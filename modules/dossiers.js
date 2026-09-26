(function installDossiers(window, document) {
  'use strict';
  if (window.HabitFlowDossiers) return;
  const store = window.HabitFlowDossiersStore;
  if (!store) return;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const date = value => new Date(value).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' });
  const PAGE_SIZE = 20;
  let pane, projects, dialog, active = '', view = 'projects', page = 0, overviewPage = 0, query = '', order = 'newest';
  let editing = '', blob = null, previewUrl = '', busy = false, imageOperation = 0, renderFrame = 0, imageGeneration = 0;
  let overviewSignature = '', entrySignature = '', titleSignature = '', returnFocus = null;
  const button = (action, label, id = '', primary = false) => `<button type="button" class="mini-btn ${primary ? 'primary' : 'secondary'}" data-dossier-action="${action}" data-id="${escape(id)}">${label}</button>`;
  function status(message) { dialog.querySelector('[data-dossier-message]').textContent = message; }
  function projectOptions(selected = '') {
    const rows = store.snapshot().projects;
    return '<option value="">Ohne Projektverknüpfung</option>' + rows.map(project => `<option value="${escape(project.id)}" ${project.id === selected ? 'selected' : ''}>${escape(project.title)}</option>`).join('');
  }
  function show(next) {
    view = next === 'dossiers' ? 'dossiers' : 'projects';
    projects.hidden = view !== 'projects'; pane.hidden = view !== 'dossiers';
    document.querySelectorAll('[data-project-view]').forEach(tab => { const selected = tab.dataset.projectView === view; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
    if (view === 'dossiers') { refresh(); void store.sync(''); }
  }
  function resetEntry() {
    imageOperation++; editing = ''; blob = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    const form = dialog.querySelector('[data-entry-form]'); form.reset();
    form.querySelector('[data-draft-image]').replaceChildren();
    form.querySelector('[data-entry-submit]').textContent = 'Eintrag hinzufügen';
    form.querySelector('[data-dossier-action="cancel-entry"]').hidden = true;
  }
  function entryHasDraft() {
    const form = dialog.querySelector('[data-entry-form]');
    const original = store.snapshot().entries.find(row => row.id === editing);
    return Boolean(blob || form.elements.body.value.trim() !== (original?.body || '') || form.elements.link.value.trim() !== (original?.link || '') || form.elements.image_alt.value.trim() !== (original?.image_alt || '') || form.elements.is_pinned.checked !== Boolean(original?.is_pinned));
  }
  function headerHasDraft() {
    const form = dialog.querySelector('[data-dossier-form]');
    const original = store.snapshot().dossiers.find(row => row.id === active);
    return form.elements.title.value.trim() !== (original?.title || '') || form.elements.description.value.trim() !== (original?.description || '') || form.elements.project_id.value !== (original?.project_id || '');
  }
  function close() {
    if (busy) { status('Bitte kurz warten, der Vorgang läuft noch.'); return; }
    const form = dialog.querySelector('[data-entry-form]');
    if ((entryHasDraft() || headerHasDraft()) && !window.confirm('Dossier schliessen und den ungespeicherten Entwurf verwerfen?')) return;
    resetEntry(); active = ''; dialog.close(); imageGeneration++;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }
  function open(id = '', trigger) {
    returnFocus = trigger || document.activeElement;
    active = id; page = 0; order = 'newest'; editing = '';
    entrySignature = ''; titleSignature = '';
    resetEntry();
    const dossier = store.snapshot().dossiers.find(row => row.id === id);
    const form = dialog.querySelector('[data-dossier-form]');
    form.elements.title.value = dossier?.title || '';
    form.elements.description.value = dossier?.description || '';
    form.elements.project_id.innerHTML = projectOptions(dossier?.project_id);
    dialog.querySelector('[data-dossier-editor]').open = !dossier;
    dialog.querySelector('[data-dossier-content]').hidden = !dossier;
    dialog.querySelector('[data-dossier-action="delete-dossier"]').hidden = !dossier;
    dialog.querySelector('[data-entry-order]').value = order;
    status(''); refresh(); dialog.showModal();
    (dossier ? dialog.querySelector('[name="body"]') : form.elements.title).focus();
    if (id) void store.sync(id);
  }
  function entryCard(row) {
    const link = store.safeLink(row.link);
    return `<article class="dossier-entry project-detail-box" data-entry-id="${escape(row.id)}"><header><time datetime="${escape(row.created_at)}">${escape(date(row.created_at))}</time><button class="mini-btn secondary dossier-pin" type="button" data-dossier-action="pin" data-id="${escape(row.id)}" aria-pressed="${row.is_pinned}" aria-label="${row.is_pinned ? 'Eintrag lösen' : 'Eintrag anpinnen'}">${row.is_pinned ? '★ Angepinnt' : '☆ Anpinnen'}</button></header>${row.body ? `<p class="dossier-entry-text">${escape(row.body)}</p>` : ''}${link ? `<a class="dossier-link" href="${escape(link)}" target="_blank" rel="noopener noreferrer">↗ ${escape(new URL(link).hostname)}<span>${escape(link)}</span></a>` : ''}${row.image_path ? `<div class="dossier-image" data-image-path="${escape(row.image_path)}"><span>Bild wird geladen …</span><img alt="${escape(row.image_alt || 'Bild zum Dossier-Eintrag')}" loading="lazy" decoding="async" referrerpolicy="no-referrer" hidden></div>` : ''}<footer>${button('edit-entry', 'Bearbeiten', row.id)}${button('delete-entry', 'Entfernen', row.id)}</footer></article>`;
  }
  async function loadImages() {
    const generation = ++imageGeneration;
    const nodes = Array.from(dialog.querySelectorAll('[data-image-path]'));
    if (!nodes.length) return;
    try {
      const urls = await store.imageUrls(nodes.map(node => node.dataset.imagePath));
      if (generation !== imageGeneration || !dialog.open) return;
      for (const node of nodes) {
        const url = urls.get(node.dataset.imagePath), image = node.querySelector('img'), hint = node.querySelector('span');
        if (!url) { hint.textContent = 'Bild gerade nicht verfügbar. Bitte online aktualisieren.'; continue; }
        image.onerror = () => { image.hidden = true; hint.hidden = false; hint.textContent = 'Bild gerade nicht verfügbar. Bitte aktualisieren.'; };
        image.src = url; image.hidden = false; hint.hidden = true;
      }
    } catch (_) { if (generation === imageGeneration) nodes.forEach(node => { node.querySelector('span').textContent = 'Bild gerade nicht verfügbar.'; }); }
  }
  function refresh() {
    if (!pane || (view !== 'dossiers' && !dialog.open)) return;
    const snapshot = store.snapshot();
    pane.querySelector('[data-dossier-sync]').textContent = snapshot.status;
    dialog.querySelector('[data-detail-sync]').textContent = snapshot.status;
    const dossiers = snapshot.dossiers.filter(row => (row.title + ' ' + row.description).toLocaleLowerCase('de').includes(query)).sort((a,b) => b.updated_at.localeCompare(a.updated_at));
    const pages = Math.max(1, Math.ceil(dossiers.length / PAGE_SIZE)); overviewPage = Math.min(overviewPage, pages - 1);
    const signature = JSON.stringify([dossiers, snapshot.projects.map(row => [row.id, row.title]), overviewPage]);
    if (signature !== overviewSignature) {
      overviewSignature = signature;
      pane.querySelector('[data-dossier-grid]').innerHTML = dossiers.length ? dossiers.slice(overviewPage * PAGE_SIZE, (overviewPage + 1) * PAGE_SIZE).map(row => {
        const project = snapshot.projects.find(project => project.id === row.project_id);
        return `<button type="button" class="project-card dossier-card" data-dossier-action="open" data-id="${escape(row.id)}"><small>Dossier</small><h3>${escape(row.title)}</h3><p>${escape(row.description || 'Gedanken, Links und Bilder an einem Ort.')}</p><div class="project-card-footer"><span class="badge muted">Dossier öffnen</span><span aria-hidden="true">↗</span></div>${project ? `<span class="subtle">Projekt: ${escape(project.title)}</span>` : ''}</button>`;
      }).join('') : `<div class="project-empty">${query ? 'Keine passenden Dossiers gefunden.' : 'Noch keine Dossiers. Sammle Gedanken, Links und Bilder zu deinem nächsten Thema.'}</div>`;
      pane.querySelector('[data-overview-page]').textContent = `${overviewPage + 1} / ${pages}`;
      pane.querySelector('[data-dossier-action="overview-prev"]').disabled = overviewPage === 0;
      pane.querySelector('[data-dossier-action="overview-next"]').disabled = overviewPage >= pages - 1;
    }
    const dossier = snapshot.dossiers.find(row => row.id === active);
    if (active && !dossier) { if (dialog.open) { resetEntry(); active = ''; dialog.close(); } return; }
    dialog.querySelector('#dossierTitle').textContent = dossier?.title || 'Dossier erstellen';
    if (!dossier) return;
    const titleKey = JSON.stringify([dossier, snapshot.projects.map(row => [row.id,row.title])]);
    if (titleKey !== titleSignature) {
      titleSignature = titleKey;
      const linked = snapshot.projects.find(row => row.id === dossier.project_id);
      dialog.querySelector('[data-dossier-description]').textContent = dossier.description;
      dialog.querySelector('[data-project-link]').innerHTML = linked ? button('open-project', 'Projekt öffnen: ' + escape(linked.title), linked.id) : '';
    }
    const entries = snapshot.entries.filter(row => row.dossier_id === active).sort((a,b) => Number(b.is_pinned) - Number(a.is_pinned) || (order === 'oldest' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)) || a.id.localeCompare(b.id));
    const entryPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE)); page = Math.min(page, entryPages - 1);
    const shown = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const nextSignature = JSON.stringify([active, shown, entries.length, page, order]);
    if (nextSignature !== entrySignature) {
      entrySignature = nextSignature;
      dialog.querySelector('[data-entry-list]').innerHTML = shown.length ? shown.map(entryCard).join('') : '<div class="project-empty">Dein Dossier ist bereit. Halte oben den ersten Gedanken fest oder füge einen Link oder ein Bild hinzu.</div>';
      dialog.querySelector('[data-entry-page]').textContent = `${entries.length} Einträge · Seite ${page + 1} / ${entryPages}`;
      dialog.querySelector('[data-dossier-action="entry-prev"]').disabled = page === 0;
      dialog.querySelector('[data-dossier-action="entry-next"]').disabled = page >= entryPages - 1;
      void loadImages();
    }
  }
  function queueRefresh() { if (!renderFrame) renderFrame = window.requestAnimationFrame(() => { renderFrame = 0; refresh(); }); }
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
    const input = { id: editing || undefined, dossier_id: active, body: form.elements.body.value, link: form.elements.link.value.trim(), is_pinned: form.elements.is_pinned.checked, image_path: existing?.image_path || '', image_alt: form.elements.image_alt.value };
    if (input.link && !store.safeLink(input.link)) { status('Bitte einen gültigen http- oder https-Link eingeben.'); return; }
    if (!input.body.trim() && !input.link && !blob && !input.image_path) { status('Bitte Text, Link oder Bild hinzufügen.'); return; }
    busy = true; form.setAttribute('aria-busy', 'true'); form.querySelectorAll('input,textarea,select,button').forEach(control => { control.disabled = true; }); let uploaded = '';
    try {
      if (blob) { status('Bild wird hochgeladen …'); uploaded = await store.upload(blob, active); input.image_path = uploaded; }
      store.saveEntry(input); resetEntry(); page = 0; refresh(); status('Eintrag lokal gespeichert.'); form.elements.body.focus();
    } catch (error) { if (uploaded) void store.removeUpload(uploaded); status(error.message || 'Speichern fehlgeschlagen. Dein Entwurf bleibt erhalten.'); }
    finally { busy = false; form.removeAttribute('aria-busy'); form.querySelectorAll('input,textarea,select,button').forEach(control => { control.disabled = false; }); }
  }
  function action(event) {
    const target = event.target.closest('[data-dossier-action]'); if (!target || busy) return;
    const name = target.dataset.dossierAction, id = target.dataset.id;
    try {
      if (name === 'create' || name === 'open') return open(id, target);
      if (name === 'close') return close();
      if (name === 'refresh') { void store.sync(active); void loadImages(); return; }
      if (name === 'overview-prev' || name === 'overview-next') { overviewPage += name.endsWith('next') ? 1 : -1; refresh(); return; }
      if (name === 'entry-prev' || name === 'entry-next') { page += name.endsWith('next') ? 1 : -1; refresh(); dialog.querySelector('[data-entry-list]').scrollIntoView({ block:'start' }); return; }
      if (name === 'cancel-entry' || name === 'remove-image') { if (name === 'cancel-entry') resetEntry(); else { blob = null; if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = ''; dialog.querySelector('[data-draft-image]').replaceChildren(); } status(''); return; }
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
        resetEntry(); editing = row.id;
        const form = dialog.querySelector('[data-entry-form]');
        form.elements.body.value = row.body; form.elements.link.value = row.link; form.elements.is_pinned.checked = row.is_pinned; form.elements.image_alt.value = row.image_alt;
        form.querySelector('[data-entry-submit]').textContent = 'Änderungen speichern'; form.querySelector('[data-dossier-action="cancel-entry"]').hidden = false;
        status(row.image_path ? 'Das vorhandene Bild bleibt erhalten. Ein neues Bild ersetzt es.' : ''); form.elements.body.focus();
      }
    } catch (error) { status(error.message || 'Aktion fehlgeschlagen.'); }
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
    dialog.innerHTML = `<div class="dossier-dialog-body"><header class="dossier-dialog-head"><div><p class="eyebrow">Dossier</p><h2 id="dossierTitle">Dossier erstellen</h2></div><button type="button" class="icon-btn" data-dossier-action="close" aria-label="Dossier schliessen">×</button></header><p data-dossier-description class="subtle"></p><div data-project-link></div><details class="project-editor-toggle" data-dossier-editor><summary>Dossier bearbeiten <span aria-hidden="true">⌄</span></summary><form data-dossier-form class="project-form-grid dossier-form"><label class="full"><span>Titel</span><input name="title" maxlength="120" required placeholder="z. B. Konferenz Zürich"></label><label class="full"><span>Beschreibung</span><textarea name="description" maxlength="600" rows="2" placeholder="Worum geht es?"></textarea></label><label class="full"><span>Projekt (optional)</span><select name="project_id"></select></label><div class="full dossier-actions"><button type="submit" class="pill primary">Dossier speichern</button>${button('delete-dossier','Dossier entfernen')}</div></form></details><div data-dossier-content><form data-entry-form class="dossier-composer"><h3>Gedanken festhalten</h3><label><span>Text</span><textarea name="body" maxlength="10000" rows="3" placeholder="Was möchtest du festhalten?"></textarea></label><label><span>Link (optional)</span><input name="link" type="url" maxlength="4000" placeholder="https://…"></label><div class="dossier-composer-options"><label class="dossier-file"><span>Bild hinzufügen</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp"></label><label class="dossier-check"><input name="is_pinned" type="checkbox"><span>Anpinnen</span></label></div><div data-draft-image class="dossier-draft-image"></div><label><span>Bildbeschreibung (optional)</span><input name="image_alt" maxlength="200" placeholder="Was zeigt das Bild?"></label><div class="dossier-actions"><button type="submit" class="pill primary" data-entry-submit>Eintrag hinzufügen</button><button type="button" class="mini-btn secondary" data-dossier-action="cancel-entry" hidden>Abbrechen</button></div></form><div class="dossier-history-head"><h3>Einträge</h3><label><span>Reihenfolge</span><select data-entry-order><option value="newest">Neueste zuerst</option><option value="oldest">Älteste zuerst</option></select></label></div><p class="subtle">Angepinnte Einträge stehen oben.</p><div data-entry-list class="dossier-entries"></div><nav class="dossier-pagination" aria-label="Eintragsseiten">${button('entry-prev','Zurück')}<span data-entry-page></span>${button('entry-next','Weiter')}</nav></div><footer class="dossier-sync-footer"><span class="subtle" data-detail-sync></span>${button('refresh','Aktualisieren')}</footer><p data-dossier-message class="dossier-message" role="status" aria-live="polite"></p></div>`;
    document.body.appendChild(dialog);
    tabs.addEventListener('click', event => { const tab = event.target.closest('[data-project-view]'); if (tab) show(tab.dataset.projectView); });
    tabs.addEventListener('keydown', event => { if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'projects' : event.key === 'End' ? 'dossiers' : view === 'projects' ? 'dossiers' : 'projects'; show(next); tabs.querySelector(`[data-project-view="${next}"]`).focus(); } });
    pane.addEventListener('click', action); dialog.addEventListener('click', action);
    pane.querySelector('[data-dossier-search]').addEventListener('input', event => { query = event.target.value.trim().toLocaleLowerCase('de'); overviewPage = 0; queueRefresh(); });
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.querySelector('[data-entry-order]').addEventListener('change', event => { order = event.target.value; page = 0; refresh(); });
    dialog.querySelector('[data-entry-form]').addEventListener('submit', submitEntry);
    dialog.querySelector('[name="image"]').addEventListener('change', event => { if (event.target.files[0]) void receive(event.target.files[0]); });
    dialog.querySelector('[data-entry-form]').addEventListener('paste', event => { const file = Array.from(event.clipboardData?.items || []).find(item => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile(); if (file) { event.preventDefault(); void receive(file); } });
    dialog.querySelector('[data-dossier-form]').addEventListener('submit', event => {
      event.preventDefault(); if (busy || !event.target.reportValidity()) return;
      const form = event.target;
      try { const row = store.saveDossier({ id:active || undefined, title:form.elements.title.value, description:form.elements.description.value, project_id:form.elements.project_id.value || null }); active = row.id; dialog.querySelector('[data-dossier-editor]').open = false; dialog.querySelector('[data-dossier-content]').hidden = false; dialog.querySelector('[data-dossier-action="delete-dossier"]').hidden = false; refresh(); void store.sync(active); status('Dossier lokal gespeichert.'); dialog.querySelector('[name="body"]').focus(); }
      catch (error) { status(error.message || 'Speichern fehlgeschlagen.'); }
    });
    store.subscribe(queueRefresh);
    document.getElementById('settingsForm')?.addEventListener('submit', () => { void store.sync(active); });
    window.addEventListener('habitflow:auth-change', () => { resetEntry(); active = ''; if (dialog.open) dialog.close(); overviewSignature = ''; queueRefresh(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && view === 'dossiers') { void store.sync(active); if (dialog.open) void loadImages(); } });
  }
  window.HabitFlowDossiers = Object.freeze({ showProjects() { if (projects) show('projects'); } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once:true }); else mount();
})(window, document);
