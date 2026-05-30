(function applyQuickCaptureButtonStyle(window) {
  'use strict';

  function inject() {
    const document = window.document;
    if (!document || document.getElementById('habitflow-quick-capture-button-style')) return;
    const style = document.createElement('style');
    style.id = 'habitflow-quick-capture-button-style';
    style.textContent = `
      #screen-smoking .craving-actions .mini-btn {
        min-height: 46px !important;
        color: #182033 !important;
        background: #66d8d6 !important;
        border: 1px solid rgba(17,36,58,.04) !important;
        box-shadow: 0 10px 24px rgba(102,216,214,.16) !important;
      }

      #screen-smoking #recordSmokeBtn.smoke-button {
        min-height: 60px !important;
        gap: 12px !important;
        border-radius: 24px !important;
        background: #fb9953 !important;
        box-shadow: 0 14px 32px rgba(251,153,83,.20), inset 0 1px 0 rgba(255,255,255,.24) !important;
        font-size: 1.12rem !important;
      }

      #screen-smoking #recordSmokeBtn.smoke-button span {
        width: 34px !important;
        height: 34px !important;
        background: rgba(255,255,255,.28) !important;
        font-size: 1.26rem !important;
      }

      @media (max-width: 760px) {
        #screen-smoking #recordSmokeBtn.smoke-button {
          min-height: 54px !important;
          border-radius: 20px !important;
          font-size: 1.04rem !important;
        }

        #screen-smoking #recordSmokeBtn.smoke-button span {
          width: 30px !important;
          height: 30px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  if (window.document?.readyState === 'loading') {
    window.document.addEventListener('DOMContentLoaded', inject, { once: true });
  } else {
    inject();
  }
  window.setTimeout(inject, 0);
  window.setTimeout(inject, 400);
})(window);
