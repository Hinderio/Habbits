const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

const pauseCardStart = appSource.indexOf('function pausePeriodCard(period)');
const pauseCardEnd = appSource.indexOf('function renderPauseList(', pauseCardStart);
assert.ok(pauseCardStart >= 0 && pauseCardEnd > pauseCardStart, 'pause card renderer exists');

const pauseCardSource = appSource.slice(pauseCardStart, pauseCardEnd);
assert.match(pauseCardSource, /class="consumption-icon-action"[^>]+data-action="edit-pause"/);
assert.match(pauseCardSource, /aria-label="Pause bearbeiten"[^>]*>\$\{svgIcon\('edit', 'ui-icon'\)\}/);
assert.match(pauseCardSource, /class="consumption-icon-action consumption-icon-action-delete"[^>]+data-action="delete-pause"/);
assert.match(pauseCardSource, /aria-label="Pause löschen"[^>]*>\$\{svgIcon\('trash', 'ui-icon'\)\}/);
assert.doesNotMatch(pauseCardSource, /class="mini-btn danger"[^>]+data-action="delete-pause"/);
assert.match(workerSource, /habitflow-v284-habit-story-full-history/);

console.log('pause card icon actions tests passed');
