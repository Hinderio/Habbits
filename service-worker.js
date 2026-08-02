const CACHE_NAME = 'habitflow-v235-fitness-columns';
const MODULE_ASSETS = [
  './modules/module-registry.js',
  './modules/points-domain.js',
  './modules/smoking-domain.js',
  './modules/alcohol-domain.js',
  './modules/domain-runtime.js',
  './modules/app-domain-facade.js',
  './modules/app-domain-facade-parity.js',
  './modules/smoking-scoring-parity.js',
  './modules/smoking-domain-persistence.js',
  './modules/alcohol-domain-parity.js',
  './modules/alcohol-domain-persistence.js',
  './modules/points-domain-parity.js',
  './modules/domain-diagnostics.js',
  './modules/state.js',
  './modules/sync.js',
  './modules/weekly-autosave.js',
  './modules/quick-capture-button-style.js',
  './modules/remote-cache-reconcile.js',
  './modules/dashboard.js',
  './modules/habit-defaults-extension.js',
  './modules/habits.js',
  './modules/tasks.js',
  './modules/task-swimlane-view.js',
  './modules/task-swimlane-view.css',
  './modules/fitness.js',
  './modules/consumption.js',
  './modules/smoking-tip-modal.js',
  './modules/smoking-top-cards-polish.js',
  './modules/consumption-time-profile.js',
  './modules/pause-period-edit.js',
  './modules/craving-coach-v2.js',
  './modules/craving-coach-v2-actions-polish.js',
  './modules/gamification.js',
  './modules/monthly-missions.js',
  './modules/line-calendar.js',
  './modules/line-calendar.css',
  './modules/projects-milestone-edit.js',
  './modules/projects.js',
  './modules/projects.css',
  './modules/projects-mobile-fix.css',
  './modules/project-task-form-bridge.js',
  './modules/project-idea-form-bridge.js',
  './modules/project-unlink-persistence-fix.js',
  './modules/projects-ui-polish.js',
  './modules/project-timeline-view.js'
];
const SQL_ASSETS = ['./sql/add-appointment-series.sql', './sql/add-projects.sql'];
const ASSETS = ['./', './index.html', './style.css', './app.js', './supabase-config.js', './supabase-schema.js', './manifest.json', './icons/coach-clean.svg', './data/activity-ideas.json', ...SQL_ASSETS, ...MODULE_ASSETS];
const NETWORK_FIRST_PATHS = new Set(['/', '/index.html', '/app.js', '/style.css', '/supabase-config.js', '/supabase-schema.js', '/manifest.json', ...SQL_ASSETS.map(path => path.replace(/^\./, '')), ...MODULE_ASSETS.map(path => path.replace(/^\./, ''))]);

function patchedHeaders(response) {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store');
  return headers;
}

function injectAppointmentRecurrenceField(html) {
  return html;
}

