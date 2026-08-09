(function registerSmokingTopCardsPolish(window, document) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (modules?.has?.('smoking-top-cards-polish')) return;

  const STATE_KEY = 'habitflow-state-v1';
  const STYLE_ID = 'habitflow-smoking-top-cards-polish-style';
  const R = 98;
  const C = 2 * Math.PI * R;
  const BONUS_R = 104;
  const BONUS_C = 2 * Math.PI * BONUS_R;
  const pane = '#screen-smoking .consumption-pane[data-consumption-pane="smoke"]';
  let busy = false;
  let timer = null;
  let liveSnapshot = null;

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

  function cloneLiveSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    return {
      cigarettes: Array.isArray(snapshot.cigarettes)
        ? snapshot.cigarettes.map(item => item && typeof item === 'object' ? { ...item } : item)
        : [],
      pausePeriods: Array.isArray(snapshot.pausePeriods)
        ? snapshot.pausePeriods.map(item => item && typeof item === 'object' ? { ...item } : item)
        : []
    };
  }

  function dateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

  function chf(value) {
    return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(Number(value || 0));
  }

  function when(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return `${date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })}, ${date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}`;
  }

  function smokeRows(state = readState()) {
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

  function smokePausePeriods(state) {
    return (Array.isArray(state?.pausePeriods) ? state.pausePeriods : [])
      .filter(item => item && !item.is_archived && (item.scope || item.pause_scope || 'smoke') === 'smoke' && item.starts_at)
      .map(item => ({
        start: new Date(item.starts_at).getTime(),
        end: item.ends_at ? new Date(item.ends_at).getTime() : Infinity
      }))
      .filter(item => Number.isFinite(item.start) && item.end >= item.start);
  }

  function recentDateKeys(days = 28) {
    const today = new Date();
    return new Set(Array.from({ length: days }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (days - 1 - index));
      return dateKey(date);
    }));
  }

  function activeDaytimePauses(rows, state, days = 28) {
    const pauses = smokePausePeriods(state);
    const keys = recentDateKeys(days);
    const values = [];
    const activeRows = rows.filter(item => item && !item.deleted_at && !item.archived_at && !item.is_archived);
    for (let index = 1; index < activeRows.length; index += 1) {
      const previous = activeRows[index - 1];
      const current = activeRows[index];
      const previousAt = new Date(previous?.smoked_at).getTime();
      const currentAt = new Date(current?.smoked_at).getTime();
      if (!Number.isFinite(previousAt) || !Number.isFinite(currentAt) || currentAt <= previousAt) continue;
      const currentKey = dateKey(currentAt);
      if (!keys.has(currentKey) || dateKey(previousAt) !== currentKey) continue;
      if (pauses.some(period => period.start < currentAt && period.end > previousAt)) continue;
      const rawMinutes = Math.round((currentAt - previousAt) / 60000);
      const deducted = Number(current?.scoring_sleep_deducted_minutes);
      const stored = Number(current?.scoring_interval_minutes);
      const minutes = Number.isFinite(deducted) && deducted > 0
        ? Math.max(0, rawMinutes - deducted)
        : Number.isFinite(stored) && stored >= 0 && stored <= rawMinutes
          ? stored
          : rawMinutes;
      if (minutes > 0) values.push(minutes);
    }
    return values;
  }

  function medianOf(values) {
    const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function metrics(state = readState()) {
    const rows = smokeRows(state);
    const intervals = rows.map(item => Number(item.interval_minutes)).filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
    const activeIntervals = activeDaytimePauses(rows, state, 28);
    const median = medianOf(activeIntervals);
    const latest = rows[rows.length - 1] || null;
    const pause = latest ? Math.max(0, Math.floor((Date.now() - new Date(latest.smoked_at).getTime()) / 60000)) : null;
    const bestDaytime = activeIntervals.length ? Math.max(...activeIntervals) : null;
    const bonusMinutes = median != null && pause != null ? Math.max(0, Math.floor(pause - median)) : 0;
    const bonusProgress = bonusMinutes > 0 && bestDaytime != null
      ? bestDaytime > median
        ? Math.min(1, bonusMinutes / (bestDaytime - median))
        : 1
      : 0;
    const todayKey = dateKey(new Date());
    const weekKeys = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - index);
      return dateKey(date);
    });
    const today = rows.filter(item => dateKey(item.smoked_at) === todayKey);
    const week = rows.filter(item => weekKeys.includes(dateKey(item.smoked_at)));
    const weekIntervals = week.map(item => Number(item.interval_minutes)).filter(value => Number.isFinite(value) && value > 0);
    const next = pause == null ? 10 : pause < 30 ? Math.min(30, pause + 10) : pause < 60 ? 60 : pause < 120 ? 120 : pause < 240 ? 240 : pause + 30;
    return {
      rows,
      recent: [...rows].reverse().slice(0, 3),
      total: rows.length,
      today: today.length,
      week: week.length,
      pause,
      median,
      bestDaytime,
      bonusMinutes,
      bonusProgress,
      next,
      progress: median && pause != null ? Math.min(1, Math.max(0, pause / median)) : 0,
      avg: weekIntervals.length ? duration(weekIntervals.reduce((sum, value) => sum + value, 0) / weekIntervals.length) : '-',
      best: intervals.length ? Math.max(...intervals) : null
    };
  }

  function style() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
