(function registerHabitFlowAlcoholDomainPersistence(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('alcohol-domain-persistence')) return;

  const STORAGE_KEY = 'habitflow-state-v1';
  const nativeSetItem = window.localStorage?.setItem?.bind(window.localStorage);
  const nativeGetItem = window.localStorage?.getItem?.bind(window.localStorage);
  if (!nativeSetItem || !nativeGetItem) return;

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
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

  function writableTargets(state) {
    const targets = [];
    if (Object.prototype.hasOwnProperty.call(state || {}, 'todayAlcoholUnits')) targets.push(['todayAlcoholUnits']);
    if (Object.prototype.hasOwnProperty.call(state || {}, 'today_alcohol_units')) targets.push(['today_alcohol_units']);
    if (Object.prototype.hasOwnProperty.call(state || {}, 'alcoholToday')) targets.push(['alcoholToday']);
    if (Object.prototype.hasOwnProperty.call(state || {}, 'alcohol_today')) targets.push(['alcohol_today']);
    if (Object.prototype.hasOwnProperty.call(state?.consumption || {}, 'todayAlcoholUnits')) targets.push(['consumption', 'todayAlcoholUnits']);
    if (Object.prototype.hasOwnProperty.call(state?.consumption || {}, 'today_alcohol_units')) targets.push(['consumption', 'today_alcohol_units']);
    return targets;
  }

  function setAtPath(object, path, value) {
    let current = object;
    path.slice(0, -1).forEach(key => {
      current[key] = current[key] || {};
      current = current[key];
    });
    current[path[path.length - 1]] = value;
  }

  function normalizeState(state) {
    const alcohol = window.HabitFlowDomains?.alcohol;
    if (!state || typeof state !== 'object' || !alcohol?.countUnitsForDay) return { state, changed: false };
    const rows = alcoholRows(state);
    const targets = writableTargets(state);
    if (!rows.length || !targets.length) return { state, changed: false };

    const todayUnits = Number(alcohol.countUnitsForDay(rows, new Date()) || 0);
    let changed = false;
    const nextState = clone(state);
    targets.forEach(path => {
      let current = nextState;
      path.slice(0, -1).forEach(key => { current = current?.[key]; });
      const field = path[path.length - 1];
      if (!current || Number(current[field] || 0) === todayUnits) return;
      setAtPath(nextState, path, todayUnits);
      changed = true;
    });
    return { state: nextState, changed };
  }

  function normalizeJsonString(value) {
    if (typeof value !== 'string' || !value.trim().startsWith('{')) return value;
    try {
      const parsed = JSON.parse(value);
      const normalized = normalizeState(parsed);
      return normalized.changed ? JSON.stringify(normalized.state) : value;
    } catch (error) {
      return value;
    }
  }

  window.localStorage.setItem = function setItemWithAlcoholDomain(key, value) {
    const nextValue = key === STORAGE_KEY ? normalizeJsonString(value) : value;
    return nativeSetItem(key, nextValue);
  };

  window.localStorage.getItem = function getItemWithAlcoholDomain(key) {
    const value = nativeGetItem(key);
    return key === STORAGE_KEY ? normalizeJsonString(value) : value;
  };

  window.HabitFlowRuntime = window.HabitFlowRuntime || {};
  window.HabitFlowRuntime.normalizeAlcoholStateWithDomain = function normalizeAlcoholStateWithDomain(state) {
    return normalizeState(state).state;
  };

  modules.register('alcohol-domain-persistence', {
    description: 'Uses alcohol-domain helpers as a conservative local aggregate normalizer. Alcohol events are never mutated.',
    active: true,
    storageKey: STORAGE_KEY
  });
})(window);
