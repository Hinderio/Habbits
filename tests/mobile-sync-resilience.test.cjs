const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

assert.match(workerSource, /habitflow-v284-habit-story-full-history/);
assert.doesNotMatch(appSource, /controllerchange[\s\S]{0,300}location\.reload/);

const pullBlock = appSource.match(/  async function pullSupabaseData\(\) \{[\s\S]*?(?=\n  async function fetchRemoteTableSnapshots)/)?.[0];
assert.ok(pullBlock, 'pullSupabaseData must be present');
assert.match(pullBlock, /if \(remoteHabitRows\) state\.habits/);
assert.match(pullBlock, /if \(remoteTaskRows\) state\.tasks/);
assert.match(pullBlock, /if \(failedTables\.length\) \{[\s\S]*saveState\(\{ skipRender: true \}\);[\s\S]*safeRender\(\);[\s\S]*throw new Error/);
assert.match(appSource, /catch \(error\) \{[\s\S]*renderSyncStatus\('error'\);\s*scheduleRemoteSyncRetry\(\);/);
assert.match(appSource, /REMOTE_SYNC_RETRY_DELAYS_MS = Object\.freeze\(\[3_000, 10_000, 30_000, 60_000\]\)/);

const helperBlock = appSource.match(/  async function fetchRemoteTableSnapshots\(tableNames\) \{[\s\S]*?(?=\n  async function fetchRemoteTable\(table\))/)?.[0];
assert.ok(helperBlock, 'remote snapshot retry helpers must be present');

const attempts = new Map();
let active = 0;
let maxActive = 0;
async function fakeFetchRemoteTable(table) {
  attempts.set(table, (attempts.get(table) || 0) + 1);
  active += 1;
  maxActive = Math.max(maxActive, active);
  await new Promise(resolve => setTimeout(resolve, 2));
  active -= 1;
  if (table === 'tasks' && attempts.get(table) < 3) throw new Error('temporary tasks failure');
  if (table === 'appointments') throw new Error('persistent appointments failure');
  return { data: [{ id: `${table}-1` }], error: null };
}

const context = {
  Map,
  Promise,
  Error,
  setTimeout,
  REMOTE_PULL_BATCH_SIZE: 4,
  REMOTE_PULL_RETRY_DELAYS_MS: [0, 1, 1],
  fetchRemoteTable: fakeFetchRemoteTable
};
vm.createContext(context);
vm.runInContext(`${helperBlock}\nthis.helpers = { fetchRemoteTableSnapshots, fetchRemoteTableWithRetry };`, context);

(async () => {
  const tables = ['habit_definitions', 'habit_entries', 'tasks', 'cigarette_events', 'alcohol_logs', 'appointments', 'points_ledger'];
  const snapshots = await context.helpers.fetchRemoteTableSnapshots(tables);

  assert.equal(snapshots.get('tasks').result.data.length, 1);
  assert.equal(snapshots.get('tasks').error, null);
  assert.equal(attempts.get('tasks'), 3);
  assert.equal(snapshots.get('appointments').result, null);
  assert.match(snapshots.get('appointments').error.message, /persistent/);
  assert.equal(attempts.get('appointments'), 3);
  assert.ok(maxActive <= 4, `expected at most 4 parallel reads, got ${maxActive}`);

  console.log('mobile sync resilience checks passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
