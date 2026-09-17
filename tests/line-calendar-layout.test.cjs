const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const source = fs.readFileSync(path.join(__dirname, '../modules/line-calendar.js'), 'utf8');

function harness({ resizeObserver = true } = {}) {
  const frames = new Map(), listeners = new Map(), observers = [], operations = [];
  let sequence = 0, fontSize = 16;
  const classes = new Set();
  const tracks = [];
  const modal = {
    classList: { contains: name => classes.has(name), add: name => classes.add(name) },
    querySelectorAll: () => tracks,
    innerHTML: ''
  };
  const window = {
    addEventListener: (event, fn) => listeners.set(event, fn),
    removeEventListener: (event, fn) => { if (listeners.get(event) === fn) listeners.delete(event); }
  };
  class Observer {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
    observe(target) { this.targets.push(target); }
    disconnect() { this.targets = []; }
  }
  if (resizeObserver) window.ResizeObserver = Observer;
  const context = vm.createContext({
    window, console, Date, document: {
      readyState: 'loading', addEventListener() {}, documentElement: {},
      body: { classList: { remove() {} } }
    },
    ResizeObserver: Observer,
    getComputedStyle: () => ({ fontSize: `${fontSize}px` }),
    requestAnimationFrame: fn => { frames.set(++sequence, fn); return sequence; },
    cancelAnimationFrame: id => frames.delete(id)
  });
  vm.runInContext(source.replace("  if (document.readyState === 'loading')", `
    window.testing = { layoutLabels, renderEvent, renderSegment, segmentAppointments, watchLayout,
      scheduleLayout, closeModal, setModal(value) { modal = value; } };
    if (document.readyState === 'loading')`), context);
  const api = window.testing;
  api.setModal(modal);
  function style() {
    return new Proxy({ setProperty(key, value) { this[key] = value; } }, {
      set(target, key, value) { operations.push('write'); target[key] = value; return true; }
    });
  }
  function addTrack(width, anchors) {
    const labels = anchors.map(anchor => ({ dataset: { anchor }, style: style() }));
    const svg = { set innerHTML(value) { operations.push('write'); this.paths = value; } };
    const track = {
      width, labels, style: style(),
      get clientWidth() { operations.push('read'); return this.width; },
      classList: { add() { operations.push('write'); } },
      querySelectorAll: () => labels,
      querySelector: () => svg
    };
    tracks.push(track);
    return track;
  }
  function flush() {
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn());
  }
  return { api, addTrack, flush, frames, listeners, observers, operations, tracks,
    setFontSize(value) { fontSize = value; } };
}

function checkLayout(layout, width, count) {
  assert.equal(layout.labels.length, count);
  assert.equal(new Set(layout.labels.map(label => label.index)).size, count);
  const lanes = new Map();
  for (const label of layout.labels) {
    assert.ok(label.left >= 0 && label.left + layout.labelWidth <= width + 1e-8, 'inside horizontal bounds');
    assert.ok(label.top >= 0 && label.top + layout.labelHeight <= layout.height, 'inside vertical bounds');
    assert.ok(label.top + layout.labelHeight < layout.axis || label.top > layout.axis, 'clear of timeline');
    if (!lanes.has(label.lane)) lanes.set(label.lane, []);
    lanes.get(label.lane).push(label);
  }
  for (const labels of lanes.values()) {
    labels.sort((a, b) => a.left - b.left);
    for (let i = 1; i < labels.length; i++) {
      assert.ok(labels[i].left >= labels[i - 1].left + layout.labelWidth, 'labels in same lane do not overlap');
    }
  }
  const laneRows = [...lanes.values()].map(labels => labels[0]).sort((a, b) => a.top - b.top);
  for (let i = 1; i < laneRows.length; i++) {
    assert.ok(laneRows[i].top >= laneRows[i - 1].top + layout.labelHeight, 'separate lanes do not overlap');
  }
}

test('dense screenshot-like month fits narrow mobile, tablet and desktop tracks', () => {
  const { api } = harness();
  const anchors = [3, 6, 10, 14, 17, 20, 34, 72, 89, 97];
  for (const width of [220, 260, 320, 600, 980, 1400]) {
    for (const fontSize of [16, 20, 32]) {
      checkLayout(api.layoutLabels(anchors, width, fontSize), width, anchors.length);
    }
  }
});

test('coincident events, endpoints and shuffled range midpoints stay distinct and stable', () => {
  const { api } = harness();
  const anchors = [100, 0, 50, 50, 0, 100, 2, 99, 49, 51];
  const first = api.layoutLabels(anchors, 280);
  checkLayout(first, 280, anchors.length);
  assert.equal(JSON.stringify(first), JSON.stringify(api.layoutLabels(anchors, 280)));
  for (const label of first.labels) assert.ok(Math.abs(label.anchor - anchors[label.index] * 2.8) < 1e-8);
});

