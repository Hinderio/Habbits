(() => {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const SETTINGS_KEY = 'habitflow-settings-v1';
  const THEME_KEY = 'habitflow-theme';
  const TREND_METRIC_KEY = 'habitflow-trend-metric';
  const COACH_SESSION_KEY = 'habitflow-coach-session-v1';
  const SUPABASE_CONFIG = window.HABITFLOW_SUPABASE_CONFIG || {};
  const MEDITATION_TECHNIQUES = [
    { key: '7-3-11', title: '7-3-11 Atemtechnik', subtitle: 'Runterfahren mit langer Ausatmung', minutes: 6, pattern: '7 ein · 3 halten · 11 aus' },
    { key: 'box', title: 'Box Breathing', subtitle: 'Klarer Fokus vor schwierigen Momenten', minutes: 5, pattern: '4 · 4 · 4 · 4' },
    { key: 'body-scan', title: 'Body Scan', subtitle: 'Körper wahrnehmen und Spannung lösen', minutes: 10, pattern: 'ruhig scannen' },
    { key: 'urge-surf', title: 'Craving-Welle', subtitle: 'Drang beobachten, ohne sofort zu handeln', minutes: 4, pattern: 'wahrnehmen · warten · wählen' },
    { key: 'gratitude', title: 'Dankbarkeits-Minute', subtitle: 'Kurzer mentaler Reset mit positiver Ankerung', minutes: 3, pattern: '3 Dinge benennen' }
  ];

  const SMOKING_TIPS = [
    {
      title: '10-Minuten-Verzögerung',
      body: 'Stell dir innerlich nur ein kleines Ziel: nicht nie wieder, sondern jetzt 10 Minuten später. Öffne danach bewusst neu, ob du wirklich rauchen willst.',
      meta: '+10 Min.'
    },
    {
      title: 'Wasser + kurzer Weg',
      body: 'Trink ein Glas Wasser und geh einmal kurz weg vom Trigger-Ort. Die App soll genau diesen Moment zwischen Reiz und Zigarette stärker machen.',
      meta: 'Reset'
    },
    {
      title: 'Atmung statt Autopilot',
      body: 'Mach 3 ruhige Atemzüge mit langer Ausatmung. Wenn der Druck noch da ist, logge die Craving-Welle und warte eine weitere Minute.',
      meta: 'Atem'
    },
    {
      title: 'Hände beschäftigen',
      body: 'Nimm für 2 Minuten etwas in die Hand: Tee, Kaugummi, Stift, kurzer Notiz-Check. Ziel ist Ablenkung ohne Ersatz-Stress.',
      meta: 'Ablenkung'
    },
    {
      title: 'Trigger bewusst benennen',
      body: 'Sag dir kurz: „Das ist gerade ein Craving, kein Befehl.“ Benenne Ort, Gefühl und nächster kleiner Schritt – dann erst entscheiden.',
      meta: 'Klarheit'
    }
  ];

  const COACH_TRIGGER_META = {
    stress: { label: 'Stress / Druck', action: 'Schultern senken, 3 lange Ausatmungen, dann die kleinste Aufgabe statt Zigarette wählen.', icon: '⚡' },
    coffee: { label: 'Kaffee / Routine', action: 'Tasse wegstellen, Wasser nachziehen und den Ort für 2 Minuten wechseln.', icon: '☕' },
    alcohol: { label: 'Alkohol / Ausgang', action: 'Rauch-Situation verlassen, Glas Wasser bestellen und die nächste Zigarette aktiv um 10 Minuten schieben.', icon: '🍸' },
    boredom: { label: 'Langeweile', action: 'Hände beschäftigen: kurze Nachricht, Kaugummi, Stift oder 20 Schritte gehen.', icon: '〰️' },
    reward: { label: 'Belohnung', action: 'Belohnung ersetzen: Tee, Musik, kurze Dusche oder 5 Minuten frische Luft ohne Zigarette.', icon: '🏆' },
    social: { label: 'Sozialer Moment', action: 'Kurz draussen mitgehen ohne zu rauchen oder bewusst innen bleiben und später neu entscheiden.', icon: '👥' },
    meal: { label: 'Nach dem Essen', action: 'Direkt Zähne putzen, Tee machen oder Küche verlassen. Die Routine wird zuerst gebrochen.', icon: '🍽️' }
  };
  const DAY_MS = 24 * 60 * 60 * 1000;
  const DEFAULT_HABIT_IDS = Object.freeze({
    weight: '00000000-0000-4000-8000-000000000101',
    water: '00000000-0000-4000-8000-000000000102',
    sport: '00000000-0000-4000-8000-000000000103',
    meditation: '00000000-0000-4000-8000-000000000104'
  });
  const SYNC_TABLES = ['habit_definitions', 'habit_entries', 'cigarette_events', 'alcohol_logs', 'tasks', 'points_ledger'];
  const nowIso = () => new Date().toISOString();
  const uid = () => (crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  let state = loadState();
  let settings = loadSettings();
  let supabaseClient = null;
  let syncSubscription = null;
  let syncInFlight = false;
  let lastSyncAt = null;
  let remotePullTimer = null;
  let selectedCalendarDate = toDateKey(new Date());
  let calendarCursor = new Date();
  let charts = { trend: null, points: null };
  let selectedTrendMetric = localStorage.getItem(TREND_METRIC_KEY) || 'points';
  let activeSmokingTipIndex = 0;
  let coachSession = loadCoachSession();
  let editingSmokeId = null;
  let editingHabitId = null;
  let editingTaskId = null;
  let renderQueued = false;

  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheEls();
    applyTheme();
    fillSettingsForm();
    bindEvents();
    await initSupabase();
    initOngoingSync();
    registerServiceWorker();
    render();
    setInterval(() => {
      renderTimers();
      renderCoach();
    }, 30_000);
  }


  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./service-worker.js').catch(error => console.warn('Service Worker konnte nicht registriert werden.', error));
  }

  function cacheEls() {
    Object.assign(els, {
      toast: $('#toast'),
      themeToggle: $('#themeToggle'),
      syncNowBtn: $('#syncNowBtn'),
      navButtons: $$('.nav-btn'),
      screens: $$('.screen'),
      dashboardTitle: $('#dashboardTitle'),
      dashboardSubtitle: $('#dashboardSubtitle'),
      heroSmokeBtn: $('#heroSmokeBtn'),
      heroTaskBtn: $('#heroTaskBtn'),
      heroCoachBtn: $('#heroCoachBtn'),
      totalPoints: $('#totalPoints'),
      levelLabel: $('#levelLabel'),
      levelProgress: $('#levelProgress'),
      currentPause: $('#currentPause'),
      todayCigarettes: $('#todayCigarettes'),
      avgPause7: $('#avgPause7'),
      openTasksCount: $('#openTasksCount'),
      insightsGrid: $('#insightsGrid'),
      habitHeatmap: $('#habitHeatmap'),
      trendMetricSelect: $('#trendMetricSelect'),
      trendChartTitle: $('#trendChartTitle'),
      trendChart: $('#trendChart'),
      pointsChart: $('#pointsChart'),
      recordSmokeBtn: $('#recordSmokeBtn'),
      smokePauseLive: $('#smokePauseLive'),
      smokePauseHint: $('#smokePauseHint'),
      alcoholTodayBtn: $('#alcoholTodayBtn'),
      smokeHistory: $('#smokeHistory'),
      lastSmokePoints: $('#lastSmokePoints'),
      cravingTipTitle: $('#cravingTipTitle'),
      cravingTipBody: $('#cravingTipBody'),
      cravingTipMeta: $('#cravingTipMeta'),
      meditationTechniqueGrid: $('#meditationTechniqueGrid'),
      meditationHistory: $('#meditationHistory'),
      habitForm: $('#habitForm'),
      habitFormTitle: $('#habitFormTitle'),
      habitSubmitBtn: $('#habitSubmitBtn'),
      cancelHabitEditBtn: $('#cancelHabitEditBtn'),
      habitCards: $('#habitCards'),
      taskForm: $('#taskForm'),
      taskFormTitle: $('#taskFormTitle'),
      taskSubmitBtn: $('#taskSubmitBtn'),
      cancelTaskEditBtn: $('#cancelTaskEditBtn'),
      taskPointsPreview: $('#taskPointsPreview'),
      tasksList: $('#tasksList'),
      calendarTitle: $('#calendarTitle'),
      calendarGrid: $('#calendarGrid'),
      selectedDateTitle: $('#selectedDateTitle'),
      dayDetails: $('#dayDetails'),
      prevMonthBtn: $('#prevMonthBtn'),
      todayMonthBtn: $('#todayMonthBtn'),
      nextMonthBtn: $('#nextMonthBtn'),
      settingsForm: $('#settingsForm'),
      manualSyncBtn: $('#manualSyncBtn'),
      logoutBtn: $('#logoutBtn'),
      syncStatus: $('#syncStatus'),
      exportBtn: $('#exportBtn'),
      importInput: $('#importInput'),
      resetBtn: $('#resetBtn'),
      sqlPreview: $('#sqlPreview'),
      copySqlBtn: $('#copySqlBtn'),
      coachUrgeLevel: $('#coachUrgeLevel'),
      coachTrigger: $('#coachTrigger'),
      coachRiskBadge: $('#coachRiskBadge'),
      coachChallengeCard: $('#coachChallengeCard'),
      coachResult: $('#coachResult'),
      coachConfidence: $('#coachConfidence'),
      coachPlanGrid: $('#coachPlanGrid')
    });
  }

  function bindEvents() {
    els.themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light');
      localStorage.setItem(THEME_KEY, document.body.classList.contains('light') ? 'light' : 'dark');
    });

    els.navButtons.forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.target)));
    els.heroSmokeBtn.addEventListener('click', () => recordCigarette());
    els.heroTaskBtn.addEventListener('click', () => showScreen('tasks'));
    if (els.heroCoachBtn) els.heroCoachBtn.addEventListener('click', () => showScreen('coach'));
    els.recordSmokeBtn.addEventListener('click', () => recordCigarette());
    els.alcoholTodayBtn.addEventListener('click', () => toggleAlcoholToday());
    els.trendMetricSelect.addEventListener('change', () => {
      selectedTrendMetric = els.trendMetricSelect.value;
      localStorage.setItem(TREND_METRIC_KEY, selectedTrendMetric);
      renderCharts();
    });
    els.habitForm.addEventListener('submit', createHabit);
    els.taskForm.addEventListener('submit', createTask);
    els.taskForm.elements.effort.addEventListener('change', updateTaskPreview);
    if (els.cancelHabitEditBtn) els.cancelHabitEditBtn.addEventListener('click', resetHabitFormMode);
    if (els.cancelTaskEditBtn) els.cancelTaskEditBtn.addEventListener('click', resetTaskFormMode);
    els.prevMonthBtn.addEventListener('click', () => moveMonth(-1));
    els.nextMonthBtn.addEventListener('click', () => moveMonth(1));
    els.todayMonthBtn.addEventListener('click', () => {
      calendarCursor = new Date();
      selectedCalendarDate = toDateKey(new Date());
      renderCalendar();
      renderDayDetails();
    });
    if (els.settingsForm) {
      els.settingsForm.addEventListener('submit', event => {
        event.preventDefault();
        syncWithSupabase({ silent: false, pullFirst: true });
      });
    }
    if (els.logoutBtn) els.logoutBtn.addEventListener('click', () => syncWithSupabase({ silent: false, pullFirst: true }));
    els.syncNowBtn.addEventListener('click', () => syncWithSupabase({ silent: false, pullFirst: true }));
    els.exportBtn.addEventListener('click', exportJson);
    els.importInput.addEventListener('change', importJson);
    els.resetBtn.addEventListener('click', resetDemo);
    if (els.copySqlBtn) els.copySqlBtn.addEventListener('click', copySql);
    if (els.coachUrgeLevel) els.coachUrgeLevel.addEventListener('change', updateCoachCheckIn);
    if (els.coachTrigger) els.coachTrigger.addEventListener('change', updateCoachCheckIn);

    document.addEventListener('click', event => {
      const actionEl = event.target.closest('[data-action]');
      if (!actionEl) return;
      const { action, id } = actionEl.dataset;
      if (action === 'complete-task') completeTask(id);
      if (action === 'edit-task') editTask(id);
      if (action === 'delete-task') deleteTask(id);
      if (action === 'archive-task') archiveTask(id);
      if (action === 'edit-habit') editHabit(id);
      if (action === 'delete-habit') deleteHabit(id);
      if (action === 'archive-habit') archiveHabit(id);
      if (action === 'log-habit') logHabit(id);
      if (action === 'edit-smoke') editSmoke(id);
      if (action === 'save-smoke-time') saveSmokeTime(id);
      if (action === 'cancel-smoke-edit') cancelSmokeEdit();
      if (action === 'delete-smoke') deleteSmoke(id);
      if (action === 'rotate-craving-tip') rotateSmokingTip();
      if (action === 'log-meditation') logMeditationTechnique(id);
      if (action === 'open-coach') showScreen('coach');
      if (action === 'start-coach-delay') startCoachDelay();
      if (action === 'coach-breath-reset') coachBreathReset();
      if (action === 'coach-record-smoke') coachRecordSmoke();
      if (action === 'select-day') {
        selectedCalendarDate = actionEl.dataset.day;
        renderCalendar();
        renderDayDetails();
      }
    });
  }

  function defaultState() {
    const created = nowIso();
    return {
      version: 1,
      habits: [
        { id: DEFAULT_HABIT_IDS.weight, name: 'Gewicht', type: 'weight', unit: 'kg', direction: 'decrease', target: null, icon: '⚖️', color: '#4ad7d1', is_archived: false, created_at: created, updated_at: created },
        { id: DEFAULT_HABIT_IDS.water, name: 'Wasser', type: 'number', unit: 'Gläser', direction: 'increase', target: 8, icon: '💧', color: '#66e7ff', is_archived: false, created_at: created, updated_at: created },
        { id: DEFAULT_HABIT_IDS.sport, name: 'Sport', type: 'duration', unit: 'Min.', direction: 'increase', target: 30, icon: '🏃', color: '#8ff0a7', is_archived: false, created_at: created, updated_at: created },
        createSystemMeditationHabit(created)
      ],
      habitEntries: [],
      cigarettes: [],
      alcoholLogs: [],
      tasks: [],
      pointsLedger: []
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    } catch (error) {
      console.warn('State konnte nicht geladen werden.', error);
      return defaultState();
    }
  }

  function normalizeState(input) {
    const base = defaultState();
    const next = { ...base, ...input };
    next.habits = Array.isArray(next.habits) ? next.habits : [];
    next.habitEntries = Array.isArray(next.habitEntries) ? next.habitEntries : [];
    next.cigarettes = Array.isArray(next.cigarettes) ? next.cigarettes : [];
    next.alcoholLogs = Array.isArray(next.alcoholLogs) ? next.alcoholLogs : [];
    next.tasks = Array.isArray(next.tasks) ? next.tasks : [];
    next.pointsLedger = Array.isArray(next.pointsLedger) ? next.pointsLedger : [];
    ensureSystemHabits(next);
    return next;
  }

  function createSystemMeditationHabit(created = nowIso()) {
    return {
      id: DEFAULT_HABIT_IDS.meditation,
      name: 'Meditation',
      type: 'duration',
      unit: 'Min.',
      direction: 'increase',
      target: 10,
      icon: '🧘',
      color: '#b79cff',
      system_key: 'meditation',
      is_archived: false,
      created_at: created,
      updated_at: created,
      synced: false
    };
  }

  function ensureSystemHabits(nextState = state) {
    const hasMeditation = nextState.habits.some(h => h.system_key === 'meditation' || String(h.name || '').trim().toLowerCase() === 'meditation');
    if (!hasMeditation) nextState.habits.push(createSystemMeditationHabit());
  }

  function saveState({ skipRender = false } = {}) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!skipRender) queueRender();
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  function loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
      return { email: stored.email || '' };
    } catch {
      return { email: '' };
    }
  }

  function saveSettingsToStorage() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function applyTheme() {
    document.body.classList.toggle('light', localStorage.getItem(THEME_KEY) === 'light');
  }

  function fillSettingsForm() {
    if (els.settingsForm?.email) els.settingsForm.email.value = settings.email || '';
    if (els.sqlPreview) els.sqlPreview.textContent = window.HABITFLOW_SUPABASE_SQL || 'supabase.sql konnte nicht geladen werden.';
  }

  function showScreen(screen) {
    els.navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.target === screen));
    els.screens.forEach(view => view.classList.toggle('active', view.dataset.screen === screen));
    if (screen === 'calendar') {
      renderCalendar();
      renderDayDetails();
    }
    if (screen === 'coach') renderCoach();
  }

  function render() {
    renderTimers();
    renderDashboard();
    renderSmoking();
    renderMeditation();
    renderHabits();
    renderTasks();
    renderCoach();
    renderCalendar();
    renderDayDetails();
    renderSyncStatus();
  }

  function renderTimers() {
    const last = getLastCigarette();
    const pauseText = last ? formatDuration((Date.now() - new Date(last.smoked_at).getTime()) / 60000) : '–';
    els.currentPause.textContent = pauseText;
    els.smokePauseLive.textContent = pauseText;
    els.smokePauseHint.textContent = last ? `Letzte Zigarette: ${formatDateTime(last.smoked_at)}` : 'Noch kein Eintrag vorhanden';
  }

  function renderDashboard() {
    const total = getTotalPoints();
    const level = Math.floor(total / 500) + 1;
    const levelPoints = total % 500;
    els.totalPoints.textContent = total.toLocaleString('de-CH');
    els.levelLabel.textContent = `Level ${level}`;
    els.levelProgress.style.width = `${Math.min(100, (levelPoints / 500) * 100)}%`;
    const todayKey = toDateKey(new Date());
    const todayCount = cigarettesOnDate(todayKey).length;
    const habitLogsToday = state.habitEntries.filter(e => toDateKey(e.occurred_at) === todayKey).length;
    const completedToday = state.tasks.filter(t => t.status === 'done' && toDateKey(t.completed_at || t.updated_at || t.created_at) === todayKey).length;
    els.todayCigarettes.textContent = todayCount;
    els.avgPause7.textContent = habitLogsToday;
    els.openTasksCount.textContent = state.tasks.filter(t => t.status === 'open').length;

    els.dashboardTitle.textContent = 'Dein Fortschritt auf einen Blick.';
    els.dashboardSubtitle.textContent = habitLogsToday || completedToday || todayCount
      ? `${habitLogsToday} Habit-Log${habitLogsToday === 1 ? '' : 's'}, ${completedToday} erledigte Aufgabe${completedToday === 1 ? '' : 'n'} und ${todayCount} Zigarette${todayCount === 1 ? '' : 'n'} heute.`
      : 'Wähle eine Auswertung, erfasse kleine Schritte und halte deine wichtigsten Muster sichtbar.';

    renderTrendOptions();
    renderInsights();
    renderHabitHeatmap();
    renderCharts();
  }

  function renderInsights() {
    const last7 = daysBack(7);
    const cigarettes7 = state.cigarettes.filter(c => last7.includes(toDateKey(c.smoked_at))).length;
    const alcoholDays7 = state.alcoholLogs.filter(a => last7.includes(a.log_date) && a.consumed).length;
    const completed7 = state.tasks.filter(t => t.status === 'done' && last7.includes(toDateKey(t.completed_at || t.updated_at || t.created_at))).length;
    const bestPause = bestPauseMinutes();
    const insights = [
      { title: '7-Tage-Konsum', body: `${cigarettes7} Zigaretten in den letzten 7 Tagen. Der Trend wird aussagekräftiger, je konsequenter du trackst.` },
      { title: 'Alkohol-Kontext', body: alcoholDays7 ? `${alcoholDays7} Alkohol-Tag(e) in 7 Tagen. Vergleiche diese Tage bewusst mit Rauch-Peaks.` : 'Keine Alkohol-Tage in den letzten 7 Tagen getrackt.' },
      { title: 'Task-Momentum', body: `${completed7} Aufgabe(n) diese Woche abgeschlossen. Aufwand zahlt direkt auf Punkte ein.` },
      { title: 'Beste Pause', body: bestPause ? `Längste Pause bisher: ${formatDuration(bestPause)}. Das ist dein aktueller Highscore.` : 'Noch keine Intervall-Daten vorhanden.' }
    ];
    els.insightsGrid.innerHTML = insights.map(item => `<article class="insight-card"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p></article>`).join('');
  }


  function renderTrendOptions() {
    if (!els.trendMetricSelect) return;
    const options = getTrendMetricOptions();
    if (!options.some(option => option.value === selectedTrendMetric)) {
      selectedTrendMetric = options[0]?.value || 'points';
      localStorage.setItem(TREND_METRIC_KEY, selectedTrendMetric);
    }
    const current = els.trendMetricSelect.value;
    const nextHtml = options.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('');
    if (els.trendMetricSelect.innerHTML !== nextHtml) els.trendMetricSelect.innerHTML = nextHtml;
    if (current !== selectedTrendMetric) els.trendMetricSelect.value = selectedTrendMetric;
  }

  function getTrendMetricOptions() {
    const activeHabits = state.habits.filter(h => !h.is_archived);
    return [
      { value: 'points', label: 'Punkte' },
      { value: 'cigarettes', label: 'Zigaretten' },
      { value: 'alcohol', label: 'Alkohol-Tage' },
      ...activeHabits.map(habit => ({ value: `habit:${habit.id}`, label: `${habit.icon || '✨'} ${habit.name}` }))
    ];
  }

  function getTrendMetricConfig(keys) {
    if (selectedTrendMetric === 'cigarettes') {
      return { title: 'Zigaretten pro Tag', label: 'Zigaretten', data: keys.map(k => cigarettesOnDate(k).length), beginAtZero: true };
    }
    if (selectedTrendMetric === 'alcohol') {
      return { title: 'Alkohol-Kontext', label: 'Alkohol', data: keys.map(k => alcoholForDate(k)?.consumed ? 1 : 0), beginAtZero: true };
    }
    if (selectedTrendMetric.startsWith('habit:')) {
      const habitId = selectedTrendMetric.slice(6);
      const habit = state.habits.find(h => h.id === habitId && !h.is_archived);
      if (habit) {
        return {
          title: `${habit.name} Verlauf`,
          label: habit.unit || typeLabel(habit.type),
          data: keys.map(k => habitValueForDay(habit, k).value),
          beginAtZero: habit.type !== 'weight'
        };
      }
    }
    selectedTrendMetric = 'points';
    return { title: 'Punkteentwicklung', label: 'Punkte', data: keys.map(k => pointsOnDate(k)), beginAtZero: true };
  }

  function renderHabitHeatmap() {
    if (!els.habitHeatmap) return;
    const activeHabits = state.habits.filter(h => !h.is_archived);
    const keys = daysBack(14);
    if (!activeHabits.length) {
      els.habitHeatmap.innerHTML = '<div class="empty-state">Noch keine aktiven Habits vorhanden. Sobald du Habits anlegst oder loggst, erscheint hier dein Rhythmus.</div>';
      return;
    }

    const header = keys.map(key => {
      const date = new Date(`${key}T12:00:00`);
      return `<div class="heatmap-day-label"><span>${date.toLocaleDateString('de-CH', { weekday: 'short' }).slice(0, 2)}</span><strong>${date.getDate()}</strong></div>`;
    }).join('');

    const rows = activeHabits.map(habit => {
      const cells = keys.map(key => {
        const day = habitValueForDay(habit, key);
        const level = day.logged ? (day.ratio >= 1 ? 'is-full' : day.ratio >= .5 ? 'is-mid' : 'is-low') : 'is-empty';
        return `<span class="heatmap-cell ${level}" title="${escapeHtml(habit.name)} · ${key}: ${escapeHtml(day.label)}"></span>`;
      }).join('');
      return `<div class="heatmap-row-label"><span>${escapeHtml(habit.icon || '✨')}</span><strong>${escapeHtml(habit.name)}</strong></div>${cells}`;
    }).join('');

    els.habitHeatmap.innerHTML = `<div class="heatmap-scroll"><div class="heatmap-grid" style="--heatmap-days:${keys.length}"><div class="heatmap-corner">Habit</div>${header}${rows}</div></div>`;
  }

  function habitValueForDay(habit, key) {
    const entries = entriesForHabitOnDate(habit.id, key).sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
    if (!entries.length) return { value: null, label: 'kein Eintrag', logged: false, ratio: 0 };
    if (habit.type === 'boolean') {
      const done = entries.some(e => e.value_bool);
      return { value: done ? 1 : 0, label: done ? 'Ja' : 'Nein', logged: true, ratio: done ? 1 : .25 };
    }
    const unit = habit.unit || defaultUnit(habit.type);
    let value;
    if (habit.type === 'weight') {
      value = Number(entries[entries.length - 1].value_num || 0);
    } else {
      value = sum(entries.map(e => Number(e.value_num || 0)));
    }
    const ratio = habit.target
      ? habit.direction === 'decrease'
        ? (value <= Number(habit.target) ? 1 : Math.max(.15, Number(habit.target) / Math.max(value, .01)))
        : Math.min(1, value / Math.abs(Number(habit.target)))
      : 1;
    const display = `${Number.isInteger(value) ? value : value.toFixed(2)} ${unit}`.trim();
    return { value, label: display, logged: true, ratio };
  }

  function renderMeditation() {
    if (!els.meditationTechniqueGrid || !els.meditationHistory) return;
    const meditationHabit = getMeditationHabit({ createIfMissing: true });
    els.meditationTechniqueGrid.innerHTML = MEDITATION_TECHNIQUES.map(technique => `<article class="meditation-card">
      <div>
        <strong>${escapeHtml(technique.title)}</strong>
        <p>${escapeHtml(technique.subtitle)}</p>
        <small>${escapeHtml(technique.pattern)} · ${technique.minutes} Min.</small>
      </div>
      <button class="mini-btn primary" type="button" data-action="log-meditation" data-id="${escapeHtml(technique.key)}">Loggen</button>
    </article>`).join('');

    const sessions = state.habitEntries
      .filter(entry => entry.habit_id === meditationHabit.id)
      .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
      .slice(0, 5);

    if (!sessions.length) {
      els.meditationHistory.innerHTML = '<div class="empty-state">Noch keine Meditation erfasst. Wähle oben eine Technik – sie wird als normaler Habit-Eintrag gespeichert und synchronisiert.</div>';
      return;
    }

    els.meditationHistory.innerHTML = sessions.map(session => `<article class="list-card">
      <div class="list-card-main">
        <h4>${escapeHtml(session.note || 'Meditation')}</h4>
        <p class="meta">${formatDateTime(session.occurred_at)} · ${formatHabitValue(meditationHabit, session.value_num || 0)}</p>
      </div>
    </article>`).join('');
  }

  function logMeditationTechnique(key) {
    const technique = MEDITATION_TECHNIQUES.find(item => item.key === key);
    if (!technique) return;
    const meditationHabit = getMeditationHabit({ createIfMissing: true });
    const occurredAt = nowIso();
    const entry = {
      id: uid(),
      habit_id: meditationHabit.id,
      value_num: technique.minutes,
      value_bool: null,
      note: technique.title,
      occurred_at: occurredAt,
      created_at: occurredAt,
      updated_at: occurredAt,
      synced: false
    };
    state.habitEntries.push(entry);
    const points = habitPoints(meditationHabit, entry);
    addPoints('habit', entry.id, points, `${technique.title} abgeschlossen`, occurredAt);
    saveState();
    toast(`${technique.title} geloggt · +${points} Punkte`);
    syncWithSupabase({ silent: true });
  }

  function getMeditationHabit({ createIfMissing = false } = {}) {
    let habit = state.habits.find(h => h.system_key === 'meditation' || String(h.name || '').trim().toLowerCase() === 'meditation');
    if (!habit && createIfMissing) {
      habit = createSystemMeditationHabit();
      state.habits.push(habit);
    }
    return habit;
  }

  function isSystemMeditationHabit(habit) {
    return Boolean(habit && (habit.system_key === 'meditation' || habit.id === DEFAULT_HABIT_IDS.meditation || String(habit.name || '').trim().toLowerCase() === 'meditation'));
  }

  function renderSmoking() {
    const todayAlcohol = alcoholForDate(toDateKey(new Date()));
    els.alcoholTodayBtn.textContent = todayAlcohol?.consumed ? 'Ja' : 'Nein';
    els.alcoholTodayBtn.classList.toggle('is-on', Boolean(todayAlcohol?.consumed));
    els.alcoholTodayBtn.setAttribute('aria-pressed', String(Boolean(todayAlcohol?.consumed)));
    const last = getLastCigarette();
    els.lastSmokePoints.textContent = `${last?.points || 0} Pkt.`;
    renderSmokingTip(last);

    const items = [...state.cigarettes]
      .sort((a, b) => new Date(b.smoked_at) - new Date(a.smoked_at))
      .slice(0, 25);

    if (!items.length) {
      els.smokeHistory.innerHTML = '<div class="empty-state">Noch keine Zigarette erfasst. Der Button ist bewusst gross, damit Tracking in 1 Sekunde erledigt ist.</div>';
      return;
    }

    els.smokeHistory.innerHTML = items.map(c => {
      const cls = c.points < 0 ? 'danger-text' : c.points >= 40 ? 'positive-text' : '';
      const isEditing = editingSmokeId === c.id;
      const editBlock = isEditing
        ? `<div class="smoke-edit-row">
            <label><span>Zeitpunkt</span><input id="smoke-input-${c.id}" type="datetime-local" value="${toDateTimeLocalValue(c.smoked_at)}" /></label>
            <button class="mini-btn primary" type="button" data-action="save-smoke-time" data-id="${c.id}">Speichern</button>
            <button class="mini-btn" type="button" data-action="cancel-smoke-edit" data-id="${c.id}">Abbrechen</button>
          </div>`
        : '';
      return `<article class="list-card ${isEditing ? 'is-editing' : ''}">
        <div class="list-card-main">
          <h4>${formatDateTime(c.smoked_at)}</h4>
          <p class="meta">Pause davor: <strong>${c.interval_minutes == null ? '–' : formatDuration(c.interval_minutes)}</strong>${c.alcohol_context ? ' · Alkohol-Kontext' : ''}</p>
          ${editBlock}
        </div>
        <div class="list-actions">
          <span class="badge ${cls ? '' : 'muted'} ${cls}">${c.points > 0 ? '+' : ''}${c.points} Pkt.</span>
          ${isEditing ? '' : `<button class="mini-btn" type="button" data-action="edit-smoke" data-id="${c.id}">Bearbeiten</button>`}
          <button class="mini-btn danger" type="button" data-action="delete-smoke" data-id="${c.id}">Löschen</button>
        </div>
      </article>`;
    }).join('');
  }


  function renderSmokingTip(last = getLastCigarette()) {
    if (!els.cravingTipTitle || !els.cravingTipBody || !els.cravingTipMeta) return;
    const pauseMinutes = last ? Math.max(0, Math.floor((Date.now() - new Date(last.smoked_at).getTime()) / 60000)) : null;
    const contextIndex = getContextualSmokingTipIndex(pauseMinutes);
    const tip = SMOKING_TIPS[(activeSmokingTipIndex || contextIndex) % SMOKING_TIPS.length] || SMOKING_TIPS[contextIndex];
    const nextGoal = getNextPauseGoalMinutes(pauseMinutes);
    const goalText = pauseMinutes == null
      ? 'Erste Pause bewusst starten'
      : `Mini-Ziel: ${formatDuration(nextGoal)}`;

    els.cravingTipTitle.textContent = tip.title;
    els.cravingTipBody.innerHTML = `${escapeHtml(tip.body)} <strong>${escapeHtml(goalText)}</strong>`;
    els.cravingTipMeta.textContent = tip.meta;
  }

  function getContextualSmokingTipIndex(pauseMinutes) {
    const alcoholToday = Boolean(alcoholForDate(toDateKey(new Date()))?.consumed);
    if (alcoholToday) return 4;
    if (pauseMinutes == null) return 0;
    if (pauseMinutes < 10) return 2;
    if (pauseMinutes < 30) return 0;
    if (pauseMinutes < 90) return 1;
    return 3;
  }

  function getNextPauseGoalMinutes(pauseMinutes) {
    if (pauseMinutes == null) return 10;
    if (pauseMinutes < 30) return Math.min(30, pauseMinutes + 10);
    if (pauseMinutes < 60) return 60;
    if (pauseMinutes < 120) return 120;
    if (pauseMinutes < 240) return 240;
    return pauseMinutes + 30;
  }

  function rotateSmokingTip() {
    activeSmokingTipIndex = (activeSmokingTipIndex + 1) % SMOKING_TIPS.length;
    renderSmokingTip();
  }



  function loadCoachSession() {
    try {
      const raw = localStorage.getItem(COACH_SESSION_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        urgeLevel: Math.max(1, Math.min(5, Number(parsed.urgeLevel || 3))),
        trigger: COACH_TRIGGER_META[parsed.trigger] ? parsed.trigger : 'stress',
        delayUntil: Number(parsed.delayUntil || 0),
        delayStartedAt: Number(parsed.delayStartedAt || 0)
      };
    } catch {
      return { urgeLevel: 3, trigger: 'stress', delayUntil: 0, delayStartedAt: 0 };
    }
  }

  function saveCoachSession() {
    localStorage.setItem(COACH_SESSION_KEY, JSON.stringify(coachSession));
  }

  function updateCoachCheckIn() {
    coachSession.urgeLevel = Math.max(1, Math.min(5, Number(els.coachUrgeLevel?.value || 3)));
    coachSession.trigger = COACH_TRIGGER_META[els.coachTrigger?.value] ? els.coachTrigger.value : 'stress';
    saveCoachSession();
    renderCoach();
  }

  function buildCoachInsight() {
    const now = new Date();
    const todayKey = toDateKey(now);
    const last = getLastCigarette();
    const pauseMinutes = last ? Math.max(0, Math.floor((Date.now() - new Date(last.smoked_at).getTime()) / 60000)) : null;
    const todayCount = cigarettesOnDate(todayKey).length;
    const last7Keys = daysBack(7);
    const cigarettes7 = state.cigarettes.filter(c => last7Keys.includes(toDateKey(c.smoked_at))).length;
    const avgPerDay = cigarettes7 ? cigarettes7 / 7 : 0;
    const alcoholToday = Boolean(alcoholForDate(todayKey)?.consumed);
    const trigger = COACH_TRIGGER_META[coachSession.trigger] || COACH_TRIGGER_META.stress;
    const urge = Math.max(1, Math.min(5, Number(coachSession.urgeLevel || 3)));
    const bestPause = bestPauseMinutes();
    const hour = now.getHours();
    const activeDelay = coachSession.delayUntil && coachSession.delayUntil > Date.now();
    const delayDone = coachSession.delayUntil && coachSession.delayUntil <= Date.now() && Date.now() - coachSession.delayUntil < 90 * 60 * 1000;

    let risk = 18 + urge * 11;
    if (pauseMinutes == null) risk -= 6;
    else if (pauseMinutes < 10) risk += 20;
    else if (pauseMinutes < 30) risk += 16;
    else if (pauseMinutes < 60) risk += 8;
    else if (pauseMinutes >= 120) risk -= 8;
    if (alcoholToday || coachSession.trigger === 'alcohol') risk += 15;
    if (todayCount > Math.max(1, Math.ceil(avgPerDay))) risk += 10;
    if (hour >= 21 || hour < 7) risk += 6;
    if (activeDelay) risk -= 10;
    risk = Math.max(8, Math.min(95, Math.round(risk)));

    let label = 'Stabil';
    let tone = 'low';
    if (risk >= 72) { label = 'Akut'; tone = 'high'; }
    else if (risk >= 48) { label = 'Wachsam'; tone = 'mid'; }

    let headline = 'Baue die nächste Pause aus.';
    let coachLine = 'Du bist nicht im Autopilot. Du brauchst jetzt keine perfekte Entscheidung, nur den nächsten kleinen besseren Schritt.';
    if (!last) {
      headline = 'Starte deinen Referenzpunkt.';
      coachLine = 'Noch kein Rauchverlauf vorhanden. Tracke ehrlich, dann kann der Coach immer genauer werden.';
    } else if (activeDelay) {
      headline = 'Nicht verhandeln – halten.';
      coachLine = 'Der wichtigste Teil läuft bereits: Du hast eine Pause aktiv verlängert. Bleib bei der Challenge bis der Timer durch ist.';
    } else if (pauseMinutes < 30) {
      headline = 'Nicht nachlegen. Erst 10 Minuten Puffer.';
      coachLine = 'Der Abstand ist noch kurz. Genau hier entstehen Ketten. Ziel ist nicht Verzicht für immer, sondern diese eine Lücke zu vergrössern.';
    } else if (alcoholToday || coachSession.trigger === 'alcohol') {
      headline = 'Alkohol-Trigger entschärfen.';
      coachLine = 'Heute zählt Umgebung stärker als Willenskraft. Verlasse kurz die Rauch-Situation und trink Wasser, bevor du neu entscheidest.';
    } else if (urge >= 4) {
      headline = 'Drang ist hoch – Welle reiten.';
      coachLine = 'Ein starkes Craving ist unangenehm, aber nicht automatisch ein Auftrag. Beobachte es ein paar Minuten und verschiebe die Entscheidung.';
    } else if (todayCount > Math.max(1, Math.ceil(avgPerDay))) {
      headline = 'Heute nicht eskalieren.';
      coachLine = 'Du liegst über deinem aktuellen Muster. Ein einziges Delay kann den Tag wieder stabilisieren.';
    }

    const nextGoal = getNextPauseGoalMinutes(pauseMinutes);
    const microGoal = pauseMinutes == null ? 'Erste Pause setzen' : `${formatDuration(pauseMinutes)} → ${formatDuration(nextGoal)}`;
    const comparison = avgPerDay ? `${todayCount} heute · Ø ${avgPerDay.toFixed(1).replace('.', ',')}/Tag` : `${todayCount} heute · noch wenig Historie`;
    const bestText = bestPause ? formatDuration(bestPause) : '–';
    const stage = pauseMinutes == null ? 'Start' : pauseMinutes < 30 ? 'Akutphase' : pauseMinutes < 120 ? 'Aufbau' : 'Highscore-Jagd';

    const steps = [
      { icon: '⏱️', title: 'Delay', body: activeDelay ? 'Timer fertig laufen lassen. Keine neue Diskussion starten.' : '10-Minuten-Challenge starten und erst danach neu entscheiden.' },
      { icon: '💧', title: 'Reset', body: 'Ein Glas Wasser und mindestens 20 Schritte weg vom Trigger-Ort.' },
      { icon: trigger.icon, title: trigger.label, body: trigger.action }
    ];

    return { risk, label, tone, headline, coachLine, microGoal, comparison, bestText, stage, pauseMinutes, todayCount, avgPerDay, alcoholToday, trigger, urge, activeDelay, delayDone, steps };
  }

  function renderCoach() {
    if (!els.coachResult || !els.coachPlanGrid) return;
    if (els.coachUrgeLevel && String(els.coachUrgeLevel.value) !== String(coachSession.urgeLevel)) els.coachUrgeLevel.value = String(coachSession.urgeLevel);
    if (els.coachTrigger && els.coachTrigger.value !== coachSession.trigger) els.coachTrigger.value = coachSession.trigger;

    const insight = buildCoachInsight();
    const badgeClass = insight.tone === 'high' ? 'danger-badge' : insight.tone === 'mid' ? 'warning-badge' : 'muted';
    if (els.coachRiskBadge) {
      els.coachRiskBadge.className = `badge ${badgeClass}`;
      els.coachRiskBadge.textContent = insight.label;
    }
    if (els.coachConfidence) {
      els.coachConfidence.className = `coach-confidence-score is-${insight.tone}`;
      els.coachConfidence.innerHTML = `<strong>${insight.risk}%</strong><span>Risiko</span>`;
    }

    els.coachChallengeCard.innerHTML = renderCoachChallenge(insight);
    els.coachResult.innerHTML = `
      <div class="coach-result-topline"><small>${escapeHtml(insight.stage)} · Drang ${insight.urge}/5</small><h3>${escapeHtml(insight.headline)}</h3><p>${escapeHtml(insight.coachLine)}</p></div>
      <div class="coach-tip-grid">
        <article><span>Mini-Ziel</span><strong>${escapeHtml(insight.microGoal)}</strong></article>
        <article><span>Heute</span><strong>${escapeHtml(insight.comparison)}</strong></article>
        <article><span>Beste Pause</span><strong>${escapeHtml(insight.bestText)}</strong></article>
        <article><span>Kontext</span><strong>${insight.alcoholToday ? 'Alkohol aktiv' : escapeHtml(insight.trigger.label)}</strong></article>
      </div>
      <div class="coach-callout"><b>Coach sagt:</b> ${escapeHtml(insight.steps[0].body)} <em>${escapeHtml(insight.microGoal)}</em></div>`;
    els.coachPlanGrid.innerHTML = insight.steps.map((step, index) => `<article class="coach-plan-card"><span>${step.icon}</span><small>Schritt ${index + 1}</small><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.body)}</p></article>`).join('');
  }

  function renderCoachChallenge(insight) {
    const remainingMs = Math.max(0, Number(coachSession.delayUntil || 0) - Date.now());
    if (remainingMs > 0) {
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      return `<div><p class="eyebrow">Challenge läuft</p><h3>${remainingMinutes} Min. halten</h3><span>Bis ${new Date(coachSession.delayUntil).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}. Danach bewusst neu entscheiden – nicht automatisch.</span></div><div class="coach-challenge-meter"><i style="width:${coachChallengeProgress()}%"></i></div>`;
    }
    if (insight.delayDone) {
      return `<div><p class="eyebrow">Geschafft</p><h3>Delay abgeschlossen.</h3><span>Du hast den Autopilot unterbrochen. Jetzt neu wählen: noch 10 Minuten, Atem-Reset oder bewusst loggen.</span></div>`;
    }
    return `<div><p class="eyebrow">Mini-Challenge</p><h3>Nur die nächste Lücke zählt.</h3><span>Starte einen 10-Minuten-Puffer. Der Coach merkt sich den Timer auch nach einem Refresh.</span></div>`;
  }

  function coachChallengeProgress() {
    const start = Number(coachSession.delayStartedAt || 0);
    const end = Number(coachSession.delayUntil || 0);
    if (!start || !end || end <= start) return 0;
    return Math.max(4, Math.min(100, ((Date.now() - start) / (end - start)) * 100));
  }

  function startCoachDelay() {
    const now = Date.now();
    coachSession.delayStartedAt = now;
    coachSession.delayUntil = now + 10 * 60 * 1000;
    saveCoachSession();
    renderCoach();
    toast('10-Minuten-Challenge gestartet');
  }

  function coachBreathReset() {
    logMeditationTechnique('urge-surf');
    startCoachDelay();
  }

  function coachRecordSmoke() {
    recordCigarette();
    coachSession.delayUntil = 0;
    coachSession.delayStartedAt = 0;
    saveCoachSession();
    showScreen('smoking');
  }

  function renderHabits() {
    const activeHabits = state.habits.filter(h => !h.is_archived);
    if (!activeHabits.length) {
      els.habitCards.innerHTML = '<div class="empty-state">Lege deine erste flexible Gewohnheit an. Unterstützt werden Gewicht, Zahlen, Ja/Nein und Dauer.</div>';
      return;
    }

    els.habitCards.innerHTML = activeHabits.map(habit => {
      const todayEntries = entriesForHabitOnDate(habit.id, toDateKey(new Date()));
      const todayValue = habit.type === 'boolean'
        ? todayEntries.some(e => e.value_bool)
        : todayEntries.reduce((sum, e) => sum + Number(e.value_num || 0), 0);
      const progress = habit.target ? Math.min(100, Math.abs(Number(todayValue || 0) / Number(habit.target)) * 100) : 0;
      const unit = habit.unit || defaultUnit(habit.type);
      const control = habit.type === 'boolean'
        ? `<button class="pill primary" type="button" data-action="log-habit" data-id="${habit.id}">${todayValue ? 'Heute erledigt' : 'Heute abhaken'}</button>`
        : `<div class="habit-log-row"><input id="habit-input-${habit.id}" type="number" step="0.01" placeholder="Wert ${unit ? `(${escapeHtml(unit)})` : ''}" /><button class="pill primary" type="button" data-action="log-habit" data-id="${habit.id}">Loggen</button></div>`;
      const isSystemHabit = isSystemMeditationHabit(habit);
      const habitActions = `
        <button class="mini-btn" type="button" data-action="edit-habit" data-id="${habit.id}">Bearbeiten</button>
        <button class="mini-btn" type="button" data-action="archive-habit" data-id="${habit.id}">Archiv</button>
        ${isSystemHabit ? '<span class="badge muted">System</span>' : `<button class="mini-btn danger" type="button" data-action="delete-habit" data-id="${habit.id}">Löschen</button>`}`;

      return `<article class="habit-card ${editingHabitId === habit.id ? 'is-editing' : ''}">
        <div class="habit-card-head">
          <div class="habit-title"><span class="habit-icon">${escapeHtml(habit.icon || '✨')}</span><div><strong>${escapeHtml(habit.name)}</strong><small>${habit.typeLabel || typeLabel(habit.type)}${unit ? ` · ${escapeHtml(unit)}` : ''}</small></div></div>
          <div class="list-actions">${habitActions}</div>
        </div>
        ${control}
        <div class="meta" style="margin-top:10px">Heute: <strong>${formatHabitValue(habit, todayValue)}</strong>${habit.target ? ` · Ziel: ${habit.target} ${escapeHtml(unit)}` : ''}</div>
        ${habit.target ? `<div class="habit-progress-track"><i style="width:${progress}%"></i></div>` : ''}
      </article>`;
    }).join('');
  }

  function renderTasks() {
    const open = state.tasks
      .filter(t => t.status === 'open')
      .sort((a, b) => sortDate(a.due_at) - sortDate(b.due_at));
    if (!open.length) {
      els.tasksList.innerHTML = '<div class="empty-state">Keine offenen Aufgaben. Neue Aufgaben erhalten je nach Aufwand Punkte beim Abschliessen.</div>';
      return;
    }
    els.tasksList.innerHTML = open.map(task => `<article class="list-card ${editingTaskId === task.id ? 'is-editing' : ''}">
      <div class="list-card-main">
        <h4>${escapeHtml(task.title)}</h4>
        <p class="meta">Aufwand ${task.effort}/5 · ${task.due_at ? `Fällig ${formatDateTime(task.due_at)}` : 'ohne Fälligkeitsdatum'}${task.description ? `<br>${escapeHtml(task.description)}` : ''}</p>
      </div>
      <div class="list-actions">
        <span class="badge">+${taskPoints(task)} Pkt.</span>
        <button class="mini-btn primary" type="button" data-action="complete-task" data-id="${task.id}">Erledigt</button>
        <button class="mini-btn" type="button" data-action="edit-task" data-id="${task.id}">Bearbeiten</button>
        <button class="mini-btn" type="button" data-action="archive-task" data-id="${task.id}">Archiv</button>
        <button class="mini-btn danger" type="button" data-action="delete-task" data-id="${task.id}">Löschen</button>
      </div>
    </article>`).join('');
  }

  function renderCalendar() {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    els.calendarTitle.textContent = calendarCursor.toLocaleDateString('de-CH', { month: 'long', year: 'numeric' });

    const first = new Date(year, month, 1);
    const start = new Date(first);
    const day = first.getDay() || 7;
    start.setDate(first.getDate() - day + 1);

    const cells = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = toDateKey(date);
      const cigarettes = cigarettesOnDate(key).length;
      const tasks = state.tasks.filter(t => toDateKey(t.due_at || t.completed_at || t.created_at) === key);
      const alcohol = alcoholForDate(key)?.consumed;
      const points = calendarPointsOnDate(key);
      const chips = [];
      if (cigarettes) chips.push(`<span class="day-chip smoke">${cigarettes} Zig.</span>`);
      if (tasks.length) chips.push(`<span class="day-chip task">${tasks.length} Task</span>`);
      if (alcohol) chips.push('<span class="day-chip alcohol">Alk.</span>');
      cells.push(`<button class="calendar-day ${date.getMonth() !== month ? 'is-muted' : ''} ${key === toDateKey(new Date()) ? 'is-today' : ''} ${key === selectedCalendarDate ? 'is-selected' : ''}" type="button" data-action="select-day" data-day="${key}">
        <span class="calendar-day-head"><strong>${date.getDate()}</strong>${points ? `<em class="day-points">${points > 0 ? '+' : ''}${points}</em>` : ''}</span>
        <span class="day-chips">${chips.join('')}</span>
      </button>`);
    }
    els.calendarGrid.innerHTML = cells.join('');
  }

  function renderDayDetails() {
    const key = selectedCalendarDate;
    els.selectedDateTitle.textContent = new Date(`${key}T12:00:00`).toLocaleDateString('de-CH', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const details = [];
    const cigarettes = cigarettesOnDate(key);
    if (cigarettes.length) details.push(`<article class="list-card"><div><h4>Rauchen</h4><p class="meta">${cigarettes.length} Zigarette(n), ${sum(cigarettes.map(c => c.points))} Punkte</p></div></article>`);
    const alcohol = alcoholForDate(key);
    if (alcohol) details.push(`<article class="list-card"><div><h4>Alkohol</h4><p class="meta">${alcohol.consumed ? 'Ja' : 'Nein'} getrackt</p></div></article>`);
    const tasks = state.tasks.filter(t => toDateKey(t.due_at || t.completed_at || t.created_at) === key);
    tasks.forEach(t => details.push(`<article class="list-card ${t.status === 'done' ? 'done' : ''}"><div><h4>${escapeHtml(t.title)}</h4><p class="meta">${t.status === 'done' ? 'Erledigt' : 'Offen'} · Aufwand ${t.effort}/5</p></div></article>`));
    els.dayDetails.innerHTML = details.length ? details.join('') : '<div class="empty-state">Für diesen Tag gibt es noch keine Einträge.</div>';
  }

  function renderCharts() {
    if (!window.Chart) return;
    const keys = daysBack(14);
    const labels = keys.map(k => new Date(`${k}T12:00:00`).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' }));
    const trend = getTrendMetricConfig(keys);
    const pointsData = keys.map(k => pointsOnDate(k));
    if (els.trendChartTitle) els.trendChartTitle.textContent = trend.title;
    charts.trend = drawChart(charts.trend, els.trendChart, labels, trend.data, trend.label, { beginAtZero: trend.beginAtZero });
    charts.points = drawChart(charts.points, els.pointsChart, labels, pointsData, 'Punkte', { beginAtZero: true });
  }

  function drawChart(existing, canvas, labels, data, label, options = {}) {
    if (!canvas) return existing;
    if (existing) {
      existing.data.labels = labels;
      existing.data.datasets[0].data = data;
      existing.data.datasets[0].label = label;
      existing.options.scales.y.beginAtZero = options.beginAtZero !== false;
      existing.update();
      return existing;
    }
    return new Chart(canvas, {
      type: 'line',
      data: { labels, datasets: [{ label, data, tension: .42, fill: true, spanGaps: true, pointRadius: 3 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--muted') || '#9db0c3' } },
          y: { beginAtZero: options.beginAtZero !== false, ticks: { precision: 0, color: getComputedStyle(document.documentElement).getPropertyValue('--muted') || '#9db0c3' }, grid: { color: 'rgba(255,255,255,.07)' } }
        }
      }
    });
  }

  function recordCigarette() {
    const smokedAt = nowIso();
    const last = getLastCigarette();
    const interval = last ? Math.max(0, Math.round((new Date(smokedAt) - new Date(last.smoked_at)) / 60000)) : null;
    const points = cigarettePoints(interval);
    const todayAlcohol = Boolean(alcoholForDate(toDateKey(new Date()))?.consumed);
    const entry = { id: uid(), smoked_at: smokedAt, interval_minutes: interval, alcohol_context: todayAlcohol, points, note: '', created_at: smokedAt, updated_at: smokedAt, synced: false };
    state.cigarettes.push(entry);
    addPoints('cigarette', entry.id, points, interval == null ? 'Erste Zigarette erfasst' : `Pause ${formatDuration(interval)}`, smokedAt);
    saveState();
    toast(points >= 0 ? `Zigarette erfasst · +${points} Punkte` : `Zigarette erfasst · ${points} Punkte`);
    syncWithSupabase({ silent: true });
  }

  function editSmoke(id) {
    if (!state.cigarettes.some(c => c.id === id)) return;
    editingSmokeId = id;
    renderSmoking();
  }

  function cancelSmokeEdit() {
    editingSmokeId = null;
    renderSmoking();
  }

  function saveSmokeTime(id) {
    const cigarette = state.cigarettes.find(c => c.id === id);
    const input = $(`#smoke-input-${cssEscape(id)}`);
    if (!cigarette || !input) return;

    const nextDate = new Date(input.value);
    if (!input.value || Number.isNaN(nextDate.getTime())) {
      toast('Bitte einen gültigen Zeitpunkt eintragen.');
      return;
    }
    if (nextDate.getTime() > Date.now() + 60_000) {
      toast('Der Zeitpunkt darf nicht in der Zukunft liegen.');
      return;
    }

    const nextIso = nextDate.toISOString();
    cigarette.smoked_at = nextIso;
    cigarette.updated_at = nowIso();
    cigarette.synced = false;
    editingSmokeId = null;
    recalculateSmokeIntervals({ markUpdated: true });
    saveState();
    toast('Zigaretten-Zeitpunkt aktualisiert');
    syncWithSupabase({ silent: true, pullFirst: false });
  }

  async function deleteSmoke(id) {
    const index = state.cigarettes.findIndex(c => c.id === id);
    if (index === -1) return;
    const removedLedgerIds = state.pointsLedger.filter(p => p.source_type === 'cigarette' && p.source_id === id).map(p => p.id);
    state.cigarettes.splice(index, 1);
    state.pointsLedger = state.pointsLedger.filter(p => !(p.source_type === 'cigarette' && p.source_id === id));
    if (editingSmokeId === id) editingSmokeId = null;
    recalculateSmokeIntervals({ markUpdated: true });
    saveState();
    await deleteRemoteById('cigarette_events', id);
    await deleteRemoteByIds('points_ledger', removedLedgerIds);
    toast('Zigaretten-Eintrag entfernt');
    syncWithSupabase({ silent: true, pullFirst: false });
  }

  function recalculateSmokeIntervals({ markUpdated = false } = {}) {
    const touchedAt = nowIso();
    const sorted = [...state.cigarettes].sort((a, b) => new Date(a.smoked_at) - new Date(b.smoked_at));
    sorted.forEach((c, index) => {
      const prev = sorted[index - 1];
      const interval = prev ? Math.max(0, Math.round((new Date(c.smoked_at) - new Date(prev.smoked_at)) / 60000)) : null;
      c.interval_minutes = interval;
      c.points = cigarettePoints(interval);
      if (markUpdated) {
        c.updated_at = touchedAt;
        c.synced = false;
      }
      addPoints('cigarette', c.id, c.points, interval == null ? 'Erste Zigarette erfasst' : `Pause ${formatDuration(interval)}`, c.smoked_at);
    });
  }

  function toggleAlcoholToday() {
    const key = toDateKey(new Date());
    const existing = alcoholForDate(key);
    if (existing) {
      existing.consumed = !existing.consumed;
      existing.updated_at = nowIso();
    } else {
      state.alcoholLogs.push({ id: uid(), log_date: key, consumed: true, note: '', created_at: nowIso(), updated_at: nowIso(), synced: false });
    }
    saveState();
    toast(`Alkohol heute: ${alcoholForDate(key)?.consumed ? 'Ja' : 'Nein'}`);
    syncWithSupabase({ silent: true });
  }

  function createHabit(event) {
    event.preventDefault();
    const data = new FormData(els.habitForm);
    const type = data.get('type');
    const values = {
      name: String(data.get('name') || '').trim(),
      type,
      unit: String(data.get('unit') || defaultUnit(type)).trim(),
      direction: data.get('direction') || 'increase',
      target: data.get('target') ? Number(data.get('target')) : null,
      icon: String(data.get('icon') || '✨').trim().slice(0, 2),
      updated_at: nowIso(),
      synced: false
    };
    if (!values.name) return;

    if (editingHabitId) {
      const habit = state.habits.find(h => h.id === editingHabitId);
      if (!habit) {
        resetHabitFormMode();
        toast('Habit wurde nicht gefunden.');
        return;
      }
      Object.assign(habit, values, { is_archived: false });
      resetHabitFormMode({ clearForm: true });
      saveState();
      toast('Habit aktualisiert');
      syncWithSupabase({ silent: true });
      return;
    }

    const created = nowIso();
    state.habits.push({
      id: uid(),
      ...values,
      color: '#4ad7d1',
      is_archived: false,
      created_at: created,
      updated_at: created
    });
    resetHabitFormMode({ clearForm: true });
    saveState();
    toast('Habit erstellt');
    syncWithSupabase({ silent: true });
  }

  function logHabit(habitId) {
    const habit = state.habits.find(h => h.id === habitId);
    if (!habit) return;
    let valueNum = null;
    let valueBool = null;
    if (habit.type === 'boolean') {
      valueBool = true;
    } else {
      const input = $(`#habit-input-${cssEscape(habit.id)}`);
      valueNum = Number(input?.value || 0);
      if (!Number.isFinite(valueNum) || valueNum === 0) {
        toast('Bitte einen gültigen Wert eintragen.');
        return;
      }
      input.value = '';
    }
    const occurredAt = nowIso();
    const entry = { id: uid(), habit_id: habit.id, value_num: valueNum, value_bool: valueBool, note: '', occurred_at: occurredAt, created_at: occurredAt, updated_at: occurredAt, synced: false };
    state.habitEntries.push(entry);
    const points = habitPoints(habit, entry);
    addPoints('habit', entry.id, points, `${habit.name} geloggt`, occurredAt);
    saveState();
    toast(`${habit.name} geloggt · +${points} Punkte`);
    syncWithSupabase({ silent: true });
  }

  function archiveHabit(id) {
    const habit = state.habits.find(h => h.id === id);
    if (!habit) return;
    habit.is_archived = true;
    habit.updated_at = nowIso();
    if (editingHabitId === id) resetHabitFormMode({ clearForm: true });
    saveState();
    toast('Habit archiviert');
    syncWithSupabase({ silent: true });
  }


  function editHabit(id) {
    const habit = state.habits.find(h => h.id === id);
    if (!habit) return;
    editingHabitId = id;
    const fields = els.habitForm.elements;
    fields.name.value = habit.name || '';
    fields.type.value = habit.type || 'number';
    fields.unit.value = habit.unit || '';
    fields.direction.value = habit.direction || 'increase';
    fields.target.value = habit.target ?? '';
    fields.icon.value = habit.icon || '✨';
    els.habitFormTitle.textContent = 'Gewohnheit bearbeiten';
    els.habitSubmitBtn.textContent = 'Änderungen speichern';
    els.cancelHabitEditBtn.classList.remove('hidden');
    showScreen('habits');
    els.habitForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    renderHabits();
  }

  function resetHabitFormMode({ clearForm = true } = {}) {
    editingHabitId = null;
    if (clearForm) {
      els.habitForm.reset();
      els.habitForm.elements.icon.value = '✨';
    }
    els.habitFormTitle.textContent = 'Gewohnheit anlegen';
    els.habitSubmitBtn.textContent = 'Habit erstellen';
    els.cancelHabitEditBtn.classList.add('hidden');
    renderHabits();
  }

  async function deleteHabit(id) {
    const habit = state.habits.find(h => h.id === id);
    if (!habit) return;
    if (isSystemMeditationHabit(habit)) {
      toast('Meditation ist ein System-Habit und bleibt für Atem-Logs aktiv.');
      return;
    }
    if (!confirm(`Habit „${habit.name}“ und zugehörige Logs wirklich löschen?`)) return;
    const removedEntryIds = state.habitEntries.filter(e => e.habit_id === id).map(e => e.id);
    const removedLedgerIds = state.pointsLedger
      .filter(p => p.source_type === 'habit' && removedEntryIds.includes(p.source_id))
      .map(p => p.id);
    state.habits = state.habits.filter(h => h.id !== id);
    state.habitEntries = state.habitEntries.filter(e => e.habit_id !== id);
    state.pointsLedger = state.pointsLedger.filter(p => !(p.source_type === 'habit' && removedEntryIds.includes(p.source_id)));
    if (editingHabitId === id) resetHabitFormMode({ clearForm: true });
    saveState();
    await deleteRemoteByIds('points_ledger', removedLedgerIds);
    await deleteRemoteByIds('habit_entries', removedEntryIds);
    await deleteRemoteById('habit_definitions', id);
    toast('Habit gelöscht');
    syncWithSupabase({ silent: true, pullFirst: false });
  }

  function createTask(event) {
    event.preventDefault();
    const data = new FormData(els.taskForm);
    const values = {
      title: String(data.get('title') || '').trim(),
      description: String(data.get('description') || '').trim(),
      effort: Number(data.get('effort') || 3),
      due_at: data.get('due_at') ? new Date(data.get('due_at')).toISOString() : null,
      updated_at: nowIso(),
      synced: false
    };
    if (!values.title) return;

    if (editingTaskId) {
      const task = state.tasks.find(t => t.id === editingTaskId);
      if (!task) {
        resetTaskFormMode();
        toast('Aufgabe wurde nicht gefunden.');
        return;
      }
      Object.assign(task, values);
      if (task.status === 'done') {
        task.points = taskPoints(task);
        addPoints('task', task.id, task.points, `Aufgabe abgeschlossen: ${task.title}`, task.completed_at || nowIso());
      }
      resetTaskFormMode({ clearForm: true });
      saveState();
      toast('Aufgabe aktualisiert');
      syncWithSupabase({ silent: true });
      return;
    }

    const created = nowIso();
    state.tasks.push({
      id: uid(),
      ...values,
      status: 'open',
      completed_at: null,
      points: 0,
      created_at: created,
      updated_at: created
    });
    resetTaskFormMode({ clearForm: true });
    saveState();
    toast('Aufgabe gespeichert');
    syncWithSupabase({ silent: true });
  }

  function completeTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    task.status = 'done';
    task.completed_at = nowIso();
    task.updated_at = nowIso();
    task.points = taskPoints(task);
    addPoints('task', task.id, task.points, `Aufgabe abgeschlossen: ${task.title}`, task.completed_at);
    if (editingTaskId === id) resetTaskFormMode({ clearForm: true });
    saveState();
    toast(`Aufgabe erledigt · +${task.points} Punkte`);
    syncWithSupabase({ silent: true });
  }


  function editTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    editingTaskId = id;
    const fields = els.taskForm.elements;
    fields.title.value = task.title || '';
    fields.description.value = task.description || '';
    fields.effort.value = String(task.effort || 3);
    fields.due_at.value = toDateTimeLocalValue(task.due_at);
    els.taskFormTitle.textContent = 'Aufgabe bearbeiten';
    els.taskSubmitBtn.textContent = 'Änderungen speichern';
    els.cancelTaskEditBtn.classList.remove('hidden');
    updateTaskPreview();
    showScreen('tasks');
    els.taskForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    renderTasks();
  }

  function resetTaskFormMode({ clearForm = true } = {}) {
    editingTaskId = null;
    if (clearForm) {
      els.taskForm.reset();
      els.taskForm.elements.effort.value = '3';
    }
    els.taskFormTitle.textContent = 'Aufgabe erfassen';
    els.taskSubmitBtn.textContent = 'Aufgabe speichern';
    els.cancelTaskEditBtn.classList.add('hidden');
    updateTaskPreview();
    renderTasks();
  }

  async function deleteTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    if (!confirm(`Aufgabe „${task.title}“ wirklich löschen?`)) return;
    const removedLedgerIds = state.pointsLedger
      .filter(p => p.source_type === 'task' && p.source_id === id)
      .map(p => p.id);
    state.tasks = state.tasks.filter(t => t.id !== id);
    state.pointsLedger = state.pointsLedger.filter(p => !(p.source_type === 'task' && p.source_id === id));
    if (editingTaskId === id) resetTaskFormMode({ clearForm: true });
    saveState();
    await deleteRemoteByIds('points_ledger', removedLedgerIds);
    await deleteRemoteById('tasks', id);
    toast('Aufgabe gelöscht');
    syncWithSupabase({ silent: true, pullFirst: false });
  }

  function archiveTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    task.status = 'archived';
    task.updated_at = nowIso();
    if (editingTaskId === id) resetTaskFormMode({ clearForm: true });
    saveState();
    toast('Aufgabe archiviert');
    syncWithSupabase({ silent: true });
  }

  function updateTaskPreview() {
    const effort = Number(els.taskForm.elements.effort.value || 3);
    els.taskPointsPreview.textContent = `+${effort * 20} Pkt.`;
  }

  function moveMonth(delta) {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + delta, 1);
    renderCalendar();
  }

  function addPoints(sourceType, sourceId, points, reason, earnedAt = nowIso()) {
    const existing = state.pointsLedger.find(p => p.source_type === sourceType && p.source_id === sourceId);
    if (existing) {
      existing.points = points;
      existing.reason = reason;
      existing.earned_at = earnedAt;
      return;
    }
    state.pointsLedger.push({ id: uid(), source_type: sourceType, source_id: sourceId, points, reason, earned_at: earnedAt, created_at: nowIso(), synced: false });
  }

  function cigarettePoints(minutes) {
    if (minutes == null) return 5;
    if (minutes < 30) return -5;
    if (minutes < 60) return 2;
    if (minutes < 120) return 8;
    if (minutes < 240) return 18;
    if (minutes < 480) return 40;
    if (minutes < 1440) return 80;
    return 180;
  }

  function taskPoints(task) {
    const effort = Math.max(1, Math.min(5, Number(task.effort || 3)));
    let points = effort * 20;
    if (task.due_at && new Date(task.completed_at || nowIso()) <= new Date(task.due_at)) points += 10;
    return points;
  }

  function habitPoints(habit, entry) {
    if (habit.type === 'boolean') return 12;
    const value = Math.abs(Number(entry.value_num || 0));
    if (habit.target) {
      const ratio = Math.min(1, value / Math.abs(Number(habit.target)));
      return Math.max(5, Math.round(30 * ratio));
    }
    return Math.max(5, Math.min(35, Math.round(value * 2)));
  }

  function getTotalPoints() {
    return sum(state.pointsLedger.map(p => Number(p.points || 0)));
  }

  function pointsOnDate(key) {
    return sum(state.pointsLedger.filter(p => toDateKey(p.earned_at) === key).map(p => Number(p.points || 0))) +
      sum(state.cigarettes.filter(c => toDateKey(c.smoked_at) === key && !state.pointsLedger.some(p => p.source_type === 'cigarette' && p.source_id === c.id)).map(c => Number(c.points || 0)));
  }


  function calendarPointsOnDate(key) {
    return sum(state.pointsLedger
      .filter(p => p.source_type !== 'habit' && toDateKey(p.earned_at) === key)
      .map(p => Number(p.points || 0))) +
      sum(state.cigarettes
        .filter(c => toDateKey(c.smoked_at) === key && !state.pointsLedger.some(p => p.source_type === 'cigarette' && p.source_id === c.id))
        .map(c => Number(c.points || 0)));
  }

  function getLastCigarette() {
    return [...state.cigarettes].sort((a, b) => new Date(b.smoked_at) - new Date(a.smoked_at))[0] || null;
  }

  function cigarettesOnDate(key) {
    return state.cigarettes.filter(c => toDateKey(c.smoked_at) === key);
  }

  function alcoholForDate(key) {
    return state.alcoholLogs.find(a => a.log_date === key) || null;
  }

  function entriesForHabitOnDate(habitId, key) {
    return state.habitEntries.filter(e => e.habit_id === habitId && toDateKey(e.occurred_at) === key);
  }

  function averagePauseText(days) {
    const keys = daysBack(days);
    const intervals = state.cigarettes
      .filter(c => keys.includes(toDateKey(c.smoked_at)) && Number.isFinite(Number(c.interval_minutes)))
      .map(c => Number(c.interval_minutes));
    if (!intervals.length) return '–';
    return formatDuration(Math.round(sum(intervals) / intervals.length));
  }

  function bestPauseMinutes() {
    const intervals = state.cigarettes.map(c => Number(c.interval_minutes)).filter(Number.isFinite);
    return intervals.length ? Math.max(...intervals) : null;
  }

  function daysBack(count) {
    const out = [];
    const today = new Date();
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      out.push(toDateKey(d));
    }
    return out;
  }

  function toDateKey(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function formatDateTime(value) {
    if (!value) return '–';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '–';
    return date.toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function toDateTimeLocalValue(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function formatDuration(minutes) {
    if (!Number.isFinite(Number(minutes))) return '–';
    const min = Math.max(0, Math.round(Number(minutes)));
    const days = Math.floor(min / 1440);
    const hours = Math.floor((min % 1440) / 60);
    const rest = min % 60;
    if (days) return `${days}T ${hours}h`;
    if (hours) return `${hours}h ${rest}m`;
    return `${rest}m`;
  }

  function defaultUnit(type) {
    return { number: 'x', weight: 'kg', boolean: '', duration: 'Min.' }[type] || '';
  }

  function typeLabel(type) {
    return { number: 'Anzahl / Zahl', weight: 'Gewicht', boolean: 'Ja/Nein', duration: 'Dauer' }[type] || type;
  }

  function formatHabitValue(habit, value) {
    if (habit.type === 'boolean') return value ? 'Ja' : 'Nein';
    const n = Number(value || 0);
    return `${Number.isInteger(n) ? n : n.toFixed(2)} ${habit.unit || defaultUnit(habit.type)}`.trim();
  }

  function sum(values) {
    return values.reduce((total, value) => total + Number(value || 0), 0);
  }

  function sortDate(value) {
    return value ? new Date(value).getTime() : Date.now() + 365 * DAY_MS;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function cssEscape(value) {
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => els.toast.classList.add('hidden'), 2600);
  }

  function getSupabaseConfig() {
    return {
      url: String(SUPABASE_CONFIG.url || SUPABASE_CONFIG.supabaseUrl || '').trim(),
      anonKey: String(SUPABASE_CONFIG.anonKey || SUPABASE_CONFIG.supabaseAnonKey || '').trim()
    };
  }

  function isSupabaseConfigured() {
    const config = getSupabaseConfig();
    return Boolean(config.url && config.anonKey && window.supabase);
  }

  async function initSupabase() {
    const config = getSupabaseConfig();
    if (!config.url || !config.anonKey || !window.supabase) {
      renderSyncStatus('offline');
      return;
    }
    try {
      supabaseClient = window.supabase.createClient(config.url, config.anonKey);
      renderSyncStatus('syncing');
      await syncWithSupabase({ silent: true, pullFirst: true });
      subscribeToRemoteChanges();
      renderSyncStatus('connected');
      console.log('HabitFlow Supabase direkt verbunden');
    } catch (error) {
      console.warn('Supabase init error', error);
      renderSyncStatus('error');
      toast('Supabase konnte nicht initialisiert werden. App läuft lokal weiter.');
    }
  }

  function initOngoingSync() {
    if (!isSupabaseConfigured()) return;
    setInterval(() => syncWithSupabase({ silent: true, pullFirst: true }), 60_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') syncWithSupabase({ silent: true, pullFirst: true });
    });
    window.addEventListener('online', () => syncWithSupabase({ silent: true, pullFirst: true }));
  }

  function renderSyncStatus(mode) {
    if (!els.syncStatus) return;
    if (!isSupabaseConfigured()) {
      els.syncStatus.textContent = 'Lokal';
      els.syncStatus.className = 'badge muted';
      return;
    }
    if (mode === 'syncing' || syncInFlight) {
      els.syncStatus.textContent = 'Synchronisiert';
      els.syncStatus.className = 'badge muted';
      return;
    }
    if (mode === 'error') {
      els.syncStatus.textContent = 'Sync prüfen';
      els.syncStatus.className = 'badge danger-badge';
      return;
    }
    els.syncStatus.textContent = lastSyncAt ? 'Sync aktiv' : 'Verbunden';
    els.syncStatus.className = 'badge';
  }

  async function manualSyncFromSettings(event) {
    if (event) event.preventDefault();
    await syncWithSupabase({ silent: false, pullFirst: true });
  }

  async function logout() {
    await syncWithSupabase({ silent: false, pullFirst: true });
  }

  async function syncWithSupabase({ silent = false, pullFirst = true } = {}) {
    if (!supabaseClient) {
      if (!silent) toast(isSupabaseConfigured() ? 'Supabase ist noch nicht bereit.' : 'Supabase ist nicht konfiguriert.');
      return;
    }
    if (syncInFlight) return;
    syncInFlight = true;
    renderSyncStatus('syncing');
    try {
      if (pullFirst) await pullSupabaseData();

      await upsertRows('habit_definitions', state.habits.map(h => ({
        id: h.id, name: h.name, type: h.type, unit: h.unit, direction: h.direction, target: h.target,
        icon: h.icon, color: h.color || '#4ad7d1', is_archived: Boolean(h.is_archived), created_at: h.created_at, updated_at: h.updated_at || nowIso()
      })));

      await upsertRows('habit_entries', state.habitEntries.map(e => ({
        id: e.id, habit_id: e.habit_id, value_num: e.value_num, value_bool: e.value_bool, note: e.note || null,
        occurred_at: e.occurred_at, created_at: e.created_at, updated_at: e.updated_at || nowIso()
      })));

      await upsertRows('cigarette_events', state.cigarettes.map(c => ({
        id: c.id, smoked_at: c.smoked_at, interval_minutes: c.interval_minutes, alcohol_context: Boolean(c.alcohol_context),
        points: Number(c.points || 0), note: c.note || null, created_at: c.created_at, updated_at: c.updated_at || nowIso()
      })));

      await upsertRows('alcohol_logs', state.alcoholLogs.map(a => ({
        id: a.id, log_date: a.log_date, consumed: Boolean(a.consumed), note: a.note || null,
        created_at: a.created_at, updated_at: a.updated_at || nowIso()
      })));

      await upsertRows('tasks', state.tasks.map(t => ({
        id: t.id, title: t.title, description: t.description || null, effort: Number(t.effort || 3), status: t.status,
        due_at: t.due_at, completed_at: t.completed_at, points: Number(t.points || 0), created_at: t.created_at, updated_at: t.updated_at || nowIso()
      })));

      await upsertRows('points_ledger', state.pointsLedger.map(p => ({
        id: p.id, source_type: p.source_type, source_id: p.source_id, points: Number(p.points || 0), reason: p.reason || null,
        earned_at: p.earned_at, created_at: p.created_at || nowIso()
      })));

      await pullSupabaseData();
      saveState({ skipRender: true });
      lastSyncAt = new Date();
      render();
      if (!silent) toast('Sync abgeschlossen');
    } catch (error) {
      console.error(error);
      if (!silent) toast(`Sync Fehler: ${error.message || error}`);
      renderSyncStatus('error');
    } finally {
      syncInFlight = false;
      renderSyncStatus();
    }
  }

  async function upsertRows(table, rows) {
    if (!rows.length) return;
    const { error } = await supabaseClient.from(table).upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  async function deleteRemoteById(table, id) {
    if (!supabaseClient || !id) return;
    try {
      const { error } = await supabaseClient.from(table).delete().eq('id', id);
      if (error) console.warn(`Remote-Delete ${table} fehlgeschlagen`, error);
    } catch (error) {
      console.warn(`Remote-Delete ${table} nicht möglich`, error);
    }
  }

  async function deleteRemoteByIds(table, ids) {
    if (!supabaseClient || !ids?.length) return;
    try {
      const { error } = await supabaseClient.from(table).delete().in('id', ids);
      if (error) console.warn(`Remote-Delete ${table} fehlgeschlagen`, error);
    } catch (error) {
      console.warn(`Remote-Delete ${table} nicht möglich`, error);
    }
  }

  async function pullSupabaseData() {
    if (!supabaseClient) return;
    const [habits, entries, cigarettes, alcohol, tasks, ledger] = await Promise.all([
      supabaseClient.from('habit_definitions').select('*'),
      supabaseClient.from('habit_entries').select('*'),
      supabaseClient.from('cigarette_events').select('*'),
      supabaseClient.from('alcohol_logs').select('*'),
      supabaseClient.from('tasks').select('*'),
      supabaseClient.from('points_ledger').select('*')
    ]);
    for (const result of [habits, entries, cigarettes, alcohol, tasks, ledger]) if (result.error) throw result.error;

    const remoteHasData = [habits, entries, cigarettes, alcohol, tasks, ledger].some(result => (result.data || []).length > 0);
    if (remoteHasData && isLocalPristine()) {
      state.habits = (habits.data || []).map(mapRemoteHabit);
      state.habitEntries = (entries.data || []).map(mapRemoteEntry);
      state.cigarettes = (cigarettes.data || []).map(mapRemoteCigarette);
      state.alcoholLogs = (alcohol.data || []).map(mapRemoteAlcohol);
      state.tasks = (tasks.data || []).map(mapRemoteTask);
      state.pointsLedger = (ledger.data || []).map(mapRemoteLedger);
      ensureSystemHabits(state);
      return;
    }

    state.habits = mergeById(state.habits, habits.data || [], mapRemoteHabit);
    state.habitEntries = mergeById(state.habitEntries, entries.data || [], mapRemoteEntry);
    state.cigarettes = mergeById(state.cigarettes, cigarettes.data || [], mapRemoteCigarette);
    state.alcoholLogs = mergeById(state.alcoholLogs, alcohol.data || [], mapRemoteAlcohol);
    state.tasks = mergeById(state.tasks, tasks.data || [], mapRemoteTask);
    state.pointsLedger = mergeById(state.pointsLedger, ledger.data || [], mapRemoteLedger);
    ensureSystemHabits(state);
  }

  function mergeById(localRows, remoteRows, mapper) {
    const map = new Map(localRows.map(row => [row.id, row]));
    remoteRows.map(mapper).forEach(remote => {
      const local = map.get(remote.id);
      if (!local || new Date(remote.updated_at || remote.created_at || 0) >= new Date(local.updated_at || local.created_at || 0)) {
        map.set(remote.id, remote);
      }
    });
    return Array.from(map.values());
  }

  function isLocalPristine() {
    const defaultIds = new Set(Object.values(DEFAULT_HABIT_IDS));
    const defaultNames = new Set(['gewicht', 'wasser', 'sport', 'meditation']);
    const hasOnlyDefaultHabits = state.habits.every(h => defaultIds.has(h.id) || defaultNames.has(String(h.name || '').trim().toLowerCase()));
    return hasOnlyDefaultHabits && !state.habitEntries.length && !state.cigarettes.length && !state.alcoholLogs.length && !state.tasks.length && !state.pointsLedger.length;
  }

  function subscribeToRemoteChanges() {
    if (!supabaseClient || syncSubscription || !supabaseClient.channel) return;
    try {
      const channel = supabaseClient.channel('habitflow-direct-sync');
      SYNC_TABLES.forEach(table => {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRemotePull);
      });
      syncSubscription = channel.subscribe();
    } catch (error) {
      console.warn('Realtime Sync konnte nicht aktiviert werden.', error);
    }
  }

  function scheduleRemotePull() {
    clearTimeout(remotePullTimer);
    remotePullTimer = setTimeout(() => syncWithSupabase({ silent: true, pullFirst: true }), 900);
  }

  const mapRemoteHabit = h => ({ id: h.id, name: h.name, type: h.type, unit: h.unit, direction: h.direction, target: h.target, icon: h.icon, color: h.color, is_archived: h.is_archived, created_at: h.created_at, updated_at: h.updated_at, synced: true });
  const mapRemoteEntry = e => ({ id: e.id, habit_id: e.habit_id, value_num: e.value_num, value_bool: e.value_bool, note: e.note, occurred_at: e.occurred_at, created_at: e.created_at, updated_at: e.updated_at, synced: true });
  const mapRemoteCigarette = c => ({ id: c.id, smoked_at: c.smoked_at, interval_minutes: c.interval_minutes, alcohol_context: c.alcohol_context, points: c.points, note: c.note, created_at: c.created_at, updated_at: c.updated_at, synced: true });
  const mapRemoteAlcohol = a => ({ id: a.id, log_date: a.log_date, consumed: a.consumed, note: a.note, created_at: a.created_at, updated_at: a.updated_at, synced: true });
  const mapRemoteTask = t => ({ id: t.id, title: t.title, description: t.description, effort: t.effort, status: t.status, due_at: t.due_at, completed_at: t.completed_at, points: t.points, created_at: t.created_at, updated_at: t.updated_at, synced: true });
  const mapRemoteLedger = p => ({ id: p.id, source_type: p.source_type, source_id: p.source_id, points: p.points, reason: p.reason, earned_at: p.earned_at, created_at: p.created_at, updated_at: p.created_at, synced: true });

  function exportJson() {
    const blob = new Blob([JSON.stringify({ state, settings: { email: settings.email || '' } }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `habitflow-backup-${toDateKey(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        state = normalizeState(parsed.state || parsed);
        saveState();
        toast('Import abgeschlossen');
      } catch (error) {
        toast('Import fehlgeschlagen');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  function resetDemo() {
    if (!confirm('Lokale Demo-Daten wirklich zurücksetzen?')) return;
    state = defaultState();
    saveState();
    toast('Demo zurückgesetzt');
  }

  async function copySql() {
    try {
      await navigator.clipboard.writeText(window.HABITFLOW_SUPABASE_SQL || '');
      toast('SQL kopiert');
    } catch {
      toast('Kopieren nicht möglich. Markiere den SQL-Block manuell.');
    }
  }
})();
