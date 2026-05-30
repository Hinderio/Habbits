(function registerHabitFlowPointsDomain(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('points-domain')) return;

  function normalizePoints(value) {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function pointLabel(value) {
    const points = normalizePoints(value);
    return `${points > 0 ? '+' : ''}${points} Pkt.`;
  }

  function pointTone(value) {
    const points = normalizePoints(value);
    if (points > 0) return 'positive';
    if (points < 0) return 'danger';
    return 'neutral';
  }

  function ledgerKey(sourceType, sourceId) {
    return `${sourceType || 'unknown'}:${sourceId || 'unknown'}`;
  }

  function dedupeLedgerEntries(entries) {
    const seen = new Map();
    const result = [];
    (Array.isArray(entries) ? entries : []).forEach(entry => {
      if (!entry) return;
      const key = ledgerKey(entry.source_type, entry.source_id);
      if (!seen.has(key)) {
        seen.set(key, entry);
        result.push(entry);
        return;
      }
      const current = seen.get(key);
      const currentTime = new Date(current.updated_at || current.created_at || current.earned_at || 0).getTime();
      const nextTime = new Date(entry.updated_at || entry.created_at || entry.earned_at || 0).getTime();
      if (nextTime > currentTime) {
        const index = result.indexOf(current);
        if (index >= 0) result[index] = entry;
        seen.set(key, entry);
      }
    });
    return result;
  }

  function upsertLedgerEntry(entries, nextEntry) {
    const ledger = Array.isArray(entries) ? entries.slice() : [];
    if (!nextEntry || !nextEntry.source_type || !nextEntry.source_id) return ledger;
    const key = ledgerKey(nextEntry.source_type, nextEntry.source_id);
    let replaced = false;
    const merged = ledger.map(entry => {
      if (ledgerKey(entry?.source_type, entry?.source_id) !== key) return entry;
      replaced = true;
      return Object.assign({}, entry, nextEntry, { updated_at: new Date().toISOString(), synced: false });
    });
    if (!replaced) merged.push(Object.assign({ id: key, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), synced: false }, nextEntry));
    return dedupeLedgerEntries(merged);
  }

  const api = Object.freeze({
    normalizePoints,
    pointLabel,
    pointTone,
    ledgerKey,
    dedupeLedgerEntries,
    upsertLedgerEntry
  });

  window.HabitFlowDomains = window.HabitFlowDomains || {};
  window.HabitFlowDomains.points = api;

  modules.register('points-domain', {
    description: 'Pure points helpers for labels, tones and ledger consistency. Safe to reuse from app.js during gradual extraction.',
    exports: Object.freeze(['normalizePoints', 'pointLabel', 'pointTone', 'dedupeLedgerEntries', 'upsertLedgerEntry'])
  });
})(window);
