const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const appSource = read('app.js');
const indexSource = read('index.html');
const projectSource = read('modules/projects.js');
const calendarCss = read('modules/calendar-bubbles-native.css');
const workerSource = read('service-worker.js');

assert.match(workerSource, /habitflow-v284-habit-story-full-history/);
assert.match(workerSource, /fetch\(event\.request, \{ cache: 'no-store' \}\)/);
assert.doesNotMatch(workerSource, /response\.text\(\)/);
assert.doesNotMatch(workerSource, /nativeAppointmentPatch|nativeTaskIdeaProjectPatch|withProjectMilestoneEditScript|withInlineMilestoneEditing/);
assert.doesNotMatch(workerSource, /\.replace\(['"`]/);

[
  'modules/projects-milestone-edit.js?v=183',
  'modules/project-timeline-view.js?v=266',
  'modules/projects-ui-polish.js?v=221',
  'modules/project-idea-form-bridge.js?v=227',
  'modules/project-task-form-bridge.js?v=226',
  'modules/project-unlink-persistence-fix.js?v=218',
  'modules/pause-period-edit.js?v=204'
].forEach(asset => assert.match(indexSource, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));

assert.match(indexSource, /modules\/calendar-bubbles-native\.css\?v=272/);
assert.match(workerSource, /\.\/modules\/calendar-bubbles-native\.css/);
assert.match(calendarCss, /content: attr\(data-initials\)/);
assert.match(calendarCss, /calendar-event-chip\.is-birthday/);

assert.match(appSource, /function syncAppointmentBirthdayRecurrence\(\)/);
assert.match(appSource, /const visibleBirthdayAppointments = appointments\.filter/);
assert.match(appSource, /function calendarBubbleInitials\(/);
assert.match(appSource, /const calendarAppointmentInitials = calendarBubbleInitials/);
assert.match(appSource, /data-initials="\$\{escapeHtml\(calendarAppointmentInitials\)\}"/);
assert.doesNotMatch(appSource, /const appointmentInitials = calendarBubbleInitials/);
assert.match(appSource, /data-initials="\$\{escapeHtml\(taskInitials\)\}"/);
assert.match(appSource, /function readPendingProjectTaskContext\(\)/);
assert.match(appSource, /project_link_cleared_at: normalizedProjectId \? null : nowIso\(\)/);
assert.match(appSource, /project_id: t\.project_id \|\| null/);
assert.match(appSource, /function taskIdeaProjectId\(/);
assert.match(appSource, /const localProjectId = taskIdeaProjectId\(localIdea\)/);

assert.match(projectSource, /const editingMilestoneId = form\.dataset\.editingMilestoneId \|\| ''/);
assert.match(projectSource, /!task\.project_link_cleared_at/);

console.log('service worker native-source checks passed');
