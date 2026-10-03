const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const model = require('../modules/ontology-model.js');
function fixture() { return {
  habits:[{id:'run',name:'Joggen',type:'number'},{id:'swim',name:'Schwimmen',type:'duration'},{id:'old',name:'Archiv',is_archived:true}],
  ontologyHabits:[{id:'run',fitness:'jogging',category:'Sport'},{id:'swim',fitness:'swimming'}],
  habitEntries:[{id:'e1',habit_id:'run',value_num:5},{id:'e2',habit_id:'run',value_num:0},{id:'e3',habit_id:'swim',value_num:30},{id:'e4',habit_id:'old',value_num:3}],
  projects:[{id:'p',title:'Umbau'}],tasks:[{id:'t',title:'Plan',project_id:'p'}], projectPhases:[{id:'phase',project_id:'p'}],
  lists:[{id:'gifts',title:'Geschenke'},{id:'custom',title:'Meine neue Liste'}],listItems:[{id:'gift',listId:'gifts'},{id:'hidden',listId:'gifts',isArchived:true}],
  futureCollection:[{id:'future',customField:'Wert'}]
}; }

test('complete schema has valid endpoints and explicitly distinguishes derivation from stored links',()=>{
  const graph=model.build({}); assert.ok(graph.nodes.size >= 45); assert.ok(graph.edges.length >= 75);
  for(const edge of graph.edges){assert.ok(graph.nodes.has(edge.from));assert.ok(graph.nodes.has(edge.to));assert.ok(['stored','derived','contains'].includes(edge.kind));}
  assert.equal(graph.edges.find(e=>e.from==='entries'&&e.to==='points').kind,'stored');
  assert.match(graph.edges.find(e=>e.from==='entries'&&e.to==='points').evidence,/habit_entries.id/);
  assert.equal(graph.edges.find(e=>e.from==='entries'&&e.to==='fitness').kind,'derived');
  assert.equal(graph.edges.find(e=>e.from==='alcoholEvents'&&e.to==='alcoholDays').kind,'derived');
  assert.equal(graph.edges.some(e=>e.from==='learnings'&&e.to==='points'),false);
});
test('live habits, lists and projects have real counts, relation paths and correct navigation',()=>{
  const graph=model.build(fixture());
  assert.equal(graph.nodes.get('habit:run').count,2);
  assert.equal(graph.nodes.get('fitness').count,1);
  assert.equal(graph.nodes.has('habit:old'),false);
  assert.equal(graph.nodes.get('list:gifts').count,1);
  assert.ok(graph.nodes.has('list:custom'));
  assert.equal(graph.nodes.get('project:p').count,1);
  assert.ok(graph.edges.some(e=>e.from==='habit:swim'&&e.to==='swimming'));
  assert.deepEqual(graph.nodes.get('habit:run').target,{screen:'habits',kind:'habit',id:'run'});
  assert.deepEqual(graph.nodes.get('project:p').rowTarget({id:'t'}),{screen:'tasks',kind:'task',id:'t'});
  assert.equal(graph.nodes.get('collection:futureCollection').target,null);
});
test('build is read-only, supports empty data and never expands history into graph nodes',()=>{
  const data=fixture(), before=JSON.stringify(data); model.build(data); assert.equal(JSON.stringify(data),before);
  const first=model.build(data).nodes.size;
  data.habitEntries=Array.from({length:100000},(_,i)=>({id:'e'+i,habit_id:i%2?'run':'swim',value_num:5}));
  const start=performance.now(), graph=model.build(data), elapsed=performance.now()-start;
  assert.equal(graph.nodes.size,first); assert.equal(graph.nodes.get('habit:run').count,50000);
  assert.equal(graph.nodes.get('fitness').count,50000); assert.ok(elapsed<2000,`100k rows took ${elapsed}ms`);
  console.log(`Ontology 100k rows: ${elapsed.toFixed(1)}ms; ${graph.nodes.size} graph nodes`);
  assert.equal(model.build({habitEntries:null}).nodes.get('entries').count,0);
});
test('graph filtering retains no dangling edges and caps large numbers of entities',()=>{
  const data=fixture(); data.habits.push(...Array.from({length:1000},(_,i)=>({id:'h'+i,name:'Habit '+i})));
  const graph=model.build(data), overview=model.sliceGraph(graph,'habits',{overview:true,limit:80});
  assert.equal(overview.nodes.length,80);assert.ok(overview.total>1000);
  const ids=new Set(overview.nodes.map(n=>n.id));assert.ok(overview.edges.every(e=>ids.has(e.from)&&ids.has(e.to)));
  const search=model.sliceGraph(graph,'habits',{query:'MEINE NEUE LISTE'});assert.deepEqual(search.nodes.map(n=>n.id),['list:custom']);
  assert.equal(model.sliceGraph(graph,'habits',{query:'nothing-matches-009'}).nodes.length,0);
  assert.ok(model.sliceGraph(graph,'habits',{group:'knowledge'}).nodes.every(n=>n.group==='knowledge'));
});
test('extensions register declarative entities and relationships without changing renderer',()=>{
  model.register({id:'test-extension',label:'Erweiterung',group:'system',key:'extensionRows',description:'Test',fields:['habit_id']});
  model.relate('habits','test-extension','verknüpft','stored','habit_id');
  const graph=model.build({extensionRows:[{id:'x'}]});assert.equal(graph.nodes.get('test-extension').count,1);
  assert.ok(graph.adjacency.get('test-extension').some(e=>e.from==='habits'));
  assert.throws(()=>model.register({id:'test-extension',label:'Duplikat',group:'system'}));
});

