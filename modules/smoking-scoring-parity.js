(function registerHabitFlowSmokingScoringParity(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('smoking-scoring-parity')) return;

  const STORAGE_KEY = 'habitflow-state-v1';

  function readState() {
    try {
      return JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function cigaretteRows(state) {
    const candidates = [
      state?.cigarettes,
      state?.cigarette_events,
      state?.smoking?.cigarettes,
      state?.consumption?.cigarettes
    ];
    return candidates.find(Array.isArray) || [];
  }

  function rowTime(row) {
    return row?.smoked_at || row?.created_at || row?.updated_at || null;
  }

  function compareRows(rows) {
    const smoking = window.HabitFlowDomains?.smoking;
    if (!smoking?.scoreInterval) {
      return { ready: false, checked: 0, mismatches: [] };
    }

    const sorted = rows
      .filter(row => row && !row.deleted_at)
      .slice()
      .sort((a, b) => new Date(rowTime(a) || 0) - new Date(rowTime(b) || 0));

    const mismatches = [];
    sorted.forEach((row, index) => {
      const previous = index > 0 ? sorted[index - 1] : null;
      const score = previous ? smoking.scoreInterval(rowTime(previous), rowTime(row)) : smoking.scoreInterval(null, rowTime(row));
      if (!Number.isFinite(Number(row.points))) return;
      const stored = Number(row.points || 0);
      const expected = Number(score.points || 0);
      if (stored !== expected) {
        mismatches.push({
          id: row.id || row.local_id || null,
          smoked_at: rowTime(row),
          stored,
          expected,
          intervalMinutes: score.intervalMinutes,
          scoringIntervalMinutes: score.scoringIntervalMinutes,
          sleepDeductedMinutes: score.sleepDeductedMinutes,
          sleepBridge: score.sleepBridge
        });
      }
    });

    return { ready: true, checked: sorted.length, mismatches };
  }

  function verify() {
    const state = readState();
    const report = compareRows(cigaretteRows(state));
    window.HabitFlowRuntime = window.HabitFlowRuntime || {};
    window.HabitFlowRuntime.smokingParity = report;
    if (report.ready && report.mismatches.length) {
      console.warn('[HabitFlow/smoking-parity] Domain scoring differs from stored cigarette rows.', report);
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
  window.HabitFlowRuntime.verifySmokingScoringParity = verify;

  modules.register('smoking-scoring-parity', {
    description: 'Passive parity check between stored cigarette points and the smoking domain scorer. Does not mutate app state.',
    passive: true,
    exports: Object.freeze(['window.HabitFlowRuntime.verifySmokingScoringParity'])
  });
})(window);
