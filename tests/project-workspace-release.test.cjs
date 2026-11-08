const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{performance}=require('node:perf_hooks');
const modelSource=fs.readFileSync('modules/project-workspace-model.js','utf8');
const source=fs.readFileSync('modules/projects.js','utf8');
const ctx={window:{},URL};vm.runInNewContext(modelSource,ctx);const model=ctx.window.HabitFlowProjectWorkspaceModel;
function extract(name){const start=source.search(new RegExp('  (?:async )?function '+name+'\\('));assert.ok(start>=0,name);const tail=source.slice(start+1),match=tail.search(/\n  (?:async )?function /);return source.slice(start,match<0?undefined:start+1+match);}
const dossier=(id,project='p',owner='u')=>({id,project_id:project,user_id:owner,title:'Dossier '+id,updated_at:'2026-11-07'});
const entry=(id,dossierId='d',owner='u')=>({id,dossier_id:dossierId,user_id:owner,title:'Entry '+id,body:'Gedanke',links:['https://example.com/a','https://example.com/b'],updated_at:'2026-11-08'});
test('knowledge projects only owned linked dossiers and entries, with no persisted copies or image paths',()=>{
 const snapshot={dossiers:[dossier('d'),dossier('other','q'),dossier('foreign','p','v'),{...dossier('archived'),is_archived:true}],entries:[entry('one'),entry('foreign','d','v'),entry('other','other'),{...entry('deleted'),is_archived:true},{...entry('image'),image_path:'secret/path',links:[]}]};const before=JSON.stringify(snapshot);
 const notes=[{id:'n',project_id:'p',category:'Entscheidung',body:'Entscheid:\nX',updated_at:'2026-11-08'},{id:'question',project_id:'p',category:'Offene Frage',body:'Y'},{id:'foreign',project_id:'p',user_id:'v',category:'Entscheidung',body:'Private'}];
 const rows=model.knowledge('p','u',snapshot,notes);assert.equal(rows.length,6);assert.ok(!JSON.stringify(rows).includes('secret/path'));assert.ok(!JSON.stringify(rows).includes('Private'));assert.equal(JSON.stringify(snapshot),before);assert.equal(model.knowledge('p','',snapshot,[]).length,0);
});
test('sources validate protocols, credentials and duplicate URLs within each original entry',()=>{
 const snapshot={dossiers:[dossier('d')],entries:[{...entry('e'),links:['https://example.com','https://example.com/','javascript:alert(1)','data:text/html,x','https://user:secret@example.com','http://example.org/?a=1&b=2']}]};
 const links=model.knowledge('p','u',snapshot).filter(row=>row.kind==='links');assert.equal(links.length,2);assert.equal(links[0].key,'link:e:0');assert.equal(links[1].key,'link:e:5');assert.ok(links.every(row=>row.entryId==='e'));
});
test('multiple dossiers, archive, missing fields, text search and batches over 1000 entries remain bounded',()=>{
 const snapshot={dossiers:[dossier('d'),dossier('b')],entries:Array.from({length:1200},(_,i)=>({...entry(String(i),i%2?'b':'d'),body:i===1100?'Suchbegriff':'Gedanke'}))};
 const start=performance.now();const rows=model.knowledge('p','u',snapshot);const elapsed=performance.now()-start;
 assert.equal(rows.length,3602);assert.equal(model.page(rows).rows.length,20);assert.equal(model.page(rows,'links','',40).rows.length,40);assert.equal(model.page(rows,'thoughts','Suchbegriff').total,1);
 assert.equal(model.page(rows,'decisions').total,0);assert.equal(model.page(rows,'dossiers').total,2);assert.ok(elapsed<1000,'projection must not perform expensive work per row');
 assert.doesNotThrow(()=>model.knowledge('p','u',{dossiers:[dossier('d')],entries:[{...entry('empty'),title:null,body:null,links:undefined}]}));
});
test('coach prioritizes at most three factual hints, respects readiness, completion and backlog tasks',()=>{
 const project={status:'active',outcome_note:''}, milestones=[{id:'m',title:'Review',milestone_date:'2026-11-01'}];
 const hints=model.coach(project,[],[],milestones,'2026-11-08');assert.deepEqual(Array.from(hints,h=>h.id),['outcome','task','phase']);
 assert.equal(model.coach(project,[],[],milestones,'2026-11-08',false).length,0);assert.equal(model.coach({...project,status:'done'},[],[],milestones,'2026-11-08').length,0);
 const only=model.coach({...project,outcome_note:'Ziel'},[{id:'t',status:'archived'}],[{id:'phase'}],milestones,'2026-11-08');assert.equal(only.length,1);assert.equal(only[0].action,'milestone');assert.equal(only[0].recordId,'m');assert.match(only[0].reason,/kein Erledigt-Status/);
});
test('decision template requires context, stays human readable and never truncates silently',()=>{
 assert.throws(()=>model.decisionBody({decision:'X'}),/Begründung/);
 assert.equal(model.decisionBody({decision:'B2B',reason:'Kundenwert',alternatives:'B2C',consequence:'Validieren'}),'Entscheid:\nB2B\n\nBegründung:\nKundenwert\n\nAlternativen:\nB2C\n\nKonsequenz:\nValidieren');
 assert.throws(()=>model.decisionBody({decision:'x'.repeat(1990),reason:'y'.repeat(30)}),/2’000/);
});
test('tab switching keeps actual editor nodes, values, disclosure and cursor untouched',()=>{
 const tabs=['cockpit','planning','knowledge'].map(id=>({dataset:{id},setAttribute(k,v){this[k]=v},focus(){this.focused=true}}));
 const panels=['cockpit','planning','knowledge'].map(id=>({dataset:{workspacePanel:id}}));
 const form={value:'Unfertiger Entscheid',selectionStart:7,open:true};const root={form,querySelectorAll:s=>s.includes('role=')?tabs:panels};
 const c=vm.createContext({workspaceTab:'cockpit',document:{getElementById:()=>root},refreshWorkspaceKnowledge(){}});vm.runInContext(extract('selectWorkspaceTab'),c);
 for(const tab of ['planning','knowledge','cockpit'])c.selectWorkspaceTab(tab);
 assert.equal(root.form,form);assert.equal(form.value,'Unfertiger Entscheid');assert.equal(form.selectionStart,7);assert.equal(form.open,true);
 assert.equal(panels[0].hidden,false);assert.ok(panels.slice(1).every(p=>p.hidden));assert.equal(tabs[0]['aria-selected'],'true');assert.equal(tabs[1].tabIndex,-1);
});
test('unchanged targeted updates retain the DOM, while changed action rows restore focus',()=>{
 let writes=0,focused=0;const old={dataset:{action:'edit',id:'x'}},replacement={dataset:old.dataset,focus(){focused++}};
 const node={dataset:{},contains:n=>n===old,set innerHTML(v){writes++;this.html=v},querySelectorAll:()=>[replacement]};
 const c=vm.createContext({document:{querySelector:()=>node,activeElement:old}});vm.runInContext(extract('updateWorkspaceHtml'),c);
 c.updateWorkspaceHtml('mount','a');c.updateWorkspaceHtml('mount','a');assert.equal(writes,1);assert.equal(focused,1);c.updateWorkspaceHtml('mount','b');assert.equal(writes,2);
});
function saveHarness({wait,fail=false}={}){
 let rows=[],writes=0,renders=0,serial=0,owner='u';let state={projectNotes:[],tasks:[{id:'keep'}]};
 class Form {constructor(){this.dataset={projectId:'p'};this.message={textContent:''};this.submit={disabled:false};this.values={decision:'B2B',reason:'Kundenwert',alternatives:'',consequence:''};this.resets=0;}hasAttribute(){return true}querySelector(s){return s.includes('button')?this.submit:this.message}setAttribute(){}removeAttribute(){}reset(){this.resets++;this.values={}}}
 const form=new Form();let rejection=fail;const c=vm.createContext({HTMLFormElement:Form,FormData:class{constructor(f){this.f=f}entries(){return Object.entries(this.f.values)}get(k){return this.f.values[k]}},workspaceGeneration:0,workspaceModel:()=>model,TABLE_NOTES:'project_notes',readState:()=>state,normalizeProjectNote:n=>n,nowIso:()=> '2026-11-08T12:00:00Z',uid:()=> 'n'+(++serial),requireRemoteUser:async()=>({userId:owner,supabase:{from:()=>({async upsert(row){rows.push(row);if(wait) await wait;if(rejection)throw Error('offline');return {error:null}}})}}),currentUserId:async()=>owner,writeState:s=>{writes++;state=s},render(){renders++},toast(){},isMissingRemoteRelationError:()=>false,console:{warn(){}}});
 vm.runInContext(extract('saveProjectNote'),c);return {form,c,rows,save:()=>c.saveProjectNote({target:form,preventDefault(){}}),allow(){rejection=false},setOwner(v){owner=v},get state(){return state},get writes(){return writes},get renders(){return renders}};
}
test('decision saves exactly once through existing notes persistence and merges current state',async()=>{
 let release;const wait=new Promise(resolve=>release=resolve),h=saveHarness({wait});const first=h.save();await new Promise(resolve=>setImmediate(resolve));await h.save();assert.equal(h.rows.length,1);h.state.tasks.push({id:'new-during-save'});release();await first;
 assert.equal(h.writes,1);assert.equal(h.form.resets,1);assert.equal(h.state.tasks.length,2);assert.equal(h.rows[0].category,'Entscheidung');assert.match(h.rows[0].body,/Begründung/);
});
test('failed remote decision saves retain draft and retry identity, with inline error',async()=>{
 const h=saveHarness({fail:true});await h.save();assert.equal(h.writes,0);assert.equal(h.form.resets,0);assert.equal(h.form.values.reason,'Kundenwert');assert.match(h.form.message.textContent,/Entwurf bleibt erhalten/);const id=h.rows[0].id;h.allow();await h.save();assert.equal(h.rows[1].id,id);assert.equal(h.writes,1);
});
test('auth changes prevent an outstanding decision from writing into another session',async()=>{
 let release;const h=saveHarness({wait:new Promise(resolve=>release=resolve)});const saving=h.save();await new Promise(resolve=>setImmediate(resolve));h.setOwner('v');h.c.workspaceGeneration++;release();await saving;assert.equal(h.writes,0);assert.equal(h.form.resets,0);
});
test('knowledge load is serialized, limited to three linked dossiers, cancellable and non-duplicating',async()=>{
 let release;const calls=[];const pending=new Promise(resolve=>release=resolve);const c=vm.createContext({knowledgeBusy:false,selectedProjectId:'p',workspaceGeneration:1,workspaceLoaded:new Set(),refreshWorkspaceKnowledge(){},window:{HabitFlowDossiersStore:{snapshot:()=>({dossiers:[dossier('a'),dossier('b'),dossier('c'),dossier('d'),dossier('foreign','q')],status:'synchronisiert',metrics:Object.fromEntries(['a','b','c','d'].map(id=>[id,{loaded:true}]))}),async sync(id){calls.push(id);await pending}}}});vm.runInContext(extract('loadWorkspaceKnowledge'),c);
 const first=c.loadWorkspaceKnowledge();await c.loadWorkspaceKnowledge();assert.deepEqual(calls,['a']);release();await first;assert.deepEqual(calls,['a','b','c']);assert.equal(c.workspaceLoaded.size,3);await c.loadWorkspaceKnowledge();assert.deepEqual(calls,['a','b','c','d']);
});
test('late dossier loads cannot carry results into another project/session',async()=>{
 let release;const wait=new Promise(resolve=>release=resolve);const calls=[];const c=vm.createContext({knowledgeBusy:false,selectedProjectId:'p',workspaceGeneration:1,workspaceLoaded:new Set(),refreshWorkspaceKnowledge(){},window:{HabitFlowDossiersStore:{snapshot:()=>({dossiers:[dossier('a'),dossier('b')],status:'synchronisiert',metrics:Object.fromEntries(['a','b','c','d'].map(id=>[id,{loaded:true}]))}),async sync(id){calls.push(id);await wait}}}});vm.runInContext(extract('loadWorkspaceKnowledge'),c);const work=c.loadWorkspaceKnowledge();c.workspaceGeneration++;release();await work;assert.deepEqual(calls,['a']);assert.equal(c.workspaceLoaded.size,0);
});
test('refreshing the same project bypasses full markup replacement and retains active tab/drafts',()=>{
 let refreshes=0;const node={querySelector:()=>true,set innerHTML(_){throw Error('Must not rebuild editors')}};
 const state={projects:[{id:'p'}]};const c=vm.createContext({workspaceProject:'p',workspaceTab:'knowledge',selectedProjectId:'p',workspaceState:null,readState:()=>state,document:{getElementById:()=>node},refreshWorkspace(project,s){assert.equal(project.id,'p');assert.equal(s,state);refreshes++}});
 vm.runInContext(extract('renderDetail'),c);c.renderDetail('p');c.renderDetail('p');assert.equal(refreshes,2);assert.equal(c.workspaceTab,'knowledge');
});
test('dossier entry navigation and composer options preserve the existing return callback',()=>{
 const code=fs.readFileSync('modules/dossiers.js','utf8');const a=code.indexOf('    open(id, options = {}) {',code.indexOf('window.HabitFlowDossiers ='));const b=code.indexOf('\n    }\n  });',a);const method=code.slice(a,b+6).trim();
 let opened=[],jumped=[],focused=[],callback=null;const form={elements:{project_id:{value:''},body:{focus(){focused.push('body')}},link:{focus(){focused.push('link')}}}};
 const c=vm.createContext({pane:{},dialog:{open:false,querySelector:()=>form},store:{snapshot:()=>({dossiers:[{id:'d'}]})},show(){throw Error('Should not navigate away from project')},open:id=>opened.push(id),jumpEntry:id=>jumped.push(id),setComposer(value){assert.equal(value,true)},returnToCaller:null});
 vm.runInContext('const api = {'+method+'};',c);c.callback=()=>{};
 assert.equal(vm.runInContext("api.open('d',{fromProject:true,entryId:'e',onDismiss:callback})",c),true);assert.deepEqual(jumped,['e']);assert.equal(c.returnToCaller,c.callback);
 vm.runInContext("api.open('d',{fromProject:true,composer:'link'})",c);assert.deepEqual(focused,['link']);vm.runInContext("api.open('',{fromProject:true,create:true,projectId:'p'})",c);assert.equal(form.elements.project_id.value,'p');assert.deepEqual(opened,['d','d','']);
});
