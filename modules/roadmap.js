(function(window,document){
  'use strict';
  const D=window.HabitFlowRoadmapDomain, esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const months=new Intl.DateTimeFormat('de-CH',{month:'short',year:'2-digit'}), dates=new Intl.DateTimeFormat('de-CH',{day:'numeric',month:'short',year:'numeric'});
  let dialog,snapshot,goals=[],rows=[],year,month,span=6,filter='all',limit=100,editing=null,opener;
  const today=()=>D.key(new Date().toISOString()), dateText=v=>v?dates.format(new Date(v+'T12:00:00')):'Ohne Datum';
  const dateAt=(y,m)=>D.key(new Date(y,m,1,12).toISOString());
  function refresh(){
    snapshot={...window.HabitFlowRoadmapBridge.snapshot(),...window.HabitFlowRoadmapProjects?.snapshot()};
    goals=window.HabitFlowRoadmapGoals.snapshot().goals;rows=D.build(snapshot,goals,today());limit=100;
  }
  function close(){dialog.close();}
  function shell(){
    dialog=document.createElement('dialog');dialog.className='roadmap-dialog';dialog.setAttribute('aria-labelledby','roadmapTitle');
    dialog.innerHTML=`<header class="roadmap-header"><div><p class="eyebrow">DEIN WEG NACH VORN</p><h2 id="roadmapTitle">Roadmap</h2><p>Ziele setzen. Fortschritt sehen. Zusammenhänge entdecken.</p></div><button type="button" data-action="close" aria-label="Roadmap schliessen">✕</button></header>
      <div class="roadmap-controls"><div class="roadmap-period"><button type="button" data-action="prev" aria-label="Vorheriger Zeitraum">‹</button><strong id="roadmapPeriod"></strong><button type="button" data-action="next" aria-label="Nächster Zeitraum">›</button><button type="button" data-action="today">Heute</button></div><label>Zeitraum<select id="roadmapSpan"><option value="3">3 Monate</option><option value="6" selected>6 Monate</option><option value="12">12 Monate</option></select></label><label>Ansicht<select id="roadmapFilter"><option value="all">Alles</option><option value="goal">Meine Ziele</option><option value="project">Projekte</option><option value="task">Aufgaben</option></select></label><button type="button" data-action="refresh" aria-label="Roadmap aktualisieren">↻</button><button type="button" data-action="weekly">Wochenliste ↗</button><button type="button" class="roadmap-primary" data-action="new">＋ Ziel setzen</button></div>
      <div id="roadmapEditor" hidden></div><p id="roadmapMessage" role="status" class="roadmap-message"></p><div class="roadmap-summary" id="roadmapSummary"></div><div class="roadmap-scroll" tabindex="0" role="region" aria-label="Roadmap-Zeitachse, horizontal scrollbar"><div id="roadmapGrid" class="roadmap-grid"></div></div><footer class="roadmap-footer"><span>◆ Ziel · ━ Projekt · ● Aufgabe</span><button type="button" data-action="more" hidden>Weitere 100 anzeigen</button><span id="roadmapCount"></span></footer>`;
    document.body.append(dialog);
    dialog.addEventListener('click',handle);
    dialog.addEventListener('change',e=>{if(e.target.id==='roadmapSpan'){span=Number(e.target.value);limit=100;render();}if(e.target.id==='roadmapFilter'){filter=e.target.value;limit=100;render();}if(e.target.name==='kind')updateHabitOptions();});
    dialog.addEventListener('submit',save);
    dialog.addEventListener('close',()=>{snapshot=null;goals=[];rows=[];editing=null;dialog.querySelector('#roadmapGrid').replaceChildren();dialog.querySelector('#roadmapEditor').replaceChildren();opener?.focus();});
  }
  function render(){
    const start=dateAt(year,month), end=D.key(new Date(year,month+span,0,12).toISOString()), a=D.day(start), b=D.day(end), width=b-a||1;
    const visible=D.windowRows(rows,start,end,filter), shown=visible.slice(0,limit), now=(D.day(today())-a)/width*100;
    dialog.querySelector('#roadmapPeriod').textContent=`${months.format(new Date(start+'T12:00:00'))} – ${months.format(new Date(end+'T12:00:00'))}`;
    const allGoals=rows.filter(r=>r.source==='goal');
    dialog.querySelector('#roadmapSummary').innerHTML=`<div><strong>${allGoals.length}</strong><span>Persönliche Ziele</span></div><div><strong>${allGoals.filter(r=>r.ratio>=1).length}</strong><span>Erreicht</span></div><div><strong>${visible.length}</strong><span>Einträge im Zeitraum</span></div><p>Deine Themen links. Dein Weg auf der Zeitachse.<br><small>Ziele öffnen zum Bearbeiten · Einträge öffnen ihre Quelle</small></p>`;
    let html=`<div class="roadmap-axis-label">KATEGORIE / THEMA</div><div class="roadmap-axis" style="--months:${span}">${Array.from({length:span},(_,i)=>`<span>${esc(months.format(new Date(year,month+i,1,12)))}</span>`).join('')}</div>`, group='';
    for(const r of shown){
      const rowIndex=r.index, hasDate=Boolean(r.start||r.end)&&(!r.start||r.start<=end)&&(!r.end||r.end>=start), startDay=D.day(r.start||r.end), endDay=D.day(r.end||r.start), left=Math.max(0,Math.min(100,(startDay-a)/width*100)), right=Math.max(left,Math.min(100,(endDay-a)/width*100));
      if(group!==r.groupKey){group=r.groupKey;html+=`<div class="roadmap-group ${r.projectId?'roadmap-lane-heading':''}">${r.projectId?'<small>PROJEKT</small>':''}${esc(r.group)}</div><div class="roadmap-group-line ${r.projectId?'roadmap-lane-heading':''}"></div>`;}
      const desc=`${r.title} · ${r.label||''} · ${dateText(r.end||r.start)}`;
      html+=`<button type="button" class="roadmap-topic${r.projectId?' roadmap-lane-topic':''}${r.laneRole&&r.laneRole!=='summary'?' roadmap-lane-child':''}" data-row="${rowIndex}" title="${esc(desc)}"><strong>${esc(r.title)}</strong><small>${esc(r.label)}${hasDate?' · '+esc(dateText(r.end||r.start)):''}</small></button><div class="roadmap-track roadmap-${r.source}${r.projectId?' roadmap-lane-track':''}" style="--months:${span}">${now>=0&&now<=100?`<i class="roadmap-today" style="left:${now}%" aria-hidden="true"></i>`:''}${hasDate?`<button type="button" class="roadmap-mark ${r.source==='goal'||r.laneRole==='milestone'?'is-goal':''}" data-row="${rowIndex}" style="left:${left}%;width:${Math.max(0,right-left)}%" aria-label="${esc(desc)}" title="${esc(desc)}"><span class="roadmap-fill" style="width:${Math.round((r.ratio||0)*100)}%"></span><span class="roadmap-dot"></span></button>`:`<span class="roadmap-undated">${r.start||r.end?'Projektzeitraum ausserhalb der Ansicht':'Noch ohne Datum · Quelle öffnen zum Planen'}</span>`}</div>`;
    }
    if(!shown.length)html+='<p class="roadmap-empty">Hier ist Platz für deinen nächsten Schritt. Setze ein Ziel oder wähle einen anderen Zeitraum.</p>';
    const grid=dialog.querySelector('#roadmapGrid');grid.innerHTML=html;grid.style.setProperty('--months',span);
    dialog.querySelector('[data-action="more"]').hidden=visible.length<=limit;
    dialog.querySelector('#roadmapCount').textContent=`${shown.length} von ${visible.length} Einträgen`;
  }
  function editor(goal=null){
    editing=goal;const m=goal?.metadata||{}, start=today(), due=`${start.slice(0,4)}-12-31`, host=dialog.querySelector('#roadmapEditor');host.hidden=false;
    host.innerHTML=`<form class="roadmap-form"><div class="roadmap-form-title"><h3>${goal?'Ziel bearbeiten':'Dein nächster Meilenstein'}</h3><button type="button" data-action="cancel">Schliessen</button></div><label class="roadmap-wide">Ziel<input name="title" maxlength="160" required placeholder="Zum Beispiel: 20-mal joggen" value="${esc(goal?.title)}"></label><label>Kategorie / Thema<input name="category" maxlength="60" required placeholder="Gesundheit, Lernen, Persönlich …" value="${esc(m.category||'Persönlich')}"></label><label>Fortschritt<select name="kind"><option value="manual">Manuell abhaken</option><option value="weight">Messwert erreichen (z. B. Gewicht)</option><option value="count">Habit-Einträge zählen (z. B. Joggen)</option></select></label><label data-weight>Zielrichtung<select name="direction"><option value="atMost">Höchstens (z. B. 80 kg)</option><option value="atLeast">Mindestens (z. B. 80 kg)</option></select></label><label>Start<input name="startDate" type="date" required value="${esc(m.startDate||start)}"></label><label>Zieldatum<input name="dueDate" type="date" required value="${esc(m.dueDate||due)}"></label><label data-auto>Habit<select name="habitId"></select></label><label data-auto>Zielwert<input name="target" type="number" min="0.01" step="any" value="${esc(m.target||'')}"></label><label data-manual class="roadmap-checkbox"><input type="checkbox" name="isDone" ${goal?.isDone?'checked':''}> Meilenstein erreicht</label><p class="roadmap-wide roadmap-help">Automatischer Fortschritt verwendet vorhandene Habit-Einträge bis heute und innerhalb des Zielzeitraums. Einträge aus Pausen werden wie in der App ausgeblendet. Es werden keine Habit-Daten verändert.</p><div class="roadmap-form-actions roadmap-wide"><button type="submit" class="roadmap-primary">Ziel speichern</button>${goal?'<button type="button" data-action="delete">Ziel löschen</button>':''}</div></form>`;
    host.querySelector('[name="kind"]').value=m.kind||'manual';host.querySelector('[name="direction"]').value=m.direction||'atMost';updateHabitOptions(m.habitId);host.querySelector('[name="title"]').focus();host.scrollIntoView({block:'nearest'});
  }
  function updateHabitOptions(selected){
    const form=dialog.querySelector('.roadmap-form');if(!form)return;const kind=form.elements.kind.value, select=form.elements.habitId, previous=selected||select.value;
    const options=snapshot.habits.filter(h=>kind!=='weight'||h.type!=='boolean');
    select.innerHTML='<option value="">Habit auswählen</option>'+options.map(h=>`<option value="${esc(h.id)}">${esc(h.name)}${h.unit?' ('+esc(h.unit)+')':''}</option>`).join('');select.value=previous||'';
    for(const el of form.querySelectorAll('[data-auto]'))el.hidden=kind==='manual';form.querySelector('[data-manual]').hidden=kind!=='manual';form.querySelector('[data-weight]').hidden=kind!=='weight';select.required=kind!=='manual';select.disabled=kind==='manual';form.elements.target.required=kind!=='manual';form.elements.target.disabled=kind==='manual';form.elements.target.step=kind==='count'?'1':'any';form.elements.target.min=kind==='count'?'1':'0.01';
  }
  function message(text){dialog.querySelector('#roadmapMessage').textContent=text;}
  function save(e){
    if(!e.target.matches('.roadmap-form'))return;e.preventDefault();const f=e.target.elements,h=snapshot.habits.find(h=>h.id===f.habitId.value);
    try{window.HabitFlowRoadmapGoals.save({id:editing?.id,title:f.title.value,isDone:f.isDone.checked,metadata:{kind:f.kind.value,direction:f.direction.value,category:f.category.value.trim().slice(0,60)||'Persönlich',startDate:f.startDate.value,dueDate:f.dueDate.value,habitId:f.habitId.value,target:Number(f.target.value),unit:h?.unit||''}});dialog.querySelector('#roadmapEditor').hidden=true;refresh();render();message('Ziel lokal gespeichert. Die bestehende Listensynchronisierung überträgt es, sobald eine Verbindung besteht.');dialog.querySelector('[data-action="new"]').focus();}catch(error){message(error.message);}
  }
  function handle(e){
    const button=e.target.closest('button');if(!button)return;
    if(button.dataset.row!==undefined){const r=rows[Number(button.dataset.row)];if(!r)return;if(r.source==='goal'){editor(r.goal);return;}opener=null;close();if(r.source==='project')window.HabitFlowRoadmapProjects?.open(r.id);else window.HabitFlowRoadmapBridge.open(r.source,r.id);return;}
    switch(button.dataset.action){
      case 'close':close();break;
      case 'prev':month-=span;render();break;case 'next':month+=span;render();break;
      case 'today':year=new Date().getFullYear();month=new Date().getMonth();render();break;
      case 'refresh':refresh();render();message('Ansicht mit den aktuell verfügbaren App-Daten aktualisiert.');break;
      case 'more':limit+=100;render();break;
      case 'weekly':opener=null;close();window.HabitFlowRoadmapBridge.open('weekly');break;
      case 'new':editor();break;
      case 'cancel':dialog.querySelector('#roadmapEditor').hidden=true;dialog.querySelector('[data-action="new"]').focus();break;
      case 'delete':if(editing&&window.confirm('Dieses Ziel löschen?')){try{window.HabitFlowRoadmapGoals.save({...editing,isArchived:true});dialog.querySelector('#roadmapEditor').hidden=true;refresh();render();message('Ziel gelöscht.');}catch(error){message(error.message);}}break;
    }
  }
  window.HabitFlowRoadmap=Object.freeze({open(){if(!dialog)shell();if(dialog.open)return;opener=document.activeElement;year=new Date().getFullYear();month=new Date().getMonth();span=6;dialog.querySelector('#roadmapSpan').value='6';refresh();dialog.querySelector('#roadmapEditor').hidden=true;message('');render();dialog.showModal();}});
})(window,document);
