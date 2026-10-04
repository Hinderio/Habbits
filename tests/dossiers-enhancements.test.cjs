const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../modules/dossiers.js'),'utf8');
function ui() {
  const nodes=new Map(),observers=[],listeners=new Map(),frames=[];let focused='',scrolled='';
  const node=key=>{if(!nodes.has(key))nodes.set(key,{textContent:'',innerHTML:'',value:'',hidden:false,isConnected:true,setAttribute(k,v){this[k]=v;},focus(){focused=key;},querySelector:node,scrollIntoView(){scrolled=key;}});return nodes.get(key);};
  const data={status:'synchronisiert',projects:[],tasks:[],metrics:{d:{count:105,exact:true,updated_at:'2026-10-04T12:00:00Z'}},dossiers:[{id:'d',title:'Education',description:'Notes',updated_at:'2026-09-26T00:00:00Z',icon_key:'education',linked_task_ids:[]}],entries:Array.from({length:105},(_,i)=>({id:'e'+i,dossier_id:'d',title:'Entry '+i,body:'Body '+i,created_at:new Date(Date.UTC(2026,0,1,0,i)).toISOString(),updated_at:'2026-10-04T00:00:00Z'}))};
  const tasksModal={hidden:true,classList:{contains(){return tasksModal.hidden;}}};
  const dialog={open:true,scrollTop:123,querySelector:node,querySelectorAll(selector){if(selector==='[data-entry-id]')return [...node('[data-entry-list]').innerHTML.matchAll(/data-entry-id="([^"]+)"/g)].map(m=>({dataset:{entryId:m[1]},querySelector:()=>node('summary-'+m[1]),scrollIntoView(){scrolled=m[1];}}));return [];},showModal(){this.open=true;},close(){this.open=false;}};
  const window={HabitFlowDossiersStore:{snapshot:()=>data,safeLink:value=>value||''},requestAnimationFrame(callback){frames.push(callback);return 1;},confirm:()=>true};
  const document={readyState:'loading',addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);},getElementById:()=>tasksModal};
  class MutationObserver {constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}
  const injection=`window.enhanceTest={fillHeader,headerHasDraft,headerChanges,icon,iconPicker,entryModel,renderIndex,jumpEntry,taskOptions,renderTasks,suspendForTask,clearTaskReturn,refresh,setup(p,d){pane=p;dialog=d;active='d';view='dossiers';},index(value){indexOpen=value;},search(value){indexQuery=value.toLocaleLowerCase("de");},limit(value){indexLimit=value;},order(value){order=value;},page(){return page;}};`;
  vm.runInNewContext(source.replace('  function mount() {','  '+injection+'\n  function mount() {'),{window,document,URL,Date,MutationObserver});
  window.enhanceTest.setup({querySelector:node},dialog);
  return {api:window.enhanceTest,data,node,dialog,tasksModal,observers,listeners,frames,focused:()=>focused,scrolled:()=>scrolled};
}
test('six labelled SVG icons use whitelisted markup and safe default',()=>{
  const h=ui();const picker=h.api.iconPicker();assert.equal((picker.match(/type="radio"/g)||[]).length,6);
  for(const label of ['Education','Ferien','Arbeit','Freizeit','Sport','Life'])assert.ok(picker.includes(label));
  assert.ok(!h.api.icon('<img onerror=bad>').includes('onerror'));assert.match(h.api.icon('education'),/<svg/);
});
test('overview includes server metrics without requiring local entry bodies',()=>{
  const h=ui();h.data.entries=[];h.api.refresh();const html=h.node('[data-dossier-grid]').innerHTML;
  assert.match(html,/Letztes Update/);assert.match(html,/>105<\/strong>/);assert.match(html,/4\. Okt\.|04\.10\.|04\. Okt\./);assert.match(html,/dossier-symbol-education/);
});
test('title index searches all pages while bounding DOM and jumps to the matching page',()=>{
  const h=ui();h.api.index(true);h.api.refresh();let html=h.node('[data-entry-index-list]').innerHTML;
  assert.equal((html.match(/data-dossier-action="jump-entry"/g)||[]).length,100);assert.equal(h.node('[data-dossier-action="index-more"]').hidden,false);
  h.api.search('Entry 0');h.api.refresh();assert.match(h.node('[data-entry-index-list]').innerHTML,/Seite 6/);
  h.api.jumpEntry('e0');assert.equal(h.api.page(),5);assert.match(h.node('[data-entry-list]').innerHTML,/data-entry-disclosure="e0" open/);assert.equal(h.scrolled(),'e0');assert.equal(h.focused(),'summary-e0');
  h.api.order('oldest');h.api.jumpEntry('e0');assert.equal(h.api.page(),0);
});
test('all remaining titles can be revealed and index labels escape stored markup',()=>{
  const h=ui();h.data.entries[0].title='<script>bad</script>';h.api.index(true);h.api.limit(200);h.api.refresh();
  const html=h.node('[data-entry-index-list]').innerHTML;assert.equal((html.match(/data-dossier-action="jump-entry"/g)||[]).length,105);assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);
});
test('task search covers tasks beyond initial options, excludes linked tasks and offers unlink for missing tasks',()=>{
  const h=ui();h.data.tasks=Array.from({length:101},(_,i)=>({id:'t'+i,title:'Task '+i,status:i===100?'done':'open'}));h.data.dossiers[0].linked_task_ids=['t0','missing'];h.api.refresh();
  assert.equal((h.node('[data-task-choice]').innerHTML.match(/<option/g)||[]).length,51);
  assert.match(h.node('[data-linked-tasks]').innerHTML,/Task nicht mehr verfügbar/);assert.match(h.node('[data-linked-tasks]').innerHTML,/data-id="missing"/);
  h.node('[data-task-query]').value='Task 100';h.api.taskOptions(h.data,h.data.dossiers[0]);assert.match(h.node('[data-task-choice]').innerHTML,/Task 100 · Erledigt/);
  assert.ok(!h.node('[data-task-choice]').innerHTML.includes('value="t0"'));
});
test('closing a linked task restores the same dossier, scroll position and trigger with one observer',()=>{
  const h=ui(),trigger=h.node('task-trigger');h.api.suspendForTask(trigger);assert.equal(h.dialog.open,false);assert.equal(h.observers.length,1);
  h.tasksModal.hidden=false;h.frames.shift()();assert.equal(h.dialog.open,false);
  h.tasksModal.hidden=true;h.observers[0].callback();assert.equal(h.dialog.open,true);assert.equal(h.dialog.scrollTop,123);assert.equal(h.focused(),'task-trigger');assert.equal(h.observers[0].disconnected,true);assert.equal(h.listeners.has('click'),false);
});
test('failed task opening restores the dossier and cancelling return disconnects the observer',()=>{
  const h=ui();h.api.suspendForTask(h.node('trigger'));h.frames.shift()();assert.equal(h.dialog.open,true);
  h.api.suspendForTask(h.node('trigger'));h.api.clearTaskReturn();h.observers[1].callback();assert.equal(h.dialog.open,false);assert.equal(h.observers[1].disconnected,true);
});

