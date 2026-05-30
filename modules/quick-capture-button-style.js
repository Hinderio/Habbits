(function applyQuickCaptureButtonStyle(window) {
  'use strict';

  function inject() {
    const document = window.document;
    if (!document) return;
    let style = document.getElementById('habitflow-quick-capture-button-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'habitflow-quick-capture-button-style';
    }
    style.textContent = `
      #screen-smoking .craving-actions .mini-btn {
        min-height: 46px !important;
        color: #182033 !important;
        background: #66d8d6 !important;
        background-image: none !important;
        border: 1px solid rgba(17,36,58,.04) !important;
        box-shadow: 0 10px 24px rgba(102,216,214,.16) !important;
      }

      #screen-smoking button#recordSmokeBtn.smoke-button,
      #screen-smoking #recordSmokeBtn.smoke-button {
        min-height: 56px !important;
        height: 56px !important;
        gap: 12px !important;
        border-radius: 22px !important;
        background: #fb9953 !important;
        background-color: #fb9953 !important;
        background-image: none !important;
        box-shadow: 0 12px 28px rgba(251,153,83,.18), inset 0 1px 0 rgba(255,255,255,.22) !important;
        font-size: 1.08rem !important;
        padding-block: 0 !important;
      }

      #screen-smoking button#recordSmokeBtn.smoke-button span,
      #screen-smoking #recordSmokeBtn.smoke-button span {
        width: 32px !important;
        height: 32px !important;
        background: rgba(255,255,255,.26) !important;
        background-image: none !important;
        font-size: 1.2rem !important;
      }

      @media (max-width: 760px) {
        #screen-smoking button#recordSmokeBtn.smoke-button,
        #screen-smoking #recordSmokeBtn.smoke-button {
          min-height: 52px !important;
          height: 52px !important;
          border-radius: 19px !important;
          font-size: 1.02rem !important;
        }

        #screen-smoking button#recordSmokeBtn.smoke-button span,
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
  [0, 300, 900, 1800].forEach(delay => window.setTimeout(inject, delay));
})(window);