function bridgeHarness() {
  const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
  const start=source.indexOf('window.HabitFlowOntologyBridge = Object.freeze({');
  const end=source.indexOf('\n    });',start)+8;
  const calls=[];
  const element={querySelector:()=>element,focus:()=>calls.push('focus'),scrollIntoView:()=>calls.push('scroll'),parentElement:null};
  const context={window:{},state:{habits:[{id:'h'}],tasks:[{id:'t'}],appointments:[{id:'a',starts_at:'2026-10-03T12:00:00'}]},document:{querySelector:()=>element,getElementById:()=>element},els:{historyModal:element,taskDetailCloseBtn:element},
    isFitnessDistanceHabit:()=>true,fitnessHabitType:()=> 'jogging',isSwimmingHabit:()=>false,habitCategoryMeta:()=>({label:'Sport'}),toDateKey:()=> '2026-10-03',
    visibleHabitEntries:()=>[{id:'e',habit_id:'h',value_num:5}],setPointsRulesPopoverOpen:()=>calls.push('close-rules'),showScreen:s=>calls.push('screen:'+s),openHistoryModal:(mode,id)=>calls.push([mode,id]),openTaskDetail:id=>calls.push(['task',id]),selectFitnessEntry:id=>calls.push(['fitness',id]),renderCalendar:()=>calls.push('calendar'),renderDayDetails:()=>calls.push('day'),switchConsumptionMode:mode=>calls.push(mode),openMorningRoutineModal:()=>calls.push('routine'),openCoachModal:()=>calls.push('coach'),openFitnessCoach:()=>calls.push('fitness-coach'),syncTaskUtilityPanels:()=>calls.push('ideas')};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);return {api:context.window.HabitFlowOntologyBridge,calls,context};
}
test('real app bridge navigates to details and rejects stale targets without changing data',()=>{
  const {api,calls,context}=bridgeHarness();const before=JSON.stringify(context.state);
  assert.equal(api.open({screen:'habits',kind:'habit',id:'h'}),true);assert.ok(calls.some(v=>Array.isArray(v)&&v[0]==='habit-detail'&&v[1]==='h'));
  assert.equal(api.open({screen:'habits',kind:'habit',id:'gone'}),false);
  assert.equal(api.open({screen:'tasks',kind:'task',id:'t'}),true);
  assert.equal(api.open({screen:'calendar',kind:'appointment',id:'a'}),true);assert.ok(calls.includes('calendar'));
  assert.equal(api.open({screen:'tasks',kind:'ideas'}),true);assert.ok(calls.includes('ideas'));
  assert.equal(api.open({screen:'fitness',kind:'fitness',id:'e'}),true);
  assert.equal(JSON.stringify(context.state),before);
  assert.equal(api.snapshot().ontologyHabits[0].fitness,'jogging');
});
test('lazy assets are precached without query-string mismatch, loader is the only startup cost',()=>{
  const html=fs.readFileSync(require.resolve('../index.html'),'utf8'), sw=fs.readFileSync(require.resolve('../service-worker.js'),'utf8'),loader=fs.readFileSync(require.resolve('../modules/ontology-loader.js'),'utf8');
  assert.match(html,/ontology-loader.js/);assert.doesNotMatch(html,/<script src="modules\/ontology(?:-model)?\.js/);
  for(const file of ['ontology.js','ontology-model.js','ontology.css']) {assert.ok(sw.includes("'./modules/"+file+"'"));assert.ok(loader.includes("'modules/"+file+"'"));}
});
