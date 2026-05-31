(function installPointsLedgerRemoteAuthority(window, document) {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const SUMMARY_KEY = 'habitflow-points-ledger-remote-authority-v1';
  const RECENT_LOCAL_GRACE_MS = 10 * 60 * 1000;
  let remoteSnapshot = null;

  function rowTime(row = {}) {
    const time = new Date(row.updated_at || row.created_at || row.earned_at || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function isRecent(row = {}) {
    const time = rowTime(row);
    return time > 0 && Date.now() - time < RECENT_LOCAL_GRACE_MS;
  }

  function sourceKey(row = {}) {
    const type = row.source_type || '';
    const id = row.source_id || '';
    return type && id ? `${type}::${id}` : '';
  }

  function rememberRemoteRows(rows = []) {
    const ids = new Set();
    const sourceKeys = new Set();
    rows.forEach(row => {
      if (row?.id) ids.add(row.id);
      const key = sourceKey(row);
      if (key) sourceKeys.add(key);
    });
    remoteSnapshot = { ids, sourceKeys, rowCount: rows.length, capturedAt: new Date().toISOString() };
  }

  function writeSummary(summary = {}) {
    try {
      window.localStorage?.setItem(SUMMARY_KEY, JSON.stringify({ ...summary, cleaned_at: new Date().toISOString() }));
    } catch (error) {
      console.warn('[HabitFlow/points-ledger-remote-authority] Summary konnte nicht gespeichert werden.', error);
    }
  }

  function applyAuthority(state) {
    if (!remoteSnapshot || !state || typeof state !== 'object' || !Array.isArray(state.pointsLedger)) {
      return { state, changed: false };
    }

    const summary = {
      before: state.pointsLedger.length,
      after: 0,
      removedSyncedLocalRows: 0,
      keptUnsyncedRows: 0,
      keptRecentRows: 0,
      remoteRows: remoteSnapshot.rowCount,
      capturedAt: remoteSnapshot.capturedAt
    };

    const rows = state.pointsLedger.filter(row => {
      if (row?.synced !== true) {
        summary.keptUnsyncedRows += 1;
        return true;
      }
      if (isRecent(row)) {
        summary.keptRecentRows += 1;
        return true;
      }
      if (row.id && remoteSnapshot.ids.has(row.id)) return true;
      const key = sourceKey(row);
      if (key && remoteSnapshot.sourceKeys.has(key)) return true;
      summary.removedSyncedLocalRows += 1;
      return false;
    });

    summary.after = rows.length;
    if (!summary.removedSyncedLocalRows) return { state, changed: false };
    writeSummary(summary);
    return { state: { ...state, pointsLedger: rows }, changed: true, summary };
  }

  function normalizeStateJson(value) {
    if (typeof value !== 'string' || !value.trim().startsWith('{')) return value;
    try {
      const parsed = JSON.parse(value);
      const result = applyAuthority(parsed);
      return result.changed ? JSON.stringify(result.state) : value;
    } catch {
      return value;
    }
  }

  function patchStorage() {
    const storage = window.localStorage;
    if (!storage || storage.__habitFlowPointsLedgerRemoteAuthority) return;
    const getItem = storage.getItem.bind(storage);
    const setItem = storage.setItem.bind(storage);
    storage.getItem = function guardedGetItem(key) {
      const value = getItem(key);
      if (key !== STORAGE_KEY) return value;
      const normalized = normalizeStateJson(value);
      if (normalized !== value) setItem(key, normalized);
      return normalized;
    };
    storage.setItem = function guardedSetItem(key, value) {
      return setItem(key, key === STORAGE_KEY ? normalizeStateJson(value) : value);
    };
    storage.__habitFlowPointsLedgerRemoteAuthority = true;
  }

  function captureResult(result) {
    if (Array.isArray(result?.data)) rememberRemoteRows(result.data);
    return result;
  }

  function patchSelect(builder) {
    if (!builder || builder.__habitFlowRemoteLedgerSelect || typeof builder.select !== 'function') return;
    const select = builder.select.bind(builder);
    builder.select = function guardedSelect(...args) {
      const query = select(...args);
      if (query && !query.__habitFlowRemoteLedgerResult && typeof query.then === 'function') {
        const then = query.then.bind(query);
        query.then = function guardedThen(onFulfilled, onRejected) {
          return then(result => {
            const captured = captureResult(result);
            return onFulfilled ? onFulfilled(captured) : captured;
          }, onRejected);
        };
        query.__habitFlowRemoteLedgerResult = true;
      }
      return query;
    };
    builder.__habitFlowRemoteLedgerSelect = true;
  }

  function patchSupabaseCreateClient() {
    const supabase = window.supabase;
    if (!supabase || supabase.__habitFlowPointsLedgerRemoteAuthority || typeof supabase.createClient !== 'function') return false;
    const createClient = supabase.createClient.bind(supabase);
    supabase.createClient = function guardedCreateClient(...args) {
      const client = createClient(...args);
      if (!client || client.__habitFlowPointsLedgerRemoteAuthority || typeof client.from !== 'function') return client;
      const from = client.from.bind(client);
      client.from = function guardedFrom(tableName) {
        const builder = from(tableName);
        if (tableName === 'points_ledger') patchSelect(builder);
        return builder;
      };
      client.__habitFlowPointsLedgerRemoteAuthority = true;
      return client;
    };
    supabase.__habitFlowPointsLedgerRemoteAuthority = true;
    return true;
  }

  patchStorage();
  if (!patchSupabaseCreateClient()) {
    document?.addEventListener('DOMContentLoaded', patchSupabaseCreateClient, { once: true });
  }

  window.HabitFlowRuntime = window.HabitFlowRuntime || {};
  window.HabitFlowRuntime.applyPointsLedgerRemoteAuthority = applyAuthority;

  const modules = window.HabitFlowModules;
  if (modules && !modules.has('points-ledger-remote-authority')) {
    modules.register('points-ledger-remote-authority', {
      description: 'Keeps unsynced local ledger rows, but removes stale synced local ledger rows after a successful remote points_ledger pull.',
      active: true,
      summaryKey: SUMMARY_KEY
    });
  }
})(window, document);
