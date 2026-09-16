const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../modules/points-ledger-sync-guard.js'),'utf8');
const block=source.match(/  async function resolveExistingLedgerIds\([^]*?\n  \}/)[0];
const context=vm.createContext({});vm.runInContext(block,context);
const uuid=i=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
function fake(rows,{cap=1000,fail=false}={}){
 const calls=[];
 const from=()=>{
  const q={filters:[],from:0,to:999,ids:[]};calls.push(q);
  const builder={select(){return this;},eq(k,v){q.filters.push([k,v]);return this;},in(k,v){q.ids=v;return this;},order(){return this;},range(a,b){q.from=a;q.to=b;return this;},then(resolve,reject){
   const matching=rows.filter(r=>q.ids.includes(r.source_id)&&q.filters.every(([k,v])=>r[k]===v)).sort((a,b)=>a.id.localeCompare(b.id));
   return Promise.resolve(fail?{error:Error('offline')}:{data:matching.slice(q.from,Math.min(q.to+1,q.from+cap)),count:matching.length,error:null}).then(resolve,reject);
  }};return builder;
 };
 return {from,calls};
}
test('100 source IDs use one lookup and reuse existing remote IDs without mutating input',async()=>{
 const input=Array.from({length:100},(_,i)=>({id:uuid(i+1000),source_id:uuid(i),source_type:'habit',user_id:'u',points:i}));
 const remote=input.map((r,i)=>({...r,id:uuid(i+2000)}));const {from,calls}=fake(remote);
 const prepared=await context.resolveExistingLedgerIds(from,input);assert.equal(calls.length,1);assert.deepEqual(Array.from(prepared,r=>r.id),remote.map(r=>r.id));assert.equal(input[0].id,uuid(1000));
});
test('batches are bounded, users/types stay separate and capped responses are fully paginated',async()=>{
 const input=Array.from({length:230},(_,i)=>({id:uuid(i),source_id:uuid(i+1000),source_type:'habit',user_id:'u'}));
 input.push({...input[0],user_id:'v'},{...input[0],source_type:'task'},{id:'manual',source_id:null,source_type:'manual'});
 const remote=input.filter(r=>r.source_id).map((r,i)=>({...r,id:uuid(i+2000)}));const {from,calls}=fake(remote,{cap:40});
 const prepared=await context.resolveExistingLedgerIds(from,input);assert.deepEqual(Array.from(prepared.slice(0,-1),r=>r.id),remote.map(r=>r.id));assert.equal(prepared.at(-1).id,'manual');assert.ok(calls.every(q=>q.ids.length<=100));assert.equal(calls.length,9);
});
test('lookup failure rejects preparation instead of inserting possible duplicates',async()=>{
 const {from}=fake([],{fail:true});await assert.rejects(context.resolveExistingLedgerIds(from,[{id:uuid(1),source_id:uuid(2),source_type:'habit'}]),/offline/);
});
test('empty/identity-free batches do not read remote rows',async()=>{
 const {from,calls}=fake([]);const result=await context.resolveExistingLedgerIds(from,[{id:'manual',source_id:null}]);assert.equal(result.length,1);assert.equal(calls.length,0);
});
test('upsert wrapper keeps normalization/options and does not write on lookup failure',async()=>{
 const writes=[];let failing=false;
 const id=uuid(1),sourceId=uuid(2),existingId=uuid(3);
 const remote=[{id:existingId,source_id:sourceId,source_type:'habit',user_id:'u'}];
 const client={from(){
   const original=fake(remote,{fail:failing}).from();
   original.upsert=async(rows,options)=>{writes.push({rows,options});return {data:rows,error:null};};
   return original;
 }};
 const window={supabase:{createClient:()=>client},localStorage:{getItem:()=>null,setItem(){}},setTimeout(){}};
 vm.runInNewContext(source,{window,document:{},console});
 const guarded=window.supabase.createClient();
 const one=await guarded.from('points_ledger').upsert({id,source_id:sourceId,source_type:'habit',user_id:'u'},{ignoreDuplicates:true});
 assert.equal(one.data.id,existingId);assert.equal(writes[0].options.onConflict,'id');assert.equal(writes[0].options.ignoreDuplicates,true);
 failing=true;const failed=await guarded.from('points_ledger').upsert([{id,source_id:sourceId,source_type:'habit',user_id:'u'}]);
 assert.ok(failed.error);assert.equal(writes.length,1);
});
test('UUID source matching preserves PostgreSQL case-insensitive UUID semantics',async()=>{
 const sourceId='abcdefab-0000-4000-8000-abcdefabcdef';
 const {from}=fake([{id:uuid(3),user_id:'u',source_type:'habit',source_id:sourceId}]);
 const result=await context.resolveExistingLedgerIds(from,[{id:uuid(1),user_id:'u',source_type:'habit',source_id:sourceId.toUpperCase()}]);
 assert.equal(result[0].id,uuid(3));
});
