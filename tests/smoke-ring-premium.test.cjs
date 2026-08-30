const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const ringCss = fs.readFileSync(path.join(root, 'modules/smoke-ring-premium.css'), 'utf8');

assert.match(indexSource, /modules\/smoke-ring-premium\.css\?v=278/);
assert.match(workerSource, /habitflow-v278-smoke-ring-progress/);
assert.match(workerSource, /\.\/modules\/smoke-ring-premium\.css/);

assert.match(ringCss, /#screen-smoking \.smoke-control-card \.smoke-ring/);
assert.match(ringCss, /aspect-ratio: 1/);
assert.match(ringCss, /font-variant-numeric: tabular-nums/);
assert.match(ringCss, /white-space: nowrap/);
assert.match(ringCss, /> \.hf-smoke-progress-svg/);
assert.match(ringCss, /display: block !important/);
assert.match(ringCss, /visibility: visible !important/);
assert.match(ringCss, /\.hf-smoke-progress-value/);
assert.match(ringCss, /\.hf-smoke-progress-bonus/);
assert.match(ringCss, /stroke: #31c7c4 !important/);
assert.match(ringCss, /stroke: #ff9d58 !important/);
assert.match(ringCss, /stroke-dasharray: none !important/);
assert.doesNotMatch(ringCss, /conic-gradient/);
assert.match(ringCss, /body\.light #screen-smoking/);
assert.match(ringCss, /@media \(max-width: 760px\)/);
assert.doesNotMatch(ringCss, /^(?:\.smoke-ring|\.smoke-control-card)/m);

console.log('premium smoking pause dial checks passed');
