(function registerSmokingTipModal(window, document) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (modules?.has?.('smoking-tip-modal')) return;

  const STATE_KEY = 'habitflow-state-v1';
  const STYLE_ID = 'habitflow-smoking-tip-modal-style';
  const MODAL_ID = 'hfCravingTipModal';
  const $ = (selector, root = document) => root?.querySelector?.(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

  function readState() {
    try {
      const state = JSON.parse(window.localStorage?.getItem(STATE_KEY) || '{}');
      return state && typeof state === 'object' ? state : {};
    } catch {
      return {};
    }
  }

  function smokeRows() {
    const state = readState();
    const pauses = Array.isArray(state.pausePeriods)
      ? state.pausePeriods.filter(item => !item?.is_archived && (item.scope || item.pause_scope) === 'smoke' && item.starts_at)
      : [];
    return (Array.isArray(state.cigarettes) ? state.cigarettes : [])
      .filter(item => item?.smoked_at && !pauses.some(period => {
        const at = new Date(item.smoked_at).getTime();
        const start = new Date(period.starts_at).getTime();
        const end = period.ends_at ? new Date(period.ends_at).getTime() : Infinity;
        return Number.isFinite(at) && Number.isFinite(start) && start <= at && at <= end;
      }))
      .sort((a, b) => new Date(a.smoked_at) - new Date(b.smoked_at));
  }

  function duration(minutes) {
    const value = Math.max(0, Math.round(Number(minutes)));
    if (!Number.isFinite(value)) return '-';
    const days = Math.floor(value / 1440);
    const hours = Math.floor((value % 1440) / 60);
    const rest = value % 60;
    if (days) return `${days}T ${hours}h`;
    if (hours) return `${hours}h ${rest}m`;
    return `${rest}m`;
  }

  function todayKey() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function metrics() {
    const rows = smokeRows();
    const latest = rows[rows.length - 1] || null;
    const pause = latest ? Math.max(0, Math.floor((Date.now() - new Date(latest.smoked_at).getTime()) / 60000)) : null;
    const today = rows.filter(item => {
      const date = new Date(item.smoked_at);
      if (Number.isNaN(date.getTime())) return false;
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === todayKey();
    }).length;
    const next = pause == null ? 10 : pause < 30 ? Math.min(30, pause + 10) : pause < 60 ? 60 : pause < 120 ? 120 : pause < 240 ? 240 : pause + 30;
    return { pause, today, next };
  }

  function tipCopy(data = metrics()) {
    if (data.pause == null) {
      return {
        tag: 'Start',
        title: 'Erste bewusste Pause setzen.',
        body: 'Du brauchst gerade keinen grossen Plan. Starte mit einem kleinen Abstand und entscheide danach neu.',
        action: '10 Minuten Abstand gewinnen',
        reason: 'Ohne letzte Zigarette gibt es noch keinen Rhythmus. Der Tipp beginnt deshalb bewusst klein.',
        step: 'Wasser holen, kurz stehen bleiben, dann erst neu prüfen.'
      };
    }
    if (data.pause < 30) {
      return {
        tag: 'Akut',
        title: 'Sehr kurzer Abstand. Jetzt zählt nur: 10 Minuten gewinnen.',
        body: 'Nicht diskutieren, nicht bewerten. Du verschiebst nur den Autopilot um einen kleinen, machbaren Schritt.',
        action: '10-Minuten-Vertrag',
        reason: 'Unter 30 Minuten ist der stärkste Hebel nicht Motivation, sondern Abstand.',
        step: 'Glas Wasser, drei tiefe Ausatmungen, Handy weglegen.'
      };
    }
    if (data.pause < 90) {
      return {
        tag: 'Stabilisieren',
        title: `${duration(data.next)} als nächste saubere Marke.`,
        body: 'Du bist schon im Aufbau. Halte die Linie noch ein Stück, ohne daraus eine grosse Entscheidung zu machen.',
        action: 'Marke halten',
        reason: 'Dein aktueller Abstand ist nah genug, um mit wenig Reibung eine bessere Pause daraus zu machen.',
        step: 'Kurz raus aus der Situation: Fenster, Küche, Wasser, zurück.'
      };
    }
    return {
      tag: 'Halten',
      title: 'Pause nicht aus Routine beenden.',
      body: 'Das ist ein gutes Fenster. Wenn du jetzt rauchst, dann bewusst und nicht aus Reflex.',
      action: 'Noch einmal bewusst wählen',
      reason: 'Längere Pausen kippen oft nicht durch Drang, sondern durch alte Abschluss-Rituale.',
      step: 'Belohnung nehmen, aber ohne Zigarette: Musik, Tee oder kurze Nachricht.'
    };
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .hf-tip-modal .coach-modal-card{width:min(760px,100%)!important;gap:16px!important}
      .hf-tip-shell{display:grid;gap:14px}
      .hf-tip-hero{display:grid;grid-template-columns:58px minmax(0,1fr);gap:14px;align-items:center;padding:18px;border-radius:26px;background:rgba(52,201,195,.09);border:1px solid rgba(52,201,195,.18)}
      .hf-tip-icon{width:58px;height:58px;border-radius:21px;display:grid;place-items:center;background:rgba(52,201,195,.18);color:#18aaa4;font-size:1.3rem;font-weight:950}
      .hf-tip-hero h2{font-size:clamp(1.65rem,4vw,2.55rem);line-height:1.02;letter-spacing:-.055em;margin:4px 0 0}
      .hf-tip-hero p:not(.eyebrow){color:var(--muted);line-height:1.45;margin-top:7px}
      .hf-tip-main{padding:18px;border-radius:26px;background:rgba(255,255,255,.055);border:1px solid rgba(147,196,205,.18);display:grid;gap:10px}
      .hf-tip-main small,.hf-tip-card small{color:var(--muted);font-size:.68rem;font-weight:950;letter-spacing:.11em;text-transform:uppercase}
      .hf-tip-main strong{font-size:1.3rem;line-height:1.18;letter-spacing:-.025em}
      .hf-tip-main p,.hf-tip-card p{color:var(--muted);line-height:1.45}
      .hf-tip-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .hf-tip-card{padding:15px;border-radius:22px;background:rgba(255,255,255,.045);border:1px solid rgba(147,196,205,.16);display:grid;gap:7px}
      .hf-tip-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end}
      .hf-tip-actions .pill{justify-content:center}
      body.light .hf-tip-main,body.light .hf-tip-card{background:rgba(255,255,255,.72);border-color:rgba(17,36,58,.1)}
      @media(max-width:760px){.hf-tip-modal{align-items:flex-end!important}.hf-tip-modal .coach-modal-card{border-radius:28px 28px 18px 18px!important}.hf-tip-hero{grid-template-columns:48px minmax(0,1fr);padding:15px}.hf-tip-icon{width:48px;height:48px;border-radius:18px}.hf-tip-grid{grid-template-columns:1fr}.hf-tip-actions{display:grid;grid-template-columns:1fr}.hf-tip-actions .pill{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'coach-modal hf-tip-modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'hfCravingTipTitle');
    modal.innerHTML = '<section class="coach-modal-card"><button class="icon-btn coach-close-btn" type="button" data-hf-tip-close aria-label="Tipp schliessen">×</button><div class="hf-tip-shell"></div></section>';
    document.body.appendChild(modal);
    return modal;
  }

  function renderModal() {
    const data = metrics();
    const tip = tipCopy(data);
    const modal = ensureModal();
    const body = $('.hf-tip-shell', modal);
    if (!body) return modal;
    body.innerHTML = `
      <section class="hf-tip-hero">
        <span class="hf-tip-icon">☆</span>
        <div>
          <p class="eyebrow">Craving-Tipp · ${esc(tip.tag)}</p>
          <h2 id="hfCravingTipTitle">${esc(tip.title)}</h2>
          <p>${esc(tip.body)}</p>
        </div>
      </section>
      <section class="hf-tip-main">
        <small>Jetzt konkret</small>
        <strong>${esc(tip.action)}</strong>
        <p>${esc(tip.step)}</p>
      </section>
      <div class="hf-tip-grid">
        <article class="hf-tip-card"><small>Warum dieser Tipp</small><p>${esc(tip.reason)}</p></article>
        <article class="hf-tip-card"><small>Aktuelle Lage</small><p>${data.pause == null ? 'Noch keine letzte Zigarette erfasst.' : `${esc(duration(data.pause))} seit letzter Zigarette · ${data.today} heute erfasst.`}</p></article>
      </div>
      <div class="hf-tip-actions">
        <button class="pill secondary" type="button" data-hf-tip-close>Schliessen</button>
        <button class="pill secondary" type="button" data-hf-tip-action="coach">Coach öffnen</button>
        <button class="pill primary" type="button" data-hf-tip-action="pause">Pause starten</button>
      </div>
    `;
    return modal;
  }

  function openModal() {
    injectStyle();
    $('#screen-smoking .craving-coach-card')?.classList.remove('hf-show-coach-details');
    const modal = renderModal();
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    window.requestAnimationFrame(() => $('[data-hf-tip-action="pause"], [data-hf-tip-close]', modal)?.focus({ preventScroll: true }));
  }

  function closeModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.classList.add('hidden');
    if (!$('#coachModal:not(.hidden), #historyModal:not(.hidden), #pauseModal:not(.hidden), #fitnessCoachModal:not(.hidden)')) {
      document.body.classList.remove('modal-open');
    }
  }

  function bind() {
    injectStyle();
    document.addEventListener('click', event => {
      const modal = document.getElementById(MODAL_ID);
      if (modal && !modal.classList.contains('hidden')) {
        const close = event.target?.closest?.('[data-hf-tip-close]');
        const modalAction = event.target?.closest?.('[data-hf-tip-action]');
        if (close || event.target === modal) {
          event.preventDefault();
          event.stopImmediatePropagation();
          closeModal();
          return;
        }
        if (modalAction) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const action = modalAction.dataset.hfTipAction;
          closeModal();
          if (action === 'coach') $('[data-action="open-coach"]', $('#screen-smoking'))?.click();
          if (action === 'pause') $('[data-action="open-pause-modal"][data-scope="smoke"]', $('#screen-smoking'))?.click();
          return;
        }
      }

      if (event.target?.closest?.('[data-action="rotate-craving-tip"]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openModal();
      }
    }, true);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && $('#hfCravingTipModal:not(.hidden)')) {
        event.preventDefault();
        closeModal();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();

  modules?.register?.('smoking-tip-modal', {
    description: 'Shows Craving Coach tips in a dedicated modal before inline tip handlers run.',
    exports: Object.freeze([])
  });
})(window, document);
