const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { webcrypto } = require('node:crypto');
const root = path.join(__dirname, '..');
const OWNER = '10000000-0000-4000-8000-000000000001';
const OTHER = '10000000-0000-4000-8000-000000000002';
const id = n => '20000000-0000-4000-8000-' + String(n).padStart(12, '0');
const stamp = '2026-09-26T12:00:00.000Z';
function harness() {
  const values = new Map(), events = new EventTarget(), remote = { dossiers: [], dossier_entries: [] }, requests = [];
  let owner = OWNER, failWrite = false, failRemote = false, gate = null, uploads = 0;
  const storage = { getItem: key => values.get(key) || null, setItem(key,value) { if (failWrite) throw new Error('quota'); values.set(key,value); } };
  const client = {
    from(table) {
      const filters = [], query = { table, from:0, to:Infinity, rows:null };
      const api = { select() { return api; }, eq(key,value) { filters.push([key,value]); return api; }, order() { return api; }, range(from,to) { query.from=from;query.to=to;return api; }, upsert(rows) { query.rows=rows;return api; },
        then(resolve,reject) { return (async () => {
          requests.push({table,write:Boolean(query.rows),from:query.from});
          if (gate) { const wait=gate;gate=null;await wait; }
          if (failRemote) return { error:{code:'42P01',message:'missing'},data:null };
          if (query.rows) {
            const result=[];
            for (const row of query.rows) {
              const old=remote[table].find(item=>item.id===row.id);
              if (old && (old.updated_at > row.updated_at || old.is_archived && !row.is_archived)) {result.push(old);continue;}
              remote[table]=remote[table].filter(item=>item.id!==row.id).concat({...row});result.push({...row});
            }
            return {data:result,error:null};
          }
          return {data:remote[table].filter(row=>filters.every(([key,value])=>row[key]===value)).sort((a,b)=>a.id.localeCompare(b.id)).slice(query.from,query.to+1),error:null};
        })().then(resolve,reject); }
      }; return api;
    },
    storage: { from() { return { upload:async (path,blob)=>{uploads++;return {data:{path},error:null};}, remove:async()=>({error:null}), createSignedUrls:async paths=>({data:paths.map(path=>({path,signedUrl:'https://example.test/'+path})),error:null}) }; } }
  };
  const window = { localStorage:storage, crypto:webcrypto, navigator:{onLine:true}, HabitFlowRemote:{getClient:()=>client,getUserId:()=>owner}, setTimeout:()=>1, clearTimeout(){}, addEventListener:events.addEventListener.bind(events) };
  const context = vm.createContext({window,console:{warn(){}},URL,Blob,Uint8Array,Date,Map,Set});
  vm.runInContext(fs.readFileSync(path.join(root,'modules/state-persistence.js'),'utf8'),context);
  for(const stage of ['smoking','alcohol','points-ledger','projects'])window.HabitFlowPersistence.register(stage,{});
  vm.runInContext(fs.readFileSync(path.join(root,'modules/dossiers-store.js'),'utf8'),context);
  return { api:window.HabitFlowDossiersStore, window, values, remote, requests, storage,
    read:()=>JSON.parse(storage.getItem('habitflow-state-v1')||'{}'),
    owner(value){owner=value;events.dispatchEvent(new Event('habitflow:auth-change'));},
    failWrite(value){failWrite=value;},failRemote(value){failRemote=value;},
    pause(){let release;gate=new Promise(resolve=>release=resolve);return release;},uploads:()=>uploads
  };
}
test('dossiers and entries share the app state and survive stale app saves',()=>{
  const app=harness();
  const dossier=app.api.saveDossier({title:'Reise'});
  app.api.saveEntry({dossier_id:dossier.id,body:'Gedanke'});
  app.window.HabitFlowPersistence.writeState({tasks:[{id:'task'}]});
  assert.equal(app.api.snapshot().dossiers.length,1);assert.equal(app.api.snapshot().entries.length,1);
  assert.equal(app.read().tasks[0].id,'task');assert.deepEqual([...app.values.keys()],['habitflow-state-v1']);
});
test('quota failure does not publish an apparently saved record',()=>{
  const app=harness();let publications=0;app.api.subscribe(()=>publications++);app.failWrite(true);
  assert.throws(()=>app.api.saveDossier({title:'Never saved'}),/quota/);assert.equal(publications,0);assert.equal(app.api.snapshot().dossiers.length,0);
});
test('validation rejects empty entries, dangerous links and persistent image payloads',()=>{
  const app=harness();const dossier=app.api.saveDossier({title:'Recherche'});
  assert.throws(()=>app.api.saveEntry({dossier_id:dossier.id}),/Text/);
  for(const link of ['javascript:alert(1)','data:text/html,test','https://user:pass@example.org'])assert.throws(()=>app.api.saveEntry({dossier_id:dossier.id,body:'x',link}),/Link/);
  assert.throws(()=>app.api.saveEntry({dossier_id:dossier.id,image_path:'data:image/webp;base64,AAAA'}),/Text|Bild/);
  const row=app.api.saveEntry({dossier_id:dossier.id,link:'https://example.org',image:'data:image/webp;base64,AAAA'});
  assert.ok(!JSON.stringify(app.read()).includes('base64'));assert.equal(row.link,'https://example.org/');
});
test('pin and edit preserve chronology and project links are optional and independent',()=>{
  const app=harness();app.storage.setItem('habitflow-state-v1',JSON.stringify({projects:[{id:id(8),title:'Masterarbeit'}]}));
  const dossier=app.api.saveDossier({title:'Buch',project_id:id(8)});
  const entry=app.api.saveEntry({dossier_id:dossier.id,body:'Kapitel 1'});
  const edited=app.api.saveEntry({...entry,body:'Kapitel 2',is_pinned:true});
  assert.equal(edited.created_at,entry.created_at);assert.ok(edited.updated_at>entry.updated_at);assert.ok(edited.is_pinned);
  app.api.saveDossier({...dossier,is_archived:true});assert.equal(app.read().projects.length,1);assert.equal(app.api.snapshot().dossiers.length,0);
  assert.throws(()=>app.api.saveEntry({...entry,body:'Later'}),/Dossier/);
});
test('a tombstone wins over a newer stale active row',()=>{
  const app=harness();const row=app.api.saveDossier({title:'Old'});const archived=app.api.saveDossier({...row,is_archived:true});
  const merged=app.api.merge([archived],[{...row,updated_at:'2099-01-01T00:00:00Z'}]);assert.ok(merged[0].is_archived);
});
test('signed-out and different-account data cannot be viewed or uploaded',async()=>{
  const app=harness();app.api.saveDossier({title:'Private'});app.owner(OTHER);
  assert.equal(app.api.snapshot().dossiers.length,0);assert.equal(app.api.backup().dossiers.length,0);
  await app.api.sync();assert.ok(!app.remote.dossiers.some(row=>row.user_id===OWNER));
  app.owner('');assert.throws(()=>app.api.saveDossier({title:'no'}),/anmelden/);
});
test('sync paginates beyond the Supabase page limit and keeps tombstones',async()=>{
  const app=harness();
  app.remote.dossiers=Array.from({length:1001},(_,n)=>({id:id(n),user_id:OWNER,title:'Dossier '+n,created_at:stamp,updated_at:stamp,is_archived:n===1000}));
  await app.api.sync();assert.equal(app.api.snapshot().dossiers.length,1000);assert.equal(app.read().dossiers.length,1001);
  assert.deepEqual(app.requests.filter(row=>!row.write).map(row=>row.from),[0,500,1000]);
});
test('failed sync retains pending writes and a later retry persists them',async()=>{
  const app=harness();const dossier=app.api.saveDossier({title:'Offline'});app.failRemote(true);await app.api.sync();
  assert.equal(app.read().dossiers[0].synced,false);assert.match(app.api.snapshot().status,/eingerichtet/);
  app.failRemote(false);await app.api.sync(dossier.id);assert.equal(app.remote.dossiers.length,1);assert.equal(app.read().dossiers[0].synced,true);
});
test('edits during a sync are not acknowledged by an older response',async()=>{
  const app=harness();const dossier=app.api.saveDossier({title:'Before'});const release=app.pause();const first=app.api.sync();
  app.api.saveDossier({...dossier,title:'During'});const second=app.api.sync();release();await Promise.all([first,second]);
  assert.equal(app.api.snapshot().dossiers[0].title,'During');assert.equal(app.remote.dossiers[0].title,'During');
});
test('entries are fetched only for the opened dossier, and image signing stays out of storage',async()=>{
  const app=harness();const dossier=app.api.saveDossier({title:'Photos'});const other=app.api.saveDossier({title:'Other'});
  const image=OWNER+'/'+dossier.id+'/'+id(99)+'.webp';
  app.remote.dossier_entries=[{id:id(1),user_id:OWNER,dossier_id:dossier.id,body:'hi',image_path:image,created_at:stamp,updated_at:stamp},{id:id(2),user_id:OWNER,dossier_id:other.id,body:'other',created_at:stamp,updated_at:stamp}];
  await app.api.sync(dossier.id);assert.equal(app.api.snapshot().entries.length,1);
  const urls=await app.api.imageUrls([image,OTHER+'/bad.webp']);assert.equal(urls.size,1);
  assert.ok(!JSON.stringify(app.read()).includes('example.test'));
});
test('images use bounded blobs, synchronize the dossier first, and reject offline uploads',async()=>{
  const app=harness();const dossier=app.api.saveDossier({title:'Photos'});
  const path=await app.api.upload(new Blob(['abc'],{type:'image/webp'}),dossier.id);assert.ok(path.startsWith(OWNER+'/'+dossier.id+'/'));
  assert.equal(app.uploads(),1);assert.equal(app.remote.dossiers.length,1);
  await assert.rejects(app.api.upload(new Blob([new Uint8Array(135001)],{type:'image/webp'}),dossier.id));
  app.window.navigator.onLine=false;await assert.rejects(app.api.upload(new Blob(['abc'],{type:'image/webp'}),dossier.id),/online/);
});
