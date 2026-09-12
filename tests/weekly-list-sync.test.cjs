const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const listSource = fs.readFileSync(path.join(root, 'modules/lists.js'), 'utf8');
const listStyle = fs.readFileSync(path.join(root, 'modules/lists.css'), 'utf8');
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
  assert.match(workerSource, /weekly-habit-card-294/);
  assert.match(workerSource, /'\.\/modules\/lists\.js'/);
  assert.match(workerSource, /'\.\/modules\/lists\.css'/);
  assert.match(indexSource, /modules\/lists\.css\?v=294/);
  assert.match(indexSource, /modules\/lists\.js\?v=294/);
});

test('weekly notes use the habit-card surface and the pink list tone', () => {
  assert.match(listSource, /id:\s*WEEKLY_LIST_ID[^\n]+color:\s*'#EDBDC3'/);
  assert.match(listSource, /if \(list\.id === WEEKLY_LIST_ID\) merged\.color = '#EDBDC3'/);
  assert.match(listSource, /class="hf-weekly-card-icon"/);
  assert.match(listStyle, /\.hf-weekly-card\{[^}]*border-radius:24px[^}]*background:rgba\(255,255,255,\.055\)/);
  assert.match(listStyle, /\.hf-weekly-card-icon\{/);
  assert.match(listStyle, /body\.light \.hf-weekly-card\{background:rgba\(255,255,255,\.72\)/);
  assert.doesNotMatch(listStyle, /\.hf-weekly-card:after/);
  assert.doesNotMatch(listStyle, /231,200,135|#e7c887|#dcbf7e|#94712e/i);
});

test('global open and card metrics count only the current weekly note', () => {
  assert.match(listSource, /item\.listId !== WEEKLY_LIST_ID/);
  assert.match(listSource, /\+ weeklyOpenItems\(currentWeek\)\.length/);
  assert.match(listSource, /list\.id === WEEKLY_LIST_ID[\s\S]*weeklyOpenItems\(currentWeekStartKey\(\)\)\.length/);
});