test('clean dossier fields follow sync; dirty fields save only their own changes',()=>{
  const h=ui();
  h.node('[data-dossier-form]').elements=Object.fromEntries(['title','description','project_id','icon_key'].map(key=>[key,{value:''}]));
  h.api.fillHeader(h.data.dossiers[0]);
  h.data.dossiers=[{...h.data.dossiers[0],title:'Remote title',icon_key:'holiday'}];
  h.api.refresh();
  const form=h.node('[data-dossier-form]');
  assert.equal(form.elements.icon_key.value,'holiday');
  assert.equal(form.elements.title.value,'Remote title');
  assert.equal(h.api.headerHasDraft(),false);
  form.elements.description.value='My draft';
  h.data.dossiers=[{...h.data.dossiers[0],title:'Another title',icon_key:'sport'}];
  h.api.refresh();
  assert.equal(form.elements.description.value,'My draft');
  assert.deepEqual(JSON.parse(JSON.stringify(h.api.headerChanges())),{description:'My draft'});
});
test('cards reserve the project row and put a bare icon after the heading',()=>{
  const h=ui();h.data.projects=[{id:'p',title:'MAS Arbeit'}];
  h.data.dossiers=[h.data.dossiers[0],{...h.data.dossiers[0],id:'other',project_id:'p'}];h.api.refresh();
  const html=h.node('[data-dossier-grid]').innerHTML;
  assert.equal((html.match(/class="dossier-card-project subtle"/g)||[]).length,2);
  assert.ok(!html.includes('<small>Dossier</small>'));
  assert.ok(html.includes('<h3>Education</h3><span class="dossier-symbol'));
});
