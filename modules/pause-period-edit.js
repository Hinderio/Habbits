(function registerHabitFlowPausePeriodEdit(window, document) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (modules && modules.has('pause-period-edit')) return;

  const STORAGE_KEY = 'habitflow-state-v1';
  const RETURN_KEY = 'habitflow-pause-edit-return';
  const EDITING_ATTR = 'data-hf-editing-pause-id';
  let enhanceTimer = null;
  let observer = null;
  let supabaseClient = null;

  function readState() {
    try {
      const parsed = JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.warn('[HabitFlow/pause-period-edit] State konnte nicht gelesen werden.', error);
      return {};
    }
  }

  function writeState(state) {
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn('[HabitFlow/pause-period-edit] State konnte nicht gespeichert werden.', error);
      return false;
    }
  }

  function normalizeScope(scope = 'smoke') {
    return ['smoke', 'alcohol', 'habit'].includes(String(scope)) ? String(scope) : 'smoke';
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function toDateTimeLocalValue(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function fromDateTimeLocalValue(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function pauseScopeLabel(scope, targetId, state = readState()) {
    const normalized = normalizeScope(scope);
    if (normalized === 'smoke') return 'Rauchen';
    if (normalized === 'alcohol') return 'Alkohol';
    const habit = (Array.isArray(state.habits) ? state.habits : []).find(item => item && item.id === targetId);
    return habit?.name ? `Habit: ${habit.name}` : 'Habit';
  }

  function findPause(id, state = readState()) {
    const periods = Array.isArray(state.pausePeriods) ? state.pausePeriods : [];
    const index = periods.findIndex(item => item && item.id === id);
    return { periods, index, pause: index >= 0 ? periods[index] : null };
  }

  function setToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    window.clearTimeout(setToast.timer);
    setToast.timer = window.setTimeout(() => toast.classList.add('hidden'), 2600);
  }

  function setEditMode(form, id = '') {
    if (!form) return;
    if (id) form.setAttribute(EDITING_ATTR, id);
    else form.removeAttribute(EDITING_ATTR);
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.textContent = id ? 'Änderungen speichern' : 'Pause speichern';
  }

  function clearEditMode() {
    setEditMode(document.getElementById('pauseForm'), '');
  }

  function openEditModal(id) {
    const modal = document.getElementById('pauseModal');
    const form = document.getElementById('pauseForm');
    if (!modal || !form || !id) return;

    const state = readState();
    const { pause } = findPause(id, state);
    if (!pause) {
      setToast('Pause nicht gefunden. Bitte kurz neu laden.');
      return;
    }

    const scope = normalizeScope(pause.scope);
    form.reset();
    setEditMode(form, id);
    if (form.elements.scope) form.elements.scope.value = scope;
    if (form.elements.target_id) form.elements.target_id.value = scope === 'habit' ? (pause.target_id || '') : '';
    if (form.elements.starts_at) form.elements.starts_at.value = toDateTimeLocalValue(pause.starts_at);
    if (form.elements.ends_at) form.elements.ends_at.value = pause.ends_at ? toDateTimeLocalValue(pause.ends_at) : '';
    if (form.elements.note) form.elements.note.value = pause.note || '';

    const label = pauseScopeLabel(scope, pause.target_id, state);
    const labelInput = document.getElementById('pauseScopeLabel');
    const title = document.getElementById('pauseModalTitle');
    if (labelInput) labelInput.value = label;
    if (title) title.textContent = `${label} bearbeiten`;

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    window.setTimeout(() => form.elements.starts_at?.focus({ preventScroll: true }), 30);
  }

  function normalizeUpdatedPause(existing, values) {
    const scope = normalizeScope(values.scope);
    return {
      ...existing,
      scope,
      target_id: scope === 'habit' ? (values.targetId || null) : null,
      starts_at: values.startsAt,
      ends_at: values.endsAt || null,
      note: values.note,
      is_archived: Boolean(existing.is_archived),
      created_at: existing.created_at || nowIso(),
      updated_at: nowIso(),
      synced: false
    };
  }

  async function upsertRemotePause(pause) {
    try {
      const config = window.HABITFLOW_SUPABASE_CONFIG || {};
      if (!config.url || !config.anonKey || !window.supabase?.createClient) return;
      supabaseClient = supabaseClient || window.supabase.createClient(config.url, config.anonKey);
      const { data } = await supabaseClient.auth.getSession();
      const userId = data?.session?.user?.id;
      if (!userId) return;
      await supabaseClient.from('pause_periods').upsert({
        id: pause.id,
        user_id: userId,
        scope: pause.scope,
        target_id: pause.target_id || null,
        starts_at: pause.starts_at,
        ends_at: pause.ends_at || null,
        note: pause.note || '',
        is_archived: Boolean(pause.is_archived),
        created_at: pause.created_at,
        updated_at: pause.updated_at
      });
    } catch (error) {
      console.warn('[HabitFlow/pause-period-edit] Remote-Sync der bearbeiteten Pause wurde übersprungen.', error);
    }
  }

  async function saveEditedPause(form, id) {
    const data = new FormData(form);
    const scope = normalizeScope(data.get('scope'));
    const startsAt = fromDateTimeLocalValue(data.get('starts_at'));
    const endsAt = data.get('ends_at') ? fromDateTimeLocalValue(data.get('ends_at')) : null;
    const targetId = scope === 'habit' ? String(data.get('target_id') || '').trim() : null;

    if (!startsAt) {
      setToast('Bitte Startdatum der Pause setzen.');
      form.elements.starts_at?.focus();
      return;
    }
    if (endsAt && new Date(endsAt) < new Date(startsAt)) {
      setToast('Ende der Pause muss nach dem Start liegen.');
      form.elements.ends_at?.focus();
      return;
    }

    const state = readState();
    const { periods, index, pause } = findPause(id, state);
    if (!pause || index < 0) {
      setToast('Pause nicht gefunden. Bitte kurz neu laden.');
      return;
    }

    const updated = normalizeUpdatedPause(pause, {
      scope,
      targetId,
      startsAt,
      endsAt,
      note: String(data.get('note') || '').trim()
    });
    periods[index] = updated;
    state.pausePeriods = periods;

    if (!writeState(state)) {
      setToast('Pause konnte lokal nicht gespeichert werden.');
      return;
    }

    const modal = document.getElementById('pauseModal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    clearEditMode();
    setToast('Pause aktualisiert');

    await Promise.race([
      upsertRemotePause(updated),
      new Promise(resolve => window.setTimeout(resolve, 1800))
    ]);

    try { window.sessionStorage?.setItem(RETURN_KEY, '1'); } catch {}
    window.setTimeout(() => window.location.reload(), 220);
  }

  function enhancePauseCards() {
    document.querySelectorAll('.pause-card').forEach(card => {
      const deleteButton = card.querySelector('[data-action="delete-pause"][data-id]');
      const actions = deleteButton?.closest('.pause-card-actions');
      if (!deleteButton || !actions || actions.querySelector('[data-action="edit-pause"]')) return;
      const button = document.createElement('button');
      button.className = 'mini-btn';
      button.type = 'button';
      button.dataset.action = 'edit-pause';
      button.dataset.id = deleteButton.dataset.id || '';
      button.textContent = 'Bearbeiten';
      actions.insertBefore(button, deleteButton);
    });
  }

  function scheduleEnhance(delay = 80) {
    window.clearTimeout(enhanceTimer);
    enhanceTimer = window.setTimeout(enhancePauseCards, delay);
  }

  function restoreAfterReload() {
    try {
      if (window.sessionStorage?.getItem(RETURN_KEY) !== '1') return;
      window.sessionStorage.removeItem(RETURN_KEY);
    } catch {
      return;
    }
    window.setTimeout(() => {
      document.querySelector('.nav-btn[data-target="smoking"]')?.click();
      window.setTimeout(() => document.getElementById('consumptionPauseList')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 360);
    }, 900);
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const actionEl = event.target.closest?.('[data-action]');
      if (actionEl?.dataset.action === 'open-pause-modal') {
        clearEditMode();
        return;
      }
      if (actionEl?.dataset.action === 'close-pause-modal' || event.target?.id === 'pauseModalCloseBtn' || event.target?.id === 'pauseModal') {
        window.setTimeout(clearEditMode, 0);
        return;
      }
      const editButton = event.target.closest?.('[data-action="edit-pause"][data-id]');
      if (!editButton) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openEditModal(editButton.dataset.id);
    }, true);

    document.addEventListener('submit', event => {
      if (event.target?.id !== 'pauseForm') return;
      const id = event.target.getAttribute(EDITING_ATTR);
      if (!id) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      saveEditedPause(event.target, id);
    }, true);

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') window.setTimeout(clearEditMode, 0);
    }, true);
  }

  function start() {
    bindEvents();
    restoreAfterReload();
    [120, 600, 1400].forEach(delay => window.setTimeout(enhancePauseCards, delay));
    if (document.body) {
      observer = new MutationObserver(() => scheduleEnhance(80));
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  if (modules) {
    modules.register('pause-period-edit', {
      description: 'Adds targeted edit support for existing consumption and habit pause periods using the existing pause modal.',
      augments: Object.freeze(['pause_periods', '#pauseForm', '#consumptionPauseList']),
      replacesScreens: false,
      active: true
    });
  }
})(window, document);
