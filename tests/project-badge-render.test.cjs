const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../modules/projects.js'), 'utf8');

function extract(name) {
  const start = source.indexOf('  function ' + name + '(');
  assert.notEqual(start, -1, 'Missing function: ' + name);
  const end = source.indexOf('\n  function ', start + 1);
  return source.slice(start, end < 0 ? undefined : end);
}

// Model observer delivery and frame scheduling with a bounded queue. Badge
// equality covers markup and runtime attributes, including pending removal.
function harness() {
  const state = {
    tasks: [{ id: 't1', project_id: 'p1' }],
    projects: [{ id: 'p1', title: 'Alpha Project', color: '#123456' }]
  };
  const frames = [], timers = [], observers = [], cards = [];
  let dirty = false, writes = 0, reads = 0;
  function mutate() { dirty = true; writes++; }
  function badge(html) {
    return {
      html,
      dataset: { projectId: html.match(/data-project-id="([^"]+)"/)[1] },
      isEqualNode(other) {
        return Boolean(other && this.html === other.html &&
          JSON.stringify(this.dataset) === JSON.stringify(other.dataset));
      },
      replaceWith(next) {
        const card = cards.find(card => card.badge === this);
        if (card) { card.badge = next; mutate(); }
      },
      remove() {
        const card = cards.find(card => card.badge === this);
        if (card) { card.badge = null; mutate(); }
      }
    };
  }
  function addCard({ directId = true, heading = true } = {}) {
    const card = {
      dataset: directId ? { taskId: 't1' } : {},
      badge: null,
      querySelector(selector) {
        if (selector === '[data-project-badge-root]') return this.badge;
        return heading ? {
          parentElement: {},
          insertAdjacentElement: (_position, node) => { this.badge = node; mutate(); }
        } : null;
      },
      querySelectorAll: () => [{ dataset: { id: 't1' } }],
      prepend(node) { this.badge = node; mutate(); }
    };
    cards.push(card);
    dirty = true;
    return card;
  }
  const window = {
    requestAnimationFrame(callback) { frames.push(callback); return 1; },
    setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; }
  };
  const document = {
    body: {},
    querySelectorAll: () => cards,
    createElement: () => ({ set innerHTML(html) { this.firstElementChild = badge(html); } })
  };
  const context = vm.createContext({
    window, document, console,
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe() { observers.push(this); }
    },
    readState() { reads++; return state; },
    normalizeTask: task => task,
    pullRemoteProjectData: async () => {}
  });
  const names = ['escapeHtml', 'projectInitials', 'projectBadge',
    'scheduleTaskBadgePaint', 'scheduleTaskLinkRefresh', 'inferTaskId',
    'decorateTaskProjectBadges', 'bindTaskBadgeObserver'];
  vm.runInContext('let taskBadgeRaf = 0, taskLinkRefreshTimer = 0;\n' +
    names.map(extract).join('\n') + '\nbindTaskBadgeObserver();', context);
  function settle() {
    for (let turn = 0; turn < 12; turn++) {
      if (dirty) { dirty = false; observers.forEach(observer => observer.callback([])); }
      if (!frames.length) return;
      frames.splice(0).forEach(callback => callback());
    }
    assert.fail('Badge rendering did not settle after 12 animation frames');
  }
  return {
    state, addCard, settle,
    get writes() { return writes; },
    get reads() { return reads; },
    refresh() { vm.runInContext('scheduleTaskBadgePaint();', context); settle(); },
    unrelatedMutation() { dirty = true; settle(); },
    runTimers(delay) {
      timers.filter(timer => timer.delay === delay).forEach(timer => {
        timers.splice(timers.indexOf(timer), 1);
        timer.callback();
      });
      settle();
    }
  };
}

test('observer settles and preserves unchanged badges, including hidden cards', () => {
  const app = harness(), card = app.addCard();
  card.hidden = true;
  app.settle();
  const original = card.badge;
  assert.ok(original);
  assert.equal(app.writes, 1);
  app.unrelatedMutation();
  app.refresh();
  assert.equal(card.badge, original);
  assert.equal(app.writes, 1);
  const reads = app.reads;
  app.settle();
  assert.equal(app.reads, reads, 'No background frame remains queued');
});

test('rename, color change and reassignment still update badges', () => {
  const app = harness(), card = app.addCard();
  app.settle();
  let previous = card.badge;
  app.state.projects[0].title = 'Beta Project';
  app.refresh();
  assert.notEqual(card.badge, previous);
  assert.match(card.badge.html, />BP<\/span>/);
  previous = card.badge;
  app.state.projects[0].color = '#abcdef';
  app.refresh();
  assert.notEqual(card.badge, previous);
  assert.match(card.badge.html, /--project-color:#abcdef/);
  previous = card.badge;
  app.state.projects.push({ ...app.state.projects[0], id: 'p2' });
  app.state.tasks[0].project_id = 'p2';
  app.refresh();
  assert.notEqual(card.badge, previous);
  assert.equal(card.badge.dataset.projectId, 'p2');
  assert.equal(app.writes, 4);
});

test('new cards support nested task IDs and the no-heading fallback', () => {
  const app = harness();
  app.addCard();
  app.settle();
  const detail = app.addCard({ directId: false, heading: false });
  app.settle();
  assert.equal(detail.badge.dataset.projectId, 'p1');
  assert.equal(app.writes, 2);
});

test('unlinking retains the existing delayed removal behavior', () => {
  const app = harness(), card = app.addCard();
  app.settle();
  app.state.tasks[0].project_id = null;
  app.refresh();
  assert.equal(card.badge.dataset.pendingRemoval, 'true');
  app.runTimers(1000);
  assert.equal(card.badge, null);
});

test('a recovered link clears pending removal and survives the old timer', () => {
  const app = harness(), card = app.addCard();
  app.settle();
  app.state.tasks[0].project_id = null;
  app.refresh();
  const pending = card.badge;
  app.state.tasks[0].project_id = 'p1';
  app.refresh();
  assert.notEqual(card.badge, pending);
  assert.equal(card.badge.dataset.pendingRemoval, undefined);
  const recovered = card.badge;
  app.runTimers(1000);
  assert.equal(card.badge, recovered);
});
