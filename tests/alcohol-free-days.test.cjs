const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
const fn = name => source.match(new RegExp(`  function ${name}\\([^]*?\\n  \\}`))[0];
class Clock extends Date { constructor(...args) { super(...(args.length ? args : ['2026-08-05T12:00:00'])); } }
const state = { alcoholLogs: [], alcoholUnits: [], alcoholEvents: [], pausePeriods: [] };
const c = vm.createContext({state, Date: Clock, analyticsRead: (_, read) => read(), visibleAlcoholDays: () => [], normalizePausePeriod: x => x,
  toDateKey: v => { const d = new Date(v); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; },
  normalizeMonthlyMissionMetric: x => x, normalizeMonthlyMissionCategory: () => 'consumption', validIsoOrFallback: x => x, nowIso: () => '', uid: () => 'new', currentMonthKey: () => '2026-08', MONTHLY_MISSION_METRICS: {smoke_free_evenings:{label:'Alkoholfreie Tage'}}
});
vm.runInContext(fn('countMonthlyAlcoholFreeDays'), c);
vm.runInContext(fn('normalizeMonthlyMission'), c);
const keys = ['2026-07-26','2026-07-27','2026-08-01','2026-08-02','2026-08-03','2026-08-04','2026-08-05','2026-08-06'];
assert.equal(c.countMonthlyAlcoholFreeDays(keys),5, 'cutoff and unfinished/future days excluded');
state.alcoholLogs.push({log_date:'2026-08-01',consumption_level:2});
state.alcoholUnits.push({occurred_at:'2026-08-02T21:00:00'});
state.alcoholEvents.push({occurred_at:'2026-08-03T12:00:00'});
assert.equal(c.countMonthlyAlcoholFreeDays(keys),2, 'raw consumption counts even when hidden from visible logs');
state.pausePeriods.push({scope:'alcohol',starts_at:'2026-08-04T18:00:00',ends_at:'2026-08-04T20:00:00'});
assert.equal(c.countMonthlyAlcoholFreeDays(keys),1,'partial pause excludes day');
state.pausePeriods[0].is_archived=true;
assert.equal(c.countMonthlyAlcoholFreeDays(keys),2,'archived pause no longer excludes');
state.pausePeriods.push({scope:'smoke',starts_at:'2026-07-27T00:00:00'});
assert.equal(c.countMonthlyAlcoholFreeDays(keys),2,'smoking pauses do not affect alcohol');
state.pausePeriods.push({scope:'alcohol',starts_at:'2026-07-27T23:59:00'});
assert.equal(c.countMonthlyAlcoholFreeDays(keys),0,'open pauses excluded');
const mission=c.normalizeMonthlyMission({id:'existing',metric:'smoke_free_evenings',title:'20 rauchfreie Abende',target:20});
assert.equal(mission.title,'20 alkoholfreie Tage');assert.equal(mission.id,'existing');assert.equal(mission.target,20);assert.equal(mission.metric,'smoke_free_evenings');
assert.equal(c.normalizeMonthlyMission({metric:'smoke_free_evenings',title:'Mein persönliches Ziel'}).title,'Mein persönliches Ziel');
assert.ok(!source.includes('facts.smokeFreeEvenings'));
console.log('Alcohol-free days: cutoff, raw logs, partial/open/archived pauses, scope and existing mission compatibility passed');
