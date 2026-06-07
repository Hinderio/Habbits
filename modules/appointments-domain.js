(function installHabitFlowAppointmentsDomain(window, document) {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const FORM_ID = 'appointmentForm';
  const FIELD_ID = 'appointmentRecurrenceSelect';
  const FIELD_NAME = 'recurrence';
  const RESTORE_KEY = 'habitflow-appointment-series-restore';
  const SAVE_LOCK_KEY = 'habitflow-appointment-series-save-lock';
  const REMOTE_RELOAD_KEY = 'habitflow-appointments-domain-remote-reload';
  const SAVE_LOCK_MS = 12000;
  const REMOTE_PULL_DELAY_MS = 900;
  const RECURRENCES = Object.freeze({
    once: { label: 'Einmalig', count: 1 },
    weekly: { label: 'Wöchentlich', count: 104 },
    monthly: { label: 'Monatlich', count: 36 },
    quarterly: { label: 'Quartal', count: 20 },
    yearly: { label: 'Jährlich', count: 10 },
  });
  let editingAppointmentId = null;

  function uid() {
    return window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function clean(value) {
    return String(value || '').trim();
  }

  function readState() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
      const state = parsed && typeof parsed === 'object' ? parsed : {};
      if (!Array.isArray(state.appointments)) state.appointments = [];
      return state;
    } catch (error) {
      console.warn('[HabitFlow/appointments] State konnte nicht gelesen werden.', error);
      return { appointments: [] };
    }
  }

  function writeState(state) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function toast(message, type = 'success') {
    const node = document.getElementById('toast');
    if (!node) {
      console.info(message);
      return;
    }
    node.textContent = message;
    node.className = `toast ${type}`;
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => node.classList.add('hidden'), 2600);
  }

  function setSaveLock() {
    try {
      window.sessionStorage.setItem(SAVE_LOCK_KEY, String(Date.now() + SAVE_LOCK_MS));
    } catch (error) {}
  }

  function clearSaveLock() {
    try {
      window.sessionStorage.removeItem(SAVE_LOCK_KEY);
    } catch (error) {}
  }

  function saveLockRemainingMs() {
    try {
      const expiresAt = Number(window.sessionStorage.getItem(SAVE_LOCK_KEY) || 0);
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        window.sessionStorage.removeItem(SAVE_LOCK_KEY);
        return 0;
      }
      return expiresAt - Date.now();
    } catch (error) {
      return 0;
    }
  }

  function rememberCalendarRestore() {
    try {
      window.sessionStorage.setItem(RESTORE_KEY, JSON.stringify({ screen: 'calendar' }));
    } catch (error) {}
  }

  function showCalendarAfterReload() {
    let restore = false;
    try {
      restore = JSON.parse(window.sessionStorage.getItem(RESTORE_KEY) || 'null')?.screen === 'calendar';
      if (restore) window.sessionStorage.removeItem(RESTORE_KEY);
    } catch (error) {
      restore = false;
    }
    if (!restore) return;
    const show = () => document.querySelector('.nav-btn[data-target="calendar"]')?.click();
    show();
    window.setTimeout(show, 0);
    window.setTimeout(show, 80);
    window.setTimeout(show, 240);
  }

  function timestampMs(value) {
    const time = new Date(value || '').getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function sameInstant(left, right) {
    return Math.abs(timestampMs(left) - timestampMs(right)) < 1000;
  }

  function addMonthsClamped(base, months) {
    const date = new Date(base.getTime());
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + months);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, last));
    date.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds());
    return date;
  }

  function advanceDate(base, recurrence, index) {
    const date = new Date(base.getTime());
    if (recurrence === 'weekly') {
      date.setDate(date.getDate() + index * 7);
      return date;
    }
    if (recurrence === 'monthly') return addMonthsClamped(base, index);
    if (recurrence === 'quarterly') return addMonthsClamped(base, index * 3);
    if (recurrence === 'yearly') return addMonthsClamped(base, index * 12);
    return date;
  }

  function durationMs(appointment) {
    const start = timestampMs(appointment?.starts_at);
    const end = timestampMs(appointment?.ends_at);
    return start && end ? String(end - start) : '';
  }

  function appointmentSignature(appointment = {}) {
    return [
      clean(appointment.title),
      clean(appointment.location),
      clean(appointment.appointment_type || 'other'),
      clean(appointment.description),
      durationMs(appointment),
    ].join('|');
  }

  function normalizeRecurrence(value) {
    const key = String(value || '').trim();
    return RECURRENCES[key] && key !== 'once' ? key : null;
  }

  function normalizeAppointment(appointment = {}) {
    const created = appointment.created_at || nowIso();
    const startsAt = validIsoOrFallback(appointment.starts_at || appointment.start_at || appointment.date || created, created);
    const rawEnd = validIsoOrNull(appointment.ends_at || appointment.end_at);
    return {
      ...appointment,
      title: clean(appointment.title) || 'Termin',
      description: clean(appointment.description || appointment.note),
      location: clean(appointment.location),
      appointment_type: clean(appointment.appointment_type || appointment.type || 'other') || 'other',
      starts_at: startsAt,
      ends_at: rawEnd && timestampMs(rawEnd) >= timestampMs(startsAt) ? rawEnd : null,
      created_at: created,
      updated_at: appointment.updated_at || created,
      recurrence: normalizeRecurrence(appointment.recurrence),
      series_id: appointment.series_id || null,
      series_index: Number.isInteger(appointment.series_index) ? appointment.series_index : null,
      synced: appointment.synced === true,
    };
  }

  function validIsoOrNull(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function validIsoOrFallback(value, fallback = nowIso()) {
    return validIsoOrNull(value) || validIsoOrNull(fallback) || nowIso();
  }

  function comparable(appointment = {}) {
    const row = normalizeAppointment(appointment);
    return [row.id, row.title, row.description, row.location, row.appointment_type, row.starts_at, row.ends_at || '', row.created_at, row.updated_at, row.recurrence || '', row.series_id || '', row.series_index ?? ''].join('|');
  }

  function signature(appointments = []) {
    return appointments.map(comparable).sort().join('\n');
  }

  function injectRecurrenceField() {
    const form = document.getElementById(FORM_ID);
    if (!form) return null;
    let field = document.getElementById(FIELD_ID);
    if (field) return form;

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
    if (locationLabel) locationLabel.insertAdjacentElement('afterend', label);
    else if (descriptionLabel) descriptionLabel.insertAdjacentElement('beforebegin', label);
    else form.insertBefore(label, form.querySelector('.form-actions'));
    return form;
  }

  function syncRecurrenceField(appointment = null) {
    const field = document.getElementById(FIELD_ID);
    if (!field) return;
    field.disabled = false;
    field.value = appointment?.recurrence || 'once';
  }

  function configClient() {
    const config = window.HABITFLOW_SUPABASE_CONFIG || {};
    if (!window.supabase || !config.url || !config.anonKey) return null;
    return window.supabase.createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }

  async function remoteUser() {
    const client = configClient();
    if (!client) return { client: null, userId: null };
    const session = await client.auth.getSession();
    return { client, userId: session?.data?.session?.user?.id || null };
  }

  async function fetchRemoteAppointments() {
    const { client, userId } = await remoteUser();
    if (!client || !userId) return null;
    const base = 'id,title,description,location,appointment_type,starts_at,ends_at,created_at,updated_at';
    const withSeries = `${base},recurrence,series_id,series_index`;
    let result = await client.from('appointments').select(withSeries).eq('user_id', userId).order('starts_at', { ascending: true });
    if (result.error && /recurrence|series_id|series_index/i.test(result.error.message || '')) {
      result = await client.from('appointments').select(base).eq('user_id', userId).order('starts_at', { ascending: true });
    }
    if (result.error) throw result.error;
    return (result.data || []).map(row => normalizeAppointment({ ...row, synced: true }));
  }

  async function upsertRemote(rows) {
    const { client, userId } = await remoteUser();
    if (!client || !userId || !rows.length) return false;
    const payload = rows.map(row => ({
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
    if (error) throw error;
    return true;
  }

  async function deleteRemoteIds(ids = []) {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (!unique.length) return true;
    const { client, userId } = await remoteUser();
    if (!client || !userId) return false;
    const { error } = await client.from('appointments').delete().eq('user_id', userId).in('id', unique);
    if (error) throw error;
    return true;
  }

  async function deleteRemoteSeriesFollowers(anchor, keepIds = new Set()) {
    if (!anchor?.series_id || !anchor?.starts_at) return true;
    const { client, userId } = await remoteUser();
    if (!client || !userId) return false;
    let query = client.from('appointments')
      .delete()
      .eq('user_id', userId)
      .eq('series_id', anchor.series_id)
      .gt('starts_at', anchor.starts_at);
    if (keepIds.size) query = query.not('id', 'in', `(${Array.from(keepIds).join(',')})`);
    const { error } = await query;
    if (error) throw error;
    return true;
  }

  function seriesFromFields(state, appointment) {
    if (!appointment?.series_id) return null;
    const appointments = state.appointments
      .map(normalizeAppointment)
      .filter(item => item.series_id === appointment.series_id)
      .sort((a, b) => timestampMs(a.starts_at) - timestampMs(b.starts_at));
    const recurrence = appointment.recurrence || appointments.find(item => item.recurrence)?.recurrence;
    if (!recurrence || appointments.length < 2) return null;
    return { recurrence, appointments, seriesId: appointment.series_id };
  }

  function detectLegacySeries(state, appointment) {
    if (!appointment?.starts_at || appointment.series_id || appointment.recurrence) return null;
    const candidates = state.appointments
      .map(normalizeAppointment)
      .filter(item => item.id && appointmentSignature(item) === appointmentSignature(appointment))
      .sort((a, b) => timestampMs(a.starts_at) - timestampMs(b.starts_at));
    if (candidates.length < 2) return null;

    for (const recurrence of ['yearly', 'quarterly', 'monthly', 'weekly']) {
      for (const anchor of candidates) {
        const anchorDate = new Date(anchor.starts_at);
        const group = candidates.filter(candidate => {
          for (let index = 0; index < RECURRENCES[recurrence].count; index += 1) {
            if (sameInstant(candidate.starts_at, advanceDate(anchorDate, recurrence, index).toISOString())) return true;
          }
          return false;
        });
        if (group.length >= 2 && group.some(item => item.id === appointment.id)) {
          return { recurrence, appointments: group, seriesId: uid() };
        }
      }
    }
    return null;
  }

  function inferSeries(state, appointment) {
    return seriesFromFields(state, appointment) || detectLegacySeries(state, appointment);
  }

  function appointmentsFromEditPoint(state, appointment, series) {
    const anchorStart = timestampMs(appointment?.starts_at);
    if (!anchorStart) return [];
    const appointments = series?.appointments?.length ? series.appointments : [appointment];
    return appointments
      .filter(item => item.id && (item.id === appointment.id || timestampMs(item.starts_at) >= anchorStart))
      .sort((a, b) => timestampMs(a.starts_at) - timestampMs(b.starts_at));
  }

  function buildBaseFromForm(form, existing = null) {
    const data = new FormData(form);
    const title = clean(data.get('title'));
    const startsAt = validIsoOrNull(data.get('starts_at'));
    const endsAt = validIsoOrNull(data.get('ends_at'));
    if (!title) throw new Error('Bitte gib einen Titel ein.');
    if (!startsAt) throw new Error('Bitte Startzeit für den Termin setzen.');
    if (endsAt && timestampMs(endsAt) < timestampMs(startsAt)) throw new Error('Ende darf nicht vor dem Start liegen.');
    const timestamp = nowIso();
    return normalizeAppointment({
      id: existing?.id || uid(),
      title,
      description: clean(data.get('description')),
      location: clean(data.get('location')),
      appointment_type: clean(data.get('appointment_type') || 'other') || 'other',
      starts_at: startsAt,
      ends_at: endsAt,
      created_at: existing?.created_at || timestamp,
      updated_at: timestamp,
      recurrence: null,
      series_id: null,
      series_index: null,
      synced: false,
    });
  }

  function buildRows(form, recurrenceValue, existing = null, existingSeriesId = null) {
    const recurrence = recurrenceValue === 'once' ? null : normalizeRecurrence(recurrenceValue);
    const base = buildBaseFromForm(form, existing);
    if (!recurrence) return [base];
    const startsAt = new Date(base.starts_at);
    const duration = base.ends_at ? timestampMs(base.ends_at) - timestampMs(base.starts_at) : null;
    const seriesId = existingSeriesId || existing?.series_id || uid();
    return Array.from({ length: RECURRENCES[recurrence].count }, (_, index) => {
      const start = advanceDate(startsAt, recurrence, index);
      const end = duration == null ? null : new Date(start.getTime() + duration);
      return normalizeAppointment({
        ...base,
        id: index === 0 ? base.id : uid(),
        starts_at: start.toISOString(),
        ends_at: end ? end.toISOString() : null,
        recurrence,
        series_id: seriesId,
        series_index: index,
        synced: false,
      });
    });
  }

  function currentEditingAppointment(state, form) {
    const explicitId = form?.dataset?.editingAppointmentId || editingAppointmentId;
    if (explicitId) {
      const match = state.appointments.map(normalizeAppointment).find(item => item.id === explicitId);
      if (match) return match;
    }
    const data = new FormData(form);
    const title = clean(data.get('title'));
    const startsAt = validIsoOrNull(data.get('starts_at'));
    if (!title || !startsAt) return null;
    const matches = state.appointments.map(normalizeAppointment).filter(item => item.title === title && sameInstant(item.starts_at, startsAt));
    if (matches.length === 1) return matches[0];
    return matches.sort((a, b) => timestampMs(b.updated_at || b.created_at) - timestampMs(a.updated_at || a.created_at))[0] || null;
  }

  function isEditingAppointment() {
    const title = document.getElementById('appointmentFormTitle')?.textContent || '';
    const cancelButton = document.getElementById('cancelAppointmentEditBtn');
    return /bearbeiten/i.test(title) || Boolean(cancelButton && !cancelButton.classList.contains('hidden'));
  }

  async function refreshFromRemote({ reload = false } = {}) {
    const remaining = saveLockRemainingMs();
    if (remaining > 0) {
      window.setTimeout(() => refreshFromRemote({ reload }), remaining + 300);
      return false;
    }
    const remote = await fetchRemoteAppointments();
    if (!remote) return false;
    const state = readState();
    const unsyncedLocal = state.appointments
      .map(normalizeAppointment)
      .filter(item => item.id && item.synced !== true && !remote.some(remoteItem => remoteItem.id === item.id));
    const nextAppointments = [...remote, ...unsyncedLocal];
    if (signature(state.appointments || []) === signature(nextAppointments)) return false;
    state.appointments = nextAppointments;
    if (state.deletedRemoteIds?.appointments) state.deletedRemoteIds.appointments = {};
    writeState(state);
    if (reload && !isEditingAppointment()) {
      try {
        const marker = signature(nextAppointments).slice(0, 512);
        if (window.sessionStorage.getItem(REMOTE_RELOAD_KEY) === marker) return true;
        window.sessionStorage.setItem(REMOTE_RELOAD_KEY, marker);
      } catch (error) {}
      window.setTimeout(() => window.location.reload(), 150);
    }
    return true;
  }

  async function saveAppointment(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== FORM_ID) return;
    const recurrenceValue = form.elements[FIELD_NAME]?.value || 'once';
    if (!RECURRENCES[recurrenceValue]) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    setSaveLock();

    const state = readState();
    const originalAppointments = [...state.appointments];
    const existing = isEditingAppointment() ? currentEditingAppointment(state, form) : null;
    if (isEditingAppointment() && !existing) {
      clearSaveLock();
      toast('Termin konnte nicht eindeutig gefunden werden. Bitte Kalender neu laden und nochmals bearbeiten.', 'danger');
      return;
    }

    let rows = [];
    let replaced = [];
    try {
      const series = existing ? inferSeries(state, existing) : null;
      rows = buildRows(form, recurrenceValue, existing, series?.seriesId);
      replaced = existing ? appointmentsFromEditPoint(state, existing, series) : [];
      const keepIds = new Set(rows.map(row => row.id));
      const deleteIds = replaced.filter(item => !keepIds.has(item.id)).map(item => item.id);

      await deleteRemoteIds(deleteIds);
      await deleteRemoteSeriesFollowers(existing, keepIds);
      const synced = await upsertRemote(rows);
      if (!synced) throw new Error('Termin konnte nicht mit Supabase synchronisiert werden.');
    } catch (error) {
      console.warn('[HabitFlow/appointments] Speichern fehlgeschlagen.', error);
      state.appointments = originalAppointments;
      writeState(state);
      clearSaveLock();
      toast(error.message || 'Termin konnte nicht vollständig gespeichert werden.', 'danger');
      return;
    }

    const replacedIds = new Set(replaced.map(item => item.id));
    const nextRows = rows.map(row => ({ ...row, synced: true }));
    state.appointments = state.appointments
      .map(normalizeAppointment)
      .filter(item => !replacedIds.has(item.id) && !nextRows.some(row => row.id === item.id));
    state.appointments.push(...nextRows);
    writeState(state);

    editingAppointmentId = null;
    delete form.dataset.editingAppointmentId;
    rememberCalendarRestore();
    toast(recurrenceValue === 'once'
      ? 'Termin gespeichert.'
      : `${nextRows.length} Termine als ${RECURRENCES[recurrenceValue].label}-Serie gespeichert.`);
    window.setTimeout(() => window.location.reload(), 250);
  }

  function captureEditContext(event) {
    const source = event.target instanceof Element ? event.target : null;
    const target = source?.closest('button, [data-action]') || null;
    const action = target?.dataset?.action || '';
    const form = document.getElementById(FORM_ID);
    if (action === 'edit-appointment' || action.includes('edit-appointment')) {
      editingAppointmentId = target?.dataset?.id || source?.closest?.('[data-id]')?.dataset?.id || null;
      if (form && editingAppointmentId) form.dataset.editingAppointmentId = editingAppointmentId;
      window.setTimeout(() => {
        const appointment = readState().appointments.map(normalizeAppointment).find(item => item.id === editingAppointmentId);
        syncRecurrenceField(appointment || null);
      }, 0);
      return;
    }
    if (action === 'new-appointment-for-day' || target?.id === 'appointmentFormToggleBtn') {
      editingAppointmentId = null;
      if (form) delete form.dataset.editingAppointmentId;
      window.setTimeout(() => syncRecurrenceField(null), 0);
    }
    if (target?.id === 'cancelAppointmentEditBtn' || target?.id === 'appointmentFormCloseBtn') {
      editingAppointmentId = null;
      if (form) delete form.dataset.editingAppointmentId;
    }
  }

  function install() {
    showCalendarAfterReload();
    injectRecurrenceField();
    syncRecurrenceField(null);
    document.addEventListener('click', captureEditContext, true);
    document.addEventListener('submit', saveAppointment, true);
    window.setTimeout(() => refreshFromRemote({ reload: true }).catch(error => {
      console.warn('[HabitFlow/appointments] Remote-Abgleich fehlgeschlagen.', error);
    }), REMOTE_PULL_DELAY_MS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})(window, document);
