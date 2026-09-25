(function(root) {
  'use strict';
  const key = value => {
    if (!value) return '';
    const d = new Date(value.length === 10 ? value + 'T12:00:00' : value);
    return Number.isNaN(+d) ? '' : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const day = value => { const k = key(value); return k ? Date.UTC(...k.split('-').map((v,i)=>Number(v)-(i===1?1:0))) / 86400000 : NaN; };
  const bound = (rows,date,upper=false) => { let lo=0,hi=rows.length; while(lo<hi){const m=(lo+hi)>>>1;if(rows[m].date<date || (upper&&rows[m].date===date))lo=m+1;else hi=m;}return lo; };
  function indexEntries(entries,habits,today) {
    const map=new Map(), hm=new Map(habits.map(h=>[h.id,h]));
    for(const e of entries){const h=hm.get(e.habit_id), date=key(e.occurred_at);if(!h||!date||date>today||e.is_archived)continue;
      const value=Number(e.value_num), valid=h.type==='boolean'?e.value_bool===true:Number.isFinite(value)&&e.value_num!==null&&value>0;
      if(!valid)continue; if(!map.has(h.id))map.set(h.id,[]);map.get(h.id).push({date,value,time:String(e.occurred_at)});
    }
    for(const rows of map.values())rows.sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)); return map;
  }
  function progress(goal,index,today) {
    const m=goal.metadata||{}, rows=index.get(m.habitId)||[], end=m.dueDate<today?m.dueDate:today;
    if(m.kind==='manual')return {ratio:goal.isDone?1:0,label:goal.isDone?'Erreicht':'Offen'};
    const start=bound(rows,m.startDate), stop=bound(rows,end,true), target=Number(m.target);
    if(m.kind==='weight'){
      if(stop<=start)return {ratio:0,label:'Noch kein Messwert'};
      const current=rows[stop-1].value, baseline=rows[Math.max(0,Math.min(start,stop-1))].value;
      const achieved=m.direction==='atLeast'?current>=target:current<=target;
      const ratio=achieved?1:baseline===target?0:(current-baseline)/(target-baseline);
      return {ratio:Math.max(0,Math.min(1,ratio)),label:`${current} / ${target} ${m.unit||'kg'}`};
    }
    const count=Math.max(0,stop-start);return {ratio:Math.min(1,count/target),label:`${count} / ${target} Einträge`};
  }
  function build(snapshot, goals, today = key(new Date().toISOString())) {
    const index = indexEntries(snapshot.entries || [], snapshot.habits || [], today);
    const out = [];
    const projects = new Map((snapshot.projects || []).filter(p => !p.is_archived).map(p => [p.id, p]));
    // Project linking lives in the project module; it can be newer than app state.
    const links = new Map((snapshot.taskLinks || []).map(t => [t.id, t.projectId]));
    const lane = p => ({ group: p.title, groupKey: `project:${p.id}`, projectId: p.id, section: 'Projekte' });
    for (const g of goals) {
      if (g.isArchived) continue;
      const m = g.metadata || {};
      out.push({ id: g.id, source: 'goal', group: m.category || 'Meine Ziele', groupKey: `goal:${m.category || 'Meine Ziele'}`, title: g.title, start: m.startDate, end: m.dueDate, ...progress(g, index, today), goal: g });
    }
    for (const p of projects.values()) {
      out.push({ id: p.id, source: 'project', ...lane(p), laneRole: 'summary', title: p.title, start: key(p.start_date), end: key(p.end_date), label: p.status === 'done' ? 'Abgeschlossen' : 'Projektzeitraum' });
    }
    for (const m of snapshot.milestones || []) {
      const p = projects.get(m.project_id);
      if (m.is_archived || !p) continue;
      out.push({ id: p.id, source: 'project', ...lane(p), laneRole: 'milestone', title: m.title, start: key(m.milestone_date), end: key(m.milestone_date), label: 'Meilenstein' });
    }
    for (const t of snapshot.tasks || []) {
      if (t.is_archived || t.priority !== 'high') continue;
      const projectId = links.has(t.id) ? links.get(t.id) : t.project_id || t.projectId;
      const p = projects.get(projectId);
      out.push({ id: t.id, source: 'task', ...(p ? lane(p) : { group: 'Aufgaben', groupKey: 'tasks' }), laneRole: p ? 'task' : '', title: t.title, start: key(t.due_at), end: key(t.due_at), label: t.status === 'done' ? 'Hoch · Erledigt' : 'Hoch · Aufgabe' });
    }
    // Keep project summaries and children together, even for equal project titles.
    return out.sort((a, b) =>
      (a.section || a.group).localeCompare(b.section || b.group) ||
      a.group.localeCompare(b.group) || a.groupKey.localeCompare(b.groupKey) ||
      Number(b.laneRole === 'summary') - Number(a.laneRole === 'summary') ||
      String(a.start || a.end || '9999').localeCompare(String(b.start || b.end || '9999')) ||
      a.title.localeCompare(b.title)
    ).map((row, index) => ({ ...row, index }));
  }
  function windowRows(rows, start, end, filter = 'all') {
    const matchesSource = r => filter === 'all' || r.source === filter || (filter === 'project' && r.projectId);
    const matchesDate = r => (!r.start && !r.end) || ((r.start || r.end) <= end && (r.end || r.start) >= start);
    const visibleProjects = new Set();
    for (const r of rows) if (r.projectId && matchesSource(r) && matchesDate(r)) visibleProjects.add(r.projectId);
    return rows.filter(r => matchesSource(r) && (matchesDate(r) || (r.laneRole === 'summary' && visibleProjects.has(r.projectId))));
  }
  const api={key,day,indexEntries,progress,build,windowRows};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HabitFlowRoadmapDomain=Object.freeze(api);
})(typeof window==='undefined'?globalThis:window);
