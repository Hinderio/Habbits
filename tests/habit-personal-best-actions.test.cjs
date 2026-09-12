const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const moduleSource = fs.readFileSync(path.join(root, 'modules', 'habit-story-coverage.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const styleSource = fs.readFileSync(path.join(root, 'modules', 'habit-personal-best.css'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

const personalBestBlock = moduleSource.match(/function longestSuccessStreak[\s\S]*?(?=\n  function chartIcon)/)?.[0];
assert.ok(personalBestBlock, 'personal-best calculation exists');

const context = {
  iconKey: habit => habit.iconKey || 'number',
  successDateKeys: (_habit, entries) => [...new Set(entries.filter(entry => entry.value_bool).map(entry => entry.date))].sort(),
  chartUnit: habit => habit.unit || '',
  formatChartValue: (value, unit) => `${value}${unit ? ` ${unit}` : ''}`
};
vm.runInNewContext(`${personalBestBlock}\nthis.personalBestFor = personalBestFor;`, context);

assert.equal(context.personalBestFor(
  { iconKey: 'hiking', type: 'number', direction: 'increase', unit: 'km' },
  [{ value_num: 7.3 }, { value_num: 12.4 }, { value_num: 5.1 }]
), '12.4 km', 'distance PB uses the best individual log');

assert.equal(context.personalBestFor(
  { iconKey: 'weight', type: 'weight', direction: 'increase', unit: 'kg' },
  [{ value_num: 83.2 }, { value_num: 0 }, { value_num: 81.7 }, { value_num: 82.1 }]
), '81.7 kg', 'weight PB always uses the lowest valid weighing');

assert.equal(context.personalBestFor(
  { iconKey: 'number', type: 'number', direction: 'decrease', unit: 'x' },
  [{ value_num: 4 }, { value_num: 0 }, { value_num: 2 }]
), '0 x', 'decrease PB respects zero as a valid value');

assert.equal(context.personalBestFor(
  { iconKey: 'boolean', type: 'boolean' },
  [
    { date: '2026-08-01', value_bool: true },
    { date: '2026-08-02', value_bool: true },
    { date: '2026-08-04', value_bool: false },
    { date: '2026-08-05', value_bool: true },
    { date: '2026-08-06', value_bool: true },
    { date: '2026-08-07', value_bool: true }
  ]
), '3 Tage', 'boolean PB is the longest successful streak');

assert.match(moduleSource, /class="habit-story-chart-stat is-personal-best"><span>PB<\/span>/);
assert.match(moduleSource, /const personalBest = personalBestFor\(habit, entries\)/);
assert.match(styleSource, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(styleSource, /@media \(max-width: 760px\)/);
assert.match(indexSource, /modules\/habit-personal-best\.css\?v=295/);
assert.match(workerSource, /\.\/modules\/habit-personal-best\.css/);

const detailStart = appSource.indexOf('function renderHabitDetailModal(habit)');
const detailEnd = appSource.indexOf('function timeBucketForHour(', detailStart);
const detailSource = appSource.slice(detailStart, detailEnd);
assert.match(detailSource, /class="consumption-icon-action"[^>]+data-action="edit-habit"/);
assert.match(detailSource, /class="consumption-icon-action consumption-icon-action-delete"[^>]+data-action="delete-habit"/);
assert.doesNotMatch(detailSource, /class="mini-btn danger"[^>]+data-action="delete-habit"/);

const entryStart = appSource.indexOf('function renderHabitEntryCard(habit, entry)');
const entryEnd = appSource.indexOf('function renderHabitEntryEditCard(', entryStart);
const entrySource = appSource.slice(entryStart, entryEnd);
assert.match(entrySource, /class="consumption-icon-action"[^>]+data-action="edit-habit-entry"/);
assert.match(entrySource, /class="consumption-icon-action consumption-icon-action-delete"[^>]+data-action="delete-habit-entry"/);
assert.doesNotMatch(entrySource, /class="mini-btn danger"[^>]+data-action="delete-habit-entry"/);

console.log('habit personal-best and icon-action checks passed');
