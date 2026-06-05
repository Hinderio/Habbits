(function hydrateProjectPhasesFromSupabase(window, document) {
  'use strict';

  if (window.__habitFlowProjectPhaseHydrationPatched) return;
  window.__habitFlowProjectPhaseHydrationPatched = true;

  const STORAGE_KEY = 'habitflow-state-v1';
  let client;

  function escapeHtml(value = '') {
    return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function validDate(value) {
    const text = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
  }

  function dateLabel(value) {
    if (!value) return '-';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  function readState() {
    try {
      const parsed = JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeState(state) {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function normalizePhase(row) {
    return {
      id: String(row.id || ''),
      project_id: String(row.project_id || ''),
      name: String(row.name || '').trim(),
      start_date: validDate(row.start_date),
      end_date: validDate(row.end_date),
      status: ['open', 'active', 'done'].includes(row.status) ? row.status : 'open',
      is_archived: Boolean(row.is_archived),
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || row.created_at || new Date().toISOString(),
      synced: true
    };
  }

  function phaseLabel(status) {
    return { open: 'Offen', active: 'In Arbeit', done: 'Erledigt' }[status] || 'Offen';
  }

  function getProject(state, projectId) {
    return (Array.isArray(state.projects) ? state.projects : []).find(project => String(project.id) === String(projectId)) || {};
  }

  function renderPhaseCard(phase, project) {
    const projectStart = project.start_date || phase.start_date;
    const projectEnd = project.end_date || phase.end_date || projectStart;
    const start = new Date(`${projectStart}T12:00:00`).getTime();
    const end = new Date(`${projectEnd}T12:00:00`).getTime();
    const phaseStart = new Date(`${phase.start_date}T12:00:00`).getTime();
    const phaseEnd = new Date(`${phase.end_date}T12:00:00`).getTime();
    const span = Math.max(1, end - start);
    const left = Math.max(0, Math.min(96, ((phaseStart - start) / span) * 100));
    const width = Math.max(8, Math.min(100 - left, ((phaseEnd - phaseStart || 86400000) / span) * 100));

    return `<article class="phase-card"><div><strong>${escapeHtml(phase.name)}</strong><span class="subtle">${phaseLabel(phase.status)}</span></div><div class="phase-timeline"><div class="phase-timeline-track"><i style="margin-left:${left}%;width:${width}%"></i></div><div class="phase-timeline-dates"><span>${dateLabel(phase.start_date)}</span><span>${dateLabel(phase.end_date)}</span></div></div><div class="list-actions"><button class="mini-btn" type="button" data-action="edit-phase" data-id="${escapeHtml(phase.id)}">Bearbeiten</button><button class="mini-btn danger" type="button" data-action="delete-phase" data-id="${escapeHtml(phase.id)}">Loeschen</button></div></article>`;
  }

  function renderPhaseList(projectId) {
    const state = readState();
    const form = document.querySelector(`[data-project-phase-form][data-project-id="${CSS.escape(String(projectId))}"]`);
    if (!form) return;

    const project = getProject(state, projectId);
    const phases = (Array.isArray(state.projectPhases) ? state.projectPhases : [])
      .filter(phase => String(phase.project_id) === String(projectId) && !phase.is_archived)
      .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));

    const list = form.nextElementSibling;
    if (list) {
      list.innerHTML = phases.length ? phases.map(phase => renderPhaseCard(phase, project)).join('') : '<div class="project-empty">Noch keine Phasen. Erstelle die erste Projektphase.</div>';
    }

    const badge = form.previousElementSibling?.querySelector?.('.badge');
    if (badge) badge.textContent = `${phases.length} Phase${phases.length === 1 ? '' : 'n'}`;

    const nextStep = document.querySelector('.project-next-step p');
    if (nextStep && phases.length && nextStep.textContent.includes('erste Projektphase')) {
      nextStep.textContent = 'Lege konkrete Tasks fuer dieses Projekt an.';
    }
  }

  function getClient() {
    const config = window.HABITFLOW_SUPABASE_CONFIG || {};
    if (!config.url || !config.anonKey || !window.supabase?.createClient) return null;
    if (!client) client = window.supabase.createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    return client;
  }

  async function hydrate(projectId) {
    const supabase = getClient();
    if (!supabase || !projectId) return;

    const { data, error } = await supabase
      .from('project_phases')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_archived', false)
      .order('start_date', { ascending: true });

    if (error) {
      console.warn('[HabitFlow/projects] Projektphasen konnten nicht geladen werden.', error);
      return;
    }

    const remotePhases = (data || []).map(normalizePhase).filter(phase => phase.id && phase.project_id && phase.name);
    const state = readState();
    const localPhases = Array.isArray(state.projectPhases) ? state.projectPhases : [];
    const keepOthers = localPhases.filter(phase => String(phase.project_id) !== String(projectId));
    state.projectPhases = [...remotePhases, ...keepOthers];
    writeState(state);
    renderPhaseList(projectId);
  }

  function hydrateSoon(projectId) {
    window.setTimeout(() => hydrate(projectId), 120);
    window.setTimeout(() => hydrate(projectId), 900);
  }

  document.addEventListener('click', event => {
    const opener = event.target.closest?.('[data-action="open-project-detail"]');
    if (opener?.dataset?.id) hydrateSoon(opener.dataset.id);
  });

  document.addEventListener('submit', event => {
    const form = event.target;
    if (form instanceof window.HTMLFormElement && form.matches('[data-project-phase-form]') && form.dataset.projectId) {
      hydrateSoon(form.dataset.projectId);
    }
  }, true);
})(window, document);
