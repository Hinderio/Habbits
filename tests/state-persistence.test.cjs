const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { harness, seed, KEY, clone } = require('./helpers/storage-harness.cjs');

test('canonical ledger rows are unchanged and do not trigger repair writes', () => {
  const h = harness({ initial: seed() });
  const input = seed();
  const result = h.window.HabitFlowRuntime.normalizePointsLedgerState(input);
  assert.equal(result.changed, false);
  assert.equal(result.state, input);
  assert.equal(result.stats.changedSourceIds, 0);
  h.read(); h.read();
  assert.equal(h.counts.writes, 0);
  assert.equal(h.counts.serializes, 0);
});
test('real legacy bonus IDs and duplicate rows still repair without mutating input', () => {
  const h = harness();
  const input = seed();
  input.pointsLedger.push(
    { id: 'a', source_type: 'bonus', source_id: 'smoke-daily-bonus-2026-09-01', points: 50, earned_at: '2026-09-01T23:59:00Z' },
    { id: 'b', source_type: 'bonus', source_id: '00000000-0000-4000-8001-000020260901', points: 60, earned_at: '2026-09-01T23:59:00Z' },
    { id: 'routine', source_type: 'bonus', source_id: 'old', reason: 'Morgenroutine', earned_at: '2026-09-01T12:00:00Z' });
  const before = clone(input);
  const result = h.window.HabitFlowRuntime.normalizePointsLedgerState(input);
  assert.equal(result.changed, true);
  assert.equal(result.stats.changedSourceIds, 2);
  assert.equal(result.state.pointsLedger.length, 3);
  assert.equal(result.state.pointsLedger.find(row => row.id === 'b').points, 60);
  assert.equal(result.state.pointsLedger.find(row => row.id === 'b').synced, false);
  assert.deepEqual(input, before);
  assert.equal(h.window.HabitFlowRuntime.normalizePointsLedgerState(result.state).changed, false);
});
test('app writes serialize once, preserve project data and keep pending offline changes', () => {
  const h = harness({ initial: seed() });
  const incoming = seed();
  delete incoming.projects; delete incoming.projectPhases;
  incoming.tasks[0].project_id = null;
  incoming.habitEntries.push({ id: 'offline', synced: false, value_num: 2 });
  const before = clone(incoming);
  h.write(incoming);
  assert.deepEqual(incoming, before);
  const saved = h.saved();
  assert.equal(saved.projects[0].id, 'p1');
  assert.equal(saved.projectPhases[0].id, 'phase');
  assert.equal(saved.tasks[0].project_id, 'p1');
  assert.equal(saved.habitEntries[0].synced, false);
  assert.deepEqual(saved.deletedRemoteIds, incoming.deletedRemoteIds);
  assert.equal(h.counts.serializes, 1);
  assert.equal(h.counts.writes, 1);
  assert.ok(h.counts.parses <= 1);
});
test('explicit unlink, project tombstones and re-link survive repeated writes', () => {
  const h = harness({ initial: seed() });
  h.window.localStorage.setItem('habitflow-project-deleted-records-v1', JSON.stringify({ project_phases: ['phase'] }));
  const incoming = seed();
  incoming.tasks[0].project_id = null;
  incoming.tasks[0].project_link_cleared_at = '2026-09-16T10:00:00Z';
  h.write(incoming);
  assert.equal(h.saved().tasks[0].project_id, null);
  assert.equal(h.saved().projectPhases[0].is_archived, true);
  assert.equal(h.counts.writes, 1, 'unlink requires no intermediate native write');
  h.write(incoming);
  assert.equal(h.saved().tasks[0].project_id, null);
  incoming.tasks[0].project_id = 'p2'; delete incoming.tasks[0].project_link_cleared_at;
  h.write(incoming);
  assert.equal(h.saved().tasks[0].project_id, 'p2');
});
test('native external writes, removal, clearing and in-memory edits cannot reuse stale state', () => {
  const h = harness({ initial: seed() });
  h.read();
  const external = seed(); external.projects[0].title = 'Other tab'; external.projects[0].updated_at = '2026-09-16T11:00:00Z';
  h.data.set(KEY, JSON.stringify(external));
  const incoming = seed(); incoming.projects = [];
  h.write(incoming);
  assert.equal(h.saved().projects[0].title, 'Other tab');
  incoming.habitEntries.push({ id: 'later-edit' });
  assert.equal(h.read().habitEntries.length, 0, 'cache does not own the mutable caller object');
  h.window.localStorage.removeItem(KEY);
  assert.equal(h.window.localStorage.getItem(KEY), null);
  h.write({ pointsLedger: [], tasks: [] });
  assert.equal(h.saved().projects.length, 0);
  h.window.localStorage.clear();
  assert.equal(h.window.localStorage.getItem(KEY), null);
});
test('quota errors propagate and failed saves do not corrupt persisted data or cache', () => {
  const h = harness({ initial: seed() });
  h.read();
  const before = h.data.get(KEY), incoming = seed(); incoming.habitEntries.push({ id: 'pending', synced: false });
  h.failWrites(true);
  assert.throws(() => h.write(incoming), /QuotaExceeded/);
  assert.equal(h.data.get(KEY), before);
  assert.equal(h.read().habitEntries.length, 0);
  h.failWrites(false);
  h.write(incoming);
  assert.equal(h.saved().habitEntries[0].id, 'pending');
});
test('legacy string callers, non-state keys and malformed JSON retain storage behavior', () => {
  const h = harness({ initial: seed() });
  h.window.localStorage.setItem(KEY, JSON.stringify(seed()));
  assert.equal(h.saved().projects[0].id, 'p1');
  h.window.localStorage.setItem('other', 'not JSON');
  assert.equal(h.window.localStorage.getItem('other'), 'not JSON');
  h.window.localStorage.setItem(KEY, '{broken');
  assert.equal(h.window.localStorage.getItem(KEY), '{broken');
  h.write(seed());
  assert.equal(h.saved().pointsLedger.length, 1);
});
test('alcohol aggregates update across midnight without mutating nested input', () => {
  const h = harness();
  const input = seed();
  input.alcoholUnits = [{ id: 'drink', occurred_at: '2026-09-16T12:00:00Z', units: 1 }];
  input.todayAlcoholUnits = 0; input.consumption = { todayAlcoholUnits: 0, other: 'keep' };
  const before = clone(input);
  h.write(input);
  assert.deepEqual(input, before);
  assert.equal(h.saved().todayAlcoholUnits, 1);
  assert.equal(h.saved().consumption.todayAlcoholUnits, 1);
  h.setClock('2026-09-18T12:00:00Z');
  assert.equal(h.read().todayAlcoholUnits, 0);
  assert.equal(h.read().consumption.other, 'keep');
});
test('verified smoking scores survive save/read and legacy writers still normalize', () => {
  const h = harness();
  const input = seed();
  input.cigarettes = [{ id: 'c', smoked_at: '2026-09-01T12:00:00Z', points: 77 }];
  input.pointsLedger.push({ id: 'c-point', source_type: 'cigarette', source_id: 'c', points: 77, reason: 'Verified by app' });
  h.write(input);
  assert.equal(h.read().cigarettes[0].points, 77);
  assert.equal(h.read().pointsLedger.find(p => p.id === 'c-point').reason, 'Verified by app');
  h.window.localStorage.setItem(KEY, JSON.stringify(input));
  assert.equal(h.read().cigarettes[0].points, 100);
  assert.equal(input.cigarettes[0].points, 77);
});
test('cached storage still re-evaluates time-sensitive daily bonus closure', () => {
  const h = harness();
  const input = seed();
  input.pointsLedger.push({ id: 'day', source_type: 'bonus', source_id: 'smoke-daily-bonus-2026-09-16', points: 50 });
  h.data.set(KEY, JSON.stringify(input));
  assert.equal(h.read().pointsLedger.some(p => p.id === 'day'), false);
  h.setClock('2026-09-18T12:00:00Z');
  h.data.set(KEY, JSON.stringify(input));
  assert.equal(h.read().pointsLedger.find(p => p.id === 'day').source_id, '00000000-0000-4000-8001-000020260916');
});
test('app saveState uses object persistence and still propagates failures', () => {
  const h = harness({ initial: seed() });
  Object.assign(h.context, { state: seed(), STORAGE_KEY: KEY, localStorage: h.window.localStorage,
    combineDeletedRemoteIds: a => a, readRemoteDeleteArchive: () => ({}), writeRemoteDeleteArchive() {},
    queueRender() {}, queuePointEvolutionRefresh() {} });
  const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  vm.runInContext(app.match(/  function saveState\([^]*?\n  \}/)[0], h.context);
  h.resetCounts();
  h.context.saveState();
  assert.equal(h.counts.serializes, 1);
  h.failWrites(true);
  assert.throws(() => h.context.saveState(), /QuotaExceeded/);
});
test('offline snapshot can be reopened and normalizers retain their disabled switches', () => {
  const h = harness({ initial: seed() });
  const input = seed(); input.habitEntries = [{ id: 'pending', synced: false }];
  input.cigarettes = [{ id: 'c', smoked_at: '2026-09-01T12:00:00Z', points: 77 }];
  h.window.HabitFlowRuntime.setSmokingDomainPersistenceEnabled(false);
  h.write(input, false);
  assert.equal(h.saved().cigarettes[0].points, 77);
  const reopened = harness({ initial: h.saved() });
  assert.equal(reopened.read().habitEntries[0].synced, false);
  assert.equal(reopened.read().tasks[0].project_id, 'p1');
  assert.deepEqual(reopened.read().deletedRemoteIds, input.deletedRemoteIds);
  h.window.HabitFlowRuntime.setSmokingDomainPersistenceEnabled(true);
  h.write(input, false);
  assert.equal(h.saved().cigarettes[0].points, 100);
});
test('nested smoking and ledger aliases are normalized without modifying caller branches', () => {
  const h = harness();
  const input = { smoking: { cigarettes: [{ id: 'c', smoked_at: '2026-09-01T12:00:00Z', points: 77 }] },
    gamification: { pointsLedger: [{ id: 'p', source_type: 'cigarette', source_id: 'c', points: 77, reason: 'old' }] },
    unrelated: { nested: [1, 2] } };
  const before = clone(input);
  const result = h.window.HabitFlowRuntime.normalizeSmokingStateWithDomain(input);
  assert.equal(result.smoking.cigarettes[0].points, 100);
  assert.equal(result.gamification.pointsLedger[0].points, 100);
  assert.deepEqual(input, before);
});
test('optional remote authority retains offline and recent rows after snapshot changes', async () => {
  const h = harness();
  let remoteRows = [{ id: 'server', source_type: 'habit', source_id: 'remote-entry' }];
  h.window.supabase = { createClient: () => ({ from: () => ({ select: () => ({ then: callback => Promise.resolve({ data: remoteRows }).then(callback) }) }) }) };
  h.load('modules/points-ledger-remote-authority.js');
  const client = h.window.supabase.createClient();
  await client.from('points_ledger').select('*');
  const input = seed();
  input.pointsLedger.push(
    { id: 'stale', source_type: 'habit', source_id: 'missing', synced: true, updated_at: '2026-09-01T12:00:00Z' },
    { ...remoteRows[0], synced: true },
    { id: 'recent', synced: true, updated_at: '2026-09-16T11:59:00Z' });
  h.write(input);
  assert.deepEqual(h.saved().pointsLedger.map(p => p.id), ['point', 'server', 'recent']);
  remoteRows = [];
  await client.from('points_ledger').select('*');
  assert.deepEqual(h.read().pointsLedger.map(p => p.id), ['point', 'recent']);
});
test('legacy fallback still persists project fields and offline rows without new module', () => {
  const h = harness({ initial: seed(), legacy: true });
  const input = seed(); delete input.projects;
  input.tasks[0].project_id = null;
  input.habitEntries = [{ id: 'offline', synced: false }];
  h.write(input);
  assert.equal(h.saved().projects[0].id, 'p1');
  assert.equal(h.saved().tasks[0].project_id, 'p1');
  assert.equal(h.saved().habitEntries[0].synced, false);
});
test('new persistence script loads before normalizers and is cached for offline startup', () => {
  const config = fs.readFileSync(path.join(__dirname, '../supabase-config.js'), 'utf8');
  const worker = fs.readFileSync(path.join(__dirname, '../service-worker.js'), 'utf8');
  assert.ok(config.indexOf("'modules/state-persistence.js'") < config.indexOf("'modules/smoking-domain-persistence.js'"));
  assert.match(worker, /'\.\/modules\/state-persistence\.js'/);
});
test('object API does not bypass a later legacy wrapper during partial asset updates', () => {
  const h = harness({ initial: seed() });
  const original = h.window.localStorage.setItem.bind(h.window.localStorage);
  let calls = 0;
  h.window.localStorage.setItem = (key, value) => { calls++; return original(key, value); };
  assert.equal(h.window.HabitFlowPersistence.isReady(), false);
  h.write(seed());
  assert.equal(calls, 1);
  assert.equal(h.saved().tasks[0].project_id, 'p1');
});
test('large unrelated history is encoded once per app save', () => {
  const input = seed();
  input.habitEntries = Array.from({ length: 5000 }, (_, i) => ({ id: `entry-${i}`, value_num: i, synced: false }));
  input.pointsLedger = Array.from({ length: 5000 }, (_, i) => ({ id: `point-${i}`, source_type: 'habit', source_id: `entry-${i}`, points: 30, synced: false }));
  const h = harness({ initial: input });
  h.write(input);
  input.tasks[0].status = 'done';
  h.write(input);
  assert.equal(h.counts.serializes, 2);
  assert.ok(h.counts.parses <= 2);
  assert.equal(h.counts.writes, 2);
  assert.equal(h.saved().habitEntries.length, 5000);
  assert.equal(h.saved().pointsLedger.length, 5000);
});
test('repeated reads of an external snapshot reuse smoking normalization', () => {
  const h = harness();
  const domain = h.window.HabitFlowDomains.smoking;
  let recalculations = 0;
  h.window.HabitFlowDomains.smoking = { ...domain, recalculateEvents(rows) { recalculations++; return domain.recalculateEvents(rows); } };
  const external = seed();
  external.cigarettes = [{ id: 'c', smoked_at: '2026-09-01T12:00:00Z', points: 77 }];
  h.data.set(KEY, JSON.stringify(external));
  h.read(); h.read(); h.read();
  assert.equal(recalculations, 1);
  external.cigarettes[0].smoked_at = '2026-09-02T12:00:00Z';
  h.data.set(KEY, JSON.stringify(external));
  h.read();
  assert.equal(recalculations, 2);
});

test('read-only collection projections reuse persisted data without running domain repairs',()=>{
  const h=harness({initial:seed()});let repairReads=0;
  h.window.HabitFlowPersistence.register('projection-probe',{read(state){repairReads++;return {state,changed:false};}});
  const read=()=>h.window.HabitFlowPersistence.readCollections(['projects']);
  const first=read();h.resetCounts();
  for(let i=0;i<25;i++)assert.equal(read().projects,first.projects);
  assert.equal(repairReads,0);assert.equal(h.counts.parses,0);assert.equal(h.counts.writes,0);assert.equal(h.counts.serializes,0);
  const changed=seed();changed.projects[0].title='Other tab';h.data.set(KEY,JSON.stringify(changed));
  assert.equal(read().projects[0].title,'Other tab');h.data.delete(KEY);assert.equal(read().projects,undefined);
  h.write(seed());assert.equal(read().projects[0].title,'Project');h.read();assert.ok(repairReads>0,'regular reads retain their normalizers');
});
