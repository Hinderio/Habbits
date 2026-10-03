const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const before = fs.readFileSync(path.join(__dirname, 'fixtures/calendar-before-render-optimization.js'), 'utf8');
const block = (name, text = source) => {
  const start = text.indexOf('  function ' + name + '(');
  assert.ok(start >= 0, name);
  return text.slice(start, text.indexOf('\n  }', start) + 4);
};
function harness(legacy = false) {
  const counts = { normalized: 0, dates: 0, formatters: 0 };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : ['2026-09-17T10:00:00Z'])); } }
  const state = { appointments: [], tasks: [] };
  const c = vm.createContext({ state, Date: Clock, document: { getElementById: () => null }, calendarEventFilters: new Set(),
    Intl: { DateTimeFormat: function(...args) { counts.formatters++; return new Intl.DateTimeFormat(...args); } },
    calendarCursor: new Clock('2026-09-17T12:00:00'), selectedCalendarDate: '2026-09-17',
    els: { calendarTitle: {}, calendarGrid: {} },
    normalizeTask: row => { counts.normalized++; return { ...row, status: row.status || 'open', priority: row.priority || 'medium' }; },
    normalizeTaskPriority: value => value || 'medium',
    taskPriorityMeta: value => ({ rank: ({ high: 3, medium: 2, low: 1 })[value?.priority || value || 'medium'], label: value?.priority || value || 'medium' }),
    compareTasks: (a,b) => String(a.id).localeCompare(String(b.id)),
    normalizeAppointmentType: type => type || 'other',
    appointmentTypeMeta: () => ({ short: 'PR', label: 'Privat' })
  });
  vm.runInContext("const calendarDateFormatters = new Map(); const APPOINTMENT_EVENT_KIND_META_RE = /(?:\\r?\\n)?<!--hf:event-kind=(birthday|holiday|public_holiday|celebration|visit)-->/gi;", c);
  for (const name of ['toDateKey','escapeHtml','appointmentOccursOnDate','appointmentsOnDate','compareAppointments','isActiveTask',
    'calendarTasksOnDate','calendarBubbleInitials','appointmentInitials','appointmentEventLabel','normalizeAppointmentEventKind',
    'appointmentDescriptionMeta','appointmentEventKind','renderCalendarTaskDots','formatCalendarValue','calendarRowsForDates','calendarEventMatches','renderCalendarEventFilters']) {
    vm.runInContext(block(name),c);
  }
  for (const name of ['renderCalendarContent','renderCalendarAppointmentChips','formatAppointmentRange','formatDateTime','formatTime']) {
    vm.runInContext(block(name,legacy ? before : source),c);
  }
  const dateKey = c.toDateKey;
  c.toDateKey = value => { counts.dates++; return dateKey(value); };
  return { c, state, counts };
}
function seed(state) {
  for (let i = 0; i < 250; i++) {
    const start = new Date(2026, 8, 1 + i % 35, 9 + i % 8).toISOString();
    state.appointments.push({ id: `a${i}`, title: `Termin <${i}>`, starts_at: start,
      ends_at: i % 4 === 0 ? new Date(2026, 8, 5 + i % 35, 10).toISOString() : null,
      event_kind: ['standard','birthday','holiday','public_holiday','celebration','visit'][i % 6] });
    state.tasks.push({ id: `t${i}`, title: `Aufgabe ${i}`, due_at: start,
      status: ['open','in_progress','done','backlog'][i % 4], priority: ['high','medium','low'][i % 3] });
  }
  state.appointments.push(null, { id: 'invalid', starts_at: 'invalid' }, { id: 'backwards', starts_at: '2026-09-30', ends_at: '2026-09-01' },
    { id: 'long', title: 'Lange Ferien', starts_at: '2025-01-01', ends_at: '2028-01-01' });
}

test('month HTML stays byte-identical while tasks normalize once, not 42 times', () => {
  const old = harness(true), fast = harness(); seed(old.state); seed(fast.state);
  old.c.renderCalendarContent(); fast.c.renderCalendarContent();
  assert.equal(fast.c.els.calendarGrid.innerHTML, old.c.els.calendarGrid.innerHTML);
  assert.equal(fast.c.els.calendarTitle.textContent, old.c.els.calendarTitle.textContent);
  assert.equal(old.counts.normalized, old.state.tasks.length * 42);
  assert.equal(fast.counts.normalized, fast.state.tasks.length);
  assert.ok(fast.counts.dates < old.counts.dates / 10);
  const count = fast.counts.formatters; fast.c.renderCalendarContent();
  assert.equal(fast.counts.formatters, count, 'reuse formatters');
});

