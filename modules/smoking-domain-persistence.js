(function registerHabitFlowSmokingDomainPersistence(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('smoking-domain-persistence')) return;

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

  function collectionPath(state) {
    if (Array.isArray(state?.cigarettes)) return ['cigarettes'];
    if (Array.isArray(state?.cigarette_events)) return ['cigarette_events'];
    if (Array.isArray(state?.smoking?.cigarettes)) return ['smoking', 'cigarettes'];
    if (Array.isArray(state?.consumption?.cigarettes)) return ['consumption', 'cigarettes'];
    return null;
  }

  function getAtPath(object, path) {
    return path.reduce((current, key) => current?.[key], object);
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
    const smoking = window.HabitFlowDomains?.smoking;
    if (!state || typeof state !== 'object' || !smoking?.recalculateEvents) return { state, changed: false };
    const path = collectionPath(state);
    if (!path) return { state, changed: false };

    const rows = getAtPath(state, path);
    const recalculated = smoking.recalculateEvents(rows);
    if (!Array.isArray(recalculated) || recalculated.length !== rows.length) return { state, changed: false };

    let changed = false;
    const byId = new Map(recalculated.map(row => [row.id || row.local_id || row.smoked_at || row.created_at, row]));
    const nextRows = rows.map(row => {
      const key = row?.id || row?.local_id || row?.smoked_at || row?.created_at;
      const next = byId.get(key);
      if (!next) return row;
      const fields = ['interval_minutes', 'scoring_interval_minutes', 'scoring_sleep_deducted_minutes', 'points'];
      const patched = Object.assign({}, row);
      fields.forEach(field => {
        if (Number(patched[field] ?? 0) !== Number(next[field] ?? 0)) {
          patched[field] = next[field];
          changed = true;
        }
      });
      return patched;
    });

    if (!changed) return { state, changed: false };
    const nextState = clone(state);
    setAtPath(nextState, path, nextRows);
    return { state: nextState, changed: true };
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

  window.localStorage.setItem = function setItemWithSmokingDomain(key, value) {
    const nextValue = key === STORAGE_KEY ? normalizeJsonString(value) : value;
    return nativeSetItem(key, nextValue);
  };

  window.localStorage.getItem = function getItemWithSmokingDomain(key) {
    const value = nativeGetItem(key);
    return key === STORAGE_KEY ? normalizeJsonString(value) : value;
  };

  window.HabitFlowRuntime = window.HabitFlowRuntime || {};
  window.HabitFlowRuntime.normalizeSmokingStateWithDomain = function normalizeSmokingStateWithDomain(state) {
    return normalizeState(state).state;
  };

  modules.register('smoking-domain-persistence', {
    description: 'Uses smoking-domain scoring as a safe local state persistence normalizer. No UI or sync calls are triggered directly.',
    active: true,
    storageKey: STORAGE_KEY
  });
})(window);
