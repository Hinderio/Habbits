(function guardHabitFlowAppointmentSeriesEdits(window, document) {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const FORM_ID = 'appointmentForm';
  const FIELD_NAME = 'recurrence';
  const SAVE_LOCK_KEY = 'habitflow-appointment-series-save-lock';
  const RESTORE_KEY = 'habitflow-appointment-series-restore';
  const REMOTE_RECONCILE_RELOAD_KEY = 'habitflow-appointments-remote-reconcile-reload';
  const SAVE_LOCK_MS = 15000;
  const RECURRENCE_OPTIONS = Object.freeze({
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

  function readState() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
      const state = parsed && typeof parsed === 'object' ? parsed : {};
      if (!Array.isArray(state.appointments)) state.appointments = [];
      return state;
    } catch (error) {
      console.warn('[HabitFlow/appointment-guard] State konnte nicht gelesen werden.', error);
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

  function rememberCalendarRestore() {
    try {
      window.sessionStorage.setItem(RESTORE_KEY, JSON.stringify({ screen: 'calendar' }));
      window.sessionStorage.setItem(REMOTE_RECONCILE_RELOAD_KEY, `edit:${Date.now()}`);
    } catch (error) {}
  }

  function clean(value) {
    return String(value || '').trim();
  }

  function timestampMs(value) {
    const time = new Date(value || '').getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function sameInstant(left, right) {
    return Math.abs(new Date(left).getTime() - new Date(right).getTime()) < 1000;
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

  function seriesFromLocalFields(state, appointment) {
    if (!appointment?.series_id) return null;
    const appointments = state.appointments
      .filter(item => item.series_id === appointment.series_id)
      .sort((a, b) => timestampMs(a.starts_at) - timestampMs(b.starts_at));
    const recurrence = appointment.recurrence || appointments.find(item => item.recurrence)?.recurrence;
    if (!RECURRENCE_OPTIONS[recurrence] || appointments.length < 2) return null;
    return { recurrence, appointments, seriesId: appointment.series_id };
  }

  function detectSeriesByCadence(state, appointment) {
    if (!appointment?.starts_at) return null;
    const signature = appointmentSignature(appointment);
    const candidates = state.appointments
      .filter(item => item.id && appointmentSignature(item) === signature)
      .sort((a, b) => timestampMs(a.starts_at) - timestampMs(b.starts_at));
    if (candidates.length < 2) return null;

    for (const recurrence of ['weekly', 'monthly', 'quarterly', 'yearly']) {
      for (const anchor of candidates) {
        const anchorDate = new Date(anchor.starts_at);
        const group = candidates.filter(candidate => {
          for (let index = 0; index < RECURRENCE_OPTIONS[recurrence].count; index += 1) {
            if (sameInstant(candidate.starts_at, advanceDate(anchorDate, recurrence, index).toISOString())) return true;
          }
          return false;
        });
        if (group.length >= 2 && group.some(item => item.id === appointment.id)) {
          return {
            recurrence,
            appointments: group.sort((a, b) => timestampMs(a.starts_at) - timestampMs(b.starts_at)),
            seriesId: appointment.series_id || group.find(item => item.series_id)?.series_id || uid(),
          };
        }
      }
    }
    return null;
  }

  function inferSeries(state, appointment) {
    return seriesFromLocalFields(state, appointment) || detectSeriesByCadence(state, appointment);
  }

  function appointmentsFromEditPoint(state, appointment, existingSeries) {
    const anchorStart = timestampMs(appointment?.starts_at);
    if (!anchorStart) return [];
    const seriesAppointments = existingSeries?.appointments?.length ? existingSeries.appointments : [appointment];
    return seriesAppointments
      .filter(item => item.id && (item.id === appointment.id || timestampMs(item.starts_at) >= anchorStart))
      .sort((a, b) => timestampMs(a.starts_at) - timestampMs(b.starts_at));
  }

  function buildAppointmentFromForm(form, existingAppointment) {
    const data = new FormData(form);
    const title = clean(data.get('title'));
    const startDate = new Date(String(data.get('starts_at') || ''));
    const endRaw = String(data.get('ends_at') || '');
    const endDate = endRaw ? new Date(endRaw) : null;
    if (!title || Number.isNaN(startDate.getTime())) throw new Error('Bitte gib mindestens Titel und Startzeit ein.');
    if (endDate && Number.isNaN(endDate.getTime())) throw new Error('Bitte prüfe die Endzeit.');
    if (endDate && endDate < startDate) throw new Error('Die Endzeit muss nach dem Start liegen.');
    const timestamp = nowIso();
    return {
      id: existingAppointment?.id || uid(),
      title,
      description: clean(data.get('description')),
      location: clean(data.get('location')),
      appointment_type: clean(data.get('appointment_type') || 'other') || 'other',
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

  function buildRows(form, recurrence, existingAppointment, seriesId) {
    const base = buildAppointmentFromForm(form, existingAppointment);
    if (recurrence === 'once') return [base];
    const option = RECURRENCE_OPTIONS[recurrence];
    const startDate = new Date(base.starts_at);
    const duration = base.ends_at ? timestampMs(base.ends_at) - timestampMs(base.starts_at) : null;
    const effectiveSeriesId = seriesId || existingAppointment?.series_id || uid();
    return Array.from({ length: option.count }, (_, index) => {
      const startsAt = advanceDate(startDate, recurrence, index);
      const endsAt = duration == null ? null : new Date(startsAt.getTime() + duration);
      return {
        ...base,
        id: index === 0 ? base.id : uid(),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt ? endsAt.toISOString() : null,
        recurrence,
        series_id: effectiveSeriesId,
        series_index: index,
        synced: false,
      };
    });
  }

  function explicitEditingId(form) {
    return form?.dataset?.editingAppointmentId || editingAppointmentId || null;
  }

  function currentEditingAppointment(state, form) {
    const explicitId = explicitEditingId(form);
    if (explicitId) {
      const match = state.appointments.find(item => item.id === explicitId);
      if (match) return match;
    }
    const data = new FormData(form);
    const title = clean(data.get('title'));
    const startDate = new Date(String(data.get('starts_at') || ''));
    if (!title || Number.isNaN(startDate.getTime())) return null;
    const matches = state.appointments.filter(item => item.title === title && item.starts_at === startDate.toISOString());
    if (matches.length === 1) return matches[0];
    return matches.sort((a, b) => timestampMs(b.updated_at || b.created_at) - timestampMs(a.updated_at || a.created_at))[0] || null;
  }

  function isEditingAppointment() {
    const title = document.getElementById('appointmentFormTitle')?.textContent || '';
    const cancelButton = document.getElementById('cancelAppointmentEditBtn');
    return /bearbeiten/i.test(title) || Boolean(cancelButton && !cancelButton.classList.contains('hidden'));
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
    const sessionResult = await client.auth.getSession();
    return { client, userId: sessionResult?.data?.session?.user?.id || null };
  }

  async function syncAppointments(rows) {
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

  async function deleteRemoteAppointments(ids) {
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (!uniqueIds.length) return false;
    const { client, userId } = await remoteUser();
    if (!client || !userId) return false;
    const { error } = await client.from('appointments').delete().eq('user_id', userId).in('id', uniqueIds);
    if (error) throw error;
    return true;
  }

  async function deleteRemoteFollowers(anchor, keepIds, existingSeries) {
    if (!anchor) return false;
    if (existingSeries?.appointments?.length) {
      const ids = existingSeries.appointments
        .filter(item => item.id && !keepIds.has(item.id) && timestampMs(item.starts_at) > timestampMs(anchor.starts_at))
        .map(item => item.id);
      if (ids.length) return deleteRemoteAppointments(ids);
    }
    if (!anchor.series_id) return false;
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

  function setSynced(state, ids) {
    const idSet = new Set(ids);
    state.appointments = state.appointments.map(item => idSet.has(item.id) ? { ...item, synced: true } : item);
  }

  async function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== FORM_ID || !isEditingAppointment()) return;
    const recurrence = form.elements[FIELD_NAME]?.value || 'once';
    if (!RECURRENCE_OPTIONS[recurrence]) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    setSaveLock();

    const state = readState();
    const originalAppointments = [...state.appointments];
    const existingAppointment = currentEditingAppointment(state, form);
    if (!existingAppointment) {
      clearSaveLock();
      toast('Termin konnte nicht eindeutig gefunden werden. Bitte Kalender neu laden und nochmals bearbeiten.', 'danger');
      return;
    }

    let rows;
    let replacedAppointments;
    try {
      const existingSeries = inferSeries(state, existingAppointment);
      rows = buildRows(form, recurrence, existingAppointment, existingSeries?.seriesId);
      replacedAppointments = appointmentsFromEditPoint(state, existingAppointment, existingSeries);
      const keepIds = new Set(rows.map(row => row.id));
      const deletedIds = replacedAppointments.filter(item => !keepIds.has(item.id)).map(item => item.id);
      await deleteRemoteAppointments(deletedIds);
      await deleteRemoteFollowers(existingAppointment, keepIds, existingSeries);
      const synced = await syncAppointments(rows);
      if (!synced) {
        if (replacedAppointments.length) await syncAppointments(replacedAppointments);
        throw new Error('Termin konnte nicht mit Supabase synchronisiert werden.');
      }
    } catch (error) {
      console.warn('[HabitFlow/appointment-guard] Termin-Serie konnte nicht gespeichert werden.', error);
      state.appointments = originalAppointments;
      writeState(state);
      clearSaveLock();
      toast('Termin konnte nicht vollständig mit der DB synchronisiert werden. Bitte nochmals speichern.', 'danger');
      return;
    }

    const replacedIds = new Set(replacedAppointments.map(item => item.id));
    state.appointments = state.appointments.filter(item => !replacedIds.has(item.id));
    state.appointments.push(...rows);
    setSynced(state, rows.map(row => row.id));
    writeState(state);
    editingAppointmentId = null;
    delete form.dataset.editingAppointmentId;
    rememberCalendarRestore();
    toast(recurrence === 'once' ? 'Termin als Einzeltermin gespeichert.' : `${rows.length} Termine als ${RECURRENCE_OPTIONS[recurrence].label}-Serie gespeichert.`);
    window.setTimeout(() => window.location.reload(), 250);
  }

  function captureEditId(event) {
    const source = event.target instanceof Element ? event.target : null;
    const target = source?.closest('button, [data-action]') || null;
    const action = target?.dataset?.action || '';
    const form = document.getElementById(FORM_ID);
    if (action === 'edit-appointment' || action.includes('edit-appointment')) {
      editingAppointmentId = target?.dataset?.id || source?.closest?.('[data-id]')?.dataset?.id || null;
      if (form && editingAppointmentId) form.dataset.editingAppointmentId = editingAppointmentId;
      return;
    }
    if (action === 'new-appointment-for-day' || target?.id === 'appointmentFormToggleBtn' || target?.id === 'cancelAppointmentEditBtn') {
      editingAppointmentId = null;
      if (form) delete form.dataset.editingAppointmentId;
    }
  }

  function install() {
    document.addEventListener('click', captureEditId, true);
    document.addEventListener('submit', handleSubmit, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})(window, document);