test('fresh index sees same-array edits, deletions and newly created rows without mutating inputs', () => {
  const old = harness(true), fast = harness(); seed(old.state); seed(fast.state);
  fast.c.renderCalendarContent();
  for (const app of [old, fast]) {
    app.state.appointments[0].starts_at = '2026-10-02T09:00:00Z';
    app.state.appointments[0].ends_at = null;
    app.state.tasks[0].due_at = '2026-10-02T09:00:00Z';
    app.state.tasks[1].status = 'done';
    app.state.appointments.splice(2, 10);
    app.state.appointments.push({id:'new', title:'Einladung', event_kind:'visit', starts_at:'2026-09-18T10:00:00Z'});
  }
  const snapshot = JSON.stringify(fast.state);
  old.c.renderCalendarContent(); fast.c.renderCalendarContent();
  assert.equal(fast.c.els.calendarGrid.innerHTML, old.c.els.calendarGrid.innerHTML);
  assert.equal(JSON.stringify(fast.state), snapshot);
});

test('months spanning daylight saving and leap days preserve cells and appointment range text', () => {
  for (const month of ['2026-03-15T12:00:00','2026-10-15T12:00:00','2024-02-15T12:00:00']) {
    const old = harness(true), fast = harness();
    for (const app of [old,fast]) {
      app.c.calendarCursor = new Date(month);
      app.state.appointments = [{id:'span',title:'Über Monatsgrenze',starts_at:'2024-01-31T23:00:00Z',ends_at:'2026-11-01T23:00:00Z'}];
      app.c.renderCalendarContent();
    }
    assert.equal(fast.c.els.calendarGrid.innerHTML, old.c.els.calendarGrid.innerHTML);
  }
  const old = harness(true), fast = harness();
  for (const row of [{}, {starts_at:'invalid'}, {starts_at:'2026-09-17T08:00:00Z'},
    {starts_at:'2026-03-28T23:00:00Z',ends_at:'2026-03-29T02:00:00Z'},
    {starts_at:'2026-09-17T08:00:00Z',ends_at:'2026-09-19T14:00:00Z'}]) {
    assert.equal(fast.c.formatAppointmentRange(row), old.c.formatAppointmentRange(row));
  }
});

