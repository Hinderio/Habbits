(function registerHabitFlowConsumptionModule(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('consumption')) return;

  const STORAGE_KEY = 'habitflow-state-v1';
  const LOOKBACK_DAYS = 120;
  const HOURS = 24;
  const renderDelays = [240, 900, 1800, 3600];

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function readState() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      console.warn('[HabitFlow/consumption] Time distribution state read failed.', error);
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
    return source
      .map(item => eventDate(item, mode))
      .filter(date => date && date.getTime() >= since)
      .sort((a, b) => a - b);
  }

  function smooth(values) {
    return values.map((value, index) => {
      const prev = values[(index + HOURS - 1) % HOURS];
      const next = values[(index + 1) % HOURS];
      return value * 0.56 + prev * 0.22 + next * 0.22;
    });
  }

  function analyze(events) {
    const bins = Array.from({ length: HOURS }, () => 0);
    const days = new Set();
    events.forEach(date => {
      bins[date.getHours()] += 1;
      days.add(date.toISOString().slice(0, 10));
    });
    const curve = smooth(bins);
    const max = Math.max(1, ...curve);
    const peak = curve.reduce((best, value, index) => value > curve[best] ? index : best, 0);
    const threshold = Math.max(0.85, max * 0.42);
    let start = peak;
    let end = peak;
    while (start > 0 && curve[start - 1] >= threshold) start -= 1;
    while (end < HOURS - 1 && curve[end + 1] >= threshold) end += 1;
    return { bins, curve, max, peak, start, end, activeDays: days.size };
  }

  function hourLabel(hour) {
    const value = ((Math.round(hour) % HOURS) + HOURS) % HOURS;
    return `${String(value).padStart(2, '0')}:00`;
  }

  function windowLabel(model) {
    if (!model) return '–';
    if (model.start === model.end) return `${hourLabel(model.peak)} ± 1h`;
    return `${hourLabel(model.start)} – ${hourLabel(model.end + 1)}`;
  }

  function buildSvg(model, mode) {
    const center = 36;
    const maxHeight = 24;
    const points = Array.from({ length: HOURS + 1 }, (_, index) => {
      const sourceIndex = Math.min(HOURS - 1, index);
      const value = model.curve[sourceIndex] || 0;
      const x = (index / HOURS) * 100;
      const height = Math.max(1.4, (value / model.max) * maxHeight);
      return { x, top: center - height, bottom: center + height };
    });
    const top = points.map(point => `${point.x.toFixed(2)},${point.top.toFixed(2)}`).join(' L ');
    const bottom = points.slice().reverse().map(point => `${point.x.toFixed(2)},${point.bottom.toFixed(2)}`).join(' L ');
    const peakX = ((model.peak + 0.5) / HOURS) * 100;
    const peakHeight = Math.max(1.4, ((model.curve[model.peak] || 0) / model.max) * maxHeight);
    const gradientId = `hf-time-${mode}`;
    return `<svg class="hf-time-profile-svg" viewBox="0 0 100 78" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="${gradientId}" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stop-color="var(--hf-time-soft)"/><stop offset="72%" stop-color="var(--hf-time-tone)"/><stop offset="100%" stop-color="var(--hf-time-strong)"/></linearGradient></defs>
      <line class="hf-time-midline" x1="0" y1="36" x2="100" y2="36"></line>
      <path class="hf-time-area" d="M ${top} L ${bottom} Z" fill="url(#${gradientId})"></path>
      <line class="hf-time-peak-line" x1="${peakX.toFixed(2)}" y1="4" x2="${peakX.toFixed(2)}" y2="72"></line>
      <circle class="hf-time-peak-dot" cx="${peakX.toFixed(2)}" cy="${(center - peakHeight).toFixed(2)}" r="1.9"></circle>
    </svg>`;
  }

  function insightText(mode, events, model) {
    if (!events.length) {
      return mode === 'alcohol'
        ? 'Sobald Einheiten erfasst sind, erkennt die App typische Alkohol-Zeitfenster.'
        : 'Sobald Zigaretten erfasst sind, erkennt die App typische Rauch-Zeitfenster.';
    }
    const label = mode === 'alcohol' ? 'Einheiten' : 'Zigaretten';
    return `Peak um ${hourLabel(model.peak)} · typisches Fenster ${windowLabel(model)} · ${events.length} ${label} in ${LOOKBACK_DAYS} Tagen.`;
  }

  function cardHtml(mode, state) {
    const events = eventsForMode(state, mode);
    const model = analyze(events);
    const activeDays = Math.max(1, model.activeDays || 0);
    const average = events.length ? (events.length / activeDays).toFixed(events.length / activeDays >= 10 ? 1 : 2).replace(/\.00$/, '').replace(/\.0$/, '') : '0';
    const isAlcohol = mode === 'alcohol';
    const title = isAlcohol ? 'Zeitprofil Alkohol' : 'Zeitprofil Rauchen';
    const unit = isAlcohol ? 'Einheiten' : 'Zigaretten';
    const count = events.length ? `${events.length} ${unit}` : 'lernt';
    return `<article class="hf-time-profile-card ${isAlcohol ? 'is-alcohol' : 'is-smoke'}" id="hfTimeProfile-${mode}">
      <div class="hf-time-profile-head">
        <div><p class="eyebrow">Zeitverteilung</p><h4>${title}</h4></div>
        <span class="badge muted">${count}</span>
      </div>
      <div class="hf-time-profile-stage">
        ${buildSvg(model, mode)}
        <div class="hf-time-axis"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span></div>
      </div>
      <div class="hf-time-profile-stats">
        <span><small>Peak</small><strong>${events.length ? hourLabel(model.peak) : '–'}</strong></span>
        <span><small>Fenster</small><strong>${events.length ? windowLabel(model) : '–'}</strong></span>
        <span><small>Ø aktiver Tag</small><strong>${average}</strong></span>
      </div>
      <p>${insightText(mode, events, model)}</p>
    </article>`;
  }

  function injectStyle(document) {
    if (!document || document.getElementById('hf-time-profile-style')) return;
    const style = document.createElement('style');
    style.id = 'hf-time-profile-style';
    style.textContent = `
      .hf-time-profile-card{--hf-time-tone:rgba(74,215,209,.72);--hf-time-soft:rgba(74,215,209,.03);--hf-time-strong:rgba(143,240,167,.82);display:grid;gap:14px;margin:0 0 14px;padding:16px;border-radius:26px;background:linear-gradient(180deg,rgba(255,255,255,.065),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.08);box-shadow:0 18px 44px rgba(0,0,0,.08);overflow:hidden}.hf-time-profile-card.is-alcohol{--hf-time-tone:rgba(125,170,255,.7);--hf-time-soft:rgba(74,215,209,.025);--hf-time-strong:rgba(182,152,255,.86)}.hf-time-profile-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.hf-time-profile-head h4{margin:3px 0 0;font-size:1.02rem;letter-spacing:-.02em}.hf-time-profile-stage{position:relative;min-height:136px;padding:10px 0 0;border-radius:24px;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.018));border:1px solid rgba(255,255,255,.055);overflow:hidden}.hf-time-profile-svg{width:100%;height:110px;display:block;filter:drop-shadow(0 18px 22px rgba(74,215,209,.08))}.hf-time-midline{stroke:rgba(74,215,209,.24);stroke-width:.5}.hf-time-area{opacity:.92}.hf-time-peak-line{stroke:rgba(9,18,30,.78);stroke-width:.72;vector-effect:non-scaling-stroke}.hf-time-peak-dot{fill:#8ff0a7;stroke:rgba(9,18,30,.32);stroke-width:.7;vector-effect:non-scaling-stroke}.hf-time-axis{display:grid;grid-template-columns:repeat(5,1fr);padding:0 12px 12px;color:var(--muted);font-size:.72rem;font-weight:640;letter-spacing:-.01em}.hf-time-axis span{text-align:center}.hf-time-axis span:first-child{text-align:left}.hf-time-axis span:last-child{text-align:right}.hf-time-profile-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.hf-time-profile-stats span{padding:10px 11px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.055)}.hf-time-profile-stats small{display:block;color:var(--muted);font-size:.64rem;text-transform:uppercase;letter-spacing:.08em;font-weight:640;margin-bottom:4px}.hf-time-profile-stats strong{font-size:.9rem;font-weight:720;letter-spacing:-.02em;white-space:nowrap}.hf-time-profile-card p{margin:0;color:var(--muted);font-size:.86rem;line-height:1.45}body.light .hf-time-profile-card{background:rgba(255,255,255,.78);border-color:rgba(17,36,58,.08);box-shadow:0 18px 36px rgba(17,36,58,.06)}body.light .hf-time-profile-stage,body.light .hf-time-profile-stats span{background:rgba(255,255,255,.66);border-color:rgba(17,36,58,.07)}body.light .hf-time-peak-line{stroke:rgba(17,36,58,.82)}@media (max-width:760px){.hf-time-profile-card{padding:14px;border-radius:23px;margin-bottom:12px;gap:12px}.hf-time-profile-stage{min-height:124px;border-radius:21px}.hf-time-profile-svg{height:98px}.hf-time-profile-stats{grid-template-columns:1fr}.hf-time-profile-stats span{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px}.hf-time-profile-stats small{margin:0}.hf-time-profile-head h4{font-size:.98rem}}
    `;
    document.head.appendChild(style);
  }

  function upsertCard(targetId, mode, state) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const existing = document.getElementById(`hfTimeProfile-${mode}`);
    const nextHtml = cardHtml(mode, state);
    if (existing) {
      existing.outerHTML = nextHtml;
    } else {
      target.insertAdjacentHTML('afterbegin', nextHtml);
    }
  }

  function renderTimeProfiles() {
    const state = readState();
    if (!state) return;
    injectStyle(document);
    upsertCard('smokeIntervalVisual', 'smoke', state);
    upsertCard('alcoholIntervalVisual', 'alcohol', state);
  }

  function scheduleRender(delay = 120) {
    window.setTimeout(renderTimeProfiles, delay);
  }

  function startTimeProfiles() {
    injectStyle(document);
    renderDelays.forEach(scheduleRender);
    window.addEventListener('focus', () => scheduleRender(160));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleRender(160); });
    document.addEventListener('click', event => {
      const action = event.target?.closest?.('[data-action]')?.dataset?.action || '';
      if (/record|log|switch-consumption-mode|delete|save/i.test(action)) scheduleRender(650);
    }, true);
    window.setInterval(renderTimeProfiles, 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startTimeProfiles, { once: true });
  else startTimeProfiles();

  modules.register('consumption', {
    description: 'Consumption domain boundary for smoking, alcohol, pauses, craving coach and deep analytics.',
    modes: Object.freeze(['smoke', 'alcohol']),
    dataTables: Object.freeze(['cigarette_events', 'alcohol_logs', 'alcohol_events', 'pause_periods']),
    migrationMode: 'preserve quick capture and analytics while moving pure calculations first',
    uiPatch: Object.freeze({
      timeDistributionInIntervalIntelligence: true,
      timeDistributionInAlcoholIntelligence: true,
      lookbackDays: LOOKBACK_DAYS
    })
  });
})(window);
