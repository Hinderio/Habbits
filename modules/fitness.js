(function registerHabitFlowFitnessModule(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('fitness')) return;

  function injectFitnessCoachFabLabelStyle(document) {
    if (!document || document.getElementById('habitflow-fitness-coach-fab-label-style')) return;

    const style = document.createElement('style');
    style.id = 'habitflow-fitness-coach-fab-label-style';
    style.textContent = `
      .fitness-coach-fab {
        width: auto !important;
        min-width: 126px !important;
        height: 54px !important;
        padding: 0 20px !important;
        border-radius: 999px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 10px !important;
        white-space: nowrap !important;
        overflow: visible !important;
      }
      .fitness-coach-fab strong {
        display: inline-flex !important;
        opacity: 1 !important;
        visibility: visible !important;
        max-width: none !important;
        font-size: .96rem !important;
        font-weight: 950 !important;
        letter-spacing: -.01em !important;
        line-height: 1 !important;
      }
      .fitness-coach-fab [data-icon="plus"] {
        width: 28px !important;
        height: 28px !important;
        flex: 0 0 28px !important;
        border-radius: 50% !important;
        display: grid !important;
        place-items: center !important;
      }
      @media (max-width: 760px) {
        .fitness-coach-fab {
          min-width: 118px !important;
          height: 52px !important;
          padding: 0 18px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  injectFitnessCoachFabLabelStyle(window.document);

  modules.register('fitness', {
    description: 'Fitness domain boundary for coach tabs, activities, route progress and nutrition content.',
    uiStateKeys: Object.freeze([
      'habitflow-fitness-filter-v1',
      'habitflow-fitness-detail-tab-v1',
      'habitflow-fitness-mobile-sections-v1',
      'habitflow-fitness-coach-state-v1'
    ]),
    migrationMode: 'extract catalog and config data before changing interactive coach behavior',
    uiPatch: Object.freeze({
      fitnessCoachFabLabel: true
    })
  });
})(window);
