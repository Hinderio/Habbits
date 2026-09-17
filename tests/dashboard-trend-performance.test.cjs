const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function extract(name, text = source) {
  const start = text.indexOf('  function ' + name + '(');
  assert.ok(start >= 0, name);
  const end = text.indexOf('\n  function ', start + 1);
  return text.slice(start, end < 0 ? text.length : end);
}

function harness(text = source) {
  const names = ['toDateKey', 'daysBack', 'trendChartKeys', 'getTrendMetricConfig',
    'habitValueForDay', 'entriesForHabitOnDate', 'withAnalyticsReadScope', 'analyticsRead',
    'groupAnalyticsRows', 'analyticsDayRows', 'cigaretteLedgerSourceIds', 'cigarettesOnDate',
    'pointsOnDate', 'renderCharts'];
  if (text.includes('  function renderTrendChart(')) names.push('renderTrendChart');
  return new Function(names.map(name => extract(name, text)).join('\n') + `
    let selectedTrendMetric = 'habit:weight';
    let analyticsReadCache = null;
    const state = { habits: [
      {id:'weight', name:'Weight', type:'weight', unit:'kg'},
      {id:'count', name:'Count', type:'counter'},
      {id:'boolean', name:'Check', type:'boolean'},
      {id:'distance', name:'Distance', type:'boolean', unit:'km'}
    ], habitEntries: [], pointsLedger: [], cigarettes: [], alcohol: [] };
    const scans = { habits:0, smoke:0, ledger:0, alcohol:0 };
    const visibleHabitEntries = id => {
      scans.habits++;
      return state.habitEntries.filter(row => !row.paused && (!id || row.habit_id === id));
    };
    const visibleCigarettes = () => { scans.smoke++; return state.cigarettes.filter(row => !row.paused); };
    const visibleLedgerPoints = () => { scans.ledger++; return state.pointsLedger.filter(row => !row.paused); };
    const visibleAlcoholDays = () => { scans.alcohol++; return state.alcohol.filter(row => !row.paused); };
    const alcoholUnitsOnDate = key => visibleAlcoholDays().filter(row => row.log_date === key);
    const isFitnessDistanceHabit = habit => habit.id === 'distance';
    const effectiveHabitUnit = habit => habit.unit || '';
    const typeLabel = type => type;
    const sum = values => values.reduce((total, value) => total + value, 0);
    const window = {Chart:true};
    const els = {trendChart:'left', pointsChart:'right', trendChartTitle:{}};
    const charts = {};
    let rightDraws = 0;
    const drawChart = (existing, canvas, labels, data, label, options) => {
      if (canvas === 'right') rightDraws++;
      return {labels, data, options};
    };
    const dashboardChartKeys = () => daysBack(14);
    const syncDashboardChartControls = () => {};
    return {state, scans, charts, keys:trendChartKeys,
      metric(value) {selectedTrendMetric=value;},
      render() { ` + (text.includes('  function renderTrendChart(') ? 'renderTrendChart();' : 'renderCharts();') + ` },
      all:renderCharts, rightDraws:()=>rightDraws,
      cache:()=>analyticsReadCache
    };
  `)();
}