async function withProjectMilestoneEditScript(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  let html = await response.text();
  html = injectAppointmentRecurrenceField(html);
  if (!html.includes('modules/projects-milestone-edit.js')) {
    html = html.replace('<script src="app.js"></script>', '<script src="modules/projects-milestone-edit.js?v=183"></script>\n  <script src="app.js"></script>');
    if (!html.includes('modules/projects-milestone-edit.js')) {
      html = html.replace('</body>', '  <script src="modules/projects-milestone-edit.js?v=183"></script>\n</body>');
    }
  }
  if (!html.includes('modules/pause-period-edit.js')) {
    html = html.replace('<script src="app.js"></script>', '<script src="app.js"></script>\n  <script src="modules/pause-period-edit.js?v=204"></script>');
    if (!html.includes('modules/pause-period-edit.js')) {
      html = html.replace('</body>', '  <script src="modules/pause-period-edit.js?v=204"></script>\n</body>');
    }
  }
  if (!html.includes('modules/project-unlink-persistence-fix.js')) {
    html = html.replace('<script src="app.js"></script>', '<script src="app.js"></script>\n  <script src="modules/project-unlink-persistence-fix.js?v=218"></script>');
    if (!html.includes('modules/project-unlink-persistence-fix.js')) {
      html = html.replace('</body>', '  <script src="modules/project-unlink-persistence-fix.js?v=218"></script>\n</body>');
    }
  }
  if (!html.includes('modules/project-task-form-bridge.js')) {
    html = html.replace('<script src="app.js"></script>', '<script src="app.js"></script>\n  <script src="modules/project-task-form-bridge.js?v=226"></script>');
    if (!html.includes('modules/project-task-form-bridge.js')) {
      html = html.replace('</body>', '  <script src="modules/project-task-form-bridge.js?v=226"></script>\n</body>');
    }
  }
  if (!html.includes('modules/project-idea-form-bridge.js')) {
    html = html.replace('<script src="app.js"></script>', '<script src="app.js"></script>\n  <script src="modules/project-idea-form-bridge.js?v=227"></script>');
    if (!html.includes('modules/project-idea-form-bridge.js')) {
      html = html.replace('</body>', '  <script src="modules/project-idea-form-bridge.js?v=227"></script>\n</body>');
    }
  }
  if (!html.includes('modules/projects-ui-polish.js')) {
    html = html.replace('<script src="app.js"></script>', '<script src="app.js"></script>\n  <script src="modules/projects-ui-polish.js?v=221"></script>');
    if (!html.includes('modules/projects-ui-polish.js')) {
      html = html.replace('</body>', '  <script src="modules/projects-ui-polish.js?v=221"></script>\n</body>');
    }
  }
  if (!html.includes('modules/project-timeline-view.js')) {
    html = html.replace('<script src="app.js"></script>', '<script src="app.js"></script>\n  <script src="modules/project-timeline-view.js?v=227"></script>');
    if (!html.includes('modules/project-timeline-view.js')) {
      html = html.replace('</body>', '  <script src="modules/project-timeline-view.js?v=227"></script>\n</body>');
    }
  }
  return new Response(html, { status: response.status, statusText: response.statusText, headers: patchedHeaders(response) });
}

