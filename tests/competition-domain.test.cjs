const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('../modules/competition-domain.js');
let seq=0;const id=()=>`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`;
const at=d=>Date.parse(d+'T12:00:00+01:00');
const event=(run,kind,payload,time)=>({id:id(),challenge_id:run,kind,payload,occurred_at:new Date(time).toISOString()});
const start=(type,time=at('2026-11-01'),goal=7)=>{const run=id();return event(run,'start',{type,goal},time);};
const check=(s,day,done=true,time=at(day))=>event(s.challenge_id,'check',{day,done},time);
test('invalid dates and malformed events are rejected without throwing',()=>{
 assert.equal(D.validDay('2026-99-99'),false);assert.equal(D.validDay('2026-02-30'),false);assert.equal(D.validDay('2024-02-29'),true);
 assert.equal(D.normalize({}),null);const s=start('bread');assert.equal(D.normalize({...s,kind:'check',payload:{day:'2026-99-99',done:true}}),null);
});
test('smoke timer survives reload, ignores earlier/future entries and closes at first cigarette',()=>{
 const s=start('smoke',at('2026-11-01'),24),now=at('2026-11-03');
 let [r]=D.project(JSON.parse(JSON.stringify([s])),now,{smoke:[at('2026-10-31'),at('2026-11-04')]});
 assert.equal(r.active,true);assert.equal(r.elapsed,2*D.DAY);assert.equal(r.reached,true);
 [r]=D.project([s],now,{smoke:[at('2026-11-02'),now]});assert.equal(r.active,false);assert.equal(r.elapsed,D.DAY);assert.equal(r.needsFinish,true);
 const end=event(s.challenge_id,'finish',{ended_at:new Date(r.endedAt).toISOString(),reason:r.reason},now);
 [r]=D.project([s,end],now+10*D.DAY,{});assert.equal(r.elapsed,D.DAY);assert.equal(r.needsFinish,false);
});
test('daily streak requires confirmation, respects gaps and allows undo',()=>{
 const s=start('bread');const rows=[s,check(s,'2026-11-01'),check(s,'2026-11-02'),check(s,'2026-11-04')];
 let [r]=D.project(rows,at('2026-11-05'));assert.equal(r.current,1);assert.equal(r.best,2);
 [r]=D.project([...rows,check(s,'2026-11-03')],at('2026-11-05'));assert.equal(r.current,4);assert.equal(r.best,4);
 [r]=D.project([...rows,check(s,'2026-11-02',false,at('2026-11-05'))],at('2026-11-05'));assert.equal(r.best,1);
 [r]=D.project(rows,at('2026-11-07'));assert.equal(r.current,0);assert.equal(r.best,2);
});
test('today alcohol intake stops immediately and excludes drinking day',()=>{
 const s=start('alcohol'),rows=[s,check(s,'2026-11-01'),check(s,'2026-11-02')];
 const e=D.evidence({alcoholLogs:[{log_date:'2026-11-02',consumed:true},{log_date:'2026-11-03',consumed:false}]});
 const [r]=D.project(rows,at('2026-11-02'),e);assert.equal(r.active,false);assert.equal(r.reason,'consumption');assert.deepEqual(r.confirmed,['2026-11-01']);
 const [before]=D.project(rows,at('2026-11-01'),e);assert.equal(before.active,true);
});
test('meditation inherits logged days, explicit undo wins and zero duration does not count',()=>{
 const s=start('meditation');const e=D.evidence({habits:[{id:'med',system_key:'meditation'}],habitEntries:[{habit_id:'med',value_num:5,occurred_at:new Date(at('2026-11-01')).toISOString()},{habit_id:'med',value_num:0,occurred_at:new Date(at('2026-11-02')).toISOString()}]});
 assert.equal(D.project([s],at('2026-11-02'),e)[0].current,1);
 assert.equal(D.project([s,check(s,'2026-11-01',false)],at('2026-11-02'),e)[0].current,0);
});
test('day arithmetic remains consecutive over Swiss daylight saving change',()=>{
 const s=start('reading',at('2026-10-24'));const rows=[s,...['2026-10-24','2026-10-25','2026-10-26'].map(d=>check(s,d))];
 assert.equal(D.project(rows,at('2026-10-26'))[0].current,3);
});
test('new attempts preserve independent historical bests and old events cannot change another attempt',()=>{
 const a=start('movement'),b=start('movement',at('2026-11-04'));
 const rows=[a,check(a,'2026-11-01'),check(a,'2026-11-02'),event(a.challenge_id,'finish',{ended_at:new Date(at('2026-11-03')).toISOString()},at('2026-11-03')),b];
 const result=D.project(rows,at('2026-11-05'));assert.equal(result.length,2);assert.equal(result[0].active,true);assert.equal(result[0].best,0);assert.equal(result[1].best,2);
});
