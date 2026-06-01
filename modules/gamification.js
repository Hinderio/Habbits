(function registerHabitFlowGamificationModule(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('gamification')) return;

  function loadPointsLedgerViewer(document) {
    if (!document || document.getElementById('habitflow-points-ledger-viewer-script')) return;
    const script = document.createElement('script');
    script.id = 'habitflow-points-ledger-viewer-script';
    script.src = 'modules/points-ledger-viewer.js';
    script.defer = true;
    document.head.appendChild(script);
  }

  loadPointsLedgerViewer(window.document);

  modules.register('gamification', {
    description: 'Gamification domain boundary for points ledger, companion evolution, badges and level math.',
    dataTables: Object.freeze(['points_ledger']),
    levelRules: Object.freeze({ maxStage: 20, baseCost: 250, growth: 1.18 }),
    migrationMode: 'keep existing score rendering; extract deterministic level helpers next',
    uiPatch: Object.freeze({
      loadsPointsLedgerViewer: true
    })
  });
})(window);
