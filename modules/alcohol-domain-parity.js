(function registerHabitFlowAlcoholDomainParity(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('alcohol-domain-parity')) return;

  const STORAGE_KEY = 'habitflow-state-v1';

  function readState() {
    try {
      return JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function firstArray(candidates) {
    return candidates.find(Array.isArray) || [];
  }

  function alcoholRows(state) {
    return firstArray([
      state?.alcohol,
      state?.alcoholUnits,
      state?.alcohol_units,
      state?.alcohol_events,
      state?.drinks,
      state?.drink_events,
      state?.consumption?.alcohol,
      state?.consumption?.alcoholUnits,
      state?.consumption?.alcohol_units,
      state?.consumption?.drinks
    ]);
  }

  function eventDate(event) {
    return event?.occurred_at || event?.drank_at || event?.created_at || event?.updated_at || null;
  }

  function eventUnits(event) {
    const value = Number(event?.units ?? event?.amount ?? event?.count ?? 1);
    return Number.isFinite(value) ? value : 1;
  }

  function todayKey(date = new Date()) {
    const value = date instanceof Date ? date : new Date(date || Date.now());
    if (Number.isNaN(value.getTime())) return new Date().toISOString().slice(0, 10);
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function localDayKey(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return null;
    return todayKey(date);
  }

  function fallbackUnitsForDay(events, key = todayKey()) {
    return (Array.isArray(events) ? events : []).reduce((total, event) => {
      if (!event || event.deleted_at) return total;
      return localDayKey(eventDate(event)) === key ? total + eventUnits(event) : total;
    }, 0);
  }

  function storedTodayCandidates(state) {
    return [
      state?.todayAlcoholUnits,
      state?.today_alcohol_units,
      state?.alcoholToday,
      state?.alcohol_today,
      state?.consumption?.todayAlcoholUnits,
      state?.consumption?.today_alcohol_units
    ].filter(value => value !== undefined && value !== null && value !== '');
  }

  function compareRows(rows, state) {
    const alcohol = window.HabitFlowDomains?.alcohol;
    if (!alcohol?.countUnitsForDay) {
      return { ready: false, checked: 0, todayUnits: 0, mismatches: [] };
    }

    const cleanRows = (Array.isArray(rows) ? rows : []).filter(row => row && !row.deleted_at);
    const today = new Date();
    const domainToday = Number(alcohol.countUnitsForDay(cleanRows, today) || 0);
    const fallbackToday = Number(fallbackUnitsForDay(cleanRows, todayKey(today)) || 0);
    const mismatches = [];

    if (domainToday !== fallbackToday) {
      mismatches.push({ type: 'today_units_formula', stored: fallbackToday, expected: domainToday });
    }

    storedTodayCandidates(state).forEach(value => {
      const stored = Number(value || 0);
      if (Number.isFinite(stored) && stored !== domainToday) {
        mismatches.push({ type: 'stored_today_units', stored, expected: domainToday });
      }
    });

    return {
      ready: true,
      checked: cleanRows.length,
      todayUnits: domainToday,
      activeDays30: alcohol.activeDrinkingDays ? alcohol.activeDrinkingDays(cleanRows, 30) : null,
      totalUnits30: alcohol.totalUnits ? alcohol.totalUnits(cleanRows, 30) : null,
      mismatches
    };
  }

  function verify() {
    const state = readState();
    const report = compareRows(alcoholRows(state), state);
    window.HabitFlowRuntime = window.HabitFlowRuntime || {};
    window.HabitFlowRuntime.alcoholParity = report;
    if (report.ready && report.mismatches.length) {
      console.warn('[HabitFlow/alcohol-parity] Alcohol domain differs from current local aggregates.', report);
    }
    return report;
  }

  function scheduleVerify() {
    [500, 2000, 6000].forEach(delay => window.setTimeout(verify, delay));
  }

  if (window.document?.readyState === 'loading') {
    window.document.addEventListener('DOMContentLoaded', scheduleVerify, { once: true });
  } else {
    scheduleVerify();
  }

  window.addEventListener('visibilitychange', () => {
    if (!window.document.hidden) verify();
  });

  window.HabitFlowRuntime = window.HabitFlowRuntime || {};
  window.HabitFlowRuntime.verifyAlcoholDomainParity = verify;

  modules.register('alcohol-domain-parity', {
    description: 'Passive parity check for alcohol domain helpers. Reads local state only and does not mutate app data.',
    passive: true,
    exports: Object.freeze(['window.HabitFlowRuntime.verifyAlcoholDomainParity'])
  });
})(window);
