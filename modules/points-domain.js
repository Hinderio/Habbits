(function registerHabitFlowPointsDomain(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('points-domain')) return;

  function normalizePoints(value) {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function pointLabel(value) {
    const points = normalizePoints(value);
    return `${points > 0 ? '+' : ''}${points} Pkt.`;
  }

  function pointTone(value) {
    const points = normalizePoints(value);
    if (points > 0) return 'positive';
    if (points < 0) return 'danger';
    return 'neutral';
  }

  function ledgerKey(sourceType, sourceId) {
    return `${sourceType || 'unknown'}:${sourceId || 'unknown'}`;
  }

  function dedupeLedgerEntries(entries) {
    const seen = new Map();
    const result = [];
    (Array.isArray(entries) ? entries : []).forEach(entry => {
      if (!entry) return;
      const key = ledgerKey(entry.source_type, entry.source_id);
      if (!seen.has(key)) {
        seen.set(key, entry);
        result.push(entry);
        return;
      }
      const current = seen.get(key);
      const currentTime = new Date(current.updated_at || current.created_at || current.earned_at || 0).getTime();
      const nextTime = new Date(entry.updated_at || entry.created_at || entry.earned_at || 0).getTime();
      if (nextTime > currentTime) {
        const index = result.indexOf(current);
        if (index >= 0) result[index] = entry;
        seen.set(key, entry);
      }
    });
    return result;
  }

  function upsertLedgerEntry(entries, nextEntry) {
    const ledger = Array.isArray(entries) ? entries.slice() : [];
    if (!nextEntry || !nextEntry.source_type || !nextEntry.source_id) return ledger;
    const key = ledgerKey(nextEntry.source_type, nextEntry.source_id);
    let replaced = false;
    const merged = ledger.map(entry => {
      if (ledgerKey(entry?.source_type, entry?.source_id) !== key) return entry;
      replaced = true;
      return Object.assign({}, entry, nextEntry, { updated_at: new Date().toISOString(), synced: false });
    });
    if (!replaced) merged.push(Object.assign({ id: key, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), synced: false }, nextEntry));
    return dedupeLedgerEntries(merged);
  }

  const api = Object.freeze({
    normalizePoints,
    pointLabel,
    pointTone,
    ledgerKey,
    dedupeLedgerEntries,
    upsertLedgerEntry
  });

  window.HabitFlowDomains = window.HabitFlowDomains || {};
  window.HabitFlowDomains.points = api;

  modules.register('points-domain', {
    description: 'Pure points helpers for labels, tones and ledger consistency. Safe to reuse from app.js during gradual extraction.',
    exports: Object.freeze(['normalizePoints', 'pointLabel', 'pointTone', 'dedupeLedgerEntries', 'upsertLedgerEntry'])
  });
})(window);

(function registerTaskWeeklySelector(window, document) {
  'use strict';

  const SELECT_ID = 'taskWeeklySelect';
  const WEEK_WINDOW = 26;
  let currentOffset = 0;
  let internalMove = false;

  function startOfWeekDate(value = new Date()) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return startOfWeekDate(new Date());
    const day = (date.getDay() + 6) % 7;
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - day);
    return date;
  }

  function addDays(value, days = 0) {
    const date = new Date(value);
    date.setDate(date.getDate() + days);
    return date;
  }

  function addWeeks(value, weeks = 0) {
    return addDays(value, weeks * 7);
  }

  function isoWeekInfo(value) {
    const date = startOfWeekDate(value);
    date.setDate(date.getDate() + 3);
    const firstThursday = new Date(date.getFullYear(), 0, 4, 12, 0, 0, 0);
    firstThursday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7) + 3);
    const week = 1 + Math.round((date - firstThursday) / 604800000);
    return { week, year: date.getFullYear() };
  }

  function formatDate(value) {
    return value.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
  }

  function optionLabel(offset) {
    const weekStart = addWeeks(startOfWeekDate(new Date()), offset);
    const weekEnd = addDays(weekStart, 6);
    const label = offset === 0 ? 'Diese Woche' : `KW ${String(isoWeekInfo(weekStart).week).padStart(2, '0')}`;
    return `${label} · ${formatDate(weekStart)}-${formatDate(weekEnd)}`;
  }

  function syncSelectValue(select) {
    if (!select) return;
    if (![...select.options].some(option => Number(option.value) === currentOffset)) {
      const option = document.createElement('option');
      option.value = String(currentOffset);
      option.textContent = optionLabel(currentOffset);
      select.append(option);
    }
    select.value = String(currentOffset);
  }

  function buildOptions(select) {
    const fragment = document.createDocumentFragment();
    for (let offset = -WEEK_WINDOW; offset <= WEEK_WINDOW; offset += 1) {
      const option = document.createElement('option');
      option.value = String(offset);
      option.textContent = optionLabel(offset);
      fragment.append(option);
    }
    select.replaceChildren(fragment);
    syncSelectValue(select);
  }

  function clickWeekButton(id, count) {
    const button = document.getElementById(id);
    if (!button) return;
    for (let index = 0; index < count; index += 1) button.click();
  }

  function moveToOffset(nextOffset) {
    const next = Number(nextOffset || 0);
    const delta = next - currentOffset;
    if (!Number.isFinite(next) || delta === 0) return;
    internalMove = true;
    clickWeekButton(delta > 0 ? 'taskWeeklyNextBtn' : 'taskWeeklyPrevBtn', Math.abs(delta));
    currentOffset = next;
    syncSelectValue(document.getElementById(SELECT_ID));
    internalMove = false;
  }

  function bindButton(id, updateOffset) {
    const button = document.getElementById(id);
    if (!button) return;
    button.addEventListener('click', () => {
      if (internalMove) return;
      currentOffset = updateOffset(currentOffset);
      syncSelectValue(document.getElementById(SELECT_ID));
    });
  }

  function ensureTaskWeeklySelector() {
    const controls = document.querySelector('.task-weekly-controls');
    if (!controls || document.getElementById(SELECT_ID)) return;

    const select = document.createElement('select');
    select.id = SELECT_ID;
    select.className = 'task-weekly-select';
    select.setAttribute('aria-label', 'Woche auswählen');
    select.title = 'Woche auswählen';
    buildOptions(select);
    select.addEventListener('change', event => moveToOffset(event.target.value));

    const todayButton = document.getElementById('taskWeeklyTodayBtn');
    if (todayButton?.nextSibling) controls.insertBefore(select, todayButton.nextSibling);
    else controls.append(select);

    bindButton('taskWeeklyPrevBtn', offset => offset - 1);
    bindButton('taskWeeklyNextBtn', offset => offset + 1);
    bindButton('taskWeeklyTodayBtn', () => 0);
  }

  document.addEventListener('DOMContentLoaded', () => window.setTimeout(ensureTaskWeeklySelector, 0));
})(window, document);
