const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'modules/smoking-top-cards-polish.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const oracle = fs.readFileSync(path.join(__dirname, 'fixtures/smoke-ring-metrics-before-live-fix.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function harness({ init = true } = {}) {
  let clock = new Date('2026-09-16T12:00:00').getTime(), seq = 0, live = { cigarettes: [], pausePeriods: [] };
  const timers = new Map(), intervals = [], listeners = new Map(), domListeners = new Map();
  const probe = { metrics: 0, reads: 0, renders: 0, rings: [], overviews: [], observed: false, ringWhileObserved: 0 };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } }
  const element = () => ({ textContent: '', dataset: {}, style: { setProperty() {} },
    classList: { toggle() {}, add() {} }, setAttribute() {}, insertAdjacentElement() {}, prepend() {} });
  const label = element(), value = element(), hint = element(), meta = element(), sector = element();
  const svg = element(), progress = element(), bonus = element(), box = element(), history = element(), panel = element(), focus = element();
  const ringNodes = { small: label, '#smokePauseLive': value, '#smokePauseHint': hint,
    '.hf-smoke-progress-svg': svg, '.hf-smoke-sector': sector, '.hf-smoke-bonus-meta': meta };
  box.querySelector = selector => ringNodes[selector] || null;
  svg.querySelector = selector => selector === '.hf-smoke-progress-value' ? progress : bonus;
  panel.querySelector = () => null;
  history.querySelector = selector => selector === '.hf-overview-row.is-focus .hf-overview-copy span' ? focus : null;
  const document = { readyState: 'loading', hidden: false,
    getElementById: id => id === 'screen-smoking' || id === 'habitflow-smoking-top-cards-polish-style' ? element() : null,
    querySelector(selector) {
      if (selector === '#screen-smoking .smoke-ring') return box;
      if (selector === '#smokeHistory') return history;
      if (selector.endsWith('.consumption-history-panel')) return panel;
      if (selector === '.hf-overview-row.is-focus .hf-overview-copy span') return focus;
      return null;
    },
    addEventListener(name, callback) { if (!domListeners.has(name)) domListeners.set(name, []); domListeners.get(name).push(callback); }
  };
  const window = { document, localStorage: { getItem: () => JSON.stringify(live) },
    HabitFlowModules: { has: () => false, register() {} },
    HabitFlowConsumptionLive: { snapshot() { probe.reads++; return live; } },
    setTimeout(callback, delay) { const id = ++seq; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id), setInterval: (callback, delay) => intervals.push({ callback, delay }),
    addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(callback); },
    dispatchEvent(event) { (listeners.get(event.type) || []).forEach(callback => callback(event)); },
    MutationObserver: class { constructor(callback) { this.callback = callback; } disconnect() { probe.observed = false; } observe() { probe.observed = true; } },
  };
  const c = vm.createContext({ window, document, Date: Clock, console, MutationObserver: window.MutationObserver,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    consumptionLiveSnapshot: () => live, __probe: probe });
  const instrumented = source
    .replace('function metrics(state = readState()) {', 'function metrics(state = readState()) { __probe.metrics++;')
    .replace('function ring(data) {', 'function ring(data) { __probe.rings.push(data); if (__probe.observed) __probe.ringWhileObserved++;')
    .replace('function overview(data) {', 'function overview(data) { __probe.overviews.push(data);')
    .replace('function render(snapshot = null, { data = null, forceRing = false } = {}) {', 'function render(snapshot = null, { data = null, forceRing = false } = {}) { __probe.renders++;')
    .replace('})(window, document);', oracle + '\nwindow.__ringTest = { legacyMetrics, metricsForSnapshot, refreshRing, refreshTimedDisplay, schedule };\n})(window, document);');
  vm.runInContext(instrumented, c);
  vm.runInContext(app.match(/  function notifyConsumptionLiveUpdate\([^]*?\n  \}/)[0], c);
  const boot = () => (domListeners.get('DOMContentLoaded') || []).forEach(callback => callback());
  if (init) boot();
  const reset = () => { probe.metrics = probe.reads = probe.renders = probe.ringWhileObserved = 0; probe.rings.length = probe.overviews.length = 0; };
  reset();
  return { probe, window, document, boot, reset, nodes: { value, label, hint, focus, history },
    setState(state) { live = state; }, get state() { return live; },
    notify(reason = 'state') { c.notifyConsumptionLiveUpdate(reason); },
    advance(ms) { clock += ms; }, setClock(value) { clock = new Date(value).getTime(); },
    tick(ms) { intervals.filter(interval => interval.delay === ms).forEach(interval => interval.callback()); },
    runTimers() { const pending = [...timers.values()]; timers.clear(); pending.forEach(timer => timer.callback()); },
    legacy: () => window.__ringTest.legacyMetrics(live),
  };
}
function seed() {
  return { cigarettes: [
    { id: 'a', smoked_at: '2026-09-16T07:00:00', interval_minutes: 450, points: 20 },
    { id: 'b', smoked_at: '2026-09-16T09:00:00', interval_minutes: 120, scoring_interval_minutes: 120, points: 20 },
    { id: 'c', smoked_at: '2026-09-16T10:00:00', interval_minutes: 60, scoring_interval_minutes: 60, points: 0 },
  ], pausePeriods: [] };
}
test('one live event computes once and shares the result with ring and overview', () => {
  const h = harness(); h.setState(seed());
  let received = 0;
  h.window.addEventListener('habitflow:consumption-live-update', event => { received++; assert.equal(event.detail.reason, 'recorded'); assert.equal(event.detail.snapshot, h.state); });
  h.notify('recorded');
  assert.equal(received, 1);
  assert.equal(h.probe.metrics, 1); assert.equal(h.probe.rings.length, 1); assert.equal(h.probe.overviews.length, 1);
  assert.equal(h.probe.rings[0], h.probe.overviews[0]);
  assert.deepEqual(plain(h.probe.rings[0]), plain(h.legacy()));
  assert.equal(h.probe.ringWhileObserved, 0);
});
test('optimistic and committed updates stay immediate; unchanged data reuses metrics', () => {
  const h = harness(); h.setState(seed()); h.notify('optimistic');
  h.state.cigarettes[2].points = 60; h.notify('committed');
  assert.equal(h.probe.metrics, 2); assert.equal(h.probe.rings.length, 2);
  assert.equal(h.probe.overviews.at(-1).recent[0].points, 60);
  h.notify('same-state');
  assert.equal(h.probe.metrics, 2); assert.equal(h.probe.rings.length, 3);
});
test('five-second ticks update elapsed time without reading or scanning history', () => {
  const h = harness(); h.setState(seed()); h.notify(); h.reset();
  h.advance(60000); h.tick(5000);
  assert.equal(h.probe.metrics, 0); assert.equal(h.probe.reads, 0); assert.equal(h.probe.overviews.length, 0);
  assert.equal(h.probe.rings.at(-1).pause, 121);
  assert.deepEqual(plain(h.probe.rings.at(-1)), plain(h.legacy()));
  assert.equal(h.probe.ringWhileObserved, 0);
});
test('thirty-second ticks update only clock surfaces until silent data changes', () => {
  const h = harness(); h.setState(seed()); h.notify(); h.reset();
  h.advance(30000); h.tick(30000);
  assert.equal(h.probe.metrics, 0); assert.equal(h.probe.renders, 0);
  assert.match(h.nodes.focus.textContent, /nächste saubere Marke/);
  h.state.cigarettes[2].smoked_at = '2026-09-16T10:30:00';
  h.advance(30000); h.tick(30000);
  assert.equal(h.probe.metrics, 1); assert.equal(h.probe.renders, 1);
  assert.deepEqual(plain(h.probe.overviews.at(-1)), plain(h.legacy()));
});
test('midnight refreshes day/week windows and historical median', () => {
  const h = harness(); h.setClock('2026-09-16T23:59:58'); h.setState(seed());
  h.state.cigarettes.unshift(
    { id: 'old-a', smoked_at: '2026-08-20T08:00:00', interval_minutes: 60 },
    { id: 'old-b', smoked_at: '2026-08-20T09:00:00', interval_minutes: 60 });
  h.notify(); assert.equal(h.probe.rings.at(-1).median, 60); h.reset();
  h.advance(5000); h.tick(5000);
  assert.equal(h.probe.metrics, 1); assert.equal(h.probe.overviews.at(-1).today, 0);
  assert.equal(h.probe.overviews.at(-1).median, 90);
  assert.deepEqual(plain(h.probe.overviews.at(-1)), plain(h.legacy()));
});
test('in-place time, interval, sleep, archive, pause and deletion edits invalidate metrics', () => {
  const h = harness(); h.setState(seed()); h.notify();
  const edits = [
    () => h.state.cigarettes[2].scoring_sleep_deducted_minutes = 10,
    () => h.state.cigarettes[2].scoring_interval_minutes = 40,
    () => h.state.cigarettes[1].interval_minutes = 140,
    () => h.state.cigarettes[1].is_archived = true,
    () => h.state.pausePeriods.push({ scope: 'smoke', starts_at: '2026-09-16T08:00:00', ends_at: null }),
    () => h.state.pausePeriods[0].ends_at = '2026-09-16T09:30:00',
    () => h.state.pausePeriods[0].is_archived = true,
    () => h.state.cigarettes.splice(0, 1),
    () => h.state.cigarettes = [],
  ];
  for (const edit of edits) {
    h.reset(); edit(); h.notify();
    assert.equal(h.probe.metrics, 1);
    assert.deepEqual(plain(h.probe.overviews.at(-1)), plain(h.legacy()));
  }
});
test('early events and public update API remain supported', () => {
  const h = harness({ init: false }); h.setState(seed()); h.notify();
  assert.equal(h.probe.metrics, 1); h.boot(); assert.equal(h.probe.metrics, 1);
  h.state.cigarettes.push({ id: 'd', smoked_at: '2026-09-16T11:59:00' });
  assert.equal(h.window.HabitFlowSmokingCircle.update(h.state), true);
  assert.equal(h.probe.metrics, 2); assert.equal(h.probe.rings.at(-1).pause, 1);
});
test('pending throttled paints cannot overwrite a newer immediate live update', () => {
  const h = harness(); h.setState(seed()); h.notify(); h.advance(1000); h.tick(5000);
  h.state.cigarettes.push({ id: 'd', smoked_at: '2026-09-16T12:00:00' }); h.notify();
  h.runTimers();
  assert.equal(h.probe.rings.at(-1).rows.at(-1).id, 'd');
  assert.equal(h.probe.ringWhileObserved, 0);
});
test('storage events refresh the standalone fallback and hidden timer ticks do no work', () => {
  const h = harness(); delete h.window.HabitFlowConsumptionLive;
  h.setState(seed());
  h.window.dispatchEvent({ type: 'storage', key: 'habitflow-state-v1' }); h.runTimers();
  assert.equal(h.probe.overviews.at(-1).total, 3);
  h.reset(); h.document.hidden = true; h.advance(5000); h.tick(5000);
  assert.equal(h.probe.metrics, 0); assert.equal(h.probe.rings.length, 0);
});
test('median and bonus transitions still update the ring label and timer', () => {
  const h = harness(); h.setState(seed()); h.setClock('2026-09-16T11:29:00'); h.notify(); h.reset();
  assert.equal(h.nodes.label.textContent, 'Aktuelle Pause');
  h.advance(60000); h.tick(5000);
  assert.equal(h.nodes.label.textContent, 'Median erreicht');
  h.advance(60000); h.tick(5000);
  assert.equal(h.nodes.label.textContent, 'Median übertroffen');
  assert.equal(h.nodes.value.textContent, '1h 31m');
  assert.equal(h.probe.metrics, 0);
});
test('scheduled DOM repairs reuse metrics but still redraw changed UI', () => {
  const h = harness(); h.setState(seed()); h.notify(); h.reset();
  h.window.__ringTest.schedule(120); h.runTimers();
  assert.equal(h.probe.metrics, 0);
  assert.ok(h.probe.renders > 0);
  assert.ok(h.probe.overviews.length > 0);
});
