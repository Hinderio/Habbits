(function registerHabitFlowAppDomainFacadeParity(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('app-domain-facade-parity')) return;

  const STORAGE_KEY = 'habitflow-state-v1';

  function readState() {
    try {
      return JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function firstArray(candidates) {
    return candidates.find(Array.isArray) || [];
  }

  function cigaretteRows(state) {
    return firstArray([
      state?.cigarettes,
      state?.cigarette_events,
      state?.smoking?.cigarettes,
      state?.consumption?.cigarettes
    ]);
  }

  function alcoholRows(state) {
    return firstArray([
      state?.alcohol,
      state?.alcoholUnits,
      state?.alcohol_units,
      state?.alcohol_events,
      state?.drinks,
      state?.drink_events,
      state?.consumption?.alcohol,
      state?.consumption?.alcoholUnits,
      state?.consumption?.alcohol_units,
      state?.consumption?.drinks
    ]);
  }

  function rowTime(row) {
    return row?.smoked_at || row?.created_at || row?.updated_at || null;
  }

  function compareNumber(a, b) {
    const left = Number(a ?? 0);
    const right = Number(b ?? 0);
    return Number.isFinite(left) && Number.isFinite(right) && left === right;
  }

  function verifySmokingFacade(state, facade, smoking) {
    const rows = cigaretteRows(state)
      .filter(row => row && !row.deleted_at)
      .slice()
      .sort((a, b) => new Date(rowTime(a) || 0) - new Date(rowTime(b) || 0));
    const mismatches = [];

    rows.forEach((row, index) => {
      const previous = index > 0 ? rows[index - 1] : null;
      const previousAt = previous ? rowTime(previous) : null;
      const currentAt = rowTime(row);
      const direct = smoking.scoreInterval(previousAt, currentAt);
      const viaFacade = facade.getSmokingScore(previousAt, currentAt);
      if (!viaFacade || !compareNumber(viaFacade.points, direct.points) || !compareNumber(viaFacade.scoringIntervalMinutes, direct.scoringIntervalMinutes)) {
        mismatches.push({ type: 'smoking_score', id: row.id || row.local_id || null, direct, viaFacade });
      }
    });

    return { checked: rows.length, mismatches };
  }

  function verifyAlcoholFacade(state, facade, alcohol) {
    const rows = alcoholRows(state).filter(row => row && !row.deleted_at);
    const direct = {
      todayUnits: alcohol.countUnitsForDay(rows, new Date()),
      activeDays: alcohol.activeDrinkingDays(rows, 30),
      totalUnits: alcohol.totalUnits(rows, 30)
    };
    const viaFacade = facade.getAlcoholStats(rows, { days: 30 });
    const mismatches = [];
    ['todayUnits', 'activeDays', 'totalUnits'].forEach(key => {
      if (!compareNumber(viaFacade?.[key], direct[key])) {
        mismatches.push({ type: 'alcohol_stats', key, direct: direct[key], viaFacade: viaFacade?.[key] });
      }
    });
    return { checked: rows.length, mismatches };
  }

  function verifyPointsFacade(facade, points) {
    const samples = [-40, -20, 0, 20, 60, 100];
    const mismatches = [];
    samples.forEach(value => {
      const directLabel = points.pointLabel(value);
      const facadeLabel = facade.getPointLabel(value);
      const directTone = points.pointTone(value);
      const facadeTone = facade.getPointTone(value);
      if (directLabel !== facadeLabel) mismatches.push({ type: 'point_label', value, direct: directLabel, viaFacade: facadeLabel });
      if (directTone !== facadeTone) mismatches.push({ type: 'point_tone', value, direct: directTone, viaFacade: facadeTone });
    });
    return { checked: samples.length, mismatches };
  }

  function verify() {
    const facade = window.HabitFlowRuntime?.appDomainFacade;
    const domains = window.HabitFlowDomains || {};
    const state = readState();
    const missingApis = [];

    if (!facade?.getSmokingScore) missingApis.push('appDomainFacade.getSmokingScore');
    if (!facade?.getAlcoholStats) missingApis.push('appDomainFacade.getAlcoholStats');
    if (!facade?.getPointLabel) missingApis.push('appDomainFacade.getPointLabel');
    if (!facade?.getPointTone) missingApis.push('appDomainFacade.getPointTone');
    if (!domains.smoking?.scoreInterval) missingApis.push('HabitFlowDomains.smoking.scoreInterval');
    if (!domains.alcohol?.countUnitsForDay) missingApis.push('HabitFlowDomains.alcohol.countUnitsForDay');
    if (!domains.alcohol?.activeDrinkingDays) missingApis.push('HabitFlowDomains.alcohol.activeDrinkingDays');
    if (!domains.alcohol?.totalUnits) missingApis.push('HabitFlowDomains.alcohol.totalUnits');
    if (!domains.points?.pointLabel) missingApis.push('HabitFlowDomains.points.pointLabel');
    if (!domains.points?.pointTone) missingApis.push('HabitFlowDomains.points.pointTone');

    const sections = [];
    if (!missingApis.length) {
      sections.push(verifySmokingFacade(state, facade, domains.smoking));
      sections.push(verifyAlcoholFacade(state, facade, domains.alcohol));
      sections.push(verifyPointsFacade(facade, domains.points));
    }

    const report = {
      ready: missingApis.length === 0 && sections.every(section => section.mismatches.length === 0),
      missingApis,
      checked: sections.reduce((sum, section) => sum + section.checked, 0),
      mismatches: sections.flatMap(section => section.mismatches),
      checkedAt: new Date().toISOString()
    };

    window.HabitFlowRuntime = window.HabitFlowRuntime || {};
    window.HabitFlowRuntime.appDomainFacadeParity = report;

    if (!report.ready) {
      console.warn('[HabitFlow/app-domain-facade-parity] Facade differs from direct domain output.', report);
    }
    return report;
  }

  function scheduleVerify() {
    [700, 2400, 6200].forEach(delay => window.setTimeout(verify, delay));
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
  window.HabitFlowRuntime.verifyAppDomainFacadeParity = verify;

  modules.register('app-domain-facade-parity', {
    description: 'Passive parity check for the app domain facade before app.js consumes it.',
    passive: true,
    exports: Object.freeze(['window.HabitFlowRuntime.verifyAppDomainFacadeParity'])
  });
})(window);
