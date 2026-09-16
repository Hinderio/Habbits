const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { analyze, dateKey, day } = require('../modules/life-coach.js');
const now = new Date(2026, 8, 13, 12);
const at = (offset, hour = 10) => new Date(2026, 8, 13 + offset, hour).toISOString();
const key = offset => dateKey(at(offset));
const h = (id = 'h', extra = {}) => ({ id, name: id, type: 'number', target_period: 'day', ...extra });
const entry = (offset, extra = {}) => ({ habit_id: 'h', occurred_at: at(offset), value_num: 1, ...extra });
const byId = (model, id) => model.cards.find(c => c.id === id);

test('empty state is honest about missing consumption data and never manufactures risk scores', () => {
  const m = analyze({}, {}, now);
  assert.equal(m.consumption.alcoholTodayKnown, false);
  assert.equal(m.consumption.knownRecent, 0);
  assert.equal(m.habits.length, 0);
  assert.doesNotMatch(JSON.stringify(m), /Risiko|alkoholfrei/);
});
test('overdue tasks lead; completed, archived and distant tasks are excluded', () => {
  const m = analyze({ tasks: [
    { id: 'late', title: 'Rechnung', due_at: at(-2), steps: [{title: 'Erledigt', done: true}, {title: 'Beleg suchen'}] },
    { id: 'future', due_at: at(8) }, { id: 'done', status: 'done' }, { id: 'archived', is_archived: true },
    { id: 'today', due_at: at(0) }, {id: 'backlog'}
  ] }, {}, now);
  assert.equal(m.cards[0].id, 'agenda:task:late');
  assert.match(m.cards[0].body, /Beleg suchen/);
  assert.ok(byId(m, 'agenda:task:backlog'));
  assert.ok(!byId(m, 'agenda:task:done') && !byId(m, 'agenda:task:future') && !byId(m, 'agenda:task:archived'));
});
test('birthdays stay visible all day; completed appointments do not; materialized series are not duplicated', () => {
  const m = analyze({ appointments: [
    { id: 'birthday', title: 'Anna', starts_at: at(0, 0), is_birthday: true, recurrence: 'yearly' },
    { id: 'past', starts_at: at(0, 8), ends_at: at(0, 9) },
    { id: 'ongoing', starts_at: at(-1), ends_at: at(1) },
    { id: 'oldBirthday', starts_at: at(-365), is_birthday: true },
    { id: 'next', starts_at: at(3) }
  ] }, {}, now);
  assert.match(byId(m, 'agenda:appointment:birthday').evidence, /Geburtstag/);
  assert.equal(byId(m, 'agenda:appointment:ongoing').action.day, key(0));
  assert.ok(!byId(m, 'agenda:appointment:past') && !byId(m, 'agenda:appointment:oldBirthday'));
  assert.equal(m.cards.filter(c=>c.category==='agenda').length, 3);
});
test('local calendar dates handle DST and Swiss voucher dates, rejecting impossible dates', () => {
  assert.equal(day(new Date(2026, 2, 30, 0)) - day(new Date(2026, 2, 29, 0)), 1);
  assert.equal(day('13.09.2026'), day(now));
  assert.equal(day('31.02.2026'), null);
  assert.equal(day('2026-02-31'), null);
  assert.equal(day(null), null);
  assert.equal(dateKey(new Date(2026, 8, 13, 0, 5)), '2026-09-13');
});
test('habit decline counts distinct active days, excludes today from comparisons and ignores false boolean logs', () => {
  const m = analyze({ habits: [h('h', {type:'boolean'})], habitEntries: [
    ...[-14,-13,-12,-11].map(d=>entry(d,{value_bool:true})),
    entry(-3,{value_bool:true}), entry(-3,{value_bool:true}), entry(-2,{value_bool:false}), entry(0,{value_bool:true})
  ] }, {}, now);
  assert.equal(m.habits[0].previous, 4);
  assert.equal(m.habits[0].recent, 1);
  assert.equal(m.habits[0].reached, true);
});
test('weekly and monthly habits are not treated as missed daily habits', () => {
  const m = analyze({ habits: [h('week',{target_period:'week',target:3}), h('month',{target_period:'month',target:4})],
    habitEntries:[entry(-2,{habit_id:'week',value_num:3}), entry(-15,{habit_id:'month',value_num:4})] }, {}, now);
  assert.ok(m.habits.every(h=>h.reached));
  assert.ok(m.cards.filter(c=>c.category==='habits').every(c=>c.tag==='Ziel erreicht'));
});
test('decrease and weight habits never recommend increasing recorded values', () => {
  const m = analyze({ habits:[h('h',{type:'weight',direction:'decrease',target:80})], habitEntries:[entry(0,{value_num:78})] }, {}, now);
  assert.equal(m.habits[0].reached,true);
  assert.match(byId(m,'habits:h').body,/Check-in/);
});
test('paused and archived habits are omitted; paused, deleted and future logs do not affect trends', () => {
  const m=analyze({ habits:[h(),h('paused'),h('archived',{is_archived:true})],
    habitEntries:[entry(-2),entry(-1,{deleted_at:at(0)}),entry(1),entry(-10)],
    pausePeriods:[{scope:'habit',target_id:'h',starts_at:at(-3),ends_at:at(-1)}, {scope:'habit',target_id:'paused',starts_at:at(-1)}]
  },{},now);
  assert.equal(m.habits.length,1);
  assert.equal(m.habits[0].gap,10);
  assert.equal(m.habits[0].recent,0);
});
test('smoking uses two completed seven-day windows and a separate today count', () => {
  const m=analyze({cigarettes:[-14,-8,-7,-1,0,1].map(d=>({smoked_at:at(d)})).concat({smoked_at:'invalid'})},{},now);
  assert.equal(m.consumption.smokePrevious,2);
  assert.equal(m.consumption.smokeRecent,2);
  assert.equal(m.consumption.smokeToday,1);
});
test('alcohol deduplicates events and daily logs, respects explicit no-consumption and tracks unknown days', () => {
  const m=analyze({alcoholLogs:[{log_date:key(-1),consumed:true,consumption_key:'heavy'},{log_date:key(-2),consumed:false},{log_date:key(0),consumed:false}],
    alcoholUnits:[{occurred_at:at(-1)},{occurred_at:at(-1,11)},{occurred_at:at(-3)},{occurred_at:at(1)}]}, {}, now);
  assert.equal(m.consumption.alcoholRecent,2);
  assert.equal(m.consumption.knownRecent,3);
  assert.equal(m.consumption.elevated,1);
  assert.equal(m.consumption.alcoholTodayKnown,true);
  assert.equal(m.consumption.alcoholToday,false);
});
test('voucher and contract dates get actionable list links; done and archived notes stay excluded', () => {
  const m=analyze({}, {lists:[{id:'v',type:'voucher',title:'Gutscheine'},{id:'s',type:'subscription',title:'Abos'}],items:[
    {id:'voucher',listId:'v',title:'Buchladen',metadata:{metaB:'14.09.2026'}},
    {id:'subscription',listId:'s',metadata:{contractEnd:'2026-09-20'}},
    {id:'done',listId:'v',isDone:true}, {id:'archived',listId:'v',isArchived:true}
  ]},now);
  assert.equal(byId(m,'lists:voucher').action.itemId,'voucher');
  assert.match(byId(m,'lists:voucher').evidence,/Ablauf/);
  assert.match(byId(m,'lists:subscription').evidence,/Vertragsende/);
  assert.equal(m.cards.filter(c=>c.category==='lists').length,2);
});
test('weekly notes exclude future, old, carried and promoted notes', () => {
  const metadata = {weekStart:'2026-09-07'};
  const m=analyze({}, {lists:[{id:'weekly',title:'Wochenzettel'}],items:[
    {id:'yes',listId:'weekly',title:'Kamera mitnehmen',metadata},
    {id:'carried',listId:'weekly',metadata:{...metadata,carriedToId:'other'}},
    {id:'promoted',listId:'weekly',metadata:{...metadata,promotedTaskId:'task'}},
    {id:'future',listId:'weekly',metadata:{weekStart:'2026-09-14'}},
    {id:'old',listId:'weekly',metadata:{weekStart:'2026-08-17'}}
  ]},now);
  const card=byId(m,'lists:group:weekly');
  assert.match(card.body,/1 offene Notiz/);
  assert.equal(card.action.itemId,'yes');
});
test('analysis does not mutate application or list state', () => {
  const s={habits:[h()],habitEntries:[entry(-1),entry(-8)],tasks:[{id:'t'}]}, l={lists:[],items:[]};
  const before=JSON.stringify({s,l});
  analyze(s,l,now); analyze(s,l,now);
  assert.equal(JSON.stringify({s,l}),before);
});

