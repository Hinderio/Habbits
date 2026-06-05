(function renderProjectDetailsOnMobile(window, document) {
  'use strict';

  if (window.__habitFlowProjectMobileDetailPatched) return;
  window.__habitFlowProjectMobileDetailPatched = true;

  const STORAGE_KEY = 'habitflow-state-v1';
  let client;

  function isMobile() {
    return window.matchMedia?.('(max-width: 760px)').matches || window.innerWidth <= 760;
  }

  function readState() {
    try {
      const parsed = JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeState(state) {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function escapeHtml(value = '') {
    return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function dateLabel(value) {
    if (!value) return '-';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  function statusLabel(status) {
    return { planned: 'Geplant', active: 'Aktiv', paused: 'Pausiert', done: 'Abgeschlossen' }[status] || 'Geplant';
  }

  function phaseLabel(status) {
    return { open: 'Offen', active: 'In Arbeit', done: 'Erledigt' }[status] || 'Offen';
  }

  function taskDone(task = {}) {
    return (task.status || 'open') === 'done';
  }

  function projectTasks(state, projectId) {
    return (Array.isArray(state.tasks) ? state.tasks : []).filter(task => task.project_id === projectId);
  }

  function projectPhases(state, projectId) {
    return (Array.isArray(state.projectPhases) ? state.projectPhases : [])
      .filter(phase => phase.project_id === projectId && !phase.is_archived)
      .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
  }

  function progressFor(project, state) {
    const tasks = projectTasks(state, project.id).filter(task => (task.status || 'open') !== 'archived');
    if (tasks.length) return Math.round((tasks.filter(taskDone).length / tasks.length) * 100);
    const phases = projectPhases(state, project.id);
    if (phases.length) return Math.round((phases.filter(phase => phase.status === 'done').length / phases.length) * 100);
    return 0;
  }

  function nextStep(project, state, progress) {
    const phases = projectPhases(state, project.id);
    const tasks = projectTasks(state, project.id);
    if (!phases.length) return 'Erstelle die erste Projektphase.';
    if (!tasks.length) return 'Lege konkrete Tasks fuer dieses Projekt an.';
    if (progress >= 100) return 'Alle Tasks oder Phasen sind erledigt. Das Projekt kann abgeschlossen werden.';
    return `Naechster Meilenstein: ${escapeHtml(phases.find(phase => phase.status !== 'done')?.name || 'Projekt fokussiert weiterfuehren')}.`;
  }

  function renderPhase(phase, project) {
    const projectStart = project.start_date || phase.start_date;
    const projectEnd = project.end_date || phase.end_date || projectStart;
    const start = new Date(`${projectStart}T12:00:00`).getTime();
    const end = new Date(`${projectEnd}T12:00:00`).getTime();
    const phaseStart = new Date(`${phase.start_date}T12:00:00`).getTime();
    const phaseEnd = new Date(`${phase.end_date}T12:00:00`).getTime();
    const span = Math.max(1, end - start);
    const left = Math.max(0, Math.min(96, ((phaseStart - start) / span) * 100));
    const width = Math.max(8, Math.min(100 - left, ((phaseEnd - phaseStart || 86400000) / span) * 100));
    return `<article class="phase-card"><div><strong>${escapeHtml(phase.name)}</strong><span class="subtle">${phaseLabel(phase.status)}</span></div><div class="phase-timeline"><div class="phase-timeline-track"><i style="margin-left:${left}%;width:${width}%"></i></div><div class="phase-timeline-dates"><span>${dateLabel(phase.start_date)}</span><span>${dateLabel(phase.end_date)}</span></div></div><div class="list-actions"><button class="mini-btn" type="button" data-action="edit-phase" data-id="${escapeHtml(phase.id)}">Bearbeiten</button><button class="mini-btn danger" type="button" data-action="delete-phase" data-id="${escapeHtml(phase.id)}">Loeschen</button></div></article>`;
  }

  function renderTasks(tasks) {
    if (!tasks.length) return '<div class="project-empty">Noch keine Tasks verknuepft.</div>';
    return tasks.map(task => `<article class="project-task-row ${taskDone(task) ? 'is-done' : ''}"><div><strong>${escapeHtml(task.title)}</strong><span class="subtle">${escapeHtml(task.status || 'open')}</span></div><button class="mini-btn" type="button" data-action="unlink-task" data-id="${escapeHtml(task.id)}">Loesen</button></article>`).join('');
  }

  function render(projectId) {
    const state = readState();
    const project = (Array.isArray(state.projects) ? state.projects : []).find(item => item.id === projectId);
    const modal = document.getElementById('projectDetailModal');
    const content = document.getElementById('projectDetailContent');
    if (!project || !modal || !content) return false;

    const phases = projectPhases(state, project.id);
    const tasks = projectTasks(state, project.id);
    const progress = progressFor(project, state);
    content.innerHTML = `<div class="project-detail-head"><p class="eyebrow">Projekt</p><h2>${escapeHtml(project.title)}</h2><p>${escapeHtml(project.description || 'Noch keine Beschreibung.')}</p></div>
      <div class="project-detail-grid">
        <article class="project-detail-box"><small>Status</small><h3><span class="badge project-status-${escapeHtml(project.status || 'planned')}">${statusLabel(project.status)}</span></h3><p class="subtle">${dateLabel(project.start_date)} bis ${dateLabel(project.end_date)}</p></article>
        <article class="project-detail-box"><small>Fortschritt</small><h3>${progress}%</h3><div class="project-progress-track"><i style="width:${progress}%"></i></div></article>
        <article class="project-detail-box"><small>Ziel / Outcome</small><p class="subtle">${escapeHtml(project.outcome_note || 'Noch kein Outcome notiert.')}</p></article>
        <article class="project-detail-box project-next-step"><small>Naechster sinnvoller Schritt</small><p>${nextStep(project, state, progress)}</p></article>
      </div>
      <div class="project-section-head"><div><p class="eyebrow">Phasen / Gantt MVP</p><h3>Timeline</h3></div><span class="badge muted">${phases.length} Phase${phases.length === 1 ? '' : 'n'}</span></div>
      <form class="phase-form" data-project-phase-form data-project-id="${escapeHtml(project.id)}"><label><span>Phase</span><input name="name" required placeholder="z. B. Konzept" /></label><label><span>Start</span><input name="start_date" type="date" value="${escapeHtml(project.start_date || new Date().toISOString().slice(0, 10))}" required /></label><label><span>Ende</span><input name="end_date" type="date" value="${escapeHtml(project.end_date || project.start_date || new Date().toISOString().slice(0, 10))}" required /></label><label><span>Status</span><select name="status"><option value="open">Offen</option><option value="active">In Arbeit</option><option value="done">Erledigt</option></select></label><button class="mini-btn primary" type="submit">Phase speichern</button></form>
      <div>${phases.length ? phases.map(phase => renderPhase(phase, project)).join('') : '<div class="project-empty">Noch keine Phasen. Erstelle die erste Projektphase.</div>'}</div>
      <div class="project-section-head"><div><p class="eyebrow">Tasks</p><h3>Verknuepfte Aufgaben</h3></div><span class="badge muted">${tasks.length} Task${tasks.length === 1 ? '' : 's'}</span></div>
      <div class="project-task-list">${renderTasks(tasks)}</div>
      <div class="form-actions" style="margin-top:16px"><button class="pill secondary" type="button" data-action="edit-project" data-id="${escapeHtml(project.id)}">Projekt bearbeiten</button><button class="pill secondary" type="button" data-action="mark-project-done" data-id="${escapeHtml(project.id)}">Als abgeschlossen markieren</button></div>`;
    modal.classList.remove('hidden');
    modal.classList.add('project-mobile-detail-modal');
    document.body.classList.add('project-modal-open');
    return true;
  }

  function getClient() {
    const config = window.HABITFLOW_SUPABASE_CONFIG || {};
    if (!config.url || !config.anonKey || !window.supabase?.createClient) return null;
    if (!client) client = window.supabase.createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    return client;
  }

  async function hydrateRemote(projectId) {
    const supabase = getClient();
    if (!supabase) return;
    const { data, error } = await supabase.from('project_phases').select('*').eq('project_id', projectId).eq('is_archived', false).order('start_date', { ascending: true });
    if (error) return;
    const state = readState();
    const others = (Array.isArray(state.projectPhases) ? state.projectPhases : []).filter(phase => phase.project_id !== projectId);
    state.projectPhases = [...(data || []).map(row => ({ ...row, synced: true })), ...others];
    writeState(state);
    render(projectId);
  }

  document.addEventListener('click', event => {
    if (!isMobile()) return;
    const opener = event.target.closest?.('[data-action="open-project-detail"]');
    if (!opener?.dataset?.id) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (render(opener.dataset.id)) hydrateRemote(opener.dataset.id);
  }, true);

  document.addEventListener('click', event => {
    const close = event.target.closest?.('[data-action="close-project-detail"]');
    if (!close) return;
    document.getElementById('projectDetailModal')?.classList.remove('project-mobile-detail-modal');
  });
})(window, document);
