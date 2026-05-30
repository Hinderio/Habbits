(function registerHabitFlowTasksModule(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('tasks')) return;

  modules.register('tasks', {
    description: 'Task domain boundary for backlog, recurring items, task ideas and archive handling.',
    dataTables: Object.freeze(['tasks', 'task_ideas']),
    migrationMode: 'keep existing parsing compatible while extracting utilities step by step'
  });
})(window);
