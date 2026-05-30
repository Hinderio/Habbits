(function registerHabitFlowDomainDiagnostics(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('domain-diagnostics')) return;

  const EXPECTED_MODULES = Object.freeze([
    'points-domain',
    'smoking-domain',
    'alcohol-domain',
    'domain-runtime',
    'smoking-scoring-parity',
    'smoking-domain-persistence',
    'alcohol-domain-parity',
    'alcohol-domain-persistence',
    'points-domain-parity'
  ]);

  function hasModule(name) {
    return typeof modules.has === 'function' ? modules.has(name) : Boolean(modules.get?.(name));
  }

  function verify() {
    const missingModules = EXPECTED_MODULES.filter(name => !hasModule(name));
    const domains = window.HabitFlowDomains || {};
    const runtime = window.HabitFlowRuntime || {};
    const missingApis = [];

    if (!domains.points?.dedupeLedgerEntries) missingApis.push('HabitFlowDomains.points.dedupeLedgerEntries');
    if (!domains.smoking?.scoreInterval) missingApis.push('HabitFlowDomains.smoking.scoreInterval');
    if (!domains.alcohol?.countUnitsForDay) missingApis.push('HabitFlowDomains.alcohol.countUnitsForDay');
    if (!runtime.domains?.smokeScore) missingApis.push('HabitFlowRuntime.domains.smokeScore');
    if (!runtime.verifySmokingScoringParity) missingApis.push('HabitFlowRuntime.verifySmokingScoringParity');
    if (!runtime.verifyAlcoholDomainParity) missingApis.push('HabitFlowRuntime.verifyAlcoholDomainParity');
    if (!runtime.verifyPointsDomainParity) missingApis.push('HabitFlowRuntime.verifyPointsDomainParity');

    const report = {
      ready: missingModules.length === 0 && missingApis.length === 0,
      missingModules,
      missingApis,
      smokingParity: runtime.smokingParity || null,
      alcoholParity: runtime.alcoholParity || null,
      pointsParity: runtime.pointsParity || null,
      checkedAt: new Date().toISOString()
    };

    window.HabitFlowRuntime = window.HabitFlowRuntime || {};
    window.HabitFlowRuntime.domainDiagnostics = report;

    if (!report.ready) {
      console.warn('[HabitFlow/domain-diagnostics] Domain runtime is incomplete.', report);
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
