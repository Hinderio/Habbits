const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'modules/ghost-arena.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'modules/ghost-arena.css'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

assert.match(source, /const previousStart = new Date\(currentStart\.getTime\(\) - 7 \* DAY_MS\)/);
assert.match(source, /const previousEnd = new Date\(previousStart\.getTime\(\) \+ elapsed\)/);
assert.match(source, /Fairer Vergleich: laufende Woche gegen denselben Zeitraum der Vorwoche/);
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

assert.match(indexSource, /modules\/ghost-arena\.css\?v=286/);
assert.match(indexSource, /modules\/ghost-arena\.js\?v=286/);
assert.match(workerSource, /\.\/modules\/ghost-arena\.js/);
assert.match(workerSource, /\.\/modules\/ghost-arena\.css/);
assert.match(workerSource, /habitflow-v286-ghost-arena/);

console.log('ghost arena isolation and performance checks passed');