function nativeAppointmentPatch(script) {
  if (!script.includes('function createAppointment(event)')) return script;
  let next = script;
  if (!next.includes('function syncAppointmentBirthdayRecurrence()')) {
    next = next.replace(
      "if (els.appointmentForm?.elements?.starts_at) els.appointmentForm.elements.starts_at.addEventListener('change', syncAppointmentEndDefault);",
      "if (els.appointmentForm?.elements?.starts_at) els.appointmentForm.elements.starts_at.addEventListener('change', syncAppointmentEndDefault);\n    if (els.appointmentForm?.elements?.is_birthday) els.appointmentForm.elements.is_birthday.addEventListener('change', syncAppointmentBirthdayRecurrence);\n    if (els.appointmentForm?.elements?.recurrence) els.appointmentForm.elements.recurrence.addEventListener('change', syncAppointmentBirthdayRecurrence);"
    );
    next = next.replace(
      "if (!els.appointmentForm) return;\n    const data = new FormData(els.appointmentForm);",
      "if (!els.appointmentForm) return;\n    syncAppointmentBirthdayRecurrence();\n    const data = new FormData(els.appointmentForm);"
    );
    next = next.replace(
      "const recurrence = normalizeAppointmentRecurrence(data.get('recurrence'));",
      "const isBirthday = Boolean(data.get('is_birthday'));\n    const recurrence = isBirthday ? 'yearly' : normalizeAppointmentRecurrence(data.get('recurrence'));"
    );
    next = next.replace(
      "is_birthday: Boolean(data.get('is_birthday')),",
      "is_birthday: isBirthday,"
    );
    next = next.replace(
      "if (fields.is_birthday) fields.is_birthday.checked = Boolean(appointment.is_birthday);\n    els.appointmentFormTitle.textContent = 'Termin bearbeiten';",
      "if (fields.is_birthday) fields.is_birthday.checked = Boolean(appointment.is_birthday);\n    syncAppointmentBirthdayRecurrence();\n    els.appointmentFormTitle.textContent = 'Termin bearbeiten';"
    );
    next = next.replace(
      "\n  function moveMonth(delta) {",
      "\n  function syncAppointmentBirthdayRecurrence() {\n    const fields = els.appointmentForm?.elements;\n    if (!fields?.is_birthday?.checked || !fields?.recurrence) return;\n    fields.recurrence.value = 'yearly';\n  }\n\n  function moveMonth(delta) {"
    );
  }
  if (!next.includes('const visibleBirthdayAppointments = appointments.filter')) {
    next = next.replace(
      "const visibleAppointments = appointments.slice(0, 2);",
      "const visibleBirthdayAppointments = appointments.filter(appointment => Boolean(appointment?.is_birthday));\n    const visibleAppointments = visibleBirthdayAppointments.length > 1\n      ? appointments.filter((appointment, index) => index < 2 || Boolean(appointment?.is_birthday)).slice(0, 5)\n      : appointments.slice(0, 2);"
    );
  }
  if (!next.includes('const birthdayInitials = isBirthday')) {
    next = next.replace(
      ": 'Zeit offen';\n      return `<span class=\"day-chip appointment calendar-event-chip type-${normalizeAppointmentType(appointment.appointment_type)}${isBirthday ? ' is-birthday' : ''}\">",
      ": 'Zeit offen';\n      const birthdayInitials = isBirthday ? (() => {\n        const words = String(appointment.title || '').trim().split(/\\s+/).filter(Boolean);\n        const raw = words.length > 1 ? words.slice(0, 2).map(part => part[0] || '').join('') : (words[0] || 'GB').slice(0, 2);\n        return raw.toUpperCase() || 'GB';\n      })() : '';\n      return `<span class=\"day-chip appointment calendar-event-chip type-${normalizeAppointmentType(appointment.appointment_type)}${isBirthday ? ' is-birthday' : ''}\">"
    );
  }
  if (!next.includes('function calendarBubbleInitials(')) {
    next = next.replace(
      "\n  function renderCalendarAppointmentChips(appointments) {",
      "\n  function calendarBubbleInitials(value, fallback = 'HF') {\n    const words = String(value || '').trim().split(/\\s+/).filter(Boolean);\n    const raw = words.length > 1 ? words.slice(0, 2).map(part => part[0] || '').join('') : (words[0] || fallback).slice(0, 2);\n    return raw.toUpperCase() || fallback;\n  }\n\n  function renderCalendarAppointmentChips(appointments) {"
    );
  }
  if (!next.includes('const appointmentInitials = calendarBubbleInitials')) {
    next = next.replace(
      ": 'Zeit offen';\n      const birthdayInitials = isBirthday",
      ": 'Zeit offen';\n      const appointmentInitials = calendarBubbleInitials(appointment.title || type.label || 'Termin', isBirthday ? 'GB' : (type.short || type.label || 'TE'));\n      const birthdayInitials = isBirthday"
    );
  }
  next = next.replace(
    "return `<span class=\"day-chip appointment calendar-event-chip type-${normalizeAppointmentType(appointment.appointment_type)}${isBirthday ? ' is-birthday' : ''}\">",
    "return `<span class=\"day-chip appointment calendar-event-chip type-${normalizeAppointmentType(appointment.appointment_type)}${isBirthday ? ' is-birthday' : ''}\" data-initials=\"${escapeHtml(appointmentInitials)}\">"
  );
  next = next
    .replace(
      "<b>${escapeHtml(time)} · ${escapeHtml(isBirthday ? 'Geburtstag' : type.short || type.label)}</b>",
      "<b>${escapeHtml(isBirthday ? birthdayInitials : `${time} · ${type.short || type.label}`)}</b>"
    )
    .replace(
      "<b>${escapeHtml(isBirthday ? 'Geburtstag' : `${time} · ${type.short || type.label}`)}</b>",
      "<b>${escapeHtml(isBirthday ? birthdayInitials : `${time} · ${type.short || type.label}`)}</b>"
    );
  if (!next.includes('habitflow-birthday-initials-style')) {
    next += "\n;(() => {\n  const css = '.calendar-event-chip.is-birthday{display:inline-grid!important;place-items:center!important;width:44px!important;height:44px!important;min-width:44px!important;max-width:44px!important;padding:0!important;border-radius:50%!important;background:#f6b33f!important;border:0!important;box-shadow:none!important;color:#111827!important;justify-self:start!important}.calendar-event-chip.is-birthday b{font-size:.82rem!important;line-height:1!important;letter-spacing:.03em!important;text-transform:uppercase!important;color:#111827!important;font-weight:950!important}.calendar-event-chip.is-birthday em{display:none!important}.line-calendar-event.is-birthday{background:#f6b33f!important}@media(max-width:760px){.calendar-event-chip.is-birthday{width:34px!important;height:34px!important;min-width:34px!important;max-width:34px!important}.calendar-event-chip.is-birthday b{font-size:.68rem!important}}';\n  const inject = () => {\n    if (document.getElementById('habitflow-birthday-initials-style')) return;\n    const style = document.createElement('style');\n    style.id = 'habitflow-birthday-initials-style';\n    style.textContent = css;\n    document.head.appendChild(style);\n  };\n  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject, { once: true });\n  else inject();\n})();\n";
  }
  if (!next.includes('habitflow-birthday-bubble-flow-style')) {
    next += "\n;(() => {\n  const css = '.day-chips:has(.calendar-event-chip.is-birthday){display:flex!important;align-items:flex-start!important;flex-wrap:wrap!important;gap:6px!important}.day-chips:has(.calendar-event-chip.is-birthday) .calendar-event-chip:not(.is-birthday){flex:0 0 100%!important}.calendar-event-chip.is-birthday{flex:0 0 44px!important}.day-chips:has(.calendar-event-chip.is-birthday) .day-chip.appointment-more{align-self:center!important}@media(max-width:760px){.calendar-event-chip.is-birthday{flex-basis:34px!important}}';\n  const inject = () => {\n    if (document.getElementById('habitflow-birthday-bubble-flow-style')) return;\n    const style = document.createElement('style');\n    style.id = 'habitflow-birthday-bubble-flow-style';\n    style.textContent = css;\n    document.head.appendChild(style);\n  };\n  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject, { once: true });\n  else inject();\n})();\n";
  }
  if (!next.includes('data-initials="${escapeHtml(taskInitials)}"')) {
    next = next.replace(
      "const title = `${label}: ${task.title || 'Aufgabe'}`;\n      return `<span class=\"calendar-task-dot priority-${priority}\" title=\"${escapeHtml(title)}\" aria-label=\"${escapeHtml(title)}\"></span>`;",
      "const title = `${label}: ${task.title || 'Aufgabe'}`;\n      const taskInitials = calendarBubbleInitials(task.title || 'Aufgabe', 'AU');\n      return `<span class=\"calendar-task-dot priority-${priority}\" data-initials=\"${escapeHtml(taskInitials)}\" title=\"${escapeHtml(title)}\" aria-label=\"${escapeHtml(title)}\"></span>`;"
    );
  }
  if (!next.includes('habitflow-mobile-calendar-bubbles-style')) {
    next += "\n;(() => {\n  const css = '@media(max-width:760px) and (orientation:portrait){#screen-calendar .calendar-day-head{justify-content:flex-start!important;align-items:baseline!important;gap:3px!important}#screen-calendar .day-appointment-count{display:inline!important;min-width:0!important;height:auto!important;padding:0!important;border-radius:0!important;background:transparent!important;color:rgba(17,24,39,.48)!important;font-size:.5rem!important;font-style:normal!important;font-weight:900!important;line-height:1!important;transform:translateY(-.18em)!important}#screen-calendar .day-chips{display:flex!important;align-items:flex-start!important;align-content:flex-start!important;flex-wrap:wrap!important;gap:4px!important;min-height:0!important}#screen-calendar .day-chip.calendar-event-chip,#screen-calendar .calendar-task-dot{display:inline-grid!important;place-items:center!important;width:24px!important;height:24px!important;min-width:24px!important;max-width:24px!important;flex:0 0 24px!important;padding:0!important;border-radius:999px!important;background:#acdacf!important;border:1px solid rgba(17,36,58,.08)!important;box-shadow:none!important;color:#111827!important;overflow:hidden!important}#screen-calendar .day-chip.calendar-event-chip.is-birthday{background:#f6b33f!important;border-color:rgba(17,24,39,.08)!important}#screen-calendar .calendar-event-chip b,#screen-calendar .calendar-event-chip em{display:none!important}#screen-calendar .calendar-event-chip:before,#screen-calendar .calendar-task-dot:before{content:attr(data-initials);font-size:.54rem!important;line-height:1!important;letter-spacing:0!important;text-transform:uppercase!important;font-weight:950!important;color:#111827!important}#screen-calendar .calendar-task-dots{display:flex!important;align-items:flex-start!important;flex-wrap:wrap!important;gap:4px!important;min-height:0!important;margin-top:0!important;padding-top:0!important}#screen-calendar .calendar-task-dot-more,#screen-calendar .day-chip.appointment-more{height:16px!important;min-width:16px!important;padding:0 4px!important;border-radius:999px!important;background:rgba(17,24,39,.055)!important;color:rgba(17,24,39,.55)!important;font-size:.48rem!important;font-weight:950!important;line-height:16px!important}body:not(.light) #screen-calendar .day-appointment-count{color:rgba(255,255,255,.5)!important}body:not(.light) #screen-calendar .calendar-task-dot-more,body:not(.light) #screen-calendar .day-chip.appointment-more{background:rgba(255,255,255,.08)!important;color:rgba(255,255,255,.62)!important}}';\n  const inject = () => {\n    if (document.getElementById('habitflow-mobile-calendar-bubbles-style')) return;\n    const style = document.createElement('style');\n    style.id = 'habitflow-mobile-calendar-bubbles-style';\n    style.textContent = css;\n    document.head.appendChild(style);\n  };\n  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject, { once: true });\n  else inject();\n})();\n";
  }
  if (!next.includes('function readPendingProjectTaskContext()')) {
    next = next.replace(
      "\n  function closeTaskForm({ clearForm = false } = {}) {\n    if (clearForm || editingTaskId) resetTaskFormMode({ clearForm });",
      "\n  function closeTaskForm({ clearForm = false } = {}) {\n    if (clearForm && !editingTaskId) clearPendingProjectTaskContext();\n    if (clearForm || editingTaskId) resetTaskFormMode({ clearForm });"
    );
    next = next.replace(
      "\n  async function createTask(event) {",
      "\n  function readPendingProjectTaskContext() {\n    let raw = null;\n    try {\n      raw = sessionStorage.getItem('habitflow-task-project-context-v1');\n    } catch {\n      raw = null;\n    }\n    const context = raw ? (() => {\n      try { return JSON.parse(raw); } catch { return null; }\n    })() : window.__habitFlowTaskProjectContext;\n    if (!context?.project_id) return null;\n    if (context.created_at && Date.now() - Number(context.created_at) > 30 * 60 * 1000) {\n      clearPendingProjectTaskContext();\n      return null;\n    }\n    return { ...context, project_id: String(context.project_id) };\n  }\n\n  function clearPendingProjectTaskContext() {\n    try {\n      sessionStorage.removeItem('habitflow-task-project-context-v1');\n    } catch {}\n    if (window.__habitFlowTaskProjectContext) delete window.__habitFlowTaskProjectContext;\n  }\n\n  async function createTask(event) {"
    );
    next = next.replace(
      "const data = new FormData(els.taskForm);\n    const wantsMonthly",
      "const data = new FormData(els.taskForm);\n    const selectedProjectId = String(data.get('project_id') || '').trim();\n    const projectTaskContext = editingTaskId ? null : readPendingProjectTaskContext();\n    const normalizedProjectId = selectedProjectId || projectTaskContext?.project_id || null;\n    const wantsMonthly"
    );
    next = next.replace(
      "due_at: dueAt,\n      updated_at: nowIso(),",
      "due_at: dueAt,\n      project_id: normalizedProjectId,\n      projectId: normalizedProjectId,\n      project_link_cleared_at: normalizedProjectId ? null : nowIso(),\n      updated_at: nowIso(),"
    );
    next = next.replace(
      "points: 0,\n      recurrence: wantsMonthly ? buildMonthlyTaskRecurrence(values.due_at, { id: taskId }) : null,",
      "points: 0,\n      project_id: normalizedProjectId,\n      projectId: normalizedProjectId,\n      recurrence: wantsMonthly ? buildMonthlyTaskRecurrence(values.due_at, { id: taskId }) : null,"
    );
    next = next.replace(
      "saveState();\n    toast(wantsMonthly ? 'Aufgabe gespeichert · wird monatlich fortgeführt' : 'Aufgabe gespeichert');",
      "saveState();\n    if (projectTaskContext?.project_id) clearPendingProjectTaskContext();\n    toast(wantsMonthly ? 'Aufgabe gespeichert · wird monatlich fortgeführt' : 'Aufgabe gespeichert');"
    );
    next = next.replace(
      "points: Number(t.points || 0),\n        created_at: t.created_at,",
      "points: Number(t.points || 0),\n        project_id: t.project_id || null,\n        created_at: t.created_at,"
    );
    next = next.replace(
      "const mapRemoteTask = t => ({ id: t.id, title: t.title, description: t.description, effort: t.effort, priority: normalizeTaskPriority(t.priority), status: TASK_COLUMNS.some(column => column.status === t.status) ? t.status : 'open', due_at: t.due_at, completed_at: t.completed_at, points: t.points, backlog_rank: t.backlog_rank, done_archived_at: t.done_archived_at, done_archive_rank: t.done_archive_rank, created_at: t.created_at, updated_at: t.updated_at, synced: true });",
      "const mapRemoteTask = t => ({ id: t.id, title: t.title, description: t.description, effort: t.effort, priority: normalizeTaskPriority(t.priority), status: TASK_COLUMNS.some(column => column.status === t.status) ? t.status : 'open', due_at: t.due_at, completed_at: t.completed_at, points: t.points, project_id: t.project_id || null, backlog_rank: t.backlog_rank, done_archived_at: t.done_archived_at, done_archive_rank: t.done_archive_rank, created_at: t.created_at, updated_at: t.updated_at, synced: true });"
    );
  }
  return next;
}

