const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
const file = n => ({ name: 'stage-' + n + '.png', id: 'image-' + n });
function setup(list) {
  let renders = 0, now = 1000000;
  const c = {
    Date: { now: () => now }, console: { warn() {} },
    supabaseClient: { storage: { from(bucket) { assert.equal(bucket, 'companion-posters'); return { list }; } } },
    currentUser: { id: 'user' }, COMPANION_POSTER_BUCKET: 'companion-posters',
    renderMonthlyMagazine() { renders++; void c.refreshMonthlyMagazineCovers(); },
    currentMonthKey: () => '2026-09', companionPosterAssetUrl: f => f
  };
  vm.createContext(c);
  vm.runInContext(source.match(/  const MONTHLY_MAGAZINE_COVERS = Object.freeze\(\[[^]*?\n  \]\);/)[0]
    + source.match(/  let monthlyMagazineCovers =[^]*?const MONTHLY_MAGAZINE_COVERS_REFRESH_MS =[^;]+;/)[0], c);
  for (const name of ['monthlyMagazineCoverCatalog', 'refreshMonthlyMagazineCovers', 'monthlyMagazineCoverUrl', 'monthlyMagazinePageCover']) {
    vm.runInContext(source.match(new RegExp('  (?:async )?function ' + name + '\\([^]*?\\n  \\}'))[0], c);
  }
  return { c, covers: () => vm.runInContext('monthlyMagazineCovers', c), renders: () => renders, advance() { now += 300001; } };
}
test('discovers stages 31–37 and future stages; rejects companion images, folders and unrelated files', () => {
  const { c } = setup();
  const input = [...Array.from({length:37}, (_,i) => file(i+1)), file(125), {name:'stage-126.webp',id:'126'},
    {name:'stage-99.png', id:null}, {name:'stage-40.png.bak',id:'x'}, {name:'other.png',id:'x'}, file(31)];
  const covers = c.monthlyMagazineCoverCatalog(input);
  assert.equal(covers.length,19);
  for(let n=31;n<=37;n++) assert.ok(covers.some(x => x.file === file(n).name));
  assert.ok(covers.some(x => x.file === 'stage-125.png'));
  assert.equal(covers.find(x => x.file === 'stage-23.png').label,'Peak Issue');
  assert.equal(JSON.stringify(covers),JSON.stringify(c.monthlyMagazineCoverCatalog(input.reverse())));
});
test('paginates beyond 100 objects and coalesces concurrent refreshes', async () => {
  const files = Array.from({length:237},(_,i)=>file(i+1)), offsets=[];
  const s=setup(async (path,options) => { assert.equal(path,''); offsets.push(options.offset); return {data:files.slice(options.offset,options.offset+options.limit)}; });
  await Promise.all([s.c.refreshMonthlyMagazineCovers(),s.c.refreshMonthlyMagazineCovers()]);
  assert.deepEqual(offsets,[0,100,200]); assert.equal(s.covers().length,217); assert.equal(s.renders(),1);
  await s.c.refreshMonthlyMagazineCovers(); assert.equal(offsets.length,3);
});
test('new uploads join the catalog after refresh, unchanged lists do not redraw', async () => {
  let files = [file(21),file(22),file(23)];
  const s=setup(async()=>({data:files}));
  await s.c.refreshMonthlyMagazineCovers(); s.advance();
  await s.c.refreshMonthlyMagazineCovers(); assert.equal(s.renders(),1);
  files=[...files,file(37),file(50)]; s.advance(); await s.c.refreshMonthlyMagazineCovers();
  assert.equal(s.covers().length,5); assert.equal(s.renders(),2);
});
test('failed or empty listing retains last working catalog and retries later', async () => {
  let mode='ok';
  const s=setup(async()=> { if(mode==='throw') throw Error('offline'); return mode==='error'?{error:Error('denied')}:{data:mode==='empty'?[]:[file(37)]}; });
  await s.c.refreshMonthlyMagazineCovers();
  for(const next of ['throw','error','empty']) { mode=next;s.advance();await s.c.refreshMonthlyMagazineCovers();assert.equal(s.covers()[0].file,'stage-37.png'); }
  mode='ok';s.advance();await s.c.refreshMonthlyMagazineCovers();assert.equal(s.renders(),1);
});
test('offline startup preserves original covers and logged-out state does not query Storage', async () => {
  let calls=0;
  const s=setup(async()=> { calls++;throw Error('offline'); });
  s.c.currentUser=null; await s.c.refreshMonthlyMagazineCovers(); assert.equal(calls,0);
  s.c.currentUser={id:'user'};await s.c.refreshMonthlyMagazineCovers();assert.equal(s.covers().length,10);
});
test('sparse score tiers still produce valid covers and pages', async () => {
  const s=setup(async()=>({data:[file(32)]}));
  await s.c.refreshMonthlyMagazineCovers();
  for(const score of [0,44,45,74,75,100]) {
    const cover=s.c.monthlyMagazineCoverUrl(score,'2026-09');
    assert.equal(cover.file,'stage-32.png');
    for(let page=0;page<3;page++) assert.equal(s.c.monthlyMagazinePageCover({cover},page).file,'stage-32.png');
  }
});
test('every new image can be selected and selection is deterministic', async () => {
  const s=setup(async()=>({data:Array.from({length:17},(_,i)=>file(i+21))}));
  await s.c.refreshMonthlyMagazineCovers();
  const selected = new Set();
  for(let year=2020;year<2040;year++) for(let month=1;month<=12;month++) for(const score of [0,45,75]) {
    const key=year+'-'+String(month).padStart(2,'0');
    const cover=s.c.monthlyMagazineCoverUrl(score,key);
    assert.equal(cover.file,s.c.monthlyMagazineCoverUrl(score,key).file);
    selected.add(cover.file);
  }
  for(let n=31;n<=37;n++) assert.ok(selected.has(file(n).name));
});
