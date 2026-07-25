(() => {
  'use strict';

  const CONTEXT_KEY = 'habitflow-task-project-context-v1';
  const STATE_KEY = 'habitflow-state-v1';
  const CONTEXT_TTL_MS = 30 * 60 * 1000;
  const RETRY_DELAYS = [120, 260, 520, 900, 1400, 2200, 3200];

  let supabaseClient = null;
  let editingTaskId = '';
  let formObserverBound = false;

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

  function activeProjects() {
    return (readState().projects || [])
      .filter(project => project?.id && !project.is_archived)
      .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'de'));
  }

  function taskById(taskId) {
    return (readState().tasks || []).find(task => String(task?.id || '') === String(taskId || '')) || null;
  }

  function writeContext(projectId) {
    const project = activeProjects().find(item => String(item.id) === String(projectId || ''));
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

  function escapeHtml(value = '') {
    return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function ensureProjectField() {
    const form = document.getElementById('taskForm');
    if (!form || form.elements.project_id) return form?.elements.project_id || null;
    const priorityLabel = form.querySelector('select[name="priority"]')?.closest('label');
    const field = document.createElement('label');
    field.dataset.taskProjectField = 'true';
    field.innerHTML = '<span>Projekt</span><select name="project_id"></select>';
    if (priorityLabel) priorityLabel.insertAdjacentElement('afterend', field);
    else form.prepend(field);
    return field.querySelector('select');
  }

  function selectedProjectIdForForm() {
    const context = readContext();
    if (context?.project_id) return context.project_id;
    const task = taskById(editingTaskId);
    return task?.project_id || task?.projectId || '';
  }

  function syncProjectField() {
    const select = ensureProjectField();
    if (!select) return;
    const selected = selectedProjectIdForForm();
    const projects = activeProjects();
    select.innerHTML = [
      '<option value="">Kein Projekt</option>',
      ...projects.map(project => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.title || 'Projekt')}</option>`)
    ].join('');
    select.value = projects.some(project => String(project.id) === String(selected)) ? String(selected) : '';
  }

  function bindFormObserver() {
    if (formObserverBound) return;
    const panel = document.getElementById('taskFormPanel');
    if (!panel) return;
    formObserverBound = true;
    new MutationObserver(() => {
      if (!panel.classList.contains('hidden')) window.setTimeout(syncProjectField, 0);
    }).observe(panel, { attributes: true, attributeFilter: ['class'] });
  }

  function closeProjectDialog() {
    document.getElementById('projectDetailModal')?.classList.add('hidden');
    document.body.classList.remove('project-modal-open');
  }

  function closeTaskDialog() {
    document.getElementById('taskDetailModal')?.classList.add('hidden');
    const detail = document.getElementById('taskDetailContent');
    if (detail) detail.innerHTML = '';
    document.body.classList.remove('modal-open');
  }

  function openTaskMask() {
    closeProjectDialog();
    document.querySelector('.nav-btn[data-target="tasks"]')?.click();
    window.setTimeout(() => {
      const panel = document.getElementById('taskFormPanel');
      const toggle = document.getElementById('taskFormToggleBtn');
      if (panel?.classList.contains('hidden')) toggle?.click();
      syncProjectField();
      document.querySelector('#taskForm [name="title"]')?.focus({ preventScroll: false });
    }, 80);
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

  async function syncRemoteProjectLink(taskId, projectId, updatedAt) {
    const client = getSupabaseClient();
    if (!client) return false;
    const { error } = await client
      .from('tasks')
      .update({ project_id: projectId || null, updated_at: updatedAt })
      .eq('id', taskId);
    if (error) {
      console.warn('[HabitFlow/projects] Task-Projekt-Verknuepfung konnte remote nicht gespeichert werden.', error);
      return false;
    }
    return true;
  }

  async function persistProjectLink(taskId, projectId, { clearProjectContext = false } = {}) {
    if (!taskId) return false;
    const normalizedProjectId = projectId ? String(projectId) : null;
    const state = readState();
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const task = tasks.find(item => String(item?.id || '') === String(taskId));
    if (!task) return false;

    const updatedAt = new Date().toISOString();
    state.tasks = tasks.map(item => String(item?.id || '') === String(taskId)
      ? { ...item, project_id: normalizedProjectId, projectId: normalizedProjectId, updated_at: updatedAt, synced: false }
      : item);
    writeState(state);

    const synced = await syncRemoteProjectLink(taskId, normalizedProjectId, updatedAt);
    if (synced) {
      const fresh = readState();
      fresh.tasks = (fresh.tasks || []).map(item => String(item?.id || '') === String(taskId)
        ? { ...item, project_id: normalizedProjectId, projectId: normalizedProjectId, synced: true }
        : item);
      writeState(fresh);
      if (clearProjectContext) clearContext();
      window.setTimeout(() => window.dispatchEvent(new Event('habitflow:project-task-link-updated')), 0);
    }
    return synced;
  }

  function newestCreatedTask(beforeIds, createdAt = Date.now()) {
    const createdAfter = Number(createdAt || Date.now()) - 60 * 1000;
    return (readState().tasks || [])
      .filter(task => task?.id && !beforeIds.has(String(task.id)))
      .filter(task => !createdAfter || Date.parse(task.created_at || task.updated_at || '') >= createdAfter)
      .sort((a, b) => Date.parse(b.created_at || b.updated_at || 0) - Date.parse(a.created_at || a.updated_at || 0))[0] || null;
  }

  function linkCreatedTask(beforeIds, projectId, createdAt, attempt = 0) {
    const task = newestCreatedTask(beforeIds, createdAt);
    if (task) {
      persistProjectLink(task.id, projectId, { clearProjectContext: true });
      return;
    }
    const delay = RETRY_DELAYS[attempt];
    if (delay) window.setTimeout(() => linkCreatedTask(beforeIds, projectId, createdAt, attempt + 1), delay);
  }

  function repairRecentContextTask() {
    const context = readContext();
    if (!context) return;
    const createdAfter = Number(context.created_at || 0) - 60 * 1000;
    const task = (readState().tasks || [])
      .filter(item => item?.id && !item.project_id)
      .filter(item => Date.parse(item.created_at || item.updated_at || '') >= createdAfter)
      .sort((a, b) => Date.parse(b.created_at || b.updated_at || 0) - Date.parse(a.created_at || a.updated_at || 0))[0];
    if (task) persistProjectLink(task.id, context.project_id, { clearProjectContext: true });
  }

  function openProjectDetail(projectId) {
    if (!projectId) return;
    closeTaskDialog();
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.dataset.action = 'open-project-detail';
    trigger.dataset.id = projectId;
    trigger.hidden = true;
    document.body.appendChild(trigger);
    trigger.click();
    trigger.remove();
  }

  function enhanceProjectBadges(root = document) {
    root.querySelectorAll?.('[data-project-badge-root]').forEach(node => {
      if (node.dataset.projectLinkEnhanced) return;
      node.dataset.projectLinkEnhanced = 'true';
      node.classList.add('is-project-link');
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
      node.setAttribute('aria-label', 'Projekt öffnen');
      node.setAttribute('title', 'Projekt öffnen');
    });
  }

  function injectStyle() {
    if (document.getElementById('habitflow-task-project-integration-style')) return;
    const style = document.createElement('style');
    style.id = 'habitflow-task-project-integration-style';
    style.textContent = '[data-task-project-field]{display:flex;flex-direction:column;gap:8px}[data-project-badge-root].is-project-link{cursor:pointer;width:max-content;max-width:100%}[data-project-badge-root].is-project-link:focus-visible{outline:3px solid rgba(74,215,209,.42);outline-offset:4px;border-radius:999px}';
    document.head.appendChild(style);
  }

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-action="create-project-task"]');
    if (!button) return;
    const context = writeContext(button.dataset.id);
    if (!context) return;
    editingTaskId = '';
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openTaskMask();
  }, true);

  document.addEventListener('click', event => {
    const badge = event.target?.closest?.('.task-detail-modal [data-project-badge-root]');
    if (!badge?.dataset.projectId) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openProjectDetail(badge.dataset.projectId);
  }, true);

  document.addEventListener('keydown', event => {
    const badge = event.target?.closest?.('.task-detail-modal [data-project-badge-root]');
    if (!badge?.dataset.projectId || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    openProjectDetail(badge.dataset.projectId);
  }, true);

  document.addEventListener('click', event => {
    const editButton = event.target?.closest?.('[data-action="edit-task"]');
    if (editButton?.dataset.id) {
      editingTaskId = String(editButton.dataset.id);
      clearContext();
      window.setTimeout(syncProjectField, 90);
      return;
    }
    if (event.target?.closest?.('#taskFormToggleBtn')) {
      editingTaskId = '';
      window.setTimeout(syncProjectField, 90);
      return;
    }
    if (event.target?.closest?.('#taskFormCloseBtn, #cancelTaskEditBtn')) {
      editingTaskId = '';
      clearContext();
    }
  }, true);

  document.addEventListener('submit', event => {
    if (event.target?.id !== 'taskForm') return;
    const select = ensureProjectField();
    const selectedProjectId = select?.value || '';
    const context = readContext();
    const beforeIds = new Set((readState().tasks || []).map(task => String(task.id)));
    const submittedEditId = editingTaskId;
    const createdAt = Date.now();

    window.setTimeout(() => {
      if (submittedEditId) {
        persistProjectLink(submittedEditId, selectedProjectId);
        editingTaskId = '';
        clearContext();
        return;
      }
      if (selectedProjectId || context?.project_id) {
        linkCreatedTask(beforeIds, selectedProjectId || context.project_id, createdAt);
      } else {
        clearContext();
      }
    }, 0);
  }, true);

  window.addEventListener('storage', event => {
    if (event.key === STATE_KEY) window.setTimeout(syncProjectField, 0);
  });
  window.addEventListener('habitflow:project-task-link-updated', () => {
    window.setTimeout(() => {
      syncProjectField();
      enhanceProjectBadges();
    }, 0);
  });

  const boot = () => {
    injectStyle();
    bindFormObserver();
    syncProjectField();
    enhanceProjectBadges();
    new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) enhanceProjectBadges(node);
      }));
    }).observe(document.body, { childList: true, subtree: true });
    window.setTimeout(repairRecentContextTask, 400);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
