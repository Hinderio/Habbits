// Optional repeatable synthetic benchmark: node tests/life-coach.bench.cjs
const { analyze } = require('../modules/life-coach.js');
const now = new Date(2026, 8, 13, 12);
const at = i => new Date(+now - i * 3600000).toISOString();
for (const [label, habits, logs, smoke, tasks] of [['typical', 15, 1000, 3000, 30], ['large', 50, 10000, 20000, 100]]) {
  const state = {
    habits: Array.from({length:habits}, (_,i)=>({id:String(i),name:'Habit '+i,type:'number',target_period:'week',target:3})),
    habitEntries: Array.from({length:logs},(_,i)=>({habit_id:String(i%habits),occurred_at:at(i%500),value_num:1})),
    cigarettes: Array.from({length:smoke},(_,i)=>({smoked_at:at(i)})),
    tasks: Array.from({length:tasks},(_,i)=>({id:String(i),title:'Task '+i,due_at:at(i)}))
  };
  for (let i=0;i<3;i++) analyze(state,{},now);
  const times=[];
  for(let i=0;i<10;i++){const start=performance.now();analyze(state,{},now);times.push(performance.now()-start);}
  times.sort((a,b)=>a-b);
  console.log(`${label}: ${habits+logs+smoke+tasks} records, median ${times[5].toFixed(1)} ms, max ${times.at(-1).toFixed(1)} ms`);
}
