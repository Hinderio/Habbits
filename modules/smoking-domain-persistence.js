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

  function ledgerPath(state) {
    if (Array.isArray(state?.pointsLedger)) return ['pointsLedger'];
    if (Array.isArray(state?.points_ledger)) return ['points_ledger'];
    if (Array.isArray(state?.gamification?.pointsLedger)) return ['gamification', 'pointsLedger'];
    if (Array.isArray(state?.points?.ledger)) return ['points', 'ledger'];
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

  function cigaretteReason(score) {
    const facade = window.HabitFlowRuntime?.appDomainFacade;
    const suffix = score?.sleepBridge ? ' · Schlafzeit neutralisiert' : '';
    const label = facade?.getPointLabel ? facade.getPointLabel(score?.points || 0) : `${Number(score?.points || 0) > 0 ? '+' : ''}${Number(score?.points || 0)} PKT.`;
    return `Rauchpause ${label}${suffix}`;
  }

  function normalizeLedger(state, nextState, normalizedRows) {
    const path = ledgerPath(nextState);
    if (!path) return false;
    const rows = getAtPath(nextState, path);
    if (!Array.isArray(rows) || !rows.length) return false;

    const byId = new Map(normalizedRows.map(row => [row.id || row.local_id || row.smoked_at || row.created_at, row]));
    let changed = false;
    const nextLedger = rows.map(entry => {
      const sourceType = entry?.source_type || entry?.sourceType;
      const sourceId = entry?.source_id || entry?.sourceId;
      if (sourceType !== 'cigarette' || !sourceId || !byId.has(sourceId)) return entry;
      const cigarette = byId.get(sourceId);
      const nextPoints = Number(cigarette.points || 0);
      const nextReason = cigaretteReason({ points: nextPoints, sleepBridge: Boolean(cigarette.scoring_sleep_deducted_minutes) });
      const patched = Object.assign({}, entry);
      if (Number(patched.points || 0) !== nextPoints) {
        patched.points = nextPoints;
        changed = true;
      }
      if (patched.reason && patched.reason !== nextReason) {
        patched.reason = nextReason;
        changed = true;
      }
      if (changed) {
        patched.updated_at = patched.updated_at || new Date().toISOString();
        patched.synced = false;
      }
      return patched;
    });

    if (changed) setAtPath(nextState, path, nextLedger);
    return changed;
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

    const nextState = changed ? clone(state) : clone(state);
    setAtPath(nextState, path, nextRows);
    const ledgerChanged = normalizeLedger(state, nextState, nextRows);
    if (!changed && !ledgerChanged) return { state, changed: false };
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
    description: 'Uses smoking-domain scoring as a safe local state and cigarette ledger normalizer. No UI or sync calls are triggered directly.',
    active: true,
    storageKey: STORAGE_KEY
  });
})(window);
