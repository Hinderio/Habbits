const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const block = name => source.match(new RegExp(`  function ${name}\\([^]*?\\n  \\}`))[0];
function setup() {
  let sequence = 0;
  const c = {
    state: { habits: [], habitEntries: [], pointsLedger: [], deletedRemoteIds: {} },
    nowIso: () => '2026-09-25T10:00:00Z',
    uid: () => `new-${++sequence}`,
    markRemoteDeletedMany() {},
    isFitnessDistanceHabit: () => false
  };
  vm.createContext(c);
  for (const name of ['migrateRoutineHabits', 'isSwimmingHabit', 'swimmingPoints', 'habitPointReason', 'habitPoints', 'addPoints', 'migrateHabitScoring']) vm.runInContext(block(name), c);
  return c;
}
test('replacement archives old definitions without rewriting historical logs or points', () => {
  const c = setup();
  c.state.habits = [{ id: 'bread', name: 'Brotfreier Tag', type: 'boolean' }, { id: 'desk', name: 'Stehpult', type: 'boolean' }];
  c.state.habitEntries = [{ id: 'old', habit_id: 'bread', value_bool: true }];
  c.state.pointsLedger = [{ id: 'ledger', source_type: 'habit', source_id: 'old', points: 12 }];
  const history = JSON.stringify([c.state.habitEntries, c.state.pointsLedger]);
  assert.equal(c.migrateRoutineHabits(), true);
  assert.equal(c.state.habits.length, 4);
  assert.ok(c.state.habits.slice(0, 2).every(h => h.is_archived && h.synced === false));
  assert.equal(JSON.stringify([c.state.habitEntries, c.state.pointsLedger]), history);
  const morning = c.state.habits.find(h => h.name === 'Morgenroutine');
  const engagement = c.state.habits.find(h => h.name === 'Engagement');
  assert.equal(morning.type, 'boolean');
  assert.equal(morning.target, 1);
  assert.equal(morning.icon, 'sunrise');
  assert.equal(engagement.type, 'duration');
  assert.equal(engagement.target, 15);
  assert.equal(engagement.target_period, 'day');
  assert.equal(engagement.icon, 'engagement');
  assert.equal(c.migrateRoutineHabits(), false);
  morning.is_archived = true;
  assert.equal(c.migrateRoutineHabits(), false);
  assert.equal(morning.is_archived, true);
});
test('migration respects existing replacements and delete tombstones', () => {
  const c = setup();
  c.state.habits = [{ id: 'bread', name: 'Brotfreier Tag', is_archived: true }, { id: 'custom', name: 'Morgenroutine', is_archived: true }];
  assert.equal(c.migrateRoutineHabits(), false);
  c.state.habits.pop();
  c.state.deletedRemoteIds = { habit_definitions: { '00000000-0000-4000-8000-000000000107': {} } };
  assert.equal(c.migrateRoutineHabits(), false);
  assert.equal(c.state.habits.length, 1);
  c.state.habits = [];
  assert.equal(c.migrateRoutineHabits(), false);
});
test('morning routine earns 30 for yes and zero for no; engagement caps at 30 for 15 minutes', () => {
  const c = setup();
  assert.equal(c.habitPoints({ name: 'Morgenroutine', type: 'boolean' }, { value_bool: true }), 30);
  assert.equal(c.habitPoints({ name: 'Morgenroutine', type: 'boolean' }, { value_bool: false }), 0);
  for (const [minutes, points] of [[0, 0], [5, 10], [15, 30], [60, 30], [-1, 0], ['invalid', 0]]) {
    assert.equal(c.habitPoints({ name: 'Engagement', type: 'duration', target: 15 }, { value_num: minutes }), points);
  }
  assert.equal(c.habitPoints({ name: 'Brotfreier Tag', type: 'boolean' }, { value_bool: true }), 12);
  assert.equal(c.habitPoints({ name: 'Stehpult', type: 'boolean' }, { value_bool: true }), 12);
});
test('weight history corrects existing ledger IDs to five points exactly once', () => {
  const c = setup();
  c.state.habits = [{ id: 'weight', name: 'Gewicht messen', type: 'weight', target: 79 }];
  c.state.habitEntries = [{ id: 'entry', habit_id: 'weight', value_num: 83.2, occurred_at: '2026-09-01T10:00:00Z', synced: true }];
  c.state.pointsLedger = [
    { id: 'ledger', source_type: 'habit', source_id: 'entry', points: 30, reason: 'Gewicht messen geloggt', earned_at: '2026-09-01T10:00:00Z', synced: true },
    { id: 'other', source_type: 'task', source_id: 'task', points: 100, synced: true }
  ];
  assert.equal(c.migrateHabitScoring(), true);
  assert.equal(c.state.pointsLedger.length, 2);
  assert.equal(c.state.pointsLedger[0].id, 'ledger');
  assert.equal(c.state.pointsLedger[0].points, 5);
  assert.equal(c.state.pointsLedger[0].synced, false);
  assert.equal(c.state.pointsLedger[1].points, 100);
  assert.equal(c.state.habitEntries[0].synced, true);
  assert.equal(c.migrateHabitScoring(), false);
});

test('sync reconciles new remote habits and weight points even on a pull-only refresh', () => {
  assert.ok(source.includes('if (remoteHabitRows) migrateRoutineHabits(state)'));
  assert.ok(source.includes('if (remoteHabitRows && remoteEntryRows && remoteLedgerRows) migrateHabitScoring'));
  assert.ok(source.includes('if (effectivePullOnly && hasPendingSyncWork()) effectivePullOnly = false'));
});

test('guided morning routine awards the habit once and recognises manual completion', () => {
  const c = setup();
  Object.assign(c, {
    toDateKey: () => '2026-09-25',
    isMorningRoutinePoint: () => false,
    morningRoutineSession: { dateKey: '2026-09-25', startedAt: '2026-09-25T09:00:00Z', routineKey: 'test' },
    getMorningRoutineByKey: () => ({ key: 'test', title: 'Test', steps: [1, 2] }),
    todayMorningRoutineSourceId: () => 'bonus-today',
    toast() {}, saveMorningRoutineSession() {}, saveState() {}, syncWithSupabase() {}
  });
  c.state.morningRoutineLogs = [];
  c.state.habits = [{ id: 'morning', name: 'Morgenroutine', type: 'boolean', icon: 'sunrise' }];
  for (const name of ['morningRoutineCompletedLog', 'finishMorningRoutine']) vm.runInContext(block(name), c);
  c.finishMorningRoutine();
  assert.equal(c.state.habitEntries.length, 1);
  assert.equal(c.state.pointsLedger.length, 1);
  assert.equal(c.state.pointsLedger[0].source_type, 'habit');
  assert.equal(c.state.pointsLedger[0].points, 30);
  c.finishMorningRoutine();
  assert.equal(c.state.pointsLedger.length, 1);
  c.state.morningRoutineLogs = [];
  c.state.pointsLedger = [];
  assert.ok(c.morningRoutineCompletedLog());
  c.finishMorningRoutine();
  assert.equal(c.state.habitEntries.length, 1);
  assert.equal(c.state.pointsLedger.length, 0);
});
