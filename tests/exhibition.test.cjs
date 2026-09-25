const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.resolve(__dirname, '../modules/exhibition.js'), 'utf8');
const lists = fs.readFileSync(path.resolve(__dirname, '../modules/lists.js'), 'utf8');
const validImage = 'data:image/webp;base64,AAAA';

function harness() {
  const storage = new Map();
  let failWrite = false, closed = 0, serial = 0;
  const canvas = { width: 0, height: 0, getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => validImage };
  const document = {
    querySelector: () => null, getElementById: () => null,
    createElement: () => canvas, addEventListener() {},
    body: { classList: { add() {}, remove() {} } }
  };
  const window = {
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => { if (failWrite) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); storage.set(key, value); } },
    createImageBitmap: async () => ({ width: 4000, height: 2000, close() { closed++; } }),
    addEventListener() {}, setTimeout, clearTimeout, crypto: { randomUUID: () => String(++serial) }
  };
  const context = { window, document, console, URL, Date, Intl, Map, Set, Math, Event, setTimeout, clearTimeout };
  vm.runInNewContext(source, context);
  vm.runInNewContext(lists.replace('})(window, document);', 'window.exTest = { saveExhibition, getState: () => state, normalizeState };\n})(window, document);'), context);
  return { api: window.HabitFlowExhibition, integration: window.exTest, canvas, window, storage, setFailure: value => { failWrite = value; }, closed: () => closed };
}
const input = () => ({ title: 'Barcelona', note: 'Neue Perspektiven', metadata: { image: validImage, style: 'poster', font: 'serif', tone: 'red', monochrome: true } });

test('unknown typography values fall back to whitelisted classes', () => {
  const { api } = harness();
  assert.deepEqual({ ...api.normalize({ font: '__proto__', style: '<script>', tone: 'constructor' }) }, { font: 'sans', style: 'poster', tone: 'white', color: '#ffffff', brightness: 100, monochrome: false });
});
test('poster escapes text and rejects external or executable image sources', () => {
  const { api } = harness();
  const html = api.poster({ title: '<img src=x onerror=alert(1)>', note: '<script>bad</script>', metadata: { image: 'javascript:alert(1)', font: 'bad" onclick="bad' } });
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('onclick='));
  assert.ok(!html.includes('src="javascript'));
  for (const image of ['https://example.com/a.jpg', 'data:image/svg+xml;base64,AAAA', 'data:image/png;base64,AAAA', validImage + 'A'.repeat(180000)]) assert.equal(api.safeImage(image), '');
  assert.equal(api.safeImage(validImage), validImage);
});
test('image optimization limits dimensions, preserves proportions and releases bitmap', async () => {
  const { api, canvas, closed } = harness();
  assert.equal(await api.optimize({ type: 'image/jpeg', size: 1024 }), validImage);
  assert.equal(canvas.width, 1440);
  assert.equal(canvas.height, 720);
  assert.equal(closed(), 1);
});
test('optimizer rejects unsupported and oversized files', async () => {
  const { api } = harness();
  await assert.rejects(api.optimize({ type: 'image/svg+xml', size: 200 }));
  await assert.rejects(api.optimize({ type: 'image/jpeg', size: 21 * 1024 * 1024 }));
});
test('optimizer retries smaller encodes and uses JPEG fallback', async () => {
  const { api, canvas } = harness();
  let calls = 0;
  canvas.toDataURL = type => {
    calls++;
    return calls < 4 || type === 'image/webp' ? 'data:image/png;base64,AAAA' : 'data:image/jpeg;base64,AAAA';
  };
  assert.equal(await api.optimize({ type: 'image/png', size: 1024 }), 'data:image/jpeg;base64,AAAA');
  assert.ok(canvas.width < 1440);
  assert.equal(calls, 4);
});
test('optimizer releases resources on encoding failure', async () => {
  const { api, canvas, closed } = harness();
  canvas.toDataURL = () => { throw new Error('failed'); };
  await assert.rejects(api.optimize({ type: 'image/png', size: 1024 }), /failed/);
  assert.equal(closed(), 1);
});
test('exhibition uses generic existing schema and adds a color without changing existing colors', () => {
  const { integration } = harness();
  const state = integration.normalizeState({});
  const exhibition = state.lists.find(list => list.id === 'exhibition');
  assert.equal(exhibition.type, 'generic');
  assert.equal(exhibition.color, '#75A56A');
  assert.equal(state.lists.find(list => list.id === 'weekly').color, '#4AA885');
});
test('create, edit, archive and reload preserve data and do not affect other lists', () => {
  const { integration, storage } = harness();
  integration.saveExhibition(input());
  const first = integration.getState().items[0];
  integration.saveExhibition({ ...first, title: 'Edited' });
  assert.equal(integration.getState().items.length, 1);
  assert.equal(integration.getState().items[0].title, 'Edited');
  integration.saveExhibition({ ...integration.getState().items[0], isArchived: true });
  const persisted = JSON.parse(storage.get('habitflow-lists-v1'));
  assert.equal(persisted.items[0].isArchived, true);
  assert.equal(persisted.items[0].metadata.image, '');
  assert.throws(() => integration.saveExhibition({ ...first, title: 'resurrect' }), /nicht mehr verfügbar/);
});
test('quota failures leave memory and persisted data untouched', () => {
  const { integration, storage, setFailure } = harness();
  integration.saveExhibition(input());
  const original = storage.get('habitflow-lists-v1');
  const item = integration.getState().items[0];
  setFailure(true);
  assert.throws(() => integration.saveExhibition({ ...item, title: 'Not saved' }), { name: 'QuotaExceededError' });
  assert.equal(integration.getState().items[0].title, 'Barcelona');
  assert.equal(storage.get('habitflow-lists-v1'), original);
  assert.throws(() => integration.saveExhibition(input()));
  assert.equal(integration.getState().items.length, 1);
});
test('missing image, empty title, and nonexistent edits are rejected', () => {
  const { integration } = harness();
  assert.throws(() => integration.saveExhibition({ ...input(), title: '' }));
  assert.throws(() => integration.saveExhibition({ ...input(), metadata: {} }));
  assert.throws(() => integration.saveExhibition({ ...input(), id: 'unknown' }));
  assert.equal(integration.getState().items.length, 0);
});