test('sparse months retain the alternating above/below appearance; empty months are finite', () => {
  const { api } = harness();
  const layout = api.layoutLabels([10, 40, 70, 95], 1200);
  assert.equal(layout.labels.map(label => label.lane).join(','), '0,1,0,1');
  checkLayout(layout, 1200, 4);
  checkLayout(api.layoutLabels([], 250), 250, 0);
});

test('randomized layouts preserve bounds and separation without dropping labels', () => {
  const { api } = harness();
  let seed = 724;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let run = 0; run < 100; run++) {
    const anchors = Array.from({ length: 1 + Math.floor(random() * 160) }, () => random() * 100);
    const width = 180 + random() * 1400;
    checkLayout(api.layoutLabels(anchors, width), width, anchors.length);
  }
});

test('multi-month and end-of-month ranges remain clipped and anchored to their visible bar', () => {
  const { api } = harness();
  const segment = { index: 0, start: new Date('2026-09-17T09:00:00Z'), end: new Date('2026-10-17T09:00:00Z') };
  const appointment = { title: 'Ferien <Berge> & Meer', _date: new Date('2026-09-10T09:00:00Z'), _endDate: new Date('2026-10-24T09:00:00Z') };
  const html = api.renderEvent(appointment, segment);
  assert.match(html, /is-range is-continued is-open-ended/);
  assert.match(html, /--event-left:0.00%;--event-width:100.00%/);
  assert.match(html, /data-anchor="50.0000"/);
  assert.match(html, /Ferien &lt;Berge&gt; &amp; Meer/);
  assert.ok(!html.includes('Ferien <Berge>'));
  appointment._date = new Date('2026-10-17T08:00:00Z');
  const edge = api.renderEvent(appointment, segment);
  const [, left, width] = edge.match(/--event-left:([\d.]+)%;--event-width:([\d.]+)%/);
  assert.ok(Number(left) + Number(width) <= 100.01);
  assert.ok(Number(edge.match(/data-anchor="([\d.]+)"/)[1]) <= 100);
});

test('resize work is coalesced, reads precede writes, and unchanged sizes cause no writes', () => {
  const app = harness();
  const track = app.addTrack(980, [3, 6, 10, 14, 17, 20, 34, 72, 89, 97]);
  app.addTrack(980, [40, 65]);
  app.api.watchLayout();
  app.api.scheduleLayout(); app.api.scheduleLayout();
  assert.equal(app.frames.size, 1);
  app.flush();
  assert.ok(app.operations.lastIndexOf('read') < app.operations.indexOf('write'));
  const desktopHeight = parseFloat(track.style.height);
  app.operations.length = 0;
  app.observers[0].callback(); app.flush();
  assert.equal(app.operations.filter(op => op === 'write').length, 0);
  track.width = 260;
  app.listeners.get('resize')(); app.flush();
  assert.ok(parseFloat(track.style.height) > desktopHeight);
  app.operations.length = 0;
  app.setFontSize(24); app.listeners.get('resize')(); app.flush();
  assert.equal(track.style['--label-width'], '240px');
  assert.ok(app.operations.includes('write'));
});

test('closing cancels pending work and disconnects observers; reopening observes only new tracks', () => {
  const app = harness();
  app.addTrack(320, [0, 50, 100]);
  app.api.watchLayout();
  app.api.closeModal();
  assert.equal(app.frames.size, 0);
  assert.equal(app.observers[0].targets.length, 0);
  assert.equal(app.listeners.has('resize'), false);
  app.tracks.length = 0;
  const track = app.addTrack(900, [50]);
  app.api.watchLayout();
  assert.equal(app.observers[1].targets.length, 1);
  assert.equal(app.observers[1].targets[0], track);
});

test('window resize fallback works without ResizeObserver', () => {
  const app = harness({ resizeObserver: false });
  const track = app.addTrack(320, [0, 0, 50, 50, 100]);
  app.api.watchLayout(); app.flush();
  assert.ok(track.style.height);
  track.width = 1000; app.listeners.get('resize')(); app.flush();
  assert.equal(app.observers.length, 0);
  app.api.closeModal();
  assert.equal(app.listeners.size, 0);
});

test('large coincident input keeps every event; report layout-only timing', context => {
  const { api } = harness();
  const anchors = Array(10000).fill(50);
  const start = performance.now();
  const layout = api.layoutLabels(anchors, 280);
  const duration = performance.now() - start;
  checkLayout(layout, 280, anchors.length);
  context.diagnostic(`10,000 coincident labels: ${duration.toFixed(2)} ms (algorithm only, not browser rendering)`);
});
