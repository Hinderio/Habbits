(function patchHabitFlowProjectFormData(window, document) {
  'use strict';

  if (window.__habitflowProjectFormDataPatched) return;
  window.__habitflowProjectFormDataPatched = true;

  const NativeFormData = window.FormData;

  function resolveForm(candidate) {
    if (candidate instanceof window.HTMLFormElement) return candidate;

    const activeElement = document.activeElement;
    if (activeElement && typeof activeElement.closest === 'function') {
      const activeForm = activeElement.closest('form');
      if (activeForm instanceof window.HTMLFormElement) return activeForm;
    }

    const projectForm = document.getElementById('projectForm');
    if (projectForm instanceof window.HTMLFormElement) return projectForm;

    const phaseForm = document.querySelector('[data-project-phase-form]');
    if (phaseForm instanceof window.HTMLFormElement) return phaseForm;

    return candidate;
  }

  function PatchedFormData(form, submitter) {
    return new NativeFormData(resolveForm(form), submitter);
  }

  PatchedFormData.prototype = NativeFormData.prototype;
  Object.setPrototypeOf(PatchedFormData, NativeFormData);

  window.FormData = PatchedFormData;
})(window, document);
