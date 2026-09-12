const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const moduleSource = fs.readFileSync(path.join(root, 'modules', 'sync-integrity.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const configSource = fs.readFileSync(path.join(root, 'supabase-config.js'), 'utf8');
const window = {};
vm.runInNewContext(moduleSource, { window, Map, TypeError, Error });

const {
  fetchAllRows,
  compactActivityIdeasForStorage,
  mergeRemoteAuthoritative,
  mergeRemoteNewest
} = window.HabitFlowSyncIntegrity;

test('loads every remote page even when the server caps each response', async () => {
  const remoteRows = Array.from({ length: 2350 }, (_, index) => ({ id: `row-${index}` }));
  const calls = [];
  const result = await fetchAllRows({
    pageSize: 1000,
    fetchPage: async ({ from, to, page }) => {
      calls.push({ from, to, page });
      return {
        data: remoteRows.slice(from, Math.min(to + 1, from + 400)),
        count: page === 0 ? remoteRows.length : null,
        error: null
      };
    }
  });

  assert.equal(result.complete, true);
  assert.equal(result.data.length, remoteRows.length);
  assert.ok(calls.length > 1);
});

test('never exposes a partial snapshot as a successful pull', async () => {
  const result = await fetchAllRows({
    pageSize: 2,
    fetchPage: async ({ page }) => page === 0
      ? { data: [{ id: 'a' }, { id: 'b' }], count: 3, error: null }
      : { data: [], count: null, error: null }
  });

  assert.equal(result.complete, false);
  assert.deepEqual(Array.from(result.data), []);
  assert.match(result.error.message, /2 von 3/);
});

test('keeps local pending points but removes stale synced device-only rows', () => {
  const local = [
    { id: 'remote', points: 10, synced: true },
    { id: 'stale', points: 65, synced: true },
    { id: 'pending', points: 20, synced: false },
    { id: 'edited', points: 30, synced: false }
  ];
  const remote = [
    { id: 'remote', points: 10 },
    { id: 'edited', points: 25 }
  ];
  const merged = mergeRemoteAuthoritative(local, remote, row => ({ ...row, synced: true }));

  assert.deepEqual(Array.from(merged, row => row.id).sort(), ['edited', 'pending', 'remote']);
  assert.equal(merged.find(row => row.id === 'edited').points, 30);
});

test('keeps the newest monthly mission across auth fallback and delayed table rows', () => {
  const fallback = [
    { id: 'desktop-new', title: 'Neue Mission', updated_at: '2026-09-12T08:00:00Z', synced: false },
    { id: 'edited', title: 'Neuer Titel', updated_at: '2026-09-12T08:05:00Z', synced: false }
  ];
  const delayedTable = [
    { id: 'edited', title: 'Alter Titel', updated_at: '2026-09-12T07:55:00Z' }
  ];
  const merged = mergeRemoteNewest(fallback, delayedTable, row => ({ ...row, synced: true }));

  assert.deepEqual(Array.from(merged, row => row.id).sort(), ['desktop-new', 'edited']);
  assert.equal(merged.find(row => row.id === 'edited').title, 'Neuer Titel');
  assert.equal(merged.find(row => row.id === 'edited').synced, false);
});

test('accepts an equally new confirmed table row and marks it synced', () => {
  const fallback = [
    { id: 'confirmed', title: 'Mission', updated_at: '2026-09-12T08:00:00Z', synced: false }
  ];
  const remote = [
    { id: 'confirmed', title: 'Mission', updated_at: '2026-09-12T08:00:00Z' }
  ];
  const merged = mergeRemoteNewest(fallback, remote, row => ({ ...row, synced: true }));

  assert.equal(merged.length, 1);
  assert.equal(merged[0].synced, true);
});

test('does not persist the reproducible seed catalogue in the main state blob', () => {
  const compact = compactActivityIdeasForStorage([
    { id: 'seed-synced', source: 'seed', synced: true },
    { id: 'generated-synced', source: 'generated', synced: true },
    { id: 'seed-pending', source: 'seed', synced: false },
    { id: 'custom-synced', source: 'custom', synced: true }
  ]);

  assert.deepEqual(Array.from(compact, row => row.id), ['seed-pending', 'custom-synced']);
});

test('compacts the complete shipped catalogue while keeping it available as a static asset', () => {
  const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'data', 'activity-ideas.json'), 'utf8'));
  const rows = (catalogue.items || []).map(row => ({ ...row, synced: true }));
  assert.equal(rows.length, 1000);
  assert.equal(compactActivityIdeasForStorage(rows).length, 0);
});

test('wires pagination, authoritative ledger merge and compact persistence into the app', () => {
  assert.match(appSource, /HabitFlowSyncIntegrity\?\.compactActivityIdeasForStorage/);
  assert.match(appSource, /HabitFlowSyncIntegrity\?\.mergeRemoteAuthoritative/);
  assert.match(appSource, /HabitFlowSyncIntegrity\.mergeRemoteNewest/);
  assert.doesNotMatch(appSource, /applyRemoteCollectionAuthority\('monthly_missions'/);
  assert.match(appSource, /syncMonthlyMissionBackup\(\);\s*await syncMonthlyMissionsDirect\(\);\s*await syncWithSupabase\(\{ silent: false/);
  assert.match(appSource, /pagination\?\.fetchAllRows/);
  assert.match(appSource, /select\('\*', page === 0 \? \{ count: 'exact' \} : undefined\)/);
  assert.match(appSource, /leisureCatalog = mergeActivityIdeas\(leisureSeedCatalog, state\.activityIdeas \|\| \[\]\)/);
  assert.doesNotMatch(appSource, /state\.activityIdeas = seedRows\.map/);
  assert.match(configSource, /modules\/sync-integrity\.js/);
  assert.match(configSource, /manualSyncButton\.click\(\)/);
  assert.match(workerSource, /modules\/sync-integrity\.js/);
  assert.match(appSource, /button\.textContent = 'Synchronisiert …'/);
});
