const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const ringCss = fs.readFileSync(path.join(root, 'modules/smoke-ring-premium.css'), 'utf8');

assert.match(indexSource, /modules\/smoke-ring-premium\.css\?v=277/);
assert.match(workerSource, /habitflow-v277-smoke-ring-cleanup/);
assert.match(workerSource, /\.\/modules\/smoke-ring-premium\.css/);

assert.match(ringCss, /#screen-smoking \.smoke-control-card \.smoke-ring/);
assert.match(ringCss, /aspect-ratio: 1/);
assert.match(ringCss, /conic-gradient/);
assert.match(ringCss, /font-variant-numeric: tabular-nums/);
assert.match(ringCss, /white-space: nowrap/);
assert.match(ringCss, /> \.hf-smoke-progress-svg/);
assert.match(ringCss, /display: none !important/);
assert.match(ringCss, /visibility: hidden !important/);
assert.match(ringCss, /body\.light #screen-smoking/);
assert.match(ringCss, /@media \(max-width: 760px\)/);
assert.doesNotMatch(ringCss, /^(?:\.smoke-ring|\.smoke-control-card)/m);

console.log('premium smoking pause dial checks passed');