test('modal refresh is lazy, coalesced and cancelled when closed; rendering escapes user input', () => {
  const handlers={}, frames=new Map(), intervals=new Map();let id=0, snapshots=0;
  const cls=new Set(['hidden']);
  const modal={classList:{contains:k=>cls.has(k),add:k=>cls.add(k),remove:k=>cls.delete(k)},addEventListener:(k,f)=>handlers[k]=f};
  const content={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]};
  const closeButton={focus:()=>{},dataset:{}};
  const document={hidden:false,activeElement:closeButton,body:{classList:{add(){},remove(){}}},
    getElementById:id=>({coachModal:modal,lifeCoachContent:content,coachCloseBtn:closeButton,coachDialog:{addEventListener:(k,f)=>handlers[k]=f}})[id],
    addEventListener(){},querySelector(){return null;}};
  const window={document,requestAnimationFrame:f=>{frames.set(++id,f);return id;},cancelAnimationFrame:i=>frames.delete(i),setInterval:f=>{intervals.set(++id,f);return id;},clearInterval:i=>intervals.delete(i),addEventListener(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../modules/life-coach.js'),'utf8'),{window,Date,Set,Map});
  const coach=window.HabitFlowCoach;
  coach.refresh(); assert.equal(frames.size,0);
  coach.open({snapshot:()=>{snapshots++;return {tasks:[{id:'t',title:'<img src=x onerror=alert(1)>'}]};}});
  coach.refresh();coach.refresh();assert.equal(frames.size,1);
  const cb=frames.values().next().value;frames.clear();cb();
  assert.equal(snapshots,1);
  assert.ok(content.innerHTML.includes('&lt;img'));
  assert.ok(!content.innerHTML.includes('<img src=x'));
  assert.equal(intervals.size,0);
  handlers.click({target:{closest:()=>({dataset:{lcFilter:'agenda'}})}});
  assert.match(content.innerHTML,/Nächste 3 Tage · inklusive heute/);
  assert.match(content.innerHTML,/Nächste 7 Tage · inklusive heute/);
  assert.match(content.innerHTML,/lc-agenda-tasks/);
  coach.refresh();coach.close();assert.equal(frames.size,0);
  coach.refresh();assert.equal(snapshots,1);
});

test('app integration delegates navigation to existing detail and calendar functions', () => {
  const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
  const block=source.slice(source.indexOf('  function openCoachModal() {'),source.indexOf('\n  function render() {',source.indexOf('  function openCoachModal() {')));
  const calls=[]; let bridge;
  const context={els:{coachModal:{}},window:{HabitFlowCoach:{open:b=>bridge=b,close:()=>calls.push('close')},HabitFlowListsCoach:{open:(...args)=>calls.push(['list',...args])}},state:{tasks:[]},showScreen:s=>calls.push(s),openTaskDetail:id=>calls.push(['task',id]),openHistoryModal:(...args)=>calls.push(args),switchConsumptionMode:s=>calls.push(['mode',s]),selectedCalendarDate:null,calendarCursor:null,Date,requestAnimationFrame:()=>{}};
  vm.createContext(context);vm.runInContext(block+'\nopenCoachModal();',context);
  assert.equal(bridge.snapshot(),context.state);
  for(const action of [{type:'task',id:'t'},{type:'habit',id:'h'},{type:'calendar',day:'2026-10-01'},{type:'list',id:'v',itemId:'i'},{type:'alcohol'}]) bridge.navigate(action);
  assert.ok(calls.includes('tasks') && calls.includes('calendar') && calls.includes('lists'));
  assert.equal(context.selectedCalendarDate,'2026-10-01');
  assert.equal(context.calendarCursor.getMonth(),9);
  assert.deepEqual(calls.at(-2),['mode','alcohol']);
});


test('Coach Agenda limits birthdays to today plus two days and appointments to today plus six', () => {
  const appointments = [
    {id:'birthday-today',starts_at:at(0,0),is_birthday:true},
    {id:'birthday-last',starts_at:at(2,23),is_birthday:true},
    {id:'birthday-out',starts_at:at(3,0),is_birthday:true},
    {id:'appointment-last',starts_at:at(6,23)},
    {id:'appointment-out',starts_at:at(7,0)},
    {id:'deleted',starts_at:at(1),deleted_at:at(0)},
    {id:'archived',starts_at:at(1),is_archived:true}
  ];
  const m=analyze({appointments},{},now);
  const ids=m.cards.filter(c=>c.category==='agenda').map(c=>c.id).sort();
  assert.deepEqual(ids,[
    'agenda:appointment:appointment-last',
    'agenda:appointment:birthday-last',
    'agenda:appointment:birthday-today'
  ]);
});

test('Coach recognizes all birthday markers without extending past birthdays across multiple days', () => {
  const m=analyze({appointments:[
    {id:'flag',starts_at:at(1),is_birthday:true},
    {id:'kind',starts_at:at(1),event_kind:'birthday'},
    {id:'meta',starts_at:at(2),description:'Notiz\n<!--hf:event-kind=birthday-->'},
    {id:'old',starts_at:at(-1),ends_at:at(1),is_birthday:true},
    {id:'meta-out',starts_at:at(3),description:'<!--hf:event-kind=birthday-->'}
  ]},{},now);
  for(const id of ['flag','kind','meta']) assert.match(byId(m,'agenda:appointment:'+id).evidence,/Geburtstag/);
  assert.ok(!byId(m,'agenda:appointment:old'));
  assert.ok(!byId(m,'agenda:appointment:meta-out'));
});

test('Coach keeps ongoing appointments and removes ended multi-day appointments', () => {
  const m=analyze({appointments:[
    {id:'ended',starts_at:at(-1),ends_at:at(0,11)},
    {id:'ongoing',starts_at:at(-1),ends_at:at(0,13)},
    {id:'invalid',starts_at:'invalid'},
    {id:'missing'}
  ]},{},now);
  const cards=m.cards.filter(c=>c.category==='agenda');
  assert.equal(cards.length,1);
  assert.equal(cards[0].id,'agenda:appointment:ongoing');
  assert.equal(cards[0].action.day,key(0));
});

test('Coach horizons follow local days across New Year and both DST transitions', () => {
  for(const anchor of [new Date(2026,11,30,12),new Date(2026,2,28,12),new Date(2026,9,24,12)]) {
    const relative=(offset,hour=0)=>new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate()+offset,hour).toISOString();
    const m=analyze({appointments:[
      {id:'birthday-in',starts_at:relative(2,23),is_birthday:true},
      {id:'birthday-out',starts_at:relative(3),is_birthday:true},
      {id:'appointment-in',starts_at:relative(6,23)},
      {id:'appointment-out',starts_at:relative(7)}
    ]},{},anchor);
    assert.ok(byId(m,'agenda:appointment:birthday-in'));
    assert.ok(byId(m,'agenda:appointment:appointment-in'));
    assert.ok(!byId(m,'agenda:appointment:birthday-out'));
    assert.ok(!byId(m,'agenda:appointment:appointment-out'));
  }
});

