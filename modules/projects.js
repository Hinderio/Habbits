(function registerHabitFlowProjects(window, document) {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const DELETED_RECORDS_KEY = 'habitflow-project-deleted-records-v1';
  const TABLE_PROJECTS = 'projects';
  const TABLE_PHASES = 'project_phases';
  const TABLE_MILESTONES = 'project_milestones';
  const TABLE_NOTES = 'project_notes';
  const DEFAULT_PROJECT_COLOR = '#4ad7d1';
  const PROJECT_META_RE = /\n?\s*<!--hf-project-meta:([^>]+)-->/;
  const CLOSED_TASK_STATUSES = new Set(['done', 'archived', 'closed', 'completed']);
  const STATUS = {
    planned: { label: 'Geplant', cls: 'project-status-planned' },
    active: { label: 'Aktiv', cls: 'project-status-active' },
    paused: { label: 'Pausiert', cls: 'project-status-paused' },
    done: { label: 'Abgeschlossen', cls: 'project-status-done' }
  };
  const PHASE_STATUS = { open: 'Offen', active: 'In Arbeit', done: 'Erledigt' };
  const PROJECT_ACTION_ICONS = {
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4.4L19.7 8.7a2.1 2.1 0 0 0 0-3l-1.4-1.4a2.1 2.1 0 0 0-3 0L4 15.6V20Z"></path><path d="m13.8 5.8 4.4 4.4"></path></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 7V5h6v2"></path><path d="M7 7l1 13h8l1-13"></path></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>'
  };

  let editingProjectId = '';
  let selectedProjectId = '';
  let projectTaskReturn = null;
  let syncing = false;
  let client = null;
  let taskBadgeRaf = 0;
  let taskLinkRefreshTimer = 0;
  let workspaceTab = 'cockpit', workspaceProject = '', workspaceState = null;
  let workspaceReady = false, workspaceSyncMessage = '', workspaceGeneration = 0, workspaceRaf = 0;
  let knowledgeFilter = 'all', knowledgeQuery = '', knowledgeLimit = 20, knowledgeBusy = false;
  let knowledgeRows = [], knowledgeKey = null, projectNoteLimit = 20, projectAuthEpoch = 0;
  const workspaceLoaded = new Set();
  const workspaceModel = () => window.HabitFlowProjectWorkspaceModel;


  function uid(prefix = 'project') {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function nowIso() { return new Date().toISOString(); }
  function todayDate() { return new Date().toISOString().slice(0, 10); }
  function escapeHtml(value = '') { return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
  function validDate(value) { const text = String(value || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(new Date(`${text}T12:00:00`).getTime()) ? text : ''; }
  function validIso(value) { if (!value) return ''; const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toISOString(); }
  function normalizeProjectColor(value) { const color = String(value || '').trim(); return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(color) ? color : DEFAULT_PROJECT_COLOR; }

  function parseProjectMeta(value = '') {
    const raw = String(value || '');
    const match = raw.match(PROJECT_META_RE);
    if (!match) return { text: raw, meta: {} };
    try { return { text: raw.replace(PROJECT_META_RE, '').trim(), meta: JSON.parse(decodeURIComponent(match[1])) || {} }; }
    catch { return { text: raw.replace(PROJECT_META_RE, '').trim(), meta: {} }; }
  }

  function projectOutcomeForStorage(project = {}) {
    const text = String(project.outcome_note || '').trim();
    const meta = encodeURIComponent(JSON.stringify({ color: normalizeProjectColor(project.color) }));
    return `${text ? `${text}\n\n` : ''}<!--hf-project-meta:${meta}-->`;
  }

  function isMissingRemoteColumnError(error, column) {
    const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return text.includes(column.toLowerCase()) && (text.includes('schema cache') || text.includes('column'));
  }

  function isMissingRemoteRelationError(error) {
    const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return text.includes('does not exist') || text.includes('schema cache') || text.includes('relation');
  }

  function dedupeById(items = []) {
    if (!Array.isArray(items)) return [];
    const map = new Map();
    items.forEach(item => {
      if (!item?.id) return;
      const current = map.get(item.id);
      if (!current || new Date(item.updated_at || item.created_at || 0) >= new Date(current.updated_at || current.created_at || 0)) map.set(item.id, item);
    });
    return Array.from(map.values());
  }

  function readDeletedProjectRecords() {
    try {
      const stored = JSON.parse(window.localStorage?.getItem(DELETED_RECORDS_KEY) || '{}');
      return {
        [TABLE_PHASES]: new Set(Array.isArray(stored[TABLE_PHASES]) ? stored[TABLE_PHASES].map(String) : []),
        [TABLE_MILESTONES]: new Set(Array.isArray(stored[TABLE_MILESTONES]) ? stored[TABLE_MILESTONES].map(String) : []),
        [TABLE_NOTES]: new Set(Array.isArray(stored[TABLE_NOTES]) ? stored[TABLE_NOTES].map(String) : [])
      };
    } catch {
      return { [TABLE_PHASES]: new Set(), [TABLE_MILESTONES]: new Set(), [TABLE_NOTES]: new Set() };
    }
  }

  function projectRecordWasDeleted(table, id) {
    return readDeletedProjectRecords()[table]?.has(String(id)) || false;
  }

  function rememberDeletedProjectRecord(table, id) {
    const deleted = readDeletedProjectRecords();
    deleted[table]?.add(String(id));
    window.localStorage?.setItem(DELETED_RECORDS_KEY, JSON.stringify({
      [TABLE_PHASES]: Array.from(deleted[TABLE_PHASES]),
      [TABLE_MILESTONES]: Array.from(deleted[TABLE_MILESTONES]),
      [TABLE_NOTES]: Array.from(deleted[TABLE_NOTES])
    }));
  }

  function projectInitials(title = '') {
    const words = String(title || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 'PR';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
  }

  function milestoneAbbr(title = '') {
    const words = String(title || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 'MS';
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
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
    if (!client) client = window.supabase.createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    return client;
  }

  async function currentUserId() { try { return (await getSupabaseClient()?.auth.getUser())?.data?.user?.id || null; } catch { return null; } }
  function normalizeTask(task = {}) { return { ...task, project_id: task.project_id || task.projectId || null }; }

  function normalizeProject(project = {}) {
    const created = validIso(project.created_at || project.createdAt) || nowIso();
    const outcome = parseProjectMeta(project.outcome_note || project.outcomeNote || '');
    return {
      id: String(project.id || uid()),
      title: String(project.title || '').trim().slice(0, 120),
      description: String(project.description || '').trim().slice(0, 600),
      start_date: validDate(project.start_date || project.startDate) || todayDate(),
      end_date: validDate(project.end_date || project.endDate) || '',
      status: STATUS[project.status] ? project.status : 'planned',
      outcome_note: String(outcome.text || '').trim().slice(0, 500),
      color: normalizeProjectColor(project.color || outcome.meta.color),
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

  function normalizeMilestone(milestone = {}) {
    const created = validIso(milestone.created_at || milestone.createdAt) || nowIso();
    return {
      id: String(milestone.id || uid('milestone')),
      project_id: String(milestone.project_id || milestone.projectId || ''),
      phase_id: String(milestone.phase_id || milestone.phaseId || ''),
      title: String(milestone.title || milestone.name || '').trim().slice(0, 100),
      milestone_date: validDate(milestone.milestone_date || milestone.date || milestone.due_date) || todayDate(),
      is_archived: Boolean(milestone.is_archived),
      created_at: created,
      updated_at: validIso(milestone.updated_at || milestone.updatedAt) || created,
      synced: milestone.synced === true
    };
  }

  function normalizeProjectNote(note = {}) {
    const created = validIso(note.created_at || note.createdAt) || nowIso();
    return {
      id: String(note.id || uid('note')),
      project_id: String(note.project_id || note.projectId || ''),
      category: String(note.category || 'Allgemein').trim().slice(0, 60) || 'Allgemein',
      body: String(note.body || note.text || '').trim().slice(0, 2000),
      is_archived: Boolean(note.is_archived),
      created_at: created,
      updated_at: validIso(note.updated_at || note.updatedAt) || created,
      synced: note.synced === true
    };
  }

  function normalizeState(input = {}) {
    const next = { ...input };
    const deleted = readDeletedProjectRecords();
    next.tasks = Array.isArray(next.tasks) ? dedupeById(next.tasks.map(normalizeTask)) : [];
    next.projects = Array.isArray(next.projects) ? next.projects.map(normalizeProject).filter(project => project.id && project.title && !project.is_archived) : [];
    // Keep archived records as tombstones so the merge layer cannot resurrect deleted rows.
    next.projectPhases = Array.isArray(next.projectPhases) ? next.projectPhases.map(normalizePhase).map(phase => deleted[TABLE_PHASES].has(phase.id) ? { ...phase, is_archived: true } : phase).filter(phase => phase.id && phase.project_id && phase.name) : [];
    next.projectMilestones = Array.isArray(next.projectMilestones) ? next.projectMilestones.map(normalizeMilestone).map(item => deleted[TABLE_MILESTONES].has(item.id) ? { ...item, is_archived: true } : item).filter(item => item.id && item.project_id && item.title) : [];
    next.projectNotes = Array.isArray(next.projectNotes) ? next.projectNotes.map(normalizeProjectNote).map(item => deleted[TABLE_NOTES].has(item.id) ? { ...item, is_archived: true } : item).filter(item => item.id && item.project_id && item.body) : [];
    if (Array.isArray(next.pointsLedger)) next.pointsLedger = dedupeById(next.pointsLedger);
    return next;
  }

  function readState() {
    try { return normalizeState(JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || '{}')); }
    catch (error) { console.warn('[HabitFlow/projects] State konnte nicht gelesen werden.', error); return normalizeState({}); }
  }

  function writeState(next) {
    const state = normalizeState(next);
    if (window.HabitFlowPersistence) window.HabitFlowPersistence.writeState(state);
    else window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
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

  function mergePersistedProjectState(previous, next) {
    const existing = normalizeState(previous);
    const incoming = normalizeState(next);
    incoming.projects = mergeById(existing.projects, incoming.projects);
    incoming.projectPhases = mergeById(existing.projectPhases, incoming.projectPhases);
    incoming.projectMilestones = mergeById(existing.projectMilestones, incoming.projectMilestones);
    incoming.projectNotes = mergeById(existing.projectNotes, incoming.projectNotes);
    const projectByTask = new Map(existing.tasks.filter(task => task.project_id).map(task => [task.id, task.project_id]));
    incoming.tasks = incoming.tasks.map(task => projectByTask.has(task.id) && !task.project_id && !task.project_link_cleared_at ? { ...task, project_id: projectByTask.get(task.id) } : task);
    return incoming;
  }

  function patchStatePersistence() {
    if (window.__habitFlowProjectsStoragePatched) return;
    window.__habitFlowProjectsStoragePatched = true;
    if (window.HabitFlowPersistence) {
      window.HabitFlowPersistence.register('projects', {
        write(state, context) {
          const incoming = mergePersistedProjectState(context.previous(), state);
          return { state: incoming, changed: true };
        }
      });
      return;
    }
    const originalSetItem = window.localStorage?.setItem?.bind(window.localStorage);
    if (!originalSetItem) return;
    window.localStorage.setItem = function patchedSetItem(key, value) {
      if (key !== STORAGE_KEY) return originalSetItem(key, value);
      try {
        const incoming = mergePersistedProjectState(
          JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}'),
          JSON.parse(String(value || '{}'))
        );
        return originalSetItem(key, JSON.stringify(incoming));
      } catch (error) {
        console.warn('[HabitFlow/projects] Projektfelder konnten beim Speichern nicht gemerged werden.', error);
        return originalSetItem(key, value);
      }
    };
  }

  function projectTasks(state, projectId) { return state.tasks.filter(task => task.project_id === projectId && !task.is_archived); }
  function projectPhases(state, projectId) { return state.projectPhases.filter(phase => phase.project_id === projectId && !phase.is_archived && !projectRecordWasDeleted(TABLE_PHASES, phase.id)).sort((a, b) => a.start_date.localeCompare(b.start_date)); }
  function projectMilestones(state, projectId) { return state.projectMilestones.filter(item => item.project_id === projectId && !item.is_archived && !projectRecordWasDeleted(TABLE_MILESTONES, item.id)).sort((a, b) => a.milestone_date.localeCompare(b.milestone_date)); }
  function projectNotes(state, projectId) { return state.projectNotes.filter(item => item.project_id === projectId && !item.is_archived && !projectRecordWasDeleted(TABLE_NOTES, item.id)).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))); }
  function milestonePhaseLabel(milestone, phases = []) { return milestone.phase_id ? (phases.find(phase => phase.id === milestone.phase_id)?.name || 'Phase') : 'Projektweit'; }
  function milestonesForPhase(milestones = [], phaseId = '') { return milestones.filter(item => !item.phase_id || item.phase_id === phaseId); }
  function phaseOptions(phases = [], selectedPhaseId = '') { return `<option value="">Projektweit</option>${phases.map(phase => `<option value="${escapeHtml(phase.id)}" ${phase.id === selectedPhaseId ? 'selected' : ''}>${escapeHtml(phase.name)}</option>`).join('')}`; }
  function taskDone(task = {}) { return (task.status || 'open') === 'done'; }
  function taskClosedForLinking(task = {}) { const status = String(task.status || task.state || '').toLowerCase(); return CLOSED_TASK_STATUSES.has(status) || Boolean(task.is_archived) || Boolean(task.done_archived_at) || status === 'archived'; }

  function projectActionButton(action, id, label, icon, deleteTone = false) {
    const tone = deleteTone ? ' project-icon-action-delete' : ' project-icon-action-edit';
    return `<button class="mini-btn project-icon-action${tone}" type="button" data-action="${action}" data-id="${escapeHtml(id)}" data-polished="true" aria-label="${label}" title="${label}">${PROJECT_ACTION_ICONS[icon]}</button>`;
  }

  function progressFor(project, state) {
    const tasks = projectTasks(state, project.id);
    if (tasks.length) return Math.round((tasks.filter(taskDone).length / tasks.length) * 100);
    const phases = projectPhases(state, project.id);
    if (phases.length) return Math.round((phases.filter(phase => phase.status === 'done').length / phases.length) * 100);
    return 0;
  }

  function nextMilestone(project, state) {
    const upcoming = projectMilestones(state, project.id).find(item => item.milestone_date >= todayDate());
    if (upcoming) return upcoming.title;
    const phase = projectPhases(state, project.id).find(item => item.status !== 'done');
    if (phase) return phase.name;
    const task = projectTasks(state, project.id).find(item => !taskDone(item));
    if (task) return task.title;
    return project.status === 'done' ? 'Abgeschlossen' : 'Nächsten Schritt definieren';
  }

  function nextStep(project, state, progress) {
    const phases = projectPhases(state, project.id);
    const tasks = projectTasks(state, project.id);
    if (!phases.length) return 'Erstelle die erste Projektphase.';
    if (!tasks.length) return 'Lege konkrete Tasks für dieses Projekt an.';
    const end = project.end_date ? new Date(`${project.end_date}T23:59:59`).getTime() : null;
    if (end && end - Date.now() <= 7 * 86400000 && progress < 50) return 'Enddatum ist bald erreicht und der Fortschritt ist niedrig. Reduziere Scope oder plane den wichtigsten Task neu.';
    if (progress >= 100) return 'Alle Tasks oder Phasen sind erledigt. Das Projekt kann abgeschlossen werden.';
    return `Nächster Meilenstein: ${nextMilestone(project, state)}.`;
  }

  function projectBadge(project, mode = 'full') {
    if (mode === 'mark') return `<span class="project-chip-mark project-chip-mark-only" style="--project-color:${project.color}">${escapeHtml(projectInitials(project.title))}</span>`;
    const classes = mode === 'chip' ? 'project-chip project-chip-inline' : 'project-chip';
    return `<span class="${classes}" style="--project-color:${project.color}"><span class="project-chip-mark">${escapeHtml(projectInitials(project.title))}</span><span class="project-chip-label">${escapeHtml(project.title)}</span></span>`;
  }

  function milestoneMarkers(project, milestones = []) {
    const start = new Date(`${project.start_date || todayDate()}T12:00:00`).getTime();
    const end = new Date(`${project.end_date || project.start_date || todayDate()}T12:00:00`).getTime();
    const span = Math.max(1, end - start);
    return milestones.map(item => {
      const date = new Date(`${item.milestone_date}T12:00:00`).getTime();
      if (!Number.isFinite(date) || date < start || date > end) return '';
      const left = Math.max(0, Math.min(100, ((date - start) / span) * 100));
      return `<span class="phase-milestone-marker" style="left:${left}%" title="${escapeHtml(item.title)} · ${dateLabel(item.milestone_date)}"><i></i><b>${escapeHtml(milestoneAbbr(item.title))}</b></span>`;
    }).join('');
  }

  function projectTodayMarker(project, showLabel = false) {
    const startDate = validDate(project.start_date);
    const endDate = validDate(project.end_date) || startDate;
    const currentDate = todayDate();
    if (!startDate || !endDate || currentDate < startDate || currentDate > endDate) return '';
    const start = new Date(`${startDate}T12:00:00`).getTime();
    const end = new Date(`${endDate}T12:00:00`).getTime();
    const current = new Date(`${currentDate}T12:00:00`).getTime();
    const left = Math.max(0, Math.min(100, ((current - start) / Math.max(1, end - start)) * 100));
    return `<span class="project-today-marker" style="left:${left}%" aria-label="Heute" title="Heute">${showLabel ? '<b>Heute</b>' : ''}</span>`;
  }

  function scheduleTaskBadgePaint() {
    if (taskBadgeRaf) return;
    taskBadgeRaf = window.requestAnimationFrame(() => { taskBadgeRaf = 0; decorateTaskProjectBadges(); });
  }

  function scheduleTaskLinkRefresh() {
    if (taskLinkRefreshTimer) return;
    taskLinkRefreshTimer = window.setTimeout(() => {
      taskLinkRefreshTimer = 0;
      pullRemoteProjectData('', { silent: true }).catch(error => console.warn('[HabitFlow/projects] Task-Projekt-Links konnten nicht nachgeladen werden.', error));
    }, 250);
  }

  function inferTaskId(card, taskMap) {
    const direct = card.dataset.taskId || card.dataset.id;
    if (direct && taskMap.has(direct)) return direct;
    return Array.from(card.querySelectorAll('[data-id]')).map(node => node.dataset.id).find(id => taskMap.has(id)) || '';
  }

  function decorateTaskProjectBadges() {
    const state = readState();
    const taskMap = new Map(state.tasks.map(task => [task.id, normalizeTask(task)]));
    const projectMap = new Map(state.projects.map(project => [project.id, project]));
    document.querySelectorAll('#screen-tasks .task-card, #screen-tasks .kanban-card, .task-detail-modal .task-detail-card').forEach(card => {
      const existing = card.querySelector('[data-project-badge-root]');
      const taskId = inferTaskId(card, taskMap);
      const task = taskMap.get(taskId);
      const project = task?.project_id ? projectMap.get(task.project_id) : null;
      if (!project) {
        if (existing?.dataset.projectId && !existing.dataset.pendingRemoval) {
          existing.dataset.pendingRemoval = 'true';
          scheduleTaskLinkRefresh();
          window.setTimeout(() => {
            const freshTask = readState().tasks.find(item => item.id === taskId);
            if (freshTask?.project_id) scheduleTaskBadgePaint(); else existing.remove();
          }, 1000);
          return;
        }
        if (existing) existing.remove();
        return;
      }
      const markup = document.createElement('div');
      markup.innerHTML = `<div data-project-badge-root data-project-id="${escapeHtml(project.id)}">${projectBadge(project, 'mark')}</div>`;
      const badge = markup.firstElementChild;
      // Keep unchanged badges: replacing them retriggers the body observer every frame.
      if (existing?.isEqualNode(badge)) return;
      if (existing) return existing.replaceWith(badge);
      const heading = card.querySelector('h1, h2, h3, h4, strong');
      if (heading?.parentElement) heading.insertAdjacentElement('afterend', badge); else card.prepend(badge);
    });
  }

  function bindTaskBadgeObserver() {
    if (window.__habitFlowProjectBadgeObserverBound) return;
    window.__habitFlowProjectBadgeObserverBound = true;
    new MutationObserver(mutations => {
      // Dossier cards/status never change task badges. Avoid scanning and
      // normalizing the entire task state for every dossier DOM update.
      if (mutations.length && mutations.every(mutation => mutation.target?.closest?.('#projectViewDossiers, .dossier-dialog'))) return;
      scheduleTaskBadgePaint();
    }).observe(document.body, { childList: true, subtree: true });
  }

  function ensureCss() {
    ['modules/projects.css', 'modules/projects-mobile-fix.css', 'modules/project-workspace.css'].forEach(href => {
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
    return `<section class="projects-hero glass"><div><p class="eyebrow">Projektmanagement</p><h2>Projekte planen und ruhig steuern</h2><p>Start, Ende, Phasen, Fortschritt und verknüpfte Tasks in einem schlanken Cockpit.</p></div><button class="pill primary" type="button" data-action="toggle-project-form">Projekt erstellen</button></section>
    <section id="projectFormPanel" class="panel glass project-form-panel hidden" aria-hidden="true"><div class="panel-head"><div><p class="eyebrow">Projekt</p><h3 id="projectFormTitle">Projekt erstellen</h3></div><button class="icon-btn" type="button" data-action="close-project-form" aria-label="Projektformular schliessen">×</button></div><form id="projectForm" class="project-form-grid"><label class="full"><span>Titel</span><input name="title" required placeholder="z. B. Portfolio Relaunch" /></label><label class="full"><span>Beschreibung</span><textarea name="description" rows="3" placeholder="Worum geht es, und warum ist es wichtig?"></textarea></label><label><span>Startdatum</span><input name="start_date" type="date" required /></label><label><span>Enddatum</span><input name="end_date" type="date" /></label><label><span>Status</span><select name="status"><option value="planned">Geplant</option><option value="active">Aktiv</option><option value="paused">Pausiert</option><option value="done">Abgeschlossen</option></select></label><label><span>Projektfarbe</span><input name="color" type="color" value="${DEFAULT_PROJECT_COLOR}" /></label><label class="full"><span>Zielnotiz / Outcome</span><textarea name="outcome_note" rows="2" placeholder="Woran erkennst du, dass das Projekt gelungen ist?"></textarea></label><div id="projectFormError" class="project-error full" role="status"></div><div class="form-actions full"><button class="pill primary" type="submit">Projekt speichern</button><button class="pill secondary" type="button" data-action="cancel-project-edit">Abbrechen</button></div></form></section>
    <section class="projects-summary" id="projectsSummary" aria-label="Projekt Kennzahlen"></section>
    <section class="panel glass"><div class="panel-head"><div><p class="eyebrow">Portfolio</p><h3>Projekt-Übersicht</h3></div><span id="projectSyncStatus" class="badge muted">bereit</span></div><div id="projectsGrid" class="project-grid"></div></section>`;
  }

  function render() {
    const state = readState();
    renderSummary(state);
    const grid = document.getElementById('projectsGrid');
    if (grid) grid.innerHTML = state.projects.length ? state.projects.map(project => renderProjectCard(project, state)).join('') : '<div class="project-empty">Noch keine Projekte. Erstelle ein erstes Projekt mit Start, Ziel und den wichtigsten Phasen.</div>';
    if (selectedProjectId) renderDetail(selectedProjectId);
    scheduleTaskBadgePaint();
    document.dispatchEvent(new CustomEvent('habitflow:projects-updated'));
  }

  function renderSummary(state) {
    const node = document.getElementById('projectsSummary');
    if (!node) return;
    node.innerHTML = `<article><small>Aktiv</small><strong>${state.projects.filter(project => project.status === 'active').length}</strong></article><article><small>Geplant</small><strong>${state.projects.filter(project => project.status === 'planned').length}</strong></article><article><small>Abgeschlossen</small><strong>${state.projects.filter(project => project.status === 'done').length}</strong></article><article><small>Verknüpfte Tasks</small><strong>${state.projects.reduce((count, project) => count + projectTasks(state, project.id).length, 0)}</strong></article>`;
  }

  function renderProjectCard(project, state) {
    const progress = progressFor(project, state);
    const tasks = projectTasks(state, project.id);
    const status = STATUS[project.status] || STATUS.planned;
    return `<button class="project-card" type="button" aria-label="Projekt öffnen: ${escapeHtml(project.title)}" data-action="open-project-detail" data-id="${escapeHtml(project.id)}"><div class="project-card-head"><div>${projectBadge(project)}<small>Projekt</small><h3>${escapeHtml(project.title)}</h3></div><span class="badge ${status.cls}">${status.label}</span></div><p>${escapeHtml(project.description || 'Noch keine Kurzbeschreibung hinterlegt.')}</p><div class="project-progress-track" aria-label="Fortschritt ${progress}%"><i style="width:${progress}%"></i></div><div class="project-card-meta"><div><small>Start</small><strong>${dateLabel(project.start_date)}</strong></div><div><small>Ende</small><strong>${dateLabel(project.end_date)}</strong></div><div><small>Fortschritt</small><strong>${progress}%</strong></div><div><small>Tasks</small><strong>${tasks.length}</strong></div></div><div class="project-card-footer"><span class="subtle">${escapeHtml(nextMilestone(project, state))}</span><span class="mini-btn project-card-open-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M10 4H4v16h16v-6"/></svg></span></div></button>`;
  }

  function renderProjectEditors(project, phases, milestones) {
    const phaseRecords = phases.length ? phases.map(renderPhaseManagementRow).join('') : '<div class="project-empty">Noch keine Phasen erfasst.</div>';
    const milestoneRecords = milestones.length ? milestones.map(milestone => renderMilestone(milestone, phases)).join('') : '<div class="project-empty">Noch keine Meilensteine erfasst.</div>';
    return `<div class="project-editor-grid"><details class="project-editor-toggle" data-project-editor="phase"><summary><span><small>Phase</small>Phasen erfassen und verwalten</span><span class="project-editor-chevron" aria-hidden="true">⌄</span></summary><div class="project-editor-content"><form class="phase-form" data-project-phase-form data-project-id="${escapeHtml(project.id)}"><label><span>Phase</span><input name="name" required placeholder="z. B. Konzept" /></label><label><span>Start</span><input name="start_date" type="date" value="${escapeHtml(project.start_date || todayDate())}" required /></label><label><span>Ende</span><input name="end_date" type="date" value="${escapeHtml(project.end_date || project.start_date || todayDate())}" required /></label><label><span>Status</span><select name="status"><option value="open">Offen</option><option value="active">In Arbeit</option><option value="done">Erledigt</option></select></label><button class="mini-btn primary" type="submit">Phase speichern</button></form><div class="project-editor-records">${phaseRecords}</div></div></details><details class="project-editor-toggle" data-project-editor="milestone"><summary><span><small>Meilenstein</small>Meilensteine erfassen und verwalten</span><span class="project-editor-chevron" aria-hidden="true">⌄</span></summary><div class="project-editor-content"><form class="milestone-form" data-project-milestone-form data-project-id="${escapeHtml(project.id)}"><label><span>Meilenstein</span><input name="title" required placeholder="z. B. Go-Live" /></label><label><span>Datum</span><input name="milestone_date" type="date" value="${escapeHtml(project.end_date || project.start_date || todayDate())}" required /></label><label><span>Phase</span><select name="phase_id">${phaseOptions(phases)}</select></label><button class="mini-btn primary" type="submit">Meilenstein speichern</button></form><div class="milestone-list project-editor-records">${milestoneRecords}</div></div></details></div>`;
  }

  function renderPhaseManagementRow(phase) {
    return `<article class="project-editor-record"><div><strong>${escapeHtml(phase.name)}</strong><span class="subtle">${escapeHtml(PHASE_STATUS[phase.status] || PHASE_STATUS.open)}</span></div><span class="project-editor-record-meta">${dateLabel(phase.start_date)} bis ${dateLabel(phase.end_date)}</span><div class="list-actions">${projectActionButton('edit-phase', phase.id, 'Phase bearbeiten', 'edit')}${projectActionButton('delete-phase', phase.id, 'Phase löschen', 'trash', true)}</div></article>`;
  }

  function renderProjectLinkedText(text = '') {
    const source = String(text || '');
    if (!source) return '';
    const urlRe = /\b(?:https?:\/\/|www\.)[^\s<>'"]+/gi;
    let html = '';
    let lastIndex = 0;
    source.replace(urlRe, (match, offset) => {
      html += escapeHtml(source.slice(lastIndex, offset));
      const trailing = (match.match(/[),.;:!?]+$/) || [''])[0];
      const cleanUrl = trailing ? match.slice(0, -trailing.length) : match;
      const href = cleanUrl.startsWith('www.') ? `https://${cleanUrl}` : cleanUrl;
      try {
        const parsed = new URL(href);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol');
        html += `<a class="task-inline-link" href="${escapeHtml(parsed.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(cleanUrl)}</a>${escapeHtml(trailing)}`;
      } catch {
        html += escapeHtml(match);
      }
      lastIndex = offset + match.length;
      return match;
    });
    html += escapeHtml(source.slice(lastIndex));
    return html.replace(/\n/g, '<br>');
  }


  function renderProjectNote(note) {
    const body = String(note.body || '');
    const characters = typeof Intl.Segmenter === 'function'
      ? Array.from(new Intl.Segmenter('de', { granularity: 'grapheme' }).segment(body), part => part.segment)
      : Array.from(body);
    const fullText = renderProjectLinkedText(body);
    const preview = escapeHtml(characters.slice(0, 100).join('').replace(/\s+/g, ' ').trim());
    const content = characters.length > 100
      ? `<details class="project-note-disclosure"><summary aria-label="Notiz: ${escapeHtml(note.category)}"><span class="project-note-preview">${preview}…</span><span class="project-note-toggle"><span class="project-note-more">Mehr anzeigen</span><span class="project-note-less">Weniger anzeigen</span><span class="project-editor-chevron" aria-hidden="true">⌄</span></span></summary><p tabindex="0" aria-label="Vollständige Notiz">${fullText}</p></details>`
      : `<p class="project-note-preview">${fullText}</p>`;
    return `<article class="project-card project-note-card" data-note-id="${escapeHtml(note.id)}"><div class="project-note-head"><h3>${escapeHtml(note.category)}</h3></div>${content}<footer class="project-note-footer"><div><small>Letztes Update</small><strong>${dateLabel(note.updated_at)}</strong></div><div class="list-actions">${projectActionButton('edit-project-note', note.id, 'Notiz bearbeiten', 'edit')}${projectActionButton('delete-project-note', note.id, 'Notiz löschen', 'trash', true)}</div></footer></article>`;
  }

  function renderProjectNotes(project, state) {
    const notes = projectNotes(state, project.id);
    const categories = [...new Set(notes.map(note => note.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
    return `<div class="project-section-head"><div><p class="eyebrow">Notizen</p><h3>Projektnotizen</h3></div><span class="badge muted">${notes.length} Notiz${notes.length === 1 ? '' : 'en'}</span></div><details class="project-editor-toggle project-note-editor" data-project-editor="note"><summary><span><small>Notizzettel</small>Notiz erfassen oder bearbeiten</span><span class="project-editor-chevron" aria-hidden="true">⌄</span></summary><form class="project-note-form" data-project-note-form data-project-id="${escapeHtml(project.id)}"><label class="project-note-body"><span>Notiz</span><textarea name="body" rows="4" required placeholder="Gedanke, Entscheid oder offene Frage"></textarea></label><label class="project-note-category"><span>Kategorie</span><input name="category" list="project-note-categories-${escapeHtml(project.id)}" required placeholder="z. B. Recherche" /></label><datalist id="project-note-categories-${escapeHtml(project.id)}">${categories.map(category => `<option value="${escapeHtml(category)}"></option>`).join('')}</datalist><button class="mini-btn primary" type="submit">Notiz speichern</button></form></details><div class="project-note-list">${notes.length ? notes.slice(0,projectNoteLimit).map(renderProjectNote).join('') : '<div class="project-empty">Noch keine Projektnotiz. Halte Entscheide, Fragen und Erkenntnisse direkt hier fest.</div>'}</div><button class="mini-btn secondary" type="button" data-action="workspace-notes-more"${notes.length <= projectNoteLimit ? ' hidden' : ''}>Weitere Projektnotizen</button>`;
  }

  function renderDetail(projectId) {
    const state = readState();
    const project = state.projects.find(item => item.id === projectId);
    const node = document.getElementById('projectDetailContent');
    if (!node || !project) return;
    selectedProjectId = projectId;
    workspaceState = state;
    if (workspaceProject === projectId && node.querySelector('[data-workspace-tabs]')) { refreshWorkspace(project, state); return; }
    workspaceProject = projectId;
    const progress = progressFor(project, state);
    const tasks = projectTasks(state, project.id);
    const phases = projectPhases(state, project.id);
    const milestones = projectMilestones(state, project.id);
    const status = STATUS[project.status] || STATUS.planned;
    node.innerHTML = `<div data-workspace-header><div class="project-detail-head">${projectBadge(project)}<p class="eyebrow">Projekt</p><h2>${escapeHtml(project.title)}</h2><p>${escapeHtml(project.description || 'Noch keine Beschreibung.')}</p></div>
</div>
      <nav class="project-workspace-tabs" data-workspace-tabs role="tablist" aria-label="Projektbereiche">${[['cockpit','Cockpit'],['planning','Planung'],['knowledge','Wissen']].map(([id,label]) => `<button type="button" role="tab" id="project-tab-${id}" aria-controls="project-panel-${id}" aria-selected="${workspaceTab === id}" tabindex="${workspaceTab === id ? '0' : '-1'}" data-action="workspace-tab" data-id="${id}">${label}</button>`).join('')}</nav>
      <div class="workspace-capture-bar"><button class="pill primary" type="button" data-action="workspace-capture" aria-controls="projectCaptureChoices" aria-expanded="false">+ Erfassen</button><span class="subtle" data-workspace-sync role="status"></span><button class="mini-btn secondary" type="button" data-action="workspace-refresh">Aktualisieren</button></div>
      ${renderWorkspaceCapture(project)}
      <section role="tabpanel" id="project-panel-cockpit" aria-labelledby="project-tab-cockpit" data-workspace-panel="cockpit" tabindex="0">
        <div data-workspace-summary>      <div class="project-detail-grid"><article class="project-detail-box"><small>Status</small><h3><span class="badge ${status.cls}">${status.label}</span></h3><p class="subtle">${dateLabel(project.start_date)} bis ${dateLabel(project.end_date)}</p></article><article class="project-detail-box"><small>Fortschritt</small><h3>${progress}%</h3><div class="project-progress-track"><i style="width:${progress}%"></i></div></article><article class="project-detail-box"><small>Ziel / Outcome</small><p class="subtle">${escapeHtml(project.outcome_note || 'Noch kein Outcome notiert.')}</p></article><article class="project-detail-box project-next-step"><small>Nächster sinnvoller Schritt</small><p>${escapeHtml(nextStep(project, state, progress))}</p></article></div>
</div>
        <div data-workspace-aggregate></div><section data-workspace-coach aria-label="Projekt-Coach"></section><div data-workspace-activity></div>
      </section>
      <section role="tabpanel" id="project-panel-planning" aria-labelledby="project-tab-planning" data-workspace-panel="planning" tabindex="0">
      <div class="project-section-head"><div><p class="eyebrow">Projektstruktur</p><h3>Phasen &amp; Meilensteine</h3></div><span class="badge muted">Verwalten</span></div>
      ${renderProjectEditors(project, phases, milestones)}
      <div class="project-section-head project-overview-head"><div><p class="eyebrow">Timeline</p><h3>Projektübersicht</h3></div><span class="badge muted">${phases.length} Phase${phases.length === 1 ? '' : 'n'} · ${milestones.length} Meilenstein${milestones.length === 1 ? '' : 'e'}</span></div>
      <div class="project-phase-list" data-workspace-phases>${phases.length ? phases.map((phase, index) => renderPhase(phase, project, milestonesForPhase(milestones, phase.id), index === 0)).join('') : '<div class="project-empty">Noch keine Phasen. Erstelle die erste Projektphase.</div>'}</div>
      <div class="project-section-head"><div><p class="eyebrow">Tasks</p><h3>Verknüpfte Aufgaben</h3></div><span class="badge muted" data-workspace-task-count>${tasks.length} Task${tasks.length === 1 ? '' : 's'}</span></div>
      ${renderTaskTools(project, state)}
      <div data-project-tasks>${renderProjectTaskList(tasks)}</div>
</section>
      <section role="tabpanel" id="project-panel-knowledge" aria-labelledby="project-tab-knowledge" data-workspace-panel="knowledge" tabindex="0">
        <div class="project-section-head"><div><p class="eyebrow">Projektwissen</p><h3>Quellen, Gedanken &amp; Entscheidungen</h3></div></div>
        <label class="workspace-search"><span>Wissen durchsuchen</span><input type="search" data-workspace-search placeholder="Titel, Inhalt oder URL" /></label>
        <div class="workspace-filters" role="group" aria-label="Wissensfilter">${[['all','Alle'],['links','Links'],['thoughts','Gedanken'],['decisions','Entscheide'],['dossiers','Dossiers']].map(([id,label]) => `<button class="mini-btn secondary" type="button" data-action="workspace-filter" data-id="${id}" aria-pressed="${knowledgeFilter === id}">${label}</button>`).join('')}</div>
        <div class="workspace-knowledge-status"><p class="subtle" data-knowledge-status role="status"></p><button type="button" class="mini-btn secondary" data-action="workspace-load">Inhalte laden</button></div>
        <div class="workspace-knowledge-list" data-knowledge-results></div><button type="button" class="mini-btn secondary" data-action="workspace-more" hidden>Mehr anzeigen</button>
        <div class="workspace-dossier-actions"><button type="button" class="mini-btn secondary" data-action="workspace-choose-dossier">Dossier verknüpfen</button><button type="button" class="mini-btn secondary" data-action="workspace-create-dossier">Dossier erstellen</button></div>
        <section data-project-dossiers></section>
        <section data-workspace-notes>${renderProjectNotes(project, state)}</section>
      </section>
      <div class="form-actions project-detail-actions">${projectActionButton('edit-project', project.id, 'Projekt bearbeiten', 'edit')}<button class="pill primary project-complete-button" type="button" data-action="mark-project-done" data-id="${escapeHtml(project.id)}"><span class="project-complete-icon" aria-hidden="true">${PROJECT_ACTION_ICONS.check}</span><span>Als abgeschlossen markieren</span></button></div>`;
    selectWorkspaceTab(workspaceTab, false);
    refreshWorkspace(project, state);
  }

  function workspaceButton(action, label, id = '') {
    return `<button class="mini-btn secondary" type="button" data-action="${action}" data-id="${escapeHtml(id)}">${label}</button>`;
  }

  function renderWorkspaceCapture(project) {
    return `<section id="projectCaptureChoices" class="workspace-capture project-detail-box" hidden>
      <div class="project-section-head"><h3>Was möchtest du festhalten?</h3>${workspaceButton('workspace-capture-close','Schliessen')}</div>
      <div class="workspace-capture-types">${[['thought','Gedanke'],['link','Link'],['decision','Entscheidung']].map(([id,label])=>workspaceButton('workspace-capture-type',label,id)).join('')}${workspaceButton('create-project-task','Aufgabe',project.id)}</div>
      <div data-workspace-dossier-choice hidden><p class="subtle">Wähle das Dossier für deinen Eintrag. Es wird nichts automatisch angelegt.</p><label class="workspace-search"><span>Dossier</span><select data-workspace-dossier-select></select></label><div class="dossier-actions">${workspaceButton('workspace-dossier-continue','Weiter')}${workspaceButton('workspace-create-dossier','Dossier erstellen')}</div><p data-workspace-capture-status role="status"></p></div>
      <form data-project-note-form data-project-decision-form data-project-id="${escapeHtml(project.id)}" class="workspace-decision-form" hidden>
        <h3>Entscheidung festhalten</h3><label><span>Entscheid *</span><textarea name="decision" rows="2" maxlength="600" required></textarea></label><label><span>Begründung *</span><textarea name="reason" rows="3" maxlength="800" required></textarea></label><label><span>Alternativen (optional)</span><textarea name="alternatives" rows="2" maxlength="400"></textarea></label><label><span>Konsequenz (optional)</span><textarea name="consequence" rows="2" maxlength="400"></textarea></label>
        <p class="subtle">Wird als Projektnotiz gespeichert. Eine Aufgabe wird dadurch nicht automatisch erstellt.</p><p class="workspace-save-status" role="status" aria-live="polite"></p><button class="pill primary" type="submit">Entscheidung speichern</button>
      </form>
    </section>`;
  }

  function updateWorkspaceHtml(selector, html) {
    const mount = document.querySelector(selector);
    if (!mount || mount.dataset.workspaceHtml === html) return;
    const focus = document.activeElement;
    const action = mount.contains(focus) ? focus?.dataset?.action : '';
    const id = action ? focus.dataset.id : '';
    mount.dataset.workspaceHtml = html;
    mount.innerHTML = html;
    if (action) Array.from(mount.querySelectorAll('[data-action]')).find(button=>button.dataset.action === action && button.dataset.id === id)?.focus({preventScroll:true});
  }

  function refreshWorkspace(project, state) {
    workspaceState = state;
    const tasks = projectTasks(state, project.id), phases = projectPhases(state, project.id), milestones = projectMilestones(state, project.id);
    const notes = projectNotes(state, project.id), progress = progressFor(project, state), status = STATUS[project.status] || STATUS.planned;
    updateWorkspaceHtml('[data-workspace-header]', `<div class="project-detail-head">${projectBadge(project)}<p class="eyebrow">Projekt</p><h2>${escapeHtml(project.title)}</h2><p>${escapeHtml(project.description || 'Noch keine Beschreibung.')}</p></div>`);
    updateWorkspaceHtml('[data-workspace-summary]', `<div class="project-detail-grid"><article class="project-detail-box"><small>Status</small><h3><span class="badge ${status.cls}">${status.label}</span></h3><p class="subtle">${dateLabel(project.start_date)} bis ${dateLabel(project.end_date)}</p></article><article class="project-detail-box"><small>Fortschritt</small><h3>${progress}%</h3><div class="project-progress-track"><i style="width:${progress}%"></i></div></article><article class="project-detail-box"><small>Ziel / Outcome</small><p class="subtle">${escapeHtml(project.outcome_note || 'Noch kein Outcome notiert.')}</p></article><article class="project-detail-box project-next-step"><small>Nächster sinnvoller Schritt</small><p>${escapeHtml(nextStep(project,state,progress))}</p>${workspaceButton('workspace-tab','Zur Planung','planning')}</article></div>`);
    const today = new Date(); const localDay = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const hints = workspaceModel().coach(project,tasks,phases,milestones,localDay,workspaceReady);
    updateWorkspaceHtml('[data-workspace-coach]', '<div class="project-section-head"><div><p class="eyebrow">Projekt-Coach</p><h3>Orientierung für den nächsten Schritt</h3></div></div>' + (hints.length ? '<div class="workspace-coach-grid">' + hints.map(hint=>`<article class="project-detail-box"><strong>${escapeHtml(hint.title)}</strong><p class="subtle">${escapeHtml(hint.reason)}</p><button class="mini-btn secondary" type="button" data-action="workspace-coach" data-id="${hint.action}" data-record-id="${escapeHtml(hint.recordId || '')}">${hint.label}</button></article>`).join('') + '</div>' : `<p class="subtle">${project.status === 'done' ? 'Projekt abgeschlossen. Wissen und Entscheidungen bleiben verfügbar.' : !workspaceReady ? 'Hinweise erscheinen nach dem Abgleich der Projektdaten.' : 'Die Grundlagen sind erfasst. In der Planung findest du deine nächsten Aufgaben.'}</p>`));
    // Forms remain mounted. Updating record lists never resets typed values or selection.
    updateWorkspaceHtml('[data-project-tasks]', renderProjectTaskList(tasks));
    updateWorkspaceHtml('[data-workspace-phases]', phases.length ? phases.map((phase,index)=>renderPhase(phase,project,milestonesForPhase(milestones,phase.id),index===0)).join('') : '<div class="project-empty">Noch keine Phasen. Erstelle die erste Projektphase.</div>');
    const temporary = document.createElement('div'); temporary.innerHTML = renderProjectEditors(project,phases,milestones);
    for (const kind of ['phase','milestone']) {
      const selector = `[data-project-editor="${kind}"] .project-editor-records`;
      updateWorkspaceHtml(selector, temporary.querySelector(selector)?.innerHTML || '');
    }
    const phaseSelect=document.querySelector('[data-project-milestone-form] [name="phase_id"]');
    if(phaseSelect && document.activeElement !== phaseSelect) { const value=phaseSelect.value; const options=phaseOptions(phases); if(phaseSelect.innerHTML !== options) { phaseSelect.innerHTML=options; phaseSelect.value=value; } }
    const taskSelect=document.getElementById('projectTaskSelect');
    if(taskSelect && document.activeElement !== taskSelect) {
      const value=taskSelect.value; temporary.innerHTML=renderTaskTools(project,state);
      const options=temporary.querySelector('select')?.innerHTML || ''; if(taskSelect.innerHTML !== options) { taskSelect.innerHTML=options; taskSelect.value=value; }
    }
    const taskCount=document.querySelector('[data-workspace-task-count]'); if(taskCount) taskCount.textContent=tasks.length + (tasks.length === 1 ? ' Task' : ' Tasks');
    const phaseCount=document.querySelector('.project-overview-head>.badge'); if(phaseCount) phaseCount.textContent=phases.length + (phases.length === 1 ? ' Phase' : ' Phasen') + ' · ' + milestones.length + (milestones.length === 1 ? ' Meilenstein' : ' Meilensteine');
    updateWorkspaceNotes(notes);
    refreshWorkspaceKnowledge();
    const message = document.querySelector('[data-workspace-sync]');
    if (message) message.textContent = workspaceSyncMessage;
  }

  function updateWorkspaceNotes(notes) {
    const mount = document.querySelector('[data-workspace-notes] .project-note-list');
    if (!mount) return;
    const signature = JSON.stringify(notes.slice(0,projectNoteLimit));
    const count = document.querySelector('[data-workspace-notes] .project-section-head>.badge');
    if (count) count.textContent = notes.length + (notes.length === 1 ? ' Notiz' : ' Notizen');
    const more=document.querySelector('[data-action="workspace-notes-more"]'); if(more) more.hidden=notes.length <= projectNoteLimit;
    if (mount.dataset.notesSignature === signature) return;
    const expanded = new Set(Array.from(mount.querySelectorAll('[data-note-id]')).filter(card=>card.querySelector('details')?.open).map(card=>card.dataset.noteId));
    updateWorkspaceHtml('[data-workspace-notes] .project-note-list', notes.length ? notes.slice(0,projectNoteLimit).map(renderProjectNote).join('') : '<div class="project-empty">Noch keine Projektnotiz. Halte Entscheide, Fragen und Erkenntnisse direkt hier fest.</div>');
    mount.dataset.notesSignature = signature;
    for (const card of mount.querySelectorAll('[data-note-id]')) if (expanded.has(card.dataset.noteId) && card.querySelector('details')) card.querySelector('details').open = true;

  }

  function selectWorkspaceTab(tab, focus = true) {
    if (!['cockpit','planning','knowledge'].includes(tab)) return;
    workspaceTab = tab;
    const root = document.getElementById('projectDetailContent'); if (!root) return;
    root.querySelectorAll('[data-workspace-tabs] [role="tab"]').forEach(button=>{ const active = button.dataset.id === tab; button.setAttribute('aria-selected',String(active)); button.tabIndex = active ? 0 : -1; if (active && focus) button.focus({preventScroll:true}); });
    root.querySelectorAll('[data-workspace-panel]').forEach(panel=>{ panel.hidden = panel.dataset.workspacePanel !== tab; });
    if (tab === 'knowledge') refreshWorkspaceKnowledge();
  }

  function refreshWorkspaceKnowledge() {
    if (!selectedProjectId || !workspaceState) return;
    const snapshot = window.HabitFlowDossiersStore?.snapshot() || { dossiers:[],entries:[],metrics:{},status:'Dossier-Speicher wird geladen' };
    const owner = window.HabitFlowRemote?.getUserId() || '';
    const notes = projectNotes(workspaceState,selectedProjectId);
    const dossiers = snapshot.dossiers.filter(row=>row.project_id === selectedProjectId && row.user_id === owner);
    const decisions = notes.filter(note=>note.category === 'Entscheidung');
    const knownHeaders = snapshot.status === 'synchronisiert' || dossiers.length > 0;
    updateWorkspaceHtml('[data-workspace-aggregate]', `<div class="workspace-metrics"><article class="project-detail-box"><small>Tasks</small><strong>${projectTasks(workspaceState,selectedProjectId).length}</strong></article><article class="project-detail-box"><small>Dossiers</small><strong>${knownHeaders ? dossiers.length : '–'}</strong></article><article class="project-detail-box"><small>Entscheide</small><strong>${workspaceReady || decisions.length ? decisions.length : '–'}</strong></article></div>`);
    const latest = dossiers.slice().sort((a,b)=>(snapshot.metrics[b.id]?.updated_at || b.updated_at).localeCompare(snapshot.metrics[a.id]?.updated_at || a.updated_at))[0];
    updateWorkspaceHtml('[data-workspace-activity]', `<div class="workspace-activity-grid"><article class="project-detail-box"><small>Letzte Entscheidung</small><p>${escapeHtml(decisions[0] ? workspaceModel().preview(decisions[0].body) : 'Noch keine Entscheidung erfasst.')}</p>${decisions[0] ? workspaceButton('workspace-open-note','Entscheidung ansehen',decisions[0].id) : workspaceButton('workspace-capture-type','Entscheid erfassen','decision')}</article><article class="project-detail-box"><small>Zuletzt aktualisiertes Wissen</small><p>${escapeHtml(latest?.title || (knownHeaders ? 'Noch kein Dossier verknüpft.' : 'Dossier-Übersicht wird abgeglichen.'))}</p>${latest ? workspaceButton('open-project-dossier','Dossier öffnen ↗',latest.id) : workspaceButton('workspace-choose-dossier','Dossier auswählen')}</article></div>`);
    if (workspaceTab !== 'knowledge') return;
    const key = [snapshot.dossiers,snapshot.entries,workspaceState.projectNotes,owner,selectedProjectId];
    if (!knowledgeKey || key.some((value,index)=>value!==knowledgeKey[index])) { knowledgeRows = workspaceModel().knowledge(selectedProjectId,owner,snapshot,notes); knowledgeKey = key; }
    const result = workspaceModel().page(knowledgeRows,knowledgeFilter,knowledgeQuery,knowledgeLimit);
    updateWorkspaceHtml('[data-knowledge-results]', result.rows.length ? result.rows.map(row=>`<article class="workspace-knowledge-card"><div><small>${({links:'Quelle',thoughts:'Gedanke / Eintrag',decisions:'Entscheidung',dossiers:'Dossier'})[row.kind]}${row.dossierTitle ? ' · ' + escapeHtml(row.dossierTitle) : ''}</small><h4>${escapeHtml(row.title)}</h4>${row.url ? `<a href="${escapeHtml(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.url)}</a>` : `<p>${escapeHtml(row.preview)}</p>`}<time>${dateLabel(row.updated)}</time></div><button class="mini-btn project-task-icon" type="button" data-action="${row.noteId ? 'workspace-open-note' : 'open-project-dossier'}" data-id="${escapeHtml(row.noteId || row.dossierId)}" data-entry-id="${escapeHtml(row.entryId || '')}" aria-label="${row.noteId ? 'Entscheidung ansehen' : 'Im Dossier öffnen'}" title="${row.noteId ? 'Entscheidung ansehen' : 'Im Dossier öffnen'}">↗</button></article>`).join('') : '<p class="project-empty">' + (knowledgeQuery ? 'Keine Treffer in den lokal verfügbaren Inhalten.' : 'Hier erscheinen verknüpfte Dossiers, geladene Einträge und Entscheidungen.') + '</p>');
    const more = document.querySelector('[data-action="workspace-more"]'); if (more) more.hidden = result.rows.length >= result.total;
    const load = document.querySelector('[data-action="workspace-load"]');
    const unloaded = dossiers.filter(row=>!workspaceLoaded.has(row.id));
    if (load) { load.disabled = knowledgeBusy || !dossiers.length; load.textContent = knowledgeBusy ? 'Inhalte werden geladen …' : unloaded.length ? 'Weitere Inhalte laden (' + unloaded.length + ')' : 'Inhalte aktualisieren'; }
    const status = document.querySelector('[data-knowledge-status]');
    if (status) status.textContent = `${result.rows.length} von ${result.total} Treffern · Nur lokal verfügbare Inhalte. ${workspaceLoaded.size} Dossiers in dieser Sitzung geladen. ${snapshot.status || ''}`;
    renderProjectDossiers(selectedProjectId);
  }

  async function loadWorkspaceKnowledge() {
    if (knowledgeBusy || !selectedProjectId) return;
    const store = window.HabitFlowDossiersStore; if (!store) return;
    const generation = workspaceGeneration, projectId = selectedProjectId;
    const snapshot = store.snapshot(), dossiers = snapshot.dossiers.filter(row=>row.project_id === projectId);
    const pending = dossiers.filter(row=>!workspaceLoaded.has(row.id));
    const batch = (pending.length ? pending : dossiers).slice(0,3);
    knowledgeBusy = true; refreshWorkspaceKnowledge();
    try {
      for (const dossier of batch) {
        if (generation !== workspaceGeneration || projectId !== selectedProjectId) break;
        await store.sync(dossier.id);
        if (generation !== workspaceGeneration) break;
        if (store.snapshot().metrics?.[dossier.id]?.loaded) workspaceLoaded.add(dossier.id);
        else break;
      }
    } finally { if (generation === workspaceGeneration) { knowledgeBusy = false; refreshWorkspaceKnowledge(); } }
  }

  function showWorkspaceCapture(type) {
    const panel = document.getElementById('projectCaptureChoices'); if (!panel) return;
    panel.hidden = false;
    document.querySelector('[data-action="workspace-capture"]')?.setAttribute('aria-expanded','true');
    const decision = panel.querySelector('[data-project-decision-form]'), choice = panel.querySelector('[data-workspace-dossier-choice]');
    decision.hidden = type !== 'decision'; choice.hidden = !['thought','link','link-dossier'].includes(type);
    if (!choice.hidden) {
      choice.dataset.mode = type;
      const select = choice.querySelector('select'), snapshot = window.HabitFlowDossiersStore?.snapshot();
      const options = (snapshot?.dossiers || []).filter(row=>!row.project_id || row.project_id === selectedProjectId);
      select.innerHTML = '<option value="">Dossier auswählen</option>' + options.map(row=>`<option value="${escapeHtml(row.id)}">${escapeHtml(row.title)}${row.project_id ? '' : ' · noch ohne Projekt'}</option>`).join('');
      choice.querySelector('[data-workspace-capture-status]').textContent = type === 'link-dossier' ? 'Ein eigenständiges Dossier wird erst durch «Weiter» mit diesem Projekt verknüpft.' : 'Ein noch nicht verknüpftes Dossier wird mit «Weiter» diesem Projekt zugeordnet.';
      select.focus();
    } else if (type === 'decision') decision.querySelector('textarea').focus();
    else panel.querySelector('button')?.focus();
    panel.scrollIntoView({block:'nearest'});
  }

  function continueWorkspaceDossier(trigger) {
    const choice = document.querySelector('[data-workspace-dossier-choice]');
    const id = choice?.querySelector('select')?.value;
    const store = window.HabitFlowDossiersStore;
    const row = store?.snapshot().dossiers.find(item=>item.id === id);
    const message = choice?.querySelector('[data-workspace-capture-status]');
    if (!row) { if (message) message.textContent = 'Bitte ein Dossier auswählen.'; return; }
    if (row.project_id && row.project_id !== selectedProjectId) { message.textContent = 'Das Dossier gehört inzwischen zu einem anderen Projekt. Bitte erneut auswählen.'; return; }
    try {
      if (!row.project_id) store.saveDossier({ id:row.id,project_id:selectedProjectId });
      if (choice.dataset.mode === 'link-dossier') { message.textContent = 'Dossier lokal verknüpft. Der Sync-Status zeigt den Abgleich.'; refreshWorkspaceKnowledge(); return; }
      openProjectDossier(row.id,trigger,{ composer:choice.dataset.mode });
    } catch(error) { message.textContent = error.message || 'Dossier konnte nicht verknüpft werden.'; }
  }

  function workspaceAction(action, id, trigger) {
    if (action === 'workspace-tab') selectWorkspaceTab(id);
    if (action === 'workspace-filter') { knowledgeFilter=id; knowledgeLimit=20; document.querySelectorAll('[data-action="workspace-filter"]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.id === id))); refreshWorkspaceKnowledge(); }
    if (action === 'workspace-notes-more') { projectNoteLimit+=20; updateWorkspaceNotes(projectNotes(workspaceState,selectedProjectId)); }
    if (action === 'workspace-more') { knowledgeLimit+=20; refreshWorkspaceKnowledge(); }
    if (action === 'workspace-refresh') { workspaceSyncMessage='Projektdaten werden abgeglichen …'; renderDetail(selectedProjectId); void pullRemoteProjectData(selectedProjectId); }
    if (action === 'workspace-load') void loadWorkspaceKnowledge();
    if (action === 'workspace-capture') showWorkspaceCapture('');
    if (action === 'workspace-capture-type') showWorkspaceCapture(id);
    if (action === 'workspace-capture-close') { document.getElementById('projectCaptureChoices').hidden=true; const button=document.querySelector('[data-action="workspace-capture"]'); button?.setAttribute('aria-expanded','false'); button?.focus(); }
    if (action === 'workspace-choose-dossier') showWorkspaceCapture('link-dossier');
    if (action === 'workspace-dossier-continue') continueWorkspaceDossier(trigger);
    if (action === 'workspace-create-dossier') openProjectDossier('',trigger,{ create:true, projectId:selectedProjectId });
    if (action === 'workspace-open-note') {
      selectWorkspaceTab('knowledge',false);
      const notes=projectNotes(workspaceState,selectedProjectId), position=notes.findIndex(note=>note.id===id);
      if(position>=projectNoteLimit) { projectNoteLimit=Math.ceil((position+1)/20)*20; updateWorkspaceNotes(notes); }
      const card=Array.from(document.querySelectorAll('[data-note-id]')).find(node=>node.dataset.noteId===id);
      if (card) { const details=card.querySelector('details'); if(details) details.open=true; card.scrollIntoView({block:'center'}); const target=card.querySelector('summary,button'); target?.focus({preventScroll:true}); }
    }
    if (action === 'workspace-coach') {
      if (id === 'task') document.querySelector('[data-action="create-project-task"]')?.click();
      if (id === 'outcome') { closeDetail({skipSync:true}); openForm(selectedProjectId || workspaceProject); document.querySelector('#projectForm [name="outcome_note"]')?.focus(); }
      if (id === 'phase' || id === 'milestone') { selectWorkspaceTab('planning',false); const editor=document.querySelector(`[data-project-editor="${id}"]`); if(editor) { editor.open=true; editor.querySelector('input')?.focus(); editor.scrollIntoView({block:'nearest'}); } if(id==='milestone' && trigger.dataset.recordId) editMilestone(trigger.dataset.recordId); }
    }
  }

  const completedProjects = new Set();
  function renderProjectTaskList(tasks) {
    const active = tasks.filter(task => !taskDone(task)).sort((a,b) => window.HabitFlowTaskOrder?.compare(a,b) || 0);
    const done = tasks.filter(taskDone);
    return '<div class="project-task-list">' + (active.length ? active.map((task,index) => renderTaskRow(task,index,active.length)).join('') : '<p class="subtle">Keine offenen Aufgaben.</p>') + '</div>' + (done.length ? '<details class="project-completed-tasks" data-project-completed' + (completedProjects.has(selectedProjectId) ? ' open' : '') + '><summary>Erledigt <span class="badge muted">' + done.length + '</span><span aria-hidden="true">⌄</span></summary><div class="project-task-list">' + done.map(task => renderTaskRow(task)).join('') + '</div></details>' : '');
  }
  function renderMilestone(milestone, phases = []) {
    return `<article class="milestone-chip"><strong>${escapeHtml(milestoneAbbr(milestone.title))}</strong><span>${escapeHtml(milestone.title)}</span><small>${dateLabel(milestone.milestone_date)}</small><em>${escapeHtml(milestonePhaseLabel(milestone, phases))}</em>${projectActionButton('edit-milestone', milestone.id, 'Meilenstein bearbeiten', 'edit')}${projectActionButton('delete-milestone', milestone.id, 'Meilenstein löschen', 'trash', true)}</article>`;
  }

  function renderPhase(phase, project, milestones = [], showTodayLabel = false) {
    const start = new Date(`${project.start_date || phase.start_date}T12:00:00`).getTime();
    const end = new Date(`${project.end_date || phase.end_date || project.start_date}T12:00:00`).getTime();
    const phaseStart = new Date(`${phase.start_date}T12:00:00`).getTime();
    const phaseEnd = new Date(`${phase.end_date}T12:00:00`).getTime();
    const span = Math.max(1, end - start);
    const left = Math.max(0, Math.min(96, ((phaseStart - start) / span) * 100));
    const width = Math.max(8, Math.min(100 - left, ((phaseEnd - phaseStart || 86400000) / span) * 100));
    return `<article class="phase-card project-phase-overview"><div><strong>${escapeHtml(phase.name)}</strong><span class="subtle">${PHASE_STATUS[phase.status]}</span></div><div class="phase-timeline phase-timeline-with-milestones"><div class="phase-timeline-track"><i style="margin-left:${left}%;width:${width}%"></i>${projectTodayMarker(project, showTodayLabel)}${milestoneMarkers(project, milestones)}</div><div class="phase-timeline-dates"><span>${dateLabel(phase.start_date)}</span><span>${dateLabel(phase.end_date)}</span></div></div></article>`;
  }

  function renderTaskTools(project, state) {
    const options = state.tasks.filter(task => !task.project_id && !taskClosedForLinking(task)).map(task => `<option value="${escapeHtml(task.id)}">${escapeHtml(task.title)}</option>`).join('');
    return `<div class="project-task-tools"><label><span class="subtle">Bestehenden Task verbinden</span><select id="projectTaskSelect"><option value="">Task auswählen</option>${options}</select></label><div class="list-actions"><button class="mini-btn" type="button" data-action="link-selected-task" data-id="${escapeHtml(project.id)}">Verbinden</button><button class="mini-btn primary" type="button" data-action="create-project-task" data-id="${escapeHtml(project.id)}">Task für Projekt erstellen</button></div></div>`;
  }

  function renderTaskRow(task, index = -1, count = 0) {
    const states = { open: ['Offen','<circle cx="12" cy="12" r="8"/>'], in_progress: ['In Bearbeitung','<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>'], archived: ['Backlog','<path d="M4 5h16v14H4zM4 13h5l2 3h2l2-3h5"/>'], done: ['Erledigt','<circle cx="12" cy="12" r="8"/><path d="m8 12 3 3 5-6"/>'] };
    const status = states[task.status] || states.open;
    const icon = (action,label,path,disabled=false) => '<button class="mini-btn project-icon-action project-task-icon" data-polished="true" type="button" data-action="' + action + '" data-id="' + escapeHtml(task.id) + '" aria-label="' + escapeHtml(label) + '" title="' + escapeHtml(label) + '"' + (disabled ? ' disabled' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg></button>';
    return '<article class="project-task-row ' + (taskDone(task) ? 'is-done' : '') + '"><div class="project-task-info"><span class="project-task-state" role="img" aria-label="' + status[0] + '" title="' + status[0] + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + status[1] + '</svg></span><div><strong>' + escapeHtml(task.title) + '</strong>' + (task.due_at ? '<small>Fällig ' + escapeHtml(dateLabel(task.due_at)) + '</small>' : '') + '</div></div><div class="project-task-actions">' + (index >= 0 ? icon('project-task-up','Höher priorisieren','<path d="m6 14 6-6 6 6"/>',index===0) + icon('project-task-down','Tiefer priorisieren','<path d="m6 10 6 6 6-6"/>',index===count-1) : '') + icon('open-task-detail','Aufgabe öffnen: '+task.title,'<path d="M14 4h6v6M20 4l-9 9M10 4H4v16h16v-6"/>') + icon('unlink-task','Projektverknüpfung lösen: '+task.title,'<path d="m10 14 4-4M8 16l-1 1a3 3 0 0 1-4-4l4-4M16 8l1-1a3 3 0 0 1 4 4l-4 4M3 3l18 18"/>') + '</div></article>';
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
    form.elements.color.value = project?.color || DEFAULT_PROJECT_COLOR;
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

  function setProjectError(text) { const node = document.getElementById('projectFormError'); if (node) node.textContent = text || ''; }
  async function requireRemoteUser() { const supabase = getSupabaseClient(); const userId = await currentUserId(); if (!supabase || !userId) throw new Error('Supabase ist nicht verbunden.'); return { supabase, userId }; }

  async function deleteRemoteProjectRecord(table, id) {
    const { supabase, userId } = await requireRemoteUser();
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id');
    if (error) throw error;
    const { data: remaining, error: verificationError } = await supabase
      .from(table)
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .limit(1);
    if (verificationError) throw verificationError;
    if (Array.isArray(remaining) && remaining.length) {
      throw new Error('Der Eintrag ist in Supabase noch vorhanden und wurde nicht gelöscht.');
    }
    return Array.isArray(data) ? data : [];
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
      const project = normalizeProject({ ...(existing || {}), id: existing?.id || uid(), title, description: data.get('description'), start_date: start, end_date: end, status: data.get('status'), outcome_note: data.get('outcome_note'), color: data.get('color'), created_at: existing?.created_at || now, updated_at: now, synced: true });
      const { supabase, userId } = await requireRemoteUser();
      const baseRow = { id: project.id, user_id: userId, title: project.title, description: project.description || null, start_date: project.start_date || null, end_date: project.end_date || null, status: project.status, outcome_note: projectOutcomeForStorage(project), is_archived: false, created_at: project.created_at, updated_at: project.updated_at };
      const row = { ...baseRow, color: project.color };
      let { error } = await supabase.from(TABLE_PROJECTS).upsert(row, { onConflict: 'id' });
      if (error && isMissingRemoteColumnError(error, 'color')) ({ error } = await supabase.from(TABLE_PROJECTS).upsert(baseRow, { onConflict: 'id' }));
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
    const editingPhaseId = form.dataset.editingPhaseId || '';
    const name = String(data.get('name') || '').trim();
    const start = validDate(data.get('start_date'));
    const end = validDate(data.get('end_date'));
    if (!projectId) return toast('Projekt konnte für die Phase nicht gefunden werden.');
    if (!name || !start || !end) return toast('Phase braucht Name, Start und Ende.');
    if (end < start) return toast('Phasenende darf nicht vor Start liegen.');

    try {
      const now = nowIso();
      const state = readState();
      const existing = editingPhaseId ? state.projectPhases.find(item => item.id === editingPhaseId) : null;
      const phase = normalizePhase({ ...(existing || {}), id: existing?.id || uid('phase'), project_id: projectId, name, start_date: start, end_date: end, status: data.get('status'), created_at: existing?.created_at || now, updated_at: now, synced: true });
      const { supabase, userId } = await requireRemoteUser();
      const row = { id: phase.id, user_id: userId, project_id: phase.project_id, name: phase.name, start_date: phase.start_date, end_date: phase.end_date, status: phase.status, is_archived: false, created_at: phase.created_at, updated_at: phase.updated_at };
      const { error } = await supabase.from(TABLE_PHASES).upsert(row, { onConflict: 'id' });
      if (error) throw error;
      state.projectPhases = existing ? state.projectPhases.map(item => item.id === phase.id ? phase : item) : [phase, ...state.projectPhases.filter(item => item.id !== phase.id)];
      writeState(state);
      delete form.dataset.editingPhaseId;
      const button = form.querySelector('button[type="submit"]');
      if (button) button.textContent = 'Phase speichern';
      form.reset();
      renderDetail(projectId);
      render();
      toast(existing ? 'Phase aktualisiert' : 'Phase gespeichert');
    } catch (error) {
      console.warn('[HabitFlow/projects] Phase konnte nicht gespeichert werden.', error);
      toast(error.message || 'Phase konnte nicht gespeichert werden.');
    }
  }

  async function saveMilestone(event) {
    event.preventDefault();
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const data = new FormData(form);
    const projectId = form.dataset.projectId;
    const editingMilestoneId = form.dataset.editingMilestoneId || '';
    const title = String(data.get('title') || '').trim();
    const date = validDate(data.get('milestone_date'));
    const phaseId = String(data.get('phase_id') || '');
    if (!projectId) return toast('Projekt konnte für den Meilenstein nicht gefunden werden.');
    if (!title || !date) return toast('Meilenstein braucht Titel und Datum.');

    try {
      const now = nowIso();
      const state = readState();
      const existing = editingMilestoneId ? state.projectMilestones.find(item => item.id === editingMilestoneId) : null;
      const milestone = normalizeMilestone({ ...(existing || {}), id: existing?.id || uid('milestone'), project_id: projectId, phase_id: phaseId, title, milestone_date: date, created_at: existing?.created_at || now, updated_at: now, synced: true });
      const { supabase, userId } = await requireRemoteUser();
      const row = { id: milestone.id, user_id: userId, project_id: milestone.project_id, phase_id: milestone.phase_id || null, title: milestone.title, milestone_date: milestone.milestone_date, is_archived: false, created_at: milestone.created_at, updated_at: milestone.updated_at };
      const { error } = await supabase.from(TABLE_MILESTONES).upsert(row, { onConflict: 'id' });
      if (error) throw error;
      state.projectMilestones = existing ? state.projectMilestones.map(item => item.id === milestone.id ? milestone : item) : [milestone, ...state.projectMilestones.filter(item => item.id !== milestone.id)];
      writeState(state);
      delete form.dataset.editingMilestoneId;
      const button = form.querySelector('button[type="submit"]');
      if (button) button.textContent = 'Meilenstein speichern';
      form.reset();
      renderDetail(projectId);
      render();
      toast(existing ? 'Meilenstein aktualisiert' : 'Meilenstein gespeichert');
    } catch (error) {
      console.warn('[HabitFlow/projects] Meilenstein konnte nicht gespeichert werden.', error);
      toast(error.message || 'Meilenstein konnte nicht gespeichert werden.');
    }
  }

  function editMilestone(id) {
    const state = readState();
    const milestone = state.projectMilestones.find(item => item.id === id);
    if (!milestone) return;
    const form = Array.from(document.querySelectorAll('[data-project-milestone-form]')).find(item => item.dataset.projectId === milestone.project_id);
    if (!form) return;
    form.dataset.editingMilestoneId = milestone.id;
    form.elements.title.value = milestone.title || '';
    form.elements.milestone_date.value = validDate(milestone.milestone_date) || todayDate();
    if (form.elements.phase_id) form.elements.phase_id.value = milestone.phase_id || '';
    const button = form.querySelector('button[type="submit"]');
    if (button) button.textContent = 'Meilenstein aktualisieren';
    form.closest('details')?.setAttribute('open', '');
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    form.elements.title?.focus();
  }

  async function deleteMilestone(id) {
    const state = readState();
    const milestone = state.projectMilestones.find(item => item.id === id);
    if (!milestone) return;
    try {
      await deleteRemoteProjectRecord(TABLE_MILESTONES, id);
      rememberDeletedProjectRecord(TABLE_MILESTONES, id);
      state.projectMilestones = state.projectMilestones.filter(item => item.id !== id);
      writeState(state);
      renderDetail(milestone.project_id);
      render();
      toast('Meilenstein gelöscht');
    } catch (error) { toast(error.message || 'Meilenstein konnte nicht gelöscht werden.'); }
  }

  function editPhase(id) {
    const state = readState();
    const phase = state.projectPhases.find(item => item.id === id);
    if (!phase) return;
    const form = Array.from(document.querySelectorAll('[data-project-phase-form]')).find(item => item.dataset.projectId === phase.project_id);
    if (!form) return;
    form.dataset.editingPhaseId = phase.id;
    form.elements.name.value = phase.name || '';
    form.elements.start_date.value = validDate(phase.start_date) || todayDate();
    form.elements.end_date.value = validDate(phase.end_date) || validDate(phase.start_date) || todayDate();
    form.elements.status.value = PHASE_STATUS[phase.status] ? phase.status : 'open';
    const button = form.querySelector('button[type="submit"]');
    if (button) button.textContent = 'Phase aktualisieren';
    form.closest('details')?.setAttribute('open', '');
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    form.elements.name?.focus();
  }

  async function deletePhase(id) {
    const state = readState();
    const phase = state.projectPhases.find(item => item.id === id);
    if (!phase) return;
    try {
      await deleteRemoteProjectRecord(TABLE_PHASES, id);
      rememberDeletedProjectRecord(TABLE_PHASES, id);
      state.projectPhases = state.projectPhases.filter(item => item.id !== id);
      writeState(state);
      renderDetail(phase.project_id);
      render();
      toast('Phase gelöscht');
    } catch (error) { toast(error.message || 'Phase konnte nicht gelöscht werden.'); }
  }

  async function saveProjectNote(event) {
    event.preventDefault();
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.dataset.saving === 'true') return;
    const data = new FormData(form), projectId = form.dataset.projectId;
    const editingNoteId = form.dataset.editingNoteId || '';
    const decision = form.hasAttribute('data-project-decision-form');
    let message = form.querySelector('.workspace-save-status');
    if (!message) { message=document.createElement('p'); message.className='workspace-save-status'; message.setAttribute('role','status'); form.append(message); }
    let body, category;
    try {
      category = decision ? 'Entscheidung' : String(data.get('category') || '').trim();
      body = decision ? workspaceModel().decisionBody(Object.fromEntries(data.entries())) : String(data.get('body') || '').trim();
      if (!projectId || !category || !body) throw new Error('Notiz braucht Kategorie und Inhalt.');
      if (body.length > 2000) throw new Error('Bitte die Notiz auf 2’000 Zeichen kürzen. Der Entwurf bleibt erhalten.');
    } catch (error) { message.textContent=error.message; return; }
    const submit = form.querySelector('button[type="submit"]');
    form.dataset.saving='true'; form.setAttribute('aria-busy','true'); if(submit) submit.disabled=true;
    message.textContent='Wird gespeichert …';
    const generation = workspaceGeneration;
    try {
      const existing = editingNoteId ? readState().projectNotes.find(item => item.id === editingNoteId) : null;
      const now = nowIso();
      // Retain the id on ambiguous remote errors, so retry cannot duplicate a decision.
      const id = existing?.id || form.dataset.pendingNoteId || uid('note'); form.dataset.pendingNoteId=id;
      const note = normalizeProjectNote({ ...(existing || {}), id, project_id:projectId, category, body, created_at:existing?.created_at || now, updated_at:now, synced:true });
      const { supabase, userId } = await requireRemoteUser();
      if (generation !== workspaceGeneration) return;
      const row = { id:note.id, user_id:userId, project_id:note.project_id, category:note.category, body:note.body, is_archived:false, created_at:note.created_at, updated_at:note.updated_at };
      const { error } = await supabase.from(TABLE_NOTES).upsert(row, { onConflict:'id' });
      if (error) throw error;
      if (generation !== workspaceGeneration || userId !== await currentUserId()) return;
      const state = readState();
      state.projectNotes = [note, ...state.projectNotes.filter(item=>item.id !== note.id)];
      writeState(state);
      delete form.dataset.editingNoteId; delete form.dataset.pendingNoteId;
      form.reset();
      if(submit) submit.textContent=decision ? 'Entscheidung speichern' : 'Notiz speichern';
      message.textContent=decision ? 'Entscheidung gespeichert.' : 'Notiz gespeichert.';
      render();
      toast(decision ? 'Entscheidung gespeichert' : existing ? 'Notiz aktualisiert' : 'Notiz gespeichert');
    } catch (error) {
      console.warn('[HabitFlow/projects] Projektnotiz konnte nicht gespeichert werden.', error);
      message.textContent=(isMissingRemoteRelationError(error) ? 'Bitte zuerst das Supabase-Skript für Projektnotizen ausführen.' : (error.message || 'Notiz konnte nicht gespeichert werden.')) + ' Dein Entwurf bleibt erhalten. Bitte erneut versuchen.';
    } finally { delete form.dataset.saving; form.removeAttribute('aria-busy'); if(submit) submit.disabled=false; }
  }

  function editProjectNote(id) {
    const note = readState().projectNotes.find(item => item.id === id);
    if (!note) return;
    const form = Array.from(document.querySelectorAll('[data-project-note-form]:not([data-project-decision-form])')).find(item => item.dataset.projectId === note.project_id);
    if (!form) return;
    form.dataset.editingNoteId = note.id;
    form.elements.category.value = note.category || 'Allgemein';
    form.elements.body.value = note.body || '';
    const button = form.querySelector('button[type="submit"]');
    if (button) button.textContent = 'Notiz aktualisieren';
    form.closest('details')?.setAttribute('open', '');
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    form.elements.body?.focus();
  }

  async function deleteProjectNote(id) {
    const state = readState();
    const note = state.projectNotes.find(item => item.id === id);
    if (!note) return;
    try {
      await deleteRemoteProjectRecord(TABLE_NOTES, id);
      rememberDeletedProjectRecord(TABLE_NOTES, id);
      state.projectNotes = state.projectNotes.filter(item => item.id !== id);
      writeState(state);
      renderDetail(note.project_id);
      render();
      toast('Notiz gelöscht');
    } catch (error) { toast(error.message || 'Notiz konnte nicht gelöscht werden.'); }
  }

  async function linkTask(projectId, taskId) {
    if (!taskId) return toast('Bitte Task auswählen.');
    try {
      const { supabase } = await requireRemoteUser();
      const { error } = await supabase.from('tasks').update({ project_id: projectId, updated_at: nowIso() }).eq('id', taskId);
      if (error) throw error;
      const state = readState();
      state.tasks = state.tasks.map(task => task.id === taskId ? { ...task, project_id: projectId, projectId, project_link_cleared_at: null, updated_at: nowIso(), synced: true } : task);
      writeState(state);
      renderDetail(projectId);
      render();
      toast('Task verknüpft');
    } catch (error) { toast(error.message || 'Task konnte nicht verknüpft werden.'); }
  }

  async function unlinkTask(taskId) {
    const state = readState();
    const task = state.tasks.find(item => item.id === taskId);
    if (!task) return;
    try {
      const updatedAt = nowIso();
      const { supabase, userId } = await requireRemoteUser();
      const { data, error } = await supabase.from('tasks').update({ project_id: null, updated_at: updatedAt }).eq('id', taskId).eq('user_id', userId).select('id,project_id,updated_at');
      if (error) throw error;
      if (!Array.isArray(data) || data.length !== 1 || data[0].project_id !== null) throw new Error('Die Projektverknüpfung wurde in Supabase nicht entfernt.');
      const { data: verification, error: verificationError } = await supabase.from('tasks').select('id,project_id,updated_at').eq('id', taskId).eq('user_id', userId).maybeSingle();
      if (verificationError) throw verificationError;
      if (!verification || verification.project_id !== null) throw new Error('Die Projektverknüpfung ist in Supabase noch vorhanden.');
      state.tasks = state.tasks.map(item => item.id === taskId ? { ...item, project_id: null, projectId: null, project_link_cleared_at: updatedAt, updated_at: verification.updated_at || updatedAt, synced: true } : item);
      writeState(state);
      renderDetail(task.project_id);
      render();
      toast('Task gelöst');
    } catch (error) { toast(error.message || 'Task konnte nicht gelöst werden.'); }
  }

  async function createProjectTask(projectId) {
    const title = prompt('Task-Titel für dieses Projekt');
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
    } catch (error) { toast(error.message || 'Projekt-Task konnte nicht erstellt werden.'); }
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
    } catch (error) { toast(error.message || 'Projekt konnte nicht abgeschlossen werden.'); }
  }

  function suspendProjectForTask(actionEl) {
    const modal = document.getElementById('projectDetailModal');
    const taskModal = document.getElementById('taskDetailModal');
    if (!selectedProjectId || !modal || !taskModal || taskModal.classList.contains('hidden')) return;
    const card = modal.querySelector('.project-detail-card');
    const context = {
      projectId: selectedProjectId,
      taskId: actionEl.dataset.id,
      trigger: actionEl,
      modalScroll: modal.scrollTop,
      cardScroll: card?.scrollTop || 0
    };
    context.observer = new MutationObserver(() => {
      if (!taskModal.classList.contains('hidden')) return;
      context.observer.disconnect();
      if (projectTaskReturn !== context) return;
      projectTaskReturn = null;
      if (selectedProjectId !== context.projectId) return;
      window.HabitFlowRoadmapProjects?.refreshTasks?.();
      modal.classList.remove('hidden');
      document.body.classList.add('project-modal-open');
      modal.scrollTop = context.modalScroll;
      if (card) card.scrollTop = context.cardScroll;
      const trigger = context.trigger.isConnected ? context.trigger
        : Array.from(modal.querySelectorAll('[data-action="open-task-detail"]')).find(button => button.dataset.id === context.taskId);
      trigger?.focus({ preventScroll: true });
    });
    projectTaskReturn?.observer.disconnect();
    projectTaskReturn = context;
    context.observer.observe(taskModal, { attributes: true, attributeFilter: ['class'] });
    modal.classList.add('hidden');
    document.body.classList.remove('project-modal-open');
  }

  function clearProjectTaskReturn() {
    projectTaskReturn?.observer.disconnect();
    projectTaskReturn = null;
  }

  function openProjectDossier(id, trigger, options = {}) {
    const modal = document.getElementById('projectDetailModal');
    if (!selectedProjectId || !modal) return;
    const card = modal.querySelector('.project-detail-card');
    const context = { projectId:selectedProjectId, modalScroll:modal.scrollTop, cardScroll:card?.scrollTop || 0 };
    const opened = window.HabitFlowDossiers?.open(id, { ...options, entryId:options.entryId || trigger?.dataset?.entryId, fromProject:true, onDismiss(restore) {
      if (selectedProjectId !== context.projectId) return;
      if (!restore || !readState().projects.some(project => project.id === context.projectId)) { closeDetail({skipSync:true}); return; }
      window.HabitFlowRoadmapProjects?.refreshTasks?.();
      modal.classList.remove('hidden'); document.body.classList.add('project-modal-open');
      modal.scrollTop = context.modalScroll; if (card) card.scrollTop = context.cardScroll;
      const target = trigger.isConnected ? trigger : Array.from(modal.querySelectorAll('[data-action="open-project-dossier"]')).find(button => button.dataset.id === id);
      (target || modal.querySelector('.project-detail-close'))?.focus({preventScroll:true});
    } });
    if (opened) { modal.classList.add('hidden'); document.body.classList.remove('project-modal-open'); }
  }
  let dossierUnsubscribe = null;
  const loadedProjectDossiers = new Set();
  function renderProjectDossiers(projectId) {
    const mount = document.querySelector('[data-project-dossiers]');
    const store = window.HabitFlowDossiersStore;
    if (!mount || !store || selectedProjectId !== projectId) return;
    const snapshot = store.snapshot();
    const dossiers = snapshot.dossiers.filter(row => row.project_id === projectId);
    const expanded = new Set(Array.from(mount.querySelectorAll('details[open]'), node => node.dataset.projectDossier));
    const grouped = new Map(dossiers.map(row => [row.id, []]));
    for (const entry of snapshot.entries) {
      const list = grouped.get(entry.dossier_id); if (!list) continue;
      list.push(entry); list.sort((a,b) => b.updated_at.localeCompare(a.updated_at)); if (list.length > 3) list.pop();
    }
    const previews = dossiers.map(row => ({ row: {id:row.id,title:row.title}, metric:snapshot.metrics[row.id], entries:grouped.get(row.id).map(entry => ({title:entry.title,body:Array.from((entry.body || entry.link || 'Bild').replace(/\s+/g,' ').trim()).slice(0,100).join(''),updated_at:entry.updated_at})) }));
    const signature = JSON.stringify(previews);
    if (mount.dataset.signature === signature) return;
    const focused = document.activeElement?.closest?.('[data-project-dossier]');
    const focusId = focused && mount.contains(focused) ? focused.dataset.projectDossier : '';
    mount.dataset.signature = signature;
    mount.innerHTML = dossiers.length ? '<div class="project-section-head"><div><p class="eyebrow">Wissen &amp; Notizen</p><h3>Verknüpfte Dossiers</h3></div><span class="badge muted">' + dossiers.length + '</span></div><div class="project-dossier-grid">' + previews.map(({row,metric,entries}) => '<details class="project-dossier-preview" data-project-dossier="' + escapeHtml(row.id) + '"' + (expanded.has(row.id) ? ' open' : '') + '><summary><strong>' + escapeHtml(row.title) + '</strong><span>' + (metric?.exact ? metric.count + ' Einträge' : 'Einträge ansehen') + ' ⌄</span></summary><div class="project-dossier-notes">' + (entries.length ? entries.map(entry => '<article><strong>' + escapeHtml(entry.title || 'Notiz') + '</strong><p>' + escapeHtml(Array.from((entry.body || entry.link || 'Bild').replace(/\s+/g,' ').trim()).slice(0,100).join('')) + '</p><small>' + dateLabel(entry.updated_at) + '</small></article>').join('') : (metric?.exact && metric.count === 0 ? '<p class="subtle">Noch keine Einträge.</p>' : '<p class="subtle">Einträge werden beim Aufklappen geladen. Falls sie nicht erscheinen, bitte das Dossier öffnen.</p>')) + '<button class="mini-btn" type="button" data-action="open-project-dossier" data-id="' + escapeHtml(row.id) + '">Dossier öffnen ↗</button></div></details>').join('') + '</div>' : '';
    if (focusId) Array.from(mount.querySelectorAll('[data-project-dossier]')).find(node => node.dataset.projectDossier === focusId)?.querySelector('summary')?.focus({preventScroll:true});
  }
  async function openDetail(projectId) {
    window.HabitFlowDossiers?.showProjects();
    clearProjectTaskReturn();
    loadedProjectDossiers.clear();
    workspaceGeneration++; workspaceLoaded.clear(); knowledgeBusy=false; knowledgeKey=null;
    workspaceTab='cockpit'; workspaceProject=''; workspaceReady=false; workspaceSyncMessage='Projektdaten werden abgeglichen …';
    knowledgeFilter='all'; knowledgeQuery=''; knowledgeLimit=20; projectNoteLimit=20;
    selectedProjectId = projectId;
    renderDetail(projectId);
    if (!dossierUnsubscribe && window.HabitFlowDossiersStore) dossierUnsubscribe = window.HabitFlowDossiersStore.subscribe(() => {
      if (!selectedProjectId || workspaceRaf) return;
      workspaceRaf = window.requestAnimationFrame(() => { workspaceRaf=0; if(selectedProjectId) refreshWorkspaceKnowledge(); });
    });
    void window.HabitFlowDossiersStore?.sync('');
    const modal = document.getElementById('projectDetailModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.classList.add('project-modal-open');
    await pullRemoteProjectData(projectId).catch(error => console.warn('[HabitFlow/projects] Projekt konnte nicht nachgeladen werden.', error));
  }

  function closeDetail(options = {}) {
    workspaceGeneration++; knowledgeBusy=false; workspaceLoaded.clear(); knowledgeKey=null; knowledgeRows=[];
    if (workspaceRaf) window.cancelAnimationFrame(workspaceRaf); workspaceRaf=0;
    dossierUnsubscribe?.(); dossierUnsubscribe = null;
    clearProjectTaskReturn();
    selectedProjectId = '';
    document.getElementById('projectDetailModal')?.classList.add('hidden');
    document.body.classList.remove('project-modal-open');
    if (!options.skipSync) pullRemoteProjectData('', { silent: true }).catch(error => console.warn('[HabitFlow/projects] Projektliste konnte nicht nachgeladen werden.', error));
  }

  async function pullRemoteProjectData(projectId = '', options = {}) {
    const authEpoch=projectAuthEpoch;
    const supabase = getSupabaseClient();
    const userId = await currentUserId();
    if (!supabase || !userId || syncing) {
      if (!userId && selectedProjectId) { workspaceSyncMessage='Lokal verfügbar · zum Abgleichen bitte anmelden.'; renderDetail(selectedProjectId); }
      return;
    }
    syncing = true;
    if (!options.silent) setSyncStatus('synchronisiert...');
    try {
      const projectQuery = supabase.from(TABLE_PROJECTS).select('*').eq('user_id', userId).eq('is_archived', false);
      let phaseQuery = supabase.from(TABLE_PHASES).select('*').eq('user_id', userId).eq('is_archived', false);
      let milestoneQuery = supabase.from(TABLE_MILESTONES).select('*').eq('user_id', userId).eq('is_archived', false);
      let noteQuery = supabase.from(TABLE_NOTES).select('*').eq('user_id', userId).eq('is_archived', false);
      if (projectId) {
        phaseQuery = phaseQuery.eq('project_id', projectId);
        milestoneQuery = milestoneQuery.eq('project_id', projectId);
        noteQuery = noteQuery.eq('project_id', projectId);
      }
      const taskLinkQuery = supabase.from('tasks').select('id,project_id,updated_at').eq('user_id', userId).not('project_id', 'is', null);
      const [projectsRemote, phasesRemote, milestonesRemote, notesRemote, taskLinksRemote] = await Promise.all([projectQuery, phaseQuery, milestoneQuery, noteQuery, taskLinkQuery]);
      if (userId !== await currentUserId() || authEpoch !== projectAuthEpoch) return;
      if (projectsRemote.error) throw projectsRemote.error;
      if (phasesRemote.error) throw phasesRemote.error;
      if (milestonesRemote.error && !isMissingRemoteRelationError(milestonesRemote.error)) throw milestonesRemote.error;
      if (notesRemote.error && !isMissingRemoteRelationError(notesRemote.error)) throw notesRemote.error;
      if (taskLinksRemote.error && !isMissingRemoteColumnError(taskLinksRemote.error, 'project_id')) throw taskLinksRemote.error;
      const state = readState();
      const remoteProjects = (projectsRemote.data || []).map(row => normalizeProject({ ...row, synced: true }));
      const remotePhases = (phasesRemote.data || []).map(row => normalizePhase({ ...row, synced: true }));
      const remoteMilestones = (milestonesRemote.data || []).map(row => normalizeMilestone({ ...row, synced: true }));
      const remoteNotes = (notesRemote.data || []).map(row => normalizeProjectNote({ ...row, synced: true }));
      const remoteTaskLinks = new Map((taskLinksRemote.data || []).filter(row => row?.id && row.project_id).map(row => [String(row.id), row]));
      state.projects = mergeById(state.projects, remoteProjects);
      state.projectPhases = projectId ? [...remotePhases, ...state.projectPhases.filter(phase => phase.project_id !== projectId)] : remotePhases;
      state.projectMilestones = projectId ? [...remoteMilestones, ...state.projectMilestones.filter(item => item.project_id !== projectId)] : remoteMilestones;
      state.projectNotes = projectId ? [...remoteNotes, ...state.projectNotes.filter(item => item.project_id !== projectId)] : remoteNotes;
      if (remoteTaskLinks.size) {
        state.tasks = state.tasks.map(task => {
          const remoteLink = remoteTaskLinks.get(String(task.id));
          if (!remoteLink) return task;
          const clearedAt = new Date(task.project_link_cleared_at || 0).getTime();
          const remoteAt = new Date(remoteLink.updated_at || 0).getTime();
          if (clearedAt && clearedAt >= remoteAt) return task;
          const projectLink = String(remoteLink.project_id);
          return task.project_id !== projectLink ? { ...task, project_id: projectLink, projectId: projectLink, project_link_cleared_at: null } : task;
        });
      }
      writeState(state);
      if (!options.silent) setSyncStatus('synchronisiert');
      if (!projectId || selectedProjectId === projectId) { workspaceReady=!notesRemote.error && !taskLinksRemote.error && (taskLinksRemote.data || []).every(link=>state.tasks.some(task=>task.id === link.id)); workspaceSyncMessage=workspaceReady ? 'Projektdaten synchronisiert' : 'Projekt geladen · Aufgaben oder Notizen noch nicht vollständig verfügbar'; }
      render();
    } catch (error) {
      if (!options.silent) setSyncStatus('Sync-Fehler');
      console.warn('[HabitFlow/projects] Sync fehlgeschlagen.', error);
      if (selectedProjectId) { workspaceReady=false; workspaceSyncMessage='Abgleich fehlgeschlagen · lokal verfügbare Projektdaten.'; renderDetail(selectedProjectId); }
    } finally { syncing = false; }
  }

  function setSyncStatus(text) { const node = document.getElementById('projectSyncStatus'); if (node) node.textContent = text; }

  function bindEvents() {
    if (window.__habitFlowProjectsEventsBound) return;
    window.__habitFlowProjectsEventsBound = true;
    document.addEventListener('click', event => {
      // Editing intentionally navigates to the task form instead of returning to the project.
      if (projectTaskReturn && event.target.closest?.('[data-action="edit-task"]')) closeDetail({ skipSync: true });
    }, true);
    document.addEventListener('submit', event => {
      if (event.target?.id === 'projectForm') saveProject(event);
      if (event.target?.matches?.('[data-project-phase-form]')) savePhase(event);
      if (event.target?.matches?.('[data-project-milestone-form]')) saveMilestone(event);
      if (event.target?.matches?.('[data-project-note-form]')) saveProjectNote(event);
    });
    document.addEventListener('click', event => {
      const actionEl = event.target.closest?.('[data-action]');
      if (!actionEl) return;
      const action = actionEl.dataset.action;
      const id = actionEl.dataset.id;
      if (action.startsWith('workspace-')) { workspaceAction(action,id,actionEl); return; }
      if (action === 'toggle-project-form') openForm();
      if (action === 'close-project-form' || action === 'cancel-project-edit') closeForm();
      if (action === 'open-project-detail') openDetail(id);
      if (action === 'close-project-detail') closeDetail();
      if (action === 'edit-project') { closeDetail({ skipSync: true }); openForm(id); }
      if (action === 'mark-project-done') markProjectDone(id);
      if (action === 'edit-phase') editPhase(id);
      if (action === 'delete-phase') deletePhase(id);
      if (action === 'edit-milestone') editMilestone(id);
      if (action === 'delete-milestone') deleteMilestone(id);
      if (action === 'edit-project-note') editProjectNote(id);
      if (action === 'delete-project-note') deleteProjectNote(id);
      if (action === 'link-selected-task') linkTask(id, document.getElementById('projectTaskSelect')?.value || '');
      if (action === 'open-task-detail' && actionEl.closest('.project-task-row')) suspendProjectForTask(actionEl);
      if (action === 'open-project-dossier') openProjectDossier(id, actionEl);
      if (action === 'project-task-up' || action === 'project-task-down') {
        window.HabitFlowTaskOrder?.shift(id, action === 'project-task-up' ? -1 : 1, selectedProjectId);
        const mount = document.querySelector('[data-project-tasks]');
        if (mount) { mount.innerHTML = renderProjectTaskList(projectTasks(readState(),selectedProjectId)); const button = Array.from(mount.querySelectorAll('button')).find(node => node.dataset.id === id && node.dataset.action === action); (button?.disabled ? Array.from(mount.querySelectorAll('button')).find(node => node.dataset.id === id && node.dataset.action === 'open-task-detail') : button)?.focus({preventScroll:true}); }
      }
      if (action === 'unlink-task') unlinkTask(id);
      if (action === 'create-project-task') createProjectTask(id);
    });
    document.addEventListener('toggle', event => {
      if (event.target.isConnected && event.target.matches?.('[data-project-completed]')) { if (event.target.open) completedProjects.add(selectedProjectId); else completedProjects.delete(selectedProjectId); }
      if (event.target.matches?.('[data-project-dossier]') && event.target.open && event.target.isConnected) {
        if (!loadedProjectDossiers.has(event.target.dataset.projectDossier)) { loadedProjectDossiers.add(event.target.dataset.projectDossier); void window.HabitFlowDossiersStore?.sync(event.target.dataset.projectDossier); }
      }
    }, true);
    document.addEventListener('input', event => {
      if (event.target.matches?.('[data-workspace-search]')) { knowledgeQuery=event.target.value; knowledgeLimit=20; refreshWorkspaceKnowledge(); }
    });
    window.addEventListener?.('habitflow:auth-change', () => {
      projectAuthEpoch++; closeDetail({skipSync:true}); workspaceState=null; workspaceProject=''; workspaceTab='cockpit'; workspaceReady=false;
      const content=document.getElementById('projectDetailContent'); if(content) content.innerHTML='';
    });
    document.addEventListener('keydown', event => {
      if (event.target?.closest?.('[data-workspace-tabs]') && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
        event.preventDefault(); const tabs=['cockpit','planning','knowledge']; const index=tabs.indexOf(workspaceTab);
        selectWorkspaceTab(tabs[event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index+(event.key === 'ArrowRight' ? 1 : 2))%3]); return;
      }
      if (event.key === 'Escape' && !document.getElementById('projectDetailModal')?.classList.contains('hidden')) closeDetail();
    });
    document.getElementById('projectDetailModal')?.addEventListener('click', event => { if (event.target.id === 'projectDetailModal') closeDetail(); });
  }

  function boot() {
    patchStatePersistence();
    writeState(readState());
    injectShell();
    bindEvents();
    bindTaskBadgeObserver();
    render();
    setTimeout(() => pullRemoteProjectData(), 500);
    setTimeout(() => pullRemoteProjectData('', { silent: true }), 2500);
    setTimeout(() => pullRemoteProjectData('', { silent: true }), 6000);
    setTimeout(() => scheduleTaskBadgePaint(), 900);
  }

  window.HabitFlowRoadmapProjects = Object.freeze({
    badge: projectBadge,
    refreshTasks: () => { if (selectedProjectId) renderDetail(selectedProjectId); },
    snapshot: () => { const current = readState(); return { projects: current.projects, milestones: current.projectMilestones, taskLinks: current.tasks.map(task => ({ id: task.id, projectId: task.project_id })) }; },
    open: id => { if (readState().projects.some(project => project.id === id && !project.is_archived)) openDetail(id); }
  });

  patchStatePersistence();
  if (document.readyState === 'loading') {
    injectShell();
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})(window, document);
