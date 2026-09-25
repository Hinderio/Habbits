const test=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),D=require('../modules/roadmap-domain.js');
const today='2026-09-25',habit={id:'run',name:'Joggen',type:'number'},goal=(kind='count',extra={})=>({title:'Ziel',metadata:{kind,habitId:'run',startDate:'2026-01-01',dueDate:'2026-12-31',target:20,...extra}});
const entry=(date,value=5)=>({habit_id:'run',occurred_at:date+'T12:00:00',value_num:value});
test('calendar dates use civil days through DST and leap years',()=>{assert.equal(D.day('2026-03-30')-D.day('2026-03-29'),1);assert.equal(D.day('2024-03-01')-D.day('2024-02-28'),2);assert.equal(D.key('invalid'),'');});
test('counts include boundaries but exclude future, zero and archived entries',()=>{const index=D.indexEntries([entry('2025-12-31'),entry('2026-01-01'),entry(today),entry('2026-12-31'),entry(today,0),{...entry(today),is_archived:true}], [habit],today);assert.deepEqual(D.progress(goal(),index,today),{ratio:.1,label:'2 / 20 Einträge'});});
test('boolean habits count only successful entries',()=>{const index=D.indexEntries([{habit_id:'run',occurred_at:today,value_bool:true},{habit_id:'run',occurred_at:today,value_bool:false}],[{...habit,type:'boolean'}],today);assert.equal(D.progress(goal(),index,today).ratio,.05);});
test('weight supports decreasing and increasing goals and surpassed targets',()=>{let index=D.indexEntries([entry('2026-01-01',90),entry(today,85)],[habit],today);assert.equal(D.progress(goal('weight',{target:80}),index,today).ratio,.5);index=D.indexEntries([entry(today,78)],[habit],today);assert.equal(D.progress(goal('weight',{target:80}),index,today).ratio,1);assert.equal(D.progress(goal('weight',{target:80,direction:'atLeast'}),index,today).ratio,0);});
test('old values do not masquerade as measurements in a new goal period',()=>{const index=D.indexEntries([entry('2025-12-31',80)],[habit],today);assert.equal(D.progress(goal('weight',{target:80}),index,today).label,'Noch kein Messwert');});
test('latest measurement is chosen by timestamp within the same day',()=>{const index=D.indexEntries([{...entry(today,82),occurred_at:today+'T19:00:00'}, {...entry(today,84),occurred_at:today+'T08:00:00'}],[habit],today);assert.match(D.progress(goal('weight',{target:80}),index,today).label,/^82/);});
test('manual goals preserve explicit completion',()=>assert.equal(D.progress({...goal('manual'),isDone:true},new Map(),today).ratio,1));
test('sources preserve originals and include undated work and project milestones',()=>{const source={projects:[{id:'p',title:'Projekt',start_date:'2026-01-01',end_date:'2026-12-31'}],milestones:[{id:'m',project_id:'p',title:'Launch',milestone_date:today}],tasks:[{id:'t',title:'Task',priority:'high'},{id:'gone',title:'X',is_archived:true}],appointments:[{id:'a',title:'Termin',starts_at:today}],habits:[],entries:[]};const before=JSON.stringify(source),rows=D.build(source,[],today);assert.equal(rows.length,4);assert.equal(D.windowRows(rows,'2026-09-01','2026-09-30').length,4);assert.equal(D.windowRows(rows,'2027-01-01','2027-02-01').length,1);assert.equal(JSON.stringify(source),before);assert.equal(rows[1].id,'p');});
function storageBridge(){
 const source=fs.readFileSync(path.join(root,'modules/lists.js'),'utf8'),start=source.indexOf('  window.HabitFlowRoadmapGoals ='),end=source.indexOf('  window.HabitFlowListsCoach =',start);
 const state={items:[{id:'unrelated',listId:'weekly',title:'Keep'}],lists:[]},calls=[],stored=[];let fail=false;
 const context={window:{},state,ROADMAP_LIST_ID:'roadmap-goals',STORAGE_KEY:'test',activeListId:'weekly',syncLabel:'lokal',crypto:{randomUUID:()=> 'unique'},localStorage:{setItem(k,v){if(fail)throw Error('Quota');stored.push(JSON.parse(v));}},syncToSupabase:items=>calls.push(items)};
 vm.runInNewContext(source.slice(start,end),context);return {api:context.window.HabitFlowRoadmapGoals,calls,stored,context,fail:()=>fail=true};
}
test('goal writes persist first and synchronize only changed item',()=>{const h=storageBridge(),saved=h.api.save(goal('manual'));assert.equal(h.stored.length,1);assert.equal(h.calls.length,1);assert.equal(h.calls[0].length,1);assert.equal(h.context.state.items[0].title,'Keep');assert.equal(saved.metadata.version,1);assert.equal(h.api.snapshot().goals.length,1);});
test('failed local writes do not publish or sync changes',()=>{const h=storageBridge();h.fail();assert.throws(()=>h.api.save(goal()),/Quota/);assert.equal(h.calls.length,0);assert.equal(h.api.snapshot().goals.length,0);});
test('invalid dates and targets cannot be saved',()=>{const h=storageBridge();for(const metadata of [{dueDate:'2026-02-30'},{startDate:'2027-01-01'},{target:0},{target:2.5}])assert.throws(()=>h.api.save(goal('count',metadata)));assert.equal(h.calls.length,0);});
test('goal updates cannot overwrite another list, and deletion leaves tombstone',()=>{const h=storageBridge();assert.throws(()=>h.api.save({...goal(),id:'unrelated'}));const saved=h.api.save(goal('manual'));h.api.save({...saved,isDone:true});assert.equal(h.api.snapshot().goals[0].isDone,true);h.api.save({...saved,isArchived:true});assert.equal(h.api.snapshot().goals.length,0);assert.equal(h.context.state.items[1].isArchived,true);});
function uiHarness(count=2,extra={}){
 const nodes=new Map(),listeners={},calls=[];const node=()=>({innerHTML:'',textContent:'',hidden:false,style:{setProperty(){}},replaceChildren(){this.innerHTML='';},focus(){},scrollIntoView(){}});
 const dialog={...node(),open:false,setAttribute(){},querySelector(k){if(!nodes.has(k))nodes.set(k,node());return nodes.get(k);},addEventListener(k,f){listeners[k]=f;},showModal(){this.open=true;},close(){this.open=false;listeners.close();}};
 const document={createElement:()=>dialog,body:{append(){}},activeElement:{focus(){}}};
 const snapshot={habits:[],entries:[],tasks:Array.from({length:count},(_,i)=>({id:String(i),priority:'high',title:i===0?'<img src=x onerror=alert(1)>':'Task '+i})),...extra};
 const window={HabitFlowRoadmapDomain:D,HabitFlowRoadmapBridge:{snapshot:()=>{calls.push('snapshot');return snapshot;},open:(...args)=>calls.push(args)},HabitFlowRoadmapGoals:{snapshot:()=>({goals:[]})}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'modules/roadmap.js'),'utf8'),{window,document,Intl,Date,Map,Number,String,Math});
 return {window,dialog,nodes,calls,click:dataset=>listeners.click({target:{closest:()=>({dataset})}})};
}
test('view is dormant until opened, bounds rows and escapes imported titles',()=>{const h=uiHarness(150);assert.equal(h.calls.length,0);h.window.HabitFlowRoadmap.open();assert.equal(h.calls.length,1);const html=h.nodes.get('#roadmapGrid').innerHTML;assert.equal((html.match(/class="roadmap-topic"/g)||[]).length,100);assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));h.click({action:'more'});assert.equal((h.nodes.get('#roadmapGrid').innerHTML.match(/class="roadmap-topic"/g)||[]).length,150);assert.equal(h.calls.length,1);});
test('closing releases rendered rows and reopening reads fresh data',()=>{const h=uiHarness();h.window.HabitFlowRoadmap.open();h.click({action:'close'});assert.equal(h.nodes.get('#roadmapGrid').innerHTML,'');h.window.HabitFlowRoadmap.open();assert.equal(h.calls.length,2);});
test('source and weekly actions invoke existing navigation',()=>{const h=uiHarness();h.window.HabitFlowRoadmap.open();h.click({row:'0'});assert.deepEqual(h.calls.at(-1),['task','0']);h.window.HabitFlowRoadmap.open();h.click({action:'weekly'});assert.deepEqual(h.calls.at(-1),['weekly']);});
test('large histories use one entry index with queryable progress',()=>{const entries=Array.from({length:50000},(_,i)=>entry('2026-09-01',i+1));const start=performance.now();const index=D.indexEntries(entries,[habit],today);for(let i=0;i<1000;i++)assert.equal(D.progress(goal(),index,today).ratio,1);console.log(`50k entries + 1k goal queries: ${(performance.now()-start).toFixed(1)}ms`);});

