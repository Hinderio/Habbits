const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const block = name => source.match(new RegExp('  function ' + name + '\\([^]*?\\n  \\}'))[0];
function setup(type = 'number') {
  const nodes = new Map(['.habit-card-status-badge', '.habit-card-value-row strong', '.habit-progress-track i', '.habit-card-meta-row span:last-child', '.habit-quick-check'].map(key => [key, { textContent: '', style: {} }]));
  const classes = new Set();
  const card = { querySelector: key => nodes.get(key), classList: { toggle(key, yes) { yes ? classes.add(key) : classes.delete(key); } } };
  const input = { value: '5', matches: () => true, closest: () => card };
  const otherInput = { value: 'unfinished draft' };
  let sequence = 0;
  const calls = { render: 0, sync: 0, persist: 0, history: 0, period: 0, today: 0 };
  const habit = { id: 'h', name: type === 'boolean' ? 'CRM Viertelstunde' : 'Lesen', type, target: type === 'boolean' ? 1 : 10, target_period: 'day', unit: type === 'boolean' ? 'x' : 'Min.' };
  const c = {
    state: { habits: [habit], habitEntries: [], pointsLedger: [], deletedRemoteIds: {} },
    document: { activeElement: input, body: {} }, els: { habitCards: { querySelector: () => ({ closest: () => card }) } },
    nowIso: () => '2026-10-31T12:00:00Z', toDateKey: () => '2026-10-31', uid: () => 'id-' + ++sequence,
    cssEscape: value => value, $: () => input,
    isFitnessDistanceHabit: () => false, isSwimmingHabit: () => false,
    activePauseNow: () => null, confirm: () => true,
    formatHabitValue: (_, value) => String(value),
    effectiveHabitUnit: h => h.unit,
    habitTargetPeriodMeta: () => ({ short: 'Tag' }),
    habitValueForPeriod: () => {
      calls.period++;
      const value = type === 'boolean' ? Number(c.state.habitEntries.some(e => e.value_bool)) : c.state.habitEntries.reduce((n,e) => n + e.value_num, 0);
      return { value, label: String(value) };
    },
    entriesForHabitOnDate: () => { calls.today++; return c.state.habitEntries; },
    addPoints: (_, id, points) => c.state.pointsLedger.push({ source_id: id, points }),
    habitPointReason: h => h.name,
    combineDeletedRemoteIds: x => x, readRemoteDeleteArchive: () => ({}), writeRemoteDeleteArchive() {},
    window: { HabitFlowPersistence: { writeState() { calls.persist++; } } },
    queuePointEvolutionRefresh() {},
    render() { calls.render++; }, renderSyncStatus() {},
    requestAnimationFrame: fn => frames.push(fn),
    renderHistoryModal() { calls.history++; }, toast() {},
    parseFitnessDurationNote: () => null, parseFitnessAscentNote: () => null,
    syncWithSupabase() { calls.sync++; }
  };
  const frames = [];
  vm.createContext(c);
  vm.runInContext('let analyticsReadCache = null; let renderQueued = false; let deferredRenderPending = false;', c);
  for (const name of ['withAnalyticsReadScope','shouldDeferInteractiveRender','queueRender','safeRender','saveState','habitPoints','habitFulfillmentState','habitProgressPercent','refreshLoggedHabitCard','logHabit']) vm.runInContext(block(name), c);
  return { c, habit, nodes, input, otherInput, classes, calls, frames };
}
test('focused numeric logging confirms immediately while the full render stays deferred', () => {
  const { c, habit, nodes, input, otherInput, classes, calls, frames } = setup();
  c.logHabit(habit.id, 'habit-card-input-h');
  assert.equal(nodes.get('.habit-card-value-row strong').textContent, '5');
  assert.equal(nodes.get('.habit-card-status-badge').textContent, '1 Log heute');
  assert.equal(nodes.get('.habit-progress-track i').style.width, '50%');
  assert.equal(nodes.get('.habit-card-meta-row span:last-child').textContent, 'Tag: 5 / 10 Min.');
  assert.equal(classes.has('is-complete'), false);
  assert.equal(c.document.activeElement, input);
  assert.equal(input.value, '');
  assert.equal(otherInput.value, 'unfinished draft');
  assert.equal(frames.length, 0);
  assert.equal(vm.runInContext('deferredRenderPending', c), true);
  assert.deepEqual(calls, { render: 0, sync: 1, persist: 1, history: 1, period: 1, today: 1 });
  input.value = '5';
  c.logHabit(habit.id, 'habit-card-input-h');
  assert.equal(nodes.get('.habit-card-status-badge').textContent, 'Erfüllt');
  assert.equal(nodes.get('.habit-card-value-row strong').textContent, '10');
  assert.equal(nodes.get('.habit-progress-track i').style.width, '100%');
  assert.equal(classes.has('is-complete'), true);
  assert.equal(c.state.habitEntries.length, 2);
  assert.equal(c.state.pointsLedger.length, 2);
});
test('boolean completion updates the check button and awards exactly its existing points', () => {
  const { c, habit, nodes, calls } = setup('boolean');
  c.logHabit(habit.id);
  assert.equal(nodes.get('.habit-quick-check').textContent, 'Heute erledigt');
  assert.equal(nodes.get('.habit-card-status-badge').textContent, 'Erfüllt');
  assert.equal(c.state.pointsLedger[0].points, 15);
  assert.equal(calls.sync, 1);
  assert.equal(calls.render, 0);
});
test('invalid values and declined pause confirmation cause no writes or visual success', () => {
  for (const value of ['0', '-1', 'invalid']) {
    const { c, habit, input, calls } = setup();
    input.value = value;
    c.logHabit(habit.id, 'habit-card-input-h');
    assert.equal(c.state.habitEntries.length, 0);
    assert.equal(calls.period + calls.persist + calls.sync, 0);
  }
  const { c, habit, calls } = setup();
  c.activePauseNow = () => ({ id: 'pause' });
  c.confirm = () => false;
  c.logHabit(habit.id);
  assert.equal(calls.period + calls.persist + calls.sync, 0);
});
test('paused and weekly habits retain their status and period progress semantics', () => {
  const { c, habit, nodes, calls } = setup();
  c.activePauseNow = () => ({ id: 'pause' });
  c.habitTargetPeriodMeta = () => ({ short: 'Woche' });
  c.habitValueForPeriod = () => ({ value: 8, label: '8' });
  c.logHabit(habit.id);
  assert.equal(nodes.get('.habit-card-status-badge').textContent, 'Pausiert');
  assert.equal(nodes.get('.habit-progress-track i').style.width, '80%');
  assert.equal(nodes.get('.habit-card-value-row strong').textContent, '5');
  assert.equal(nodes.get('.habit-card-meta-row span:last-child').textContent, 'Woche: 8 / 10 Min.');
  assert.equal(calls.sync, 1);
});
test('without retained focus the existing frame is still queued only once', () => {
  const { c, habit, frames, calls } = setup();
  c.document.activeElement = c.document.body;
  c.logHabit(habit.id);
  c.queueRender();
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(calls.render, 1);
  assert.equal(calls.sync, 1);
});
test('a missing card skips analytics and safely uses the existing history refresh', () => {
  const { c, habit, calls } = setup();
  c.els.habitCards.querySelector = () => null;
  c.logHabit(habit.id);
  assert.equal(calls.period + calls.today, 0);
  assert.equal(calls.history, 1);
  assert.equal(c.state.habitEntries.length, 1);
});
