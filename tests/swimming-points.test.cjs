const assert = require('node:assert/strict');
const {test}=require('node:test');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const block=name=>source.match(new RegExp(`  function ${name}\\([^]*?\\n  \\}`))[0];
function setup(){
 const c={state:{habits:[],habitEntries:[],pointsLedger:[]},isFitnessDistanceHabit:()=>false,nowIso:()=> '2026-09-13T12:00:00Z',uid:()=> 'new',markRemoteDeletedMany(){}};
 vm.createContext(c);
 for(const name of ['isSwimmingHabit','swimmingPoints','habitPointReason','habitPoints','addPoints','migrateHabitScoring'])vm.runInContext(block(name),c);
 return c;
}
const swimming={id:'swim',name:'Schwimmen',type:'duration',unit:'min',target:30};
test('swimming earns 30 per entry plus 2 per minute without target cap',()=>{
 const c=setup();
 for(const [minutes,expected] of [[0,30],[1,32],[30,90],[60,150],[120,270],[12.5,55]])assert.equal(c.habitPoints(swimming,{value_num:minutes}),expected);
 assert.equal(c.habitPoints({...swimming,target:999},{value_num:60}),150);
 assert.equal(c.habitPoints({...swimming,type:'number'},{value_num:60}),150);
 assert.match(c.habitPointReason(swimming,{value_num:60}),/30 Basis \+ 60 Min\. × 2 = 150 Pkt\./);
});
test('other habits and distance-based swimming retain existing scoring',()=>{
 const c=setup();
 assert.equal(c.habitPoints({...swimming,name:'Meditation'},{value_num:60}),30);
 assert.equal(c.habitPoints({...swimming,name:'Lesen'},{value_num:15}),15);
 assert.equal(c.habitPoints({...swimming,type:'number',unit:'km'},{value_num:30}),30);
 assert.equal(c.habitPoints({name:'Wasser',type:'boolean'},{value_bool:true}),12);
});
test('migration and edits replace the existing swimming booking and are idempotent',()=>{
 const c=setup();c.state.habits=[swimming];
 c.state.habitEntries=[{id:'entry',habit_id:'swim',value_num:60,occurred_at:'2026-09-12T12:00:00Z'}];
 c.state.pointsLedger=[{id:'ledger',source_type:'habit',source_id:'entry',points:30,reason:'Schwimmen geloggt',synced:true}];
 assert.equal(c.migrateHabitScoring(),true);assert.equal(c.state.pointsLedger.length,1);
 assert.equal(c.state.pointsLedger[0].points,150);assert.equal(c.state.pointsLedger[0].synced,false);
 assert.equal(c.migrateHabitScoring(),false);
 c.state.habitEntries[0].value_num=30;c.migrateHabitScoring();
 assert.equal(c.state.pointsLedger[0].points,90);assert.equal(c.state.pointsLedger[0].id,'ledger');
});
