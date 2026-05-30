(function registerHabitFlowTasksModule(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('tasks')) return;

  function injectTaskCardActionStyle(document) {
    if (!document || document.getElementById('habitflow-task-card-action-style')) return;

    const style = document.createElement('style');
    style.id = 'habitflow-task-card-action-style';
    style.textContent = `
      #screen-tasks button[data-action="open-task-detail"] {
        display: none !important;
      }

      #screen-tasks .mini-btn,
      #screen-tasks .pill,
      #screen-tasks .task-card-actions button,
      #screen-tasks .list-actions button,
      #screen-tasks .compact-actions button,
      #screen-tasks .kanban-cards button {
        font-weight: 680 !important;
        letter-spacing: -.015em !important;
      }

      #screen-tasks .mini-btn.primary,
      #screen-tasks .pill.primary {
        font-weight: 720 !important;
      }

      #screen-tasks .kanban-card a,
      #screen-tasks .task-card a,
      #screen-tasks .task-description a,
      #screen-tasks .task-card-description a,
      #screen-tasks a[href] {
        font-weight: 500 !important;
      }
    `;
    document.head.appendChild(style);
  }

  injectTaskCardActionStyle(window.document);

  modules.register('tasks', {
    description: 'Task domain boundary for backlog, recurring items, task ideas and archive handling.',
    dataTables: Object.freeze(['tasks', 'task_ideas']),
    migrationMode: 'keep existing parsing compatible while extracting utilities step by step',
    uiPatch: Object.freeze({
      hideRedundantDetailsButton: true,
      softerTaskButtonTypography: true,
      softerTaskLinks: true
    })
  });
})(window);
