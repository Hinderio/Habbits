(function initHabitFlowModuleRegistry(window) {
  'use strict';

  if (!window || window.HabitFlowModules?.__isHabitFlowRegistry) return;

  const registry = new Map();
  const loadOrder = [];

  function normalizeName(name) {
    return String(name || '').trim().toLowerCase();
  }

  function freezePlainObject(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => freezePlainObject(value[key]));
    return Object.freeze(value);
  }

  function register(name, definition) {
    const normalizedName = normalizeName(name);
    if (!normalizedName) {
      throw new Error('HabitFlowModules.register requires a module name.');
    }

    if (registry.has(normalizedName)) {
      return registry.get(normalizedName);
    }

    const moduleDefinition = freezePlainObject({
      name: normalizedName,
      version: '1.0.0',
      loadedAt: new Date().toISOString(),
      ...(definition || {})
    });

    registry.set(normalizedName, moduleDefinition);
    loadOrder.push(normalizedName);
    return moduleDefinition;
  }

  function get(name) {
    return registry.get(normalizeName(name)) || null;
  }

  function has(name) {
    return registry.has(normalizeName(name));
  }

  function list() {
    return loadOrder.map(name => registry.get(name));
  }

  function preloadModule(src, id) {
    if (!window.document || window.document.readyState === 'complete') return;
    if (id && window.document.getElementById(id)) return;
    const script = window.document.createElement('script');
    if (id) script.id = id;
    script.src = src;
    script.async = false;
    const parent = window.document.currentScript?.parentNode || window.document.head || window.document.documentElement;
    parent.insertBefore(script, window.document.currentScript?.nextSibling || null);
  }

  window.HabitFlowModules = Object.freeze({
    __isHabitFlowRegistry: true,
    register,
    get,
    has,
    list
  });

  preloadModule('modules/dashboard-visual-tokens.js', 'dashboardVisualTokensModuleScript');
  preloadModule('modules/points-ledger-remote-authority.js', 'pointsLedgerRemoteAuthorityScript');
})(window);
