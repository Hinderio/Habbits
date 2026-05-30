(function registerHabitFlowWeeklyAutosave(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  const STORAGE_KEY = 'habitflow-state-v1';
  const MAX_BACKFILL_WEEKS = 8;

  function nowIso() {
    return new Date().toISOString();
  }

  function toDateKey(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + Number(days || 0));
    return next;
  }

  function startOfWeekDate(value = new Date()) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return startOfWeekDate(new Date());
    date.setHours(12, 0, 0, 0);
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
    return date;
  }

  function weekKeysFromStart(startDate) {
    const start = startOfWeekDate(startDate);
    return Array.from({ length: 7 }, (_, index) => toDateKey(addDays(start, index)));
  }

  function dateValueInKeys(value, keySet) {
    const key = toDateKey(value);
    return Boolean(key && keySet.has(key));
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function readState() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      console.warn('[HabitFlow/weekly-autosave] State konnte nicht gelesen werden.', error);
      return null;
    }
  }

  function writeState(state) {
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn('[HabitFlow/weekly-autosave] State konnte nicht gespeichert werden.', error);
      return false;
    }
  }

  function sum(values) {
    return safeArray(values).reduce((total, value) => total + Number(value || 0), 0);
  }

  function formatKmValue(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return '0 km';
    return `${numeric.toFixed(numeric >= 10 ? 1 : 2).replace(/\.0$/, '')} km`;
  }

  function formatMetersValue(value) {
    const numeric = Math.round(Number(value || 0));
    return `${Math.max(0, numeric).toLocaleString('de-CH')} hm`;
  }

  function localDateLabel(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
  }

  function weeklyReviewRangeLabel(startDate) {
    const start = startOfWeekDate(startDate);
    return `${localDateLabel(start)} – ${localDateLabel(addDays(start, 6))}`;
  }

  function habitLooksLikeFitness(habit = {}, type) {
    const text = `${habit.name || ''} ${habit.icon || ''} ${habit.unit || ''}`.toLowerCase();
    if (type === 'jogging') return /jog|run|lauf/.test(text);
    if (type === 'hiking') return /hik|wander|berg/.test(text);
    return false;
  }

  function parseAscentMeters(note = '') {
    const match = String(note || '').match(/(\d+(?:[.,]\d+)?)\s*(?:hm|h\s*m|meter|m)\b/i);
    if (!match) return 0;
    const numeric = Number(String(match[1]).replace(',', '.'));
    return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
  }

  function pointsOnDate(state, key) {
    return sum(safeArray(state.pointsLedger)
      .filter(point => toDateKey(point.earned_at || point.created_at) === key)
      .map(point => point.points));
  }

  function calculateDailyScore(state, key) {
    const cigarettes = safeArray(state.cigarettes).filter(item => toDateKey(item.smoked_at || item.created_at) === key).length;
    const alcohol = safeArray(state.alcoholUnits).filter(item => toDateKey(item.occurred_at || item.created_at) === key).length;
    const tasksDone = safeArray(state.tasks).filter(task => task.status === 'done' && toDateKey(task.completed_at || task.updated_at || task.created_at) === key).length;
    const habitLogs = safeArray(state.habitEntries).filter(entry => toDateKey(entry.occurred_at || entry.created_at) === key).length;
    let score = 72;
    score += Math.min(14, habitLogs * 4);
    score += Math.min(12, tasksDone * 5);
    score -= Math.min(36, cigarettes * 8);
    score -= Math.min(18, alcohol * 5);
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function dayHasTrackedActivity(state, key) {
    return Boolean(
      safeArray(state.cigarettes).some(item => toDateKey(item.smoked_at || item.created_at) === key) ||
      safeArray(state.alcoholUnits).some(item => toDateKey(item.occurred_at || item.created_at) === key) ||
      safeArray(state.habitEntries).some(item => toDateKey(item.occurred_at || item.created_at) === key) ||
      safeArray(state.tasks).some(item => item.status === 'done' && toDateKey(item.completed_at || item.updated_at || item.created_at) === key) ||
      safeArray(state.morningRoutineLogs).some(item => (item.date_key || toDateKey(item.completed_at || item.created_at)) === key) ||
      pointsOnDate(state, key) !== 0
    );
  }

  function buildWeeklyHighlights(metrics = {}) {
    const out = [];
    if (metrics.cleanDays) out.push(`${metrics.cleanDays} klare Tage ohne Konsum-Kontext`);
    if (metrics.runKm) out.push(`${formatKmValue(metrics.runKm)} Joggen`);
    if (metrics.hikeKm || metrics.ascentM) out.push(`${formatKmValue(metrics.hikeKm)} Wandern · ${formatMetersValue(metrics.ascentM)}`);
    if (metrics.tasksDone) out.push(`${metrics.tasksDone} Aufgabe${metrics.tasksDone === 1 ? '' : 'n'} erledigt`);
    if (metrics.routineDays) out.push(`${metrics.routineDays} Morgenroutine${metrics.routineDays === 1 ? '' : 'n'}`);
    if (!metrics.cigarettes) out.push('rauchfrei dokumentiert');
    return out.slice(0, 5);
  }

  function weeklyReviewTitle(score, metrics = {}) {
    if (score >= 82) return 'Starke Woche mit Premium-Momentum';
    if ((metrics.runKm || metrics.hikeKm || metrics.tasksDone) && score >= 68) return 'Solide Woche mit klarer Bewegung';
    if (score >= 55) return 'Stabile Woche mit sichtbaren Hebeln';
    return 'Woche mit klarer nächster Stellschraube';
  }

  function weeklyReviewRecommendation(metrics = {}) {
    if (metrics.cigarettes >= 12 && metrics.alcoholUnits) return 'Nächste Woche zuerst Alkohol-Kontexte planen: vor dem ersten Drink einen Delay-Schritt festlegen.';
    if (metrics.cigarettes >= 8) return 'Fokussiere eine starke Tagespause statt Perfektion – ein bewusstes Delay-Fenster pro Tag reicht.';
    if (!metrics.tasksDone) return 'Plane eine kleine Aufgabe mit Datum. Ein sichtbarer Abschluss gibt der Woche Struktur.';
    if (!metrics.runKm && !metrics.hikeKm) return 'Eine kurze Bewegungseinheit würde den Wochenrückblick stark aufwerten.';
    if (metrics.routineDays < 2) return 'Zwei Morgenroutinen reichen als ruhiger Anker für die nächste Woche.';
    return 'Behalte den Kurs bei und setze nur ein kleines Zusatz-Ziel, damit die Woche nicht überladen wird.';
  }

  function buildWeeklyReviewSnapshot(state, startDate) {
    const start = startOfWeekDate(startDate);
    const startKey = toDateKey(start);
    const endKey = toDateKey(addDays(start, 6));
    const keys = weekKeysFromStart(start);
    const keySet = new Set(keys);
    const habitsById = new Map(safeArray(state.habits).map(habit => [habit.id, habit]));

    const cigarettes = safeArray(state.cigarettes).filter(item => dateValueInKeys(item.smoked_at || item.created_at, keySet));
    const alcoholUnits = safeArray(state.alcoholUnits).filter(item => dateValueInKeys(item.occurred_at || item.created_at, keySet));
    const tasksDone = safeArray(state.tasks).filter(task => task.status === 'done' && dateValueInKeys(task.completed_at || task.updated_at || task.created_at, keySet));
    const habitEntries = safeArray(state.habitEntries).filter(entry => dateValueInKeys(entry.occurred_at || entry.created_at, keySet));
    const habitDays = new Set(habitEntries.map(entry => toDateKey(entry.occurred_at || entry.created_at)).filter(Boolean)).size;
    const routineDays = new Set(safeArray(state.morningRoutineLogs)
      .filter(log => keySet.has(log.date_key || toDateKey(log.completed_at || log.created_at)))
      .map(log => log.date_key || toDateKey(log.completed_at || log.created_at))).size;
    const runEntries = habitEntries.filter(entry => habitLooksLikeFitness(habitsById.get(entry.habit_id), 'jogging'));
    const hikeEntries = habitEntries.filter(entry => habitLooksLikeFitness(habitsById.get(entry.habit_id), 'hiking'));
    const activeDays = keys.filter(key => dayHasTrackedActivity(state, key)).length;
    const cleanDays = keys.filter(key => dayHasTrackedActivity(state, key) && !cigarettes.some(item => toDateKey(item.smoked_at || item.created_at) === key) && !alcoholUnits.some(item => toDateKey(item.occurred_at || item.created_at) === key)).length;
    const points = sum(keys.map(key => pointsOnDate(state, key)));
    const score = Math.round(sum(keys.map(key => calculateDailyScore(state, key))) / Math.max(1, keys.length));
    const metrics = {
      cigarettes: cigarettes.length,
      alcoholUnits: alcoholUnits.length,
      tasksDone: tasksDone.length,
      habitLogs: habitEntries.length,
      habitDays,
      routineDays,
      runKm: sum(runEntries.map(entry => entry.value_num)),
      hikeKm: sum(hikeEntries.map(entry => entry.value_num)),
      ascentM: sum(hikeEntries.map(entry => parseAscentMeters(entry.note))),
      points,
      activeDays,
      cleanDays
    };

    return {
      id: `weekly-${startKey}`,
      week_key: startKey,
      start_key: startKey,
      end_key: endKey,
      range_label: weeklyReviewRangeLabel(start),
      title: weeklyReviewTitle(score, metrics),
      score,
      metrics,
      highlights: buildWeeklyHighlights(metrics),
      recommendation: weeklyReviewRecommendation(metrics),
      created_at: nowIso(),
      updated_at: nowIso(),
      synced: false
    };
  }

  function hasMeaningfulWeeklyData(review = {}) {
    const metrics = review.metrics || {};
    return ['cigarettes', 'alcoholUnits', 'tasksDone', 'habitLogs', 'routineDays', 'runKm', 'hikeKm', 'ascentM', 'points', 'activeDays', 'cleanDays']
      .some(key => Number(metrics[key] || 0) !== 0);
  }

  function autoSaveCompletedWeeklyReviews() {
    const state = readState();
    if (!state) return { saved: 0 };

    const currentWeekStart = startOfWeekDate(new Date());
    const existingWeekKeys = new Set(safeArray(state.weeklyReviews).map(review => review?.week_key || review?.weekKey || review?.start_key || review?.startKey).filter(Boolean));
    const snapshots = [];

    for (let offset = 1; offset <= MAX_BACKFILL_WEEKS; offset += 1) {
      const start = addDays(currentWeekStart, -7 * offset);
      const weekKey = toDateKey(start);
      if (!weekKey || existingWeekKeys.has(weekKey)) continue;
      const snapshot = buildWeeklyReviewSnapshot(state, start);
      if (!hasMeaningfulWeeklyData(snapshot)) continue;
      snapshots.push(snapshot);
      existingWeekKeys.add(weekKey);
    }

    if (!snapshots.length) return { saved: 0 };

    state.weeklyReviews = safeArray(state.weeklyReviews).concat(snapshots).sort((a, b) => String(b.week_key || '').localeCompare(String(a.week_key || '')));
    writeState(state);
    return { saved: snapshots.length, weeks: snapshots.map(snapshot => snapshot.week_key) };
  }

  const result = autoSaveCompletedWeeklyReviews();

  if (modules && !modules.has('weekly-autosave')) {
    modules.register('weekly-autosave', {
      description: 'Automatically snapshots missing completed weekly reviews before app.js loads, so the normal state and Supabase sync paths pick them up.',
      maxBackfillWeeks: MAX_BACKFILL_WEEKS,
      lastRun: Object.freeze(result)
    });
  }
})(window);
