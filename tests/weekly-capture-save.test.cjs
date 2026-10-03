const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.resolve(__dirname, '../modules/lists.js'), 'utf8');

function harness({ localFails = false, noSession = false, noClient = false, remoteError = false, noAck = false, wait = null } = {}) {
  const storage = new Map([['habitflow-lists-v1', JSON.stringify({ activeListId: 'weekly', items: [{ id: 'existing', listId: 'gifts', title: 'Keep me' }] })]]);
  const remoteRows = [], syncs = [];
  let resets = 0, serial = 0, rejectRemote = remoteError;
  const message = { textContent: '', hidden: true }, button = { disabled: false };
  const form = {
    dataset: { weekStart: '2026-09-28' },
    elements: { title: { value: 'Mobile Notiz', disabled: false } },
    querySelector: selector => selector.includes('button') ? button : message,
    reset() { resets++; this.elements.title.value = ''; }
  };
  const client = {
    auth: { getSession: async () => ({ data: { session: noSession ? null : { user: { id: 'user-1' } } } }) },
    from: table => {
      assert.equal(table, 'custom_list_items');
      return { upsert: (row, options) => {
        remoteRows.push(row);
        assert.equal(options.onConflict, 'user_id,id');
        return { select: field => {
          assert.equal(field, 'id');
          return { single: async () => {
            if (wait) await wait;
            return rejectRemote ? { error: new Error('network') } : { data: noAck ? null : { id: row.id } };
          } };
        } };
      } };
    }
  };
  const document = {
    querySelector: () => null, querySelectorAll: () => [form], getElementById: () => null,
    addEventListener() {}, body: { classList: { add() {}, remove() {} } }
  };
  const window = {
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => { if (localFails) throw new Error('QuotaExceeded'); storage.set(key, value); }
    },
    crypto: { randomUUID: () => String(++serial) },
    addEventListener() {}, setTimeout: callback => { callback(); }, clearTimeout() {}
  };
  const hook = 'getClient = async () => testClient; syncToSupabase = items => testSyncs.push(items); window.captureTest = { saveWeeklyThought, renderWeeklyWeekCard, drafts: weeklyCaptureDrafts, state: () => state };';
  vm.runInNewContext(source.replace('})(window, document);', hook + '\n})(window, document);'), {
    window, document, console, Date, Intl, Map, Set, Math, URL, Event, setTimeout, clearTimeout,
    testClient: noClient ? null : client, testSyncs: syncs
  });
  return { api: window.captureTest, form, message, button, storage, remoteRows, syncs, resets: () => resets, allowRemote: () => { rejectRemote = false; } };
}

test('normal capture is persisted before reset and uses existing targeted synchronization', async () => {
  const h = harness();
  await h.api.saveWeeklyThought(h.form);
  const stored = JSON.parse(h.storage.get('habitflow-lists-v1'));
  assert.equal(stored.items.length, 2);
  assert.equal(stored.items[1].title, 'Mobile Notiz');
  assert.equal(stored.items[1].metadata.weekStart, '2026-09-28');
  assert.equal(h.resets(), 1);
  assert.equal(h.syncs.length, 1);
  assert.equal(h.remoteRows.length, 0);
});
test('failed device write saves only the new note remotely before clearing input', async () => {
  const h = harness({ localFails: true });
  await h.api.saveWeeklyThought(h.form);
  assert.equal(h.remoteRows.length, 1);
  assert.equal(h.remoteRows[0].user_id, 'user-1');
  assert.equal(h.remoteRows[0].list_id, 'weekly');
  assert.equal(h.api.state().items.length, 2);
  assert.equal(h.api.state().items[0].title, 'Keep me');
  assert.equal(h.resets(), 1);
  assert.equal(h.syncs.length, 0);
});
test('failed local and remote persistence retain input and do not publish a phantom note', async () => {
  const h = harness({ localFails: true, remoteError: true });
  await h.api.saveWeeklyThought(h.form);
  assert.equal(h.form.elements.title.value, 'Mobile Notiz');
  assert.equal(h.resets(), 0);
  assert.equal(h.api.state().items.length, 1);
  assert.equal(h.message.hidden, false);
  assert.match(h.message.textContent, /Nicht gespeichert/);
  assert.equal(h.button.disabled, false);
});
test('no session, no client or missing server acknowledgement never clears the input', async () => {
  for (const options of [{ noSession: true }, { noClient: true }, { noAck: true }]) {
    const h = harness({ localFails: true, ...options });
    await h.api.saveWeeklyThought(h.form);
    assert.equal(h.resets(), 0);
    assert.equal(h.form.elements.title.value, 'Mobile Notiz');
    assert.equal(h.api.state().items.length, 1);
  }
});
test('retry reuses the same note ID after ambiguous remote failure', async () => {
  const h = harness({ localFails: true, remoteError: true });
  await h.api.saveWeeklyThought(h.form);
  h.allowRemote();
  await h.api.saveWeeklyThought(h.form);
  assert.equal(h.remoteRows[0].id, h.remoteRows[1].id);
  assert.equal(h.resets(), 1);
  assert.equal(h.api.state().items.length, 2);
});
test('double submit while saving does not duplicate and draft survives a render', async () => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const h = harness({ localFails: true, wait });
  const first = h.api.saveWeeklyThought(h.form);
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  await h.api.saveWeeklyThought(h.form);
  assert.equal(h.resets(), 0);
  assert.equal(h.form.elements.title.value, 'Mobile Notiz');
  const html = h.api.renderWeeklyWeekCard('2026-09-28');
  assert.match(html, /value="Mobile Notiz" disabled/);
  h.api.state().items.push({ id: 'concurrent', listId: 'weekly', title: 'Another remote note' });
  release(); await first;
  assert.equal(h.remoteRows.length, 1);
  assert.equal(h.api.state().items.length, 3);
});
