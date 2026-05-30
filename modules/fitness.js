(function registerHabitFlowFitnessModule(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('fitness')) return;

  function normalizeFitnessCoachFab(document) {
    const button = document?.querySelector?.('.fitness-coach-fab');
    if (!button) return;

    button.classList.add('fitness-coach-fab--labeled');
    button.setAttribute('aria-label', 'Fitness Coach öffnen');

    const hasVisibleLabel = button.querySelector('.fitness-coach-fab-plus') && button.querySelector('strong');
    if (!hasVisibleLabel) {
      button.innerHTML = '<span class="fitness-coach-fab-plus" aria-hidden="true">+</span><strong>Coach</strong>';
    }
  }

  function injectFitnessCoachFabLabelStyle(document) {
    if (!document || document.getElementById('habitflow-fitness-coach-fab-label-style')) return;

    const style = document.createElement('style');
    style.id = 'habitflow-fitness-coach-fab-label-style';
    style.textContent = `
      .fitness-coach-fab.fitness-coach-fab--labeled {
        width: auto !important;
        min-width: 132px !important;
        max-width: none !important;
        height: 54px !important;
        min-height: 54px !important;
        padding: 0 20px 0 14px !important;
        border: 0 !important;
        border-radius: 999px !important;
        background: linear-gradient(135deg,var(--primary),#66e7ff) !important;
        color: #00131c !important;
        box-shadow: 0 18px 38px rgba(74,215,209,.2) !important;
        display: inline-flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 10px !important;
        white-space: nowrap !important;
        overflow: visible !important;
        text-indent: 0 !important;
        line-height: 1 !important;
      }
      .fitness-coach-fab.fitness-coach-fab--labeled .fitness-coach-fab-plus {
        width: 30px !important;
        height: 30px !important;
        min-width: 30px !important;
        flex: 0 0 30px !important;
        border-radius: 50% !important;
        display: grid !important;
        place-items: center !important;
        background: rgba(0,19,28,.08) !important;
        color: #00131c !important;
        font-size: 1.22rem !important;
        font-weight: 900 !important;
        line-height: 1 !important;
      }
      .fitness-coach-fab.fitness-coach-fab--labeled strong {
        position: static !important;
        display: inline-flex !important;
        align-items: center !important;
        width: auto !important;
        height: auto !important;
        max-width: none !important;
        min-width: 0 !important;
        clip: auto !important;
        clip-path: none !important;
        overflow: visible !important;
        opacity: 1 !important;
        visibility: visible !important;
        color: #00131c !important;
        text-indent: 0 !important;
        font-size: .96rem !important;
        font-weight: 950 !important;
        letter-spacing: -.01em !important;
        line-height: 1 !important;
        transform: none !important;
      }
      @media (max-width: 760px) {
        .fitness-coach-fab.fitness-coach-fab--labeled {
          width: auto !important;
          min-width: 128px !important;
          height: 52px !important;
          min-height: 52px !important;
          padding: 0 18px 0 13px !important;
          gap: 10px !important;
        }
        .fitness-coach-fab.fitness-coach-fab--labeled strong {
          display: inline-flex !important;
          opacity: 1 !important;
          visibility: visible !important;
          font-size: .94rem !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  injectFitnessCoachFabLabelStyle(window.document);
  normalizeFitnessCoachFab(window.document);

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
      fitnessCoachFabLabel: true,
      mobileAndDesktopCoachPill: true
    })
  });
})(window);
