const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const controller = html.match(/<script id="startup-art-controller">([\s\S]*?)<\/script>/)[1];
function harness() {
 const listeners = new Map(), timers = new Map(); let id = 0;
 const make = () => ({ hidden:true, textContent:'', attrs:{}, removed:false, style:{values:{},setProperty(k,v){this.values[k]=v}}, classList:{values:new Set(),add(v){this.values.add(v)},remove(v){this.values.delete(v)}},setAttribute(k,v){this.attrs[k]=v},contains(){return false},remove(){this.removed=true},addEventListener(k,fn){this[k]=fn} });
 const art=make(), status=make(), retry=make(), root=make(), progress=make();
 const window={addEventListener(k,fn){listeners.set(k,fn)},removeEventListener(k){listeners.delete(k)},dispatchEvent(e){listeners.get(e.type)?.(e)},location:{reload(){}}};
 const context={window,document:{documentElement:root,getElementById(id){return {startupArt:art,startupArtStatus:status,startupArtRetry:retry,startupArtProgress:progress}[id]}},setTimeout(fn,ms){timers.set(++id,{fn,ms});return id},clearTimeout(id){timers.delete(id)},requestAnimationFrame(fn){fn()},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail}},console};
 vm.createContext(context);vm.runInContext(controller,context);
 return {context,art,status,retry,root,progress,timers,window,listeners,tick(ms){for(const [id,t] of [...timers])if(t.ms===ms){timers.delete(id);t.fn()}}};
}
test('ready unlocks content, clears slow timer, removes splash and listeners',()=>{
 const h=harness(); assert(h.root.classList.values.has('startup-art-active'));
 h.window.dispatchEvent({type:'habitflow:ready'});
 assert(!h.root.classList.values.has('startup-art-active'));assert.equal(h.art.attrs['aria-hidden'],'true');
 h.tick(600); assert(h.art.removed);assert.equal(h.listeners.size,0);assert.equal(h.timers.size,0);
});
test('slow startup offers retry without falsely claiming readiness',()=>{
 const h=harness();h.tick(15000);assert.equal(h.retry.hidden,false);assert.match(h.status.textContent,/länger/);assert(h.root.classList.values.has('startup-art-active'));
});
test('failure remains recoverable; later successful start removes overlay',()=>{
 const h=harness();h.window.dispatchEvent({type:'habitflow:startup-error'});assert.equal(h.retry.hidden,false);assert.match(h.status.textContent,/nicht abgeschlossen/);
 h.window.dispatchEvent({type:'habitflow:ready'});h.tick(600);assert(h.art.removed);
});
test('failed app script exposes recovery',()=>{
 const h=harness();h.window.dispatchEvent({type:'error',target:{tagName:'SCRIPT',src:'https://example.org/Habbits/app.js?v=354'}});assert.equal(h.retry.hidden,false);
});
test('readiness waits for asynchronous init including render and reports failure',async()=>{
 const source=app.slice(app.indexOf('  function startApp() {'),app.indexOf('  function requestAppStart() {'));
 const h=harness();let resolve;h.context.init=()=>new Promise(r=>resolve=r);
 vm.runInContext('let appInitialized=false;let appInitPromise=null;'+source,h.context);
 const pending=vm.runInContext('startApp()',h.context);assert(h.root.classList.values.has('startup-art-active'));
 resolve();await pending;assert(!h.root.classList.values.has('startup-art-active'));
 const f=harness();f.context.init=()=>Promise.reject(new Error('test failure'));f.context.console={error(){}};
 vm.runInContext('let appInitialized=false;let appInitPromise=null;'+source,f.context);
 await assert.rejects(vm.runInContext('startApp()',f.context),/test failure/);assert.equal(f.retry.hidden,false);
});

test('cocktail advances monotonically through real phases, full only when ready',()=>{
 const h=harness();assert.equal(h.progress.attrs['aria-valuenow'],'8');
 for (const [phase,value] of [['prepare',20],['session',38],['sync',58],['details',78],['render',92]]) {
  h.window.dispatchEvent({type:'habitflow:startup-progress',detail:{phase}});
  assert.equal(h.progress.attrs['aria-valuenow'],String(value));
 }
 h.window.dispatchEvent({type:'habitflow:startup-progress',detail:{phase:'prepare'}});
 h.window.dispatchEvent({type:'habitflow:startup-progress',detail:{phase:'unknown'}});
 assert.equal(h.progress.attrs['aria-valuenow'],'92');
 h.window.dispatchEvent({type:'habitflow:ready'});
 assert.equal(h.progress.attrs['aria-valuenow'],'100');assert.equal(h.progress.style.values['--fill-offset'],'0px');
});
test('startup failure freezes progress and keeps its recovery message',()=>{
 const h=harness();h.window.dispatchEvent({type:'habitflow:startup-error'});
 h.window.dispatchEvent({type:'habitflow:startup-progress',detail:{phase:'render'}});
 assert.equal(h.progress.attrs['aria-valuenow'],'8');assert.match(h.status.textContent,/nicht abgeschlossen/);
});
test('unavailable poster does not block app readiness',()=>{
 const h=harness();h.window.dispatchEvent({type:'error',target:{tagName:'IMG'}});
 assert.equal(h.retry.hidden,true);h.window.dispatchEvent({type:'habitflow:ready'});h.tick(600);assert(h.art.removed);
});
test('initialization emits preparation, session and render phases around async data loading',async()=>{
 const h=harness();const phases=[];let release;
 h.context.reportStartupProgress=phase=>phases.push(phase);
 for(const name of ['registerServiceWorker','cacheEls','applyRulesVisibility','applyPausesVisibility','applyConsumptionMode','applyTheme','fillSettingsForm','bindEvents','showScreen','renderStaticIcons','loadLeisureCatalog','isSupabaseConfigured','migrateHabitScoring','migrateCigaretteScoring','migrateAlcoholScoring','initOngoingSync','render','setInterval'])h.context[name]=()=>{};
 h.context.document.querySelector=()=>null;
 h.context.initSupabase=()=>new Promise(r=>release=r);
 vm.runInContext(app.slice(app.indexOf('  async function init() {'),app.indexOf('  function registerServiceWorker() {')),h.context);
 const pending=vm.runInContext('init()',h.context);assert.deepEqual(phases,['prepare','session']);
 release();await pending;assert.deepEqual(phases,['prepare','session','render']);
});
