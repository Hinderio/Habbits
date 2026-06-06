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

  function cleanDescription(value) {
    return String(value || '').trim();
  }

  function appointmentSignature(appointment) {
    return [
      appointment.title || '',
      appointment.location || '',
      appointment.appointment_type || 'other',
      cleanDescription(appointment.description),
      durationMs(appointment),
    ].join('|');
  }

  function durationMs(appointment) {
    const start = new Date(appointment?.starts_at || '').getTime();
    const end = new Date(appointment?.ends_at || '').getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return '';
    }
    return String(end - start);
  }

  function sameInstant(left, right) {
    return Math.abs(new Date(left).getTime() - new Date(right).getTime()) < 1000;
  }

  function timestampMs(value) {
    const time = new Date(value || '').getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function sameCreatedAt(left, right) {
    if (!left?.created_at || !right?.created_at) {
      return false;
    }
    return sameInstant(left.created_at, right.created_at);
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

  function buildAppointmentFromForm(form, existingAppointment = null) {
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

    const timestamp = nowIso();
    return {
      id: existingAppointment?.id || uid(),
      title,
      description: cleanDescription(formData.get('description')),
      location: String(formData.get('location') || '').trim(),
      appointment_type: String(formData.get('appointment_type') || 'other').trim() || 'other',
      starts_at: startDate.toISOString(),
      ends_at: endDate ? endDate.toISOString() : null,
      created_at: existingAppointment?.created_at || timestamp,
      updated_at: timestamp,
      recurrence: null,
      series_id: null,
      series_index: null,
      synced: false,
    };
  }

  function buildSeries(form, recurrence, existingAppointment = null, seriesId = null) {
    const option = RECURRENCE_OPTIONS[recurrence];
    const base = buildAppointmentFromForm(form, existingAppointment);
    const startDate = new Date(base.starts_at);
    const duration = base.ends_at ? new Date(base.ends_at).getTime() - startDate.getTime() : null;
    const effectiveSeriesId = seriesId || existingAppointment?.series_id || uid();
    const rows = [];

    for (let index = 0; index < option.count; index += 1) {
      const occurrenceStart = advanceDate(startDate, recurrence, index);
      const occurrenceEnd = duration == null ? null : new Date(occurrenceStart.getTime() + duration);
      rows.push({
        ...base,
        id: index === 0 && existingAppointment?.id ? existingAppointment.id : uid(),
        starts_at: occurrenceStart.toISOString(),
        ends_at: occurrenceEnd ? occurrenceEnd.toISOString() : null,
        synced: false,
        recurrence,
        series_id: effectiveSeriesId,
        series_index: index,
      });
    }

    return rows;
  }

  function seriesFromLocalFields(state, appointment) {
    if (!appointment?.series_id) {
      return null;
    }
    const appointments = state.appointments
      .filter((item) => item.series_id === appointment.series_id)
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    const recurrence = appointment.recurrence || appointments.find((item) => item.recurrence)?.recurrence;
    if (!RECURRENCE_OPTIONS[recurrence] || appointments.length < 2) {
      return null;
    }
    return { recurrence, appointments, seriesId: appointment.series_id };
  }

  function detectSeriesByCadence(state, appointment) {
    if (!appointment?.starts_at) {
      return null;
    }
    const signature = appointmentSignature(appointment);
    const candidates = state.appointments
      .filter((item) => item.id && appointmentSignature(item) === signature)
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    if (candidates.length < 2) {
      return null;
    }

    const recurrenceOrder = ['weekly', 'monthly', 'quarterly', 'yearly'];
    for (const recurrence of recurrenceOrder) {
      for (const anchor of candidates) {
        const anchorDate = new Date(anchor.starts_at);
        const group = candidates.filter((candidate) => {
          for (let index = 0; index < RECURRENCE_OPTIONS[recurrence].count; index += 1) {
            if (sameInstant(candidate.starts_at, advanceDate(anchorDate, recurrence, index).toISOString())) {
              return true;
            }
          }
          return false;
        });
        if (group.length >= 2 && group.some((item) => item.id === appointment.id)) {
          return {
            recurrence,
            appointments: group.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)),
            seriesId: appointment.series_id || group.find((item) => item.series_id)?.series_id || uid(),
          };
        }
      }
    }
    return null;
  }

  function inferSeries(state, appointment) {
    return seriesFromLocalFields(state, appointment) || detectSeriesByCadence(state, appointment);
  }

  function generatedFollowers(state, appointment) {
    if (!appointment?.id || !appointment?.starts_at) {
      return [];
    }
    const anchorStart = timestampMs(appointment.starts_at);
    const signature = appointmentSignature(appointment);
    return state.appointments
      .filter((item) => item.id !== appointment.id)
      .filter((item) => timestampMs(item.starts_at) > anchorStart)
      .filter((item) => appointmentSignature(item) === signature)
      .filter((item) => sameCreatedAt(item, appointment) || item.series_id === appointment.series_id)
      .sort((a, b) => timestampMs(a.starts_at) - timestampMs(b.starts_at));
  }

  function appointmentsFromEditPoint(state, appointment, existingSeries) {
    if (!appointment?.starts_at) {
      return [];
    }
    const anchorStart = timestampMs(appointment.starts_at);
    const seriesAppointments = existingSeries?.appointments?.length
      ? existingSeries.appointments
      : [appointment, ...generatedFollowers(state, appointment)];
    return seriesAppointments
      .filter((item) => item.id && (item.id === appointment.id || timestampMs(item.starts_at) >= anchorStart))
      .sort((a, b) => timestampMs(a.starts_at) - timestampMs(b.starts_at));
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
      recurrence: row.recurrence || null,
      series_id: row.series_id || null,
      series_index: Number.isInteger(row.series_index) ? row.series_index : null,
    }));
    const { error } = await client.from('appointments').upsert(payload, { onConflict: 'id' });
    if (error) {
      throw error;
    }
    return true;
  }

  async function deleteRemoteAppointments(ids) {
    const config = window.HABITFLOW_SUPABASE_CONFIG || {};
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (!window.supabase || !config.url || !config.anonKey || !uniqueIds.length) {
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
    const { error } = await client.from('appointments').delete().eq('user_id', userId).in('id', uniqueIds);
    if (error) {
      throw error;
    }
    return true;
  }

  function sameTextValue(left, right) {
    return cleanDescription(left) === cleanDescription(right);
  }

  function isGeneratedFollower(anchor, candidate) {
    if (!anchor || !candidate || candidate.id === anchor.id) {
      return false;
    }
    if (timestampMs(candidate.starts_at) <= timestampMs(anchor.starts_at)) {
      return false;
    }
    if (appointmentSignature(candidate) !== appointmentSignature(anchor)) {
      return false;
    }
    if (sameCreatedAt(candidate, anchor)) {
      return true;
    }
    const anchorDate = new Date(anchor.starts_at);
    return ['weekly', 'monthly', 'quarterly', 'yearly'].some((recurrence) => {
      for (let index = 1; index < RECURRENCE_OPTIONS[recurrence].count; index += 1) {
        if (sameInstant(candidate.starts_at, advanceDate(anchorDate, recurrence, index).toISOString())) {
          return true;
        }
      }
      return false;
    });
  }

  async function deleteRemoteGeneratedFollowers(anchor, keepId) {
    const config = window.HABITFLOW_SUPABASE_CONFIG || {};
    if (!window.supabase || !config.url || !config.anonKey || !anchor?.starts_at || !anchor?.created_at) {
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

    if (anchor.series_id) {
      let query = client.from('appointments')
        .delete()
        .eq('user_id', userId)
        .eq('series_id', anchor.series_id)
        .gt('starts_at', anchor.starts_at);
      if (keepId) {
        query = query.neq('id', keepId);
      }
      const { error: seriesDeleteError } = await query;
      if (seriesDeleteError) {
        throw seriesDeleteError;
      }
      return true;
    }

    const { data, error } = await client.from('appointments')
      .select('id,title,description,location,appointment_type,starts_at,ends_at,created_at,updated_at,recurrence,series_id,series_index')
      .eq('user_id', userId)
      .eq('title', anchor.title || '')
      .eq('appointment_type', anchor.appointment_type || 'other')
      .gt('starts_at', anchor.starts_at)
      .order('starts_at', { ascending: true });
    if (error) {
      throw error;
    }

    const ids = (data || [])
      .filter((candidate) => candidate.id !== keepId)
      .filter((candidate) => sameTextValue(candidate.location, anchor.location))
      .filter((candidate) => sameTextValue(candidate.description, anchor.description))
      .filter((candidate) => isGeneratedFollower(anchor, candidate))
      .map((candidate) => candidate.id)
      .filter(Boolean);
    if (!ids.length) {
      return false;
    }
    return deleteRemoteAppointments(ids);
  }

  function markDeletedAppointments(state, ids, synced = false) {
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (!uniqueIds.length) {
      return;
    }
    if (!state.deletedRemoteIds || typeof state.deletedRemoteIds !== 'object') {
      state.deletedRemoteIds = {};
    }
    if (!state.deletedRemoteIds.appointments || typeof state.deletedRemoteIds.appointments !== 'object') {
      state.deletedRemoteIds.appointments = {};
    }
    const timestamp = nowIso();
    uniqueIds.forEach((id) => {
      state.deletedRemoteIds.appointments[id] = {
        deleted_at: timestamp,
        ...(synced ? { synced_at: timestamp } : {}),
      };
    });
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

  function rememberEditingAppointmentFromForm({ applyDetectedRecurrence = false } = {}) {
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
      if (!applyDetectedRecurrence) {
        return;
      }
      const field = document.getElementById(FIELD_ID);
      const series = inferSeries(readState(), match);
      if (field && series?.recurrence) {
        field.value = series.recurrence;
      }
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
      window.setTimeout(() => rememberEditingAppointmentFromForm({ applyDetectedRecurrence: true }), 0);
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
    window.setTimeout(() => rememberEditingAppointmentFromForm({ applyDetectedRecurrence: false }), 0);
  }

  async function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== FORM_ID) {
      return;
    }
    const recurrence = form.elements[FIELD_NAME]?.value || 'once';
    if (!RECURRENCE_OPTIONS[recurrence]) {
      return;
    }

    const state = readState();
    const existingAppointment = isEditingAppointment() ? currentEditingAppointment(state, form) : null;
    const existingSeries = existingAppointment ? inferSeries(state, existingAppointment) : null;
    if (recurrence === 'once' && !existingSeries && !existingAppointment) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    let rows;
    try {
      rows = recurrence === 'once'
        ? [buildAppointmentFromForm(form, existingAppointment)]
        : buildSeries(form, recurrence, existingAppointment, existingSeries?.seriesId);
    } catch (error) {
      toast(error.message, 'danger');
      return;
    }

    const replacedAppointments = existingAppointment
      ? appointmentsFromEditPoint(state, existingAppointment, existingSeries)
      : [];
    const replacedSeriesIds = new Set(replacedAppointments.map((appointment) => appointment.id));
    const existingKeys = new Set(state.appointments
      .filter((appointment) => !replacedSeriesIds.has(appointment.id))
      .map(appointmentKey));
    const additions = rows.filter((row, index) => (
      index === 0 && existingAppointment?.id ? true : !existingKeys.has(appointmentKey(row))
    ));
    if (!additions.length) {
      toast('Diese Terminserie ist bereits angelegt.', 'warning');
      return;
    }

    const deletedIds = replacedAppointments
      .map((appointment) => appointment.id)
      .filter((id) => id && !additions.some((row) => row.id === id)) || [];
    if (deletedIds.length) {
      markDeletedAppointments(state, deletedIds, false);
    }

    if (replacedAppointments.length) {
      state.appointments = state.appointments.filter((appointment) => !replacedSeriesIds.has(appointment.id));
      state.appointments = [...state.appointments, ...additions];
    } else if (existingAppointment?.id) {
      state.appointments = state.appointments.map((appointment) => (
        appointment.id === existingAppointment.id ? { ...additions[0], synced: false } : appointment
      ));
      state.appointments = [...state.appointments, ...additions.slice(1)];
    } else {
      state.appointments = [...state.appointments, ...additions];
    }
    writeState(state);
    toast(recurrence === 'once'
      ? 'Termin als Einzeltermin gespeichert.'
      : `${additions.length} Termine als ${recurrenceLabel(recurrence)}-Serie angelegt.`,
    'success');

    try {
      const deletedRemote = await deleteRemoteAppointments(deletedIds);
      const deletedRemoteFollowers = await deleteRemoteGeneratedFollowers(existingAppointment, additions[0]?.id);
      if (deletedRemote && deletedIds.length) {
        const latestState = readState();
        markDeletedAppointments(latestState, deletedIds, Boolean(deletedRemoteFollowers));
        writeState(latestState);
      }
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
