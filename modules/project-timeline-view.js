(() => {
  'use strict';

  if (window.__habitFlowProjectTimelineViewInstalled) return;
  window.__habitFlowProjectTimelineViewInstalled = true;

  const STATE_KEY = 'habitflow-state-v1';
  const DAY_MS = 86400000;
  const TILE_SIZE = 52;
  const MONTH_WIDTH = 150;
  const MAX_MONTHS = 12;
  const CLOSED_STATUSES = new Set(['archived', 'closed']);
  const IDEA_META_RE = /\n?\s*<!--hf-idea-meta:([^>]+)-->/;
  let renderTimer = null;

  const STATUS_LABELS = {
    planned: 'Geplant',
    active: 'Aktiv',
    paused: 'Pausiert',
    done: 'Abgeschlossen',
    open: 'Offen',
    in_progress: 'In Bearbeitung',
    inprogress: 'In Bearbeitung',
    completed: 'Erledigt',
    archived: 'Archiviert'
  };

  const PRIORITY_LABELS = {
    low: 'Niedrig',
    medium: 'Mittel',
    normal: 'Mittel',
    high: 'Hoch',
    urgent: 'Dringend',
    idea: 'Idee'
  };

  function escapeHtml(value = '') {
    return String(value || '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[char]));
  }

  function readState() {
    try {
      const parsed = JSON.parse(window.localStorage?.getItem(STATE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function validDate(value) {
    const text = String(value || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
    const date = new Date(`${text}T12:00:00`);
    return Number.isNaN(date.getTime()) ? '' : text;
  }

  function dateFrom(value) {
    const dateText = validDate(value);
    if (!dateText) return null;
    const date = new Date(`${dateText}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function addMonths(date, count) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + count);
    return next;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
  }

  function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function dateLabel(value, options = {}) {
    const date = value instanceof Date ? value : dateFrom(value);
    if (!date) return '-';
    return date.toLocaleDateString('de-CH', {
      day: options.monthOnly ? undefined : '2-digit',
      month: 'short',
      year: options.withYear ? 'numeric' : undefined
    }).replace('.', '');
  }

  function normalizeColor(value) {
    const color = String(value || '').trim();
    return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(color) ? color : '#4ad7d1';
  }

  function projectInitials(title = '') {
    const words = String(title || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 'PR';
    const raw = words.length > 1 ? words.slice(0, 2).map(word => word[0] || '').join('') : words[0].slice(0, 2);
    return raw.toUpperCase() || 'PR';
  }

  function tileInitials(title = '') {
    const words = String(title || '').trim().split(/\s+/).filter(Boolean);
    let raw = '';
    if (words.length >= 4) raw = words.slice(0, 4).map(word => word[0] || '').join('');
    else if (words.length > 1) raw = words.map(word => word[0] || '').join('');
    else raw = (words[0] || 'TASK').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4);
    return (raw || 'TASK').slice(0, 4).toUpperCase();
  }

  function normalizePriority(value) {
    const key = String(value || 'medium').trim().toLowerCase();
    if (key === 'kritisch') return 'urgent';
    if (key === 'hoch') return 'high';
    if (key === 'niedrig') return 'low';
    if (key === 'normal') return 'medium';
    return PRIORITY_LABELS[key] ? key : 'medium';
  }

  function storyPoints(item = {}) {
    const explicit = Number(item.story_points || item.storyPoints || item.sp);
    if ([1, 2, 3, 5, 8].includes(explicit)) return explicit;
    const effort = Math.max(1, Math.min(5, Number(item.effort || 3)));
    return [1, 2, 3, 5, 8][effort - 1] || 3;
  }

  function activeProjects(state) {
    return (Array.isArray(state.projects) ? state.projects : [])
      .filter(project => project?.id && project.title && !project.is_archived)
      .sort((a, b) => {
        const statusA = a.status === 'active' ? 0 : a.status === 'planned' ? 1 : a.status === 'paused' ? 2 : 3;
        const statusB = b.status === 'active' ? 0 : b.status === 'planned' ? 1 : b.status === 'paused' ? 2 : 3;
        return statusA - statusB || String(a.start_date || '').localeCompare(String(b.start_date || '')) || String(a.title || '').localeCompare(String(b.title || ''), 'de');
      });
  }

  function projectTasks(state, projectId) {
    return (Array.isArray(state.tasks) ? state.tasks : [])
      .filter(task => String(task?.project_id || task?.projectId || '') === String(projectId || ''))
      .filter(task => !task.is_archived && !task.done_archived_at && !CLOSED_STATUSES.has(String(task.status || '').toLowerCase()))
      .sort((a, b) => {
        const dateA = Date.parse(a.due_at || a.updated_at || a.created_at || '') || Number.MAX_SAFE_INTEGER;
        const dateB = Date.parse(b.due_at || b.updated_at || b.created_at || '') || Number.MAX_SAFE_INTEGER;
        return dateA - dateB || String(a.title || '').localeCompare(String(b.title || ''), 'de');
      });
  }

  function projectIdeas(state, projectId, taskMap) {
    return (Array.isArray(state.taskIdeas) ? state.taskIdeas : [])
      .filter(idea => String(idea.idea_status || 'open') === 'open')
      .filter(idea => {
        const direct = String(idea.project_id || idea.projectId || parseIdeaMeta(idea.description).project_id || '');
        if (direct) return direct === String(projectId);
        const generated = idea.generated_task_id ? taskMap.get(String(idea.generated_task_id)) : null;
        return String(generated?.project_id || generated?.projectId || '') === String(projectId);
      })
      .slice(0, 4);
  }

  function parseIdeaMeta(description = '') {
    const match = String(description || '').match(IDEA_META_RE);
    if (!match) return {};
    try {
      const decoded = JSON.parse(decodeURIComponent(match[1] || ''));
      return decoded && typeof decoded === 'object' ? decoded : {};
    } catch {
      return {};
    }
  }

  function buildModel() {
    const state = readState();
    const projects = activeProjects(state);
    const taskMap = new Map((Array.isArray(state.tasks) ? state.tasks : []).map(task => [String(task.id || ''), task]));
    const today = new Date();
    const dates = [today, addMonths(today, 4)];
    projects.forEach(project => {
      [project.start_date, project.end_date].forEach(value => {
        const date = dateFrom(value);
        if (date) dates.push(date);
      });
      projectTasks(state, project.id).forEach(task => {
        const date = dateFrom(task.due_at || task.completed_at || task.created_at);
        if (date) dates.push(date);
      });
    });
    const min = startOfMonth(new Date(Math.min(...dates.map(date => date.getTime()))));
    const maxCandidate = endOfMonth(new Date(Math.max(...dates.map(date => date.getTime()))));
    const max = addMonths(min, Math.min(MAX_MONTHS, Math.max(4, monthDiff(min, maxCandidate) + 1)));
    const months = buildMonths(min, max);
    return { state, projects, taskMap, rangeStart: min, rangeEnd: max, months };
  }

  function monthDiff(start, end) {
    return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth());
  }

  function buildMonths(start, end) {
    const months = [];
    let cursor = startOfMonth(start);
    while (cursor < end && months.length < MAX_MONTHS) {
      months.push(new Date(cursor));
      cursor = addMonths(cursor, 1);
    }
    return months.length ? months : [startOfMonth(new Date())];
  }

  function positionForDate(date, rangeStart, rangeEnd) {
    const time = date instanceof Date ? date.getTime() : Date.parse(date || '');
    const start = rangeStart.getTime();
    const end = Math.max(start + DAY_MS, rangeEnd.getTime());
    if (!Number.isFinite(time)) return null;
    return Math.max(0, Math.min(100, ((time - start) / (end - start)) * 100));
  }

  function lanesForTasks(tasks, rangeStart, rangeEnd, timelineWidth) {
    const minGap = Math.max(5, (TILE_SIZE / Math.max(1, timelineWidth)) * 100 + 1);
    const lanes = [];
    return tasks.map((task, index) => {
      const dueDate = dateFrom(task.due_at);
      const fallbackDate = new Date(rangeStart.getTime() + (7 + index * 8) * DAY_MS);
      const left = positionForDate(dueDate || fallbackDate, rangeStart, rangeEnd);
      let lane = lanes.findIndex(lastLeft => left - lastLeft >= minGap);
      if (lane < 0) {
        lane = Math.min(lanes.length, 2);
      }
      lanes[lane] = left;
      return { task, left, lane, floating: !dueDate };
    });
  }

  function spBars(tasks = []) {
    const buckets = [0, 0, 0, 0, 0];
    tasks.forEach((task, index) => {
      buckets[index % buckets.length] += storyPoints(task);
    });
    const max = Math.max(1, ...buckets);
    return buckets.map(value => `<i style="height:${Math.max(16, Math.round((value / max) * 42))}%"></i>`).join('');
  }

  function renderAxis(months, rangeStart, rangeEnd) {
    const monthLabels = months.map(month => `<span style="left:${positionForDate(month, rangeStart, rangeEnd).toFixed(2)}%">${escapeHtml(dateLabel(month, { monthOnly: true }))}</span>`).join('');
    const weekTicks = [];
    const cursor = new Date(rangeStart);
    cursor.setDate(cursor.getDate() + ((8 - cursor.getDay()) % 7));
    while (cursor < rangeEnd && weekTicks.length < 55) {
      weekTicks.push(`<i style="left:${positionForDate(cursor, rangeStart, rangeEnd).toFixed(2)}%">${String(cursor.getDate()).padStart(2, '0')}</i>`);
      cursor.setDate(cursor.getDate() + 7);
    }
    const todayLeft = positionForDate(new Date(), rangeStart, rangeEnd);
    const today = todayLeft == null ? '' : `<b class="project-timeline-today" style="left:${todayLeft.toFixed(2)}%">Heute</b>`;
    return `<div class="project-timeline-axis" style="--timeline-width:${months.length * MONTH_WIDTH}px">
      <div class="project-timeline-months">${monthLabels}</div>
      <div class="project-timeline-weeks">${today}${weekTicks.join('')}</div>
    </div>`;
  }

  function renderTaskTile(item, project) {
    const task = item.task;
    const priority = normalizePriority(task.priority);
    const status = String(task.status || 'open').toLowerCase();
    const title = task.title || 'Task';
    const meta = [
      STATUS_LABELS[status] || STATUS_LABELS[status.replace(/-/g, '_')] || 'Offen',
      task.due_at ? dateLabel(task.due_at, { withYear: false }) : 'ohne Datum',
      `${storyPoints(task)} SP`,
      PRIORITY_LABELS[priority]
    ].join(' · ');
    return `<button class="project-timeline-task ${item.floating ? 'is-floating' : ''} ${status === 'done' ? 'is-done' : ''}" type="button" data-action="open-task-detail" data-id="${escapeHtml(task.id)}" style="--left:${item.left.toFixed(2)}%;--lane:${item.lane};--project-color:${escapeHtml(normalizeColor(project.color))}" title="${escapeHtml(title)} · ${escapeHtml(meta)}">
      <span class="project-timeline-sp">${storyPoints(task)}</span>
      <span class="project-timeline-priority priority-${escapeHtml(priority)}"></span>
      <strong>${escapeHtml(tileInitials(title))}</strong>
    </button>`;
  }

  function renderIdeaTile(idea, project) {
    const priority = normalizePriority(idea.priority || 'idea');
    return `<button class="project-timeline-idea" type="button" data-action="open-task-idea-detail" data-id="${escapeHtml(idea.id)}" style="--project-color:${escapeHtml(normalizeColor(project.color))}" title="${escapeHtml(idea.title || 'Idee')} · ${storyPoints(idea)} SP">
      <span class="project-timeline-sp">${storyPoints(idea)}</span>
      <span class="project-timeline-priority priority-${escapeHtml(priority === 'medium' ? 'idea' : priority)}"></span>
      <strong>${escapeHtml(tileInitials(idea.title || 'Idee'))}</strong>
    </button>`;
  }

  function renderProjectRow(project, model) {
    const tasks = projectTasks(model.state, project.id);
    const ideas = projectIdeas(model.state, project.id, model.taskMap);
    const totalSp = tasks.reduce((sum, task) => sum + storyPoints(task), 0);
    const timelineWidth = model.months.length * MONTH_WIDTH;
    const laneItems = lanesForTasks(tasks, model.rangeStart, model.rangeEnd, timelineWidth);
    const laneCount = Math.max(1, ...laneItems.map(item => item.lane + 1));
    const progress = tasks.length ? Math.round((tasks.filter(task => String(task.status || '') === 'done').length / tasks.length) * 100) : 0;
    const color = normalizeColor(project.color);
    return `<article class="project-timeline-row" style="--project-color:${escapeHtml(color)};--timeline-width:${timelineWidth}px;--lane-count:${laneCount}">
      <div class="project-timeline-project">
        <button class="project-timeline-dna" type="button" data-action="open-project-detail" data-id="${escapeHtml(project.id)}" aria-label="Projekt-DNA oeffnen: ${escapeHtml(project.title)}" title="Projekt-DNA oeffnen">
          <span>${escapeHtml(projectInitials(project.title))}</span>
        </button>
        <div class="project-timeline-project-copy">
          <strong>${escapeHtml(project.title)}</strong>
          <small>${totalSp} SP · ${tasks.length} Task${tasks.length === 1 ? '' : 's'}</small>
          <div class="project-timeline-bars" aria-hidden="true">${spBars(tasks)}</div>
        </div>
      </div>
      <div class="project-timeline-track">
        <div class="project-timeline-track-grid" aria-hidden="true">${model.months.map(month => `<i data-month="${escapeHtml(monthKey(month))}" style="left:${positionForDate(month, model.rangeStart, model.rangeEnd).toFixed(2)}%"></i>`).join('')}</div>
        ${laneItems.length ? laneItems.map(item => renderTaskTile(item, project)).join('') : `<span class="project-timeline-empty">Noch keine geplanten Tasks</span>`}
      </div>
      <div class="project-timeline-ideas">
        <div class="project-timeline-idea-list">${ideas.length ? ideas.map(idea => renderIdeaTile(idea, project)).join('') : '<span class="project-timeline-empty">Keine Ideen</span>'}</div>
        <div class="project-timeline-create-actions">
          <button class="project-timeline-add" type="button" data-action="open-project-idea" data-id="${escapeHtml(project.id)}">+ Idee</button>
          <button class="project-timeline-add" type="button" data-action="create-project-task" data-id="${escapeHtml(project.id)}">+ Task</button>
        </div>
      </div>
      <div class="project-timeline-progress" aria-label="Fortschritt ${progress}%"><i style="width:${progress}%"></i></div>
    </article>`;
  }

  function render() {
    const mount = ensureMount();
    if (!mount) return;
    const model = buildModel();
    const timelineWidth = model.months.length * MONTH_WIDTH;
    if (!model.projects.length) {
      mount.innerHTML = `<section class="panel glass project-timeline-panel"><div class="panel-head"><div><p class="eyebrow">Planung</p><h3>Projekt-Timeline</h3></div></div><div class="project-empty">Sobald ein Projekt angelegt ist, erscheint hier die Timeline-Ansicht.</div></section>`;
      return;
    }
    mount.innerHTML = `<section class="panel glass project-timeline-panel" style="--timeline-width:${timelineWidth}px">
      <div class="panel-head project-timeline-head">
        <div><p class="eyebrow">Planung</p><h3>Projekt-Timeline</h3></div>
        <span class="badge muted">SP-basiert · ${model.projects.length} Projekt${model.projects.length === 1 ? '' : 'e'}</span>
      </div>
      <div class="project-timeline-scroll">
        <div class="project-timeline-shell">
          <div class="project-timeline-header">
            <span>Projekte</span>
            ${renderAxis(model.months, model.rangeStart, model.rangeEnd)}
            <span>Ideen</span>
          </div>
          <div class="project-timeline-rows">${model.projects.map(project => renderProjectRow(project, model)).join('')}</div>
        </div>
      </div>
      <div class="project-timeline-foot">
        <span><i class="priority-low"></i>Niedrig</span>
        <span><i class="priority-medium"></i>Mittel</span>
        <span><i class="priority-high"></i>Hoch</span>
        <span><i class="priority-urgent"></i>Dringend</span>
        <span><i class="priority-idea"></i>Idee</span>
      </div>
    </section>`;
  }

  function ensureMount() {
    const screen = document.getElementById('screen-projects');
    if (!screen) return null;
    let mount = document.getElementById('projectTimelineViewMount');
    if (mount) return mount;
    mount = document.createElement('div');
    mount.id = 'projectTimelineViewMount';
    const portfolioPanel = document.getElementById('projectsGrid')?.closest('.panel');
    if (portfolioPanel?.parentElement) portfolioPanel.parentElement.insertBefore(mount, portfolioPanel);
    else screen.appendChild(mount);
    return mount;
  }

  function injectStyle() {
    if (document.getElementById('habitflow-project-timeline-view-style')) return;
    const style = document.createElement('style');
    style.id = 'habitflow-project-timeline-view-style';
    style.textContent = `
      .project-timeline-panel{overflow:hidden}
      .project-timeline-head{align-items:flex-start}
      .project-timeline-scroll{overflow-x:auto;overflow-y:hidden;padding-bottom:6px;-webkit-overflow-scrolling:touch}
      .project-timeline-shell{min-width:calc(250px + var(--timeline-width,600px) + 230px)}
      .project-timeline-header,.project-timeline-row{display:grid;grid-template-columns:250px var(--timeline-width,600px) 230px;gap:14px;align-items:center}
      .project-timeline-header{padding:2px 0 10px;color:var(--muted);font-size:.76rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
      .project-timeline-axis{position:relative;height:48px}
      .project-timeline-months,.project-timeline-weeks{position:absolute;inset:0}
      .project-timeline-months span,.project-timeline-weeks i,.project-timeline-today{position:absolute;transform:translateX(-50%);white-space:nowrap}
      .project-timeline-months span{top:0;color:var(--text);font-size:.78rem}
      .project-timeline-weeks{top:24px;border-top:1px solid rgba(255,255,255,.08)}
      .project-timeline-weeks i{top:10px;font-style:normal;font-size:.66rem;color:var(--muted)}
      .project-timeline-today{top:-21px;padding:5px 8px;border-radius:9px;background:var(--primary);color:#06111f;font-size:.62rem;font-weight:950;letter-spacing:0;text-transform:none}
      .project-timeline-today:after{content:'';position:absolute;left:50%;top:100%;width:2px;height:57px;background:rgba(74,215,209,.42);transform:translateX(-50%)}
      .project-timeline-rows{display:grid;gap:0}
      .project-timeline-row{position:relative;min-height:calc(94px + (var(--lane-count,1) - 1) * 58px);padding:14px 0;border-top:1px solid rgba(255,255,255,.07)}
      .project-timeline-project{display:flex;align-items:center;gap:12px;min-width:0}
      .project-timeline-dna{display:inline-grid;place-items:center;width:58px;height:58px;min-width:58px;border:1px solid color-mix(in srgb,var(--project-color,#4ad7d1) 34%, rgba(255,255,255,.1));border-radius:999px;background:color-mix(in srgb,var(--project-color,#4ad7d1) 26%, rgba(255,255,255,.08));padding:6px;color:var(--text)}
      .project-timeline-dna span{display:grid;place-items:center;width:42px;height:42px;border-radius:999px;background:var(--project-color,#4ad7d1);color:#0e1726;font-size:.9rem;font-weight:950;letter-spacing:.04em}
      .project-timeline-project-copy{min-width:0}
      .project-timeline-project-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.95rem}
      .project-timeline-project-copy small{display:block;margin-top:4px;color:var(--muted);font-weight:800}
      .project-timeline-bars{display:flex;align-items:flex-end;gap:3px;width:72px;height:32px;margin-top:8px}
      .project-timeline-bars i{display:block;width:7px;border-radius:999px;background:var(--project-color,#4ad7d1);opacity:.78}
      .project-timeline-track{position:relative;min-height:calc(68px + (var(--lane-count,1) - 1) * 58px);border-radius:18px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06);overflow:hidden}
      .project-timeline-track-grid{position:absolute;inset:0}
      .project-timeline-track-grid i{position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,.06)}
      .project-timeline-task,.project-timeline-idea{position:absolute;display:grid;place-items:center;width:${TILE_SIZE}px;height:${TILE_SIZE}px;border-radius:8px;border:1px solid color-mix(in srgb,var(--project-color,#4ad7d1) 78%, rgba(17,36,58,.16));background:var(--project-color,#4ad7d1);color:#0e1726;box-shadow:0 8px 20px rgba(2,10,18,.08);padding:5px;text-align:center}
      .project-timeline-task{left:var(--left);top:calc(12px + var(--lane) * 58px);transform:translateX(-50%)}
      .project-timeline-task.is-done{opacity:.58}
      .project-timeline-task.is-floating{border-style:dashed}
      .project-timeline-task strong,.project-timeline-idea strong{display:block;width:100%;font-size:.74rem;line-height:1;font-weight:950;letter-spacing:.03em;text-align:center}
      .project-timeline-sp{position:absolute;left:6px;top:5px;font-size:.58rem;line-height:1;font-weight:950;color:rgba(14,23,38,.7)}
      .project-timeline-priority{position:absolute;right:7px;top:7px;width:7px;height:7px;border-radius:999px;background:#4ad7d1}
      .project-timeline-priority.priority-low,.project-timeline-foot .priority-low{background:#16c6b8}
      .project-timeline-priority.priority-medium,.project-timeline-foot .priority-medium{background:#4598ff}
      .project-timeline-priority.priority-high,.project-timeline-foot .priority-high{background:#f6a91f}
      .project-timeline-priority.priority-urgent,.project-timeline-foot .priority-urgent{background:#ff4d55}
      .project-timeline-priority.priority-idea,.project-timeline-foot .priority-idea{background:#9b6cff}
      .project-timeline-ideas{display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:8px;min-width:0}
      .project-timeline-idea-list{position:relative;display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:8px;width:100%;min-width:0;min-height:${TILE_SIZE}px;overflow:visible}
      .project-timeline-idea{position:relative;inset:auto}
      .project-timeline-create-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}
      .project-timeline-add{border:0;background:rgba(74,215,209,.16);color:var(--primary);border-radius:999px;padding:9px 12px;font-weight:900;white-space:nowrap}
      .project-timeline-empty{display:inline-flex;align-items:center;height:100%;min-height:48px;color:var(--muted);font-weight:800;font-size:.82rem;padding:0 14px}
      .project-timeline-progress{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.06);border-radius:999px;overflow:hidden}
      .project-timeline-progress i{display:block;height:100%;background:var(--project-color,#4ad7d1);border-radius:inherit}
      .project-timeline-foot{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:12px;color:var(--muted);font-size:.74rem;font-weight:800}
      .project-timeline-foot span{display:inline-flex;align-items:center;gap:6px}
      .project-timeline-foot i{width:8px;height:8px;border-radius:999px}
      body.light .project-timeline-row{border-color:rgba(17,36,58,.07)}
      body.light .project-timeline-weeks{border-color:rgba(17,36,58,.08)}
      body.light .project-timeline-track{background:rgba(255,255,255,.58);border-color:rgba(17,36,58,.08)}
      body.light .project-timeline-track-grid i{background:rgba(17,36,58,.06)}
      body.light .project-timeline-progress{background:rgba(17,36,58,.06)}
      @media(max-width:920px){.project-timeline-shell{min-width:calc(190px + var(--timeline-width,600px) + 170px)}.project-timeline-header,.project-timeline-row{grid-template-columns:190px var(--timeline-width,600px) 170px}.project-timeline-dna{width:48px;height:48px;min-width:48px}.project-timeline-dna span{width:34px;height:34px;font-size:.76rem}.project-timeline-project{gap:9px}.project-timeline-idea-list{gap:6px}}
      @media(max-width:760px){.project-timeline-panel{border-radius:24px}.project-timeline-scroll{margin-inline:-2px}.project-timeline-shell{min-width:780px}.project-timeline-header,.project-timeline-row{grid-template-columns:170px var(--timeline-width,600px) 170px;gap:10px}.project-timeline-row{min-height:calc(86px + (var(--lane-count,1) - 1) * 54px);padding:12px 0}.project-timeline-track{min-height:calc(62px + (var(--lane-count,1) - 1) * 54px)}.project-timeline-task,.project-timeline-idea{width:46px;height:46px;border-radius:8px}.project-timeline-task{top:calc(10px + var(--lane) * 54px)}.project-timeline-task strong,.project-timeline-idea strong{font-size:.66rem}.project-timeline-project-copy small{font-size:.72rem}.project-timeline-bars{display:none}.project-timeline-add{padding:8px 10px;font-size:.72rem}.project-timeline-foot{font-size:.68rem;gap:10px}}
    `;
    document.head.appendChild(style);
  }

  function ensureBridgeScript(src, marker) {
    if (window[marker] || document.querySelector(`script[data-project-timeline-bridge="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.dataset.projectTimelineBridge = src;
    document.head.appendChild(script);
  }

  function ensureProjectBridges() {
    ensureBridgeScript('modules/project-task-form-bridge.js?v=226', '__habitFlowTaskProjectBridgeInstalled');
    ensureBridgeScript('modules/project-idea-form-bridge.js?v=226', '__habitFlowProjectIdeaBridgeInstalled');
  }

  function scheduleRender(delay = 0) {
    if (renderTimer) window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      renderTimer = null;
      render();
    }, delay);
  }

  function boot() {
    ensureProjectBridges();
    injectStyle();
    render();
    scheduleRender(600);
    new MutationObserver(() => {
      if (!document.getElementById('projectTimelineViewMount') && document.getElementById('screen-projects')) scheduleRender(0);
    }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('storage', event => {
      if (event.key === STATE_KEY) scheduleRender(0);
    });
    window.addEventListener('habitflow:projects-changed', () => scheduleRender(0));
    window.addEventListener('habitflow:project-task-link-updated', () => scheduleRender(0));
    document.addEventListener('submit', event => {
      if (event.target?.id === 'projectForm' || event.target?.id === 'taskForm' || event.target?.matches?.('[data-project-phase-form], [data-project-milestone-form]')) {
        scheduleRender(240);
      }
    }, true);
    document.addEventListener('click', event => {
      if (event.target?.closest?.('#projectTimelineViewMount [data-action="open-task-idea-detail"], #projectTimelineViewMount [data-action="create-project-task"], #projectTimelineViewMount [data-action="open-project-idea"]')) scheduleRender(600);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();