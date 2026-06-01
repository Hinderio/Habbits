(function registerHabitFlowSmokingDomain(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('smoking-domain')) return;

  const MIN_SLEEP_BRIDGE_MINUTES = 240;
  const SLEEP_START_HOUR = 23;
  const SLEEP_END_HOUR = 7;

  function toDate(value) {
    const date = value instanceof Date ? value : new Date(value || 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function minutesBetween(startValue, endValue) {
    const start = toDate(startValue);
    const end = toDate(endValue);
    if (!start || !end || end <= start) return null;
    return Math.max(0, Math.round((end - start) / 60000));
  }

  function sleepWindowForDate(value) {
    const start = toDate(value) || new Date();
    start.setHours(SLEEP_START_HOUR, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setHours(SLEEP_END_HOUR, 0, 0, 0);
    return { start, end };
  }

  function sleepMinutesBetween(startValue, endValue) {
    const start = toDate(startValue);
    const end = toDate(endValue);
    if (!start || !end || end <= start) return 0;
    let total = 0;
    const cursor = new Date(start);
    cursor.setDate(cursor.getDate() - 1);
    cursor.setHours(12, 0, 0, 0);
    for (let guard = 0; guard < 10 && cursor.getTime() <= end.getTime() + 86400000; guard += 1) {
      const range = sleepWindowForDate(cursor);
      const overlapStart = Math.max(start.getTime(), range.start.getTime());
      const overlapEnd = Math.min(end.getTime(), range.end.getTime());
      if (overlapEnd > overlapStart) total += Math.round((overlapEnd - overlapStart) / 60000);
      cursor.setDate(cursor.getDate() + 1);
    }
    return total;
  }

  function isMorningAfterSleep(endValue) {
    const end = toDate(endValue);
    if (!end) return false;
    return end.getHours() >= 5 && end.getHours() < 12;
  }

  function scoreInterval(previousValue, currentValue) {
    const interval = minutesBetween(previousValue, currentValue);
    if (interval == null) {
      return Object.freeze({
        intervalMinutes: null,
        scoringIntervalMinutes: null,
        sleepDeductedMinutes: 0,
        sleepBridge: false,
        points: 0,
        reason: 'Erste Zigarette erfasst'
      });
    }
    const sleep = sleepMinutesBetween(previousValue, currentValue);
    const sleepBridge = interval >= MIN_SLEEP_BRIDGE_MINUTES && sleep >= MIN_SLEEP_BRIDGE_MINUTES && isMorningAfterSleep(currentValue);
    const scoringInterval = sleepBridge ? Math.max(0, interval - sleep) : interval;
    const points = pointsForScoringInterval(scoringInterval, { sleepBridge });
    return Object.freeze({
      intervalMinutes: interval,
      scoringIntervalMinutes: scoringInterval,
      sleepDeductedMinutes: sleepBridge ? sleep : 0,
      sleepBridge,
      points,
      reason: reasonForPoints(points, { sleepBridge, scoringInterval, sleepMinutes: sleep })
    });
  }

  function pointsForScoringInterval(minutes, options = {}) {
    if (minutes == null) return 0;
    const repeatBonus = options.consecutiveRecoveryBonus ? 10 : 0;
    let base = 100;
    if (options.sleepBridge && minutes < 30) base = 0;
    else if (minutes < 30) base = -40;
    else if (minutes < 60) base = -20;
    else if (minutes < 120) base = 0;
    else if (minutes < 240) base = 20;
    else if (minutes < 480) base = 60;
    return base + repeatBonus;
  }

  function reasonForPoints(points, options = {}) {
    const suffix = options.consecutiveRecoveryBonus ? ' · Folgepause' : '';
    if (options.sleepBridge) return `Rauchpause: Schlafzeit neutralisiert${suffix}`;
    if (points >= 100) return `Rauchpause: 8+ Stunden${suffix}`;
    if (points >= 60) return `Rauchpause: 4–8 Stunden${suffix}`;
    if (points >= 20) return `Rauchpause: 2–4 Stunden${suffix}`;
    if (points < 0) return 'Rauchabstand zu kurz';
    return `Rauchpause: neutral${suffix}`;
  }

  function sortEvents(events, direction = 'asc') {
    const rows = (Array.isArray(events) ? events : [])
      .filter(event => event && !event.deleted_at)
      .slice()
      .sort((a, b) => new Date(a.smoked_at || a.created_at || 0) - new Date(b.smoked_at || b.created_at || 0));
    return direction === 'desc' ? rows.reverse() : rows;
  }

  function recalculateEvents(events) {
    const rows = sortEvents(events, 'asc');
    return rows.map((event, index) => {
      const previous = index > 0 ? rows[index - 1] : null;
      const score = previous ? scoreInterval(previous.smoked_at || previous.created_at, event.smoked_at || event.created_at) : scoreInterval(null, event.smoked_at || event.created_at);
      return Object.assign({}, event, {
        interval_minutes: score.intervalMinutes,
        scoring_interval_minutes: score.scoringIntervalMinutes,
        scoring_sleep_deducted_minutes: score.sleepDeductedMinutes,
        points: score.points
      });
    });
  }

  const api = Object.freeze({
    MIN_SLEEP_BRIDGE_MINUTES,
    minutesBetween,
    sleepMinutesBetween,
    scoreInterval,
    pointsForScoringInterval,
    reasonForPoints,
    sortEvents,
    recalculateEvents
  });

  window.HabitFlowDomains = window.HabitFlowDomains || {};
  window.HabitFlowDomains.smoking = api;

  modules.register('smoking-domain', {
    description: 'Pure smoking interval and point scoring domain. Keeps sleep-aware scoring separate from UI and sync.',
    exports: Object.freeze(['scoreInterval', 'recalculateEvents', 'pointsForScoringInterval'])
  });
})(window);

(function enhanceSmokeIntervalStrikes(window, document) {
  'use strict';

  const STYLE_ID = 'smokeIntervalStrikeStyles';
  const VISUAL_SELECTOR = '#smokeIntervalVisual';
  const BAR_SELECTOR = '.interval-skyline-bar';

  function injectStrikeStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #smokeIntervalVisual .smoke-strike-grid{grid-template-columns:repeat(2,minmax(0,1fr));margin:14px 0 4px;}
      #smokeIntervalVisual .smoke-strike-card{position:relative;overflow:hidden;}
      #smokeIntervalVisual .smoke-strike-card:after{content:"";position:absolute;inset:auto 14px 12px auto;width:54px;height:54px;border-radius:50%;background:rgba(100,208,203,.14);pointer-events:none;}
      #smokeIntervalVisual .smoke-strike-card strong{font-size:clamp(1.75rem,4vw,2.45rem);letter-spacing:-.06em;}
      #smokeIntervalVisual .smoke-strike-card small{color:var(--muted);}
      #smokeIntervalVisual .smoke-strike-card.is-current{border-color:rgba(100,208,203,.24);background:linear-gradient(135deg,rgba(100,208,203,.12),rgba(255,255,255,.045));}
      body.light #smokeIntervalVisual .smoke-strike-card.is-current{background:linear-gradient(135deg,rgba(100,208,203,.16),rgba(255,255,255,.78));}
    `;
    document.head.appendChild(style);
  }

  function isStrikeBar(bar) {
    return Boolean(bar && !bar.classList.contains('is-critical') && !bar.classList.contains('is-warning'));
  }

  function buildStrikeStats(bars) {
    let best = 0;
    let run = 0;
    let current = 0;
    bars.forEach(bar => {
      if (isStrikeBar(bar)) {
        run += 1;
        best = Math.max(best, run);
      } else {
        run = 0;
      }
    });
    for (let index = bars.length - 1; index >= 0; index -= 1) {
      if (!isStrikeBar(bars[index])) break;
      current += 1;
    }
    return { best, current, total: bars.length };
  }

  function strikeSignature(bars) {
    return bars.map(bar => isStrikeBar(bar) ? '1' : '0').join('');
  }

  function renderStrikeCards() {
    const visual = document.querySelector(VISUAL_SELECTOR);
    if (!visual) return;
    const skyline = visual.querySelector('.interval-skyline');
    if (!skyline) return;
    const bars = Array.from(skyline.querySelectorAll(BAR_SELECTOR));
    const existing = visual.querySelector('.smoke-strike-grid');
    if (!bars.length) {
      if (existing) existing.remove();
      return;
    }
    const signature = strikeSignature(bars);
    if (existing && existing.dataset.strikeSignature === signature) return;
    const stats = buildStrikeStats(bars);
    const strikeGrid = document.createElement('div');
    strikeGrid.className = 'smoke-strike-grid smoking-visual-summary-grid';
    strikeGrid.dataset.strikeSignature = signature;
    strikeGrid.innerHTML = `
      <article class="smoke-strike-card"><small>Bester Strike</small><strong>${stats.best}×</strong><p>Längste Serie ohne rote oder orange Pausen in der sichtbaren Sequenz.</p></article>
      <article class="smoke-strike-card is-current"><small>Aktueller Strike</small><strong>${stats.current}×</strong><p>Vom neuesten Balken rückwärts gezählt. Rot oder Orange startet neu.</p></article>
    `;
    const summary = visual.querySelector('.smoking-visual-summary-grid');
    if (existing) existing.replaceWith(strikeGrid);
    else if (summary) summary.insertAdjacentElement('afterend', strikeGrid);
  }

  function scheduleRender() {
    window.cancelAnimationFrame(scheduleRender.frame);
    scheduleRender.frame = window.requestAnimationFrame(() => {
      injectStrikeStyles();
      renderStrikeCards();
    });
  }

  function init() {
    injectStrikeStyles();
    renderStrikeCards();
    const observer = new MutationObserver(scheduleRender);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window, document);
