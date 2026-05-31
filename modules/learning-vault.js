(function registerHabitFlowLearningVault(window, document) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('learning-vault')) return;

  const STORAGE_KEY = 'habitflow-learning-vault-v1';
  const UI_KEY = 'habitflow-learning-vault-open-v1';
  const MAX_ITEMS = 120;

  function uid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `learning-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function escapeHtml(value = '') {
    return String(value || '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  function readItems() {
    try {
      const parsed = JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (error) {
      console.warn('[HabitFlow/learning-vault] Learnings konnten nicht gelesen werden.', error);
      return [];
    }
  }

  function writeItems(items) {
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
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

  function normalizeTags(value = '') {
    return String(value || '')
      .split(/[#,]/)
      .map(tag => tag.trim().replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, 5);
  }

  function injectStyles() {
    if (document.getElementById('learningVaultStyles')) return;
    const style = document.createElement('style');
    style.id = 'learningVaultStyles';
    style.textContent = `
      .learning-vault-section { margin-top: var(--space-4, 1rem); }
      .learning-vault-card { display: grid; gap: 1rem; }
      .learning-vault-hero { display: grid; gap: .55rem; }
      .learning-vault-hero p { margin: 0; color: var(--muted); line-height: 1.55; }
      .learning-vault-form { display: grid; gap: .75rem; }
      .learning-vault-form textarea,
      .learning-vault-form input {
        width: 100%; border: 1px solid rgba(100, 116, 139, .16); border-radius: 24px;
        background: rgba(255,255,255,.78); color: var(--text); padding: 1rem 1.1rem;
        font: inherit; box-shadow: inset 0 1px 0 rgba(255,255,255,.55);
      }
      .learning-vault-form textarea { min-height: 98px; resize: vertical; line-height: 1.45; }
      .learning-vault-form-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, .8fr); gap: .75rem; }
      .learning-vault-actions { display: flex; align-items: center; justify-content: space-between; gap: .75rem; flex-wrap: wrap; }
      .learning-vault-list { display: grid; gap: .7rem; }
      .learning-vault-item { border: 1px solid rgba(100, 116, 139, .13); border-radius: 26px; padding: 1rem; background: rgba(255,255,255,.55); }
      .learning-vault-item-head { display: flex; justify-content: space-between; gap: .75rem; align-items: flex-start; margin-bottom: .45rem; }
      .learning-vault-item strong { color: var(--text); font-size: 1rem; line-height: 1.25; }
      .learning-vault-item p { color: var(--muted); margin: .35rem 0 0; line-height: 1.5; }
      .learning-vault-tags { display: flex; gap: .35rem; flex-wrap: wrap; margin-top: .7rem; }
      .learning-vault-tags span { border-radius: 999px; padding: .24rem .55rem; background: rgba(100, 208, 203, .16); color: var(--text); font-size: .78rem; font-weight: 750; }
      .learning-vault-delete { border: 0; background: rgba(255,112,112,.12); color: #b84949; border-radius: 999px; padding: .35rem .55rem; font-weight: 800; cursor: pointer; }
      .learning-vault-empty { color: var(--muted); border: 1px dashed rgba(100, 116, 139, .24); border-radius: 24px; padding: 1rem; line-height: 1.5; }
      .learning-vault-open-btn { text-align: left; }
      body:not(.light) .learning-vault-form textarea,
      body:not(.light) .learning-vault-form input,
      body:not(.light) .learning-vault-item { background: rgba(15, 23, 42, .42); border-color: rgba(148, 163, 184, .16); }
      @media (max-width: 720px) {
        .learning-vault-form-row { grid-template-columns: 1fr; }
        .learning-vault-actions .pill { width: 100%; justify-content: center; }
      }
    `;
    document.head.appendChild(style);
  }

  function renderList(root) {
    const list = root.querySelector('[data-learning-list]');
    const count = root.querySelector('[data-learning-count]');
    if (!list) return;
    const items = readItems().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    if (count) count.textContent = items.length ? `${items.length} Notiz${items.length === 1 ? '' : 'en'}` : 'bereit';
    if (!items.length) {
      list.innerHTML = `<div class="learning-vault-empty">Noch keine Learnings gespeichert. Gute Sätze, Modelle oder Beobachtungen landen hier, ohne daraus sofort eine Aufgabe zu machen.</div>`;
      return;
    }
    list.innerHTML = items.slice(0, 6).map(item => `
      <article class="learning-vault-item">
        <div class="learning-vault-item-head">
          <strong>${escapeHtml(item.title || 'Learning')}</strong>
          <button class="learning-vault-delete" type="button" data-learning-delete="${escapeHtml(item.id)}" aria-label="Learning löschen">×</button>
        </div>
        <small class="subtle">${escapeHtml(dateLabel(item.created_at))}${item.context ? ` · ${escapeHtml(item.context)}` : ''}</small>
        <p>${escapeHtml(item.body || '')}</p>
        ${item.tags?.length ? `<div class="learning-vault-tags">${item.tags.map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
      </article>
    `).join('');
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
              <span class="subtle">Privat lokal gespeichert · bewusst ohne Punkte</span>
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
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => panel.querySelector('textarea')?.focus({ preventScroll: true }), 220);
    document.getElementById('mobileQuickAdd')?.removeAttribute('open');
  }

  function bindEvents() {
    document.addEventListener('submit', event => {
      const form = event.target.closest('[data-learning-form]');
      if (!form) return;
      event.preventDefault();
      const data = new FormData(form);
      const body = String(data.get('body') || '').trim();
      if (!body) return;
      const firstSentence = body.split(/[.!?\n]/).find(Boolean)?.trim() || body;
      const item = {
        id: uid(),
        title: firstSentence.slice(0, 72),
        body,
        context: String(data.get('context') || '').trim().slice(0, 80),
        tags: normalizeTags(data.get('tags')),
        created_at: nowIso()
      };
      const next = [item, ...readItems()].slice(0, MAX_ITEMS);
      if (writeItems(next)) {
        form.reset();
        renderList(document);
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
      const deleteButton = event.target.closest('[data-learning-delete]');
      if (!deleteButton) return;
      const id = deleteButton.getAttribute('data-learning-delete');
      writeItems(readItems().filter(item => item.id !== id));
      renderList(document);
    });

    document.addEventListener('toggle', event => {
      if (event.target?.id === 'learningVaultSection') {
        window.localStorage?.setItem(UI_KEY, event.target.open ? 'open' : 'closed');
      }
    }, true);
  }

  function init() {
    injectStyles();
    ensurePanel();
    ensureQuickAction();
    renderList(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  bindEvents();

  modules.register('learning-vault', {
    description: 'Lightweight local-first capture space for quotes, mental models and observations without turning them into tasks.',
    storageKey: STORAGE_KEY,
    maxItems: MAX_ITEMS
  });
})(window, document);
