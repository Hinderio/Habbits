const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');const D=require('../modules/competition-domain.js');
const source=fs.readFileSync(require.resolve('../modules/competition.js'),'utf8');
function harness(type='smoke'){
 const id=crypto.randomUUID(),started=Date.now()-3600000,events=[{id,challenge_id:id,kind:'start',occurred_at:new Date(started).toISOString(),payload:{type,goal:24}}];
 const timeouts=new Map(),intervals=new Map(),listeners={},docListeners={},rootListeners={},preferences=new Map();let n=0,evidence={},reads=0;
 const clock={dataset:{clockStart:started},textContent:''};const root={innerHTML:'',addEventListener:(key,fn)=>rootListeners[key]=fn,querySelector:q=>q==='[data-clock-start]'&&root.innerHTML.includes('data-clock-start')?clock:null,querySelectorAll:q=>q==='[data-clock-start]'&&root.innerHTML.includes('data-clock-start')?[clock]:[]};
 const dialog={addEventListener(){},close(){}};const notice={textContent:''};const pane={classList:{contains:()=>true}};
 const document={hidden:false,activeElement:null,body:{dataset:{activeScreen:'smoking'}},getElementById:id=>({competitionRoot:root,competitionDialog:dialog,competitionNotice:notice})[id],querySelector:q=>q.includes('data-consumption-pane')?pane:null,addEventListener:(k,fn)=>docListeners[k]=fn};
 const window={localStorage:{getItem:key=>preferences.get(key)||null,setItem:(key,value)=>preferences.set(key,value)},HabitFlowCompetitionDomain:D,HabitFlowCompetitionStore:{snapshot:()=>({events,status:'local'}),activate(){},subscribe(){},append(run,kind,payload){events.push({id:crypto.randomUUID(),challenge_id:run,kind,payload,occurred_at:new Date().toISOString()})},sync(){}},HabitFlowPersistence:{readCollections(){reads++;return evidence}},setTimeout:fn=>{timeouts.set(++n,fn);return n},clearTimeout:id=>timeouts.delete(id),setInterval:fn=>{intervals.set(++n,fn);return n},clearInterval:id=>intervals.delete(id),addEventListener:(k,fn)=>listeners[k]=fn};
 vm.runInNewContext(source,{window,document,console,Date,Blob,URL});
 return {window,document,root,events,intervals,clock,preferences,toggleHistory(open){rootListeners.toggle({target:{isConnected:true,matches:()=>true,open}})},get reads(){return reads},setEvidence(s){evidence=s},flush(){const f=[...timeouts.values()];timeouts.clear();f.forEach(fn=>fn())},emitDoc(name){docListeners[name]?.()}};
}
test('active timer renders; seconds tick without reparsing app state; leaving stops interval',()=>{
 const h=harness();assert.match(h.root.innerHTML,/Rauchfrei/);assert.match(h.root.innerHTML,/Hall of Fame/);assert.match(h.root.innerHTML,/<details class="comp-attempts" data-comp-history >/);assert.match(h.root.innerHTML,/Tage mit Früchten/);assert.doesNotMatch(h.root.innerHTML,/data-type="sweets"/);assert.match(h.root.innerHTML,/Deine laufenden Challenges/);assert.equal(h.intervals.size,1);
 const reads=h.reads;for(let i=0;i<10;i++)[...h.intervals.values()].forEach(fn=>fn());assert.equal(h.reads,reads);assert.match(h.clock.textContent,/01:00:/);
 h.document.body.dataset.activeScreen='dashboard';h.window.HabitFlowCompetition.onScreenChange();assert.equal(h.intervals.size,0);
});
test('persisted consumption closes run and renders history, not another active timer',()=>{
 const h=harness();h.setEvidence({cigarettes:[{smoked_at:new Date().toISOString()}]});h.window.HabitFlowCompetition.onStateSaved();h.flush();assert.equal(h.events.filter(e=>e.kind==='finish').length,1);assert.match(h.root.innerHTML,/Konsum erfasst/);assert.doesNotMatch(h.root.innerHTML,/data-clock-start=/);
 h.window.HabitFlowCompetition.refresh();h.flush();assert.equal(h.events.filter(e=>e.kind==='finish').length,1);
});
test('hiding page suspends live updates and returning refreshes from durable state',()=>{
 const h=harness();h.document.hidden=true;h.emitDoc('visibilitychange');assert.equal(h.intervals.size,0);h.document.hidden=false;h.emitDoc('visibilitychange');h.flush();assert.equal(h.intervals.size,1);
});

test('attempt disclosure state survives reactive renders and is saved locally',()=>{
 const h=harness();h.toggleHistory(true);h.window.HabitFlowCompetition.refresh();h.flush();assert.match(h.root.innerHTML,/<details class="comp-attempts" data-comp-history open>/);assert.equal(h.preferences.get('habitflow-competition-history-open'),'true');
 h.toggleHistory(false);h.window.HabitFlowCompetition.refresh();h.flush();assert.match(h.root.innerHTML,/<details class="comp-attempts" data-comp-history >/);assert.equal(h.preferences.get('habitflow-competition-history-open'),'false');
});
