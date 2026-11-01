const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
new vm.Script(source);
const fn=n=>{const a=source.lastIndexOf(`  function ${n}(`);return source.slice(a,source.indexOf('\n  }',a)+4);};
let days=[];
const c=vm.createContext({DAY_MS:86400000,ALCOHOL_ANALYSIS_START:'2026-07-27',toDateKey:()=> '2026-08-01',alcoholDayForDate:()=>days.find(d=>d.log_date==='2026-08-01'),visibleAlcoholDays:()=>days,daysBack:()=>[],$:()=>null,$$:()=>[],els:{alcoholTodayUnits:{},alcoholTodayHint:{}}});
vm.runInContext(fn('alcoholFreeStreakStats')+'\n'+fn('renderAlcoholDashboard'),c);
for(const [date,value,label] of [['2026-08-01','0','Tage ohne Alkohol'],['2026-07-31','1','Tag ohne Alkohol'],['2026-07-27','5','Tage ohne Alkohol']]){days=[{log_date:date}];c.renderAlcoholDashboard();assert.equal(c.els.alcoholTodayUnits.textContent,value);assert.equal(c.els.alcoholTodayHint.textContent,label);}
days=[];c.renderAlcoholDashboard();assert.equal(c.els.alcoholTodayUnits.textContent,'6');
assert.ok(!source.includes('alcoholBottleMarkup'));
console.log('Strike hero: current consumption, one/multiple days, empty history and bottle removal passed');
