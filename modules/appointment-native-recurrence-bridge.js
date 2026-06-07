(function bridgeHabitFlowNativeAppointmentRecurrence(window, document) {
  'use strict';

  if (window.__HABITFLOW_NATIVE_APPOINTMENT_RECURRENCE_BRIDGE__) return;
  window.__HABITFLOW_NATIVE_APPOINTMENT_RECURRENCE_BRIDGE__ = true;

  const DELETE_ARCHIVE_KEY = 'habitflow-remote-delete-archive-v1';
  const RECURRENCES = Object.freeze({ weekly: 104, monthly: 36, quarterly: 20, yearly: 10 });
  const RECURRENCE_LABELS = Object.freeze({ weekly: 'Wöchentlich', monthly: 'Monatlich', quarterly: 'Quartal', yearly: 'Jährlich' });
  let submitSnapshot = null;
  let activeAppointmentsArray = null;
  let applying = false;

  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const originalArrayFind = Array.prototype.find;
  const originalArrayPush = Array.prototype.push;
  const originalObjectAssign = Object.assign;

  function uid() {
    return window.crypto?.randomUUID ? window.crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function clean(value) {
    return String(value || '').trim();
  }

  function timestamp(value) {
    const time = new Date(value || '').getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function sameInstant(left, right) {
    return Math.abs(timestamp(left) - timestamp(right)) < 1500;
  }

  function normalizeRecurrence(value) {
    const key = clean(value).toLowerCase();
    return RECURRENCES[key] ? key : null;
  }

  function normalizeType(value) {
    const key = clean(value).toLowerCase();
    return ['personal', 'work', 'health', 'social', 'admin', 'other'].includes(key) ? key : 'other';
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

  function isAppointment(row) {
    return Boolean(row && typeof row === 'object' && 'starts_at' in row && 'title' in row && !('habit_id' in row) && !('smoked_at' in row));
  }

  function appointmentSignature(row) {
    return [clean(row.title), clean(row.description), clean(row.location), normalizeType(row.appointment_type)].join('|');
  }

  function snapshotFromForm(form) {
    const data = new FormData(form);
    const startsAt = new Date(String(data.get('starts_at') || ''));
    const rawEnd = String(data.get('ends_at') || '');
    const endsAt = rawEnd ? new Date(rawEnd) : null;
    const title = clean(data.get('title'));
    if (!title || Number.isNaN(startsAt.getTime())) return null;
    return {
      title,
      description: clean(data.get('description')),
      location: clean(data.get('location')),
      appointment_type: normalizeType(data.get('appointment_type')),
      starts_at: startsAt.toISOString(),
      ends_at: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt.toISOString() : null,
      recurrence: normalizeRecurrence(data.get('recurrence')),
      is_birthday: Boolean(data.get('is_birthday')),
      touched_at: nowIso()
    };
  }

  function applySnapshot(row, snapshot, { recurrence = snapshot.recurrence, seriesId = null, index = null } = {}) {
    row.title = snapshot.title;
    row.description = snapshot.description;
    row.location = snapshot.location;
    row.appointment_type = snapshot.appointment_type;
    row.recurrence = recurrence || null;
    row.series_id = recurrence ? (seriesId || row.series_id || uid()) : null;
    row.series_index = recurrence ? (Number.isInteger(index) ? index : 0) : null;
    row.is_birthday = Boolean(snapshot.is_birthday);
    row.updated_at = snapshot.touched_at;
    row.synced = false;
    return row;
  }

  function buildRows(baseRow, snapshot, seriesId = null) {
    const recurrence = snapshot.recurrence;
    const first = applySnapshot(baseRow, snapshot, { recurrence, seriesId, index: 0 });
    if (!recurrence) return [first];

    const start = new Date(snapshot.starts_at);
    const duration = snapshot.ends_at ? timestamp(snapshot.ends_at) - timestamp(snapshot.starts_at) : null;
    const nextSeriesId = seriesId || first.series_id || uid();
    first.series_id = nextSeriesId;
    first.series_index = 0;

    return Array.from({ length: RECURRENCES[recurrence] }, (_, index) => {
      const row = index === 0 ? first : { ...first, id: uid(), created_at: first.created_at || snapshot.touched_at };
      const nextStart = advanceDate(start, recurrence, index);
      row.starts_at = nextStart.toISOString();
      row.ends_at = duration == null ? null : new Date(nextStart.getTime() + duration).toISOString();
      row.recurrence = recurrence;
      row.series_id = nextSeriesId;
      row.series_index = index;
      row.is_birthday = Boolean(snapshot.is_birthday);
      row.updated_at = snapshot.touched_at;
      row.synced = false;
      return row;
    });
  }

  function seriesForEdit(array, appointment) {
    if (!Array.isArray(array) || !isAppointment(appointment)) return [appointment];
    const anchor = timestamp(appointment.starts_at);
    if (appointment.series_id) {
      return array.filter(row => row?.id === appointment.id || (row?.series_id === appointment.series_id && timestamp(row.starts_at) >= anchor));
    }
    const signature = appointmentSignature(appointment);
    return array.filter(row => row?.id === appointment.id || (appointmentSignature(row) === signature && timestamp(row.starts_at) >= anchor));
  }

  function markDeleted(ids) {
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (!uniqueIds.length) return;
    let archive = {};
    try { archive = JSON.parse(window.localStorage.getItem(DELETE_ARCHIVE_KEY) || '{}') || {}; } catch {}
    if (!archive.appointments || typeof archive.appointments !== 'object') archive.appointments = {};
    const deletedAt = nowIso();
    uniqueIds.forEach(id => {
      archive.appointments[id] = { deleted_at: deletedAt, synced_at: null };
    });
    window.localStorage.setItem(DELETE_ARCHIVE_KEY, JSON.stringify(archive));
  }

  function replaceRows(array, additions, replaced) {
    const replacedIds = new Set(replaced.map(row => row?.id).filter(Boolean));
    const additionIds = new Set(additions.map(row => row?.id).filter(Boolean));
    const deletedIds = Array.from(replacedIds).filter(id => !additionIds.has(id));
    markDeleted(deletedIds);

    applying = true;
    try {
      for (let index = array.length - 1; index >= 0; index -= 1) {
        const row = array[index];
        if (replacedIds.has(row?.id) || additionIds.has(row?.id)) array.splice(index, 1);
      }
      originalArrayPush.apply(array, additions);
      array.sort((left, right) => timestamp(left.starts_at || left.created_at) - timestamp(right.starts_at || right.created_at));
    } finally {
      applying = false;
    }
    return deletedIds;
  }

  async function remoteContext() {
    const config = window.HABITFLOW_SUPABASE_CONFIG || {};
    if (!window.supabase || !config.url || !config.anonKey) return null;
    const client = window.supabase.createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    const session = await client.auth.getSession();
    const userId = session?.data?.session?.user?.id;
    return userId ? { client, userId } : null;
  }

  async function syncRemote(additions, deletedIds) {
    const context = await remoteContext();
    if (!context) return;
    if (deletedIds.length) {
      const deletion = await context.client.from('appointments').delete().eq('user_id', context.userId).in('id', deletedIds);
      if (deletion.error) console.warn('[HabitFlow/appointments] Serien-Löschung konnte remote nicht vollständig synchronisiert werden.', deletion.error);
    }
    if (!additions.length) return;
    const payload = additions.map(row => ({
      id: row.id,
      user_id: context.userId,
      title: row.title,
      description: row.description || null,
      location: row.location || null,
      appointment_type: normalizeType(row.appointment_type),
      starts_at: row.starts_at,
      ends_at: row.ends_at || null,
      recurrence: row.recurrence || null,
      series_id: row.series_id || null,
      series_index: Number.isInteger(row.series_index) ? row.series_index : null,
      is_birthday: Boolean(row.is_birthday),
      created_at: row.created_at || nowIso(),
      updated_at: row.updated_at || nowIso()
    }));
    const result = await context.client.from('appointments').upsert(payload, { onConflict: 'id' });
    if (result.error) console.warn('[HabitFlow/appointments] Serien-Sync konnte remote nicht vollständig synchronisiert werden.', result.error);
  }

  Array.prototype.find = function patchedFind(...args) {
    const result = originalArrayFind.apply(this, args);
    if (submitSnapshot && result && isAppointment(result) && Array.isArray(this) && originalArrayFind.call(this, isAppointment)) {
      activeAppointmentsArray = this;
    }
    return result;
  };

  Array.prototype.push = function patchedPush(...items) {
    if (!applying && submitSnapshot && items.length === 1 && isAppointment(items[0]) && sameInstant(items[0].starts_at, submitSnapshot.starts_at)) {
      const additions = buildRows(items[0], submitSnapshot, null);
      window.setTimeout(() => syncRemote(additions, []), 1200);
      return originalArrayPush.apply(this, additions);
    }
    return originalArrayPush.apply(this, items);
  };

  Object.assign = function patchedAssign(target, ...sources) {
    const result = originalObjectAssign.call(Object, target, ...sources);
    if (!applying && submitSnapshot && activeAppointmentsArray && isAppointment(target)) {
      const replaced = seriesForEdit(activeAppointmentsArray, target);
      const seriesId = target.series_id || replaced.find(row => row.series_id)?.series_id || null;
      const additions = buildRows(target, submitSnapshot, submitSnapshot.recurrence ? seriesId : null);
      const deletedIds = replaceRows(activeAppointmentsArray, additions, replaced);
      window.setTimeout(() => syncRemote(additions, deletedIds), 1200);
    }
    return result;
  };

  EventTarget.prototype.addEventListener = function patchedAddEventListener(type, listener, options) {
    if (type === 'submit' && this instanceof HTMLFormElement && this.id === 'appointmentForm' && typeof listener === 'function') {
      const wrapped = function wrappedAppointmentSubmit(event) {
        submitSnapshot = snapshotFromForm(this);
        activeAppointmentsArray = null;
        try {
          return listener.call(this, event);
        } finally {
          window.setTimeout(() => {
            submitSnapshot = null;
            activeAppointmentsArray = null;
          }, 0);
        }
      };
      return originalAddEventListener.call(this, type, wrapped, options);
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  function fieldValueForAppointment(appointment, rows) {
    if (appointment?.recurrence) return appointment.recurrence;
    if (appointment?.series_id) return rows.find(row => row.series_id === appointment.series_id && row.recurrence)?.recurrence || null;
    return null;
  }

  function syncEditFieldsFromStorage(id) {
    if (!id) return;
    let state = null;
    try { state = JSON.parse(window.localStorage.getItem('habitflow-state-v1') || '{}'); } catch {}
    const rows = Array.isArray(state?.appointments) ? state.appointments : [];
    const appointment = rows.find(row => row.id === id);
    if (!appointment) return;
    const recurrence = fieldValueForAppointment(appointment, rows);
    const recurrenceField = document.getElementById('appointmentRecurrenceSelect');
    const birthdayField = document.getElementById('appointmentBirthdayCheckbox');
    if (recurrenceField) recurrenceField.value = recurrence || 'once';
    if (birthdayField) birthdayField.checked = Boolean(appointment.is_birthday || (appointment.series_id && rows.some(row => row.series_id === appointment.series_id && row.is_birthday)));
  }

  document.addEventListener('click', event => {
    const editButton = event.target?.closest?.('[data-action="edit-appointment"]');
    if (!editButton) return;
    const id = editButton.dataset.id;
    window.setTimeout(() => syncEditFieldsFromStorage(id), 80);
    window.setTimeout(() => syncEditFieldsFromStorage(id), 240);
  }, true);

  console.info('[HabitFlow/appointments] Native recurrence bridge active.');
})(window, document);