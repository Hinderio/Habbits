(function registerHabitFlowConsumptionModule(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('consumption')) return;

  function loadConsumptionTimeProfile(document) {
    if (!document || document.getElementById('habitflow-consumption-time-profile-script')) return;
    const script = document.createElement('script');
    script.id = 'habitflow-consumption-time-profile-script';
    script.src = 'modules/consumption-time-profile.js';
    script.defer = true;
    document.head.appendChild(script);
  }

  loadConsumptionTimeProfile(window.document);

  modules.register('consumption', {
    description: 'Consumption domain boundary for smoking, alcohol, pauses, craving coach and deep analytics.',
    modes: Object.freeze(['smoke', 'alcohol']),
    dataTables: Object.freeze(['cigarette_events', 'alcohol_logs', 'alcohol_events', 'pause_periods']),
    migrationMode: 'preserve quick capture and analytics while moving pure calculations first',
    uiPatch: Object.freeze({
      loadsConsumptionTimeProfile: true
    })
  });
})(window);
