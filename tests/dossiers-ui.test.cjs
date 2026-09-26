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
  data.entries=data.entries.map(row=>({...row,synced:true}));data.dossiers=data.dossiers.map(row=>({...row,synced:true}));
  window.testRefresh(pane,dialog);assert.equal(entryWrites,writes,'acknowledgments must preserve cards and image nodes');
  assert.ok(!nodes.has('[data-entry-form]'),'refresh must not replace or touch the composer');
  window.testRefresh(pane,dialog,50);assert.equal((node('[data-entry-list]').innerHTML.match(/data-entry-id=/g)||[]).length,1);
});

test('hidden dossier screen performs no snapshot reads or scheduled renders',()=>{
  let reads=0,frames=0;
  const window={HabitFlowDossiersStore:{snapshot(){reads++;}},requestAnimationFrame(){frames++;}};
  const document={readyState:'loading',addEventListener(){}};
  vm.runInNewContext(source.replace('  function mount() {','  window.hiddenRefresh=()=>{view="dossiers";pane={closest:()=>({hidden:true})};dialog={open:false};queueRefresh();refresh();};\n  function mount() {'),{window,document,URL,Date});
  window.hiddenRefresh();assert.equal(reads,0);assert.equal(frames,0);
});

function uploadHarness(failure) {
  const nodes=new Map(),saved=[];let uploaded=0,revoked=0;
  const node=key=>{if(!nodes.has(key))nodes.set(key,{textContent:'',value:'',replaceChildren(){this.innerHTML='';}});return nodes.get(key);};
  const elements={title:{value:'Photo title'},body:{value:'A photo',focus(){}},link:{value:''},is_pinned:{checked:false},image_alt:{value:'Photo'}};
  const form={elements,reportValidity:()=>true,setAttribute(){},removeAttribute(){},querySelector:node,querySelectorAll:()=>Object.values(elements),reset(){elements.body.value='';}};
  const messages=[node('inline'),node('footer')];
  const dialog={querySelector:selector=>selector==='[data-entry-form]'?form:node(selector),querySelectorAll:()=>messages};
  const window={HabitFlowExhibition:{optimize:async()=> 'data:image/webp;base64,YWJj'},HabitFlowDossiersStore:{snapshot:()=>({entries:[]}),safeLink:()=>'',async upload(blob){uploaded++;assert.equal(blob.type,'image/webp');assert.equal(blob.size,3);if(failure)throw new Error(failure);return 'owner/dossier/photo.webp';},saveEntry:row=>saved.push(row)}};
  const document={readyState:'loading',addEventListener(){}};
  const URLmock={createObjectURL:()=> 'blob:preview',revokeObjectURL(){revoked++;}};
  vm.runInNewContext(source.replace('  function mount() {','  window.uploadTest={setup(d){dialog=d;active="dossier";},receive,submitEntry};\n  function mount() {'),{window,document,URL:URLmock,Date,Blob,atob});
  window.uploadTest.setup(dialog);
  return {api:window.uploadTest,form,node,messages,saved,uploaded:()=>uploaded,revoked:()=>revoked};
}
test('image selection previews a blob and submit saves its uploaded path, then releases the preview',async()=>{
  const h=uploadHarness();await h.api.receive({});assert.match(h.node('[data-draft-image]').innerHTML,/blob:preview/);
  await h.api.submitEntry({preventDefault(){},target:h.form});assert.equal(h.uploaded(),1);assert.equal(h.saved[0].image_path,'owner/dossier/photo.webp');assert.equal(h.saved[0].title,'Photo title');assert.equal(h.revoked(),1);
  assert.match(h.messages[0].textContent,/gespeichert/);assert.equal(h.node('[data-entry-submit]').textContent,'Eintrag hinzufügen');
});
test('upload failure is visible beside the button and preserves image and text for retry',async()=>{
  const h=uploadHarness('Bildspeicher fehlt');await h.api.receive({});await h.api.submitEntry({preventDefault(){},target:h.form});
  assert.equal(h.saved.length,0);assert.equal(h.revoked(),0);assert.equal(h.form.elements.body.value,'A photo');assert.match(h.messages[0].textContent,/Bildspeicher fehlt/);
  assert.equal(h.node('[data-entry-submit]').textContent,'Eintrag hinzufügen');assert.equal(h.form.elements.body.disabled,false);
  await h.api.submitEntry({preventDefault(){},target:h.form});assert.equal(h.uploaded(),2,'retry retains the blob');
});

test('entries use a closed native disclosure with an escaped optional title',()=>{
  const {api}=harness();const html=api.entryCard({id:'e',title:'<b>My title</b>',body:'Full content',created_at:'2026-09-26T12:00:00Z'});
  assert.match(html,/<details[^>]*data-entry-disclosure="e">/);assert.match(html,/<summary><strong>&lt;b&gt;My title&lt;\/b&gt;<\/strong>/);
  assert.match(html,/Mehr anzeigen/);assert.match(html,/Weniger anzeigen/);assert.ok(html.indexOf('Full content')>html.indexOf('</summary>'));
});
test('older untitled entries have a compact content or link heading',()=>{
  const {api}=harness();assert.match(api.entryCard({id:'e',body:'First\nthought',created_at:'2026-09-26'}),/<summary><strong>First thought/);
  assert.match(api.entryCard({id:'e',link:'https://example.org/a',created_at:'2026-09-26'}),/<summary><strong>example.org/);
});

test('disclosure state survives rendering and images are requested only when opening',async()=>{
  let queries=0;const window={HabitFlowDossiersStore:{safeLink:()=>''}};
  const document={readyState:'loading',addEventListener(){}};
  vm.runInNewContext(source.replace('  function mount() {','  window.disclosureTest={entryCard,toggleEntry,setDialog(d){dialog=d;}};\n  function mount() {'),{window,document,URL,Date});
  window.disclosureTest.setDialog({querySelectorAll(selector){assert.equal(selector,"[data-entry-disclosure][open] [data-image-path]");queries++;return [];}});
  const details={matches:()=>true,isConnected:true,open:true,dataset:{entryDisclosure:'e'}};
  window.disclosureTest.toggleEntry({target:details});assert.equal(queries,1);
  assert.match(window.disclosureTest.entryCard({id:'e',body:'Text',created_at:'2026-09-26'}),/data-entry-disclosure="e" open/);
  window.disclosureTest.toggleEntry({target:details});assert.equal(queries,1,'DOM rebuild toggle must not duplicate signing requests');
  details.open=false;window.disclosureTest.toggleEntry({target:details});assert.equal(queries,1);
  assert.doesNotMatch(window.disclosureTest.entryCard({id:'e',body:'Text',created_at:'2026-09-26'}),/data-entry-disclosure="e" open/);
});
