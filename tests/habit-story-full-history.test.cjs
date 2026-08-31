const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const moduleSource = fs.readFileSync(path.join(root, 'modules/habit-story-coverage.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

const buildPointsBlock = moduleSource.match(/function buildChartPoints\([\s\S]*?(?=\n  function chartIcon)/)?.[0];
assert.ok(buildPointsBlock, 'habit story chart point builder exists');
assert.doesNotMatch(buildPointsBlock, /\.slice\(-14\)/);
assert.match(buildPointsBlock, /return \[\.\.\.grouped\.entries\(\)\]/);
assert.match(moduleSource, /const dotRadius = points\.length <= 14 \? 5 : Math\.max\(1\.35,/);
assert.match(moduleSource, /r="\$\{dotRadius\.toFixed\(2\)\}"/);
assert.match(moduleSource, /if \(\['hiking', 'jogging', 'walking'\]\.includes\(key\)\) return 'km'/);
assert.match(moduleSource, /const isDistanceHabit = \['hiking', 'jogging', 'walking'\]\.includes\(key\)/);
assert.match(moduleSource, /const value = isDistanceHabit[\s\S]*?Number\(entry\.value_num \|\| 0\)[\s\S]*?habit\.type === 'boolean'/);
assert.match(indexSource, /modules\/habit-story-coverage\.js\?v=285/);
assert.match(workerSource, /\.\/modules\/habit-story-coverage\.js/);
assert.match(workerSource, /habitflow-v288-ghost-arena-production/);

console.log('habit story full-history checks passed');