function nativeTaskIdeaProjectPatch(script) {
  if (!script.includes('function createTaskIdea(event)') || script.includes('function taskIdeaProjectId(')) return script;
  let next = script;
  next = next.replace(
    "function taskIdeaDescriptionForStorage(idea = {}) {\n    const clean = taskIdeaDescriptionForDisplay(idea).trim();\n    const rating = normalizeTaskIdeaRating(idea.rating);\n    if (!rating) return clean || null;\n    const meta = { rating };\n    return `${clean ? `${clean}\\n\\n` : ''}<!--hf-idea-meta:${encodeURIComponent(JSON.stringify(meta))}-->`;\n  }",
    "function taskIdeaProjectId(idea = {}) {\n    const parsed = parseTaskIdeaMetaFromDescription(idea.description || '');\n    return String(idea.project_id || idea.projectId || parsed.meta.project_id || '').trim();\n  }\n\n  function taskIdeaDescriptionForStorage(idea = {}) {\n    const parsed = parseTaskIdeaMetaFromDescription(idea.description || '');\n    const clean = parsed.description.trim();\n    const rating = normalizeTaskIdeaRating(idea.rating ?? parsed.meta.rating);\n    const projectId = taskIdeaProjectId(idea);\n    const meta = {};\n    if (rating) meta.rating = rating;\n    if (projectId) meta.project_id = projectId;\n    if (!Object.keys(meta).length) return clean || null;\n    return `${clean ? `${clean}\\n\\n` : ''}<!--hf-idea-meta:${encodeURIComponent(JSON.stringify(meta))}-->`;\n  }"
  );
  next = next.replace(
    "rating,\n      category,",
    "rating,\n      project_id: idea.project_id || idea.projectId || parsedDescription.meta.project_id || null,\n      projectId: idea.project_id || idea.projectId || parsedDescription.meta.project_id || null,\n      category,"
  );
  next = next.replace(
    "const created = nowIso();\n    state.taskIdeas.push(normalizeTaskIdea({",
    "const created = nowIso();\n    const projectId = String(data.get('project_id') || '').trim() || null;\n    state.taskIdeas.push(normalizeTaskIdea({"
  );
  next = next.replace(
    "priority: normalizeTaskPriority(data.get('priority')),\n      idea_status: 'open',",
    "priority: normalizeTaskPriority(data.get('priority')),\n      project_id: projectId,\n      projectId: projectId,\n      idea_status: 'open',"
  );
  next = next.replace(
    "const nextStatus = targetStatus === TASK_BACKLOG_STATUS ? TASK_BACKLOG_STATUS : 'open';\n    const task = {",
    "const nextStatus = targetStatus === TASK_BACKLOG_STATUS ? TASK_BACKLOG_STATUS : 'open';\n    const ideaProjectId = taskIdeaProjectId(idea) || null;\n    const task = {"
  );
  next = next.replace(
    "status: nextStatus,\n      backlog_rank:",
    "status: nextStatus,\n      project_id: ideaProjectId,\n      projectId: ideaProjectId,\n      project_link_cleared_at: ideaProjectId ? null : undefined,\n      backlog_rank:"
  );
  next = next.replace(
    "if (!normalizeTaskIdeaRating(next.rating) && normalizeTaskIdeaRating(localIdea.rating)) next.rating = normalizeTaskIdeaRating(localIdea.rating);\n    return next;",
    "if (!normalizeTaskIdeaRating(next.rating) && normalizeTaskIdeaRating(localIdea.rating)) next.rating = normalizeTaskIdeaRating(localIdea.rating);\n    const localProjectId = taskIdeaProjectId(localIdea);\n    if (!taskIdeaProjectId(next) && localProjectId) {\n      next.project_id = localProjectId;\n      next.projectId = localProjectId;\n    }\n    return next;"
  );
  return next;
}

