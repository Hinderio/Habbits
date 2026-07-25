(() => {
  'use strict';

  if (window.__habitFlowProjectIdeaBridgeInstalled) return;
  window.__habitFlowProjectIdeaBridgeInstalled = true;

  const STATE_KEY = 'habitflow-state-v1';
  const CONTEXT_KEY = 'habitflow-idea-project-context-v1';
  const META_RE = /\n?\s*<!--hf-idea-meta:([^>]+)-->/;
  const RETRY_DELAYS = [120, 360, 800, 1400, 2400, 3600];

  let supabaseClient = null;
  let lastProjectFieldSignature = '';
  let syncProjectFieldQueued = false;

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeState(state) {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state || {}));
      return true;
    } catch (error) {
      console.warn('[HabitFlow/projects] Ideen-Projekt-Verknuepfung konnte lokal nicht gespeichert werden.', error);
      return false;
    }
  }

  function escapeHtml(value = '') {
    return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function cleanDescription(value = '') {
    return String(value || '').replace(META_RE, '').trim();
  }

  function parseMeta(value = '') {
    const match = String(value || '').match(META_RE);
    if (!match) return {};
    try {
      const decoded = JSON.parse(decodeURIComponent(match[1] || ''));
      return decoded && typeof decoded === 'object' ? decoded : {};
    } catch {
      return {};
    }
  }

  function descriptionWithMeta(description = '', extraMeta = {}) {
    const clean = cleanDescription(description);
    const meta = { ...parseMeta(description), ...extraMeta };
    Object.keys(meta).forEach(key => {
      if (meta[key] == null || meta[key] === '') delete meta[key];
    });
    if (!Object.keys(meta).length) return clean;
    return `${clean ? `${clean}\n\n` : ''}<!--hf-idea-meta:${encodeURIComponent(JSON.stringify(meta))}-->`;
  }

  function ideaProjectId(idea = {}) {
    return String(idea.project_id || idea.projectId || parseMeta(idea.description).project_id || '');
  }

  function activeProjects() {
    return (readState().projects || [])
      .filter(project => project?.id && !project.is_archived)
      .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'de'));
  }

  function projectById(projectId) {
    return activeProjects().find(project => String(project.id) === String(projectId || '')) || null;
  }

  function readContext() {
    let parsed = null;
    try {
      const raw = sessionStorage.getItem(CONTEXT_KEY);
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    return parsed?.project_id ? parsed : null;
  }

  function writeContext(projectId) {
    const project = projectById(projectId);
    if (!project) return null;
    const context = {
      project_id: String(project.id),
      project_title: String(project.title || 'Projekt'),
      project_color: project.color || null,
      created_at: Date.now()
    };
    try {
      sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
    } catch {
      window.__habitFlowIdeaProjectContext = context;
    }
    return context;
  }

  function clearContext() {
    try {
      sessionStorage.removeItem(CONTEXT_KEY);
    } catch {}
    if (window.__habitFlowIdeaProjectContext) delete window.__habitFlowIdeaProjectContext;
  }

  function ensureProjectField() {
    const form = document.getElementById('taskIdeaForm');
    if (!form || form.elements.project_id) return form?.elements.project_id || null;
    const noteLabel = form.querySelector('textarea[name="description"]')?.closest('label');
    const field = document.createElement('label');
    field.dataset.taskIdeaProjectField = 'true';
    field.innerHTML = '<span>Projekt</span><select name="project_id"></select>';
    if (noteLabel) noteLabel.insertAdjacentElement('beforebegin', field);
    else form.appendChild(field);
    return field.querySelector('select');
  }

  function syncProjectField() {
    const select = ensureProjectField();
    if (!select) return;
    const context = readContext() || window.__habitFlowIdeaProjectContext || null;
    const projects = activeProjects();
    const selected = context?.project_id || select.value || '';
    const value = projects.some(project => String(project.id) === String(selected)) ? String(selected) : '';
    const signature = `${value}|${projects.map(project => `${project.id}:${project.title || ''}`).join('|')}`;
    if (signature === lastProjectFieldSignature && select.value === value) return;
    lastProjectFieldSignature = signature;
    select.innerHTML = [
      '<option value="">Kein Projekt</option>',
      ...projects.map(project => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.title || 'Projekt')}</option>`)
    ].join('');
    select.value = value;
  }

  function queueSyncProjectField(delay = 0) {
    if (syncProjectFieldQueued) return;
    syncProjectFieldQueued = true;
    window.setTimeout(() => {
      syncProjectFieldQueued = false;
      syncProjectField();
    }, delay);
  }

  function openIdeaMask(projectId) {
    if (!writeContext(projectId)) return;
    document.querySelector('.nav-btn[data-target="tasks"]')?.click();
    window.setTimeout(() => {
      const panel = document.getElementById('taskIdeasPanel');
      const toggle = document.getElementById('taskIdeasToggleBtn');
      if (panel?.classList.contains('hidden')) toggle?.click();
      syncProjectField();
      document.querySelector('#taskIdeaForm [name="title"]')?.focus({ preventScroll: false });
    }, 90);
  }

  function persistIdeaProject(ideaId, projectId) {
    if (!ideaId || !projectId) return false;
    const state = readState();
    const ideas = Array.isArray(state.taskIdeas) ? state.taskIdeas : [];
    const now = new Date().toISOString();
    let changed = false;
    state.taskIdeas = ideas.map(idea => {
      if (String(idea?.id || '') !== String(ideaId)) return idea;
      changed = true;
      return {
        ...idea,
        project_id: String(projectId),
        projectId: String(projectId),
        description: descriptionWithMeta(idea.description, { project_id: String(projectId) }),
        updated_at: now,
        synced: false
      };
    });
    if (!changed) return false;
    writeState(state);
    const updatedIdea = state.taskIdeas.find(idea => String(idea?.id || '') === String(ideaId));
    syncRemoteIdeaProject(updatedIdea, projectId, now).then(synced => {
      if (!synced) return;
      const fresh = readState();
      fresh.taskIdeas = (fresh.taskIdeas || []).map(idea => String(idea?.id || '') === String(ideaId) ? { ...idea, synced: true } : idea);
      writeState(fresh);
      window.dispatchEvent(new Event('habitflow:projects-changed'));
    });
    window.dispatchEvent(new Event('habitflow:projects-changed'));
    return true;
  }

  function newestCreatedIdea(beforeIds, createdAt = Date.now()) {
    const createdAfter = Number(createdAt || Date.now()) - 60000;
    return (readState().taskIdeas || [])
      .filter(idea => idea?.id && !beforeIds.has(String(idea.id)))
      .filter(idea => !createdAfter || Date.parse(idea.created_at || idea.updated_at || '') >= createdAfter)
      .sort((a, b) => Date.parse(b.created_at || b.updated_at || 0) - Date.parse(a.created_at || a.updated_at || 0))[0] || null;
  }

  function linkCreatedIdea(beforeIds, projectId, createdAt, attempt = 0) {
    const idea = newestCreatedIdea(beforeIds, createdAt);
    if (idea) {
      persistIdeaProject(idea.id, projectId);
      clearContext();
      return;
    }
    const delay = RETRY_DELAYS[attempt];
    if (delay) window.setTimeout(() => linkCreatedIdea(beforeIds, projectId, createdAt, attempt + 1), delay);
  }

  function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;
    const config = window.HABITFLOW_SUPABASE_CONFIG;
    const createClient = window.supabase?.createClient;
    if (!config?.url || !config?.anonKey || typeof createClient !== 'function') return null;
    supabaseClient = createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return supabaseClient;
  }

  async function syncRemoteTaskProject(taskId, projectId, updatedAt) {
    const client = getSupabaseClient();
    if (!client || !taskId || !projectId) return false;
    const { error } = await client.from('tasks').update({ project_id: projectId, updated_at: updatedAt }).eq('id', taskId);
    if (error) {
      console.warn('[HabitFlow/projects] Ideen-Task konnte remote nicht mit Projekt verknuepft werden.', error);
      return false;
    }
    return true;
  }

  async function syncRemoteIdeaProject(idea, projectId, updatedAt) {
    const client = getSupabaseClient();
    if (!client || !idea?.id || !projectId) return false;
    const description = descriptionWithMeta(idea.description, { project_id: String(projectId) });
    const { error } = await client.from('task_ideas').update({ description, updated_at: updatedAt }).eq('id', idea.id);
    if (error) {
      console.warn('[HabitFlow/projects] Idee konnte remote nicht mit Projekt verknuepft werden.', error);
      return false;
    }
    return true;
  }

  function ideaProjectMap() {
    const pairs = new Map();
    (readState().taskIdeas || []).forEach(idea => {
      const projectId = ideaProjectId(idea);
      if (idea?.id && projectId) pairs.set(String(idea.id), String(projectId));
    });
    return pairs;
  }

  function restoreIdeaProjectLinks(projectByIdeaId) {
    if (!projectByIdeaId?.size) return false;
    const state = readState();
    const ideas = Array.isArray(state.taskIdeas) ? state.taskIdeas : [];
    const now = new Date().toISOString();
    let changed = false;
    const remoteUpdates = [];
    state.taskIdeas = ideas.map(idea => {
      const projectId = projectByIdeaId.get(String(idea?.id || ''));
      if (!idea?.id || !projectId || ideaProjectId(idea)) return idea;
      changed = true;
      const next = {
        ...idea,
        project_id: projectId,
        projectId: projectId,
        description: descriptionWithMeta(idea.description, { project_id: projectId }),
        updated_at: now,
        synced: false
      };
      remoteUpdates.push(next);
      return next;
    });
    if (!changed) return false;
    writeState(state);
    remoteUpdates.forEach(idea => {
      syncRemoteIdeaProject(idea, ideaProjectId(idea), idea.updated_at).then(synced => {
        if (!synced) return;
        const fresh = readState();
        fresh.taskIdeas = (fresh.taskIdeas || []).map(item => String(item?.id || '') === String(idea.id) ? { ...item, synced: true } : item);
        writeState(fresh);
      });
    });
    window.dispatchEvent(new Event('habitflow:projects-changed'));
    return true;
  }

  function persistTaskProject(taskId, projectId) {
    if (!taskId || !projectId) return false;
    const state = readState();
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const now = new Date().toISOString();
    let changed = false;
    state.tasks = tasks.map(task => {
      if (String(task?.id || '') !== String(taskId)) return task;
      changed = true;
      return { ...task, project_id: String(projectId), projectId: String(projectId), project_link_cleared_at: null, updated_at: now, synced: false };
    });
    if (!changed) return false;
    writeState(state);
    syncRemoteTaskProject(taskId, projectId, now).then(synced => {
      if (!synced) return;
      const fresh = readState();
      fresh.tasks = (fresh.tasks || []).map(task => String(task?.id || '') === String(taskId) ? { ...task, synced: true } : task);
      writeState(fresh);
      window.dispatchEvent(new Event('habitflow:project-task-link-updated'));
    });
    return true;
  }

  function linkTaskCreatedFromIdea(ideaId, projectId, beforeTaskIds, attempt = 0) {
    const state = readState();
    const idea = (state.taskIdeas || []).find(item => String(item?.id || '') === String(ideaId));
    const generatedId = idea?.generated_task_id;
    const task = generatedId
      ? (state.tasks || []).find(item => String(item?.id || '') === String(generatedId))
      : (state.tasks || []).filter(item => item?.id && !beforeTaskIds.has(String(item.id))).sort((a, b) => Date.parse(b.created_at || b.updated_at || 0) - Date.parse(a.created_at || a.updated_at || 0))[0];
    if (task?.id) {
      persistTaskProject(task.id, projectId);
      return;
    }
    const delay = RETRY_DELAYS[attempt];
    if (delay) window.setTimeout(() => linkTaskCreatedFromIdea(ideaId, projectId, beforeTaskIds, attempt + 1), delay);
  }

  function patchStoragePreservation() {
    // Intentionally no global localStorage monkey patch: the app writes a large state object often.
    // Project links are applied at the precise create/convert interaction points instead.
  }

  function injectStyle() {
    if (document.getElementById('habitflow-project-idea-bridge-style')) return;
    const style = document.createElement('style');
    style.id = 'habitflow-project-idea-bridge-style';
    style.textContent = '[data-task-idea-project-field]{display:flex;flex-direction:column;gap:8px}';
    document.head.appendChild(style);
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const addIdea = event.target?.closest?.('#projectTimelineViewMount [data-action="open-project-idea"]');
      if (addIdea?.dataset.id) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openIdeaMask(addIdea.dataset.id);
        return;
      }

      const ideaTile = event.target?.closest?.('#projectTimelineViewMount [data-action="idea-to-task"]');
      if (!ideaTile?.dataset.id) return;
      const state = readState();
      const idea = (state.taskIdeas || []).find(item => String(item?.id || '') === String(ideaTile.dataset.id));
      const projectId = ideaProjectId(idea);
      if (!projectId) return;
      const beforeTaskIds = new Set((state.tasks || []).map(task => String(task.id)));
      window.setTimeout(() => linkTaskCreatedFromIdea(ideaTile.dataset.id, projectId, beforeTaskIds), 0);
    }, true);

    document.addEventListener('submit', event => {
      if (event.target?.id !== 'taskIdeaForm') return;
      const select = ensureProjectField();
      const context = readContext() || window.__habitFlowIdeaProjectContext || null;
      const projectId = select?.value || context?.project_id || '';
      const textarea = event.target.elements.description;
      if (projectId && textarea) textarea.value = descriptionWithMeta(textarea.value, { project_id: String(projectId) });
      const beforeIds = new Set((readState().taskIdeas || []).map(idea => String(idea.id)));
      const createdAt = Date.now();
      if (projectId) window.setTimeout(() => linkCreatedIdea(beforeIds, projectId, createdAt), 0);
      else clearContext();
    }, true);

    document.addEventListener('click', event => {
      if (event.target?.closest?.('#taskIdeasToggleBtn')) queueSyncProjectField(90);
      const action = event.target?.closest?.('#taskIdeasPanel [data-action], #projectTimelineViewMount [data-action="idea-to-task"]');
      if (!action) return;
      const beforeProjects = ideaProjectMap();
      [80, 420, 1200].forEach(delay => window.setTimeout(() => restoreIdeaProjectLinks(beforeProjects), delay));
    }, true);
  }

  function boot() {
    patchStoragePreservation();
    injectStyle();
    syncProjectField();
    bindEvents();
    new MutationObserver(mutations => {
      const shouldSync = mutations.some(mutation => Array.from(mutation.addedNodes || []).some(node => node.nodeType === 1 && (node.id === 'taskIdeaForm' || node.querySelector?.('#taskIdeaForm'))));
      if (shouldSync) queueSyncProjectField(0);
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();