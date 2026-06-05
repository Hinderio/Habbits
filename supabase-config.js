window.HABITFLOW_SUPABASE_CONFIG = Object.freeze({
  url: 'https://spzytdyottsicwmmwsbl.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwenl0ZHlvdHRzaWN3bW13c2JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDE5MzksImV4cCI6MjA5MjExNzkzOX0.9Ku9KU102YaX1UhWVPntA6q7vzyvo7rCzgn68pLS9xU'
});

(function routeTopbarSyncToSettings(document) {
  'use strict';

  if (!document) return;

  document.addEventListener('DOMContentLoaded', () => {
    const syncTab = document.querySelector('.bottom-nav .nav-btn[data-target="settings"]');
    const syncButton = document.getElementById('syncNowBtn');
    const navButtons = Array.from(document.querySelectorAll('.bottom-nav .nav-btn[data-target]'));
    let lastNonSettingsTarget = 'dashboard';

    const getActiveScreen = () => (
      document.body?.dataset.activeScreen
      || document.documentElement?.dataset.activeScreen
      || document.querySelector('.bottom-nav .nav-btn.active')?.dataset.target
      || 'dashboard'
    );

    const openScreen = target => {
      const targetButton = document.querySelector(`.bottom-nav .nav-btn[data-target="${target}"]`);
      if (targetButton) targetButton.click();
    };

    navButtons.forEach(button => {
      button.addEventListener('click', () => {
        if (button.dataset.target && button.dataset.target !== 'settings') {
          lastNonSettingsTarget = button.dataset.target;
        }
      }, { capture: true });
    });

    if (syncTab) {
      syncTab.classList.add('hidden');
      syncTab.setAttribute('aria-hidden', 'true');
      syncTab.setAttribute('tabindex', '-1');
    }

    if (!syncButton || !syncTab) return;

    syncButton.setAttribute('aria-controls', 'screen-settings');
    syncButton.addEventListener('click', event => {
      const activeScreen = getActiveScreen();

      event.preventDefault();
      event.stopImmediatePropagation();

      if (activeScreen === 'settings') {
        openScreen(lastNonSettingsTarget || 'dashboard');
        return;
      }

      if (activeScreen && activeScreen !== 'settings') {
        lastNonSettingsTarget = activeScreen;
      }
      openScreen('settings');
    }, { capture: true });
  }, { once: true });
})(document);

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
    'modules/points-ledger-sync-guard.js',
    'modules/points-domain-parity.js',
    'modules/domain-diagnostics.js',
    'modules/state.js',
    'modules/sync.js',
    'modules/dashboard.js',
    'modules/habits.js',
    'modules/tasks.js',
    'modules/fitness.js',
    'modules/consumption.js',
    'modules/consumption-heatmap-flat-polish.js',
    'modules/smoke-strike-history.js',
    'modules/gamification.js',
    'modules/monthly-missions.js'
  ];

  document.write(scripts.map(src => `<script src="${src}"><\/script>`).join(''));
})(document);
