(function installHabitFlowAppointmentCore(window, document) {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const FORM_ID = 'appointmentForm';
  const RECURRENCE_FIELD_ID = 'appointmentRecurrenceSelect';
  const RECURRENCE_COUNTS = Object.freeze({ weekly: 104, monthly: 36, quarterly: 20, yearly: 10 });
  const RECURRENCE_LABELS = Object.freeze({ once: 'Einmalig', weekly: 'Wöchentlich', monthly: 'Monatlich', quarterly: 'Quartal', yearly: 'Jährlich' });
  const TYPE_LABELS = Object.freeze({ personal: 'Privat', work: 'Arbeit', health: 'Gesundheit', social: 'Sozial', admin: 'Admin', other: 'Sonstiges' });
  const TYPE_SHORT = Object.freeze({ personal: 'PRIVAT', work: 'ARBEIT', health: 'HEALTH', social: 'SOZIAL', admin: 'ADMIN', other: 'SONST.' });
  const REFRESH_DELAYS = [700, 1800, 4200];

  let editingId = null;
  let calendarCursor = new Date();
  let selectedDate = toDateKey(new Date());
  let saving = false;

  function uid() {
    return window.crypto?.randomUUID ? window.crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function readState() {
    try {
      const state = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') || {};
      if (!Array.isArray(state.appointments)) state.appointments = [];
      return state;
    } catch {
      return { appointments: [] };
    }
  }

  function writeState(state) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state || {}));
  }

  function toast(message, type = 'success') {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.className = `toast ${type}`;
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => node.classList.add('hidden'), 2600);
  }

  function clean(value) {
    return String(value || '').trim();
  }

  function timestamp(value) {
    const time = new Date(value || '').getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function validIso(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function toDateKey(value) {
    const date = value instanceof Date ? value : new Date(value || '');
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function toDateTimeLocalValue(value) {
    const date = value instanceof Date ? value : new Date(value || '');
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function normalizeRecurrence(value) {
    const key = clean(value);
    return RECURRENCE_COUNTS[key] ? key : null;
  }

  function normalizeType(value) {
    const key = clean(value) || 'personal';
    return TYPE_LABELS[key] ? key : 'other';
  }

  function normalizeAppointment(row = {}) {
    const created = validIso(row.created_at) || nowIso();
    const starts = validIso(row.starts_at || row.start_at || row.date) || created;
    const ends = validIso(row.ends_at || row.end_at);
    const recurrence = normalizeRecurrence(row.recurrence);
    return {
      ...row,
      id: row.id || uid(),
      title: clean(row.title) || 'Termin',
      description: clean(row.description || row.note),
      location: clean(row.location),
      appointment_type: normalizeType(row.appointment_type || row.type),
      starts_at: starts,
      ends_at: ends && timestamp(ends) >= timestamp(starts) ? ends : null,
      recurrence,
      series_id: recurrence ? (row.series_id || uid()) : null,
      series_index: recurrence && Number.isInteger(row.series_index) ? row.series_index : null,
      created_at: created,
      updated_at: validIso(row.updated_at) || created,
      synced: row.synced === true,
    };
  }

  function appointmentSignature(row = {}) {
    const appointment = normalizeAppointment(row);
    const duration = appointment.ends_at ? timestamp(appointment.ends_at) - timestamp(appointment.starts_at) : '';
    return [appointment.title, appointment.description, appointment.location, appointment.appointment_type, duration].join('|');
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
    if (recurrence === 'monthly') return addMonthsClamped(base, index);
    if (recurrence === 'quarterly') return addMonthsClamped(base, index * 3);
    if (recurrence === 'yearly') return addMonthsClamped(base, index * 12);
    return date;
  }

  function buildBaseFromForm(form, existing = null) {
    const data = new FormData(form);
    const title = clean(data.get('title'));
    const starts = validIso(data.get('starts_at'));
    const ends = validIso(data.get('ends_at'));
    if (!title) throw new Error('Bitte gib einen Titel ein.');
    if (!starts) throw new Error('Bitte Startzeit für den Termin setzen.');
    if (ends && timestamp(ends) < timestamp(starts)) throw new Error('Ende darf nicht vor dem Start liegen.');
    const updated = nowIso();
    return normalizeAppointment({
      id: existing?.id || uid(),
      title,
      description: clean(data.get('description')),
      location: clean(data.get('location')),
      appointment_type: normalizeType(data.get('appointment_type')),
      starts_at: starts,
      ends_at: ends,
      recurrence: null,
      series_id: null,
      series_index: null,
      created_at: existing?.created_at || updated,
      updated_at: updated,
      synced: false,
    });
  }

  function rowsFromForm(form, recurrenceValue, existing = null, seriesId = null) {
    const recurrence = recurrenceValue === 'once' ? null : normalizeRecurrence(recurrenceValue);
    const base = buildBaseFromForm(form, existing);
    if (!recurrence) return [base];
    const start = new Date(base.starts_at);
    const duration = base.ends_at ? timestamp(base.ends_at) - timestamp(base.starts_at) : null;
    const id = seriesId || existing?.series_id || uid();
    return Array.from({ length: RECURRENCE_COUNTS[recurrence] }, (_, index) => {
      const nextStart = advanceDate(start, recurrence, index);
      const nextEnd = duration == null ? null : new Date(nextStart.getTime() + duration);
      return normalizeAppointment({
        ...base,
        id: index === 0 ? base.id : uid(),
        starts_at: nextStart.toISOString(),
        ends_at: nextEnd ? nextEnd.toISOString() : null,
        recurrence,
        series_id: id,
        series_index: index,
      });
    });
  }

  function sameInstant(a, b) {
    return Math.abs(timestamp(a) - timestamp(b)) < 1000;
  }

  function inferLegacySeries(state, appointment) {
    if (!appointment || appointment.recurrence || appointment.series_id) return null;
    const candidates = state.appointments.map(normalizeAppointment)
      .filter(item => item.id && appointmentSignature(item) === appointmentSignature(appointment))
      .sort((a, b) => timestamp(a.starts_at) - timestamp(b.starts_at));
    if (candidates.length < 2) return null;
    for (const recurrence of ['yearly', 'quarterly', 'monthly', 'weekly']) {
      for (const anchor of candidates) {
        const base = new Date(anchor.starts_at);
        const group = candidates.filter(candidate => {
          for (let index = 0; index < RECURRENCE_COUNTS[recurrence]; index += 1) {
            if (sameInstant(candidate.starts_at, advanceDate(base, recurrence, index).toISOString())) return true;
          }
          return false;
        });
        if (group.length >= 2 && group.some(item => item.id === appointment.id)) return { recurrence, series_id: uid(), appointments: group };
      }
    }
    return null;
  }

  function inferSeries(state, appointment) {
    if (!appointment) return null;
    if (appointment.series_id) {
      const appointments = state.appointments.map(normalizeAppointment)
        .filter(item => item.series_id === appointment.series_id)
        .sort((a, b) => timestamp(a.starts_at) - timestamp(b.starts_at));
      return { recurrence: appointment.recurrence || appointments.find(item => item.recurrence)?.recurrence || null, series_id: appointment.series_id, appointments };
    }
    return inferLegacySeries(state, appointment);
  }

  function replacedAppointments(state, existing, series) {
    if (!existing) return [];
    const anchor = timestamp(existing.starts_at);
    const source = series?.appointments?.length ? series.appointments : [existing];
    return source.filter(item => item.id === existing.id || timestamp(item.starts_at) >= anchor);
  }

  function formEditingAppointment(state, form) {
    const explicitId = form?.dataset?.editingAppointmentId || editingId;
    if (explicitId) {
      const found = state.appointments.map(normalizeAppointment).find(item => item.id === explicitId);
      if (found) return found;
    }
    const data = new FormData(form);
    const title = clean(data.get('title'));
    const starts = validIso(data.get('starts_at'));
    if (!title || !starts) return null;
    return state.appointments.map(normalizeAppointment).find(item => item.title === title && sameInstant(item.starts_at, starts)) || null;
  }

  function isEditingForm() {
    const title = document.getElementById('appointmentFormTitle')?.textContent || '';
    const cancel = document.getElementById('cancelAppointmentEditBtn');
    return /bearbeiten/i.test(title) || Boolean(cancel && !cancel.classList.contains('hidden'));
  }

  function supabaseClient() {
    const config = window.HABITFLOW_SUPABASE_CONFIG || {};
    if (!window.supabase || !config.url || !config.anonKey) return null;
    return window.supabase.createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  }

  async function remoteUser() {
    const client = supabaseClient();
    if (!client) return { client: null, userId: null };
    const session = await client.auth.getSession();
    return { client, userId: session?.data?.session?.user?.id || null };
  }

  function payload(row, userId) {
    return {
      id: row.id,
      user_id: userId,
      title: row.title,
      description: row.description || null,
      location: row.location || null,
      appointment_type: normalizeType(row.appointment_type),
      starts_at: row.starts_at,
      ends_at: row.ends_at || null,
      recurrence: row.recurrence || null,
      series_id: row.series_id || null,
      series_index: Number.isInteger(row.series_index) ? row.series_index : null,
      created_at: row.created_at,
      updated_at: row.updated_at || nowIso(),
    };
  }

  async function upsertRemote(rows) {
    const { client, userId } = await remoteUser();
    if (!client || !userId) throw new Error('Supabase ist noch nicht bereit.');
    const { error } = await client.from('appointments').upsert(rows.map(row => payload(row, userId)), { onConflict: 'id' });
    if (error) throw error;
    return true;
  }

  async function deleteRemote(ids) {
    const unique = Array.from(new Set((ids || []).filter(Boolean)));
    if (!unique.length) return true;
    const { client, userId } = await remoteUser();
    if (!client || !userId) throw new Error('Supabase ist noch nicht bereit.');
    const { error } = await client.from('appointments').delete().eq('user_id', userId).in('id', unique);
    if (error) throw error;
    return true;
  }

  async function fetchRemoteAppointments() {
    const { client, userId } = await remoteUser();
    if (!client || !userId) return null;
    const { data, error } = await client.from('appointments').select('*').eq('user_id', userId).order('starts_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(row => normalizeAppointment({ ...row, synced: true }));
  }

  async function refreshFromRemote({ render = true } = {}) {
    const remote = await fetchRemoteAppointments();
    if (!remote) return false;
    const state = readState();
    const remoteIds = new Set(remote.map(item => item.id));
    const unsynced = state.appointments.map(normalizeAppointment).filter(item => item.synced !== true && !remoteIds.has(item.id));
    state.appointments = [...remote, ...unsynced];
    if (state.deletedRemoteIds?.appointments) state.deletedRemoteIds.appointments = {};
    writeState(state);
    if (render) renderCalendarFromState();
    return true;
  }

  async function saveAppointment(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== FORM_ID || saving) return;
    const recurrenceValue = form.elements.recurrence?.value || 'once';
    if (!RECURRENCE_LABELS[recurrenceValue]) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    saving = true;

    const state = readState();
    const original = [...state.appointments];
    try {
      const existing = isEditingForm() ? formEditingAppointment(state, form) : null;
      if (isEditingForm() && !existing) throw new Error('Termin konnte nicht eindeutig gefunden werden. Bitte einmal neu öffnen.');
      const series = existing ? inferSeries(state, existing) : null;
      const rows = rowsFromForm(form, recurrenceValue, existing, series?.series_id).map(row => ({ ...row, synced: true }));
      const replaced = replacedAppointments(state, existing, series);
      const keepIds = new Set(rows.map(row => row.id));
      const deleteIds = replaced.filter(item => !keepIds.has(item.id)).map(item => item.id);

      await deleteRemote(deleteIds);
      await upsertRemote(rows);

      const replacedIds = new Set(replaced.map(item => item.id));
      state.appointments = state.appointments.map(normalizeAppointment)
        .filter(item => !replacedIds.has(item.id) && !keepIds.has(item.id));
      state.appointments.push(...rows);
      writeState(state);

      editingId = null;
      delete form.dataset.editingAppointmentId;
      closeForm(form, rows[0]);
      selectedDate = toDateKey(rows[0].starts_at) || selectedDate;
      calendarCursor = new Date(`${selectedDate}T12:00:00`);
      renderCalendarFromState();
      toast(recurrenceValue === 'once' ? 'Termin gespeichert.' : `${rows.length} Termine als ${RECURRENCE_LABELS[recurrenceValue]}-Serie gespeichert.`);
      window.setTimeout(() => refreshFromRemote({ render: true }).catch(error => console.warn('[HabitFlow/appointments] Remote Refresh fehlgeschlagen.', error)), 700);
    } catch (error) {
      state.appointments = original;
      writeState(state);
      toast(error.message || 'Termin konnte nicht gespeichert werden.', 'danger');
      console.warn('[HabitFlow/appointments] Save failed', error);
    } finally {
      saving = false;
    }
  }

  function closeForm(form, appointment = null) {
    form.reset();
    const startKey = appointment ? toDateKey(appointment.starts_at) : selectedDate;
    const defaults = defaultRange(startKey);
    form.elements.starts_at.value = defaults.start;
    form.elements.ends_at.value = defaults.end;
    if (form.elements.appointment_type) form.elements.appointment_type.value = 'personal';
    if (form.elements.recurrence) form.elements.recurrence.value = 'once';
    document.getElementById('appointmentFormTitle').textContent = 'Termin erfassen';
    document.getElementById('appointmentSubmitBtn').textContent = 'Termin speichern';
    document.getElementById('cancelAppointmentEditBtn')?.classList.add('hidden');
    document.getElementById('appointmentFormPanel')?.classList.add('hidden');
  }

  function defaultRange(dateKey = selectedDate) {
    const now = new Date();
    let start = dateKey === toDateKey(now) ? new Date(now) : new Date(`${dateKey || toDateKey(now)}T09:00:00`);
    if (Number.isNaN(start.getTime())) start = new Date(now);
    if (dateKey === toDateKey(now)) {
      start.setMinutes(start.getMinutes() > 30 ? 0 : 30, 0, 0);
      if (start.getTime() <= now.getTime()) start.setHours(start.getHours() + 1);
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return { start: toDateTimeLocalValue(start), end: toDateTimeLocalValue(end) };
  }

  function syncRecurrenceField(appointment) {
    const field = document.getElementById(RECURRENCE_FIELD_ID);
    if (!field) return;
    field.value = appointment?.recurrence || 'once';
  }

  function captureClick(event) {
    const target = event.target instanceof Element ? event.target.closest('[data-action], #appointmentFormToggleBtn, #appointmentFormCloseBtn, #cancelAppointmentEditBtn, #prevMonthBtn, #nextMonthBtn, #todayMonthBtn') : null;
    if (!target) return;
    const action = target.dataset?.action || '';
    if (action === 'edit-appointment') {
      editingId = target.dataset.id || null;
      const form = document.getElementById(FORM_ID);
      if (form && editingId) form.dataset.editingAppointmentId = editingId;
      window.setTimeout(() => syncRecurrenceField(readState().appointments.map(normalizeAppointment).find(item => item.id === editingId)), 0);
    }
    if (action === 'new-appointment-for-day' || target.id === 'appointmentFormToggleBtn') {
      editingId = null;
      const form = document.getElementById(FORM_ID);
      if (form) {
        delete form.dataset.editingAppointmentId;
        window.setTimeout(() => syncRecurrenceField(null), 0);
      }
    }
    if (target.id === 'appointmentFormCloseBtn' || target.id === 'cancelAppointmentEditBtn') {
      editingId = null;
      const form = document.getElementById(FORM_ID);
      if (form) delete form.dataset.editingAppointmentId;
    }
    if (action === 'select-day') {
      selectedDate = target.dataset.day || selectedDate;
      window.setTimeout(renderCalendarFromState, 0);
    }
    if (target.id === 'prevMonthBtn') {
      calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
      window.setTimeout(renderCalendarFromState, 0);
    }
    if (target.id === 'nextMonthBtn') {
      calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
      window.setTimeout(renderCalendarFromState, 0);
    }
    if (target.id === 'todayMonthBtn') {
      calendarCursor = new Date();
      selectedDate = toDateKey(new Date());
      window.setTimeout(renderCalendarFromState, 0);
    }
  }

  function appointmentsOnDate(dayKey) {
    return readState().appointments.map(normalizeAppointment)
      .filter(item => item.id && toDateKey(item.starts_at) === dayKey)
      .sort((a, b) => timestamp(a.starts_at) - timestamp(b.starts_at));
  }

  function formatTime(value) {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? 'Zeit offen' : date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
  }

  function formatRange(appointment) {
    if (!appointment.ends_at) return formatTime(appointment.starts_at);
    return `${formatTime(appointment.starts_at)}-${formatTime(appointment.ends_at)}`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function renderChips(appointments) {
    const visible = appointments.slice(0, 2).map(appointment => {
      const type = normalizeType(appointment.appointment_type);
      return `<span class="day-chip appointment calendar-event-chip type-${type}"><b>${escapeHtml(formatTime(appointment.starts_at))} · ${escapeHtml(TYPE_SHORT[type])}</b><em>${escapeHtml(appointment.title)}</em></span>`;
    });
    if (appointments.length > 2) visible.push(`<span class="day-chip appointment-more">+${appointments.length - 2} weitere</span>`);
    return visible.join('');
  }

  function renderCalendarFromState() {
    const title = document.getElementById('calendarTitle');
    const grid = document.getElementById('calendarGrid');
    const detailsTitle = document.getElementById('selectedDateTitle');
    const details = document.getElementById('dayDetails');
    if (!title || !grid || !detailsTitle || !details) return;

    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    title.textContent = calendarCursor.toLocaleDateString('de-CH', { month: 'long', year: 'numeric' });
    const first = new Date(year, month, 1);
    const start = new Date(first);
    const day = first.getDay() || 7;
    start.setDate(first.getDate() - day + 1);
    const todayKey = toDateKey(new Date());
    const cells = [];
    for (let i = 0; i < 42; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = toDateKey(date);
      const appointments = appointmentsOnDate(key);
      cells.push(`<button class="calendar-day ${date.getMonth() !== month ? 'is-muted' : ''} ${key === todayKey ? 'is-today' : ''} ${key === selectedDate ? 'is-selected' : ''} ${appointments.length ? 'has-appointments' : ''}" type="button" data-action="select-day" data-day="${key}"><span class="calendar-day-head"><strong>${date.getDate()}</strong>${appointments.length ? `<em class="day-appointment-count">${appointments.length}</em>` : ''}</span><span class="day-chips">${renderChips(appointments)}</span></button>`);
    }
    grid.innerHTML = cells.join('');
    detailsTitle.textContent = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('de-CH', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const dayAppointments = appointmentsOnDate(selectedDate);
    details.innerHTML = dayAppointments.length ? dayAppointments.map(renderDetailCard).join('') : '<div class="empty-state">Für diesen Tag gibt es noch keine Einträge.<div class="empty-actions"><button class="pill secondary" type="button" data-action="new-appointment-for-day">Termin anlegen</button></div></div>';
  }

  function renderDetailCard(appointment) {
    const type = normalizeType(appointment.appointment_type);
    const location = appointment.location ? ` · ${escapeHtml(appointment.location)}` : '';
    const description = appointment.description ? `<br>${escapeHtml(appointment.description)}` : '';
    const recurrence = appointment.recurrence ? ` · ${escapeHtml(RECURRENCE_LABELS[appointment.recurrence])}` : '';
    return `<article class="list-card appointment-card"><div class="list-card-main"><h4>${escapeHtml(appointment.title)}</h4><p class="meta">${escapeHtml(formatRange(appointment))} · ${escapeHtml(TYPE_LABELS[type])}${recurrence}${location}${description}</p></div><div class="list-actions"><button class="mini-btn" type="button" data-action="edit-appointment" data-id="${appointment.id}">Bearbeiten</button><button class="mini-btn danger" type="button" data-action="delete-appointment" data-id="${appointment.id}">Löschen</button></div></article>`;
  }

  function ensureField() {
    const form = document.getElementById(FORM_ID);
    if (!form || document.getElementById(RECURRENCE_FIELD_ID)) return;
    const label = document.createElement('label');
    label.innerHTML = '<span>Zyklus</span><select id="appointmentRecurrenceSelect" name="recurrence"><option value="once">Einmalig</option><option value="weekly">Wöchentlich</option><option value="monthly">Monatlich</option><option value="quarterly">Quartal</option><option value="yearly">Jährlich</option></select>';
    form.elements.location?.closest('label')?.insertAdjacentElement('afterend', label);
  }

  function init() {
    ensureField();
    document.addEventListener('submit', saveAppointment, true);
    document.addEventListener('click', captureClick, true);
    REFRESH_DELAYS.forEach(delay => window.setTimeout(() => refreshFromRemote({ render: true }).catch(error => console.warn('[HabitFlow/appointments] Remote Refresh fehlgeschlagen.', error)), delay));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window, document);
