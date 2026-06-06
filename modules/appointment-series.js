(function registerHabitFlowAppointmentSeries(window, document) {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const FORM_ID = 'appointmentForm';
  const FIELD_ID = 'appointmentRecurrenceSelect';
  const FIELD_NAME = 'recurrence';
  const RESTORE_KEY = 'habitflow-appointment-series-restore';
  let editingAppointmentId = null;
  const RECURRENCE_OPTIONS = Object.freeze({
    once: { label: 'Einmalig', count: 1 },
    weekly: { label: 'Wöchentlich', count: 104 },
    monthly: { label: 'Monatlich', count: 36 },
    quarterly: { label: 'Quartal', count: 20 },
    yearly: { label: 'Jährlich', count: 10 },
  });

  function uid() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function addMonthsClamped(base, months) {
    const date = new Date(base.getTime());
    const originalDay = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + months);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(originalDay, lastDay));
    date.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds());
    return date;
  }

  function advanceDate(base, recurrence, index) {
    const date = new Date(base.getTime());
    if (recurrence === 'weekly') {
      date.setDate(date.getDate() + index * 7);
      return date;
    }
    if (recurrence === 'monthly') {
      return addMonthsClamped(base, index);
    }
    if (recurrence === 'quarterly') {
      return addMonthsClamped(base, index * 3);
    }
    if (recurrence === 'yearly') {
      return addMonthsClamped(base, index * 12);
    }
    return date;
  }

  function readState() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
      const state = parsed && typeof parsed === 'object' ? parsed : {};
      if (!Array.isArray(state.appointments)) {
        state.appointments = [];
      }
      return state;
    } catch (error) {
      console.warn('HabitFlow appointment series: state could not be read.', error);
      return { appointments: [] };
    }
  }

  function writeState(state) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function appointmentKey(appointment) {
    return [
      appointment.title || '',
      appointment.starts_at || '',
      appointment.ends_at || '',
      appointment.location || '',
    ].join('|');
  }

  function toast(message, type) {
    const node = document.getElementById('toast');
    if (!node) {
      console.info(message);
      return;
    }
    node.textContent = message;
    node.className = `toast ${type || 'success'}`;
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => node.classList.add('hidden'), 2600);
  }

  function recurrenceLabel(recurrence) {
    return RECURRENCE_OPTIONS[recurrence]?.label || RECURRENCE_OPTIONS.once.label;
  }

  function isEditingAppointment() {
    const title = document.getElementById('appointmentFormTitle')?.textContent || '';
    const cancelButton = document.getElementById('cancelAppointmentEditBtn');
    return /bearbeiten/i.test(title) || Boolean(cancelButton && !cancelButton.classList.contains('hidden'));
  }

  function syncFieldAvailability() {
    const field = document.getElementById(FIELD_ID);
    if (!field) {
      return;
    }
    field.disabled = false;
    field.title = isEditingAppointment()
      ? 'Beim Speichern wird aus diesem Termin eine Serie angelegt.'
      : '';
  }

  function injectField() {
    const form = document.getElementById(FORM_ID);
    if (!form || document.getElementById(FIELD_ID)) {
      return null;
    }

    const label = document.createElement('label');
    label.className = 'appointment-series-field';
    label.innerHTML = `
      <span>Zyklus</span>
      <select id="${FIELD_ID}" name="${FIELD_NAME}">
        <option value="once">Einmalig</option>
        <option value="weekly">Wöchentlich</option>
        <option value="monthly">Monatlich</option>
        <option value="quarterly">Quartal</option>
        <option value="yearly">Jährlich</option>
      </select>
    `;

    const locationLabel = form.elements.location?.closest('label');
    const descriptionLabel = form.elements.description?.closest('label');
    if (locationLabel) {
      locationLabel.insertAdjacentElement('afterend', label);
    } else if (descriptionLabel) {
      descriptionLabel.insertAdjacentElement('beforebegin', label);
    } else {
      form.insertBefore(label, form.querySelector('.form-actions'));
    }
    return form;
  }

  function buildSeries(form, recurrence, existingAppointment = null) {
    const option = RECURRENCE_OPTIONS[recurrence];
    const formData = new FormData(form);
    const title = String(formData.get('title') || '').trim();
    const startsAtRaw = String(formData.get('starts_at') || '');
    const endsAtRaw = String(formData.get('ends_at') || '');
    const startDate = new Date(startsAtRaw);
    const endDate = endsAtRaw ? new Date(endsAtRaw) : null;

    if (!title || Number.isNaN(startDate.getTime())) {
      throw new Error('Bitte gib mindestens Titel und Startzeit ein.');
    }
    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new Error('Bitte prüfe die Endzeit.');
    }
    if (endDate && endDate < startDate) {
      throw new Error('Die Endzeit muss nach dem Start liegen.');
    }

    const createdAt = existingAppointment?.created_at || nowIso();
    const seriesId = uid();
    const duration = endDate ? endDate.getTime() - startDate.getTime() : null;
    const rows = [];

    for (let index = 0; index < option.count; index += 1) {
      const occurrenceStart = advanceDate(startDate, recurrence, index);
      const occurrenceEnd = duration == null ? null : new Date(occurrenceStart.getTime() + duration);
      rows.push({
        id: index === 0 && existingAppointment?.id ? existingAppointment.id : uid(),
        title,
        description: String(formData.get('description') || '').trim(),
        location: String(formData.get('location') || '').trim(),
        appointment_type: String(formData.get('appointment_type') || 'other').trim() || 'other',
        starts_at: occurrenceStart.toISOString(),
        ends_at: occurrenceEnd ? occurrenceEnd.toISOString() : null,
        created_at: createdAt,
        updated_at: createdAt,
        synced: false,
        recurrence,
        series_id: seriesId,
        series_index: index,
      });
    }

    return rows;
  }

  async function syncAppointments(rows) {
    const config = window.HABITFLOW_SUPABASE_CONFIG || {};
    if (!window.supabase || !config.url || !config.anonKey || !rows.length) {
      return false;
    }

    const client = window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    const sessionResult = await client.auth.getSession();
    const userId = sessionResult?.data?.session?.user?.id;
    if (!userId) {
      return false;
    }

    const payload = rows.map((row) => ({
      id: row.id,
      user_id: userId,
      title: row.title,
      description: row.description || null,
      location: row.location || null,
      appointment_type: row.appointment_type || 'other',
      starts_at: row.starts_at,
      ends_at: row.ends_at || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
    const { error } = await client.from('appointments').upsert(payload, { onConflict: 'id' });
    if (error) {
      throw error;
    }
    return true;
  }

  function markSynced(ids) {
    const idSet = new Set(ids);
    const state = readState();
    state.appointments = state.appointments.map((appointment) => (
      idSet.has(appointment.id) ? { ...appointment, synced: true } : appointment
    ));
    writeState(state);
  }

  function currentEditingAppointment(state, form) {
    if (editingAppointmentId) {
      const match = state.appointments.find((appointment) => appointment.id === editingAppointmentId);
      if (match) {
        return match;
      }
    }
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const startsAtRaw = String(data.get('starts_at') || '');
    const startDate = new Date(startsAtRaw);
    if (!title || Number.isNaN(startDate.getTime())) {
      return null;
    }
    return state.appointments.find((appointment) => (
      appointment.title === title && appointment.starts_at === startDate.toISOString()
    )) || null;
  }

  function rememberEditingAppointmentFromForm() {
    if (!isEditingAppointment()) {
      return;
    }
    const form = document.getElementById(FORM_ID);
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    const match = currentEditingAppointment(readState(), form);
    if (match?.id) {
      editingAppointmentId = match.id;
    }
  }

  function rememberCalendarRestore() {
    try {
      window.sessionStorage.setItem(RESTORE_KEY, JSON.stringify({ screen: 'calendar' }));
    } catch (error) {}
  }

  function showCalendarScreen() {
    const calendarButton = document.querySelector('.nav-btn[data-target="calendar"]');
    calendarButton?.click();
    const calendarScreen = document.getElementById('screen-calendar');
    if (calendarScreen && !calendarScreen.classList.contains('active')) {
      document.querySelectorAll('.screen').forEach((screen) => {
        const active = screen === calendarScreen;
        screen.classList.toggle('active', active);
        screen.hidden = !active;
        screen.setAttribute('aria-hidden', String(!active));
      });
      document.querySelectorAll('.nav-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.target === 'calendar');
      });
    }
  }

  function restoreCalendarAfterReload() {
    let shouldRestore = false;
    try {
      shouldRestore = JSON.parse(window.sessionStorage.getItem(RESTORE_KEY) || 'null')?.screen === 'calendar';
      if (shouldRestore) {
        window.sessionStorage.removeItem(RESTORE_KEY);
      }
    } catch (error) {
      shouldRestore = false;
    }
    if (!shouldRestore) {
      return;
    }
    showCalendarScreen();
    window.setTimeout(showCalendarScreen, 0);
    window.setTimeout(showCalendarScreen, 60);
    window.setTimeout(showCalendarScreen, 220);
    window.setTimeout(showCalendarScreen, 420);
  }

  function resetEditContextIfNeeded(action, target) {
    if (action === 'edit-appointment' || (action || '').includes('edit-appointment')) {
      editingAppointmentId = target?.dataset?.id || null;
      window.setTimeout(rememberEditingAppointmentFromForm, 0);
      return;
    }
    if (
      action === 'new-appointment-for-day'
      || target?.id === 'appointmentFormToggleBtn'
      || target?.id === 'appointmentFormCloseBtn'
      || target?.id === 'cancelAppointmentEditBtn'
    ) {
      editingAppointmentId = null;
    }
    window.setTimeout(rememberEditingAppointmentFromForm, 0);
  }

  async function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== FORM_ID) {
      return;
    }
    const recurrence = form.elements[FIELD_NAME]?.value || 'once';
    if (recurrence === 'once') {
      return;
    }
    if (!RECURRENCE_OPTIONS[recurrence]) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const state = readState();
    const existingAppointment = isEditingAppointment() ? currentEditingAppointment(state, form) : null;
    let rows;
    try {
      rows = buildSeries(form, recurrence, existingAppointment);
    } catch (error) {
      toast(error.message, 'danger');
      return;
    }

    const existingKeys = new Set(state.appointments.map(appointmentKey));
    const additions = rows.filter((row, index) => (
      index === 0 && existingAppointment?.id ? true : !existingKeys.has(appointmentKey(row))
    ));
    if (!additions.length) {
      toast('Diese Terminserie ist bereits angelegt.', 'warning');
      return;
    }

    if (existingAppointment?.id) {
      const replacement = { ...additions[0], synced: false };
      state.appointments = state.appointments.map((appointment) => (
        appointment.id === existingAppointment.id ? replacement : appointment
      ));
      state.appointments = [...state.appointments, ...additions.slice(1)];
    } else {
      state.appointments = [...state.appointments, ...additions];
    }
    writeState(state);
    toast(`${additions.length} Termine als ${recurrenceLabel(recurrence)}-Serie angelegt.`, 'success');

    try {
      const synced = await syncAppointments(additions);
      if (synced) {
        markSynced(additions.map((row) => row.id));
      }
    } catch (error) {
      console.warn('HabitFlow appointment series: sync failed, local changes remain pending.', error);
    }

    rememberCalendarRestore();
    window.setTimeout(() => window.location.reload(), 700);
  }

  function install() {
    const form = injectField();
    if (!form) {
      return;
    }
    syncFieldAvailability();
    restoreCalendarAfterReload();
    form.addEventListener('submit', handleSubmit, true);
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('button, [data-action]') : null;
      resetEditContextIfNeeded(target?.dataset?.action, target);
      window.setTimeout(syncFieldAvailability, 0);
    });
  }

  if (document.readyState === 'loading') {
    restoreCalendarAfterReload();
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})(window, document);
