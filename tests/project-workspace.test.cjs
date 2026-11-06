const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
const app=fs.readFileSync('app.js','utf8'),projects=fs.readFileSync('modules/projects.js','utf8');
function extract(src,name){const start=src.indexOf('  function '+name+'(');assert.ok(start>=0,name);const end=src.indexOf('\n  function ',start+1);return src.slice(start,end);}
function ranking(tasks,saved=[]){let saves=0,syncs=0;const state={tasks};const context=vm.createContext({state,TASK_BACKLOG_STATUS:'archived',normalizeTask:t=>({...t}),compareTasks:(a,b)=>a.id.localeCompare(b.id),nowIso:()=> '2026-11-06T12:00:00Z',saveState(){saves++},syncWithSupabase(){syncs++},toast(){},window:{HabitFlowPersistence:{readCollections:()=>({tasks:saved})}}});vm.runInContext(['backlogTasks','compareBacklogTasks','shiftBacklogTask'].map(n=>extract(app,n)).join('\n'),context);return {context,state,get saves(){return saves},get syncs(){return syncs}};}
const row=(id,rank,project='p',status='archived')=>({id,backlog_rank:rank,project_id:project,status,updated_at:'2026-11-01',synced:true,points:42});
test('project and backlog arrows use the same global order and sync path',()=>{
 const h=ranking([row('a',1),row('x',2,'other'),row('b',3),row('done',9,'p','done')]);
 h.context.shiftBacklogTask('b',-1,'p');assert.deepEqual(Array.from(h.context.backlogTasks(),r=>r.id),['b','a','x']);assert.equal(h.saves,1);assert.equal(h.syncs,1);
 h.context.shiftBacklogTask('b',1);assert.deepEqual(Array.from(h.context.backlogTasks(),r=>r.id),['a','b','x']);assert.equal(h.saves,2);assert.equal(h.syncs,2);
 assert.equal(h.state.tasks.find(t=>t.id==='done').backlog_rank,9);assert.ok(h.state.tasks.every(t=>t.points===42));assert.ok(h.state.tasks.filter(t=>t.id!=='done').every(t=>t.status==='archived'));
});
test('open and in-progress tasks participate without status or urgency changes',()=>{
 const h=ranking([row('a',1,'p','open'),row('b',2,'p','in_progress'),row('c',3,'p','archived')]);h.state.tasks[0].priority='urgent';
 h.context.shiftBacklogTask('c',-1,'p');assert.deepEqual(Array.from(h.state.tasks).sort(h.context.compareBacklogTasks).map(t=>t.id),['a','c','b']);assert.equal(h.state.tasks[0].priority,'urgent');
 const before=JSON.stringify(h.state);h.context.shiftBacklogTask('a',-1,'p');h.context.shiftBacklogTask('missing',1,'p');h.context.shiftBacklogTask('a',2,'p');assert.equal(JSON.stringify(h.state),before);assert.equal(h.syncs,1);
});
test('ranking reconciles a newer persisted task before saving its shared rank',()=>{
 const h=ranking([row('a',1),row('b',2)], [{...row('b',2),title:'Newest title',updated_at:'2026-11-05'}]);h.context.shiftBacklogTask('b',-1,'p');assert.equal(h.state.tasks.find(t=>t.id==='b').title,'Newest title');
});
function view(){const context=vm.createContext({window:{HabitFlowTaskOrder:{compare:(a,b)=>a.backlog_rank-b.backlog_rank}},selectedProjectId:'p',completedProjects:new Set()});vm.runInContext(['escapeHtml','dateLabel','taskDone','projectTasks','renderProjectTaskList','renderTaskRow'].map(n=>extract(projects,n)).join('\n'),context);return context;}
test('linked backlog tasks stay visible and completed tasks are collapsed with accessible symbol actions',()=>{
 const c=view(),tasks=[{...row('todo',2),title:'<Todo>'},{...row('done',3,'p','done'),title:'Finished'}];const html=c.renderProjectTaskList(tasks);assert.match(html,/data-project-completed>/);assert.match(html,/aria-label="Backlog"/);assert.match(html,/aria-label="Erledigt"/);assert.match(html,/data-action="project-task-up"/);assert.match(html,/&lt;Todo&gt;/);assert.ok(!html.includes('>Lösen<'));assert.equal(c.projectTasks({tasks},'p').length,2);
});
test('dossier previews are bounded, escaped, owner-filtered through the store and never fetch images',()=>{
 let snapshotReads=0;const mount={dataset:{},innerHTML:'',querySelectorAll:()=>[]};const snapshot={dossiers:[{id:'d',project_id:'p',title:'<Dossier>'},{id:'else',project_id:'q',title:'Elsewhere'}],metrics:{d:{count:20,exact:true}},entries:Array.from({length:20},(_,i)=>({dossier_id:'d',title:'Entry '+i,body:'<script>'+('a'.repeat(200)),updated_at:new Date(2026,10,i+1).toISOString(),image_path:'secret/image.jpg'}))};const c=vm.createContext({selectedProjectId:'p',window:{HabitFlowDossiersStore:{snapshot(){snapshotReads++;return snapshot;}}},document:{querySelector:()=>mount}});vm.runInContext(['escapeHtml','dateLabel','renderProjectDossiers'].map(n=>extract(projects,n)).join('\n'),c);c.renderProjectDossiers('p');assert.equal((mount.innerHTML.match(/<article>/g)||[]).length,3);assert.ok(!mount.innerHTML.includes('Elsewhere'));assert.ok(!mount.innerHTML.includes('secret/image'));assert.ok(!mount.innerHTML.includes('<script>'));assert.match(mount.innerHTML,/&lt;Dossier&gt;/);const before=mount.innerHTML;c.renderProjectDossiers('p');assert.equal(mount.innerHTML,before);
});
test('rebuilding expanded dossier previews does not add duplicate sync requests',()=>{
 const listeners=new Map();let syncs=0;
 const c=vm.createContext({selectedProjectId:'p',completedProjects:new Set(),loadedProjectDossiers:new Set(),window:{HabitFlowDossiersStore:{sync(){syncs++;}}},document:{addEventListener(type,handler){listeners.set(type,handler);},getElementById(){return null;}}});
 vm.runInContext(extract(projects,'bindEvents'),c);c.bindEvents();
 const target=()=>({isConnected:true,open:true,dataset:{projectDossier:'d'},matches:s=>s==='[data-project-dossier]'});
 listeners.get('toggle')({target:target()});listeners.get('toggle')({target:target()});
 assert.equal(syncs,1);const removed=target();removed.isConnected=false;removed.dataset.projectDossier='other';listeners.get('toggle')({target:removed});assert.equal(syncs,1);
});
