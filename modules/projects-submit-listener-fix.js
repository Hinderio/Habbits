(function patchHabitFlowProjectPhaseSubmit(window, document) {
  'use strict';

  if (window.__habitFlowProjectPhaseSubmitPatched) return;
  window.__habitFlowProjectPhaseSubmitPatched = true;

  const STORAGE_KEY = 'habitflow-state-v1';

  function toast(message) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.remove('hidden');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.add('hidden'), 2200);
  }

  function validDate(value) {
    const text = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(new Date(`${text}T12:00:00`).getTime()) ? text : '';
  }

  function uid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `phase-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(value = '') {
    return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
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

  function normalizePhase(phase) {
    return {
      id: String(phase.id || uid()),
      project_id: String(phase.project_id || ''),
      name: String(phase.name || '').trim().slice(0, 100),
      start_date: validDate(phase.start_date),
      end_date: validDate(phase.end_date),
      status: ['open', 'active', 'done'].includes(phase.status) ? phase.status : 'open',
      is_archived: false,
      created_at: phase.created_at || new Date().toISOString(),
      updated_at: phase.updated_at || new Date().toISOString(),
      synced: phase.synced === true
    };
  }

  function projectPhases(state, projectId) {
    return (Array.isArray(state.projectPhases) ? state.projectPhases : [])
      .filter(phase => phase.project_id === projectId && !phase.is_archived)
      .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
  }

  function phaseStatusLabel(status) {
    return { open: 'Offen', active: 'In Arbeit', done: 'Erledigt' }[status] || 'Offen';
  }

  function renderPhaseCard(phase, project) {
    const projectStart = project?.start_date || phase.start_date;
    const projectEnd = project?.end_date || phase.end_date || projectStart;
    const start = new Date(`${projectStart}T12:00:00`).getTime();
    const end = new Date(`${projectEnd}T12:00:00`).getTime();
    const phaseStart = new Date(`${phase.start_date}T12:00:00`).getTime();
    const phaseEnd = new Date(`${phase.end_date}T12:00:00`).getTime();
    const span = Math.max(1, end - start);
    const left = Math.max(0, Math.min(96, ((phaseStart - start) / span) * 100));
    const width = Math.max(8, Math.min(100 - left, ((phaseEnd - phaseStart || 86400000) / span) * 100));

    return `<article class="phase-card"><div><strong>${escapeHtml(phase.name)}</strong><span class="subtle">${phaseStatusLabel(phase.status)}</span></div><div class="phase-timeline"><div class="phase-timeline-track"><i style="margin-left:${left}%;width:${width}%"></i></div><div class="phase-timeline-dates"><span>${dateLabel(phase.start_date)}</span><span>${dateLabel(phase.end_date)}</span></div></div><div class="list-actions"><button class="mini-btn" type="button" data-action="edit-phase" data-id="${escapeHtml(phase.id)}">Bearbeiten</button><button class="mini-btn danger" type="button" data-action="delete-phase" data-id="${escapeHtml(phase.id)}">Loeschen</button></div></article>`;
  }

  function renderPhaseList(form, projectId, state) {
    const project = (Array.isArray(state.projects) ? state.projects : []).find(item => item.id === projectId) || {};
    const phases = projectPhases(state, projectId);
    const list = form.nextElementSibling;
    if (list) {
      list.innerHTML = phases.length ? phases.map(phase => renderPhaseCard(phase, project)).join('') : '<div class="project-empty">Noch keine Phasen. Erstelle die erste Projektphase.</div>';
    }
    const sectionHead = form.previousElementSibling;
    const badge = sectionHead?.querySelector?.('.badge');
    if (badge) badge.textContent = `${phases.length} Phase${phases.length === 1 ? '' : 'n'}`;
  }

  function getSupabaseClient() {
    const config = window.HABITFLOW_SUPABASE_CONFIG || {};
    if (!config.url || !config.anonKey || !window.supabase?.createClient) return null;
    if (!getSupabaseClient.client) {
      getSupabaseClient.client = window.supabase.createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    }
    return getSupabaseClient.client;
  }

  async function currentUserId(client) {
    try {
      return (await client?.auth.getUser())?.data?.user?.id || null;
    } catch {
      return null;
    }
  }

  async function persistPhaseRemote(phase) {
    const client = getSupabaseClient();
    const userId = await currentUserId(client);
    if (!client || !userId) throw new Error('Supabase ist nicht verbunden.');

    const row = {
      id: phase.id,
      user_id: userId,
      project_id: phase.project_id,
      name: phase.name,
      start_date: phase.start_date,
      end_date: phase.end_date,
      status: phase.status,
      is_archived: false,
      created_at: phase.created_at,
      updated_at: phase.updated_at
    };
    const { error } = await client.from('project_phases').upsert(row, { onConflict: 'id' });
    if (error) throw error;
  }

  async function savePhase(form) {
    const data = new FormData(form);
    const projectId = form.dataset.projectId;
    const name = String(data.get('name') || '').trim();
    const start = validDate(data.get('start_date'));
    const end = validDate(data.get('end_date'));
    if (!projectId) return toast('Projekt konnte fuer die Phase nicht gefunden werden.');
    if (!name || !start || !end) return toast('Phase braucht Name, Start und Ende.');
    if (end < start) return toast('Phasenende darf nicht vor Start liegen.');

    const now = new Date().toISOString();
    const phase = normalizePhase({ id: uid(), project_id: projectId, name, start_date: start, end_date: end, status: data.get('status'), created_at: now, updated_at: now, synced: true });

    try {
      await persistPhaseRemote(phase);
    } catch (error) {
      console.warn('[HabitFlow/projects] Phase konnte nicht in Supabase gespeichert werden.', error);
      toast('Phase konnte nicht in Supabase gespeichert werden.');
      return;
    }

    const state = readState();
    state.projectPhases = Array.isArray(state.projectPhases) ? state.projectPhases : [];
    state.projectPhases = [phase, ...state.projectPhases.filter(item => item.id !== phase.id)];
    writeState(state);
    form.reset();
    renderPhaseList(form, projectId, state);
    toast('Phase gespeichert');
  }

  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof window.HTMLFormElement) || !form.matches('[data-project-phase-form]')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    savePhase(form);
  }, true);
})(window, document);
