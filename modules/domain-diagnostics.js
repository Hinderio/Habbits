(function registerHabitFlowDomainDiagnostics(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('domain-diagnostics')) return;

  const EXPECTED_MODULES = Object.freeze([
    'points-domain',
    'smoking-domain',
    'alcohol-domain',
    'domain-runtime',
    'app-domain-facade',
    'app-domain-facade-parity',
    'smoking-scoring-parity',
    'smoking-domain-persistence',
    'alcohol-domain-parity',
    'alcohol-domain-persistence',
    'points-domain-parity'
  ]);

  function hasModule(name) {
    return typeof modules.has === 'function' ? modules.has(name) : Boolean(modules.get?.(name));
  }

  function isCleanParity(report) {
    return Boolean(report?.ready) && Array.isArray(report?.mismatches) && report.mismatches.length === 0;
  }

  function verify() {
    const missingModules = EXPECTED_MODULES.filter(name => !hasModule(name));
    const domains = window.HabitFlowDomains || {};
    const runtime = window.HabitFlowRuntime || {};
    const missingApis = [];

    if (!domains.points?.dedupeLedgerEntries) missingApis.push('HabitFlowDomains.points.dedupeLedgerEntries');
    if (!domains.points?.pointLabel) missingApis.push('HabitFlowDomains.points.pointLabel');
    if (!domains.points?.pointTone) missingApis.push('HabitFlowDomains.points.pointTone');
    if (!domains.smoking?.scoreInterval) missingApis.push('HabitFlowDomains.smoking.scoreInterval');
    if (!domains.alcohol?.countUnitsForDay) missingApis.push('HabitFlowDomains.alcohol.countUnitsForDay');
    if (!runtime.domains?.smokeScore) missingApis.push('HabitFlowRuntime.domains.smokeScore');
    if (!runtime.appDomainFacade?.getSmokingScore) missingApis.push('HabitFlowRuntime.appDomainFacade.getSmokingScore');
    if (!runtime.appDomainFacade?.getAlcoholStats) missingApis.push('HabitFlowRuntime.appDomainFacade.getAlcoholStats');
    if (!runtime.verifySmokingScoringParity) missingApis.push('HabitFlowRuntime.verifySmokingScoringParity');
    if (!runtime.verifyAlcoholDomainParity) missingApis.push('HabitFlowRuntime.verifyAlcoholDomainParity');
    if (!runtime.verifyPointsDomainParity) missingApis.push('HabitFlowRuntime.verifyPointsDomainParity');
    if (!runtime.verifyAppDomainFacadeParity) missingApis.push('HabitFlowRuntime.verifyAppDomainFacadeParity');

    const smokingParity = runtime.verifySmokingScoringParity?.() || runtime.smokingParity || null;
    const alcoholParity = runtime.verifyAlcoholDomainParity?.() || runtime.alcoholParity || null;
    const pointsParity = runtime.verifyPointsDomainParity?.() || runtime.pointsParity || null;
    const facadeParity = runtime.verifyAppDomainFacadeParity?.() || runtime.appDomainFacadeParity || null;

    const parityReports = { smokingParity, alcoholParity, pointsParity, facadeParity };
    const parityClean = Object.values(parityReports).every(report => report === null || isCleanParity(report));
    const migrationReady = missingModules.length === 0 && missingApis.length === 0 && parityClean;

    const report = {
      ready: missingModules.length === 0 && missingApis.length === 0,
      migrationReady,
      missingModules,
      missingApis,
      parityClean,
      smokingParity,
      alcoholParity,
      pointsParity,
      facadeParity,
      checkedAt: new Date().toISOString()
    };

    window.HabitFlowRuntime = window.HabitFlowRuntime || {};
    window.HabitFlowRuntime.domainDiagnostics = report;

    if (!report.ready || !report.migrationReady) {
      console.warn('[HabitFlow/domain-diagnostics] Domain migration is not fully ready yet.', report);
    }
    return report;
  }

  function scheduleVerify() {
    [800, 2500, 6500].forEach(delay => window.setTimeout(verify, delay));
  }

  if (window.document?.readyState === 'loading') {
    window.document.addEventListener('DOMContentLoaded', scheduleVerify, { once: true });
  } else {
    scheduleVerify();
  }

  window.HabitFlowRuntime = window.HabitFlowRuntime || {};
  window.HabitFlowRuntime.verifyDomainDiagnostics = verify;

  modules.register('domain-diagnostics', {
    description: 'Runtime diagnostics for domain modules and migration readiness. Passive only.',
    passive: true,
    exports: Object.freeze(['window.HabitFlowRuntime.verifyDomainDiagnostics'])
  });
})(window);
