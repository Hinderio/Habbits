(function installHabitFlowCalendarPerformanceWorker(window) {
  'use strict';

  if (!('serviceWorker' in navigator)) return;
  if (navigator.serviceWorker.__habitFlowCalendarPerformanceWorker) return;

  const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
  navigator.serviceWorker.__habitFlowCalendarPerformanceWorker = true;
  navigator.serviceWorker.register = function registerHabitFlowWorker(scriptURL, options) {
    const requested = String(scriptURL || '');
    const shouldUsePerformanceWorker = requested === './service-worker.js'
      || requested === 'service-worker.js'
      || requested.endsWith('/service-worker.js');
    return originalRegister(shouldUsePerformanceWorker ? './calendar-performance-worker.js' : scriptURL, options);
  };
})(window);
