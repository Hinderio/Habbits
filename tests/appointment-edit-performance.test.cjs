const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
function extract(name) {
  const match = new RegExp('  (?:async )?function ' + name + '\\(').exec(source);
  assert.ok(match, name);
  return source.slice(match.index, source.indexOf('\n  }', match.index) + 4);
}
function harness(screen = 'calendar') {
  const calls = { calendar: 0, details: 0, navigation: 0, scroll: 0, focus: 0, reset: 0 };
  const frames = [];
  const rows = [
    { id: 'a', title: 'Sommerfest', starts_at: '2026-09-20T09:00:00Z', ends_at: '2026-09-20T10:00:00Z', event_kind: 'celebration', appointment_type: 'social', location: 'Garten', description: 'Notiz', recurrence: 'monthly' },
    { id: 'b', title: 'Geburtstag', event_kind: 'birthday' },
    { id: 'c', title: 'Besuch', event_kind: 'visit' }
  ];
  const cards = rows.map(row => ({ id: row.id, editing: false,
    classList: { toggle(_name, value) { cards.find(card => card.id === row.id).editing = value; } } }));
  const fields = Object.fromEntries(['title','starts_at','ends_at','appointment_type','location','description','recurrence','event_kind','is_birthday'].map(name => [name, { value: '', checked: false }]));
  fields.title.focus = () => calls.focus++;
  const toggle = { classList: { add() {}, remove() {} } };
  const context = vm.createContext({
    document: { body: { dataset: { activeScreen: screen } } },
    state: { appointments: rows }, editingAppointmentId: null, appointmentFormOpen: false,
    selectedCalendarDate: '2026-09-17',
    els: { appointmentForm: { elements: fields, reset() { calls.reset++; Object.values(fields).forEach(field => { field.value = ''; field.checked = false; }); }, scrollIntoView() { calls.scroll++; } },
      dayDetails: { querySelectorAll: () => cards.map(card => ({ dataset: { id: card.id }, closest: () => card })) },
      appointmentFormTitle: {}, appointmentSubmitBtn: {}, cancelAppointmentEditBtn: toggle },
    requestAnimationFrame: fn => frames.push(fn),
    normalizeAppointmentType: value => value || 'other',
    normalizeAppointmentRecurrence: value => value || null,
    appointmentEventKind: row => row.event_kind || 'standard',
    syncAppointmentBirthdayRecurrence() {}, syncAppointmentFormPanel() {},
    defaultAppointmentRange: () => ({ start: '2026-09-17T09:00', end: '2026-09-17T10:00' }),
    renderCalendar() { calls.calendar++; }, renderDayDetails() { calls.details++; },
    showScreen() { calls.navigation++; calls.calendar++; calls.details++; context.document.body.dataset.activeScreen = 'calendar'; }
  });
  for (const name of ['toDateTimeLocalValue','syncAppointmentEditHighlight','editAppointment','resetAppointmentFormMode','openAppointmentForm','closeAppointmentForm']) vm.runInContext(extract(name), context);
  return { context, fields, cards, calls, frames };
}

test('opening an editor on the calendar fills every field without rebuilding either view', () => {
  const h = harness(); h.context.editAppointment('a');
  assert.equal(h.calls.calendar, 0); assert.equal(h.calls.details, 0); assert.equal(h.calls.navigation, 0);
  assert.equal(h.fields.title.value, 'Sommerfest');
  assert.equal(h.fields.event_kind.value, 'celebration');
  assert.equal(h.fields.recurrence.value, 'monthly');
  assert.equal(h.fields.location.value, 'Garten'); assert.equal(h.fields.description.value, 'Notiz');
  assert.equal(h.fields.starts_at.value, h.context.toDateTimeLocalValue('2026-09-20T09:00:00Z'));
  assert.equal(h.fields.ends_at.value, h.context.toDateTimeLocalValue('2026-09-20T10:00:00Z'));
  assert.equal(h.cards[0].editing, true); assert.equal(h.calls.focus, 1);
  assert.equal(h.calls.scroll, 0); h.frames.shift()(); assert.equal(h.calls.scroll, 1);
});

