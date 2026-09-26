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
function harness({ legacy = false } = {}) {
  const counts = { writes: 0, parses: 0, serializes: 0 };
  const values = new Map(), events = new EventTarget(), remote = { dossiers: [], dossier_entries: [] }, requests = [];
  let owner = OWNER, failWrite = false, failRemote = false, gate = null, uploads = 0, beforeRequest = null, uploadError = null, titleColumn = true;
  const storage = { getItem: key => values.get(key) || null, setItem(key,value) { if (failWrite) throw new Error('quota'); counts.writes++; values.set(key,value); } };
  const client = {
    from(table) {
      const filters = [], query = { table, from:0, to:Infinity, rows:null };
      const api = { select() { return api; }, eq(key,value) { filters.push([key,value]); return api; }, order() { return api; }, range(from,to) { query.from=from;query.to=to;return api; }, upsert(rows) { query.rows=rows;return api; },
        then(resolve,reject) { return (async () => {
          requests.push({table,write:Boolean(query.rows),from:query.from});
          if(beforeRequest)await beforeRequest(query);
          if (gate) { const wait=gate;gate=null;await wait; }
          if (failRemote) return { error:{code:'42P01',message:'missing'},data:null };
          if (query.rows) {
            if(!titleColumn && table==='dossier_entries' && query.rows.some(row=>Object.hasOwn(row,'title')))return {data:null,error:{code:'PGRST204',message:'title column missing'}};
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
    storage: { from() { return { upload:async (path,blob)=>{uploads++;return {data:{path},error:uploadError};}, remove:async()=>({error:null}), createSignedUrls:async paths=>({data:paths.map(path=>({path,signedUrl:'https://example.test/'+path})),error:null}) }; } }
  };
  const window = { localStorage:storage, crypto:webcrypto, navigator:{onLine:true}, HabitFlowRemote:{getClient:()=>client,getUserId:()=>owner}, setTimeout:()=>1, clearTimeout(){}, addEventListener:events.addEventListener.bind(events) };
  const trackedJSON = { parse(value) { counts.parses++; return JSON.parse(value); }, stringify(value) { counts.serializes++; return JSON.stringify(value); } };
  const context = vm.createContext({window,console:{warn(){}},URL,Blob,Uint8Array,Date,Map,Set,JSON:trackedJSON});
  vm.runInContext(fs.readFileSync(path.join(root,'modules/state-persistence.js'),'utf8'),context);
  for(const stage of ['smoking','alcohol','points-ledger','projects'])window.HabitFlowPersistence.register(stage,{});
  vm.runInContext(fs.readFileSync(path.join(root,legacy ? 'tests/fixtures/dossiers-store-before-performance.js' : 'modules/dossiers-store.js'),'utf8'),context);
  return { counts, resetCounts() { counts.writes=counts.parses=counts.serializes=0; }, api:window.HabitFlowDossiersStore, window, values, remote, requests, storage,
    read:()=>JSON.parse(storage.getItem('habitflow-state-v1')||'{}'),
    owner(value){owner=value;events.dispatchEvent(new Event('habitflow:auth-change'));},
    titleColumn(value){titleColumn=value;},uploadError(value){uploadError=value;},beforeRequest(callback){beforeRequest=callback;},failWrite(value){failWrite=value;},failRemote(value){failRemote=value;},
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

test('unchanged snapshots reuse normalized rows without whole-app JSON work', () => {
  const app=harness(); app.api.saveDossier({title:'Stable'});
  const first=app.api.snapshot(); app.resetCounts();
  for(let i=0;i<30;i++){const next=app.api.snapshot();assert.equal(next.dossiers,first.dossiers);assert.equal(next.entries,first.entries);}
  assert.deepEqual(app.counts,{writes:0,parses:0,serializes:0});
});
test('native storage changes invalidate the snapshot, and it cannot be mutated by a consumer', () => {
  const app=harness();const row=app.api.saveDossier({title:'Initial'});const first=app.api.snapshot();
  assert.ok(Object.isFrozen(first.dossiers));assert.ok(Object.isFrozen(first.dossiers[0]));
  const raw=JSON.parse(app.values.get('habitflow-state-v1'));raw.dossiers[0].title='Other tab';
  app.values.set('habitflow-state-v1',JSON.stringify(raw));
  assert.equal(app.api.snapshot().dossiers[0].title,'Other tab');
  app.values.delete('habitflow-state-v1');assert.equal(app.api.snapshot().dossiers.length,0);
});
test('unchanged sync performs zero writes instead of rewriting the whole app', async () => {
  const app=harness();const dossier=app.api.saveDossier({title:'Ready'});await app.api.sync(dossier.id);app.resetCounts();
  await app.api.sync(dossier.id);assert.equal(app.counts.writes,0);assert.equal(app.counts.serializes,0);
});
test('all fetched records and successful batches commit in one durable write', async () => {
  const app=harness();const dossier=app.api.saveDossier({title:'Ready'});await app.api.sync();
  app.remote.dossier_entries=Array.from({length:501},(_,n)=>({id:id(n),user_id:OWNER,dossier_id:dossier.id,body:'Entry '+n,created_at:stamp,updated_at:stamp}));
  app.resetCounts();await app.api.sync(dossier.id);
  assert.equal(app.counts.writes,1);assert.equal(app.api.snapshot().entries.length,501);
});
test('duplicate simultaneous sync calls share requests, but changing the dossier schedules one follow-up', async () => {
  const app=harness();const first=app.api.saveDossier({title:'A'}),second=app.api.saveDossier({title:'B'});await app.api.sync();
  app.requests.length=0;const release=app.pause();const pending=app.api.sync(first.id);
  for(let i=0;i<10;i++)assert.equal(app.api.sync(first.id),pending);
  release();await pending;assert.equal(app.requests.filter(r=>r.table==='dossiers'&&!r.write).length,1);
  app.requests.length=0;const releaseAgain=app.pause();const changed=app.api.sync(first.id);app.api.sync(second.id);releaseAgain();await changed;
  assert.equal(app.requests.filter(r=>r.table==='dossiers'&&!r.write).length,2);
});
test('a concurrent local edit survives a delayed response to the previous version', async () => {
  const app=harness();const dossier=app.api.saveDossier({title:'Initial'});await app.api.sync();
  const entry=app.api.saveEntry({dossier_id:dossier.id,body:'Before'});await app.api.sync(dossier.id);
  const release=app.pause();const pending=app.api.sync(dossier.id);
  app.api.saveEntry({...entry,body:'Edited while loading'});release();await pending;
  assert.equal(app.api.snapshot().entries[0].body,'Edited while loading');
  await app.api.sync(dossier.id);assert.equal(app.remote.dossier_entries[0].body,'Edited while loading');
});
test('synthetic large-state snapshot benchmark compares the previous implementation', () => {
  const data={projects:[],dossiers:[{id:id(9000),user_id:OWNER,title:'Research',created_at:stamp,updated_at:stamp,synced:true}],
    dossierEntries:Array.from({length:2000},(_,n)=>({id:id(n),user_id:OWNER,dossier_id:id(9000),body:'Research '.repeat(100),created_at:stamp,updated_at:stamp,synced:true})),
    activityIdeas:Array.from({length:10000},(_,n)=>({id:n,title:'Unrelated data '.repeat(20)}))};
  const results=[];
  for(const legacy of [true,false]){const app=harness({legacy});app.values.set('habitflow-state-v1',JSON.stringify(data));app.api.snapshot();app.resetCounts();
    const start=performance.now();for(let n=0;n<25;n++)app.api.snapshot();results.push({legacy,ms:Math.round(performance.now()-start),...app.counts});}
  assert.ok(results[0].parses>=25);assert.equal(results[1].parses,0);assert.equal(results[1].writes,0);
  console.log('Dossier snapshot benchmark (25 warm reads):',JSON.stringify(results));
});

test('a delayed upsert acknowledgment cannot mark a newer edit synced',async()=>{
  const app=harness();const dossier=app.api.saveDossier({title:'Original'});
  let reached,release;const started=new Promise(resolve=>reached=resolve),gate=new Promise(resolve=>release=resolve);
  app.beforeRequest(async query=>{if(query.rows){app.beforeRequest(null);reached();await gate;}});
  const pending=app.api.sync();await started;app.api.saveDossier({...dossier,title:'Newer edit'});release();await pending;
  assert.equal(app.api.snapshot().dossiers[0].title,'Newer edit');assert.equal(app.read().dossiers[0].synced,false);
  await app.api.sync();assert.equal(app.remote.dossiers[0].title,'Newer edit');assert.equal(app.read().dossiers[0].synced,true);
});
test('partial sync failure retains acknowledged headers and pending entries',async()=>{
  const app=harness();const dossier=app.api.saveDossier({title:'Pending'});app.api.saveEntry({dossier_id:dossier.id,body:'Pending entry'});
  app.beforeRequest(query=>{if(query.table==='dossier_entries')app.failRemote(true);});await app.api.sync();
  assert.equal(app.read().dossiers[0].synced,true);assert.equal(app.read().dossierEntries[0].synced,false);
  app.beforeRequest(null);app.failRemote(false);await app.api.sync();assert.equal(app.read().dossierEntries[0].synced,true);
});
test('quota failure during acknowledgment keeps the durable local edit available for retry',async()=>{
  const app=harness();app.api.saveDossier({title:'Durable'});app.failWrite(true);await app.api.sync();
  assert.equal(app.read().dossiers[0].title,'Durable');assert.equal(app.read().dossiers[0].synced,false);
  app.failWrite(false);await app.api.sync();assert.equal(app.read().dossiers[0].synced,true);
});

test('image upload distinguishes missing setup and denied storage while preserving the draft',async()=>{
  const app=harness();const dossier=app.api.saveDossier({title:'Photos'});const blob=new Blob(['abc'],{type:'image/webp'});
  app.failRemote(true);await assert.rejects(app.api.upload(blob,dossier.id),/Synchronisierung ist noch nicht eingerichtet/);assert.equal(app.uploads(),0);
  app.failRemote(false);app.uploadError({message:'Bucket not found'});await assert.rejects(app.api.upload(blob,dossier.id),/Bildspeicher.*nicht eingerichtet/);
  app.uploadError({statusCode:'403',message:'new row violates row-level security policy'});await assert.rejects(app.api.upload(blob,dossier.id),/Upload abgelehnt/);
  app.uploadError(null);assert.match(await app.api.upload(blob,dossier.id),/webp$/);
});

test('image upload remains possible through a legacy storage wrapper',async()=>{
  const app=harness();const native=app.storage.setItem.bind(app.storage);
  app.storage.setItem=(key,value)=>native(key,value);
  assert.equal(app.window.HabitFlowPersistence.isReady(),false);
  const dossier=app.api.saveDossier({title:'Photo dossier'});
  await app.api.sync(dossier.id);
  assert.equal(app.remote.dossiers.length,1);
  assert.equal(app.read().dossiers[0].synced,true,'remote acknowledgment must survive the legacy writer');
  const path=await app.api.upload(new Blob(['abc'],{type:'image/webp'}),dossier.id);
  assert.ok(path.endsWith('.webp'));
});

test('acknowledgments win only for identical versions regardless of merge direction',()=>{
  const app=harness();const pending=app.api.saveDossier({title:'Original'}),ack={...pending,synced:true};
  for(const rows of [[pending,ack],[ack,pending]])assert.equal(app.api.merge([rows[0]],[rows[1]])[0].synced,true);
  const newer={...pending,title:'Edited',updated_at:new Date(Date.parse(pending.updated_at)+1).toISOString()};
  for(const rows of [[newer,ack],[ack,newer]]){const merged=app.api.merge([rows[0]],[rows[1]])[0];assert.equal(merged.title,'Edited');assert.equal(merged.synced,false);}
  const different={...pending,title:'Different content at same timestamp'};
  assert.equal(app.api.merge([ack],[different])[0].synced,false);
});
test('legacy writes cannot revert an acknowledged entry but newer edits remain pending',async()=>{
  const app=harness();const original=app.storage.setItem.bind(app.storage);app.storage.setItem=(key,value)=>original(key,value);
  const dossier=app.api.saveDossier({title:'Photos'});const entry=app.api.saveEntry({dossier_id:dossier.id,body:'Initial'});
  const stale=app.read();await app.api.sync(dossier.id);assert.equal(app.read().dossierEntries[0].synced,true);
  app.window.HabitFlowPersistence.writeState(stale);assert.equal(app.read().dossierEntries[0].synced,true);
  app.api.saveEntry({...entry,body:'Updated offline'});assert.equal(app.read().dossierEntries[0].synced,false);
  await app.api.sync(dossier.id);assert.equal(app.remote.dossier_entries[0].body,'Updated offline');assert.equal(app.read().dossierEntries[0].synced,true);
});

test('a real server failure exposes its code without leaking record contents',async()=>{
  const app=harness();const dossier=app.api.saveDossier({title:'Private title'});
  app.beforeRequest(query=>{if(query.rows)throw Object.assign(new Error('Private database record'),{code:'23503'});});
  await assert.rejects(app.api.upload(new Blob(['abc'],{type:'image/webp'}),dossier.id),error=>{
    assert.match(error.message,/dossiers, 23503/);assert.ok(!error.message.includes('Private'));return true;
  });
  assert.equal(app.uploads(),0);assert.equal(app.read().dossiers[0].synced,false);
});

test('entry titles survive edits, sync, reload and explicit clearing',async()=>{
  const app=harness();const dossier=app.api.saveDossier({title:'Research'});
  let entry=app.api.saveEntry({dossier_id:dossier.id,title:'Summary',body:'Content'});await app.api.sync(dossier.id);
  assert.equal(app.remote.dossier_entries[0].title,'Summary');assert.equal(app.api.snapshot().entries[0].title,'Summary');
  entry=app.api.saveEntry({...entry,title:''});await app.api.sync(dossier.id);assert.equal(app.remote.dossier_entries[0].title,'');
  assert.equal(app.api.normalize({...entry,title:undefined},true).title,'');
  assert.equal(app.api.normalize({...entry,title:'a'.repeat(200)},true).title.length,120);
});

test('before title migration, untitled entries sync and titled entries stay pending without losing their title',async()=>{
  const app=harness();app.titleColumn(false);const dossier=app.api.saveDossier({title:'Old schema'});
  app.api.saveEntry({dossier_id:dossier.id,body:'Untitled'});await app.api.sync(dossier.id);assert.equal(app.read().dossierEntries[0].synced,true);
  const titled=app.api.saveEntry({dossier_id:dossier.id,title:'Keep me',body:'Content'});await app.api.sync(dossier.id);
  assert.equal(app.read().dossierEntries.find(r=>r.id===titled.id).synced,false);assert.match(app.api.snapshot().status,/Datenbank-Update/);
  app.titleColumn(true);await app.api.sync(dossier.id);assert.equal(app.remote.dossier_entries.find(r=>r.id===titled.id).title,'Keep me');
});
