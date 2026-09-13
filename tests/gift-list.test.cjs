const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { webcrypto } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const listSource = fs.readFileSync(path.join(root, 'modules/lists.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function listHarness() {
  const storage = new Map();
  let serial = 0;
  const document = {
    querySelector: () => null, getElementById: () => null, addEventListener() {},
    body: { classList: { add() {}, remove() {} } }
  };
  const window = {
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    addEventListener() {}, setTimeout, clearTimeout,
    crypto: { randomUUID: () => 'gift-test-' + (++serial) }
  };
  const hooks = 'window.testGifts = { saveGift, handleGiftAction, renderGiftsDetail, getState: () => state };';
  vm.runInNewContext(listSource.replace('})(window, document);', hooks + '\n})(window, document);'), {
    window, document, console, Date, Intl, Map, Set, Math, URL, Event, setTimeout, clearTimeout,
    FormData: class { constructor(form) { this.values = form.values; } get(name) { return this.values[name]; } }
  });
  const form = (values, id = '') => ({ values, dataset: { editingId: id }, reset() {}, elements: { person: { focus() {} }, title: { focus() {} } } });
  return { api: window.testGifts, window, form };
}

test('gifts require person and title, preserve metadata when edited, and archive independently', async () => {
  const { api, form } = listHarness();
  api.saveGift(form({ title: 'Buch', person: '   ' }));
  assert.equal(api.getState().items.length, 0);
  api.saveGift(form({ title: '  Buch ', person: ' Anna ', note: 'Erstausgabe' }));
  const item = api.getState().items[0];
  assert.equal(item.listId, 'gifts');
  assert.equal(item.metadata.person, 'Anna');
  item.metadata.promotedTaskId = 'linked-task';
  api.saveGift(form({ title: 'Kochbuch', person: 'Lea', note: 'Signiert' }, item.id));
  assert.equal(item.title, 'Kochbuch');
  assert.equal(item.metadata.person, 'Lea');
  assert.equal(item.metadata.promotedTaskId, 'linked-task');
  await api.handleGiftAction('toggle-gift', item.id);
  assert.equal(item.isDone, true);
  await api.handleGiftAction('delete-gift', item.id);
  assert.equal(item.isArchived, true);
});

test('gift content is escaped and recipient is visible', () => {
  const { api, form } = listHarness();
  api.saveGift(form({ title: '<img src=x>', person: 'Anna & Lea', note: '<script>bad</script>' }));
  const html = api.renderGiftsDetail({ title: 'Geschenk' });
  assert.ok(html.includes('Für Anna &amp; Lea'));
  assert.ok(html.includes('&lt;img src=x&gt;'));
  assert.ok(!html.includes('<script>bad</script>'));
});

test('double-click promotion runs once, records the task, and leaves the gift open', async () => {
  const { api, window, form } = listHarness();
  api.saveGift(form({ title: 'Buch', person: 'Anna' }));
  const item = api.getState().items[0];
  let calls = 0;
  let resolve;
  window.HabitFlowGiftTasks = { create: payload => {
    calls++;
    assert.equal(payload.person, 'Anna');
    return new Promise(done => { resolve = done; });
  } };
  const first = api.handleGiftAction('promote-gift', item.id);
  await api.handleGiftAction('promote-gift', item.id);
  resolve('task-1');
  await first;
  await api.handleGiftAction('promote-gift', item.id);
  assert.equal(calls, 1);
  assert.equal(item.metadata.promotedTaskId, 'task-1');
  assert.equal(item.isDone, false);
});

test('failed task creation remains retryable', async () => {
  const { api, window, form } = listHarness();
  api.saveGift(form({ title: 'Buch', person: 'Anna' }));
  const item = api.getState().items[0];
  window.HabitFlowGiftTasks = { create: async () => { throw new Error('storage'); } };
  await api.handleGiftAction('promote-gift', item.id);
  assert.equal(item.metadata.promotedTaskId, undefined);
  window.HabitFlowGiftTasks.create = async () => 'task-retry';
  await api.handleGiftAction('promote-gift', item.id);
  assert.equal(item.metadata.promotedTaskId, 'task-retry');
});

function taskHarness() {
  const state = { tasks: [] };
  let saves = 0;
  const source = appSource.slice(appSource.indexOf('  async function createTaskFromGift('), appSource.indexOf('  function createTaskFromIdea('));
  const context = { state, crypto: webcrypto, TextEncoder, Uint8Array, Date,
    nowIso: () => new Date().toISOString(), normalizeTask: value => value,
    storyPointsToEffort: () => 2, normalizeTaskPriority: value => value,
    saveState: () => { saves++; }, syncWithSupabase() {}
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { create: context.createTaskFromGift, state, saves: () => saves };
}

test('task conversion includes person and notes, grants no points, and deduplicates concurrent requests', async () => {
  const { create, state, saves } = taskHarness();
  const gift = { itemId: 'gift-123', title: 'Kochkurs', person: 'Anna', note: 'Vegetarisch' };
  const ids = await Promise.all([create(gift), create(gift)]);
  assert.equal(ids[0], ids[1]);
  assert.match(ids[0], /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(state.tasks.length, 1);
  assert.equal(state.tasks[0].title, 'Geschenk für Anna: Kochkurs');
  assert.ok(state.tasks[0].description.includes('Vegetarisch'));
  assert.equal(state.tasks[0].points, 0);
  assert.equal(state.tasks[0].status, 'open');
  assert.equal(saves(), 2);
  assert.equal(await taskHarness().create(gift), ids[0], 'same gift on another device has the same task ID');
  await assert.rejects(create({ ...gift, person: ' ' }));
});
