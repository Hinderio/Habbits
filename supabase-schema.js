(function loadHabitFlowSchemaAndProjectTab(window, document) {
  'use strict';

  window.HABITFLOW_SUPABASE_SQL = window.HABITFLOW_SUPABASE_SQL || 'Supabase SQL wird geladen...';

  function loadSqlPreview() {
    if (!window.fetch) return;
    Promise.all([
      fetch('./supabase.sql', { cache: 'no-store' }).then(response => response.ok ? response.text() : ''),
      fetch('./sql/add-projects.sql', { cache: 'no-store' }).then(response => response.ok ? response.text() : '')
    ]).then(parts => {
      const sql = parts.filter(Boolean).join('\n\n-- Project Tab extension\n\n');
      if (sql.trim()) window.HABITFLOW_SUPABASE_SQL = sql;
      const preview = document.getElementById('sqlPreview');
      if (preview) preview.textContent = window.HABITFLOW_SUPABASE_SQL;
    }).catch(error => {
      console.warn('[HabitFlow/schema] SQL preview konnte nicht geladen werden.', error);
    });
  }

  function loadProjectAssets() {
    if (!document.querySelector('link[href="modules/projects.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'modules/projects.css';
      document.head.appendChild(link);
    }
    if (!document.querySelector('link[href="modules/projects-mobile-fix.css"]')) {
      const mobileLink = document.createElement('link');
      mobileLink.rel = 'stylesheet';
      mobileLink.href = 'modules/projects-mobile-fix.css';
      document.head.appendChild(mobileLink);
    }
    if (!document.querySelector('script[src="modules/projects-supabase-fix.js"]')) {
      document.write('<script src="modules/projects-supabase-fix.js"><\/script>');
    }
    if (!document.querySelector('script[src="modules/projects-submit-listener-fix.js"]')) {
      document.write('<script src="modules/projects-submit-listener-fix.js"><\/script>');
    }
    if (!document.querySelector('script[src="modules/projects-submit-currenttarget-fix.js"]')) {
      document.write('<script src="modules/projects-submit-currenttarget-fix.js"><\/script>');
    }
    if (!document.querySelector('script[src="modules/projects-formdata-fix.js"]')) {
      document.write('<script src="modules/projects-formdata-fix.js"><\/script>');
    }
    if (!document.querySelector('script[src="modules/projects-phases-remote-fix.js"]')) {
      document.write('<script src="modules/projects-phases-remote-fix.js"><\/script>');
    }
    if (!document.querySelector('script[src="modules/projects-mobile-detail.js"]')) {
      document.write('<script src="modules/projects-mobile-detail.js"><\/script>');
    }
    if (!document.querySelector('script[src="modules/projects.js"]')) {
      document.write('<script src="modules/projects.js"><\/script>');
    }
  }

  loadSqlPreview();
  loadProjectAssets();
})(window, document);
