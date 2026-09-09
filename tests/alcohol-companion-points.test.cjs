const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

new vm.Script(appSource);
assert.match(indexSource, /app\.js\?v=290/);
assert.match(workerSource, /alcohol-points-290/);

const totalBlock = appSource.match(/  function getTotalPoints\(\) \{[\s\S]*?\n  \}/)?.[0];
assert.ok(totalBlock, 'getTotalPoints must exist');
assert.match(totalBlock, /sum\(visibleLedgerPoints\(\)\.map\(p => Number\(p\.points \|\| 0\)\)\)/);
assert.doesNotMatch(totalBlock, /Math\.max\(0/);

const summaryBlock = appSource.match(/  function renderPointEvolutionSummary\(\) \{[\s\S]*?(?=\n  function renderDashboard)/)?.[0];
assert.ok(summaryBlock, 'point evolution summary renderer must exist');
assert.match(summaryBlock, /getTotalPoints\(\)/);
assert.match(summaryBlock, /followActualStage[\s\S]*?selectedCompanionStage = null/);
assert.match(summaryBlock, /renderGamification\(\)/);
assert.match(summaryBlock, /renderPointsRulesPopover\(\)/);

const recordBlock = appSource.match(/  function recordAlcoholDay\(levelKey\) \{[\s\S]*?(?=\n  function editableAlcoholDayLog)/)?.[0];
assert.ok(recordBlock, 'recordAlcoholDay must exist');
assert.match(recordBlock, /recalculateAlcoholScores\(\);[\s\S]*?saveState\(\{ skipRender: true \}\);[\s\S]*?renderPointEvolutionSummary\(\{ followActualStage: true \}\);/);

const editBlock = appSource.match(/  function saveAlcoholDay\(id\) \{[\s\S]*?(?=\n  function deleteAlcoholDay)/)?.[0];
assert.ok(editBlock, 'saveAlcoholDay must exist');
assert.match(editBlock, /renderPointEvolutionSummary\(\)/);

const deleteBlock = appSource.match(/  function deleteAlcoholDay\(id\) \{[\s\S]*?(?=\n  async function deleteAlcoholLog)/)?.[0];
assert.ok(deleteBlock, 'deleteAlcoholDay must exist');
assert.ok((deleteBlock.match(/renderPointEvolutionSummary\(\)/g) || []).length >= 2);

console.log('alcohol companion point representation checks passed');
