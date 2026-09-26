const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'../modules/dossiers.js'),'utf8');
function harness() {
  const api={ safeLink(value){try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}} };
  const window={HabitFlowDossiersStore:api};
  const document={readyState:'loading',addEventListener(){}};
  vm.runInNewContext(source.replace('  function mount() {','  window.testDossierUI = { entryCard, show, setPanels(p, d, tabs) { projects=p; pane=d; } };\n  function mount() {'),{window,document,URL,Date});
  return {api:window.testDossierUI,window,document};
}
test('entry rendering escapes text and alt content, rejects executable links and delays image requests',()=>{
  const {api}=harness();
  const html=api.entryCard({id:'safe',body:'<script>alert(1)</script>',link:'javascript:alert(1)',image_path:'owner/dossier/image.webp',image_alt:'" onerror="bad',created_at:'2026-09-26T12:00:00Z',is_pinned:true});
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript'));
  assert.ok(!html.includes('src='));assert.ok(html.includes('loading="lazy"'));assert.ok(html.includes('decoding="async"'));
  assert.ok(html.includes('&quot; onerror=&quot;bad'));assert.ok(html.includes('aria-pressed="true"'));
});
test('external links preserve normal navigation with opener isolation',()=>{
  const {api}=harness();const html=api.entryCard({id:'safe',body:'',link:'https://example.org/research',created_at:'2026-09-26T12:00:00Z'});
  assert.ok(html.includes('rel="noopener noreferrer"'));assert.ok(html.includes('target="_blank"'));
});
test('switch restores existing project panel without rebuilding its DOM',()=>{
  const {api,document}=harness();
  const projects={hidden:true,innerHTML:'original form draft'},pane={hidden:false,innerHTML:'dossier draft'};
  const tabs=['projects','dossiers'].map(view=>({dataset:{projectView:view},setAttribute(key,value){this[key]=value;}}));
  document.querySelectorAll=()=>tabs;
  api.setPanels(projects,pane);api.show('projects');
  assert.equal(projects.hidden,false);assert.equal(pane.hidden,true);assert.equal(projects.innerHTML,'original form draft');
  assert.equal(tabs[0]['aria-selected'],'true');assert.equal(tabs[1].tabIndex,-1);
});

test('large dossiers render 20 entries per page; status changes preserve entry DOM and composer',()=>{
  const nodes=new Map();let entryWrites=0;
  const node = selector => {
    if(!nodes.has(selector))nodes.set(selector,{_html:'',textContent:'',disabled:false,hidden:false,set innerHTML(value){this._html=value;if(selector==='[data-entry-list]')entryWrites++;},get innerHTML(){return this._html;}});
    return nodes.get(selector);
  };
  const pane={querySelector:node},dialog={open:true,querySelector:node,querySelectorAll:()=>[]};
  const data={status:'lokal',projects:[],dossiers:[{id:'d',title:'Research',description:'',updated_at:'2026-09-26T12:00:00Z'}],entries:Array.from({length:1001},(_,i)=>({id:'e'+i,dossier_id:'d',body:'Note '+i,created_at:new Date(Date.UTC(2026,0,1,0,i)).toISOString(),is_pinned:i===0}))};
  const window={HabitFlowDossiersStore:{snapshot:()=>data,safeLink:()=>''}};
  const document={readyState:'loading',addEventListener(){}};
  const instrumented=source.replace('  function mount() {', '  window.testRefresh = (p,d,n=0) => { pane=p;dialog=d;active="d";view="dossiers";page=n;refresh(); };\n  function mount() {');
  vm.runInNewContext(instrumented,{window,document,URL,Date});
  window.testRefresh(pane,dialog);
  assert.equal((node('[data-entry-list]').innerHTML.match(/data-entry-id=/g)||[]).length,20);
  assert.match(node('[data-entry-list]').innerHTML,/data-entry-id="e0"/);
  assert.ok(node('[data-entry-list]').innerHTML.indexOf('data-entry-id="e0"')<node('[data-entry-list]').innerHTML.indexOf('data-entry-id="e1000"'));
  const writes=entryWrites;data.status='synchronisiert';window.testRefresh(pane,dialog);assert.equal(entryWrites,writes);
  assert.ok(!nodes.has('[data-entry-form]'),'refresh must not replace or touch the composer');
  window.testRefresh(pane,dialog,50);assert.equal((node('[data-entry-list]').innerHTML.match(/data-entry-id=/g)||[]).length,1);
});
