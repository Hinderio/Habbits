const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.resolve(__dirname, '../modules/lists.js'), 'utf8');

function harness(raw = {}) {
  const storage = new Map([['habitflow-lists-v1', JSON.stringify(raw)]]);
  const nodes = { hfWeblinkResults: {}, hfWeblinkCount: {}, hfWeblinkMessage: {} };
  const listeners = {};
  let serial = 0;
  const document = {
    querySelector: () => null, getElementById: id => nodes[id] || null,
    addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); },
    body: { classList: { add() {}, remove() {} } }
  };
  const window = {
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    crypto: { randomUUID: () => String(++serial) }, addEventListener() {},
    setTimeout, clearTimeout, confirm: () => true,
    navigator: { clipboard: { writeText: async url => { window.copied = url; } } }
  };
  const hooks = 'window.testLinks = { validatedWeblinkUrl, saveWeblink, handleWeblinkAction, renderWeblinkResults, filteredWeblinks, getState: () => state };';
  vm.runInNewContext(source.replace('})(window, document);', hooks + '\n})(window, document);'), {
    window, document, console, Date, Intl, Map, Set, Math, URL, Event, setTimeout, clearTimeout,
    FormData: class { constructor(form) { this.values = form.values; } get(name) { return this.values[name]; } }
  });
  const form = (values, id = '') => ({ values, dataset: { editingId: id }, reset() {}, elements: { url: { focus() {} } } });
  return { api: window.testLinks, window, nodes, listeners, form, storage };
}

test('normalizes web addresses and rejects unsafe protocols or embedded credentials', () => {
  const { api } = harness();
  assert.equal(api.validatedWeblinkUrl('www.example.com'), 'https://www.example.com/');
  assert.equal(api.validatedWeblinkUrl('https://EXAMPLE.com:443/a?q=x#section'), 'https://example.com/a?q=x#section');
  for (const url of ['javascript:alert(1)', 'data:text/html,bad', 'file:///tmp/a', 'https://user:secret@example.com', 'https://', 'https://exam ple.com']) {
    assert.equal(api.validatedWeblinkUrl(url), '', url);
  }
});

test('saves, prevents duplicate normalized URLs, edits without losing favorite, and archives', async () => {
  const { api, form } = harness();
  api.saveWeblink(form({ url: 'example.com', category: 'Arbeit' }));
  const item = api.getState().items[0];
  assert.equal(item.title, 'example.com');
  api.saveWeblink(form({ url: 'https://example.com/' }));
  assert.equal(api.getState().items.length, 1);
  await api.handleWeblinkAction('favorite-weblink', item.id);
  api.saveWeblink(form({ url: 'https://example.com/new', title: 'Neu', category: 'Wissen', note: 'Merken' }, item.id));
  assert.equal(item.metadata.favorite, true);
  assert.equal(item.title, 'Neu');
  assert.equal(item.note, 'Merken');
  await api.handleWeblinkAction('delete-weblink', item.id);
  assert.equal(api.filteredWeblinks().length, 0);
  assert.equal(item.isArchived, true);
});

test('search, category and favorite filters combine without resetting the editor', async () => {
  const { api, form, listeners, nodes } = harness();
  api.saveWeblink(form({ url: 'https://a.example', title: 'Alpha', category: 'Arbeit', note: 'Projekt' }));
  api.saveWeblink(form({ url: 'https://b.example', title: 'Beta', category: 'Privat' }));
  const first = api.getState().items[0];
  await api.handleWeblinkAction('favorite-weblink', first.id);
  const fire = (type, selector, props) => listeners[type].forEach(fn => fn({ target: {
    matches: s => s === selector, closest: () => null, ...props
  } }));
  fire('input', '#hfWeblinkSearch', { value: 'PROJEKT' });
  assert.equal(api.filteredWeblinks().length, 1);
  fire('change', '#hfWeblinkCategory', { value: 'Privat' });
  assert.equal(api.filteredWeblinks().length, 0);
  fire('change', '#hfWeblinkCategory', { value: 'Arbeit' });
  fire('change', '#hfWeblinkFavorites', { checked: true });
  assert.equal(api.filteredWeblinks()[0].id, first.id);
  assert.equal(nodes.hfWeblinkCount.textContent, '1 von 2 Links');
});

test('uses task link styling, escapes saved content and copies the validated URL', async () => {
  const { api, form, window } = harness();
  api.saveWeblink(form({ url: 'https://example.com/?a=1&b=2', title: '<img src=x>', note: '<script>bad</script>' }));
  const item = api.getState().items[0];
  const html = api.renderWeblinkResults();
  assert.ok(html.includes('class="task-inline-link"'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
  assert.ok(html.includes('&lt;img src=x&gt;'));
  assert.ok(!html.includes('<script>'));
  await api.handleWeblinkAction('copy-weblink', item.id);
  assert.equal(window.copied, 'https://example.com/?a=1&b=2');
});

test('gift color migration preserves the existing gift and its task link', () => {
  const gift = { id: 'gift-1', listId: 'gifts', title: 'Buch', metadata: { person: 'Anna', promotedTaskId: 'task-1' } };
  const { api } = harness({ lists: [{ id: 'gifts', color: '#E49767' }], items: [gift] });
  assert.equal(api.getState().lists.find(list => list.id === 'gifts').color, '#587E99');
  assert.equal(api.getState().lists.find(list => list.id === 'weblinks').color, '#AF4360');
  assert.equal(JSON.stringify(api.getState().items[0]), JSON.stringify(gift));
});
