(function installHabitFlowLists(window, document) {
  'use strict';

  if (window.__habitFlowListsInstalled) return;
  window.__habitFlowListsInstalled = true;

  const STORAGE_KEY = 'habitflow-lists-v1';
  const PHOTO_IMAGE_MAX_EDGE = 1280;
  const PHOTO_IMAGE_QUALITY = 0.78;
  const SUBSCRIPTION_CYCLES = [
    { value: 'daily', label: 'Täglich', annualFactor: 365 },
    { value: 'weekly', label: 'Wöchentlich', annualFactor: 52 },
    { value: 'monthly', label: 'Monatlich', annualFactor: 12 },
    { value: 'quarterly', label: 'Quartalsweise', annualFactor: 4 },
    { value: 'yearly', label: 'Jährlich', annualFactor: 1 }
  ];
  const SUBSCRIPTION_COLORS = ['#34c9c3', '#f6b33f', '#61cbf4', '#ff8fa3', '#8fdc9b', '#9b7de3', '#f08a73', '#5b8def'];
  const FINANCE_KINDS = [
    { value: 'investment', label: 'Investition' },
    { value: 'credit', label: 'Guthaben' },
    { value: 'debt', label: 'Schuld' }
  ];
  const FINANCE_UNITS = [
    { value: 'chf', label: 'CHF' },
    { value: 'visits', label: 'Besuche' },
    { value: 'units', label: 'Einheiten' },
    { value: 'hours', label: 'Stunden' },
    { value: 'days', label: 'Tage' }
  ];
  const FINANCE_COLORS = ['#35c9a5', '#61cbf4', '#f6b33f'];
  const DEFAULT_LISTS = [
    { id: 'lists', slug: 'listen', title: 'Listen', type: 'generic', icon: 'list', color: '#59d4cc', description: 'Freie Listen für kleine Sammlungen, Ideen und Dinge, die nicht in Tasks gehören.' },
    { id: 'vouchers', slug: 'gutscheine', title: 'Gutscheine', type: 'voucher', icon: 'ticket', color: '#f6b33f', description: 'Gutscheine, Codes und Fristen ruhig im Blick behalten.' },
    { id: 'shopping', slug: 'shopping', title: 'Shopping', type: 'shopping', icon: 'shopping', color: '#8bd7cd', description: 'Einkäufe, Mengen und Läden als klare Liste sammeln.' },
    { id: 'photos', slug: 'fotospots', title: 'Fotospots', type: 'photos', icon: 'camera', color: '#52bfd7', description: 'Spots sammeln und daraus visuelle Touren planen.' },
    { id: 'subscriptions', slug: 'abos', title: 'Abos', type: 'subscription', icon: 'repeat', color: '#61CBF4', description: 'Abos, Kosten, Laufzeiten und Kündigungsfenster ordnen.' },
    { id: 'terms', slug: 'begriffe', title: 'Begriffe', type: 'generic', icon: 'book', color: '#ff8fa3', description: 'Begriffe nach Kategorien sammeln und mit Lernkarten festigen.' },
    { id: 'finance', slug: 'finanzen', title: 'Finanzen', type: 'generic', icon: 'wallet', color: '#6fd6a8', description: 'Investitionen, Guthaben und offene Schulden in einem ruhigen Finanzbild.' },
    { id: 'chatgpt', slug: 'chatgpt', title: 'ChatGPT', type: 'generic', icon: 'message', color: '#7f9fd4', description: 'Wichtige Projekte und Threads gruppiert sichern und direkt wieder öffnen.' }
  ];

  const ICONS = {
    list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    ticket: '<path d="M3 9a3 3 0 0 0 0 6v3h18v-3a3 3 0 0 0 0-6V6H3v3Z"/><path d="M13 6v12"/><path d="M8 10h2"/><path d="M8 14h2"/>',
    shopping: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    camera: '<path d="M4 8h4l2-3h4l2 3h4v11H4V8Z"/><circle cx="12" cy="13" r="3"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z"/>',
    wallet: '<path d="M3 6h15a3 3 0 0 1 3 3v10H5a2 2 0 0 1-2-2V6Z"/><path d="M3 6a3 3 0 0 1 3-3h11v3"/><path d="M15 11h6v5h-6a2.5 2.5 0 0 1 0-5Z"/>',
    trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
    credit: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M7 15h3"/>',
    debt: '<path d="M16 3h5v5"/><path d="m21 3-7 7"/><path d="M8 21H3v-5"/><path d="m3 21 7-7"/>',
    close: '<path d="m6 6 12 12"/><path d="m18 6-12 12"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m9 10 .5 8"/><path d="m15 10-.5 8"/><path d="M5 6l1 15h12l1-15"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    route: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M9 6h3a3 3 0 0 1 0 6h-1a3 3 0 0 0 0 6h4"/>',
    pin: '<path d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
    message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/><path d="M8 9h8"/><path d="M8 13h5"/>',
    external: '<path d="M15 3h6v6"/><path d="m10 14 11-11"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
  };

  let state = readState();
  let activeListId = state.activeListId || 'photos';
  let editingSpotId = '';
  let editingTourId = '';
  let editingTermId = '';
  let editingShoppingId = '';
  let editingSubscriptionId = '';
  let editingFinanceId = '';
  let editingChatgptId = '';
  let termStudyCategory = '';
  let termStudyIndex = 0;
  let termStudyOrder = [];
  const collapsedTermCategories = new Set();
  const initializedTermCategories = new Set();
  const collapsedShoppingCategories = new Set();
  const collapsedChatgptProjects = new Set();
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
      const merged = { ...listsById.get(list.id), ...list };
      if (list.id === 'subscriptions') merged.color = '#61CBF4';
      listsById.set(list.id, merged);
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
    if (kind === 'open') return state.items.filter(item => item.listId !== 'terms' && !item.isDone && !item.isArchived).length;
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
          <h2>Listen, Wissen und Werte ruhig ordnen</h2>
          <p>Shopping, Gutscheine, Fotospots, Finanzen und wiederkehrende Dinge als klare Cards statt verstreuter Notizen.</p>
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
    renderTermStudyPortal();
  }

  function renderCards(target) {
    target.innerHTML = state.lists.map(list => {
      const count = list.type === 'photos' ? state.stops.filter(stop => !stop.isArchived).length : itemsFor(list.id).length;
      const categories = list.id === 'terms' ? termCategories().length : 0;
      const done = list.type === 'photos' ? state.tours.filter(tour => !tour.isArchived).length : itemsFor(list.id).filter(item => item.isDone).length;
      const cardType = list.type === 'photos' ? 'Touren & Orte' : list.id === 'terms' ? 'Lernkarten' : list.id === 'finance' ? 'Werte & Verpflichtungen' : list.id === 'chatgpt' ? 'Threads & Projekte' : 'Liste';
      const cardStat = list.type === 'photos' ? `${done} Touren` : list.id === 'terms' ? `${categories} ${categories === 1 ? 'Kategorie' : 'Kategorien'}` : list.id === 'finance' ? 'Positionen' : list.id === 'chatgpt' ? 'Threads' : 'Einträge';
      return `
        <article class="hf-list-card ${list.id === activeListId ? 'is-active' : ''}" style="--hf-list-tone:${escapeHtml(list.color)}">
          <button type="button" data-list-open="${escapeHtml(list.id)}">
            <span class="hf-list-card-art">${icon(list.icon)}</span>
            <span class="hf-list-card-copy">
              <small>${escapeHtml(cardType)}</small>
              <strong>${escapeHtml(list.title)}</strong>
              <em>${escapeHtml(list.description)}</em>
            </span>
            <span class="hf-list-card-stat"><b>${count}</b><small>${escapeHtml(cardStat)}</small></span>
          </button>
        </article>
      `;
    }).join('');
  }

  function renderDetail(target, list) {
    if (list.id === 'terms') {
      target.innerHTML = renderTermsDetail(list);
      return;
    }
    if (list.id === 'shopping') {
      target.innerHTML = renderShoppingDetail(list);
      return;
    }
    if (list.id === 'subscriptions') {
      target.innerHTML = renderSubscriptionsDetail(list);
      return;
    }
    if (list.id === 'finance') {
      target.innerHTML = renderFinanceDetail(list);
      return;
    }
    if (list.id === 'chatgpt') {
      target.innerHTML = renderChatgptDetail(list);
      return;
    }
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

  function itemCategory(item, fallback = 'Ohne Kategorie') {
    return String(item?.metadata?.category || fallback).trim() || fallback;
  }

  function shoppingCategory(item) {
    return itemCategory(item);
  }

  function shoppingCategories() {
    return Array.from(new Set(itemsFor('shopping').map(shoppingCategory))).sort((a, b) => a.localeCompare(b, 'de'));
  }

  function shoppingItemsInCategory(category) {
    return itemsFor('shopping').filter(item => shoppingCategory(item) === category);
  }


  function chatgptProject(item) {
    return String(item?.metadata?.project || item?.metadata?.category || 'Ohne Projekt').trim() || 'Ohne Projekt';
  }

  function chatgptProjects() {
    return Array.from(new Set(itemsFor('chatgpt').map(chatgptProject))).sort((a, b) => a.localeCompare(b, 'de'));
  }

  function chatgptItemsInProject(project) {
    return itemsFor('chatgpt').filter(item => chatgptProject(item) === project);
  }

  function normalizedExternalUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
      const parsed = new URL(candidate);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch (_) {
      return '';
    }
  }

  function chatgptLinkLabel(value) {
    try {
      return new URL(value).hostname.replace(/^www\./, '');
    } catch (_) {
      return 'ChatGPT-Link';
    }
  }

  function renderChatgptDetail(list) {
    const items = itemsFor('chatgpt');
    const projects = chatgptProjects();
    const editingItem = editingChatgptId ? items.find(item => item.id === editingChatgptId) : null;
    const projectOptions = projects.map(project => `<option value="${escapeHtml(project)}"></option>`).join('');
    return `
      <div class="panel-head">
        <div><p class="eyebrow">${escapeHtml(list.title)}</p><h3>Wichtige Threads nach Projekt ordnen</h3></div>
        <span class="badge">${items.length} ${items.length === 1 ? 'Thread' : 'Threads'}</span>
      </div>
      <form class="hf-list-form hf-chatgpt-form ${editingItem ? 'is-editing' : ''}" data-form="chatgpt" data-editing-id="${escapeHtml(editingItem?.id || '')}">
        <label><span>Titel</span><input name="title" value="${escapeHtml(editingItem?.title || '')}" placeholder="z. B. HabitFlow Performance-Fix" required></label>
        <label><span>Projekt</span><input name="project" list="hfChatgptProjects" value="${escapeHtml(editingItem ? chatgptProject(editingItem) : '')}" placeholder="Auswählen oder neu eingeben" required><datalist id="hfChatgptProjects">${projectOptions}</datalist></label>
        <label class="full"><span>Thread-Link</span><input name="url" type="text" inputmode="url" value="${escapeHtml(editingItem?.metadata?.url || '')}" placeholder="https://chatgpt.com/c/..." required></label>
        <label class="full"><span>Notiz</span><textarea name="note" rows="2" placeholder="Worum geht es in diesem Thread?">${escapeHtml(editingItem?.note || '')}</textarea></label>
        <p class="hf-list-form-error full" data-chatgpt-error role="status" hidden></p>
        <div class="hf-list-form-actions full">
          <button class="pill primary" type="submit">${icon('plus')} ${editingItem ? 'Änderungen speichern' : 'Thread speichern'}</button>
          ${editingItem ? '<button class="pill secondary" type="button" data-action="cancel-chatgpt-edit">Abbrechen</button>' : ''}
        </div>
      </form>
      <div class="hf-term-categories hf-chatgpt-projects ${projects.length ? '' : 'is-empty'}">
        ${projects.length ? projects.map(renderChatgptProject).join('') : '<p>Noch keine ChatGPT-Threads gespeichert.</p>'}
      </div>
    `;
  }

  function renderChatgptProject(project) {
    const items = chatgptItemsInProject(project);
    const isCollapsed = collapsedChatgptProjects.has(project);
    return `
      <section class="hf-term-category hf-chatgpt-project ${isCollapsed ? 'is-collapsed' : ''}" data-project="${escapeHtml(project)}">
        <div class="hf-term-category-head">
          <div>
            <small>Projekt</small>
            <h4><span class="hf-chatgpt-project-tag">${icon('message')}${escapeHtml(project)}</span></h4>
            <span>${items.length} ${items.length === 1 ? 'gespeicherter Thread' : 'gespeicherte Threads'}</span>
          </div>
          <div class="hf-term-category-head-actions">
            <button class="hf-list-icon-btn hf-term-collapse" type="button" data-action="toggle-chatgpt-project" aria-label="${isCollapsed ? 'Projekt öffnen' : 'Projekt schliessen'}" aria-expanded="${String(!isCollapsed)}">${icon('chevronRight')}</button>
          </div>
        </div>
        <div class="hf-term-list hf-chatgpt-list">
          ${items.map(renderChatgptRow).join('')}
        </div>
      </section>
    `;
  }

  function renderChatgptRow(item) {
    const url = normalizedExternalUrl(item.metadata?.url);
    return `
      <article class="hf-list-row hf-chatgpt-row" data-chatgpt-id="${escapeHtml(item.id)}">
        <div class="hf-chatgpt-copy">
          <strong>${escapeHtml(item.title)}</strong>
          <span class="hf-chatgpt-domain">${escapeHtml(chatgptLinkLabel(url))}</span>
          ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}
        </div>
        <a class="hf-chatgpt-open" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="Thread ${escapeHtml(item.title)} öffnen">${icon('external')}<span>Öffnen</span></a>
        <button class="hf-list-icon-btn" type="button" data-action="edit-chatgpt" aria-label="Thread bearbeiten">${icon('edit')}</button>
        <button class="hf-list-icon-btn danger" type="button" data-action="delete-chatgpt" aria-label="Thread löschen">${icon('trash')}</button>
      </article>
    `;
  }

  function renderShoppingDetail(list) {
    const items = itemsFor('shopping');
    const categories = shoppingCategories();
    const editingItem = editingShoppingId ? items.find(item => item.id === editingShoppingId) : null;
    const categoryOptions = categories.map(category => `<option value="${escapeHtml(category)}"></option>`).join('');
    return `
      <div class="panel-head">
        <div><p class="eyebrow">${escapeHtml(list.title)}</p><h3>Einkäufe kategorisiert planen</h3></div>
        <span class="badge">${items.length} Einträge</span>
      </div>
      <form class="hf-list-form ${editingItem ? 'is-editing' : ''}" data-form="shopping" data-editing-id="${escapeHtml(editingItem?.id || '')}">
        <label><span>Artikel</span><input name="title" value="${escapeHtml(editingItem?.title || '')}" placeholder="z. B. Hafermilch" required></label>
        <label><span>Kategorie</span><input name="category" list="hfShoppingCategories" value="${escapeHtml(editingItem ? shoppingCategory(editingItem) : '')}" placeholder="Auswählen oder neu eingeben" required><datalist id="hfShoppingCategories">${categoryOptions}</datalist></label>
        <label><span>Menge</span><input name="amount" value="${escapeHtml(editingItem?.metadata?.amount ?? editingItem?.metadata?.metaA ?? '')}" placeholder="z. B. 2 Stk."></label>
        <label><span>Laden</span><input name="store" value="${escapeHtml(editingItem?.metadata?.store ?? editingItem?.metadata?.metaB ?? '')}" placeholder="z. B. Migros"></label>
        <label class="full"><span>Notiz</span><textarea name="note" rows="2" placeholder="optional">${escapeHtml(editingItem?.note || '')}</textarea></label>
        <div class="hf-list-form-actions full">
          <button class="pill primary" type="submit">${icon('plus')} ${editingItem ? 'Änderungen speichern' : 'Artikel speichern'}</button>
          ${editingItem ? '<button class="pill secondary" type="button" data-action="cancel-shopping-edit">Abbrechen</button>' : ''}
        </div>
      </form>
      <div class="hf-term-categories hf-shopping-categories ${categories.length ? '' : 'is-empty'}">
        ${categories.length ? categories.map(renderShoppingCategory).join('') : '<p>Noch keine Einkäufe vorhanden.</p>'}
      </div>
    `;
  }

  function renderShoppingCategory(category) {
    const items = shoppingItemsInCategory(category);
    const isCollapsed = collapsedShoppingCategories.has(category);
    return `
      <section class="hf-term-category ${isCollapsed ? 'is-collapsed' : ''}">
        <div class="hf-term-category-head">
          <div><small>Kategorie</small><h4>${escapeHtml(category)}</h4><span>${items.length} ${items.length === 1 ? 'Artikel' : 'Artikel'}</span></div>
          <div class="hf-term-category-head-actions">
            <button class="hf-list-icon-btn hf-term-collapse" type="button" data-action="toggle-shopping-category" data-category="${escapeHtml(category)}" aria-expanded="${String(!isCollapsed)}" aria-label="Kategorie ${escapeHtml(category)} ${isCollapsed ? 'aufklappen' : 'zuklappen'}" title="Kategorie ${isCollapsed ? 'aufklappen' : 'zuklappen'}">${icon('chevronRight')}</button>
          </div>
        </div>
        <div class="hf-term-list">${items.map(renderShoppingRow).join('')}</div>
      </section>
    `;
  }

  function renderShoppingRow(item) {
    const amount = item.metadata?.amount ?? item.metadata?.metaA;
    const store = item.metadata?.store ?? item.metadata?.metaB;
    const details = [amount, store, item.note].filter(Boolean).join(' · ');
    return `
      <article class="hf-list-row ${item.isDone ? 'is-done' : ''}" data-shopping-id="${escapeHtml(item.id)}">
        <button class="hf-list-check" type="button" data-action="toggle-shopping" aria-label="Status wechseln">${item.isDone ? icon('check') : ''}</button>
        <div><strong>${escapeHtml(item.title)}</strong>${details ? `<span>${escapeHtml(details)}</span>` : ''}</div>
        <button class="hf-list-icon-btn" type="button" data-action="edit-shopping" aria-label="Artikel bearbeiten">${icon('edit')}</button>
        <button class="hf-list-icon-btn danger" type="button" data-action="delete-shopping" aria-label="Artikel löschen">${icon('trash')}</button>
      </article>
    `;
  }

  function parseSubscriptionCost(value) {
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : 0;
    let normalized = String(value ?? '').trim().replace(/[^0-9,.'-]/g, '').replace(/'/g, '');
    if (normalized.includes(',') && normalized.includes('.')) {
      normalized = normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
        ? normalized.replace(/\./g, '').replace(',', '.')
        : normalized.replace(/,/g, '');
    } else {
      normalized = normalized.replace(',', '.');
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  function subscriptionCycleKey(item) {
    const raw = String(item?.metadata?.cycle ?? item?.metadata?.metaB ?? 'monthly').trim().toLowerCase();
    const aliases = {
      daily: 'daily', 'täglich': 'daily', taeglich: 'daily', tag: 'daily',
      weekly: 'weekly', 'wöchentlich': 'weekly', woechentlich: 'weekly', woche: 'weekly',
      monthly: 'monthly', monatlich: 'monthly', monat: 'monthly',
      quarterly: 'quarterly', quartalsweise: 'quarterly', 'vierteljährlich': 'quarterly', vierteljaehrlich: 'quarterly', quartal: 'quarterly',
      yearly: 'yearly', 'jährlich': 'yearly', jaehrlich: 'yearly', annual: 'yearly', jahr: 'yearly'
    };
    return aliases[raw] || 'monthly';
  }

  function subscriptionCycle(key) {
    return SUBSCRIPTION_CYCLES.find(cycle => cycle.value === key) || SUBSCRIPTION_CYCLES[2];
  }

  function subscriptionCost(item) {
    return parseSubscriptionCost(item?.metadata?.cost ?? item?.metadata?.metaA);
  }

  function subscriptionAnnualCost(item) {
    return subscriptionCost(item) * subscriptionCycle(subscriptionCycleKey(item)).annualFactor;
  }

  function subscriptionIsCancelled(item) {
    return item?.metadata?.isCancelled === true || String(item?.metadata?.isCancelled || '').toLowerCase() === 'true';
  }

  function subscriptionContractEnd(item) {
    const value = String(item?.metadata?.contractEnd || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
  }

  function subscriptionIsExpired(item, now = new Date()) {
    if (!subscriptionIsCancelled(item)) return false;
    const contractEnd = subscriptionContractEnd(item);
    if (!contractEnd) return false;
    const end = new Date(`${contractEnd}T23:59:59`);
    return Number.isFinite(end.getTime()) && end < now;
  }

  function subscriptionForecastCost(item, now = new Date()) {
    const regularAnnualCost = subscriptionAnnualCost(item);
    const contractEnd = subscriptionContractEnd(item);
    if (!subscriptionIsCancelled(item) || !contractEnd) return regularAnnualCost;
    const end = new Date(`${contractEnd}T23:59:59`);
    if (!Number.isFinite(end.getTime()) || end <= now) return 0;
    const horizon = new Date(now);
    horizon.setFullYear(horizon.getFullYear() + 1);
    const effectiveEnd = end < horizon ? end : horizon;
    const remainingDays = Math.max(0, (effectiveEnd - now) / 86400000);
    const horizonDays = Math.max(1, (horizon - now) / 86400000);
    return regularAnnualCost * Math.min(1, remainingDays / horizonDays);
  }

  function formatContractDate(value) {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00`);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
  }

  function renderSubscriptionsDetail(list) {
    const items = itemsFor('subscriptions');
    const editingItem = editingSubscriptionId ? items.find(item => item.id === editingSubscriptionId) : null;
    const editingCycle = subscriptionCycleKey(editingItem);
    const editingCancelled = subscriptionIsCancelled(editingItem);
    const editingContractEnd = subscriptionContractEnd(editingItem);
    const cycleOptions = SUBSCRIPTION_CYCLES.map(cycle => `<option value="${cycle.value}" ${cycle.value === editingCycle ? 'selected' : ''}>${cycle.label}</option>`).join('');
    return `
      <div class="panel-head">
        <div><p class="eyebrow">${escapeHtml(list.title)}</p><h3>Abos & Kosten im Blick</h3></div>
        <span class="badge">${items.filter(item => !item.isDone && !subscriptionIsExpired(item)).length} laufend</span>
      </div>
      ${renderSubscriptionForecast(items)}
      <form class="hf-list-form ${editingItem ? 'is-editing' : ''}" data-form="subscription" data-editing-id="${escapeHtml(editingItem?.id || '')}">
        <label class="full"><span>Abo</span><input name="title" value="${escapeHtml(editingItem?.title || '')}" placeholder="z. B. Adobe Foto Abo" required></label>
        <label><span>Kosten</span><input name="cost" type="number" min="0" step="0.01" inputmode="decimal" value="${editingItem ? escapeHtml(subscriptionCost(editingItem)) : ''}" placeholder="12.90" required></label>
        <label><span>Zyklus</span><select name="cycle" required>${cycleOptions}</select></label>
        <label class="hf-subscription-cancel"><input name="isCancelled" type="checkbox" data-subscription-cancel-toggle ${editingCancelled ? 'checked' : ''}><span>Gekündigt</span></label>
        <label><span>Vertragsende</span><input name="contractEnd" type="date" value="${escapeHtml(editingContractEnd)}" ${editingCancelled ? 'required' : ''}></label>
        <label class="full"><span>Notiz</span><textarea name="note" rows="2" placeholder="optional">${escapeHtml(editingItem?.note || '')}</textarea></label>
        <div class="hf-list-form-actions full">
          <button class="pill primary" type="submit">${icon('plus')} ${editingItem ? 'Änderungen speichern' : 'Abo speichern'}</button>
          ${editingItem ? '<button class="pill secondary" type="button" data-action="cancel-subscription-edit">Abbrechen</button>' : ''}
        </div>
      </form>
      <div class="hf-list-items ${items.length ? '' : 'is-empty'}">
        ${items.length ? items.map(renderSubscriptionRow).join('') : '<p>Noch keine Abos vorhanden.</p>'}
      </div>
    `;
  }

  function renderSubscriptionForecast(items) {
    const entries = items
      .filter(item => !item.isDone)
      .map(item => ({ item, annualCost: subscriptionForecastCost(item) }))
      .filter(entry => entry.annualCost > 0)
      .sort((a, b) => b.annualCost - a.annualCost);
    const total = entries.reduce((sum, entry) => sum + entry.annualCost, 0);
    if (!entries.length) {
      return `
        <section class="hf-subscription-forecast is-empty">
          <div><p class="eyebrow">12-Monats-Prognose</p><h4>Noch keine Kosten berechenbar</h4></div>
          <p>Erfasse Kosten und Zyklus eines aktiven Abos, dann erscheint hier die Verteilung.</p>
        </section>
      `;
    }
    let offset = 0;
    const segments = entries.map((entry, index) => {
      const share = (entry.annualCost / total) * 100;
      const segment = `<circle class="hf-subscription-segment" cx="60" cy="60" r="48" pathLength="100" transform="rotate(-90 60 60)" style="--hf-segment-color:${SUBSCRIPTION_COLORS[index % SUBSCRIPTION_COLORS.length]};stroke-dasharray:${share.toFixed(4)} ${(100 - share).toFixed(4)};stroke-dashoffset:${(-offset).toFixed(4)}"></circle>`;
      offset += share;
      return segment;
    }).join('');
    const legend = entries.map((entry, index) => {
      const share = (entry.annualCost / total) * 100;
      const contractEnd = subscriptionContractEnd(entry.item);
      const status = subscriptionIsCancelled(entry.item)
        ? `Gekündigt${contractEnd ? ` · bis ${formatContractDate(contractEnd)}` : ''}`
        : subscriptionCycle(subscriptionCycleKey(entry.item)).label;
      return `
        <li style="--hf-segment-color:${SUBSCRIPTION_COLORS[index % SUBSCRIPTION_COLORS.length]}">
          <span class="hf-subscription-dot"></span>
          <div><strong>${escapeHtml(entry.item.title)}</strong><small>${escapeHtml(status)} · ${share.toFixed(1)}%</small></div>
          <b>${escapeHtml(formatCurrency(entry.annualCost))}</b>
        </li>
      `;
    }).join('');
    return `
      <section class="hf-subscription-forecast">
        <div class="hf-subscription-forecast-head"><div><p class="eyebrow">12-Monats-Prognose</p><h4>Erwartete Abo-Kosten</h4></div><span>${entries.length} aktive ${entries.length === 1 ? 'Position' : 'Positionen'}</span></div>
        <div class="hf-subscription-forecast-body">
          <div class="hf-subscription-donut-wrap">
            <svg class="hf-subscription-donut" viewBox="0 0 120 120" role="img" aria-label="Verteilung der erwarteten Abo-Kosten für zwölf Monate">
              <circle class="hf-subscription-track" cx="60" cy="60" r="48"></circle>
              ${segments}
            </svg>
            <div class="hf-subscription-total"><small>12 Monate</small><strong>${escapeHtml(formatCurrency(total))}</strong><span>erwartet</span></div>
          </div>
          <ul class="hf-subscription-legend">${legend}</ul>
        </div>
      </section>
    `;
  }

  function renderSubscriptionRow(item) {
    const cycle = subscriptionCycle(subscriptionCycleKey(item));
    const cost = subscriptionCost(item);
    const contractEnd = subscriptionContractEnd(item);
    const cancelled = subscriptionIsCancelled(item);
    const status = cancelled
      ? `Gekündigt${contractEnd ? ` · Vertragsende ${formatContractDate(contractEnd)}` : ''}`
      : contractEnd ? `Vertragsende ${formatContractDate(contractEnd)}` : '';
    return `
      <article class="hf-list-row hf-subscription-row ${item.isDone || subscriptionIsExpired(item) ? 'is-done' : ''}" data-subscription-id="${escapeHtml(item.id)}">
        <button class="hf-list-check" type="button" data-action="toggle-subscription" aria-label="Abo aktiv oder inaktiv setzen">${item.isDone ? icon('check') : ''}</button>
        <div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml([`${formatCurrency(cost)} · ${cycle.label}`, status, item.note].filter(Boolean).join(' · '))}</span></div>
        <button class="hf-list-icon-btn" type="button" data-action="edit-subscription" aria-label="Abo bearbeiten">${icon('edit')}</button>
        <button class="hf-list-icon-btn danger" type="button" data-action="delete-subscription" aria-label="Abo löschen">${icon('trash')}</button>
      </article>
    `;
  }

  function financeKind(item) {
    const value = String(item?.metadata?.financeKind || 'investment');
    return FINANCE_KINDS.some(kind => kind.value === value) ? value : 'investment';
  }

  function financeUnit(item) {
    const value = String(item?.metadata?.unit || 'chf');
    return FINANCE_UNITS.some(unit => unit.value === value) ? value : 'chf';
  }

  function financeUnitLabel(value) {
    return FINANCE_UNITS.find(unit => unit.value === value)?.label || 'CHF';
  }

  function financeAmount(item) {
    return parseSubscriptionCost(item?.metadata?.amount);
  }

  function financeTotal(item) {
    return parseSubscriptionCost(item?.metadata?.totalAmount);
  }

  function financeDirection(item) {
    return item?.metadata?.direction === 'payable' ? 'payable' : 'receivable';
  }

  function financeDate(item) {
    const value = String(item?.metadata?.dueDate || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
  }

  function formatFinanceValue(value, unit = 'chf') {
    if (unit === 'chf') return formatCurrency(value);
    return `${new Intl.NumberFormat('de-CH', { maximumFractionDigits: 2 }).format(Number(value) || 0)} ${financeUnitLabel(unit)}`;
  }

  function formatSignedCurrency(value) {
    const amount = Number(value) || 0;
    return `${amount > 0 ? '+' : ''}${formatCurrency(amount)}`;
  }

  function financeSummary(items) {
    const active = items.filter(item => !item.isDone);
    const investments = active.filter(item => financeKind(item) === 'investment' && financeUnit(item) === 'chf');
    const credits = active.filter(item => financeKind(item) === 'credit');
    const debts = active.filter(item => financeKind(item) === 'debt');
    const invested = investments.reduce((sum, item) => sum + financeAmount(item), 0);
    const basis = investments.reduce((sum, item) => sum + financeTotal(item), 0);
    const creditChf = credits.filter(item => financeUnit(item) === 'chf').reduce((sum, item) => sum + financeAmount(item), 0);
    const creditUnits = credits.filter(item => financeUnit(item) !== 'chf').length;
    const receivable = debts.filter(item => financeDirection(item) === 'receivable').reduce((sum, item) => sum + financeAmount(item), 0);
    const payable = debts.filter(item => financeDirection(item) === 'payable').reduce((sum, item) => sum + financeAmount(item), 0);
    return { active, investments, credits, debts, invested, basis, creditChf, creditUnits, receivable, payable, net: invested + creditChf + receivable - payable };
  }

  function renderFinanceDetail(list) {
    const items = itemsFor('finance');
    const summary = financeSummary(items);
    const editingItem = editingFinanceId ? items.find(item => item.id === editingFinanceId) : null;
    const editingKind = financeKind(editingItem);
    const editingUnit = financeUnit(editingItem);
    const kindOptions = FINANCE_KINDS.map(kind => `<option value="${kind.value}" ${kind.value === editingKind ? 'selected' : ''}>${kind.label}</option>`).join('');
    const unitOptions = FINANCE_UNITS.map(unit => `<option value="${unit.value}" ${unit.value === editingUnit ? 'selected' : ''}>${unit.label}</option>`).join('');
    return `
      <div class="panel-head">
        <div><p class="eyebrow">${escapeHtml(list.title)}</p><h3>Dein Finanzbild</h3></div>
        <span class="badge">${summary.active.length} aktiv</span>
      </div>
      ${renderFinanceOverview(summary)}
      <form class="hf-list-form hf-finance-form ${editingItem ? 'is-editing' : ''}" data-form="finance" data-editing-id="${escapeHtml(editingItem?.id || '')}">
        <label><span>Art</span><select name="kind" data-finance-kind required>${kindOptions}</select></label>
        <label><span>Bezeichnung</span><input name="title" value="${escapeHtml(editingItem?.title || '')}" placeholder="z. B. ETF Welt, Fitnessabo oder Darlehen" required></label>
        <label><span data-finance-amount-label>${editingKind === 'credit' ? 'Restguthaben' : editingKind === 'debt' ? 'Betrag' : 'Aktueller Wert'}</span><input name="amount" type="number" min="0" step="0.01" inputmode="decimal" value="${editingItem ? escapeHtml(financeAmount(editingItem)) : ''}" placeholder="0.00" required></label>
        <label data-finance-total-field ${editingKind === 'debt' ? 'hidden' : ''}><span data-finance-total-label>${editingKind === 'credit' ? 'Ursprüngliches Guthaben' : 'Einstand'}</span><input name="totalAmount" type="number" min="0" step="0.01" inputmode="decimal" value="${editingItem ? escapeHtml(financeTotal(editingItem) || '') : ''}" placeholder="optional"></label>
        <label data-finance-unit-field ${editingKind !== 'credit' ? 'hidden' : ''}><span>Einheit</span><select name="unit">${unitOptions}</select></label>
        <label data-finance-direction-field ${editingKind !== 'debt' ? 'hidden' : ''}><span>Richtung</span><select name="direction"><option value="receivable" ${financeDirection(editingItem) === 'receivable' ? 'selected' : ''}>Jemand schuldet mir</option><option value="payable" ${financeDirection(editingItem) === 'payable' ? 'selected' : ''}>Ich schulde jemandem</option></select></label>
        <label><span data-finance-party-label>${editingKind === 'investment' ? 'Depot / Anbieter' : editingKind === 'credit' ? 'Anbieter' : 'Gegenpartei'}</span><input name="counterparty" value="${escapeHtml(editingItem?.metadata?.counterparty || '')}" placeholder="optional"></label>
        <label><span data-finance-date-label>${editingKind === 'investment' ? 'Stand per' : editingKind === 'credit' ? 'Gültig bis' : 'Fällig am'}</span><input name="dueDate" type="date" value="${escapeHtml(financeDate(editingItem))}"></label>
        <label class="full"><span>Notiz</span><textarea name="note" rows="2" placeholder="Kontext, Konditionen oder nächster Schritt">${escapeHtml(editingItem?.note || '')}</textarea></label>
        <div class="hf-list-form-actions full">
          <button class="pill primary" type="submit">${icon('plus')} ${editingItem ? 'Änderungen speichern' : 'Position speichern'}</button>
          ${editingItem ? '<button class="pill secondary" type="button" data-action="cancel-finance-edit">Abbrechen</button>' : ''}
        </div>
      </form>
      <div class="hf-finance-groups ${items.length ? '' : 'is-empty'}">
        ${items.length ? FINANCE_KINDS.map(kind => renderFinanceGroup(kind, items.filter(item => financeKind(item) === kind.value))).join('') : '<p>Noch keine Finanzpositionen vorhanden.</p>'}
      </div>
    `;
  }

  function renderFinanceOverview(summary) {
    const result = summary.basis > 0 ? summary.invested - summary.basis : 0;
    const positiveParts = [
      { label: 'Investitionen', value: summary.invested },
      { label: 'Guthaben', value: summary.creditChf },
      { label: 'Forderungen', value: summary.receivable }
    ].filter(entry => entry.value > 0);
    const positiveTotal = positiveParts.reduce((sum, entry) => sum + entry.value, 0);
    let offset = 0;
    const segments = positiveParts.map((entry, index) => {
      const share = (entry.value / positiveTotal) * 100;
      const segment = `<circle class="hf-subscription-segment" cx="60" cy="60" r="48" pathLength="100" transform="rotate(-90 60 60)" style="--hf-segment-color:${FINANCE_COLORS[index]};stroke-dasharray:${share.toFixed(4)} ${(100 - share).toFixed(4)};stroke-dashoffset:${(-offset).toFixed(4)}"></circle>`;
      offset += share;
      return segment;
    }).join('');
    const legend = positiveParts.map((entry, index) => `<li style="--hf-segment-color:${FINANCE_COLORS[index]}"><span class="hf-subscription-dot"></span><div><strong>${escapeHtml(entry.label)}</strong><small>${positiveTotal ? ((entry.value / positiveTotal) * 100).toFixed(1) : '0.0'}% der positiven Werte</small></div><b>${escapeHtml(formatCurrency(entry.value))}</b></li>`).join('');
    return `
      <section class="hf-finance-overview">
        <div class="hf-finance-metrics">
          <div><small>Investiert</small><strong>${escapeHtml(formatCurrency(summary.invested))}</strong><span>${summary.investments.length} ${summary.investments.length === 1 ? 'Position' : 'Positionen'}</span></div>
          <div><small>Entwicklung</small><strong class="${result >= 0 ? 'is-positive' : 'is-negative'}">${summary.basis > 0 ? escapeHtml(formatSignedCurrency(result)) : '–'}</strong><span>${summary.basis > 0 ? 'gegenüber Einstand' : 'Einstand noch offen'}</span></div>
          <div><small>Guthaben</small><strong>${escapeHtml(formatCurrency(summary.creditChf))}</strong><span>${summary.creditUnits ? `plus ${summary.creditUnits} in Einheiten` : 'verfügbar'}</span></div>
          <div><small>Netto-Schulden</small><strong class="${summary.receivable - summary.payable >= 0 ? 'is-positive' : 'is-negative'}">${escapeHtml(formatSignedCurrency(summary.receivable - summary.payable))}</strong><span>${escapeHtml(`${formatCurrency(summary.receivable)} rein · ${formatCurrency(summary.payable)} raus`)}</span></div>
        </div>
        <div class="hf-finance-balance">
          <div class="hf-finance-balance-copy"><p class="eyebrow">Finanzkompass</p><h4>${positiveParts.length ? 'Deine Werte auf einen Blick' : 'Bereit für dein erstes Finanzbild'}</h4><p>${positiveParts.length ? `Netto-Position ${formatCurrency(summary.net)}. Verpflichtungen werden separat abgezogen.` : 'Erfasse eine Investition, ein Guthaben oder eine Schuld. Die Übersicht baut sich automatisch auf.'}</p></div>
          ${positiveParts.length ? `<div class="hf-finance-distribution"><div class="hf-subscription-donut-wrap"><svg class="hf-subscription-donut" viewBox="0 0 120 120" role="img" aria-label="Verteilung deiner positiven Finanzwerte"><circle class="hf-subscription-track" cx="60" cy="60" r="48"></circle>${segments}</svg><div class="hf-subscription-total"><small>Netto</small><strong>${escapeHtml(formatCurrency(summary.net))}</strong><span>Position</span></div></div><ul class="hf-subscription-legend">${legend}</ul></div>` : ''}
        </div>
      </section>
    `;
  }

  function renderFinanceGroup(kind, items) {
    if (!items.length) return '';
    const activeCount = items.filter(item => !item.isDone).length;
    return `
      <section class="hf-finance-group" data-finance-group="${kind.value}">
        <div class="hf-finance-group-head"><div class="hf-finance-group-icon">${icon(kind.value === 'investment' ? 'trend' : kind.value === 'credit' ? 'credit' : 'debt')}</div><div><small>${escapeHtml(kind.label)}</small><h4>${kind.value === 'investment' ? 'Vermögen aufbauen' : kind.value === 'credit' ? 'Verfügbare Guthaben' : 'Offene Beziehungen'}</h4></div><span>${activeCount} aktiv</span></div>
        <div class="hf-list-items">${items.map(renderFinanceRow).join('')}</div>
      </section>
    `;
  }

  function renderFinanceRow(item) {
    const kind = financeKind(item);
    const unit = financeUnit(item);
    const amount = financeAmount(item);
    const total = financeTotal(item);
    const date = financeDate(item);
    const party = String(item.metadata?.counterparty || '').trim();
    const direction = financeDirection(item);
    const details = [];
    if (kind === 'investment' && total > 0) details.push(`${formatSignedCurrency(amount - total)} seit Einstand`);
    if (kind === 'credit' && total > 0) details.push(`${Math.min(100, (amount / total) * 100).toFixed(0)}% verfügbar`);
    if (kind === 'debt') details.push(direction === 'receivable' ? 'Du erhältst' : 'Du schuldest');
    if (party) details.push(party);
    if (date) details.push(`${kind === 'investment' ? 'Stand' : kind === 'credit' ? 'gültig bis' : 'fällig'} ${formatContractDate(date)}`);
    if (item.note) details.push(item.note);
    const progress = kind === 'credit' && total > 0 ? Math.min(100, Math.max(0, (amount / total) * 100)) : 0;
    return `
      <article class="hf-list-row hf-finance-row ${item.isDone ? 'is-done' : ''}" data-finance-id="${escapeHtml(item.id)}">
        <button class="hf-list-check" type="button" data-action="toggle-finance" aria-label="Position ${item.isDone ? 'reaktivieren' : 'abschliessen'}">${item.isDone ? icon('check') : ''}</button>
        <div class="hf-finance-row-copy"><small>${escapeHtml(FINANCE_KINDS.find(entry => entry.value === kind)?.label || '')}</small><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(details.join(' · '))}</span>${progress ? `<i><b style="width:${progress.toFixed(2)}%"></b></i>` : ''}</div>
        <b class="hf-finance-row-value ${kind === 'debt' && direction === 'payable' ? 'is-negative' : ''}">${escapeHtml(formatFinanceValue(amount, unit))}</b>
        <div class="hf-finance-row-actions"><button class="hf-list-icon-btn" type="button" data-action="edit-finance" aria-label="Position bearbeiten">${icon('edit')}</button><button class="hf-list-icon-btn danger" type="button" data-action="delete-finance" aria-label="Position löschen">${icon('trash')}</button></div>
      </article>
    `;
  }

  function updateFinanceFormFields(form) {
    if (!form) return;
    const kind = String(form.elements?.kind?.value || 'investment');
    const setText = (selector, value) => { const node = form.querySelector(selector); if (node) node.textContent = value; };
    const totalField = form.querySelector('[data-finance-total-field]');
    const unitField = form.querySelector('[data-finance-unit-field]');
    const directionField = form.querySelector('[data-finance-direction-field]');
    if (totalField) totalField.hidden = kind === 'debt';
    if (unitField) unitField.hidden = kind !== 'credit';
    if (directionField) directionField.hidden = kind !== 'debt';
    setText('[data-finance-amount-label]', kind === 'credit' ? 'Restguthaben' : kind === 'debt' ? 'Betrag' : 'Aktueller Wert');
    setText('[data-finance-total-label]', kind === 'credit' ? 'Ursprüngliches Guthaben' : 'Einstand');
    setText('[data-finance-party-label]', kind === 'investment' ? 'Depot / Anbieter' : kind === 'credit' ? 'Anbieter' : 'Gegenpartei');
    setText('[data-finance-date-label]', kind === 'investment' ? 'Stand per' : kind === 'credit' ? 'Gültig bis' : 'Fällig am');
  }

  function termCategory(item) {
    return itemCategory(item);
  }

  function termCategories() {
    return Array.from(new Set(itemsFor('terms').map(termCategory))).sort((a, b) => a.localeCompare(b, 'de'));
  }

  function termsInCategory(category) {
    return itemsFor('terms').filter(item => termCategory(item) === category);
  }

  function shuffledTermIds(category) {
    const source = termsInCategory(category).map(term => term.id);
    const shuffled = source.slice();
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    if (shuffled.length > 1 && shuffled.every((id, index) => id === source[index])) {
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    }
    return shuffled;
  }

  function termStudyTerms() {
    const terms = termsInCategory(termStudyCategory);
    const byId = new Map(terms.map(term => [term.id, term]));
    if (!termStudyOrder.length) termStudyOrder = shuffledTermIds(termStudyCategory);
    const ordered = termStudyOrder.map(id => byId.get(id)).filter(Boolean);
    terms.forEach(term => {
      if (!termStudyOrder.includes(term.id)) {
        termStudyOrder.push(term.id);
        ordered.push(term);
      }
    });
    return ordered;
  }

  function renderTermsDetail(list) {
    const terms = itemsFor('terms');
    const categories = termCategories();
    categories.forEach(category => {
      if (initializedTermCategories.has(category)) return;
      initializedTermCategories.add(category);
      collapsedTermCategories.add(category);
    });
    const editingTerm = editingTermId ? terms.find(term => term.id === editingTermId) : null;
    const categoryOptions = categories.map(category => `<option value="${escapeHtml(category)}"></option>`).join('');
    return `
      <div class="panel-head">
        <div><p class="eyebrow">${escapeHtml(list.title)}</p><h3>Begriffe sammeln & lernen</h3></div>
        <span class="badge">${terms.length} Begriffe</span>
      </div>
      <form class="hf-list-form hf-term-form ${editingTerm ? 'is-editing' : ''}" data-form="term" data-editing-id="${escapeHtml(editingTerm?.id || '')}">
        <label><span>Begriff</span><input name="title" value="${escapeHtml(editingTerm?.title || '')}" placeholder="z. B. Opportunitätskosten" required></label>
        <label><span>Kategorie</span><input name="category" list="hfTermCategories" value="${escapeHtml(editingTerm ? termCategory(editingTerm) : '')}" placeholder="Auswählen oder neu eingeben" required><datalist id="hfTermCategories">${categoryOptions}</datalist></label>
        <label class="full"><span>Erklärung</span><textarea name="explanation" rows="4" placeholder="Was bedeutet der Begriff?" required>${escapeHtml(editingTerm?.note || '')}</textarea></label>
        <div class="hf-list-form-actions full">
          <button class="pill primary" type="submit">${icon('plus')} ${editingTerm ? 'Änderungen speichern' : 'Begriff speichern'}</button>
          ${editingTerm ? '<button class="pill secondary" type="button" data-action="cancel-term-edit">Abbrechen</button>' : ''}
        </div>
      </form>
      <div class="hf-term-categories ${categories.length ? '' : 'is-empty'}">
        ${categories.length ? categories.map(renderTermCategory).join('') : '<p>Noch keine Begriffe vorhanden.</p>'}
      </div>
    `;
  }

  function renderTermCategory(category) {
    const terms = termsInCategory(category);
    const isCollapsed = collapsedTermCategories.has(category);
    return `
      <section class="hf-term-category ${isCollapsed ? 'is-collapsed' : ''}">
        <div class="hf-term-category-head">
          <div><small>Kategorie</small><h4>${escapeHtml(category)}</h4><span>${terms.length} ${terms.length === 1 ? 'Begriff' : 'Begriffe'}</span></div>
          <div class="hf-term-category-head-actions">
            <button class="pill secondary" type="button" data-action="start-term-study" data-category="${escapeHtml(category)}">${icon('book')} Lernmodus</button>
            <button class="hf-list-icon-btn hf-term-collapse" type="button" data-action="toggle-term-category" data-category="${escapeHtml(category)}" aria-expanded="${String(!isCollapsed)}" aria-label="Kategorie ${escapeHtml(category)} ${isCollapsed ? 'aufklappen' : 'zuklappen'}" title="Kategorie ${isCollapsed ? 'aufklappen' : 'zuklappen'}">${icon('chevronRight')}</button>
          </div>
        </div>
        <div class="hf-term-list">${terms.map(renderTermRow).join('')}</div>
      </section>
    `;
  }

  function renderTermRow(term) {
    return `
      <article class="hf-term-row" data-term-id="${escapeHtml(term.id)}">
        <div class="hf-term-copy"><strong>${escapeHtml(term.title)}</strong><span>${escapeHtml(term.note || 'Keine Erklärung hinterlegt.')}</span></div>
        <div class="hf-term-actions">
          <button class="hf-list-icon-btn" type="button" data-action="edit-term" aria-label="Begriff bearbeiten">${icon('edit')}</button>
          <button class="hf-list-icon-btn danger" type="button" data-action="delete-term" aria-label="Begriff löschen">${icon('trash')}</button>
        </div>
      </article>
    `;
  }

  function renderTermStudyModal() {
    if (!termStudyCategory) return '';
    const terms = termStudyTerms();
    if (!terms.length) {
      termStudyCategory = '';
      termStudyIndex = 0;
      termStudyOrder = [];
      document.body.classList.remove('hf-term-study-open');
      return '';
    }
    termStudyIndex = Math.min(Math.max(0, termStudyIndex), terms.length - 1);
    const term = terms[termStudyIndex];
    return `
      <div class="hf-term-study-modal" role="dialog" aria-modal="true" aria-label="Lernmodus ${escapeHtml(termStudyCategory)}">
        <section class="hf-term-study-shell">
          <header class="hf-term-study-head">
            <div><small>Lernmodus</small><span class="hf-term-study-category-tag">${escapeHtml(termStudyCategory)}</span></div>
            <button class="hf-list-icon-btn" type="button" data-action="close-term-study" aria-label="Lernmodus schliessen">${icon('close')}</button>
          </header>
          <button class="hf-term-flip-card" type="button" data-action="flip-term-card" aria-label="Lernkarte umdrehen" aria-pressed="false">
            <span class="hf-term-flip-inner">
              <span class="hf-term-face hf-term-front"><small>Begriff</small><strong>${escapeHtml(term.title)}</strong><em>Antippen für die Erklärung</em></span>
              <span class="hf-term-face hf-term-back"><small>Erklärung</small><strong>${escapeHtml(term.title)}</strong><p>${escapeHtml(term.note || 'Keine Erklärung hinterlegt.')}</p></span>
            </span>
          </button>
          <footer class="hf-term-study-controls">
            <button class="hf-list-icon-btn" type="button" data-action="previous-term-card" aria-label="Vorheriger Begriff" ${termStudyIndex === 0 ? 'disabled' : ''}>${icon('chevronLeft')}</button>
            <strong>${termStudyIndex + 1} / ${terms.length}</strong>
            <button class="hf-list-icon-btn" type="button" data-action="next-term-card" aria-label="Nächster Begriff" ${termStudyIndex === terms.length - 1 ? 'disabled' : ''}>${icon('chevronRight')}</button>
          </footer>
        </section>
      </div>
    `;
  }

  function renderTermStudyPortal() {
    let portal = document.getElementById('hfTermStudyPortal');
    if (!termStudyCategory) {
      portal?.remove();
      return;
    }
    if (!portal) {
      portal = document.createElement('div');
      portal.id = 'hfTermStudyPortal';
      document.body.appendChild(portal);
    }
    const markup = renderTermStudyModal();
    if (!markup) {
      portal.remove();
      return;
    }
    portal.innerHTML = markup;
  }

  function renderPhotosDetail(list) {
    const tours = state.tours.filter(tour => !tour.isArchived).sort((a, b) => (a.sortRank || 0) - (b.sortRank || 0));
    const activeTours = tours.length ? tours : [{ id: 'demo-tour', title: 'Valais Route', region: 'Valais', demo: true }];
    const editingTour = editingTourId ? state.tours.find(tour => tour.id === editingTourId && !tour.isArchived) : null;
    const editingSpot = editingSpotId ? state.stops.find(stop => stop.id === editingSpotId && !stop.isArchived) : null;
    const tourOptions = tours.map(tour => `<option value="${escapeHtml(tour.id)}" ${tour.id === editingSpot?.tourId ? 'selected' : ''}>${escapeHtml(tour.title)}</option>`).join('');
    const spotImageHint = editingSpot?.imageUrl
      ? 'Optional · neues Bild ersetzt den vorhandenen Anhang.'
      : 'Optional · wird vor dem Speichern komprimiert.';
    return `
      <div class="panel-head">
        <div><p class="eyebrow">${escapeHtml(list.title)}</p><h3>Fotospots & Touren</h3></div>
        <span class="badge">${state.stops.filter(stop => !stop.isArchived).length} Spots</span>
      </div>
      <div class="hf-photo-grid">
        <form class="hf-list-form ${editingTour ? 'is-editing' : ''}" data-form="tour" data-editing-id="${escapeHtml(editingTour?.id || '')}">
          <label class="full"><span>Tour</span><input name="title" value="${escapeHtml(editingTour?.title || '')}" placeholder="z. B. Valais Winterroute" required></label>
          <label class="full"><span>Region</span><input name="region" value="${escapeHtml(editingTour?.region || '')}" placeholder="z. B. Valais"></label>
          <label class="full"><span>Notiz</span><input name="note" value="${escapeHtml(editingTour?.note || '')}" placeholder="optional"></label>
          <div class="hf-list-form-actions full">
            <button class="pill primary" type="submit">${icon('route')} ${editingTour ? 'Änderungen speichern' : 'Tour erstellen'}</button>
            ${editingTour ? '<button class="pill secondary" type="button" data-action="cancel-tour-edit">Abbrechen</button>' : ''}
          </div>
        </form>
        <form class="hf-list-form ${editingSpot ? 'is-editing' : ''}" data-form="spot" data-editing-id="${escapeHtml(editingSpot?.id || '')}">
          <label class="full"><span>Fotospot</span><input name="title" value="${escapeHtml(editingSpot?.title || '')}" placeholder="z. B. Gornergrat" required></label>
          <label><span>Tour</span><select name="tourId" ${tourOptions ? '' : 'disabled'}>${tourOptions || '<option>Erst Tour erstellen</option>'}</select></label>
          <label class="full hf-photo-upload"><span>Bildanhang</span><input name="image" type="file" accept="image/*"><small>${spotImageHint}</small></label>
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
        editingTourId = '';
        editingTermId = '';
        editingShoppingId = '';
        editingSubscriptionId = '';
        editingFinanceId = '';
        editingChatgptId = '';
        termStudyCategory = '';
        termStudyIndex = 0;
        termStudyOrder = [];
        document.body.classList.remove('hf-term-study-open');
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
      if (action === 'cancel-tour-edit') {
        editingTourId = '';
        render();
        return;
      }
      if (action === 'cancel-term-edit') {
        editingTermId = '';
        render();
        return;
      }
      if (action === 'cancel-shopping-edit') {
        editingShoppingId = '';
        render();
        return;
      }
      if (action === 'cancel-subscription-edit') {
        editingSubscriptionId = '';
        render();
        return;
      }
      if (action === 'cancel-finance-edit') {
        editingFinanceId = '';
        render();
        return;
      }
      if (action === 'cancel-chatgpt-edit') {
        editingChatgptId = '';
        render();
        return;
      }
      if (action === 'toggle-term-category') {
        const category = String(event.target.closest('[data-category]')?.dataset.category || '');
        if (!category) return;
        if (collapsedTermCategories.has(category)) collapsedTermCategories.delete(category);
        else collapsedTermCategories.add(category);
        render();
        return;
      }
      if (action === 'start-term-study') {
        termStudyCategory = String(event.target.closest('[data-category]')?.dataset.category || '');
        termStudyIndex = 0;
        termStudyOrder = shuffledTermIds(termStudyCategory);
        document.body.classList.add('hf-term-study-open');
        render();
        return;
      }
      if (action === 'toggle-shopping-category') {
        const category = String(event.target.closest('[data-category]')?.dataset.category || '');
        if (!category) return;
        if (collapsedShoppingCategories.has(category)) collapsedShoppingCategories.delete(category);
        else collapsedShoppingCategories.add(category);
        render();
        return;
      }
      if (action === 'toggle-chatgpt-project') {
        const project = String(event.target.closest('[data-project]')?.dataset.project || '');
        if (!project) return;
        if (collapsedChatgptProjects.has(project)) collapsedChatgptProjects.delete(project);
        else collapsedChatgptProjects.add(project);
        render();
        return;
      }
      if (action === 'close-term-study') {
        closeTermStudy();
        return;
      }
      if (action === 'flip-term-card') {
        const card = event.target.closest('.hf-term-flip-card');
        card?.classList.toggle('is-flipped');
        card?.setAttribute('aria-pressed', String(card.classList.contains('is-flipped')));
        return;
      }
      if (action === 'previous-term-card' || action === 'next-term-card') {
        const direction = action === 'next-term-card' ? 1 : -1;
        const terms = termStudyTerms();
        termStudyIndex = Math.min(Math.max(0, termStudyIndex + direction), Math.max(0, terms.length - 1));
        render();
        return;
      }

      const chatgptRow = event.target.closest('[data-chatgpt-id]');
      if (chatgptRow && ['edit-chatgpt', 'delete-chatgpt'].includes(action)) {
        handleChatgptAction(action, chatgptRow.dataset.chatgptId);
        return;
      }

      const termRow = event.target.closest('[data-term-id]');
      if (termRow && (action === 'edit-term' || action === 'delete-term')) {
        handleTermAction(action, termRow.dataset.termId);
        return;
      }

      const shoppingRow = event.target.closest('[data-shopping-id]');
      if (shoppingRow && ['toggle-shopping', 'edit-shopping', 'delete-shopping'].includes(action)) {
        handleShoppingAction(action, shoppingRow.dataset.shoppingId);
        return;
      }

      const subscriptionRow = event.target.closest('[data-subscription-id]');
      if (subscriptionRow && ['toggle-subscription', 'edit-subscription', 'delete-subscription'].includes(action)) {
        handleSubscriptionAction(action, subscriptionRow.dataset.subscriptionId);
        return;
      }

      const financeRow = event.target.closest('[data-finance-id]');
      if (financeRow && ['toggle-finance', 'edit-finance', 'delete-finance'].includes(action)) {
        handleFinanceAction(action, financeRow.dataset.financeId);
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
      if (form.dataset.form === 'term') saveTerm(form);
      if (form.dataset.form === 'shopping') saveShopping(form);
      if (form.dataset.form === 'subscription') saveSubscription(form);
      if (form.dataset.form === 'finance') saveFinance(form);
      if (form.dataset.form === 'chatgpt') saveChatgpt(form);
      if (form.dataset.form === 'tour') saveTour(form);
      if (form.dataset.form === 'spot') void saveSpot(form);
    });

    document.addEventListener('change', event => {
      const financeKindSelect = event.target.closest('#screen-lists [data-finance-kind]');
      if (financeKindSelect) {
        updateFinanceFormFields(financeKindSelect.closest('form[data-form="finance"]'));
        return;
      }
      const toggle = event.target.closest('#screen-lists [data-subscription-cancel-toggle]');
      if (toggle) {
        const form = toggle.closest('form[data-form="subscription"]');
        const contractEnd = form?.elements?.contractEnd;
        if (!contractEnd) return;
        contractEnd.required = toggle.checked;
        if (toggle.checked && !contractEnd.value) contractEnd.focus({ preventScroll: true });
      }
    });

    document.addEventListener('keydown', event => {
      if (!termStudyCategory) return;
      if (event.key === 'Escape') {
        closeTermStudy();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const terms = termStudyTerms();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        termStudyIndex = Math.min(Math.max(0, termStudyIndex + direction), Math.max(0, terms.length - 1));
        render();
      }
    });
  }

  function closeTermStudy() {
    termStudyCategory = '';
    termStudyIndex = 0;
    termStudyOrder = [];
    document.body.classList.remove('hf-term-study-open');
    render();
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

  function handleTermAction(action, id) {
    const term = state.items.find(item => item.id === id && item.listId === 'terms' && !item.isArchived);
    if (!term) return;
    if (action === 'edit-term') {
      editingTermId = id;
      render();
      window.requestAnimationFrame(() => {
        const form = document.querySelector('#screen-lists form[data-form="term"]');
        form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const titleInput = form?.elements?.title;
        titleInput?.focus({ preventScroll: true });
        titleInput?.select();
      });
      return;
    }
    if (action === 'delete-term') {
      term.isArchived = true;
      term.updatedAt = new Date().toISOString();
      if (editingTermId === id) editingTermId = '';
      if (termStudyCategory && !termsInCategory(termStudyCategory).length) {
        termStudyCategory = '';
        termStudyIndex = 0;
        termStudyOrder = [];
        document.body.classList.remove('hf-term-study-open');
      }
      saveAndSync();
    }
  }

  function focusListForm(formName) {
    window.requestAnimationFrame(() => {
      const form = document.querySelector(`#screen-lists form[data-form="${formName}"]`);
      form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const titleInput = form?.elements?.title;
      titleInput?.focus({ preventScroll: true });
      titleInput?.select();
    });
  }

  function handleShoppingAction(action, id) {
    const item = state.items.find(entry => entry.id === id && entry.listId === 'shopping' && !entry.isArchived);
    if (!item) return;
    if (action === 'edit-shopping') {
      editingShoppingId = id;
      render();
      focusListForm('shopping');
      return;
    }
    if (action === 'toggle-shopping') item.isDone = !item.isDone;
    if (action === 'delete-shopping') {
      item.isArchived = true;
      if (editingShoppingId === id) editingShoppingId = '';
    }
    item.updatedAt = new Date().toISOString();
    saveAndSync();
  }


  function handleChatgptAction(action, id) {
    const item = state.items.find(entry => entry.id === id && entry.listId === 'chatgpt' && !entry.isArchived);
    if (!item) return;
    if (action === 'edit-chatgpt') {
      editingChatgptId = id;
      render();
      focusListForm('chatgpt');
      return;
    }
    if (action === 'delete-chatgpt') {
      item.isArchived = true;
      item.updatedAt = new Date().toISOString();
      if (editingChatgptId === id) editingChatgptId = '';
      saveAndSync();
    }
  }

  function handleSubscriptionAction(action, id) {
    const item = state.items.find(entry => entry.id === id && entry.listId === 'subscriptions' && !entry.isArchived);
    if (!item) return;
    if (action === 'edit-subscription') {
      editingSubscriptionId = id;
      render();
      focusListForm('subscription');
      return;
    }
    if (action === 'toggle-subscription') item.isDone = !item.isDone;
    if (action === 'delete-subscription') {
      item.isArchived = true;
      if (editingSubscriptionId === id) editingSubscriptionId = '';
    }
    item.updatedAt = new Date().toISOString();
    saveAndSync();
  }

  function handleFinanceAction(action, id) {
    const item = state.items.find(entry => entry.id === id && entry.listId === 'finance' && !entry.isArchived);
    if (!item) return;
    if (action === 'edit-finance') {
      editingFinanceId = id;
      render();
      focusListForm('finance');
      return;
    }
    if (action === 'toggle-finance') item.isDone = !item.isDone;
    if (action === 'delete-finance') {
      item.isArchived = true;
      if (editingFinanceId === id) editingFinanceId = '';
    }
    item.updatedAt = new Date().toISOString();
    saveAndSync();
  }

  function handleTourAction(action, id) {
    const tour = state.tours.find(entry => entry.id === id);
    if (!tour) return;
    if (action === 'edit-tour') {
      editingTourId = id;
      editingSpotId = '';
      render();
      window.requestAnimationFrame(() => {
        const form = document.querySelector('#screen-lists form[data-form="tour"]');
        form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const titleInput = form?.elements?.title;
        titleInput?.focus({ preventScroll: true });
        titleInput?.select();
      });
      return;
    }
    if (action === 'delete-tour') {
      tour.isArchived = true;
      state.stops.filter(stop => stop.tourId === id).forEach(stop => { stop.isArchived = true; });
      if (editingTourId === id) editingTourId = '';
    }
    tour.updatedAt = new Date().toISOString();
    saveAndSync();
  }

  function handleSpotOpen(id) {
    const stop = state.stops.find(entry => entry.id === id);
    if (!stop) return;
    editingSpotId = id;
    editingTourId = '';
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

  function saveTerm(form) {
    const data = new FormData(form);
    const existingTermId = String(form.dataset.editingId || '').trim();
    const existingTerm = existingTermId ? state.items.find(item => item.id === existingTermId && item.listId === 'terms' && !item.isArchived) : null;
    const title = String(data.get('title') || '').trim();
    const category = String(data.get('category') || '').trim();
    const explanation = String(data.get('explanation') || '').trim();
    if (!title || !category || !explanation) return;
    const now = new Date().toISOString();
    if (existingTerm) {
      Object.assign(existingTerm, {
        title,
        note: explanation,
        metadata: { ...(existingTerm.metadata || {}), category },
        updatedAt: now
      });
    } else {
      state.items.push({
        id: uid('term'),
        listId: 'terms',
        title,
        note: explanation,
        metadata: { category },
        isDone: false,
        isArchived: false,
        sortRank: Date.now(),
        createdAt: now,
        updatedAt: now
      });
    }
    if (!existingTermId || editingTermId === existingTermId) editingTermId = '';
    form.reset();
    saveAndSync();
  }

  function saveShopping(form) {
    const data = new FormData(form);
    const existingId = String(form.dataset.editingId || '').trim();
    const existingItem = existingId ? state.items.find(item => item.id === existingId && item.listId === 'shopping' && !item.isArchived) : null;
    const title = String(data.get('title') || '').trim();
    const category = String(data.get('category') || '').trim();
    if (!title || !category) return;
    const amount = String(data.get('amount') || '').trim();
    const store = String(data.get('store') || '').trim();
    const note = String(data.get('note') || '').trim();
    const now = new Date().toISOString();
    if (existingItem) {
      Object.assign(existingItem, {
        title,
        note,
        metadata: { ...(existingItem.metadata || {}), category, amount, store, metaA: amount, metaB: store },
        updatedAt: now
      });
    } else {
      state.items.push({
        id: uid('shopping-item'),
        listId: 'shopping',
        title,
        note,
        metadata: { category, amount, store, metaA: amount, metaB: store },
        isDone: false,
        isArchived: false,
        sortRank: Date.now(),
        createdAt: now,
        updatedAt: now
      });
    }
    editingShoppingId = '';
    form.reset();
    saveAndSync();
  }


  function saveChatgpt(form) {
    const data = new FormData(form);
    const existingId = String(form.dataset.editingId || '').trim();
    const existingItem = existingId ? state.items.find(item => item.id === existingId && item.listId === 'chatgpt' && !item.isArchived) : null;
    const title = String(data.get('title') || '').trim();
    const project = String(data.get('project') || '').trim();
    const url = normalizedExternalUrl(data.get('url'));
    const errorElement = form.querySelector('[data-chatgpt-error]');
    if (!title || !project || !url) {
      if (errorElement) {
        errorElement.textContent = 'Bitte Titel, Projekt und einen gültigen http/https-Link angeben.';
        errorElement.hidden = false;
      }
      return;
    }
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.hidden = true;
    }
    const note = String(data.get('note') || '').trim();
    const now = new Date().toISOString();
    const metadata = { ...(existingItem?.metadata || {}), project, category: project, url };
    if (existingItem) {
      Object.assign(existingItem, { title, note, metadata, updatedAt: now });
    } else {
      state.items.push({
        id: uid('chatgpt-thread'),
        listId: 'chatgpt',
        title,
        note,
        metadata,
        isDone: false,
        isArchived: false,
        sortRank: Date.now(),
        createdAt: now,
        updatedAt: now
      });
    }
    editingChatgptId = '';
    form.reset();
    saveAndSync();
  }

  function saveSubscription(form) {
    const data = new FormData(form);
    const existingId = String(form.dataset.editingId || '').trim();
    const existingItem = existingId ? state.items.find(item => item.id === existingId && item.listId === 'subscriptions' && !item.isArchived) : null;
    const title = String(data.get('title') || '').trim();
    const cost = parseSubscriptionCost(data.get('cost'));
    const cycleKey = String(data.get('cycle') || '').trim();
    const cycle = subscriptionCycle(cycleKey);
    const isCancelled = data.get('isCancelled') === 'on';
    const contractEnd = String(data.get('contractEnd') || '').trim();
    if (!title || !SUBSCRIPTION_CYCLES.some(entry => entry.value === cycleKey) || !Number.isFinite(cost) || (isCancelled && !contractEnd)) return;
    const note = String(data.get('note') || '').trim();
    const now = new Date().toISOString();
    const metadata = { ...(existingItem?.metadata || {}), cost, cycle: cycleKey, isCancelled, contractEnd, metaA: cost, metaB: cycle.label };
    if (existingItem) {
      Object.assign(existingItem, { title, note, metadata, updatedAt: now });
    } else {
      state.items.push({
        id: uid('subscription'),
        listId: 'subscriptions',
        title,
        note,
        metadata,
        isDone: false,
        isArchived: false,
        sortRank: Date.now(),
        createdAt: now,
        updatedAt: now
      });
    }
    editingSubscriptionId = '';
    form.reset();
    saveAndSync();
  }

  function saveFinance(form) {
    const data = new FormData(form);
    const existingId = String(form.dataset.editingId || '').trim();
    const existingItem = existingId ? state.items.find(item => item.id === existingId && item.listId === 'finance' && !item.isArchived) : null;
    const title = String(data.get('title') || '').trim();
    const kind = String(data.get('kind') || '').trim();
    const amount = parseSubscriptionCost(data.get('amount'));
    if (!title || !FINANCE_KINDS.some(entry => entry.value === kind) || !Number.isFinite(amount)) return;
    const totalAmount = kind === 'debt' ? 0 : parseSubscriptionCost(data.get('totalAmount'));
    const unit = kind === 'credit' && FINANCE_UNITS.some(entry => entry.value === data.get('unit')) ? String(data.get('unit')) : 'chf';
    const direction = kind === 'debt' && data.get('direction') === 'payable' ? 'payable' : 'receivable';
    const counterparty = String(data.get('counterparty') || '').trim();
    const dueDate = String(data.get('dueDate') || '').trim();
    const note = String(data.get('note') || '').trim();
    const now = new Date().toISOString();
    const metadata = { ...(existingItem?.metadata || {}), financeKind: kind, amount, totalAmount, unit, direction, counterparty, dueDate };
    if (existingItem) {
      Object.assign(existingItem, { title, note, metadata, updatedAt: now });
    } else {
      state.items.push({
        id: uid('finance-item'),
        listId: 'finance',
        title,
        note,
        metadata,
        isDone: false,
        isArchived: false,
        sortRank: Date.now(),
        createdAt: now,
        updatedAt: now
      });
    }
    editingFinanceId = '';
    form.reset();
    saveAndSync();
  }

  function saveTour(form) {
    const data = new FormData(form);
    const existingTourId = String(form.dataset.editingId || '').trim();
    const existingTour = existingTourId ? state.tours.find(tour => tour.id === existingTourId && !tour.isArchived) : null;
    const title = String(data.get('title') || '').trim();
    if (!title) return;
    const now = new Date().toISOString();
    const region = String(data.get('region') || '').trim();
    const note = String(data.get('note') || '').trim();
    if (existingTour) {
      Object.assign(existingTour, { title, region, note, updatedAt: now });
    } else {
      state.tours.push({
        id: uid('photo-tour'),
        title,
        region,
        note,
        coverUrl: '',
        sortRank: Date.now(),
        isArchived: false,
        createdAt: now,
        updatedAt: now
      });
    }
    if (!existingTourId || editingTourId === existingTourId) editingTourId = '';
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
