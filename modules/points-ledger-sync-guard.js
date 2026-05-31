(function registerHabitFlowPointsLedgerSyncGuard(window, document) {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const SMOKE_DAILY_PREFIX = 'smoke-daily-bonus-';
  const SMOKE_DAILY_UUID_PREFIX = '00000000-0000-4000-8001-0000';
  const MORNING_ROUTINE_UUID_PREFIX = '00000000-0000-4000-8000-0000';
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function isUuid(value) {
    return UUID_RE.test(String(value || ''));
  }

  function dateKey(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }

  function compactDateKey(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 8).padEnd(8, '0');
  }

  function smokeDailyBonusSourceId(key) {
    return `${SMOKE_DAILY_UUID_PREFIX}${compactDateKey(key)}`;
  }

  function morningRoutineSourceId(key) {
    return `${MORNING_ROUTINE_UUID_PREFIX}${compactDateKey(key)}`;
  }

  function isSmokeDailyBonus(row = {}) {
    const sourceId = String(row.source_id || row.sourceId || '');
    const reason = String(row.reason || '');
    return row.source_type === 'bonus' && (
      sourceId.startsWith(SMOKE_DAILY_PREFIX) ||
      sourceId.startsWith(SMOKE_DAILY_UUID_PREFIX) ||
      reason.startsWith('Rauchziel:')
    );
  }

  function smokeDailyKey(row = {}) {
    const sourceId = String(row.source_id || row.sourceId || '');
    if (sourceId.startsWith(SMOKE_DAILY_PREFIX)) return sourceId.slice(SMOKE_DAILY_PREFIX.length);
    if (sourceId.startsWith(SMOKE_DAILY_UUID_PREFIX)) {
      const raw = sourceId.slice(SMOKE_DAILY_UUID_PREFIX.length);
      if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    }
    return dateKey(row.earned_at || row.earnedAt || row.created_at || row.createdAt);
  }

  function isMorningRoutineBonus(row = {}) {
    return row.source_type === 'bonus' && String(row.reason || '').trim().toLowerCase().startsWith('morgenroutine');
  }

  function canonicalLedgerRow(row = {}) {
    if (!row || typeof row !== 'object') return row;
    const next = { ...row };
    if (isSmokeDailyBonus(next)) {
      const key = smokeDailyKey(next);
      if (key) next.source_id = smokeDailyBonusSourceId(key);
    } else if (isMorningRoutineBonus(next)) {
      const key = dateKey(next.earned_at || next.earnedAt || next.created_at || next.createdAt);
      if (key) next.source_id = morningRoutineSourceId(key);
    }
    return next;
  }

  function dedupeLedgerRows(rows = []) {
    const bySource = new Map();
    const keepOrder = [];
    let changed = false;

    rows.forEach(row => {
      const canonical = canonicalLedgerRow(row);
      if (canonical !== row || canonical.source_id !== row?.source_id) changed = true;
      const sourceType = canonical?.source_type || canonical?.sourceType || '';
      const sourceId = canonical?.source_id || canonical?.sourceId || '';
      const key = sourceType && sourceId ? `${sourceType}::${sourceId}` : `id::${canonical?.id || keepOrder.length}`;
      const previous = bySource.get(key);
      if (!previous) {
        bySource.set(key, canonical);
        keepOrder.push(key);
        return;
      }
      changed = true;
      const previousTime = new Date(previous.updated_at || previous.created_at || previous.earned_at || 0).getTime();
      const currentTime = new Date(canonical.updated_at || canonical.created_at || canonical.earned_at || 0).getTime();
      if ((Number.isFinite(currentTime) ? currentTime : 0) >= (Number.isFinite(previousTime) ? previousTime : 0)) {
        bySource.set(key, { ...canonical, synced: false });
      }
    });

    return { rows: keepOrder.map(key => bySource.get(key)), changed };
  }

  function normalizeStateObject(state) {
    if (!state || typeof state !== 'object') return { state, changed: false };
    const ledger = Array.isArray(state.pointsLedger) ? state.pointsLedger : Array.isArray(state.points_ledger) ? state.points_ledger : null;
    if (!ledger) return { state, changed: false };
    const normalized = dedupeLedgerRows(ledger);
    if (!normalized.changed) return { state, changed: false };
    const next = { ...state };
    if (Array.isArray(state.pointsLedger)) next.pointsLedger = normalized.rows;
    if (Array.isArray(state.points_ledger)) next.points_ledger = normalized.rows;
    return { state: next, changed: true };
  }

  function normalizeStateJson(value) {
    if (typeof value !== 'string' || !value.trim().startsWith('{')) return value;
    try {
      const parsed = JSON.parse(value);
      const normalized = normalizeStateObject(parsed);
      return normalized.changed ? JSON.stringify(normalized.state) : value;
    } catch {
      return value;
    }
  }

  function installLocalStateGuard() {
    const storage = window.localStorage;
    if (!storage || storage.__habitFlowPointsLedgerGuard) return;
    const nativeSetItem = storage.setItem.bind(storage);
    const nativeGetItem = storage.getItem.bind(storage);
    storage.setItem = function guardedSetItem(key, value) {
      return nativeSetItem(key, key === STORAGE_KEY ? normalizeStateJson(value) : value);
    };
    storage.getItem = function guardedGetItem(key) {
      const value = nativeGetItem(key);
      if (key !== STORAGE_KEY) return value;
      const normalized = normalizeStateJson(value);
      if (normalized !== value) nativeSetItem(key, normalized);
      return normalized;
    };
    storage.__habitFlowPointsLedgerGuard = true;
  }

  function normalizeRemoteLedgerRow(row = {}) {
    const normalized = canonicalLedgerRow(row);
    if (normalized.source_id && !isUuid(normalized.source_id)) {
      return { ...normalized, source_id: null };
    }
    return normalized;
  }

  function patchSupabaseCreateClient() {
    const supabase = window.supabase;
    if (!supabase || supabase.__habitFlowPointsLedgerGuard || typeof supabase.createClient !== 'function') return false;
    const originalCreateClient = supabase.createClient.bind(supabase);
    supabase.createClient = function guardedCreateClient(...args) {
      const client = originalCreateClient(...args);
      if (!client || client.__habitFlowPointsLedgerGuard || typeof client.from !== 'function') return client;
      const originalFrom = client.from.bind(client);
      client.from = function guardedFrom(tableName) {
        const builder = originalFrom(tableName);
        if (tableName !== 'points_ledger' || !builder || typeof builder.upsert !== 'function') return builder;
        const originalUpsert = builder.upsert.bind(builder);
        builder.upsert = async function guardedPointsLedgerUpsert(rows, options = {}) {
          const inputWasArray = Array.isArray(rows);
          const normalizedRows = (inputWasArray ? rows : [rows]).map(normalizeRemoteLedgerRow);
          const preparedRows = [];
          for (const row of normalizedRows) {
            const next = { ...row };
            if (next.source_id && next.source_type) {
              try {
                let query = originalFrom('points_ledger').select('id').eq('source_type', next.source_type).eq('source_id', next.source_id).limit(1);
                if (next.user_id) query = query.eq('user_id', next.user_id);
                const { data, error } = await query.maybeSingle();
                if (!error && data?.id) next.id = data.id;
              } catch (error) {
                console.warn('[HabitFlow/points-ledger-sync-guard] Existing ledger row lookup skipped.', error);
              }
            }
            preparedRows.push(next);
          }
          return originalUpsert(inputWasArray ? preparedRows : preparedRows[0], { ...options, onConflict: 'id' });
        };
        return builder;
      };
      client.__habitFlowPointsLedgerGuard = true;
      return client;
    };
    supabase.__habitFlowPointsLedgerGuard = true;
    return true;
  }

  installLocalStateGuard();
  if (!patchSupabaseCreateClient()) {
    document?.addEventListener('DOMContentLoaded', patchSupabaseCreateClient, { once: true });
  }

  window.HabitFlowRuntime = window.HabitFlowRuntime || {};
  window.HabitFlowRuntime.normalizePointsLedgerState = normalizeStateObject;

  const modules = window.HabitFlowModules;
  if (modules && !modules.has('points-ledger-sync-guard')) {
    modules.register('points-ledger-sync-guard', {
      description: 'Normalizes deterministic daily bonus ledger source IDs and protects Supabase points_ledger sync from duplicate bonus rows.',
      active: true
    });
  }
})(window, document);
