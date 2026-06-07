(function initHabitFlowLineCalendar(window, document) {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const MONTHS_AHEAD = 12;
  const MONTHS_PER_SEGMENT = 1;
  const TITLE_MAX_LENGTH = 10;
  const APPOINTMENT_COLOR = '#f7b84a';
  const APPOINTMENT_TYPES = {
    personal: { label: 'Privat', color: APPOINTMENT_COLOR },
    work: { label: 'Arbeit', color: APPOINTMENT_COLOR },
    health: { label: 'Gesundheit', color: APPOINTMENT_COLOR },
    social: { label: 'Sozial', color: APPOINTMENT_COLOR },
    admin: { label: 'Admin', color: APPOINTMENT_COLOR },
    other: { label: 'Sonstiges', color: APPOINTMENT_COLOR }
  };

  let modal = null;
  let remoteAppointmentCache = null;

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  }

  function shortTitle(value = '') {
    const title = String(value || 'Termin').trim() || 'Termin';
    return title.length > TITLE_MAX_LENGTH ? `${title.slice(0, TITLE_MAX_LENGTH - 1)}…` : title;
  }

  function readState() {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }

  function writeState(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state || {}));
    } catch (error) {}
  }

  function readJsonStorage(key) {
    try {
      return JSON.parse(window.localStorage.getItem(key) || '{}') || {};
    } catch {
      return {};
    }
  }

  function collectDeletedIds(source, table, ids) {
    const value = source?.[table];
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(id => { if (id) ids.add(String(id)); });
      return;
    }
    if (typeof value === 'object') {
      Object.keys(value).forEach(id => { if (id) ids.add(String(id)); });
    }
  }

  function deletedAppointmentIds(state = readState()) {
    const ids = new Set();
    collectDeletedIds(state.deletedRemoteIds, 'appointments', ids);
    collectDeletedIds(readJsonStorage('habitflow-remote-delete-archive-v1'), 'appointments', ids);
    return ids;
  }

  function toIso(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
  }

  function mapRemoteAppointment(row) {
    return {
      id: row.id,
      title: row.title || '',
      description: row.description || '',
      location: row.location || '',
      appointment_type: row.appointment_type || 'other',
      starts_at: toIso(row.starts_at),
      ends_at: toIso(row.ends_at),
      recurrence: row.recurrence || 'once',
      series_id: row.series_id || '',
      series_index: Number.isInteger(row.series_index) ? row.series_index : null,
      is_birthday: Boolean(row.is_birthday),
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
      synced: true
    };
  }

  async function refreshRemoteAppointments() {
    const config = window.HABITFLOW_SUPABASE_CONFIG || {};
    if (!window.supabase || !config.url || !config.anonKey) return false;
    const client = window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    const sessionResult = await client.auth.getSession();
    const userId = sessionResult?.data?.session?.user?.id;
    if (!userId) return false;

    const { data, error } = await client.from('appointments')
      .select('*')
      .eq('user_id', userId)
      .order('starts_at', { ascending: true });
    if (error) throw error;

    const state = readState();
    remoteAppointmentCache = (data || []).map(mapRemoteAppointment);
    state.appointments = remoteAppointmentCache;
    if (state.deletedRemoteIds?.appointments) {
      state.deletedRemoteIds.appointments = {};
    }
    writeState(state);
    return true;
  }

  function toDate(value) {
    const date = value instanceof Date ? new Date(value) : new Date(value || 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function addMonths(value, months) {
    const source = toDate(value) || new Date();
    const date = new Date(source);
    const originalDay = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + months);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(originalDay, lastDay));
    return date;
  }

  function formatDate(value, options = {}) {
    const date = toDate(value);
    if (!date) return '';
    return date.toLocaleDateString('de-CH', options);
  }

  function formatTime(value) {
    const date = toDate(value);
    if (!date) return '';
    return date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
  }

  function normalizedType(type) {
    const key = String(type || '').trim().toLowerCase();
    return APPOINTMENT_TYPES[key] ? key : 'other';
  }

  function appointmentDate(appointment) {
    return toDate(appointment?.starts_at || appointment?.created_at);
  }

  function futureAppointments(sourceAppointments = null) {
    const now = new Date();
    const windowEnd = addMonths(now, MONTHS_AHEAD);
    const state = readState();
    const deletedIds = deletedAppointmentIds(state);
    const appointments = Array.isArray(sourceAppointments) ? sourceAppointments : (state.appointments || []);
    return appointments
      .filter(appointment => appointment?.id && !deletedIds.has(String(appointment.id)))
      .map(appointment => ({ ...appointment, _date: appointmentDate(appointment) }))
      .filter(appointment => appointment._date && appointment._date >= now && appointment._date < windowEnd)
      .sort((a, b) => a._date.getTime() - b._date.getTime());
  }

  function buildSegments(today = new Date()) {
    return Array.from({ length: MONTHS_AHEAD / MONTHS_PER_SEGMENT }, (_, index) => {
      const start = addMonths(today, index * MONTHS_PER_SEGMENT);
      const end = addMonths(today, (index + 1) * MONTHS_PER_SEGMENT);
      return { index, start, end };
    });
  }

  function rangeLabel(start, end) {
    return `${formatDate(start, { day: '2-digit', month: 'short' })} - ${formatDate(new Date(end.getTime() - 1), { day: '2-digit', month: 'short', year: 'numeric' })}`;
  }

  function segmentAppointments(appointments, segment) {
    return appointments.filter(appointment => appointment._date >= segment.start && appointment._date < segment.end);
  }

  function renderEvent(appointment, segment, index) {
    const start = segment.start.getTime();
    const range = Math.max(1, segment.end.getTime() - start);
    const left = Math.max(0, Math.min(100, ((appointment._date.getTime() - start) / range) * 100));
    const typeKey = normalizedType(appointment.appointment_type);
    const type = APPOINTMENT_TYPES[typeKey];
    const title = appointment.title || type.label || 'Termin';
    const displayTitle = shortTitle(title);
    const meta = `${formatDate(appointment._date, { day: '2-digit', month: 'short' })} · ${formatTime(appointment._date)}`;
    const placement = index % 2 === 0 ? 'is-top' : 'is-bottom';
    const birthdayClass = appointment.is_birthday ? ' is-birthday' : '';
    return `<span class="line-calendar-event ${placement}${birthdayClass}" style="--event-left:${left.toFixed(2)}%;--event-color:${type.color}" title="${escapeHtml(`${title} · ${meta}`)}">
      <span class="line-calendar-label"><strong>${escapeHtml(displayTitle)}</strong><small>${escapeHtml(meta)}</small></span>
    </span>`;
  }

  function renderSegment(segment, appointments) {
    const rows = segmentAppointments(appointments, segment);
    const progress = segment.index === 0 ? Math.min(100, Math.max(3, ((Date.now() - segment.start.getTime()) / Math.max(1, segment.end.getTime() - segment.start.getTime())) * 100)) : 0;
    return `<section class="line-calendar-segment">
      <div class="line-calendar-segment-head">
        <span>${escapeHtml(rangeLabel(segment.start, segment.end))}</span>
        <span>${rows.length} Termin${rows.length === 1 ? '' : 'e'}</span>
      </div>
      <div class="line-calendar-track-scroll">
        <div class="line-calendar-track">
          <span class="line-calendar-line"><i style="--segment-progress:${progress.toFixed(2)}%"></i></span>
          <span class="line-calendar-start" title="${escapeHtml(formatDate(segment.start, { day: '2-digit', month: 'long', year: 'numeric' }))}"></span>
          <span class="line-calendar-end" title="${escapeHtml(formatDate(segment.end, { day: '2-digit', month: 'long', year: 'numeric' }))}"></span>
          ${rows.map((appointment, index) => renderEvent(appointment, segment, index)).join('')}
        </div>
      </div>
    </section>`;
  }

  function renderModalBody(options = {}) {
    const today = new Date();
    const appointments = futureAppointments(options.appointments || null);
    const segments = buildSegments(today);
    const next = appointments[0] || null;
    const last = appointments[appointments.length - 1] || null;
    const body = options.isLoading
      ? '<div class="line-calendar-empty">Termine werden aktualisiert…</div>'
      : appointments.length
        ? segments.map(segment => renderSegment(segment, appointments)).join('')
        : '<div class="line-calendar-empty">In den kommenden 12 Monaten sind noch keine Termine eingetragen. Sobald du Termine im bestehenden Kalender speicherst, erscheinen sie automatisch auf dieser Linie.</div>';

    return `<section class="line-calendar-card" role="document">
      <div class="line-calendar-head">
        <div>
          <p class="eyebrow">Linienkalender</p>
          <h2>12 Monate voraus</h2>
          <p>Zwölf ruhige Linien, jeweils ein Monat ab heute. Deine bestehenden Kalendertermine werden automatisch als Meilensteine angezeigt.</p>
        </div>
        <button class="icon-btn line-calendar-close" type="button" data-line-calendar-close aria-label="Linienkalender schliessen">x</button>
      </div>
      <div class="line-calendar-summary" aria-label="Linienkalender Zusammenfassung">
        <article><small>Fenster</small><strong>${escapeHtml(formatDate(today, { day: '2-digit', month: 'long', year: 'numeric' }))}</strong></article>
        <article><small>Termine</small><strong>${options.isLoading ? '…' : appointments.length}</strong></article>
        <article><small>Nächster Termin</small><strong>${!options.isLoading && next ? escapeHtml(formatDate(next._date, { day: '2-digit', month: 'short' })) : '-'}</strong></article>
      </div>
      <div class="line-calendar-track-list">${body}</div>
      ${!options.isLoading && last ? `<p class="meta">Letzter sichtbarer Termin: ${escapeHtml(last.title || 'Termin')} am ${escapeHtml(formatDate(last._date, { day: '2-digit', month: 'long', year: 'numeric' }))}.</p>` : ''}
    </section>`;
  }

  async function openModal() {
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'lineCalendarModal';
      modal.className = 'line-calendar-modal hidden';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', 'Linienkalender');
      document.body.appendChild(modal);
    }
    modal.innerHTML = renderModalBody({ isLoading: true });
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => modal.querySelector('[data-line-calendar-close]')?.focus({ preventScroll: true }));
    try {
      const didRefresh = await refreshRemoteAppointments();
      if (modal && !modal.classList.contains('hidden')) {
        modal.innerHTML = renderModalBody({ appointments: didRefresh ? remoteAppointmentCache : null });
      }
      return;
    } catch (error) {
      console.warn('[HabitFlow/line-calendar] Termine konnten nicht aus Supabase aktualisiert werden.', error);
    }
    if (modal && !modal.classList.contains('hidden')) {
      modal.innerHTML = renderModalBody();
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.innerHTML = '';
    document.body.classList.remove('modal-open');
  }

  function syncButtonSize(button, addButton) {
    requestAnimationFrame(() => {
      const rect = addButton.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (!width || !height) return;
      button.style.width = `${width}px`;
      button.style.height = `${height}px`;
      button.style.flexBasis = `${width}px`;
    });
  }

  function watchButtonSize(button, addButton) {
    syncButtonSize(button, addButton);
    window.addEventListener('resize', () => syncButtonSize(button, addButton), { passive: true });
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(() => syncButtonSize(button, addButton));
      observer.observe(addButton);
    }
  }

  function ensureButton() {
    const addButton = document.getElementById('appointmentFormToggleBtn');
    if (!addButton || document.getElementById('lineCalendarToggleBtn')) return;
    const button = document.createElement('button');
    button.id = 'lineCalendarToggleBtn';
    button.className = 'line-calendar-btn';
    button.type = 'button';
    button.setAttribute('aria-label', 'Linienkalender oeffnen');
    button.setAttribute('title', 'Linienkalender');
    button.innerHTML = '<span aria-hidden="true"><i></i></span>';
    addButton.parentElement?.insertBefore(button, addButton);
    watchButtonSize(button, addButton);
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('#lineCalendarToggleBtn')) {
        openModal();
        return;
      }
      if (target.closest('[data-line-calendar-close]') || (target === modal && modal && !modal.classList.contains('hidden'))) {
        closeModal();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && modal && !modal.classList.contains('hidden')) closeModal();
    });
  }

  function init() {
    ensureButton();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window, document);
