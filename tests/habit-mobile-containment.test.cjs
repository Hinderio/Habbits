const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../modules/habit-card-typography.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const worker = fs.readFileSync(path.join(__dirname, '../service-worker.js'), 'utf8');
const fix = css.slice(css.indexOf('/* Keep the wide rhythm table'));
test('the Habits grid can shrink independently of the wide heatmap', () => {
  assert.ok(fix.includes('#screen-habits .habits-pane > *'));
  assert.ok(fix.includes('min-width: 0;'));
  assert.ok(fix.includes('max-width: 100%;'));
  assert.match(fix, /#screen-habits \.habits-pane \{[^}]*width: 100%;[^}]*grid-template-columns: minmax\(0, 1fr\);/);
});
test('heatmap keeps local horizontal scrolling rather than hiding page overflow', () => {
  assert.match(fix, /#screen-habits \.heatmap-scroll \{[^}]*width: 100%;[^}]*overflow-x: auto;/);
  assert.ok(!fix.includes('overflow: hidden'));
  assert.ok(!fix.includes('overflow-x: hidden'));
  assert.ok(!fix.includes('.heatmap-grid {'));
});
test('phone tiles retain two shrinkable columns and correctly placed date controls', () => {
  const mobile = fix.slice(fix.indexOf('@media (max-width: 760px)'));
  assert.match(mobile, /\.habit-card-grid \{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(mobile, /#habitChartPrevWindowBtn \{ grid-column: 1; grid-row: 2;/);
  assert.match(mobile, /#habitChartNextWindowBtn \{ grid-column: 2; grid-row: 2;/);
  assert.match(mobile, /#habitChartTodayWindowBtn \{ grid-column: 1 \/ -1; grid-row: 3;/);
  assert.ok(!fix.slice(0, fix.indexOf('@media')).includes('.habit-card-grid'));
});
test('updated styles are linked after the base stylesheet and available offline', () => {
  assert.ok(html.indexOf('style.css?v=') < html.indexOf('habit-card-typography.css?v=346'));
  assert.ok(worker.includes("'./modules/habit-card-typography.css'"));
  assert.ok(worker.includes('habit-mobile-width-346'));
});
