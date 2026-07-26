(() => {
  'use strict';

  if (window.__habitFlowSmokingRingCopyPolishInstalled) return;
  window.__habitFlowSmokingRingCopyPolishInstalled = true;

  const STYLE_ID = 'habitflow-smoking-ring-copy-polish-style';
  const LABEL = 'Aktuelle Pause';
  const HINT = 'seit letzter Zigarette';
  let renderTimer = 0;
  let hintObserver = null;
  let observedHint = null;

  const $ = (selector, root = document) => root?.querySelector?.(selector);

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        #screen-smoking .smoke-ring strong {
          color: #111827 !important;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif !important;
          font-size: clamp(3.15rem, 5vw, 4.45rem) !important;
          font-weight: 950 !important;
          font-variant-numeric: tabular-nums !important;
          letter-spacing: -.075em !important;
          line-height: .86 !important;
          display: block !important;
          max-width: 4.8ch !important;
          margin-inline: auto !important;
          text-align: center !important;
          white-space: normal !important;
        }

        #screen-smoking .smoke-ring #smokePauseHint {
          color: #65758a !important;
          display: block !important;
          font-size: .95rem !important;
          font-weight: 760 !important;
          line-height: 1.25 !important;
          max-width: 24ch !important;
          white-space: normal !important;
        }

        body:not(.light) #screen-smoking .smoke-ring strong {
          color: #f4f9ff !important;
        }

        body:not(.light) #screen-smoking .smoke-ring #smokePauseHint {
          color: rgba(210,227,244,.68) !important;
        }

        @media (max-width: 760px) {
          #screen-smoking .smoke-ring strong {
            font-size: clamp(2.85rem, 12.8vw, 3.9rem) !important;
          }

          #screen-smoking .smoke-ring #smokePauseHint {
            font-size: .86rem !important;
          }
        }
      `;
    }
    if (document.head && style.parentNode !== document.head) document.head.appendChild(style);
    else if (document.head && document.head.lastElementChild !== style) document.head.appendChild(style);
  }

  function setText(node, text) {
    if (!node || node.textContent === text) return;
    node.textContent = text;
  }

  function lockHint(hint) {
    if (!hint || observedHint === hint) return;
    if (hintObserver) hintObserver.disconnect();
    observedHint = hint;
    hintObserver = new MutationObserver(() => {
      if (hint.textContent !== HINT) setText(hint, HINT);
    });
    hintObserver.observe(hint, { childList: true, characterData: true, subtree: true });
  }

  function fixRing() {
    ensureStyle();
    const ring = $('#screen-smoking .smoke-ring');
    if (!ring) return;
    setText($('small', ring), LABEL);
    const hint = $('#smokePauseHint', ring) || $('span', ring);
    if (hint) {
      setText(hint, HINT);
      lockHint(hint);
    }
  }

  function schedule(delay = 80) {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(fixRing, delay);
  }

  function boot() {
    fixRing();
    [120, 450, 1000, 2200, 5200].forEach(delay => window.setTimeout(fixRing, delay));
    window.setInterval(fixRing, 10000);
    const root = document.getElementById('screen-smoking') || document.body;
    if (root && 'MutationObserver' in window) {
      new MutationObserver(() => schedule(20)).observe(root, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
