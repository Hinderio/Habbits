const CACHE_NAME = 'habitflow-v206-birthday-appointments-repair';
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
  './modules/pause-period-edit.js',
  './modules/craving-coach-v2.js',
  './modules/craving-coach-v2-actions-polish.js',
  './modules/gamification.js',
  './modules/monthly-missions.js',
  './modules/line-calendar.js',
  './modules/line-calendar.css',
  './modules/projects-milestone-edit.js',
  './modules/projects.js',
  './modules/projects.css',
  './modules/projects-mobile-fix.css'
];
const SQL_ASSETS = ['./sql/add-appointment-series.sql', './sql/add-projects.sql'];
const ASSETS = ['./', './index.html', './style.css', './app.js', './supabase-config.js', './supabase-schema.js', './manifest.json', './icons/coach-clean.svg', './data/activity-ideas.json', ...SQL_ASSETS, ...MODULE_ASSETS];
const NETWORK_FIRST_PATHS = new Set(['/', '/index.html', '/app.js', '/style.css', '/supabase-config.js', '/supabase-schema.js', '/manifest.json', ...SQL_ASSETS.map(path => path.replace(/^\./, '')), ...MODULE_ASSETS.map(path => path.replace(/^\./, ''))]);

function patchedHeaders(response) {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store');
  return headers;
}

function injectHtmlPatches(html) {
  let next = html;
  if (!next.includes('modules/projects-milestone-edit.js')) {
    next = next.replace('<script src="app.js"></script>', '<script src="modules/projects-milestone-edit.js?v=183"></script>\n  <script src="app.js"></script>');
    if (!next.includes('modules/projects-milestone-edit.js')) next = next.replace('</body>', '  <script src="modules/projects-milestone-edit.js?v=183"></script>\n</body>');
  }
  if (!next.includes('modules/pause-period-edit.js')) {
    next = next.replace('<script src="app.js"></script>', '<script src="app.js"></script>\n  <script src="modules/pause-period-edit.js?v=206"></script>');
    if (!next.includes('modules/pause-period-edit.js')) next = next.replace('</body>', '  <script src="modules/pause-period-edit.js?v=206"></script>\n</body>');
  }
  return next;
}

async function withHtmlPatches(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  const html = injectHtmlPatches(await response.text());
  return new Response(html, { status: response.status, statusText: response.statusText, headers: patchedHeaders(response) });
}

function nativeAppointmentPatch(script) {
  if (!script.includes('function createAppointment(event)')) return script;
  let next = script;
  if (!next.includes('function syncAppointmentBirthdayRecurrence()')) {
    next = next.replace(
      "if (els.appointmentForm?.elements?.starts_at) els.appointmentForm.elements.starts_at.addEventListener('change', syncAppointmentEndDefault);",
      "if (els.appointmentForm?.elements?.starts_at) els.appointmentForm.elements.starts_at.addEventListener('change', syncAppointmentEndDefault);\n    if (els.appointmentForm?.elements?.is_birthday) els.appointmentForm.elements.is_birthday.addEventListener('change', syncAppointmentBirthdayRecurrence);\n    if (els.appointmentForm?.elements?.recurrence) els.appointmentForm.elements.recurrence.addEventListener('change', syncAppointmentBirthdayRecurrence);"
    );
    next = next.replace(
      "if (!els.appointmentForm) return;\n    const data = new FormData(els.appointmentForm);",
      "if (!els.appointmentForm) return;\n    syncAppointmentBirthdayRecurrence();\n    const data = new FormData(els.appointmentForm);"
    );
    next = next.replace(
      "const recurrence = normalizeAppointmentRecurrence(data.get('recurrence'));",
      "const isBirthday = Boolean(data.get('is_birthday'));\n    const recurrence = isBirthday ? 'yearly' : normalizeAppointmentRecurrence(data.get('recurrence'));"
    );
    next = next.replace(
      "is_birthday: Boolean(data.get('is_birthday')),",
      "is_birthday: isBirthday,"
    );
    next = next.replace(
      "if (fields.is_birthday) fields.is_birthday.checked = Boolean(appointment.is_birthday);\n    els.appointmentFormTitle.textContent = 'Termin bearbeiten';",
      "if (fields.is_birthday) fields.is_birthday.checked = Boolean(appointment.is_birthday);\n    syncAppointmentBirthdayRecurrence();\n    els.appointmentFormTitle.textContent = 'Termin bearbeiten';"
    );
    next = next.replace(
      "\n  function moveMonth(delta) {",
      "\n  function syncAppointmentBirthdayRecurrence() {\n    const fields = els.appointmentForm?.elements;\n    if (!fields?.is_birthday?.checked || !fields?.recurrence) return;\n    fields.recurrence.value = 'yearly';\n  }\n\n  function moveMonth(delta) {"
    );
  }
  if (!next.includes('habitflow-birthday-appointment-style')) {
    next += "\n;(() => {\n  const css = '.calendar-event-chip.is-birthday{box-shadow:inset 3px 0 0 #f6b33f!important;border-color:rgba(246,179,63,.48)!important;background:rgba(246,179,63,.18)!important;color:var(--text)!important}.line-calendar-event.is-birthday{background:#f6b33f!important}';\n  const inject = () => {\n    if (document.getElementById('habitflow-birthday-appointment-style')) return;\n    const style = document.createElement('style');\n    style.id = 'habitflow-birthday-appointment-style';\n    style.textContent = css;\n    document.head.appendChild(style);\n  };\n  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject, { once: true });\n  else inject();\n})();\n";
  }
  return next;
}

async function withNativeAppointmentSeries(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('javascript') && !type.includes('text/plain') && !response.url.includes('app.js')) return response;
  const script = nativeAppointmentPatch(await response.text());
  return new Response(script, { status: response.status, statusText: response.statusText, headers: patchedHeaders(response) });
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {}));
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
  const shouldPatchHtml = event.request.mode === 'navigate' || (isSameOrigin && (normalizedPath === '/' || normalizedPath === '/index.html'));
  const shouldPatchAppScript = isSameOrigin && normalizedPath === '/app.js';

  if (shouldNetworkFirst) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(async response => {
          let clientResponse = shouldPatchHtml ? await withHtmlPatches(response.clone()) : response.clone();
          if (shouldPatchAppScript) clientResponse = await withNativeAppointmentSeries(clientResponse.clone());
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clientResponse.clone())).catch(() => {});
          return clientResponse;
        })
        .catch(() => caches.match(event.request).then(async cached => {
          if (!cached) return caches.match('./index.html').then(fallback => fallback && shouldPatchHtml ? withHtmlPatches(fallback.clone()) : fallback);
          let clientResponse = shouldPatchHtml ? await withHtmlPatches(cached.clone()) : cached;
          if (shouldPatchAppScript) clientResponse = await withNativeAppointmentSeries(clientResponse.clone());
          return clientResponse;
        }))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then(async cached => {
    let response = cached || await fetch(event.request);
    if (shouldPatchAppScript) response = await withNativeAppointmentSeries(response.clone());
    return response;
  }));
});
