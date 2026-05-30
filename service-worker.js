const CACHE_NAME = 'habitflow-v131-smoking-capture-polish';
const MODULE_ASSETS = [
  './modules/module-registry.js',
  './modules/state.js',
  './modules/sync.js',
  './modules/weekly-autosave.js',
  './modules/remote-cache-reconcile.js',
  './modules/dashboard.js',
  './modules/habits.js',
  './modules/tasks.js',
  './modules/fitness.js',
  './modules/consumption.js',
  './modules/consumption-time-profile.js',
  './modules/gamification.js',
  './modules/monthly-missions.js'
];
const ASSETS = ['./', './index.html', './style.css', './app.js', './supabase-config.js', './supabase-schema.js', './manifest.json', './icons/coach-clean.svg', './data/activity-ideas.json', ...MODULE_ASSETS];
const NETWORK_FIRST_PATHS = new Set(['/', '/index.html', '/app.js', '/style.css', '/supabase-config.js', '/supabase-schema.js', '/manifest.json', ...MODULE_ASSETS.map(path => path.replace(/^\./, ''))]);
const MIN_SLEEP_BRIDGE_MINUTES = 240;

function replaceRequired(source, needle, replacement, flags) {
  if (!source.includes(needle)) flags.ok = false;
  return source.replace(needle, replacement);
}

function patchAppRuntimeSource(source) {
  if (typeof source !== 'string' || source.includes('function smokingScoringIntervalMinutes(')) return source;
  const flags = { ok: true };
  const minutesNeedle = `  function minutesBetweenIfNotPaused(startValue, endValue, options = {}) {
    const startMs = new Date(startValue || 0).getTime();
    const endMs = new Date(endValue || 0).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
    if (intervalCrossesPause(startValue, endValue, options)) return null;
    return Math.max(0, Math.round((endMs - startMs) / 60000));
  }`;
  const minutesReplacement = `${minutesNeedle}

  function sleepWindowForDate(dateValue) {
    const start = new Date(dateValue);
    start.setHours(23, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setHours(7, 0, 0, 0);
    return { start, end };
  }

  function sleepMinutesBetween(startValue, endValue) {
    const startMs = new Date(startValue || 0).getTime();
    const endMs = new Date(endValue || 0).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
    let total = 0;
    const cursor = new Date(startMs);
    cursor.setDate(cursor.getDate() - 1);
    cursor.setHours(12, 0, 0, 0);
    for (let guard = 0; guard < 21 && cursor.getTime() <= endMs + 86400000; guard += 1) {
      const windowRange = sleepWindowForDate(cursor);
      const overlapStart = Math.max(startMs, windowRange.start.getTime());
      const overlapEnd = Math.min(endMs, windowRange.end.getTime());
      if (overlapEnd > overlapStart) total += Math.round((overlapEnd - overlapStart) / 60000);
      cursor.setDate(cursor.getDate() + 1);
    }
    return total;
  }

  function scoringSleepDeductionMinutes(startValue, endValue) {
    const activeMinutes = minutesBetweenIfNotPaused(startValue, endValue, { scope: 'smoke' });
    if (activeMinutes == null) return 0;
    const sleepMinutes = sleepMinutesBetween(startValue, endValue);
    return activeMinutes >= ${MIN_SLEEP_BRIDGE_MINUTES} && sleepMinutes >= ${MIN_SLEEP_BRIDGE_MINUTES} ? sleepMinutes : 0;
  }

  function smokingScoringIntervalMinutes(startValue, endValue, options = {}) {
    const activeMinutes = minutesBetweenIfNotPaused(startValue, endValue, options);
    if (activeMinutes == null) return null;
    return Math.max(0, activeMinutes - scoringSleepDeductionMinutes(startValue, endValue));
  }`;

  let next = replaceRequired(source, minutesNeedle, minutesReplacement, flags);
  next = replaceRequired(next,
    `    const interval = last ? Math.max(0, Math.round((new Date(smokedAt) - new Date(last.smoked_at)) / 60000)) : null;`,
    `    const interval = last ? Math.max(0, Math.round((new Date(smokedAt) - new Date(last.smoked_at)) / 60000)) : null;
    const scoringInterval = last ? smokingScoringIntervalMinutes(last.smoked_at, smokedAt, { scope: 'smoke' }) : null;`, flags);
  next = replaceRequired(next,
    `    const points = cigarettePoints(interval, scoringContext);`,
    `    const points = cigarettePoints(scoringInterval, scoringContext);`, flags);
  next = replaceRequired(next,
    `    const entry = { id: uid(), smoked_at: smokedAt, interval_minutes: interval, alcohol_context: todayAlcohol, points, note: '', created_at: smokedAt, updated_at: smokedAt, synced: false };`,
    `    const entry = { id: uid(), smoked_at: smokedAt, interval_minutes: interval, scoring_interval_minutes: scoringInterval, alcohol_context: todayAlcohol, points, note: '', created_at: smokedAt, updated_at: smokedAt, synced: false };`, flags);
  next = replaceRequired(next,
    `    addPoints('cigarette', entry.id, points, cigarettePointReason(interval, scoringContext), smokedAt);`,
    `    addPoints('cigarette', entry.id, points, cigarettePointReason(scoringInterval, scoringContext), smokedAt);`, flags);
  next = replaceRequired(next,
    `      const interval = prev && !crossesPause ? Math.max(0, Math.round((new Date(c.smoked_at) - new Date(prev.smoked_at)) / 60000)) : null;
      const scoringContext = smokingScoringContext(prev && !crossesPause ? prev : null, c);
      const points = cigarettePoints(interval, scoringContext);
      const hasChanged = c.interval_minutes !== interval || Number(c.points || 0) !== points;
      if (hasChanged) {
        c.interval_minutes = interval;
        c.points = points;
        changed = true;
      }`,
    `      const interval = prev && !crossesPause ? Math.max(0, Math.round((new Date(c.smoked_at) - new Date(prev.smoked_at)) / 60000)) : null;
      const scoringInterval = prev && !crossesPause ? smokingScoringIntervalMinutes(prev.smoked_at, c.smoked_at, { scope: 'smoke' }) : null;
      const scoringContext = smokingScoringContext(prev && !crossesPause ? prev : null, c);
      const points = cigarettePoints(scoringInterval, scoringContext);
      const hasChanged = c.interval_minutes !== interval || c.scoring_interval_minutes !== scoringInterval || Number(c.points || 0) !== points;
      if (hasChanged) {
        c.interval_minutes = interval;
        c.scoring_interval_minutes = scoringInterval;
        c.points = points;
        changed = true;
      }`, flags);
  next = replaceRequired(next,
    `      if (addPoints('cigarette', c.id, c.points, cigarettePointReason(interval, scoringContext), c.smoked_at)) changed = true;`,
    `      if (addPoints('cigarette', c.id, c.points, cigarettePointReason(scoringInterval, scoringContext), c.smoked_at)) changed = true;`, flags);
  return flags.ok ? next : source;
}

function patchedJavaScriptResponse(sourceResponse, sourceText) {
  const headers = new Headers(sourceResponse.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.set('content-type', 'application/javascript; charset=utf-8');
  return new Response(patchAppRuntimeSource(sourceText), {
    status: sourceResponse.status,
    statusText: sourceResponse.statusText,
    headers
  });
}

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
  const shouldPatchAppRuntime = isSameOrigin && normalizedPath === '/app.js';

  if (shouldNetworkFirst) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(async response => {
          const nextResponse = shouldPatchAppRuntime ? patchedJavaScriptResponse(response, await response.text()) : response;
          const copy = nextResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
          return nextResponse;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
