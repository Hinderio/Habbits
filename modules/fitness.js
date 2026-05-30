(function registerHabitFlowFitnessModule(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('fitness')) return;

  modules.register('fitness', {
    description: 'Fitness domain boundary for coach tabs, activities, route progress and nutrition content.',
    uiStateKeys: Object.freeze([
      'habitflow-fitness-filter-v1',
      'habitflow-fitness-detail-tab-v1',
      'habitflow-fitness-mobile-sections-v1',
      'habitflow-fitness-coach-state-v1'
    ]),
    migrationMode: 'extract catalog and config data before changing interactive coach behavior'
  });
})(window);
