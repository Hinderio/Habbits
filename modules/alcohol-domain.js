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

  const api = Object.freeze({
    eventDate,
    isSameLocalDay,
    unitsForDay,
    countUnitsForDay,
    sortEvents,
    activeDrinkingDays,
    totalUnits
  });

  window.HabitFlowDomains = window.HabitFlowDomains || {};
  window.HabitFlowDomains.alcohol = api;

  modules.register('alcohol-domain', {
    description: 'Pure alcohol event helpers for counts, daily context and analytics. No UI or sync side effects.',
    exports: Object.freeze(['countUnitsForDay', 'sortEvents', 'activeDrinkingDays', 'totalUnits'])
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
