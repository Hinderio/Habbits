const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.resolve(__dirname, '../modules/lists.js'), 'utf8');
function harness() {
  let failed = false, serial = 0;
  const storage = new Map();
  const message = {};
  const syncs = [];
  const document = {
    querySelector: selector => selector === '[data-event-message]' ? message : null,
    getElementById: () => null, addEventListener() {},
    body: { classList: { add() {}, remove() {} } }
  };
  const window = {
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => { if (failed) throw new Error('full'); storage.set(key, value); } },
    addEventListener() {}, crypto: { randomUUID: () => String(++serial) }, confirm: () => true,
    requestAnimationFrame: callback => callback(), setTimeout, clearTimeout
  };
  const hook = 'syncToSupabase = items => syncs.push(items); window.eventsTest = { saveEventIdea, handleEventIdeaAction, renderEventIdeas, renderCards, state: () => state, normalizeState };';
  vm.runInNewContext(source.replace('})(window, document);', hook + '\n})(window, document);'), {
    window, document, console, Date, Intl, Map, Set, Math, URL, Event, setTimeout, clearTimeout, syncs,
    FormData: class { constructor(form) { this.values = form.values; } get(key) { return this.values[key]; } }
  });
  const form = (values, id = '') => ({ values, dataset: { editingId: id } });
  return { api: window.eventsTest, form, storage, message, syncs, fail: () => { failed = true; } };
}
test('new default event list uses existing generic schema and preserves existing lists', () => {
  const { api } = harness();
  const state = api.normalizeState({ lists: [{ id: 'finance', title: 'Finanzen' }], items: [{ id: 'keep', listId: 'gifts' }] });
  assert.equal(state.lists.filter(list => list.id === 'event-ideas').length, 1);
  assert.equal(state.lists.find(list => list.id === 'event-ideas').type, 'generic');
  assert.equal(state.lists.find(list => list.id === 'event-ideas').color, '#A5AD56');
  assert.equal(state.items[0].id, 'keep');
  assert.equal(state.lists.find(list => list.id === 'finance').color, '#713B89');
});
test('ideas persist category, place and notes and are editable without duplication', () => {
  const { api, form, storage, syncs } = harness();
  api.saveEventIdea(form({ title: 'Kino', metaA: 'Kultur', metaB: 'Zürich', note: 'Mit Freunden' }));
  const item = api.state().items[0];
  assert.equal(item.listId, 'event-ideas');
  assert.equal(item.metadata.metaB, 'Zürich');
  api.handleEventIdeaAction('edit-item', item.id);
  assert.match(api.renderEventIdeas(), /value="Kino"/);
  api.saveEventIdea(form({ title: 'Open-Air-Kino', metaA: 'Outdoor', metaB: 'Park', note: 'Im Sommer' }, item.id));
  assert.equal(api.state().items.length, 1);
  assert.equal(JSON.parse(storage.get('habitflow-lists-v1')).items[0].note, 'Im Sommer');
  assert.equal(syncs.length, 2);
});
test('event ideas can be checked off and archived independently', () => {
  const { api, form } = harness();
  api.saveEventIdea(form({ title: 'Kino' }));
  const id = api.state().items[0].id;
  api.handleEventIdeaAction('toggle-item', id);
  assert.equal(api.state().items[0].isDone, true);
  api.handleEventIdeaAction('delete-item', id);
  assert.equal(api.state().items[0].isArchived, true);
  assert.match(api.renderEventIdeas(), /Noch keine Eventideen/);
});
test('missing title, stale edits and failed writes do not add or overwrite items', () => {
  const { api, form, fail, message } = harness();
  api.saveEventIdea(form({ title: ' ' }));
  api.saveEventIdea(form({ title: 'Stale' }, 'missing'));
  assert.equal(api.state().items.length, 0);
  api.saveEventIdea(form({ title: 'Keep me' }));
  fail();
  api.saveEventIdea(form({ title: 'Overwrite' }, api.state().items[0].id));
  assert.equal(api.state().items[0].title, 'Keep me');
  assert.equal(message.hidden, false);
});
test('event content is escaped and finance card uses its compact caption', () => {
  const { api, form } = harness();
  api.saveEventIdea(form({ title: '<script>bad</script>', metaB: '" onclick="bad' }));
  const html = api.renderEventIdeas();
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
  const target = {};
  api.renderCards(target);
  assert.match(target.innerHTML, /Finanzübersicht/);
  assert.doesNotMatch(target.innerHTML, /Werte &amp; Verpflichtungen/);
  assert.match(target.innerHTML, /data-list-open="event-ideas"/);
});
