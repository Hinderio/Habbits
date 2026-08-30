const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const appSource = read('app.js');
const indexSource = read('index.html');
const workerSource = read('service-worker.js');
const mobileCss = read('modules/fitness-detail-mobile.css');

assert.match(indexSource, /modules\/fitness-detail-mobile\.css\?v=275/);
assert.match(workerSource, /\.\/modules\/fitness-detail-mobile\.css/);
assert.match(mobileCss, /@media \(max-width: 760px\) and \(orientation: portrait\)/);
assert.doesNotMatch(mobileCss, /@media[^\n]*orientation: landscape/);
assert.match(mobileCss, /#screen-fitness \.fitness-detail-tabs/);
assert.match(mobileCss, /display: flex !important/);
assert.match(mobileCss, /flex-flow: row nowrap !important/);
assert.match(mobileCss, /flex: 1 1 0 !important/);
assert.match(mobileCss, /width: 0 !important/);
assert.match(mobileCss, /width: calc\(100vw - 96px\)/);
assert.doesNotMatch(mobileCss, /width: calc\(100vw - 64px\)/);
assert.doesNotMatch(mobileCss, /grid-template-columns: repeat\(3/);
assert.match(mobileCss, /min-height: 44px/);
assert.match(mobileCss, /touch-action: manipulation/);

assert.match(appSource, /class="fitness-detail-tabs" role="tablist"/);
assert.match(appSource, /data-action="set-fitness-detail-tab"/);
assert.match(appSource, /role="tab" aria-controls="fitnessDetailPanel" aria-selected=/);
assert.match(appSource, /id="fitnessDetailPanel" class="fitness-detail-body" role="tabpanel"/);

console.log('fitness portrait detail-tab checks passed');
