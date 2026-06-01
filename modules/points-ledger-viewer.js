(function initHabitFlowPointsLedgerViewer(window, document) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (modules && modules.has('points-ledger-viewer')) return;

  function start() {
    // viewer implementation is loaded by follow-up patch
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  if (modules) {
    modules.register('points-ledger-viewer', {
      description: 'Adds a lightweight points ledger viewer to the existing points rules popover.',
      active: true
    });
  }
})(window, document);
