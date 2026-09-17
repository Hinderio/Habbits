const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../modules/line-calendar.js'), 'utf8');

function harness(rows = []) {
  let formatters = 0;
  const window = { localStorage: { getItem: key => key === 'habitflow-state-v1' ? JSON.stringify({ appointments: rows }) : '{}' } };
  vm.runInNewContext(source.replace("  if (document.readyState === 'loading')", `
    window.testing = { formatDate, formatTime, prepareAppointments, appointmentTiming, segmentAppointments, renderModalBody,
      setup() { windowAnchor = new Date('2026-09-17T10:00:00Z'); windowAppointments = prepareAppointments(); }
    }; if (document.readyState === 'loading')`), {
    window, Date, document: { readyState: 'loading', addEventListener() {} },
    Intl: { DateTimeFormat: function(...args) { formatters++; return new Intl.DateTimeFormat(...args); } }
  });
  return { api: window.testing, get formatters() { return formatters; } };
}

test('cached date and time formatters preserve Swiss output around DST and leap days', () => {
  const { api } = harness();
  for (const value of ['2024-02-29T23:00:00Z', '2026-03-29T01:30:00Z', '2026-10-25T01:30:00Z']) {
    const date = new Date(value);
    for (const options of [{}, { day: '2-digit', month: 'short' }, { day: '2-digit', month: 'long', year: 'numeric' }]) {
      assert.equal(api.formatDate(date, options), date.toLocaleDateString('de-CH', options));
    }
    assert.equal(api.formatTime(date), date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }));
  }
});

test('formatter construction stays bounded independently of event count and repeated renders', () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({ id: String(i), title: `Termin ${i}`,
    starts_at: new Date(Date.UTC(2026, 8, 18 + i % 340, 9)).toISOString() }));
  const app = harness(rows);
  app.api.setup();
  app.api.renderModalBody();
  const warmed = app.formatters;
  assert.ok(warmed <= 6, `Only a fixed set of formatters is needed, got ${warmed}`);
  for (let i = 0; i < 3; i++) app.api.renderModalBody();
  assert.equal(app.formatters, warmed, 'No new Intl formatters on subsequent renders');
});

test('timing caches belong to immutable snapshots and fresh preparation sees edits', () => {
  const { api } = harness();
  const rows = [{ id: 'a', starts_at: '2026-09-20T09:00:00Z', ends_at: '2026-09-22T09:00:00Z' }];
  const first = api.prepareAppointments(rows)[0];
  const timing = api.appointmentTiming(first);
  assert.equal(api.appointmentTiming(first), timing);
  rows[0].starts_at = '2027-01-01T09:00:00Z';
  rows[0].ends_at = '2027-01-01T10:00:00Z';
  const second = api.prepareAppointments(rows)[0];
  assert.notEqual(api.appointmentTiming(second), timing);
  assert.equal(api.appointmentTiming(second).isRange, false);
  assert.equal(api.appointmentTiming(first).isRange, true);
});

test('numeric filtering matches the previous date-based inclusion rules', () => {
  const { api } = harness();
  const rows = Array.from({ length: 300 }, (_, i) => ({ id: String(i),
    starts_at: new Date(Date.UTC(2026, 1, i, 9)).toISOString(),
    ends_at: new Date(Date.UTC(2026, 1, i + (i % 5), 10)).toISOString() }));
  const prepared = api.prepareAppointments(rows);
  const stamp = date => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  for (let month = 0; month < 12; month++) {
    const start = new Date(2026, month, 17, 12), end = new Date(2026, month + 1, 17, 12);
    const expected = prepared.filter(row => stamp(row._endDate) > stamp(row._date)
      ? row._date < end && row._endDate > start : row._date >= start && row._date < end);
    assert.equal(api.segmentAppointments(prepared, { start, end }).map(x => x.id).join(','), expected.map(x => x.id).join(','));
  }
});
