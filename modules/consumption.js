(function registerHabitFlowConsumptionModule(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('consumption')) return;

  modules.register('consumption', {
    description: 'Consumption domain boundary for smoking, alcohol, pauses, craving coach and deep analytics.',
    modes: Object.freeze(['smoke', 'alcohol']),
    dataTables: Object.freeze(['cigarette_events', 'alcohol_logs', 'alcohol_events', 'pause_periods']),
    migrationMode: 'preserve quick capture and analytics while moving pure calculations first'
  });
})(window);
