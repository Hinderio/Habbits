  function renderCalendarContent() {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    els.calendarTitle.textContent = calendarCursor.toLocaleDateString('de-CH', { month: 'long', year: 'numeric' });

    const first = new Date(year, month, 1);
    const start = new Date(first);
    const day = first.getDay() || 7;
    start.setDate(first.getDate() - day + 1);

    const cells = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = toDateKey(date);
      const appointments = appointmentsOnDate(key);
      const tasks = calendarTasksOnDate(key);
      const chips = renderCalendarAppointmentChips(appointments);
      const taskDots = renderCalendarTaskDots(tasks);
      cells.push(`<button class="calendar-day ${date.getMonth() !== month ? 'is-muted' : ''} ${key === toDateKey(new Date()) ? 'is-today' : ''} ${key === selectedCalendarDate ? 'is-selected' : ''} ${appointments.length ? 'has-appointments' : ''} ${tasks.length ? 'has-task-dots' : ''}" type="button" data-action="select-day" data-day="${key}">
        <span class="calendar-day-head"><strong>${date.getDate()}</strong>${appointments.length ? `<em class="day-appointment-count">${appointments.length}</em>` : ''}</span>
        <span class="day-chips">${chips}</span>
        ${taskDots}
      </button>`);
    }
    els.calendarGrid.innerHTML = cells.join('');
  }

  function renderCalendarAppointmentChips(appointments) {
    const visibleBirthdayAppointments = appointments.filter(appointment => appointmentEventKind(appointment) === 'birthday');
    const visibleAppointments = visibleBirthdayAppointments.length > 1
      ? appointments.filter((appointment, index) => index < 2 || appointmentEventKind(appointment) === 'birthday').slice(0, 5)
      : appointments.slice(0, 2);
    const chips = visibleAppointments.map(appointment => {
      const type = appointmentTypeMeta(appointment.appointment_type);
      const eventKind = appointmentEventKind(appointment);
      if (eventKind !== 'standard') {
        const specialLabel = appointmentEventLabel(eventKind);
        const initials = appointmentInitials(appointment.title, eventKind === 'birthday' ? 'GB' : eventKind === 'holiday' ? 'FT' : eventKind === 'visit' ? 'EB' : 'FE');
        const accessibleLabel = `${appointment.title || specialLabel}, ${specialLabel}`;
        return `<span class="day-chip appointment calendar-event-chip is-special-event is-${eventKind}" data-initials="${escapeHtml(initials)}" title="${escapeHtml(accessibleLabel)}" aria-label="${escapeHtml(accessibleLabel)}"><strong>${escapeHtml(initials)}</strong></span>`;
      }
      const startsAt = appointment?.starts_at ? new Date(appointment.starts_at) : null;
      const time = startsAt && !Number.isNaN(startsAt.getTime())
        ? startsAt.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
        : 'Zeit offen';
      const calendarAppointmentInitials = calendarBubbleInitials(appointment.title || type.label || 'Termin', type.short || type.label || 'TE');
      return `<span class="day-chip appointment calendar-event-chip type-${normalizeAppointmentType(appointment.appointment_type)}" data-initials="${escapeHtml(calendarAppointmentInitials)}">
        <b>${escapeHtml(time)} · ${escapeHtml(type.short || type.label)}</b>
        <em>${escapeHtml(appointment.title || type.label || 'Termin')}</em>
      </span>`;
    });
    if (appointments.length > visibleAppointments.length) {
      chips.push(`<span class="day-chip appointment-more">+${appointments.length - visibleAppointments.length} weitere</span>`);
    }
    return chips.join('');
  }

  function formatAppointmentRange(appointment) {
    if (!appointment?.starts_at) return 'ohne Zeit';
    const startKey = toDateKey(appointment.starts_at);
    const endKey = toDateKey(appointment.ends_at || appointment.starts_at);
    if (appointment.ends_at && startKey !== endKey) return `${formatDateTime(appointment.starts_at)} – ${formatDateTime(appointment.ends_at)}`;
    if (appointment.ends_at) return `${formatTime(appointment.starts_at)}–${formatTime(appointment.ends_at)}`;
    return formatTime(appointment.starts_at);
  }

  function formatDateTime(value) {
    if (!value) return '–';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '–';
    return date.toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function formatTime(value) {
    if (!value) return '–';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '–';
    return date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
  }
