(function renderProjectDetailsReliably(window, document) {
  'use strict';

  if (window.__habitFlowProjectDetailPatched) return;
  window.__habitFlowProjectDetailPatched = true;

  const STORAGE_KEY = 'habitflow-state-v1';
  const DAY_MS = 86400000;
  let client;
  let currentProjectId = '';
  let openTimer = 0;

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

  function validDate(value) {
    const text = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(new Date(`${text}T12:00:00`).getTime()) ? text : '';
  }

  function dateMs(value) {
    const date = validDate(value);
    if (!date) return NaN;
    return new Date(`${date}T12:00:00`).getTime();
  }

  function todayDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function dateLabel(value) {
    const date = new Date(`${String(value || '').slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  function statusLabel(status) {
    return { planned: 'Geplant', active: 'Aktiv', paused: 'Pausiert', done: 'Abgeschlossen' }[status] || 'Geplant';
  }

  function statusClass(status) {
    return { planned: 'project-status-planned', active: 'project-status-active', paused: 'project-status-paused', done: 'project-status-done' }[status] || 'project-status-planned';
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
      .sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
  }

  function progressFor(project, state) {
    const tasks = projectTasks(state, project.id).filter(task => (task.status || 'open') !== 'archived');
    if (tasks.length) return Math.round((tasks.filter(taskDone).length / tasks.length) * 100);
    const phases = projectPhases(state, project.id);
    if (phases.length) return Math.round((phases.filter(phase => phase.status === 'done').length / phases.length) * 100);
    return 0;
  }

  function nextMilestone(project, state) {
    const phases = projectPhases(state, project.id).filter(phase => phase.status !== 'done');
    if (phases.length) return phases[0].name;
    const tasks = projectTasks(state, project.id).filter(task => !taskDone(task));
    if (tasks.length) return tasks[0].title;
    return project.status === 'done' ? 'Abgeschlossen' : 'Naechsten Schritt definieren';
  }

  function nextStep(project, state, progress) {
    const phases = projectPhases(state, project.id);
    const tasks = projectTasks(state, project.id);
    const end = dateMs(project.end_date);
    if (!phases.length) return 'Erstelle die erste Projektphase.';
    if (!tasks.length) return 'Lege konkrete Tasks fuer dieses Projekt an.';
    if (Number.isFinite(end) && end - Date.now() <= 7 * DAY_MS && progress < 50) return 'Enddatum ist bald erreicht und der Fortschritt ist niedrig. Reduziere Scope oder plane den wichtigsten Task neu.';
    if (progress >= 100) return 'Alle Tasks oder Phasen sind erledigt. Das Projekt kann abgeschlossen werden.';
    return `Naechster Meilenstein: ${nextMilestone(project, state)}.`;
  }

  function timelineBounds(project, phases) {
    const starts = [project.start_date, ...phases.map(phase => phase.start_date)].map(validDate).filter(Boolean).sort();
    const ends = [project.end_date, ...phases.map(phase => phase.end_date), project.start_date].map(validDate).filter(Boolean).sort();
    const startDate = starts[0] || todayDate();
    const endDate = ends[ends.length - 1] || startDate;
    const start = dateMs(startDate);
    const rawEnd = dateMs(endDate);
    const end = Number.isFinite(rawEnd) && rawEnd > start ? rawEnd : start + DAY_MS;
    return { start, end };
  }

  function renderPhase(phase, bounds) {
    const phaseStart = Number.isFinite(dateMs(phase.start_date)) ? dateMs(phase.start_date) : bounds.start;
    const rawPhaseEnd = dateMs(phase.end_date);
    const phaseEnd = Number.isFinite(rawPhaseEnd) && rawPhaseEnd >= phaseStart ? rawPhaseEnd : phaseStart + DAY_MS;
    const span = Math.max(DAY_MS, bounds.end - bounds.start);
    const left = Math.max(0, Math.min(96, ((phaseStart - bounds.start) / span) * 100));
    const rawWidth = ((phaseEnd - phaseStart || DAY_MS) / span) * 100;
    const width = Math.max(8, Math.min(100 - left, Number.isFinite(rawWidth) ? rawWidth : 8));
    return `<article class="phase-card"><div><strong>${escapeHtml(phase.name)}</strong><span class="subtle">${phaseLabel(phase.status)}</span></div><div class="phase-timeline"><div class="phase-timeline-track"><i style="margin-left:${left}%;width:${width}%"></i></div><div class="phase-timeline-dates"><span>${dateLabel(phase.start_date)}</span><span>${dateLabel(phase.end_date)}</span></div></div><div class="list-actions"><button class="mini-btn" type="button" data-action="edit-phase" data-id="${escapeHtml(phase.id)}">Bearbeiten</button><button class="mini-btn danger" type="button" data-action="delete-phase" data-id="${escapeHtml(phase.id)}">Loeschen</button></div></article>`;
  }

  function renderTaskTools(project, state) {
    const available = (Array.isArray(state.tasks) ? state.tasks : []).filter(task => !task.project_id && (task.status || 'open') !== 'archived');
    const options = available.map(task => `<option value="${escapeHtml(task.id)}">${escapeHtml(task.title)}</option>`).join('');
    return `<div class="project-task-tools"><label><span class="subtle">Bestehenden Task verbinden</span><select id="projectTaskSelect"><option value="">Task auswaehlen</option>${options}</select></label><div class="list-actions"><button class="mini-btn" type="button" data-action="link-selected-task" data-id="${escapeHtml(project.id)}">Verbinden</button><button class="mini-btn primary" type="button" data-action="create-project-task" data-id="${escapeHtml(project.id)}">Task fuer Projekt erstellen</button></div></div>`;
  }

  function renderTasks(tasks) {
    if (!tasks.length) return '<div class="project-empty">Noch keine Tasks verknuepft.</div>';
    return tasks.map(task => `<article class="project-task-row ${taskDone(task) ? 'is-done' : ''}"><div><strong>${escapeHtml(task.title)}</strong><span class="subtle">${escapeHtml(task.status || 'open')}${task.due_at ? ` · faellig ${escapeHtml(dateLabel(task.due_at))}` : ''}</span></div><button class="mini-btn" type="button" data-action="unlink-task" data-id="${escapeHtml(task.id)}">Loesen</button></article>`).join('');
  }

  function blurHiddenFormFocus() {
    const active = document.activeElement;
    const hiddenFormPanel = active?.closest?.('#projectFormPanel.hidden, #projectFormPanel[aria-hidden="true"]');
    if (hiddenFormPanel && typeof active.blur === 'function') active.blur();
  }

  function render(projectId) {
    blurHiddenFormFocus();
    const state = readState();
    const id = String(projectId || '');
    const project = (Array.isArray(state.projects) ? state.projects : []).find(item => String(item.id) === id && !item.is_archived);
    const modal = document.getElementById('projectDetailModal');
    const content = document.getElementById('projectDetailContent');
    if (!modal || !content) return false;
    if (!project) {
      currentProjectId = '';
      content.innerHTML = '';
      modal.classList.add('hidden');
      modal.classList.remove('project-mobile-detail-modal');
      document.body.classList.remove('project-modal-open');
      return false;
    }

    currentProjectId = project.id;
    const phases = projectPhases(state, project.id);
    const tasks = projectTasks(state, project.id);
    const progress = progressFor(project, state);
    const bounds = timelineBounds(project, phases);
    content.innerHTML = `<div class="project-detail-head"><p class="eyebrow">Projekt</p><h2>${escapeHtml(project.title)}</h2><p>${escapeHtml(project.description || 'Noch keine Beschreibung.')}</p></div>
      <div class="project-detail-grid">
        <article class="project-detail-box"><small>Status</small><h3><span class="badge ${statusClass(project.status)}">${statusLabel(project.status)}</span></h3><p class="subtle">${dateLabel(project.start_date)} bis ${dateLabel(project.end_date)}</p></article>
        <article class="project-detail-box"><small>Fortschritt</small><h3>${progress}%</h3><div class="project-progress-track"><i style="width:${progress}%"></i></div></article>
        <article class="project-detail-box"><small>Ziel / Outcome</small><p class="subtle">${escapeHtml(project.outcome_note || 'Noch kein Outcome notiert.')}</p></article>
        <article class="project-detail-box project-next-step"><small>Naechster sinnvoller Schritt</small><p>${escapeHtml(nextStep(project, state, progress))}</p></article>
      </div>
      <div class="project-section-head"><div><p class="eyebrow">Phasen / Gantt MVP</p><h3>Timeline</h3></div><span class="badge muted">${phases.length} Phase${phases.length === 1 ? '' : 'n'}</span></div>
      <form class="phase-form" data-project-phase-form data-project-id="${escapeHtml(project.id)}"><label><span>Phase</span><input name="name" required placeholder="z. B. Konzept" /></label><label><span>Start</span><input name="start_date" type="date" value="${escapeHtml(validDate(project.start_date) || todayDate())}" required /></label><label><span>Ende</span><input name="end_date" type="date" value="${escapeHtml(validDate(project.end_date) || validDate(project.start_date) || todayDate())}" required /></label><label><span>Status</span><select name="status"><option value="open">Offen</option><option value="active">In Arbeit</option><option value="done">Erledigt</option></select></label><button class="mini-btn primary" type="submit">Phase speichern</button></form>
      <div>${phases.length ? phases.map(phase => renderPhase(phase, bounds)).join('') : '<div class="project-empty">Noch keine Phasen. Erstelle die erste Projektphase.</div>'}</div>
      <div class="project-section-head"><div><p class="eyebrow">Tasks</p><h3>Verknuepfte Aufgaben</h3></div><span class="badge muted">${tasks.length} Task${tasks.length === 1 ? '' : 's'}</span></div>
      ${renderTaskTools(project, state)}
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
    if (error || currentProjectId !== projectId) return;
    const state = readState();
    const others = (Array.isArray(state.projectPhases) ? state.projectPhases : []).filter(phase => phase.project_id !== projectId);
    state.projectPhases = [...(data || []).map(row => ({ ...row, synced: true })), ...others];
    writeState(state);
    if (currentProjectId === projectId) render(projectId);
  }

  function scheduleOpen(projectId, delay = 0) {
    window.clearTimeout(openTimer);
    openTimer = window.setTimeout(() => {
      if (render(projectId)) hydrateRemote(projectId);
    }, delay);
  }

  function projectIdFromEvent(event) {
    const opener = event.target.closest?.('[data-action="open-project-detail"], .project-card');
    return opener?.dataset?.id || '';
  }

  function openFromEvent(event) {
    const projectId = projectIdFromEvent(event);
    if (!projectId) return;
    blurHiddenFormFocus();
    scheduleOpen(projectId, event.type === 'click' ? 40 : 0);
  }

  function rerenderSoon(projectId = currentProjectId) {
    if (!projectId) return;
    window.setTimeout(() => {
      const modal = document.getElementById('projectDetailModal');
      if (modal && !modal.classList.contains('hidden') && currentProjectId === projectId) render(projectId);
    }, 80);
  }

  document.addEventListener('pointerup', openFromEvent, true);
  document.addEventListener('touchend', openFromEvent, true);
  document.addEventListener('click', openFromEvent, true);

  document.addEventListener('submit', event => {
    if (event.target?.matches?.('[data-project-phase-form]')) rerenderSoon(event.target.dataset.projectId || currentProjectId);
  });

  document.addEventListener('click', event => {
    if (event.target?.id === 'projectDetailModal') {
      currentProjectId = '';
      document.getElementById('projectDetailModal')?.classList.remove('project-mobile-detail-modal');
      return;
    }
    const action = event.target.closest?.('[data-action]')?.dataset?.action;
    if (action === 'close-project-detail') {
      currentProjectId = '';
      document.getElementById('projectDetailModal')?.classList.remove('project-mobile-detail-modal');
      return;
    }
    if (action === 'close-project-form' || action === 'cancel-project-edit') window.setTimeout(blurHiddenFormFocus, 0);
    if (['edit-phase', 'delete-phase', 'link-selected-task', 'unlink-task', 'create-project-task', 'mark-project-done'].includes(action)) rerenderSoon();
  });
})(window, document);
