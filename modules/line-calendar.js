(function initHabitFlowLineCalendar(window, document) {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const MONTHS_AHEAD = 12;
  const MONTHS_PER_SEGMENT = 1;
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
  let layoutObserver = null;
  let layoutFrame = 0;
  let layoutSizes = new WeakMap();
  let windowAnchor = new Date();
  let monthOffset = 0;
  let windowAppointments = [];
  let appointmentsLoading = false;
  let openGeneration = 0;

  // Interval partitioning with an earliest-ending-lane heap: O(n log n).
  // Fixed label boxes avoid measuring every title or repeated layout reads.
  function layoutLabels(anchors, width, fontSize = 16) {
    const labelWidth = Math.min(10 * fontSize, width);
    const gap = .75 * fontSize;
    const labelHeight = 2.8 * fontSize;
    const rowHeight = 3.75 * fontSize;
    const axisGap = 1.5 * fontSize;
    const heap = [{ lane: 0, end: -Infinity }, { lane: 1, end: -Infinity }];
    let laneCount = 2;
    const labels = anchors.map((anchor, index) => {
      const x = Math.max(0, Math.min(width, anchor * width / 100));
      return { index, anchor: x, left: Math.max(0, Math.min(width - labelWidth, x - labelWidth / 2)) };
    }).sort((a, b) => a.left - b.left || a.index - b.index);
    const before = (a, b) => a.end < b.end || (a.end === b.end && a.lane < b.lane);
    for (const label of labels) {
      let entry;
      if (heap[0].end <= label.left) {
        entry = heap[0];
        entry.end = label.left + labelWidth + gap;
        let i = 0;
        while (i * 2 + 1 < heap.length) {
          let child = i * 2 + 1;
          if (child + 1 < heap.length && before(heap[child + 1], heap[child])) child++;
          if (!before(heap[child], heap[i])) break;
          [heap[i], heap[child]] = [heap[child], heap[i]];
          i = child;
        }
      } else {
        entry = { lane: laneCount++, end: label.left + labelWidth + gap };
        heap.push(entry);
        let i = heap.length - 1;
        while (i > 0) {
          const parent = Math.floor((i - 1) / 2);
          if (!before(heap[i], heap[parent])) break;
          [heap[i], heap[parent]] = [heap[parent], heap[i]];
          i = parent;
        }
      }
      label.lane = entry.lane;
    }
    const axis = Math.ceil(laneCount / 2) * rowHeight + axisGap;
    const height = axis + Math.floor(laneCount / 2) * rowHeight + axisGap;
    labels.forEach(label => {
      const top = label.lane % 2 === 0;
      const offset = axisGap + Math.floor(label.lane / 2) * rowHeight;
      label.top = top ? axis - offset - labelHeight : axis + offset;
      label.edge = top ? label.top + labelHeight : label.top;
      label.center = label.left + labelWidth / 2;
    });
    return { labels, axis, height, labelWidth, labelHeight };
  }

  function layoutTracks() {
    layoutFrame = 0;
    if (!modal || modal.classList.contains('hidden')) return;
    const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    // Batch all geometry reads before any DOM writes.
    const tracks = Array.from(modal.querySelectorAll('.line-calendar-track')).map(track => ({
      track, width: track.clientWidth,
      labels: Array.from(track.querySelectorAll('.line-calendar-label'))
    }));
    for (const { track, width, labels } of tracks) {
      if (!width) continue;
      const previous = layoutSizes.get(track);
      if (previous?.width === width && previous?.fontSize === fontSize) continue;
      layoutSizes.set(track, { width, fontSize });
      const layout = layoutLabels(labels.map(label => Number(label.dataset.anchor)), width, fontSize);
      track.style.setProperty('--track-axis', `${layout.axis}px`);
      track.style.height = `${layout.height}px`;
      track.style.setProperty('--label-width', `${layout.labelWidth}px`);
      track.style.setProperty('--label-height', `${layout.labelHeight}px`);
      const paths = [];
      layout.labels.forEach(position => {
        const label = labels[position.index];
        label.style.left = `${position.left}px`;
        label.style.top = `${position.top}px`;
        paths.push(`<path d="M${position.anchor},${layout.axis} L${position.center},${position.edge}"/>`);
      });
      track.querySelector('.line-calendar-leaders').innerHTML = paths.join('');
      track.classList.add('is-laid-out');
    }
  }

  function scheduleLayout() {
    if (!layoutFrame) layoutFrame = requestAnimationFrame(layoutTracks);
  }

  function stopLayout() {
    layoutObserver?.disconnect();
    layoutObserver = null;
    if (layoutFrame) cancelAnimationFrame(layoutFrame);
    layoutFrame = 0;
    window.removeEventListener('resize', scheduleLayout);
    layoutSizes = new WeakMap();
  }

  function watchLayout() {
    stopLayout();
    if ('ResizeObserver' in window) {
      layoutObserver = new ResizeObserver(scheduleLayout);
      modal.querySelectorAll('.line-calendar-track').forEach(track => layoutObserver.observe(track));
    }
    window.addEventListener('resize', scheduleLayout, { passive: true });
    scheduleLayout();
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
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

  function appointmentEndDate(appointment) {
    return toDate(appointment?.ends_at || appointment?.starts_at || appointment?.created_at);
  }

  function dayStamp(value) {
    const date = toDate(value);
    if (!date) return 0;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  function eventEnd(appointment) {
    const start = appointment._date || appointmentDate(appointment);
    const end = appointment._endDate || appointmentEndDate(appointment);
    if (!start) return end;
    if (!end || end.getTime() < start.getTime()) return start;
    return end;
  }

  function isMultiDayAppointment(appointment) {
    return dayStamp(eventEnd(appointment)) > dayStamp(appointment._date || appointmentDate(appointment));
  }

  // Normalize and sort once per opening; paging only filters this snapshot.
  function prepareAppointments(sourceAppointments = null) {
    const state = readState();
    const deletedIds = deletedAppointmentIds(state);
    const appointments = Array.isArray(sourceAppointments) ? sourceAppointments : (state.appointments || []);
    return appointments
      .filter(appointment => appointment?.id && !appointment.is_birthday && !deletedIds.has(String(appointment.id)))
      .map(appointment => ({ ...appointment, _date: appointmentDate(appointment), _endDate: appointmentEndDate(appointment) }))
      .filter(appointment => appointment._date)
      .sort((a, b) => a._date.getTime() - b._date.getTime());
  }

  function buildSegments(anchor = new Date(), offset = 0) {
    return Array.from({ length: MONTHS_AHEAD / MONTHS_PER_SEGMENT }, (_, index) => {
      // Always derive from the original date, avoiding leap-day/month-end drift.
      const start = addMonths(anchor, offset + index * MONTHS_PER_SEGMENT);
      const end = addMonths(anchor, offset + (index + 1) * MONTHS_PER_SEGMENT);
      return { index, start, end };
    });
  }

  function rangeLabel(start, end) {
    return `${formatDate(start, { day: '2-digit', month: 'short' })} - ${formatDate(new Date(end.getTime() - 1), { day: '2-digit', month: 'short', year: 'numeric' })}`;
  }

  function segmentAppointments(appointments, segment) {
    return appointments.filter(appointment => {
      if (!isMultiDayAppointment(appointment)) {
        return appointment._date >= segment.start && appointment._date < segment.end;
      }
      return appointment._date < segment.end && eventEnd(appointment) > segment.start;
    });
  }

  function renderEvent(appointment, segment) {
    const segmentStart = segment.start.getTime();
    const segmentEnd = segment.end.getTime();
    const range = Math.max(1, segmentEnd - segmentStart);
    const isRange = isMultiDayAppointment(appointment);
    const startsInSegment = appointment._date.getTime() >= segmentStart;
    const endDate = eventEnd(appointment);
    const eventStart = Math.max(segmentStart, appointment._date.getTime());
    const eventEndTime = Math.min(segmentEnd, endDate.getTime());
    const left = Math.max(0, Math.min(100, ((eventStart - segmentStart) / range) * 100));
    const right = Math.max(left, Math.min(100, ((eventEndTime - segmentStart) / range) * 100));
    const width = Math.min(100 - left, Math.max(2.4, right - left));
    const typeKey = normalizedType(appointment.appointment_type);
    const type = APPOINTMENT_TYPES[typeKey];
    const title = appointment.title || type.label || 'Termin';
    const dateLabel = formatDate(appointment._date, { day: '2-digit', month: 'short' });
    const timeLabel = formatTime(appointment._date);
    const endLabel = formatDate(endDate, { day: '2-digit', month: 'short' });
    const meta = `${dateLabel} · ${timeLabel}`;
    const titleMeta = isRange ? `${meta} - ${endLabel}` : meta;
    const rangeClass = isRange ? ' is-range' : '';
    const continuedClass = isRange && !startsInSegment ? ' is-continued' : '';
    const openEndedClass = isRange && endDate.getTime() > segmentEnd ? ' is-open-ended' : '';
    const style = isRange
      ? `--event-left:${left.toFixed(2)}%;--event-width:${width.toFixed(2)}%;--event-color:${type.color}`
      : `--event-left:${left.toFixed(2)}%;--event-color:${type.color}`;
    const anchor = isRange ? left + width / 2 : left;
    const accessibleLabel = escapeHtml(`${title} · ${titleMeta}`);
    return `<span class="line-calendar-event${rangeClass}${continuedClass}${openEndedClass}" style="${style}" title="${accessibleLabel}" aria-hidden="true"></span>
      <span class="line-calendar-label" data-anchor="${anchor.toFixed(4)}" tabindex="0" title="${accessibleLabel}" aria-label="${accessibleLabel}"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(meta)}</small></span>`;
  }

  function renderSegment(segment, appointments) {
    const rows = segmentAppointments(appointments, segment);
    const progress = Math.min(100, Math.max(0, ((Date.now() - segment.start.getTime()) / Math.max(1, segment.end.getTime() - segment.start.getTime())) * 100));
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
          <svg class="line-calendar-leaders" aria-hidden="true" focusable="false"></svg>
          ${rows.map(appointment => renderEvent(appointment, segment)).join('')}
        </div>
      </div>
    </section>`;
  }

  function renderModalBody(options = {}) {
    const segments = buildSegments(windowAnchor, monthOffset);
    const windowStart = segments[0].start;
    const windowEnd = segments[segments.length - 1].end;
    const appointments = segmentAppointments(windowAppointments, { start: windowStart, end: windowEnd });
    const isHistory = monthOffset < 0;
    const disabled = options.isLoading ? ' disabled' : '';
    const periodLabel = `${formatDate(windowStart, { day: '2-digit', month: 'short', year: 'numeric' })} – ${formatDate(windowEnd, { day: '2-digit', month: 'short', year: 'numeric' })}`;
    const next = appointments[0] || null;
    const last = appointments[appointments.length - 1] || null;
    const body = options.isLoading
      ? '<div class="line-calendar-empty">Termine werden aktualisiert…</div>'
      : appointments.length
        ? segments.map(segment => renderSegment(segment, appointments)).join('')
        : '<div class="line-calendar-empty">In diesem Zeitraum sind keine Termine eingetragen. Sobald du Termine im bestehenden Kalender speicherst, erscheinen sie automatisch auf dieser Linie.</div>';

    return `<section class="line-calendar-card" role="document">
      <div class="line-calendar-head">
        <div>
          <p class="eyebrow">Linienkalender</p>
          <h2>${isHistory ? '12 Monate Rückblick' : '12 Monate voraus'}</h2>
          <p>Zwölf ruhige Linien, jeweils ein Monat ${isHistory ? 'im gewählten Zeitraum' : 'ab heute'}. Deine bestehenden Kalendertermine werden automatisch als Meilensteine angezeigt.</p>
        </div>
        <button class="icon-btn line-calendar-close" type="button" data-line-calendar-close aria-label="Linienkalender schliessen">x</button>
      </div>
      <nav class="line-calendar-navigation" aria-label="Zeitraum wählen">
        <button type="button" data-line-calendar-page="-12" aria-label="12 Monate zurück" title="12 Monate zurück"${disabled}>‹</button>
        <span class="line-calendar-period" role="status" aria-live="polite">${escapeHtml(periodLabel)}</span>
        <button type="button" data-line-calendar-page="12" aria-label="12 Monate vor" title="12 Monate vor"${options.isLoading || !isHistory ? ' disabled' : ''}>›</button>
        ${isHistory ? `<button type="button" class="line-calendar-today" data-line-calendar-page="today"${disabled}>Heute</button>` : ''}
      </nav>
      <div class="line-calendar-summary" aria-label="Linienkalender Zusammenfassung">
        <article><small>Fenster</small><strong>${escapeHtml(formatDate(windowStart, { day: '2-digit', month: 'long', year: 'numeric' }))}</strong></article>
        <article><small>Termine</small><strong>${options.isLoading ? '…' : appointments.length}</strong></article>
        <article><small>${isHistory ? 'Erster Termin' : 'Nächster Termin'}</small><strong>${!options.isLoading && next ? escapeHtml(formatDate(next._date, { day: '2-digit', month: 'short' })) : '-'}</strong></article>
      </div>
      <div class="line-calendar-track-list">${body}</div>
      ${!options.isLoading && last ? `<p class="meta">Letzter sichtbarer Termin: ${escapeHtml(last.title || 'Termin')} am ${escapeHtml(formatDate(last._date, { day: '2-digit', month: 'long', year: 'numeric' }))}.</p>` : ''}
    </section>`;
  }

  function showWindow(focusPage = null) {
    stopLayout();
    modal.innerHTML = renderModalBody();
    watchLayout();
    const selector = focusPage === null ? '[data-line-calendar-close]'
      : `[data-line-calendar-page="${focusPage}"]:not(:disabled)`;
    const focusTarget = modal.querySelector(selector) || modal.querySelector('[data-line-calendar-page="-12"]');
    focusTarget?.focus({ preventScroll: true });
  }

  function changeWindow(page) {
    if (appointmentsLoading || !modal || modal.classList.contains('hidden')) return;
    if (!['-12', '12', 'today'].includes(page)) return;
    const nextOffset = page === 'today' ? 0 : Math.min(0, monthOffset + Number(page));
    if (nextOffset === monthOffset || !Number.isFinite(addMonths(windowAnchor, nextOffset).getTime())) return;
    monthOffset = nextOffset;
    showWindow(page);
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
    const generation = ++openGeneration;
    windowAnchor = new Date();
    monthOffset = 0;
    windowAppointments = [];
    appointmentsLoading = true;
    stopLayout();
    modal.innerHTML = renderModalBody({ isLoading: true });
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    modal.querySelector('[data-line-calendar-close]')?.focus({ preventScroll: true });
    let sourceAppointments = null;
    try {
      const didRefresh = await refreshRemoteAppointments();
      if (didRefresh) sourceAppointments = remoteAppointmentCache;
    } catch (error) {
      console.warn('[HabitFlow/line-calendar] Termine konnten nicht aus Supabase aktualisiert werden.', error);
    }
    if (generation !== openGeneration || !modal || modal.classList.contains('hidden')) return;
    windowAppointments = prepareAppointments(sourceAppointments);
    appointmentsLoading = false;
    showWindow();
  }

  function closeModal() {
    if (!modal) return;
    openGeneration++;
    appointmentsLoading = false;
    windowAppointments = [];
    stopLayout();
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
    button.setAttribute('aria-label', 'Linienkalender öffnen');
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
      const pageButton = target.closest('[data-line-calendar-page]');
      if (pageButton && !pageButton.disabled && modal?.contains(pageButton)) {
        changeWindow(pageButton.dataset.lineCalendarPage);
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