test('only high priority tasks are included, including within projects',()=>{
 const tasks=['low','medium','high','urgent',undefined].flatMap((priority,i)=>[{id:'free'+i,title:'Free',priority},{id:'linked'+i,title:'Linked',priority,project_id:'p'}]);
 tasks.push({id:'archived',title:'Archived',priority:'high',is_archived:true});
 const rows=D.build({projects:[{id:'p',title:'Project'}],tasks},[],today);
 assert.deepEqual(rows.filter(r=>r.source==='task').map(r=>r.id).sort(),['free2','linked2']);
});
test('birthday flags and normalized birthday kinds are excluded without filtering names',()=>{
 const rows=D.build({appointments:[{id:'flag',title:'A',is_birthday:true},{id:'kind',title:'B',event_kind:'birthday'},{id:'normal',title:'Geburtstagsgeschenk kaufen',event_kind:'standard'},{id:'party',title:'Feier',event_kind:'celebration'}]},[],today);
 assert.deepEqual(rows.map(r=>r.id).sort(),['normal','party']);
});
test('legacy birthday metadata uses the calendar normalization at the snapshot boundary',()=>{
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
 const start=app.indexOf('  function normalizeAppointmentEventKind('),end=app.indexOf('\n  function ',app.indexOf('  function appointmentEventKind(')+5);
 const context={APPOINTMENT_EVENT_KIND_META_RE:/(?:\r?\n)?<!--hf:event-kind=(birthday|holiday|public_holiday|celebration|visit)-->/gi};
 vm.runInNewContext(app.slice(start,end),context);
 assert.equal(context.appointmentEventKind({description:'<!--hf:event-kind=birthday-->'}),'birthday');
 assert.match(app,/appointments: state\.appointments\.map\(appointment => \(\{ \.\.\.appointment, event_kind: appointmentEventKind\(appointment\) \}\)\)/);
});
test('each project forms a contiguous lane with summary, milestones and tasks exactly once',()=>{
 const snapshot={projects:[{id:'p1',title:'Same',start_date:'2026-01-01',end_date:'2026-12-31'},{id:'p2',title:'Same',start_date:'2026-01-01',end_date:'2026-12-31'}],milestones:[{project_id:'p1',title:'Launch',milestone_date:'2026-08-01'}],tasks:[{id:'task1',title:'First',priority:'high',project_id:'p1',due_at:'2026-07-01'},{id:'task2',title:'Second',priority:'high',project_id:'p2',due_at:'2026-02-01'},{id:'free',title:'Free',priority:'high'}]};
 const before=JSON.stringify(snapshot), rows=D.build(snapshot,[],today);
 assert.deepEqual(rows.filter(r=>r.projectId).map(r=>r.projectId),['p1','p1','p1','p2','p2']);
 for(const id of ['p1','p2'])assert.equal(rows.find(r=>r.projectId===id).laneRole,'summary');
 assert.equal(rows.filter(r=>r.id==='task1').length,1);
 assert.equal(rows.find(r=>r.id==='task1').group,'Same');
 assert.equal(JSON.stringify(snapshot),before);
 const projects=D.windowRows(rows,'2026-01-01','2026-12-31','project');
 assert.ok(projects.some(r=>r.id==='task1'));assert.ok(!projects.some(r=>r.id==='free'));
});
test('current project links override stale app associations and support unlinking',()=>{
 const rows=D.build({projects:[{id:'a',title:'A'},{id:'b',title:'B'}],tasks:[{id:'moved',title:'Moved',priority:'high',project_id:'a'},{id:'unlinked',title:'Unlinked',priority:'high',project_id:'a'},{id:'alias',title:'Alias',priority:'high',projectId:'b'}],taskLinks:[{id:'moved',projectId:'b'},{id:'unlinked',projectId:null}]},[],today);
 assert.equal(rows.find(r=>r.id==='moved').projectId,'b');assert.equal(rows.find(r=>r.id==='unlinked').projectId,undefined);assert.equal(rows.find(r=>r.id==='alias').projectId,'b');
});
test('a task outside project dates retains the project context without hiding the task',()=>{
 const rows=D.build({projects:[{id:'p',title:'Past project',start_date:'2025-01-01',end_date:'2025-12-31'}],tasks:[{id:'t',title:'Follow-up',priority:'high',project_id:'p',due_at:today}]},[],today);
 assert.deepEqual(D.windowRows(rows,'2026-09-01','2026-09-30','project').map(r=>r.id),['p','t']);
 assert.deepEqual(D.windowRows(rows,'2026-09-01','2026-09-30','task').map(r=>r.id),['t']);
});
test('calendar actions are grouped below the title without modifying month navigation',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),css=fs.readFileSync(path.join(root,'style.css'),'utf8');
 const actions=html.match(/<div class="calendar-view-actions"[^>]*>([\s\S]*?)<\/div>/)[1];
 assert.ok(actions.includes('roadmapToggleBtn'));assert.ok(actions.includes('appointmentFormToggleBtn'));
 assert.match(css,/#screen-calendar > \.section-toolbar \{[^}]*flex-direction:column/);
 assert.match(css,/#screen-calendar \.calendar-view-actions \{[^}]*flex-flow:row nowrap/);
 assert.ok(!css.includes('.section-toolbar:has(#roadmapToggleBtn)'));
 const line=fs.readFileSync(path.join(root,'modules/line-calendar.js'),'utf8');
 assert.match(line,/addButton\.parentElement\?\.insertBefore\(button, addButton\)/);
});
test('project lane renders nested tasks and keeps task navigation intact',()=>{
 const h=uiHarness(0,{projects:[{id:'p',title:'<Project>'}],tasks:[{id:'linked',title:'Task in project',priority:'high',project_id:'p'}]});
 h.window.HabitFlowRoadmap.open();const html=h.nodes.get('#roadmapGrid').innerHTML;
 assert.match(html,/PROJEKT<\/small>&lt;Project&gt;/);
 assert.equal((html.match(/roadmap-lane-child/g)||[]).length,1);
 assert.equal((html.match(/roadmap-lane-track/g)||[]).length,2);
 assert.ok(!html.includes('>Aufgaben</div>'));
 h.click({row:'1'});assert.deepEqual(h.calls.at(-1),['task','linked']);
});
