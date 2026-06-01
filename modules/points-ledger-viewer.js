(function initHabitFlowPointsLedgerViewer(window, document) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (modules && modules.has('points-ledger-viewer')) return;

  const STORAGE_KEY = 'habitflow-state-v1';
  const MAX_ROWS = 80;
  const SMOKE_DAILY_PREFIX = 'smoke-daily-bonus-';
  const SMOKE_DAILY_UUID_PREFIX = '00000000-0000-4000-8001-0000';
  const SMOKE_DAY_CUTOFF_HOUR = 2;
  let modal = null;
  let range = '30';

  function escapeHtml(value = '') {
    return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function readState() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function sourceLabel(value = '') {
    const key = String(value || '').toLowerCase();
    return ({ habit: 'Habit', task: 'Aufgabe', cigarette: 'Rauchen', smoke: 'Rauchen', alcohol: 'Alkohol', fitness: 'Fitness', bonus: 'Bonus', routine: 'Routine' })[key] || (key ? key.replace(/_/g, ' ') : 'Punkte');
  }

  function eventDate(row = {}) {
    const value = row.earned_at || row.earnedAt || row.created_at || row.createdAt || row.updated_at || row.updatedAt;
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function dateKey(value) {
    const date = value instanceof Date ? new Date(value) : new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function smokeDailyEarnedDateKey(value) {
    const date = value instanceof Date ? new Date(value) : new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '';
    if (date.getHours() < SMOKE_DAY_CUTOFF_HOUR + 1) date.setDate(date.getDate() - 1);
    return dateKey(date);
  }

  function smokeDayClosesAt(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || ''))) return null;
    const close = new Date(`${key}T${String(SMOKE_DAY_CUTOFF_HOUR).padStart(2, '0')}:00:00`);
    if (Number.isNaN(close.getTime())) return null;
    close.setDate(close.getDate() + 1);
    return close;
  }

  function isSmokeDayClosed(key) {
    const close = smokeDayClosesAt(key);
    return Boolean(close && Date.now() >= close.getTime());
  }

  function points(row = {}) {
    const value = Number(row.points || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function signed(value) {
    const number = Number(value || 0);
    return `${number > 0 ? '+' : ''}${number}`;
  }

  function formatDate(value, withTime = false) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'Unbekannt';
    return new Intl.DateTimeFormat('de-CH', withTime ? { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' } : { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' }).format(date);
  }

  function reason(row = {}) {
    if (row.reason || row.description || row.label) return String(row.reason || row.description || row.label);
    const source = sourceLabel(row.source_type || row.sourceType);
    if (source === 'Rauchen' && points(row) < 0) return 'Zigarette erfasst';
    if (source === 'Habit') return 'Habit-Eintrag gespeichert';
    if (source === 'Aufgabe') return 'Aufgabe abgeschlossen';
    return `${source} · Punkte gebucht`;
  }

  function isSmokeDailyBonus(row = {}) {
    const sourceId = String(row.source_id || row.sourceId || row.sourceId || '');
    const rowReason = String(row.reason || row.description || row.label || '');
    return String(row.source_type || row.sourceType || '') === 'bonus' && (
      sourceId.startsWith(SMOKE_DAILY_PREFIX) ||
      sourceId.startsWith(SMOKE_DAILY_UUID_PREFIX) ||
      rowReason.startsWith('Rauchziel:')
    );
  }

  function smokeDailyKey(row = {}) {
    const sourceId = String(row.source_id || row.sourceId || '');
    if (sourceId.startsWith(SMOKE_DAILY_PREFIX)) return sourceId.slice(SMOKE_DAILY_PREFIX.length);
    if (sourceId.startsWith(SMOKE_DAILY_UUID_PREFIX)) {
      const raw = sourceId.slice(SMOKE_DAILY_UUID_PREFIX.length);
      if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    }
    return smokeDailyEarnedDateKey(row.earned_at || row.earnedAt || row.created_at || row.createdAt);
  }

  function normalizeRow(row = {}) {
    const date = eventDate(row);
    const sourceType = String(row.source_type || row.sourceType || '');
    const sourceId = String(row.source_id || row.sourceId || '');
    return {
      id: String(row.id || `${sourceType}-${sourceId}-${row.earned_at || row.created_at || ''}`),
      sourceId,
      type: sourceType,
      points: points(row),
      reason: reason(row),
      date: date?.toISOString() || '',
      sortTime: new Date(row.updated_at || row.updatedAt || row.created_at || row.createdAt || row.earned_at || row.earnedAt || 0).getTime() || 0,
      isPendingSmokeDaily: isSmokeDailyBonus(row) && !isSmokeDayClosed(smokeDailyKey(row)),
      ledgerKey: isSmokeDailyBonus(row) ? `smoke-daily:${smokeDailyKey(row)}` : (sourceType && sourceId ? `${sourceType}:${sourceId}` : `id:${row.id || ''}`),
      synced: row.synced === true
    };
  }

  function dedupeRows(rawRows = []) {
    const byKey = new Map();
    rawRows.map(normalizeRow).filter(row => !row.isPendingSmokeDaily).forEach(row => {
      const key = row.ledgerKey || row.id;
      const existing = byKey.get(key);
      if (!existing || row.sortTime >= existing.sortTime || Math.abs(row.points) > Math.abs(existing.points)) byKey.set(key, row);
    });
    return Array.from(byKey.values());
  }

  function rows() {
    const state = readState();
    const ledger = Array.isArray(state?.pointsLedger) ? state.pointsLedger : Array.isArray(state?.points_ledger) ? state.points_ledger : [];
    const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 24 * 60 * 60 * 1000;
    return dedupeRows(ledger)
      .filter(row => range === 'all' || (row.date && new Date(row.date).getTime() >= cutoff))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, MAX_ROWS);
  }

  function rangeLabel(value) {
    if (value === '7') return '7 Tage';
    if (value === '30') return '30 Tage';
    return 'Alle';
  }

  function renderRows(data) {
    if (!data.length) return '<div class="hf-points-empty">Noch keine Punkte-Logs im gewählten Zeitraum.</div>';
    return data.map(row => `<article class="hf-points-row ${row.points > 0 ? 'is-positive' : row.points < 0 ? 'is-negative' : ''}"><strong>${escapeHtml(signed(row.points))} Pkt.</strong><div><b>${escapeHtml(row.reason)}</b><span>${escapeHtml(sourceLabel(row.type))} · ${escapeHtml(formatDate(row.date, true))}${row.synced ? ' · Sync' : ''}</span></div></article>`).join('');
  }

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'hfPointsLedgerModal';
    modal.className = 'hf-points-modal hidden';
    modal.innerHTML = '<div class="hf-points-card glass"><div class="hf-points-head"><div><p class="eyebrow">Points Ledger</p><h2>Punkteverlauf</h2><p>Nachvollziehbare Buchungen aus deinen Punkte-Logs.</p></div><button class="icon-btn" type="button" data-hf-points-close>×</button></div><div data-hf-points-body></div></div>';
    document.body.appendChild(modal);
    return modal;
  }

  function renderModal() {
    const data = rows();
    const total = data.reduce((sum, row) => sum + row.points, 0);
    const plus = data.filter(row => row.points > 0).reduce((sum, row) => sum + row.points, 0);
    const minus = data.filter(row => row.points < 0).reduce((sum, row) => sum + row.points, 0);
    ensureModal().querySelector('[data-hf-points-body]').innerHTML = `<div class="hf-points-toolbar">${['7', '30', 'all'].map(item => `<button class="${range === item ? 'is-active' : ''}" type="button" data-hf-points-range="${item}">${rangeLabel(item)}</button>`).join('')}</div><div class="hf-points-summary"><article><small>Saldo</small><strong>${signed(total)}</strong></article><article><small>Plus</small><strong>${signed(plus)}</strong></article><article><small>Minus</small><strong>${signed(minus)}</strong></article><article><small>Logs</small><strong>${data.length}</strong></article></div><div class="hf-points-list">${renderRows(data)}</div>`;
  }

  function openModal() {
    ensureModal().classList.remove('hidden');
    renderModal();
  }

  function closeModal() {
    if (modal) modal.classList.add('hidden');
  }

  function injectButton() {
    const popover = document.getElementById('pointsRulesPopover');
    if (!popover || popover.querySelector('[data-hf-points-open]') || !popover.textContent.trim()) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'points-rules-ledger-btn';
    button.setAttribute('data-hf-points-open', '1');
    button.textContent = 'Punkteverlauf ansehen';
    const detailButton = popover.querySelector('[data-action="toggle-points-detail"]');
    if (detailButton?.after) detailButton.after(button);
    else popover.appendChild(button);
  }

  function injectStyles() {
    if (document.getElementById('hf-points-ledger-style')) return;
    const style = document.createElement('style');
    style.id = 'hf-points-ledger-style';
    style.textContent = '.points-rules-ledger-btn{width:100%;margin:0 0 12px;border:1px solid rgba(143,240,167,.2);border-radius:18px;padding:12px 14px;background:linear-gradient(135deg,rgba(143,240,167,.14),rgba(74,215,209,.08));color:var(--text);font-weight:850;text-align:left}.hf-points-modal{position:fixed;inset:0;z-index:260;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(3,10,18,.64);backdrop-filter:blur(18px)}.hf-points-modal.hidden{display:none!important}.hf-points-card{width:min(740px,100%);max-height:86vh;overflow:hidden;border-radius:32px;padding:18px;display:grid;gap:14px}.hf-points-head{display:flex;justify-content:space-between;gap:16px}.hf-points-head h2{font-size:clamp(2rem,5vw,3.2rem);line-height:.95;letter-spacing:-.07em}.hf-points-head p:not(.eyebrow){color:var(--muted);line-height:1.45}.hf-points-toolbar{display:flex;gap:7px;flex-wrap:wrap}.hf-points-toolbar button{border:0;border-radius:999px;padding:8px 12px;background:rgba(255,255,255,.08);color:var(--muted);font-weight:900}.hf-points-toolbar button.is-active{background:linear-gradient(135deg,var(--primary),#66e7ff);color:#00131c}.hf-points-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.hf-points-summary article{padding:12px;border-radius:18px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.065)}.hf-points-summary small{display:block;color:var(--muted);font-size:.66rem;font-weight:950;text-transform:uppercase;letter-spacing:.09em}.hf-points-summary strong{font-size:1.12rem}.hf-points-list{max-height:48vh;overflow:auto;display:grid;gap:8px}.hf-points-row{display:grid;grid-template-columns:82px minmax(0,1fr);gap:10px;align-items:center;padding:11px;border-radius:18px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.06)}.hf-points-row>strong{min-height:48px;border-radius:14px;display:grid;place-items:center;background:rgba(255,255,255,.06)}.hf-points-row.is-positive>strong{color:#8ff0a7;background:rgba(143,240,167,.13)}.hf-points-row.is-negative>strong{color:#ff9d9d;background:rgba(255,112,112,.13)}.hf-points-row b{display:block;font-size:.92rem}.hf-points-row span{display:block;color:var(--muted);font-size:.78rem;line-height:1.35}.hf-points-empty{padding:18px;border:1px dashed rgba(157,176,195,.22);border-radius:18px;color:var(--muted);text-align:center}body.light .hf-points-modal{background:rgba(226,238,249,.72)}body.light .hf-points-summary article,body.light .hf-points-row,body.light .hf-points-row>strong{background:rgba(255,255,255,.72);border-color:rgba(17,36,58,.08)}@media(max-width:760px){.hf-points-modal{align-items:flex-end;padding:8px}.hf-points-card{max-height:92vh;border-radius:28px 28px 18px 18px}.hf-points-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.hf-points-row{grid-template-columns:70px minmax(0,1fr)}}';
    document.head.appendChild(style);
  }

  function start() {
    injectStyles();
    ensureModal();
    const popover = document.getElementById('pointsRulesPopover');
    if (popover) new MutationObserver(injectButton).observe(popover, { childList: true, attributes: true, attributeFilter: ['class'] });
    injectButton();
    document.addEventListener('click', event => {
      if (event.target.closest('[data-hf-points-open]')) { event.preventDefault(); openModal(); }
      if (event.target.closest('[data-hf-points-close]') || event.target.id === 'hfPointsLedgerModal') closeModal();
      const rangeButton = event.target.closest('[data-hf-points-range]');
      if (rangeButton) { range = rangeButton.getAttribute('data-hf-points-range') || '30'; renderModal(); }
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  if (modules) modules.register('points-ledger-viewer', { description: 'Points ledger viewer in existing rules popover.', active: true });
})(window, document);
