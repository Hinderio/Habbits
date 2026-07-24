(function registerSmokingTopCardsPolish(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (modules?.has?.('smoking-top-cards-polish')) return;

  const STATE_KEY = 'habitflow-state-v1';
  const STYLE_ID = 'habitflow-smoking-top-cards-polish-style';
  const RADIUS = 98;
  const CIRCLE = 2 * Math.PI * RADIUS;
  let rendering = false;
  let timer = null;

  const $ = (selector, root = window.document) => root?.querySelector?.(selector);
  const paneSelector = '#screen-smoking .consumption-pane[data-consumption-pane="smoke"]';

  function readState() {
    try {
      const state = JSON.parse(window.localStorage?.getItem(STATE_KEY) || '{}');
      return state && typeof state === 'object' ? state : {};
    } catch {
      return {};
    }
  }

  function dateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function lastDays(count) {
    return Array.from({ length: count }, (_, index) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - index);
      return dateKey(date);
    });
  }

  function activeSmokePauses(state) {
    return Array.isArray(state.pausePeriods)
      ? state.pausePeriods.filter(item => !item?.is_archived && (item.scope || item.pause_scope) === 'smoke' && item.starts_at)
      : [];
  }

  function isInsidePause(value, pauses) {
    const at = new Date(value).getTime();
    if (!Number.isFinite(at)) return false;
    return pauses.some(item => {
      const start = new Date(item.starts_at).getTime();
      const end = item.ends_at ? new Date(item.ends_at).getTime() : Infinity;
      return Number.isFinite(start) && start <= at && at <= end;
    });
  }

  function smokeRows(state) {
    const pauses = activeSmokePauses(state);
    return (Array.isArray(state.cigarettes) ? state.cigarettes : [])
      .filter(item => item?.smoked_at && !isInsidePause(item.smoked_at, pauses))
      .sort((a, b) => new Date(a.smoked_at) - new Date(b.smoked_at));
  }

  function duration(minutes) {
    const value = Number(minutes);
    if (!Number.isFinite(value)) return '-';
    const rounded = Math.max(0, Math.round(value));
    const days = Math.floor(rounded / 1440);
    const hours = Math.floor((rounded % 1440) / 60);
    const rest = rounded % 60;
    if (days) return `${days}T ${hours}h`;
    if (hours) return `${hours}h ${rest}m`;
    return `${rest}m`;
  }

  function currency(value) {
    return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(Number(value || 0));
  }

  function when(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return `${date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })}, ${date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function median(values) {
    const sorted = values.filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function nextGoal(minutes) {
    if (minutes == null) return 10;
    if (minutes < 30) return Math.min(30, minutes + 10);
    if (minutes < 60) return 60;
    if (minutes < 120) return 120;
    if (minutes < 240) return 240;
    return minutes + 30;
  }

  function metrics() {
    const rows = smokeRows(readState());
    const intervals = rows.map(item => Number(item.interval_minutes)).filter(value => Number.isFinite(value) && value > 0);
    const latest = rows[rows.length - 1] || null;
    const pause = latest ? Math.max(0, Math.floor((Date.now() - new Date(latest.smoked_at).getTime()) / 60000)) : null;
    const medianPause = median(intervals);
    const todayKey = dateKey(new Date());
    const weekKeys = lastDays(7);
    const today = rows.filter(item => dateKey(item.smoked_at) === todayKey);
    const week = rows.filter(item => weekKeys.includes(dateKey(item.smoked_at)));
    const weekIntervals = week.map(item => Number(item.interval_minutes)).filter(value => Number.isFinite(value) && value > 0);
    return {
      rows,
      recent: [...rows].reverse().slice(0, 3),
      total: rows.length,
      today: today.length,
      week: week.length,
      totalCost: rows.length * 0.4,
      todayCost: today.length * 0.4,
      pause,
      medianPause,
      progress: medianPause && pause != null ? Math.min(1, Math.max(0, pause / medianPause)) : 0,
      averagePause: weekIntervals.length ? duration(weekIntervals.reduce((sum, value) => sum + value, 0) / weekIntervals.length) : '-',
      bestPause: intervals.length ? Math.max(...intervals) : null,
      nextGoal: nextGoal(pause)
    };
  }

  function injectStyle(document) {
    if (!document || document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
${paneSelector} > .smoking-layout{align-items:stretch!important;gap:24px!important}
#screen-smoking .smoke-control-card,${paneSelector} .consumption-history-panel{height:100%!important;padding:clamp(22px,2.2vw,30px)!important;border-radius:28px!important;border:1px solid rgba(17,36,58,.08)!important;background:rgba(255,255,255,.88)!important;background-image:none!important;box-shadow:0 18px 45px rgba(17,36,58,.07)!important;overflow:hidden!important}
#screen-smoking .smoke-control-card:before,#screen-smoking .smoke-control-card:after{display:none!important;content:none!important}
#screen-smoking .smoke-control-card{display:grid!important;grid-template-rows:auto minmax(250px,1fr) auto auto;align-content:stretch;gap:18px!important}
#screen-smoking .smoke-control-card .panel-head.compact,${paneSelector} .consumption-history-panel .panel-head{margin:0!important;min-height:46px;align-items:flex-start!important}
#screen-smoking .smoke-control-card .panel-head.compact h3,${paneSelector} .consumption-history-panel .panel-head h3{font-size:clamp(1.2rem,1.45vw,1.45rem)!important;line-height:1.12!important;letter-spacing:-.035em!important}
#screen-smoking .smoke-ring{position:relative!important;width:min(100%,310px)!important;min-height:0!important;aspect-ratio:1/1;align-self:center;justify-self:center;display:grid!important;place-items:center!important;align-content:center!important;gap:7px!important;padding:34px!important;border:0!important;border-radius:50%!important;background:transparent!important;background-image:none!important;box-shadow:none!important;text-align:center}
#screen-smoking .hf-smoke-progress-svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);pointer-events:none}
#screen-smoking .hf-smoke-progress-bg,#screen-smoking .hf-smoke-progress-value{fill:none;stroke-width:7}
#screen-smoking .hf-smoke-progress-bg{stroke:rgba(17,36,58,.07)}
#screen-smoking .hf-smoke-progress-value{stroke:#34c9c3;stroke-linecap:round;stroke-dasharray:${CIRCLE};stroke-dashoffset:${CIRCLE}}
#screen-smoking .smoke-ring small,#screen-smoking .smoke-ring strong,#screen-smoking .smoke-ring span{position:relative;z-index:1}
#screen-smoking .smoke-ring small{color:#63748a!important;font-size:.66rem!important;font-weight:900!important;letter-spacing:.16em!important;text-transform:uppercase!important}
#screen-smoking .smoke-ring strong{color:#111827!important;font-size:clamp(3.8rem,6vw,5.3rem)!important;font-weight:950!important;letter-spacing:-.08em!important;line-height:.9!important}
#screen-smoking .smoke-ring span{color:#65758a!important;font-size:.92rem!important;font-weight:760!important;line-height:1.35!important}
#screen-smoking .pause-status-row,#screen-smoking .smoke-control-card .consumption-command-insight,#screen-smoking .smoke-control-card .mobile-consumption-kpis{display:none!important}
#screen-smoking .hf-smoking-actions{display:grid;grid-template-columns:minmax(150px,.72fr) minmax(220px,1.28fr);gap:12px;align-items:stretch}
#screen-smoking .hf-pause-start-btn{min-height:56px!important;border-radius:18px!important;padding:0 18px!important;justify-content:center!important;background:rgba(255,255,255,.82)!important;background-image:none!important;border:1px solid rgba(17,36,58,.09)!important;box-shadow:none!important;color:#223047!important;font-weight:900!important}
#screen-smoking #recordSmokeBtn.smoke-button{min-height:56px!important;height:56px!important;margin:0!important;border:0!important;border-radius:18px!important;background:#fb8f3f!important;background-color:#fb8f3f!important;background-image:none!important;box-shadow:none!important;color:#fff!important;font-size:1.06rem!important;font-weight:950!important;letter-spacing:-.01em!important}
#screen-smoking #recordSmokeBtn.smoke-button span{width:30px!important;height:30px!important;background:rgba(255,255,255,.26)!important;color:#fff!important;font-size:1.15rem!important;font-weight:950!important}
#screen-smoking .craving-coach-card{display:grid!important;grid-template-columns:auto minmax(0,1fr) auto;align-items:center!important;gap:12px!important;padding:14px 16px!important;border-radius:20px!important;border:1px solid rgba(52,201,195,.16)!important;background:rgba(52,201,195,.08)!important;background-image:none!important;box-shadow:none!important}
#screen-smoking .craving-coach-head{display:contents!important;margin:0!important}
#screen-smoking .craving-coach-head>div{min-width:0}
#screen-smoking .craving-coach-head:before{content:"";width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:rgba(52,201,195,.14);color:#21a9a4;font-weight:950}
#screen-smoking .craving-coach-head h4{margin:0!important;font-size:.92rem!important;line-height:1.18!important;letter-spacing:-.015em!important}
#screen-smoking .craving-coach-card p:not(.eyebrow){grid-column:2;margin:-5px 0 0!important;color:#65758a!important;font-size:.8rem!important;line-height:1.35!important}
#screen-smoking .craving-coach-card .badge{display:none!important}
#screen-smoking .craving-actions{grid-column:3;grid-row:1/span 2;display:flex!important;gap:8px!important;margin:0!important}
#screen-smoking .craving-actions .mini-btn{min-height:36px!important;border-radius:999px!important;padding:0 13px!important;font-size:.78rem!important;font-weight:900!important;box-shadow:none!important}
${paneSelector} .consumption-history-panel{display:flex!important;flex-direction:column!important;gap:16px!important}
${paneSelector} .consumption-history-panel .panel-head .badge{min-height:32px;padding:0 13px;border-radius:999px;background:rgba(255,255,255,.78)!important;color:#23334a!important;border-color:rgba(17,36,58,.08)!important}
#screen-smoking .history-launch-area{flex:1;min-height:0}
#screen-smoking .hf-smoke-overview{min-height:100%;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:16px}
#screen-smoking .hf-overview-primary{display:grid;gap:0;border-block:1px solid rgba(17,36,58,.08)}
#screen-smoking .hf-overview-row{width:100%;border:0;border-bottom:1px solid rgba(17,36,58,.08);background:transparent;color:#111827;padding:14px 0;display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:13px;align-items:center;text-align:left}
#screen-smoking .hf-overview-row:last-child{border-bottom:0}
#screen-smoking .hf-overview-icon{width:42px;height:42px;border-radius:16px;display:grid;place-items:center;background:rgba(52,201,195,.11);color:#17aaa4;font-weight:950}
#screen-smoking .hf-overview-row.is-cost .hf-overview-icon{background:rgba(251,143,63,.12);color:#d97706}
#screen-smoking .hf-overview-copy{display:grid;gap:3px;min-width:0}
#screen-smoking .hf-overview-copy strong{font-size:.94rem;line-height:1.2;letter-spacing:-.01em}
#screen-smoking .hf-overview-copy span,#screen-smoking .hf-overview-action{color:#65758a;font-size:.78rem;line-height:1.35;font-weight:760}
#screen-smoking .hf-overview-action{font-size:1.2rem;color:#708198}
#screen-smoking .hf-overview-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border:1px solid rgba(17,36,58,.08);border-radius:20px;overflow:hidden}
#screen-smoking .hf-overview-metrics article{min-height:82px;padding:13px 14px;display:grid;align-content:space-between;gap:6px;background:transparent!important;border:0}
#screen-smoking .hf-overview-metrics article:nth-child(odd){border-right:1px solid rgba(17,36,58,.08)}
#screen-smoking .hf-overview-metrics article:nth-child(-n+2){border-bottom:1px solid rgba(17,36,58,.08)}
#screen-smoking .hf-overview-metrics small,#screen-smoking .hf-recent-head small{color:#718197;font-size:.66rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
#screen-smoking .hf-overview-metrics strong{color:#111827;font-size:1.28rem;line-height:1;letter-spacing:-.045em}
#screen-smoking .hf-overview-metrics span{color:#65758a;font-size:.76rem;font-weight:760;line-height:1.25}
#screen-smoking .hf-overview-recent{min-height:0;display:grid;align-content:start;gap:8px;padding-top:2px}
#screen-smoking .hf-recent-head,#screen-smoking .hf-recent-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
#screen-smoking .hf-recent-head strong{font-size:.84rem;letter-spacing:-.01em}
#screen-smoking .hf-recent-list{list-style:none;margin:0;padding:0;display:grid}
#screen-smoking .hf-recent-row{min-height:34px;border-top:1px solid rgba(17,36,58,.075);color:#65758a;font-size:.76rem;font-weight:760}
#screen-smoking .hf-recent-row strong{color:#111827;font-size:.76rem;font-weight:950;white-space:nowrap}
#screen-smoking .hf-recent-row strong.is-positive{color:#159c68}
#screen-smoking .hf-recent-row strong.is-danger{color:#dc4c4c}
#screen-smoking .hf-overview-footer{width:100%;min-height:44px;border:0;border-radius:16px;background:rgba(52,201,195,.08);color:#17aaa4;font-weight:950}
body:not(.light) #screen-smoking .smoke-control-card,body:not(.light) ${paneSelector} .consumption-history-panel{background:rgba(18,30,44,.9)!important;border-color:rgba(255,255,255,.08)!important;box-shadow:0 18px 45px rgba(0,0,0,.18)!important}
body:not(.light) #screen-smoking .smoke-ring strong,body:not(.light) #screen-smoking .hf-overview-row,body:not(.light) #screen-smoking .hf-overview-copy strong,body:not(.light) #screen-smoking .hf-overview-metrics strong,body:not(.light) #screen-smoking .hf-recent-head strong,body:not(.light) #screen-smoking .hf-recent-row strong{color:#f4f9ff!important}
body:not(.light) #screen-smoking .hf-smoke-progress-bg{stroke:rgba(255,255,255,.09)}
body:not(.light) #screen-smoking .hf-overview-copy span,body:not(.light) #screen-smoking .hf-overview-metrics span,body:not(.light) #screen-smoking .hf-recent-row,body:not(.light) #screen-smoking .smoke-ring span,body:not(.light) #screen-smoking .smoke-ring small{color:rgba(210,227,244,.68)!important}
body:not(.light) #screen-smoking .hf-overview-primary,body:not(.light) #screen-smoking .hf-overview-row,body:not(.light) #screen-smoking .hf-overview-metrics,body:not(.light) #screen-smoking .hf-overview-metrics article,body:not(.light) #screen-smoking .hf-recent-row{border-color:rgba(255,255,255,.08)!important}
@media(max-width:760px){${paneSelector} > .smoking-layout{grid-template-columns:1fr!important;gap:14px!important}${paneSelector} > .smoking-layout>.mobile-consumption-section{display:block!important}${paneSelector} > .smoking-layout>.mobile-consumption-section>summary{display:none!important}${paneSelector} > .smoking-layout>.mobile-consumption-section>.consumption-history-panel,${paneSelector} > .smoking-layout>.mobile-consumption-section:not([open])>.consumption-history-panel{display:flex!important}#screen-smoking .smoke-control-card,${paneSelector} .consumption-history-panel{height:auto!important;min-height:0!important;width:100%!important;padding:17px!important;border-radius:26px!important}#screen-smoking .smoke-control-card{grid-template-rows:auto auto auto;gap:15px!important}#screen-smoking .smoke-ring{width:min(100%,238px)!important;padding:25px!important}#screen-smoking .smoke-ring strong{font-size:clamp(3.35rem,16vw,4.45rem)!important}#screen-smoking .hf-smoke-progress-bg,#screen-smoking .hf-smoke-progress-value{stroke-width:8}#screen-smoking .hf-smoking-actions{grid-template-columns:minmax(0,.82fr) minmax(0,1.18fr);gap:10px}#screen-smoking .hf-pause-start-btn,#screen-smoking #recordSmokeBtn.smoke-button{min-height:52px!important;height:52px!important;border-radius:17px!important}#screen-smoking .craving-coach-card{grid-template-columns:auto minmax(0,1fr);padding:13px!important;border-radius:20px!important}#screen-smoking .craving-actions{grid-column:1/-1;grid-row:auto;display:grid!important;grid-template-columns:1fr 1fr}#screen-smoking .hf-overview-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:380px){#screen-smoking .hf-smoking-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function renderRing(document) {
    const ring = $('#screen-smoking .smoke-ring', document);
    if (!ring) return;
    let svg = $('.hf-smoke-progress-svg', ring);
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'hf-smoke-progress-svg');
      svg.setAttribute('viewBox', '0 0 220 220');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = `<circle class="hf-smoke-progress-bg" cx="110" cy="110" r="${RADIUS}"></circle><circle class="hf-smoke-progress-value" cx="110" cy="110" r="${RADIUS}"></circle>`;
      ring.prepend(svg);
    }
    const data = metrics();
    const progress = $('.hf-smoke-progress-value', svg);
    if (progress) {
      progress.style.strokeDasharray = String(CIRCLE);
      progress.style.strokeDashoffset = String(CIRCLE * (1 - data.progress));
    }
    ring.dataset.progressLabel = data.medianPause ? `${Math.round(data.progress * 100)}% der Median-Pause` : 'Noch keine Median-Pause';
  }

  function renderActions(document) {
    const card = $('#screen-smoking .smoke-control-card', document);
    if (!card) return;
    let actions = $('.hf-smoking-actions', card);
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'hf-smoking-actions';
      const ring = $('.smoke-ring', card);
      if (ring) ring.insertAdjacentElement('afterend', actions);
      else card.appendChild(actions);
    }
    const pause = $('.pause-status-row button[data-action="open-pause-modal"][data-scope="smoke"], .hf-pause-start-btn', card);
    const cigarette = $('#recordSmokeBtn', card);
    if (pause && pause.parentElement !== actions) actions.appendChild(pause);
    if (pause) {
      pause.classList.add('hf-pause-start-btn');
      pause.textContent = 'Pause starten';
    }
    if (cigarette && cigarette.parentElement !== actions) actions.appendChild(cigarette);
  }

  function renderOverview(document) {
    const root = $('#smokeHistory', document);
    const panel = $(`${paneSelector} .consumption-history-panel`, document);
    if (!root || !panel) return;
    const title = $('.panel-head h3', panel);
    const badge = $('#lastSmokePoints', panel);
    if (title) title.textContent = 'Heute im Überblick';
    if (badge) badge.textContent = 'Mehr';

    const data = metrics();
    const focus = data.pause == null
      ? 'Erste bewusste Pause setzen.'
      : data.pause >= data.nextGoal
        ? 'Pause halten und nicht verhandeln.'
        : `${duration(data.nextGoal)} als nächste saubere Marke.`;
    const recent = data.recent.length
      ? data.recent.map(item => {
          const points = Number(item.points || 0);
          const className = points < 0 ? 'is-danger' : points > 0 ? 'is-positive' : '';
          return `<li class="hf-recent-row"><span>${escapeHtml(when(item.smoked_at))}</span><strong class="${className}">${points > 0 ? '+' : ''}${points} Pkt.</strong></li>`;
        }).join('')
      : '<li class="hf-recent-row"><span>Noch keine Logs</span><strong>bereit</strong></li>';
    const markup = `<div class="hf-smoke-overview" aria-label="Heute im Überblick">
      <div class="hf-overview-primary">
        <button class="hf-overview-row is-logs" type="button" data-action="open-smoke-history"><span class="hf-overview-icon">↗</span><span class="hf-overview-copy"><strong>Logs bei Bedarf</strong><span>${data.total} Einträge · ${data.today} heute</span></span><span class="hf-overview-action">›</span></button>
        <button class="hf-overview-row is-cost" type="button" data-action="open-smoke-costs"><span class="hf-overview-icon">CHF</span><span class="hf-overview-copy"><strong>Kosten</strong><span>${escapeHtml(currency(data.totalCost))} gesamt · ${escapeHtml(currency(data.todayCost))} heute</span></span><span class="hf-overview-action">›</span></button>
        <div class="hf-overview-row is-focus"><span class="hf-overview-icon">∿</span><span class="hf-overview-copy"><strong>Nächste saubere Aktion</strong><span>${escapeHtml(focus)}</span></span></div>
      </div>
      <div class="hf-overview-metrics">
        <article><small>Heute</small><strong>${data.today}×</strong><span>erfasst</span></article>
        <article><small>7 Tage</small><strong>${data.week}×</strong><span>sichtbar</span></article>
        <article><small>Ø Pause</small><strong>${escapeHtml(data.averagePause)}</strong><span>letzte 7 Tage</span></article>
        <article><small>Beste Pause</small><strong>${data.bestPause == null ? '-' : escapeHtml(duration(data.bestPause))}</strong><span>bisher</span></article>
      </div>
      <div class="hf-overview-recent"><div class="hf-recent-head"><small>Letzte Einträge</small><strong>kurzer Check</strong></div><ul class="hf-recent-list">${recent}</ul></div>
      <button class="hf-overview-footer" type="button" data-action="open-smoke-history">Alle Einträge anzeigen</button>
    </div>`;
    if (root.dataset.hfSmokingOverviewMarkup === markup) return;
    root.innerHTML = markup;
    root.dataset.hfSmokingOverviewMarkup = markup;
  }

  function render() {
    if (rendering) return;
    const document = window.document;
    if (!document) return;
    rendering = true;
    try {
      injectStyle(document);
      renderRing(document);
      renderActions(document);
      renderOverview(document);
    } finally {
      rendering = false;
    }
  }

  function schedule(delay = 80) {
    window.clearTimeout(timer);
    timer = window.setTimeout(render, delay);
  }

  function init() {
    render();
    [150, 450, 1000, 2200].forEach(delay => window.setTimeout(render, delay));
    window.setInterval(render, 30000);
    window.addEventListener('storage', event => {
      if (!event.key || event.key === STATE_KEY) schedule(80);
    });
    window.document.addEventListener('click', event => {
      const action = event.target?.closest?.('[data-action]')?.dataset?.action || '';
      if (action.includes('smoke') || action.includes('pause') || action.includes('consumption')) schedule(500);
    }, true);
    const target = window.document.getElementById('screen-smoking');
    if (target && 'MutationObserver' in window) {
      new MutationObserver(() => {
        if (!rendering) schedule(120);
      }).observe(target, { childList: true, subtree: true });
    }
  }

  if (window.document?.readyState === 'loading') window.document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  modules?.register?.('smoking-top-cards-polish', {
    description: 'Polishes only the smoking quick-capture and today overview cards, preserving existing actions and storage.',
    exports: Object.freeze([])
  });
})(window);
