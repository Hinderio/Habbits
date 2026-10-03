(function (window, document) {
  'use strict';
  let pending;
  function asset(url, css) {
    return new Promise((resolve, reject) => {
      const node = document.createElement(css ? 'link' : 'script');
      if (css) { node.rel = 'stylesheet'; node.href = url; } else node.src = url;
      node.onload = resolve;
      node.onerror = () => { node.remove(); reject(new Error('Ontology konnte nicht geladen werden. Bitte erneut versuchen.')); };
      document.head.append(node);
    });
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-ontology-open]');
    if (!button || button.disabled) return;
    button.disabled = true; button.setAttribute('aria-busy', 'true');
    let status = document.getElementById('ontologyLoadStatus');
    if (!status) { status = document.createElement('p'); status.id = 'ontologyLoadStatus'; status.setAttribute('role','status'); button.after(status); }
    status.textContent = 'Ontology wird geladen …';
    try {
      if (!pending) pending = (async () => {
        if (!document.getElementById('ontologyStyles')) { await asset('modules/ontology.css', true); document.querySelector('link[href="modules/ontology.css"]').id = 'ontologyStyles'; }
        if (!window.HabitFlowOntologyModel) await asset('modules/ontology-model.js');
        if (!window.HabitFlowOntology) await asset('modules/ontology.js');
      })();
      await pending;
      status.textContent = ''; window.HabitFlowOntology.open(button);
    } catch (error) { pending = null; status.textContent = error.message; }
    finally { button.disabled = false; button.removeAttribute('aria-busy'); }
  });
})(window, document);
