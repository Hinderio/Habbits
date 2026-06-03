(function registerHabitFlowLearningVault(window, document) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('learning-vault')) return;

  const STORAGE_KEY = 'habitflow-learning-vault-v1';
  const UI_KEY = 'habitflow-learning-vault-open-v1';
  const EXPANDED_KEY = 'habitflow-learning-vault-expanded-v1';
  const EDITING_KEY = 'habitflow-learning-vault-editing-v1';
  const TABLE_NAME = 'learning_vault';
  const MAX_ITEMS = 120;
  const MAX_CACHE_ITEMS = 180;
  const REMOTE_SELECT = 'id,user_id,title,body,context,tags,is_archived,created_at,updated_at';

  let supabaseClient = null;
  let authSubscription = null;
  let remoteSupported = true;
  let syncInFlight = false;
  let syncTimer = null;

  function uid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `learning-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function validIsoOrFallback(value, fallback = nowIso()) {
    const date = new Date(value || fallback);
    return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
  }

  function escapeHtml(value = '') {
    return String(value || '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  function normalizeTags(value = '') {
    return (Array.isArray(value) ? value.join(',') : String(value || ''))
      .split(/[#,]/)
      .map(tag => tag.trim().replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, 5);
  }

  function titleFromBody(body = '') {
    const firstSentence = String(body || '').split(/[.!?\n]/).find(Boolean)?.trim() || body;
    return String(firstSentence || 'Learning').slice(0, 72);
  }

  function normalizeItem(item = {}) {
    const body = String(item.body || '').trim().slice(0, 420);
    if (!body) return null;
    const createdAt = validIsoOrFallback(item.created_at || item.createdAt || nowIso());
    return {
      id: String(item.id || uid()),
      title: String(item.title || titleFromBody(body)).trim().slice(0, 120),
      body,
      context: String(item.context || '').trim().slice(0, 80),
      tags: normalizeTags(item.tags),
      is_archived: Boolean(item.is_archived || item.isArchived),
      created_at: createdAt,
      updated_at: validIsoOrFallback(item.updated_at || item.updatedAt || createdAt, createdAt),
      synced: item.synced === true
    };
  }

  function sortByUpdated(items = []) {
    return [...items].sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
  }

  function readCache() {
    try {
      const parsed = JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeItem).filter(Boolean);
    } catch (error) {
      console.warn('[HabitFlow/learning-vault] Learnings konnten nicht gelesen werden.', error);
      return [];
    }
  }

  function visibleItems() {
    return sortByUpdated(readCache().filter(item => !item.is_archived));
  }

  function pruneCache(items = []) {
    const byId = new Map();
    sortByUpdated(items.map(normalizeItem).filter(Boolean)).forEach(item => {
      if (!byId.has(item.id)) byId.set(item.id, item);
    });
    return Array.from(byId.values()).slice(0, MAX_CACHE_ITEMS);
  }

  function writeCache(items) {
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(pruneCache(items)));
      return true;
    } catch (error) {
      console.warn('[HabitFlow/learning-vault] Learnings konnten nicht gespeichert werden.', error);
      return false;
    }
  }

  function dateLabel(value) {
    const date = new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return 'gerade eben';
    return new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(date);
  }

  function readExpandedId() {
    return window.localStorage?.getItem(EXPANDED_KEY) || '';
  }

  function setExpandedId(id = '') {
    if (id) window.localStorage?.setItem(EXPANDED_KEY, id);
    else window.localStorage?.removeItem(EXPANDED_KEY);
  }

  function readEditingId() {
    return window.localStorage?.getItem(EDITING_KEY) || '';
  }

  function setEditingId(id = '') {
    if (id) window.localStorage?.setItem(EDITING_KEY, id);
    else window.localStorage?.removeItem(EDITING_KEY);
  }

  function previewText(value = '', maxLength = 132) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trim()}…`;
  }

  function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;
    const config = window.HABITFLOW_SUPABASE_CONFIG || {};
    if (!config.url || !config.anonKey || !window.supabase?.createClient) return null;
    supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return supabaseClient;
  }

  async function currentUserId() {
    const client = getSupabaseClient();
    if (!client) return null;
    try {
      const { data } = await client.auth.getUser();
      return data?.user?.id || null;
    } catch (error) {
      console.warn('[HabitFlow/learning-vault] Auth-Status konnte nicht gelesen werden.', error);
      return null;
    }
  }

  function isMissingLearningVaultRelationError(error) {
    const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
    return text.includes('42p01') || text.includes('pgrst205') || text.includes(TABLE_NAME);
  }

  function rowForRemote(item, userId) {
    const normalized = normalizeItem(item);
    if (!normalized || !userId) return null;
    return {
      id: normalized.id,
      user_id: userId,
      title: normalized.title,
      body: normalized.body,
      context: normalized.context || null,
      tags: normalized.tags,
      is_archived: Boolean(normalized.is_archived),
      created_at: normalized.created_at,
      updated_at: normalized.updated_at
    };
  }

  function mergeItems(localItems = [], remoteItems = []) {
    const map = new Map();
    localItems.map(normalizeItem).filter(Boolean).forEach(item => map.set(item.id, item));
    remoteItems.map(item => normalizeItem({ ...item, synced: true })).filter(Boolean).forEach(remote => {
      const local = map.get(remote.id);
      if (!local) {
        map.set(remote.id, remote);
        return;
      }
      const remoteMs = new Date(remote.updated_at || remote.created_at || 0).getTime();
      const localMs = new Date(local.updated_at || local.created_at || 0).getTime();
      if (Number.isFinite(remoteMs) && remoteMs >= localMs) map.set(remote.id, remote);
    });
    return pruneCache(Array.from(map.values()));
  }

  function setSyncStatus(text) {
    document.querySelectorAll('[data-learning-sync-status]').forEach(node => {
      node.textContent = text;
    });
  }

  async function fetchRemoteItems(userId) {
    const client = getSupabaseClient();
    if (!client || !userId || !remoteSupported) return null;
    const { data, error } = await client
      .from(TABLE_NAME)
      .select(REMOTE_SELECT)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(MAX_CACHE_ITEMS);
    if (error) {
      if (isMissingLearningVaultRelationError(error)) {
        remoteSupported = false;
        setSyncStatus('Lokal gespeichert · Supabase-SQL fehlt');
        console.warn('[HabitFlow/learning-vault] Supabase-Tabelle fehlt. Learnings bleiben lokal, bis sql/add-learning-vault.sql ausgeführt wurde.', error);
        return null;
      }
      throw error;
    }
    return Array.isArray(data) ? data : [];
  }

  async function upsertRemoteItems(items = [], userId) {
    const client = getSupabaseClient();
    if (!client || !userId || !remoteSupported || !items.length) return false;
    const rows = items.map(item => rowForRemote(item, userId)).filter(Boolean);
    if (!rows.length) return false;
    const { error } = await client.from(TABLE_NAME).upsert(rows, { onConflict: 'user_id,id' });
    if (error) {
      if (isMissingLearningVaultRelationError(error)) {
        remoteSupported = false;
        setSyncStatus('Lokal gespeichert · Supabase-SQL fehlt');
        return false;
      }
      throw error;
    }
    const syncedIds = new Set(rows.map(row => row.id));
    writeCache(readCache().map(item => syncedIds.has(item.id) ? { ...item, synced: true } : item));
    return true;
  }

  async function syncWithRemote() {
    if (syncInFlight || !remoteSupported) return;
    syncInFlight = true;
    try {
      const userId = await currentUserId();
      if (!userId) {
        setSyncStatus('Lokal gespeichert · Sync nach Login');
        return;
      }
      setSyncStatus('Sync läuft · bewusst ohne Punkte');
      const localBeforePull = readCache();
      const remoteRows = await fetchRemoteItems(userId);
      if (!Array.isArray(remoteRows)) return;
      const merged = mergeItems(localBeforePull, remoteRows);
      writeCache(merged);
      const pending = merged.filter(item => item.synced !== true);
      if (pending.length) await upsertRemoteItems(pending, userId);
      setSyncStatus('Mit Supabase synchronisiert · ohne Punkte');
      renderList(document);
    } catch (error) {
      console.warn('[HabitFlow/learning-vault] Remote-Sync fehlgeschlagen.', error);
      setSyncStatus('Lokal gespeichert · Sync später erneut');
    } finally {
      syncInFlight = false;
    }
  }

  function scheduleRemoteSync(delay = 400) {
    if (syncTimer) window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(syncWithRemote, delay);
  }

  function syncSingleItem(item) {
    scheduleRemoteSync(250);
    currentUserId().then(userId => {
      if (!userId) return;
      return upsertRemoteItems([item], userId);
    }).catch(error => {
      console.warn('[HabitFlow/learning-vault] Learning konnte nicht sofort remote gespeichert werden.', error);
    }).finally(() => renderList(document));
  }

  function injectStyles() {
    if (document.getElementById('learningVaultStyles')) return;
    const style = document.createElement('style');
    style.id = 'learningVaultStyles';
    style.textContent = `
      .learning-vault-section { margin-top: var(--space-4, 1rem); }
      .learning-vault-card { display: grid; gap: 1rem; overflow: hidden; }
      .learning-vault-hero { display: grid; gap: .55rem; }
      .learning-vault-hero p { margin: 0; color: var(--muted); line-height: 1.55; }
      .learning-vault-form { display: grid; gap: .75rem; }
      .learning-vault-form textarea,
      .learning-vault-form input,
      .learning-vault-edit-form textarea,
      .learning-vault-edit-form input {
        width: 100%; border: 1px solid rgba(100, 116, 139, .16); border-radius: 24px;
        background: rgba(255,255,255,.78); color: var(--text); padding: 1rem 1.1rem;
        font: inherit; box-shadow: inset 0 1px 0 rgba(255,255,255,.55);
      }
      .learning-vault-form textarea,
      .learning-vault-edit-form textarea { min-height: 98px; resize: vertical; line-height: 1.45; }
      .learning-vault-form-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, .8fr); gap: .75rem; }
      .learning-vault-actions { display: flex; align-items: center; justify-content: space-between; gap: .75rem; flex-wrap: wrap; }
      .learning-vault-list {
        display: grid;
        gap: .78rem;
        max-height: clamp(360px, 42vh, 690px);
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: .12rem .18rem .25rem 0;
        scrollbar-width: thin;
      }
      .learning-vault-list::-webkit-scrollbar { width: 8px; }
      .learning-vault-list::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, .25); border-radius: 999px; }
      .learning-vault-item {
        position: relative;
        border: 1px solid rgba(100, 116, 139, .13);
        border-radius: 26px;
        padding: 1rem;
        background: linear-gradient(180deg, rgba(255,255,255,.7), rgba(255,255,255,.48));
        box-shadow: 0 16px 32px rgba(15, 23, 42, .05), inset 0 1px 0 rgba(255,255,255,.62);
        transition: transform .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease;
      }
      .learning-vault-item:hover { transform: translateY(-1px); border-color: rgba(74, 215, 209, .28); box-shadow: 0 18px 38px rgba(15, 23, 42, .08), inset 0 1px 0 rgba(255,255,255,.66); }
      .learning-vault-item.is-expanded { border-color: rgba(74, 215, 209, .38); background: linear-gradient(180deg, rgba(255,255,255,.82), rgba(245,253,253,.58)); }
      .learning-vault-item.is-editing { border-color: rgba(74, 215, 209, .52); box-shadow: 0 0 0 3px rgba(74,215,209,.12), 0 18px 38px rgba(15,23,42,.08); }
      .learning-vault-item-toggle {
        width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .85rem; align-items: start;
        border: 0; padding: 0; background: transparent; color: inherit; text-align: left;
      }
      .learning-vault-item-copy { min-width: 0; display: grid; gap: .45rem; }
      .learning-vault-title-row { display: flex; align-items: center; gap: .55rem; min-width: 0; }
      .learning-vault-title-row strong { color: var(--text); font-size: 1.02rem; line-height: 1.24; overflow-wrap: anywhere; }
      .learning-vault-chevron { color: var(--primary); font-weight: 950; transition: transform .18s ease; }
      .learning-vault-item.is-expanded .learning-vault-chevron { transform: rotate(180deg); }
      .learning-vault-meta { display: flex; align-items: center; gap: .45rem; flex-wrap: wrap; }
      .learning-vault-dot { opacity: .55; }
      .learning-vault-preview, .learning-vault-body { color: var(--muted); line-height: 1.5; overflow-wrap: anywhere; }
      .learning-vault-preview { margin-top: .12rem; }
      .learning-vault-body { margin-top: .85rem; color: var(--text); }
      .learning-vault-card-actions { display: flex; align-items: center; justify-content: flex-end; gap: .5rem; flex-wrap: wrap; margin-top: .95rem; }
      .learning-vault-edit-form { display: grid; gap: .75rem; margin-top: .95rem; padding-top: .95rem; border-top: 1px solid rgba(100, 116, 139, .12); }
      .learning-vault-edit-actions { display: flex; align-items: center; justify-content: flex-end; gap: .55rem; flex-wrap: wrap; }
      .learning-vault-tags { display: flex; gap: .35rem; flex-wrap: wrap; margin-top: .7rem; }
      .learning-vault-tags span { border-radius: 999px; padding: .24rem .55rem; background: rgba(100, 208, 203, .16); color: var(--text); font-size: .78rem; font-weight: 750; }
      .learning-vault-delete { border: 0; background: rgba(255,112,112,.12); color: #b84949; border-radius: 999px; padding: .35rem .55rem; font-weight: 800; cursor: pointer; }
      .learning-vault-empty { color: var(--muted); border: 1px dashed rgba(100, 116, 139, .24); border-radius: 24px; padding: 1rem; line-height: 1.5; }
      .learning-vault-open-btn { text-align: left; }
      body:not(.light) .learning-vault-form textarea,
      body:not(.light) .learning-vault-form input,
      body:not(.light) .learning-vault-edit-form textarea,
      body:not(.light) .learning-vault-edit-form input,
      body:not(.light) .learning-vault-item { background: rgba(15, 23, 42, .42); border-color: rgba(148, 163, 184, .16); }
      body:not(.light) .learning-vault-item { background: linear-gradient(180deg, rgba(15,23,42,.52), rgba(15,23,42,.34)); box-shadow: inset 0 1px 0 rgba(255,255,255,.04); }
      body:not(.light) .learning-vault-item.is-expanded { background: linear-gradient(180deg, rgba(15,23,42,.68), rgba(20,38,54,.44)); }
      @media (min-width: 1160px) { .learning-vault-list { max-height: clamp(390px, 46vh, 720px); } }
      @media (max-width: 720px) {
        .learning-vault-form-row { grid-template-columns: 1fr; }
        .learning-vault-actions .pill { width: 100%; justify-content: center; }
        .learning-vault-list { max-height: min(54vh, 560px); padding-right: 0; }
        .learning-vault-item { border-radius: 22px; padding: .9rem; }
        .learning-vault-item-toggle { grid-template-columns: 1fr auto; }
        .learning-vault-card-actions .mini-btn, .learning-vault-edit-actions .mini-btn { flex: 1 1 100%; }
      }
    `;
    document.head.appendChild(style);
  }

  function renderTags(tags = []) {
    return tags?.length ? `<div class="learning-vault-tags">${tags.map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</div>` : '';
  }

  function renderEditForm(item) {
    return `
      <form class="learning-vault-edit-form" data-learning-edit-form="${escapeHtml(item.id)}">
        <textarea name="body" required maxlength="420" aria-label="Learning Text bearbeiten">${escapeHtml(item.body || '')}</textarea>
        <div class="learning-vault-form-row">
          <input name="context" maxlength="80" value="${escapeHtml(item.context || '')}" placeholder="Kontext" aria-label="Learning Kontext bearbeiten" />
          <input name="tags" maxlength="80" value="${escapeHtml((item.tags || []).join(', '))}" placeholder="Tags" aria-label="Learning Tags bearbeiten" />
        </div>
        <div class="learning-vault-edit-actions">
          <button class="mini-btn" type="button" data-learning-edit-cancel="${escapeHtml(item.id)}">Abbrechen</button>
          <button class="mini-btn primary" type="submit">Speichern</button>
        </div>
      </form>
    `;
  }

  function renderLearningCard(item, expandedId, editingId) {
    const isExpanded = expandedId === item.id;
    const isEditing = editingId === item.id;
    const title = escapeHtml(item.title || 'Learning');
    const meta = `${escapeHtml(dateLabel(item.created_at))}${item.context ? `<span class="learning-vault-dot">·</span><span>${escapeHtml(item.context)}</span>` : ''}`;
    return `
      <article class="learning-vault-item ${isExpanded ? 'is-expanded' : ''} ${isEditing ? 'is-editing' : ''}" data-learning-card="${escapeHtml(item.id)}">
        <button class="learning-vault-item-toggle" type="button" data-learning-toggle="${escapeHtml(item.id)}" aria-expanded="${isExpanded ? 'true' : 'false'}">
          <span class="learning-vault-item-copy">
            <span class="learning-vault-title-row"><strong>${title}</strong></span>
            <span class="learning-vault-meta subtle">${meta}</span>
            ${isExpanded ? '' : `<span class="learning-vault-preview">${escapeHtml(previewText(item.body || ''))}</span>`}
          </span>
          <span class="learning-vault-chevron" aria-hidden="true">⌄</span>
        </button>
        ${isExpanded ? `
          ${isEditing ? renderEditForm(item) : `
            <p class="learning-vault-body">${escapeHtml(item.body || '')}</p>
            ${renderTags(item.tags)}
            <div class="learning-vault-card-actions">
              <button class="mini-btn" type="button" data-learning-edit="${escapeHtml(item.id)}">Bearbeiten</button>
              <button class="learning-vault-delete" type="button" data-learning-delete="${escapeHtml(item.id)}" aria-label="Learning löschen">×</button>
            </div>
          `}
        ` : renderTags(item.tags)}
      </article>
    `;
  }

  function renderList(root) {
    const list = root.querySelector('[data-learning-list]');
    const count = root.querySelector('[data-learning-count]');
    if (!list) return;
    const items = visibleItems();
    if (count) count.textContent = items.length ? `${items.length} Notiz${items.length === 1 ? '' : 'en'}` : 'bereit';
    if (!items.length) {
      list.innerHTML = `<div class="learning-vault-empty">Noch keine Learnings gespeichert. Gute Sätze, Modelle oder Beobachtungen landen hier, ohne daraus sofort eine Aufgabe zu machen.</div>`;
      return;
    }
    const itemIds = new Set(items.map(item => item.id));
    const expandedId = itemIds.has(readExpandedId()) ? readExpandedId() : '';
    const editingId = expandedId && readEditingId() === expandedId ? readEditingId() : '';
    if (!expandedId) setEditingId('');
    list.innerHTML = items.map(item => renderLearningCard(item, expandedId, editingId)).join('');
  }

  function panelHtml() {
    const open = window.localStorage?.getItem(UI_KEY) === 'open';
    return `
      <details id="learningVaultSection" class="mobile-dashboard-section learning-vault-section" ${open ? 'open' : ''}>
        <summary><span>Learning Vault</span><small data-learning-count>bereit</small></summary>
        <section class="panel glass learning-vault-card" aria-labelledby="learningVaultTitle">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Learning Vault</p>
              <h3 id="learningVaultTitle">Gedanken sauber parken</h3>
            </div>
            <span class="badge muted">low noise</span>
          </div>
          <div class="learning-vault-hero">
            <p>Für Sätze, Modelle und Beobachtungen, die wertvoll sind, aber keine Aufgabe sein müssen. Beispiel: „Weitwinkelaufmerksamkeit“.</p>
          </div>
          <form class="learning-vault-form" data-learning-form>
            <textarea name="body" required maxlength="420" placeholder="Was hast du aufgeschnappt? z. B. Heute braucht man Weitwinkelaufmerksamkeit."></textarea>
            <div class="learning-vault-form-row">
              <input name="context" maxlength="80" placeholder="Kontext · z. B. Samstag, Gespräch, Buch" />
              <input name="tags" maxlength="80" placeholder="Tags · Fokus, Arbeit, Leben" />
            </div>
            <div class="learning-vault-actions">
              <span class="subtle" data-learning-sync-status>Lokal gespeichert · Sync nach Login</span>
              <button class="pill primary" type="submit">Learning speichern</button>
            </div>
          </form>
          <div class="learning-vault-list" data-learning-list></div>
        </section>
      </details>
    `;
  }

  function ensurePanel() {
    if (document.getElementById('learningVaultSection')) return document.getElementById('learningVaultSection');
    const dashboard = document.getElementById('screen-dashboard');
    if (!dashboard) return null;
    const anchor = dashboard.querySelector('.monthly-magazine-mobile-section') || dashboard.querySelector('.weekly-review-mobile-section') || dashboard.lastElementChild;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = panelHtml().trim();
    const panel = wrapper.firstElementChild;
    if (anchor?.after) anchor.after(panel);
    else dashboard.appendChild(panel);
    return panel;
  }

  function ensureQuickAction() {
    const sheet = document.querySelector('#mobileQuickAdd .mobile-quick-sheet');
    if (!sheet || sheet.querySelector('[data-learning-open]')) return;
    const taskButton = sheet.querySelector('[data-action="open-task-form"]');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'learning-vault-open-btn';
    button.setAttribute('data-learning-open', '1');
    button.innerHTML = '<span class="quick-action-icon">✦</span><strong>Learning</strong>';
    if (taskButton?.after) taskButton.after(button);
    else sheet.appendChild(button);
  }

  function openPanel() {
    const panel = ensurePanel();
    if (!panel) return;
    panel.open = true;
    window.localStorage?.setItem(UI_KEY, 'open');
    scheduleRemoteSync(50);
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => panel.querySelector('textarea')?.focus({ preventScroll: true }), 220);
    document.getElementById('mobileQuickAdd')?.removeAttribute('open');
  }

  function updateLearningItem(id, patch) {
    const cache = readCache();
    const existing = cache.find(item => item.id === id);
    if (!existing) return null;
    const updated = normalizeItem({
      ...existing,
      ...patch,
      title: patch.title || titleFromBody(patch.body || existing.body),
      updated_at: nowIso(),
      synced: false
    });
    if (!updated) return null;
    writeCache([updated, ...cache.filter(item => item.id !== id)]);
    return updated;
  }

  function bindEvents() {
    document.addEventListener('submit', event => {
      const editForm = event.target.closest('[data-learning-edit-form]');
      if (editForm) {
        event.preventDefault();
        const id = editForm.getAttribute('data-learning-edit-form');
        const data = new FormData(editForm);
        const body = String(data.get('body') || '').trim();
        if (!body) return;
        const updated = updateLearningItem(id, {
          body,
          context: String(data.get('context') || '').trim().slice(0, 80),
          tags: normalizeTags(data.get('tags'))
        });
        if (!updated) return;
        setExpandedId(updated.id);
        setEditingId('');
        renderList(document);
        setSyncStatus('Bearbeitet · Sync läuft im Hintergrund');
        syncSingleItem(updated);
        window.dispatchEvent(new CustomEvent('habitflow:learning-updated', { detail: updated }));
        return;
      }

      const form = event.target.closest('[data-learning-form]');
      if (!form) return;
      event.preventDefault();
      const data = new FormData(form);
      const body = String(data.get('body') || '').trim();
      if (!body) return;
      const item = normalizeItem({
        id: uid(),
        body,
        context: String(data.get('context') || '').trim().slice(0, 80),
        tags: normalizeTags(data.get('tags')),
        created_at: nowIso(),
        updated_at: nowIso(),
        synced: false
      });
      if (!item) return;
      const next = [item, ...readCache()];
      if (writeCache(next)) {
        form.reset();
        setExpandedId(item.id);
        setEditingId('');
        renderList(document);
        setSyncStatus('Lokal gespeichert · Sync läuft im Hintergrund');
        syncSingleItem(item);
        window.dispatchEvent(new CustomEvent('habitflow:learning-saved', { detail: item }));
      }
    });

    document.addEventListener('click', event => {
      const opener = event.target.closest('[data-learning-open]');
      if (opener) {
        event.preventDefault();
        openPanel();
        return;
      }

      const toggleButton = event.target.closest('[data-learning-toggle]');
      if (toggleButton) {
        event.preventDefault();
        const id = toggleButton.getAttribute('data-learning-toggle');
        const nextId = readExpandedId() === id ? '' : id;
        setExpandedId(nextId);
        setEditingId('');
        renderList(document);
        return;
      }

      const editButton = event.target.closest('[data-learning-edit]');
      if (editButton) {
        event.preventDefault();
        const id = editButton.getAttribute('data-learning-edit');
        setExpandedId(id);
        setEditingId(id);
        renderList(document);
        window.setTimeout(() => document.querySelector(`[data-learning-edit-form="${CSS.escape(id)}"] textarea`)?.focus({ preventScroll: true }), 30);
        return;
      }

      const cancelEditButton = event.target.closest('[data-learning-edit-cancel]');
      if (cancelEditButton) {
        event.preventDefault();
        const id = cancelEditButton.getAttribute('data-learning-edit-cancel');
        setExpandedId(id);
        setEditingId('');
        renderList(document);
        return;
      }

      const deleteButton = event.target.closest('[data-learning-delete]');
      if (!deleteButton) return;
      event.preventDefault();
      const id = deleteButton.getAttribute('data-learning-delete');
      const cache = readCache();
      const existing = cache.find(item => item.id === id);
      if (!existing) return;
      const archived = { ...existing, is_archived: true, updated_at: nowIso(), synced: false };
      writeCache([archived, ...cache.filter(item => item.id !== id)]);
      if (readExpandedId() === id) setExpandedId('');
      if (readEditingId() === id) setEditingId('');
      renderList(document);
      setSyncStatus('Gelöscht · Sync läuft im Hintergrund');
      syncSingleItem(archived);
    });

    document.addEventListener('toggle', event => {
      if (event.target?.id === 'learningVaultSection') {
        window.localStorage?.setItem(UI_KEY, event.target.open ? 'open' : 'closed');
        if (event.target.open) scheduleRemoteSync(100);
      }
    }, true);
  }

  function bindRemoteRefresh() {
    const client = getSupabaseClient();
    if (client && !authSubscription) {
      const { data } = client.auth.onAuthStateChange(() => scheduleRemoteSync(300));
      authSubscription = data?.subscription || null;
    }
    window.addEventListener('online', () => scheduleRemoteSync(300));
    window.addEventListener('focus', () => scheduleRemoteSync(300));
    window.setInterval(() => scheduleRemoteSync(300), 60_000);
  }

  function init() {
    injectStyles();
    ensurePanel();
    ensureQuickAction();
    renderList(document);
    bindRemoteRefresh();
    scheduleRemoteSync(700);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  bindEvents();

  modules.register('learning-vault', {
    description: 'Local-first capture space for quotes, mental models and observations. Syncs to Supabase learning_vault after login without creating tasks or points.',
    storageKey: STORAGE_KEY,
    tableName: TABLE_NAME,
    maxItems: MAX_ITEMS,
    syncNow: syncWithRemote
  });
})(window, document);
