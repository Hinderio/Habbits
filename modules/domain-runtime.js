(function registerHabitFlowDomainRuntime(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('domain-runtime')) return;

  function getDomains() {
    return window.HabitFlowDomains || {};
  }

  function isReady() {
    const domains = getDomains();
    return Boolean(
      domains.points?.pointLabel &&
      domains.smoking?.scoreInterval &&
      domains.alcohol?.countUnitsForDay
    );
  }

  function smokeScore(previousAt, currentAt) {
    const domain = getDomains().smoking;
    if (!domain?.scoreInterval) return null;
    return domain.scoreInterval(previousAt, currentAt);
  }

  function smokeRecalculate(events) {
    const domain = getDomains().smoking;
    if (!domain?.recalculateEvents) return Array.isArray(events) ? events.slice() : [];
    return domain.recalculateEvents(events);
  }

  function alcoholUnitsForDay(events, day) {
    const domain = getDomains().alcohol;
    if (!domain?.countUnitsForDay) return 0;
    return domain.countUnitsForDay(events, day);
  }

  function pointLabel(points) {
    const domain = getDomains().points;
    return domain?.pointLabel ? domain.pointLabel(points) : `${Number(points || 0) > 0 ? '+' : ''}${Number(points || 0)} Pkt.`;
  }

  const api = Object.freeze({
    isReady,
    smokeScore,
    smokeRecalculate,
    alcoholUnitsForDay,
    pointLabel
  });

  window.HabitFlowRuntime = window.HabitFlowRuntime || {};
  window.HabitFlowRuntime.domains = api;

  modules.register('domain-runtime', {
    description: 'Safe runtime adapter for domain modules. Keeps app.js migration incremental and regression-safe.',
    ready: isReady(),
    exports: Object.freeze(['smokeScore', 'smokeRecalculate', 'alcoholUnitsForDay', 'pointLabel'])
  });
})(window);
