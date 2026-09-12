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
    compactActivityIdeasForStorage,
    mergeRemoteAuthoritative,
    mergeRemoteNewest
  });
})(window);
