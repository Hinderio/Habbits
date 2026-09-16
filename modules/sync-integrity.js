(function installHabitFlowSyncIntegrity(window) {
  'use strict';

  const DEFAULT_PAGE_SIZE = 1000;
  const MAX_PAGES = 10_000;

  async function fetchAllRows({ fetchPage, pageSize = DEFAULT_PAGE_SIZE } = {}) {
    if (typeof fetchPage !== 'function') throw new TypeError('fetchPage muss eine Funktion sein.');

    const normalizedPageSize = Math.max(1, Math.floor(Number(pageSize) || DEFAULT_PAGE_SIZE));
    const rows = [];
    let expectedCount = null;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const from = rows.length;
      const to = from + normalizedPageSize - 1;
      const result = await fetchPage({ from, to, page, pageSize: normalizedPageSize });
      if (result?.error) return { data: [], error: result.error, count: expectedCount, complete: false };

      const pageRows = Array.isArray(result?.data) ? result.data : [];
      if (expectedCount == null && result?.count != null && Number.isFinite(Number(result.count))) {
        expectedCount = Math.max(0, Number(result.count));
      }
      rows.push(...pageRows);

      if (expectedCount != null && rows.length >= expectedCount) {
        return { data: rows.slice(0, expectedCount), error: null, count: expectedCount, complete: true };
      }
      if (!pageRows.length) {
        if (expectedCount != null && rows.length < expectedCount) {
          return {
            data: [],
            error: new Error(`Remote-Paginierung unvollständig: ${rows.length} von ${expectedCount} Zeilen geladen.`),
            count: expectedCount,
            complete: false
          };
        }
        return { data: rows, error: null, count: expectedCount ?? rows.length, complete: true };
      }
      if (expectedCount == null && pageRows.length < normalizedPageSize) {
        return { data: rows, error: null, count: rows.length, complete: true };
      }
    }

    return {
      data: [],
      error: new Error(`Remote-Paginierung nach ${MAX_PAGES} Seiten abgebrochen.`),
      count: expectedCount,
      complete: false
    };
  }

  function createDeltaSnapshotReader({ request, getUserId }) {
    const snapshots = new Map();
    const pending = new Map();
    let owner = null;
    let generation = 0;
    let unavailableUntil = 0;
    const copy = value => JSON.parse(JSON.stringify(value));
    const revision = value => {
      if (typeof value !== 'string' || !/^[0-9]{1,18}$/.test(value)) throw new Error('Invalid sync revision');
      return BigInt(value);
    };
    function reset() {
      generation += 1;
      snapshots.clear();
      pending.clear();
      owner = getUserId();
    }
    async function load(table, userId, epoch) {
      const previous = snapshots.get(table);
      let cursor = previous?.cursor ?? null;
      let rows = new Map(previous?.rows || []);
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const result = await request(table, cursor);
        if (epoch !== generation || getUserId() !== userId) throw new Error('Sync account changed');
        if (result?.error) {
          if (['PGRST202', '42883'].includes(result.error.code)) unavailableUntil = Date.now() + 300_000;
          throw result.error;
        }
        const payload = result?.data;
        if (payload?.protocol !== 1 || payload.table !== table || payload.user_id !== userId || typeof payload.has_more !== 'boolean') throw new Error('Invalid sync response');
        const next = revision(payload.cursor);
        if (payload.mode === 'snapshot') {
          if (!Array.isArray(payload.rows) || payload.has_more) throw new Error('Incomplete initial sync snapshot');
          rows = new Map();
          for (const row of payload.rows) {
            if (!row?.id || row.user_id !== userId || rows.has(row.id)) throw new Error('Invalid sync snapshot row');
            rows.set(row.id, row);
          }
        } else if (payload.mode === 'delta') {
          if (cursor === null || !Array.isArray(payload.changes) || next < revision(cursor)) throw new Error('Invalid delta base');
          let last = revision(cursor);
          for (const change of payload.changes) {
            const current = revision(change.revision);
            if (!change.id || typeof change.deleted !== 'boolean' || current <= last || current > next) throw new Error('Invalid delta ordering');
            if (change.deleted) rows.delete(change.id);
            else {
              if (change.row?.id !== change.id || change.row.user_id !== userId) throw new Error('Invalid delta row');
              rows.set(change.id, change.row);
            }
            last = current;
          }
          if (payload.has_more && (next === revision(cursor) || last !== next)) throw new Error('Delta cursor made no progress');
        } else throw new Error('Unknown sync mode');
        cursor = payload.cursor;
        if (!payload.has_more) {
          snapshots.set(table, { cursor, rows });
          // Never expose a partial delta to snapshot-based deletion/merge logic.
          // Isolate cached rows from callers that normalize or mutate nested data.
          return { data: copy([...rows.values()]), error: null, complete: true, count: rows.size };
        }
      }
      throw new Error('Delta pagination exceeded safety limit');
    }
    async function read(table) {
      const userId = getUserId();
      if (owner !== userId) reset();
      if (!userId || Date.now() < unavailableUntil) return null;
      if (pending.has(table)) {
        // A post-write pull must not reuse a read that started before the write.
        try { await pending.get(table); } catch {}
        if (getUserId() !== userId) throw new Error('Sync account changed');
        return read(table);
      }
      const job = load(table, userId, generation);
      pending.set(table, job);
      try { return await job; }
      finally { if (pending.get(table) === job) pending.delete(table); }
    }
    return Object.freeze({ read, reset });
  }

  function compactActivityIdeasForStorage(rows = []) {
    return (Array.isArray(rows) ? rows : []).filter(row => {
      if (!row || typeof row !== 'object') return false;
      const source = String(row.source || 'custom').trim().toLowerCase();
      const reproducibleSource = source === 'seed' || source === 'generated';
      return row.synced === false || !reproducibleSource;
    });
  }

  function mergeRemoteAuthoritative(localRows = [], remoteRows = [], mapper = row => row) {
    const byId = new Map();
    (Array.isArray(remoteRows) ? remoteRows : []).map(mapper).forEach(row => {
      if (row?.id) byId.set(row.id, row);
    });
    (Array.isArray(localRows) ? localRows : []).forEach(row => {
      if (row?.id && row.synced !== true) byId.set(row.id, row);
    });
    return Array.from(byId.values());
  }

  function mergeRemoteNewest(localRows = [], remoteRows = [], mapper = row => row) {
    const byId = new Map();
    (Array.isArray(localRows) ? localRows : []).forEach(row => {
      if (row?.id) byId.set(row.id, row);
    });
    (Array.isArray(remoteRows) ? remoteRows : []).map(mapper).forEach(row => {
      if (!row?.id) return;
      const current = byId.get(row.id);
      const currentTime = Date.parse(current?.updated_at || current?.created_at || '') || 0;
      const remoteTime = Date.parse(row.updated_at || row.created_at || '') || 0;
      if (!current || remoteTime >= currentTime) byId.set(row.id, row);
    });
    return Array.from(byId.values());
  }

  window.HabitFlowSyncIntegrity = Object.freeze({
    DEFAULT_PAGE_SIZE,
    fetchAllRows,
    createDeltaSnapshotReader,
    compactActivityIdeasForStorage,
    mergeRemoteAuthoritative,
    mergeRemoteNewest
  });
})(window);
