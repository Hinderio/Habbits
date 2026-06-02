(function initHabitFlowSmokeStrikeHistory(window, document) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (modules && modules.has('smoke-strike-history')) return;

  const STORAGE_KEY = 'habitflow-state-v1';
  const VISUAL_SELECTOR = '#smokeIntervalVisual';
  const GRID_SELECTOR = '.smoke-strike-grid';
  let renderTimer = null;

  function readState() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      console.warn('[HabitFlow/smoke-strike-history] State konnte nicht gelesen werden.', error);
      return null;
    }
  }

  function eventDate(row = {}) {
    const value = row.smoked_at || row.created_at || row.updated_at;
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function activeCigarettes(state) {
    return (Array.isArray(state?.cigarettes) ? state.cigarettes : [])
      .filter(row => row && !row.deleted_at && !row.archived_at && !row.is_archived)
      .map(row => ({ row, date: eventDate(row) }))
      .filter(item => item.date)
      .sort((a, b) => a.date - b.date)
      .map(item => item.row);
  }

  function fallbackIntervalPoints(previous, current) {
    const scoring = window.HabitFlowDomains?.smoking?.scoreInterval;
    if (typeof scoring === 'function') {
      const result = scoring(previous?.smoked_at || previous?.created_at, current?.smoked_at || current?.created_at);
      if (Number.isFinite(Number(result?.points))) return Number(result.points);
    }
    const minutes = Number(current?.scoring_interval_minutes ?? current?.interval_minutes);
    if (!Number.isFinite(minutes)) return 0;
    if (minutes < 30) return -40;
    if (minutes < 60) return -20;
    if (minutes < 120) return 0;
    if (minutes < 240) return 20;
    if (minutes < 480) return 60;
    return 100;
  }

  function isHealthyInterval(previous, current) {
    const points = Number.isFinite(Number(current?.points))
      ? Number(current.points)
      : fallbackIntervalPoints(previous, current);
    return points >= 0;
  }

  function buildHistoryModel(state) {
    const rows = activeCigarettes(state);
    const intervals = [];
    for (let index = 1; index < rows.length; index += 1) {
      intervals.push({
        id: rows[index].id || `${index}-${rows[index].smoked_at || rows[index].created_at || ''}`,
        healthy: isHealthyInterval(rows[index - 1], rows[index]),
        at: rows[index].smoked_at || rows[index].created_at || '',
        points: Number(rows[index].points || 0)
      });
    }

    let best = 0;
    let run = 0;
    intervals.forEach(item => {
      if (item.healthy) {
        run += 1;
        best = Math.max(best, run);
      } else {
        run = 0;
      }
    });

    let current = 0;
    for (let index = intervals.length - 1; index >= 0; index -= 1) {
      if (!intervals[index].healthy) break;
      current += 1;
    }

    const last = intervals.length ? intervals[intervals.length - 1] : null;
    const signature = intervals.map(item => `${item.id}:${item.at}:${item.healthy ? 1 : 0}:${item.points}`).join('|');
    return { best, current, total: intervals.length, signature, lastAt: last?.at || '' };
  }

  function ensureGrid(visual) {
    let grid = visual.querySelector(GRID_SELECTOR);
    if (grid) return grid;
    const summary = visual.querySelector('.smoking-visual-summary-grid');
    if (!summary) return null;
    grid = document.createElement('div');
    grid.className = 'smoke-strike-grid smoking-visual-summary-grid';
    summary.insertAdjacentElement('afterend', grid);
    return grid;
  }

  function renderStrikeHistory() {
    const visual = document.querySelector(VISUAL_SELECTOR);
    if (!visual) return;
    const state = readState();
    if (!state) return;
    const grid = ensureGrid(visual);
    if (!grid) return;

    const stats = buildHistoryModel(state);
    if (grid.dataset.hfHistoryStrikeSignature === stats.signature) return;
    grid.dataset.hfHistoryStrikeSignature = stats.signature;
    grid.dataset.hfHistoryStrike = 'full-history';
    grid.innerHTML = `
      <article class="smoke-strike-card"><small>Bester Strike</small><strong>${stats.best}×</strong><p>Längste Serie ohne rote oder orange Pausen über die gesamte Rauch-Historie.</p></article>
      <article class="smoke-strike-card is-current"><small>Aktueller Strike</small><strong>${stats.current}×</strong><p>Vom neuesten Eintrag rückwärts über alle gespeicherten Rauchpausen gezählt.</p></article>
    `;
  }

  function scheduleRender(delay = 120) {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(renderStrikeHistory, delay);
  }

  function start() {
    [220, 700, 1500, 3200].forEach(delay => window.setTimeout(renderStrikeHistory, delay));
    const observer = new MutationObserver(() => scheduleRender(80));
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) scheduleRender(120); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleRender(120); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  if (modules) {
    modules.register('smoke-strike-history', {
      description: 'Updates smoke strike cards to use the full saved cigarette interval history instead of only visible skyline bars.',
      source: 'localStorage.cigarettes',
      active: true
    });
  }
})(window, document);
