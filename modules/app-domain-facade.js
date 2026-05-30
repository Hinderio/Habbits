(function registerHabitFlowAppDomainFacade(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('app-domain-facade')) return;

  function domains() {
    return window.HabitFlowDomains || {};
  }

  function runtimeDomains() {
    return window.HabitFlowRuntime?.domains || {};
  }

  function getSmokingScore(previousAt, currentAt, fallback = null) {
    const runtime = runtimeDomains();
    if (typeof runtime.smokeScore === 'function') {
      const score = runtime.smokeScore(previousAt, currentAt);
      if (score && typeof score === 'object') return score;
    }
    const smoking = domains().smoking;
    if (typeof smoking?.scoreInterval === 'function') {
      return smoking.scoreInterval(previousAt, currentAt);
    }
    return fallback;
  }

  function getSmokingPointsForInterval(minutes, options = {}, fallback = 0) {
    const smoking = domains().smoking;
    if (typeof smoking?.pointsForScoringInterval === 'function') {
      const value = Number(smoking.pointsForScoringInterval(minutes, options));
      return Number.isFinite(value) ? value : fallback;
    }
    return fallback;
  }

  function getAlcoholStats(events = [], options = {}) {
    const alcohol = domains().alcohol;
    const date = options.date || new Date();
    const days = Number(options.days || 30);
    return Object.freeze({
      todayUnits: typeof alcohol?.countUnitsForDay === 'function' ? alcohol.countUnitsForDay(events, date) : 0,
      activeDays: typeof alcohol?.activeDrinkingDays === 'function' ? alcohol.activeDrinkingDays(events, days) : 0,
      totalUnits: typeof alcohol?.totalUnits === 'function' ? alcohol.totalUnits(events, days) : 0
    });
  }

  function getPointLabel(points, fallback = '') {
    const pointDomain = domains().points;
    if (typeof pointDomain?.pointLabel === 'function') return pointDomain.pointLabel(points);
    const numeric = Number(points || 0);
    if (!Number.isFinite(numeric)) return fallback;
    return `${numeric > 0 ? '+' : ''}${numeric} PKT.`;
  }

  function getPointTone(points, fallback = 'neutral') {
    const pointDomain = domains().points;
    if (typeof pointDomain?.pointTone === 'function') return pointDomain.pointTone(points);
    const numeric = Number(points || 0);
    if (!Number.isFinite(numeric) || numeric === 0) return fallback;
    return numeric > 0 ? 'positive' : 'negative';
  }

  const api = Object.freeze({
    getSmokingScore,
    getSmokingPointsForInterval,
    getAlcoholStats,
    getPointLabel,
    getPointTone
  });

  window.HabitFlowRuntime = window.HabitFlowRuntime || {};
  window.HabitFlowRuntime.appDomainFacade = api;

  modules.register('app-domain-facade', {
    description: 'Stable facade for app.js to consume domain helpers incrementally with legacy fallbacks.',
    exports: Object.freeze(Object.keys(api))
  });
})(window);
