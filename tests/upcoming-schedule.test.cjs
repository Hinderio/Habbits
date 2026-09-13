const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const path = require('node:path');
process.env.TZ = 'Europe/Zurich';
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
function setup() {
  const c = { APPOINTMENT_EVENT_KIND_META_RE: /(?:\r?\n)?<!--hf:event-kind=(birthday|holiday|public_holiday)-->/gi,
    state: { appointments: [] }, selectedCalendarDate: '', calendarCursor: null,
    showScreen(screen) { c.screen = screen; },
    els: { dayDetails: { scrollIntoView() { c.scrolled = true; } } },
    openAppointmentForm(options) { c.formOptions = options; },
    syncAppointmentBirthdayRecurrence() { c.birthdaySync = true; },
    $() { return c.target; }, target: { innerHTML: '' },
    svgIcon: () => '<svg></svg>', appointmentTypeMeta: () => ({label:'Privat'}),
    formatAppointmentRange: () => '10:00–11:00'
  };
  vm.createContext(c);
  for (const name of ['toDateKey','normalizeAppointmentEventKind','appointmentDescriptionMeta','appointmentEventKind',
    'compareAppointments','appointmentInitials','escapeHtml','buildUpcomingSchedule','upcomingDayLabel',
    'renderUpcomingScheduleList','renderUpcomingSchedule','openUpcomingAppointment','createUpcomingAppointment']) {
    const block=source.match(new RegExp('  function '+name+'\\([^]*?\\n  \\}'));
    assert.ok(block,name); vm.runInContext(block[0],c);
  }
  return c;
}
function row(id, start, extra={}) { return {id, title:id, starts_at:start, ...extra}; }
const ids = items => Array.from(items, item=>item.appointment.id);
test('birthdays include today through day 2; appointments include through day 6',()=>{
  const c=setup(),now=new Date('2026-09-13T12:00:00');
  const data=[
    row('today','2026-09-13T00:00:00',{is_birthday:true}),
    row('birthday-last','2026-09-15T23:59:59',{event_kind:'birthday'}),
    row('birthday-out','2026-09-16T00:00:00',{is_birthday:true}),
    row('past','2026-09-12T23:59:59',{is_birthday:true}),
    row('last','2026-09-19T23:59:59'), row('out','2026-09-20T00:00:00')
  ];
  const schedule=c.buildUpcomingSchedule(data,now);
  assert.deepEqual(ids(schedule.birthdays),['today','birthday-last']);
  assert.deepEqual(ids(schedule.appointments),['last']);
});
test('completed appointments disappear; ongoing and multi-day events remain once',()=>{
  const c=setup(),now=new Date('2026-09-13T12:00:00');
  const data=[
    row('ended','2026-09-13T09:00:00',{ends_at:'2026-09-13T11:59:00'}),
    row('past-start','2026-09-13T11:00:00'),
    row('ongoing','2026-09-13T11:00:00',{ends_at:'2026-09-13T13:00:00'}),
    row('trip','2026-09-11T10:00:00',{ends_at:'2026-09-16T10:00:00'}),
    row('later','2026-09-13T15:00:00')
  ];
  const result=c.buildUpcomingSchedule(data,now).appointments;
  assert.deepEqual(ids(result),['trip','ongoing','later']);
  assert.equal(result[0].dateKey,'2026-09-13');
  assert.equal(result[0].ongoing,true);
  assert.equal(result[2].ongoing,false);
});
test('date windows follow local calendar days across both DST changes and New Year',()=>{
  const c=setup();
  for(const [now,last,out] of [
    ['2026-03-28T12:00:00','2026-04-03T23:59:00','2026-04-04T00:00:00'],
    ['2026-10-24T12:00:00','2026-10-30T23:59:00','2026-10-31T00:00:00'],
    ['2026-12-30T12:00:00','2027-01-05T23:59:00','2027-01-06T00:00:00']
  ]) assert.deepEqual(ids(c.buildUpcomingSchedule([row('last',last),row('out',out)],new Date(now)).appointments),['last']);
  assert.equal(c.upcomingDayLabel('2027-01-01',new Date('2026-12-30T12:00:00')),'Übermorgen');
});
test('existing materialized recurring rows and legacy birthday markers are respected',()=>{
  const c=setup();
  const data=[
    row('previous','2025-09-14T00:00:00',{series_id:'s',recurrence:'yearly',is_birthday:true}),
    row('current','2026-09-14T00:00:00',{series_id:'s',recurrence:'yearly',description:'Note\n<!--hf:event-kind=birthday-->'}),
    row('next','2027-09-14T00:00:00',{series_id:'s',recurrence:'yearly',is_birthday:true}),
    row('weekly','2026-09-16T14:00:00',{series_id:'w',recurrence:'weekly'})
  ];
  const result=c.buildUpcomingSchedule(data,new Date('2026-09-13T12:00:00'));
  assert.deepEqual(ids(result.birthdays),['current']);
  assert.deepEqual(ids(result.appointments),['weekly']);
});
test('invalid entries are ignored and repeated ids are not shown twice',()=>{
  const c=setup(),a=row('one','2026-09-14T10:00:00');
  const result=c.buildUpcomingSchedule([null,{id:'missing'},row('bad','invalid'),a,a],new Date('2026-09-13T12:00:00'));
  assert.deepEqual(ids(result.appointments),['one']);
});
test('birthday windows handle local dates rather than UTC dates',()=>{
  const c=setup();
  const result=c.buildUpcomingSchedule([
    row('local-today','2026-09-12T22:30:00Z',{is_birthday:true}),
    row('local-out','2026-09-15T22:00:00Z',{is_birthday:true})
  ],new Date('2026-09-13T12:00:00'));
  assert.deepEqual(ids(result.birthdays),['local-today']);
});
test('render groups entries by date, escapes content and offers readable empty states',()=>{
  const c=setup(),now=new Date('2026-09-13T12:00:00');
  const entries=c.buildUpcomingSchedule([row('one','2026-09-14T10:00:00',{title:'<script>alert(1)</script>',location:'A & B'})],now).appointments;
  const html=c.renderUpcomingScheduleList(entries,false,now);
  assert.match(html,/Morgen/);assert.match(html,/data-date="2026-09-14"/);
  assert.match(html,/&lt;script&gt;/);assert.match(html,/A &amp; B/);
  assert.doesNotMatch(html,/<script>/);
  assert.match(c.renderUpcomingScheduleList([],true,now),/Keine Geburtstage/);
  assert.match(c.renderUpcomingScheduleList([],false,now),/Keine anstehenden Termine/);
});
test('opening an entry selects its calendar day without mutating appointments',()=>{
  const c=setup();c.state.appointments=[row('one','2026-12-31T10:00:00')];
  c.openUpcomingAppointment('one','2026-12-31');
  assert.equal(c.screen,'calendar');assert.equal(c.selectedCalendarDate,'2026-12-31');assert.equal(c.scrolled,true);
  assert.equal(c.calendarCursor.getMonth(),11);
  c.screen='upcoming';c.openUpcomingAppointment('deleted','2026-12-31');assert.equal(c.screen,'upcoming');
});
test('creation reuses calendar form and sets birthday recurrence only for birthdays',()=>{
  const c=setup();c.els.appointmentForm={elements:{is_birthday:{checked:false}}};
  c.createUpcomingAppointment(true);
  assert.equal(c.screen,'calendar');assert.equal(c.formOptions.forceNew,true);
  assert.equal(c.els.appointmentForm.elements.is_birthday.checked,true);assert.equal(c.birthdaySync,true);
  c.createUpcomingAppointment(false);assert.equal(c.els.appointmentForm.elements.is_birthday.checked,false);
});
test('navigation, state renders, active clock refresh and offline CSS are integrated',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const worker=fs.readFileSync(path.join(__dirname,'../service-worker.js'),'utf8');
  assert.match(html,/data-target="upcoming"/);assert.match(html,/id="screen-upcoming"/);
  assert.match(html,/modules\/upcoming-schedule.css/);assert.match(worker,/\.\/modules\/upcoming-schedule.css/);
  assert.match(source,/renderSection\('upcoming-schedule', renderUpcomingSchedule\)/);
  assert.match(source,/targetScreen === 'upcoming'\) renderUpcomingSchedule/);
  assert.match(source,/activeScreen === 'upcoming'\) renderUpcomingSchedule/);
});
