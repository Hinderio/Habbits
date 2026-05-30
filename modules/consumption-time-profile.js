(function initHabitFlowConsumptionTimeProfile(window) {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const LOOKBACK_DAYS = 120;
  const HOURS = 24;
  const TARGETS = { smoke: 'smokeIntervalVisual', alcohol: 'alcoholIntervalVisual' };
  const observedTargets = new WeakSet();
  let renderTimer = null;
  let isRendering = false;

  function safeArray(value) { return Array.isArray(value) ? value : []; }

  function readState() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      console.warn('[HabitFlow/time-profile] state read failed', error);
      return null;
    }
  }

  function eventDate(item, mode) {
    const value = mode === 'alcohol'
      ? (item.occurred_at || item.created_at || item.updated_at)
      : (item.smoked_at || item.occurred_at || item.created_at || item.updated_at);
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function eventsForMode(state, mode) {
    const source = mode === 'alcohol'
      ? safeArray(state?.alcoholUnits).concat(safeArray(state?.alcoholEvents))
      : safeArray(state?.cigarettes);
    const since = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
    return source.map(item => eventDate(item, mode)).filter(date => date && date.getTime() >= since).sort((a, b) => a - b);
  }

  function smooth(values) {
    return values.map((value, index) => {
      const prev = values[(index + HOURS - 1) % HOURS] || 0;
      const next = values[(index + 1) % HOURS] || 0;
      return value * 0.58 + prev * 0.21 + next * 0.21;
    });
  }

  function analyze(events) {
    const focusBins = Array.from({ length: HOURS }, () => 0);
    const restBins = Array.from({ length: HOURS }, () => 0);
    const totalBins = Array.from({ length: HOURS }, () => 0);
    const focusDays = new Set();
    const restDays = new Set();
    const allDays = new Set();

    events.forEach(date => {
      const hour = date.getHours();
      const key = date.toISOString().slice(0, 10);
      const isFridayOrSaturday = date.getDay() === 5 || date.getDay() === 6;
      if (isFridayOrSaturday) {
        focusBins[hour] += 1;
        focusDays.add(key);
      } else {
        restBins[hour] += 1;
        restDays.add(key);
      }
      totalBins[hour] += 1;
      allDays.add(key);
    });

    const focusCurve = smooth(focusBins.map(value => value / Math.max(1, focusDays.size)));
    const restCurve = smooth(restBins.map(value => value / Math.max(1, restDays.size)));
    const totalCurve = smooth(totalBins);
    const max = Math.max(1, ...focusCurve, ...restCurve);
    const peak = totalCurve.reduce((best, value, index) => value > totalCurve[best] ? index : best, 0);
    return {
      focusCurve,
      restCurve,
      max,
      peak,
      focusTotal: focusBins.reduce((sum, value) => sum + value, 0),
      restTotal: restBins.reduce((sum, value) => sum + value, 0),
      activeDays: allDays.size
    };
  }

  function hourLabel(hour) {
    const value = ((Math.round(hour) % HOURS) + HOURS) % HOURS;
    return `${String(value).padStart(2, '0')}:00`;
  }

  function point(hour, value, max) {
    return { x: 5 + (hour / (HOURS - 1)) * 90, y: 66 - (Number(value || 0) / Math.max(1, max)) * 48 };
  }

  function linePath(values, max) {
    const points = values.map((value, index) => point(index, value, max));
    return points.reduce((path, current, index) => {
      if (index === 0) return `M ${current.x.toFixed(2)} ${current.y.toFixed(2)}`;
      const previous = points[index - 1];
      const midX = (previous.x + current.x) / 2;
      return `${path} C ${midX.toFixed(2)} ${previous.y.toFixed(2)}, ${midX.toFixed(2)} ${current.y.toFixed(2)}, ${current.x.toFixed(2)} ${current.y.toFixed(2)}`;
    }, '');
  }

  function buildSvg(model) {
    const peakValue = Math.max(model.focusCurve[model.peak] || 0, model.restCurve[model.peak] || 0, model.max * 0.08);
    const peakPoint = point(model.peak, peakValue, model.max);
    return `<svg class="hf-time-line-svg" viewBox="0 0 100 76" preserveAspectRatio="none" aria-hidden="true">
      <g class="hf-time-grid"><line x1="5" y1="18" x2="95" y2="18"></line><line x1="5" y1="42" x2="95" y2="42"></line><line x1="5" y1="66" x2="95" y2="66"></line></g>
      <path class="hf-time-line hf-time-line-rest" d="${linePath(model.restCurve, model.max)}"></path>
      <path class="hf-time-line hf-time-line-focus" d="${linePath(model.focusCurve, model.max)}"></path>
      <line class="hf-time-peak-line" x1="${peakPoint.x.toFixed(2)}" y1="8" x2="${peakPoint.x.toFixed(2)}" y2="68"></line>
      <circle class="hf-time-peak-dot" cx="${peakPoint.x.toFixed(2)}" cy="${peakPoint.y.toFixed(2)}" r="2.15"></circle>
    </svg>`;
  }

  function dominantLabel(model) {
    if (!model.focusTotal && !model.restTotal) return '-';
    if (model.focusTotal === model.restTotal) return 'Balanced';
    return model.focusTotal > model.restTotal ? 'Fr/Sa' : 'Rest';
  }

  function cardHtml(mode, state) {
    const events = eventsForMode(state, mode);
    const model = analyze(events);
    const isAlcohol = mode === 'alcohol';
    const title = isAlcohol ? 'Zeitprofil Alkohol' : 'Zeitprofil Rauchen';
    const unit = isAlcohol ? 'Einheiten' : 'Zigaretten';
    const focusShare = events.length ? `${Math.round((model.focusTotal / Math.max(1, events.length)) * 100)}%` : '-';
    const badge = events.length ? `${events.length} ${unit}` : 'lernt';
    const insight = events.length
      ? `Peak um ${hourLabel(model.peak)} · Fr/Sa-Anteil ${focusShare} · ${events.length} ${unit} in ${LOOKBACK_DAYS} Tagen.`
      : (isAlcohol ? 'Sobald Einheiten erfasst sind, erkennt die App typische Alkohol-Zeitfenster.' : 'Sobald Zigaretten erfasst sind, erkennt die App typische Rauch-Zeitfenster.');

    return `<article class="hf-time-profile-card ${isAlcohol ? 'is-alcohol' : 'is-smoke'}" id="hfTimeProfile-${mode}" data-hf-time-profile="${mode}">
      <div class="hf-time-profile-head"><div><p class="eyebrow">Zeitverteilung</p><h4>${title}</h4></div><span class="badge muted">${badge}</span></div>
      <div class="hf-time-legend"><span><i class="is-focus"></i>Fr/Sa</span><span><i class="is-rest"></i>Rest</span></div>
      <div class="hf-time-profile-stage">${buildSvg(model)}<div class="hf-time-axis"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span></div></div>
      <div class="hf-time-profile-stats"><span><small>Peak</small><strong>${events.length ? hourLabel(model.peak) : '-'}</strong></span><span><small>Dominant</small><strong>${dominantLabel(model)}</strong></span><span><small>Fr/Sa</small><strong>${focusShare}</strong></span></div>
      <p>${insight}</p>
    </article>`;
  }

  function injectStyle(document) {
    if (!document || document.getElementById('hf-time-profile-style')) return;
    const style = document.createElement('style');
    style.id = 'hf-time-profile-style';
    style.textContent = `
      .hf-time-profile-card{--hf-focus:#8ff0a7;--hf-rest:#66e7ff;display:grid;gap:14px;margin:0 0 14px;padding:16px;border-radius:28px;background:linear-gradient(180deg,rgba(255,255,255,.072),rgba(255,255,255,.034));border:1px solid rgba(255,255,255,.09);box-shadow:0 18px 44px rgba(0,0,0,.08);overflow:hidden}.hf-time-profile-card.is-alcohol{--hf-focus:#c7b7ff;--hf-rest:#7db7ff}.hf-time-profile-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.hf-time-profile-head h4{margin:3px 0 0;font-size:1.02rem;letter-spacing:-.02em}.hf-time-legend{display:flex;gap:12px;align-items:center;color:var(--muted);font-size:.72rem;font-weight:680}.hf-time-legend span{display:inline-flex;align-items:center;gap:6px}.hf-time-legend i{width:18px;height:3px;border-radius:999px;display:inline-block}.hf-time-legend .is-focus{background:var(--hf-focus)}.hf-time-legend .is-rest{background:var(--hf-rest);opacity:.74}.hf-time-profile-stage{min-height:144px;padding:12px 0 0;border-radius:24px;background:linear-gradient(180deg,rgba(255,255,255,.048),rgba(255,255,255,.018));border:1px solid rgba(255,255,255,.06);overflow:hidden}.hf-time-line-svg{width:100%;height:116px;display:block}.hf-time-grid line{stroke:rgba(157,176,195,.14);stroke-width:.55;vector-effect:non-scaling-stroke}.hf-time-line{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-width:2.35;vector-effect:non-scaling-stroke}.hf-time-line-focus{stroke:var(--hf-focus);filter:drop-shadow(0 0 10px rgba(143,240,167,.18))}.hf-time-line-rest{stroke:var(--hf-rest);opacity:.78}.hf-time-peak-line{stroke:rgba(9,18,30,.82);stroke-width:.8;vector-effect:non-scaling-stroke}.hf-time-peak-dot{fill:var(--hf-focus);stroke:rgba(9,18,30,.34);stroke-width:.7;vector-effect:non-scaling-stroke}.hf-time-axis{display:grid;grid-template-columns:repeat(5,1fr);padding:0 12px 12px;color:var(--muted);font-size:.72rem;font-weight:640}.hf-time-axis span{text-align:center}.hf-time-axis span:first-child{text-align:left}.hf-time-axis span:last-child{text-align:right}.hf-time-profile-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.hf-time-profile-stats span{padding:10px 11px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.055)}.hf-time-profile-stats small{display:block;color:var(--muted);font-size:.64rem;text-transform:uppercase;letter-spacing:.08em;font-weight:640;margin-bottom:4px}.hf-time-profile-stats strong{font-size:.9rem;font-weight:720;white-space:nowrap}.hf-time-profile-card p{margin:0;color:var(--muted);font-size:.86rem;line-height:1.45}body.light .hf-time-profile-card{background:rgba(255,255,255,.8);border-color:rgba(17,36,58,.08);box-shadow:0 18px 36px rgba(17,36,58,.06)}body.light .hf-time-profile-stage,body.light .hf-time-profile-stats span{background:rgba(255,255,255,.68);border-color:rgba(17,36,58,.07)}body.light .hf-time-grid line{stroke:rgba(95,112,130,.15)}body.light .hf-time-peak-line{stroke:rgba(17,36,58,.82)}@media (max-width:760px){.hf-time-profile-card{padding:14px;border-radius:23px;margin-bottom:12px;gap:12px}.hf-time-profile-stage{min-height:126px;border-radius:21px}.hf-time-line-svg{height:100px}.hf-time-profile-stats{grid-template-columns:1fr}.hf-time-profile-stats span{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px}.hf-time-profile-stats small{margin:0}.hf-time-profile-head h4{font-size:.98rem}}
    `;
    document.head.appendChild(style);
  }

  function signatureFor(mode, state) {
    const events = eventsForMode(state, mode);
    const last = events.length ? events[events.length - 1].getTime() : 0;
    return `${mode}:${events.length}:${last}`;
  }

  function upsertCard(targetId, mode, state) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const signature = signatureFor(mode, state);
    const existing = document.getElementById(`hfTimeProfile-${mode}`);
    if (existing?.dataset?.signature === signature && existing.parentElement === target) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = cardHtml(mode, state).trim();
    const card = wrapper.firstElementChild;
    card.dataset.signature = signature;
    if (existing && existing.parentElement === target) existing.replaceWith(card);
    else target.prepend(card);
  }

  function observeTarget(target) {
    if (!target || observedTargets.has(target)) return;
    observedTargets.add(target);
    const observer = new MutationObserver(() => {
      if (!isRendering && !target.querySelector('[data-hf-time-profile]')) scheduleRender(80);
    });
    observer.observe(target, { childList: true });
  }

  function renderTimeProfiles() {
    const state = readState();
    if (!state) return;
    isRendering = true;
    try {
      injectStyle(document);
      upsertCard(TARGETS.smoke, 'smoke', state);
      upsertCard(TARGETS.alcohol, 'alcohol', state);
      Object.values(TARGETS).forEach(id => observeTarget(document.getElementById(id)));
    } finally {
      window.setTimeout(() => { isRendering = false; }, 0);
    }
  }

  function scheduleRender(delay = 140) {
    clearTimeout(renderTimer);
    renderTimer = window.setTimeout(renderTimeProfiles, delay);
  }

  function start() {
    injectStyle(document);
    [180, 700, 1600, 3200].forEach(delay => window.setTimeout(renderTimeProfiles, delay));
    window.addEventListener('focus', () => scheduleRender(120));
    window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) scheduleRender(160); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleRender(120); });
    document.addEventListener('click', event => {
      const action = event.target?.closest?.('[data-action]')?.dataset?.action || '';
      if (action.includes('record') || action.includes('log') || action.includes('switch-consumption-mode')) scheduleRender(520);
    }, true);
    window.setInterval(() => scheduleRender(0), 45000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(window);
