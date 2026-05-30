(function registerHabitFlowDashboardModule(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('dashboard')) return;

  function injectDashboardRiskWindowStyle(document) {
    if (!document || document.getElementById('habitflow-dashboard-risk-window-style')) return;
    const style = document.createElement('style');
    style.id = 'habitflow-dashboard-risk-window-style';
    style.textContent = `
      #screen-dashboard #triggerHeatmap {
        display: none !important;
      }
      #screen-dashboard .intelligence-support-grid > section:has(#triggerHeatmap) {
        display: none !important;
      }
      #screen-dashboard .intelligence-support-grid {
        grid-template-columns: minmax(0, 1fr) !important;
      }
    `;
    document.head.appendChild(style);
  }

  injectDashboardRiskWindowStyle(window.document);

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
    migrationMode: 'keep existing app.js rendering active; extract pure calculations first',
    uiPatch: Object.freeze({
      hideDashboardRiskWindow: true
    })
  });
})(window);
