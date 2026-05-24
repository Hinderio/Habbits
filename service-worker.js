const CACHE_NAME = 'habitflow-v68-photo-poster-interactions';
const ASSETS = ['./', './index.html', './style.css', './app.js', './supabase-config.js', './supabase-schema.js', './manifest.json', './icons/coach-clean.svg', './data/activity-ideas.json', './assets/companion-posters/stage-01.jpg', './assets/companion-posters/stage-02.jpg', './assets/companion-posters/stage-03.jpg', './assets/companion-posters/stage-04.jpg', './assets/companion-posters/stage-05.jpg', './assets/companion-posters/stage-06.jpg', './assets/companion-posters/stage-07.jpg', './assets/companion-posters/stage-08.jpg', './assets/companion-posters/stage-09.jpg', './assets/companion-posters/stage-10.jpg', './assets/companion-posters/stage-11.jpg', './assets/companion-posters/stage-12.jpg', './assets/companion-posters/stage-13.jpg', './assets/companion-posters/stage-14.jpg', './assets/companion-posters/stage-15.jpg', './assets/companion-posters/stage-16.jpg', './assets/companion-posters/stage-17.jpg', './assets/companion-posters/stage-18.jpg', './assets/companion-posters/stage-19.jpg', './assets/companion-posters/stage-20.jpg'];
const NETWORK_FIRST_PATHS = new Set(['/', '/index.html', '/app.js', '/style.css', '/supabase-config.js', '/supabase-schema.js', '/manifest.json']);

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
