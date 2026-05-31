(function registerHabitFlowStateModule(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('state')) return;

  const keys = Object.freeze({
    appState: 'habitflow-state-v1',
    appSchema: 'habitflow-app-data-schema-version',
    settings: 'habitflow-settings-v1',
    theme: 'habitflow-theme',
    trendMetric: 'habitflow-trend-metric',
    dashboardWindow: 'habitflow-dashboard-chart-window-v1',
    coachSession: 'habitflow-coach-session-v1',
    morningRoutineSession: 'habitflow-morning-routine-session-v1',
    rulesUi: 'habitflow-rules-open',
    habitDnaUi: 'habitflow-habit-dna-open',
    habitCardsUi: 'habitflow-habit-cards-open',
    consumptionMode: 'habitflow-consumption-mode',
    leisureFilters: 'habitflow-leisure-filters-v1',
    gamificationLocked: 'habitflow-gamification-show-locked-v1',
    gamificationBadgeShelf: 'habitflow-gamification-badge-shelf-v1',
    habitsExperience: 'habitflow-habits-experience-v1',
    fitnessFilter: 'habitflow-fitness-filter-v1',
    fitnessDetailTab: 'habitflow-fitness-detail-tab-v1',
    fitnessMobileSections: 'habitflow-fitness-mobile-sections-v1',
    fitnessCoachState: 'habitflow-fitness-coach-state-v1',
    remoteDeleteArchive: 'habitflow-remote-delete-archive-v1',
    monthlyMissionForm: 'habitflow-monthly-mission-form-v1',
    learningVault: 'habitflow-learning-vault-v1'
  });

  function readJson(key, fallback = null) {
    try {
      const raw = window.localStorage?.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (error) {
      console.warn('[HabitFlow/state] Could not read local JSON state.', { key, error });
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage?.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('[HabitFlow/state] Could not persist local JSON state.', { key, error });
      return false;
    }
  }

  function remove(key) {
    try {
      window.localStorage?.removeItem(key);
      return true;
    } catch (error) {
      console.warn('[HabitFlow/state] Could not remove local state.', { key, error });
      return false;
    }
  }

  function loadPreAppModule(src) {
    if (!window.document || window.document.readyState === 'complete') return;
    window.document.write(`<script src="${src}"><\/script>`);
  }

  modules.register('state', {
    description: 'Central registry for state keys and safe localStorage access. Does not replace app.js state yet.',
    sourceOfTruth: Object.freeze({
      remote: 'Supabase rows after authenticated sync',
      local: 'offline cache and UI persistence only',
      ui: 'short-lived DOM/session state'
    }),
    keys,
    readJson,
    writeJson,
    remove
  });

  loadPreAppModule('modules/weekly-autosave.js');
  loadPreAppModule('modules/quick-capture-button-style.js');
  loadPreAppModule('modules/remote-cache-reconcile.js');
  loadPreAppModule('modules/learning-vault.js');
})(window);
