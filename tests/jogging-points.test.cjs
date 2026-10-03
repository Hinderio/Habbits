const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const block = name => source.match(new RegExp(`  function ${name}\\([^]*?\\n  \\}`))[0];
function setup() {
 const c = { state:{habits:[],habitEntries:[],pointsLedger:[]}, habitIconKey: habit=>habit.icon || '', nowIso:()=> '2026-10-03T12:00:00Z', uid:()=> 'new', markRemoteDeletedMany(){}, HIKING_POINTS_BASE:50,HIKING_POINTS_PER_KM:10,HIKING_POINTS_PER_100M:10,parseFitnessAscentNote:()=>0 };
 vm.createContext(c);
 for (const name of ['isFitnessDistanceHabit','fitnessHabitType','parseFitnessDurationNote','buildFitnessDurationNote','isSwimmingHabit','swimmingPoints','joggingPoints','habitPointReason','habitPoints','hikingPoints','addPoints','migrateHabitScoring']) vm.runInContext(block(name),c);
 return c;
}
const run={id:'run',name:'Joggen',icon:'jogging',type:'number',unit:'km',target:5};
test('running uses recorded minutes, never kilometres or target caps',()=>{
 const c=setup();
 for(const [minutes,expected] of [[0,50],[1,52],[30,110],[60,170],[120,290]]) {
  const entry={value_num:10,note:c.buildFitnessDurationNote(minutes)};
  assert.equal(c.habitPoints(run,entry),expected);
  assert.equal(c.habitPoints({...run,target:500},{...entry,value_num:1}),expected);
 }
 assert.equal(c.habitPoints({...run,name:'Morgenlauf'}, {note:'time:3600sec',value_num:6}),170);
 assert.match(c.habitPointReason(run,{note:'time:3600sec'}),/50 Basis \+ 60 Min\. × 2 = 170 Pkt\./);
});
test('seconds and historical minute formats are supported; missing duration earns only base',()=>{
 const c=setup();
 for(const note of ['time:3600sec','Dauer:60min','60 min','zeit:60:00'])assert.equal(c.joggingPoints({note}),170);
 assert.equal(c.joggingPoints({note:c.buildFitnessDurationNote(30,30)}),111);
 assert.equal(c.joggingPoints({note:c.buildFitnessDurationNote(30,10)}),110);
 for(const note of ['',null,'lockerer Lauf'])assert.equal(c.joggingPoints({value_num:60,note}),50);
 assert.match(c.habitPointReason(run,{}),/keine Laufdauer erfasst/);
});
test('existing entries migrate in place and editing duration is idempotent',()=>{
 const c=setup();c.state.habits=[run];
 c.state.habitEntries=[{id:'entry',habit_id:'run',value_num:10,note:'time:3600sec',occurred_at:'2026-10-01T12:00:00Z'}];
 c.state.pointsLedger=[{id:'ledger',source_type:'habit',source_id:'entry',points:30,reason:'Joggen geloggt',synced:true}];
 assert.equal(c.migrateHabitScoring(),true);assert.equal(c.state.pointsLedger.length,1);
 assert.equal(c.state.pointsLedger[0].points,170);assert.equal(c.state.pointsLedger[0].id,'ledger');assert.equal(c.state.pointsLedger[0].synced,false);
 assert.equal(c.migrateHabitScoring(),false);
 c.state.habitEntries[0].note='time:1800sec';c.migrateHabitScoring();assert.equal(c.state.pointsLedger[0].points,110);
});
test('swimming, hiking and other habits keep their scoring',()=>{
 const c=setup();
 assert.equal(c.habitPoints({name:'Schwimmen',type:'duration',unit:'min'},{value_num:60}),150);
 assert.equal(c.habitPoints({name:'Wandern',icon:'hiking',type:'number'},{value_num:5}),100);
 assert.equal(c.habitPoints({name:'Lesen',type:'duration',target:30},{value_num:30}),30);
 assert.equal(c.habitPoints({name:'Gewicht',type:'weight'},{value_num:70}),5);
});
