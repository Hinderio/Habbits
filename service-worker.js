const CACHE_NAME = 'habitflow-v156-project-detail';
const MODULE_ASSETS = [
  './modules/module-registry.js',
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
  './modules/points-domain-parity.js',
  './modules/domain-diagnostics.js',
  './modules/state.js',
  './modules/sync.js',
  './modules/weekly-autosave.js',
  './modules/quick-capture-button-style.js',
  './modules/remote-cache-reconcile.js',
  './modules/dashboard.js',
  './modules/habits.js',
  './modules/tasks.js',
  './modules/fitness.js',
  './modules/consumption.js',
  './modules/consumption-time-profile.js',
  './modules/gamification.js',
  './modules/monthly-missions.js',
  './modules/projects.js',
  './modules/projects-supabase-fix.js',
  './modules/projects-submit-listener-fix.js',
  './modules/projects-submit-currenttarget-fix.js',
  './modules/projects-formdata-fix.js',
  './modules/projects-phases-remote-fix.js',
  './modules/projects-mobile-detail.js',
  './modules/projects.css',
  './modules/projects-mobile-fix.css'
];
const ASSETS = ['./', './index.html', './style.css', './app.js', './supabase-config.js', './supabase-schema.js', './manifest.json', './icons/coach-clean.svg', './data/activity-ideas.json', './sql/add-projects.sql', ...MODULE_ASSETS];
const NETWORK_FIRST_PATHS = new Set(['/', '/index.html', '/app.js', '/style.css', '/supabase-config.js', '/supabase-schema.js', '/manifest.json', '/sql/add-projects.sql', ...MODULE_ASSETS.map(path => path.replace(/^\./, ''))]);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const normalizedPath = url.pathname.endsWith('/') ? '/' : url.pathname.replace(self.location.pathname.replace(/service-worker\.js$/, ''), '/');
  const shouldNetworkFirst = event.request.mode === 'navigate' || (isSameOrigin && NETWORK_FIRST_PATHS.has(normalizedPath));

  if (shouldNetworkFirst) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
