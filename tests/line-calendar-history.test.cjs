const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../modules/line-calendar.js'), 'utf8');

function harness(rows = []) {
  let reads = 0, refreshes = 0, refresh = async () => false;
  const hidden = new Set();
  const frames = new Map();
  let frameId = 0;
  const modal = {
    innerHTML: '',
    classList: { contains: key => hidden.has(key), add: key => hidden.add(key), remove: key => hidden.delete(key) },
    querySelectorAll: () => [],
    querySelector: () => ({ focus() {} })
  };
  const window = {
    localStorage: { getItem(key) { reads++; return key === 'habitflow-state-v1' ? JSON.stringify({ appointments: rows, deletedRemoteIds: { appointments: ['deleted'] } }) : '{}'; } },
    addEventListener() {}, removeEventListener() {}
  };
  const context = vm.createContext({ window, Date, console,
    document: { readyState: 'loading', addEventListener() {}, body: { classList: { add() {}, remove() {} } } },
    requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
    mockRefresh: () => { refreshes++; return refresh(); }
  });
  vm.runInContext(source.replace("  if (document.readyState === 'loading')", `
    refreshRemoteAppointments = mockRefresh;
    window.testing = { prepareAppointments, buildSegments, segmentAppointments, renderModalBody,
      changeWindow, openModal, closeModal, renderSegment,
      setup(value, anchor) { modal = value; windowAnchor = anchor; windowAppointments = prepareAppointments(); },
      offset() { return monthOffset; }
    };
    if (document.readyState === 'loading')`), context);
  const api = window.testing;
  api.setup(modal, new Date('2026-09-17T10:00:00Z'));
  return { api, modal, frames, get reads() { return reads; }, get refreshes() { return refreshes; },
    setRefresh(fn) { refresh = fn; } };
}

const row = (id, starts_at, ends_at, extra = {}) => ({ id, title: id, starts_at, ends_at, ...extra });

test('history keeps past events while excluding deleted, invalid and birthday entries', () => {
  const app = harness([
    row('older', '2023-10-01T10:00:00Z'), row('recent', '2026-05-01T10:00:00Z'),
    row('future', '2027-01-01T10:00:00Z'), row('deleted', '2025-11-01T10:00:00Z'),
    row('birthday', '2026-05-01T10:00:00Z', null, { is_birthday: true }), row('invalid', 'invalid')
  ]);
  assert.equal(app.api.prepareAppointments().map(x => x.id).join(','), 'older,recent,future');
  app.api.changeWindow('-12');
  assert.match(app.modal.innerHTML, /12 Monate Rückblick/);
  assert.match(app.modal.innerHTML, /recent/);
  assert.doesNotMatch(app.modal.innerHTML, /older|future|birthday|deleted/);
  assert.match(app.modal.innerHTML, /Erster Termin/);
  app.api.changeWindow('-12');
  app.api.changeWindow('-12');
  assert.match(app.modal.innerHTML, /older/);
});

test('half-open windows include spanning ranges but do not duplicate boundary points', () => {
  const app = harness([
    row('start', '2025-09-17T10:00:00Z'), row('end', '2026-09-17T10:00:00Z'),
    row('spans', '2025-01-01T10:00:00Z', '2027-01-01T10:00:00Z'),
    row('ended', '2025-09-01T10:00:00Z', '2025-09-17T10:00:00Z')
  ]);
  const rows = app.api.prepareAppointments();
  const segments = app.api.buildSegments(new Date('2026-09-17T10:00:00Z'), -12);
  const visible = app.api.segmentAppointments(rows, { start: segments[0].start, end: segments[11].end });
  assert.equal(visible.map(x => x.id).join(','), 'spans,start');
  assert.match(app.api.renderSegment(segments[0], visible), /is-continued/);
});

test('leap-day and month-end pages are contiguous without anchor drift', () => {
  const { api } = harness();
  for (const anchor of [new Date(2024, 1, 29, 12), new Date(2026, 2, 31, 12)]) {
    const originalTime = anchor.getTime();
    for (let offset = -60; offset <= 0; offset += 12) {
      const current = api.buildSegments(anchor, offset);
      const next = api.buildSegments(anchor, offset + 12);
      assert.equal(current.length, 12);
      assert.equal(current[11].end.getTime(), next[0].start.getTime());
      for (let i = 1; i < 12; i++) assert.equal(current[i - 1].end.getTime(), current[i].start.getTime());
    }
    assert.equal(api.buildSegments(anchor, 0)[0].start.getTime(), originalTime);
    assert.equal(anchor.getTime(), originalTime);
  }
});

test('paging reuses the snapshot without storage reads or network requests and returns to today', () => {
  const app = harness([row('recent', '2026-05-01T10:00:00Z'), row('future', '2027-01-01T10:00:00Z')]);
  const reads = app.reads;
  for (let i = 0; i < 20; i++) app.api.changeWindow('-12');
  assert.equal(app.api.offset(), -240);
  assert.match(app.modal.innerHTML, /In diesem Zeitraum sind keine Termine eingetragen/);
  app.api.changeWindow('12');
  assert.equal(app.api.offset(), -228);
  app.api.changeWindow('today');
  assert.equal(app.api.offset(), 0);
  assert.match(app.modal.innerHTML, /12 Monate voraus/);
  assert.match(app.modal.innerHTML, /future/);
  assert.match(app.modal.innerHTML, /data-line-calendar-page="12"[^>]*disabled/);
  const html = app.modal.innerHTML;
  app.api.changeWindow('12'); app.api.changeWindow('invalid');
  assert.equal(app.modal.innerHTML, html);
  assert.equal(app.reads, reads);
  assert.equal(app.refreshes, 0);
  assert.equal(app.frames.size, 1, 'old pending layout is cancelled on every page change');
});

test('loading prevents paging; closing invalidates late results and reopening resets the window', async () => {
  const app = harness();
  let resolve;
  app.setRefresh(() => new Promise(done => { resolve = done; }));
  const pending = app.api.openModal();
  assert.match(app.modal.innerHTML, /data-line-calendar-page="-12"[^>]*disabled/);
  app.api.changeWindow('-12');
  assert.equal(app.api.offset(), 0);
  app.api.closeModal();
  resolve(false); await pending;
  assert.equal(app.modal.innerHTML, '');
  app.setRefresh(async () => false);
  await app.api.openModal();
  app.api.changeWindow('-12');
  assert.equal(app.api.offset(), -12);
  app.api.closeModal();
  await app.api.openModal();
  assert.equal(app.api.offset(), 0);
});

test('past lines show elapsed progress, future lines remain unfilled', () => {
  const { api } = harness();
  const past = { index: 8, start: new Date('2020-01-01'), end: new Date('2020-02-01') };
  const future = { index: 0, start: new Date('2090-01-01'), end: new Date('2090-02-01') };
  assert.match(api.renderSegment(past, []), /--segment-progress:100.00%/);
  assert.match(api.renderSegment(future, []), /--segment-progress:0.00%/);
});
