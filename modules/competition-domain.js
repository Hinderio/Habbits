(function (root) {
  'use strict';
  const TYPES = Object.freeze({
    smoke: { title: 'Rauchfrei', category: 'Konsum', mode: 'timer', icon: 'smoke', color: '#43b9b2', goal: 24, unit: 'Stunden', description: 'Starte jetzt. Jede Minute ohne Zigarette zählt.', rule: 'Ein neuer Rauch-Eintrag beendet den Versuch automatisch. Deine Konsumdaten bleiben vollständig erhalten.' },
    alcohol: { title: 'Alkoholfreie Tage', category: 'Konsum', mode: 'daily', icon: 'alcohol', color: '#6495ce', goal: 7, unit: 'Tage', description: 'Bewusst alkoholfrei. Ein bestätigter Tag nach dem anderen.', rule: 'Bestätige abgeschlossene alkoholfreie Tage. Ein Alkoholeintrag beendet den Versuch.' },
    bread: { title: 'Ohne Brot', category: 'Ernährung', mode: 'daily', icon: 'food', color: '#d5a352', goal: 7, unit: 'Tage', description: 'Dein persönliches Ernährungsexperiment.', rule: 'Bestätige einen Tag, wenn du an diesem Tag kein Brot gegessen hast. Ein ausgelassener Tag zählt nicht.' },
    meditation: { title: 'Meditation', category: 'Balance', mode: 'daily', icon: 'meditation', color: '#a78bc9', goal: 7, unit: 'Tage', description: 'Täglich ein bewusster Moment für dich.', rule: 'Meditations-Logs aus deinen Habits werden übernommen. Du kannst auch selbst einen Tag bestätigen.' },
    movement: { title: 'Täglich bewegen', category: 'Bewegung', mode: 'daily', icon: 'hiking', color: '#6aaf8d', goal: 7, unit: 'Tage', description: 'Mindestens 20 Minuten bewusste Bewegung.', rule: 'Bestätige Tage mit mindestens 20 Minuten Bewegung. Entscheidend ist die Regelmäßigkeit.' },
    reading: { title: 'Leseroutine', category: 'Fokus', mode: 'daily', icon: 'book', color: '#749db0', goal: 7, unit: 'Tage', description: 'Zehn Seiten oder zehn Minuten lesen.', rule: 'Bestätige jeden Tag, an dem du zehn Seiten oder mindestens zehn Minuten gelesen hast.' },
    sweets: { title: 'Ohne Süßigkeiten', category: 'Ernährung', mode: 'daily', icon: 'food', color: '#cf8f98', goal: 7, unit: 'Tage', description: 'Eine kleine Entscheidung, jeden Tag neu.', rule: 'Bestätige abgeschlossene Tage ohne Süßigkeiten. Die Challenge ist ein persönliches Ziel, keine Ernährungsempfehlung.' }
  });
  const DAY = 86400000;
  const dateKey = value => { const d = new Date(value); return Number.isNaN(+d) ? '' : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const dayNumber = key => Date.parse(`${key}T00:00:00Z`) / DAY;
  const previousDay = key => new Date(Date.parse(`${key}T12:00:00Z`) - DAY).toISOString().slice(0,10);
  function validDay(key) { return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(Date.parse(`${key}T12:00:00Z`)) && new Date(`${key}T12:00:00Z`).toISOString().slice(0,10) === key; }
  function normalize(event) {
    if (!event || typeof event.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.id) || typeof event.challenge_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.challenge_id)) return null;
    if (!['start','check','finish','archive'].includes(event.kind) || typeof event.occurred_at !== 'string' || !Number.isFinite(Date.parse(event.occurred_at))) return null;
    const p = event.payload || {};
    if (event.kind === 'start' && (!Object.hasOwn(TYPES,p.type) || !Number.isInteger(p.goal) || p.goal < 1 || p.goal > 365)) return null;
    if (event.kind === 'check' && (!validDay(p.day) || typeof p.done !== 'boolean')) return null;
    if (event.kind === 'finish' && (typeof p.ended_at !== 'string' || !Number.isFinite(Date.parse(p.ended_at)))) return null;
    return { id: event.id, challenge_id: event.challenge_id, user_id: event.user_id || null, kind: event.kind, occurred_at: event.occurred_at, payload: event.kind === 'start' ? {type:p.type,goal:p.goal} : event.kind === 'check' ? {day:p.day,done:p.done} : event.kind === 'finish' ? {ended_at:p.ended_at,reason:String(p.reason || 'manual').slice(0,40)} : {} };
  }
  function project(events, now = Date.now(), evidence = {}) {
    const groups = new Map();
    const ordered = events.map(normalize).filter(Boolean).sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at)||a.id.localeCompare(b.id));
    for (const event of ordered) { if (!groups.has(event.challenge_id)) groups.set(event.challenge_id, []); groups.get(event.challenge_id).push(event); }
    const today = dateKey(now), yesterday = previousDay(today);
    return [...groups.entries()].flatMap(([id, rows]) => {
      const start = rows.find(e=>e.kind==='start'); if (!start) return [];
      const definition = TYPES[start.payload.type], startAt = Date.parse(start.occurred_at), startDay = dateKey(startAt);
      const finish = rows.filter(e=>e.kind==='finish' && Date.parse(e.payload.ended_at)>=startAt).sort((a,b)=>Date.parse(a.payload.ended_at)-Date.parse(b.payload.ended_at))[0];
      let endedAt = finish ? Date.parse(finish.payload.ended_at) : null, reason = finish?.payload.reason || '';
      const observations = start.payload.type==='alcohol' ? (evidence.alcoholDays || []).filter(day=>day>=startDay && day<=today).map(day=>Math.max(startAt, Math.min(now, Date.parse(day+'T12:00:00')))) : (evidence[start.payload.type] || []);
      const violations = observations.filter(at=>at>=startAt && at<=now).sort((a,b)=>a-b);
      if (['smoke','alcohol'].includes(start.payload.type) && violations.length && (endedAt===null || violations[0]<endedAt)) { endedAt=violations[0]; reason='consumption'; }
      const checks = new Map();
      for (const event of rows) if (event.kind==='check' && event.payload.day>=startDay && event.payload.day<=today) checks.set(event.payload.day,event.payload.done);
      if (start.payload.type==='meditation') for(const key of evidence.meditationDays || []) if(key>=startDay && key<=today && !checks.has(key)) checks.set(key,true);
      const endDay = endedAt===null ? today : dateKey(endedAt);
      const confirmed = [...checks].filter(([key,done])=>done && key<=endDay && !(reason==='consumption' && key===endDay)).map(([key])=>key).sort();
      let best = 0, chain = 0, prev = -Infinity;
      for(const key of confirmed) { const n=dayNumber(key); chain=n===prev+1?chain+1:1; best=Math.max(best,chain);prev=n; }
      let current = 0;
      let cursor = checks.get(today) && confirmed.includes(today) ? today : yesterday;
      if(endedAt!==null) cursor=confirmed.at(-1);
      const set = new Set(confirmed);
      while(cursor && set.has(cursor)) {current++;cursor=previousDay(cursor);}
      const elapsed = Math.max(0, Math.min(now, endedAt ?? now) - startAt);
      const value = definition.mode==='timer' ? elapsed / 3600000 : current;
      const score = definition.mode==='timer' ? elapsed : best;
      const target = start.payload.goal;
      return [{id,type:start.payload.type,definition,startedAt:startAt,endedAt,reason,active:endedAt===null,archived:rows.some(e=>e.kind==='archive'),checks,confirmed,current,best,elapsed,value,score,target,progress:Math.min(100,value/target*100),reached:definition.mode==='timer'?value>=target:best>=target, needsFinish:endedAt!==null && (!finish || Date.parse(finish.payload.ended_at)>endedAt)}];
    }).sort((a,b)=>b.startedAt-a.startedAt||a.id.localeCompare(b.id));
  }
  function evidence(state = {}) {
    const smoke = (state.cigarettes || []).map(e=>Date.parse(e.smoked_at||e.created_at)).filter(Number.isFinite);
    const alcohol = [...(state.alcoholUnits || []),...(state.alcoholEvents || [])].map(e=>Date.parse(e.occurred_at||e.created_at)).filter(Number.isFinite);
    const alcoholDays = new Set(alcohol.map(dateKey));
    for(const log of state.alcoholLogs || []) if(log.consumed || Number(log.consumption_level)>0) { const day=String(log.log_date).slice(0,10); if(validDay(day)) alcoholDays.add(day); }
    const meditationIds = new Set((state.habits || []).filter(h=>h.system_key==='meditation'||h.id==='00000000-0000-4000-8000-000000000104'||String(h.name||'').trim().toLowerCase()==='meditation').map(h=>h.id));
    const meditationDays = [...new Set((state.habitEntries || []).filter(e=>meditationIds.has(e.habit_id) && (e.value_bool===true || Number(e.value_num)>0 || Number(e.duration_minutes)>0)).map(e=>dateKey(e.occurred_at||e.created_at)).filter(Boolean))];
    return {smoke,alcoholDays:[...alcoholDays],meditationDays};
  }
  const api = Object.freeze({TYPES,DAY,dateKey,previousDay,validDay,normalize,project,evidence});
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.HabitFlowCompetitionDomain=api;
})(typeof window==='object'?window:globalThis);
