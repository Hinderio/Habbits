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
  assert.match(indexSource, /modules\/lists\.css\?v=329/);
  assert.match(indexSource, /modules\/lists\.js\?v=343/);
});

test('weekly notes keep the habit-card surface with the updated list tone', () => {
  assert.match(listSource, /id:\s*WEEKLY_LIST_ID[^\n]+color:\s*'#4AA885'/);
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

test('weekly rerenders preserve each card scroll position without affecting new weeks', () => {
  const start = listSource.indexOf('  function renderDetail(');
  const end = listSource.indexOf('\n  function ', start + 1);
  let scheduled = 0;
  const renderDetail = vm.runInNewContext('(' + listSource.slice(start, end).trim() + ')', {
    WEEKLY_LIST_ID: 'weekly',
    EXHIBITION_LIST_ID: 'exhibition',
    WEBLINK_LIST_ID: 'weblinks',
    GIFT_LIST_ID: 'gifts',
    renderWeeklyDetail: () => '<weekly>',
    scheduleWeeklyRailPosition: () => { scheduled += 1; }
  });
  const body = (week, scrollTop) => ({ dataset: { weeklyScroll: week }, scrollTop });
  const before = [body('2026-09-21', 210), body('2026-09-28', 95)];
  const after = [body('2026-09-28', 0), body('2026-09-21', 0), body('2026-10-05', 0)];
  let rendered = false;
  const target = {
    querySelectorAll: () => rendered ? after : before,
    set innerHTML(value) { assert.equal(value, '<weekly>'); rendered = true; }
  };
  renderDetail(target, { id: 'weekly' });
  assert.deepEqual(after.map(entry => entry.scrollTop), [95, 210, 0]);
  assert.equal(scheduled, 1);
});

test('vertical note scrolling does not trigger horizontal week navigation', () => {
  const start = listSource.indexOf("document.addEventListener('scroll', event => {");
  const end = listSource.indexOf('}, true);', start) + '}, true);'.length;
  let listener;
  let scheduled = 0;
  vm.runInNewContext(listSource.slice(start, end), {
    document: { addEventListener: (event, callback) => { listener = callback; } },
    window: { clearTimeout() {}, setTimeout() { scheduled += 1; return 1; } },
    weeklyRailScrollTimer: null
  });
  listener({ target: { matches: () => false, closest: () => ({}) } });
  assert.equal(scheduled, 0);
  listener({ target: { matches: () => true } });
  assert.equal(scheduled, 1);
});
