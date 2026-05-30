(function registerHabitFlowDashboardModule(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('dashboard')) return;

  modules.register('dashboard', {
    description: 'Dashboard boundary for future extraction of KPI, chart, heatmap, insight and weekly review rendering.',
    anchors: Object.freeze([
      'dashboardTitle',
      'dashboardSubtitle',
      'currentPause',
      'todayCigarettes',
      'avgPause7',
      'openTasksCount',
      'dailyScore',
      'trendChart',
      'pointsChart',
      'habitHeatmap',
      'insightsGrid',
      'weeklyReview'
    ]),
    migrationMode: 'keep existing app.js rendering active; extract pure calculations first'
  });
})(window);
