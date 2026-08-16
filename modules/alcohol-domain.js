(function registerHabitFlowAlcoholDomain(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('alcohol-domain')) return;

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function toDate(value) {
    const date = value instanceof Date ? value : new Date(value || 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function eventDate(event) {
    return toDate(event?.occurred_at || event?.created_at || event?.updated_at);
  }

  function isSameLocalDay(a, b) {
    const first = toDate(a);
    const second = toDate(b);
    if (!first || !second) return false;
    return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
  }

  function unitsForDay(events, dayValue = new Date()) {
    return safeArray(events).filter(event => !event?.deleted_at && isSameLocalDay(eventDate(event), dayValue));
  }

  function countUnitsForDay(events, dayValue = new Date()) {
    return unitsForDay(events, dayValue).reduce((total, event) => total + Number(event.units || event.amount || 1), 0);
  }

  function sortEvents(events, direction = 'asc') {
    const rows = safeArray(events)
      .filter(event => event && !event.deleted_at)
      .slice()
      .sort((a, b) => (eventDate(a)?.getTime() || 0) - (eventDate(b)?.getTime() || 0));
    return direction === 'desc' ? rows.reverse() : rows;
  }

  function activeDrinkingDays(events, lookbackDays = 30) {
    const since = Date.now() - lookbackDays * 86400000;
    const days = new Set();
    safeArray(events).forEach(event => {
      const date = eventDate(event);
      if (!date || date.getTime() < since || event.deleted_at) return;
      days.add(date.toISOString().slice(0, 10));
    });
    return days.size;
  }

  function totalUnits(events, lookbackDays = 30) {
    const since = Date.now() - lookbackDays * 86400000;
    return safeArray(events).reduce((total, event) => {
      const date = eventDate(event);
      if (!date || date.getTime() < since || event.deleted_at) return total;
      return total + Number(event.units || event.amount || 1);
    }, 0);
  }


  const DAILY_LEVELS = Object.freeze({
    light: Object.freeze({ key: 'light', rank: 1, points: -10 }),
    moderate: Object.freeze({ key: 'moderate', rank: 2, points: -30 }),
    elevated: Object.freeze({ key: 'elevated', rank: 3, points: -70 }),
    heavy: Object.freeze({ key: 'heavy', rank: 4, points: -120 })
  });

  function dailyLevel(value) {
    const key = typeof value === 'string'
      ? value
      : Object.values(DAILY_LEVELS).find(level => level.rank === Number(value))?.key;
    return DAILY_LEVELS[key] || DAILY_LEVELS.light;
  }

  function normalizeDailyLog(log) {
    if (!log || !log.log_date || !log.consumed) return null;
    const level = dailyLevel(log.consumption_key || log.consumption_level);
    return {
      ...log,
      consumption_key: level.key,
      consumption_level: level.rank,
      points: Number.isFinite(Number(log.points)) ? Number(log.points) : level.points
    };
  }

  function dailyLogs(logs, lookbackDays = 30) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - Math.max(0, Number(lookbackDays) - 1));
    const byDate = new Map();
    safeArray(logs).forEach(log => {
      const normalized = normalizeDailyLog(log);
      if (!normalized) return;
      const date = toDate(normalized.log_date + 'T12:00:00');
      if (!date || date < since) return;
      const current = byDate.get(normalized.log_date);
      if (!current || toDate(normalized.updated_at || normalized.created_at) >= toDate(current.updated_at || current.created_at)) {
        byDate.set(normalized.log_date, normalized);
      }
    });
    return [...byDate.values()].sort((a, b) => a.log_date.localeCompare(b.log_date));
  }

  function intensityLoad(logs, lookbackDays = 30) {
    return dailyLogs(logs, lookbackDays).reduce((total, log) => total + dailyLevel(log.consumption_key).rank, 0);
  }

  const api = Object.freeze({
    eventDate,
    isSameLocalDay,
    unitsForDay,
    countUnitsForDay,
    sortEvents,
    activeDrinkingDays,
    totalUnits,
    dailyLevel,
    normalizeDailyLog,
    dailyLogs,
    intensityLoad
  });

  window.HabitFlowDomains = window.HabitFlowDomains || {};
  window.HabitFlowDomains.alcohol = api;

  modules.register('alcohol-domain', {
    description: 'Pure alcohol helpers for daily intensity plus compatible historical event analytics. No UI or sync side effects.',
    exports: Object.freeze(['countUnitsForDay', 'sortEvents', 'activeDrinkingDays', 'totalUnits', 'dailyLevel', 'dailyLogs', 'intensityLoad'])
  });
})(window);

(function loadHabitStoryCoverage(window, document) {
  'use strict';

  if (window.__habitFlowStoryCoverageLoaded) return;
  window.__habitFlowStoryCoverageLoaded = true;

  const script = document.createElement('script');
  script.src = 'modules/habit-story-coverage.js';
  script.defer = true;
  document.head.appendChild(script);
})(window, document);

(function loadLineCalendar(window, document) {
  'use strict';

  if (window.__habitFlowLineCalendarLoaded) return;
  window.__habitFlowLineCalendarLoaded = true;

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'modules/line-calendar.css';
  document.head.appendChild(stylesheet);

  const script = document.createElement('script');
  script.src = 'modules/line-calendar.js';
  script.defer = true;
  document.head.appendChild(script);
})(window, document);
