(() => {
  'use strict';

  const CONTEXT_KEY = 'habitflow-task-project-context-v1';
  const STATE_KEY = 'habitflow-state-v1';

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function writeContext(projectId) {
    const state = readState();
    const project = (state.projects || []).find(item => String(item?.id || '') === String(projectId || ''));
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
})();
