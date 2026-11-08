(function(window,document){
  'use strict';
  const D=window.HabitFlowCompetitionDomain,S=window.HabitFlowCompetitionStore;
  const root=document.getElementById('competitionRoot');if(!root||!D||!S)return;
  let historyOpen=false;try{historyOpen=window.localStorage.getItem('habitflow-competition-history-open')==='true';}catch{}
  let opened=false,renderTimer=null,tickTimer=null,lastDay='',historyLimit=8,dialogReturn=null,model=[],data={};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons={fruit:'M12 7c-5-5-11 1-8 8 2 5 5 6 8 4 3 2 6 1 8-4 3-7-3-13-8-8M12 7c0-4 2-5 5-5-1 3-2 4-5 5',smoke:'M5 14h12v4H5zM17 14h2v4h-2M20 14h2v4h-2M9 10c-3-3 3-3 0-6M14 10c-3-3 3-3 0-6',alcohol:'M9 3h6M10 3v5l-4 5v7h12v-7l-4-5V3M7 16h10',food:'M6 8c-4-1-4-6 0-6h12c4 0 4 5 0 6v12H6z',meditation:'M12 4a2 2 0 1 0 0 .01M4 16l4-3h8l4 3M7 21l5-5 5 5M9 9l3 3 3-3',hiking:'M4 20l5-9 4 5 3-9 5 13M14 4h3',book:'M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1v15',trophy:'M8 3h8v7a4 4 0 0 1-8 0zM8 5H4v3c0 3 2 4 4 4M16 5h4v3c0 3-2 4-4 4M12 14v6M8 21h8',check:'M5 12l4 4L19 6',arrow:'M5 12h14M14 7l5 5-5 5'};
  const icon=key=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[key]||icons.trophy}"/></svg>`;
  const visible=()=>!document.hidden&&document.body.dataset.activeScreen==='smoking'&&document.querySelector('[data-consumption-pane="competition"]')?.classList.contains('is-active');
  function readEvidence(){
    const keys=['cigarettes','alcoholLogs','alcoholUnits','alcoholEvents','habits','habitEntries'];
    try{const s=window.HabitFlowPersistence?.readCollections?.(keys)||JSON.parse(window.localStorage.getItem('habitflow-state-v1')||'{}');return D.evidence(s);}catch{return {smoke:[],alcohol:[],meditationDays:[]};}
  }
  function duration(ms,seconds=false){
    const n=Math.max(0,Math.floor(ms/1000)),days=Math.floor(n/86400),h=Math.floor(n/3600)%24,m=Math.floor(n/60)%60,s=n%60;
    if(seconds)return `${days?days+' T · ':''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return days?`${days} T ${h} Std.`:h?`${h} Std. ${m} Min.`:`${m} Min.`;
  }
  const date=value=>new Date(value).toLocaleDateString('de-CH',{day:'2-digit',month:'2-digit',year:'2-digit'});
  function announce(message){document.getElementById('competitionNotice').textContent=message;}
  function schedule(){if(!opened)return;window.clearTimeout(renderTimer);renderTimer=window.setTimeout(render,100);}
  function refreshModel(){data=readEvidence();model=D.project(S.snapshot().events,Date.now(),data);}
  function reconcile(){
    for(const run of model)if(run.needsFinish){try{S.append(run.id,'finish',{ended_at:new Date(run.endedAt).toISOString(),reason:run.reason});}catch(error){announce(error.message);}}
  }
  function best(type,exclude=''){return Math.max(0,...model.filter(r=>r.type===type&&r.id!==exclude).map(r=>r.score));}
  function bestLabel(type,value){return D.TYPES[type].mode==='timer'?duration(value):`${value} ${value===1?'Tag':'Tage'}`;}
  function weekStrip(run){
    const today=D.dateKey(Date.now());const days=[];let key=today;for(let i=0;i<7;i++){days.unshift(key);key=D.previousDay(key);}
    return `<div class="comp-week" aria-label="Letzte sieben Tage">${days.map(day=>{const done=run.confirmed.includes(day),future=day<D.dateKey(run.startedAt);return `<span class="${done?'is-done':''} ${day===today?'is-today':''} ${future?'is-before':''}" title="${esc(day)} · ${done?'Bestätigt':future?'Vor dem Start':'Nicht bestätigt'}"><small>${new Date(day+'T12:00:00').toLocaleDateString('de-CH',{weekday:'short'})}</small><i>${done?icon('check'):'·'}</i></span>`;}).join('')}</div>`;
  }
  function activeCard(run){
    const def=run.definition,pb=best(run.type,run.id),today=D.dateKey(Date.now()),abstinence=['alcohol','bread','sweets'].includes(run.type),maxDay=abstinence?D.previousDay(today):today;
    const checkDay=maxDay>=D.dateKey(run.startedAt)?maxDay:null,done=checkDay&&run.confirmed.includes(checkDay);
    const timer=def.mode==='timer';
    return `<article class="comp-card ${timer?'comp-card-timer':''}" style="--comp-accent:${def.color}" data-run="${run.id}">
      <header><div class="comp-type">${icon(def.icon)}<div><small>${esc(def.category)}</small><h3>${esc(def.title)}</h3></div></div><span class="comp-status"><i></i>${run.reached?'Ziel erreicht':'Läuft'}</span></header>
      <div class="comp-value"><strong ${timer?`data-clock-start="${run.startedAt}"`:''}>${timer?duration(run.elapsed,true):run.current}</strong><span>${timer?'ohne Zigarette':`${run.current===1?'Tag':'Tage'} in Folge`}</span></div>
      <div class="comp-progress-label"><span>Ziel: ${run.target} ${def.unit}</span><strong>${Math.floor(run.progress)}%</strong></div><div class="comp-progress" role="progressbar" aria-label="${esc(def.title)}: Ziel-Fortschritt" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(run.progress)}"><i style="width:${run.progress}%"></i></div>
      ${timer?`<div class="comp-timer-note">${icon('trophy')}<span>${pb?`Dein bisheriger Bestwert: <b>${duration(pb)}</b>`:'Dein erster Bestwert entsteht gerade.'}</span></div>`:weekStrip(run)}
      <div class="comp-card-foot"><span>Seit ${date(run.startedAt)}</span><span>${timer?'Zeit läuft weiter':`Bester Strike: ${Math.max(pb,run.best)} Tage`}</span></div>
      <div class="comp-actions">${timer?`<button type="button" class="comp-button comp-button-soft" data-comp-action="smoke" data-id="${run.id}">${icon('smoke')}Zigarette erfassen</button>`:run.habitId?`<button type="button" class="comp-button comp-button-soft" data-comp-action="habits">${icon('arrow')}Im Habit erfassen</button>`:`<button type="button" class="comp-button ${done?'comp-button-soft':'comp-button-primary'}" data-comp-action="check" data-id="${run.id}">${icon(done?'check':'arrow')}${done?'Tag bestätigt · bearbeiten':checkDay?(checkDay===today?'Heute bestätigen':'Gestern bestätigen'):'Tag bestätigen'}</button>`}<button type="button" class="comp-text-button" data-comp-action="finish" data-id="${run.id}">Beenden</button></div>
      ${!timer?`<p class="comp-fine">${run.habitId?`Habit: <b>${esc(run.habitName||'Verknüpftes Habit nicht verfügbar')}</b> · Einträge werden automatisch übernommen.${run.type==='alcohol'?' Abgeschlossene Tage zählen; Alkoholkonsum hat Vorrang.':''}`:['alcohol','meditation'].includes(run.type)?'Kein Habit verknüpft · aktuell zählen deine manuellen Bestätigungen.':'Nur bestätigte Tage zählen. Fehlende Tage unterbrechen die Serie.'}</p>`:''}
    </article>`;
  }
  function hallOfFame(){
    const records=D.records(model);
    return `<section class="comp-hall" aria-labelledby="compHallTitle"><div class="comp-section-head"><div><p class="eyebrow">DEINE PERSÖNLICHEN REKORDE</p><h3 id="compHallTitle">Hall of Fame</h3></div><span>${records.length} ${records.length===1?'Bestwert':'Bestwerte'}</span></div>
      ${records.length?`<div class="comp-record-grid">${records.map(run=>{const percent=Math.min(100,run.score/(run.definition.mode==='timer'?3600000:1)/run.target*100);return `<article class="comp-record ${run.reached?'is-achieved':''}" style="--comp-accent:${run.definition.color}"><div class="comp-record-top"><span class="comp-record-medal">${icon('trophy')}</span><span>${run.reached?'Ziel übertroffen oder erreicht':'Persönlicher Bestwert'}</span>${icon(run.definition.icon)}</div><h4>${esc(run.definition.title)}</h4><strong class="comp-record-value">${bestLabel(run.type,run.score)}</strong><div class="comp-record-track" aria-hidden="true"><i style="width:${percent}%"></i></div><p>Ziel im Rekordversuch: ${run.target} ${run.definition.unit}</p><footer><span>Seit ${date(run.startedAt)}</span><span>${run.active?'Versuch läuft':'Abgeschlossen'}</span></footer></article>`;}).join('')}</div>`:`<div class="comp-hall-empty">${icon('trophy')}<div><strong>Platz für deinen ersten Rekord.</strong><p>Mit deinem ersten Fortschritt erscheint hier dein persönlicher Bestwert pro Challenge.</p></div></div>`}</section>`;
  }
  function habitSelect(type){
    if(!['alcohol','meditation'].includes(type))return '';
    const habits=(data.habits||[]).filter(h=>!h.is_archived),suggested=data.habitLinks?.[type]?.id;
    return `<label>Mit Habit verbinden<select name="habit_id"><option value="">${habits.length?'Ohne Verknüpfung · manuell bestätigen':'Noch kein Habit vorhanden'}</option>${habits.map(h=>`<option value="${esc(h.id)}" ${h.id===suggested?'selected':''}>${esc(h.name)}</option>`).join('')}</select></label><p class="comp-fine">Positive Habit-Einträge zählen automatisch einmal pro Tag. ${type==='alcohol'?'Wähle dein Habit für alkoholfreie Tage. Alkohol-Einträge beenden den Versuch weiterhin.':'Wähle dein Meditations-Habit.'} Fehlende Einträge zählen nicht.</p>`;
  }
  function statusHtml(snapshot){
    const labels={local:'Auf diesem Gerät gespeichert',pending:'Lokal gespeichert · Sync ausstehend',syncing:'Wird synchronisiert',synced:'Cloud synchronisiert',offline:'Lokal gespeichert · offline',setup:'Lokal gespeichert · Cloud einrichten',error:'Speichern prüfen'};
    return `<button type="button" class="comp-sync" data-comp-action="sync" title="Synchronisierung erneut versuchen"><i class="${['setup','error','offline'].includes(snapshot.status)?'is-warning':''}"></i>${esc(labels[snapshot.status]||'Lokal gespeichert')}</button>${snapshot.failure?`<p class="comp-sync-detail" role="status">${esc(snapshot.failure)}${snapshot.status==='setup'?' <a href="sql/add-competition.sql" download>Datenbankupdate herunterladen</a>':''}</p>`:''}`;
  }
  function render(){
    if(!opened)return;
    refreshModel();reconcile();refreshModel();
    if(!visible())return;
    const snapshot=S.snapshot(),runs=model.filter(r=>!r.archived),active=runs.filter(r=>r.active),history=runs.filter(r=>!r.active),completed=model.filter(r=>r.reached).length;
    const historyFocused=document.activeElement?.tagName==='SUMMARY' && document.activeElement?.parentElement?.hasAttribute('data-comp-history');
    const focus=document.activeElement?.closest?.('[data-comp-action]');const focusKey=focus?{action:focus.dataset.compAction,id:focus.dataset.id,type:focus.dataset.type}:null;
    root.innerHTML=`<section class="comp-intro"><div><p class="eyebrow">COMPETITION · DEIN NÄCHSTER BESTWERT</p><h2>Ein Tag. Ein Versuch.<br><span>Ein Stück weiter.</span></h2><p>Deine Challenges gegen dich selbst. Bewusst starten, Fortschritt sichtbar machen und neue Bestwerte setzen.</p></div><div class="comp-scoreboard"><div><strong>${active.length}</strong><span>Laufend</span></div><div><strong>${completed}</strong><span>Ziele erreicht</span></div><div><strong>${model.length}</strong><span>Versuche</span></div></div></section>
      <div class="comp-toolbar"><div>${statusHtml(snapshot)}</div><button type="button" class="comp-text-button" data-comp-action="export">Verlauf exportieren</button></div>
      <section aria-labelledby="compActiveTitle"><div class="comp-section-head"><div><p class="eyebrow">DRANBLEIBEN</p><h3 id="compActiveTitle">Deine laufenden Challenges</h3></div><span>${active.length} aktiv</span></div>
      ${active.length?`<div class="comp-active-grid">${active.map(activeCard).join('')}</div>`:`<div class="comp-empty">${icon('trophy')}<h3>Der nächste Bestwert beginnt hier.</h3><p>Wähle unten deine erste Challenge. Start, Fortschritt und Verlauf werden gespeichert.</p><button type="button" class="comp-button comp-button-primary" data-comp-action="start" data-type="smoke">Rauchfrei starten ${icon('arrow')}</button></div>`}</section>
      ${hallOfFame()}
      <section aria-labelledby="compExploreTitle"><div class="comp-section-head"><div><p class="eyebrow">DEIN NÄCHSTER SCHRITT</p><h3 id="compExploreTitle">Challenge wählen</h3></div><span>Persönliche Bestwerte</span></div><div class="comp-catalog">${Object.entries(D.TYPES).filter(([,def])=>!def.retired).map(([type,def])=>{const running=active.some(r=>r.type===type),pb=best(type);return `<article class="comp-option" style="--comp-accent:${def.color}"><div class="comp-option-icon">${icon(def.icon)}</div><small>${esc(def.category)}</small><h4>${esc(def.title)}</h4><p>${esc(def.description)}</p><div class="comp-option-bottom"><span>${pb?`Bestwert <b>${bestLabel(type,pb)}</b>`:'Noch kein Bestwert'}</span><button type="button" class="comp-icon-button" data-comp-action="start" data-type="${type}" aria-label="${esc(def.title)} starten" ${running?'disabled':''}>${icon(running?'check':'arrow')}</button></div></article>`;}).join('')}</div></section>
      <details class="comp-attempts" data-comp-history ${historyOpen?'open':''}><summary><div class="comp-section-head"><div><p class="eyebrow">DEINE ENTWICKLUNG</p><h3 id="compHistoryTitle">Versuche & Bestwerte</h3></div><span>${history.length} beendet <span class="comp-chevron" aria-hidden="true">⌄</span></span></div></summary><div class="comp-history">${history.length?history.slice(0,historyLimit).map(run=>`<article><div class="comp-history-icon" style="color:${run.definition.color}">${icon(run.definition.icon)}</div><div><strong>${esc(run.definition.title)}</strong><small>${date(run.startedAt)} – ${date(run.endedAt)} · ${run.reason==='consumption'?'Konsum erfasst':'Beendet'}</small></div><div class="comp-history-value"><strong>${bestLabel(run.type,run.score)}</strong><small>${run.reached?'Ziel erreicht':`Ziel: ${run.target} ${run.definition.unit}`}</small></div><button type="button" class="comp-text-button" data-comp-action="start" data-type="${run.type}" ${run.definition.retired||active.some(r=>r.type===run.type)?'disabled':''}>${run.definition.retired?'Frühere Challenge':'Neuer Versuch'}</button></article>`).join(''):'<p class="comp-history-empty">Beendete Versuche erscheinen hier. Ein neuer Start überschreibt keinen früheren Versuch.</p>'}</div>${history.length>historyLimit?'<button type="button" class="comp-text-button" data-comp-action="more">Mehr anzeigen</button>':''}</details>`;
    if(focusKey){const match=[...root.querySelectorAll('[data-comp-action]')].find(el=>el.dataset.compAction===focusKey.action&&el.dataset.id===focusKey.id&&el.dataset.type===focusKey.type);match?.focus({preventScroll:true});}
    if(historyFocused)root.querySelector('[data-comp-history] > summary')?.focus({preventScroll:true});
    lastDay=D.dateKey(Date.now());manageTimer();
  }
  function manageTimer(){
    window.clearInterval(tickTimer);tickTimer=null;if(!visible())return;
    tickTimer=window.setInterval(()=>{
      if(!visible()){window.clearInterval(tickTimer);tickTimer=null;return;}
      for(const el of root.querySelectorAll('[data-clock-start]'))el.textContent=duration(Date.now()-Number(el.dataset.clockStart),true);
      // Refresh the cards only when the displayed whole-percent progress changes.
      const progressChanged=model.some(run=>run.active&&run.definition.mode==='timer'&&Math.floor(Math.min(100,(Date.now()-run.startedAt)/3600000/run.target*100))!==Math.floor(run.progress));
      if(progressChanged||lastDay!==D.dateKey(Date.now()))schedule();
    },root.querySelector('[data-clock-start]')?1000:60000);
  }

  function modal(title,body,submit,action){
    const dialog=document.getElementById('competitionDialog');dialogReturn=document.activeElement;
    dialog.innerHTML=`<form method="dialog" class="comp-modal-form"><header><div><p class="eyebrow">COMPETITION</p><h3 id="compDialogTitle">${esc(title)}</h3></div><button type="button" class="comp-close" aria-label="Schließen" data-comp-close>×</button></header>${body}<p class="comp-form-error" role="alert"></p><footer><button type="button" class="comp-button comp-button-soft" data-comp-close>Abbrechen</button><button type="submit" class="comp-button comp-button-primary">${esc(submit)}</button></footer></form>`;
    dialog.setAttribute('aria-labelledby','compDialogTitle');dialog.showModal();
    dialog.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{await action(new FormData(event.target));dialog.close();schedule();}catch(error){dialog.querySelector('.comp-form-error').textContent=error.message;button.disabled=false;}});
  }
  function handle(action,element){
    refreshModel();const type=element.dataset.type,run=model.find(r=>r.id===element.dataset.id);
    if(action==='start'){
      const def=D.TYPES[type];if(!def||def.retired||model.some(r=>r.type===type&&r.active))return;
      const goals=def.mode==='timer'?[4,8,12,24,48,72,168]:[3,7,14,21,30,60,90];
      modal(def.title,`<p>${esc(def.rule)}</p>${habitSelect(type)}<label>Dein Ziel<select name="goal">${goals.map(goal=>`<option value="${goal}" ${goal===def.goal?'selected':''}>${goal} ${def.unit}</option>`).join('')}</select></label><div class="comp-modal-note">${icon('trophy')}<span>Du startest jetzt. Dein Versuch bleibt auch nach dem Schließen der App erhalten. ${def.mode==='timer'?'Die Zeit läuft bis zum nächsten Rauch-Eintrag oder bis du beendest.':'Bestätige deine Tage regelmäßig; Lücken unterbrechen den Strike.'}</span></div>`,'Challenge starten',form=>{refreshModel();if(model.some(r=>r.type===type&&r.active))throw Error('Diese Challenge läuft bereits.');const habitId=String(form.get('habit_id')||'');if(habitId&&!(data.habits||[]).some(h=>h.id===habitId&&!h.is_archived))throw Error('Das gewählte Habit ist nicht mehr verfügbar.');S.append(null,'start',{type,goal:Number(form.get('goal')),...(['alcohol','meditation'].includes(type)?{habit_id:habitId}:{})});announce(`${def.title} gestartet.`);});
    }else if(action==='check'&&run?.active){
      const today=D.dateKey(Date.now()),max=['alcohol','bread','sweets'].includes(run.type)?D.previousDay(today):today,min=D.dateKey(run.startedAt);
      if(max<min){announce('Deinen ersten abgeschlossenen Tag kannst du morgen bestätigen.');return;}
      modal('Tag bestätigen',`<p>${esc(run.definition.rule)}</p><label>Tag<input type="date" name="day" min="${min}" max="${max}" value="${max}" required></label><label>Ergebnis<select name="done"><option value="true">Geschafft</option><option value="false">Nicht geschafft / Bestätigung zurücknehmen</option></select></label><p class="comp-fine">Du kannst frühere Tage innerhalb dieses Versuchs korrigieren.</p>`,'Speichern',form=>{const day=String(form.get('day'));if(!D.validDay(day)||day<min||day>max)throw Error('Bitte einen gültigen, zulässigen Tag auswählen.');refreshModel();if(!model.find(r=>r.id===run.id)?.active)throw Error('Dieser Versuch ist bereits beendet.');S.append(run.id,'check',{day,done:form.get('done')==='true'});announce('Tagesergebnis gespeichert.');});
    }else if((action==='finish'||action==='smoke')&&run?.active){
      const smoke=action==='smoke';modal(smoke?'Zigarette erfassen?':'Versuch beenden?',`<p>${smoke?'Die Zigarette wird im bestehenden Rauch-Verlauf gespeichert und beendet deinen Rauchfrei-Versuch.':'Dein bisheriger Fortschritt bleibt im Verlauf erhalten. Du kannst jederzeit einen neuen Versuch starten.'}</p>`,smoke?'Zigarette speichern':'Versuch beenden',async()=>{if(smoke){if(!window.HabitFlowCompetitionBridge?.recordSmoke)throw Error('Die Raucherfassung ist noch nicht bereit.');await window.HabitFlowCompetitionBridge.recordSmoke();}else S.append(run.id,'finish',{ended_at:new Date().toISOString(),reason:'manual'});announce(smoke?'Zigarette erfasst. Dein Versuch bleibt im Verlauf.':'Versuch gespeichert und beendet.');});
    }else if(action==='sync')void S.sync();
    else if(action==='habits'){document.querySelector('.nav-btn[data-target="habits"]')?.click();}
    else if(action==='more'){historyLimit+=8;render();}
    else if(action==='export'){const blob=new Blob([JSON.stringify(S.backup(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`competition-${D.dateKey(Date.now())}.json`;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }
  document.querySelector('.consumption-switch')?.addEventListener('keydown',event=>{
    const tabs=[...document.querySelectorAll('.consumption-switch-btn')],index=tabs.indexOf(event.target);
    if(index<0||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    tabs[next].click();tabs[next].focus();
  });
  root.addEventListener('toggle',event=>{if(!event.target.matches?.('[data-comp-history]')||!event.target.isConnected)return;historyOpen=event.target.open;try{window.localStorage.setItem('habitflow-competition-history-open',String(historyOpen));}catch{}},true);
  root.addEventListener('click',event=>{const button=event.target.closest('[data-comp-action]');if(button&&!button.disabled)handle(button.dataset.compAction,button);});
  const dialog=document.getElementById('competitionDialog');dialog.addEventListener('click',event=>{if(event.target.closest('[data-comp-close]'))dialog.close();});dialog.addEventListener('close',()=>dialogReturn?.isConnected&&dialogReturn.focus());
  S.subscribe(schedule);
  window.addEventListener('focus',()=>{if(opened){schedule();void S.sync();}});
  window.addEventListener('storage',event=>{if(event.key==='habitflow-state-v1')schedule();});
  window.addEventListener('habitflow:consumption-live-update',schedule);
  window.addEventListener('habitflow:auth-change',()=>{dialog.close();historyLimit=8;schedule();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){window.clearInterval(tickTimer);tickTimer=null;}else if(opened)schedule();});
  window.HabitFlowCompetition=Object.freeze({
    activate(){if(!opened){opened=true;S.activate();}render();},
    onStateSaved:schedule,
    onScreenChange(){if(visible()){if(!opened){opened=true;S.activate();}schedule();}else{window.clearInterval(tickTimer);tickTimer=null;}},
    refresh:schedule
  });
  if(document.querySelector('[data-consumption-pane="competition"]')?.classList.contains('is-active'))window.HabitFlowCompetition.activate();
})(window,document);
