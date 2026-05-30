(function registerHabitFlowDashboardModule(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('dashboard')) return;

  function removeRiskWindowCards(root = document) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll('section, article, details').forEach(element => {
      const text = String(element.textContent || '').toLowerCase();
      if (text.includes('risikofenster') || text.includes('trigger heatmap')) {
        element.remove();
      }
    });
  }

  function startDashboardCleanup() {
    removeRiskWindowCards(document);
    const dashboard = document.getElementById('screen-dashboard') || document.body;
    if (!dashboard) return;
    const observer = new MutationObserver(() => removeRiskWindowCards(dashboard));
    observer.observe(dashboard, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startDashboardCleanup, { once: true });
  else startDashboardCleanup();

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
      removeDashboardRiskWindow: true
    })
  });
})(window);
