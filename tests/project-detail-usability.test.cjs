const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../modules/projects.js'), 'utf8');
function extract(name) {
  const start = source.indexOf('  function ' + name + '(');
  assert.notEqual(start, -1);
  const end = source.indexOf('\n  function ', start + 1);
  return source.slice(start, end);
}
function harness() {
  const clicks = [], keys = [], observers = [];
  const hidden = new Set();
  const taskClasses = new Set();
  const bodyClasses = new Set(['project-modal-open', 'modal-open']);
  const classes = set => ({
    add: value => set.add(value), remove: value => set.delete(value), contains: value => set.has(value)
  });
  const card = { scrollTop: 420 };
  const modal = { classList: classes(hidden), scrollTop: 180, addEventListener() {},
    querySelector: () => card, querySelectorAll: () => [] };
  const taskModal = { classList: classes(taskClasses) };
  const context = vm.createContext({
    Intl, console,
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() { this.active = true; }
      disconnect() { this.active = false; }
    },
    window: {},
    document: {
      addEventListener(type, listener, capture) {
        if (type === 'click') clicks.push({ listener, capture });
        if (type === 'keydown') keys.push(listener);
      },
      getElementById: id => id === 'taskDetailModal' ? taskModal : modal,
      body: { classList: classes(bodyClasses) }
    },
    PROJECT_ACTION_ICONS: { edit: '', trash: '' }
  });
  const functions = ['escapeHtml', 'dateLabel', 'taskDone', 'projectActionButton', 'renderProjectNote',
    'renderTaskRow', 'suspendProjectForTask', 'clearProjectTaskReturn', 'bindEvents'];
  const closeStart = source.indexOf('  function closeDetail(');
  const closeEnd = source.indexOf('\n  async function ', closeStart);
  vm.runInContext('let selectedProjectId = "p1", projectTaskReturn = null;\n' + functions.map(extract).join('\n') + '\n' + source.slice(closeStart, closeEnd), context);
  let focused = false;
  const trigger = { dataset: { action: 'open-task-detail', id: 't1' }, isConnected: true,
    closest: () => ({}), focus(options) { focused = options.preventScroll; } };
  context.bindEvents();
  return { context, hidden, bodyClasses, card, modal, taskClasses, keys, trigger,
    get focused() { return focused; },
    open() { clicks.filter(item => !item.capture).forEach(item => item.listener({ target: { closest: () => trigger } })); },
    flush() { observers.filter(observer => observer.active).forEach(observer => observer.callback()); },
    edit() { clicks.filter(item => item.capture).forEach(item => item.listener({ target: { closest: () => ({}) } })); }
  };
}

test('short notes and exactly 100 characters stay fully visible without disclosure', () => {
  const { context } = harness();
  for (const body of ['Kurze Notiz', 'ä'.repeat(100)]) {
    const html = context.renderProjectNote({ body, category: 'Test' });
    assert.ok(html.includes(body));
    assert.ok(!html.includes('<details'));
  }
});
test('long notes show 100 characters and preserve the full text for expansion', () => {
  const { context } = harness();
  const note = { body: 'a'.repeat(100) + ' Rest\nZweite Zeile', category: 'Test' };
  const before = JSON.stringify(note);
  const html = context.renderProjectNote(note);
  assert.ok(html.includes('<span class="project-note-preview">' + 'a'.repeat(100) + '…</span>'));
  assert.ok(html.includes('<p tabindex="0" aria-label="Vollständige Notiz">' + 'a'.repeat(100) + ' Rest<br>Zweite Zeile</p>'));
  assert.ok(html.includes('Mehr anzeigen') && html.includes('Weniger anzeigen'));
  assert.ok(!/<details[^>]*\sopen(?:\s|>)/.test(html));
  assert.equal(JSON.stringify(note), before);
});
test('preview respects emoji and combining characters; note content is escaped', () => {
  const { context } = harness();
  const unit = '👨‍👩‍👧‍👦';
  const html = context.renderProjectNote({ body: unit.repeat(100) + '<script>alert(1)</script>', category: '"<test>' });
  assert.ok(html.includes(unit.repeat(100) + '…</span>'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  const combined = context.renderProjectNote({ body: 'e\u0301'.repeat(100) });
  assert.ok(!combined.includes('<details'));
});
test('open and unlink remain distinct actions, including completed tasks', () => {
  const { context } = harness();
  const html = context.renderTaskRow({ id: 'task"1', title: '<Aufgabe>', status: 'done' });
  assert.ok(html.includes('data-action="open-task-detail" data-id="task&quot;1"'));
  assert.ok(html.includes('data-action="unlink-task" data-id="task&quot;1"'));
  assert.ok(html.includes('is-done'));
  assert.ok(!html.includes('disabled'));
  assert.ok(html.includes('&lt;Aufgabe&gt;'));
});
test('closing a linked task returns to the same project with scroll and focus restored', () => {
  const app = harness();
  app.open();
  assert.ok(app.hidden.has('hidden'));
  assert.ok(!app.bodyClasses.has('project-modal-open'));
  assert.ok(app.bodyClasses.has('modal-open'));
  assert.equal(vm.runInContext('selectedProjectId', app.context), 'p1');
  app.card.scrollTop = 0;
  app.modal.scrollTop = 0;
  app.taskClasses.add('hidden');
  app.bodyClasses.delete('modal-open');
  app.flush();
  assert.ok(!app.hidden.has('hidden'));
  assert.ok(app.bodyClasses.has('project-modal-open'));
  assert.equal(app.card.scrollTop, 420);
  assert.equal(app.modal.scrollTop, 180);
  assert.ok(app.focused);
});
test('Escape dismisses only the task before the observer restores the project', () => {
  const app = harness();
  app.open();
  app.taskClasses.add('hidden');
  app.keys.forEach(listener => listener({ key: 'Escape' }));
  app.flush();
  assert.ok(!app.hidden.has('hidden'));
  assert.equal(vm.runInContext('selectedProjectId', app.context), 'p1');
});
test('editing or explicitly closing the project cancels pending return', () => {
  for (const action of ['edit', 'close']) {
    const app = harness();
    app.open();
    if (action === 'edit') app.edit();
    else app.context.closeDetail({ skipSync: true });
    app.taskClasses.add('hidden');
    app.flush();
    assert.ok(app.hidden.has('hidden'));
    assert.equal(vm.runInContext('selectedProjectId', app.context), '');
  }
});
test('a task that could not open leaves the project visible', () => {
  const app = harness();
  app.taskClasses.add('hidden');
  app.open();
  assert.ok(!app.hidden.has('hidden'));
  assert.equal(vm.runInContext('projectTaskReturn', app.context), null);
});
test('preview collapses blank lines while the full note retains formatting', () => {
  const { context } = harness();
  const body = 'Mittwoch ZHAW:\n\n\nPräsentation:\n\n' + 'Text '.repeat(30);
  const html = context.renderProjectNote({ body, category: 'Antrag' });
  const preview = html.match(/class="project-note-preview">([^<]*)<\/span>/)[1];
  assert.ok(preview.startsWith('Mittwoch ZHAW: Präsentation: Text'));
  assert.ok(html.includes('Mittwoch ZHAW:<br><br><br>Präsentation:<br><br>'));
});
