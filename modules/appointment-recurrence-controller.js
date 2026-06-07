(function registerHabitFlowAppointmentRecurrenceController(window, document) {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const FORM_ID = 'appointmentForm';
  const RECURRENCE_FIELD_ID = 'appointmentRecurrenceSelect';
  const BIRTHDAY_FIELD_ID = 'appointmentBirthdayCheckbox';
  const RESTORE_KEY = 'habitflow-appointment-recurrence-restore';
  const SAVE_LOCK_KEY = 'habitflow-appointment-recurrence-save-lock';
  const SAVE_LOCK_MS = 15000;
  const RECURRENCE_OPTIONS = Object.freeze({
    once: { label: 'Einmalig', count: 1 },
    weekly: { label: 'Wöchentlich', count: 104 },
    monthly: { label: 'Monatlich', count: 36 },
    quarterly: { label: 'Quartal', count: 20 },
    yearly: { label: 'Jährlich', count: 10 },
  });
  const RECURRENCE_DETECTION_ORDER = Object.freeze(['yearly', 'quarterly', 'monthly', 'weekly']);

  let editingAppointmentId = null;

  function uid() {
    return window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function timestampMs(value) {
    const time = new Date(value || '').getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function clean(value) {
    return String(value || '').trim();
  }

  function sameInstant(left, right) {
    return Math.abs(timestampMs(left) - timestampMs(right)) < 1000;
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

  function readState() {
    try {
      const state = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') || {};
      if (!Array.isArray(state.appointments)) state.appointments = [];
      return state;
    } catch (error) {
      console.warn('[HabitFlow/appointments] State konnte nicht gelesen werden.', error);
      return { appointments: [] };
    }
  }

  function writeState(state) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state || {}));
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

  function recurrenceValue(form) {
    const value = clean(form?.elements?.recurrence?.value || 'once');
    return RECURRENCE_OPTIONS[value] ? value : 'once';
  }

  function isBirthdayValue(form) {
    return Boolean(form?.elements?.is_birthday?.checked);
  }

  function durationMs(appointment) {
    const start = timestampMs(appointment?.starts_at);
    const end = timestampMs(appointment?.ends_at);
    return start && end ? String(end - start) : '';
  }

  function appointmentSignature(appointment) {
    return [
      clean(appointment?.title),
      clean(appointment?.location),
      clean(appointment?.appointment_type || 'other'),
      clean(appointment?.description),
      durationMs(appointment),
    ].join('|');
  }

  function appointmentKey(appointment) {
    return [
      clean(appointment?.title),
      appointment?.starts_at || '',
      appointment?.ends_at || '',
      clean(appointment?.location),
      clean(appointment?.appointment_type || 'other'),
    ].join('|');
  }

  function normalizeAppointment(row) {
    return {
      ...row,
      recurrence: RECURRENCE_OPTIONS[row?.recurrence] && row.recurrence !== 'once' ? row.recurrence : null,
      series_id: row?.series_id || null,
      series_index: Number.isInteger(row?.series_index) ? row.series_index : null,
      is_birthday: Boolean(row?.is_birthday),
    };
  }

  function buildAppointmentFromForm(form, existingAppointment = null) {
    const data = new FormData(form);
    const title = clean(data.get('title'));
    const startDate = new Date(String(data.get('starts_at') || ''));
    const endsAtRaw = String(data.get('ends_at') || '');
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
    return normalizeAppointment({
      id: existingAppointment?.id || uid(),
      title,
      description: clean(data.get('description')),
      location: clean(data.get('location')),
      appointment_type: clean(data.get('appointment_type') || 'other') || 'other',
      starts_at: startDate.toISOString(),
      ends_at: endDate ? endDate.toISOString() : null,
      created_at: existingAppointment?.created_at || timestamp,
      updated_at: timestamp,
      synced: false,
      recurrence: null,
      series_id: null,
      series_index: null,
      is_birthday: isBirthdayValue(form),
    });
  }

  function buildSeries(form, recurrence, existingAppointment = null, existingSeries = null) {
    const option = RECURRENCE_OPTIONS[recurrence];
    const base = buildAppointmentFromForm(form, existingAppointment);
    const startDate = new Date(base.starts_at);
    const duration = base.ends_at ? timestampMs(base.ends_at) - timestampMs(base.starts_at) : null;
    const seriesId = existingSeries?.seriesId || existingAppointment?.series_id || uid();

    return Array.from({ length: option.count }, (_, index) => {
      const occurrenceStart = advanceDate(startDate, recurrence, index);
      const occurrenceEnd = duration == null ? null : new Date(occurrenceStart.getTime() + duration);
      return normalizeAppointment({
        ...base,
        id: index === 0 && existingAppointment?.id ? existingAppointment.id : uid(),
        starts_at: occurrenceStart.toISOString(),
        ends_at: occurrenceEnd ? occurrenceEnd.toISOString() : null,
        recurrence,
        series_id: seriesId,
        series_index: index,
        synced: false,
      });
    });
  }

  function seriesFromMetadata(state, appointment) {
    if (!appointment?.series_id) return null;
    const appointments = state.appointments
      .map(normalizeAppointment)
      .filter((item) => item.series_id === appointment.series_id)
      .sort((left, right) => timestampMs(left.starts_at) - timestampMs(right.starts_at));
    const recurrence = appointment.recurrence || appointments.find((item) => item.recurrence)?.recurrence || null;
    if (!RECURRENCE_OPTIONS[recurrence] || appointments.length < 2) return null;
    return { recurrence, seriesId: appointment.series_id, appointments };
  }

  function detectSeriesByCadence(state, appointment) {
    if (!appointment?.starts_at) return null;
    const signature = appointmentSignature(appointment);
    const candidates = state.appointments
      .map(normalizeAppointment)
      .filter((item) => item.id && appointmentSignature(item) === signature)
      .sort((left, right) => timestampMs(left.starts_at) - timestampMs(right.starts_at));
    if (candidates.length < 2) return null;

    for (const recurrence of RECURRENCE_DETECTION_ORDER) {
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
            seriesId: appointment.series_id || group.find((item) => item.series_id)?.series_id || uid(),
            appointments: group.sort((left, right) => timestampMs(left.starts_at) - timestampMs(right.starts_at)),
          };
        }
      }
    }
    return null;
  }

  function inferSeries(state, appointment) {
    return seriesFromMetadata(state, appointment) || detectSeriesByCadence(state, appointment);
  }

  function appointmentsFromEditPoint(state, appointment, existingSeries) {
    if (!appointment?.starts_at) return [];
    const anchorStart = timestampMs(appointment.starts_at);
    const source = existingSeries?.appointments?.length ? existingSeries.appointments : [appointment];
    return source
      .map(normalizeAppointment)
      .filter((item) => item.id && (item.id === appointment.id || timestampMs(item.starts_at) >= anchorStart))
      .sort((left, right) => timestampMs(left.starts_at) - timestampMs(right.starts_at));
  }

  function isEditingAppointment() {
    const title = document.getElementById('appointmentFormTitle')?.textContent || '';
    const cancelButton = document.getElementById('cancelAppointmentEditBtn');
    return /bearbeiten/i.test(title) || Boolean(cancelButton && !cancelButton.classList.contains('hidden'));
  }

  function setFormEditingAppointmentId(id) {
    const form = document.getElementById(FORM_ID);
    if (!form) return;
    if (id) form.dataset.editingAppointmentId = id;
    else delete form.dataset.editingAppointmentId;
  }

  function formEditingAppointmentId(form) {
    return form?.dataset?.editingAppointmentId || editingAppointmentId || null;
  }

  function currentEditingAppointment(state, form) {
    const explicitId = formEditingAppointmentId(form);
    if (explicitId) {
      const match = state.appointments.find((appointment) => appointment.id === explicitId);
      if (match) return normalizeAppointment(match);
    }

    const data = new FormData(form);
    const title = clean(data.get('title'));
    const startDate = new Date(String(data.get('starts_at') || ''));
    if (!title || Number.isNaN(startDate.getTime())) return null;

    const matches = state.appointments
      .map(normalizeAppointment)
      .filter((appointment) => appointment.title === title && sameInstant(appointment.starts_at, startDate.toISOString()));
    if (matches.length === 1) return matches[0];
    return matches
      .sort((left, right) => timestampMs(right.updated_at || right.created_at) - timestampMs(left.updated_at || left.created_at))[0]
      || null;
  }

  function ensureFields() {
    const form = document.getElementById(FORM_ID);
    if (!form) return null;

    if (!document.getElementById(RECURRENCE_FIELD_ID)) {
      const field = document.createElement('label');
      field.className = 'appointment-recurrence-field';
      field.innerHTML = '<span>Zyklus</span><select id="appointmentRecurrenceSelect" name="recurrence"><option value="once" selected>Einmalig</option><option value="weekly">Wöchentlich</option><option value="monthly">Monatlich</option><option value="quarterly">Quartal</option><option value="yearly">Jährlich</option></select>';
      form.elements.location?.closest('label')?.insertAdjacentElement('afterend', field);
    }

    if (!document.getElementById(BIRTHDAY_FIELD_ID)) {
      const field = document.createElement('label');
      field.className = 'appointment-birthday-field';
      field.innerHTML = '<span>Geburtstag</span><span class="appointment-checkbox-row"><input id="appointmentBirthdayCheckbox" name="is_birthday" type="checkbox" value="1"><strong>Als Geburtstag markieren</strong></span>';
      const recurrenceLabel = document.getElementById(RECURRENCE_FIELD_ID)?.closest('label');
      const descriptionLabel = form.elements.description?.closest('label');
      if (recurrenceLabel) recurrenceLabel.insertAdjacentElement('afterend', field);
      else if (descriptionLabel) descriptionLabel.insertAdjacentElement('beforebegin', field);
      else form.insertBefore(field, form.querySelector('.form-actions'));
    }

    return form;
  }

  function syncFormFieldsFromAppointment(appointment) {
    if (!appointment) return;
    const state = readState();
    const normalized = normalizeAppointment(appointment);
    const series = inferSeries(state, normalized);
    const recurrenceField = document.getElementById(RECURRENCE_FIELD_ID);
    const birthdayField = document.getElementById(BIRTHDAY_FIELD_ID);
    if (recurrenceField) {
      recurrenceField.value = series?.recurrence || normalized.recurrence || 'once';
    }
    if (birthdayField) {
      birthdayField.checked = Boolean(normalized.is_birthday || series?.appointments?.some((item) => item.is_birthday));
    }
  }

  function rememberEditingAppointmentFromForm({ applyFields = false } = {}) {
    if (!isEditingAppointment()) return;
    const form = document.getElementById(FORM_ID);
    if (!(form instanceof HTMLFormElement)) return;
    const appointment = currentEditingAppointment(readState(), form);
    if (!appointment?.id) return;
    editingAppointmentId = appointment.id;
    setFormEditingAppointmentId(appointment.id);
    if (applyFields) syncFormFieldsFromAppointment(appointment);
  }

  function appointmentIdFromTarget(target, source) {
    return target?.dataset?.id || source?.closest?.('[data-id]')?.dataset?.id || null;
  }

  function resetEditContext(action, target, source) {
    if ((action || '').includes('edit-appointment')) {
      editingAppointmentId = appointmentIdFromTarget(target, source);
      setFormEditingAppointmentId(editingAppointmentId);
      window.setTimeout(() => rememberEditingAppointmentFromForm({ applyFields: true }), 0);
      return;
    }
    if (
      action === 'new-appointment-for-day'
      || target?.id === 'appointmentFormToggleBtn'
      || target?.id === 'appointmentFormCloseBtn'
      || target?.id === 'cancelAppointmentEditBtn'
    ) {
      editingAppointmentId = null;
      setFormEditingAppointmentId(null);
      const recurrenceField = document.getElementById(RECURRENCE_FIELD_ID);
      const birthdayField = document.getElementById(BIRTHDAY_FIELD_ID);
      if (recurrenceField) recurrenceField.value = 'once';
      if (birthdayField) birthdayField.checked = false;
    }
    window.setTimeout(() => rememberEditingAppointmentFromForm({ applyFields: false }), 0);
  }

  function rememberCalendarRestore() {
    try {
      window.sessionStorage.setItem(RESTORE_KEY, '1');
    } catch (error) {}
  }

  function restoreCalendarAfterReload() {
    let shouldRestore = false;
    try {
      shouldRestore = window.sessionStorage.getItem(RESTORE_KEY) === '1';
      if (shouldRestore) window.sessionStorage.removeItem(RESTORE_KEY);
    } catch (error) {}
    if (!shouldRestore) return;
    const showCalendar = () => document.querySelector('.nav-btn[data-target="calendar"]')?.click();
    showCalendar();
    window.setTimeout(showCalendar, 0);
    window.setTimeout(showCalendar, 80);
    window.setTimeout(showCalendar, 220);
  }

  function setSaveLock() {
    try {
      window.sessionStorage.setItem(SAVE_LOCK_KEY, String(Date.now() + SAVE_LOCK_MS));
    } catch (error) {}
  }

  function isSaveLocked() {
    try {
      const expiresAt = Number(window.sessionStorage.getItem(SAVE_LOCK_KEY) || 0);
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        window.sessionStorage.removeItem(SAVE_LOCK_KEY);
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  function markDeletedAppointments(state, ids) {
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (!uniqueIds.length) return;
    if (!state.deletedRemoteIds || typeof state.deletedRemoteIds !== 'object') state.deletedRemoteIds = {};
    if (!state.deletedRemoteIds.appointments || typeof state.deletedRemoteIds.appointments !== 'object') {
      state.deletedRemoteIds.appointments = {};
    }
    const timestamp = nowIso();
    uniqueIds.forEach((id) => {
      state.deletedRemoteIds.appointments[id] = { deleted_at: timestamp };
    });
  }

  function sortedAppointments(rows) {
    return rows.slice().sort((left, right) => timestampMs(left.starts_at || left.created_at) - timestampMs(right.starts_at || right.created_at));
  }

  function mergeSeriesIntoState(state, additions, replacedAppointments) {
    const replacedIds = new Set(replacedAppointments.map((appointment) => appointment.id).filter(Boolean));
    const additionIds = new Set(additions.map((appointment) => appointment.id).filter(Boolean));
    const additionKeys = new Set(additions.map(appointmentKey));
    const deletedIds = Array.from(replacedIds).filter((id) => !additionIds.has(id));
    if (deletedIds.length) markDeletedAppointments(state, deletedIds);

    const kept = state.appointments
      .map(normalizeAppointment)
      .filter((appointment) => !replacedIds.has(appointment.id))
      .filter((appointment) => !additionIds.has(appointment.id))
      .filter((appointment) => !additionKeys.has(appointmentKey(appointment)));
    state.appointments = sortedAppointments([...kept, ...additions]);
    return deletedIds;
  }

  async function getSupabaseUser() {
    const config = window.HABITFLOW_SUPABASE_CONFIG || {};
    if (!window.supabase || !config.url || !config.anonKey) return null;
    const client = window.supabase.createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    const sessionResult = await client.auth.getSession();
    const userId = sessionResult?.data?.session?.user?.id;
    return userId ? { client, userId } : null;
  }

  async function deleteRemoteAppointments(ids) {
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (!uniqueIds.length) return false;
    const context = await getSupabaseUser();
    if (!context) return false;
    const { error } = await context.client.from('appointments').delete().eq('user_id', context.userId).in('id', uniqueIds);
    if (error) throw error;
    return true;
  }

  async function syncAppointments(rows) {
    if (!rows.length) return false;
    const context = await getSupabaseUser();
    if (!context) return false;
    const payload = rows.map((row) => ({
      id: row.id,
      user_id: context.userId,
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
      is_birthday: Boolean(row.is_birthday),
    }));
    let result = await context.client.from('appointments').upsert(payload, { onConflict: 'id' });
    if (result.error && /is_birthday/i.test(result.error.message || '')) {
      const fallbackPayload = payload.map(({ is_birthday, ...row }) => row);
      result = await context.client.from('appointments').upsert(fallbackPayload, { onConflict: 'id' });
    }
    if (result.error) throw result.error;
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

  async function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== FORM_ID || isSaveLocked()) return;

    const recurrence = recurrenceValue(form);
    const wantsBirthday = isBirthdayValue(form);
    const state = readState();
    const existingAppointment = isEditingAppointment() ? currentEditingAppointment(state, form) : null;
    const existingSeries = existingAppointment ? inferSeries(state, existingAppointment) : null;

    if (recurrence === 'once' && !wantsBirthday && !existingAppointment && !existingSeries) {
      return;
    }
    if (recurrence === 'once' && !existingSeries && existingAppointment && !existingAppointment.is_birthday && !wantsBirthday) {
      return;
    }
    if (isEditingAppointment() && !existingAppointment) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toast('Termin konnte nicht eindeutig gefunden werden. Bitte Kalender neu laden und nochmals bearbeiten.', 'danger');
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    setSaveLock();

    const originalAppointments = state.appointments.slice();
    let additions;
    try {
      additions = recurrence === 'once'
        ? [buildAppointmentFromForm(form, existingAppointment)]
        : buildSeries(form, recurrence, existingAppointment, existingSeries);
    } catch (error) {
      window.sessionStorage.removeItem(SAVE_LOCK_KEY);
      toast(error.message, 'danger');
      return;
    }

    const replacedAppointments = existingAppointment
      ? appointmentsFromEditPoint(state, existingAppointment, existingSeries)
      : [];
    const deletedIds = mergeSeriesIntoState(state, additions, replacedAppointments);
    writeState(state);

    try {
      await deleteRemoteAppointments(deletedIds);
      const synced = await syncAppointments(additions);
      if (!synced) throw new Error('Kein Supabase-Login gefunden.');
      markSynced(additions.map((row) => row.id));
      toast(recurrence === 'once'
        ? 'Termin als Einzeltermin gespeichert.'
        : `${additions.length} Termine als ${RECURRENCE_OPTIONS[recurrence].label}-Serie angelegt.`);
      editingAppointmentId = null;
      setFormEditingAppointmentId(null);
    } catch (error) {
      console.warn('[HabitFlow/appointments] Serien-Sync fehlgeschlagen.', error);
      state.appointments = originalAppointments;
      writeState(state);
      window.sessionStorage.removeItem(SAVE_LOCK_KEY);
      toast('Termin konnte nicht vollständig mit der DB synchronisiert werden. Bitte nochmals speichern.', 'danger');
      return;
    }

    rememberCalendarRestore();
    window.setTimeout(() => window.location.reload(), 180);
  }

  function installStyles() {
    if (document.getElementById('appointmentRecurrenceControllerStyles')) return;
    const style = document.createElement('style');
    style.id = 'appointmentRecurrenceControllerStyles';
    style.textContent = `
      .appointment-checkbox-row {
        min-height: 56px;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 18px;
        border: 1px solid var(--input-border, rgba(148, 163, 184, .24));
        border-radius: 18px;
        background: var(--input-bg, rgba(255, 255, 255, .04));
      }
      .appointment-checkbox-row input {
        width: 18px;
        height: 18px;
        accent-color: #f7b84a;
      }
      .appointment-birthday-chip {
        display: inline-flex;
        align-items: center;
        width: max-content;
        margin-right: 5px;
        padding: 2px 7px;
        border-radius: 999px;
        background: rgba(247, 184, 74, .18);
        border: 1px solid rgba(247, 184, 74, .38);
        color: #9a5b00;
        font-size: .68em;
        font-weight: 900;
        letter-spacing: .02em;
      }
    `;
    document.head.appendChild(style);
  }

  function decorateBirthdayAppointments() {
    const birthdays = readState().appointments
      .filter((appointment) => appointment.is_birthday)
      .map((appointment) => clean(appointment.title))
      .filter(Boolean);
    if (!birthdays.length) return;

    const candidates = document.querySelectorAll('#screen-calendar button, #screen-calendar article, #screen-calendar li, #screen-calendar .event, #screen-calendar [data-id]');
    candidates.forEach((node) => {
      if (!(node instanceof HTMLElement) || node.querySelector('.appointment-birthday-chip')) return;
      const text = node.textContent || '';
      if (!birthdays.some((title) => text.includes(title))) return;
      const chip = document.createElement('span');
      chip.className = 'appointment-birthday-chip';
      chip.textContent = 'Geburtstag';
      node.prepend(chip);
    });
  }

  function install() {
    restoreCalendarAfterReload();
    installStyles();
    const form = ensureFields();
    if (form) {
      form.addEventListener('submit', handleSubmit, true);
    }
    document.addEventListener('click', (event) => {
      const source = event.target instanceof Element ? event.target : null;
      const target = source?.closest('button, [data-action]') || null;
      resetEditContext(target?.dataset?.action, target, source);
    });
    window.setInterval(decorateBirthdayAppointments, 1200);
    window.setTimeout(decorateBirthdayAppointments, 300);
  }

  if (document.readyState === 'loading') {
    restoreCalendarAfterReload();
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})(window, document);
