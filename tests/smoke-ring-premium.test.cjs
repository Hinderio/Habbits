const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const ringCss = fs.readFileSync(path.join(root, 'modules/smoke-ring-premium.css'), 'utf8');
const ringModule = fs.readFileSync(path.join(root, 'modules/smoking-top-cards-polish.js'), 'utf8');

assert.match(indexSource, /modules\/smoke-ring-premium\.css\?v=281/);
assert.match(indexSource, /modules\/smoking-top-cards-polish\.js\?v=283/);
assert.match(workerSource, /habitflow-v286-ghost-arena/);
assert.match(workerSource, /\.\/modules\/smoke-ring-premium\.css/);

assert.match(ringCss, /#screen-smoking \.smoke-control-card \.smoke-ring/);
assert.match(ringCss, /aspect-ratio: 1/);
assert.match(ringCss, /font-variant-numeric: tabular-nums/);
assert.match(ringCss, /white-space: nowrap/);
assert.match(ringCss, /> \.hf-smoke-progress-svg/);
assert.match(ringCss, /display: none !important/);
assert.match(ringCss, /visibility: hidden !important/);
assert.match(ringCss, /> \.hf-smoke-sector/);
assert.match(ringCss, /--hf-smoke-sector-color: #f9ad00/);
assert.match(ringCss, /--hf-smoke-sector-color: #60c1c0/);
assert.match(ringCss, /conic-gradient/);
assert.match(ringCss, /font-weight: 650 !important/);
assert.doesNotMatch(ringCss, /(?:linear|radial)-gradient/);
assert.match(ringCss, /\.hf-smoking-actions/);
assert.match(ringCss, /\.hf-pause-start-btn/);
assert.match(ringCss, /#recordSmokeBtn\.smoke-button/);
assert.match(ringCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/);
assert.match(ringCss, /border-radius: 999px !important/);
assert.match(ringCss, /background: #60c1c0 !important/);

assert.match(ringModule, /const current = hasPause \? duration\(data\.pause\) : '–'/);
assert.match(ringModule, /Median übertroffen/);
assert.match(ringModule, /Median erreicht/);
assert.match(ringModule, /Median \$\{duration\(data\.median\)\}/);
assert.match(ringModule, /noch \$\{duration\(remaining\)\} bis zu deinem Median/);
assert.match(ringModule, /\+\$\{duration\(data\.bonusMinutes\)\} über deinem Median/);
assert.match(ringModule, /data\.bonusMinutes \/ data\.median/);
assert.match(ringModule, /--hf-smoke-sector-progress/);
assert.match(ringModule, /is-median-phase/);
assert.match(ringModule, /const RING_REFRESH_MS = 5_000/);
assert.match(ringModule, /window\.setInterval\(refreshRing, RING_REFRESH_MS\)/);
assert.match(ringModule, /if \(!force && lastRingPaintAt && remaining > 0\)/);
assert.doesNotMatch(ringModule, /live\.textContent !== `\+\$\{duration\(data\.bonusMinutes\)\}`/);
assert.match(ringCss, /body\.light #screen-smoking/);
assert.match(ringCss, /@media \(max-width: 760px\)/);
assert.doesNotMatch(ringCss, /^(?:\.smoke-ring|\.smoke-control-card)/m);

console.log('premium smoking pause dial checks passed');