async function withNativeAppointmentSeries(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('javascript') && !type.includes('text/plain') && !response.url.includes('app.js')) return response;
  let script = await response.text();
  script = nativeAppointmentPatch(script);
  script = nativeTaskIdeaProjectPatch(script);
  return new Response(script, { status: response.status, statusText: response.statusText, headers: patchedHeaders(response) });
}

async function withInlineMilestoneEditing(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('javascript') && !type.includes('text/plain') && !response.url.includes('projects.js')) return response;
  let script = await response.text();
  const saveMilestone = `async function saveMilestone(event) {
    event.preventDefault();
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const data = new FormData(form);
    const projectId = form.dataset.projectId;
    const editingMilestoneId = form.dataset.editingMilestoneId || '';
    const title = String(data.get('title') || '').trim();
    const date = validDate(data.get('milestone_date'));
    const phaseId = String(data.get('phase_id') || '');
    if (!projectId) return toast('Projekt konnte fuer den Meilenstein nicht gefunden werden.');
    if (!title || !date) return toast('Meilenstein braucht Titel und Datum.');

    try {
      const now = nowIso();
      const state = readState();
      const existing = editingMilestoneId ? state.projectMilestones.find(item => item.id === editingMilestoneId) : null;
      const milestone = normalizeMilestone({ ...(existing || {}), id: existing?.id || uid('milestone'), project_id: projectId, phase_id: phaseId, title, milestone_date: date, created_at: existing?.created_at || now, updated_at: now, synced: true });
      const { supabase, userId } = await requireRemoteUser();
      const row = { id: milestone.id, user_id: userId, project_id: milestone.project_id, phase_id: milestone.phase_id || null, title: milestone.title, milestone_date: milestone.milestone_date, is_archived: false, created_at: milestone.created_at, updated_at: milestone.updated_at };
      const { error } = await supabase.from(TABLE_MILESTONES).upsert(row, { onConflict: 'id' });
      if (error) throw error;
      state.projectMilestones = existing ? state.projectMilestones.map(item => item.id === milestone.id ? milestone : item) : [milestone, ...state.projectMilestones.filter(item => item.id !== milestone.id)];
      writeState(state);
      delete form.dataset.editingMilestoneId;
      const button = form.querySelector('button[type="submit"]');
      if (button) button.textContent = 'Meilenstein speichern';
      form.reset();
      renderDetail(projectId);
      render();
      toast(existing ? 'Meilenstein aktualisiert' : 'Meilenstein gespeichert');
    } catch (error) {
      console.warn('[HabitFlow/projects] Meilenstein konnte nicht gespeichert werden.', error);
      toast(error.message || 'Meilenstein konnte nicht gespeichert werden.');
    }
  }`;
  const editMilestone = `async function editMilestone(id) {
    const state = readState();
    const milestone = state.projectMilestones.find(item => item.id === id);
    if (!milestone) return;
    const form = Array.from(document.querySelectorAll('[data-project-milestone-form]')).find(item => item.dataset.projectId === milestone.project_id);
    if (!form) return;
    form.dataset.editingMilestoneId = milestone.id;
    form.elements.title.value = milestone.title || '';
    form.elements.milestone_date.value = validDate(milestone.milestone_date) || todayDate();
    if (form.elements.phase_id) form.elements.phase_id.value = milestone.phase_id || '';
    const button = form.querySelector('button[type="submit"]');
    if (button) button.textContent = 'Meilenstein aktualisieren';
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    form.elements.title?.focus();
  }`;
  script = script
    .replace(/async function saveMilestone\(event\) \{[\s\S]*?\n  async function editMilestone/, `${saveMilestone}\n\n  async function editMilestone`)
    .replace(/async function editMilestone\(id\) \{[\s\S]*?\n  async function deleteMilestone/, `${editMilestone}\n\n  async function deleteMilestone`);
  script = script.replace(
    "incoming.tasks = incoming.tasks.map(task => projectByTask.has(task.id) && !task.project_id ? { ...task, project_id: projectByTask.get(task.id) } : task);",
    "incoming.tasks = incoming.tasks.map(task => projectByTask.has(task.id) && !task.project_id && !task.project_link_cleared_at ? { ...task, project_id: projectByTask.get(task.id) } : task);"
  );
  return new Response(script, { status: response.status, statusText: response.statusText, headers: patchedHeaders(response) });
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const normalizedPath = url.pathname.endsWith('/') ? '/' : url.pathname.replace(self.location.pathname.replace(/service-worker\.js$/, ''), '/');
  const shouldNetworkFirst = event.request.mode === 'navigate' || (isSameOrigin && NETWORK_FIRST_PATHS.has(normalizedPath));
  const shouldInjectProjectPatch = event.request.mode === 'navigate' || (isSameOrigin && (normalizedPath === '/' || normalizedPath === '/index.html'));
  const shouldPatchProjectsScript = isSameOrigin && normalizedPath === '/modules/projects.js';
  const shouldPatchAppScript = isSameOrigin && normalizedPath === '/app.js';

  if (shouldNetworkFirst) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(async response => {
          let clientResponse = shouldInjectProjectPatch ? await withProjectMilestoneEditScript(response.clone()) : response.clone();
          if (shouldPatchAppScript) clientResponse = await withNativeAppointmentSeries(clientResponse.clone());
          if (shouldPatchProjectsScript) clientResponse = await withInlineMilestoneEditing(clientResponse.clone());
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clientResponse.clone())).catch(() => {});
          return clientResponse;
        })
        .catch(() => caches.match(event.request).then(async cached => {
          if (!cached) return caches.match('./index.html').then(fallback => fallback && shouldInjectProjectPatch ? withProjectMilestoneEditScript(fallback.clone()) : fallback);
          let clientResponse = shouldInjectProjectPatch ? await withProjectMilestoneEditScript(cached.clone()) : cached;
          if (shouldPatchAppScript) clientResponse = await withNativeAppointmentSeries(clientResponse.clone());
          if (shouldPatchProjectsScript) clientResponse = await withInlineMilestoneEditing(clientResponse.clone());
          return clientResponse;
        }))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then(async cached => {
    let response = cached || await fetch(event.request);
    if (shouldPatchAppScript) response = await withNativeAppointmentSeries(response.clone());
    if (shouldPatchProjectsScript) response = await withInlineMilestoneEditing(response.clone());
    return response;
  }));
});
