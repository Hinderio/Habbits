(function initHabitFlowCravingCoachV2ActionsPolish(window, document) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (modules?.has?.('craving-coach-v2-actions-polish')) return;

  function injectStyle() {
    if (document.getElementById('habitflow-craving-coach-v2-actions-polish-style')) return;
    const style = document.createElement('style');
    style.id = 'habitflow-craving-coach-v2-actions-polish-style';
    style.textContent = `
      .hf-coach-v2-actions .mini-btn.primary,
      .hf-coach-v2-actions .mini-btn:not(.danger) {
        background:#9EDCCE!important;
        color:#07111a!important;
        border:1px solid rgba(7,17,26,.08)!important;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.32),0 12px 26px rgba(74,143,132,.12)!important;
        font-family:inherit!important;
        font-size:.92rem!important;
        font-weight:760!important;
        letter-spacing:0!important;
      }
      .hf-coach-v2-actions .mini-btn.danger {
        background:#9EDCCE!important;
        color:#07111a!important;
        border:1px solid rgba(7,17,26,.08)!important;
        font-family:inherit!important;
        font-size:.92rem!important;
        font-weight:760!important;
        letter-spacing:0!important;
      }
      @media (max-width:760px) {
        .hf-coach-v2-actions .mini-btn.primary,
        .hf-coach-v2-actions .mini-btn:not(.danger),
        .hf-coach-v2-actions .mini-btn.danger {
          min-height:44px!important;
          font-size:.9rem!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyle, { once: true });
  else injectStyle();

  modules?.register?.('craving-coach-v2-actions-polish', {
    description: 'Visual polish only for Craving Coach 2.0 action buttons. Interaction is owned by craving-coach-v2.',
    remoteTables: Object.freeze([])
  });
})(window, document);
