(function (window, document) {
  'use strict';
  const domain = window.HabitFlowOntologyModel;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const number = value => Number(value).toLocaleString('de-CH');
  const kinds = { stored:'Verknüpfung', derived:'Berechnet / fachlich', contains:'Enthalten' };
  let dialog, model, trigger, selected = 'habits', group = '', query = '', overview = false;
  let recordLimit = 25, relationLimit = 30, entityLimit = 60, recordQuery = '', rowActions = [], transform = { x:0, y:0, scale:1 }, positions = new Map();
  let graphWidth = 0, graphHeight = 0, graphFrame = 0, inputTimer = 0, recordTimer = 0, pointer, wasLocked = false;
  function snapshot() {
    const bridge = window.HabitFlowOntologyBridge;
    if (!bridge) throw new Error('Die App ist noch nicht bereit. Bitte öffne die Ontology erneut.');
    const base = bridge.snapshot(), lists = window.HabitFlowListsCoach?.snapshot() || {}, dossiers = window.HabitFlowDossiersStore?.snapshot() || {};
    return { ...base, lists:lists.lists || [], listItems:lists.items || [], photoTours:lists.tours || [], photoStops:lists.stops || [], goals:window.HabitFlowRoadmapGoals?.snapshot()?.goals || [],
      dossiers:dossiers.dossiers || [], dossierEntries:dossiers.entries || [], learnings:window.HabitFlowModules?.get('learning-vault')?.snapshot?.() || [] };
  }
  function ensure() {
    if (dialog) return;
    dialog = document.createElement('dialog'); dialog.id = 'ontologyDialog'; dialog.className = 'ont-dialog'; dialog.setAttribute('aria-labelledby','ontologyTitle');
    dialog.innerHTML = `<div class="ont-shell">
      <header class="ont-header"><div class="ont-brand" aria-hidden="true">◈</div><div><p class="ont-eyebrow">HABITFLOW · DEIN VERNETZTER ALLTAG</p><h2 id="ontologyTitle">Ontology</h2><p class="ont-subtitle">Entdecke, wie alles zusammenhängt.</p></div><button type="button" class="ont-close" data-ont="close" aria-label="Ontology schliessen">×</button></header>
      <div class="ont-toolbar"><label class="ont-search"><span aria-hidden="true">⌕</span><input type="search" data-ont-search placeholder="Entität suchen …" aria-label="Entitäten und Beziehungen suchen" autocomplete="off"></label><label class="ont-group-label"><span class="ont-sr">Bereich filtern</span><select data-ont-group><option value="">Alle Bereiche</option>${Object.entries(domain.groups).map(([id,g]) => `<option value="${id}">${g.label}</option>`).join('')}</select></label><button type="button" data-ont="overview" aria-pressed="false">Gesamtkarte</button><button type="button" data-ont="refresh" title="Aktuell geladene App-Daten neu einlesen">Aktualisieren</button></div>
      <div class="ont-layout"><aside class="ont-catalog" aria-label="Entitäten"><div class="ont-section-head"><b>Entitäten</b><span data-ont-count></span></div><div data-ont-entities></div></aside>
      <section class="ont-map-section" aria-label="Beziehungskarte"><div class="ont-map-caption"><span data-ont-map-title>Im Fokus</span><span class="ont-local">● Lokal geladen</span></div>
      <div class="ont-viewport" tabindex="0" aria-label="Beziehungskarte. Mit Pfeiltasten verschieben, Plus und Minus zum Zoomen, 0 zum Einpassen. Alternativ die Entitätenliste verwenden."><div class="ont-world"><svg class="ont-edges" aria-hidden="true"></svg><div class="ont-nodes"></div></div><div class="ont-empty" hidden>Keine Entität gefunden.<br>Versuche einen anderen Begriff oder Bereich.</div></div>
      <div class="ont-map-controls"><button type="button" data-ont="out" aria-label="Verkleinern">−</button><output data-ont-zoom aria-label="Zoom">100%</output><button type="button" data-ont="in" aria-label="Vergrössern">+</button><button type="button" data-ont="fit">Einpassen</button><button type="button" data-ont="focus">Fokus</button></div>
      <footer class="ont-legend"><span><i></i>Verknüpfung</span><span><i class="ont-dashed"></i>Berechnet / fachlich</span><span><i class="ont-dotted"></i>Enthalten</span><small data-ont-map-status></small></footer></section>
      <aside class="ont-detail" aria-label="Entitätsdetails"><div data-ont-detail></div></aside></div>
      <footer class="ont-footer"><span data-ont-status role="status" aria-live="polite"></span><span>Knoten wählen → Beziehungen erkunden · ↗ öffnet die App</span></footer>
    </div>`;
    document.body.append(dialog);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button) return;
      if (button.dataset.ontSelect) { select(button.dataset.ontSelect); return; }
      if (button.dataset.ontJump) { navigate(model.nodes.get(button.dataset.ontJump)?.target); return; }
      if (button.dataset.ontRow !== undefined) { navigate(rowActions[Number(button.dataset.ontRow)]); return; }
      const action = button.dataset.ont;
      if (action === 'close') close();
      if (action === 'in') zoom(1.25);
      if (action === 'out') zoom(.8);
      if (action === 'fit') fit();
      if (action === 'focus') { overview = false; group = ''; query = ''; syncFilters(); renderCatalog(); renderGraph(); }
      if (action === 'overview') { overview = !overview; syncFilters(); renderGraph(); }
      if (action === 'refresh') refresh();
      if (action === 'entities-more') { entityLimit += 60; renderCatalog(); }
      if (action === 'records-more') { recordLimit += 25; renderRecords(); dialog.querySelector('[data-ont="records-more"]')?.focus({ preventScroll:true }); }
      if (action === 'relations-more') { relationLimit += 30; renderDetail(); dialog.querySelector('[data-ont="relations-more"]')?.focus({ preventScroll:true }); }
    });
    dialog.querySelector('[data-ont-search]').addEventListener('input', event => {
      query = event.target.value; entityLimit = 60; clearTimeout(inputTimer);
      inputTimer = setTimeout(() => { if (dialog.open) { renderCatalog(); renderGraph(); } }, 120);
    });
    dialog.querySelector('[data-ont-group]').addEventListener('change', event => { group = event.target.value; entityLimit = 60; renderCatalog(); renderGraph(); });
    dialog.addEventListener('input', event => {
      if (!event.target.matches('[data-ont-record-search]')) return;
      recordQuery = event.target.value; recordLimit = 25; clearTimeout(recordTimer);
      recordTimer = setTimeout(() => { if (dialog.open) renderRecords(); }, 120);
    });
    // Native dialog provides focus containment and makes the background inert.
    // Stop Escape before older document-level modal handlers also consume it.
    dialog.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } });
    const viewport = dialog.querySelector('.ont-viewport');
    viewport.addEventListener('pointerdown', event => {
      if (event.target.closest('button') || event.button !== 0) return;
      pointer = { id:event.pointerId, x:event.clientX, y:event.clientY, tx:transform.x, ty:transform.y };
      viewport.setPointerCapture(event.pointerId); viewport.classList.add('is-panning');
    });
    viewport.addEventListener('pointermove', event => {
      if (!pointer || event.pointerId !== pointer.id) return;
      transform.x = pointer.tx + event.clientX - pointer.x; transform.y = pointer.ty + event.clientY - pointer.y; applyTransform();
    });
    const end = () => { pointer = null; viewport.classList.remove('is-panning'); };
    viewport.addEventListener('pointerup',end); viewport.addEventListener('pointercancel',end); viewport.addEventListener('lostpointercapture',end);
    viewport.addEventListener('wheel', event => {
      if (!event.ctrlKey && !event.metaKey) return; event.preventDefault();
      const rect = viewport.getBoundingClientRect(); zoom(event.deltaY > 0 ? .9 : 1.1, event.clientX-rect.left, event.clientY-rect.top);
    }, { passive:false });
    viewport.addEventListener('keydown', event => {
      if (event.target !== viewport) return;
      const delta = { ArrowLeft:[40,0], ArrowRight:[-40,0], ArrowUp:[0,40], ArrowDown:[0,-40] }[event.key];
      if (delta) { event.preventDefault(); transform.x += delta[0]; transform.y += delta[1]; applyTransform(); }
      if (['+','=','-','0'].includes(event.key)) { event.preventDefault(); if (event.key === '0') fit(); else zoom(event.key === '-' ? .8 : 1.25); }
    });
    if (window.ResizeObserver) new ResizeObserver(() => { if (dialog.open && model) renderGraph(); }).observe(viewport);
  }
  function status(message) { dialog.querySelector('[data-ont-status]').textContent = message; }
  function open(button) {
    ensure(); if (dialog.open) return;
    trigger = button || document.activeElement; wasLocked = document.body.classList.contains('modal-open');
    model = domain.build(snapshot()); if (!model.nodes.has(selected)) selected = 'habits';
    recordLimit = 25; relationLimit = 30; recordQuery = ''; dialog.showModal(); document.body.classList.add('modal-open');
    syncFilters(); renderCatalog(); renderDetail(); renderGraph();
    status(`${model.nodes.size} Entitäten · ${model.edges.length} Beziehungen · Stand ${new Date().toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'})}`);
    dialog.querySelector('[data-ont-search]').focus({ preventScroll:true });
  }
  function close(restore = true) {
    if (!dialog?.open) return;
    clearTimeout(inputTimer); clearTimeout(recordTimer); cancelAnimationFrame(graphFrame); graphFrame = 0; pointer = null;
    dialog.close(); if (!wasLocked) document.body.classList.remove('modal-open');
    if (restore) (trigger?.isConnected ? trigger : document.getElementById('pointsRulesBtn'))?.focus({preventScroll:true});
    // Release references to user rows and rendered text while closed / logged out.
    model = null; rowActions = []; positions.clear();
    for (const selector of ['[data-ont-detail]','[data-ont-entities]','.ont-nodes','.ont-edges']) dialog.querySelector(selector).replaceChildren();
  }
  function refresh() {
    try { model = domain.build(snapshot()); if (!model.nodes.has(selected)) selected = 'habits'; renderCatalog(); renderDetail(); renderGraph(); status('Geladene App-Daten aktualisiert. Zum Nachladen weiterer Daten die jeweilige App-Ansicht öffnen.'); }
    catch (error) { status(error.message); }
  }
  function syncFilters() {
    dialog.querySelector('[data-ont-search]').value = query; dialog.querySelector('[data-ont-group]').value = group;
    dialog.querySelector('[data-ont="overview"]').setAttribute('aria-pressed',String(overview));
  }
  function select(id) {
    if (!model.nodes.has(id)) return;
    selected = id; recordLimit = 25; relationLimit = 30; recordQuery = ''; overview = false; query = ''; group = ''; syncFilters();
    renderCatalog(); renderDetail(); renderGraph();
    dialog.querySelector('.ont-detail').scrollTop = 0;
    [...dialog.querySelectorAll('[data-ont-select]')].find(button => button.dataset.ontSelect === id)?.focus({ preventScroll:true });
    status(model.nodes.get(id).label + ' im Fokus.');
  }
  function renderCatalog() {
    const matches = domain.sliceGraph(model,selected,{group,query,overview:true,limit:Number.MAX_SAFE_INTEGER}).nodes;
    dialog.querySelector('[data-ont-count]').textContent = number(matches.length);
    dialog.querySelector('[data-ont-entities]').innerHTML = matches.slice(0,entityLimit).map(node => `<button type="button" class="ont-entity ${node.id === selected ? 'is-selected' : ''}" data-ont-select="${escape(node.id)}" aria-pressed="${node.id === selected}"><i style="--ont-color:${domain.groups[node.group].color}"></i><span>${escape(node.label)}<small>${escape(domain.groups[node.group].label)}</small></span><b>${node.count === null ? '↗' : number(node.count)}</b></button>`).join('') + (matches.length > entityLimit ? '<button type="button" class="ont-more" data-ont="entities-more">Weitere Entitäten</button>' : !matches.length ? '<p class="ont-muted">Keine Treffer.</p>' : '');
  }
  function renderDetail() {
    const node = model.nodes.get(selected), links = model.adjacency.get(selected) || [];
    rowActions = [];
    dialog.querySelector('[data-ont-detail]').innerHTML = `<p class="ont-eyebrow" style="color:${domain.groups[node.group].color}">${escape(domain.groups[node.group].label)}</p><h3>${escape(node.label)}</h3><div class="ont-detail-stats"><b>${node.count === null ? 'Abgeleitet / Struktur' : number(node.count)+' lokal geladen'}</b><span>${links.length} Beziehungen</span></div><p class="ont-description">${escape(node.description)}</p>${node.target ? `<button type="button" class="ont-primary" data-ont-jump="${escape(node.id)}">In der App öffnen <span aria-hidden="true">↗</span></button>` : '<p class="ont-muted">Für diese Sammlung ist noch kein Sprungziel registriert.</p>'}<details class="ont-fields"><summary>Attribute & Datenmodell</summary><ul>${node.fields.map(field=>`<li>${escape(field)}</li>`).join('')}</ul></details><h4>Beziehungen <span>${links.length}</span></h4><div class="ont-relations">${links.slice(0,relationLimit).map(link => { const outgoing = link.from === selected, other = model.nodes.get(outgoing ? link.to : link.from); return `<button type="button" data-ont-select="${escape(other.id)}" title="${escape(link.evidence || kinds[link.kind])}"><span class="ont-relation-kind">${outgoing ? '→' : '←'} ${kinds[link.kind]}</span><b>${escape(other.label)}</b><small>${escape(outgoing ? node.label : other.label)} ${escape(link.label)} ${escape(outgoing ? other.label : node.label)}</small>${link.evidence ? `<small class="ont-evidence">${escape(link.evidence)}</small>` : ''}</button>`; }).join('') || '<p class="ont-muted">Noch keine Beziehungen registriert.</p>'}</div>${links.length > relationLimit ? '<button type="button" class="ont-more" data-ont="relations-more">Weitere 30 Beziehungen</button>' : ''}${node.rows ? `<h4>Datensätze <span>${number(node.count)}</span></h4><p class="ont-muted">Aktive, lokal geladene Daten. Einträge innerhalb von Pausen sind hier enthalten; Auswertungen können sie ausblenden.</p><input type="search" data-ont-record-search value="${escape(recordQuery)}" placeholder="Datensätze durchsuchen …" aria-label="Datensätze dieser Entität durchsuchen"><div data-ont-records></div>` : '<p class="ont-muted">Diese Entität beschreibt eine Struktur oder Auswertung, keine zusätzliche Datentabelle.</p>'}`;
    renderRecords();
  }
  function rowTitle(row) { return row.title || row.name || row.body?.slice(0,90) || row.reason || row.note?.replace(/<!--.*?-->/gs,'').slice(0,90) || row.log_date || row.date_key || row.occurred_at || row.smoked_at || row.id || 'Eintrag'; }
  function rowTarget(node,row) {
    if (node.rowTarget) return node.rowTarget(row);
    const targets = { habits:{screen:'habits',kind:'habit',id:row.id}, entries:{screen:'habits',kind:'habit',id:row.habit_id}, fitness:{screen:'fitness',kind:'fitness',id:row.id}, tasks:{screen:'tasks',kind:'task',id:row.id}, projects:{screen:'projects',kind:'project',id:row.id}, phases:{screen:'projects',kind:'project',id:row.project_id}, milestones:{screen:'projects',kind:'project',id:row.project_id}, projectNotes:{screen:'projects',kind:'project',id:row.project_id}, appointments:{screen:'calendar',kind:'appointment',id:row.id,anchor:'dayDetails'}, dossiers:{screen:'projects',kind:'dossier',id:row.id}, dossierEntries:{screen:'projects',kind:'dossier',id:row.dossier_id}, photoTours:{screen:'lists',kind:'list',id:'photos',itemId:row.id}, photoStops:{screen:'lists',kind:'list',id:'photos',itemId:row.id}, pauses:row.scope === 'habit' ? {screen:'habits',kind:'habit',id:row.target_id} : {screen:'smoking',kind:'pauses',anchor:'consumptionPauseList'}, lists:{screen:'lists',kind:'list',id:row.id}, listItems:{screen:'lists',kind:'list',id:row.listId,itemId:row.id} };
    return targets[node.id] || node.target;
  }
  function renderRecords() {
    const host = dialog.querySelector('[data-ont-records]'); if (!host) return;
    const node = model.nodes.get(selected), term = recordQuery.trim().toLocaleLowerCase('de');
    const rows = term ? node.rows.filter(row => String(rowTitle(row)).toLocaleLowerCase('de').includes(term)) : node.rows;
    rowActions = [];
    host.innerHTML = rows.slice(0,recordLimit).map(row => { const destination = rowTarget(node,row), idx = rowActions.push(destination)-1; return `<${destination ? 'button type="button" data-ont-row="'+idx+'"' : 'div'} class="ont-record"><span>${escape(rowTitle(row))}<small>${escape(row.occurred_at || row.starts_at || row.created_at || row.createdAt || row.status || '')}</small></span>${destination ? '<b aria-hidden="true">↗</b>' : ''}</${destination ? 'button' : 'div'}>`; }).join('') + `<p class="ont-muted">${Math.min(rows.length,recordLimit)} von ${number(rows.length)} Datensätzen${rows.length ? '' : ' · Noch keine passenden Daten geladen.'}</p>` + (rows.length > recordLimit ? '<button type="button" class="ont-more" data-ont="records-more">Weitere 25 anzeigen</button>' : '');
  }
  function renderGraph() {
    const graph = domain.sliceGraph(model,selected,{group,query,overview,limit:80});
    positions = new Map();
    const center = graph.nodes.find(node=>node.id === selected), neighbors = graph.nodes.filter(node=>node.id !== selected);
    const columns = Math.max(2, Math.min(5,Math.ceil(Math.sqrt(graph.nodes.length))));
    // Stable grid for overview, two clear banks around a focused entity; no physics loop.
    if (!overview && !query && !group && center) {
      const half = Math.ceil(neighbors.length/2); graphWidth = 910; graphHeight = Math.max(360, half*108+60);
      positions.set(center.id,{x:350,y:graphHeight/2-36});
      neighbors.forEach((node,i)=>positions.set(node.id,{x:i<half ? 30:670,y:42+(i%half)*108}));
    } else {
      graphWidth = columns*285+40; graphHeight = Math.max(300,Math.ceil(graph.nodes.length/columns)*125+50);
      graph.nodes.forEach((node,i)=>positions.set(node.id,{x:30+(i%columns)*285,y:35+Math.floor(i/columns)*125}));
    }
    dialog.querySelector('.ont-empty').hidden = Boolean(graph.nodes.length);
    dialog.querySelector('[data-ont-map-title]').textContent = (overview || query || group) ? 'Entitäten im Überblick' : 'Im Fokus · '+model.nodes.get(selected).label;
    dialog.querySelector('[data-ont-map-status]').textContent = `${graph.nodes.length} von ${graph.total} Knoten · ${graph.edges.length} Beziehungen${graph.total > 80 ? ' · Mit Suche oder Bereich eingrenzen' : ''}`;
    const svg = dialog.querySelector('.ont-edges'); svg.setAttribute('width',graphWidth); svg.setAttribute('height',graphHeight);
    svg.innerHTML = `<defs><marker id="ont-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="none" stroke="currentColor"/></marker></defs>`+graph.edges.map(rel => {
      const a = positions.get(rel.from), b = positions.get(rel.to), forward = b.x>a.x;
      const x1 = a.x+(forward?210:0), x2=b.x+(forward?0:210), y1=a.y+36,y2=b.y+36;
      const bend = Math.max(45,Math.abs(x2-x1)*.45), d=`M${x1},${y1} C${x1+(forward?bend:-bend)},${y1} ${x2+(forward?-bend:bend)},${y2} ${x2},${y2}`;
      return `<path d="${d}" class="ont-edge ont-edge-${rel.kind}" marker-end="url(#ont-arrow)"><title>${escape(model.nodes.get(rel.from).label+' '+rel.label+' '+model.nodes.get(rel.to).label)}</title></path>${!overview && !query && !group ? `<text x="${(x1+x2)/2}" y="${(y1+y2)/2-6}" class="ont-edge-label" text-anchor="middle">${escape(rel.label)}</text>` : ''}`;
    }).join('');
    dialog.querySelector('.ont-nodes').innerHTML = graph.nodes.map(node => { const pos=positions.get(node.id); return `<article class="ont-node ${node.id===selected?'is-selected':''}" style="left:${pos.x}px;top:${pos.y}px;--ont-color:${domain.groups[node.group].color}"><button type="button" class="ont-node-main" data-ont-select="${escape(node.id)}" aria-pressed="${node.id===selected}" title="${escape(node.label)}"><small>${escape(domain.groups[node.group].label)}</small><b>${escape(node.label)}</b><span>${node.count===null?'Struktur / Auswertung':number(node.count)+' geladen'}</span></button>${node.target ? `<button type="button" class="ont-node-jump" data-ont-jump="${escape(node.id)}" aria-label="${escape(node.label)} in der App öffnen">↗</button>` : ''}</article>`; }).join('');
    fit();
    // Start focused views at a readable scale; Einpassen explicitly shows every neighbor.
    if (!overview && !query && !group && center) {
      const viewport = dialog.querySelector('.ont-viewport'), pos = positions.get(center.id);
      transform.scale = Math.max(.85, transform.scale);
      transform.x = viewport.clientWidth/2 - (pos.x+105)*transform.scale;
      transform.y = viewport.clientHeight/2 - (pos.y+38)*transform.scale; applyTransform();
    }
  }
  function fit() {
    if (!dialog?.open) return;
    const viewport=dialog.querySelector('.ont-viewport');
    transform.scale=Math.min(1.15,Math.max(.16,Math.min((viewport.clientWidth-32)/graphWidth,(viewport.clientHeight-32)/graphHeight)));
    transform.x=(viewport.clientWidth-graphWidth*transform.scale)/2; transform.y=(viewport.clientHeight-graphHeight*transform.scale)/2; applyTransform();
  }
  function zoom(factor,x,y) {
    const viewport=dialog.querySelector('.ont-viewport'); x ??= viewport.clientWidth/2; y ??= viewport.clientHeight/2;
    const scale=Math.max(.15,Math.min(2.5,transform.scale*factor)), ratio=scale/transform.scale;
    transform.x=x-(x-transform.x)*ratio; transform.y=y-(y-transform.y)*ratio; transform.scale=scale; applyTransform();
  }
  function applyTransform() {
    if (graphFrame) return;
    graphFrame=requestAnimationFrame(()=>{ graphFrame=0; if (!dialog.open) return; dialog.querySelector('.ont-world').style.transform=`translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`; dialog.querySelector('[data-ont-zoom]').textContent=Math.round(transform.scale*100)+'%'; });
  }
  function navigate(destination) {
    if (!destination) return;
    const savedTrigger = trigger;
    close(false);
    let success = true;
    try {
      if (destination.kind === 'project' && !window.HabitFlowRoadmapProjects?.snapshot().projects.some(row => row.id === destination.id && !row.is_archived)) throw new Error('Projekt nicht mehr verfügbar.');
      success = window.HabitFlowOntologyBridge.open(destination);
      if (success && destination.kind === 'project') { window.HabitFlowDossiers?.showProjects(); window.HabitFlowRoadmapProjects?.open(destination.id); }
      if (success && destination.kind === 'dossier') success = window.HabitFlowDossiers?.open(destination.id) !== false;
      if (success && destination.kind === 'list') window.HabitFlowListsCoach?.open(destination.id,destination.itemId);
      if (success && destination.kind === 'roadmap') document.getElementById('roadmapToggleBtn')?.click();
      if (success && destination.kind === 'points') document.querySelector('[data-points-details-open]')?.click();
    } catch { success = false; }
    if (!success) { open(savedTrigger); status('Dieses Ziel ist nicht mehr verfügbar. Die Karte wurde aktualisiert.'); }
  }
  window.addEventListener('habitflow:auth-change',()=>{ if (dialog?.open) close(); });
  window.HabitFlowOntology = Object.freeze({ open, close });
})(window, document);
