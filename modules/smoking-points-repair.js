(function repairHabitFlowSmokingPoints(window) {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const MARKER_KEY = 'habitflow-smoking-points-repair-v2';
  const RELOAD_KEY = 'habitflow-smoking-points-repair-reload-v2';
  const MIN_SLEEP_BRIDGE_MINUTES = 240;
  let internalWrite = false;
  let repairTimer = null;

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function toDate(value) {
    const date = value instanceof Date ? value : new Date(value || 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function sleepWindowForDate(value) {
    const start = toDate(value) || new Date();
    start.setHours(23, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setHours(7, 0, 0, 0);
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
    for (let guard = 0; guard < 21 && cursor.getTime() <= end.getTime() + 86400000; guard += 1) {
      const windowRange = sleepWindowForDate(cursor);
      const overlapStart = Math.max(start.getTime(), windowRange.start.getTime());
      const overlapEnd = Math.min(end.getTime(), windowRange.end.getTime());
      if (overlapEnd > overlapStart) total += Math.round((overlapEnd - overlapStart) / 60000);
      cursor.setDate(cursor.getDate() + 1);
    }
    return total;
  }

  function pauseOverlaps(state, startValue, endValue) {
    const start = toDate(startValue);
    const end = toDate(endValue);
    if (!start || !end || end <= start) return false;
    return safeArray(state.pausePeriods).some(period => {
      const scope = String(period.scope || period.type || '').trim().toLowerCase() || 'smoke';
      if (scope !== 'smoke' || period.is_archived) return false;
      const pauseStart = toDate(period.starts_at || period.startsAt || period.start || period.from);
      const pauseEnd = period.ends_at || period.endsAt || period.end || period.until ? toDate(period.ends_at || period.endsAt || period.end || period.until) : null;
      if (!pauseStart) return false;
      const endMs = pauseEnd ? pauseEnd.getTime() : Infinity;
      return pauseStart.getTime() < end.getTime() && endMs > start.getTime();
    });
  }

  function scoringMeta(state, previous, current) {
    if (!previous || !current) return { interval: null, scoringInterval: null, sleepDeducted: 0, sleepBridge: false, crossesPause: false };
    const start = toDate(previous.smoked_at || previous.created_at);
    const end = toDate(current.smoked_at || current.created_at);
    if (!start || !end || end <= start) return { interval: null, scoringInterval: null, sleepDeducted: 0, sleepBridge: false, crossesPause: false };
    const interval = Math.max(0, Math.round((end - start) / 60000));
    const crossesPause = pauseOverlaps(state, start, end);
    if (crossesPause) return { interval, scoringInterval: null, sleepDeducted: 0, sleepBridge: false, crossesPause: true };
    const sleep = sleepMinutesBetween(start, end);
    const sleepBridge = interval >= MIN_SLEEP_BRIDGE_MINUTES && sleep >= MIN_SLEEP_BRIDGE_MINUTES;
    const scoringInterval = sleepBridge ? Math.max(0, interval - sleep) : interval;
    return { interval, scoringInterval, sleepDeducted: sleepBridge ? sleep : 0, sleepBridge, crossesPause: false };
  }

  function canonicalSmokingPoints(scoringInterval, meta = {}) {
    if (scoringInterval == null) return 0;
    if (meta.sleepBridge) return 0;
    if (scoringInterval < 30) return -40;
    if (scoringInterval < 60) return -20;
    if (scoringInterval < 120) return 0;
    if (scoringInterval < 240) return 20;
    if (scoringInterval < 480) return 60;
    return 100;
  }

  function canonicalReason(points, meta = {}) {
    if (meta.crossesPause) return 'Rauchpause: pausierter Zeitraum';
    if (meta.sleepBridge) return 'Rauchpause: Schlafzeit neutralisiert';
    if (points >= 100) return 'Rauchpause: 8+ Stunden';
    if (points >= 60) return 'Rauchpause: 4–8 Stunden';
    if (points >= 20) return 'Rauchpause: 2–4 Stunden';
    if (points < 0) return 'Rauchabstand zu kurz';
    return 'Rauchpause: neutral';
  }

  function ensureLedgerPoint(state, cigarette, points, reason) {
    if (!cigarette?.id) return false;
    const ledger = safeArray(state.pointsLedger);
    const matches = ledger.filter(point => point && point.source_type === 'cigarette' && point.source_id === cigarette.id);
    let changed = false;
    if (!matches.length) {
      ledger.push({
        id: `cigarette-${cigarette.id}`,
        source_type: 'cigarette',
        source_id: cigarette.id,
        points,
        reason,
        earned_at: cigarette.smoked_at || cigarette.created_at || new Date().toISOString(),
        created_at: cigarette.created_at || cigarette.smoked_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        synced: false
      });
      state.pointsLedger = ledger;
      return true;
    }
    const [primary, ...duplicates] = matches;
    if (Number(primary.points || 0) !== Number(points || 0) || primary.reason !== reason) {
      primary.points = points;
      primary.reason = reason;
      primary.earned_at = cigarette.smoked_at || primary.earned_at || cigarette.created_at;
      primary.updated_at = new Date().toISOString();
      primary.synced = false;
      changed = true;
    }
    if (duplicates.length) {
      const duplicateIds = new Set(duplicates.map(point => point.id));
      state.pointsLedger = ledger.filter(point => !duplicateIds.has(point.id));
      changed = true;
    }
    return changed;
  }

  function repairStateObject(state) {
    if (!state || typeof state !== 'object' || !safeArray(state.cigarettes).length) return { state, changed: false };
    let changed = false;
    const visible = safeArray(state.cigarettes)
      .filter(item => item && !item.deleted_at)
      .sort((a, b) => new Date(a.smoked_at || a.created_at || 0) - new Date(b.smoked_at || b.created_at || 0));

    visible.forEach((cigarette, index) => {
      const previous = index > 0 ? visible[index - 1] : null;
      const meta = scoringMeta(state, previous, cigarette);
      const points = canonicalSmokingPoints(meta.scoringInterval, meta);
      const reason = canonicalReason(points, meta);
      if (cigarette.interval_minutes !== meta.interval || cigarette.scoring_interval_minutes !== meta.scoringInterval || cigarette.scoring_sleep_deducted_minutes !== meta.sleepDeducted || Number(cigarette.points || 0) !== points) {
        cigarette.interval_minutes = meta.interval;
        cigarette.scoring_interval_minutes = meta.scoringInterval;
        cigarette.scoring_sleep_deducted_minutes = meta.sleepDeducted;
        cigarette.points = points;
        cigarette.updated_at = new Date().toISOString();
        cigarette.synced = false;
        changed = true;
      }
      if (ensureLedgerPoint(state, cigarette, points, reason)) changed = true;
    });

    const validIds = new Set(visible.map(item => item.id));
    const before = safeArray(state.pointsLedger).length;
    state.pointsLedger = safeArray(state.pointsLedger).filter(point => point.source_type !== 'cigarette' || validIds.has(point.source_id));
    if (state.pointsLedger.length !== before) changed = true;

    if (changed) state.updated_at = new Date().toISOString();
    return { state, changed };
  }

  function parseState(raw) {
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function writeRepairedState(state) {
    internalWrite = true;
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } finally {
      internalWrite = false;
    }
  }

  function repairStoredState({ reloadOnChange = false } = {}) {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    const parsed = parseState(raw);
    const result = repairStateObject(parsed);
    if (result.changed) {
      writeRepairedState(result.state);
      try { window.localStorage?.setItem(MARKER_KEY, JSON.stringify({ checked_at: new Date().toISOString(), changed: true })); } catch {}
      if (reloadOnChange) scheduleOneSafeReload();
    }
    return result;
  }

  function scheduleOneSafeReload() {
    try {
      if (window.sessionStorage?.getItem(RELOAD_KEY) === 'done') return;
      window.sessionStorage?.setItem(RELOAD_KEY, 'done');
      window.setTimeout(() => window.location.reload(), 220);
    } catch {}
  }

  function installStateWriteGuard() {
    const storage = window.localStorage;
    if (!storage || storage.__habitflowSmokingPointsGuard) return;
    const originalSetItem = storage.setItem.bind(storage);
    Object.defineProperty(storage, '__habitflowSmokingPointsGuard', { value: true, configurable: false });
    storage.setItem = function guardedSetItem(key, value) {
      if (!internalWrite && key === STORAGE_KEY) {
        const parsed = parseState(value);
        const result = repairStateObject(parsed);
        if (result.changed) {
          originalSetItem(key, JSON.stringify(result.state));
          try { originalSetItem(MARKER_KEY, JSON.stringify({ checked_at: new Date().toISOString(), changed: true, guarded: true })); } catch {}
          return;
        }
      }
      return originalSetItem(key, value);
    };
  }

  function scheduleRepair(delay = 400, reloadOnChange = true) {
    clearTimeout(repairTimer);
    repairTimer = window.setTimeout(() => repairStoredState({ reloadOnChange }), delay);
  }

  installStateWriteGuard();
  const initial = repairStoredState({ reloadOnChange: false });
  window.addEventListener('focus', () => scheduleRepair(120, true));
  window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) scheduleRepair(120, true); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleRepair(120, true); });
  document.addEventListener('click', event => {
    const action = event.target?.closest?.('[data-action]')?.dataset?.action || '';
    if (/smoke|cigarette|sync|history/i.test(action)) scheduleRepair(600, true);
  }, true);
  window.setTimeout(() => repairStoredState({ reloadOnChange: true }), 1800);
  window.setInterval(() => repairStoredState({ reloadOnChange: false }), 30000);

  const modules = window.HabitFlowModules;
  if (modules && !modules.has('smoking-points-repair')) {
    modules.register('smoking-points-repair', {
      description: 'Repairs cigarette rows and points ledger after local or remote writes so sleep bridges never create bonuses.',
      minSleepBridgeMinutes: MIN_SLEEP_BRIDGE_MINUTES,
      sleepBridgePoints: 0,
      writeGuard: true,
      lastRun: Object.freeze(initial)
    });
  }
})(window);
