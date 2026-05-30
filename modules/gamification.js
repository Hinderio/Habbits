(function registerHabitFlowGamificationModule(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('gamification')) return;

  modules.register('gamification', {
    description: 'Gamification domain boundary for points ledger, companion evolution, badges and level math.',
    dataTables: Object.freeze(['points_ledger']),
    levelRules: Object.freeze({ maxStage: 20, baseCost: 250, growth: 1.18 }),
    migrationMode: 'keep existing score rendering; extract deterministic level helpers next'
  });
})(window);
