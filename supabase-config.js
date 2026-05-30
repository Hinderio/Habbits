window.HABITFLOW_SUPABASE_CONFIG = Object.freeze({
  url: 'https://spzytdyottsicwmmwsbl.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwenl0ZHlvdHRzaWN3bW13c2JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDE5MzksImV4cCI6MjA5MjExNzkzOX0.9Ku9KU102YaX1UhWVPntA6q7vzyvo7rCzgn68pLS9xU'
});

(function loadHabitFlowModuleShell(document) {
  'use strict';

  if (!document || !document.currentScript || document.readyState === 'complete') return;

  const scripts = [
    'modules/module-registry.js',
    'modules/points-domain.js',
    'modules/smoking-domain.js',
    'modules/alcohol-domain.js',
    'modules/domain-runtime.js',
    'modules/app-domain-facade.js',
    'modules/app-domain-facade-parity.js',
    'modules/smoking-scoring-parity.js',
    'modules/smoking-domain-persistence.js',
    'modules/alcohol-domain-parity.js',
    'modules/alcohol-domain-persistence.js',
    'modules/points-domain-parity.js',
    'modules/domain-diagnostics.js',
    'modules/state.js',
    'modules/sync.js',
    'modules/dashboard.js',
    'modules/habits.js',
    'modules/tasks.js',
    'modules/fitness.js',
    'modules/consumption.js',
    'modules/gamification.js',
    'modules/monthly-missions.js'
  ];

  document.write(scripts.map(src => `<script src="${src}"><\/script>`).join(''));
})(document);
