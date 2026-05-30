(function registerHabitFlowPointsDomainParity(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('points-domain-parity')) return;

  const STORAGE_KEY = 'habitflow-state-v1';

  function readState() {
    try {
      return JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function isLedgerLikeArray(value) {
    return Array.isArray(value) && value.some(item => item && typeof item === 'object' && (
      Object.prototype.hasOwnProperty.call(item, 'points') ||
      Object.prototype.hasOwnProperty.call(item, 'delta') ||
      Object.prototype.hasOwnProperty.call(item, 'source_type') ||
      Object.prototype.hasOwnProperty.call(item, 'source_id')
    ));
  }

  function findLedgerCandidates(state) {
    const candidates = [];
    const directKeys = [
      'pointsLedger',
      'points_ledger',
      'pointLedger',
      'point_ledger',
      'ledger',
      'xpLedger',
      'xp_ledger'
    ];

    directKeys.forEach(key => {
      if (isLedgerLikeArray(state?.[key])) candidates.push({ path: key, rows: state[key] });
    });

    ['points', 'gamification', 'score', 'scoring'].forEach(section => {
      const value = state?.[section];
      if (!value || typeof value !== 'object') return;
      directKeys.forEach(key => {
        if (isLedgerLikeArray(value[key])) candidates.push({ path: `${section}.${key}`, rows: value[key] });
      });
    });

    return candidates;
  }

  function pointValue(entry) {
    const value = Number(entry?.points ?? entry?.delta ?? entry?.value ?? 0);
    return Number.isFinite(value) ? value : null;
  }

  function sourceKey(entry) {
    const sourceType = entry?.source_type ?? entry?.sourceType ?? entry?.type ?? null;
    const sourceId = entry?.source_id ?? entry?.sourceId ?? entry?.source ?? entry?.id ?? null;
    return sourceType && sourceId ? `${sourceType}:${sourceId}` : null;
  }

  function auditLedger(candidate) {
    const points = window.HabitFlowDomains?.points;
    const rows = Array.isArray(candidate?.rows) ? candidate.rows : [];
    const seen = new Map();
    const warnings = [];
    const mismatches = [];

    rows.forEach((entry, index) => {
      const value = pointValue(entry);
      const key = sourceKey(entry);

      if (value === null) {
        warnings.push({ path: candidate.path, index, type: 'invalid_points', value: entry?.points ?? entry?.delta ?? entry?.value });
      }

      if (!key) {
        warnings.push({ path: candidate.path, index, type: 'missing_source', id: entry?.id || null });
        return;
      }

      if (seen.has(key)) {
        mismatches.push({ path: candidate.path, type: 'duplicate_source', key, firstIndex: seen.get(key), duplicateIndex: index });
        return;
      }
      seen.set(key, index);
    });

    const deduped = points?.dedupeLedgerEntries ? points.dedupeLedgerEntries(rows) : rows;
    if (Array.isArray(deduped) && deduped.length !== rows.length) {
      mismatches.push({ path: candidate.path, type: 'dedupe_length_diff', stored: rows.length, expected: deduped.length });
    }

    return { path: candidate.path, checked: rows.length, warnings, mismatches };
  }

  function verify() {
    const state = readState();
    const candidates = findLedgerCandidates(state);
    const audits = candidates.map(auditLedger);
    const report = {
      ready: Boolean(window.HabitFlowDomains?.points?.dedupeLedgerEntries),
      checkedLedgers: candidates.length,
      checkedEntries: audits.reduce((sum, audit) => sum + audit.checked, 0),
      warnings: audits.flatMap(audit => audit.warnings),
      mismatches: audits.flatMap(audit => audit.mismatches),
      paths: audits.map(audit => audit.path)
    };

    window.HabitFlowRuntime = window.HabitFlowRuntime || {};
    window.HabitFlowRuntime.pointsParity = report;

    if (report.mismatches.length || report.warnings.length) {
      console.warn('[HabitFlow/points-parity] Points ledger audit found items to inspect.', report);
    }
    return report;
  }

  function scheduleVerify() {
    [500, 2000, 6000].forEach(delay => window.setTimeout(verify, delay));
  }

  if (window.document?.readyState === 'loading') {
    window.document.addEventListener('DOMContentLoaded', scheduleVerify, { once: true });
  } else {
    scheduleVerify();
  }

  window.addEventListener('visibilitychange', () => {
    if (!window.document.hidden) verify();
  });

  window.HabitFlowRuntime = window.HabitFlowRuntime || {};
  window.HabitFlowRuntime.verifyPointsDomainParity = verify;

  modules.register('points-domain-parity', {
    description: 'Passive points and ledger audit. Reads local state only and does not mutate app data.',
    passive: true,
    exports: Object.freeze(['window.HabitFlowRuntime.verifyPointsDomainParity'])
  });
})(window);
