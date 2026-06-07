(function refreshHabitFlowAppointmentsFromRemote(window, document) {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const SAVE_LOCK_KEY = 'habitflow-appointment-series-save-lock';
  const RELOAD_MARKER_KEY = 'habitflow-appointments-remote-refresh-guard';
  const RETRY_PADDING_MS = 350;

  function readState() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
      const state = parsed && typeof parsed === 'object' ? parsed : {};
      if (!Array.isArray(state.appointments)) state.appointments = [];
      return state;
    } catch (error) {
      console.warn('[HabitFlow/appointment-refresh] Lokaler State konnte nicht gelesen werden.', error);
      return { appointments: [] };
    }
  }

  function writeState(state) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function saveLockRemainingMs() {
    try {
      const expiresAt = Number(window.sessionStorage?.getItem(SAVE_LOCK_KEY) || 0);
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        window.sessionStorage?.removeItem(SAVE_LOCK_KEY);
        return 0;
      }
      return expiresAt - Date.now();
    } catch (error) {
      return 0;
    }
  }

  function clean(value) {
    return String(value || '').trim();
  }

  function comparable(appointment = {}) {
    return [
      appointment.id || '',
      clean(appointment.title),
      clean(appointment.description),
      clean(appointment.location),
      appointment.appointment_type || 'other',
      appointment.starts_at || '',
      appointment.ends_at || '',
      appointment.created_at || '',
      appointment.updated_at || '',
      appointment.recurrence || '',
      appointment.series_id || '',
      Number.isInteger(appointment.series_index) ? appointment.series_index : '',
    ].join('|');
  }

  function signature(appointments = []) {
    return appointments.map(comparable).sort().join('\n');
  }

  function normalizeRemote(row = {}) {
    return {
      id: row.id,
      title: row.title,
      description: clean(row.description),
      location: clean(row.location),
      appointment_type: row.appointment_type || 'other',
      starts_at: row.starts_at,
      ends_at: row.ends_at || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      recurrence: row.recurrence || null,
      series_id: row.series_id || null,
      series_index: Number.isInteger(row.series_index) ? row.series_index : null,
      synced: true,
    };
  }

  function client() {
    const config = window.HABITFLOW_SUPABASE_CONFIG || {};
    if (!window.supabase || !config.url || !config.anonKey) return null;
    return window.supabase.createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }

  async function fetchRemoteAppointments(supabaseClient, userId) {
    const baseColumns = 'id,title,description,location,appointment_type,starts_at,ends_at,created_at,updated_at';
    const seriesColumns = `${baseColumns},recurrence,series_id,series_index`;
    let result = await supabaseClient
      .from('appointments')
      .select(seriesColumns)
      .eq('user_id', userId)
      .order('starts_at', { ascending: true });

    if (result.error && /recurrence|series_id|series_index/i.test(result.error.message || '')) {
      result = await supabaseClient
        .from('appointments')
        .select(baseColumns)
        .eq('user_id', userId)
        .order('starts_at', { ascending: true });
    }
    if (result.error) throw result.error;
    return (result.data || []).map(normalizeRemote);
  }

  function isEditingAppointment() {
    const title = document.getElementById('appointmentFormTitle')?.textContent || '';
    const cancelButton = document.getElementById('cancelAppointmentEditBtn');
    return /bearbeiten/i.test(title) || Boolean(cancelButton && !cancelButton.classList.contains('hidden'));
  }

  async function run() {
    const remaining = saveLockRemainingMs();
    if (remaining > 0) {
      window.setTimeout(run, remaining + RETRY_PADDING_MS);
      return;
    }

    const supabaseClient = client();
    if (!supabaseClient) return;
    const sessionResult = await supabaseClient.auth.getSession();
    const userId = sessionResult?.data?.session?.user?.id;
    if (!userId) return;

    const remoteAppointments = await fetchRemoteAppointments(supabaseClient, userId);
    const state = readState();
    if (signature(state.appointments || []) === signature(remoteAppointments)) return;

    state.appointments = remoteAppointments;
    if (state.deletedRemoteIds?.appointments) state.deletedRemoteIds.appointments = {};
    writeState(state);

    if (isEditingAppointment()) return;
    try {
      const marker = signature(remoteAppointments).slice(0, 256);
      if (window.sessionStorage?.getItem(RELOAD_MARKER_KEY) === marker) return;
      window.sessionStorage?.setItem(RELOAD_MARKER_KEY, marker);
    } catch (error) {}
    window.setTimeout(() => window.location.reload(), 150);
  }

  function install() {
    window.setTimeout(() => run().catch(error => {
      console.warn('[HabitFlow/appointment-refresh] Remote-Terminabgleich fehlgeschlagen.', error);
    }), 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})(window, document);
