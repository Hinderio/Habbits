const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

process.env.TZ = 'Europe/Zurich';

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'modules/lists.js'), 'utf8');
const storage = new Map();
const document = {
  visibilityState: 'visible',
  querySelector: () => null,
  getElementById: () => null,
  addEventListener: () => {},
  body: { classList: { add() {}, remove() {} } }
};
const window = {
  localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value)
  },
  addEventListener: () => {},
  setTimeout,
  clearTimeout,
  crypto: { randomUUID: () => 'test-id' }
};
vm.runInNewContext(source, {
  window,
  document,
  console,
  Date,
  Intl,
  Map,
  Set,
  Math,
  URL,
  Event,
  setTimeout,
  clearTimeout
});

const weekly = window.HabitFlowWeeklyNotes;

test('uses the local Monday as the stable week identity', () => {
  assert.equal(weekly.normalizeWeekStart(new Date(2026, 8, 13, 23, 59)), '2026-09-07');
  assert.equal(weekly.normalizeWeekStart(new Date(2026, 8, 14, 0, 0)), '2026-09-14');
  assert.equal(weekly.normalizeWeekStart('2026-09-20'), '2026-09-14');
});

test('generates exactly three past, current and three future weeks', () => {
  assert.deepEqual(
    Array.from(weekly.visibleWeekStarts(new Date(2026, 8, 9, 12))),
    ['2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']
  );
});

test('handles ISO week years across New Year including week 53', () => {
  assert.deepEqual({ ...weekly.isoWeekData(new Date(2020, 11, 28, 12)) }, { week: 53, year: 2020 });
  assert.deepEqual({ ...weekly.isoWeekData(new Date(2021, 0, 4, 12)) }, { week: 1, year: 2021 });
});

test('shows only active entries of a week and orders completed thoughts last', () => {
  const items = [
    { id: 'done', listId: 'weekly', metadata: { weekStart: '2026-09-07' }, isDone: true, isArchived: false, sortRank: 1 },
    { id: 'open', listId: 'weekly', metadata: { weekStart: '2026-09-07' }, isDone: false, isArchived: false, sortRank: 2 },
    { id: 'old', listId: 'weekly', metadata: { weekStart: '2026-08-31' }, isDone: false, isArchived: false },
    { id: 'archived', listId: 'weekly', metadata: { weekStart: '2026-09-07' }, isDone: false, isArchived: true }
  ];
  assert.deepEqual(Array.from(weekly.weeklyItemsFrom(items, '2026-09-07'), item => item.id), ['open', 'done']);
});

test('carry-over creates a new row and never moves the historical source week', () => {
  const source = {
    id: 'source',
    listId: 'weekly',
    title: 'Christoph anrufen',
    note: '',
    metadata: { weekStart: '2026-09-07' },
    isDone: false,
    isArchived: false,
    sortRank: 1,
    createdAt: '2026-09-07T08:00:00.000Z',
    updatedAt: '2026-09-07T08:00:00.000Z'
  };
  const carried = weekly.createWeeklyCarry(source, '2026-09-14', {
    id: 'copy',
    now: '2026-09-14T06:00:00.000Z',
    sortRank: 2
  });

  assert.equal(source.metadata.weekStart, '2026-09-07');
  assert.equal(carried.source.metadata.weekStart, '2026-09-07');
  assert.equal(carried.source.metadata.carriedToId, 'copy');
  assert.equal(carried.next.metadata.weekStart, '2026-09-14');
  assert.equal(carried.next.metadata.carriedFromId, 'source');
  assert.equal(carried.next.isDone, false);
});

test('newer updatedAt wins during cross-device merge and archived rows stay archived', () => {
  const local = [{ id: 'one', title: 'Lokal', isArchived: true, updatedAt: '2026-09-12T09:00:00Z' }];
  const olderRemote = [{ id: 'one', title: 'Remote', isArchived: false, updatedAt: '2026-09-12T08:00:00Z' }];
  const newerRemote = [{ id: 'one', title: 'Neu', isArchived: false, updatedAt: '2026-09-12T10:00:00Z' }];
  assert.equal(weekly.mergeById(local, olderRemote)[0].isArchived, true);
  assert.equal(weekly.mergeById(local, newerRemote)[0].title, 'Neu');
});

test('weekly stays a generic default list backed by custom list item metadata', () => {
  assert.match(source, /id:\s*WEEKLY_LIST_ID[^\n]+type:\s*'generic'/);
  assert.match(source, /metadata:\s*\{\s*weekStart\s*\}/);
  assert.doesNotMatch(source, /weekly_notes/);
});
