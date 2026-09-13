const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
function fn(name) {
  const start = source.lastIndexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n  }', start) + 4);
}
const records = [
  { id: 'old', log_date: '2026-07-26', consumption_key: 'heavy', consumption_level: 4 },
  { id: 'mon', log_date: '2026-07-27', consumption_key: 'light', consumption_level: 1 },
  { id: 'mon2', log_date: '2026-08-03', consumption_key: 'elevated', consumption_level: 3 },
  { id: 'sun', log_date: '2026-09-13', consumption_key: 'moderate', consumption_level: 2 },
  { id: 'future', log_date: '2026-09-14', consumption_key: 'heavy', consumption_level: 4 }
];
const levels = { light: { rank: 1, label: 'Leicht', short: 'Ein Getränk' }, moderate: { rank: 2, label: 'Moderat', short: 'Zwei' }, elevated: { rank: 3, label: 'Erhöht', short: 'Drei' }, heavy: { rank: 4, label: 'Stark', short: 'Vier' } };
const context = vm.createContext({
  ALCOHOL_ANALYSIS_START: '2026-07-27', ALCOHOL_DAY_LEVELS: levels, DAY_MS: 86400000,
  visibleAlcoholDays: () => records, toDateKey: () => '2026-09-13',
  smokingWeekdayLabel: day => ['So','Mo','Di','Mi','Do','Fr','Sa'][day],
  alcoholPointsForDay: day => ({ old: -120, mon: -10, mon2: -70, sun: -30, future: -120 })[day.id],
  sum: values => values.reduce((a,b) => a+b, 0), escapeHtml: String, formatSignedPoints: String,
  els: { alcoholIntervalVisual: {}, alcoholIntervalQuality: {}, alcoholHeatmapVisual: {}, alcoholHeatmapBadge: {} },
  calendarWeeksBack: () => [{ key: '2026-31', label: 'KW 31' }],
  isoWeekInfo: () => ({ key: '2026-31' }), alcoholDayLevel: key => levels[key],
  formatDate: String, requestAnimationFrame: () => {}
});
for (const name of ['alcoholAnalysisDays','alcoholWeekdayPoints','renderAlcoholWeekdayProfile','alcoholFreeStreakStats','renderAlcoholIntervalVisual','renderAlcoholWeekHeatmap']) vm.runInContext(fn(name), context);
const days = context.alcoholAnalysisDays();
assert.deepEqual(days.map(d => d.id), ['mon', 'mon2', 'sun']);
assert.equal(context.alcoholAnalysisDays('2026-07-26').length, 0);
const profile = context.alcoholWeekdayPoints(days);
assert.equal(profile.length, 7);
assert.equal(profile[0].points, -80);
assert.equal(profile[6].points, -30);
assert.equal(profile[1].points, 0);
assert.equal(context.alcoholFreeStreakStats([], '2026-08-02', '2026-07-27').best, 7);
assert.equal(context.alcoholFreeStreakStats([{ log_date: '2026-08-02' }], '2026-08-02', '2026-07-27').best, 6);
assert.equal(context.alcoholFreeStreakStats(days, '2026-09-13', '2026-07-27').best, 40);
assert.equal(context.alcoholFreeStreakStats(days, '2026-09-13', '2026-07-27').current, 0);
context.renderAlcoholIntervalVisual();
const html = context.els.alcoholIntervalVisual.innerHTML;
assert.match(html, /46 von 49 Tagen/);
assert.match(html, /Konsumtage<\/small><strong>3<\/strong>/);
assert.match(html, /is-heavy[\s\S]*?<strong>0 Tage/);
assert.doesNotMatch(html, /30-Tage|0h|24h/);
assert.match(html, /Mo/); assert.match(html, /So/);
records.splice(0, records.length,
  { id: 'a', log_date: '2026-07-27', consumption_key: 'elevated', consumption_level: 3 },
  { id: 'b', log_date: '2026-07-28', consumption_key: 'elevated', consumption_level: 3 },
  { id: 'c', log_date: '2026-07-30', consumption_key: 'moderate', consumption_level: 2 },
  { id: 'd', log_date: '2026-08-01', consumption_key: 'moderate', consumption_level: 2 });
context.renderAlcoholWeekHeatmap(1);
assert.match(context.els.alcoholHeatmapVisual.innerHTML, /KW 31 \| 10/);
console.log('Alcohol analytics: cutoff, weekday points, full-period distribution, streak boundaries and weekly sums passed');
