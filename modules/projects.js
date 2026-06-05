(function registerHabitFlowProjects(window, document) {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const TABLE_PROJECTS = 'projects';
  const TABLE_PHASES = 'project_phases';
  const STATUS = {
    planned: { label: 'Geplant', cls: 'project-status-planned' },
    active: { label: 'Aktiv', cls: 'project-status-active' },
    paused: { label: 'Pausiert', cls: 'project-status-paused' },
    done: { label: 'Abgeschlossen', cls: 'project-status-done' }
  };
  const PHASE_STATUS = { open: 'Offen', active: 'In Arbeit', done: 'Erledigt' };

  let editingProjectId = '';
  let selectedProjectId = '';
  let syncing = false;
  let client = null;

  function uid(prefix = 'project') {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function nowIso() { return new Date().toISOString(); }
  function todayDate() { return new Date().toISOString().slice(0, 10); }

  function escapeHtml(value = '') {
    return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function validDate(value) {
    const text = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(new Date(`${text}T12:00:00`).getTime()) ? text : '';
  }

  function validIso(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }

  function dateLabel(value) {
    if (!value) return '-';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  function toast(message) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.remove('hidden');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.add('hidden'), 2400);
  }

  function getSupabaseClient() {
    const config = window.HABITFLOW_SUPABASE_CONFIG || {};
    if (!config.url || !config.anonKey || !window.supabase?.createClient) return null;
    if (!client) {
      client = window.supabase.createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    }
    return client;
  }

  async function currentUserId() {
    try { return (await getSupabaseClient()?.auth.getUser())?.data?.user?.id || null; } catch { return null; }
  }

  function normalizeTask(task = {}) {
    return { ...task, project_id: task.project_id || task.projectId || null };
  }

  function normalizeProject(project = {}) {
    const created = validIso(project.created_at || project.createdAt) || nowIso();
    return {
      id: String(project.id || uid()),
      title: String(project.title || '').trim().slice(0, 120),
      description: String(project.description || '').trim().slice(0, 600),
      start_date: validDate(project.start_date || project.startDate) || todayDate(),
      end_date: validDate(project.end_date || project.endDate) || '',
      status: STATUS[project.status] ? project.status : 'planned',
      outcome_note: String(project.outcome_note || project.outcomeNote || '').trim().slice(0, 500),
      is_archived: Boolean(project.is_archived),
      created_at: created,
      updated_at: validIso(project.updated_at || project.updatedAt) || created,
      synced: project.synced === true
    };
  }

  function normalizePhase(phase = {}) {
    const created = validIso(phase.created_at || phase.createdAt) || nowIso();
    return {
      id: String(phase.id || uid('phase')),
      project_id: String(phase.project_id || phase.projectId || ''),
      name: String(phase.name || '').trim().slice(0, 100),
      start_date: validDate(phase.start_date || phase.startDate) || todayDate(),
      end_date: validDate(phase.end_date || phase.endDate) || validDate(phase.start_date || phase.startDate) || todayDate(),
      status: PHASE_STATUS[phase.status] ? phase.status : 'open',
      is_archived: Boolean(phase.is_archived),
      created_at: created,
      updated_at: validIso(phase.updated_at || phase.updatedAt) || created,
      synced: phase.synced === true
    };
  }

  function normalizeState(input = {}) {
    const next = { ...input };
    next.tasks = Array.isArray(next.tasks) ? next.tasks.map(normalizeTask) : [];
    next.projects = Array.isArray(next.projects) ? next.projects.map(normalizeProject).filter(project => project.id && project.title && !project.is_archived) : [];
    next.projectPhases = Array.isArray(next.projectPhases) ? next.projectPhases.map(normalizePhase).filter(phase => phase.id && phase.project_id && phase.name && !phase.is_archived) : [];
    return next;
  }

  function readState() {
    try {
      const parsed = JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || '{}');
      return normalizeState(parsed && typeof parsed === 'object' ? parsed : {});
    } catch (error) {
      console.warn('[HabitFlow/projects] State konnte nicht gelesen werden.', error);
      return normalizeState({});
    }
  }

  function writeState(next) {
    const state = normalizeState(next);
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  function mergeById(a = [], b = []) {
    const map = new Map();
    [...a, ...b].filter(item => item && item.id).forEach(item => {
      const current = map.get(item.id);
      if (!current || new Date(item.updated_at || item.created_at || 0) >= new Date(current.updated_at || current.created_at || 0)) map.set(item.id, item);
    });
    return Array.from(map.values());
  }

  function patchStatePersistence() {
    if (window.__habitFlowProjectsStoragePatched) return;
    window.__habitFlowProjectsStoragePatched = true;
    const originalSetItem = window.localStorage?.setItem?.bind(window.localStorage);
    if (!originalSetItem) return;
    window.localStorage.setItem = function patchedSetItem(key, value) {
      if (key !== STORAGE_KEY) return originalSetItem(key, value);
      try {
        const existing = normalizeState(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}'));
        const incoming = normalizeState(JSON.parse(String(value || '{}')));
        incoming.projects = mergeById(existing.projects, incoming.projects);
        incoming.projectPhases = mergeById(existing.projectPhases, incoming.projectPhases);
        const projectByTask = new Map(existing.tasks.filter(task => task.project_id).map(task => [task.id, task.project_id]));
        incoming.tasks = incoming.tasks.map(task => projectByTask.has(task.id) && !task.project_id ? { ...task, project_id: projectByTask.get(task.id) } : task);
        return originalSetItem(key, JSON.stringify(incoming));
      } catch (error) {
        console.warn('[HabitFlow/projects] Projektfelder konnten beim Speichern nicht gemerged werden.', error);
        return originalSetItem(key, value);
      }
    };
  }

  function projectTasks(state, projectId) {
    return state.tasks.filter(task => task.project_id === projectId && (task.status || 'open') !== 'archived');
  }

  function projectPhases(state, projectId) {
    return state.projectPhases.filter(phase => phase.project_id === projectId && !phase.is_archived).sort((a, b) => a.start_date.localeCompare(b.start_date));
  }

  function taskDone(task = {}) { return (task.status || 'open') === 'done'; }

  function progressFor(project, state) {
    const tasks = projectTasks(state, project.id);
    if (tasks.length) return Math.round((tasks.filter(taskDone).length / tasks.length) * 100);
    const phases = projectPhases(state, project.id);
    if (phases.length) return Math.round((phases.filter(phase => phase.status === 'done').length / phases.length) * 100);
    return 0;
  }

  function nextMilestone(project, state) {
    const phase = projectPhases(state, project.id).find(item => item.status !== 'done');
    if (phase) return phase.name;
    const task = projectTasks(state, project.id).find(item => !taskDone(item));
    if (task) return task.title;
    return project.status === 'done' ? 'Abgeschlossen' : 'Naechsten Schritt definieren';
  }

  function nextStep(project, state, progress) {
    const phases = projectPhases(state, project.id);
    const tasks = projectTasks(state, project.id);
    if (!phases.length) return 'Erstelle die erste Projektphase.';
    if (!tasks.length) return 'Lege konkrete Tasks fuer dieses Projekt an.';
    const end = project.end_date ? new Date(`${project.end_date}T23:59:59`).getTime() : null;
    if (end && end - Date.now() <= 7 * 86400000 && progress < 50) return 'Enddatum ist bald erreicht und der Fortschritt ist niedrig. Reduziere Scope oder plane den wichtigsten Task neu.';
    if (progress >= 100) return 'Alle Tasks oder Phasen sind erledigt. Das Projekt kann abgeschlossen werden.';
    return `Naechster Meilenstein: ${nextMilestone(project, state)}.`;
  }

  function ensureCss() {
    ['modules/projects.css', 'modules/projects-mobile-fix.css'].forEach(href => {
      if (document.querySelector(`link[href="${href}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    });
  }

  function injectShell() {
    ensureCss();
    const main = document.querySelector('main.content');
    const nav = document.querySelector('nav.bottom-nav');
    if (!main || !nav || document.getElementById('screen-projects')) return;

    const screen = document.createElement('section');
    screen.id = 'screen-projects';
    screen.className = 'screen projects-screen';
    screen.dataset.screen = 'projects';
    screen.hidden = true;
    screen.setAttribute('aria-hidden', 'true');
    screen.innerHTML = renderScreenShell();
    const tasksScreen = document.getElementById('screen-tasks');
    if (tasksScreen) main.insertBefore(screen, tasksScreen); else main.appendChild(screen);

    const btn = document.createElement('button');
    btn.dataset.target = 'projects';
    btn.className = 'nav-btn';
    btn.type = 'button';
    btn.innerHTML = '<span>▦</span>Projekte';
    const tasksBtn = nav.querySelector('[data-target="tasks"]');
    if (tasksBtn) nav.insertBefore(btn, tasksBtn); else nav.appendChild(btn);

    const modal = document.createElement('div');
    modal.id = 'projectDetailModal';
    modal.className = 'project-detail-modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = '<section class="project-detail-card"><button class="icon-btn project-detail-close" type="button" data-action="close-project-detail" aria-label="Projekt schliessen">×</button><div id="projectDetailContent"></div></section>';
    main.appendChild(modal);
  }

  function renderScreenShell() {
    return `<section class="projects-hero glass"><div><p class="eyebrow">Projektmanagement</p><h2>Projekte planen und ruhig steuern</h2><p>Start, Ende, Phasen, Fortschritt und verknuepfte Tasks in einem schlanken Cockpit.</p></div><button class="pill primary" type="button" data-action="toggle-project-form">Projekt erstellen</button></section>
    <section id="projectFormPanel" class="panel glass project-form-panel hidden" aria-hidden="true"><div class="panel-head"><div><p class="eyebrow">Projekt</p><h3 id="projectFormTitle">Projekt erstellen</h3></div><button class="icon-btn" type="button" data-action="close-project-form" aria-label="Projektformular schliessen">×</button></div><form id="projectForm" class="project-form-grid"><label class="full"><span>Titel</span><input name="title" required placeholder="z. B. Portfolio Relaunch" /></label><label class="full"><span>Beschreibung</span><textarea name="description" rows="3" placeholder="Worum geht es, und warum ist es wichtig?"></textarea></label><label><span>Startdatum</span><input name="start_date" type="date" required /></label><label><span>Enddatum</span><input name="end_date" type="date" /></label><label><span>Status</span><select name="status"><option value="planned">Geplant</option><option value="active">Aktiv</option><option value="paused">Pausiert</option><option value="done">Abgeschlossen</option></select></label><label class="full"><span>Zielnotiz / Outcome</span><textarea name="outcome_note" rows="2" placeholder="Woran erkennst du, dass das Projekt gelungen ist?"></textarea></label><div id="projectFormError" class="project-error full" role="status"></div><div class="form-actions full"><button class="pill primary" type="submit">Projekt speichern</button><button class="pill secondary" type="button" data-action="cancel-project-edit">Abbrechen</button></div></form></section>
    <section class="projects-summary" id="projectsSummary" aria-label="Projekt Kennzahlen"></section>
    <section class="panel glass"><div class="panel-head"><div><p class="eyebrow">Portfolio</p><h3>Projekt-Uebersicht</h3></div><span id="projectSyncStatus" class="badge muted">bereit</span></div><div id="projectsGrid" class="project-grid"></div></section>`;
  }

  function render() {
    const state = readState();
    renderSummary(state);
    const grid = document.getElementById('projectsGrid');
    if (grid) grid.innerHTML = state.projects.length ? state.projects.map(project => renderProjectCard(project, state)).join('') : '<div class="project-empty">Noch keine Projekte. Erstelle ein erstes Projekt mit Start, Ziel und den wichtigsten Phasen.</div>';
    if (selectedProjectId) renderDetail(selectedProjectId);
  }

  function renderSummary(state) {
    const node = document.getElementById('projectsSummary');
    if (!node) return;
    const active = state.projects.filter(project => project.status === 'active').length;
    const planned = state.projects.filter(project => project.status === 'planned').length;
    const done = state.projects.filter(project => project.status === 'done').length;
    const tasks = state.projects.reduce((count, project) => count + projectTasks(state, project.id).length, 0);
    node.innerHTML = `<article><small>Aktiv</small><strong>${active}</strong></article><article><small>Geplant</small><strong>${planned}</strong></article><article><small>Abgeschlossen</small><strong>${done}</strong></article><article><small>Verknuepfte Tasks</small><strong>${tasks}</strong></article>`;
  }

  function renderProjectCard(project, state) {
    const progress = progressFor(project, state);
    const tasks = projectTasks(state, project.id);
    const status = STATUS[project.status] || STATUS.planned;
    return `<button class="project-card" type="button" data-action="open-project-detail" data-id="${escapeHtml(project.id)}"><div class="project-card-head"><div><small>Projekt</small><h3>${escapeHtml(project.title)}</h3></div><span class="badge ${status.cls}">${status.label}</span></div><p>${escapeHtml(project.description || 'Noch keine Kurzbeschreibung hinterlegt.')}</p><div class="project-progress-track" aria-label="Fortschritt ${progress}%"><i style="width:${progress}%"></i></div><div class="project-card-meta"><div><small>Start</small><strong>${dateLabel(project.start_date)}</strong></div><div><small>Ende</small><strong>${dateLabel(project.end_date)}</strong></div><div><small>Fortschritt</small><strong>${progress}%</strong></div><div><small>Tasks</small><strong>${tasks.length}</strong></div></div><div class="project-card-footer"><span class="subtle">${escapeHtml(nextMilestone(project, state))}</span><span class="mini-btn">Oeffnen</span></div></button>`;
  }

  function renderDetail(projectId) {
    const state = readState();
    const project = state.projects.find(item => item.id === projectId);
    const node = document.getElementById('projectDetailContent');
    if (!node || !project) return;
    selectedProjectId = projectId;
    const progress = progressFor(project, state);
    const tasks = projectTasks(state, project.id);
    const phases = projectPhases(state, project.id);
    const status = STATUS[project.status] || STATUS.planned;
    node.innerHTML = `<div class="project-detail-head"><p class="eyebrow">Projekt</p><h2>${escapeHtml(project.title)}</h2><p>${escapeHtml(project.description || 'Noch keine Beschreibung.')}</p></div><div class="project-detail-grid"><article class="project-detail-box"><small>Status</small><h3><span class="badge ${status.cls}">${status.label}</span></h3><p class="subtle">${dateLabel(project.start_date)} bis ${dateLabel(project.end_date)}</p></article><article class="project-detail-box"><small>Fortschritt</small><h3>${progress}%</h3><div class="project-progress-track"><i style="width:${progress}%"></i></div></article><article class="project-detail-box"><small>Ziel / Outcome</small><p class="subtle">${escapeHtml(project.outcome_note || 'Noch kein Outcome notiert.')}</p></article><article class="project-detail-box project-next-step"><small>Naechster sinnvoller Schritt</small><p>${escapeHtml(nextStep(project, state, progress))}</p></article></div><div class="project-section-head"><div><p class="eyebrow">Phasen / Gantt MVP</p><h3>Timeline</h3></div><span class="badge muted">${phases.length} Phase${phases.length === 1 ? '' : 'n'}</span></div><form class="phase-form" data-project-phase-form data-project-id="${escapeHtml(project.id)}"><label><span>Phase</span><input name="name" required placeholder="z. B. Konzept" /></label><label><span>Start</span><input name="start_date" type="date" value="${escapeHtml(project.start_date || todayDate())}" required /></label><label><span>Ende</span><input name="end_date" type="date" value="${escapeHtml(project.end_date || project.start_date || todayDate())}" required /></label><label><span>Status</span><select name="status"><option value="open">Offen</option><option value="active">In Arbeit</option><option value="done">Erledigt</option></select></label><button class="mini-btn primary" type="submit">Phase speichern</button></form><div>${phases.length ? phases.map(phase => renderPhase(phase, project)).join('') : '<div class="project-empty">Noch keine Phasen. Erstelle die erste Projektphase.</div>'}</div><div class="project-section-head"><div><p class="eyebrow">Tasks</p><h3>Verknuepfte Aufgaben</h3></div><span class="badge muted">${tasks.length} Task${tasks.length === 1 ? '' : 's'}</span></div>${renderTaskTools(project, state)}<div class="project-task-list">${tasks.length ? tasks.map(task => renderTaskRow(task)).join('') : '<div class="project-empty">Noch keine Tasks verknuepft.</div>'}</div><div class="form-actions project-detail-actions"><button class="pill secondary" type="button" data-action="edit-project" data-id="${escapeHtml(project.id)}">Projekt bearbeiten</button><button class="pill secondary" type="button" data-action="mark-project-done" data-id="${escapeHtml(project.id)}">Als abgeschlossen markieren</button></div>`;
  }

  function renderPhase(phase, project) {
    const start = new Date(`${project.start_date || phase.start_date}T12:00:00`).getTime();
    const end = new Date(`${project.end_date || phase.end_date || project.start_date}T12:00:00`).getTime();
    const phaseStart = new Date(`${phase.start_date}T12:00:00`).getTime();
    const phaseEnd = new Date(`${phase.end_date}T12:00:00`).getTime();
    const span = Math.max(1, end - start);
    const left = Math.max(0, Math.min(96, ((phaseStart - start) / span) * 100));
    const width = Math.max(8, Math.min(100 - left, ((phaseEnd - phaseStart || 86400000) / span) * 100));
    return `<article class="phase-card"><div><strong>${escapeHtml(phase.name)}</strong><span class="subtle">${PHASE_STATUS[phase.status]}</span></div><div class="phase-timeline"><div class="phase-timeline-track"><i style="margin-left:${left}%;width:${width}%"></i></div><div class="phase-timeline-dates"><span>${dateLabel(phase.start_date)}</span><span>${dateLabel(phase.end_date)}</span></div></div><div class="list-actions"><button class="mini-btn" type="button" data-action="edit-phase" data-id="${escapeHtml(phase.id)}">Bearbeiten</button><button class="mini-btn danger" type="button" data-action="delete-phase" data-id="${escapeHtml(phase.id)}">Loeschen</button></div></article>`;
  }

  function renderTaskTools(project, state) {
    const available = state.tasks.filter(task => !task.project_id && (task.status || 'open') !== 'archived');
    const options = available.map(task => `<option value="${escapeHtml(task.id)}">${escapeHtml(task.title)}</option>`).join('');
    return `<div class="project-task-tools"><label><span class="subtle">Bestehenden Task verbinden</span><select id="projectTaskSelect"><option value="">Task auswaehlen</option>${options}</select></label><div class="list-actions"><button class="mini-btn" type="button" data-action="link-selected-task" data-id="${escapeHtml(project.id)}">Verbinden</button><button class="mini-btn primary" type="button" data-action="create-project-task" data-id="${escapeHtml(project.id)}">Task fuer Projekt erstellen</button></div></div>`;
  }

  function renderTaskRow(task) {
    return `<article class="project-task-row ${taskDone(task) ? 'is-done' : ''}"><div><strong>${escapeHtml(task.title)}</strong><span class="subtle">${escapeHtml(task.status || 'open')}${task.due_at ? ` · faellig ${escapeHtml(dateLabel(task.due_at))}` : ''}</span></div><button class="mini-btn" type="button" data-action="unlink-task" data-id="${escapeHtml(task.id)}">Loesen</button></article>`;
  }

  function openForm(projectId = '') {
    const panel = document.getElementById('projectFormPanel');
    const form = document.getElementById('projectForm');
    if (!panel || !form) return;
    editingProjectId = projectId;
    const project = projectId ? readState().projects.find(item => item.id === projectId) : null;
    document.getElementById('projectFormTitle').textContent = project ? 'Projekt bearbeiten' : 'Projekt erstellen';
    form.elements.title.value = project?.title || '';
    form.elements.description.value = project?.description || '';
    form.elements.start_date.value = project?.start_date || todayDate();
    form.elements.end_date.value = project?.end_date || '';
    form.elements.status.value = project?.status || 'planned';
    form.elements.outcome_note.value = project?.outcome_note || '';
    setProjectError('');
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden', 'false');
  }

  function closeForm() {
    editingProjectId = '';
    const panel = document.getElementById('projectFormPanel');
    if (panel) {
      panel.classList.add('hidden');
      panel.setAttribute('aria-hidden', 'true');
    }
  }

  function setProjectError(text) {
    const node = document.getElementById('projectFormError');
    if (node) node.textContent = text || '';
  }

  async function requireRemoteUser() {
    const supabase = getSupabaseClient();
    const userId = await currentUserId();
    if (!supabase || !userId) throw new Error('Supabase ist nicht verbunden.');
    return { supabase, userId };
  }

  async function saveProject(event) {
    event.preventDefault();
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const start = validDate(data.get('start_date')) || todayDate();
    const end = validDate(data.get('end_date'));
    if (!title) return setProjectError('Titel ist Pflicht.');
    if (end && end < start) return setProjectError('Enddatum darf nicht vor dem Startdatum liegen.');

    try {
      const state = readState();
      const existing = editingProjectId ? state.projects.find(item => item.id === editingProjectId) : null;
      const now = nowIso();
      const project = normalizeProject({ ...(existing || {}), id: existing?.id || uid(), title, description: data.get('description'), start_date: start, end_date: end, status: data.get('status'), outcome_note: data.get('outcome_note'), created_at: existing?.created_at || now, updated_at: now, synced: true });
      const { supabase, userId } = await requireRemoteUser();
      const row = { id: project.id, user_id: userId, title: project.title, description: project.description || null, start_date: project.start_date || null, end_date: project.end_date || null, status: project.status, outcome_note: project.outcome_note || null, is_archived: false, created_at: project.created_at, updated_at: project.updated_at };
      const { error } = await supabase.from(TABLE_PROJECTS).upsert(row, { onConflict: 'id' });
      if (error) throw error;
      state.projects = existing ? state.projects.map(item => item.id === project.id ? project : item) : [project, ...state.projects];
      writeState(state);
      closeForm();
      openDetail(project.id);
      toast('Projekt gespeichert');
    } catch (error) {
      console.warn('[HabitFlow/projects] Projekt konnte nicht gespeichert werden.', error);
      setProjectError(error.message || 'Projekt konnte nicht gespeichert werden.');
    }
  }

  async function savePhase(event) {
    event.preventDefault();
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const data = new FormData(form);
    const projectId = form.dataset.projectId;
    const name = String(data.get('name') || '').trim();
    const start = validDate(data.get('start_date'));
    const end = validDate(data.get('end_date'));
    if (!projectId) return toast('Projekt konnte fuer die Phase nicht gefunden werden.');
    if (!name || !start || !end) return toast('Phase braucht Name, Start und Ende.');
    if (end < start) return toast('Phasenende darf nicht vor Start liegen.');

    try {
      const now = nowIso();
      const phase = normalizePhase({ id: uid('phase'), project_id: projectId, name, start_date: start, end_date: end, status: data.get('status'), created_at: now, updated_at: now, synced: true });
      const { supabase, userId } = await requireRemoteUser();
      const row = { id: phase.id, user_id: userId, project_id: phase.project_id, name: phase.name, start_date: phase.start_date, end_date: phase.end_date, status: phase.status, is_archived: false, created_at: phase.created_at, updated_at: phase.updated_at };
      const { error } = await supabase.from(TABLE_PHASES).upsert(row, { onConflict: 'id' });
      if (error) throw error;
      const state = readState();
      state.projectPhases = [phase, ...state.projectPhases.filter(item => item.id !== phase.id)];
      writeState(state);
      form.reset();
      renderDetail(projectId);
      render();
      toast('Phase gespeichert');
    } catch (error) {
      console.warn('[HabitFlow/projects] Phase konnte nicht gespeichert werden.', error);
      toast(error.message || 'Phase konnte nicht gespeichert werden.');
    }
  }

  async function editPhase(id) {
    const state = readState();
    const phase = state.projectPhases.find(item => item.id === id);
    if (!phase) return;
    const name = prompt('Phasenname', phase.name);
    if (name == null) return;
    const start = prompt('Startdatum YYYY-MM-DD', phase.start_date);
    if (start == null) return;
    const end = prompt('Enddatum YYYY-MM-DD', phase.end_date);
    if (end == null) return;
    const status = prompt('Status: open, active, done', phase.status);
    if (!String(name).trim() || !validDate(start) || !validDate(end) || validDate(end) < validDate(start)) return toast('Ungueltige Phasendaten.');
    try {
      const updated = normalizePhase({ ...phase, name, start_date: start, end_date: end, status, updated_at: nowIso(), synced: true });
      const { supabase, userId } = await requireRemoteUser();
      const row = { id: updated.id, user_id: userId, project_id: updated.project_id, name: updated.name, start_date: updated.start_date, end_date: updated.end_date, status: updated.status, is_archived: false, created_at: updated.created_at, updated_at: updated.updated_at };
      const { error } = await supabase.from(TABLE_PHASES).upsert(row, { onConflict: 'id' });
      if (error) throw error;
      state.projectPhases = state.projectPhases.map(item => item.id === id ? updated : item);
      writeState(state);
      renderDetail(updated.project_id);
      render();
      toast('Phase aktualisiert');
    } catch (error) {
      toast(error.message || 'Phase konnte nicht aktualisiert werden.');
    }
  }

  async function deletePhase(id) {
    const state = readState();
    const phase = state.projectPhases.find(item => item.id === id);
    if (!phase) return;
    try {
      const { supabase } = await requireRemoteUser();
      const { error } = await supabase.from(TABLE_PHASES).update({ is_archived: true, updated_at: nowIso() }).eq('id', id);
      if (error) throw error;
      state.projectPhases = state.projectPhases.filter(item => item.id !== id);
      writeState(state);
      renderDetail(phase.project_id);
      render();
      toast('Phase geloescht');
    } catch (error) {
      toast(error.message || 'Phase konnte nicht geloescht werden.');
    }
  }

  async function linkTask(projectId, taskId) {
    if (!taskId) return toast('Bitte Task auswaehlen.');
    try {
      const { supabase } = await requireRemoteUser();
      const { error } = await supabase.from('tasks').update({ project_id: projectId, updated_at: nowIso() }).eq('id', taskId);
      if (error) throw error;
      const state = readState();
      state.tasks = state.tasks.map(task => task.id === taskId ? { ...task, project_id: projectId, updated_at: nowIso(), synced: true } : task);
      writeState(state);
      renderDetail(projectId);
      render();
      toast('Task verknuepft');
    } catch (error) {
      toast(error.message || 'Task konnte nicht verknuepft werden.');
    }
  }

  async function unlinkTask(taskId) {
    const state = readState();
    const task = state.tasks.find(item => item.id === taskId);
    if (!task) return;
    try {
      const { supabase } = await requireRemoteUser();
      const { error } = await supabase.from('tasks').update({ project_id: null, updated_at: nowIso() }).eq('id', taskId);
      if (error) throw error;
      state.tasks = state.tasks.map(item => item.id === taskId ? { ...item, project_id: null, updated_at: nowIso(), synced: true } : item);
      writeState(state);
      renderDetail(task.project_id);
      render();
      toast('Task geloest');
    } catch (error) {
      toast(error.message || 'Task konnte nicht geloest werden.');
    }
  }

  async function createProjectTask(projectId) {
    const title = prompt('Task-Titel fuer dieses Projekt');
    if (!String(title || '').trim()) return;
    try {
      const now = nowIso();
      const task = { id: uid('task'), title: String(title).trim(), description: '', effort: 3, priority: 'medium', status: 'open', due_at: null, completed_at: null, points: 0, project_id: projectId, created_at: now, updated_at: now, synced: true };
      const { supabase, userId } = await requireRemoteUser();
      const row = { id: task.id, user_id: userId, title: task.title, description: null, effort: 3, priority: 'medium', status: 'open', due_at: null, completed_at: null, points: 0, project_id: projectId, created_at: now, updated_at: now };
      const { error } = await supabase.from('tasks').upsert(row, { onConflict: 'id' });
      if (error) throw error;
      const state = readState();
      state.tasks = [task, ...state.tasks];
      writeState(state);
      renderDetail(projectId);
      render();
      toast('Projekt-Task erstellt');
    } catch (error) {
      toast(error.message || 'Projekt-Task konnte nicht erstellt werden.');
    }
  }

  async function markProjectDone(projectId) {
    const state = readState();
    const project = state.projects.find(item => item.id === projectId);
    if (!project) return;
    const updatedAt = nowIso();
    try {
      const { supabase } = await requireRemoteUser();
      const { error } = await supabase.from(TABLE_PROJECTS).update({ status: 'done', updated_at: updatedAt }).eq('id', projectId);
      if (error) throw error;
      state.projects = state.projects.map(item => item.id === projectId ? { ...item, status: 'done', updated_at: updatedAt, synced: true } : item);
      writeState(state);
      renderDetail(projectId);
      render();
      toast('Projekt abgeschlossen');
    } catch (error) {
      toast(error.message || 'Projekt konnte nicht abgeschlossen werden.');
    }
  }

  async function openDetail(projectId) {
    selectedProjectId = projectId;
    renderDetail(projectId);
    const modal = document.getElementById('projectDetailModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.classList.add('project-modal-open');
    await pullRemoteProjectData(projectId).catch(error => console.warn('[HabitFlow/projects] Projekt konnte nicht nachgeladen werden.', error));
  }

  function closeDetail() {
    selectedProjectId = '';
    document.getElementById('projectDetailModal')?.classList.add('hidden');
    document.body.classList.remove('project-modal-open');
    pullRemoteProjectData('', { silent: true }).catch(error => console.warn('[HabitFlow/projects] Projektliste konnte nicht nachgeladen werden.', error));
  }

  async function pullRemoteProjectData(projectId = '', options = {}) {
    const supabase = getSupabaseClient();
    const userId = await currentUserId();
    if (!supabase || !userId || syncing) return;
    syncing = true;
    if (!options.silent) setSyncStatus('synchronisiert...');
    try {
      const projectQuery = supabase.from(TABLE_PROJECTS).select('*').eq('user_id', userId).eq('is_archived', false);
      let phaseQuery = supabase.from(TABLE_PHASES).select('*').eq('user_id', userId).eq('is_archived', false);
      if (projectId) phaseQuery = phaseQuery.eq('project_id', projectId);
      const [projectsRemote, phasesRemote] = await Promise.all([projectQuery, phaseQuery]);
      if (projectsRemote.error) throw projectsRemote.error;
      if (phasesRemote.error) throw phasesRemote.error;
      const state = readState();
      const remoteProjects = (projectsRemote.data || []).map(row => normalizeProject({ ...row, synced: true }));
      const remotePhases = (phasesRemote.data || []).map(row => normalizePhase({ ...row, synced: true }));
      state.projects = mergeById(state.projects, remoteProjects);
      state.projectPhases = projectId ? [...remotePhases, ...state.projectPhases.filter(phase => phase.project_id !== projectId)] : remotePhases;
      writeState(state);
      if (!options.silent) setSyncStatus('synchronisiert');
      render();
    } catch (error) {
      if (!options.silent) setSyncStatus('Sync-Fehler');
      console.warn('[HabitFlow/projects] Sync fehlgeschlagen.', error);
    } finally {
      syncing = false;
    }
  }

  function setSyncStatus(text) {
    const node = document.getElementById('projectSyncStatus');
    if (node) node.textContent = text;
  }

  function bindEvents() {
    if (window.__habitFlowProjectsEventsBound) return;
    window.__habitFlowProjectsEventsBound = true;
    document.addEventListener('submit', event => {
      if (event.target?.id === 'projectForm') saveProject(event);
      if (event.target?.matches?.('[data-project-phase-form]')) savePhase(event);
    });
    document.addEventListener('click', event => {
      const actionEl = event.target.closest?.('[data-action]');
      if (!actionEl) return;
      const action = actionEl.dataset.action;
      const id = actionEl.dataset.id;
      if (action === 'toggle-project-form') openForm();
      if (action === 'close-project-form' || action === 'cancel-project-edit') closeForm();
      if (action === 'open-project-detail') openDetail(id);
      if (action === 'close-project-detail') closeDetail();
      if (action === 'edit-project') openForm(id);
      if (action === 'mark-project-done') markProjectDone(id);
      if (action === 'edit-phase') editPhase(id);
      if (action === 'delete-phase') deletePhase(id);
      if (action === 'link-selected-task') linkTask(id, document.getElementById('projectTaskSelect')?.value || '');
      if (action === 'unlink-task') unlinkTask(id);
      if (action === 'create-project-task') createProjectTask(id);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !document.getElementById('projectDetailModal')?.classList.contains('hidden')) closeDetail();
    });
    document.getElementById('projectDetailModal')?.addEventListener('click', event => {
      if (event.target.id === 'projectDetailModal') closeDetail();
    });
  }

  function boot() {
    patchStatePersistence();
    injectShell();
    bindEvents();
    render();
    setTimeout(() => pullRemoteProjectData(), 500);
    setTimeout(() => pullRemoteProjectData('', { silent: true }), 2500);
  }

  patchStatePersistence();
  if (document.readyState === 'loading') {
    injectShell();
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})(window, document);