test('switching appointments updates only edit highlights and retains birthday and visit semantics', () => {
  const h = harness(); h.context.editAppointment('a'); h.context.editAppointment('b');
  assert.equal(h.cards[0].editing, false); assert.equal(h.cards[1].editing, true);
  assert.equal(h.fields.is_birthday.checked, true); assert.equal(h.fields.recurrence.value, 'yearly');
  assert.equal(h.fields.event_kind.value, 'standard');
  h.context.editAppointment('c');
  assert.equal(h.cards[1].editing, false); assert.equal(h.cards[2].editing, true);
  assert.equal(h.fields.is_birthday.checked, false); assert.equal(h.fields.event_kind.value, 'visit');
  assert.equal(h.calls.calendar + h.calls.details, 0);
});

test('entry from another screen performs exactly one normal refresh', () => {
  const h = harness('dashboard'); h.context.editAppointment('a');
  assert.equal(h.calls.navigation, 1); assert.equal(h.calls.calendar, 1); assert.equal(h.calls.details, 1);
});

test('cancel clears fields and highlight without redraw or a stale queued scroll', () => {
  const h = harness(); h.context.editAppointment('a'); h.context.closeAppointmentForm({ clearForm: true });
  h.frames.forEach(fn => fn());
  assert.equal(h.calls.scroll, 0); assert.equal(h.calls.reset, 1);
  assert.equal(h.context.editingAppointmentId, null); assert.equal(h.context.appointmentFormOpen, false);
  assert.equal(h.cards.some(card => card.editing), false);
  assert.equal(h.fields.event_kind.value, 'standard'); assert.equal(h.fields.starts_at.value, '2026-09-17T09:00');
  assert.equal(h.calls.calendar + h.calls.details, 0);
});

test('opening a new form reuses the active calendar and missing appointments do nothing', () => {
  const h = harness(); h.context.editAppointment('missing');
  assert.equal(h.calls.focus, 0); assert.equal(h.frames.length, 0);
  h.context.openAppointmentForm({ forceNew: true });
  assert.equal(h.calls.calendar + h.calls.details, 0); assert.equal(h.context.appointmentFormOpen, true);
});

function persistenceHarness({ mismatch = false, batchFailure = false } = {}) {
  const rows = Array.from({ length: 25 }, (_, i) => ({ id: String(i), starts_at: '2026-09-20T09:00:00Z', ends_at: null }));
  const calls = { upserts: [], synced: [], deletes: [], saves: [] };
  const context = vm.createContext({ rows, calls, suppressRemotePullUntil: 0, SELF_WRITE_ECHO_GRACE_MS: 500,
    isAuthenticated: () => true, appointmentRowForSync: row => ({ ...row }), rowsForCurrentUser: rows => rows,
    validIsoOrNull: value => value ? new Date(value).toISOString() : null,
    markRowsSynced: (_table, rows) => calls.synced.push(...rows),
    deleteRemoteByIds: async (_table, ids) => { calls.deletes.push(...ids); return true; },
    markRemoteDeletesSynced() {}, saveState: options => calls.saves.push(options), console: { warn() {} },
    supabaseClient: { from: () => ({ upsert: rows => ({ select: async () => {
      calls.upserts.push(rows);
      if (batchFailure && rows.length > 1) return { error: new Error('batch failed') };
      return { data: rows.map(row => mismatch && row.id === '0' ? { ...row, starts_at: '2026-09-21T09:00:00Z' } : row) };
    } }) }) }
  });
  vm.runInContext(extract('persistAppointmentEdit'), context);
  return { context, rows, calls };
}

test('series confirmation preserves all IDs, delete confirmation and skip-render persistence', async () => {
  const h = persistenceHarness(); assert.equal(await h.context.persistAppointmentEdit(h.rows, ['old']), true);
  assert.equal(h.calls.upserts.length, 1); assert.equal(h.calls.synced.length, 25);
  assert.equal(h.calls.deletes.join(','), 'old'); assert.equal(h.calls.saves[0].skipRender, true);
});

test('mismatched timestamps stay unsynced and failed batch still retries individual rows', async () => {
  const mismatch = persistenceHarness({ mismatch: true });
  assert.equal(await mismatch.context.persistAppointmentEdit(mismatch.rows), false);
  assert.equal(mismatch.calls.synced.length, 24);
  const fallback = persistenceHarness({ batchFailure: true });
  assert.equal(await fallback.context.persistAppointmentEdit(fallback.rows), true);
  assert.equal(fallback.calls.upserts.length, 26); assert.equal(fallback.calls.synced.length, 25);
});
