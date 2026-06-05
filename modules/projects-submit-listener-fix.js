(function patchHabitFlowProjectSubmitListeners(window, document) {
  'use strict';

  if (window.__habitFlowProjectSubmitListenerPatched) return;

  const originalAddEventListener = document.addEventListener.bind(document);

  function isProjectForm(node) {
    return node instanceof window.HTMLFormElement && (node.id === 'projectForm' || node.matches('[data-project-phase-form]'));
  }

  function wrapSubmitListener(listener) {
    if (typeof listener !== 'function') return listener;

    return function patchedProjectSubmitListener(event) {
      if (!isProjectForm(event.target)) {
        return listener.call(this, event);
      }

      const proxyEvent = Object.create(event);
      Object.defineProperty(proxyEvent, 'currentTarget', {
        configurable: true,
        enumerable: true,
        get() {
          return event.target;
        }
      });

      return listener.call(this, proxyEvent);
    };
  }

  document.addEventListener = function patchedAddEventListener(type, listener, options) {
    if (type === 'submit') {
      return originalAddEventListener(type, wrapSubmitListener(listener), options);
    }
    return originalAddEventListener(type, listener, options);
  };

  window.__habitFlowProjectSubmitListenerPatched = true;
})(window, document);
