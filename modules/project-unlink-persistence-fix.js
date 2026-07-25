(() => {
  'use strict';

  if (window.__habitFlowProjectUnlinkPersistenceFixInstalled) return;
  window.__habitFlowProjectUnlinkPersistenceFixInstalled = true;

  const STATE_KEY = 'habitflow-state-v1';
  const MAX_INSTALL_ATTEMPTS = 100;
  const RETRY_MS = 100;

  let attempts = 0;
  let wrappedSetItem = null;

  function readState() {
    try {
      const parsed = JSON.parse(window.localStorage?.getItem(STATE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function clearedProjectTasksFromValue(value) {
    try {
      const parsed = JSON.parse(String(value || '{}'));
      return (Array.isArray(parsed.tasks) ? parsed.tasks : [])
        .filter(task => task?.id && !task.project_id && !task.projectId && task.project_link_cleared_at)
        .map(task => ({
          id: String(task.id),
          project_link_cleared_at: task.project_link_cleared_at,
          updated_at: task.updated_at
        }));
    } catch {
      return [];
    }
  }

  function preClearExistingLinks(clearedTasks) {
    if (!clearedTasks.length || !window.Storage?.prototype?.setItem) return;
    const clearedById = new Map(clearedTasks.map(task => [task.id, task]));
    const state = readState();
    if (!Array.isArray(state.tasks)) return;

    let changed = false;
    state.tasks = state.tasks.map(task => {
      const cleared = clearedById.get(String(task?.id || ''));
      if (!cleared || (!task.project_id && !task.projectId)) return task;
      changed = true;
      return {
        ...task,
        project_id: null,
        projectId: null,
        project_link_cleared_at: cleared.project_link_cleared_at,
        updated_at: cleared.updated_at || task.updated_at
      };
    });

    if (changed) {
      window.Storage.prototype.setItem.call(window.localStorage, STATE_KEY, JSON.stringify(state));
    }
  }

  function install() {
    const storage = window.localStorage;
    if (!storage?.setItem || !window.__habitFlowProjectsStoragePatched) return false;
    if (storage.setItem === wrappedSetItem) return true;

    const previousSetItem = storage.setItem.bind(storage);
    wrappedSetItem = function projectUnlinkAwareSetItem(key, value) {
      if (key === STATE_KEY) preClearExistingLinks(clearedProjectTasksFromValue(value));
      return previousSetItem(key, value);
    };
    storage.setItem = wrappedSetItem;
    return storage.setItem === wrappedSetItem;
  }

  function installWhenReady() {
    if (install()) return;
    attempts += 1;
    if (attempts < MAX_INSTALL_ATTEMPTS) window.setTimeout(installWhenReady, RETRY_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installWhenReady, { once: true });
  } else {
    installWhenReady();
  }
})();
