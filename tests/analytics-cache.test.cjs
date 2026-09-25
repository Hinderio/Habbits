const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const before = fs.readFileSync(path.join(__dirname, 'fixtures/analytics-before-cache.js'), 'utf8');
const block = (name, source = app) => source.match(new RegExp(`  function ${name}\\([^]*?\\n  \\}`))[0];
const plain = x => JSON.parse(JSON.stringify(x));
function setup() {
  let now = new Date('2026-09-16T12:00:00').getTime();
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const state = { cigarettes: [], habitEntries: [], pointsLedger: [], habits: [], tasks: [], monthlyMissions: [], morningRoutineLogs: [], alcoholDays: [], pausePeriods: [] };
  const counts = { cigarettes: 0, habits: 0, ledger: 0, reviews: 0 };
  const dateKey = value => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const paused = row => state.pausePeriods.some(p => row.id === p.id);
  const c = vm.createContext({ state, Date: Clock, console, counts,
    toDateKey: dateKey, sum: values => values.reduce((a,b) => a+b,0),
    visibleCigarettes: () => { counts.cigarettes++; return state.cigarettes.filter(r => !paused(r)); },
    visibleHabitEntries: id => { counts.habits++; return state.habitEntries.filter(r => !paused(r) && (!id || r.habit_id === id)); },
    visibleLedgerPoints: () => { counts.ledger++; return state.pointsLedger.filter(r => !paused(r)); },
    visibleAlcoholDays: () => state.alcoholDays.filter(r => !paused(r)),
    normalizeHabit: row => row, normalizeTask: row => row,
    normalizeMonthlyMission: row => ({ manual_count: 0, target: 1, title: 'Mission', month_key: '2026-09', ...row }),
    normalizeIconSearch: value => String(value).toLowerCase(),
    parseTaskRecurrenceFromDescription: description => ({description}),
    currentMonthKey: () => dateKey(new Clock()).slice(0,7),
    monthKeyRange: key => { const [y,m] = key.split('-').map(Number); return {end:new Clock(y,m,0,12)}; },
    monthKeyLabel: key => key, formatMagazineDate: key => key,
    formatKmValue: x => `${x} km`, formatMetersValue: x => `${x} m`,
    clampNumber: (x,a,b) => Math.max(a,Math.min(b,x)),
    monthlyMissionMetricMeta: () => ({unit:'Logs'}),
    monthlyMagazineCoverUrl: score => ({url:`cover-${score}`, file:'cover'}),
    buildFitnessSessions: filter => c.sessions.filter(s => filter === 'all' || s.type === filter),
    sessions: [],
  });
  vm.runInContext('let analyticsReadCache = null; const monthlyMagazineReviewCache = new Map(); let monthlyMagazineCovers = [];',c);
  const names = ['withAnalyticsReadScope','analyticsRead','groupAnalyticsRows','analyticsDayRows','cigaretteLedgerSourceIds',
    'pointsOnDate','calendarPointsOnDate','getLastCigarette','cigarettesOnDate','entriesForHabitOnDate',
    'monthMissionKeys','monthMissionTotalDays','entryTextMatchesFocus','countMonthlyMissionProgress','monthlyMissionState','activeMonthlyMissions',
    'monthlyMissionSummary','monthlyMissionStatusText','monthlyMagazinePoints','buildMonthlyMagazineBestDay','buildMonthlyMagazineReview','cachedMonthlyMagazineReviews'];
  names.forEach(name => vm.runInContext(block(name),c));
  for (const name of ['pointsOnDate','calendarPointsOnDate','getLastCigarette','cigarettesOnDate','entriesForHabitOnDate','buildMonthlyMagazineReview']) {
    vm.runInContext(block(name,before).replace(`function ${name}(`,`function old_${name}(`),c);
  }
  vm.runInContext('const originalReview = buildMonthlyMagazineReview; buildMonthlyMagazineReview = (...args) => { counts.reviews++; return originalReview(...args); };',c);
  const source = () => ({ sessions:c.sessions, cigarettes:c.visibleCigarettes(), alcoholUnits:state.alcoholDays.map(r => ({...r,occurred_at:r.log_date})), tasks:state.tasks, habitEntries:c.visibleHabitEntries(), ledger:c.visibleLedgerPoints(), compass:{weakest:{label:'Fitness',cue:'Train'}} });
  return {c,state,counts,source,advance: ms => { now += ms; }};
}
function seed(state) {
  state.habits.push({id:'h',name:'Fokus',type:'number'});
  for (let i=0;i<180;i++) {
    const day = `2026-${i%2 ? '08':'09'}-${String(i%15+1).padStart(2,'0')}T${String(i%24).padStart(2,'0')}:00:00`;
    state.cigarettes.push({id:`c${i}`,smoked_at:day,points:i%7});
    state.habitEntries.push({id:`h${i}`,habit_id:'h',occurred_at:day,value_num:i});
    if (i%3) state.pointsLedger.push({id:`p${i}`,source_type:i%2 ? 'cigarette':'habit',source_id:`c${i}`,earned_at:day,points:i%5-2});
  }
  state.tasks.push({id:'t',title:'Fokus',status:'done',completed_at:'2026-08-12T12:00:00'});
  state.monthlyMissions.push({id:'m',month_key:'2026-08',metric:'completed_tasks',target:3});
}
test('day indices match legacy results and scan each collection only once per scope', () => {
  const {c,state,counts}=setup(); seed(state); state.pausePeriods.push({id:'c2'},{id:'h5'},{id:'p7'});
  const keys=Array.from({length:15},(_,i)=>`2026-09-${String(i+1).padStart(2,'0')}`);
  const expected=keys.map(key=>[c.old_pointsOnDate(key),c.old_calendarPointsOnDate(key),c.old_cigarettesOnDate(key),c.old_entriesForHabitOnDate('h',key)]);
  counts.cigarettes=counts.habits=counts.ledger=0;
  const actual=c.withAnalyticsReadScope(()=>keys.map(key=>[c.pointsOnDate(key),c.calendarPointsOnDate(key),c.cigarettesOnDate(key),c.entriesForHabitOnDate('h',key)]));
  assert.deepEqual(plain(actual),plain(expected));
  assert.deepEqual([counts.cigarettes,counts.habits,counts.ledger],[1,1,1]);
});
test('scopes release on errors and see in-place edits, pause changes and replaced state arrays',()=>{
  const {c,state}=setup(); seed(state);
  assert.throws(()=>c.withAnalyticsReadScope(()=>{c.cigarettesOnDate('2026-09-01');throw Error('render');}));
  state.cigarettes[0].smoked_at='2026-09-02T12:00:00'; state.pausePeriods.push({id:'c2'});
  for(const key of ['2026-09-01','2026-09-02','2026-09-03']) assert.deepEqual(plain(c.withAnalyticsReadScope(()=>c.cigarettesOnDate(key))),plain(c.old_cigarettesOnDate(key)));
  state.cigarettes=[];
  assert.equal(c.withAnalyticsReadScope(()=>c.getLastCigarette()),null);
});
test('returned day arrays remain independent, and nested scopes share the index',()=>{
  const {c,state,counts}=setup();seed(state);
  c.withAnalyticsReadScope(()=>{const rows=c.cigarettesOnDate('2026-09-01');const n=rows.length;rows.length=0;assert.equal(c.withAnalyticsReadScope(()=>c.cigarettesOnDate('2026-09-01')).length,n);});
  assert.equal(counts.cigarettes,1);
});
test('latest cigarette preserves ties, invalid timestamps and input ordering',()=>{
  const {c,state}=setup();seed(state);
  for(const rows of [[],state.cigarettes,[{id:'a',smoked_at:'2026-09-01'},{id:'b',smoked_at:'2026-09-01'}],[{smoked_at:'invalid'},...state.cigarettes],[...state.cigarettes,{smoked_at:'invalid'}]]) {
    state.cigarettes=rows;const original=plain(rows);assert.equal(c.getLastCigarette(),c.old_getLastCigarette());assert.deepEqual(plain(rows),original);
  }
});
test('magazine cache matches original reviews, reuses unchanged issues and invalidates only edited month',()=>{
  const {c,state,counts,source}=setup();seed(state);const keys=['2026-09','2026-08'];
  const read=()=>c.withAnalyticsReadScope(()=>c.cachedMonthlyMagazineReviews(keys,source()));
  const first=read();assert.deepEqual(plain(first),plain(keys.map(k=>c.old_buildMonthlyMagazineReview(k,source()))));
  const second=read();assert.equal(counts.reviews,2);assert.equal(first[0],second[0]);assert.equal(first[1],second[1]);
  state.tasks[0].title='Historical edit';const third=read();assert.equal(first[0],third[0]);assert.notEqual(first[1],third[1]);assert.equal(counts.reviews,3);
});
test('magazine invalidation follows pauses, moved dates, ledger fallback, missions, definitions and global dependencies',()=>{
  const {c,state,source}=setup();seed(state);const keys=['2026-09','2026-08'];
  let focus='Fitness'; const currentSource=()=>({...source(),compass:{weakest:{label:focus,cue:'Train'}}});
  const read=()=>c.withAnalyticsReadScope(()=>c.cachedMonthlyMagazineReviews(keys,currentSource()));
  const verify=()=>assert.deepEqual(plain(read()),plain(keys.map(k=>c.old_buildMonthlyMagazineReview(k,currentSource()))));
  verify();
  for(const mutate of [
    ()=>state.pausePeriods.push({id:'c0'},{id:'p1'},{id:'h2'}),
    ()=>{state.cigarettes[3].smoked_at='2026-09-01T19:00:00';},
    ()=>state.pointsLedger.push({source_type:'cigarette',source_id:'c6',earned_at:'2020-01-01',points:0}),
    ()=>{state.monthlyMissions[0].metric='deep_work_sessions';},
    ()=>{state.habits[0].name='Other';},
    ()=>state.morningRoutineLogs.push({date_key:'2026-08-01'}),
    ()=>state.alcoholDays.push({id:'a',log_date:'2026-08-02'}),
    ()=>{focus='Meditation';},
    ()=>{state.habits.push({id:'w',type:'weight',name:'Gewicht'});state.monthlyMissions.push({month_key:'2026-08',metric:'weight_measurements',target:70});},
    ()=>state.habitEntries.push({id:'w1',habit_id:'w',occurred_at:'2026-09-16',value_num:80}),
    ()=>{state.habitEntries.at(-1).value_num=65;},
    ()=>{state.pausePeriods=[];}
  ]) {mutate();verify();}
});
test('day rollover updates the live issue without rebuilding unaffected historical issues; cache is bounded',()=>{
  const {c,state,source,advance}=setup();seed(state);const keys=['2026-09','2026-08'];
  const first=c.cachedMonthlyMagazineReviews(keys,source());advance(86400000);const second=c.cachedMonthlyMagazineReviews(keys,source());
  assert.notEqual(first[0],second[0]);assert.equal(first[1],second[1]);
  assert.deepEqual(plain(second),plain(keys.map(k=>c.old_buildMonthlyMagazineReview(k,source()))));
  c.cachedMonthlyMagazineReviews(['2026-09'],source());assert.equal(vm.runInContext('monthlyMagazineReviewCache.size',c),1);
});
test('habit render retains card and overview markup with one DNA calculation per habit',()=>{
  const {c,state}=setup();state.habits=[{id:'a',name:'A',type:'number'},{id:'b',name:'B',type:'boolean'}];
  let calls=0;
  Object.assign(c,{document:{activeElement:null},els:{habitCards:{},habitDnaOverview:{}},editingHabitId:null,
    collectHabitInputDrafts:()=>[],renderHabitHeatmap(){},syncHabitsExperienceUi(){},pruneExpandedHabitCardIds(){},renderHabitPlayfulStats(){},
    habitTargetPeriodMeta:()=>({short:'Tag'}),habitValueForPeriod:()=>({label:'0'}),effectiveHabitUnit:()=>'',
    habitCategoryMeta:()=>({label:'Habit'}),habitCategoryStyle:()=>'',habitIconKey:()=>'',activePauseNow:()=>null,
    habitFulfillmentState:()=>false,habitProgressPercent:()=>0,isSystemMeditationHabit:()=>false,isFitnessDistanceHabit:()=>false,
    formatHabitValue:(_,v)=>String(v),renderHabitQuickLogControl:()=>'<input>',escapeHtml:String,svgIcon:()=>'',typeLabel:()=>'',
    buildHabitDna:habit=>{calls++;return {habit,entries:[],completionRate:0.72,riskMeta:{tone:'high'},strengthScore:20,riskScore:50,difficulty:2};},
    groupPatternSummary:()=> 'pattern'
  });
  ['buildHabitDnaPortfolio','renderHabits','renderHabitsContent','renderHabitDnaOverview'].forEach(n=>vm.runInContext(block(n),c));
  c.renderHabits();const expected=plain(c.els);assert.equal(calls,2);
  vm.runInContext(block('renderHabits',before),c);vm.runInContext(block('renderHabitDnaOverview',before),c);
  calls=0;c.renderHabits();assert.equal(calls,4);assert.deepEqual(plain(c.els),expected);
});
test('habit history index is shared across habits without exposing its arrays',()=>{
  const {c,state,counts}=setup();seed(state);vm.runInContext(block('analyticsHabitEntries'),c);
  c.withAnalyticsReadScope(()=>{
    assert.equal(c.analyticsHabitEntries('h').length,180);
    c.analyticsHabitEntries('h').reverse().pop();
    assert.deepEqual(plain(c.analyticsHabitEntries('h')),plain(state.habitEntries));
    assert.equal(c.analyticsHabitEntries('missing').length,0);
  });
  assert.equal(counts.habits,1);
});
test('month rollover finalizes the old issue and refreshed covers invalidate cached reviews',()=>{
  const {c,state,source,advance,counts}=setup();seed(state);
  const first=c.cachedMonthlyMagazineReviews(['2026-09','2026-08'],source());
  advance(15*86400000);
  const next=c.cachedMonthlyMagazineReviews(['2026-10','2026-09','2026-08'],source());
  assert.equal(next[1].isComplete,true);assert.equal(next[2],first[1]);
  assert.deepEqual(plain(next),plain(['2026-10','2026-09','2026-08'].map(k=>c.old_buildMonthlyMagazineReview(k,source()))));
  const previous=counts.reviews;
  vm.runInContext("monthlyMagazineCovers = [{file:'new.png'}]",c);
  c.cachedMonthlyMagazineReviews(['2026-10','2026-09','2026-08'],source());
  assert.equal(counts.reviews,previous+3);
});