const h = harness();
const oldDate = '2023-01-01T12:00:00';
h.state.habitEntries.push(
  {habit_id:'weight', occurred_at:oldDate, value_num:90},
  {habit_id:'weight', occurred_at:'2023-01-01T18:00:00', value_num:89},
  {habit_id:'weight', occurred_at:'2023-01-03T12:00:00', value_num:88},
  {habit_id:'weight', occurred_at:'2020-01-01T12:00:00', value_num:100, paused:true},
  {habit_id:'count', occurred_at:oldDate, value_num:2},
  {habit_id:'count', occurred_at:oldDate, value_num:3},
  {habit_id:'boolean', occurred_at:oldDate, value_bool:false},
  {habit_id:'boolean', occurred_at:oldDate, value_bool:true},
  {habit_id:'distance', occurred_at:oldDate, value_num:2.5},
  {habit_id:'distance', occurred_at:oldDate, value_num:3.5}
);
h.render();
const keys = h.keys();
assert.equal(keys[0], '2023-01-01');
assert.ok(keys.length > 365);
assert.deepEqual(h.charts.trend.data.slice(0,3), [89,null,88]);
assert.equal(h.charts.trend.labels[0], '01.01.');
assert.equal(h.charts.trend.options.instant, true);
assert.equal(h.cache(), null);
assert.equal(h.rightDraws(), 0);
assert.equal(h.scans.habits, 3); // range, indexed rows, explicit keys() above
for (const [metric, expected] of [['count',5],['boolean',1],['distance',6]]) {
  h.metric('habit:' + metric);
  h.render();
  assert.equal(h.charts.trend.data[0], expected);
}
h.metric('habit:weight');
h.state.habitEntries[1].value_num = 87;
h.render();
assert.equal(h.charts.trend.data[0],87, 'in-place edits must invalidate the render indices');
h.state.habitEntries.splice(1,1);
h.render();
assert.equal(h.charts.trend.data[0],90, 'deleted entries must disappear');

h.state.cigarettes.push({id:'a',smoked_at:oldDate,points:10},{id:'b',smoked_at:oldDate,points:7});
h.state.pointsLedger.push({source_type:'cigarette',source_id:'a',earned_at:oldDate,points:10});
h.metric('points');
h.render();
assert.equal(h.charts.trend.data[0],17, 'legacy cigarette points counted once');
h.metric('cigarettes');
h.render();
assert.equal(h.charts.trend.data[0],2);
h.state.alcohol.push({log_date:'2023-01-01'});
h.metric('alcohol');
h.render();
assert.equal(h.charts.trend.data[0],1);
assert.equal(h.scans.alcohol,2, 'alcohol history is built twice per render, not once per day');
h.all();
assert.equal(h.charts.points.data.length,14);
assert.equal(h.charts.points.options.instant,undefined);
assert.equal(h.rightDraws(),1);

const empty = harness();
empty.render();
assert.deepEqual(empty.charts.trend.data,[null]);

const colors = new Function(
  extract('chartToneForValue') + extract('chartPointTone') + extract('buildChartDataset') +
  ';return {buildChartDataset,chartToneForValue};'
)();
const data = Array.from({length:10000}, (_,i)=>i%301-100);
let visits = 0;
const tracked = new Proxy(data, {get(target,key) {if (/^\d+$/.test(String(key))) visits++; return target[key];}});
const dataset = colors.buildChartDataset('Points', tracked, {toneMode:'score'});
const afterBuild = visits;
for (const value of data) {
  const ctx = {parsed:{y:value}};
  assert.equal(dataset.pointBackgroundColor(ctx), colors.chartToneForValue(value));
}
assert.equal(visits,afterBuild,'point colors must not rescan the dataset');

const chartHarness = new Function('Chart', extract('buildChartDataset') + extract('chartToneForValue') +
  extract('chartPointTone') + extract('drawChart') + `
  const window={matchMedia:()=>({matches:false})};
  const document={documentElement:{}};
  const getComputedStyle=()=>({getPropertyValue:()=>''});
  return drawChart;
`);
function Chart(canvas, config) {Object.assign(this,config); this.update=mode=>{this.mode=mode;};}
const draw = chartHarness(Chart);
const left = draw(null,{},['01.01.'],[1],'Count',{instant:true});
assert.equal(left.options.animation,false);
draw(left,{},['02.01.'],[2],'Count',{instant:true});
assert.equal(left.mode,'none');
const right = draw(null,{},['01.01.'],[1],'Points',{});
assert.deepEqual(right.options.animation,{duration:220});
console.log('dashboard trend performance and correctness checks passed');
