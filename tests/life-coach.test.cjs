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
