(function enhanceProjectMilestoneEditing(window, document) {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const TABLE_MILESTONES = 'project_milestones';

  function toast(message) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.remove('hidden');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.add('hidden'), 2400);
  }

  function todayDate() { return new Date().toISOString().slice(0, 10); }
  function nowIso() { return new Date().toISOString(); }

  function validDate(value) {
    const text = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(new Date(`${text}T12:00:00`).getTime()) ? text : '';
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
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state || {}));
  }

  function projectMilestones(state) {
    return Array.isArray(state.projectMilestones) ? state.projectMilestones : [];
  }

  function projectPhases(state, projectId) {
    return (Array.isArray(state.projectPhases) ? state.projectPhases : [])
      .filter(phase => phase?.project_id === projectId && !phase.is_archived);
  }

  function currentAccessToken() {
    const config = window.HABITFLOW_SUPABASE_CONFIG || {};
    const ref = String(config.url || '').match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    const keys = ref ? [`sb-${ref}-auth-token`] : [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) keys.push(key);
    }
    for (const key of [...new Set(keys)]) {
      try {
        const session = JSON.parse(window.localStorage.getItem(key) || '{}');
        const token = session?.access_token || session?.currentSession?.access_token;
        if (token) return token;
      } catch {}
    }
    return '';
  }

  function userIdFromToken(token) {
    try {
      const payload = JSON.parse(atob(String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.sub || '';
    } catch {
      return '';
    }
  }

  async function upsertMilestone(row) {
    const config = window.HABITFLOW_SUPABASE_CONFIG || {};
    const token = currentAccessToken();
    const userId = userIdFromToken(token);
    if (!config.url || !config.anonKey || !token || !userId) throw new Error('Supabase ist nicht verbunden.');
    const response = await fetch(`${config.url}/rest/v1/${TABLE_MILESTONES}?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify([{ ...row, user_id: userId }])
    });
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json())?.message || ''; } catch {}
      throw new Error(detail || 'Meilenstein konnte nicht gespeichert werden.');
    }
  }

  function resetMilestoneForm(form, projectId) {
    delete form.dataset.editingMilestoneId;
    const button = form.querySelector('button[type="submit"]');
    if (button) button.textContent = 'Meilenstein speichern';
    form.reset();
    const dateInput = form.elements.milestone_date;
    if (dateInput && !dateInput.value) dateInput.value = todayDate();
    form.dataset.projectId = projectId;
  }

  function refreshProjectDetail(projectId) {
    const close = document.querySelector('[data-action="close-project-detail"]');
    const opener = document.querySelector(`[data-action="open-project-detail"][data-id="${CSS.escape(projectId)}"]`);
    if (close && opener) {
      close.click();
      window.setTimeout(() => opener.click(), 40);
      return;
    }
    window.dispatchEvent(new Event('habitflow:projects-changed'));
  }

  function startMilestoneEdit(id) {
    const state = readState();
    const milestone = projectMilestones(state).find(item => item?.id === id);
    if (!milestone) return;
    const form = document.querySelector(`[data-project-milestone-form][data-project-id="${CSS.escape(milestone.project_id)}"]`);
    if (!form) return;
    form.dataset.editingMilestoneId = milestone.id;
    form.elements.title.value = milestone.title || '';
    form.elements.milestone_date.value = validDate(milestone.milestone_date) || todayDate();
    if (form.elements.phase_id) {
      const phases = projectPhases(state, milestone.project_id);
      const phaseStillExists = !milestone.phase_id || phases.some(phase => phase.id === milestone.phase_id);
      form.elements.phase_id.value = phaseStillExists ? (milestone.phase_id || '') : '';
    }
    const button = form.querySelector('button[type="submit"]');
    if (button) button.textContent = 'Meilenstein aktualisieren';
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    form.elements.title.focus();
  }

  async function saveEditedMilestone(event, form) {
    const milestoneId = form.dataset.editingMilestoneId;
    if (!milestoneId) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const state = readState();
    const milestone = projectMilestones(state).find(item => item?.id === milestoneId);
    if (!milestone) return resetMilestoneForm(form, form.dataset.projectId || '');

    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const milestoneDate = validDate(data.get('milestone_date'));
    const phaseId = String(data.get('phase_id') || '');
    if (!title || !milestoneDate) return toast('Meilenstein braucht Titel und Datum.');

    const updatedAt = nowIso();
    const updated = { ...milestone, title, milestone_date: milestoneDate, phase_id: phaseId, updated_at: updatedAt, synced: true };
    const row = {
      id: updated.id,
      project_id: updated.project_id,
      phase_id: updated.phase_id || null,
      title: updated.title,
      milestone_date: updated.milestone_date,
      is_archived: false,
      created_at: updated.created_at || updatedAt,
      updated_at: updated.updated_at
    };

    try {
      await upsertMilestone(row);
      state.projectMilestones = projectMilestones(state).map(item => item.id === updated.id ? updated : item);
      writeState(state);
      resetMilestoneForm(form, updated.project_id);
      refreshProjectDetail(updated.project_id);
      toast('Meilenstein aktualisiert');
    } catch (error) {
      toast(error.message || 'Meilenstein konnte nicht aktualisiert werden.');
    }
  }

  document.addEventListener('click', event => {
    const action = event.target.closest?.('[data-action="edit-milestone"]');
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    startMilestoneEdit(action.dataset.id || '');
  }, true);

  document.addEventListener('submit', event => {
    const form = event.target;
    if (!form?.matches?.('[data-project-milestone-form]') || !form.dataset.editingMilestoneId) return;
    saveEditedMilestone(event, form);
  }, true);
})(window, document);
