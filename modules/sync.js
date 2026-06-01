(function registerHabitFlowSyncModule(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('sync')) return;

  const tables = Object.freeze([
    'habit_definitions',
    'habit_entries',
    'cigarette_events',
    'alcohol_logs',
    'alcohol_events',
    'pause_periods',
    'weekly_reviews',
    'monthly_missions',
    'tasks',
    'task_ideas',
    'activity_ideas',
    'appointments',
    'learning_vault',
    'points_ledger'
  ]);

  function getConfigStatus() {
    const config = window.HABITFLOW_SUPABASE_CONFIG || {};
    return Object.freeze({
      hasUrl: Boolean(config.url),
      hasAnonKey: Boolean(config.anonKey),
      isConfigured: Boolean(config.url && config.anonKey)
    });
  }

  modules.register('sync', {
    description: 'Sync contract and Supabase table map. app.js remains the active sync runner; feature modules may use their own local-first remote sync.',
    dependsOn: Object.freeze(['state']),
    policy: Object.freeze({
      primarySource: 'Supabase after login',
      localCache: 'offline cache and UI persistence only',
      mergeRule: 'prefer row timestamps and explicit user actions over stale cache',
      authRule: 'all sensitive rows stay scoped through Supabase Auth and RLS'
    }),
    tables,
    getConfigStatus
  });
})(window);
