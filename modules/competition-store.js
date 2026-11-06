(function (window) {
  'use strict';
  const D=window.HabitFlowCompetitionDomain;
  const ROOT='habitflow-competition-v1:';
  const listeners=new Set();
  let owner, events=new Map(), acknowledged=new Set(), status='local', failure='', revision=0, flight=null, timer=null, activated=false;
  const user=()=>window.HabitFlowRemote?.getUserId?.() || 'local';
  const client=()=>window.HabitFlowRemote?.getClient?.();
  const prefix=id=>`${ROOT}${id}:event:`;
  function publish(){revision++;for(const listener of listeners)listener();}
  function load(){
    const next=user(); if(owner===next)return;
    owner=next;events=new Map();acknowledged=new Set();status=owner==='local'?'local':'pending';failure='';
    try {
      const p=prefix(owner);
      for(let i=0;i<window.localStorage.length;i++){
        const key=window.localStorage.key(i);if(!key?.startsWith(p))continue;
        let raw;try{raw=JSON.parse(window.localStorage.getItem(key));}catch{status='error';failure='Ein lokaler Eintrag ist beschädigt. Bitte den Verlauf exportieren.';continue;}const event=D.normalize(raw.event);
        if(!event || (event.user_id || 'local')!==owner)continue;
        events.set(event.id,event);if(raw.synced)acknowledged.add(event.id);
      }
    }catch(error){status='error';failure='Lokale Challenge-Daten konnten nicht vollständig gelesen werden.';}
    publish();
  }
  function persist(event,synced=false){
    // One immutable event per key: parallel tabs cannot overwrite other actions.
    window.localStorage.setItem(prefix(owner)+event.id,JSON.stringify({event,synced}));
    events.set(event.id,event);if(synced)acknowledged.add(event.id);
  }
  function append(challenge,kind,payload){
    load();const id=window.crypto.randomUUID();
    const event=D.normalize({id,challenge_id:challenge||id,user_id:owner==='local'?null:owner,kind,payload,occurred_at:new Date().toISOString()});
    if(!event)throw Error('Ungültige Challenge-Aktion.');
    // Report success only after the browser has accepted the durable write.
    try {persist(event);}catch(error){status='error';failure='Speichern fehlgeschlagen. Bitte Speicherplatz freigeben und erneut versuchen.';publish();throw Error(failure);}
    status=owner==='local'?'local':'pending';failure='';publish();schedule();return event;
  }
  function snapshot(){load();return {owner,events:[...events.values()],status,failure,revision,pending:[...events.keys()].filter(id=>!acknowledged.has(id)).length};}
  async function run(){
    load();const who=owner, remote=client();
    if(who==='local'||!remote){status='local';publish();return;}
    if(window.navigator?.onLine===false){status='offline';publish();return;}
    status='syncing';failure='';publish();
    const same=()=>user()===who && owner===who;
    try{
      const pending=[...events.values()].filter(e=>!acknowledged.has(e.id));
      for(let i=0;i<pending.length;i+=100){
        if(!same())return;
        const batch=pending.slice(i,i+100);
        const result=await remote.from('competition_events').upsert(batch,{onConflict:'id',ignoreDuplicates:true});
        if(result.error)throw result.error;if(!same())return;
        for(const event of batch)persist(event,true);
      }
      const cursorKey=ROOT+who+':cursor';
      const cursor=window.localStorage.getItem(cursorKey);
      let latest=cursor || '', offset=0;
      while(true){
        if(!same())return;
        let query=remote.from('competition_events').select('*').eq('user_id',who).order('created_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+199);
        if(cursor)query=query.gte('created_at',cursor);
        const result=await query;if(result.error)throw result.error;if(!same())return;
        for(const raw of result.data||[]){
          const event=D.normalize(raw);if(!event||event.user_id!==who)continue;
          if(!events.has(event.id)||!acknowledged.has(event.id))persist(event,true);
          if(raw.created_at>latest)latest=raw.created_at;
        }
        if((result.data||[]).length<200)break;offset+=200;
      }
      if(!same())return;
      if(latest)window.localStorage.setItem(cursorKey,latest);
      status=[...events.keys()].some(id=>!acknowledged.has(id))?'pending':'synced';
      if(status==='pending')schedule();
    }catch(error){
      if(!same())return;
      const missing=['42P01','PGRST205'].includes(error.code);
      status=missing?'setup':'offline';
      failure=missing?'Cloud-Sync benötigt einmalig das Competition-Datenbankupdate. Deine Versuche sind lokal gespeichert.':'Cloud-Sync ausstehend. Deine Versuche bleiben lokal gespeichert; beim nächsten Verbinden wird erneut versucht.';
    }finally{if(same())publish();}
  }
  function sync(){if(flight)return flight;const startedFor=user();flight=run().finally(()=>{flight=null;if(activated&&user()!==startedFor)schedule();});return flight;}
  function schedule(){window.clearTimeout(timer);timer=window.setTimeout(()=>void sync(),500);}
  function activate(){activated=true;load();void sync();}
  window.addEventListener('habitflow:auth-change',()=>{owner=undefined;load();if(activated)schedule();});
  window.addEventListener('online',()=>{if(activated)schedule();});
  window.addEventListener('storage',e=>{if(e.key?.startsWith(prefix(user()))){owner=undefined;load();if(activated)schedule();}});
  window.HabitFlowCompetitionStore=Object.freeze({snapshot,append,sync,activate,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},backup:()=>({schema:1,exported_at:new Date().toISOString(),...snapshot(),events:snapshot().events})});
})(window);
