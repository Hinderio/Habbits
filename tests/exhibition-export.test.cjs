const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.resolve(__dirname, '../modules/exhibition-export.js'), 'utf8');
const exhibition = fs.readFileSync(path.resolve(__dirname, '../modules/exhibition.js'), 'utf8');
function harness(fail = false) {
  const calls = [], revoked = [];
  const context2d = {
    fillRect() {}, drawImage(...args) { calls.push(['image', ...args.slice(1)]); },
    createLinearGradient: () => ({ addColorStop() {} }),
    measureText: text => ({ width: text.length * 25 }),
    fillText: text => calls.push(['text', text]),
    getImageData: () => ({ data: new Uint8ClampedArray([100, 150, 200, 255]) }),
    putImageData: pixels => calls.push(['pixels', Array.from(pixels.data)])
  };
  const canvas = { getContext: () => context2d, toBlob: callback => callback(fail ? null : { type: 'image/png' }) };
  const document = { createElement: () => canvas };
  const window = { setTimeout };
  class Image {
    constructor() { this.width = 4000; this.height = 3000; }
    set src(value) { if (value) { calls.push(['source', value]); this.onload(); } }
  }
  const URL = { createObjectURL: () => 'blob:original', revokeObjectURL: url => revoked.push(url) };
  vm.runInNewContext(exhibition, { window, document });
  vm.runInNewContext(source, { window, document, Image, URL, Uint8ClampedArray });
  return { api: window.HabitFlowExhibitionExport, calls, canvas, revoked };
}
const item = () => ({ title: 'Neue Perspektive', note: 'Ein Gedanke', metadata: { image: 'data:image/webp;base64,AAAA', color: '#123456', brightness: 100 } });
test('poster export draws cover crop and typography and releases canvas', async () => {
  const { api, calls, canvas } = harness();
  const blob = await api.createPoster(item());
  assert.equal(blob.type, 'image/png');
  assert.ok(calls.some(call => call[0] === 'text' && call[1] === 'NEUE PERSPEKTIVE'));
  assert.ok(calls.some(call => call[0] === 'text' && call[1] === 'Ein Gedanke'));
  const image = calls.find(call => call[0] === 'image');
  assert.ok(image[1] < 0); // Landscape cover is centered and cropped.
  assert.equal(canvas.width, 0); assert.equal(canvas.height, 0);
});
test('optional original stays local and its temporary URL is revoked', async () => {
  const { api, calls, revoked } = harness();
  await api.createPoster(item(), { type: 'image/jpeg', size: 1000 });
  assert.ok(calls.some(call => call[0] === 'source' && call[1] === 'blob:original'));
  assert.deepEqual(revoked, ['blob:original']);
});
test('invalid originals and failed PNG encoding report errors', async () => {
  const { api, canvas } = harness(true);
  await assert.rejects(api.createPoster(item(), { type: 'image/svg+xml', size: 100 }));
  await assert.rejects(api.createPoster(item()), /PNG/);
  assert.equal(canvas.width, 0);
});
test('monochrome and brightness are applied only to photo pixels', async () => {
  const { api, calls } = harness();
  const entry = item(); entry.metadata.look = 'mono'; entry.metadata.brightness = 50;
  await api.createPoster(entry);
  const values = calls.find(call => call[0] === 'pixels')[1];
  assert.equal(values[0], values[1]); assert.equal(values[1], values[2]);
  assert.ok(values[0] < 100); assert.equal(values[3], 255);
});
test('long words and explicit line breaks wrap without losing text', () => {
  const { api } = harness();
  const lines = api.wrap({ measureText: text => ({ width: text.length }) }, 'abcdefghijkl\nnext', 4);
  assert.deepEqual(Array.from(lines), ['abcd', 'efgh', 'ijkl', 'next']);
});
