const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const listSource = fs.readFileSync(path.join(root, 'modules/lists.js'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('weekly list mutations use targeted custom_list_items upserts', () => {
  assert.match(listSource, /saveAndSync\(\[item\]\)/);
  assert.match(listSource, /const itemsToSync = fullSync \? state\.items : state\.items\.filter/);
  assert.match(listSource, /custom_list_items'\)\.upsert\(itemsToSync\.map/);
  assert.match(listSource, /pendingItemSyncIds/);
});

test('full sync remains available for initial reconcile and recovery', () => {
  assert.match(listSource, /if \(reconcile\) await syncToSupabase\(\)/);
  assert.match(listSource, /const itemsToSync = fullSync \? state\.items/);
  assert.match(listSource, /window\.addEventListener\('online',[\s\S]*syncFromSupabase\(remoteUserId\)/);
});

test('returning to the foreground pulls and merges remote list rows', () => {
  assert.match(listSource, /document\.addEventListener\('visibilitychange'/);
  assert.match(listSource, /syncFromSupabase\(remoteUserId, \{ reconcile: false \}\)/);
  assert.match(listSource, /items: mergeById\(state\.items, remoteItems\)/);
});

test('service worker caches weekly assets under a bumped version', () => {
  new vm.Script(workerSource);
  assert.match(workerSource, /weekly-notes-293/);
  assert.match(workerSource, /'\.\/modules\/lists\.js'/);
  assert.match(workerSource, /'\.\/modules\/lists\.css'/);
  assert.match(indexSource, /modules\/lists\.css\?v=293/);
  assert.match(indexSource, /modules\/lists\.js\?v=293/);
});

test('global open and card metrics count only the current weekly note', () => {
  assert.match(listSource, /item\.listId !== WEEKLY_LIST_ID/);
  assert.match(listSource, /\+ weeklyOpenItems\(currentWeek\)\.length/);
  assert.match(listSource, /list\.id === WEEKLY_LIST_ID[\s\S]*weeklyOpenItems\(currentWeekStartKey\(\)\)\.length/);
});
