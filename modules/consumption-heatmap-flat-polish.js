(function initHabitFlowConsumptionHeatmapFlatPolish(window, document) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (modules && modules.has('consumption-heatmap-flat-polish')) return;

  function injectStyle() {
    if (!document || document.getElementById('habitflow-consumption-heatmap-flat-polish')) return;
    const style = document.createElement('style');
    style.id = 'habitflow-consumption-heatmap-flat-polish';
    style.textContent = `
      body #screen-smoking .smoke-week-grid-wrap {
        scrollbar-width: thin !important;
        -ms-overflow-style: auto !important;
      }

      body #screen-smoking .smoke-week-grid-wrap::-webkit-scrollbar {
        display: block !important;
        height: 8px !important;
        width: 8px !important;
      }

      body #screen-smoking .smoke-week-grid-wrap::-webkit-scrollbar-thumb {
        border-radius: 999px !important;
        background: rgba(74,215,209,.45) !important;
      }

      body #screen-smoking .smoke-week-grid-wrap .smoke-week-cell[class*="level-"] {
        box-shadow: none !important;
        background-image: none !important;
      }

      body #screen-smoking .smoke-week-grid-wrap .smoke-week-cell[class*="level-"]::before,
      body #screen-smoking .smoke-week-grid-wrap .smoke-week-cell[class*="level-"]::after {
        display: none !important;
      }

      body #screen-smoking .smoke-week-grid-wrap .smoke-week-cell.level-1 {
        background: #d2f6dc !important;
        border-color: #d2f6dc !important;
      }

      body #screen-smoking .smoke-week-grid-wrap .smoke-week-cell.level-2 {
        background: #bdeeed !important;
        border-color: #bdeeed !important;
      }

      body #screen-smoking .smoke-week-grid-wrap .smoke-week-cell.level-3 {
        background: #cbd8e2 !important;
        border-color: #cbd8e2 !important;
      }

      body #screen-smoking .smoke-week-grid-wrap .smoke-week-cell.level-4 {
        background: #ffdda8 !important;
        border-color: #ffdda8 !important;
      }

      body #screen-smoking .smoke-week-grid-wrap .smoke-week-cell.level-5 {
        background: #ffb8b8 !important;
        border-color: #ffb8b8 !important;
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyle, { once: true });
  else injectStyle();

  if (modules) {
    modules.register('consumption-heatmap-flat-polish', {
      description: 'Keeps the consumption week heatmap scrollable while rendering colored cells flat and matte.',
      active: true
    });
  }
})(window, document);
