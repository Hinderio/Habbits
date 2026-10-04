(function installDossiers(window, document) {
  'use strict';
  if (window.HabitFlowDossiers) return;
  const store = window.HabitFlowDossiersStore;
  if (!store) return;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const dateFormatter = new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium', timeStyle: 'short' });
  const date = value => dateFormatter.format(new Date(value));
  const indexDateFormatter = new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const PAGE_SIZE = 20;

  const ICONS = {
    education: ['Education', '<path d="m3 9 9-5 9 5-9 5-9-5Z"/><path d="M7 12v5c3 3 7 3 10 0v-5M21 9v7"/>'],
    holiday: ['Ferien', '<circle cx="17" cy="6" r="3"/><path d="M3 17c3-2 5-2 8 0s5 2 10 0M3 21c3-2 5-2 8 0s5 2 10 0M5 14l4-8 4 8M7 10h4"/>'],
    work: ['Arbeit', '<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V4h8v3M3 12c6 3 12 3 18 0M10 13v3h4v-3"/>'],
    leisure: ['Freizeit', '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>'],
    sport: ['Sport', '<path d="m5 8 11 11M3 10l7-7M14 21l7-7M2 7l5-5M17 22l5-5M8 5l11 11"/>'],
    life: ['Life', '<path d="M12 21S3 15 3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 7-9 13-9 13Z"/><path d="M6 11h3l2-4 2 8 2-4h3"/>']
  };
  function icon(key) {
    const chosen = Object.hasOwn(ICONS, key) ? key : 'life';
    return '<span class="dossier-symbol dossier-symbol-' + chosen + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[chosen][1] + '</svg><span class="dossier-sr">' + ICONS[chosen][0] + '</span></span>';
  }
  function iconPicker() {
    return '<fieldset class="full dossier-icon-picker"><legend>Icon</legend>' + Object.entries(ICONS).map(([key, [label]]) => '<label><input type="radio" name="icon_key" value="' + key + '"' + (key === 'life' ? ' checked' : '') + '>' + icon(key) + '<span>' + label + '</span></label>').join('') + '</fieldset>';
  }
  function entryHeading(row) {
    const link = store.safeLink(row.link);
    return row.title || Array.from(String(row.body || '').replace(/\s+/g, ' ').trim()).slice(0, 100).join('') || (link ? new URL(link).hostname : 'Bild');
  }
  let modelCache = null, indexOpen = false, indexQuery = '', indexLimit = 100, indexSignature = '', taskSignature = '', taskRenderKey = null, taskReturn = null;
  function entryModel(snapshot) {
    if (!modelCache || modelCache.source !== snapshot.entries || modelCache.active !== active || modelCache.order !== order) {
      const rows = snapshot.entries.filter(row => row.dossier_id === active).sort((a,b) => Number(b.is_pinned) - Number(a.is_pinned) || (order === 'oldest' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)) || a.id.localeCompare(b.id));
      modelCache = { source: snapshot.entries, active, order, rows, positions: new Map(rows.map((row, index) => [row.id, index])) };
    }
    return modelCache;
  }
  function renderIndex(model) {
    const toggle = dialog.querySelector('[data-dossier-action="entry-index"]');
    setText(toggle, 'Alle Einträge (' + model.rows.length + ')');
    toggle.setAttribute?.('aria-expanded', String(indexOpen));
    dialog.querySelector('[data-entry-index]').hidden = !indexOpen;
    if (!indexOpen) return;
    const matches = model.rows.map((row, index) => ({ row, index, title: entryHeading(row) })).filter(item => item.title.toLocaleLowerCase('de').includes(indexQuery));
    const shown = matches.slice(0, indexLimit).map(item => {
      // Untitled entries already use the body as their heading; avoid repetition.
      const text = item.row.title?.trim() ? Array.from(String(item.row.body || '').replace(/\s+/g, ' ').trim()) : [];
      const preview = text.length > 30 ? text.slice(0, 29).join('') + '…' : text.join('');
      const updated = item.row.updated_at || item.row.created_at;
      return { ...item, preview, updated };
    });
    const signature = JSON.stringify([shown.map(item => [item.row.id, item.title, item.index, item.row.is_pinned, item.preview, item.updated]), matches.length, model.rows.length]);
    if (signature === indexSignature) return;
    indexSignature = signature;
    dialog.querySelector('[data-entry-index-list]').innerHTML = shown.map(({row, index, title, preview, updated}) => button('jump-entry', '<span class="dossier-index-label"><strong>' + (row.is_pinned ? '★ ' : '') + escape(title) + '</strong>' + (preview ? '<span class="dossier-index-preview"> – ' + escape(preview) + '</span>' : '') + '<time class="dossier-index-updated" datetime="' + escape(updated) + '" aria-label="Zuletzt aktualisiert: ' + escape(indexDateFormatter.format(new Date(updated))) + '">' + escape(indexDateFormatter.format(new Date(updated))) + '</time></span><small>Seite ' + (Math.floor(index / PAGE_SIZE) + 1) + '</small>', row.id)).join('') || '<p class="subtle">Keine passenden Einträge.</p>';
    setText(dialog.querySelector('[data-entry-index-count]'), shown.length + ' von ' + matches.length + ' Titeln');
    dialog.querySelector('[data-dossier-action="index-more"]').hidden = shown.length >= matches.length;
  }
  function jumpEntry(id) {
    const model = entryModel(store.snapshot()), position = model.positions.get(id);
    if (position === undefined) { status('Dieser Eintrag ist nicht mehr verfügbar.'); return; }
    page = Math.floor(position / PAGE_SIZE); expandedEntries.add(id);
    entrySignature = ''; lastRender = null; refresh();
    const card = Array.from(dialog.querySelectorAll('[data-entry-id]')).find(node => node.dataset.entryId === id);
    card?.querySelector('summary')?.focus({ preventScroll: true });
    card?.scrollIntoView({ block: 'start' });
  }
  const taskStatus = task => ({done:'Erledigt',completed:'Erledigt',in_progress:'In Bearbeitung',active:'In Bearbeitung',open:'Offen'})[task.status] || 'Offen';
  function taskOptions(snapshot, dossier) {
    const select = dialog.querySelector('[data-task-choice]'), previous = select.value;
    const search = dialog.querySelector('[data-task-query]').value.trim().toLocaleLowerCase('de');
    const linked = new Set(dossier.linked_task_ids || []);
    const matches = (snapshot.tasks || []).filter(task => !linked.has(task.id) && task.title.toLocaleLowerCase('de').includes(search));
    select.innerHTML = '<option value="">Task auswählen</option>' + matches.slice(0, 50).map(task => '<option value="' + escape(task.id) + '">' + escape(task.title) + ' · ' + taskStatus(task) + '</option>').join('');
    if (matches.slice(0, 50).some(task => task.id === previous)) select.value = previous;
    setText(dialog.querySelector('[data-task-search-hint]'), matches.length > 50 ? '50 von ' + matches.length + ' Tasks – Suche verfeinern.' : matches.length + ' verfügbare Tasks');
  }
  function renderTasks(snapshot, dossier) {
    const linked = dossier.linked_task_ids || [];
    if (taskRenderKey && taskRenderKey.tasks === snapshot.tasks && taskRenderKey?.links === dossier.linked_task_ids) return;
    taskRenderKey = { tasks: snapshot.tasks, links: dossier.linked_task_ids };
    const byId = new Map((snapshot.tasks || []).map(task => [task.id, task]));
    const signature = JSON.stringify([linked, snapshot.tasks || []]);
    if (signature === taskSignature) return;
    taskSignature = signature;
    setText(dialog.querySelector('[data-linked-task-count]'), linked.length + ' verknüpft');
    dialog.querySelector('[data-linked-tasks]').innerHTML = linked.map(id => {
      const task = byId.get(id);
      return '<div class="dossier-task-row"><div><strong>' + escape(task?.title || 'Task nicht mehr verfügbar') + '</strong><small>' + (task ? taskStatus(task) : 'Verknüpfung kann gelöst werden') + '</small></div><div class="dossier-actions">' + (task ? '<button type="button" class="mini-btn secondary" data-dossier-action="open-linked-task" data-action="open-task-detail" data-id="' + escape(id) + '">Öffnen</button>' : '') + button('unlink-task','Lösen',id) + '</div></div>';
    }).join('') || '<p class="subtle">Noch keine Tasks verknüpft.</p>';
    taskOptions(snapshot, dossier);
  }
  function clearTaskReturn() {
    if (!taskReturn) return;
    taskReturn.observer.disconnect();
    document.removeEventListener('click', taskReturn.onEdit, true);
    taskReturn = null;
  }
  function suspendForTask(trigger) {
    const modal = document.getElementById('taskDetailModal');
    if (!modal) { status('Die Aufgabenansicht ist noch nicht bereit.'); return; }
    clearTaskReturn();
    const context = { id: active, trigger, scroll: dialog.scrollTop };
    const restore = () => {
      if (taskReturn !== context) return;
      clearTaskReturn();
      if (active !== context.id || !store.snapshot().dossiers.some(row => row.id === active)) return;
      dialog.showModal(); refresh(); dialog.scrollTop = context.scroll;
      const target = context.trigger.isConnected ? context.trigger : dialog.querySelector('#dossierTitle');
      target?.focus({ preventScroll: true });
    };
    context.observer = new MutationObserver(() => { if (modal.classList.contains('hidden')) restore(); });
    context.onEdit = event => {
      if (!event.target.closest?.('[data-action="edit-task"]')) return;
      if ((entryHasDraft() || headerHasDraft()) && !window.confirm('Dossier-Entwurf verwerfen und Task bearbeiten?')) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      clearTaskReturn(); resetEntry(); active = '';
    };
    taskReturn = context;
    context.observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('click', context.onEdit, true);
    dialog.close();
    // The existing app click handler opens the task after this handler bubbles.
    window.requestAnimationFrame(() => { if (modal.classList.contains('hidden')) restore(); });
  }

  let pane, projects, dialog, active = '', view = 'projects', page = 0, overviewPage = 0, query = '', order = 'newest';
  let editing = '', blob = null, previewUrl = '', busy = false, imageOperation = 0, renderFrame = 0, imageGeneration = 0;
  let overviewSignature = '', entrySignature = '', titleSignature = '', returnFocus = null;
  let lastRender = null;
  const expandedEntries = new Set();
  const presented = ({ synced, ...row }) => row;
  function setText(node, value) { if (node.textContent !== value) node.textContent = value; }
  function visible() { return view === 'dossiers' && !pane?.closest?.('[data-screen]')?.hidden; }
  const button = (action, label, id = '', primary = false) => `<button type="button" class="mini-btn ${primary ? 'primary' : 'secondary'}" data-dossier-action="${action}" data-id="${escape(id)}">${label}</button>`;
  function status(message) {
    dialog.querySelectorAll('[data-dossier-message], [data-entry-message]').forEach(node => setText(node, message));
  }
  function projectOptions(selected = '') {
    const rows = store.snapshot().projects;
    return '<option value="">Ohne Projektverknüpfung</option>' + rows.map(project => `<option value="${escape(project.id)}" ${project.id === selected ? 'selected' : ''}>${escape(project.title)}</option>`).join('');
  }
  function show(next) {
    const previousView = view;
    view = next === 'dossiers' ? 'dossiers' : 'projects';
    projects.hidden = view !== 'projects'; pane.hidden = view !== 'dossiers';
    document.querySelectorAll('[data-project-view]').forEach(tab => { const selected = tab.dataset.projectView === view; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
    if (view === 'dossiers') { refresh(); if (previousView !== view) void store.sync(''); }
  }
  function setComposer(open, focus = false) {
    const form = dialog.querySelector('[data-entry-form]');
    const trigger = dialog.querySelector('[data-dossier-action="new-entry"]');
    form.hidden = !open;
    trigger.hidden = open;
    if (focus) (open ? form.elements.title : trigger).focus();
  }
  function entryLinks(row) {
    return (Array.isArray(row?.links) ? row.links : [row?.link]).map(value => store.safeLink(value)).filter(Boolean);
  }
  function draftLinks(form) {
    return [form.elements.link.value, ...Array.from(form.querySelectorAll('[data-extra-link]'), input => input.value)].map(value => value.trim()).filter(Boolean);
  }
  function addLink(value = '', focus = false) {
    const row = document.createElement('div'); row.className = 'dossier-link-field';
    row.innerHTML = '<label><span>Weiterer Link</span><input type="url" data-extra-link maxlength="4000" placeholder="https://…" autocomplete="url" aria-label="Weiterer Link"></label>' + button('remove-link', '×');
    const input = row.querySelector('input'); input.value = value;
    const remove = row.querySelector('button'); remove.setAttribute('aria-label', 'Link entfernen'); remove.title = 'Link entfernen';
    dialog.querySelector('[data-extra-links]').appendChild(row);
    if (focus) input.focus();
  }
  let entryBaseline = null;
  function resetEntry() {
    entryBaseline = null;
    imageOperation++; editing = ''; blob = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    const form = dialog.querySelector('[data-entry-form]'); form.reset();
    form.querySelector('[data-draft-image]').replaceChildren();
    form.querySelector('[data-extra-links]').replaceChildren();
    form.querySelector('[data-entry-submit]').textContent = 'Eintrag hinzufügen';
    setComposer(false);
  }
  function entryHasDraft() {
    const form = dialog.querySelector('[data-entry-form]');
    const original = entryBaseline;
    return Boolean(blob || form.elements.title.value.trim() !== (original?.title || '') || form.elements.body.value.trim() !== (original?.body || '') || JSON.stringify(draftLinks(form)) !== JSON.stringify(entryLinks(original)) || form.elements.image_alt.value.trim() !== (original?.image_alt || '') || form.elements.is_pinned.checked !== Boolean(original?.is_pinned));
  }
  let headerBaseline = null;
  function headerValues() {
    const form = dialog.querySelector('[data-dossier-form]');
    return { title: form.elements.title.value.trim(), description: form.elements.description.value.trim(), project_id: form.elements.project_id.value || null, icon_key: form.elements.icon_key.value || 'life' };
  }
  function fillHeader(row) {
    const form = dialog.querySelector('[data-dossier-form]');
    form.elements.title.value = row?.title || '';
    form.elements.description.value = row?.description || '';
    form.elements.icon_key.value = row?.icon_key || 'life';
    form.elements.project_id.innerHTML = projectOptions(row?.project_id);
    form.elements.project_id.value = row?.project_id || '';
    headerBaseline = headerValues();
  }
  function headerChanges() {
    return Object.fromEntries(Object.entries(headerValues()).filter(([key,value]) => !headerBaseline || value !== headerBaseline[key]));
  }
  function headerHasDraft() {
    return Object.keys(headerChanges()).length > 0;
  }
  function close() {
    if (busy) { status('Bitte kurz warten, der Vorgang läuft noch.'); return; }
    const form = dialog.querySelector('[data-entry-form]');
    if ((entryHasDraft() || headerHasDraft()) && !window.confirm('Dossier schliessen und den ungespeicherten Entwurf verwerfen?')) return;
    resetEntry(); active = ''; dialog.close(); imageGeneration++;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }
  function open(id = '', trigger) {
    clearTaskReturn();
    indexOpen = false; indexQuery = ''; indexLimit = 100; indexSignature = ''; taskSignature = ''; taskRenderKey = null;
    dialog.querySelector('[data-entry-index-search]').value = '';
    dialog.querySelector('[data-task-query]').value = '';
    returnFocus = trigger || document.activeElement;
    expandedEntries.clear();
    active = id; page = 0; order = 'newest'; editing = '';
    entrySignature = ''; titleSignature = ''; lastRender = null;
    resetEntry();
    const dossier = store.snapshot().dossiers.find(row => row.id === id);
    const form = dialog.querySelector('[data-dossier-form]');
    fillHeader(dossier);
    dialog.querySelector('[data-dossier-editor]').open = !dossier;
    dialog.querySelector('[data-dossier-content]').hidden = !dossier;
    dialog.querySelector('[data-dossier-action="delete-dossier"]').hidden = !dossier;
    dialog.querySelector('[data-entry-order]').value = order;
    status(''); dialog.showModal(); refresh();
    (dossier ? dialog.querySelector('#dossierTitle') : form.elements.title).focus({ preventScroll: true });
    if (id) void store.sync(id);
  }
  const ACTION_ICONS = {
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4.4L19.7 8.7a2.1 2.1 0 0 0 0-3l-1.4-1.4a2.1 2.1 0 0 0-3 0L4 15.6V20Z"></path><path d="m13.8 5.8 4.4 4.4"></path></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 7V5h6v2"></path><path d="M7 7l1 13h8l1-13"></path></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>'
  };
  function entryAction(action, label, id, remove = false) {
    return '<button type="button" class="mini-btn project-icon-action project-icon-action-' + (remove ? 'delete' : 'edit') + '" data-polished="true" data-dossier-action="' + action + '" data-id="' + escape(id) + '" aria-label="' + label + '" title="' + label + '">' + ACTION_ICONS[remove ? 'trash' : 'edit'] + '</button>';
  }
  function entryCard(row) {
    const links = entryLinks(row);
    const heading = entryHeading(row);
    return `<article class="dossier-entry project-detail-box" data-entry-id="${escape(row.id)}"><header><time datetime="${escape(row.created_at)}">${escape(date(row.created_at))}</time><button class="mini-btn secondary dossier-pin" type="button" data-dossier-action="pin" data-id="${escape(row.id)}" aria-pressed="${row.is_pinned}" aria-label="${row.is_pinned ? 'Eintrag lösen' : 'Eintrag anpinnen'}">${row.is_pinned ? '★ Angepinnt' : '☆ Anpinnen'}</button></header><details class="dossier-entry-disclosure" data-entry-disclosure="${escape(row.id)}"${expandedEntries.has(row.id) ? ' open' : ''}><summary><strong>${escape(heading)}</strong><span class="project-note-toggle"><span class="dossier-entry-more">Mehr anzeigen</span><span class="dossier-entry-less">Weniger anzeigen</span><span class="project-editor-chevron" aria-hidden="true">⌄</span></span></summary><div class="dossier-entry-content">${row.body ? `<p class="dossier-entry-text">${escape(row.body)}</p>` : ''}${links.map(link => `<a class="dossier-link" href="${escape(link)}" target="_blank" rel="noopener noreferrer">↗ ${escape(new URL(link).hostname)}<span>${escape(link)}</span></a>`).join('')}${row.image_path ? `<div class="dossier-image" data-image-path="${escape(row.image_path)}"><span>Bild wird geladen …</span><img alt="${escape(row.image_alt || 'Bild zum Dossier-Eintrag')}" loading="lazy" decoding="async" referrerpolicy="no-referrer" hidden></div>` : ''}</div></details><footer>${entryAction('edit-entry', 'Eintrag bearbeiten', row.id)}${entryAction('delete-entry', 'Eintrag entfernen', row.id, true)}</footer></article>`;
  }
  async function loadImages() {
    const generation = ++imageGeneration;
    const nodes = Array.from(dialog.querySelectorAll('[data-entry-disclosure][open] [data-image-path]'));
    if (!nodes.length) return;
    try {
      const urls = await store.imageUrls(nodes.map(node => node.dataset.imagePath));
      if (generation !== imageGeneration || !dialog.open) return;
      for (const node of nodes) {
        const url = urls.get(node.dataset.imagePath), image = node.querySelector('img'), hint = node.querySelector('span');
        if (!url) { hint.textContent = 'Bild gerade nicht verfügbar. Bitte online aktualisieren.'; continue; }
        image.onerror = () => { image.hidden = true; hint.hidden = false; hint.textContent = 'Bild gerade nicht verfügbar. Bitte aktualisieren.'; };
        if (image.getAttribute('src') !== url) image.src = url; image.hidden = false; hint.hidden = true;
      }
    } catch (_) { if (generation === imageGeneration) nodes.forEach(node => { node.querySelector('span').textContent = 'Bild gerade nicht verfügbar.'; }); }
  }
  function refresh() {
    if (!pane || (!visible() && !dialog.open)) return;
    const snapshot = store.snapshot();
    setText(pane.querySelector('[data-dossier-sync]'), snapshot.status);
    setText(dialog.querySelector('[data-detail-sync]'), snapshot.status);
    const renderKey = [snapshot.dossiers, snapshot.entries, snapshot.projects, snapshot.tasks, snapshot.metrics, active, query, order, page, overviewPage, dialog.open, indexOpen, indexQuery, indexLimit];
    if (lastRender && renderKey.every((value, index) => value === lastRender[index])) return;
    lastRender = renderKey;
    const dossiers = snapshot.dossiers.filter(row => (row.title + ' ' + row.description).toLocaleLowerCase('de').includes(query)).sort((a,b) => b.updated_at.localeCompare(a.updated_at));
    const pages = Math.max(1, Math.ceil(dossiers.length / PAGE_SIZE)); overviewPage = Math.min(overviewPage, pages - 1);
    const signature = JSON.stringify([dossiers.map(presented), snapshot.projects.map(row => [row.id, row.title]), snapshot.metrics, overviewPage]);
    if (signature !== overviewSignature) {
      overviewSignature = signature;
      pane.querySelector('[data-dossier-grid]').innerHTML = dossiers.length ? dossiers.slice(overviewPage * PAGE_SIZE, (overviewPage + 1) * PAGE_SIZE).map(row => {
        const project = snapshot.projects.find(project => project.id === row.project_id);
        const metric = snapshot.metrics?.[row.id];
        const metrics = '<div class="dossier-card-metrics"><span><small>Letztes Update</small><strong>' + escape(date(metric?.updated_at || row.updated_at)) + '</strong></span><span><small>Einträge</small><strong>' + (metric ? metric.count + (metric.exact ? '' : ' lokal') : '…') + '</strong></span></div>';
        return `<button type="button" class="project-card dossier-card" data-dossier-action="open" data-id="${escape(row.id)}"><div class="dossier-card-heading"><h3>${escape(row.title)}</h3>${icon(row.icon_key)}</div><p>${escape(row.description || 'Gedanken, Links und Bilder an einem Ort.')}</p>${metrics}<span class="dossier-card-project subtle"${project ? '' : ' aria-hidden="true"'}>${project ? 'Projekt: ' + escape(project.title) : ''}</span><div class="project-card-footer"><span class="badge muted">Dossier öffnen</span><span aria-hidden="true">↗</span></div></button>`;
      }).join('') : `<div class="project-empty">${query ? 'Keine passenden Dossiers gefunden.' : 'Noch keine Dossiers. Sammle Gedanken, Links und Bilder zu deinem nächsten Thema.'}</div>`;
      pane.querySelector('[data-overview-page]').textContent = `${overviewPage + 1} / ${pages}`;
      pane.querySelector('[data-dossier-action="overview-prev"]').disabled = overviewPage === 0;
      pane.querySelector('[data-dossier-action="overview-next"]').disabled = overviewPage >= pages - 1;
    }
    if (!dialog.open) return;
    const dossier = snapshot.dossiers.find(row => row.id === active);
    if (active && !dossier) { if (dialog.open) { resetEntry(); active = ''; dialog.close(); } return; }
    setText(dialog.querySelector('#dossierTitle'), dossier?.title || 'Dossier erstellen');
    if (!dossier) return;
    const titleKey = JSON.stringify([presented(dossier), snapshot.projects.map(row => [row.id,row.title])]);
    if (titleKey !== titleSignature) {
      titleSignature = titleKey;
      if (headerBaseline && !headerHasDraft()) fillHeader(dossier);
      dialog.querySelector('[data-detail-icon]').innerHTML = icon(dossier.icon_key);
      const linked = snapshot.projects.find(row => row.id === dossier.project_id);
      dialog.querySelector('[data-dossier-description]').textContent = dossier.description;
      dialog.querySelector('[data-project-link]').innerHTML = linked ? button('open-project', 'Projekt öffnen: ' + escape(linked.title), linked.id) : '';
    }
    renderTasks(snapshot, dossier);
    const model = entryModel(snapshot); renderIndex(model);
    const entries = model.rows;
    const entryPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE)); page = Math.min(page, entryPages - 1);
    const shown = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const nextSignature = JSON.stringify([active, shown.map(presented), entries.length, page, order]);
    if (nextSignature !== entrySignature) {
      entrySignature = nextSignature;
      dialog.querySelector('[data-entry-list]').innerHTML = shown.length ? shown.map(entryCard).join('') : '<div class="project-empty">Dein Dossier ist bereit. Über „Neuer Eintrag“ kannst du Gedanken, Links und Bilder hinzufügen.</div>';
      dialog.querySelector('[data-entry-page]').textContent = `${entries.length} Einträge · Seite ${page + 1} / ${entryPages}`;
      dialog.querySelector('[data-dossier-action="entry-prev"]').disabled = page === 0;
      dialog.querySelector('[data-dossier-action="entry-next"]').disabled = page >= entryPages - 1;
      void loadImages();
    }
  }
  function queueRefresh() { if (!visible() && !dialog?.open) return; if (!renderFrame) renderFrame = window.requestAnimationFrame(() => { renderFrame = 0; refresh(); }); }
  async function receive(file) {
    if (busy || !active) return;
    busy = true; const token = ++imageOperation; status('Bild wird verkleinert …');
    try {
      const data = await window.HabitFlowExhibition.optimize(file);
      if (token !== imageOperation) return;
      const bytes = Uint8Array.from(atob(data.split(',')[1]), c => c.charCodeAt(0));
      blob = new Blob([bytes], { type: data.slice(5, data.indexOf(';')) });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(blob);
      dialog.querySelector('[data-draft-image]').innerHTML = `<img src="${previewUrl}" alt="Bildvorschau">${button('remove-image', 'Bild verwerfen')}`;
      status(`Bild bereit · ${Math.ceil(blob.size / 1024)} KB`);
    } catch (error) { status(error.message || 'Bild konnte nicht verarbeitet werden.'); }
    finally { busy = false; dialog.querySelector('[name="image"]').value = ''; }
  }
  async function submitEntry(event) {
    event.preventDefault(); if (busy) return;
    const form = event.target; if (!form.reportValidity()) return;
    const existing = store.snapshot().entries.find(row => row.id === editing);
    const input = { id: editing || undefined, dossier_id: active, title: form.elements.title.value.trim(), body: form.elements.body.value, links: draftLinks(form), is_pinned: form.elements.is_pinned.checked, image_path: existing?.image_path || '', image_alt: form.elements.image_alt.value };
    if (input.links.some(link => !store.safeLink(link))) { status('Bitte einen gültigen http- oder https-Link eingeben.'); return; }
    if (!input.body.trim() && !input.links.length && !blob && !input.image_path) { status('Bitte Text, Link oder Bild hinzufügen.'); return; }
    busy = true; form.setAttribute('aria-busy', 'true'); form.querySelectorAll('input,textarea,select,button').forEach(control => { control.disabled = true; }); let uploaded = '';
    const submit = form.querySelector('[data-entry-submit]');
    submit.textContent = blob ? 'Bild wird gespeichert …' : 'Wird gespeichert …';
    try {
      if (blob) { status('Bild wird hochgeladen …'); uploaded = await store.upload(blob, active); input.image_path = uploaded; }
      // A background update to fields the user did not edit must survive.
      if (editing && entryBaseline) for (const key of ['title','body','is_pinned','image_alt']) {
        if (input[key] === (entryBaseline[key] ?? (key === 'is_pinned' ? false : ''))) delete input[key];
      }
      if (editing && entryBaseline && JSON.stringify(input.links) === JSON.stringify(entryLinks(entryBaseline))) delete input.links;
      if (editing && !uploaded) delete input.image_path;
      store.saveEntry(input); resetEntry(); page = 0; refresh(); status('Eintrag lokal gespeichert.'); setComposer(false, true);
    } catch (error) { if (uploaded) void store.removeUpload(uploaded); status(error.message || 'Speichern fehlgeschlagen. Dein Entwurf bleibt erhalten.'); }
    finally { busy = false; submit.textContent = editing ? 'Änderungen speichern' : 'Eintrag hinzufügen'; form.removeAttribute('aria-busy'); form.querySelectorAll('input,textarea,select,button').forEach(control => { control.disabled = false; }); }
  }
  function action(event) {
    const target = event.target.closest('[data-dossier-action]'); if (!target) return;
    if (busy) { if (target.dataset.dossierAction === 'open-linked-task') { event.preventDefault(); event.stopPropagation(); } return; }
    const name = target.dataset.dossierAction, id = target.dataset.id;
    try {
      if (name === 'add-link') { addLink('', true); return; }
      if (name === 'remove-link') { target.closest('.dossier-link-field').remove(); dialog.querySelector('[data-dossier-action="add-link"]').focus(); return; }
      if (name === 'create' || name === 'open') return open(id, target);
      if (name === 'close') return close();
      if (name === 'entry-index') { indexOpen = !indexOpen; refresh(); if (indexOpen) dialog.querySelector('[data-entry-index-search]').focus(); return; }
      if (name === 'index-more') { indexLimit += 100; refresh(); return; }
      if (name === 'jump-entry') return jumpEntry(id);
      if (name === 'open-linked-task') return suspendForTask(target);
      if (name === 'link-task' || name === 'unlink-task') {
        const dossier = store.snapshot().dossiers.find(row => row.id === active); if (!dossier) return;
        const taskId = name === 'link-task' ? dialog.querySelector('[data-task-choice]').value : id;
        if (!taskId) { status('Bitte zuerst einen Task auswählen.'); return; }
        const ids = new Set(dossier.linked_task_ids || []);
        if (name === 'link-task') ids.add(taskId); else ids.delete(taskId);
        store.saveDossier({ ...dossier, linked_task_ids: [...ids] }); refresh(); status(name === 'link-task' ? 'Task verknüpft.' : 'Verknüpfung gelöst.'); return;
      }
      if (name === 'refresh') { void store.sync(active); void loadImages(); return; }
      if (name === 'overview-prev' || name === 'overview-next') { overviewPage += name.endsWith('next') ? 1 : -1; refresh(); return; }
      if (name === 'entry-prev' || name === 'entry-next') { page += name.endsWith('next') ? 1 : -1; refresh(); dialog.querySelector('[data-entry-list]').scrollIntoView({ block:'start' }); return; }
      if (name === 'new-entry') { setComposer(true, true); status(''); return; }
      if (name === 'cancel-entry' && entryHasDraft() && !window.confirm('Ungespeicherten Eintrag verwerfen?')) return;
      if (name === 'cancel-entry' || name === 'remove-image') { if (name === 'cancel-entry') { resetEntry(); setComposer(false, true); } else { blob = null; if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = ''; dialog.querySelector('[data-draft-image]').replaceChildren(); } status(''); return; }
      if (name === 'open-project') { close(); if (!dialog.open) { show('projects'); window.HabitFlowRoadmapProjects?.open(id); } return; }
      if (name === 'delete-dossier') {
        const row = store.snapshot().dossiers.find(row => row.id === active);
        if (row && window.confirm('Dossier und seine Einträge entfernen? Das verknüpfte Projekt bleibt erhalten.')) { store.saveDossier({ ...row, is_archived:true }); resetEntry(); active = ''; dialog.close(); refresh(); } return;
      }
      const row = store.snapshot().entries.find(row => row.id === id && row.dossier_id === active); if (!row) return;
      if (name === 'pin') { store.saveEntry({ ...row, is_pinned:!row.is_pinned }); refresh(); }
      if (name === 'delete-entry' && window.confirm('Diesen Eintrag entfernen?')) { store.saveEntry({ ...row, is_archived:true }); refresh(); }
      if (name === 'edit-entry') {
        if (entryHasDraft() && !window.confirm('Ungespeicherten Entwurf ersetzen?')) return;
        resetEntry(); editing = row.id; entryBaseline = row;
        const form = dialog.querySelector('[data-entry-form]');
        form.elements.title.value = row.title || ''; form.elements.body.value = row.body; form.elements.link.value = entryLinks(row)[0] || ''; entryLinks(row).slice(1).forEach(link => addLink(link)); form.elements.is_pinned.checked = row.is_pinned; form.elements.image_alt.value = row.image_alt;
        form.querySelector('[data-entry-submit]').textContent = 'Änderungen speichern'; form.querySelector('[data-dossier-action="cancel-entry"]').hidden = false;
        setComposer(true);
        status(row.image_path ? 'Das vorhandene Bild bleibt erhalten. Ein neues Bild ersetzt es.' : ''); form.elements.body.focus();
      }
    } catch (error) { status(error.message || 'Aktion fehlgeschlagen.'); }
  }
  function toggleEntry(event) {
    const details = event.target;
    if (!details.matches?.('[data-entry-disclosure]') || !details.isConnected) return;
    const id = details.dataset.entryDisclosure;
    const wasOpen = expandedEntries.has(id);
    if (details.open) expandedEntries.add(id); else expandedEntries.delete(id);
    if (details.open && !wasOpen) void loadImages();
  }
  function mount() {
    const screen = document.getElementById('screen-projects'); if (!screen || screen.querySelector('[data-project-switch]')) return;
    projects = document.createElement('div'); projects.id = 'projectViewProjects'; projects.className = 'project-view-pane'; projects.setAttribute('role', 'tabpanel'); projects.setAttribute('aria-labelledby','projectViewTab');
    while (screen.firstChild) projects.appendChild(screen.firstChild);
    screen.appendChild(projects);
    const tabs = document.createElement('div'); tabs.className = 'project-view-switch'; tabs.dataset.projectSwitch = ''; tabs.setAttribute('role','tablist'); tabs.setAttribute('aria-label','Projekte und Dossiers');
    tabs.innerHTML = '<button id="projectViewTab" type="button" role="tab" data-project-view="projects" aria-controls="projectViewProjects" aria-selected="true">Projekte</button><button id="dossierViewTab" type="button" role="tab" data-project-view="dossiers" aria-controls="projectViewDossiers" aria-selected="false" tabindex="-1">Dossiers</button>';
    screen.prepend(tabs);
    pane = document.createElement('div'); pane.id = 'projectViewDossiers'; pane.className = 'project-view-pane'; pane.hidden = true; pane.setAttribute('role','tabpanel'); pane.setAttribute('aria-labelledby','dossierViewTab');
    pane.innerHTML = `<section class="projects-hero glass"><div><p class="eyebrow">Wissen & Inspiration</p><h2>Gedanken sammeln. Zusammenhänge entdecken.</h2><p>Dein Ort für Notizen, Links und Bilder – von der nächsten Reise bis zur grossen Recherche.</p></div><button class="pill primary" type="button" data-dossier-action="create">Dossier erstellen</button></section><section class="panel glass"><div class="panel-head"><div><p class="eyebrow">Sammlungen</p><h3>Dossier-Übersicht</h3></div><span class="badge muted" data-dossier-sync>lokal</span></div><label class="dossier-search"><span>Dossiers suchen</span><input type="search" placeholder="Titel oder Beschreibung" data-dossier-search></label><div class="project-grid" data-dossier-grid></div><nav class="dossier-pagination" aria-label="Dossierseiten">${button('overview-prev','Zurück')}<span data-overview-page></span>${button('overview-next','Weiter')}</nav></section>`;
    screen.appendChild(pane);
    dialog = document.createElement('dialog'); dialog.className = 'dossier-dialog'; dialog.setAttribute('aria-labelledby','dossierTitle');
    dialog.innerHTML = `<div class="dossier-dialog-body"><header class="dossier-dialog-head"><div class="dossier-detail-title"><h2 id="dossierTitle" tabindex="-1">Dossier erstellen</h2><span data-detail-icon></span></div><button type="button" class="icon-btn" data-dossier-action="close" aria-label="Dossier schliessen">×</button></header><p data-dossier-description class="subtle"></p><div data-project-link></div><details class="project-editor-toggle" data-dossier-editor><summary>Dossier bearbeiten <span aria-hidden="true">⌄</span></summary><form data-dossier-form class="project-form-grid dossier-form"><label class="full"><span>Titel</span><input name="title" maxlength="120" required placeholder="z. B. Konferenz Zürich"></label><label class="full"><span>Beschreibung</span><textarea name="description" maxlength="600" rows="2" placeholder="Worum geht es?"></textarea></label>${iconPicker()}<label class="full"><span>Projekt (optional)</span><select name="project_id"></select></label><div class="full dossier-actions"><button type="submit" class="pill primary">Dossier speichern</button>${button('delete-dossier','Dossier entfernen')}</div></form></details><div data-dossier-content><details class="project-editor-toggle dossier-task-section"><summary>Verknüpfte Tasks <span data-linked-task-count></span></summary><div class="dossier-task-content"><div data-linked-tasks></div><label class="dossier-search"><span>Bestehenden Task suchen</span><input type="search" data-task-query placeholder="Titel eingeben"></label><div class="dossier-task-tools"><select data-task-choice aria-label="Task auswählen"></select>${button('link-task','Verknüpfen')}</div><p class="subtle" data-task-search-hint></p></div></details><div class="dossier-actions"><button type="button" class="pill primary" data-dossier-action="new-entry" aria-controls="dossierEntryForm">+ Neuer Eintrag</button><button type="button" class="mini-btn secondary" data-dossier-action="entry-index" aria-expanded="false" aria-controls="dossierEntryIndex">Alle Einträge</button></div><section id="dossierEntryIndex" data-entry-index class="dossier-entry-index" hidden aria-label="Eintragsverzeichnis"><label class="dossier-search"><span>Alle Titel durchsuchen</span><input type="search" data-entry-index-search placeholder="Titel eingeben"></label><div data-entry-index-list class="dossier-index-list"></div><div class="dossier-pagination"><span data-entry-index-count></span>${button('index-more','Weitere Titel')}</div></section><form id="dossierEntryForm" data-entry-form class="dossier-composer" hidden><h3>Gedanken festhalten</h3><label><span>Titel (optional)</span><input name="title" maxlength="120" placeholder="Worum geht es in diesem Eintrag?"></label><label><span>Text</span><textarea name="body" maxlength="10000" rows="3" placeholder="Was möchtest du festhalten?"></textarea></label><div class="dossier-link-fields"><label><span>Links (optional)</span><input name="link" type="url" maxlength="4000" placeholder="https://…" autocomplete="url"></label><div data-extra-links></div><button type="button" class="mini-btn secondary" data-dossier-action="add-link">+ Link hinzufügen</button></div><div class="dossier-composer-options"><label class="dossier-file"><span>Bild hinzufügen</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp"></label><label class="dossier-check"><input name="is_pinned" type="checkbox"><span>Anpinnen</span></label></div><div data-draft-image class="dossier-draft-image"></div><label><span>Bildbeschreibung (optional)</span><input name="image_alt" maxlength="200" placeholder="Was zeigt das Bild?"></label><p data-entry-message class="dossier-message" role="status" aria-live="polite"></p><div class="dossier-actions"><button type="submit" class="pill primary" data-entry-submit>Eintrag hinzufügen</button><button type="button" class="mini-btn secondary" data-dossier-action="cancel-entry">Abbrechen</button></div></form><div class="dossier-history-head"><h3>Einträge</h3><label><span>Reihenfolge</span><select data-entry-order><option value="newest">Neueste zuerst</option><option value="oldest">Älteste zuerst</option></select></label></div><p class="subtle">Angepinnte Einträge stehen oben.</p><div data-entry-list class="dossier-entries"></div><nav class="dossier-pagination" aria-label="Eintragsseiten">${button('entry-prev','Zurück')}<span data-entry-page></span>${button('entry-next','Weiter')}</nav></div><footer class="dossier-sync-footer"><span class="subtle" data-detail-sync></span>${button('refresh','Aktualisieren')}</footer><p data-dossier-message class="dossier-message" role="status" aria-live="polite"></p></div>`;
    document.body.appendChild(dialog);
    tabs.addEventListener('click', event => { const tab = event.target.closest('[data-project-view]'); if (tab) show(tab.dataset.projectView); });
    tabs.addEventListener('keydown', event => { if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'projects' : event.key === 'End' ? 'dossiers' : view === 'projects' ? 'dossiers' : 'projects'; show(next); tabs.querySelector(`[data-project-view="${next}"]`).focus(); } });
    pane.addEventListener('click', action); dialog.addEventListener('click', action);
    pane.querySelector('[data-dossier-search]').addEventListener('input', event => { query = event.target.value.trim().toLocaleLowerCase('de'); overviewPage = 0; queueRefresh(); });
    dialog.addEventListener('toggle', toggleEntry, true);
    dialog.querySelector('[data-entry-index-search]').addEventListener('input', event => { indexQuery = event.target.value.trim().toLocaleLowerCase('de'); indexLimit = 100; queueRefresh(); });
    dialog.querySelector('[data-task-query]').addEventListener('input', () => { const snapshot = store.snapshot(), dossier = snapshot.dossiers.find(row => row.id === active); if (dossier) taskOptions(snapshot, dossier); });
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.querySelector('[data-entry-order]').addEventListener('change', event => { order = event.target.value; page = 0; refresh(); });
    dialog.querySelector('[data-entry-form]').addEventListener('submit', submitEntry);
    dialog.querySelector('[name="image"]').addEventListener('change', event => { if (event.target.files[0]) void receive(event.target.files[0]); });
    dialog.querySelector('[data-entry-form]').addEventListener('paste', event => { const file = Array.from(event.clipboardData?.items || []).find(item => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile(); if (file) { event.preventDefault(); void receive(file); } });
    dialog.querySelector('[data-dossier-form]').addEventListener('submit', event => {
      event.preventDefault(); if (busy || !event.target.reportValidity()) return;
      const form = event.target;
      try { const row = store.saveDossier({ id:active || undefined, ...(active ? headerChanges() : headerValues()) }); active = row.id; fillHeader(row); dialog.querySelector('[data-dossier-editor]').open = false; dialog.querySelector('[data-dossier-content]').hidden = false; dialog.querySelector('[data-dossier-action="delete-dossier"]').hidden = false; refresh(); void store.sync(active); status('Dossier lokal gespeichert.'); dialog.querySelector('#dossierTitle').focus({ preventScroll: true }); }
      catch (error) { status(error.message || 'Speichern fehlgeschlagen.'); }
    });
    store.subscribe(queueRefresh);
    document.querySelector('.nav-btn[data-target="projects"]')?.addEventListener('click', () => { if (view === 'dossiers') queueRefresh(); });
    document.getElementById('settingsForm')?.addEventListener('submit', () => { void store.sync(active); });
    window.addEventListener('habitflow:auth-change', () => { clearTaskReturn(); resetEntry(); active = ''; if (dialog.open) dialog.close(); overviewSignature = ''; queueRefresh(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && visible()) { void store.sync(active); if (dialog.open) void loadImages(); } });
  }
  window.HabitFlowDossiers = Object.freeze({ showProjects() { clearTaskReturn(); if (projects) show('projects'); }, open(id) { if (!pane) return false; show('dossiers'); if (id) { if (!store.snapshot().dossiers.some(row => row.id === id)) return false; open(id); } return true; } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once:true }); else mount();
})(window, document);
