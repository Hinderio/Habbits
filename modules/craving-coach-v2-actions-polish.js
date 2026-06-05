(function initHabitFlowCravingCoachV2ActionsPolish(window, document) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (modules?.has?.('craving-coach-v2-actions-polish')) return;

  const TIMER_ACTIONS = new Set(['reset90', 'breathe3', 'timer7', 'timer10', 'cancel_timer']);
  let lastAction = null;
  let dismissedUntil = 0;
  let renderTimer = null;

  const ACTION_GUIDES = Object.freeze({
    water: { title: 'Wasser zuerst.', body: 'Ein Glas Wasser, dann 7 ruhige Atemzuge. Erst danach neu entscheiden. Du verschiebst nicht das Leben, nur den Autopilot.' },
    move_water: { title: 'Wasser + Ortswechsel.', body: 'Nimm Wasser in die Hand und wechsle den Ort: andere Seite vom Raum, kurz vor die Tur oder ans Fenster. Kontextwechsel ist der Hebel.' },
    reward_alt: { title: 'Ersatzbelohnung wahlen.', body: 'Wahle eine kleine Belohnung ohne Zigarette: Musik, Tee, kurze Nachricht oder 3 Minuten gehen. Danach darfst du neu entscheiden.' },
    decide_later: { title: 'Spater entscheiden.', body: 'Kein Ja oder Nein fur den ganzen Tag. Nur jetzt: Entscheidung vertagen, 10 Minuten Abstand, dann bewusst prufen.' },
    mini_walk: { title: 'Mini-Walk.', body: 'Steh auf, geh 90 Sekunden langsam. Kein Podcast, kein Scrollen. Nur Beine bewegen und den Drang auslaufen lassen.' },
    name_stress: { title: 'Stress benennen.', body: 'Schreib oder sag einen Satz: Was stresst mich wirklich? Danach eine konkrete Grenze: kleiner, spater oder delegieren.' },
    keep_open: { title: 'Coach bleibt offen.', body: 'Bleib in diesem Fenster. Lies den Satz noch einmal: Du musst gerade nicht endgultig entscheiden. Gewinne nur den nachsten Schritt.' },
    change_place: { title: 'Ort wechseln.', body: 'Verlasse die Rauch-Szene kurz. Hol Wasser, geh ans Fenster oder stell dich zu jemandem ohne Zigarette. Nicht kampfen, Szene andern.' },
    support_msg: { title: 'Support-Nachricht.', body: 'Kurzer Text: "Ich will gerade rauchen. Ich gewinne 10 Minuten. Schreib mir kurz was Normales." Kein Drama, nur Unterbrechung.' },
    gum_water: { title: 'Kaugummi / Wasser.', body: 'Neuer Abschluss nach dem Essen: Wasser, Kaugummi oder Zahne putzen. Der alte Abschluss darf warten.' },
    mark_alcohol: { title: 'Alkohol-Kontext gemerkt.', body: 'Heute zahlt Abstand. Nach jedem Drink erst Wasser oder Ortswechsel. Keine Zigarette direkt anschliessen.' },
    choose_trigger: { title: 'Trigger wahlen.', body: 'Wahle den wahrscheinlichsten Trigger-Chip. Je genauer der Kontext, desto weniger zufallig wird der nachste Coach-Schritt.' },
    open_habits: { title: 'Habit als Pattern Break.', body: 'Ein kleiner Habit-Haken reicht. Ziel ist nicht Produktivitat, sondern den Rauch-Autopilot zu unterbrechen.' },
    open_tasks: { title: 'Task-Druck klein machen.', body: 'Nimm genau den nachsten Schritt, nicht die ganze Aufgabe. Druck wird kleiner, wenn er konkret wird.' },
    morning_routine: { title: 'Morgenroutine als Anker.', body: 'Wasser zuerst, dann ein kurzer Startschritt. Die erste Zigarette setzt den Rhythmus, also verschieben wir nur den Start.' },
    log_smoke: { title: 'Bewusst loggen.', body: 'Wenn du rauchst, dann bewusst und geloggt. Keine Scham, keine Verdrangung. Daraus lernt dein System.' }
  });

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function removeResponses() {
    document.querySelectorAll('[data-hf-coach-v2-action-response]').forEach(node => node.remove());
  }

  function clearResponse(suppressMs = 1200) {
    lastAction = null;
    dismissedUntil = Date.now() + suppressMs;
    clearTimeout(renderTimer);
    removeResponses();
  }

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
        letter-spacing:-.01em!important;
      }
      .hf-coach-v2-actions .mini-btn.danger {
        background:#9EDCCE!important;
        color:#07111a!important;
        border:1px solid rgba(7,17,26,.08)!important;
        font-family:inherit!important;
        font-size:.92rem!important;
        font-weight:760!important;
      }
      .hf-coach-v2-action-response {
        position:relative;
        display:grid;
        gap:7px;
        padding:12px 13px;
        border-radius:18px;
        background:rgba(158,220,206,.18);
        border:1px solid rgba(158,220,206,.34);
        color:var(--muted);
        line-height:1.42;
      }
      .hf-coach-v2-action-response strong {
        color:var(--text);
        font-size:.98rem;
        letter-spacing:-.01em;
        padding-right:42px;
      }
      .hf-coach-v2-action-response p {
        margin:0!important;
        color:var(--muted)!important;
        font-size:.9rem!important;
      }
      .hf-coach-v2-action-response .hf-coach-v2-feedback {
        margin-top:6px;
      }
      .hf-coach-v2-action-close {
        position:absolute;
        top:10px;
        right:10px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        width:32px;
        height:32px;
        border-radius:999px;
        border:1px solid rgba(7,17,26,.12);
        background:rgba(255,255,255,.82);
        color:#07111a;
        font:inherit;
        font-size:1.12rem;
        font-weight:800;
        line-height:1;
        cursor:pointer;
        box-shadow:0 8px 18px rgba(7,17,26,.08);
      }
      .hf-coach-v2-action-close:hover,
      .hf-coach-v2-action-close:focus-visible {
        background:rgba(255,255,255,.96);
        outline:2px solid rgba(7,17,26,.18);
        outline-offset:2px;
      }
      body.light .hf-coach-v2-action-response {
        background:rgba(158,220,206,.28);
        border-color:rgba(91,154,141,.2);
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

  function feedbackHtml(actionKey) {
    return `<div class="hf-coach-v2-feedback" aria-label="Coach Feedback">
      <button class="mini-btn" type="button" data-coach-feedback="not_smoked" data-action-key="${escapeHtml(actionKey)}">Nicht geraucht</button>
      <button class="mini-btn" type="button" data-coach-feedback="delayed" data-action-key="${escapeHtml(actionKey)}">Verzogert</button>
      <button class="mini-btn" type="button" data-coach-feedback="smoked" data-action-key="${escapeHtml(actionKey)}">Trotzdem geraucht</button>
      <button class="mini-btn" type="button" data-coach-feedback="not_helpful" data-action-key="${escapeHtml(actionKey)}">Hat nicht geholfen</button>
    </div>`;
  }

  function responseHtml(actionKey) {
    const guide = ACTION_GUIDES[actionKey];
    if (!guide) return '';
    return `<div class="hf-coach-v2-action-response" data-hf-coach-v2-action-response="${escapeHtml(actionKey)}">
      <button class="hf-coach-v2-action-close" type="button" data-coach-dismiss="response" aria-label="Hinweis schliessen">&times;</button>
      <strong>${escapeHtml(guide.title)}</strong>
      <p>${escapeHtml(guide.body)}</p>
      ${feedbackHtml(actionKey)}
    </div>`;
  }

  function renderResponse() {
    injectStyle();
    removeResponses();
    if (Date.now() < dismissedUntil) return;
    if (!lastAction || TIMER_ACTIONS.has(lastAction) || !ACTION_GUIDES[lastAction]) return;
    document.querySelectorAll('.hf-coach-v2-extra').forEach(extra => {
      const actions = extra.querySelector('.hf-coach-v2-actions');
      if (!actions) return;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = responseHtml(lastAction).trim();
      actions.insertAdjacentElement('afterend', wrapper.firstElementChild);
    });
  }

  function scheduleRender(delay = 60) {
    clearTimeout(renderTimer);
    renderTimer = window.setTimeout(renderResponse, delay);
  }

  function handleClick(event) {
    const dismissButton = event.target?.closest?.('[data-coach-dismiss]');
    if (dismissButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      clearResponse(2500);
      return;
    }

    const feedbackButton = event.target?.closest?.('[data-coach-feedback]');
    if (feedbackButton) {
      clearResponse(2500);
      window.setTimeout(() => clearResponse(2500), 80);
      window.setTimeout(() => clearResponse(2500), 260);
      return;
    }

    const button = event.target?.closest?.('[data-coach-action]');
    if (!button) return;
    const actionKey = button.dataset.coachAction;
    if (!actionKey || TIMER_ACTIONS.has(actionKey)) {
      if (actionKey === 'cancel_timer') clearResponse(1200);
      else removeResponses();
      return;
    }
    dismissedUntil = 0;
    lastAction = actionKey;
    scheduleRender(80);
    scheduleRender(240);
  }

  function start() {
    injectStyle();
    document.addEventListener('click', handleClick, true);
    const observer = new MutationObserver(() => {
      if (lastAction && Date.now() >= dismissedUntil) scheduleRender(80);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleRender(300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  modules?.register?.('craving-coach-v2-actions-polish', {
    description: 'Visual polish and visible action responses for Craving Coach 2.0 action buttons.',
    remoteTables: Object.freeze([])
  });
})(window, document);
