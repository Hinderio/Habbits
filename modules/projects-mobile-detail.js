(function stabilizeNativeProjectDetails(window, document) {
  'use strict';

  if (window.__habitFlowNativeProjectDetailStable) return;
  window.__habitFlowNativeProjectDetailStable = true;

  const STORAGE_KEY = 'habitflow-state-v1';
  const DAY_MS = 86400000;
  let activeProjectId = '';
  let lastPointerOpenAt = 0;

  function readState() {
    try {
      const parsed = JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
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
    return date ? new Date(`${date}T12:00:00`).getTime() : NaN;
  }

  function todayDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function dateLabel(value) {
    const date = validDate(value);
    if (!date) return '-';
    return new Date(`${date}T12:00:00`).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });
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
    return (Array.isArray(state.tasks) ? state.tasks : []).filter(task => task.project_id === projectId || task.projectId === projectId);
  }

  function projectPhases(state, projectId) {
    return (Array.isArray(state.projectPhases) ? state.projectPhases : [])
      .filter(phase => (phase.project_id === projectId || phase.projectId === projectId) && !phase.is_archived)
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
    return { start, end: Number.isFinite(rawEnd) && rawEnd > start ? rawEnd : start + DAY_MS };
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
    const available = (Array.isArray(state.tasks) ? state.tasks : []).filter(task => !task.project_id && !task.projectId && (task.status || 'open') !== 'archived');
    const options = available.map(task => `<option value="${escapeHtml(task.id)}">${escapeHtml(task.title)}</option>`).join('');
    return `<div class="project-task-tools"><label><span class="subtle">Bestehenden Task verbinden</span><select id="projectTaskSelect"><option value="">Task auswaehlen</option>${options}</select></label><div class="list-actions"><button class="mini-btn" type="button" data-action="link-selected-task" data-id="${escapeHtml(project.id)}">Verbinden</button><button class="mini-btn primary" type="button" data-action="create-project-task" data-id="${escapeHtml(project.id)}">Task fuer Projekt erstellen</button></div></div>`;
  }

  function renderTasks(tasks) {
    if (!tasks.length) return '<div class="project-empty">Noch keine Tasks verknuepft.</div>';
    return tasks.map(task => `<article class="project-task-row ${taskDone(task) ? 'is-done' : ''}"><div><strong>${escapeHtml(task.title)}</strong><span class="subtle">${escapeHtml(task.status || 'open')}${task.due_at ? ` · faellig ${escapeHtml(dateLabel(task.due_at))}` : ''}</span></div><button class="mini-btn" type="button" data-action="unlink-task" data-id="${escapeHtml(task.id)}">Loesen</button></article>`).join('');
  }

  function ensureNativeModal() {
    let modal = document.getElementById('projectDetailModal');
    let content = document.getElementById('projectDetailContent');
    if (modal && content) return { modal, content };

    modal = modal || document.createElement('div');
    modal.id = 'projectDetailModal';
    modal.className = 'project-detail-modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = '<section class="project-detail-card"><button class="icon-btn project-detail-close" type="button" data-action="close-project-detail" aria-label="Projekt schliessen">×</button><div id="projectDetailContent"></div></section>';
    (document.querySelector('main.content') || document.body).appendChild(modal);
    content = modal.querySelector('#projectDetailContent');
    return { modal, content };
  }

  function openDetail(projectId) {
    const state = readState();
    const project = (Array.isArray(state.projects) ? state.projects : []).find(item => String(item.id) === String(projectId) && !item.is_archived);
    if (!project) return false;

    const { modal, content } = ensureNativeModal();
    if (!modal || !content) return false;

    activeProjectId = project.id;
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
    modal.removeAttribute('aria-hidden');
    document.body.classList.add('project-modal-open');
    return true;
  }

  function closeDetail() {
    activeProjectId = '';
    const modal = document.getElementById('projectDetailModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('project-modal-open');
  }

  function projectIdFromEvent(event) {
    const opener = event.target.closest?.('[data-action="open-project-detail"], .project-card');
    return opener?.dataset?.id || '';
  }

  function consume(event) {
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
  }

  function openFromEvent(event) {
    const projectId = projectIdFromEvent(event);
    if (!projectId) return;
    consume(event);
    lastPointerOpenAt = Date.now();
    openDetail(projectId);
  }

  document.addEventListener('pointerdown', openFromEvent, true);
  document.addEventListener('click', event => {
    const projectId = projectIdFromEvent(event);
    if (projectId) {
      consume(event);
      if (Date.now() - lastPointerOpenAt > 350) openDetail(projectId);
      return;
    }
    const modal = document.getElementById('projectDetailModal');
    const closeAction = event.target.closest?.('[data-action="close-project-detail"]');
    if (closeAction || (modal && event.target === modal)) {
      consume(event);
      closeDetail();
    }
  }, true);

  document.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && projectIdFromEvent(event)) openFromEvent(event);
    if (event.key === 'Escape' && !document.getElementById('projectDetailModal')?.classList.contains('hidden')) {
      consume(event);
      closeDetail();
    }
  }, true);

  document.addEventListener('submit', event => {
    if (event.target?.matches?.('[data-project-phase-form]')) {
      const projectId = event.target.dataset.projectId || activeProjectId;
      window.setTimeout(() => openDetail(projectId), 80);
    }
  });

  document.addEventListener('click', event => {
    const action = event.target.closest?.('[data-action]')?.dataset?.action;
    if (['edit-phase', 'delete-phase', 'link-selected-task', 'unlink-task', 'create-project-task', 'mark-project-done'].includes(action)) {
      window.setTimeout(() => activeProjectId && openDetail(activeProjectId), 120);
    }
  });
})(window, document);
