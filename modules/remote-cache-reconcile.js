(function reconcileHabitFlowRemoteCache(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  const STORAGE_KEY = 'habitflow-state-v1';
  const CLEANUP_MARKER_KEY = 'habitflow-remote-cache-reconcile-v1';
  const RELOAD_MARKER_KEY = 'habitflow-remote-cache-reconcile-reloaded-v1';
  const APPOINTMENT_RELOAD_MARKER_KEY = 'habitflow-appointments-remote-reconcile-reload';
  const APPOINTMENT_SAVE_LOCK_KEY = 'habitflow-appointment-series-save-lock';
  const RECENT_LOCAL_GRACE_MS = 10 * 60 * 1000;
  const HISTORY_LOOKBACK_DAYS = 180;
  const RELOAD_DELAY_MS = 1200;

  function nowMs() {
    return Date.now();
  }

  function readJson(key, fallback = null) {
    try {
      const raw = window.localStorage?.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (error) {
      console.warn('[HabitFlow/reconcile] Lokaler Cache konnte nicht gelesen werden.', { key, error });
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage?.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('[HabitFlow/reconcile] Lokaler Cache konnte nicht gespeichert werden.', { key, error });
      return false;
    }
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function toDateKey(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function cutoffDateKey() {
    const date = new Date();
    date.setDate(date.getDate() - HISTORY_LOOKBACK_DAYS);
    return toDateKey(date);
  }

  function isRecentLocalRow(row = {}) {
    const changedAt = new Date(row.updated_at || row.created_at || row.occurred_at || 0).getTime();
    return Number.isFinite(changedAt) && nowMs() - changedAt < RECENT_LOCAL_GRACE_MS;
  }

  function isFitnessHabit(habit = {}) {
    const text = `${habit.name || ''} ${habit.icon || ''} ${habit.unit || ''}`.toLowerCase();
    return /wander|hiking|hik|berg|jogg|lauf|run|km/.test(text);
  }

  function relevantHabitIds(state = {}) {
    return new Set(safeArray(state.habits).filter(isFitnessHabit).map(habit => habit.id).filter(Boolean));
  }

  function getConfig() {
    return window.HABITFLOW_SUPABASE_CONFIG || {};
  }

  function getSupabaseFactory() {
    return window.supabase?.createClient || window.supabase?.default?.createClient || null;
  }

  function client() {
    const config = getConfig();
    const createClient = getSupabaseFactory();
    if (!createClient || !config.url || !config.anonKey) return null;
    try {
      return createClient(config.url, config.anonKey);
    } catch (error) {
      console.warn('[HabitFlow/reconcile] Supabase Client konnte nicht erstellt werden.', error);
      return null;
    }
  }

  async function currentUserId(supabaseClient) {
    try {
      const result = await supabaseClient.auth.getUser();
      return result?.data?.user?.id || null;
    } catch (error) {
      console.warn('[HabitFlow/reconcile] Auth-Status konnte nicht geprüft werden.', error);
      return null;
    }
  }

  async function fetchRemoteIds(supabaseClient, userId, table) {
    const since = cutoffDateKey();
    const { data, error } = await supabaseClient
      .from(table)
      .select('id')
      .eq('user_id', userId)
      .gte('occurred_at', `${since}T00:00:00.000Z`);
    if (error) throw error;
    return new Set((data || []).map(row => row.id).filter(Boolean));
  }

  function removeOrphanHabitEntries(state, remoteEntryIds) {
    const fitnessIds = relevantHabitIds(state);
    if (!fitnessIds.size) return [];
    const cutoff = cutoffDateKey();
    const removed = [];
    const kept = safeArray(state.habitEntries).filter(entry => {
      if (!entry?.id || !fitnessIds.has(entry.habit_id)) return true;
      const entryKey = toDateKey(entry.occurred_at || entry.created_at);
      if (!entryKey || entryKey < cutoff) return true;
      if (remoteEntryIds.has(entry.id)) return true;
      if (isRecentLocalRow(entry)) return true;
      removed.push(entry);
      return false;
    });
    if (removed.length) state.habitEntries = kept;
    return removed;
  }

  function removeOrphanHabitLedger(state, removedEntries) {
    const removedEntryIds = new Set(removedEntries.map(entry => entry.id).filter(Boolean));
    if (!removedEntryIds.size) return [];
    const removedLedger = [];
    state.pointsLedger = safeArray(state.pointsLedger).filter(point => {
      const shouldRemove = point?.source_type === 'habit' && removedEntryIds.has(point.source_id);
      if (shouldRemove) removedLedger.push(point);
      return !shouldRemove;
    });
    return removedLedger;
  }

  function shouldRun() {
    const marker = readJson(CLEANUP_MARKER_KEY, {});
    const today = toDateKey(new Date());
    return marker?.date !== today;
  }

  function markRun(summary) {
    writeJson(CLEANUP_MARKER_KEY, { date: toDateKey(new Date()), checked_at: new Date().toISOString(), ...summary });
  }

  function hasAppointmentReloadScheduled() {
    try {
      return Boolean(window.sessionStorage?.getItem(APPOINTMENT_RELOAD_MARKER_KEY));
    } catch (error) {
      return false;
    }
  }

  function isAppointmentSaveLocked() {
    try {
      const expiresAt = Number(window.sessionStorage?.getItem(APPOINTMENT_SAVE_LOCK_KEY) || 0);
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        window.sessionStorage?.removeItem(APPOINTMENT_SAVE_LOCK_KEY);
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  function requestReconcileReload() {
    const alreadyReloaded = window.sessionStorage?.getItem(RELOAD_MARKER_KEY) === '1';
    if (alreadyReloaded || hasAppointmentReloadScheduled() || isAppointmentSaveLocked()) return;
    window.sessionStorage?.setItem(RELOAD_MARKER_KEY, '1');
    window.setTimeout(() => {
      if (!hasAppointmentReloadScheduled() && !isAppointmentSaveLocked()) {
        window.location.reload();
      }
    }, RELOAD_DELAY_MS);
  }

  async function reconcile() {
    if (!shouldRun()) return { skipped: 'already-checked-today' };
    if (isAppointmentSaveLocked()) return { skipped: 'appointment-save-active' };
    const state = readJson(STORAGE_KEY, null);
    if (!state || !safeArray(state.habitEntries).length) return { skipped: 'no-local-state' };

    const supabaseClient = client();
    if (!supabaseClient) return { skipped: 'no-supabase-client' };

    const userId = await currentUserId(supabaseClient);
    if (!userId) return { skipped: 'not-authenticated' };

    const remoteEntryIds = await fetchRemoteIds(supabaseClient, userId, 'habit_entries');
    const removedEntries = removeOrphanHabitEntries(state, remoteEntryIds);
    const removedLedger = removeOrphanHabitLedger(state, removedEntries);

    if (!removedEntries.length) {
      markRun({ removed_entries: 0, removed_ledger: 0 });
      return { removedEntries: 0, removedLedger: 0 };
    }

    writeJson(STORAGE_KEY, state);
    markRun({ removed_entries: removedEntries.length, removed_ledger: removedLedger.length });
    requestReconcileReload();

    return { removedEntries: removedEntries.length, removedLedger: removedLedger.length };
  }

  const run = reconcile().catch(error => {
    console.warn('[HabitFlow/reconcile] Remote-Cache-Abgleich fehlgeschlagen.', error);
    return { error: true };
  });

  if (modules && !modules.has('remote-cache-reconcile')) {
    modules.register('remote-cache-reconcile', {
      description: 'Removes stale local fitness habit entries that are missing from Supabase after authenticated remote read.',
      historyLookbackDays: HISTORY_LOOKBACK_DAYS,
      recentLocalGraceMinutes: Math.round(RECENT_LOCAL_GRACE_MS / 60000),
      run
    });
  }
})(window);
