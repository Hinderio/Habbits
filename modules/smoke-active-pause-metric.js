(function registerHabitFlowSmokeActivePauseMetric(window, document) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (modules && modules.has('smoke-active-pause-metric')) return;

  const STORAGE_KEY = 'habitflow-state-v1';
  const SLEEP_START_HOUR = 23;
  const SLEEP_END_HOUR = 7;
  const SLEEP_BRIDGE_MINUTES = 240;
  const WAKE_MIN_HOUR = 5;
  let renderTimer = null;

  function readState() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      console.warn('[HabitFlow/smoke-active-pause-metric] State konnte nicht gelesen werden.', error);
      return null;
    }
  }

  function eventDate(row = {}) {
    const value = row.smoked_at || row.created_at || row.updated_at;
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function toDateKey(value) {
    const date = value instanceof Date ? value : new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function activePausePeriods(state) {
    return (Array.isArray(state?.pausePeriods) ? state.pausePeriods : [])
      .filter(period => period && !period.is_archived && String(period.scope || 'smoke') === 'smoke')
      .map(period => {
        const start = new Date(period.starts_at || period.start_at || period.started_at || 0).getTime();
        const end = period.ends_at ? new Date(period.ends_at).getTime() : Infinity;
        return { start, end };
      })
      .filter(period => Number.isFinite(period.start) && period.end >= period.start);
  }

  function isWithinPause(timeMs, pausePeriods) {
    return pausePeriods.some(period => timeMs >= period.start && timeMs <= period.end);
  }

  function intervalCrossesPause(startMs, endMs, pausePeriods) {
    return pausePeriods.some(period => period.start < endMs && period.end > startMs);
  }

  function visibleCigarettes(state) {
    const pauses = activePausePeriods(state);
    return (Array.isArray(state?.cigarettes) ? state.cigarettes : [])
      .filter(row => row && !row.deleted_at && !row.archived_at && !row.is_archived)
      .map(row => ({ row, date: eventDate(row) }))
      .filter(item => item.date && !isWithinPause(item.date.getTime(), pauses))
      .sort((a, b) => a.date - b.date)
      .map(item => item.row);
  }

  function sleepWindowForScoring(dateValue) {
    const start = dateValue instanceof Date ? new Date(dateValue) : new Date(dateValue || 0);
    if (Number.isNaN(start.getTime())) return null;
    start.setHours(SLEEP_START_HOUR, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setHours(SLEEP_END_HOUR, 0, 0, 0);
    return { start, end };
  }

  function sleepMinutesBetween(startValue, endValue) {
    const startMs = new Date(startValue || 0).getTime();
    const endMs = new Date(endValue || 0).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
    let total = 0;
    const cursor = new Date(startMs);
    cursor.setDate(cursor.getDate() - 1);
    cursor.setHours(12, 0, 0, 0);
    for (let guard = 0; guard < 14 && cursor.getTime() <= endMs + 86400000; guard += 1) {
      const sleepWindow = sleepWindowForScoring(cursor);
      if (sleepWindow) {
        const overlapStart = Math.max(startMs, sleepWindow.start.getTime());
        const overlapEnd = Math.min(endMs, sleepWindow.end.getTime());
        if (overlapEnd > overlapStart) total += Math.round((overlapEnd - overlapStart) / 60000);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return total;
  }

  function isPostSleepWakeTime(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return false;
    const hour = date.getHours();
    return hour >= WAKE_MIN_HOUR && hour < 12;
  }

  function fallbackScoringInterval(previous, current, rawMinutes) {
    const previousAt = previous?.smoked_at || previous?.created_at;
    const currentAt = current?.smoked_at || current?.created_at;
    const sleepMinutes = sleepMinutesBetween(previousAt, currentAt);
    const sleepBridge = rawMinutes >= SLEEP_BRIDGE_MINUTES && sleepMinutes >= SLEEP_BRIDGE_MINUTES && isPostSleepWakeTime(currentAt);
    return sleepBridge ? Math.max(0, rawMinutes - sleepMinutes) : rawMinutes;
  }

  function bestActiveDaytimePauseMinutes(state) {
    const pauses = activePausePeriods(state);
    const rows = visibleCigarettes(state);
    const values = [];
    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1];
      const current = rows[index];
      const previousAt = previous?.smoked_at || previous?.created_at;
      const currentAt = current?.smoked_at || current?.created_at;
      const previousMs = new Date(previousAt || 0).getTime();
      const currentMs = new Date(currentAt || 0).getTime();
      if (!Number.isFinite(previousMs) || !Number.isFinite(currentMs) || currentMs <= previousMs) continue;
      if (intervalCrossesPause(previousMs, currentMs, pauses)) continue;
      if (toDateKey(previousAt) !== toDateKey(currentAt)) continue;
      const rawMinutes = Math.max(0, Math.round((currentMs - previousMs) / 60000));
      const storedScoring = Number(current.scoring_interval_minutes);
      const activeMinutes = Number.isFinite(storedScoring) ? storedScoring : fallbackScoringInterval(previous, current, rawMinutes);
      if (Number.isFinite(activeMinutes) && activeMinutes > 0) values.push(activeMinutes);
    }
    return values.length ? Math.max(...values) : null;
  }

  function formatDuration(minutes) {
    if (minutes == null || !Number.isFinite(Number(minutes))) return '–';
    const rounded = Math.max(0, Math.round(Number(minutes)));
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    if (hours && mins) return `${hours}h ${mins}m`;
    if (hours) return `${hours}h`;
    return `${mins}m`;
  }

  function patchInsights() {
    const state = readState();
    const grid = document.getElementById('insightsGrid');
    if (!state || !grid) return;
    const best = bestActiveDaytimePauseMinutes(state);
    const card = Array.from(grid.querySelectorAll('.insight-card')).find(item => {
      const title = item.querySelector('strong')?.textContent?.trim().toLowerCase() || '';
      return title === 'beste tagespause';
    });
    if (!card) return;
    const body = card.querySelector('p');
    if (!body) return;
    const nextText = best == null
      ? 'Noch keine aktive Tagespause zwischen zwei Zigaretten vorhanden.'
      : `Längste aktive Pause innerhalb eines Tages: ${formatDuration(best)}. Schlaf-/Nachtzeit ist neutralisiert.`;
    if (body.textContent !== nextText) body.textContent = nextText;
    card.dataset.hfActivePauseMetric = 'scoring-interval';
  }

  function schedulePatch(delay = 80) {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(patchInsights, delay);
  }

  function start() {
    [120, 500, 1200].forEach(delay => window.setTimeout(patchInsights, delay));
    const observer = new MutationObserver(() => schedulePatch(80));
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) schedulePatch(80); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) schedulePatch(120); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  if (modules) {
    modules.register('smoke-active-pause-metric', {
      description: 'Uses scoring_interval_minutes for the dashboard active daytime smoke pause insight so sleep/night time is neutralized.',
      source: 'localStorage.cigarettes.scoring_interval_minutes',
      mutatesState: false,
      active: true
    });
  }
})(window, document);
