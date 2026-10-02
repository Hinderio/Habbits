const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const projectsSource = fs.readFileSync(path.join(__dirname, '../modules/projects.js'), 'utf8');
function extract(name, text = source) {
  const start = text.indexOf('  function ' + name + '(');
  assert.notEqual(start, -1, name);
  const next = text.slice(start + 1).search(/\n  (?:async )?function /);
  return text.slice(start, next < 0 ? undefined : start + 1 + next);
}
function harness() {
  let sequence = 0, saves = 0, syncs = 0;
  const root = { innerHTML: '' };
  const snapshot = { projects: [{ id: 'p1', title: 'Masterarbeit', color: '#f5a51b' }, { id: 'p2', title: 'SWICA', color: '#45ceca' }], taskLinks: [] };
  const state = { tasks: [], pointsLedger: [{ source_id: 'original', points: 85 }] };
  const context = vm.createContext({ state, window: { HabitFlowRoadmapProjects: { snapshot: () => snapshot } }, document: { getElementById: () => root, querySelectorAll: () => [] },
    uid: () => 'new-' + ++sequence, nowIso: () => '2026-10-02T12:00:00.000Z',
    validIsoOrNull: value => value || null, normalizeTaskPriority: value => value || 'medium',
    saveState: () => saves++, syncWithSupabase: () => syncs++, toast: () => {},
    isDoneArchivedTask: task => task.status === 'done' && !!task.done_archived_at,
    renderTaskBoard: () => {}, console });
  const constants = source.match(/  const TASK_(?:RECURRENCE_MARKER_RE|MEDIA_MARKER_RE|STEPS_MARKER_RE|IMAGE_LIMIT|STEP_LIMIT) = .*;/g).join('\n');
  const columns = source.slice(source.indexOf('  const TASK_COLUMNS ='), source.indexOf('  const TASK_BOARD_COLUMNS ='));
  const names = ['escapeHtml', 'parseTaskRecurrenceFromDescription', 'normalizeTaskImages', 'parseTaskMediaFromDescription', 'normalizeTaskSteps', 'parseTaskStepsFromDescription', 'parseTaskContentFromDescription', 'normalizeTaskRecurrence', 'normalizeTask', 'normalizeTaskCategory', 'taskDescriptionForDisplay', 'taskImages', 'taskSteps', 'duplicateTask', 'filterTaskBoard', 'toggleTaskProjectFilter'];
  vm.runInContext(constants + '\n' + columns + '\nconst TASK_BOARD_COLUMNS = TASK_COLUMNS.filter(c => c.status !== "archived"); const taskProjectFilters = new Set();\n' + names.map(name => extract(name)).join('\n') + '\n' + ['projectInitials', 'projectBadge'].map(name => extract(name, projectsSource)).join('\n') + '\nwindow.HabitFlowRoadmapProjects.badge = projectBadge;', context);
  return { context, state, snapshot, root, get saves() { return saves; }, get syncs() { return syncs; }, run: js => vm.runInContext(js, context) };
}
test('duplicate resets completion, points, archive and steps while preserving task content', () => {
  const h = harness();
  h.state.tasks.push({ id: 'original', title: 'Antrag', description: 'Notiz https://example.com', category: 'Studium', priority: 'high', effort: 3, status: 'done', points: 85, completed_at: '2026-10-01', done_archived_at: '2026-10-01', done_archive_rank: 2, backlog_rank: 4, due_at: '2026-11-01T12:00:00Z', synced: true, images: [{ id: 'image', data_url: 'data:image/png;base64,AA==' }], steps: [{ id: 'step', title: 'Einreichen', done: true, completed_at: '2026-10-01' }], recurrence: { frequency: 'monthly', series_id: 'old-series', previous_task_id: 'previous' } });
  h.snapshot.taskLinks.push({ id: 'original', projectId: 'p1' });
  const before = JSON.stringify(h.state);
  h.run('duplicateTask("original")');
  const copy = h.state.tasks[1];
  assert.equal(copy.status, 'open'); assert.equal(copy.points, 0); assert.equal(copy.synced, false);
  assert.equal(copy.title, 'Antrag (Kopie)'); assert.equal(copy.project_id, 'p1');
  for (const key of ['description', 'category', 'priority', 'effort', 'due_at']) assert.equal(copy[key], h.state.tasks[0][key]);
  for (const key of ['completed_at', 'done_archived_at', 'done_archive_rank', 'backlog_rank']) assert.equal(copy[key], null);
  assert.equal(copy.steps[0].done, false); assert.equal(copy.steps[0].completed_at, null); assert.notEqual(copy.steps[0].id, 'step');
  assert.equal(copy.recurrence.series_id, copy.id); assert.equal(copy.recurrence.previous_task_id, null);
  copy.images[0].name = 'changed'; copy.steps[0].title = 'changed';
  assert.equal(JSON.stringify({ tasks: [h.state.tasks[0]], pointsLedger: h.state.pointsLedger }), before);
  assert.equal(h.saves, 1); assert.equal(h.syncs, 1);
});
test('legacy description metadata survives duplication without retaining completed steps or series identity', () => {
  const h = harness();
  h.state.tasks.push({ id: 'legacy', title: 'Legacy', description: 'Notiz\n<!--hf-task-steps:' + encodeURIComponent(JSON.stringify({ steps: [{ id: 'old', title: 'Schritt', done: true }] })) + '-->\n<!--hf-task-rec:' + encodeURIComponent(JSON.stringify({ frequency: 'monthly', series_id: 'legacy-series' })) + '-->', project_id: 'p2', status: 'archived' });
  h.run('duplicateTask("legacy")');
  const copy = h.state.tasks[1];
  assert.equal(copy.description, 'Notiz'); assert.equal(copy.steps[0].done, false); assert.equal(copy.project_id, 'p2'); assert.equal(copy.recurrence.series_id, copy.id);
  h.run('duplicateTask("missing")'); assert.equal(h.state.tasks.length, 2);
});
test('project filters support OR selection, reset, unassigned tasks and exclude backlog and archive', () => {
  const h = harness();
  h.state.tasks.push({ id: 'a', status: 'open', project_id: 'p1' }, { id: 'b', status: 'done', project_id: 'p2' }, { id: 'c', status: 'in_progress' }, { id: 'd', status: 'archived', project_id: 'p1' }, { id: 'e', status: 'done', project_id: 'p1', done_archived_at: '2026-10-01' });
  const ids = () => Array.from(h.run('filterTaskBoard(state.tasks)'), task => task.id);
  assert.deepEqual(ids(), ['a', 'b', 'c']);
  h.run('toggleTaskProjectFilter("p1")'); assert.deepEqual(ids(), ['a']);
  h.run('toggleTaskProjectFilter("p2")'); assert.deepEqual(ids(), ['a', 'b']);
  h.run('toggleTaskProjectFilter("p1")'); assert.deepEqual(ids(), ['b']);
  h.run('toggleTaskProjectFilter(""); toggleTaskProjectFilter("__none__")'); assert.deepEqual(ids(), ['c']);
  h.run('toggleTaskProjectFilter("")'); assert.deepEqual(ids(), ['a', 'b', 'c']);
});
test('filters use current project links and recover after a selected project is removed', () => {
  const h = harness();
  h.state.tasks.push({ id: 'a', status: 'open', project_id: 'p1' });
  h.snapshot.taskLinks.push({ id: 'a', projectId: 'p2' });
  h.run('toggleTaskProjectFilter("p1")'); assert.equal(h.run('filterTaskBoard(state.tasks).length'), 0);
  h.snapshot.projects.shift(); assert.equal(h.run('filterTaskBoard(state.tasks).length'), 1);
  h.snapshot.projects[0].title = '<img onerror=alert(1)>';
  h.run('filterTaskBoard(state.tasks)'); assert.ok(!h.root.innerHTML.includes('<img')); assert.match(h.root.innerHTML, /aria-pressed="true"/);
  assert.match(h.root.innerHTML, /project-chip-mark/);
});
module.exports = { extract, harness };
test('done cards expose five aligned accessible icon actions and keep existing action routes', () => {
  const h = harness();
  Object.assign(h.context, { editingTaskId: null, TASK_BACKLOG_STATUS: 'archived', taskPriorityMeta: () => ({ short: 'Hoch', label: 'Hoch' }), taskPriorityClass: () => '', taskDueState: () => ({ overdue: false }), renderTaskDescriptionPreview: () => '', taskHasImages: () => false, taskPoints: () => 85, taskRecurrenceLabel: () => '', renderTaskStepsPreview: () => '', renderOverdueDots: () => '' });
  const icons = source.slice(source.indexOf('  const ICON_PATHS ='), source.indexOf('  function svgIcon('));
  vm.runInContext(icons + '\n' + extract('svgIcon') + '\n' + extract('renderTaskCard'), h.context);
  const html = h.run('renderTaskCard({ id: "done", title: "Erledigt", status: "done", effort: 3 })');
  const actions = html.slice(html.indexOf('<span class="task-card-icon-actions">'));
  assert.equal((actions.match(/<button/g) || []).length, 5);
  for (const action of ['move-task', 'archive-done-task', 'duplicate-task', 'edit-task', 'delete-task']) assert.match(actions, new RegExp('data-action="' + action + '"'));
  assert.match(actions, /aria-label="Zurück in Arbeit"/); assert.match(actions, /aria-label="Task archivieren"/);
  const open = h.run('renderTaskCard({ id: "open", title: "Offen", status: "open", effort: 3 })');
  assert.ok(!open.includes('archive-done-task')); assert.match(open, /data-action="duplicate-task"/);
});
