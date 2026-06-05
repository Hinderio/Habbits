(function patchHabitFlowProjectSubmitCurrentTarget(window, document) {
  'use strict';

  if (window.__habitFlowProjectSubmitCurrentTargetPatched) return;

  const descriptor = Object.getOwnPropertyDescriptor(window.Event.prototype, 'currentTarget');
  if (!descriptor || typeof descriptor.get !== 'function' || descriptor.configurable !== true) return;

  Object.defineProperty(window.Event.prototype, 'currentTarget', {
    configurable: true,
    enumerable: descriptor.enumerable,
    get() {
      const currentTarget = descriptor.get.call(this);
      const target = this.target;
      if (
        this.type === 'submit' &&
        currentTarget === document &&
        target instanceof window.HTMLFormElement &&
        (target.id === 'projectForm' || target.matches('[data-project-phase-form]'))
      ) {
        return target;
      }
      return currentTarget;
    }
  });

  window.__habitFlowProjectSubmitCurrentTargetPatched = true;
})(window, document);
