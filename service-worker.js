const CACHE_NAME = 'habitflow-v195-native-appointment-series';
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
const SQL_ASSETS = ['./sql/add-projects.sql'];
const ASSETS = ['./', './index.html', './style.css', './app.js', './supabase-config.js', './supabase-schema.js', './manifest.json', './icons/coach-clean.svg', './data/activity-ideas.json', ...SQL_ASSETS, ...MODULE_ASSETS];
const NETWORK_FIRST_PATHS = new Set(['/', '/index.html', '/app.js', '/style.css', '/supabase-config.js', '/manifest.json', ...SQL_ASSETS.map(path => path.replace(/^\./, '')), ...MODULE_ASSETS.map(path => path.replace(/^\./, ''))]);

function patchedHeaders(response) {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store');
  return headers;
}

function injectAppointmentRecurrenceField(html) {
  if (html.includes('appointmentRecurrenceSelect')) return html;
  const field = '<label><span>Zyklus</span><select id="appointmentRecurrenceSelect" name="recurrence"><option value="once" selected>Einmalig</option><option value="weekly">Wöchentlich</option><option value="monthly">Monatlich</option><option value="quarterly">Quartal</option><option value="yearly">Jährlich</option></select></label>';
  return html.replace('<label><span>Ort</span><input name="location" placeholder="optional" /></label>', '<label><span>Ort</span><input name="location" placeholder="optional" /></label>\n            ' + field);
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
  if (script.includes('function normalizeAppointmentRecurrence(')) return script;

  const normalizeBlock = `function normalizeAppointmentRecurrence(value) {
    const key = String(value || '').trim().toLowerCase();
    return ['weekly', 'monthly', 'quarterly', 'yearly'].includes(key) ? key : null;
  }

  function appointmentRecurrenceCount(recurrence) {
    return ({ weekly: 104, monthly: 36, quarterly: 20, yearly: 10 })[normalizeAppointmentRecurrence(recurrence)] || 1;
  }

  function normalizeAppointment(appointment = {}) {
    const created = appointment.created_at || nowIso();
    const startsAt = validIsoOrFallback(appointment.starts_at || appointment.start_at || appointment.date || created, created);
    const rawEnd = validIsoOrNull(appointment.ends_at || appointment.end_at);
    const endsAt = rawEnd && new Date(rawEnd).getTime() >= new Date(startsAt).getTime() ? rawEnd : null;
    const recurrence = normalizeAppointmentRecurrence(appointment.recurrence);
    const seriesIndex = Number.isInteger(appointment.series_index) ? appointment.series_index : Number.isInteger(Number(appointment.series_index)) ? Number(appointment.series_index) : null;
    return {
      ...appointment,
      title: String(appointment.title || '').trim() || 'Termin',
      description: String(appointment.description || appointment.note || '').trim(),
      location: String(appointment.location || '').trim(),
      appointment_type: normalizeAppointmentType(appointment.appointment_type || appointment.type || 'other'),
      starts_at: startsAt,
      ends_at: endsAt,
      recurrence,
      series_id: recurrence ? (appointment.series_id || uid()) : null,
      series_index: recurrence ? (seriesIndex ?? 0) : null,
      created_at: created,
      updated_at: appointment.updated_at || created
    };
  }`;
  script = script.replace(/function normalizeAppointment\(appointment = \{\}\) \{[\s\S]*?\n  function validIsoOrNull/, normalizeBlock + '\n\n  function validIsoOrNull');

  const helpers = `function addAppointmentMonthsClamped(base, months) {
    const date = new Date(base.getTime());
    const originalDay = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + months);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(originalDay, lastDay));
    date.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds());
    return date;
  }

  function advanceAppointmentDate(base, recurrence, index) {
    const date = new Date(base.getTime());
    if (recurrence === 'weekly') {
      date.setDate(date.getDate() + index * 7);
      return date;
    }
    if (recurrence === 'monthly') return addAppointmentMonthsClamped(base, index);
    if (recurrence === 'quarterly') return addAppointmentMonthsClamped(base, index * 3);
    if (recurrence === 'yearly') return addAppointmentMonthsClamped(base, index * 12);
    return date;
  }

  function appointmentSignature(appointment = {}) {
    const normalized = normalizeAppointment(appointment);
    const duration = normalized.ends_at ? new Date(normalized.ends_at).getTime() - new Date(normalized.starts_at).getTime() : '';
    return [normalized.title, normalized.description, normalized.location, normalized.appointment_type, duration].join('|');
  }

  function appointmentSameInstant(a, b) {
    return Math.abs(new Date(a || 0).getTime() - new Date(b || 0).getTime()) < 1000;
  }

  function inferLegacyAppointmentSeries(appointment) {
    if (!appointment || appointment.recurrence || appointment.series_id) return null;
    const candidates = state.appointments.map(normalizeAppointment)
      .filter(item => item.id && appointmentSignature(item) === appointmentSignature(appointment))
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    if (candidates.length < 2) return null;
    for (const recurrence of ['yearly', 'quarterly', 'monthly', 'weekly']) {
      for (const anchor of candidates) {
        const base = new Date(anchor.starts_at);
        const group = candidates.filter(candidate => {
          for (let index = 0; index < appointmentRecurrenceCount(recurrence); index += 1) {
            if (appointmentSameInstant(candidate.starts_at, advanceAppointmentDate(base, recurrence, index).toISOString())) return true;
          }
          return false;
        });
        if (group.length >= 2 && group.some(item => item.id === appointment.id)) return { recurrence, series_id: uid(), appointments: group };
      }
    }
    return null;
  }

  function inferAppointmentSeries(appointment) {
    if (!appointment) return null;
    const normalized = normalizeAppointment(appointment);
    if (normalized.series_id) {
      const appointments = state.appointments.map(normalizeAppointment)
        .filter(item => item.series_id === normalized.series_id)
        .sort(compareAppointments);
      return { recurrence: normalized.recurrence || appointments.find(item => item.recurrence)?.recurrence || null, series_id: normalized.series_id, appointments };
    }
    return inferLegacyAppointmentSeries(normalized);
  }

  function replacedAppointmentsForEdit(existing, series) {
    if (!existing) return [];
    const anchor = new Date(existing.starts_at).getTime();
    const source = series?.appointments?.length ? series.appointments : [existing];
    return source.filter(item => item.id === existing.id || new Date(item.starts_at).getTime() >= anchor);
  }

  function buildAppointmentRows(values, existing, recurrenceValue, seriesId = null) {
    const recurrence = recurrenceValue === 'once' ? null : normalizeAppointmentRecurrence(recurrenceValue);
    const base = normalizeAppointment({
      ...(existing || {}),
      ...values,
      id: existing?.id || uid(),
      recurrence: null,
      series_id: null,
      series_index: null,
      created_at: existing?.created_at || nowIso(),
      updated_at: nowIso(),
      synced: false
    });
    if (!recurrence) return [base];
    const start = new Date(base.starts_at);
    const duration = base.ends_at ? new Date(base.ends_at).getTime() - new Date(base.starts_at).getTime() : null;
    const nextSeriesId = seriesId || existing?.series_id || uid();
    return Array.from({ length: appointmentRecurrenceCount(recurrence) }, (_, index) => {
      const nextStart = advanceAppointmentDate(start, recurrence, index);
      const nextEnd = duration == null ? null : new Date(nextStart.getTime() + duration);
      return normalizeAppointment({
        ...base,
        id: index === 0 ? base.id : uid(),
        starts_at: nextStart.toISOString(),
        ends_at: nextEnd ? nextEnd.toISOString() : null,
        recurrence,
        series_id: nextSeriesId,
        series_index: index,
        synced: false
      });
    });
  }

  function syncAppointmentRecurrenceField(appointment = null) {
    const field = els.appointmentForm?.elements?.recurrence || document.getElementById('appointmentRecurrenceSelect');
    if (!field) return;
    const normalized = appointment ? normalizeAppointment(appointment) : null;
    const series = normalized ? inferAppointmentSeries(normalized) : null;
    field.value = normalized?.recurrence || series?.recurrence || 'once';
  }

  `;
  script = script.replace('  function createAppointment(event) {', helpers + '  function createAppointment(event) {');

  const createAppointment = `function createAppointment(event) {
    event.preventDefault();
    if (!els.appointmentForm) return;
    const data = new FormData(els.appointmentForm);
    const startsAt = validIsoOrNull(data.get('starts_at'));
    const endsAt = validIsoOrNull(data.get('ends_at'));
    const recurrenceValue = String(data.get('recurrence') || 'once');
    const values = {
      title: String(data.get('title') || '').trim(),
      description: String(data.get('description') || '').trim(),
      location: String(data.get('location') || '').trim(),
      appointment_type: normalizeAppointmentType(data.get('appointment_type')),
      starts_at: startsAt,
      ends_at: endsAt,
      updated_at: nowIso(),
      synced: false
    };
    if (!values.title) return;
    if (!startsAt) {
      toast('Bitte Startzeit für den Termin setzen.');
      return;
    }
    if (endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
      toast('Ende darf nicht vor dem Start liegen.');
      return;
    }

    const existing = editingAppointmentId ? state.appointments.find(item => item.id === editingAppointmentId) : null;
    if (editingAppointmentId && !existing) {
      resetAppointmentFormMode({ clearForm: true });
      toast('Termin wurde nicht gefunden.');
      return;
    }

    const series = existing ? inferAppointmentSeries(existing) : null;
    const rows = buildAppointmentRows(values, existing, recurrenceValue, series?.series_id);
    const replaced = replacedAppointmentsForEdit(existing, series);
    const keepIds = new Set(rows.map(row => row.id));
    const replacedIds = new Set(replaced.map(row => row.id));
    const deleteIds = replaced.filter(row => !keepIds.has(row.id)).map(row => row.id);
    if (deleteIds.length) markRemoteDeletedMany('appointments', deleteIds);

    state.appointments = state.appointments.map(normalizeAppointment)
      .filter(item => !replacedIds.has(item.id) && !keepIds.has(item.id));
    state.appointments.push(...rows);
    selectedCalendarDate = toDateKey(rows[0].starts_at) || selectedCalendarDate;
    calendarCursor = new Date(\`${'${selectedCalendarDate}'}T12:00:00\`);
    resetAppointmentFormMode({ clearForm: true, dateKey: selectedCalendarDate });
    appointmentFormOpen = false;
    syncAppointmentFormPanel();
    saveState();
    toast(editingAppointmentId ? 'Termin aktualisiert' : 'Termin gespeichert');
    syncWithSupabase({ silent: true, pullFirst: false, pullAfter: true });
  }`;
  script = script.replace(/function createAppointment\(event\) \{[\s\S]*?\n  function editAppointment/, createAppointment + '\n\n  function editAppointment');

  script = script.replace("    fields.description.value = appointment.description || '';\n    els.appointmentFormTitle.textContent = 'Termin bearbeiten';", "    fields.description.value = appointment.description || '';\n    syncAppointmentRecurrenceField(appointment);\n    els.appointmentFormTitle.textContent = 'Termin bearbeiten';");
  script = script.replace("      els.appointmentForm.elements.appointment_type.value = 'personal';\n    }", "      els.appointmentForm.elements.appointment_type.value = 'personal';\n      if (els.appointmentForm.elements.recurrence) els.appointmentForm.elements.recurrence.value = 'once';\n    }");
  script = script.replace("          appointment_type: normalizeAppointmentType(a.appointment_type), starts_at: a.starts_at, ends_at: a.ends_at || null,\n          created_at: a.created_at, updated_at: a.updated_at || nowIso()", "          appointment_type: normalizeAppointmentType(a.appointment_type), starts_at: a.starts_at, ends_at: a.ends_at || null,\n          recurrence: normalizeAppointmentRecurrence(a.recurrence), series_id: a.series_id || null, series_index: Number.isInteger(a.series_index) ? a.series_index : null,\n          created_at: a.created_at, updated_at: a.updated_at || nowIso()")
  script = script.replace("    state.appointments = mergeById(state.appointments, remoteAppointmentRows, mapRemoteAppointment).map(normalizeAppointment);", "    {\n      const remoteAppointments = remoteAppointmentRows.map(mapRemoteAppointment).map(normalizeAppointment);\n      const remoteIds = new Set(remoteAppointments.map(item => item.id));\n      const unsyncedLocalAppointments = state.appointments.map(normalizeAppointment).filter(item => item.synced !== true && !remoteIds.has(item.id));\n      state.appointments = [...remoteAppointments, ...unsyncedLocalAppointments];\n    }");
  script = script.replace("  const mapRemoteAppointment = a => normalizeAppointment({ id: a.id, title: a.title, description: a.description, location: a.location, appointment_type: a.appointment_type, starts_at: a.starts_at, ends_at: a.ends_at, created_at: a.created_at, updated_at: a.updated_at, synced: true });", "  const mapRemoteAppointment = a => normalizeAppointment({ id: a.id, title: a.title, description: a.description, location: a.location, appointment_type: a.appointment_type, starts_at: a.starts_at, ends_at: a.ends_at, recurrence: a.recurrence, series_id: a.series_id, series_index: a.series_index, created_at: a.created_at, updated_at: a.updated_at, synced: true });");

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