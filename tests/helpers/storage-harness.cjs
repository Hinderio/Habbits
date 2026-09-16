const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const KEY = 'habitflow-state-v1';
const clone = value => JSON.parse(JSON.stringify(value));
function harness({ initial = {}, root = path.resolve(__dirname, '../..'), legacy = false } = {}) {
  const data = new Map([[KEY, JSON.stringify(initial)]]);
  const counts = { parses: 0, serializes: 0, writes: 0 };
  let failWrites = false, clock = Date.parse('2026-09-16T12:00:00.000Z');
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  class Storage {
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; }
    setItem(key, value) {
      if (failWrites) throw new Error('QuotaExceededError');
      if (key === KEY) counts.writes++;
      data.set(String(key), String(value));
    }
    removeItem(key) { data.delete(String(key)); }
    clear() { data.clear(); }
  }
  const listeners = [];
  const document = {
    readyState: 'loading',
    addEventListener(type, handler) { listeners.push({ type, handler }); },
    querySelector: selector => selector.startsWith('link') ? {} : null,
    getElementById: () => null,
    head: { appendChild() {} }, createElement: () => ({}),
  };
  const registered = new Map();
  const window = { localStorage: new Storage(), Storage, document,
    HabitFlowModules: { has: name => registered.has(name), register: (name, api) => registered.set(name, api) },
    setTimeout: () => 1, clearTimeout() {},
  };
  const json = {
    parse(value, ...args) { if (String(value).includes('"pointsLedger"')) counts.parses++; return JSON.parse(value, ...args); },
    stringify(value, ...args) { if (value && typeof value === 'object' && 'pointsLedger' in value) counts.serializes++; return JSON.stringify(value, ...args); },
  };
  const context = vm.createContext({ window, document, console: { warn() {}, info() {} }, JSON: json, Date: FixedDate, setTimeout: window.setTimeout });
  const load = file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  if (!legacy) load('modules/state-persistence.js');
  for (const file of ['smoking-domain.js','alcohol-domain.js','smoking-domain-persistence.js','alcohol-domain-persistence.js',
    'points-ledger-sync-guard.js','projects.js','project-unlink-persistence-fix.js']) load(`modules/${file}`);
  listeners.find(item => item.handler.name === 'installWhenReady')?.handler();
  function resetCounts() { Object.keys(counts).forEach(key => counts[key] = 0); }
  resetCounts();
  return { window, context, load, data, counts, resetCounts,
    saved: () => JSON.parse(data.get(KEY)),
    read: () => JSON.parse(window.localStorage.getItem(KEY)),
    write(value, verified = true) {
      if (window.HabitFlowPersistence) window.HabitFlowPersistence.writeState(value, { skipSmokingNormalization: verified });
      else {
        if (verified) window.HabitFlowRuntime.skipNextSmokingDomainPersistenceNormalization();
        window.localStorage.setItem(KEY, JSON.stringify(value));
      }
    },
    failWrites(value) { failWrites = value; },
    setClock(value) { clock = Date.parse(value); },
  };
}
function seed() {
  const created = '2026-09-01T12:00:00.000Z';
  return { habits: [], habitEntries: [], cigarettes: [], alcoholUnits: [],
    tasks: [{ id: 't1', title: 'Task', project_id: 'p1', updated_at: created }],
    projects: [{ id: 'p1', title: 'Project', created_at: created, updated_at: created }],
    projectPhases: [{ id: 'phase', project_id: 'p1', name: 'Phase', start_date: '2026-09-01', created_at: created }],
    projectMilestones: [], projectNotes: [],
    pointsLedger: [{ id: 'point', source_type: 'habit', source_id: 'entry', points: 30, reason: 'Habit', synced: false }],
    deletedRemoteIds: { tasks: ['removed-offline'] },
  };
}
module.exports = { harness, seed, KEY, clone };
