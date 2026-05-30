(function registerHabitFlowHabitsModule(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('habits')) return;

  modules.register('habits', {
    description: 'Habit domain boundary for definitions, entries, compact cards, details, pauses and rhythm analytics.',
    dataTables: Object.freeze(['habit_definitions', 'habit_entries', 'pause_periods']),
    uiContracts: Object.freeze(['compact habit cards', 'detail modal', 'habit DNA', 'habit heatmap']),
    migrationMode: 'extend existing app.js functions first, move pure helpers later'
  });
})(window);
