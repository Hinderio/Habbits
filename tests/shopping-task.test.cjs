const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { webcrypto } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const listSource = fs.readFileSync(path.join(root, 'modules/lists.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function listHarness() {
  const storage = new Map();
  let serial = 0;
  const document = {
    querySelector: () => null, getElementById: () => null, addEventListener() {},
    body: { classList: { add() {}, remove() {} } }
  };
  const window = {
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    addEventListener() {}, setTimeout, clearTimeout,
    crypto: { randomUUID: () => 'gift-test-' + (++serial) }
  };
  const hooks = 'window.testShopping = { saveShopping, handleShoppingAction, renderShoppingRow, getState: () => state };';
  vm.runInNewContext(listSource.replace('})(window, document);', hooks + '\n})(window, document);'), {
    window, document, console, Date, Intl, Map, Set, Math, URL, Event, setTimeout, clearTimeout,
    FormData: class { constructor(form) { this.values = form.values; } get(name) { return this.values[name]; } }
  });
  const form = (values, id = '') => ({ values, dataset: { editingId: id }, reset() {}, elements: { person: { focus() {} }, title: { focus() {} } } });
  return { api: window.testShopping, window, form };
}


test('shopping links once, opens its task, and preserves metadata on edits', async () => {
 const {api, window, form}=listHarness();
 api.saveShopping(form({title:'Sofa',category:'Wohnen',amount:'1',store:'Möbel',note:'Blau'}));
 const item=api.getState().items[0]; let calls=0, resolve;
 window.HabitFlowShoppingTasks={create: payload=>{calls++; assert.equal(payload.store,'Möbel'); return new Promise(r=>resolve=r);},open:id=>id==='task-1'};
 const first=api.handleShoppingAction('promote-shopping',item.id);
 await api.handleShoppingAction('promote-shopping',item.id);
 resolve('task-1'); await first;
 await api.handleShoppingAction('promote-shopping',item.id);
 assert.equal(calls,1); assert.equal(item.metadata.promotedTaskId,'task-1'); assert.equal(item.isDone,false);
 assert.ok(api.renderShoppingRow(item).includes('Task öffnen'));
 await api.handleShoppingAction('open-shopping-task',item.id);
 api.saveShopping(form({title:'Sofa neu',category:'Wohnen',amount:'2',store:'Shop'},item.id));
 assert.equal(item.metadata.promotedTaskId,'task-1');
});
test('creation failure is retryable and content escaped',async()=>{
 const {api,window,form}=listHarness();
 api.saveShopping(form({title:'<script>',category:'Test'}));const item=api.getState().items[0];
 assert.ok(api.renderShoppingRow(item).includes('&lt;script&gt;'));
 window.HabitFlowShoppingTasks={create:async()=>{throw Error('storage');}};
 await api.handleShoppingAction('promote-shopping',item.id);
 assert.equal(item.metadata.promotedTaskId,undefined);
 window.HabitFlowShoppingTasks.create=async()=>'retry';
 await api.handleShoppingAction('promote-shopping',item.id);
 assert.equal(item.metadata.promotedTaskId,'retry');
});
function taskHarness() {
 const state={tasks:[]}; let fails=false;
 const source=appSource.slice(appSource.indexOf('  async function createTaskFromShopping('),appSource.indexOf('  function createTaskFromIdea('));
 const context={state,crypto:webcrypto,TextEncoder,Uint8Array,Date,
 nowIso:()=>new Date().toISOString(),normalizeTask:v=>v,storyPointsToEffort:()=>2,
 normalizeTaskPriority:v=>v,TASK_BACKLOG_STATUS:'archived',nextBacklogRank:()=>state.tasks.length+1,
 saveState:()=>{if(fails)throw Error('disk');},syncWithSupabase(){}};
 vm.createContext(context);vm.runInContext(source,context);
 return {state,create:context.createTaskFromShopping,fail:v=>fails=v};
}
test('shopping task enters backlog, carries details and has deterministic identity',async()=>{
 const h=taskHarness(),p={itemId:'list-item-legacy',title:'Sofa',category:'Wohnen',amount:'1',store:'Shop',note:'Blau'};
 const ids=await Promise.all([h.create(p),h.create(p)]);
 assert.equal(ids[0],ids[1]);assert.equal(h.state.tasks.length,1);
 const task=h.state.tasks[0];assert.equal(task.status,'archived');assert.equal(task.backlog_rank,1);assert.equal(task.points,0);assert.equal(task.due_at,null);
 for(const text of ['Wohnen','Shop','Blau','Menge: 1'])assert.ok(task.description.includes(text));
 assert.equal(await taskHarness().create(p),ids[0]);
 h.fail(true);await assert.rejects(h.create(p));h.fail(false);assert.equal(await h.create(p),ids[0]);assert.equal(h.state.tasks.length,1);
 await assert.rejects(h.create({...p,title:''}));
});

test('shopping task action uses the same icon button as edit and delete', () => {
 const {api,form}=listHarness();
 api.saveShopping(form({title:'Sofa',category:'Wohnen'}));
 const html=api.renderShoppingRow(api.getState().items[0]);
 assert.match(html, /class="hf-list-icon-btn" type="button" data-action="promote-shopping"/);
 assert.ok(html.indexOf('promote-shopping') < html.indexOf('edit-shopping'));
 assert.ok(html.indexOf('edit-shopping') < html.indexOf('delete-shopping'));
 assert.ok(!html.includes('hf-shopping-task-action'));
 assert.ok(html.includes('aria-label="Als Task im Backlog anlegen"'));
});
test('opening and closing a shopping task preserves the underlying shopping screen', () => {
 const start=appSource.indexOf('window.HabitFlowShoppingTasks =');
 const bridge=appSource.slice(start,appSource.indexOf('    // Read-only integration:',start));
 const modal={hidden:true,classList:{add(){modal.hidden=true;},remove(){modal.hidden=false;}}};
 const context={window:{},state:{tasks:[{id:'task-1'}]},createTaskFromShopping(){},
   normalizeTask:v=>v,renderTaskDetailContent:()=>'<div>Task</div>',
   taskDetailTaskId:null,els:{taskDetailModal:modal,taskDetailContent:{innerHTML:''}},
   document:{body:{classList:{add(){},remove(){}}}},
   showScreen(){throw Error('Shopping must stay active');}};
 vm.createContext(context);
 const detail=appSource.slice(appSource.indexOf('  function openTaskDetail('),appSource.indexOf('  function refreshTaskDetailIfOpen('));
 vm.runInContext(detail+'\n'+bridge,context);
 assert.equal(context.window.HabitFlowShoppingTasks.open('missing'),false);
 assert.equal(context.window.HabitFlowShoppingTasks.open('task-1'),true);
 assert.equal(modal.hidden,false);
 context.closeTaskDetail();
 assert.equal(modal.hidden,true);
 assert.equal(context.taskDetailTaskId,null);
});

test('shopping task icon distinguishes creation from opening', () => {
 const {api,form}=listHarness();
 api.saveShopping(form({title:'Sofa',category:'Wohnen'}));
 const item=api.getState().items[0];
 const creation=api.renderShoppingRow(item).match(/<button[^>]*data-action="promote-shopping"[^>]*>([\s\S]*?)<\/button>/)[1];
 item.metadata.promotedTaskId='task-1';
 const opening=api.renderShoppingRow(item).match(/<button[^>]*data-action="open-shopping-task"[^>]*>([\s\S]*?)<\/button>/)[1];
 assert.notEqual(creation,opening);
 assert.ok(creation.includes('<svg'));
 assert.ok(opening.includes('<svg'));
});
