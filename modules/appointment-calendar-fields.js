(function enhanceHabitFlowAppointmentFields(window, document) {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const FORM_ID = 'appointmentForm';
  const RECURRENCE_FIELD_ID = 'appointmentRecurrenceSelect';
  const BIRTHDAY_FIELD_ID = 'appointmentBirthdayCheckbox';
  const RECURRENCES = Object.freeze({ weekly: 104, monthly: 36, quarterly: 20, yearly: 10 });

  function clean(value) {
    return String(value || '').trim();
  }

  function nowIso() {
    return new Date().toISOString();
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

  function appointmentSignature(row) {
    return [clean(row.title), clean(row.location), clean(row.appointment_type || 'other'), clean(row.description)].join('|');
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

  function matchingAppointments(state, snapshot) {
    const rows = state.appointments || [];
    const exact = rows.find(row => sameInstant(row.starts_at, snapshot.starts_at) && clean(row.title) === snapshot.title);
    if (!snapshot.recurrence) return exact ? [exact] : [];
    if (exact?.series_id) return rows.filter(row => row.series_id === exact.series_id);

    const expected = new Set(Array.from({ length: RECURRENCES[snapshot.recurrence] }, (_, index) => (
      advanceDate(new Date(snapshot.starts_at), snapshot.recurrence, index).toISOString()
    )));
    return rows.filter(row => appointmentSignature(row) === snapshot.signature && Array.from(expected).some(start => sameInstant(row.starts_at, start)));
  }

  function supabaseContext() {
    const config = window.HABITFLOW_SUPABASE_CONFIG || {};
    if (!window.supabase || !config.url || !config.anonKey) return null;
    const client = window.supabase.createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    return client.auth.getSession().then(result => {
      const userId = result?.data?.session?.user?.id;
      return userId ? { client, userId } : null;
    });
  }

  async function syncBirthdayRows(rows) {
    const context = await supabaseContext();
    if (!context || !rows.length) return;
    const payload = rows.map(row => ({
      id: row.id,
      user_id: context.userId,
      title: row.title,
      description: row.description || null,
      location: row.location || null,
      appointment_type: row.appointment_type || 'other',
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
    if (result.error) console.warn('[HabitFlow/appointments] Geburtstag konnte nicht remote synchronisiert werden.', result.error);
  }

  function ensureFields() {
    const form = document.getElementById(FORM_ID);
    if (!form) return;
    if (!document.getElementById(RECURRENCE_FIELD_ID)) {
      const field = document.createElement('label');
      field.innerHTML = '<span>Zyklus</span><select id="appointmentRecurrenceSelect" name="recurrence"><option value="once" selected>Einmalig</option><option value="weekly">Wöchentlich</option><option value="monthly">Monatlich</option><option value="quarterly">Quartal</option><option value="yearly">Jährlich</option></select>';
      form.elements.location?.closest('label')?.insertAdjacentElement('afterend', field);
    }
    if (!document.getElementById(BIRTHDAY_FIELD_ID)) {
      const field = document.createElement('label');
      field.innerHTML = '<span>Geburtstag</span><span class="appointment-checkbox-row"><input id="appointmentBirthdayCheckbox" name="is_birthday" type="checkbox" value="1"><strong>Als Geburtstag markieren</strong></span>';
      const recurrenceLabel = document.getElementById(RECURRENCE_FIELD_ID)?.closest('label');
      const descriptionLabel = form.elements.description?.closest('label');
      if (recurrenceLabel) recurrenceLabel.insertAdjacentElement('afterend', field);
      else if (descriptionLabel) descriptionLabel.insertAdjacentElement('beforebegin', field);
    }
  }

  function installStyles() {
    if (document.getElementById('appointmentCalendarFieldsStyles')) return;
    const style = document.createElement('style');
    style.id = 'appointmentCalendarFieldsStyles';
    style.textContent = '.appointment-checkbox-row{min-height:56px;display:flex;align-items:center;gap:10px;padding:0 18px;border:1px solid rgba(148,163,184,.24);border-radius:18px;background:rgba(255,255,255,.04)}.appointment-checkbox-row input{width:18px;height:18px;accent-color:#f7b84a}.day-chip.appointment.is-birthday{color:#9a5b00;background:rgba(247,184,74,.2);border-color:rgba(247,184,74,.32)}';
    document.head.appendChild(style);
  }

  function snapshotFromSubmit(form) {
    const data = new FormData(form);
    const startsAt = new Date(String(data.get('starts_at') || ''));
    if (Number.isNaN(startsAt.getTime())) return null;
    const row = {
      title: clean(data.get('title')),
      description: clean(data.get('description')),
      location: clean(data.get('location')),
      appointment_type: clean(data.get('appointment_type') || 'other') || 'other',
      starts_at: startsAt.toISOString(),
      recurrence: normalizeRecurrence(data.get('recurrence')),
      is_birthday: Boolean(data.get('is_birthday'))
    };
    row.signature = appointmentSignature(row);
    return row.title ? row : null;
  }

  function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== FORM_ID) return;
    const snapshot = snapshotFromSubmit(form);
    if (!snapshot) return;
    window.setTimeout(() => {
      const state = readState();
      const rows = matchingAppointments(state, snapshot);
      if (!rows.length) return;
      const touchedAt = nowIso();
      rows.forEach(row => {
        row.is_birthday = snapshot.is_birthday;
        row.updated_at = touchedAt;
        row.synced = false;
      });
      writeState(state);
      syncBirthdayRows(rows).catch(error => console.warn('[HabitFlow/appointments] Geburtstag-Sync fehlgeschlagen.', error));
    }, 350);
  }

  function init() {
    installStyles();
    ensureFields();
    document.addEventListener('submit', handleSubmit, true);
    const observer = new MutationObserver(() => ensureFields());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window, document);