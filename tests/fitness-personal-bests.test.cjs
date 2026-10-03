const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const block = name => app.match(new RegExp('  function ' + name + '\\([^]*?\\n  \\}'))[0];
function setup() {
  let reads = 0;
  const context = vm.createContext({
    ledger: [], visibleLedgerPoints() { reads++; return context.ledger; },
    buildMountainCollection: () => ({ totalAscent: 0 }),
    buildBestSmokePause: () => ({ value: 'Noch offen' }),
    buildBestRunningWeek: () => ({ value: 'Noch offen' }),
    buildStrongestPointsMonth: ledger => { assert.equal(ledger, context.ledger); return { value: 'Noch offen' }; },
    buildLongestTaskStreak: () => ({ value: 'Noch offen' }),
    formatMetersValue: value => value + ' m', escapeHtml: String, svgIcon: () => ''
  });
  for (const name of ['countHundredPointFitnessSessions', 'buildFitnessPersonalBests', 'renderPersonalBestMuseum']) vm.runInContext(block(name), context);
  return { context, reads: () => reads };
}
test('counts inclusive threshold once per visible fitness session, excluding unrelated and invalid points', () => {
  const { context: c } = setup();
  const sessions = ['below', 'exact', 'above', 'duplicate', 'missing', 'invalid'].map(id => ({ id }));
  const point = (id, points, source_type = 'habit') => ({ source_id: id, points, source_type });
  const ledger = [point('below', 99.99), point('exact', '100'), point('above', 150),
    point('duplicate', 120), point('duplicate', 120), point('unrelated', 500),
    point('missing', 200, 'task'), point('invalid', Infinity), point('invalid', 'oops')];
  assert.equal(c.countHundredPointFitnessSessions(sessions, ledger), 3);
  assert.equal(c.countHundredPointFitnessSessions([], ledger), 0);
  assert.equal(c.countHundredPointFitnessSessions(sessions, []), 0);
});
test('sixth card shows zero, singular/plural and updates after edits or removal; ledger read once', () => {
  const { context: c, reads } = setup();
  const sessions = [{ id: 'a', type: 'jogging' }, { id: 'b', type: 'jogging' }];
  let cards = c.buildFitnessPersonalBests(sessions);
  assert.equal(cards.length, 6);
  assert.equal(cards[5].value, '0 Sessions');
  assert.equal(cards[5].unlocked, false);
  assert.equal(reads(), 1);
  c.ledger = [{ source_type: 'habit', source_id: 'a', points: 100 }];
  cards = c.buildFitnessPersonalBests(sessions);
  assert.equal(cards[5].value, '1 Session');
  assert.equal(cards[5].unlocked, true);
  c.ledger.push({ source_type: 'habit', source_id: 'b', points: 110 });
  assert.equal(c.buildFitnessPersonalBests(sessions)[5].value, '2 Sessions');
  c.ledger[0].points = 99;
  assert.equal(c.buildFitnessPersonalBests(sessions)[5].value, '1 Session');
  assert.equal(c.buildFitnessPersonalBests(sessions.slice(0, 1))[5].value, '0 Sessions');
});
test('museum badge and locked state reflect the new zero-count card', () => {
  const { context: c } = setup();
  let html = c.renderPersonalBestMuseum([]);
  assert.match(html, /0\/6 Pokale sichtbar/);
  assert.match(html, /is-hundred-points is-locked/);
  assert.match(html, /<strong>0 Sessions<\/strong>/);
  c.ledger = [{ source_type: 'habit', source_id: 'a', points: 100 }];
  html = c.renderPersonalBestMuseum([{ id: 'a', type: 'jogging' }]);
  assert.match(html, /1\/6 Pokale sichtbar/);
  assert.match(html, /is-hundred-points is-unlocked/);
});
test('large histories need only one ledger iteration and no session-by-session lookup', () => {
  const { context: c } = setup();
  const sessions = Array.from({ length: 10000 }, (_, id) => ({ id }));
  let visits = 0;
  const ledger = { *[Symbol.iterator]() {
    for (let id = 0; id < 100000; id++) {
      visits++;
      yield { source_type: 'habit', source_id: id, points: 100 };
    }
  }};
  assert.equal(c.countHundredPointFitnessSessions(sessions, ledger), 10000);
  assert.equal(visits, 100000);
});
