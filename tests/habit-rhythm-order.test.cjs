const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
test('habit rhythm and its controls are the final content in the Habits tab', () => {
  const habits = html.slice(html.indexOf('id="screen-habits"'), html.lastIndexOf('<section', html.indexOf('id="screen-fitness"')));
  const story = habits.indexOf('id="habitPlayfulStats"');
  const controls = habits.indexOf('id="habitChartPrevWindowBtn"');
  const heatmap = habits.indexOf('id="habitHeatmap"');
  assert.ok(story >= 0 && controls > story && heatmap > controls);
  assert.ok(!habits.slice(heatmap).includes('<section'));
  for (const id of ['habitHeatmap', 'habitChartPrevWindowBtn', 'habitChartRangeLabel', 'habitChartTodayWindowBtn', 'habitChartNextWindowBtn']) {
    assert.equal(html.split('id="' + id + '"').length - 1, 1, id + ' remains unique');
  }
});
