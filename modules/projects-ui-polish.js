(() => {
  'use strict';

  if (window.__habitFlowProjectsUiPolishInstalled) return;
  window.__habitFlowProjectsUiPolishInstalled = true;

  const STATUS_LABELS = {
    open: 'Offen',
    in_progress: 'In Bearbeitung',
    inprogress: 'In Bearbeitung',
    active: 'In Bearbeitung',
    done: 'Erledigt',
    completed: 'Erledigt',
    archived: 'Archiviert'
  };

  const ICONS = {
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4.4L19.7 8.7a2.1 2.1 0 0 0 0-3l-1.4-1.4a2.1 2.1 0 0 0-3 0L4 15.6V20Z"></path><path d="m13.8 5.8 4.4 4.4"></path></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 7V5h6v2"></path><path d="M7 7l1 13h8l1-13"></path></svg>'
  };

  function injectStyle() {
    if (document.getElementById('habitflow-projects-ui-polish-style')) return;
    const style = document.createElement('style');
    style.id = 'habitflow-projects-ui-polish-style';
    style.textContent = `
      .project-task-row>div{display:flex;align-items:baseline;gap:18px;flex-wrap:wrap;min-width:0}
      .project-task-row>div>strong{min-width:0}
      .project-task-row>div>.subtle{display:inline-flex;align-items:center;color:var(--muted);font-weight:800}
      .milestone-chip{align-items:center}
      .phase-card .list-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px}
      .milestone-chip .project-icon-action,.phase-card .project-icon-action{display:inline-grid;place-items:center;width:38px;height:38px;min-width:38px;padding:0;border-radius:999px;background:rgba(74,215,209,.11);border:1px solid rgba(74,215,209,.24);color:var(--primary);box-shadow:none;font-size:0}
      .milestone-chip .project-icon-action svg,.phase-card .project-icon-action svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
      .milestone-chip .project-icon-action:hover,.phase-card .project-icon-action:hover{transform:translateY(-1px);background:rgba(74,215,209,.17);border-color:rgba(74,215,209,.36)}
      .milestone-chip .project-icon-action-delete,.phase-card .project-icon-action-delete{background:rgba(255,99,99,.08);border-color:rgba(255,99,99,.22);color:#b33a3a}
      .milestone-chip .project-icon-action-delete:hover,.phase-card .project-icon-action-delete:hover{background:rgba(255,99,99,.13);border-color:rgba(255,99,99,.32)}
      body.light .milestone-chip .project-icon-action,body.light .phase-card .project-icon-action{background:rgba(74,215,209,.14);border-color:rgba(17,36,58,.08)}
      body.light .milestone-chip .project-icon-action-delete,body.light .phase-card .project-icon-action-delete{background:rgba(255,99,99,.1);border-color:rgba(179,58,58,.16)}
      @media(max-width:760px){.project-task-row>div{gap:7px 14px}.phase-card .list-actions{display:flex;width:auto}.milestone-chip .project-icon-action,.phase-card .project-icon-action{width:36px;height:36px;min-width:36px}}
    `;
    document.head.appendChild(style);
  }

  function polishTaskRows(root = document) {
    root.querySelectorAll?.('.project-task-row .subtle').forEach(node => {
      const current = String(node.textContent || '').trim();
      if (!current) return;
      const parts = current.split(' · ');
      const rawStatus = String(parts.shift() || '').trim();
      const key = rawStatus.toLowerCase().replace(/[\s-]+/g, '_');
      const compactKey = key.replace(/_/g, '');
      const label = STATUS_LABELS[key] || STATUS_LABELS[compactKey] || rawStatus;
      node.textContent = [label, ...parts].filter(Boolean).join(' · ');
    });
  }

  function polishIconButton(button, { label, title, icon, deleteTone = false }) {
    if (button.dataset.polished === 'true') return;
    button.dataset.polished = 'true';
    button.classList.add('project-icon-action', deleteTone ? 'project-icon-action-delete' : 'project-icon-action-edit');
    button.setAttribute('aria-label', label);
    button.setAttribute('title', title);
    button.innerHTML = icon;
  }

  function polishProjectActions(root = document) {
    root.querySelectorAll?.('[data-action="edit-milestone"]').forEach(button => {
      if (button.dataset.polished === 'true') return;
      polishIconButton(button, { label: 'Meilenstein bearbeiten', title: 'Bearbeiten', icon: ICONS.edit });
    });
    root.querySelectorAll?.('[data-action="delete-milestone"]').forEach(button => {
      if (button.dataset.polished === 'true') return;
      polishIconButton(button, { label: 'Meilenstein loeschen', title: 'Loeschen', icon: ICONS.trash, deleteTone: true });
    });
    root.querySelectorAll?.('[data-action="edit-phase"]').forEach(button => {
      if (button.dataset.polished === 'true') return;
      polishIconButton(button, { label: 'Phase bearbeiten', title: 'Bearbeiten', icon: ICONS.edit });
    });
    root.querySelectorAll?.('[data-action="delete-phase"]').forEach(button => {
      if (button.dataset.polished === 'true') return;
      polishIconButton(button, { label: 'Phase loeschen', title: 'Loeschen', icon: ICONS.trash, deleteTone: true });
    });
  }

  function polish(root = document) {
    injectStyle();
    polishTaskRows(root);
    polishProjectActions(root);
  }

  function boot() {
    polish();
    new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) polish(node);
      }));
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
