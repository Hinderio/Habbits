const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
const fn = name => { const i=source.lastIndexOf(`  function ${name}(`); return source.slice(i,source.indexOf('\n  }',i)+4); };
let today=null;
const c=vm.createContext({alcoholDayLevel:r=>({label:['','Leicht','Moderat','Erhöht','Stark'][r]}),escapeHtml:String,
  toDateKey:()=> '2026-11-01',alcoholDayForDate:()=>today,visibleAlcoholDays:()=>today?[today]:[],daysBack:()=>['2026-11-01'],
  $:()=>null,$$:()=>[],els:{alcoholTodayUnits:{},alcoholTodayHint:{}},formatSignedPoints:String,alcoholPointsForDay:()=>-30});
vm.runInContext(fn('alcoholBottleMarkup')+'\n'+fn('renderAlcoholDashboard'),c);
c.renderAlcoholDashboard();
assert.match(c.els.alcoholTodayUnits.innerHTML,/Leere Flasche/);
assert.doesNotMatch(c.els.alcoholTodayUnits.innerHTML,/class="alcohol-bottle-liquid"/);
for(let rank=1;rank<=4;rank++){
 today={log_date:'2026-11-01',consumption_level:rank,consumption_key:rank};c.renderAlcoholDashboard();
 const html=c.els.alcoholTodayUnits.innerHTML;
 assert.match(html,new RegExp(`Konsumstufe ${rank} von 4`));
 assert.match(html,new RegExp(`y="${142-rank*27}" width="46" height="${rank*27}"`));
 assert.match(html,/role="img" aria-label=/);
}
today=null;c.renderAlcoholDashboard();assert.doesNotMatch(c.els.alcoholTodayUnits.innerHTML,/class="alcohol-bottle-liquid"/);
assert.equal(c.els.alcoholTodayHint.textContent,'Noch kein Tageskonsum erfasst');
console.log('Bottle: empty, levels 1–4, accessible labels and reset after removal passed');
