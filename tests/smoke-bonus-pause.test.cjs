const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const block = name => app.match(new RegExp(`  function ${name}\\([^]*?\\n  \\}`))[0];
function setup() {
 const deleted = new Set();let seq=0;
 const c = {state:{pointsLedger:[],cigarettes:[],pausePeriods:[],habitEntries:[]}, SMOKE_DAILY_TARGET:10, SMOKE_DAILY_BASE_BONUS:50, SMOKE_DAILY_BONUS_PER_LESS:10, SMOKE_PAUSE_POINTS_REASON_PREFIX:'Rauchpause · 25 Pkt. pro Pausentag',
 saveState(){}, nowIso:()=> '2026-09-13T12:00:00.000Z',uid:()=>`new-${++seq}`,
 toDateKey:value=>{const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;},
 formatSignedPoints:p=>`+${p}`,markRemoteDeletedMany:(table,ids)=>ids.forEach(id=>deleted.add(id)),
 activePausePeriods:()=>c.state.pausePeriods.filter(p=>p.scope==='smoke'&&!p.is_archived),
 visibleCigarettes:()=>c.state.cigarettes.filter(row=>!c.isWithinPauseAt(row.smoked_at,{scope:'smoke'})),
 isAlcoholPointsEntry:()=>false,
 };
 vm.createContext(c);
 for(const name of ['isWithinPauseAt','pausePeriodsOverlappingRange','intervalCrossesPause','smokeDailyBonusSourceId','isSmokeDailyBonusEntry','smokeDailyBonusDay','smokeBonusDayPaused','smokeDailyBonusPoints','smokeDailyBonusReason','recalculateSmokeDailyBonuses','addPoints','createPointsLedgerWriter','isSmokePauseLedgerEntry','reconcileSmokePausePoints','isPausedLedgerPoint','visibleLedgerPoints','remoteLedgerSourceId','isUuid','recalculateSmokeIntervals','migrateCigaretteScoring'])vm.runInContext(block(name),c);
 return {c,deleted};
}
const legacy=(id,source_id=null)=>({id,source_type:'bonus',source_id,points:140,reason:'Rauchziel: 1 Zigarette · +140 Tagesbonus',earned_at:'2026-09-01T23:59:00.000Z',synced:true});
test('recovers lost source IDs, merges all variants and persists a valid day UUID',()=>{
 const {c,deleted}=setup();
 c.state.cigarettes=[{id:'c',smoked_at:'2026-09-01T12:00:00'}];
 c.state.pointsLedger=[legacy('a'),legacy('b','smoke-daily-bonus-2026-09-01'),legacy('c',c.smokeDailyBonusSourceId('2026-09-01'))];
 assert.equal(c.smokeDailyBonusDay(c.state.pointsLedger[0]),'2026-09-01','legacy 01:59 local belongs to previous accounting day');
 assert.equal(c.recalculateSmokeDailyBonuses(),true);
 assert.equal(c.state.pointsLedger.length,1);assert.equal(c.state.pointsLedger[0].points,140);
 assert.equal(c.state.pointsLedger[0].id,'c');assert.equal(deleted.size,2);
 assert.equal(c.remoteLedgerSourceId(c.state.pointsLedger[0]),c.smokeDailyBonusSourceId('2026-09-01'));
 assert.equal(c.recalculateSmokeDailyBonuses(),false,'repair must be idempotent');
 // Simulate old-device reintroduction after a remote pull.
 c.state.pointsLedger.push(legacy('remote-duplicate'));c.recalculateSmokeDailyBonuses();
 assert.equal(c.state.pointsLedger.length,1);assert.ok(deleted.has('remote-duplicate'));
});
test('full smoke pause removes both bonuses even when no cigarettes remain visible',()=>{
 const {c,deleted}=setup();
 c.state.pausePeriods=[{scope:'smoke',starts_at:'2026-08-09T14:00:00',ends_at:'2026-09-14T08:05:00'}];
 c.state.cigarettes=[{id:'c',smoked_at:'2026-09-01T14:59:00'}];
 c.state.pointsLedger=[legacy('a'),legacy('b'),{id:'habit',source_type:'habit',points:30}];
 assert.equal(c.visibleLedgerPoints().length,1,'pause filter excludes legacy bonuses immediately');
 c.migrateCigaretteScoring();assert.equal(c.state.pointsLedger.length,1);assert.equal(deleted.size,2);
});
test('partial and open pauses suppress bonuses; archived or other-scope pauses do not',()=>{
 const {c}=setup();c.state.cigarettes=[{id:'c',smoked_at:'2026-09-01T08:00:00'}];
 c.state.pausePeriods=[{scope:'smoke',starts_at:'2026-09-01T14:00:00',ends_at:null}];
 c.recalculateSmokeDailyBonuses();assert.equal(c.state.pointsLedger.length,0);
 c.state.pausePeriods[0].is_archived=true;c.recalculateSmokeDailyBonuses();assert.equal(c.state.pointsLedger.length,1);
 c.state.pausePeriods=[{scope:'alcohol',starts_at:'2026-08-01T00:00:00'}];assert.equal(c.smokeBonusDayPaused('2026-09-01'),false);
});
test('moving a pause restores only eligible days and preserves unrelated bonus sources',()=>{
 const {c}=setup();c.state.cigarettes=[{id:'c',smoked_at:'2026-09-01T08:00:00'}];
 c.state.pointsLedger=[{id:'routine',source_type:'bonus',reason:'Morgenroutine',points:50}];
 c.state.pausePeriods=[{scope:'smoke',starts_at:'2026-09-01T14:00:00'}];c.recalculateSmokeDailyBonuses();
 assert.equal(c.state.pointsLedger.length,1);
 c.state.pausePeriods[0].starts_at='2026-09-02T00:00:00';c.recalculateSmokeDailyBonuses();
 assert.equal(c.state.pointsLedger.length,2);assert.equal(c.state.pointsLedger.find(p=>p.id==='routine').points,50);
});
test('retire automatic pause deductions without touching other manual entries',()=>{
 const {c,deleted}=setup();c.state.pointsLedger=[{id:'old',source_type:'manual',reason:'Rauchpause · 25 Pkt. pro Pausentag · 35 Tage',points:-875},{id:'keep',source_type:'manual',reason:'Korrektur',points:20}];
 assert.equal(c.reconcileSmokePausePoints(),true);assert.ok(deleted.has('old'));assert.equal(c.state.pointsLedger.length,1);
 assert.equal(c.reconcileSmokePausePoints(),false);
});
test('existing daily scoring outside pauses remains unchanged',()=>{
 const {c}=setup();assert.equal(c.smokeDailyBonusPoints(0),0);assert.equal(c.smokeDailyBonusPoints(1),140);assert.equal(c.smokeDailyBonusPoints(10),50);assert.equal(c.smokeDailyBonusPoints(11),0);
});
