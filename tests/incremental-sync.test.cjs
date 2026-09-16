const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname,'../modules/sync-integrity.js'),'utf8');
const app = fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const window = {};
vm.runInNewContext(src,{window});
const {createDeltaSnapshotReader,mergeRemoteAuthoritative}=window.HabitFlowSyncIntegrity;
const plain=x=>JSON.parse(JSON.stringify(x));
const row=(id,points=0)=>({id,user_id:'u',points});
const payload=(fields={})=>({data:{protocol:1,table:'points_ledger',user_id:'u',mode:'delta',cursor:'2',changes:[],has_more:false,...fields},error:null});
const snapshot=(rows,fields={})=>payload({mode:'snapshot',cursor:'1',rows,...fields});
const change=(id,revision,points)=>({id,revision:String(revision),deleted:points===null,row:points===null?null:row(id,points)});
function setup(responses) {
 let user='u';const calls=[];
 const reader=createDeltaSnapshotReader({getUserId:()=>user,request:async(table,cursor)=>{calls.push({table,cursor});const next=responses.shift();if(next instanceof Error)throw next;return typeof next==='function'?next():next;}});
 return {reader,calls,setUser:id=>{user=id;}};
}
test('deltas reconstruct complete snapshots, including explicit deletes and unchanged records',async()=>{
 const {reader,calls}=setup([snapshot([row('a',1),row('b',2),row('c',3)]),payload({cursor:'4',changes:[change('a',2,10),change('b',3,null),change('d',4,4)]}),payload({cursor:'4'})]);
 const first=await reader.read('points_ledger');first.data[0].points=999;
 const second=await reader.read('points_ledger');assert.equal(second.complete,true);
 assert.deepEqual(plain(second.data),[row('a',10),row('c',3),row('d',4)]);
 const third=await reader.read('points_ledger');assert.deepEqual(plain(third.data),plain(second.data));
 assert.deepEqual(calls.map(c=>c.cursor),[null,'1','4']);
 const merged=mergeRemoteAuthoritative([{id:'pending',synced:false},{id:'b',synced:true}],second.data,r=>({...r,synced:true}));
 assert.deepEqual(Array.from(merged,r=>r.id),['a','c','d','pending']);
});
test('failed later delta page never advances the cached base or exposes a partial result',async()=>{
 const {reader,calls}=setup([snapshot([row('a')]),payload({cursor:'2',has_more:true,changes:[change('a',2,null)]}),{error:{message:'offline'}},payload({cursor:'3',changes:[change('a',2,null),change('b',3,4)]})]);
 await reader.read('points_ledger');await assert.rejects(reader.read('points_ledger'));
 assert.deepEqual(plain((await reader.read('points_ledger')).data),[row('b',4)]);
 assert.deepEqual(calls.map(c=>c.cursor),[null,'1','2','1']);
});
test('rejects invalid payloads instead of using them as deletion authority',async()=>{
 for(const bad of [
  payload({mode:'unknown'}),payload({user_id:'other'}),payload({table:'tasks'}),payload({protocol:2}),
  payload({cursor:'0'}),payload({cursor:'1',has_more:true}),payload({changes:[change('a',3,4)]}),
  payload({changes:[change('a',2,4),change('b',2,5)]}),payload({changes:[{...change('a',2,4),row:null}]}),
  payload({changes:[{...change('a',2,4),row:{...row('a'),user_id:'other'}}]}),snapshot([row('a'),row('a')]),
  snapshot([row('a')],{has_more:true})
 ]) {
  const {reader}=setup([snapshot([row('a')]),bad]);await reader.read('points_ledger');await assert.rejects(reader.read('points_ledger'));
 }
});
test('new account and explicit reset require new snapshots and discard in-flight results',async()=>{
 let resolve;const {reader,calls,setUser}=setup([()=>new Promise(r=>{resolve=r;}),snapshot([{id:'b',user_id:'v'}],{user_id:'v'})]);
 const old=reader.read('points_ledger');setUser('v');reader.reset();resolve(snapshot([row('a')]));await assert.rejects(old,/account/);
 const next=await reader.read('points_ledger');assert.equal(next.data[0].user_id,'v');assert.deepEqual(calls.map(c=>c.cursor),[null,null]);
});
test('read requested after a write performs a fresh query after an earlier in-flight read',async()=>{
 let resolve;const {reader,calls}=setup([()=>new Promise(r=>{resolve=r;}),payload({changes:[change('b',2,4)]})]);
 const before=reader.read('points_ledger');const after=reader.read('points_ledger');resolve(snapshot([row('a')]));
 await before;assert.deepEqual(Array.from((await after).data,r=>r.id),['a','b']);assert.equal(calls.length,2);
});
test('missing migration backs off the optional RPC; transient errors remain retryable',async()=>{
 const {reader,calls}=setup([{error:{code:'PGRST202',message:'function missing'}}]);await assert.rejects(reader.read('points_ledger'));assert.equal(await reader.read('tasks'),null);assert.equal(calls.length,1);
 const other=setup([{error:{code:'503'}},snapshot([row('a')])]);await assert.rejects(other.reader.read('points_ledger'));assert.equal((await other.reader.read('points_ledger')).complete,true);
});
test('server may replace a stale cursor with a fresh full snapshot',async()=>{
 const {reader}=setup([snapshot([row('a')],{cursor:'100'}),snapshot([row('b')],{cursor:'0'})]);await reader.read('points_ledger');assert.deepEqual(Array.from((await reader.read('points_ledger')).data,r=>r.id),['b']);
});
test('client accepts old servers and never merges failed or partial mobile snapshots',async()=>{
 const block=name=>app.match(new RegExp(`  (?:async )?function ${name}\\([^]*?\\n  \\}`))[0];
 const c=vm.createContext({remoteRows:(_,r)=>r.data});vm.runInContext(block('remoteRowsForMobileConsumption'),c);
 for(const result of [{data:[]},{data:[],complete:false},{data:[],complete:true,error:new Error('offline')}]) assert.throws(()=>c.remoteRowsForMobileConsumption(result));
 assert.deepEqual(c.remoteRowsForMobileConsumption({data:[row('a')],complete:true}),[row('a')]);
 vm.runInContext(block('cigaretteSnapshotFingerprint'),c);
 const cigarette={id:'a',smoked_at:'2026-09-16',points:10};assert.notEqual(c.cigaretteSnapshotFingerprint([cigarette]),c.cigaretteSnapshotFingerprint([{...cigarette,points:20}]));
});
test('SQL keeps journal private, reads with RLS and one snapshot, and tracks all twelve tables',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../sql/add-incremental-sync.sql'),'utf8');
 assert.match(sql,/stable security invoker set search_path = ''/);
 assert.match(sql,/revoke all on public\.habitflow_sync_clock, public\.habitflow_sync_changes from public, anon, authenticated/);
 assert.match(sql,/for select to authenticated using \(user_id = \(select auth\.uid\(\)\)\)/);
 assert.match(sql,/for each statement execute function public\.habitflow_sync_lock_writer/);
 assert.match(sql,/for each row execute function public\.habitflow_sync_track_row/);
 for(const table of ['habit_definitions','habit_entries','tasks','cigarette_events','alcohol_logs','alcohol_events','task_ideas','appointments','points_ledger','pause_periods','weekly_reviews','monthly_missions']) assert.ok(sql.includes(`'${table}'`));
 assert.doesNotMatch(sql,/delete from public\.(?:habit_definitions|habit_entries|points_ledger|cigarette_events)/i);
});
test('fetchRemoteTable uses complete deltas, falls back on missing RPC, and rejects legacy reads from an old account',async()=>{
 const block=app.match(/  async function fetchRemoteTable\(table\) \{[^]*?\n  \}/)[0];
 let user='u',legacy=0,rpc=0,mode='missing',finish;
 const c=vm.createContext({
  window:{HabitFlowSyncIntegrity:{...window.HabitFlowSyncIntegrity,fetchAllRows:async()=>{legacy++;if(mode==='wait')await new Promise(r=>{finish=r;});return {data:[row('legacy')],complete:true,error:null};}}},
  supabaseClient:{rpc:async(table,args)=>{rpc++;return mode==='missing'?{error:{code:'PGRST202'}}:snapshot([row('rpc')],{table:args.p_table});}},
  remoteDeltaReader:null,remoteDeltaClient:null,currentUserId:()=>user,
  remoteTaskIdeasSupported:true,remotePausePeriodsSupported:true,remoteWeeklyReviewsSupported:true,remoteMonthlyMissionsSupported:true,
  REMOTE_TABLE_PAGE_SIZE:1000,OPTIONAL_SYNC_TABLES:new Set(),console:{warn(){}}
 });
 vm.runInContext(block,c);
 assert.equal((await c.fetchRemoteTable('points_ledger')).data[0].id,'legacy');assert.equal(legacy,1);assert.equal(rpc,1);
 await c.fetchRemoteTable('tasks');assert.equal(rpc,1);
 c.remoteDeltaReader=null;mode='rpc';assert.equal((await c.fetchRemoteTable('points_ledger')).data[0].id,'rpc');assert.equal(legacy,2);
 c.remoteDeltaReader=null;c.supabaseClient.rpc=null;mode='wait';const stale=c.fetchRemoteTable('points_ledger');user='v';finish();await assert.rejects(stale,/Konto/);
});
