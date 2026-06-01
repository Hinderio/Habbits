(function initHabitFlowConsumptionYearOverview(window) {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const TARGETS = Object.freeze({ smoke: 'cigaretteHeatmapVisual', alcohol: 'alcoholHeatmapVisual' });
  const MONTHS = 12;
  const observedTargets = new WeakSet();
  let renderTimer = null;
  let isRendering = false;

  function safeArray(value) { return Array.isArray(value) ? value : []; }

  function escapeHtml(value = '') {
    return String(value || '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  function readState() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      console.warn('[HabitFlow/consumption-year] state read failed', error);
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
    return source.map(item => eventDate(item, mode)).filter(Boolean).sort((a, b) => a - b);
  }

  function toLocalDateKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function monthLabel(monthIndex) {
    return new Intl.DateTimeFormat('de-CH', { month: 'short' }).format(new Date(2026, monthIndex, 1)).replace('.', '');
  }

  function modeMeta(mode) {
    return mode === 'alcohol'
      ? { label: 'Alkohol', unit: 'Einheit', unitPlural: 'Einheiten' }
      : { label: 'Rauchen', unit: 'Zigarette', unitPlural: 'Zigaretten' };
  }

  function levelForCount(count, maxCount) {
    if (!count) return 0;
    return Math.max(1, Math.ceil((count / Math.max(1, maxCount)) * 5));
  }

  function buildDailyCounts(events, year) {
    const counts = new Map();
    events.forEach(date => {
      if (date.getFullYear() !== year) return;
      const key = toLocalDateKey(date);
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }

  function buildMonth(monthIndex, year, dailyCounts, maxDayCount, mode) {
    const meta = modeMeta(mode);
    const dayCount = daysInMonth(year, monthIndex);
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;
    const days = Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(year, monthIndex, index + 1, 12);
      const key = toLocalDateKey(date);
      const count = dailyCounts.get(key) || 0;
      const level = levelForCount(count, maxDayCount);
      return { key, day: index + 1, count, level };
    });
    const total = days.reduce((sum, day) => sum + day.count, 0);
    const activeDays = days.filter(day => day.count > 0).length;
    const dotMarkup = days.map(day => {
      const title = `${day.key} · ${day.count} ${day.count === 1 ? meta.unit : meta.unitPlural}`;
      return `<span class="hf-year-dot level-${day.level}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"></span>`;
    }).join('');

    return `<article class="hf-consumption-month ${isCurrentMonth ? 'is-current' : ''}" title="${escapeHtml(`${monthLabel(monthIndex)} ${year}: ${total} ${total === 1 ? meta.unit : meta.unitPlural}`)}">
      <div class="hf-consumption-month-head"><strong>${escapeHtml(monthLabel(monthIndex))}</strong><small>${total}×</small></div>
      <div class="hf-consumption-month-dots" style="--hf-days:${dayCount}">${dotMarkup}</div>
      <span>${activeDays ? `${activeDays} aktive Tage` : 'ruhig'}</span>
    </article>`;
  }

  function buildOverview(mode, state) {
    const meta = modeMeta(mode);
    const year = new Date().getFullYear();
    const events = eventsForMode(state, mode);
    const dailyCounts = buildDailyCounts(events, year);
    const dayValues = Array.from(dailyCounts.values());
    const maxDayCount = Math.max(...dayValues, 1);
    const total = dayValues.reduce((sum, count) => sum + count, 0);
    const activeDays = dayValues.length;
    const averagePerActiveDay = activeDays ? (total / activeDays).toFixed(1).replace('.', ',') : '0';
    const peak = Array.from(dailyCounts.entries()).sort((a, b) => b[1] - a[1])[0] || null;
    const peakLabel = peak ? `${peak[0].slice(8, 10)}.${peak[0].slice(5, 7)} · ${peak[1]}×` : '–';
    const months = Array.from({ length: MONTHS }, (_, monthIndex) => buildMonth(monthIndex, year, dailyCounts, maxDayCount, mode)).join('');
    const emptyCopy = total
      ? `Jeder Dot ist ein Kalendertag. Je stärker die Farbe, desto mehr ${meta.unitPlural.toLowerCase()} an diesem Tag.`
      : `Noch keine ${meta.unitPlural.toLowerCase()} im laufenden Jahr. Die Übersicht füllt sich automatisch mit jedem Log.`;

    return `<section class="hf-consumption-year-card" id="hfConsumptionYear-${mode}" data-hf-year-overview="${mode}">
      <div class="hf-consumption-year-head">
        <div><p class="eyebrow">Jahresübersicht</p><h4>${escapeHtml(meta.label)} ${year}</h4></div>
        <span class="badge muted">${total} ${total === 1 ? meta.unit : meta.unitPlural}</span>
      </div>
      <div class="hf-consumption-year-stats">
        <article><small>Gesamt</small><strong>${total}×</strong></article>
        <article><small>Aktive Tage</small><strong>${activeDays}</strong></article>
        <article><small>Ø aktiv</small><strong>${averagePerActiveDay}</strong></article>
        <article><small>Peak</small><strong>${escapeHtml(peakLabel)}</strong></article>
      </div>
      <div class="hf-consumption-year-grid" aria-label="${escapeHtml(`${meta.label} Jahresübersicht nach Monaten und Tagen`)}">${months}</div>
      <p>${escapeHtml(emptyCopy)}</p>
    </section>`;
  }

  function signatureFor(mode, state) {
    const year = new Date().getFullYear();
    const events = eventsForMode(state, mode).filter(date => date.getFullYear() === year);
    const last = events.length ? events[events.length - 1].getTime() : 0;
    return `${mode}:${year}:${events.length}:${last}`;
  }

  function upsertOverview(targetId, mode, state) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const signature = signatureFor(mode, state);
    const existing = target.querySelector(`[data-hf-year-overview="${mode}"]`);
    if (existing?.dataset?.signature === signature) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildOverview(mode, state).trim();
    const card = wrapper.firstElementChild;
    card.dataset.signature = signature;

    if (existing) {
      existing.replaceWith(card);
      return;
    }

    const legend = target.querySelector('.smoke-hour-legend');
    if (legend?.after) legend.after(card);
    else target.appendChild(card);
  }

  function observeTarget(target) {
    if (!target || observedTargets.has(target)) return;
    observedTargets.add(target);
    const observer = new MutationObserver(() => {
      if (!isRendering && !target.querySelector('[data-hf-year-overview]')) scheduleRender(90);
    });
    observer.observe(target, { childList: true });
  }

  function renderYearOverviews() {
    const state = readState();
    if (!state) return;
    isRendering = true;
    try {
      injectStyle(document);
      upsertOverview(TARGETS.smoke, 'smoke', state);
      upsertOverview(TARGETS.alcohol, 'alcohol', state);
      Object.values(TARGETS).forEach(id => observeTarget(document.getElementById(id)));
    } finally {
      window.setTimeout(() => { isRendering = false; }, 0);
    }
  }

  function scheduleRender(delay = 140) {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(renderYearOverviews, delay);
  }

  function injectStyle(document) {
    if (!document || document.getElementById('hf-consumption-year-style')) return;
    const style = document.createElement('style');
    style.id = 'hf-consumption-year-style';
    style.textContent = `
      #screen-smoking .smoke-week-cell.level-1,#screen-smoking .smoke-hour-legend i.level-1{background:#d2f6dc!important;border-color:#abeebb!important;color:#0d1827!important;opacity:1!important;}
      #screen-smoking .smoke-week-cell.level-2,#screen-smoking .smoke-hour-legend i.level-2{background:#bdeeed!important;border-color:#8de2df!important;color:#0d1827!important;opacity:1!important;}
      #screen-smoking .smoke-week-cell.level-3,#screen-smoking .smoke-hour-legend i.level-3{background:#cbd8e2!important;border-color:#aebfce!important;color:#0d1827!important;opacity:1!important;}
      #screen-smoking .smoke-week-cell.level-4,#screen-smoking .smoke-hour-legend i.level-4{background:#ffdda8!important;border-color:#ffc96b!important;color:#0d1827!important;opacity:1!important;}
      #screen-smoking .smoke-week-cell.level-5,#screen-smoking .smoke-hour-legend i.level-5{background:#ffb8b8!important;border-color:#ff8d8d!important;color:#0d1827!important;opacity:1!important;}
      #screen-smoking .smoke-week-cell[class*="level-"]{box-shadow:inset 0 1px 0 rgba(255,255,255,.5)!important;}
      #screen-smoking .smoke-week-cell[class*="level-"] em{color:#0d1827!important;}
      .hf-consumption-year-card{display:grid;gap:12px;margin:13px 0 12px;padding:14px;border-radius:26px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.07);box-shadow:inset 0 1px 0 rgba(255,255,255,.05);}
      .hf-consumption-year-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
      .hf-consumption-year-head h4{margin:2px 0 0;font-size:1.05rem;letter-spacing:-.025em;}
      .hf-consumption-year-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}
      .hf-consumption-year-stats article{min-height:66px;padding:10px 11px;border-radius:18px;background:rgba(255,255,255,.052);border:1px solid rgba(255,255,255,.065);display:grid;align-content:space-between;}
      .hf-consumption-year-stats small{color:var(--muted);font-size:.64rem;font-weight:900;text-transform:uppercase;letter-spacing:.09em;}
      .hf-consumption-year-stats strong{font-size:1rem;letter-spacing:-.025em;white-space:nowrap;}
      .hf-consumption-year-grid{width:min(100%,640px);aspect-ratio:1 / 1;justify-self:center;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(4,minmax(0,1fr));gap:10px;}
      .hf-consumption-month{min-width:0;min-height:0;padding:10px;border-radius:18px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.055);display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:7px;overflow:hidden;}
      .hf-consumption-month.is-current{border-color:#4ad7d1;box-shadow:0 0 0 2px rgba(74,215,209,.12);}
      .hf-consumption-month-head{display:flex;align-items:center;justify-content:space-between;gap:6px;}
      .hf-consumption-month-head strong{font-size:.72rem;line-height:1;font-weight:950;text-transform:uppercase;letter-spacing:.06em;}
      .hf-consumption-month-head small,.hf-consumption-month>span{color:var(--muted);font-size:.64rem;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .hf-consumption-month-dots{display:grid;grid-template-columns:repeat(7,6px);grid-auto-rows:6px;gap:4px;align-content:center;justify-content:center;min-height:0;}
      .hf-year-dot{width:6px;height:6px;border-radius:999px;background:rgba(157,176,195,.18);}
      .hf-year-dot.level-1{background:#d2f6dc;}
      .hf-year-dot.level-2{background:#bdeeed;}
      .hf-year-dot.level-3{background:#cbd8e2;}
      .hf-year-dot.level-4{background:#ffdda8;}
      .hf-year-dot.level-5{background:#ffb8b8;}
      .hf-consumption-year-card p{margin:0;color:var(--muted);font-size:.86rem;line-height:1.45;}
      body.light .hf-consumption-year-card,body.light .hf-consumption-year-stats article,body.light .hf-consumption-month{background:rgba(255,255,255,.72);border-color:rgba(17,36,58,.08);}
      body.light .hf-year-dot{background:rgba(95,112,130,.16);}
      body.light .hf-year-dot.level-1{background:#d2f6dc;}body.light .hf-year-dot.level-2{background:#bdeeed;}body.light .hf-year-dot.level-3{background:#cbd8e2;}body.light .hf-year-dot.level-4{background:#ffdda8;}body.light .hf-year-dot.level-5{background:#ffb8b8;}
      @media (max-width:980px){.hf-consumption-year-grid{width:min(100%,560px);}.hf-consumption-year-stats{grid-template-columns:repeat(2,minmax(0,1fr));}}
      @media (max-width:520px){.hf-consumption-year-card{padding:12px;border-radius:22px;}.hf-consumption-year-grid{width:100%;gap:7px;}.hf-consumption-month{padding:8px;border-radius:16px;gap:5px;}.hf-consumption-month-dots{grid-template-columns:repeat(7,4px);grid-auto-rows:4px;gap:3px;}.hf-year-dot{width:4px;height:4px;}.hf-consumption-year-head{flex-direction:column;}.hf-consumption-year-head .badge{align-self:flex-start;}}
    `;
    document.head.appendChild(style);
  }

  function start() {
    injectStyle(document);
    [220, 800, 1800, 3600].forEach(delay => window.setTimeout(renderYearOverviews, delay));
    window.addEventListener('focus', () => scheduleRender(120));
    window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) scheduleRender(160); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleRender(120); });
    document.addEventListener('click', event => {
      const action = event.target?.closest?.('[data-action]')?.dataset?.action || '';
      if (action.includes('record') || action.includes('log') || action.includes('delete') || action.includes('switch-consumption-mode')) scheduleRender(520);
    }, true);
    window.setInterval(() => scheduleRender(0), 45000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(window);
