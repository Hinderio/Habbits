const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const source = fs.readFileSync(path.join(root, 'modules/consumption-year-overview.js'), 'utf8');
function appFunction(name) {
  const start = app.lastIndexOf(`  function ${name}(`);
  return app.slice(start, app.indexOf('\n  }', start) + 4);
}
let records = [
  { log_date: '2026-07-26', consumption_level: 4 },
  { log_date: '2026-07-27', consumption_level: 1 },
  { log_date: '2026-07-28', consumption_level: 2 },
  { log_date: '2026-08-01', consumption_level: 3 },
  { log_date: '2026-09-17', consumption_level: 4 },
  { log_date: '2026-09-18', consumption_level: 4 }
];
const domain = vm.createContext({ visibleAlcoholDays: () => records, toDateKey: () => '2026-09-17', ALCOHOL_ANALYSIS_START: '2026-07-27' });
vm.runInContext(appFunction('alcoholAnalysisDays'), domain);
assert.match(app, /alcoholDays: \(\) => alcoholAnalysisDays\(\)\.map/);
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-09-17T12:00:00'])); } }
const window = { HabitFlowConsumptionLive: { alcoholDays: () => domain.alcoholAnalysisDays() } };
const context = vm.createContext({ window, Date: FixedDate, Intl, console, document: { readyState: 'loading', addEventListener() {} } });
vm.runInContext(source.replace('})(window);', 'window.test = { buildOverview, signatureFor, alcoholDailyRatings };\n})(window);'), context);
const state = { alcoholUnits: [{ occurred_at: '2026-05-01T12:00:00' }], cigarettes: [{ smoked_at: '2026-09-16T12:00:00' }] };
const html = window.test.buildOverview('alcohol', state);
assert.equal(window.test.alcoholDailyRatings(2026).size, 4);
assert.match(html, /10 Intensitätspunkte/);
assert.match(html, /Ø Intensität<\/small><strong>2,5/);
assert.match(html, /2026-07-27 · Stufe 1 · Leicht/);
assert.match(html, /2026-09-17 · Stufe 4 · Stark/);
assert.match(html, /2026-07-26 · Vor Auswertungsbeginn/);
assert.doesNotMatch(html, /Einheiten|level-5/);
assert.match(html, /<small>3 Pkt\.<\/small>/);
const before = window.test.signatureFor('alcohol', state);
records[1].consumption_level = 4;
assert.notEqual(window.test.signatureFor('alcohol', state), before, 'rating edits invalidate rendered card');
records = [];
assert.match(window.test.buildOverview('alcohol', state), /0 Intensitätspunkte/);
assert.match(window.test.buildOverview('smoke', state), /1 Zigarette/);
console.log('Alcohol year ratings: cutoff, four levels, summaries, edits, empty data and smoking regression passed');
