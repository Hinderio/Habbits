const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(snapshot={}){
  class Node{
    constructor(){this.nodes=new Map();this.handlers=new Map();this.attrs={};this.dataset={};this.style={};this.open=false;this.innerHTML='';this.clientWidth=760;this.clientHeight=580;this.isConnected=true;const set=new Set();this.classList={add:x=>set.add(x),remove:x=>set.delete(x),contains:x=>set.has(x)};}
    setAttribute(k,v){this.attrs[k]=v;} addEventListener(k,fn){if(!this.handlers.has(k))this.handlers.set(k,[]);this.handlers.get(k).push(fn);}
    querySelector(s){if(!this.nodes.has(s))this.nodes.set(s,new Node());return this.nodes.get(s);} querySelectorAll(){return [];}
    append(node){this.child=node;} focus(){this.focused=true;} showModal(){this.open=true;}close(){this.open=false;}replaceChildren(){this.innerHTML='';}
    emit(k,event){for(const fn of this.handlers.get(k)||[])fn(event);}
  }
  const frames=[],timers=[],events=new Map(),body=new Node(),jumps=[],source={value:snapshot},opener=new Node();let reads=0;
  const document={body,activeElement:opener,createElement:()=>new Node(),getElementById:()=>new Node(),querySelector:()=>null};
  const window={HabitFlowOntologyBridge:{snapshot:()=>{reads++;return source.value;},open:dest=>{jumps.push(dest);return true;}},addEventListener:(k,fn)=>events.set(k,fn)};
  const context={window,document,requestAnimationFrame:fn=>(frames.push(fn),frames.length),cancelAnimationFrame:()=>{},setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout:()=>{},console};vm.createContext(context);
  for(const file of ['ontology-model.js','ontology.js'])vm.runInContext(fs.readFileSync(require.resolve('../modules/'+file),'utf8'),context);
  return{window,document,source,opener,jumps,get reads(){return reads;},get dialog(){return body.child;},flush(){while(timers.length)timers.shift()();while(frames.length)frames.shift()();},open(){window.HabitFlowOntology.open(opener);this.flush();},click(dataset){const button={dataset};body.child.emit('click',{target:{closest:()=>button}});this.flush();},authChange(){events.get('habitflow:auth-change')();}};
}
test('dialog reads only on demand, escapes user labels, bounds records and clears user data on close',()=>{
  const data={habits:[{id:'h',name:'<img src=x onerror=alert(1)>'}],habitEntries:Array.from({length:1000},(_,i)=>({id:'e'+i,habit_id:'h',note:'<script>bad()</script>'}))};
  const h=harness(data);assert.equal(h.reads,0);h.open();assert.equal(h.reads,1);assert.equal(h.dialog.open,true);
  assert.match(h.dialog.querySelector('[data-ont-entities]').innerHTML,/&lt;img/);
  assert.doesNotMatch(h.dialog.querySelector('[data-ont-entities]').innerHTML,/<img/);
  h.click({ontSelect:'habit:h'});
  let html=h.dialog.querySelector('[data-ont-records]').innerHTML;assert.equal((html.match(/data-ont-row=/g)||[]).length,25);assert.match(html,/&lt;script/);
  h.click({ont:'records-more'});html=h.dialog.querySelector('[data-ont-records]').innerHTML;assert.equal((html.match(/data-ont-row=/g)||[]).length,50);
  h.click({ont:'close'});assert.equal(h.dialog.open,false);assert.equal(h.dialog.querySelector('[data-ont-detail]').innerHTML,'');assert.equal(h.dialog.querySelector('.ont-nodes').innerHTML,'');assert.equal(h.opener.focused,true);
});
test('node arrows and records use correct navigation and release the modal scroll lock',()=>{
  const h=harness({habits:[{id:'h',name:'Habits'}],habitEntries:[{id:'e',habit_id:'h'}]});h.open();h.click({ontJump:'habit:h'});
  assert.equal(h.dialog.open,false);assert.equal(h.document.body.classList.contains('modal-open'),false);assert.equal(h.jumps[0].id,'h');assert.equal(h.jumps[0].kind,'habit');
  h.open();h.click({ontSelect:'entries'});h.click({ontRow:'0'});assert.equal(h.jumps.at(-1).id,'h');assert.equal(h.dialog.open,false);
});
test('large schema overview is bounded, live refresh replaces counts, and auth change closes the dialog',()=>{
  const h=harness({habits:Array.from({length:1000},(_,i)=>({id:'h'+i,name:'Habit '+i}))});h.open();h.click({ont:'overview'});
  assert.equal((h.dialog.querySelector('.ont-nodes').innerHTML.match(/<article /g)||[]).length,80);
  h.source.value={habits:[]};h.click({ont:'refresh'});assert.match(h.dialog.querySelector('[data-ont-detail]').innerHTML,/0 lokal geladen/);
  h.authChange();assert.equal(h.dialog.open,false);assert.equal(h.dialog.querySelector('[data-ont-entities]').innerHTML,'');
});
test('Escape preserves pre-existing scroll lock and restores focus',()=>{
  const h=harness();h.document.body.classList.add('modal-open');h.open();let prevented=false;
  h.dialog.emit('keydown',{key:'Escape',preventDefault(){prevented=true;},stopPropagation(){}});
  assert.equal(prevented,true);assert.equal(h.dialog.open,false);assert.equal(h.document.body.classList.contains('modal-open'),true);assert.equal(h.opener.focused,true);
});
test('model and UI do not fetch images, private data or execute background scans',()=>{
  const h=harness();h.open();h.flush();assert.equal(h.reads,1);
  const source=fs.readFileSync(require.resolve('../modules/ontology.js'),'utf8');assert.doesNotMatch(source,/setInterval\(|fetch\(|localStorage\.(?:setItem|removeItem)/);
});
