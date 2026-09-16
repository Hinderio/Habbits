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
  const clicks = [];
  const hidden = new Set();
  const bodyClasses = new Set(['project-modal-open', 'modal-open']);
  const modal = { classList: { add: value => hidden.add(value) }, addEventListener() {} };
  const context = vm.createContext({
    Intl, console,
    window: {},
    document: {
      addEventListener(type, listener) { if (type === 'click') clicks.push(listener); },
      getElementById: () => modal,
      body: { classList: { remove: value => bodyClasses.delete(value) } }
    },
    PROJECT_ACTION_ICONS: { edit: '', trash: '' }
  });
  const functions = ['escapeHtml', 'dateLabel', 'taskDone', 'projectActionButton', 'renderProjectNote', 'renderTaskRow', 'bindEvents'];
  const closeStart = source.indexOf('  function closeDetail(');
  const closeEnd = source.indexOf('\n  async function ', closeStart);
  vm.runInContext('let selectedProjectId = "p1";\n' + functions.map(extract).join('\n') + '\n' + source.slice(closeStart, closeEnd), context);
  return { context, clicks, hidden, bodyClasses };
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
  assert.ok(html.includes('<p>' + 'a'.repeat(100) + ' Rest<br>Zweite Zeile</p>'));
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
test('opening a linked task dismisses the project overlay without unlocking the task modal', () => {
  const { context, clicks, hidden, bodyClasses } = harness();
  context.bindEvents();
  const actionEl = { dataset: { action: 'open-task-detail', id: 't1' }, closest: () => ({}) };
  clicks[0]({ target: { closest: () => actionEl } });
  assert.ok(hidden.has('hidden'));
  assert.ok(!bodyClasses.has('project-modal-open'));
  assert.ok(bodyClasses.has('modal-open'));
});