test('Coach uses existing yearly instances and never mutates appointment or task data', () => {
  const appointments=[
    {id:'prior',series_id:'s',recurrence:'yearly',starts_at:at(-365),is_birthday:true},
    {id:'current',series_id:'s',recurrence:'yearly',starts_at:at(1),is_birthday:true},
    {id:'future',series_id:'s',recurrence:'yearly',starts_at:at(366),is_birthday:true}
  ].map(Object.freeze);
  const state=Object.freeze({appointments:Object.freeze(appointments),tasks:Object.freeze([{id:'task',due_at:at(7)}])});
  const before=JSON.stringify(state);
  const m=analyze(state,{},now);
  assert.equal(m.cards.filter(c=>c.id.startsWith('agenda:appointment:')).length,1);
  assert.ok(byId(m,'agenda:task:task'),'task horizon is unchanged');
  assert.equal(JSON.stringify(state),before);
});

test('standalone birthdays screen and navigation overrides are fully removed', () => {
  const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const worker=fs.readFileSync(path.join(__dirname,'../service-worker.js'),'utf8');
  const coachCss=fs.readFileSync(path.join(__dirname,'../modules/life-coach.css'),'utf8');
  assert.doesNotMatch(app,/buildUpcomingSchedule|renderUpcomingSchedule|openUpcomingAppointment|createUpcomingAppointment/);
  assert.doesNotMatch(html,/screen-upcoming|data-target="upcoming"|upcoming-schedule/);
  assert.doesNotMatch(worker,/upcoming-schedule/);
  assert.doesNotMatch(coachCss,/bottom-nav|nav-btn/);
  assert.equal(fs.existsSync(path.join(__dirname,'../modules/upcoming-schedule.css')),false);
  assert.match(html,/id="lifeCoachContent"/);
});


