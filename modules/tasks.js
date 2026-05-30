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
      #screen-tasks .kanban-cards button,
      .task-detail-modal .mini-btn,
      .task-detail-modal .pill,
      .task-detail-modal .list-actions button,
      .task-detail-modal .compact-actions button {
        font-weight: 680 !important;
        letter-spacing: -.015em !important;
      }

      #screen-tasks .mini-btn.primary,
      #screen-tasks .pill.primary,
      .task-detail-modal .mini-btn.primary,
      .task-detail-modal .pill.primary {
        font-weight: 720 !important;
      }

      #screen-tasks .kanban-card a,
      #screen-tasks .task-card a,
      #screen-tasks .task-description a,
      #screen-tasks .task-card-description a,
      #screen-tasks a[href],
      .task-detail-modal a[href] {
        font-weight: 500 !important;
      }

      .task-detail-modal .badge,
      .task-detail-modal .task-badges .badge,
      .task-detail-modal .task-detail-meta,
      .task-detail-modal .task-detail-meta span,
      .task-detail-modal .task-detail-status,
      .task-detail-modal .task-detail-status span,
      .task-detail-modal .task-detail-side span,
      .task-detail-modal .task-detail-card small {
        font-weight: 680 !important;
        letter-spacing: -.01em !important;
      }

      .task-detail-modal button[data-action="close-task-detail"],
      .task-detail-modal .task-detail-actions button:last-child:not(.primary):not(.danger),
      .task-detail-modal .form-actions button:last-child:not(.primary):not(.danger) {
        display: none !important;
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
      softerTaskLinks: true,
      softerTaskDetailTypography: true,
      hideTaskDetailCloseAction: true
    })
  });
})(window);
