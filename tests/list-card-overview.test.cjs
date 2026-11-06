const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.resolve(__dirname, '../modules/lists.js'), 'utf8');
function harness(raw = {}) {
 const window = { localStorage: { getItem: key => key === 'habitflow-lists-v1' ? JSON.stringify(raw) : null }, addEventListener() {}, setTimeout, clearTimeout };
 const document = { querySelector: () => null, getElementById: () => null, addEventListener() {}, body: { classList: { add() {}, remove() {} } } };
 const hook = 'window.cardTest = { renderCards, currentWeekStartKey };';
 vm.runInNewContext(source.replace('})(window, document);', hook + '\n})(window, document);'), { window, document, console, Date, Intl, Map, Set, Math, URL, Event, setTimeout, clearTimeout });
 const target = {};
 window.cardTest.renderCards(target);
 return { html: target.innerHTML, week: window.cardTest.currentWeekStartKey() };
}
const card = (html, id) => html.split('<article').find(part => part.includes('data-list-open="' + id + '"'));
test('each overview card has exactly one compact count before the card copy', () => {
 const { html } = harness();
 for (const entry of html.split('<article').slice(1)) {
   assert.equal((entry.match(/class="hf-list-card-stat"/g) || []).length, 1);
   assert.ok(entry.indexOf('hf-list-card-stat') < entry.indexOf('hf-list-card-copy'));
 }
});
test('photo count labels spots rather than combining spots and tours', () => {
 const { html } = harness({ stops: [{ id: 'a' }, { id: 'b' }, { id: 'archived', isArchived: true }], tours: [{ id: 'tour' }] });
 assert.match(card(html, 'photos'), /aria-label="2 Spots"/);
 assert.match(card(html, 'photos'), /<b>2<\/b><small>Spots<\/small>/);
 assert.doesNotMatch(card(html, 'photos'), /1 Touren/);
});
test('counts keep zero, singular, completed entries and large absolute numbers', () => {
 const { html } = harness({ items: [{ id: 'one', listId: 'gifts', isDone: true }, ...Array.from({ length: 1001 }, (_, i) => ({ id: String(i), listId: 'weblinks' }))] });
 assert.match(card(html, 'gifts'), /aria-label="1 Eintrag"/);
 assert.match(card(html, 'shopping'), /aria-label="0 Einträge"/);
 assert.match(card(html, 'weblinks'), /<b>1001<\/b>/);
});
test('weekly count keeps its current-week open-note meaning', () => {
 const week = harness().week;
 const { html } = harness({ items: [
  { id: 'a', listId: 'weekly', metadata: { weekStart: week } },
  { id: 'b', listId: 'weekly', metadata: { weekStart: week }, isDone: true },
  { id: 'c', listId: 'weekly', metadata: { weekStart: '2020-01-06' } }
 ] });
 assert.match(card(html, 'weekly'), /aria-label="1 offen diese Woche"/);
});
test('short descriptions appear even when old built-in copy is stored', () => {
 const { html } = harness({ lists: [{ id: 'photos', description: 'OLD COPY' }] });
 assert.match(card(html, 'photos'), /Fotospots sammeln und Touren planen/);
 assert.doesNotMatch(card(html, 'photos'), /OLD COPY/);
});