function agendaUi(state) {
  const handlers = {}, frames = new Map(), calls = [];
  let frameId = 0;
  const classes = new Set(['hidden']);
  const modal = {classList:{contains:k=>classes.has(k),add:k=>classes.add(k),remove:k=>classes.delete(k)},addEventListener:(key,fn)=>handlers[key]=fn};
  const content = {innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]};
  const closeButton = {dataset:{},focus(){}};
  const document = {hidden:false,activeElement:closeButton,body:{classList:{add(){},remove(){}}},
    getElementById:id=>({coachModal:modal,lifeCoachContent:content,coachCloseBtn:closeButton,coachDialog:{addEventListener:(key,fn)=>handlers[key]=fn}})[id],
    addEventListener(){},querySelector(){return null;}};
  const window = {document,requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id),setInterval(){},clearInterval(){},addEventListener(){}};
  class Clock extends Date { constructor(...args) { super(...(args.length?args:[+now])); } static now(){return +now;} }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../modules/life-coach.js'),'utf8'),{window,Date:Clock,Set,Map});
  const coach=window.HabitFlowCoach;
  const flush=()=>{const queued=[...frames.values()];frames.clear();queued.forEach(fn=>fn());};
  const click=dataset=>handlers.click({target:{closest:()=>({dataset})}});
  const open=()=>{coach.open({snapshot:()=>state,navigate:action=>calls.push(action)});flush();};
  open();
  return {coach,open,click,flush,calls,html:()=>content.innerHTML,group:key=>{
    const start=content.innerHTML.indexOf('<section class="lc-agenda-group" aria-labelledby="lc-agenda-'+key+'">');
    assert.ok(start>=0,key);
    return content.innerHTML.slice(start,content.innerHTML.indexOf('</section>',start)+10);
  }};
}

