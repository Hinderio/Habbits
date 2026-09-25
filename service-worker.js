const CACHE_NAME = 'habitflow-v288-ghost-arena-production-monthly-sync-289-alcohol-points-290-sync-integrity-291-monthly-freshness-292-weekly-notes-293-weekly-habit-card-294-habit-pb-295-habit-actions-296-points-details-297-companion-consistency-298-smoke-bonus-pause-299-swimming-points-300-magazine-covers-301-life-coach-302-coach-agenda-304-coach-agenda-groups-305-gifts-306-alcohol-analysis-307-smooth-line-308-umlauts-309-weblinks-310-list-palette-311-golden-palette-312-project-usability-314-pause-layout-315-pause-border-316-monthly-expand-317-coach-backlog-318-calendar-event-types-319-list-tint-320-line-calendar-layout-321-calendar-history-322-calendar-performance-323-appointment-edit-324-calendar-render-325-alcohol-year-ratings-326-list-tint-327-list-tint-328-weekly-height-329-roadmap-332-routine-habits-333-weekly-points-334-weekly-layout-335-single-squares-336-smoking-weekly-337';
const MODULE_ASSETS = [
  './modules/weekly-points-domain.js',
  './modules/weekly-points.js',
  './modules/weekly-points.css',
  './modules/roadmap-loader.js',
  './modules/roadmap-domain.js',
  './modules/roadmap.js',
  './modules/roadmap.css',
  './modules/consumption-year-overview.js',
  './modules/life-coach.js',
  './modules/life-coach.css',
  './modules/points-details.js',
  './modules/points-details.css',
  './modules/module-registry.js',
  './modules/state-persistence.js',
  './modules/points-domain.js',
  './modules/smoking-domain.js',
  './modules/alcohol-domain.js',
  './modules/domain-runtime.js',
  './modules/app-domain-facade.js',
  './modules/app-domain-facade-parity.js',
  './modules/smoking-scoring-parity.js',
  './modules/smoking-domain-persistence.js',
  './modules/alcohol-domain-parity.js',
  './modules/alcohol-domain-persistence.js',
  './modules/sync-integrity.js',
  './modules/points-domain-parity.js',
  './modules/domain-diagnostics.js',
  './modules/state.js',
  './modules/sync.js',
  './modules/weekly-autosave.js',
  './modules/quick-capture-button-style.js',
  './modules/remote-cache-reconcile.js',
  './modules/dashboard.js',
  './modules/habit-defaults-extension.js',
  './modules/habits.js',
  './modules/habit-story-coverage.js',
  './modules/habit-personal-best.css',
  './modules/ghost-arena.js',
  './modules/ghost-arena.css',
  './modules/tasks.js',
  './modules/task-swimlane-view.js',
  './modules/task-swimlane-view.css',
  './modules/fitness.js',
  './modules/consumption.js',
  './modules/smoking-tip-modal.js',
  './modules/smoking-top-cards-polish.js',
  './modules/consumption-time-profile.js',
  './modules/pause-period-edit.js',
  './modules/craving-coach-v2.js',
  './modules/craving-coach-v2-actions-polish.js',
  './modules/gamification.js',
  './modules/monthly-missions.js',
  './modules/lists.js',
  './modules/lists.css',
  './modules/line-calendar.js',
  './modules/line-calendar.css',
  './modules/calendar-bubbles-native.css',
  './modules/fitness-detail-mobile.css',
  './modules/smoke-ring-premium.css',
  './modules/projects-milestone-edit.js',
  './modules/projects.js',
  './modules/projects.css',
  './modules/projects-mobile-fix.css',
  './modules/project-task-form-bridge.js',
  './modules/project-idea-form-bridge.js',
  './modules/project-unlink-persistence-fix.js',
  './modules/projects-ui-polish.js',
  './modules/project-timeline-view.js'
];
const SQL_ASSETS = ['./sql/add-appointment-series.sql', './sql/add-projects.sql', './sql/add-task-steps.sql', './sql/add-alcohol-daily-intensity.sql'];
const ASSETS = ['./', './index.html', './style.css', './app.js', './supabase-config.js', './supabase-schema.js', './manifest.json', './icons/coach-clean.svg', './data/activity-ideas.json', ...SQL_ASSETS, ...MODULE_ASSETS];
const NETWORK_FIRST_PATHS = new Set(['/', '/index.html', '/app.js', '/style.css', '/supabase-config.js', '/supabase-schema.js', '/manifest.json', ...SQL_ASSETS.map(path => path.replace(/^\./, '')), ...MODULE_ASSETS.map(path => path.replace(/^\./, ''))]);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(ASSETS.map(asset => cache.add(asset)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const appBasePath = self.location.pathname.replace(/service-worker\.js$/, '');
  const normalizedPath = url.pathname.endsWith('/') ? '/' : url.pathname.replace(appBasePath, '/');
  const shouldNetworkFirst = event.request.mode === 'navigate'
    || (isSameOrigin && NETWORK_FIRST_PATHS.has(normalizedPath));

  if (shouldNetworkFirst) {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: 'no-store' });
        if (response?.ok) {
          await caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, response.clone()))
            .catch(() => {});
        }
        return response;
      } catch {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return undefined;
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    return fetch(event.request);
  })());
});
