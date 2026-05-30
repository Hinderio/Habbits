(function registerHabitFlowConsumptionModule(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('consumption')) return;

  const STORAGE_KEY = 'habitflow-state-v1';
  const LOOKBACK_DAYS = 120;
  let renderTimer = null;

  function readState() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      console.warn('[HabitFlow/consumption] Could not read local state for time distribution.', error);
      return null;
    }
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function eventDate(item, type) {
    const value = type === 'alcohol'
      ? (item.occurred_at || item.created_at || item.updated_at)
      : (item.smoked_at || item.occurred_at || item.created_at || item.updated_at);
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function eventsForType(state, type) {
    const source = type === 'alcohol'
      ? safeArray(state?.alcoholUnits).concat(safeArray(state?.alcoholEvents))
      : safeArray(state?.cigarettes);
    const since = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
    return source
      .map(item => ({ item, date: eventDate(item, type) }))
      .filter(entry => entry.date && entry.date.getTime() >= since)
      .sort((a, b) => a.date - b.date);
  }

  function smoothBins(bins) {
    return bins.map((value, index) => {
      const prev = bins[(index + bins.length - 1) % bins.length];
      const next = bins[(index + 1) % bins.length];
      return value * 0.58 + prev * 0.21 + next * 0.21;
    });
  }

  function distributionFor(events) {
    const bins = Array.from({ length: 24 }, () => 0);
    const activeDays = new Set();
    events.forEach(({ date }) => {
      bins[date.getHours()] += 1;
      activeDays.add(date.toISOString().slice(0, 10));
    });
    const smooth = smoothBins(bins);
    const max = Math.max(1, ...smooth);
    const peakIndex = smooth.reduce((best, value, index) => value > smooth[best] ? index : best, 0);
    const threshold = Math.max(0.8, max * 0.42);
    let start = peakIndex;
    let end = peakIndex;
    while (start > 0 && smooth[start - 1] >= threshold) start -= 1;
    while (end < smooth.length - 1 && smooth[end + 1] >= threshold) end += 1;
    return { bins, smooth, max, peakIndex, start, end, activeDays: activeDays.size };
  }

  function hourLabel(hour) {
    const normalized = ((Math.round(hour) % 24) + 24) % 24;
    return `${String(normalized).padStart(2, '0')}:00`;
  }

  function windowLabel(distribution) {
    if (!distribution) return 'noch offen';
    if (distribution.start === distribution.end) return `${hourLabel(distribution.peakIndex)} ± 1h`;
    return `${hourLabel(distribution.start)} – ${hourLabel(distribution.end + 1)}`;
  }

  function svgArea(distribution, tone) {
    const center = 34;
    const maxHeight = 22;
    const points = Array.from({ length: 25 }, (_, index) => {
      const sourceIndex = Math.min(23, index);
      const value = distribution.smooth[sourceIndex] || 0;
      const x = (index / 24) * 100;
      const h = Math.max(1.2, (value / distribution.max) * maxHeight);
      return { x, top: center - h, bottom: center + h };
    });
    const topPath = points.map(point => `${point.x.toFixed(2)},${point.top.toFixed(2)}`).join(' L ');
    const bottomPath = [...points].reverse().map(point => `${point.x.toFixed(2)},${point.bottom.toFixed(2)}`).join(' L ');
    const path = `M ${topPath} L ${bottomPath} Z`;
    const peakX = ((distribution.peakIndex + 0.5) / 24) * 100;
    const markerY = center - Math.max(1.2, ((distribution.smooth[distribution.peakIndex] || 0) / distribution.max) * maxHeight);
    const gradientId = `timeDistributionGradient-${tone}`;
    return `<svg class="time-distribution-svg" viewBox="0 0 100 72" preserveAspectRatio="none" role="img" aria-label="Zeitliche Konsumverteilung">
      <defs><linearGradient id="${gradientId}" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stop-color="var(--time-tone-soft)"/><stop offset="72%" stop-color="var(--time-tone)"/><stop offset="100%" stop-color="var(--time-tone-strong)"/></linearGradient></defs>
      <line class="time-distribution-midline" x1="0" y1="34" x2="100" y2="34"></line>
      <path class="time-distribution-area" d="${path}" fill="url(#${gradientId})"></path>
      <line class="time-distribution-peak-line" x1="${peakX.toFixed(2)}" y1="4" x2="${peakX.toFixed(2)}" y2="66"></line>
      <circle class="time-distribution-peak-dot" cx="${peakX.toFixed(2)}" cy="${markerY.toFixed(2)}" r="1.9"></circle>
    </svg>`;
  }

  function buildInsight(type, events, distribution) {
    if (!events.length) {
      return type === 'alcohol'
        ? 'Sobald Alkoholeinheiten erfasst sind, erkennt die App typische Zeitfenster.'
        : 'Sobald Zigaretten erfasst sind, wird dein typisches Tagesfenster sichtbar.';
    }
    const noun = type === 'alcohol' ? 'Einheiten' : 'Zigaretten';
    const peak = hourLabel(distribution.peakIndex);
    const windowText = windowLabel(distribution);
    return `Peak um ${peak}. Der Schwerpunkt liegt aktuell bei ${windowText} · ${events.length} ${noun} in ${LOOKBACK_DAYS} Tagen.`;
  }

  function buildCard(type, state) {
    const events = eventsForType(state, type);
    const distribution = distributionFor(events);
    const activeDays = Math.max(1, distribution.activeDays || 0);
    const average = events.length ? (events.length / activeDays).toFixed(events.length / activeDays >= 10 ? 1 : 2).replace(/\.00$/, '') : '0';
    const tone = type === 'alcohol' ? 'alcohol' : 'smoke';
    const title = type === 'alcohol' ? 'Zeitprofil Alkohol' : 'Zeitprofil Rauchen';
    const unit = type === 'alcohol' ? 'Einheiten' : 'Zigaretten';
    const badge = events.length ? `${events.length} ${unit}` : 'lernt';
    return `<article class="time-distribution-card is-${tone}" data-consumption-time-distribution="${type}">
      <div class="time-distribution-head">
        <div><p class="eyebrow">Zeitverteilung</p><h4>${title}</h4></div>
        <span class="badge muted">${badge}</span>
      </div>
      <div class="time-distribution-stage">
        ${svgArea(distribution, tone)}
        <div class="time-distribution-axis"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span></div>
      </div>
      <div class="time-distribution-stats">
        <span><small>Peak</small><strong>${events.length ? hourLabel(distribution.peakIndex) : '–'}</strong></span>
        <span><small>Fenster</small><strong>${events.length ? windowLabel(distribution) : '–'}</strong></span>
        <span><small>Ø aktiver Tag</small><strong>${average}</strong></span>
      </div>
      <p>${buildInsight(type, events, distribution)}</p>
    </article>`;
  }

  function injectStyle(document) {
    if (!document || document.getElementById('habitflow-consumption-time-distribution-style')) return;
    const style = document.createElement('style');
    style.id = 'habitflow-consumption-time-distribution-style';
    style.textContent = `
      .time-distribution-card{
        --time-tone:#4ad7d1;
        --time-tone-soft:rgba(74,215,209,.04);
        --time-tone-strong:rgba(143,240,167,.82);
        display:grid;
        gap:14px;
        padding:16px;
        margin-bottom:14px;
        border-radius:26px;
        background:linear-gradient(180deg,rgba(255,255,255,.065),rgba(255,255,255,.035));
        border:1px solid rgba(255,255,255,.08);
        box-shadow:0 18px 44px rgba(0,0,0,.08);
        overflow:hidden;
      }
      .time-distribution-card.is-alcohol{
        --time-tone:#b698ff;
        --time-tone-soft:rgba(74,215,209,.03);
        --time-tone-strong:rgba(182,152,255,.86);
      }
      .time-distribution-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .time-distribution-head h4{margin:3px 0 0;font-size:1.02rem;letter-spacing:-.02em}
      .time-distribution-stage{position:relative;min-height:138px;padding:10px 0 0;border-radius:24px;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.018));border:1px solid rgba(255,255,255,.055);overflow:hidden}
      .time-distribution-svg{width:100%;height:112px;display:block;filter:drop-shadow(0 18px 22px rgba(74,215,209,.08))}
      .time-distribution-midline{stroke:rgba(74,215,209,.26);stroke-width:.5}
      .time-distribution-area{opacity:.9}
      .time-distribution-peak-line{stroke:rgba(9,18,30,.82);stroke-width:.72;vector-effect:non-scaling-stroke}
      .time-distribution-peak-dot{fill:#8ff0a7;stroke:rgba(9,18,30,.34);stroke-width:.7;vector-effect:non-scaling-stroke}
      .time-distribution-axis{display:grid;grid-template-columns:repeat(5,1fr);gap:0;padding:0 12px 12px;color:var(--muted);font-size:.72rem;font-weight:720;letter-spacing:-.01em}
      .time-distribution-axis span{text-align:center}.time-distribution-axis span:first-child{text-align:left}.time-distribution-axis span:last-child{text-align:right}
      .time-distribution-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .time-distribution-stats span{padding:10px 11px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.055)}
      .time-distribution-stats small{display:block;color:var(--muted);font-size:.64rem;text-transform:uppercase;letter-spacing:.08em;font-weight:720;margin-bottom:4px}
      .time-distribution-stats strong{font-size:.9rem;font-weight:760;letter-spacing:-.02em;white-space:nowrap}
      .time-distribution-card p{margin:0;color:var(--muted);font-size:.86rem;line-height:1.45}
      body.light .time-distribution-card{background:rgba(255,255,255,.78);border-color:rgba(17,36,58,.08);box-shadow:0 18px 36px rgba(17,36,58,.06)}
      body.light .time-distribution-stage,body.light .time-distribution-stats span{background:rgba(255,255,255,.66);border-color:rgba(17,36,58,.07)}
      body.light .time-distribution-peak-line{stroke:rgba(17,36,58,.82)}
      @media (max-width:760px){
        .time-distribution-card{padding:14px;border-radius:23px;margin-bottom:12px;gap:12px}
        .time-distribution-stage{min-height:126px;border-radius:21px}
        .time-distribution-svg{height:100px}
        .time-distribution-stats{grid-template-columns:1fr}
        .time-distribution-stats span{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px}
        .time-distribution-stats small{margin:0}.time-distribution-head h4{font-size:.98rem}
      }
    `;
    document.head.appendChild(style);
  }

  function upsertDistribution(type, targetId, state) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const events = eventsForType(state, type);
    const last = events.length ? events[events.length - 1].date.getTime() : 0;
    const signature = `${type}:${events.length}:${last}`;
    const selector = `[data-consumption-time-distribution="${type}"]`;
    const existing = target.querySelector(selector);
    if (existing?.dataset.signature === signature) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildCard(type, state).trim();
    const card = wrapper.firstElementChild;
    card.dataset.signature = signature;
    if (existing) existing.replaceWith(card);
    else target.prepend(card);
  }

  function renderTimeDistributions() {
    injectStyle(window.document);
    const state = readState();
    if (!state) return;
    upsertDistribution('smoke', 'smokeIntervalVisual', state);
    upsertDistribution('alcohol', 'alcoholIntervalVisual', state);
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderTimeDistributions, 120);
  }

  function startTimeDistributionUi() {
    injectStyle(window.document);
    scheduleRender();
    window.addEventListener('focus', scheduleRender);
    window.addEventListener('visibilitychange', () => {
      if (!document.hidden) scheduleRender();
    });
    window.setInterval(scheduleRender, 20000);
    const root = document.getElementById('screen-smoking') || document.body;
    if (root) {
      const observer = new MutationObserver(scheduleRender);
      observer.observe(root, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startTimeDistributionUi, { once: true });
  else startTimeDistributionUi();

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
