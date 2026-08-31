const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
assert.match(source, /requestIdleCallback/);
assert.match(source, /new MutationObserver/);
assert.doesNotMatch(source, /setInterval\(/);
assert.doesNotMatch(source, /localStorage\.setItem/);
assert.doesNotMatch(source, /fetch\(|supabase/i);
assert.match(source, /storyPanel\.insertAdjacentElement\('beforebegin', root\)/);

assert.match(css, /^\.hf-ghost-arena/m);
assert.match(css, /content-visibility: auto/);
assert.match(css, /@media \(max-width: 760px\)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.doesNotMatch(css, /@keyframes/);

assert.match(indexSource, /modules\/ghost-arena\.css\?v=287/);
assert.match(indexSource, /modules\/ghost-arena\.js\?v=287/);
assert.match(workerSource, /\.\/modules\/ghost-arena\.js/);
assert.match(workerSource, /\.\/modules\/ghost-arena\.css/);
assert.match(workerSource, /habitflow-v287-ghost-arena-rolling-weeks/);

console.log('ghost arena isolation and performance checks passed');
