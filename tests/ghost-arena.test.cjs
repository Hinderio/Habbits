const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'modules/ghost-arena.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'modules/ghost-arena.css'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

assert.match(source, /currentStart\.setDate\(currentStart\.getDate\(\) - 6\)/);
assert.match(source, /const previousStart = new Date\(currentStart\)/);
assert.match(source, /previousStart\.setDate\(previousStart\.getDate\(\) - 7\)/);
assert.match(source, /const previousEnd = new Date\(now\)/);
assert.match(source, /previousEnd\.setDate\(previousEnd\.getDate\(\) - 7\)/);
assert.match(source, /elapsedDays: 7/);
assert.match(source, /Rollierender Vergleich: letzte 7 Tage gegen die 7 Tage davor/);
assert.match(source, /function detectBoss\(/);
assert.match(source, /Rhythmusbruch/);
assert.match(source, /Offene Schleifen/);
assert.match(source, /-Autopilot/);
assert.match(source, /Wochenend-Sog/);
assert.match(source, /metricCard\('Wandern'/);
assert.match(source, /metricCard\('Joggen'/);
assert.match(source, /metricCard\('Alkohol-Tage'/);
assert.match(source, /metricCard\('Liegestütze'/);
assert.match(source, /metricCard\('Meditation'/);
assert.match(source, /requestIdleCallback/);
assert.match(source, /new MutationObserver/);
assert.doesNotMatch(source, /setInterval\(/);
assert.doesNotMatch(source, /localStorage\.setItem/);
assert.doesNotMatch(source, /fetch\(|supabase/i);
assert.match(source, /storyPanel\.insertAdjacentElement\('beforebegin', root\)/);

const instrumented = source.replace(
  /\}\)\(window, document\);\s*$/,
  'window.__ghostArenaTest = { comparisonWindows, metricsForRange, ghostScore }; })(window, document);'
);
const testWindow = {
  localStorage: { getItem: () => '{}' },
  addEventListener() {},
  clearTimeout() {},
  setTimeout() {}
};
const testDocument = { readyState: 'loading', addEventListener() {} };
vm.runInNewContext(instrumented, { window: testWindow, document: testDocument, Date, Intl, Set, Map, Math, JSON });
const { comparisonWindows, metricsForRange, ghostScore } = testWindow.__ghostArenaTest;
const windows = comparisonWindows(new Date('2026-08-31T15:00:00'));
assert.equal(windows.elapsedDays, 7);
assert.equal(new Date(windows.current.start).getDate(), 25);
assert.equal(new Date(windows.previous.start).getDate(), 18);
assert.equal(new Date(windows.previous.end).getDate(), 24);

const state = {
  habits: [
    { id: 'hike', name: 'Wandern', icon: 'hiking' },
    { id: 'run', name: 'Joggen', icon: 'jogging' },
    { id: 'push', name: 'Liegestütze', icon: 'pushups' },
    { id: 'mind', name: 'Ruhezeit', icon: '🧘', system_key: 'meditation' }
  ],
  habitEntries: [
    { habit_id: 'hike', value_num: 12.5, occurred_at: '2026-08-27T09:00:00' },
    { habit_id: 'run', value_num: 5.2, occurred_at: '2026-08-28T09:00:00' },
    { habit_id: 'push', value_num: 30, occurred_at: '2026-08-29T09:00:00' },
    { habit_id: 'mind', value_num: 15, occurred_at: '2026-08-30T09:00:00' }
  ],
  alcoholLogs: [
    { log_date: '2026-08-27', consumed: true },
    { log_date: '2026-08-28', consumed: false }
  ],
  alcoholUnits: [], cigarettes: [], tasks: [], pausePeriods: []
};
const metrics = metricsForRange(state, windows.current, 7);
assert.equal(metrics.hikingDistance, 12.5);
assert.equal(metrics.joggingDistance, 5.2);
assert.equal(metrics.pushups, 30);
assert.equal(metrics.meditationMinutes, 15);
assert.equal(metrics.alcoholDays, 1);
const score = ghostScore(metrics, { ...metrics, hikingDistance: 0, joggingDistance: 0, pushups: 0, meditationMinutes: 0 });
assert.equal(score.current + score.ghost, 100);

assert.match(css, /^\.hf-ghost-arena/m);
assert.match(css, /content-visibility: auto/);
assert.match(css, /@media \(max-width: 760px\)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.doesNotMatch(css, /@keyframes/);

assert.match(indexSource, /modules\/ghost-arena\.css\?v=288/);
assert.match(indexSource, /modules\/ghost-arena\.js\?v=288/);
assert.match(workerSource, /\.\/modules\/ghost-arena\.js/);
assert.match(workerSource, /\.\/modules\/ghost-arena\.css/);
assert.match(workerSource, /habitflow-v288-ghost-arena-production/);

console.log('ghost arena isolation and performance checks passed');
