(function installDashboardVisualTokens(window, document) {
  'use strict';

  if (!document || document.getElementById('dashboardVisualTokensStyle')) return;

  const style = document.createElement('style');
  style.id = 'dashboardVisualTokensStyle';
  style.textContent = `
    :root{
      --hf-risk-orange-solid:#E89160;
      --hf-capture-green:#64D0CB;
    }

    #screen-dashboard #urgeForecastBadge,
    #screen-dashboard .risk-badge,
    #screen-dashboard .risk-pill,
    #screen-dashboard [data-risk-badge],
    #screen-dashboard .badge.is-risk,
    #screen-dashboard .badge.risk,
    #screen-dashboard .next-action-card .badge.danger-badge,
    #screen-dashboard .intelligence-card .badge.danger-badge{
      background:#E89160 !important;
      background-image:none !important;
      border-color:#E89160 !important;
      color:#6F3E0C !important;
      opacity:1 !important;
      box-shadow:none !important;
    }

    #habitHeatmap [style*="background"],
    #habitHeatmap [style*="background-image"],
    #habitHeatmap .heatmap-cell,
    #habitHeatmap .habit-heatmap-cell,
    #habitHeatmap .rhythm-cell,
    #habitHeatmap .is-done,
    #habitHeatmap .is-active{
      background-image:none !important;
    }

    #habitHeatmap [style*="rgba(74,215,209"],
    #habitHeatmap [style*="rgb(74, 215, 209"],
    #habitHeatmap [style*="var(--primary"],
    #habitHeatmap .heatmap-cell.is-full,
    #habitHeatmap .heatmap-cell.is-done,
    #habitHeatmap .habit-heatmap-cell.is-full,
    #habitHeatmap .habit-heatmap-cell.is-done,
    #habitHeatmap .rhythm-cell.is-full,
    #habitHeatmap .rhythm-cell.is-done{
      background:#64D0CB !important;
      background-image:none !important;
      border-color:rgba(100,208,203,.42) !important;
    }

    #habitHeatmap .heatmap-cell[data-intensity="1"],
    #habitHeatmap .habit-heatmap-cell[data-intensity="1"],
    #habitHeatmap .rhythm-cell[data-intensity="1"]{background:rgba(100,208,203,.22) !important;}
    #habitHeatmap .heatmap-cell[data-intensity="2"],
    #habitHeatmap .habit-heatmap-cell[data-intensity="2"],
    #habitHeatmap .rhythm-cell[data-intensity="2"]{background:rgba(100,208,203,.42) !important;}
    #habitHeatmap .heatmap-cell[data-intensity="3"],
    #habitHeatmap .habit-heatmap-cell[data-intensity="3"],
    #habitHeatmap .rhythm-cell[data-intensity="3"]{background:rgba(100,208,203,.68) !important;}
    #habitHeatmap .heatmap-cell[data-intensity="4"],
    #habitHeatmap .habit-heatmap-cell[data-intensity="4"],
    #habitHeatmap .rhythm-cell[data-intensity="4"]{background:#64D0CB !important;}
  `;

  document.head.appendChild(style);

  const modules = window.HabitFlowModules;
  if (modules && !modules.has('dashboard-visual-tokens')) {
    modules.register('dashboard-visual-tokens', {
      description: 'Applies solid dashboard risk orange and flat capture-green habit heatmap colors.',
      active: true,
      tokens: Object.freeze({ riskOrange: '#E89160', captureGreen: '#64D0CB' })
    });
  }
})(window, document);
