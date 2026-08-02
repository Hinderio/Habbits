(() => {
  'use strict';

  if (window.__habitFlowTaskSwimlaneInstalled) return;
  window.__habitFlowTaskSwimlaneInstalled = true;

  const STATE_KEY = 'habitflow-state-v1';
  const DAY_MS = 86400000;
  const BACKLOG_STATUS = 'archived';
  const CLOSED_STATUSES = new Set(['done', 'completed', 'closed']);
  const CATEGORY_COLORS = ['#53c9c4', '#61cbf4', '#f6b33f', '#90d6c8', '#7ab7ef', '#d39bf4', '#ef8d9d', '#9ad277'];
  const PRIORITY_COLORS = { low: '#78dba1', medium: '#42c9c5', normal: '#42c9c5', high: '#f6b33f', urgent: '#ef6b73' };
  let ui = null;
  let renderTimer = null;

  const $ = selector => document.querySelector(selector);

  function escapeHtml(value = '') {
    return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function dayDate(value) {
    if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
    const text = String(value || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    const date = new Date(`${text}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return dayDate(next);
  }

  function startOfWeek(date) {
    const next = dayDate(date) || dayDate(new Date());
    next.setDate(next.getDate() - ((next.getDay() + 6) % 7));
    return next;
  }

  function formatDate(date, withYear = false) {
    return date.toLocaleDateString('de-CH', { day: '2-digit', month: 'short', year: withYear ? 'numeric' : undefined }).replace('.', '');
  }

  function normalizeColor(value, fallback = '#53c9c4') {
    const color = String(value || '').trim();
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : fallback;
  }

  function initials(value = '', fallback = 'TS') {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return fallback;
    return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0].slice(0, 2)).toUpperCase();
  }

  function taskInitials(value = '') {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 'TASK';
    const raw = words.length > 1 ? words.slice(0, 4).map(word => word[0]).join('') : words[0].replace(/[^a-z0-9]/gi, '').slice(0, 4);
    return (raw || 'TASK').toUpperCase();
  }

  function hashColor(value = '') {
    let hash = 0;
    for (const char of String(value)) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
  }

  function isBacklog(task) {
    return String(task?.status || '').toLowerCase() === BACKLOG_STATUS && !task?.done_archived_at;
  }

  function isVisibleTask(task) {
    if (!task?.id || !task.title || task.is_archived || task.done_archived_at) return false;
    return !CLOSED_STATUSES.has(String(task.status || 'open').toLowerCase());
  }

  function taskDate(task) {
    return dayDate(task?.due_at || task?.dueAt);
  }

  function defaultUi(weeks = 12) {
    const start = addDays(startOfWeek(new Date()), -7);
    return { start, end: addDays(start, weeks * 7 - 1), weeks };
  }

  function ensureUi() {
    if (!ui) ui = defaultUi();
    return ui;
  }

  function taskProjectId(task) {
    return String(task?.project_id || task?.projectId || '').trim();
  }

  function buildModel() {
    const state = readState();
    const tasks = (Array.isArray(state.tasks) ? state.tasks : []).filter(isVisibleTask);
    const projects = (Array.isArray(state.projects) ? state.projects : []).filter(project => project?.id && project.title && !project.is_archived);
    const projectMap = new Map(projects.map(project => [String(project.id), project]));
    const laneMap = new Map();

    function lane(id, type, title, color, entityId = '') {
      if (!laneMap.has(id)) laneMap.set(id, { id, type, title, color, entityId, tasks: [] });
      return laneMap.get(id);
    }

    tasks.forEach(task => {
      const projectId = taskProjectId(task);
      const project = projectMap.get(projectId);
      if (project) {
        lane(`project:${projectId}`, 'project', project.title, normalizeColor(project.color), projectId).tasks.push(task);
        return;
      }
      const category = String(task.category || '').trim();
      if (category) {
        lane(`category:${category.toLocaleLowerCase('de-CH')}`, 'category', category, hashColor(category)).tasks.push(task);
        return;
      }
      lane('neutral', 'neutral', 'Weder noch', '#7f8b9b').tasks.push(task);
    });

    const projectOrder = new Map(projects.map((project, index) => [String(project.id), index]));
    const lanes = [...laneMap.values()].sort((a, b) => {
      const rank = type => type === 'project' ? 0 : type === 'category' ? 1 : 2;
      const rankDiff = rank(a.type) - rank(b.type);
      if (rankDiff) return rankDiff;
      if (a.type === 'project') return (projectOrder.get(a.entityId) ?? 9999) - (projectOrder.get(b.entityId) ?? 9999);
      return a.title.localeCompare(b.title, 'de-CH');
    });
    return { state, tasks, projects, lanes };
  }

  function rangeDays() {
    const current = ensureUi();
    return Math.max(7, Math.round((current.end - current.start) / DAY_MS) + 1);
  }

  function inRange(date) {
    const current = ensureUi();
    return Boolean(date && date >= current.start && date <= current.end);
  }

  function leftForDate(date) {
    return Math.max(1.5, Math.min(98.5, (((date - ui.start) / DAY_MS) / Math.max(1, rangeDays() - 1)) * 100));
  }

  function taskLayout(tasks) {
    const sorted = tasks.map(task => ({ task, date: taskDate(task) })).filter(item => inRange(item.date)).sort((a, b) => a.date - b.date);
    const tracks = [];
    const canvasWidth = Math.max(920, Math.round(rangeDays() / 7) * 112);
    const minGap = (66 / canvasWidth) * 100;
    return sorted.map(item => {
      const left = leftForDate(item.date);
      let track = tracks.findIndex(last => left - last >= minGap);
      if (track < 0) track = tracks.length;
      tracks[track] = left;
      return { ...item, left, track };
    });
  }

  function priorityColor(priority) {
    return PRIORITY_COLORS[String(priority || 'medium').toLowerCase()] || PRIORITY_COLORS.medium;
  }

  function taskTile(item, lane) {
    const { task, left, track } = item;
    const effort = Math.max(1, Math.min(5, Number(task.effort || 3)));
    const backlog = isBacklog(task);
    const status = backlog ? 'Backlog' : String(task.status || 'open') === 'in_progress' ? 'In Bearbeitung' : 'Offen';
    const title = `${task.title} · ${status} · Aufwand ${effort}/5 · fällig ${formatDate(item.date, true)}`;
    return `<button class="task-swimlane-tile${backlog ? ' is-backlog' : ''}" type="button" data-action="open-task-detail" data-id="${escapeHtml(task.id)}" style="--task-left:${left.toFixed(3)}%;--task-track:${track};--lane-color:${escapeHtml(lane.color)};--priority-color:${priorityColor(task.priority)}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"><span class="task-swimlane-tile-top"><span>${effort}</span><i class="task-swimlane-priority"></i></span><b>${escapeHtml(taskInitials(task.title))}</b></button>`;
  }

  function countDots(lane, rangedTasks) {
    const active = rangedTasks.filter(task => !isBacklog(task)).length;
    const backlog = rangedTasks.filter(isBacklog).length;
    const maxDots = 8;
    const activeDots = Array.from({ length: Math.min(active, maxDots) }, () => '<i></i>').join('');
    const remaining = Math.max(0, maxDots - Math.min(active, maxDots));
    const backlogDots = Array.from({ length: Math.min(backlog, remaining) }, () => '<i class="is-backlog"></i>').join('');
    const hidden = Math.max(0, active + backlog - maxDots);
    return `${activeDots}${backlogDots}${hidden ? `<em>+${hidden}</em>` : ''}`;
  }

  function laneLabel(lane, rangedTasks) {
    const mark = escapeHtml(initials(lane.title, lane.type === 'neutral' ? '–' : 'KA'));
    const type = lane.type === 'project' ? 'Projekt' : lane.type === 'category' ? 'Kategorie' : 'Ohne Zuordnung';
    const markHtml = lane.type === 'project'
      ? `<button class="task-swimlane-lane-mark" type="button" data-action="open-project-detail" data-id="${escapeHtml(lane.entityId)}" title="Projekt öffnen">${mark}</button>`
      : `<span class="task-swimlane-lane-mark">${mark}</span>`;
    return `<div class="task-swimlane-row-label" style="--lane-color:${escapeHtml(lane.color)}">${markHtml}<div class="task-swimlane-lane-copy"><strong>${escapeHtml(lane.title)}</strong><small>${type}</small><span class="task-swimlane-dots" title="Gefüllt: aktiv · Rahmen: Backlog">${countDots(lane, rangedTasks)}</span></div></div>`;
  }

  function laneRow(lane) {
    const layout = taskLayout(lane.tasks);
    const rangedTasks = layout.map(item => item.task);
    const trackCount = Math.max(1, ...layout.map(item => item.track + 1));
    const height = Math.max(96, 28 + trackCount * 68);
    const today = dayDate(new Date());
    const todayLine = inRange(today) ? `<span class="task-swimlane-today" style="left:${leftForDate(today).toFixed(3)}%"></span>` : '';
    return `<div class="task-swimlane-row" style="--lane-color:${escapeHtml(lane.color)};min-height:${height}px">${laneLabel(lane, rangedTasks)}<div class="task-swimlane-track" style="min-height:${height}px">${todayLine}${layout.map(item => taskTile(item, lane)).join('')}</div></div>`;
  }

  function groupRows(lanes) {
    const groups = [
      ['project', 'Projekte'],
      ['category', 'Kategorien'],
      ['neutral', 'Weder Projekt noch Kategorie']
    ];
    return groups.map(([type, label]) => {
      const rows = lanes.filter(lane => lane.type === type);
      return rows.length ? `<div class="task-swimlane-group-label">${label}</div>${rows.map(laneRow).join('')}` : '';
    }).join('');
  }

  function buildAxis() {
    const days = rangeDays();
    const ticks = [];
    const months = [];
    for (let offset = 0; offset < days; offset += 7) {
      const date = addDays(ui.start, offset);
      const left = (offset / Math.max(1, days - 1)) * 100;
      ticks.push(`<span class="task-swimlane-tick" style="left:${left.toFixed(3)}%"><span>${formatDate(date)}</span></span>`);
      if (!months.some(item => item.key === `${date.getFullYear()}-${date.getMonth()}`)) months.push({ key: `${date.getFullYear()}-${date.getMonth()}`, date, left });
    }
    const today = dayDate(new Date());
    const todayLine = inRange(today) ? `<span class="task-swimlane-today" style="left:${leftForDate(today).toFixed(3)}%"><span>Heute</span></span>` : '';
    return `<div class="task-swimlane-axis"><div class="task-swimlane-axis-title">Swimlanes</div><div class="task-swimlane-axis-track">${months.map(item => `<span class="task-swimlane-month" style="left:${item.left.toFixed(3)}%">${item.date.toLocaleDateString('de-CH', { month: 'short', year: 'numeric' }).replace('.', '')}</span>`).join('')}${ticks.join('')}${todayLine}</div></div>`;
  }

  function volumeChart(tasks) {
    const bucketCount = Math.ceil(rangeDays() / 7);
    const buckets = Array.from({ length: bucketCount }, () => 0);
    tasks.forEach(task => {
      const date = taskDate(task);
      if (!inRange(date)) return;
      const bucket = Math.min(bucketCount - 1, Math.floor((date - ui.start) / DAY_MS / 7));
      buckets[bucket] += Math.max(1, Math.min(5, Number(task.effort || 3)));
    });
    const total = buckets.reduce((sum, value) => sum + value, 0);
    if (!total) return { total, peak: 0, html: '<div class="task-volume-empty">Keine fälligen Aufgaben im gewählten Zeitraum.</div>' };
    const max = Math.max(...buckets, 1);
    const points = buckets.map((value, index) => {
      const x = bucketCount === 1 ? 500 : (index / (bucketCount - 1)) * 1000;
      const y = 82 - (value / max) * 64;
      return { x, y, value };
    });
    const line = points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    const area = `M ${points[0].x.toFixed(1)} 86 L ${points.map(point => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' L ')} L ${points.at(-1).x.toFixed(1)} 86 Z`;
    const html = `<svg viewBox="0 0 1000 92" preserveAspectRatio="none" role="img" aria-label="Aufwandsvolumen pro Woche"><line class="task-volume-grid" x1="0" y1="86" x2="1000" y2="86"></line><line class="task-volume-grid" x1="0" y1="50" x2="1000" y2="50"></line><path class="task-volume-area" d="${area}"></path><polyline class="task-volume-line" points="${line}"></polyline>${points.map(point => `<circle class="task-volume-point" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4"><title>${point.value} Aufwand</title></circle>`).join('')}</svg>`;
    return { total, peak: max, html };
  }

  function unscheduled(lanes) {
    const items = [];
    lanes.forEach(lane => lane.tasks.filter(task => !taskDate(task)).forEach(task => items.push({ task, lane })));
    if (!items.length) return '';
    return `<section class="task-swimlane-unscheduled"><div class="task-swimlane-unscheduled-head"><div><p class="eyebrow">Noch einplanen</p><strong>Ohne Fälligkeitsdatum</strong></div><span class="subtle">${items.length} Task${items.length === 1 ? '' : 's'}</span></div><div class="task-swimlane-unscheduled-list">${items.map(({ task, lane }) => `<button type="button" data-action="open-task-detail" data-id="${escapeHtml(task.id)}" style="--lane-color:${escapeHtml(lane.color)}"><i></i>${escapeHtml(task.title)}${isBacklog(task) ? ' · Backlog' : ''}</button>`).join('')}</div></section>`;
  }

  function render() {
    const root = $('#taskSwimlaneView');
    if (!root) return;
    ensureUi();
    const model = buildModel();
    const dated = model.tasks.filter(task => inRange(taskDate(task)));
    const backlog = dated.filter(isBacklog).length;
    const volume = volumeChart(model.tasks);
    const before = model.tasks.filter(task => taskDate(task) && taskDate(task) < ui.start).length;
    const after = model.tasks.filter(task => taskDate(task) && taskDate(task) > ui.end).length;
    const currentWeeks = Math.round(rangeDays() / 7);
    const canvasWidth = Math.max(920, currentWeeks * 112);
    root.className = 'task-swimlane-view';
    root.innerHTML = `<header class="task-swimlane-head"><div><p class="eyebrow">Planung</p><h3>Task-Timeline</h3></div><div class="task-swimlane-summary"><span><i></i>${dated.length - backlog} aktiv</span><span class="is-outline"><i></i>${backlog} Backlog</span><span>${model.lanes.length} Swimlanes</span></div></header>
      <div class="task-swimlane-controls"><div class="task-swimlane-date-fields"><label>Von<input type="date" data-swimlane-date="start" value="${dateKey(ui.start)}"></label><label>Bis<input type="date" data-swimlane-date="end" value="${dateKey(ui.end)}"></label></div><div class="task-swimlane-presets" aria-label="Zeitraum"><button type="button" data-swimlane-weeks="4" class="${currentWeeks === 4 ? 'is-active' : ''}">4 Wo.</button><button type="button" data-swimlane-weeks="8" class="${currentWeeks === 8 ? 'is-active' : ''}">8 Wo.</button><button type="button" data-swimlane-weeks="12" class="${currentWeeks === 12 ? 'is-active' : ''}">12 Wo.</button><button type="button" data-swimlane-weeks="24" class="${currentWeeks === 24 ? 'is-active' : ''}">24 Wo.</button></div><div class="task-swimlane-nav"><button type="button" data-swimlane-shift="-1" aria-label="Früher">←</button><button type="button" data-swimlane-today class="is-primary">Heute</button><button type="button" data-swimlane-shift="1" aria-label="Später">→</button></div></div>
      <section class="task-swimlane-volume"><div class="task-swimlane-volume-copy"><p class="eyebrow">Volumen</p><strong>${volume.total} Aufwand</strong><span>Spitze ${volume.peak} pro Woche</span></div><div class="task-swimlane-volume-chart">${volume.html}</div></section>
      ${model.lanes.length ? `<div class="task-swimlane-scroll"><div class="task-swimlane-canvas" style="width:${canvasWidth}px">${buildAxis()}${groupRows(model.lanes)}</div></div>` : '<div class="task-swimlane-empty">Noch keine offenen Aufgaben für die Timeline vorhanden.</div>'}
      ${unscheduled(model.lanes)}${before || after ? `<div class="task-swimlane-range-note">Ausserhalb des Ausschnitts: ${before} früher · ${after} später. Über den Datenslicer kannst du sie direkt einblenden.</div>` : ''}`;
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      if (!$('#taskSwimlanePanel')?.classList.contains('hidden')) render();
    }, 120);
  }

  function setPanelOpen(open) {
    const panel = $('#taskSwimlanePanel');
    const button = $('#taskSwimlaneToggleBtn');
    if (!panel || !button) return;
    panel.classList.toggle('hidden', !open);
    panel.setAttribute('aria-hidden', String(!open));
    button.classList.toggle('is-active', open);
    button.setAttribute('aria-expanded', String(open));
    if (open) {
      render();
      requestAnimationFrame(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }

  function bind() {
    const button = $('#taskSwimlaneToggleBtn');
    const panel = $('#taskSwimlanePanel');
    const root = $('#taskSwimlaneView');
    if (!button || !panel || !root) return;
    button.addEventListener('click', () => setPanelOpen(panel.classList.contains('hidden')));
    root.addEventListener('click', event => {
      const weeks = event.target.closest('[data-swimlane-weeks]');
      if (weeks) {
        const count = Number(weeks.dataset.swimlaneWeeks) || 12;
        ui.end = addDays(ui.start, count * 7 - 1);
        render();
        return;
      }
      const shift = event.target.closest('[data-swimlane-shift]');
      if (shift) {
        const days = rangeDays();
        const direction = Number(shift.dataset.swimlaneShift) || 0;
        ui.start = addDays(ui.start, direction * days);
        ui.end = addDays(ui.end, direction * days);
        render();
        return;
      }
      if (event.target.closest('[data-swimlane-today]')) {
        const weeksCount = Math.max(4, Math.round(rangeDays() / 7));
        ui = defaultUi(weeksCount);
        render();
      }
    });
    root.addEventListener('change', event => {
      const input = event.target.closest('[data-swimlane-date]');
      if (!input) return;
      const date = dayDate(input.value);
      if (!date) return render();
      if (input.dataset.swimlaneDate === 'start') ui.start = date;
      else ui.end = date;
      if (ui.end < ui.start) {
        if (input.dataset.swimlaneDate === 'start') ui.end = addDays(ui.start, 27);
        else ui.start = addDays(ui.end, -27);
      }
      render();
    });
    window.addEventListener('storage', event => { if (event.key === STATE_KEY) scheduleRender(); });
    window.addEventListener('habitflow:project-task-link-updated', scheduleRender);
    const taskList = $('#tasksList');
    if (taskList) new MutationObserver(scheduleRender).observe(taskList, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
