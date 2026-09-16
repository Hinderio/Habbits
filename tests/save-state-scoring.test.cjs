const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const oracle = fs.readFileSync(path.join(__dirname, 'fixtures/smoke-scoring-before-save-fix.js'), 'utf8');
const block = name => source.match(new RegExp(`  function ${name}\\([^]*?\\n  \\}`))[0];
const plain = value => JSON.parse(JSON.stringify(value));
function setup(initial = {}, legacy = false) {
  let sequence = 0;
  const writes = [], deleted = [], calls = { render: 0, points: 0, coach: 0 };
  const c = {
    state: plain({ cigarettes: [], pointsLedger: [], pausePeriods: [], ...initial }),
    Date, console, STORAGE_KEY: 'state',
    SMOKE_DAILY_TARGET: 10, SMOKE_DAILY_BASE_BONUS: 50, SMOKE_DAILY_BONUS_PER_LESS: 10,
    SMOKE_RECOVERY_REPEAT_MINUTES: 120, SMOKE_RECOVERY_REPEAT_BONUS: 10,
    SMOKE_SLEEP_START_HOUR: 23, SMOKE_SLEEP_END_HOUR: 7,
    SMOKE_SLEEP_BRIDGE_MINUTES: 240, SMOKE_SLEEP_WAKE_MIN_HOUR: 5,
    SMOKE_PAUSE_POINTS_REASON_PREFIX: 'Rauchpause · 25 Pkt. pro Pausentag',
    nowIso: () => '2026-09-16T12:00:00.000Z', uid: () => `generated-${++sequence}`,
    toDateKey: value => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; },
    normalizePauseScope: value => value,
    normalizePausePeriod: value => value,
    appDomainFacade: () => null,
    formatDuration: value => `${value} min`,
    markRemoteDeletedMany: (table, ids) => deleted.push(...ids),
    combineDeletedRemoteIds: a => a, readRemoteDeleteArchive: () => ({}), writeRemoteDeleteArchive() {},
    window: { HabitFlowCoach: { refresh() { calls.coach++; } }, HabitFlowRuntime: { skipNextSmokingDomainPersistenceNormalization() {} } },
    localStorage: { setItem: (key, value) => writes.push(JSON.parse(value)) },
    queueRender() { calls.render++; }, queuePointEvolutionRefresh() { calls.points++; },
  };
  vm.createContext(c);
  const names = ['activePausePeriods','isWithinPauseAt','pausePeriodsOverlappingRange','intervalCrossesPause',
    'sleepWindowForSmokeScoring','sleepMinutesBetweenForSmokeScoring','isPostSleepSmokeWakeTime','smokeIntervalScoring',
    'visibleCigarettes','smokingScoringContext','isDaytimeSmokeInterval','smokeRecoveryRepeatBonus','cigarettePoints',
    'cigarettePointReason','smokeDailyBonusSourceId','isSmokeDailyBonusEntry','smokeDailyBonusDay','smokeBonusDayPaused',
    'smokeDailyBonusPoints','smokeDailyBonusReason','formatSignedPoints','createPointsLedgerWriter','addPoints',
    'recalculateSmokeIntervals','recalculateSmokeDailyBonuses','saveState','importJson'];
  names.forEach(name => vm.runInContext(block(name), c));
  if (legacy) vm.runInContext(oracle, c);
  return { c, writes, deleted, calls };
}
function seed(count = 40) {
  return {
    cigarettes: Array.from({ length: count }, (_, i) => ({ id: `c${i}`, smoked_at: new Date(Date.UTC(2026, 8, 1, 8) + i * 145 * 60000).toISOString(), points: -999, synced: true })),
    pointsLedger: [{ id: 'habit', source_type: 'habit', source_id: 'c0', points: 50, reason: 'Keep habit' }],
  };
}
test('ordinary saves persist and refresh without changing smoke scores or ledger', () => {
  const { c, writes, calls } = setup(seed());
  const before = plain(c.state);
  c.recalculateSmokeIntervals = () => assert.fail('unrelated save recalculated smoking');
  c.state.tasks = [{ id: 'task', status: 'doing' }];
  c.saveState();
  c.state.habitEntries = [{ id: 'entry', value_num: 1 }];
  c.saveState({ skipRender: true });
  assert.deepEqual(plain(c.state.cigarettes), before.cigarettes);
  assert.deepEqual(plain(c.state.pointsLedger), before.pointsLedger);
  assert.equal(writes.length, 2);
  assert.equal(writes[1].habitEntries[0].id, 'entry');
  assert.deepEqual(calls, { render: 1, points: 2, coach: 2 });
});
test('import explicitly recalculates before persistence', () => {
  const { c, writes } = setup();
  const imported = seed(3);
  c.normalizeState = value => value;
  c.toast = () => {};
  c.FileReader = class {
    readAsText() { this.result = JSON.stringify({ state: imported }); this.onload(); }
  };
  const event = { target: { files: [{}], value: 'backup.json' } };
  c.importJson(event);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].cigarettes[0].points, 0);
  assert.equal(writes[0].pointsLedger.filter(p => p.source_type === 'cigarette').length, 3);
  assert.equal(event.target.value, '');
});
test('indexed scoring matches original for time edits, deletion, sleep, pauses and repairs', () => {
  const current = setup(seed()), previous = setup(seed(), true);
  const steps = [
    () => {},
    c => { c.state.cigarettes[2].smoked_at = '2026-09-04T08:30:00.000Z'; },
    c => { const id = c.state.cigarettes.splice(5, 1)[0].id; c.state.pointsLedger = c.state.pointsLedger.filter(p => p.source_id !== id); },
    c => { c.state.pausePeriods.push({ scope: 'smoke', starts_at: '2026-09-02T12:00:00.000Z', ends_at: '2026-09-03T10:00:00.000Z' }); },
    c => { c.state.pausePeriods[0].ends_at = null; },
    c => { c.state.pausePeriods[0].is_archived = true; },
    c => { const p = c.state.pointsLedger.find(p => p.source_type === 'cigarette'); c.state.pointsLedger.push({ ...p, id: 'duplicate-cigarette' }); },
    c => { const p = c.state.pointsLedger.find(p => c.isSmokeDailyBonusEntry(p)); c.state.pointsLedger.push({ ...p, id: 'legacy-bonus', source_id: null }); },
    c => { c.state.cigarettes = []; },
  ];
  steps.forEach((mutate, i) => {
    mutate(current.c); mutate(previous.c);
    assert.equal(current.c.recalculateSmokeIntervals({ markUpdated: true }), previous.c.recalculateSmokeIntervals({ markUpdated: true }), `changed flag ${i}`);
    assert.deepEqual(plain(current.c.state), plain(previous.c.state), `state after step ${i}`);
    assert.deepEqual(current.deleted, previous.deleted, `remote tombstones ${i}`);
    assert.equal(current.c.recalculateSmokeIntervals({ markUpdated: true }), false, `idempotent step ${i}`);
  });
});
test('ledger writer preserves first-row deduplication, source types, new rows and replacement', () => {
  const { c } = setup({ pointsLedger: [
    { id: 'first', source_type: 'cigarette', source_id: 'one', points: 1 },
    { id: 'duplicate', source_type: 'cigarette', source_id: 'one', points: 2 },
    { id: 'habit', source_type: 'habit', source_id: 'one', points: 3 },
  ] });
  const write = c.createPointsLedgerWriter();
  assert.equal(write('cigarette', 'one', 20, 'updated'), true);
  assert.equal(c.state.pointsLedger.length, 2);
  assert.equal(write('cigarette', 'one', 20, 'updated'), false);
  write('bonus', null, 5, 'legacy'); write('bonus', 'null', 6, 'string');
  write('bonus', 1, 7, 'number'); write('bonus', '1', 8, 'string');
  assert.equal(c.state.pointsLedger.length, 6);
  assert.equal(c.state.pointsLedger.find(p => p.id === 'habit').points, 3);
  c.state.pointsLedger = [];
  write('cigarette', 'one', 30, 'after pull');
  assert.equal(c.state.pointsLedger.length, 1);
  assert.equal(c.state.pointsLedger[0].points, 30);
});
test('existing and missing ledger rows require no full-ledger filter per cigarette', () => {
  const { c } = setup(seed(1200));
  let visits = 0;
  const ledger = c.state.pointsLedger;
  ledger.filter = function(predicate) { return Array.prototype.filter.call(this, (p, i) => { visits++; return predicate(p, i); }); };
  c.recalculateSmokeIntervals();
  const first = visits;
  visits = 0;
  c.recalculateSmokeIntervals();
  assert.ok(first < 4000, `first scoring scanned ${first} rows`);
  assert.ok(visits < 4000, `repeat scoring scanned ${visits} rows`);
});
test('smoke actions calculate before saving without a persistence fallback', () => {
  const { c, writes } = setup(seed(4));
  c.recalculateSmokeIntervals();
  const timers = [];
  Object.assign(c, {
    pendingTriggerSmokeId: null, editingSmokeId: null,
    getLastCigarette: () => c.state.cigarettes.at(-1),
    alcoholForDate: () => null, alcoholUnitsOnDate: () => [],
    renderTimers() {}, renderTriggerCapture() {}, renderSmokingQuickCapture() {}, renderHistoryModal() {},
    renderSmokeHistoryItemInPlace() {}, notifyConsumptionLiveUpdate() {}, scheduleConsumptionBackgroundRender() {}, toast() {},
    els: {}, cssEscape: value => value,
    syncWithSupabase() {}, markRemoteDeleted() {}, deleteRemoteById: async () => {}, deleteRemoteByIds: async () => {},
    document: { getElementById: () => null },
  });
  c.window.setTimeout = callback => { timers.push(callback); return timers.length; };
  c.window.clearTimeout = () => {};
  function settle() { for (let i = 0; timers.length && i < 30; i++) timers.shift()(); assert.equal(timers.length, 0); }
  for (const name of ['recordCigarette', 'saveSmokeTime', 'deleteSmoke']) vm.runInContext(block(name), c);
  c.recordCigarette(); settle();
  const added = c.state.cigarettes.at(-1);
  assert.ok(writes.at(-1).pointsLedger.some(p => p.source_id === added.id));
  c.$ = selector => selector.startsWith('#smoke-input-') ? { value: '2026-09-01T10:00:00' } : null;
  c.saveSmokeTime(added.id); settle();
  assert.equal(writes.at(-1).pointsLedger.find(p => p.source_id === added.id).earned_at, added.smoked_at);
  const expected = setup(plain(c.state), true);
  expected.c.recalculateSmokeIntervals({ markUpdated: true });
  assert.deepEqual(plain(c.state), plain(expected.c.state));
  c.deleteSmoke(added.id); settle();
  assert.ok(!writes.at(-1).pointsLedger.some(p => p.source_id === added.id));
  const afterDelete = setup(plain(c.state), true);
  afterDelete.c.recalculateSmokeIntervals({ markUpdated: true });
  assert.deepEqual(plain(c.state), plain(afterDelete.c.state));
});
test('large-history ledger lookup work is linear for the normal repair path', t => {
  const initial = seed(1200);
  initial.pointsLedger.push(...Array.from({ length: 10000 }, (_, i) => ({ id: `h${i}`, source_type: 'habit', source_id: `h${i}`, points: 10 })));
  const count = legacy => {
    const { c } = setup(initial, legacy);
    let visits = 0;
    const ledger = c.state.pointsLedger;
    ledger.filter = function(predicate) { return Array.prototype.filter.call(this, (p, i) => { visits++; return predicate(p, i); }); };
    c.recalculateSmokeIntervals();
    return visits;
  };
  const before = count(true), after = count(false);
  assert.ok(after < 15000);
  assert.ok(before > after * 100);
  t.diagnostic(`1200 cigarettes + 10001 existing ledger rows: filter visits ${before} -> ${after} (index construction excluded)`);
});