${pane}>.smoking-layout{align-items:stretch!important;gap:24px!important}
#screen-smoking .smoking-intelligence-grid{grid-template-columns:minmax(0,1.08fr) minmax(420px,.92fr)!important;align-items:stretch!important}
#screen-smoking .smoking-intelligence-grid .smoking-visual-panel{height:100%!important}
#screen-smoking .smoking-intelligence-grid .smoking-visual-summary-grid{align-items:stretch!important}
#screen-smoking .smoking-intelligence-grid .smoking-visual-summary-grid>article{height:100%!important}
#screen-smoking .smoke-control-card,${pane} .consumption-history-panel{height:100%!important;padding:clamp(22px,2.2vw,30px)!important;border:1px solid rgba(17,36,58,.08)!important;border-radius:28px!important;background:rgba(255,255,255,.9)!important;background-image:none!important;box-shadow:0 18px 45px rgba(17,36,58,.07)!important;overflow:hidden!important}
#screen-smoking .smoke-control-card:before,#screen-smoking .smoke-control-card:after{display:none!important;content:none!important}
#screen-smoking .smoke-control-card{display:grid!important;grid-template-rows:auto minmax(250px,1fr) auto auto;gap:18px!important}
#screen-smoking .smoke-control-card .panel-head.compact,${pane} .consumption-history-panel .panel-head{margin:0!important;min-height:46px;align-items:flex-start!important}
#screen-smoking .smoke-ring{position:relative!important;width:min(100%,310px)!important;aspect-ratio:1/1;align-self:center;justify-self:center;display:grid!important;place-items:center!important;align-content:center!important;gap:7px!important;padding:34px!important;border:0!important;border-radius:50%!important;background:transparent!important;background-image:none!important;box-shadow:none!important;text-align:center}
#screen-smoking .hf-smoke-progress-svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);pointer-events:none}
#screen-smoking .hf-smoke-progress-bg,#screen-smoking .hf-smoke-progress-value,#screen-smoking .hf-smoke-progress-bonus{fill:none}
#screen-smoking .hf-smoke-progress-bg,#screen-smoking .hf-smoke-progress-value{stroke-width:7}
#screen-smoking .hf-smoke-progress-bg{stroke:rgba(17,36,58,.07)}
#screen-smoking .hf-smoke-progress-value{stroke:#34c9c3;stroke-linecap:round;stroke-dasharray:${C};stroke-dashoffset:${C}}
#screen-smoking .hf-smoke-progress-bonus{stroke:#34c9c3;stroke-width:2.5;stroke-linecap:round;stroke-dasharray:.1 5.8;opacity:.68}
#screen-smoking .smoke-ring small,#screen-smoking .smoke-ring strong,#screen-smoking .smoke-ring span{position:relative;z-index:1}
#screen-smoking .smoke-ring small{color:#63748a!important;font-size:.66rem!important;font-weight:900!important;letter-spacing:.16em!important;text-transform:uppercase!important}
#screen-smoking .smoke-ring strong{color:#111827!important;font-family:inherit!important;font-size:clamp(3.45rem,5.35vw,4.75rem)!important;font-weight:950!important;font-variant-numeric:tabular-nums;letter-spacing:-.035em!important;line-height:.92!important}
#screen-smoking .smoke-ring span{color:#65758a!important;font-size:.92rem!important;font-weight:760!important;line-height:1.35!important}
#screen-smoking .smoke-ring .hf-smoke-bonus-meta{display:none;color:#34a9a5!important;font-size:.73rem!important;font-weight:850!important;line-height:1.3!important}
#screen-smoking .smoke-ring.hf-is-bonus strong{color:#34c9c3!important}
#screen-smoking .smoke-ring.hf-is-bonus #smokePauseHint{display:none!important}
#screen-smoking .smoke-ring.hf-is-bonus .hf-smoke-bonus-meta{display:block!important}
#screen-smoking .pause-status-row,#screen-smoking .smoke-control-card .consumption-command-insight,#screen-smoking .smoke-control-card .mobile-consumption-kpis{display:none!important}
#screen-smoking .hf-smoking-actions{display:grid;grid-template-columns:minmax(150px,.72fr) minmax(220px,1.28fr);gap:12px}
#screen-smoking .hf-pause-start-btn{min-height:56px!important;border-radius:18px!important;background:rgba(255,255,255,.82)!important;background-image:none!important;border:1px solid rgba(17,36,58,.09)!important;box-shadow:none!important;color:#223047!important;font-weight:900!important;justify-content:center!important}
#screen-smoking #recordSmokeBtn.smoke-button{height:56px!important;min-height:56px!important;margin:0!important;border:0!important;border-radius:18px!important;background:#fb8f3f!important;background-image:none!important;box-shadow:none!important;color:#fff!important;font-size:1.06rem!important;font-weight:950!important}
#screen-smoking #recordSmokeBtn.smoke-button span{width:30px!important;height:30px!important;background:rgba(255,255,255,.26)!important;color:#fff!important}
#screen-smoking .craving-coach-card{display:grid!important;grid-template-columns:42px minmax(0,1fr) auto;align-items:center!important;gap:13px 14px!important;min-height:82px!important;padding:16px 18px!important;border-radius:20px!important;border:1px solid rgba(52,201,195,.14)!important;background:rgba(52,201,195,.09)!important;background-image:none!important;box-shadow:none!important;overflow:hidden!important}
#screen-smoking .craving-coach-head{display:contents!important;margin:0!important}
#screen-smoking .craving-coach-head:before{content:"☆";grid-column:1;grid-row:1/span 2;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:rgba(52,201,195,.2);color:#21a9a4;font-size:1.05rem;font-weight:950}
#screen-smoking .craving-coach-head>div{min-width:0}
#screen-smoking .craving-coach-card .eyebrow,#screen-smoking .craving-coach-card .badge{display:none!important}
#screen-smoking .craving-coach-head h4{grid-column:2;grid-row:1;margin:0!important;color:#1a2638!important;font-size:.92rem!important;font-weight:950!important;line-height:1.18!important;text-transform:none!important;letter-spacing:-.015em!important}
#screen-smoking .craving-coach-card p:not(.eyebrow){grid-column:2;grid-row:2;max-width:360px!important;margin:-3px 0 0!important;color:#65758a!important;font-size:.8rem!important;font-weight:760!important;line-height:1.35!important}
#screen-smoking .craving-actions{grid-column:3;grid-row:1/span 2;display:flex!important;gap:8px!important;margin:0!important}
#screen-smoking .craving-actions .mini-btn{min-width:118px!important;min-height:38px!important;padding:0 14px!important;border-radius:999px!important;background:rgba(255,255,255,.78)!important;background-image:none!important;border:1px solid rgba(52,201,195,.55)!important;box-shadow:none!important;color:#18aaa4!important;font-size:.78rem!important;font-weight:900!important;white-space:nowrap!important}
#screen-smoking .craving-coach-card:not(.hf-show-coach-details) .hf-coach-v2-extra{display:none!important}
#screen-smoking .craving-coach-card .hf-coach-v2-extra{grid-column:1/-1!important;margin-top:4px!important}
${pane} .consumption-history-panel{display:flex!important;flex-direction:column!important;gap:16px!important}
#screen-smoking .history-launch-area{flex:1;min-height:0}
#screen-smoking .hf-smoke-overview{min-height:100%;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:16px}
#screen-smoking .hf-overview-primary{display:grid;border-block:1px solid rgba(17,36,58,.08)}
#screen-smoking .hf-overview-row{width:100%;display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:13px;align-items:center;padding:14px 0;border:0;border-bottom:1px solid rgba(17,36,58,.08);background:transparent;color:#111827;text-align:left}
#screen-smoking .hf-overview-row:last-child{border-bottom:0}
#screen-smoking .hf-overview-icon{width:42px;height:42px;border-radius:16px;display:grid;place-items:center;background:rgba(52,201,195,.11);color:#17aaa4;font-weight:950}
#screen-smoking .hf-overview-row.is-cost .hf-overview-icon{background:rgba(251,143,63,.12);color:#d97706}
#screen-smoking .hf-overview-copy{display:grid;gap:3px;min-width:0}
#screen-smoking .hf-overview-copy strong{font-size:.94rem;line-height:1.2}
#screen-smoking .hf-overview-copy span,#screen-smoking .hf-overview-action{color:#65758a;font-size:.78rem;line-height:1.35;font-weight:760}
#screen-smoking .hf-overview-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border:1px solid rgba(17,36,58,.08);border-radius:20px;overflow:hidden}
#screen-smoking .hf-overview-metrics article{min-height:82px;padding:13px 14px;display:grid;align-content:space-between;gap:6px;background:transparent!important;border:0}
#screen-smoking .hf-overview-metrics article:nth-child(odd){border-right:1px solid rgba(17,36,58,.08)}
#screen-smoking .hf-overview-metrics article:nth-child(-n+2){border-bottom:1px solid rgba(17,36,58,.08)}
#screen-smoking .hf-overview-metrics small,#screen-smoking .hf-recent-head small{color:#718197;font-size:.66rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
#screen-smoking .hf-overview-metrics strong{color:#111827;font-size:1.28rem;line-height:1}
#screen-smoking .hf-overview-metrics span,#screen-smoking .hf-recent-row{color:#65758a;font-size:.76rem;font-weight:760;line-height:1.25}
#screen-smoking .hf-overview-recent{display:grid;align-content:start;gap:8px}
#screen-smoking .hf-recent-head,#screen-smoking .hf-recent-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
#screen-smoking .hf-recent-list{list-style:none;margin:0;padding:0;display:grid}
#screen-smoking .hf-recent-row{min-height:34px;border-top:1px solid rgba(17,36,58,.075)}
#screen-smoking .hf-recent-row strong{color:#111827;font-size:.76rem;font-weight:950;white-space:nowrap}
#screen-smoking .hf-recent-row strong.is-danger{color:#dc4c4c}
#screen-smoking .hf-recent-row strong.is-positive{color:#159c68}
#screen-smoking .hf-overview-footer{width:100%;min-height:44px;border:0;border-radius:16px;background:rgba(52,201,195,.08);color:#17aaa4;font-weight:950}
body:not(.light) #screen-smoking .smoke-control-card,body:not(.light) ${pane} .consumption-history-panel{background:rgba(18,30,44,.9)!important;border-color:rgba(255,255,255,.08)!important}
body:not(.light) #screen-smoking .smoke-ring strong,body:not(.light) #screen-smoking .hf-overview-row,body:not(.light) #screen-smoking .hf-overview-copy strong,body:not(.light) #screen-smoking .hf-overview-metrics strong,body:not(.light) #screen-smoking .hf-recent-row strong,body:not(.light) #screen-smoking .craving-coach-head h4{color:#f4f9ff!important}
body:not(.light) #screen-smoking .smoke-ring.hf-is-bonus strong{color:#34c9c3!important}
body:not(.light) #screen-smoking .smoke-ring span,body:not(.light) #screen-smoking .smoke-ring small,body:not(.light) #screen-smoking .hf-overview-copy span,body:not(.light) #screen-smoking .hf-overview-metrics span,body:not(.light) #screen-smoking .hf-recent-row,body:not(.light) #screen-smoking .craving-coach-card p:not(.eyebrow){color:rgba(210,227,244,.68)!important}
@media(max-width:980px){#screen-smoking .smoking-intelligence-grid{grid-template-columns:1fr!important}}
@media(max-width:760px){${pane}>.smoking-layout{grid-template-columns:1fr!important;gap:14px!important}${pane}>.smoking-layout>.mobile-consumption-section{display:block!important}${pane}>.smoking-layout>.mobile-consumption-section>summary{display:none!important}${pane}>.smoking-layout>.mobile-consumption-section>.consumption-history-panel,${pane}>.smoking-layout>.mobile-consumption-section:not([open])>.consumption-history-panel{display:flex!important}#screen-smoking .smoke-control-card,${pane} .consumption-history-panel{height:auto!important;width:100%!important;padding:17px!important;border-radius:26px!important}#screen-smoking .smoke-control-card{grid-template-rows:auto auto auto;gap:15px!important}#screen-smoking .smoke-ring{width:min(100%,238px)!important;padding:25px!important}#screen-smoking .smoke-ring strong{font-size:clamp(3.05rem,15vw,4.2rem)!important;letter-spacing:-.025em!important}#screen-smoking .hf-smoke-progress-bg,#screen-smoking .hf-smoke-progress-value{stroke-width:8}#screen-smoking .hf-smoking-actions{grid-template-columns:minmax(0,.82fr) minmax(0,1.18fr);gap:10px}#screen-smoking .hf-pause-start-btn,#screen-smoking #recordSmokeBtn.smoke-button{height:52px!important;min-height:52px!important;border-radius:17px!important}#screen-smoking .craving-coach-card{grid-template-columns:42px minmax(0,1fr);padding:14px!important}#screen-smoking .craving-actions{grid-column:1/-1;grid-row:auto;display:grid!important;grid-template-columns:1fr 1fr}#screen-smoking .craving-actions .mini-btn{min-width:0!important}#screen-smoking .hf-overview-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}#screen-smoking .smoking-intelligence-grid .smoking-visual-panel{height:auto!important}}
@media(max-width:380px){#screen-smoking .hf-smoking-actions{grid-template-columns:1fr}}
    `;
    const node = document.createElement('style');
    node.id = STYLE_ID;
    node.textContent = css;
    document.head.appendChild(node);
  }

  function ring(data) {
    const box = $('#screen-smoking .smoke-ring');
    if (!box) return;
    const label = $('small', box);
    const live = $('#smokePauseLive', box) || $('strong', box);
    const hint = $('#smokePauseHint', box);
    if (label && label.textContent !== 'Aktuelle Pause') label.textContent = 'Aktuelle Pause';
    if (hint && hint.textContent !== 'seit letzter Zigarette') hint.textContent = 'seit letzter Zigarette';
    let svg = $('.hf-smoke-progress-svg', box);
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'hf-smoke-progress-svg');
      svg.setAttribute('viewBox', '0 0 220 220');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = `<defs><mask id="hfSmokeBonusProgressMask" maskUnits="userSpaceOnUse" x="0" y="0" width="220" height="220"><circle class="hf-smoke-progress-bonus-mask" cx="110" cy="110" r="${BONUS_R}" fill="none" stroke="#fff" stroke-width="10" stroke-dasharray="${BONUS_C}" stroke-dashoffset="${BONUS_C}"></circle></mask></defs><circle class="hf-smoke-progress-bg" cx="110" cy="110" r="${R}"></circle><circle class="hf-smoke-progress-value" cx="110" cy="110" r="${R}"></circle><circle class="hf-smoke-progress-bonus" cx="110" cy="110" r="${BONUS_R}" mask="url(#hfSmokeBonusProgressMask)"></circle>`;
      box.prepend(svg);
    }
    const progress = $('.hf-smoke-progress-value', svg);
    const bonusMask = $('.hf-smoke-progress-bonus-mask', svg);
    if (progress) progress.style.strokeDashoffset = String(C * (1 - data.progress));
    if (bonusMask) bonusMask.style.strokeDashoffset = String(BONUS_C * (1 - data.bonusProgress));
    let bonusMeta = $('.hf-smoke-bonus-meta', box);
    if (!bonusMeta) {
      bonusMeta = document.createElement('span');
      bonusMeta.className = 'hf-smoke-bonus-meta';
      hint?.insertAdjacentElement('afterend', bonusMeta);
    }
    const isBonus = data.bonusMinutes > 0;
    box.classList.toggle('hf-is-bonus', isBonus);
    if (isBonus) {
      if (live && live.textContent !== `+${duration(data.bonusMinutes)}`) live.textContent = `+${duration(data.bonusMinutes)}`;
      const meta = `${duration(data.pause)} gesamt · Median ${duration(data.median)}`;
      if (bonusMeta && bonusMeta.textContent !== meta) bonusMeta.textContent = meta;
      box.setAttribute('aria-label', `${duration(data.bonusMinutes)} über deiner Median-Pause. ${duration(data.pause)} aktuelle Pause insgesamt.`);
    } else {
      const current = data.pause == null ? '–' : duration(data.pause);
      if (live && live.textContent !== current) live.textContent = current;
      if (bonusMeta?.textContent) bonusMeta.textContent = '';
      box.removeAttribute('aria-label');
    }
  }

  function actions() {
    const card = $('#screen-smoking .smoke-control-card');
    if (!card) return;
    let row = $('.hf-smoking-actions', card);
    if (!row) {
      row = document.createElement('div');
      row.className = 'hf-smoking-actions';
      ($('.smoke-ring', card) || card).insertAdjacentElement('afterend', row);
    }
    const pause = $('.pause-status-row button[data-action="open-pause-modal"][data-scope="smoke"], .hf-pause-start-btn', card);
    const cigarette = $('#recordSmokeBtn', card);
    if (pause && pause.parentElement !== row) row.appendChild(pause);
    if (pause) {
      pause.classList.add('hf-pause-start-btn');
      pause.textContent = 'Pause starten';
    }
    if (cigarette && cigarette.parentElement !== row) row.appendChild(cigarette);
  }

  function coach() {
    const card = $('#screen-smoking .craving-coach-card');
    if (!card) return;
    const title = $('#cravingTipTitle', card);
    const body = $('#cravingTipBody', card);
    const tip = $('[data-action="rotate-craving-tip"]', card);
    const open = $('[data-action="open-coach"]', card);
    if (title && title.textContent !== 'Craving-Coach') title.textContent = 'Craving-Coach';
    if (body && body.textContent !== 'Das ist ein Belohnungsmoment. Damit stärkst du dein neues Ich.') body.textContent = 'Das ist ein Belohnungsmoment. Damit stärkst du dein neues Ich.';
    if (tip && tip.textContent !== 'Tipp anzeigen') tip.textContent = 'Tipp anzeigen';
    if (open && open.textContent !== 'Coach öffnen') open.textContent = 'Coach öffnen';
  }

  function overview(data) {
    const root = $('#smokeHistory');
    const panel = $(`${pane} .consumption-history-panel`);
    if (!root || !panel) return;
    const title = $('.panel-head h3', panel);
    if (title && title.textContent !== 'Heute im Überblick') title.textContent = 'Heute im Überblick';
    const badge = $('#lastSmokePoints', panel);
    if (badge) badge.textContent = 'Mehr';
    const focus = data.pause == null ? 'Erste bewusste Pause setzen.' : data.pause >= data.next ? 'Pause halten und nicht verhandeln.' : `${duration(data.next)} als nächste saubere Marke.`;
    const recent = data.recent.length ? data.recent.map(item => {
      const points = Number(item.points || 0);
      const className = points < 0 ? 'is-danger' : points > 0 ? 'is-positive' : '';
      return `<li class="hf-recent-row"><span>${esc(when(item.smoked_at))}</span><strong class="${className}">${points > 0 ? '+' : ''}${points} Pkt.</strong></li>`;
    }).join('') : '<li class="hf-recent-row"><span>Noch keine Logs</span><strong>bereit</strong></li>';
    const html = `<div class="hf-smoke-overview">
      <div class="hf-overview-primary">
        <button class="hf-overview-row is-logs" type="button" data-action="open-smoke-history"><span class="hf-overview-icon">↗</span><span class="hf-overview-copy"><strong>Logs bei Bedarf</strong><span>${data.total} Einträge · ${data.today} heute</span></span><span class="hf-overview-action">›</span></button>
        <button class="hf-overview-row is-cost" type="button" data-action="open-smoke-costs"><span class="hf-overview-icon">CHF</span><span class="hf-overview-copy"><strong>Kosten</strong><span>${esc(chf(data.total * 0.4))} gesamt · ${esc(chf(data.today * 0.4))} heute</span></span><span class="hf-overview-action">›</span></button>
        <div class="hf-overview-row is-focus"><span class="hf-overview-icon">∿</span><span class="hf-overview-copy"><strong>Nächste saubere Aktion</strong><span>${esc(focus)}</span></span></div>
      </div>
      <div class="hf-overview-metrics"><article><small>Heute</small><strong>${data.today}×</strong><span>erfasst</span></article><article><small>7 Tage</small><strong>${data.week}×</strong><span>sichtbar</span></article><article><small>Ø Pause</small><strong>${esc(data.avg)}</strong><span>letzte 7 Tage</span></article><article><small>Beste Pause</small><strong>${data.best == null ? '-' : esc(duration(data.best))}</strong><span>bisher</span></article></div>
      <div class="hf-overview-recent"><div class="hf-recent-head"><small>Letzte Einträge</small><strong>kurzer Check</strong></div><ul class="hf-recent-list">${recent}</ul></div>
      <button class="hf-overview-footer" type="button" data-action="open-smoke-history">Alle Einträge anzeigen</button>
    </div>`;
    if (root.dataset.hfSmokingOverviewMarkup !== html) {
      root.innerHTML = html;
      root.dataset.hfSmokingOverviewMarkup = html;
    }
  }

  function render(snapshot = null) {
    if (busy) return;
    busy = true;
    try {
      const data = metrics(snapshot || liveSnapshot || readState());
      style();
      ring(data);
      actions();
      coach();
      overview(data);
    } finally {
      busy = false;
    }
  }

  function schedule(delay = 80) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      render(liveSnapshot);
    }, delay);
  }

  function applyLiveSnapshot(snapshot) {
    window.clearTimeout(timer);
    timer = null;
    const nextSnapshot = cloneLiveSnapshot(snapshot);
    if (nextSnapshot) liveSnapshot = nextSnapshot;
    if (busy) {
      schedule(0);
      return Boolean(nextSnapshot);
    }
    render(liveSnapshot);
    return Boolean(nextSnapshot);
  }

  function renderLiveUpdate(event) {
    applyLiveSnapshot(event?.detail?.snapshot);
  }

  window.HabitFlowSmokingCircle = Object.freeze({
    update: applyLiveSnapshot,
    refresh() {
      render(liveSnapshot || readState());
    }
  });

  function init() {
    render();
    [150, 450, 1000, 2200].forEach(delay => window.setTimeout(render, delay));
    window.setInterval(render, 30000);
    window.addEventListener('storage', event => {
      if (!event.key || event.key === STATE_KEY) {
        liveSnapshot = null;
        schedule();
      }
    });
    window.addEventListener('habitflow:consumption-live-update', renderLiveUpdate);
    document.addEventListener('click', event => {
      const action = event.target?.closest?.('[data-action]')?.dataset?.action || '';
      if (action === 'rotate-craving-tip') $('#screen-smoking .craving-coach-card')?.classList.add('hf-show-coach-details');
      if (action === 'rotate-craving-tip' || action.includes('smoke') || action.includes('pause') || action.includes('consumption')) schedule(500);
    }, true);
    const target = document.getElementById('screen-smoking');
    if (target && 'MutationObserver' in window) {
      new MutationObserver(() => {
        if (!busy) schedule(120);
      }).observe(target, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  modules?.register?.('smoking-top-cards-polish', {
    description: 'Polishes only the smoking quick-capture and today overview cards, preserving existing actions and storage.',
    exports: Object.freeze([])
  });
})(window, document);
