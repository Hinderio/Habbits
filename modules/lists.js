(function installHabitFlowLists(window, document) {
  'use strict';

  if (window.__habitFlowListsInstalled) return;
  window.__habitFlowListsInstalled = true;

  const STORAGE_KEY = 'habitflow-lists-v1';
  const PHOTO_IMAGE_MAX_EDGE = 1280;
  const PHOTO_IMAGE_QUALITY = 0.78;
  const DEFAULT_LISTS = [
    { id: 'lists', slug: 'listen', title: 'Listen', type: 'generic', icon: 'list', color: '#59d4cc', description: 'Freie Listen für kleine Sammlungen, Ideen und Dinge, die nicht in Tasks gehören.' },
    { id: 'vouchers', slug: 'gutscheine', title: 'Gutscheine', type: 'voucher', icon: 'ticket', color: '#f6b33f', description: 'Gutscheine, Codes und Fristen ruhig im Blick behalten.' },
    { id: 'shopping', slug: 'shopping', title: 'Shopping', type: 'shopping', icon: 'shopping', color: '#8bd7cd', description: 'Einkäufe, Mengen und Läden als klare Liste sammeln.' },
    { id: 'photos', slug: 'fotospots', title: 'Fotospots', type: 'photos', icon: 'camera', color: '#52bfd7', description: 'Spots sammeln und daraus visuelle Touren planen.' },
    { id: 'subscriptions', slug: 'abos', title: 'Abos', type: 'subscription', icon: 'repeat', color: '#b895ff', description: 'Abos, Kosten, Laufzeiten und Kündigungsfenster ordnen.' }
  ];

  const ICONS = {
    list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    ticket: '<path d="M3 9a3 3 0 0 0 0 6v3h18v-3a3 3 0 0 0 0-6V6H3v3Z"/><path d="M13 6v12"/><path d="M8 10h2"/><path d="M8 14h2"/>',
    shopping: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    camera: '<path d="M4 8h4l2-3h4l2 3h4v11H4V8Z"/><circle cx="12" cy="13" r="3"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m9 10 .5 8"/><path d="m15 10-.5 8"/><path d="M5 6l1 15h12l1-15"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    route: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M9 6h3a3 3 0 0 1 0 6h-1a3 3 0 0 0 0 6h4"/>',
    pin: '<path d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>'
  };

  let state = readState();
  let activeListId = state.activeListId || 'photos';
  let editingSpotId = '';
  let syncLabel = 'lokal';
  let supabaseClient = null;
  let remoteReady = false;
  let remoteUserId = '';
  let pullInFlight = false;
  let syncInFlight = false;
  let syncQueued = false;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function icon(name) {
    return `<svg class="hf-list-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.list}</svg>`;
  }

  function uid(prefix = 'item') {
    if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function readState() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
      return normalizeState(parsed);
    } catch (_) {
      return normalizeState({});
    }
  }

  function normalizeState(raw) {
    const listsById = new Map(DEFAULT_LISTS.map(list => [list.id, { ...list }]));
    (Array.isArray(raw.lists) ? raw.lists : []).forEach(list => {
      if (!list?.id) return;
      listsById.set(list.id, { ...listsById.get(list.id), ...list });
    });
    return {
      lists: Array.from(listsById.values()),
      items: Array.isArray(raw.items) ? raw.items : [],
      tours: Array.isArray(raw.tours) ? raw.tours : [],
      stops: Array.isArray(raw.stops) ? raw.stops : [],
      activeListId: raw.activeListId || 'photos'
    };
  }

  function persist() {
    state.activeListId = activeListId;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function currentList() {
    return state.lists.find(list => list.id === activeListId) || state.lists[0];
  }

  function itemsFor(listId) {
    return state.items
      .filter(item => item.listId === listId && !item.isArchived)
      .sort((a, b) => Number(a.isDone) - Number(b.isDone) || (a.sortRank || 0) - (b.sortRank || 0) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  function stopsFor(tourId) {
    return state.stops
      .filter(stop => stop.tourId === tourId && !stop.isArchived)
      .sort((a, b) => (a.stopOrder || 0) - (b.stopOrder || 0) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  }

  function metricValue(kind) {
    if (kind === 'open') return state.items.filter(item => !item.isDone && !item.isArchived).length;
    if (kind === 'vouchers') return itemsFor('vouchers').length;
    if (kind === 'photos') return state.stops.filter(stop => !stop.isArchived).length;
    return itemsFor('subscriptions').length;
  }

  function insertShell() {
    const nav = document.querySelector('.bottom-nav');
    const content = document.querySelector('.content');
    if (!nav || !content || document.querySelector('[data-target="lists"]')) return;

    const button = document.createElement('button');
    button.className = 'nav-btn';
    button.type = 'button';
    button.dataset.target = 'lists';
    button.innerHTML = `<span class="hf-list-nav-icon">${icon('list')}</span>List`;
    nav.insertBefore(button, nav.querySelector('[data-target="settings"]'));

    const screen = document.createElement('section');
    screen.id = 'screen-lists';
    screen.className = 'screen';
    screen.dataset.screen = 'lists';
    screen.hidden = true;
    screen.setAttribute('aria-hidden', 'true');
    screen.innerHTML = `
      <section class="hero-card hf-list-hero glass">
        <div>
          <p class="eyebrow">List OS</p>
          <h2>Listen, Spots und Abos ruhig ordnen</h2>
          <p>Shopping, Gutscheine, Fotospots und wiederkehrende Dinge als klare Cards statt verstreuter Notizen.</p>
        </div>
        <button id="hfListQuickAdd" class="pill primary" type="button">${icon('plus')} Eintrag erstellen</button>
      </section>
      <section class="grid cards-4 hf-list-metrics">
        <article class="metric-card glass"><span class="metric-label">Offen</span><strong id="hfListMetricOpen">0</strong><small>aktive Punkte</small></article>
        <article class="metric-card glass"><span class="metric-label">Gutscheine</span><strong id="hfListMetricVouchers">0</strong><small>gesammelt</small></article>
        <article class="metric-card glass"><span class="metric-label">Fotospots</span><strong id="hfListMetricPhotos">0</strong><small>in Touren</small></article>
        <article class="metric-card glass"><span class="metric-label">Abos</span><strong id="hfListMetricSubs">0</strong><small>im Blick</small></article>
      </section>
      <section class="panel glass">
        <div class="panel-head">
          <div><p class="eyebrow">Listen</p><h3>Sammlungen</h3></div>
          <span id="hfListSyncBadge" class="badge muted">lokal</span>
        </div>
        <div id="hfListCards" class="hf-list-card-grid"></div>
      </section>
      <section id="hfListDetail" class="panel glass hf-list-detail"></section>
    `;
    content.insertBefore(screen, document.getElementById('screen-settings'));
  }

  function render() {
    const screen = document.getElementById('screen-lists');
    if (!screen) return;
    const list = currentList();
    screen.querySelector('#hfListMetricOpen').textContent = metricValue('open');
    screen.querySelector('#hfListMetricVouchers').textContent = metricValue('vouchers');
    screen.querySelector('#hfListMetricPhotos').textContent = metricValue('photos');
    screen.querySelector('#hfListMetricSubs').textContent = metricValue('subs');
    screen.querySelector('#hfListSyncBadge').textContent = syncLabel;
    renderCards(screen.querySelector('#hfListCards'));
    renderDetail(screen.querySelector('#hfListDetail'), list);
  }

  function renderCards(target) {
    target.innerHTML = state.lists.map(list => {
      const count = list.type === 'photos' ? state.stops.filter(stop => !stop.isArchived).length : itemsFor(list.id).length;
      const done = list.type === 'photos' ? state.tours.filter(tour => !tour.isArchived).length : itemsFor(list.id).filter(item => item.isDone).length;
      return `
        <article class="hf-list-card ${list.id === activeListId ? 'is-active' : ''}" style="--hf-list-tone:${escapeHtml(list.color)}">
          <button type="button" data-list-open="${escapeHtml(list.id)}">
            <span class="hf-list-card-art">${icon(list.icon)}</span>
            <span class="hf-list-card-copy">
              <small>${escapeHtml(list.type === 'photos' ? 'Touren & Orte' : 'Liste')}</small>
              <strong>${escapeHtml(list.title)}</strong>
              <em>${escapeHtml(list.description)}</em>
            </span>
            <span class="hf-list-card-stat"><b>${count}</b><small>${list.type === 'photos' ? `${done} Touren` : 'Einträge'}</small></span>
          </button>
        </article>
      `;
    }).join('');
  }

  function renderDetail(target, list) {
    if (list.type === 'photos') {
      target.innerHTML = renderPhotosDetail(list);
      return;
    }
    const listItems = itemsFor(list.id);
    target.innerHTML = `
      <div class="panel-head">
        <div><p class="eyebrow">${escapeHtml(list.title)}</p><h3>${escapeHtml(list.title)} verwalten</h3></div>
        <span class="badge">${listItems.length} Einträge</span>
      </div>
      <form class="hf-list-form" data-form="item">
        <label class="full"><span>Titel</span><input name="title" placeholder="${escapeHtml(itemPlaceholder(list.type))}" required></label>
        <label><span>${escapeHtml(firstMetaLabel(list.type))}</span><input name="metaA" placeholder="${escapeHtml(firstMetaPlaceholder(list.type))}"></label>
        <label><span>${escapeHtml(secondMetaLabel(list.type))}</span><input name="metaB" placeholder="${escapeHtml(secondMetaPlaceholder(list.type))}"></label>
        <label class="full"><span>Notiz</span><textarea name="note" rows="2" placeholder="optional"></textarea></label>
        <button class="pill primary" type="submit">${icon('plus')} Eintrag speichern</button>
      </form>
      <div class="hf-list-items ${listItems.length ? '' : 'is-empty'}">
        ${listItems.length ? listItems.map(renderItem).join('') : '<p>Noch keine Einträge vorhanden.</p>'}
      </div>
    `;
  }

  function renderItem(item) {
    const meta = [item.metadata?.metaA, item.metadata?.metaB].filter(Boolean).join(' · ');
    return `
      <article class="hf-list-row ${item.isDone ? 'is-done' : ''}" data-item-id="${escapeHtml(item.id)}">
        <button class="hf-list-check" type="button" data-action="toggle-item" aria-label="Status wechseln">${item.isDone ? icon('check') : ''}</button>
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          ${meta || item.note ? `<span>${escapeHtml([meta, item.note].filter(Boolean).join(' · '))}</span>` : ''}
        </div>
        <button class="hf-list-icon-btn" type="button" data-action="edit-item" aria-label="Eintrag bearbeiten">${icon('edit')}</button>
        <button class="hf-list-icon-btn danger" type="button" data-action="delete-item" aria-label="Eintrag löschen">${icon('trash')}</button>
      </article>
    `;
  }

  function renderPhotosDetail(list) {
    const tours = state.tours.filter(tour => !tour.isArchived).sort((a, b) => (a.sortRank || 0) - (b.sortRank || 0));
    const activeTours = tours.length ? tours : [{ id: 'demo-tour', title: 'Valais Route', region: 'Valais', demo: true }];
    const editingSpot = editingSpotId ? state.stops.find(stop => stop.id === editingSpotId && !stop.isArchived) : null;
    const tourOptions = tours.map(tour => `<option value="${escapeHtml(tour.id)}" ${tour.id === editingSpot?.tourId ? 'selected' : ''}>${escapeHtml(tour.title)}</option>`).join('');
    const imageHint = editingSpot?.imageUrl
      ? 'Optional · neues Bild ersetzt den vorhandenen Anhang.'
      : 'Optional · wird vor dem Speichern komprimiert.';
    return `
      <div class="panel-head">
        <div><p class="eyebrow">${escapeHtml(list.title)}</p><h3>Fotospots & Touren</h3></div>
        <span class="badge">${state.stops.filter(stop => !stop.isArchived).length} Spots</span>
      </div>
      <div class="hf-photo-grid">
        <form class="hf-list-form" data-form="tour">
          <label class="full"><span>Tour</span><input name="title" placeholder="z. B. Valais Winterroute" required></label>
          <label><span>Region</span><input name="region" placeholder="z. B. Valais"></label>
          <label><span>Cover URL</span><input name="coverUrl" placeholder="https://..."></label>
          <button class="pill primary" type="submit">${icon('route')} Tour erstellen</button>
        </form>
        <form class="hf-list-form ${editingSpot ? 'is-editing' : ''}" data-form="spot" data-editing-id="${escapeHtml(editingSpot?.id || '')}">
          <label class="full"><span>Fotospot</span><input name="title" value="${escapeHtml(editingSpot?.title || '')}" placeholder="z. B. Gornergrat" required></label>
          <label><span>Tour</span><select name="tourId" ${tourOptions ? '' : 'disabled'}>${tourOptions || '<option>Erst Tour erstellen</option>'}</select></label>
          <label class="full hf-photo-upload"><span>Bildanhang</span><input name="image" type="file" accept="image/*"><small>${imageHint}</small></label>
          <label class="full"><span>Ort / Notiz</span><input name="location" value="${escapeHtml(editingSpot?.location || '')}" placeholder="z. B. Sonnenaufgang, 07:30"></label>
          <p class="hf-list-form-error full" data-spot-error role="status" hidden></p>
          <div class="hf-list-form-actions full">
            <button class="pill primary" type="submit">${icon('pin')} ${editingSpot ? 'Änderungen speichern' : 'Spot speichern'}</button>
            ${editingSpot ? '<button class="pill secondary" type="button" data-action="cancel-spot-edit">Abbrechen</button>' : ''}
          </div>
        </form>
      </div>
      <div class="hf-tour-stack">
        ${activeTours.map(renderTour).join('')}
      </div>
    `;
  }

  function renderTour(tour) {
    const stops = tour.demo ? demoStops() : stopsFor(tour.id);
    return `
      <article class="hf-tour-card" data-tour-id="${escapeHtml(tour.id)}">
        <div class="hf-tour-head">
          <div><small>Fototour</small><strong>${escapeHtml(tour.title)}</strong></div>
          <span>${escapeHtml(tour.region || 'ohne Region')}</span>
        </div>
        <div class="hf-tour-scroll">
          <div class="hf-tour-line ${stops.length ? '' : 'is-empty'}">
            ${stops.length ? stops.map((stop, index) => renderTourStop(stop, index, stops.length)).join('') : '<p>Noch keine Spots in dieser Tour.</p>'}
          </div>
        </div>
        ${tour.demo ? '' : `<div class="hf-tour-actions"><button class="hf-list-icon-btn" type="button" data-action="edit-tour" aria-label="Tour bearbeiten">${icon('edit')}</button><button class="hf-list-icon-btn danger" type="button" data-action="delete-tour" aria-label="Tour löschen">${icon('trash')}</button></div>`}
      </article>
    `;
  }

  function renderTourStop(stop, index, total) {
    const left = total <= 1 ? 50 : 10 + (index * 80 / (total - 1));
    const image = stop.imageUrl ? `<img src="${escapeHtml(stop.imageUrl)}" alt="">` : `<div class="hf-spot-placeholder">${icon('camera')}</div>`;
    return `
      <button class="hf-tour-stop" type="button" data-stop-id="${escapeHtml(stop.id)}" style="--spot-left:${left}%">
        <span class="hf-tour-stop-image">${image}</span>
        <span class="hf-tour-stop-pin"></span>
        <strong>${escapeHtml(stop.title)}</strong>
        <small>${escapeHtml(stop.location || '')}</small>
      </button>
    `;
  }

  function demoStops() {
    return [
      { id: 'demo-1', title: 'Les Attelas', location: 'Startpunkt', imageUrl: '' },
      { id: 'demo-2', title: 'Vercorin', location: 'Cret du Midi', imageUrl: '' },
      { id: 'demo-3', title: 'Gornergrat', location: 'Matterhorn Blick', imageUrl: '' },
      { id: 'demo-4', title: 'Klein Matterhorn', location: 'Finale', imageUrl: '' }
    ];
  }

  function itemPlaceholder(type) {
    return type === 'voucher' ? 'z. B. Bergbahn Gutschein' : type === 'shopping' ? 'z. B. Hafermilch' : type === 'subscription' ? 'z. B. Adobe Foto Abo' : 'z. B. Packliste Weekend';
  }

  function firstMetaLabel(type) {
    return type === 'voucher' ? 'Wert' : type === 'shopping' ? 'Menge' : type === 'subscription' ? 'Kosten' : 'Kategorie';
  }

  function firstMetaPlaceholder(type) {
    return type === 'voucher' ? 'CHF 50' : type === 'shopping' ? '2 Stk.' : type === 'subscription' ? 'CHF 12.90' : 'optional';
  }

  function secondMetaLabel(type) {
    return type === 'voucher' ? 'Ablauf' : type === 'shopping' ? 'Laden' : type === 'subscription' ? 'Zyklus' : 'Kontext';
  }

  function secondMetaPlaceholder(type) {
    return type === 'voucher' ? '31.12.2026' : type === 'shopping' ? 'Migros' : type === 'subscription' ? 'monatlich' : 'optional';
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const listOpen = event.target.closest('[data-list-open]');
      if (listOpen) {
        activeListId = listOpen.dataset.listOpen;
        editingSpotId = '';
        persist();
        render();
        document.getElementById('hfListDetail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      if (event.target.closest('#hfListQuickAdd')) {
        document.getElementById('hfListDetail')?.querySelector('input,select,textarea')?.focus({ preventScroll: false });
        return;
      }

      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'cancel-spot-edit') {
        editingSpotId = '';
        render();
        return;
      }

      const row = event.target.closest('[data-item-id]');
      if (row && action) handleItemAction(action, row.dataset.itemId);

      const tour = event.target.closest('[data-tour-id]');
      if (tour && (action === 'edit-tour' || action === 'delete-tour')) handleTourAction(action, tour.dataset.tourId);

      const stop = event.target.closest('[data-stop-id]');
      if (stop && !event.target.closest('[data-action]')) handleSpotOpen(stop.dataset.stopId);
    });

    document.addEventListener('submit', event => {
      const form = event.target.closest('#screen-lists form[data-form]');
      if (!form) return;
      event.preventDefault();
      if (form.dataset.form === 'item') saveItem(form);
      if (form.dataset.form === 'tour') saveTour(form);
      if (form.dataset.form === 'spot') void saveSpot(form);
    });
  }

  function handleItemAction(action, id) {
    const item = state.items.find(entry => entry.id === id);
    if (!item) return;
    if (action === 'toggle-item') item.isDone = !item.isDone;
    if (action === 'delete-item') item.isArchived = true;
    if (action === 'edit-item') {
      const title = window.prompt('Eintrag bearbeiten', item.title);
      if (title === null) return;
      item.title = title.trim() || item.title;
    }
    item.updatedAt = new Date().toISOString();
    saveAndSync();
  }

  function handleTourAction(action, id) {
    const tour = state.tours.find(entry => entry.id === id);
    if (!tour) return;
    if (action === 'delete-tour') {
      tour.isArchived = true;
      state.stops.filter(stop => stop.tourId === id).forEach(stop => { stop.isArchived = true; });
    }
    if (action === 'edit-tour') {
      const title = window.prompt('Tour bearbeiten', tour.title);
      if (title === null) return;
      tour.title = title.trim() || tour.title;
    }
    tour.updatedAt = new Date().toISOString();
    saveAndSync();
  }

  function handleSpotOpen(id) {
    const stop = state.stops.find(entry => entry.id === id);
    if (!stop) return;
    editingSpotId = id;
    render();
    window.requestAnimationFrame(() => {
      const form = document.querySelector('#screen-lists form[data-form="spot"]');
      form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const titleInput = form?.elements?.title;
      titleInput?.focus({ preventScroll: true });
      titleInput?.select();
    });
  }

  function saveItem(form) {
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    if (!title) return;
    state.items.push({
      id: uid('list-item'),
      listId: activeListId,
      title,
      note: String(data.get('note') || '').trim(),
      metadata: { metaA: String(data.get('metaA') || '').trim(), metaB: String(data.get('metaB') || '').trim() },
      isDone: false,
      isArchived: false,
      sortRank: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    form.reset();
    saveAndSync();
  }

  function saveTour(form) {
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    if (!title) return;
    state.tours.push({
      id: uid('photo-tour'),
      title,
      region: String(data.get('region') || '').trim(),
      coverUrl: String(data.get('coverUrl') || '').trim(),
      sortRank: Date.now(),
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    form.reset();
    saveAndSync();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Datei konnte nicht gelesen werden.'));
      reader.readAsDataURL(file);
    });
  }

  function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Bild konnte nicht verarbeitet werden.'));
      image.src = dataUrl;
    });
  }

  async function compressPhotoImage(file) {
    const rawDataUrl = await readFileAsDataUrl(file);
    const image = await loadImageFromDataUrl(rawDataUrl);
    const maxEdge = Math.max(image.width || 0, image.height || 0);
    if (!maxEdge) return rawDataUrl;
    const scale = Math.min(1, PHOTO_IMAGE_MAX_EDGE / maxEdge);
    const width = Math.max(1, Math.round((image.width || PHOTO_IMAGE_MAX_EDGE) * scale));
    const height = Math.max(1, Math.round((image.height || PHOTO_IMAGE_MAX_EDGE) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Bild konnte nicht verarbeitet werden.');
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', PHOTO_IMAGE_QUALITY);
  }

  async function saveSpot(form) {
    const data = new FormData(form);
    const existingSpotId = String(form.dataset.editingId || '').trim();
    const existingSpot = existingSpotId ? state.stops.find(stop => stop.id === existingSpotId && !stop.isArchived) : null;
    const tourId = String(data.get('tourId') || '').trim();
    const title = String(data.get('title') || '').trim();
    if (!tourId || !title) return;
    const imageFile = data.get('image');
    const hasImage = imageFile && typeof imageFile === 'object' && imageFile.size > 0;
    const errorElement = form.querySelector('[data-spot-error]');
    const submitButton = form.querySelector('button[type="submit"]');
    if (hasImage && !String(imageFile.type || '').startsWith('image/')) {
      if (errorElement) {
        errorElement.textContent = 'Bitte eine Bilddatei auswählen.';
        errorElement.hidden = false;
      }
      return;
    }
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.hidden = true;
    }
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = hasImage ? 'Bild wird verarbeitet ...' : 'Spot wird gespeichert ...';
    }
    let imageUrl = existingSpot?.imageUrl || '';
    try {
      if (hasImage) imageUrl = await compressPhotoImage(imageFile);
    } catch (error) {
      console.warn('[HabitFlow/lists] Fotospot-Bild konnte nicht verarbeitet werden.', error);
      if (errorElement) {
        errorElement.textContent = 'Das Bild konnte nicht verarbeitet werden. Bitte eine andere Datei wählen.';
        errorElement.hidden = false;
      }
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = `${icon('pin')} ${existingSpot ? 'Änderungen speichern' : 'Spot speichern'}`;
      }
      return;
    }
    const now = new Date().toISOString();
    const location = String(data.get('location') || '').trim();
    if (existingSpot) {
      const tourChanged = existingSpot.tourId !== tourId;
      Object.assign(existingSpot, {
        tourId,
        title,
        location,
        imageUrl,
        stopOrder: tourChanged ? stopsFor(tourId).length + 1 : existingSpot.stopOrder,
        updatedAt: now
      });
    } else {
      state.stops.push({
        id: uid('photo-stop'),
        tourId,
        title,
        location,
        imageUrl,
        stopOrder: stopsFor(tourId).length + 1,
        isArchived: false,
        createdAt: now,
        updatedAt: now
      });
    }
    if (!existingSpotId || editingSpotId === existingSpotId) editingSpotId = '';
    form.reset();
    saveAndSync();
  }

  function saveAndSync() {
    persist();
    render();
    syncToSupabase();
  }

  async function getClient() {
    if (supabaseClient) return supabaseClient;
    const config = window.HABITFLOW_SUPABASE_CONFIG;
    if (!window.supabase?.createClient || !config?.url || !config?.anonKey) return null;
    supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return supabaseClient;
  }

  function updatedAtValue(item = {}) {
    const value = Date.parse(item.updatedAt || item.updated_at || item.createdAt || item.created_at || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function mergeById(localItems = [], remoteItems = []) {
    const merged = new Map(localItems.filter(item => item?.id).map(item => [String(item.id), item]));
    remoteItems.filter(item => item?.id).forEach(item => {
      const id = String(item.id);
      const local = merged.get(id);
      if (!local || updatedAtValue(item) >= updatedAtValue(local)) merged.set(id, item);
    });
    return Array.from(merged.values());
  }

  function assertRemoteResults(results) {
    const failed = results.find(result => result?.error);
    if (failed?.error) throw failed.error;
  }

  async function syncFromSupabase(userId = '') {
    const client = await getClient();
    if (!client) return;
    if (!userId) {
      const { data } = await client.auth.getSession();
      userId = data?.session?.user?.id || '';
    }
    if (!userId) return;
    if (pullInFlight && userId === remoteUserId) return;
    remoteUserId = userId;
    pullInFlight = true;
    syncLabel = 'synchronisiert ...';
    render();
    try {
      const [listsRes, itemsRes, toursRes, stopsRes] = await Promise.all([
        client.from('custom_lists').select('*').eq('user_id', userId).order('sort_rank', { ascending: true }),
        client.from('custom_list_items').select('*').eq('user_id', userId).order('sort_rank', { ascending: true }),
        client.from('photo_spot_tours').select('*').eq('user_id', userId).order('sort_rank', { ascending: true }),
        client.from('photo_spot_tour_stops').select('*').eq('user_id', userId).order('stop_order', { ascending: true })
      ]);
      assertRemoteResults([listsRes, itemsRes, toursRes, stopsRes]);
      const remoteLists = (listsRes.data || []).map(row => ({
        id: row.id, slug: row.slug, title: row.title, type: row.list_type, icon: row.icon, color: row.color, description: row.description || '',
        createdAt: row.created_at, updatedAt: row.updated_at, isArchived: row.is_archived
      }));
      const remoteItems = (itemsRes.data || []).map(row => ({
        id: row.id, listId: row.list_id, title: row.title, note: row.note || '', metadata: row.metadata || {}, isDone: row.is_done,
        isArchived: row.is_archived, sortRank: row.sort_rank, createdAt: row.created_at, updatedAt: row.updated_at
      }));
      const remoteTours = (toursRes.data || []).map(row => ({
        id: row.id, title: row.title, region: row.region || '', note: row.note || '', coverUrl: row.cover_url || '', sortRank: row.sort_rank,
        isArchived: row.is_archived, createdAt: row.created_at, updatedAt: row.updated_at
      }));
      const remoteStops = (stopsRes.data || []).map(row => ({
        id: row.id, tourId: row.tour_id, title: row.title, location: row.location || '', note: row.note || '', imageUrl: row.image_url || '',
        stopOrder: row.stop_order, metadata: row.metadata || {}, isArchived: row.is_archived, createdAt: row.created_at, updatedAt: row.updated_at
      }));
      state = normalizeState({
        ...state,
        lists: mergeById(state.lists, remoteLists),
        items: mergeById(state.items, remoteItems),
        tours: mergeById(state.tours, remoteTours),
        stops: mergeById(state.stops, remoteStops)
      });
      remoteReady = true;
      syncLabel = 'synchronisiert';
      persist();
      render();
      await syncToSupabase();
    } catch (error) {
      remoteReady = false;
      syncLabel = 'SQL erforderlich';
      console.warn('[HabitFlow/lists] Supabase-Tabellen sind noch nicht bereit.', error);
      render();
    } finally {
      pullInFlight = false;
    }
  }

  async function syncToSupabase() {
    if (!remoteReady || !remoteUserId) return;
    if (syncInFlight) {
      syncQueued = true;
      return;
    }
    const client = await getClient();
    if (!client) return;
    syncInFlight = true;
    try {
      const now = new Date().toISOString();
      const listResult = await client.from('custom_lists').upsert(state.lists.map((list, index) => ({
        id: list.id, user_id: remoteUserId, slug: list.slug || list.id, title: list.title, list_type: list.type, icon: list.icon, color: list.color,
        description: list.description || '', sort_rank: index, is_archived: !!list.isArchived, created_at: list.createdAt || now, updated_at: list.updatedAt || now
      })), { onConflict: 'user_id,id' });
      assertRemoteResults([listResult]);
      if (state.items.length) {
        const result = await client.from('custom_list_items').upsert(state.items.map(item => ({
          id: item.id, user_id: remoteUserId, list_id: item.listId, title: item.title, note: item.note || '', metadata: item.metadata || {},
          is_done: !!item.isDone, is_archived: !!item.isArchived, sort_rank: item.sortRank || 0, created_at: item.createdAt || now, updated_at: item.updatedAt || now
        })), { onConflict: 'user_id,id' });
        assertRemoteResults([result]);
      }
      if (state.tours.length) {
        const result = await client.from('photo_spot_tours').upsert(state.tours.map(tour => ({
          id: tour.id, user_id: remoteUserId, title: tour.title, region: tour.region || '', note: tour.note || '', cover_url: tour.coverUrl || '',
          sort_rank: tour.sortRank || 0, is_archived: !!tour.isArchived, created_at: tour.createdAt || now, updated_at: tour.updatedAt || now
        })), { onConflict: 'user_id,id' });
        assertRemoteResults([result]);
      }
      if (state.stops.length) {
        const result = await client.from('photo_spot_tour_stops').upsert(state.stops.map(stop => ({
          id: stop.id, user_id: remoteUserId, tour_id: stop.tourId, title: stop.title, location: stop.location || '', note: stop.note || '', image_url: stop.imageUrl || '',
          stop_order: stop.stopOrder || 0, metadata: stop.metadata || {}, is_archived: !!stop.isArchived, created_at: stop.createdAt || now, updated_at: stop.updatedAt || now
        })), { onConflict: 'user_id,id' });
        assertRemoteResults([result]);
      }
      syncLabel = 'synchronisiert';
      render();
    } catch (error) {
      syncLabel = 'lokal';
      console.warn('[HabitFlow/lists] Änderungen bleiben lokal und werden später erneut synchronisiert.', error);
      render();
    } finally {
      syncInFlight = false;
      if (syncQueued) {
        syncQueued = false;
        syncToSupabase();
      }
    }
  }

  async function initRemoteSync() {
    const client = await getClient();
    if (!client) return;
    client.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id || '';
      if (!userId) {
        remoteReady = false;
        remoteUserId = '';
        syncLabel = 'lokal';
        render();
        return;
      }
      if (userId === remoteUserId && remoteReady) return;
      window.setTimeout(() => syncFromSupabase(userId), 0);
    });
    const { data } = await client.auth.getSession();
    const userId = data?.session?.user?.id || '';
    if (userId) await syncFromSupabase(userId);
  }

  insertShell();
  bindEvents();
  document.addEventListener('DOMContentLoaded', () => {
    insertShell();
    render();
    initRemoteSync();
  }, { once: true });
  window.addEventListener('online', () => {
    if (remoteReady) syncToSupabase();
    else initRemoteSync();
  });
  render();
})(window, document);
