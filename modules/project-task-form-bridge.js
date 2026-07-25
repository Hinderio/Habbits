(() => {
  'use strict';

  const CONTEXT_KEY = 'habitflow-task-project-context-v1';
  const STATE_KEY = 'habitflow-state-v1';
  const CONTEXT_TTL_MS = 30 * 60 * 1000;
  const RETRY_DELAYS = [120, 260, 520, 900, 1400, 2200, 3200];

  let supabaseClient = null;

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function writeState(state) {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn('[HabitFlow/projects] Task-Projekt-Verknuepfung konnte lokal nicht gespeichert werden.', error);
      return false;
    }
  }

  function normalizeContext(raw) {
    if (!raw?.project_id) return null;
    const createdAt = Number(raw.created_at || 0);
    if (createdAt && Date.now() - createdAt > CONTEXT_TTL_MS) {
      clearContext();
      return null;
    }
    return {
      project_id: String(raw.project_id),
      project_title: String(raw.project_title || 'Projekt'),
      project_color: raw.project_color || null,
      created_at: createdAt || Date.now()
    };
  }

  function readContext() {
    let parsed = null;
    try {
      const raw = sessionStorage.getItem(CONTEXT_KEY);
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    return normalizeContext(parsed || window.__habitFlowTaskProjectContext);
  }

  function clearContext() {
    try {
      sessionStorage.removeItem(CONTEXT_KEY);
    } catch {}
    if (window.__habitFlowTaskProjectContext) delete window.__habitFlowTaskProjectContext;
  }

  function writeContext(projectId) {
    const state = readState();
    const project = (state.projects || []).find(item => String(item?.id || '') === String(projectId || ''));
    if (!project) return null;
    const context = normalizeContext({
      project_id: project.id,
      project_title: project.title || 'Projekt',
      project_color: project.color || null,
      created_at: Date.now()
    });
    try {
      sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
    } catch {
      window.__habitFlowTaskProjectContext = context;
    }
    return context;
  }

  function closeProjectDialog() {
    document.getElementById('projectDetailModal')?.classList.add('hidden');
    document.body.classList.remove('project-modal-open');
  }

  function openTaskMask() {
    closeProjectDialog();
    document.querySelector('.nav-btn[data-target="tasks"]')?.click();
    window.setTimeout(() => {
      const panel = document.getElementById('taskFormPanel');
      const toggle = document.getElementById('taskFormToggleBtn');
      if (panel?.classList.contains('hidden')) toggle?.click();
      document.querySelector('#taskForm [name="title"]')?.focus({ preventScroll: false });
    }, 80);
  }

  function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;
    const config = window.HABITFLOW_SUPABASE_CONFIG;
    const createClient = window.supabase?.createClient;
    if (!config?.url || !config?.anonKey || typeof createClient !== 'function') return null;
    supabaseClient = createClient(config.url, config.anonKey);
    return supabaseClient;
  }

  async function syncRemoteProjectLink(taskId, projectId, updatedAt) {
    const client = getSupabaseClient();
    if (!client) return false;
    const { error } = await client
      .from('tasks')
      .update({ project_id: projectId, updated_at: updatedAt })
      .eq('id', taskId);
    if (error) {
      console.warn('[HabitFlow/projects] Task-Projekt-Verknuepfung konnte remote nicht gespeichert werden.', error);
      return false;
    }
    return true;
  }

  async function persistProjectLink(taskId, context) {
    if (!taskId || !context?.project_id) return false;
    const state = readState();
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const task = tasks.find(item => String(item?.id || '') === String(taskId));
    if (!task) return false;

    const updatedAt = new Date().toISOString();
    state.tasks = tasks.map(item => String(item?.id || '') === String(taskId)
      ? { ...item, project_id: context.project_id, projectId: context.project_id, updated_at: updatedAt, synced: false }
      : item);
    writeState(state);

    const synced = await syncRemoteProjectLink(taskId, context.project_id, updatedAt);
    if (synced) {
      const fresh = readState();
      fresh.tasks = (fresh.tasks || []).map(item => String(item?.id || '') === String(taskId)
        ? { ...item, project_id: context.project_id, projectId: context.project_id, synced: true }
        : item);
      writeState(fresh);
      clearContext();
    }
    return synced;
  }

  function newestCreatedTask(beforeIds, context) {
    const state = readState();
    const createdAfter = Number(context?.created_at || 0) - 60 * 1000;
    return (state.tasks || [])
      .filter(task => task?.id && !task.project_id && !beforeIds.has(String(task.id)))
      .filter(task => !createdAfter || Date.parse(task.created_at || task.updated_at || '') >= createdAfter)
      .sort((a, b) => Date.parse(b.created_at || b.updated_at || 0) - Date.parse(a.created_at || a.updated_at || 0))[0] || null;
  }

  function linkCreatedTask(beforeIds, context, attempt = 0) {
    const task = newestCreatedTask(beforeIds, context);
    if (task) {
      persistProjectLink(task.id, context);
      return;
    }
    const delay = RETRY_DELAYS[attempt];
    if (delay) window.setTimeout(() => linkCreatedTask(beforeIds, context, attempt + 1), delay);
  }

  function repairRecentContextTask() {
    const context = readContext();
    if (!context) return;
    const state = readState();
    const createdAfter = Number(context.created_at || 0) - 60 * 1000;
    const task = (state.tasks || [])
      .filter(item => item?.id && !item.project_id)
      .filter(item => Date.parse(item.created_at || item.updated_at || '') >= createdAfter)
      .sort((a, b) => Date.parse(b.created_at || b.updated_at || 0) - Date.parse(a.created_at || a.updated_at || 0))[0];
    if (task) persistProjectLink(task.id, context);
  }

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-action="create-project-task"]');
    if (!button) return;
    const context = writeContext(button.dataset.id);
    if (!context) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openTaskMask();
  }, true);

  document.addEventListener('submit', event => {
    if (event.target?.id !== 'taskForm') return;
    const context = readContext();
    if (!context) return;
    const beforeIds = new Set((readState().tasks || []).map(task => String(task.id)));
    window.setTimeout(() => linkCreatedTask(beforeIds, context), 0);
  }, true);

  document.addEventListener('click', event => {
    if (event.target?.closest?.('#taskFormCloseBtn, #cancelTaskEditBtn')) clearContext();
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.setTimeout(repairRecentContextTask, 400), { once: true });
  } else {
    window.setTimeout(repairRecentContextTask, 400);
  }
})();
