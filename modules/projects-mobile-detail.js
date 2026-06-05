(function stableProjectDetailOverlay(window, document) {
  'use strict';

  if (window.__habitFlowStableProjectOverlay) return;
  window.__habitFlowStableProjectOverlay = true;

  const STORAGE_KEY = 'habitflow-state-v1';
  const overlayId = 'projectDetailOverlaySafe';
  let lastOpen = { id: '', at: 0 };

  function readState() {
    try {
      const value = JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
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

  function dateLabel(value) {
    const dateValue = validDate(value);
    if (!dateValue) return '-';
    const date = new Date(`${dateValue}T12:00:00`);
    return date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });
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

  function createOverlay() {
    let overlay = document.getElementById(overlayId);
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(6,16,28,.58);backdrop-filter:blur(10px);overflow:auto;box-sizing:border-box;';
    document.body.appendChild(overlay);
    return overlay;
  }

  function phaseRows(phases) {
    if (!phases.length) return '<div style="padding:16px;border:1px dashed rgba(103,121,143,.28);border-radius:18px;color:#64748b;">Noch keine Phasen. Lege konkrete Projektphasen an.</div>';
    return phases.map(phase => `<article style="display:grid;grid-template-columns:minmax(120px,1fr) minmax(160px,1.2fr) auto;gap:12px;align-items:center;padding:12px;border:1px solid rgba(103,121,143,.14);border-radius:16px;margin-top:10px;background:rgba(248,250,252,.75);">
      <div><strong>${escapeHtml(phase.name)}</strong><div style="color:#64748b;font-size:.86rem;margin-top:3px;">${phaseLabel(phase.status)}</div></div>
      <div style="height:8px;border-radius:999px;background:#e7eef6;overflow:hidden;"><i style="display:block;height:100%;width:100%;border-radius:999px;background:linear-gradient(90deg,#4ad7d1,#8ff0a7);"></i></div>
      <div style="color:#64748b;font-size:.82rem;white-space:nowrap;">${dateLabel(phase.start_date)} - ${dateLabel(phase.end_date)}</div>
    </article>`).join('');
  }

  function taskRows(tasks) {
    if (!tasks.length) return '<div style="padding:16px;border:1px dashed rgba(103,121,143,.28);border-radius:18px;color:#64748b;">Noch keine Tasks verknuepft.</div>';
    return tasks.map(task => `<article style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px;border:1px solid rgba(103,121,143,.14);border-radius:16px;margin-top:10px;background:rgba(248,250,252,.75);${taskDone(task) ? 'opacity:.68;' : ''}">
      <div><strong>${escapeHtml(task.title)}</strong><div style="color:#64748b;font-size:.86rem;margin-top:3px;">${escapeHtml(task.status || 'open')}</div></div>
      ${task.due_at ? `<span style="color:#64748b;font-size:.82rem;">${dateLabel(task.due_at)}</span>` : ''}
    </article>`).join('');
  }

  function renderOverlay(projectId) {
    const state = readState();
    const projects = Array.isArray(state.projects) ? state.projects : [];
    const project = projects.find(item => String(item.id) === String(projectId) && !item.is_archived);
    if (!project) return false;

    const overlay = createOverlay();
    const phases = projectPhases(state, project.id);
    const tasks = projectTasks(state, project.id);
    const progress = progressFor(project, state);
    overlay.innerHTML = `<section style="width:min(980px,100%);max-height:92vh;overflow:auto;border-radius:30px;background:#fff;color:#0f172a;box-shadow:0 26px 80px rgba(15,23,42,.28);padding:22px;box-sizing:border-box;position:relative;">
      <button type="button" data-project-overlay-close style="position:absolute;right:16px;top:14px;border:0;background:#f1f5f9;color:#0f172a;border-radius:999px;width:38px;height:38px;font-size:22px;line-height:1;cursor:pointer;">×</button>
      <p style="margin:0 0 6px;color:#45c8c1;text-transform:uppercase;letter-spacing:.16em;font-size:.76rem;font-weight:900;">Projekt</p>
      <h2 style="margin:0;font-size:clamp(1.55rem,4vw,2.5rem);line-height:1.05;letter-spacing:-.04em;">${escapeHtml(project.title)}</h2>
      <p style="margin:10px 48px 18px 0;color:#64748b;line-height:1.5;">${escapeHtml(project.description || 'Noch keine Beschreibung.')}</p>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:18px;">
        <article style="padding:14px;border:1px solid #e7eef6;border-radius:18px;"><small style="display:block;color:#64748b;text-transform:uppercase;letter-spacing:.12em;font-weight:900;">Status</small><strong>${statusLabel(project.status)}</strong><div style="color:#64748b;margin-top:4px;">${dateLabel(project.start_date)} bis ${dateLabel(project.end_date)}</div></article>
        <article style="padding:14px;border:1px solid #e7eef6;border-radius:18px;"><small style="display:block;color:#64748b;text-transform:uppercase;letter-spacing:.12em;font-weight:900;">Fortschritt</small><strong>${progress}%</strong><div style="height:9px;background:#e7eef6;border-radius:999px;overflow:hidden;margin-top:8px;"><i style="display:block;height:100%;width:${progress}%;background:linear-gradient(90deg,#4ad7d1,#8ff0a7);"></i></div></article>
        <article style="padding:14px;border:1px solid #e7eef6;border-radius:18px;"><small style="display:block;color:#64748b;text-transform:uppercase;letter-spacing:.12em;font-weight:900;">Ziel / Outcome</small><p style="margin:6px 0 0;color:#64748b;">${escapeHtml(project.outcome_note || 'Noch kein Outcome notiert.')}</p></article>
        <article style="padding:14px;border:1px solid #c8f3ef;border-radius:18px;background:#f0fffc;"><small style="display:block;color:#64748b;text-transform:uppercase;letter-spacing:.12em;font-weight:900;">Naechster Schritt</small><p style="margin:6px 0 0;">${phases.length ? 'Naechste Phase pruefen und konkrete Tasks ableiten.' : 'Erstelle die erste Projektphase.'}</p></article>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:18px 0 10px;"><div><p style="margin:0;color:#45c8c1;text-transform:uppercase;letter-spacing:.16em;font-size:.76rem;font-weight:900;">Phasen / Gantt MVP</p><h3 style="margin:3px 0 0;">Timeline</h3></div><span style="font-size:.82rem;color:#64748b;font-weight:800;">${phases.length} Phase${phases.length === 1 ? '' : 'n'}</span></div>
      ${phaseRows(phases)}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:22px 0 10px;"><div><p style="margin:0;color:#45c8c1;text-transform:uppercase;letter-spacing:.16em;font-size:.76rem;font-weight:900;">Tasks</p><h3 style="margin:3px 0 0;">Verknuepfte Aufgaben</h3></div><span style="font-size:.82rem;color:#64748b;font-weight:800;">${tasks.length} Task${tasks.length === 1 ? '' : 's'}</span></div>
      ${taskRows(tasks)}
    </section>`;
    overlay.style.display = 'flex';
    document.body.classList.add('project-modal-open');
    return true;
  }

  function closeOverlay() {
    const overlay = document.getElementById(overlayId);
    if (overlay) {
      overlay.style.display = 'none';
      overlay.innerHTML = '';
    }
    document.body.classList.remove('project-modal-open');
  }

  function projectIdFromEvent(event) {
    const opener = event.target.closest?.('[data-action="open-project-detail"], .project-card');
    return opener?.dataset?.id || '';
  }

  function openFromEvent(event) {
    const projectId = projectIdFromEvent(event);
    if (!projectId) return;
    const now = Date.now();
    if (lastOpen.id === projectId && now - lastOpen.at < 180) return;
    lastOpen = { id: projectId, at: now };
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    renderOverlay(projectId);
  }

  document.addEventListener('pointerdown', openFromEvent, true);
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-project-overlay-close]') || event.target.id === overlayId) {
      event.preventDefault?.();
      event.stopPropagation?.();
      closeOverlay();
    }
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeOverlay();
  }, true);
})(window, document);
