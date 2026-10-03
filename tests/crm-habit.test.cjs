const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const stories = fs.readFileSync(path.join(__dirname, '../modules/habit-story-coverage.js'), 'utf8');
const block = name => source.match(new RegExp('  function ' + name + '\\([^]*?\\n  \\}'))[0];
function setup() {
  let id = 0;
  const c = {
    state: { habits: [], habitEntries: [], pointsLedger: [], deletedRemoteIds: {} },
    nowIso: () => '2026-10-03T12:00:00Z', uid: () => 'entry-' + ++id,
    isFitnessDistanceHabit: () => false, markRemoteDeletedMany() {},
    activePauseNow: () => null, saveState() {}, renderHistoryModal() {},
    toast() {}, syncWithSupabase() {}, parseFitnessDurationNote: () => null,
    parseFitnessAscentNote: () => null
  };
  vm.createContext(c);
  for (const name of ['createCrmHabit', 'ensureCrmHabit', 'habitPoints', 'habitPointReason', 'isSwimmingHabit', 'addPoints', 'migrateHabitScoring', 'logHabit', 'renderHabitQuickLogControl'])
    vm.runInContext(block(name), c);
  return c;
}
test('CRM is added once to existing data and preserves archives and delete tombstones', () => {
  const c = setup();
  c.state.habits.push({ id: 'existing', name: 'Lesen' });
  assert.equal(c.ensureCrmHabit(), true);
  const habit = c.state.habits[1];
  assert.equal(habit.name, 'CRM Viertelstunde');
  assert.equal(habit.type, 'boolean');
  assert.equal(habit.target, 1);
  assert.equal(habit.target_period, 'day');
  assert.equal(habit.synced, false);
  assert.equal(c.ensureCrmHabit(), false);
  habit.is_archived = true;
  assert.equal(c.ensureCrmHabit(), false);
  assert.equal(habit.is_archived, true);
  c.state.habits.pop();
  c.state.deletedRemoteIds.habit_definitions = { [habit.id]: {} };
  assert.equal(c.ensureCrmHabit(), false);
  c.state.deletedRemoteIds = {};
  c.state.habits.push({ id: 'custom', name: ' CRM Viertelstunde ', is_archived: true });
  assert.equal(c.ensureCrmHabit(), false);
  assert.equal(c.state.habits.length, 2);
});
test('fresh state and remote refresh both include CRM provisioning', () => {
  assert.match(block('defaultState'), /createCrmHabit\(created\)/);
  assert.match(block('ensureSystemHabits'), /ensureCrmHabit\(nextState\)/);
  assert.ok(source.includes('if (remoteHabitRows) ensureCrmHabit(state);'));
});
test('completion uses normal logging and awards 15 points, including after renaming', () => {
  const c = setup();
  const habit = c.createCrmHabit();
  c.state.habits.push(habit);
  c.logHabit(habit.id);
  assert.equal(c.state.habitEntries.length, 1);
  assert.equal(c.state.habitEntries[0].value_bool, true);
  assert.equal(c.state.habitEntries[0].synced, false);
  assert.equal(c.state.pointsLedger[0].points, 15);
  assert.equal(c.state.pointsLedger[0].source_id, c.state.habitEntries[0].id);
  assert.equal(c.state.pointsLedger[0].source_type, 'habit');
  assert.equal(c.habitPoints({ ...habit, name: 'Kontakte', icon: 'boolean' }, { value_bool: true }), 15);
  assert.equal(c.habitPoints(habit, { value_bool: false }), 0);
});
test('editing and removing completion reconciles its existing ledger row without duplicates', () => {
  const c = setup();
  const habit = c.createCrmHabit();
  c.state.habits.push(habit);
  c.logHabit(habit.id);
  const ledgerId = c.state.pointsLedger[0].id;
  assert.equal(c.migrateHabitScoring(), false);
  c.state.habitEntries[0].value_bool = false;
  c.migrateHabitScoring();
  assert.equal(c.state.pointsLedger[0].points, 0);
  assert.equal(c.state.pointsLedger[0].id, ledgerId);
  c.state.habitEntries[0].value_bool = true;
  c.migrateHabitScoring();
  assert.equal(c.state.pointsLedger[0].points, 15);
  assert.equal(c.state.pointsLedger.length, 1);
  c.state.habitEntries = [];
  c.migrateHabitScoring();
  assert.equal(c.state.pointsLedger.length, 0);
});
test('CRM uses the shared quick action and retains detail actions and history', () => {
  const c = setup(), habit = c.createCrmHabit();
  const html = c.renderHabitQuickLogControl(habit);
  assert.match(html, /data-action="log-habit"/);
  assert.ok(html.includes(habit.id));
  assert.match(html, /Heute abhaken/);
  const detail = block('renderHabitDetailModal');
  for (const action of ['edit-habit', 'open-pause-modal', 'archive-habit', 'delete-habit']) assert.ok(detail.includes(action));
  assert.ok(detail.includes('renderHabitEntryList(normalizedHabit)'));
});
test('both statistics renderers omit CRM but retain other habit statistics', () => {
  const c = setup();
  c.els = { habitPlayfulStats: { innerHTML: '' } };
  c.isSystemMeditationHabit = () => false;
  c.habitIconKey = h => h.icon;
  c.buildHabitStoryMetric = h => ({ title: h.name });
  c.svgIcon = () => '';
  c.escapeHtml = value => String(value || '');
  vm.runInContext(block('renderHabitPlayfulStats'), c);
  c.renderHabitPlayfulStats([c.createCrmHabit(), { name: 'Lesen', icon: 'number' }]);
  assert.ok(!c.els.habitPlayfulStats.innerHTML.includes('CRM Viertelstunde'));
  assert.ok(c.els.habitPlayfulStats.innerHTML.includes('Lesen'));
  const context = {
    document: { getElementById: () => ({}) },
    readState: () => ({ habits: [c.createCrmHabit()] })
  };
  vm.createContext(context);
  for (const name of ['iconKey', 'ensureHabitStories']) {
    const fn = stories.match(new RegExp('  function ' + name + '\\([^]*?\\n  \\}'))[0];
    vm.runInContext(fn, context);
  }
  // With only CRM the fallback renderer exits before creating any story card.
  context.ensureHabitStories();
  assert.equal(context.iconKey({ ...c.createCrmHabit(), name: 'Kontakte', icon: 'boolean' }), 'crm');
});
