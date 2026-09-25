const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const domain = require('../modules/weekly-points-domain.js');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const renderer = fs.readFileSync(path.join(__dirname, '../modules/weekly-points.js'), 'utf8');
const now = new Date('2026-09-25T12:00:00Z');
const point = (id, points, extra = {}) => ({ id, source_type: 'bonus', source_id: id, points, earned_at: '2026-09-22T12:00:00Z', reason: id, ...extra });
const latest = input => domain.build({ now, ...input }).weeks.at(-1);
test('ISO weeks use Monday and preserve ISO year across January', () => {
  assert.deepEqual(domain.weekLabel(domain.monday('2021-01-01T12:00:00Z')), { year: 2020, number: 53 });
  assert.deepEqual(domain.weekLabel(domain.monday('2021-01-04T12:00:00Z')), { year: 2021, number: 1 });
  const sunday = domain.monday('2026-03-29T12:00:00Z');
  const monday = domain.monday('2026-03-30T12:00:00Z');
  assert.equal(monday - sunday, 7 * 86400000);
});
test('groups habit logs per week while keeping tasks separate and signs unnetted', () => {
  const week = latest({
    habits: [{ id: 'habit', name: 'Engagement', is_archived: true }],
    entries: [{ id: 'a', habit_id: 'habit' }, { id: 'b', habit_id: 'habit' }, { id: 'c', habit_id: 'habit' }],
    tasks: [{ id: 'task1', title: 'Task One' }, { id: 'task2', title: 'Task Two' }],
    ledger: [point('p1', 10, { source_type: 'habit', source_id: 'a' }), point('p2', 30, { source_type: 'habit', source_id: 'b' }),
      point('p3', -5, { source_type: 'habit', source_id: 'c' }), point('p4', 20, { source_type: 'task', source_id: 'task1' }),
      point('p5', 50, { source_type: 'task', source_id: 'task2' })]
  });
  assert.equal(week.positive.length, 3);
  assert.deepEqual(week.positive.map(item => item.points), [20, 40, 50]);
  assert.equal(week.positive[1].label, 'Engagement');
  assert.equal(week.positive[1].logs, 2);
  assert.equal(week.negative[0].points, -5);
  assert.equal(week.positivePoints, 110);
  assert.equal(week.negativePoints, -5);
});
test('smoking and alcohol use separate signed weekly squares', () => {
  const week = latest({ ledger: [point('s1', 5, { source_type: 'cigarette' }), point('s2', -10, { source_type: 'cigarette' }),
    point('a1', -20, { reason: 'Alkohol: Bier' }), point('a2', -50, { reason: 'Alkohol-Tag: hoch' })] });
  assert.equal(week.positive.length, 1);
  assert.equal(week.negative.length, 2);
  assert.equal(week.negative[1].label, 'Alkohol');
  assert.equal(week.negative[1].points, -70);
});
test('skips zero, invalid, future, out-of-range and duplicate ledger IDs', () => {
  const ledger = [point('valid', 30), point('valid', 30), point('zero', 0), point('nan', 'bad'), point('infinite', Infinity),
    point('invalid', 12, { earned_at: 'invalid' }), point('future', 50, { earned_at: '2026-09-26T12:00:00Z' }),
    point('old', 100, { earned_at: '2020-01-01T12:00:00Z' })];
  assert.equal(latest({ ledger }).positivePoints, 30);
});
test('navigation gives 52 disjoint weeks and never adds future weeks', () => {
  const current = domain.build({ now, count: 52 });
  const previous = domain.build({ now, count: 52, offset: 52 });
  assert.equal(current.weeks.length, 52);
  assert.equal(previous.weeks.at(-1).start + 7 * 86400000, current.weeks[0].start);
  assert.equal(current.weeks.at(-1).start, domain.monday(now));
  assert.equal(domain.build({ now, offset: -10 }).offset, 0);
});
test('sorting and colors reflect magnitude without mutating input', () => {
  const ledger = Object.freeze([Object.freeze(point('big', 300)), Object.freeze(point('small', 5)), Object.freeze(point('negative', -100))]);
  assert.deepEqual(latest({ ledger }).positive.map(item => item.points), [5, 300]);
  assert.notEqual(domain.color(5), domain.color(300));
  assert.notEqual(domain.color(-5), domain.color(-300));
  assert.notEqual(domain.color(30), domain.color(-30));
  assert.equal(ledger[0].id, 'big');
});
test('100k ledger rows are scanned once and use bounded week buckets', () => {
  let reads = 0;
  const ledger = Array.from({ length: 100000 }, (_, i) => ({ ...point('p' + i, i % 2 ? -1 : 1, { source_type: 'cigarette' }) }));
  const counted = new Proxy(ledger, { get(target, key) { if (/^[0-9]+$/.test(String(key))) reads++; return target[key]; } });
  const begin = performance.now();
  const model = domain.build({ now, ledger: counted, count: 52 });
  assert.equal(reads, 100000);
  assert.equal(model.weeks.length, 52);
  assert.equal(model.weeks.at(-1).positivePoints, 50000);
  assert.equal(model.weeks.at(-1).negativePoints, -50000);
  console.log('100k rows: ' + Math.round(performance.now() - begin) + ' ms');
});
test('heatmap is moved once to Habits, retaining its original structure and independent controls', () => {
  const dashboard = html.slice(html.indexOf('id="screen-dashboard"'), html.indexOf('id="screen-smoking"'));
  const habits = html.slice(html.indexOf('id="screen-habits"'), html.indexOf('id="screen-fitness"'));
  assert.equal((html.match(/id="habitHeatmap"/g) || []).length, 1);
  assert.ok(!dashboard.includes('id="habitHeatmap"'));
  assert.ok(habits.includes('class="panel glass dashboard-history-heatmap"'));
  assert.ok(habits.includes('id="habitChartPrevWindowBtn"'));
  assert.ok(dashboard.includes('id="weeklyPointsPanel"'));
  assert.ok(dashboard.includes('id="chartPrevWindowBtn"'));
  assert.ok(app.includes('function renderHabitHeatmap(keys = daysBack(14, habitChartOffsetDays))'));
  const move = app.match(/  function moveDashboardChartWindow[^]*?\n  \}/)[0];
  assert.ok(!move.includes('renderHabitHeatmap'));
  assert.ok(move.includes('renderCharts(keys)'));
});
test('canvas rendering is coalesced, signed, keyboard-accessible and escapes labels', () => {
  const frames = [], rectangles = [], labels = [], nodes = new Map();
  let builds = 0, fills = '', width = 960, mobile = false;
  const ctx = { scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fillText(text, x, y) { labels.push({ text, x, y }); },
    set fillStyle(value) { fills = value; }, fillRect(x, y, w, h) { rectangles.push({ x, y, w, h, color: fills }); } };
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { style: {}, listeners: {}, attrs: {}, hidden: false, clientWidth: width,
      addEventListener(name, fn) { this.listeners[name] = fn; },
      setAttribute(name, value) { this.attrs[name] = value; },
      querySelectorAll() { return []; }, querySelector() { return null; },
      getBoundingClientRect() { return { width, left: 0, top: 0 }; }, getContext() { return ctx; } });
    return nodes.get(id);
  }
  const root = node('root');
  root.querySelector = selector => node(selector.slice(1));
  const window = { matchMedia: () => ({ matches: mobile }), devicePixelRatio: 2, HabitFlowWeeklyPointsDomain: { ...domain, build(data) { builds++; return domain.build({ ...data, now }); } } };
  const sandbox = { window, document: { getElementById: () => root }, requestAnimationFrame(fn) { frames.push(fn); return frames.length; },
    getComputedStyle() { return { getPropertyValue: () => '#607080' }; }, ResizeObserver: class { observe() {} }, console };
  vm.runInNewContext(renderer, sandbox);
  const data = { ledger: [point('good', 30, { reason: '<img onerror=bad>' }), point('bad', -30)] };
  window.HabitFlowWeeklyPoints.render(data);
  window.HabitFlowWeeklyPoints.render(data);
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(builds, 1);
  const green = rectangles.find(rect => rect.color === domain.color(30));
  const red = rectangles.find(rect => rect.color === domain.color(-30));
  assert.ok(green.y < 235);
  assert.ok(red.y > 235);
  assert.equal(green.w, green.h);
  assert.equal(node('weeklyPointsCanvas').width, 1916);
  assert.equal(node('weeklyPointsCanvas').height, 920);
  const positiveLabel = labels.find(label => label.text === 'Positiv');
  const yearLabel = labels.find(label => label.text === '2025');
  assert.ok(yearLabel.y - positiveLabel.y >= 14, 'year and positive label have separate baselines');
  assert.ok(yearLabel.x - positiveLabel.x >= 30, 'year is also horizontally separated');
  for (const nextWidth of [1180, 849.5, 780, 640]) {
    width = nextWidth;
    window.HabitFlowWeeklyPoints.render(data);
    frames.shift()();
    assert.ok(parseFloat(node('weeklyPointsCanvas').style.width) < width, 'desktop canvas fits without overflow');
    assert.equal(node('weeklyPointsWeeks').style.width, node('weeklyPointsCanvas').style.width);
  }
  mobile = true;
  width = 360;
  window.HabitFlowWeeklyPoints.render(data);
  frames.shift()();
  assert.equal(node('weeklyPointsCanvas').style.width, '850px', 'mobile keeps readable swipe navigation');
  mobile = false;
  width = 960;
  assert.ok(node('weeklyPointsItems').innerHTML.includes('&lt;img onerror=bad&gt;'));
  assert.ok(!node('weeklyPointsItems').innerHTML.includes('<img'));
  node('weeklyPointsCanvas').listeners.keydown({ key: 'Home', target: node('weeklyPointsCanvas'), preventDefault() {} });
  assert.ok(node('weeklyPointsSelection').textContent.includes('KW'));
  assert.ok(node('weeklyPointsCanvas').attrs['aria-label'].includes('Pfeiltasten'));
  node('weeklyPointsPrev').listeners.click();
  frames.shift()();
  assert.equal(node('weeklyPointsNext').disabled, false);
  node('weeklyPointsToday').listeners.click();
  frames.shift()();
  assert.equal(node('weeklyPointsNext').disabled, true);
  node('weeklyPointsSelect').listeners.change({ target: { value: '0' } });
  assert.equal(node('weeklyPointsDetail').open, true);
  assert.equal(node('weeklyPointsSelect').value, '0');
  window.HabitFlowWeeklyPoints.render({ ledger: [] });
  frames.shift()();
  assert.ok(node('weeklyPointsItems').innerHTML.includes('Keine Punktebuchungen'));
});

test('only the legend ramp gets twenty percent transparency', () => {
  const css = fs.readFileSync(path.join(__dirname, '../modules/weekly-points.css'), 'utf8');
  const ramp = css.match(/\.weekly-points-legend i \{([^}]+)\}/)[1];
  assert.ok(ramp.includes('opacity: .8'));
  assert.ok(!renderer.includes('globalAlpha'));
});
