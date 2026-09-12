const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

new vm.Script(appSource);
assert.match(indexSource, /app\.js\?v=292/);
assert.match(workerSource, /monthly-sync-289/);
assert.match(appSource, /habitflow_monthly_missions_v1/);
assert.match(appSource, /async function syncMonthlyMissionBackup\(\)/);
assert.match(appSource, /supabaseClient\.auth\.getUser\(\)/);
assert.match(appSource, /supabaseClient\.auth\.updateUser\(\{/);
assert.match(appSource, /syncMonthlyMissionBackup\(\)[\s\S]*?syncMonthlyMissionsDirect\(\)/);
assert.match(appSource, /toast\('Monats-Mission gelöscht\.'\);\s*queueMonthlyMissionSync\(\);/);
assert.match(appSource, /remoteMonthlyMissionsSupported = false;\s*throw new Error\(\`Monats-Missionen-Sync unvollständig/);

console.log('monthly mission cross-device fallback checks passed');
