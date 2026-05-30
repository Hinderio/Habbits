(function registerHabitFlowMonthlyMissionsModule(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('monthly-missions')) return;

  modules.register('monthly-missions', {
    description: 'Monthly mission boundary for mission forms, progress calculation and magazine review dependencies.',
    dataTables: Object.freeze(['monthly_missions']),
    supportedMetrics: Object.freeze([
      'running_sessions',
      'hiking_days',
      'smoke_free_evenings',
      'alcohol_free_weekend_days',
      'deep_work_sessions',
      'completed_tasks',
      'morning_routines',
      'manual_count'
    ]),
    migrationMode: 'extract metric calculation only after existing dashboard and magazine output is covered'
  });
})(window);
