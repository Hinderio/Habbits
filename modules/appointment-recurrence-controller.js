(function loadSafeAppointmentFieldEnhancer(window, document) {
  'use strict';

  if (window.__HABITFLOW_APPOINTMENT_FIELD_ENHANCER_REQUESTED__) return;
  window.__HABITFLOW_APPOINTMENT_FIELD_ENHANCER_REQUESTED__ = true;

  function load() {
    if (document.querySelector('script[src^="modules/appointment-calendar-fields.js"]')) return;
    const script = document.createElement('script');
    script.src = 'modules/appointment-calendar-fields.js?v=1';
    script.async = false;
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
})(window, document);