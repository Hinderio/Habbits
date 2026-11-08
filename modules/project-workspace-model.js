(function installProjectWorkspaceModel(window) {
  'use strict';
  if (window.HabitFlowProjectWorkspaceModel) return;
  const closed = task => ['done', 'completed', 'closed'].includes(task.status) || Boolean(task.completed_at);
  function safeUrl(value) {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
  }
  function preview(value, limit = 160) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    const chars = Array.from(text); return chars.slice(0, limit).join('') + (chars.length > limit ? '…' : '');
  }
  function knowledge(projectId, owner, snapshot = {}, notes = []) {
    const dossiers = (snapshot.dossiers || []).filter(row => row.project_id === projectId && !row.is_archived && row.user_id === owner && owner);
    const byId = new Map(dossiers.map(row => [row.id, row]));
    const rows = dossiers.map(row => ({ key:'dossier:' + row.id, kind:'dossiers', dossierId:row.id, title:row.title || 'Dossier', preview:preview(row.description), updated:row.updated_at || '', search:(row.title + ' ' + (row.description || '')).toLocaleLowerCase('de') }));
    for (const entry of snapshot.entries || []) {
      const dossier = byId.get(entry.dossier_id);
      if (!dossier || entry.is_archived || entry.user_id !== owner) continue;
      const base = { dossierId:dossier.id, dossierTitle:dossier.title, entryId:entry.id, updated:entry.updated_at || entry.created_at || '', title:entry.title || preview(entry.body, 60) || (entry.image_path ? 'Bild' : 'Eintrag') };
      if (entry.body || entry.image_path || !(entry.links || []).length) rows.push({ ...base, key:'entry:' + entry.id, kind:'thoughts', preview:preview(entry.body) || 'Bild im Dossier öffnen', search:(base.title + ' ' + (entry.body || '') + ' ' + dossier.title).toLocaleLowerCase('de') });
      const seen = new Set();
      (entry.links || []).forEach((raw, position) => {
        const url = safeUrl(raw); if (!url || seen.has(url)) return; seen.add(url);
        rows.push({ ...base, key:'link:' + entry.id + ':' + position, kind:'links', url, preview:url, search:(base.title + ' ' + url + ' ' + dossier.title).toLocaleLowerCase('de') });
      });
    }
    for (const note of notes) {
      if (note.project_id !== projectId || note.category !== 'Entscheidung' || note.is_archived || (note.user_id && note.user_id !== owner)) continue;
      rows.push({ key:'decision:' + note.id, kind:'decisions', noteId:note.id, title:'Entscheidung', preview:preview(note.body), updated:note.updated_at || note.created_at || '', search:String(note.body || '').toLocaleLowerCase('de') });
    }
    return rows.sort((a,b) => b.updated.localeCompare(a.updated) || a.key.localeCompare(b.key));
  }
  function page(rows, filter = 'all', query = '', limit = 20) {
    const search = query.trim().toLocaleLowerCase('de');
    const matching = rows.filter(row => (filter === 'all' || row.kind === filter) && (!search || row.search.includes(search)));
    return { total:matching.length, rows:matching.slice(0, Math.max(20, limit)) };
  }
  function coach(project, tasks = [], phases = [], milestones = [], today, ready = true) {
    if (!ready || !project || project.status === 'done') return [];
    const hints = [];
    if (project.status === 'active' && !String(project.outcome_note || '').trim()) hints.push({ id:'outcome', rank:0, title:'Ziel konkretisieren', reason:'Für dieses aktive Projekt ist noch kein Outcome hinterlegt.', action:'outcome', label:'Ziel erfassen' });
    if (project.status === 'active' && !tasks.some(task => !task.is_archived && !task.done_archived_at && !closed(task))) hints.push({ id:'task', rank:0, title:'Nächste Aufgabe festlegen', reason:'Dieses aktive Projekt hat keine offene verknüpfte Aufgabe.', action:'task', label:'Aufgabe erstellen' });
    if (!phases.some(row => !row.is_archived)) hints.push({ id:'phase', rank:1, title:'Planung strukturieren', reason:'Für dieses Projekt sind noch keine Phasen hinterlegt.', action:'phase', label:'Phase erfassen' });
    const past = milestones.filter(row => !row.is_archived && row.milestone_date && row.milestone_date < today).sort((a,b)=>a.milestone_date.localeCompare(b.milestone_date) || a.id.localeCompare(b.id))[0];
    if (past) hints.push({ id:'milestone', rank:2, date:past.milestone_date, recordId:past.id, title:'Meilensteindatum prüfen', reason:'«' + past.title + '» liegt in der Vergangenheit. Daraus lässt sich kein Erledigt-Status ableiten.', action:'milestone', label:'Termin prüfen' });
    return hints.sort((a,b)=>a.rank-b.rank || (a.date || '').localeCompare(b.date || '') || a.id.localeCompare(b.id)).slice(0,3);
  }
  function decisionBody(values) {
    const decision = String(values.decision || '').trim(), reason = String(values.reason || '').trim();
    if (!decision || !reason) throw new Error('Bitte Entscheid und Begründung ausfüllen.');
    const body = [['Entscheid',decision],['Begründung',reason],['Alternativen',values.alternatives],['Konsequenz',values.consequence]].filter(([,value])=>String(value || '').trim()).map(([label,value])=>label + ':\n' + String(value).trim()).join('\n\n');
    if (body.length > 2000) throw new Error('Die Entscheidung ist zu lang. Bitte auf insgesamt 2’000 Zeichen kürzen.');
    return body;
  }
  window.HabitFlowProjectWorkspaceModel = Object.freeze({ knowledge, page, coach, decisionBody, preview, safeUrl });
})(window);