test('custom colors are validated and legacy tones retain their colors', () => {
  const { api } = harness();
  assert.equal(api.normalize({ tone: 'red' }).color, '#ff6759');
  assert.equal(api.normalize({ tone: 'gold' }).color, '#ffce70');
  assert.equal(api.normalize({ color: '#AbC' }).color, '#aabbcc');
  assert.equal(api.normalize({ color: '#123456' }).color, '#123456');
  assert.equal(api.normalize({ color: 'red;position:fixed' }).color, '#ffffff');
});
test('brightness defaults safely and clamps to the slider bounds', () => {
  const { api } = harness();
  for (const value of [undefined, null, NaN, Infinity, '120']) assert.equal(api.normalize({ brightness: value }).brightness, 100);
  assert.equal(api.normalize({ brightness: 0 }).brightness, 50);
  assert.equal(api.normalize({ brightness: 900 }).brightness, 150);
  assert.equal(api.normalize({ brightness: 124.6 }).brightness, 125);
});
test('color and brightness survive save, edit and persisted reload', () => {
  const { integration, storage } = harness();
  const entry = input();
  entry.metadata.color = '#102030';
  entry.metadata.brightness = 125;
  integration.saveExhibition(entry);
  const saved = integration.getState().items[0];
  integration.saveExhibition({ ...saved, title: 'Adjusted' });
  const restored = integration.normalizeState(JSON.parse(storage.get('habitflow-lists-v1'))).items[0];
  assert.equal(restored.metadata.color, '#102030');
  assert.equal(restored.metadata.brightness, 125);
  assert.equal(restored.metadata.monochrome, true);
  assert.equal(restored.metadata.image, validImage);
});
test('empty preview gets a flat background while image posters keep the photo', () => {
  const { api } = harness();
  const empty = api.poster({ title: 'Test', metadata: {} }, true);
  assert.match(empty, /ex-empty/);
  assert.doesNotMatch(empty, /Dein nächster Blickfang|<img/);
  const photo = api.poster({ ...input(), metadata: { image: validImage, color: '#123456', brightness: 75, monochrome: true } });
  assert.match(photo, /ex-mono/);
  assert.match(photo, /--ex-text-color:#123456;--ex-brightness:0.75/);
  assert.doesNotMatch(photo, /ex-empty/);
});
test('live brightness changes reuse the preview DOM and never re-encode images', () => {
  const { api } = harness();
  const start = source.indexOf('    const preview = () => {');
  const end = source.indexOf('    function setBusy', start);
  const properties = {};
  const heading = {}, description = {}, output = {};
  const card = { style: { setProperty: (key, value) => { properties[key] = value; } }, querySelector: selector => selector === 'h4' ? heading : description };
  const host = { firstElementChild: card, set innerHTML(_) { throw new Error('Preview DOM must not be replaced'); } };
  const context = {
    image: validImage, previewImage: validImage,
    draft: () => ({ title: 'Updated', note: 'Description', metadata: { color: '#123456', brightness: 140, monochrome: true } }),
    normalize: api.normalize,
    root: { querySelector: selector => selector === '[data-ex-preview]' ? host : output },
    form: { elements: { brightness: { value: '140' } } }
  };
  vm.runInNewContext(source.slice(start, end) + '\npreview();', context);
  assert.equal(properties['--ex-brightness'], 1.4);
  assert.equal(properties['--ex-text-color'], '#123456');
  assert.equal(heading.textContent, 'Updated');
  assert.equal(output.textContent, '140 %');
  assert.match(card.className, /ex-mono/);
});
