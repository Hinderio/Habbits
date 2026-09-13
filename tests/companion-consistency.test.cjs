const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
function block(name) {
  const result = source.match(new RegExp(`  function ${name}\\([^]*?\\n  \\}`));
  assert.ok(result, name);
  return result[0];
}
function setup() {
  const frames = [], events = [], cards = [];
  const context = {
    EVOLUTION_LEVEL_RULES: { maxStage: 20, baseCost: 250, growth: 1.18 },
    selectedCompanionStage: null, pointEvolutionRenderQueued: false, lastRenderedPointsSignature: null,
    gamificationShowLocked: false, gamificationBadgeShelfOpen: false, GAMIFICATION_BADGES: [],
    state: { pointsLedger: [{ points: 5266 }], cigarettes: [] },
    STORAGE_KEY: 'test', localStorage: { setItem() {} },
    writeRemoteDeleteArchive() {}, queueRender() {},
    requestAnimationFrame: callback => frames.push(callback),
    window: { dispatchEvent: event => events.push(event.type) }, CustomEvent: function(type) { this.type = type; },
    els: { totalPoints: {}, levelLabel: {}, levelProgress: {style:{}}, companionCard: {}, badgeShelf: {classList:{toggle(){}}} },
    visibleLedgerPoints() { return context.state.pointsLedger; },
    getTotalPoints() { return context.state.pointsLedger.reduce((sum, row) => sum + row.points, 0); },
    buildGamificationStats() {
      const total = context.getTotalPoints();
      return { total, dayScore: {score:72}, levelProgress: context.evolutionStageFromPoints(total).stageProgress, unlockedBadges:0, momentumStreak:0,routineDays:0 };
    },
    renderCompanionCard(display, stats, actual) { cards.push({display, total:stats.total, actual}); return ''; },
    renderGamificationBadge() {},
  };
  vm.createContext(context);
  for(const name of ['evolutionStageCost','evolutionThresholds','evolutionStageFromPoints','companionProfile','companionPreviewProfile','renderGamification','renderPointEvolutionSummary','pointsPresentationSignature','queuePointEvolutionRefresh','saveState','handleCompanionCardClick']) vm.runInContext(block(name),context);
  return {context, frames, events, cards, flush(){while(frames.length) frames.shift()();}};
}
test('background save updates total, actual stage and default poster together: 5266 -> 7016',()=>{
  const {context:c,flush,cards,events,frames} = setup();
  c.renderPointEvolutionSummary();
  assert.equal(cards.at(-1).actual.stage,10);
  assert.equal(cards.at(-1).actual.nextPoints,614);
  assert.equal(c.selectedCompanionStage,null,'automatic display must not pin stage 10');
  c.state.pointsLedger.push({points:1750});
  c.saveState({skipRender:true});
  c.saveState({skipRender:true});
  assert.equal(frames.length,1,'coalesce repeated background saves');
  flush();
  assert.equal(cards.at(-1).total,7016);
  assert.equal(cards.at(-1).actual.stage,11);
  assert.equal(cards.at(-1).display.stage,11);
  assert.equal(cards.at(-1).actual.nextPoints,174);
  assert.equal(c.els.levelLabel.textContent,'Level 11');
  assert.equal(events.at(-1),'habitflow:points-update');
  const count=cards.length;
  c.saveState({skipRender:true});flush();
  assert.equal(cards.length,count,'unchanged ledger must not redraw');
});
test('negative corrections follow the actual stage down; full render prevents redundant refresh',()=>{
 const {context:c,flush,cards}=setup();
 c.state.pointsLedger=[{points:7016}];c.renderPointEvolutionSummary();
 c.state.pointsLedger.push({points:-1750});c.saveState({skipRender:true});
 c.renderPointEvolutionSummary();const count=cards.length;flush();
 assert.equal(cards.length,count);assert.equal(cards.at(-1).display.stage,10);
 c.state.pointsLedger=[{points:-100}];c.saveState({skipRender:true});flush();
 assert.equal(cards.at(-1).total,-100);assert.equal(cards.at(-1).actual.stage,1);
});
test('intentional previews stay explicit and returning to current stage restores automatic following',()=>{
 const {context:c,flush,cards}=setup();
 c.selectedCompanionStage=15;c.renderPointEvolutionSummary();
 c.state.pointsLedger=[{points:7016}];c.saveState({skipRender:true});flush();
 assert.equal(cards.at(-1).display.stage,15);assert.equal(cards.at(-1).display.isPreview,true);
 assert.equal(cards.at(-1).actual.stage,11);
 c.handleCompanionCardClick({target:{closest:selector=>selector==='[data-companion-current]'?{}:null}});
 assert.equal(c.selectedCompanionStage,null);assert.equal(cards.at(-1).display.stage,11);
});
test('poster 21-day delta uses booked points and the same accounting day as details',()=>{
 const {context:c}=setup();
 c.daysBack=()=>['2026-09-12','2026-09-13'];c.sum=values=>values.reduce((a,b)=>a+b,0);
 c.toDateKey=value=>value.slice(0,10);c.escapeHtml=value=>value;
 c.window.HabitFlowPointsLive={snapshot:()=>({rows:[{points:80,day:'2026-09-12',earned_at:'2026-09-14T01:00:00'},{points:-30,earned_at:'2026-09-13T12:00:00'},{points:999,earned_at:'2026-08-01T12:00:00'}]})};
 c.pointsOnDate=()=>{throw Error('must not mix unbooked fallbacks into ledger chart');};
 vm.runInContext(block('renderPosterProgressOverlay'),c);
 const markup=c.renderPosterProgressOverlay({total:7016},c.evolutionStageFromPoints(7016));
 assert.match(markup,/\+50 Pkt\. \/ 21 Tage/);assert.match(markup,/\+174 Pkt\./);
});
