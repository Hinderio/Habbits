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
      #smokeIntervalVisual .smoke-strike-card{position:relative;overflow:hidden;background:rgba(255,255,255,.052)!important;background-image:none!important;}
      #smokeIntervalVisual .smoke-strike-card:after{display:none!important;content:none!important;}
      #smokeIntervalVisual .smoke-strike-card strong{font-size:clamp(1.75rem,4vw,2.45rem);letter-spacing:-.06em;}
      #smokeIntervalVisual .smoke-strike-card small{color:var(--muted);}
      #smokeIntervalVisual .smoke-strike-card.is-current{border-color:rgba(100,208,203,.24);background:rgba(255,255,255,.052)!important;background-image:none!important;}
      body.light #smokeIntervalVisual .smoke-strike-card,
      body.light #smokeIntervalVisual .smoke-strike-card.is-current{background:rgba(255,255,255,.82)!important;background-image:none!important;}
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

(function enhanceMonthlyMissionSuggestions(window, document) {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const STYLE_ID = 'monthlyMissionSuggestionStyles';
  const EXTRA_PRESETS = [
    { id: 'weight-goal', title: 'Gewicht-Ziel', source: 'Ernährung · Gewicht messen', type: 'weight' },
    { id: 'pushups-goal', title: 'Liegestütze-Ziel', source: 'Fitness · Liegestütze', type: 'pushups' }
  ];

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #monthlyMissions .monthly-preset-btn.hf-monthly-extra-preset{background:rgba(255,255,255,.052);background-image:none;}
      #monthlyMissions .monthly-mission-card.hf-habit-linked .monthly-mission-counter{display:none!important;}
    `;
    document.head.appendChild(style);
  }

  function readAppState() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function normalizedText(value = '') {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ü/g, 'u')
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/ß/g, 'ss');
  }

  function dateKey(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function currentMonthKey() {
    return dateKey(new Date()).slice(0, 7);
  }

  function activeRows(rows) {
    return Array.isArray(rows) ? rows.filter(row => row && !row.deleted_at && !row.archived_at && !row.is_archived) : [];
  }

  function habitLabel(habit = {}) {
    return normalizedText(`${habit.name || ''} ${habit.icon || ''} ${habit.type || ''} ${habit.unit || ''}`);
  }

  function findHabit(state, type) {
    const habits = activeRows(state.habits);
    if (type === 'weight') {
      return habits.find(habit => habit.type === 'weight')
        || habits.find(habit => habitLabel(habit).includes('gewicht') || habitLabel(habit).includes('weight'))
        || null;
    }
    return habits.find(habit => {
      const text = habitLabel(habit);
      return text.includes('pushup') || text.includes('push-up') || text.includes('push up') || text.includes('liegestutz') || text.includes('liegestuetz');
    }) || null;
  }

  function entriesForHabit(state, habit, { monthKey = null } = {}) {
    if (!habit?.id) return [];
    return activeRows(state.habitEntries)
      .filter(entry => entry.habit_id === habit.id)
      .filter(entry => !monthKey || dateKey(entry.occurred_at || entry.created_at).slice(0, 7) === monthKey)
      .sort((a, b) => new Date(a.occurred_at || a.created_at || 0) - new Date(b.occurred_at || b.created_at || 0));
  }

  function entryNumber(entry, fallback = 1) {
    const value = Number(entry?.value ?? entry?.amount ?? entry?.count ?? fallback);
    return Number.isFinite(value) ? value : fallback;
  }

  function formatNumber(value, digits = 0) {
    const number = Number(value || 0);
    return number.toLocaleString('de-CH', {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits && !Number.isInteger(number) ? 1 : 0
    });
  }

  function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function missionIdFromCard(card) {
    return card.querySelector('[data-id]')?.dataset?.id || '';
  }

  function missionTitleFromCard(card) {
    return card.querySelector('.monthly-mission-card-head strong')?.textContent?.trim() || '';
  }

  function findMission(state, card) {
    const id = missionIdFromCard(card);
    const title = missionTitleFromCard(card);
    return activeRows(state.monthlyMissions).find(mission => mission.id === id)
      || activeRows(state.monthlyMissions).find(mission => String(mission.title || '').trim() === title)
      || { title, target: Number(card.querySelector('.monthly-mission-meta span')?.textContent?.match(/\d+(?:[.,]\d+)?/g)?.at(-1) || 1), month_key: currentMonthKey() };
  }

  function buildWeightMissionView(state, mission) {
    const habit = findHabit(state, 'weight');
    const entries = entriesForHabit(state, habit);
    const target = Number(mission.target || 0);
    if (!habit || !entries.length || !Number.isFinite(target) || target <= 0) {
      return { source: 'Ernährung · Gewicht messen', ratio: 0, meta: `0/${target || '–'} kg`, label: 'knapp', status: 'Noch kein Gewicht-Habit-Log für dieses Ziel gefunden.' };
    }
    const start = entryNumber(entries[0], 0);
    const latest = entryNumber(entries[entries.length - 1], 0);
    const wantsDown = target < start;
    const wantsUp = target > start;
    const total = Math.abs(start - target);
    const progress = wantsDown ? start - latest : wantsUp ? latest - start : 0;
    const completed = wantsDown ? latest <= target : wantsUp ? latest >= target : Math.abs(latest - target) < 0.05;
    const ratio = completed ? 100 : total > 0 ? clamp((progress / total) * 100) : 0;
    const remaining = Math.max(0, Math.abs(latest - target));
    return {
      source: `Ernährung · ${habit.name || 'Gewicht messen'}`,
      ratio,
      meta: `${formatNumber(latest, 1)}/${formatNumber(target, 1)} kg`,
      label: completed ? 'geschafft' : ratio >= 70 ? 'auf Kurs' : 'knapp',
      status: completed ? 'Gewichtsziel erreicht. Stark dokumentiert.' : `Noch ${formatNumber(remaining, 1)} kg bis zum Ziel · ${entries.length} Wiegepunkt${entries.length === 1 ? '' : 'e'} gespeichert.`
    };
  }

  function buildPushupMissionView(state, mission) {
    const habit = findHabit(state, 'pushups');
    const target = Math.max(1, Number(mission.target || 1));
    const monthKey = mission.month_key || currentMonthKey();
    const entries = entriesForHabit(state, habit, { monthKey });
    const total = entries.reduce((sum, entry) => sum + Math.max(0, entryNumber(entry, 1)), 0);
    const ratio = clamp((total / target) * 100);
    const remaining = Math.max(0, Math.ceil(target - total));
    return {
      source: `Fitness · ${habit?.name || 'Liegestütze'}`,
      ratio,
      meta: `${formatNumber(total)}/${formatNumber(target)} Liegestütze`,
      label: ratio >= 100 ? 'geschafft' : ratio >= 70 ? 'auf Kurs' : 'knapp',
      status: habit ? (ratio >= 100 ? 'Liegestütze-Ziel abgeschlossen. Saubere Kraft-Serie.' : `Noch ${formatNumber(remaining)} Liegestütze aus deinem Habit bis zum Monatsziel.`) : 'Noch kein Liegestütze-Habit gefunden.'
    };
  }

  function applyMissionView(card, view) {
    const signature = JSON.stringify(view);
    if (card.dataset.hfHabitMissionSignature === signature) return;
    card.dataset.hfHabitMissionSignature = signature;
    card.classList.add('hf-habit-linked');
    card.classList.remove('is-complete', 'is-track', 'is-behind');
    card.classList.add(view.ratio >= 100 ? 'is-complete' : view.ratio >= 70 ? 'is-track' : 'is-behind');
    const source = card.querySelector('.monthly-mission-card-head small');
    const percent = card.querySelector('.monthly-mission-card-head em');
    const progress = card.querySelector('.monthly-mission-progress i');
    const meta = card.querySelector('.monthly-mission-meta span');
    const label = card.querySelector('.monthly-mission-meta b');
    const paragraph = Array.from(card.children).find(child => child.tagName === 'P');
    if (source) source.textContent = view.source;
    if (percent) percent.textContent = `${Math.round(view.ratio)}%`;
    if (progress) progress.style.width = `${clamp(view.ratio)}%`;
    if (meta) meta.textContent = view.meta;
    if (label) label.textContent = view.label;
    if (paragraph) paragraph.textContent = view.status;
    card.querySelector('.monthly-mission-counter')?.remove();
  }

  function enhanceMissionCards() {
    const state = readAppState();
    document.querySelectorAll('#monthlyMissions .monthly-mission-card').forEach(card => {
      const title = normalizedText(missionTitleFromCard(card));
      const mission = findMission(state, card);
      if (title.includes('gewicht')) applyMissionView(card, buildWeightMissionView(state, mission));
      if (title.includes('liegestutz') || title.includes('liegestuetz') || title.includes('pushup')) applyMissionView(card, buildPushupMissionView(state, mission));
    });
  }

  function suggestedWeightTarget() {
    const state = readAppState();
    const habit = findHabit(state, 'weight');
    const entries = entriesForHabit(state, habit);
    const latest = entries.length ? entryNumber(entries[entries.length - 1], 0) : 0;
    return latest ? String(Math.max(1, Math.floor(latest - 2))) : '82';
  }

  function fillCustomMission(preset) {
    const titleInput = document.getElementById('monthlyMissionTitle');
    const targetInput = document.getElementById('monthlyMissionTarget');
    const metricSelect = document.getElementById('monthlyMissionMetric');
    if (!titleInput || !targetInput || !metricSelect) return;
    titleInput.value = preset.title;
    targetInput.value = preset.type === 'weight' ? suggestedWeightTarget() : '100';
    metricSelect.value = 'manual_count';
    titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    metricSelect.dispatchEvent(new Event('change', { bubbles: true }));
    targetInput.focus({ preventScroll: true });
    targetInput.select?.();
  }

  function enhancePresetGrid() {
    injectStyles();
    const grid = document.querySelector('#monthlyMissions .monthly-preset-grid');
    if (grid) {
      EXTRA_PRESETS.forEach(preset => {
        if (grid.querySelector(`[data-hf-monthly-preset="${preset.id}"]`)) return;
        const button = document.createElement('button');
        button.className = 'monthly-preset-btn hf-monthly-extra-preset';
        button.type = 'button';
        button.dataset.hfMonthlyPreset = preset.id;
        button.innerHTML = `<strong>${preset.title}</strong><span>${preset.source}</span>`;
        button.addEventListener('click', () => fillCustomMission(preset));
        grid.appendChild(button);
      });
    }
    enhanceMissionCards();
  }

  function scheduleEnhance() {
    window.cancelAnimationFrame(scheduleEnhance.frame);
    scheduleEnhance.frame = window.requestAnimationFrame(enhancePresetGrid);
  }

  function init() {
    enhancePresetGrid();
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window, document);
