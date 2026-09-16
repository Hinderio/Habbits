(function installHabitFlowPersistence(window) {
  'use strict';

  if (window.HabitFlowPersistence) return;
  const KEY = 'habitflow-state-v1';
  const storage = window.localStorage;
  if (!storage?.getItem || !storage?.setItem) return;
  const getItem = storage.getItem.bind(storage);
  const setItem = storage.setItem.bind(storage);
  const stages = new Map();
  let cachedRaw;
  let cachedState;
  let lastWrittenRaw;

  // The cache owns only parsed storage data, never the application's mutable
  // state. Always compare native storage first, including writes by other tabs.
  function parseStored(raw) {
    if (raw !== cachedRaw) {
      cachedState = JSON.parse(raw);
      cachedRaw = raw;
    }
    return cachedState;
  }

  function applyStage(stage, operation, state, context) {
    try {
      const result = stage[operation]?.(state, context);
      return result?.changed ? result : { state, changed: false };
    } catch (error) {
      console.warn('[HabitFlow/persistence] State normalizer skipped.', error);
      return { state, changed: false };
    }
  }

  function readStored() {
    const raw = getItem(KEY);
    if (typeof raw !== 'string' || !raw.trim().startsWith('{')) return { raw, state: null };
    let state;
    try { state = parseStored(raw); } catch { return { raw, state: null }; }
    const context = { operation: 'read', trustedSmoking: raw === lastWrittenRaw };
    let changed = false;
    let persist = false;
    for (const stage of stages.values()) {
      const result = applyStage(stage, 'read', state, context);
      state = result.state;
      changed = changed || result.changed;
      persist = persist || (result.changed && stage.persistRead === true);
    }
    const normalized = changed ? JSON.stringify(state) : raw;
    // Ledger repairs historically persist on read. Other read normalizers do
    // not. Preserve that distinction and propagate storage failures.
    if (persist && normalized !== raw) setItem(KEY, normalized);
    return { raw: normalized, state };
  }

  function persistState(state, options = {}) {
    let previous;
    const context = {
      ...options,
      operation: 'write',
      previous() {
        if (!previous) previous = readStored();
        return previous.state || {};
      }
    };
    // Nested legacy wrappers ran the most recently installed writer first.
    for (const stage of [...stages.values()].reverse()) {
      state = applyStage(stage, 'write', state, context).state;
    }
    const serialized = JSON.stringify(state);
    setItem(KEY, serialized);
    // Update only after a successful durable write. Do not retain live objects.
    lastWrittenRaw = serialized;
  }

  storage.getItem = function getStateItem(key) {
    return key === KEY ? readStored().raw : getItem(key);
  };
  function setStateItem(key, value) {
    if (key !== KEY || typeof value !== 'string' || !value.trim().startsWith('{')) return setItem(key, value);
    let state;
    try { state = JSON.parse(value); } catch { return setItem(key, value); }
    return persistState(state);
  }
  storage.setItem = setStateItem;

  function isReady() {
    return storage.setItem === setStateItem && ['smoking', 'alcohol', 'points-ledger', 'projects'].every(name => stages.has(name));
  }

  function writeState(state, options = {}) {
    // An interrupted asset update may leave an older wrapper installed. Route
    // through that chain until all object stages own the write path.
    if (!isReady()) {
      const serialized = JSON.stringify(state);
      if (options.skipSmokingNormalization) window.HabitFlowRuntime?.skipNextSmokingDomainPersistenceNormalization?.();
      return storage.setItem(KEY, serialized);
    }
    return persistState(state, options);
  }

  window.HabitFlowPersistence = Object.freeze({
    writeState,
    isReady,
    register(name, stage) { if (!stages.has(name)) stages.set(name, stage); },
    has(name) { return stages.has(name); }
  });
})(window);