test('agenda group identity follows event metadata, not title or label text',()=>{
  const m=analyze({tasks:[{id:'task',title:'Geburtstag planen'}],appointments:[
    {id:'birth',title:'Alex',starts_at:at(1),description:'<!--hf:event-kind=birthday-->'},
    {id:'meeting',title:'Geburtstag planen',starts_at:at(1)}
  ]},{},now);
  assert.equal(byId(m,'agenda:task:task').agendaGroup,'tasks');
  assert.equal(byId(m,'agenda:appointment:birth').agendaGroup,'birthdays');
  assert.equal(byId(m,'agenda:appointment:meeting').agendaGroup,'appointments');
  assert.ok(m.cards.filter(c=>c.category!=='agenda').every(c=>!c.agendaGroup));
});

test('many urgent tasks cannot crowd birthdays and appointments out of Agenda',()=>{
  const ui=agendaUi({tasks:Array.from({length:20},(_,i)=>({id:'t'+i,title:'Task '+i,due_at:at(-2)})),
    appointments:[{id:'b',title:'Anna',starts_at:at(1),is_birthday:true},{id:'a',title:'Meeting',starts_at:at(1)}]});
  assert.doesNotMatch(ui.html(),/lc-agenda-groups/,'overview keeps its existing top recommendations');
  ui.click({lcFilter:'agenda'});
  assert.ok(ui.html().indexOf('aria-labelledby="lc-agenda-birthdays"')<ui.html().indexOf('aria-labelledby="lc-agenda-appointments"'));
  assert.ok(ui.html().indexOf('aria-labelledby="lc-agenda-appointments"')<ui.html().indexOf('aria-labelledby="lc-agenda-tasks"'));
  assert.match(ui.group('birthdays'),/<h5>Anna<\/h5>/);
  assert.match(ui.group('appointments'),/<h5>Meeting<\/h5>/);
  assert.doesNotMatch(ui.group('birthdays'),/data-lc-open="agenda:task/);
  assert.equal((ui.group('tasks').match(/data-lc-open=/g)||[]).length,4);
  assert.match(ui.group('tasks'),/4 von 20 angezeigt/);
  assert.match(ui.group('tasks'),/aria-label="20 sichtbare Hinweise"/);
});

test('each Agenda group paginates independently and resets on reopening',()=>{
  const ui=agendaUi({tasks:Array.from({length:10},(_,i)=>({id:'t'+i,title:'Task '+i})),
    appointments:Array.from({length:6},(_,i)=>({id:'b'+i,title:'Birthday '+i,starts_at:at(1),is_birthday:true}))});
  ui.click({lcFilter:'agenda'});
  ui.click({lcAgendaMore:'tasks'});
  assert.equal((ui.group('tasks').match(/data-lc-open=/g)||[]).length,8);
  assert.equal((ui.group('birthdays').match(/data-lc-open=/g)||[]).length,4);
  ui.click({lcAgendaMore:'birthdays'});
  assert.equal((ui.group('birthdays').match(/data-lc-open=/g)||[]).length,6);
  assert.doesNotMatch(ui.group('birthdays'),/data-lc-agenda-more/);
  ui.click({lcAgendaMore:'tasks'});
  assert.equal((ui.group('tasks').match(/data-lc-open=/g)||[]).length,10);
  ui.coach.close();ui.open();ui.click({lcFilter:'agenda'});
  assert.equal((ui.group('tasks').match(/data-lc-open=/g)||[]).length,4);
  assert.equal((ui.group('birthdays').match(/data-lc-open=/g)||[]).length,4);
});

test('empty groups remain visible; dismiss and restore update their counts and explanation',()=>{
  const ui=agendaUi({appointments:[{id:'b',title:'Anna',starts_at:at(1),is_birthday:true}]});
  ui.click({lcFilter:'agenda'});
  assert.match(ui.group('appointments'),/Keine anstehenden Termine/);
  assert.match(ui.group('tasks'),/Keine offenen Tasks/);
  ui.click({lcDismiss:'agenda:appointment:b'});
  assert.match(ui.group('birthdays'),/aria-label="0 sichtbare Hinweise"/);
  assert.match(ui.group('birthdays'),/1 ausgeblendet/);
  assert.match(ui.group('birthdays'),/für diese Sitzung ausgeblendet/);
  assert.doesNotMatch(ui.group('birthdays'),/Keine Geburtstage/);
  ui.click({lcRestore:''});
  assert.match(ui.group('birthdays'),/aria-label="1 sichtbare Hinweise"/);
  assert.match(ui.group('birthdays'),/<h5>Anna<\/h5>/);
  assert.doesNotMatch(ui.group('birthdays'),/1 ausgeblendet/);
});

test('grouped actions retain calendar navigation and escape user content',()=>{
  const ui=agendaUi({appointments:[{id:'b',title:'<img onerror="alert(1)">',starts_at:at(1),is_birthday:true}]});
  ui.click({lcFilter:'agenda'});
  assert.match(ui.group('birthdays'),/&lt;img/);
  assert.doesNotMatch(ui.group('birthdays'),/<img/);
  ui.click({lcOpen:'agenda:appointment:b'});
  assert.equal(ui.calls.length,1);
  assert.equal(ui.calls[0].type,'calendar');
  assert.equal(ui.calls[0].day,key(1));
});

test('dated backlog tasks share existing deadline priorities and task detail navigation', () => {
  const tasks = [-30, -1, 0, 1, 7, 8].map(offset => ({
    id: `backlog-${offset}`, title: 'Backlog task', status: 'archived', due_at: at(offset),
    steps: [{title:'Already done', done:true},{title:'Unterlagen prüfen'}]
  }));
  tasks.push({id:'board-today', status:'open', due_at:at(0)});
  const before = JSON.stringify(tasks);
  const m = analyze({tasks}, {}, now);
  for (const offset of [-30, -1, 0, 1, 7]) {
    const card = byId(m, `agenda:task:backlog-${offset}`);
    assert.ok(card);
    assert.equal(card.agendaGroup, 'tasks');
    assert.deepEqual(card.action, {type:'task',id:`backlog-${offset}`});
    assert.equal(card.label, 'Task öffnen');
    assert.match(card.tag, /^Backlog · /);
    assert.match(card.body, /ins Board/);
    assert.match(card.body, /Unterlagen prüfen/);
    assert.doesNotMatch(card.body, /Already done/);
    const board = analyze({tasks:[{...tasks.find(t=>t.id===`backlog-${offset}`), status:'open'}]}, {}, now);
    assert.equal(card.score, byId(board,card.id).score);
  }
  assert.ok(!byId(m,'agenda:task:backlog-8'));
  assert.equal(m.cards[0].id,'agenda:task:backlog--30');
  assert.match(byId(m,'agenda:task:backlog-0').tag,/Heute/);
  assert.equal(JSON.stringify(tasks),before);
});

test('undated, invalid, deleted and completed backlog rows stay out of the coach', () => {
  const tasks = [
    {id:'undated', status:'archived'}, {id:'invalid',status:'archived',due_at:'invalid'},
    {id:'impossible',status:'archived',due_at:'2026-02-31'},
    {id:'deleted',status:'archived',due_at:at(-1),deleted_at:at(0)},
    {id:'hidden',status:'archived',due_at:at(-1),is_archived:true},
    {id:'done',status:'done',due_at:at(-1),done_archived_at:at(0)},
    {id:'open',status:'open'}, {id:'progress',status:'in_progress'}
  ];
  const m=analyze({tasks},{},now);
  assert.deepEqual(m.cards.filter(c=>c.category==='agenda').map(c=>c.id).sort(),['agenda:task:open','agenda:task:progress']);
});

test('moving a backlog task into the board retains one recommendation and removes the backlog prompt', () => {
  const task={id:'move',title:'Planen',status:'archived',due_at:at(1)};
  assert.match(byId(analyze({tasks:[task]}, {}, now),'agenda:task:move').tag,/Backlog/);
  task.status='open';
  const m=analyze({tasks:[task]}, {}, now);
  assert.equal(m.cards.filter(c=>c.id==='agenda:task:move').length,1);
  assert.doesNotMatch(byId(m,'agenda:task:move').tag,/Backlog/);
  assert.doesNotMatch(byId(m,'agenda:task:move').body,/Backlog/);
  task.status='done';
  assert.ok(!byId(analyze({tasks:[task]}, {}, now),'agenda:task:move'));
});

test('backlog deadline horizon follows local dates over DST and New Year', () => {
  for (const anchor of [new Date(2026,2,28,12),new Date(2026,9,24,12),new Date(2026,11,30,12)]) {
    const relative = offset => new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate()+offset,23).toISOString();
    const m=analyze({tasks:[{id:'inside',status:'archived',due_at:relative(7)},{id:'outside',status:'archived',due_at:relative(8)}]}, {}, anchor);
    assert.ok(byId(m,'agenda:task:inside'));
    assert.ok(!byId(m,'agenda:task:outside'));
  }
});

