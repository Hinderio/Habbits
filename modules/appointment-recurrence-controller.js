(function loadSafeAppointmentRecurrenceBridge(window, document) {
  'use strict';

  function loadScript(src, flag) {
    if (flag && window[flag]) return;
    if (flag) window[flag] = true;
    if (document.querySelector(`script[src^="${src.split('?')[0]}"]`)) return;
    if (document.readyState === 'loading') {
      document.write(`<script src="${src}"><\/script>`);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }

  loadScript('modules/appointment-native-recurrence-bridge.js?v=1', '__HABITFLOW_NATIVE_APPOINTMENT_RECURRENCE_BRIDGE_REQUESTED__');
  loadScript('modules/appointment-calendar-fields.js?v=1', '__HABITFLOW_APPOINTMENT_FIELD_ENHANCER_REQUESTED__');
})(window, document);