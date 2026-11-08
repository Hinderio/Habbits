(function (root) {
  'use strict';
  const TYPES = Object.freeze({
    smoke: { title: 'Rauchfrei', category: 'Konsum', mode: 'timer', icon: 'smoke', color: '#43b9b2', goal: 24, unit: 'Stunden', description: 'Starte jetzt. Jede Minute ohne Zigarette zählt.', rule: 'Ein neuer Rauch-Eintrag beendet den Versuch automatisch. Deine Konsumdaten bleiben vollständig erhalten.' },
    alcohol: { title: 'Alkoholfreie Tage', category: 'Konsum', mode: 'daily', icon: 'alcohol', color: '#6495ce', goal: 7, unit: 'Tage', description: 'Bewusst alkoholfrei. Ein bestätigter Tag nach dem anderen.', rule: 'Bestätige abgeschlossene alkoholfreie Tage. Ein Alkoholeintrag beendet den Versuch.' },
    bread: { title: 'Ohne Brot', category: 'Ernährung', mode: 'daily', icon: 'food', color: '#d5a352', goal: 7, unit: 'Tage', description: 'Dein persönliches Ernährungsexperiment.', rule: 'Bestätige einen Tag, wenn du an diesem Tag kein Brot gegessen hast. Ein ausgelassener Tag zählt nicht.' },
    meditation: { title: 'Meditation', category: 'Balance', mode: 'daily', icon: 'meditation', color: '#a78bc9', goal: 7, unit: 'Tage', description: 'Täglich ein bewusster Moment für dich.', rule: 'Meditations-Logs aus deinen Habits werden übernommen. Du kannst auch selbst einen Tag bestätigen.' },
    movement: { title: 'Täglich bewegen', category: 'Bewegung', mode: 'daily', icon: 'hiking', color: '#6aaf8d', goal: 7, unit: 'Tage', description: 'Mindestens 20 Minuten bewusste Bewegung.', rule: 'Bestätige Tage mit mindestens 20 Minuten Bewegung. Entscheidend ist die Regelmäßigkeit.' },
    reading: { title: 'Leseroutine', category: 'Fokus', mode: 'daily', icon: 'book', color: '#749db0', goal: 7, unit: 'Tage', description: 'Zehn Seiten oder zehn Minuten lesen.', rule: 'Bestätige jeden Tag, an dem du zehn Seiten oder mindestens zehn Minuten gelesen hast.' },
    fruit: { title: 'Tage mit Früchten', category: 'Ernährung', mode: 'daily', icon: 'fruit', color: '#cf8f98', goal: 7, unit: 'Tage', description: 'Jeden Tag bewusst Früchte geniessen.', rule: 'Bestätige jeden Tag, an dem du Früchte gegessen hast.' },
    sweets: { retired: true, title: 'Ohne Süßigkeiten', category: 'Ernährung', mode: 'daily', icon: 'food', color: '#cf8f98', goal: 7, unit: 'Tage', description: 'Eine kleine Entscheidung, jeden Tag neu.', rule: 'Bestätige abgeschlossene Tage ohne Süßigkeiten. Die Challenge ist ein persönliches Ziel, keine Ernährungsempfehlung.' }
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
    return { id: event.id, challenge_id: event.challenge_id, user_id: event.user_id || null, kind: event.kind, occurred_at: event.occurred_at, payload: event.kind === 'start' ? {type:p.type,goal:p.goal,...(typeof p.habit_id==='string' && p.habit_id.length<=100 ? {habit_id:p.habit_id} : {})} : event.kind === 'check' ? {day:p.day,done:p.done} : event.kind === 'finish' ? {ended_at:p.ended_at,reason:String(p.reason || 'manual').slice(0,40)} : {} };
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
      const linkedType=['meditation','alcohol'].includes(start.payload.type);
      const habitId=linkedType ? (Object.hasOwn(start.payload,'habit_id') ? start.payload.habit_id : evidence.habitLinks?.[start.payload.type]?.id || '') : '';
      const habit=habitId ? evidence.habits?.find(h=>h.id===habitId) : null;
      const habitDays=habitId ? (evidence.habitDays?.[habitId] || []) : start.payload.type==='meditation' && !Object.hasOwn(start.payload,'habit_id') ? (evidence.meditationDays || []) : [];
      for(const key of habitDays) if(key>=startDay && key<=(start.payload.type==='alcohol'?yesterday:today) && !checks.has(key)) checks.set(key,true);
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
      return [{id,type:start.payload.type,definition,habitId,habitName:habit?.name || '',startedAt:startAt,endedAt,reason,active:endedAt===null,archived:rows.some(e=>e.kind==='archive'),checks,confirmed,current,best,elapsed,value,score,target,progress:Math.min(100,value/target*100),reached:definition.mode==='timer'?value>=target:best>=target, needsFinish:endedAt!==null && (!finish || Date.parse(finish.payload.ended_at)>endedAt)}];
    }).sort((a,b)=>b.startedAt-a.startedAt||a.id.localeCompare(b.id));
  }
  function evidence(state = {}) {
    const smoke = (state.cigarettes || []).map(e=>Date.parse(e.smoked_at||e.created_at)).filter(Number.isFinite);
    const alcohol = [...(state.alcoholUnits || []),...(state.alcoholEvents || [])].map(e=>Date.parse(e.occurred_at||e.created_at)).filter(Number.isFinite);
    const alcoholDays = new Set(alcohol.map(dateKey));
    for(const log of state.alcoholLogs || []) if(log.consumed || Number(log.consumption_level)>0) { const day=String(log.log_date).slice(0,10); if(validDay(day)) alcoholDays.add(day); }
    const habits=(state.habits || []).map(h=>({id:h.id,name:String(h.name||''),system_key:h.system_key,is_archived:h.is_archived}));
    const nameKey=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
    const findHabit=(type,names)=>{
      const eligible=habits.filter(h=>!h.is_archived);
      const system=eligible.find(h=>h.system_key===type || (type==='meditation'&&h.id==='00000000-0000-4000-8000-000000000104'));
      if(system)return system;
      const matches=eligible.filter(h=>names.includes(nameKey(h.name)));
      return matches.length===1?matches[0]:null;
    };
    const habitLinks={meditation:findHabit('meditation',['meditation','meditieren']),alcohol:findHabit('alcohol_free',['alkoholfrei','alkoholfreietage','alkoholfreiertag','ohnealkohol','keinalkohol','alcoholfreedays'])};
    const sets=new Map();
    for(const entry of state.habitEntries || []){
      if(!(entry.value_bool===true||Number(entry.value_num)>0||Number(entry.duration_minutes)>0))continue;
      const day=dateKey(entry.occurred_at||entry.created_at);if(!day)continue;
      if(!sets.has(entry.habit_id))sets.set(entry.habit_id,new Set());sets.get(entry.habit_id).add(day);
    }
    const habitDays=Object.fromEntries([...sets].map(([id,days])=>[id,[...days]]));
    return {smoke,alcoholDays:[...alcoholDays],habits,habitLinks,habitDays,meditationDays:habitDays[habitLinks.meditation?.id]||[]};
  }
  function records(runs){
    const byType=new Map();
    for(const run of runs){
      if(run.archived||run.score<=0||run.definition.retired)continue;
      const previous=byType.get(run.type);
      if(!previous||run.score>previous.score||(run.score===previous.score&&run.startedAt<previous.startedAt))byType.set(run.type,run);
    }
    return Object.keys(TYPES).flatMap(type=>byType.has(type)?[byType.get(type)]:[]);
  }

  const api = Object.freeze({TYPES,DAY,dateKey,previousDay,validDay,normalize,project,evidence,records});
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.HabitFlowCompetitionDomain=api;
})(typeof window==='object'?window:globalThis);
