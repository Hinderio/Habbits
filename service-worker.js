const CACHE_NAME = 'habitflow-v205-birthday-appointments';
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
  if (!html.includes('modules/pause-period-edit.js')) {
    html = html.replace('<script src="app.js"></script>', '<script src="app.js"></script>\n  <script src="modules/pause-period-edit.js?v=204"></script>');
    if (!html.includes('modules/pause-period-edit.js')) {
      html = html.replace('</body>', '  <script src="modules/pause-period-edit.js?v=204"></script>\n</body>');
    }
  }
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