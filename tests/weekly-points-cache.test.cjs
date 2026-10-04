const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const domain = require('../modules/weekly-points-domain.js');
const renderer = fs.readFileSync(path.join(__dirname, '../modules/weekly-points.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function harness() {
  let time = new Date('2026-10-04T12:00:00').getTime(), width = 960, theme = '#607080';
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [time])); } static now() { return time; } }
  const frames = [], nodes = new Map(), models = [], resize = [], mutation = [];
  const counts = { builds: 0, markup: 0, paints: 0 };
  const ctx = { scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fillText() {}, fillRect() { counts.paints++; } };
  function node(id) {
    if (!nodes.has(id)) {
      let html = '';
      nodes.set(id, { style: {}, listeners: {}, attrs: {}, clientWidth: 960,
        set innerHTML(value) { html = value; counts.markup++; }, get innerHTML() { return html; },
        addEventListener(name, fn) { this.listeners[name] = fn; }, setAttribute(name, value) { this.attrs[name] = value; },
        querySelectorAll: () => [], querySelector: () => ({ focus() {}, scrollIntoView() {} }),
        getBoundingClientRect: () => ({ width, left: 0, top: 0 }), getContext: () => ctx });
    }
    return nodes.get(id);
  }
  const root = node('root'); root.querySelector = selector => node(selector.slice(1));
  const window = { devicePixelRatio: 2, matchMedia: () => ({ matches: width <= 760 }),
    HabitFlowWeeklyPointsDomain: { ...domain, build(input) { counts.builds++; const model = domain.build(input); models.push(model); return model; } } };
  vm.runInNewContext(renderer, { window, Date: Clock, document: { body: {}, getElementById: () => root },
    requestAnimationFrame(fn) { frames.push(fn); return frames.length; }, getComputedStyle: () => ({ getPropertyValue: () => theme }),
    ResizeObserver: class { constructor(fn) { resize.push(fn); } observe() {} },
    MutationObserver: class { constructor(fn) { mutation.push(fn); } observe() {} }
  });
  const flush = () => { while (frames.length) frames.shift()(); };
  return { counts, node, models, flush,
    render(input) { window.HabitFlowWeeklyPoints.render(input); flush(); },
    click(id) { node(id).listeners.click(); flush(); },
    setTime(value) { time = new Date(value).getTime(); }, now: () => new Date(time),
    resize(value) { width = value; resize.forEach(fn => fn()); flush(); },
    theme(value) { theme = value; mutation.forEach(fn => fn()); flush(); },
    hide() { width = 0; }, show() { width = 960; resize.forEach(fn => fn()); flush(); }
  };
}
const seed = () => ({
  habits: [{ id: 'h', name: 'Meditation' }, { id: 'other', name: 'Lesen' }],
  entries: [{ id: 'e', habit_id: 'h' }], tasks: [{ id: 't', title: 'Task A' }],
  ledger: [
    { id: 'a', points: 20, earned_at: '2026-09-30T12:00:00', source_type: 'habit', source_id: 'e', reason: 'Habit' },
    { id: 'b', points: -10, earned_at: '2026-09-29T12:00:00', source_type: 'task', source_id: 't', reason: 'Task' }
  ]
});
function matchesFresh(h, input) {
  const cached = h.models.at(-1);
  assert.deepEqual(plain(cached), plain(domain.build({ ...input, now: input.now ?? h.now(), offset: cached.offset, count: 52 })));
}
test('20 unchanged dashboard renders reuse model, controls, details and canvas', () => {
  const h = harness(), input = seed(); h.render(input); const initial = { ...h.counts };
  for (let i = 0; i < 20; i++) h.render(plain(input));
  assert.deepEqual(h.counts, initial); assert.equal(h.counts.builds, 1); matchesFresh(h,input);
  input.tasks[0].description = 'Unrelated edit'; input.tasks[0].synced = true;
  input.habits[0].icon = 'book'; input.entries[0].note = 'No effect on weekly points';
  h.render(input); assert.deepEqual(h.counts,initial);
});
test('in-place historical edits, names, references, IDs, grouping and ordering invalidate', () => {
  const h = harness(), input = seed(); h.render(input);
  for (const mutate of [
    () => { input.ledger[0].points = -50; },
    () => { input.ledger[0].earned_at = '2026-08-01T12:00:00'; },
    () => { input.habits[0].name = 'Anderer Habit'; },
    () => { input.tasks[0].title = 'Renamed task'; },
    () => { input.entries[0].habit_id = 'other'; },
    () => { input.ledger[1].reason = 'Corrected reason'; },
    () => { input.ledger[0].source_type = 'task'; input.ledger[0].source_id = 't'; },
    () => { input.ledger[1].id = 'a'; },
    () => { input.ledger.reverse(); },
    () => { input.ledger.push({ id: 'new', points: 25, earned_at: '2026-09-28T12:00:00' }); }
  ]) {
    const before = h.counts.builds; mutate(); h.render(input);
    assert.equal(h.counts.builds,before+1); matchesFresh(h,input);
  }
});
test('pause filtering and sync removal/restoration update even when original objects are reused', () => {
  const h = harness(), input = seed(), all = input.ledger;
  h.render(input);
  // The app supplies visibleLedgerPoints(), rather than raw pause definitions.
  input.ledger = all.slice(1); h.render(input); matchesFresh(h,input);
  input.ledger = all; h.render(input); matchesFresh(h,input);
  input.ledger = []; h.render(input); matchesFresh(h,input);
  assert.equal(h.counts.builds,4);
  assert.match(h.node('weeklyPointsItems').innerHTML,/Keine Punktebuchungen/);
});
test('week selection, resize and theme changes update presentation without rebuilding', () => {
  const h = harness(), input = seed(); h.render(input);
  h.node('weeklyPointsSelect').listeners.change({target:{value:'0'}});
  assert.equal(h.node('weeklyPointsSelect').value,'0');
  h.resize(360); assert.equal(h.node('weeklyPointsCanvas').style.width,'850px');
  const painted = h.counts.paints; h.theme('#ffffff'); assert.ok(h.counts.paints > painted);
  h.node('weeklyPointsMore').listeners.click();
  h.render(input); assert.equal(h.node('weeklyPointsSelect').value,'0');
  h.click('weeklyPointsToday'); assert.equal(h.node('weeklyPointsSelect').value,'51');
  assert.equal(h.counts.builds,1);
});
test('range navigation rebuilds and returning to today restores controls', () => {
  const h = harness(), input = seed(); h.render(input);
  h.click('weeklyPointsPrev'); matchesFresh(h,input); assert.equal(h.models.at(-1).offset,52);
  h.click('weeklyPointsNext'); matchesFresh(h,input); assert.equal(h.models.at(-1).offset,0);
  assert.equal(h.node('weeklyPointsNext').disabled,true); assert.equal(h.counts.builds,3);
});
test('same-week clock ticks reuse; Monday and year rollover rebuild', () => {
  const h = harness(), input = seed(); h.render(input);
  h.setTime('2026-10-04T23:59:59'); h.render(input); assert.equal(h.counts.builds,1);
  h.setTime('2026-10-05T00:00:00'); h.render(input); assert.equal(h.counts.builds,2); matchesFresh(h,input);
  h.setTime('2027-01-04T00:00:00'); h.render(input); assert.equal(h.counts.builds,3); matchesFresh(h,input);
});
test('future bookings become visible at their timestamp, also when clock moves backwards', () => {
  const h = harness(), input = seed(); input.ledger.push({ id:'future', points:99, earned_at:'2026-10-04T13:00:00' });
  h.render(input);
  h.setTime('2026-10-04T12:59:59'); h.render(input); assert.equal(h.counts.builds,1);
  h.setTime('2026-10-04T13:00:00'); h.render(input); assert.equal(h.counts.builds,2); matchesFresh(h,input);
  h.setTime('2026-10-04T12:00:00'); h.render(input); assert.equal(h.counts.builds,3); matchesFresh(h,input);
});
test('a hidden canvas paints the newest model on reveal', () => {
  const h = harness(), input = seed(); h.hide(); h.render(input); assert.equal(h.counts.paints,0);
  input.ledger[0].points = 150; h.render(input); matchesFresh(h,input);
  h.show(); assert.ok(h.counts.paints > 0); assert.equal(h.counts.builds,2);
  const builds=h.counts.builds; h.render(input); assert.equal(h.counts.builds,builds);
});
