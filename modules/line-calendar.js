(function initHabitFlowLineCalendar(window, document) {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const MONTHS_AHEAD = 12;
  const MONTHS_PER_SEGMENT = 2;
  const APPOINTMENT_TYPES = {
    personal: { label: 'Privat', color: '#4ad7d1' },
    work: { label: 'Arbeit', color: '#66e7ff' },
    health: { label: 'Gesundheit', color: '#8ff0a7' },
    social: { label: 'Sozial', color: '#ffb84d' },
    admin: { label: 'Admin', color: '#b79cff' },
    other: { label: 'Sonstiges', color: '#9db0c3' }
  };

  let modal = null;

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

  function futureAppointments() {
    const now = new Date();
    const windowEnd = addMonths(now, MONTHS_AHEAD);
    return (readState().appointments || [])
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
    const meta = `${formatDate(appointment._date, { day: '2-digit', month: 'short' })} · ${formatTime(appointment._date)}`;
    const placement = index % 2 === 0 ? 'is-top' : 'is-bottom';
    return `<span class="line-calendar-event ${placement}" style="--event-left:${left.toFixed(2)}%;--event-color:${type.color}" title="${escapeHtml(`${title} · ${meta}`)}">
      <span class="line-calendar-label"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(meta)}</small></span>
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

  function renderModalBody() {
    const today = new Date();
    const appointments = futureAppointments();
    const segments = buildSegments(today);
    const next = appointments[0] || null;
    const last = appointments[appointments.length - 1] || null;
    const body = appointments.length
      ? segments.map(segment => renderSegment(segment, appointments)).join('')
      : '<div class="line-calendar-empty">In den kommenden 12 Monaten sind noch keine Termine eingetragen. Sobald du Termine im bestehenden Kalender speicherst, erscheinen sie automatisch auf dieser Linie.</div>';

    return `<section class="line-calendar-card" role="document">
      <div class="line-calendar-head">
        <div>
          <p class="eyebrow">Linienkalender</p>
          <h2>12 Monate voraus</h2>
          <p>Sechs ruhige Linien, jeweils zwei Monate ab heute. Deine bestehenden Kalendertermine werden automatisch als Meilensteine angezeigt.</p>
        </div>
        <button class="icon-btn line-calendar-close" type="button" data-line-calendar-close aria-label="Linienkalender schliessen">x</button>
      </div>
      <div class="line-calendar-summary" aria-label="Linienkalender Zusammenfassung">
        <article><small>Fenster</small><strong>${escapeHtml(formatDate(today, { day: '2-digit', month: 'long', year: 'numeric' }))}</strong></article>
        <article><small>Termine</small><strong>${appointments.length}</strong></article>
        <article><small>Naechster Termin</small><strong>${next ? escapeHtml(formatDate(next._date, { day: '2-digit', month: 'short' })) : '-'}</strong></article>
      </div>
      <div class="line-calendar-track-list">${body}</div>
      ${last ? `<p class="meta">Letzter sichtbarer Termin: ${escapeHtml(last.title || 'Termin')} am ${escapeHtml(formatDate(last._date, { day: '2-digit', month: 'long', year: 'numeric' }))}.</p>` : ''}
    </section>`;
  }

  function openModal() {
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'lineCalendarModal';
      modal.className = 'line-calendar-modal hidden';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', 'Linienkalender');
      document.body.appendChild(modal);
    }
    modal.innerHTML = renderModalBody();
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => modal.querySelector('[data-line-calendar-close]')?.focus({ preventScroll: true }));
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.innerHTML = '';
    document.body.classList.remove('modal-open');
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
