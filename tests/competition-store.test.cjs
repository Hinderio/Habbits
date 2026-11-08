const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const D=require('../modules/competition-domain.js');
const code=fs.readFileSync(require.resolve('../modules/competition-store.js'),'utf8');
function harness({owner='user-a',storage=new Map(),remote=null}={}){
 const handlers={},timers=new Map();let timer=0,fail=false;
 const window={HabitFlowCompetitionDomain:D,crypto,navigator:{onLine:true},localStorage:{get length(){return storage.size},key:i=>[...storage.keys()][i],getItem:k=>storage.get(k)||null,setItem(k,v){if(fail)throw Error('Quota');storage.set(k,v)}},HabitFlowRemote:{getUserId:()=>owner,getClient:()=>remote},setTimeout:fn=>{timers.set(++timer,fn);return timer},clearTimeout:id=>timers.delete(id),addEventListener:(name,fn)=>{(handlers[name]??=[]).push(fn)}};
 vm.runInNewContext(code,{window});
 return {store:window.HabitFlowCompetitionStore,window,storage,timers,emit(name,event={}){for(const fn of handlers[name]||[])fn(event)},setOwner(v){owner=v;this.emit('habitflow:auth-change')},setRemote(v){remote=v},failWrites(v){fail=v},flushTimers(){const batch=[...timers.values()];timers.clear();batch.forEach(f=>f())}};
}
function remoteMock(rows=[]){
 const db=new Map(rows.map(r=>[r.id,r]));let writes=0,reads=0,error=null,wait=null;
 return {db,get writes(){return writes},get reads(){return reads},set error(v){error=v},set wait(v){wait=v},from(table){assert.equal(table,'competition_events');return {
  async upsert(batch,options){assert.equal(options.ignoreDuplicates,true);writes++;if(wait)await wait;if(error)return {error};for(const row of batch)if(!db.has(row.id))db.set(row.id,{...row,created_at:new Date().toISOString()});return {error:null}},
  select(){let owner,cursor='',from=0,to=199;const query={eq(k,v){assert.equal(k,'user_id');owner=v;return this},order(){return this},range(a,b){from=a;to=b;return this},gte(k,v){cursor=v;return this},then(resolve,reject){reads++;return Promise.resolve(error?{error}:{data:[...db.values()].filter(r=>r.user_id===owner&&r.created_at>=cursor).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)).slice(from,to+1),error:null}).then(resolve,reject)}};return query}
 }}};
}
const start=h=>h.store.append(null,'start',{type:'smoke',goal:24});
test('durable first, reload and quota failure never claim success',()=>{
 const h=harness({owner:null});const e=start(h);assert.equal(h.store.snapshot().events.length,1);
 const restored=harness({owner:null,storage:h.storage});assert.equal(restored.store.snapshot().events[0].id,e.id);
 h.failWrites(true);assert.throws(()=>start(h),/Speichern fehlgeschlagen/);assert.equal(h.store.snapshot().events.length,1);assert.equal(h.store.snapshot().status,'error');
});
test('offline changes retry idempotently and restore on a second device',async()=>{
 const remote=remoteMock(),h=harness({remote});const e=start(h);h.window.navigator.onLine=false;await h.store.sync();assert.equal(h.store.snapshot().status,'offline');assert.equal(remote.writes,0);
 h.window.navigator.onLine=true;await h.store.sync();assert.equal(h.store.snapshot().pending,0);assert.equal(h.store.snapshot().status,'synced');await h.store.sync();assert.equal(remote.writes,1);
 const second=harness({remote});await second.store.sync();assert.equal(second.store.snapshot().events[0].id,e.id);assert.equal(second.store.snapshot().status,'synced');
});
test('missing migration is explicit and does not discard pending data',async()=>{
 const remote=remoteMock();remote.error={code:'PGRST205'};const h=harness({remote});start(h);await h.store.sync();assert.equal(h.store.snapshot().status,'setup');assert.equal(h.store.snapshot().events.length,1);assert.equal(h.store.snapshot().pending,1);
 remote.error=null;await h.store.sync();assert.equal(h.store.snapshot().status,'synced');
});
test('accounts and guest events stay isolated across logout and reload',async()=>{
 const remote=remoteMock(),h=harness({remote});const a=start(h);await h.store.sync();h.setOwner('user-b');assert.equal(h.store.snapshot().events.length,0);const b=start(h);await h.store.sync();h.setOwner(null);assert.equal(h.store.snapshot().events.length,0);const guest=start(h);await h.store.sync();assert.equal(remote.db.has(guest.id),false);
 h.setOwner('user-a');await h.store.sync();assert.deepEqual(Array.from(h.store.snapshot().events,e=>e.id),[a.id]);h.setOwner('user-b');assert.deepEqual(Array.from(h.store.snapshot().events,e=>e.id),[b.id]);
});
test('parallel tabs preserve separate event keys and merge on storage events',()=>{
 const storage=new Map(),a=harness({storage}),b=harness({storage});const first=start(a);b.store.snapshot();const second=start(b);
 a.emit('storage',{key:`habitflow-competition-v1:user-a:event:${second.id}`});b.emit('storage',{key:`habitflow-competition-v1:user-a:event:${first.id}`});assert.equal(a.store.snapshot().events.length,2);assert.equal(b.store.snapshot().events.length,2);
});
test('new events during an in-flight upload remain pending, then sync',async()=>{
 const remote=remoteMock();let release;remote.wait=new Promise(r=>release=r);const h=harness({remote});start(h);const flight=h.store.sync();const second=start(h);release();await flight;assert.equal(h.store.snapshot().pending,1);assert.equal(remote.db.has(second.id),false);await h.store.sync();assert.equal(h.store.snapshot().pending,0);assert.equal(remote.db.has(second.id),true);
});
test('switching accounts during sync never acknowledges or imports into new account',async()=>{
 const remote=remoteMock();let release;remote.wait=new Promise(r=>release=r);const h=harness({remote});const a=start(h);h.store.activate();const flight=h.store.sync();h.setOwner('user-b');const b=start(h);release();await flight;assert.equal(h.store.snapshot().owner,'user-b');assert.deepEqual(Array.from(h.store.snapshot().events,e=>e.id),[b.id]);assert.equal(h.store.snapshot().pending,1);assert.ok(h.timers.size>0);await h.store.sync();assert.equal(h.store.snapshot().pending,0);h.setOwner('user-a');await h.store.sync();assert.equal(h.store.snapshot().events[0].id,a.id);
});
test('pagination retrieves more than one page without dropping rows',async()=>{
 const rows=Array.from({length:405},(_,i)=>{const id=crypto.randomUUID();return {id,challenge_id:id,user_id:'user-a',kind:'start',payload:{type:'reading',goal:7},occurred_at:new Date(1700000000000+i).toISOString(),created_at:new Date(1700000000000+i).toISOString()}});
 const remote=remoteMock(rows),h=harness({remote});await h.store.sync();assert.equal(h.store.snapshot().events.length,405);assert.equal(remote.reads,3);await h.store.sync();assert.equal(h.store.snapshot().events.length,405);
});
test('a corrupt local row does not hide the remaining valid rows',()=>{
 const h=harness();h.storage.set('habitflow-competition-v1:user-a:event:broken','{');const e=start(h);const restored=harness({storage:h.storage});assert.equal(restored.store.snapshot().events[0].id,e.id);assert.equal(restored.store.snapshot().status,'error');
});
test('selected Habit link survives cloud sync and another device',async()=>{
 const remote=remoteMock(),h=harness({remote});h.store.append(null,'start',{type:'alcohol',goal:7,habit_id:'habit-alcohol'});await h.store.sync();
 const second=harness({remote});await second.store.sync();assert.equal(second.store.snapshot().events[0].payload.habit_id,'habit-alcohol');
});