function renderHarness() {
  let next = 0, deferred = false, renders = 0;
  const timers = new Map();
  const c = vm.createContext({ setTimeout: fn => {timers.set(++next,fn);return next;}, clearTimeout: id => timers.delete(id),
    shouldDeferInteractiveRender: () => deferred,
    renderSection: name => { if (name === 'timers') renders++; }
  });
  vm.runInContext('let deferredRenderPending = false; let deferredRenderTimer = null;',c);
  const names = [...block('render').matchAll(/renderSection\('[^']+', (\w+)\)/g)].map(match=>match[1]);
  names.forEach(name=>c[name]=()=>{});
  vm.runInContext(block('render')+'\n'+block('flushDeferredRender'),c);
  return { c, timers, get renders(){return renders;}, pending(){vm.runInContext('deferredRenderPending=true',c);},
    defer(value){deferred=value;}, flush(){const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());} };
}

test('many blur/change events share one delayed render', () => {
  const app=renderHarness();app.pending();
  for(let i=0;i<20;i++)app.c.flushDeferredRender();
  assert.equal(app.timers.size,1);app.flush();assert.equal(app.renders,1);
  app.c.flushDeferredRender();assert.equal(app.timers.size,0);
});

test('full render consumes pending work and editing keeps deferred work pending', () => {
  const app=renderHarness();app.pending();app.c.flushDeferredRender();app.c.render();
  assert.equal(app.timers.size,0);assert.equal(app.renders,1);
  app.pending();app.defer(true);app.c.flushDeferredRender();app.flush();assert.equal(app.renders,1);
  app.defer(false);app.c.flushDeferredRender();app.flush();assert.equal(app.renders,2);
});

test('event filters support multiple types, legacy birthdays and an unchanged task layer', () => {
  const app=harness(); seed(app.state);
  app.state.appointments.push({id:'legacy',title:'Legacy birthday',description:'<!--hf:event-kind=birthday-->',starts_at:'2026-09-17T10:00:00'});
  const snapshot=JSON.stringify(app.state);
  app.c.calendarEventFilters.add('birthday');app.c.calendarEventFilters.add('visit');
  const expected=harness();expected.state.tasks=app.state.tasks;
  expected.state.appointments=app.state.appointments.filter(a=>a && ['birthday','visit'].includes(app.c.appointmentEventKind(a)));
  app.c.renderCalendarContent();expected.c.renderCalendarContent();
  assert.equal(app.c.els.calendarGrid.innerHTML,expected.c.els.calendarGrid.innerHTML);
  assert.equal(JSON.stringify(app.state),snapshot);
  assert.equal(app.counts.normalized,app.state.tasks.length);
});

test('monthly filter totals count spanning appointments once and exclude adjacent-month-only rows', () => {
  const app=harness(),root={};app.c.document.getElementById=()=>root;
  vm.runInContext(block('calendarEventFilterTypes'),app.c);
  app.state.appointments=[
    {id:'span',title:'Ferien',event_kind:'holiday',starts_at:'2026-08-28T12:00:00',ends_at:'2026-09-20T12:00:00'},
    {id:'visit',title:'Besuch',event_kind:'visit',starts_at:'2026-09-20T12:00:00'},
    {id:'next',title:'Oktober',event_kind:'visit',starts_at:'2026-10-02T12:00:00'}
  ];
  app.c.calendarEventFilters.add('holiday');app.c.renderCalendarContent();
  assert.match(root.innerHTML,/1 von 2 Terminen im Monat/);
  assert.match(root.innerHTML,/data-event-kind="holiday" aria-pressed="true"/);
  assert.match(root.innerHTML,/data-event-kind="standard" aria-pressed="false"/);
  app.state.appointments.splice(0,1);app.c.renderCalendarContent();
  assert.match(root.innerHTML,/0 von 1 Terminen im Monat/);
  assert.match(root.innerHTML,/data-event-kind="holiday" aria-pressed="true"/);
});

test('selection toggles, last deselection and All restore all types and focus', () => {
  const app=harness();let month=0,day=0,focused='';
  app.c.renderCalendar=()=>month++;app.c.renderDayDetails=()=>day++;
  app.c.document.querySelectorAll=()=>['','holiday','visit'].map(kind=>({dataset:{eventKind:kind},focus:()=>focused=kind}));
  for(const name of ['calendarEventFilterTypes','toggleCalendarEventFilter'])vm.runInContext(block(name),app.c);
  app.c.toggleCalendarEventFilter('holiday');app.c.toggleCalendarEventFilter('visit');
  assert.equal(app.c.calendarEventFilters.size,2);assert.equal(focused,'visit');
  app.c.toggleCalendarEventFilter('holiday');app.c.toggleCalendarEventFilter('visit');
  assert.equal(app.c.calendarEventFilters.size,0);
  app.c.toggleCalendarEventFilter('holiday');app.c.toggleCalendarEventFilter('');
  assert.equal(app.c.calendarEventFilters.size,0);assert.equal(focused,'');
  app.c.toggleCalendarEventFilter('invalid');assert.equal(month,6);assert.equal(day,6);
});

test('day details apply the same event selection without hiding other entries', () => {
  const app=harness();Object.assign(app.c,{
    cigarettesOnDate:()=>[],alcoholForDate:()=>null,alcoholUnitsOnDate:()=>[],morningRoutineCompletedLog:()=>null,
    renderAppointmentDetailCard:a=>`<article>${a.title}</article>`,TASK_COLUMNS:[{status:'open',title:'Offen'}]
  });
  app.c.els.selectedDateTitle={};app.c.els.dayDetails={};
  app.state.appointments=[{id:'a',title:'Besuch',event_kind:'visit',starts_at:'2026-09-17T12:00:00'}, {id:'b',title:'Ferien',event_kind:'holiday',starts_at:'2026-09-17T12:00:00'}];
  app.state.tasks=[{id:'task',title:'Task bleibt',status:'open',due_at:'2026-09-17T12:00:00'}];
  vm.runInContext(block('renderDayDetails'),app.c);app.c.calendarEventFilters.add('visit');app.c.renderDayDetails();
  assert.match(app.c.els.dayDetails.innerHTML,/Besuch/);assert.match(app.c.els.dayDetails.innerHTML,/Task bleibt/);assert.doesNotMatch(app.c.els.dayDetails.innerHTML,/Ferien/);
  app.state.tasks=[];app.c.calendarEventFilters.clear();app.c.calendarEventFilters.add('birthday');app.c.renderDayDetails();
  assert.match(app.c.els.dayDetails.innerHTML,/Event-Typ-Auswahl/);
});