test('coach backlog status matches the task app and preserves its existing board action', () => {
  const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
  assert.match(app,/const TASK_BACKLOG_STATUS = 'archived'/);
  const detail=app.slice(app.indexOf('  function renderTaskDetailContent('),app.indexOf('  function openTaskDetail('));
  assert.match(detail,/data-action="move-task" data-status="open"/);
});

test('backlog reminders reuse the existing overview, Agenda cards, dismiss and detail action', () => {
  const ui=agendaUi({tasks:[{id:'dated-backlog',status:'archived',due_at:at(0),title:'<b>Unterlagen</b>'}]});
  assert.match(ui.html(),/Backlog · Heute/);
  ui.click({lcFilter:'agenda'});
  assert.match(ui.group('tasks'),/&lt;b&gt;Unterlagen&lt;\/b&gt;/);
  assert.match(ui.group('tasks'),/ins Board/);
  ui.click({lcDismiss:'agenda:task:dated-backlog'});
  assert.doesNotMatch(ui.group('tasks'),/data-lc-open="agenda:task:dated-backlog"/);
  ui.click({lcRestore:''});
  ui.click({lcOpen:'agenda:task:dated-backlog'});
  assert.equal(ui.calls.length,1);
  assert.equal(ui.calls[0].type,'task');
  assert.equal(ui.calls[0].id,'dated-backlog');
});
