const CACHE_NAME = 'habitflow-v199-line-calendar-birthday-date';
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

function injectAppointmentRecurrenceField(html) {
  return html;
}

async function withProjectMilestoneEditScript(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  let html = await response.text();
  html = injectAppointmentRecurrenceField(html);
  if (!html.includes('modules/projects-milestone-edit.js')) {
    html = html.replace('<script src="app.js"></script>', '<script src="modules/projects-milestone-edit.js?v=183"></script>\n  <script src="app.js"></script>');
    if (!html.includes('modules/projects-milestone-edit.js')) {
      html = html.replace('</body>', '  <script src="modules/projects-milestone-edit.js?v=183"></script>\n</body>');
    }
  }
  return new Response(html, { status: response.status, statusText: response.statusText, headers: patchedHeaders(response) });
}

function nativeAppointmentPatch(script) {
  return script;
}
async function withNativeAppointmentSeries(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('javascript') && !type.includes('text/plain') && !response.url.includes('app.js')) return response;
  const script = nativeAppointmentPatch(await response.text());
  return new Response(script, { status: response.status, statusText: response.statusText, headers: patchedHeaders(response) });
}

async function withInlineMilestoneEditing(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('javascript') && !type.includes('text/plain') && !response.url.includes('projects.js')) return response;
  let script = await response.text();
  const saveMilestone = `async function saveMilestone(event) {
    event.preventDefault();
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const data = new FormData(form);
    const projectId = form.dataset.projectId;
    const editingMilestoneId = form.dataset.editingMilestoneId || '';
    const title = String(data.get('title') || '').trim();
    const date = validDate(data.get('milestone_date'));
    const phaseId = String(data.get('phase_id') || '');
    if (!projectId) return toast('Projekt konnte fuer den Meilenstein nicht gefunden werden.');
    if (!title || !date) return toast('Meilenstein braucht Titel und Datum.');

    try {
      const now = nowIso();
      const state = readState();
      const existing = editingMilestoneId ? state.projectMilestones.find(item => item.id === editingMilestoneId) : null;
      const milestone = normalizeMilestone({ ...(existing || {}), id: existing?.id || uid('milestone'), project_id: projectId, phase_id: phaseId, title, milestone_date: date, created_at: existing?.created_at || now, updated_at: now, synced: true });
      const { supabase, userId } = await requireRemoteUser();
      const row = { id: milestone.id, user_id: userId, project_id: milestone.project_id, phase_id: milestone.phase_id || null, title: milestone.title, milestone_date: milestone.milestone_date, is_archived: false, created_at: milestone.created_at, updated_at: milestone.updated_at };
      const { error } = await supabase.from(TABLE_MILESTONES).upsert(row, { onConflict: 'id' });
      if (error) throw error;
      state.projectMilestones = existing ? state.projectMilestones.map(item => item.id === milestone.id ? milestone : item) : [milestone, ...state.projectMilestones.filter(item => item.id !== milestone.id)];
      writeState(state);
      delete form.dataset.editingMilestoneId;
      const button = form.querySelector('button[type="submit"]');
      if (button) button.textContent = 'Meilenstein speichern';
      form.reset();
      renderDetail(projectId);
      render();
      toast(existing ? 'Meilenstein aktualisiert' : 'Meilenstein gespeichert');
    } catch (error) {
      console.warn('[HabitFlow/projects] Meilenstein konnte nicht gespeichert werden.', error);
      toast(error.message || 'Meilenstein konnte nicht gespeichert werden.');
    }
  }`;
  const editMilestone = `async function editMilestone(id) {
    const state = readState();
    const milestone = state.projectMilestones.find(item => item.id === id);
    if (!milestone) return;
    const form = Array.from(document.querySelectorAll('[data-project-milestone-form]')).find(item => item.dataset.projectId === milestone.project_id);
    if (!form) return;
    form.dataset.editingMilestoneId = milestone.id;
    form.elements.title.value = milestone.title || '';
    form.elements.milestone_date.value = validDate(milestone.milestone_date) || todayDate();
    if (form.elements.phase_id) form.elements.phase_id.value = milestone.phase_id || '';
    const button = form.querySelector('button[type="submit"]');
    if (button) button.textContent = 'Meilenstein aktualisieren';
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    form.elements.title?.focus();
  }`;
  script = script
    .replace(/async function saveMilestone\(event\) \{[\s\S]*?\n  async function editMilestone/, `${saveMilestone}\n\n  async function editMilestone`)
    .replace(/async function editMilestone\(id\) \{[\s\S]*?\n  async function deleteMilestone/, `${editMilestone}\n\n  async function deleteMilestone`);
  return new Response(script, { status: response.status, statusText: response.statusText, headers: patchedHeaders(response) });
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
  const shouldInjectProjectPatch = event.request.mode === 'navigate' || (isSameOrigin && (normalizedPath === '/' || normalizedPath === '/index.html'));
  const shouldPatchProjectsScript = isSameOrigin && normalizedPath === '/modules/projects.js';
  const shouldPatchAppScript = isSameOrigin && normalizedPath === '/app.js';

  if (shouldNetworkFirst) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(async response => {
          let clientResponse = shouldInjectProjectPatch ? await withProjectMilestoneEditScript(response.clone()) : response.clone();
          if (shouldPatchAppScript) clientResponse = await withNativeAppointmentSeries(clientResponse.clone());
          if (shouldPatchProjectsScript) clientResponse = await withInlineMilestoneEditing(clientResponse.clone());
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clientResponse.clone())).catch(() => {});
          return clientResponse;
        })
        .catch(() => caches.match(event.request).then(async cached => {
          if (!cached) return caches.match('./index.html').then(fallback => fallback && shouldInjectProjectPatch ? withProjectMilestoneEditScript(fallback.clone()) : fallback);
          let clientResponse = shouldInjectProjectPatch ? await withProjectMilestoneEditScript(cached.clone()) : cached;
          if (shouldPatchAppScript) clientResponse = await withNativeAppointmentSeries(clientResponse.clone());
          if (shouldPatchProjectsScript) clientResponse = await withInlineMilestoneEditing(clientResponse.clone());
          return clientResponse;
        }))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then(async cached => {
    let response = cached || await fetch(event.request);
    if (shouldPatchAppScript) response = await withNativeAppointmentSeries(response.clone());
    if (shouldPatchProjectsScript) response = await withInlineMilestoneEditing(response.clone());
    return response;
  }));
});
