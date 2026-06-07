(function loadHabitFlowSchemaAndProjectTab(window, document) {
  'use strict';

  window.HABITFLOW_SUPABASE_SQL = window.HABITFLOW_SUPABASE_SQL || 'Supabase SQL wird geladen...';

  function loadSqlPreview() {
    if (!window.fetch) return;
    Promise.all([
      fetch('./supabase.sql', { cache: 'no-store' }).then(response => response.ok ? response.text() : ''),
      fetch('./sql/add-projects.sql', { cache: 'no-store' }).then(response => response.ok ? response.text() : ''),
      fetch('./sql/add-appointment-series.sql', { cache: 'no-store' }).then(response => response.ok ? response.text() : '')
    ]).then(parts => {
      const sql = parts.filter(Boolean).join('\n\n-- HabitFlow extension --\n\n');
      if (sql.trim()) window.HABITFLOW_SUPABASE_SQL = sql;
      const preview = document.getElementById('sqlPreview');
      if (preview) preview.textContent = window.HABITFLOW_SUPABASE_SQL;
    }).catch(error => {
      console.warn('[HabitFlow/schema] SQL preview konnte nicht geladen werden.', error);
    });
  }

  function ensureStylesheet(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function writeScript(src) {
    if (document.querySelector(`script[src="${src}"]`)) return;
    document.write(`<script src="${src}"><\/script>`);
  }

  function loadAppointmentSeriesAssets() {
    writeScript('modules/appointments-domain.js?v=191');
  }

  function loadProjectAssets() {
    ensureStylesheet('modules/projects.css');
    ensureStylesheet('modules/projects-mobile-fix.css');

    // Project UI, navigation, cards, modal and actions are intentionally owned by projects.js only.
    // Legacy project sidecars used to register competing listeners and made detail opening unstable.
    writeScript('modules/projects.js');
  }

  loadSqlPreview();
  loadAppointmentSeriesAssets();
  loadProjectAssets();
})(window, document);