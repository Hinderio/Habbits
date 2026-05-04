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
    stress: { label: 'Stress / Druck', action: 'Schultern senken, 3 lange Ausatmungen, dann die kleinste Aufgabe statt Zigarette wählen.', icon: 'stress' },
    coffee: { label: 'Kaffee / Routine', action: 'Tasse wegstellen, Wasser nachziehen und den Ort für 2 Minuten wechseln.', icon: 'coffee' },
    alcohol: { label: 'Alkohol / Ausgang', action: 'Rauch-Situation verlassen, Glas Wasser bestellen und die nächste Zigarette aktiv um 10 Minuten schieben.', icon: 'alcohol' },
    boredom: { label: 'Langeweile', action: 'Hände beschäftigen: kurze Nachricht, Kaugummi, Stift oder 20 Schritte gehen.', icon: 'boredom' },
    reward: { label: 'Belohnung', action: 'Belohnung ersetzen: Tee, Musik, kurze Dusche oder 5 Minuten frische Luft ohne Zigarette.', icon: 'reward' },
    social: { label: 'Sozialer Moment', action: 'Kurz draussen mitgehen ohne zu rauchen oder bewusst innen bleiben und später neu entscheiden.', icon: 'social' },
    meal: { label: 'Nach dem Essen', action: 'Direkt Zähne putzen, Tee machen oder Küche verlassen. Die Routine wird zuerst gebrochen.', icon: 'meal' },
    tasks: { label: 'Aufgaben-Druck', action: 'Wähle eine offene Karte, ziehe sie in Bearbeitung und arbeite nur 5 Minuten am kleinsten nächsten Schritt.', icon: 'tasks' },
    habits: { label: 'Habit-Check', action: 'Logge den kleinsten heute noch offenen Habit. Eine Mini-Einheit reicht, um Momentum zu halten.', icon: 'habits' }
  };
  const DAY_MS = 24 * 60 * 60 * 1000;
  const DEFAULT_HABIT_IDS = Object.freeze({
    weight: '00000000-0000-4000-8000-000000000101',
    water: '00000000-0000-4000-8000-000000000102',
    sport: '00000000-0000-4000-8000-000000000103',
    meditation: '00000000-0000-4000-8000-000000000104'
  });
  const SYNC_TABLES = ['habit_definitions', 'habit_entries', 'cigarette_events', 'alcohol_logs', 'alcohol_events', 'tasks', 'points_ledger'];
  const OPTIONAL_SYNC_TABLES = new Set(['alcohol_events']);
  const BUILT_IN_DEFAULT_HABIT_NAMES = new Set(['gewicht', 'wasser', 'sport', 'meditation']);
  const TASK_COLUMNS = [
    { status: 'open', title: 'Offen', hint: 'geplant und noch nicht gestartet' },
    { status: 'in_progress', title: 'In Bearbeitung', hint: 'aktiver Fokus für heute' },
    { status: 'done', title: 'Erledigt', hint: 'abgeschlossen und bepunktet' },
    { status: 'archived', title: 'Archiv', hint: 'aus dem aktiven Fokus' }
  ];
  const TASK_PRIORITIES = {
    low: { label: 'Niedrig', short: 'Low', rank: 1, bonus: 0 },
    medium: { label: 'Normal', short: 'Normal', rank: 2, bonus: 10 },
    high: { label: 'Hoch', short: 'Hoch', rank: 3, bonus: 25 },
    urgent: { label: 'Kritisch', short: 'Kritisch', rank: 4, bonus: 40 }
  };
  const ALCOHOL_TYPES = {
    beer: 'Bier', wine: 'Wein', cocktail: 'Drink', shot: 'Shot', other: 'Anderes'
  };
  const HABIT_TARGET_PERIODS = {
    day: { label: 'Tagesziel', short: 'Tag', days: 1 },
    week: { label: 'Wochenziel', short: 'Woche', days: 7 },
    month: { label: 'Monatsziel', short: 'Monat', days: 30 }
  };
  const nowIso = () => new Date().toISOString();
  const uid = () => (crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const ICON_PATHS = {
    dashboard: '<path d="M4 13h7V4H4v9Z"/><path d="M13 20h7V4h-7v16Z"/><path d="M4 20h7v-5H4v5Z"/>',
    smoke: '<path d="M4 15h11"/><path d="M17 15h3"/><path d="M6 18h12"/><path d="M15 8c1.8-1.6 1.8-3.3 0-4.8"/><path d="M19 10c1.2-1.1 1.2-2.4 0-3.5"/>',
    coach: '<path d="M12 4 19 8v5c0 4-2.8 6.7-7 8-4.2-1.3-7-4-7-8V8l7-4Z"/><path d="M9 12h6"/><path d="M12 9v6"/>',
    habits: '<path d="M12 3v18"/><path d="M12 8c-4.5 0-7 2.1-7 6 4.5 0 7-2.1 7-6Z"/><path d="M12 11c4.5 0 7 2.1 7 6-4.5 0-7-2.1-7-6Z"/>',
    tasks: '<path d="M5 7h14"/><path d="M5 12h14"/><path d="M5 17h8"/><path d="m15 17 2 2 4-5"/>',
    calendar: '<path d="M7 3v4"/><path d="M17 3v4"/><path d="M4 8h16"/><rect x="4" y="5" width="16" height="16" rx="3"/>',
    sync: '<path d="M20 7h-5V2"/><path d="M20 7a8 8 0 0 0-13.7-2.4"/><path d="M4 17h5v5"/><path d="M4 17a8 8 0 0 0 13.7 2.4"/>',
    weight: '<path d="M7 8h10l2 12H5L7 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    water: '<path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z"/>',
    sport: '<path d="M7 20 10 11l4 3 3 6"/><path d="m10 11 3-4 4 2"/><path d="M14 4h.01"/><path d="M4 14h4"/>',
    meditation: '<path d="M12 5a2 2 0 1 0 0 .01"/><path d="M8 20c1.5-2 2.7-3 4-3s2.5 1 4 3"/><path d="M5 15c2.5-2 4.8-3 7-3s4.5 1 7 3"/>',
    standingDesk: '<path d="M5 10h14"/><path d="M7 10v10"/><path d="M17 10v10"/><path d="M9 20h6"/><rect x="8" y="4" width="8" height="5" rx="1.5"/><path d="M12 9v3"/>',
    pushups: '<path d="M5 9a1.7 1.7 0 1 0 0 .01"/><path d="M7 10h6l4 3"/><path d="M9 14h7"/><path d="M7 11l-2 6"/><path d="M16 13l3 5"/><path d="M4 18h16"/>',
    bread: '<path d="M5 20V10a7 7 0 0 1 14 0v10H5Z"/><path d="M8 20v-8a4 4 0 0 1 8 0v8"/><path d="M9 15h.01"/><path d="M15 15h.01"/>',
    jogging: '<path d="M13 4a1.8 1.8 0 1 0 0 .01"/><path d="m11 8 3 2 3-1"/><path d="m14 10-3 4"/><path d="m11 14 4 6"/><path d="M10 14 6 19"/><path d="M4 9h3"/><path d="M3 13h4"/>',
    hiking: '<path d="m3 20 6-10 4 6 3-5 5 9H3Z"/><path d="M9 10 12 4l4 7"/><path d="M15 20v-7"/><path d="M12 16h6"/>',
    walking: '<path d="M12 5a1.8 1.8 0 1 0 0 .01"/><path d="M12 8v5"/><path d="m12 11 3 2"/><path d="M12 13 9 20"/><path d="m12 13 5 7"/><path d="M7 21h2"/><path d="M17 21h2"/>',
    number: '<path d="M9 4 7 20"/><path d="M17 4l-2 16"/><path d="M4 9h16"/><path d="M3 15h16"/>',
    duration: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/>',
    boolean: '<path d="m5 13 4 4L19 7"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13 7 4 4"/>',
    trash: '<path d="M5 7h14"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M8 7l1-3h6l1 3"/><path d="M7 7l1 14h8l1-14"/>',
    archive: '<path d="M4 7h16v4H4V7Z"/><path d="M6 11v9h12v-9"/><path d="M10 15h4"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    check: '<path d="m5 13 4 4L19 7"/>',
    alcohol: '<path d="M8 3h8l-1 9a3 3 0 0 1-6 0L8 3Z"/><path d="M12 15v5"/><path d="M9 21h6"/><path d="M9 8h6"/>',
    stress: '<path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z"/>',
    coffee: '<path d="M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2"/><path d="M8 4v2"/><path d="M12 4v2"/>',
    boredom: '<path d="M5 12h14"/><path d="M7 8h.01"/><path d="M17 16h.01"/>',
    reward: '<path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M9 18h6"/><path d="M12 13v5"/><path d="M5 6H3a3 3 0 0 0 4 3"/><path d="M19 6h2a3 3 0 0 1-4 3"/>',
    social: '<path d="M8 11a3 3 0 1 0 0-.01"/><path d="M16 11a3 3 0 1 0 0-.01"/><path d="M3 20c1-3 2.8-5 5-5s4 2 5 5"/><path d="M11 20c1-2.6 2.7-4 5-4s4 1.4 5 4"/>',
    meal: '<path d="M7 3v9"/><path d="M5 3v4"/><path d="M9 3v4"/><path d="M7 12v9"/><path d="M16 3v18"/><path d="M14 3h4v8h-4"/>',
    delay: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
    reset: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>'
  };

  function svgIcon(name = 'number', className = 'ui-icon') {
    const key = ICON_PATHS[name] ? name : 'number';
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[key]}</svg>`;
  }

  function renderStaticIcons() {
    $$('[data-icon]').forEach(node => {
      node.innerHTML = svgIcon(node.dataset.icon || 'number');
    });
  }

  function normalizeIconSearch(value = '') {
    return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function habitIconKey(habit = {}) {
    const iconRaw = String(habit.icon || '').trim().toLowerCase();
    const nameRaw = String(habit.name || '').trim().toLowerCase();
    const raw = normalizeIconSearch(iconRaw);
    const name = normalizeIconSearch(nameRaw);
    if (iconRaw.includes('💧') || name.includes('wasser')) return 'water';
    if (iconRaw.includes('⚖') || name.includes('gewicht')) return 'weight';
    if (iconRaw.includes('🧘') || name.includes('meditation')) return 'meditation';
    if (name.includes('stehpult') || name.includes('standing desk') || name.includes('stehschreibtisch')) return 'standingDesk';
    if (name.includes('liegestutz') || name.includes('liegestuetz') || name.includes('pushup') || name.includes('push-up')) return 'pushups';
    if (name.includes('brot') || name.includes('bread')) return 'bread';
    if (name.includes('joggen') || name.includes('jogging')) return 'jogging';
    if (name.includes('wandern') || name.includes('hiking')) return 'hiking';
    if (name.includes('spazieren') || name.includes('spaziergang') || name.includes('walking')) return 'walking';
    if (iconRaw.includes('🏃') || name.includes('sport')) return 'sport';
    if (ICON_PATHS[raw]) return raw;
    return ICON_PATHS[habit.type] ? habit.type : 'number';
  }

  var state = loadState();
  let settings = loadSettings();
  let supabaseClient = null;
  let syncSubscription = null;
  let syncInFlight = false;
  let pendingSyncRequest = null;
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
  let habitFormOpen = false;
  let taskFormOpen = false;
  let remoteTaskPrioritySupported = true;
  let remoteTaskInProgressSupported = true;
  let remoteHabitTargetPeriodSupported = true;
  let pendingTriggerSmokeId = null;

  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheEls();
    applyTheme();
    fillSettingsForm();
    bindEvents();
    renderStaticIcons();
    migrateCigaretteScoring();
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
      heroEmergencyBtn: $('#heroEmergencyBtn'),
      coachModal: $('#coachModal'),
      coachCloseBtn: $('#coachCloseBtn'),
      totalPoints: $('#totalPoints'),
      levelLabel: $('#levelLabel'),
      levelProgress: $('#levelProgress'),
      currentPause: $('#currentPause'),
      todayCigarettes: $('#todayCigarettes'),
      avgPause7: $('#avgPause7'),
      openTasksCount: $('#openTasksCount'),
      dailyScore: $('#dailyScore'),
      dailyScoreHint: $('#dailyScoreHint'),
      insightsGrid: $('#insightsGrid'),
      weeklyReview: $('#weeklyReview'),
      habitHeatmap: $('#habitHeatmap'),
      trendMetricSelect: $('#trendMetricSelect'),
      trendChartTitle: $('#trendChartTitle'),
      trendChart: $('#trendChart'),
      pointsChart: $('#pointsChart'),
      recordSmokeBtn: $('#recordSmokeBtn'),
      emergencyCravingBtn: $('#emergencyCravingBtn'),
      triggerCaptureCard: $('#triggerCaptureCard'),
      smokePauseLive: $('#smokePauseLive'),
      smokePauseHint: $('#smokePauseHint'),
      alcoholTypeSelect: $('#alcoholTypeSelect'),
      recordAlcoholUnitBtn: $('#recordAlcoholUnitBtn'),
      alcoholUnitHistory: $('#alcoholUnitHistory'),
      smokeHistory: $('#smokeHistory'),
      lastSmokePoints: $('#lastSmokePoints'),
      cravingTipTitle: $('#cravingTipTitle'),
      cravingTipBody: $('#cravingTipBody'),
      cravingTipMeta: $('#cravingTipMeta'),
      meditationTechniqueGrid: $('#meditationTechniqueGrid'),
      meditationHistory: $('#meditationHistory'),
      habitFormPanel: $('#habitFormPanel'),
      habitFormToggleBtn: $('#habitFormToggleBtn'),
      habitFormCloseBtn: $('#habitFormCloseBtn'),
      habitForm: $('#habitForm'),
      habitFormTitle: $('#habitFormTitle'),
      habitSubmitBtn: $('#habitSubmitBtn'),
      cancelHabitEditBtn: $('#cancelHabitEditBtn'),
      habitCards: $('#habitCards'),
      taskFormPanel: $('#taskFormPanel'),
      taskFormToggleBtn: $('#taskFormToggleBtn'),
      taskFormCloseBtn: $('#taskFormCloseBtn'),
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
      coachPlanGrid: $('#coachPlanGrid'),
      behaviorIntelligencePanel: $('#behaviorIntelligencePanel'),
      urgeForecastBadge: $('#urgeForecastBadge'),
      nextBestActionCard: $('#nextBestActionCard'),
      urgeForecastCard: $('#urgeForecastCard'),
      keystoneHabitCard: $('#keystoneHabitCard'),
      recoveryModeCard: $('#recoveryModeCard'),
      experimentModeCard: $('#experimentModeCard'),
      triggerHeatmap: $('#triggerHeatmap'),
      partyPlanBadge: $('#partyPlanBadge'),
      partyPlanCard: $('#partyPlanCard')
    });
  }

  function bindEvents() {
    els.themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light');
      localStorage.setItem(THEME_KEY, document.body.classList.contains('light') ? 'light' : 'dark');
    });

    els.navButtons.forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.target)));
    els.heroSmokeBtn.addEventListener('click', () => recordCigarette());
    els.heroTaskBtn.addEventListener('click', () => { showScreen('tasks'); openTaskForm(); });
    if (els.heroCoachBtn) els.heroCoachBtn.addEventListener('click', openCoachModal);
    if (els.heroEmergencyBtn) els.heroEmergencyBtn.addEventListener('click', startEmergencyCravingFlow);
    if (els.coachCloseBtn) els.coachCloseBtn.addEventListener('click', closeCoachModal);
    if (els.coachModal) {
      els.coachModal.addEventListener('click', event => {
        if (event.target === els.coachModal) closeCoachModal();
      });
    }
    els.recordSmokeBtn.addEventListener('click', () => recordCigarette());
    if (els.emergencyCravingBtn) els.emergencyCravingBtn.addEventListener('click', startEmergencyCravingFlow);
    if (els.recordAlcoholUnitBtn) els.recordAlcoholUnitBtn.addEventListener('click', recordAlcoholUnit);
    els.trendMetricSelect.addEventListener('change', () => {
      selectedTrendMetric = els.trendMetricSelect.value;
      localStorage.setItem(TREND_METRIC_KEY, selectedTrendMetric);
      renderCharts();
    });
    if (els.habitFormToggleBtn) els.habitFormToggleBtn.addEventListener('click', () => openHabitForm());
    if (els.habitFormCloseBtn) els.habitFormCloseBtn.addEventListener('click', () => closeHabitForm({ clearForm: !editingHabitId }));
    if (els.taskFormToggleBtn) els.taskFormToggleBtn.addEventListener('click', () => openTaskForm());
    if (els.taskFormCloseBtn) els.taskFormCloseBtn.addEventListener('click', () => closeTaskForm({ clearForm: !editingTaskId }));
    els.habitForm.addEventListener('submit', createHabit);
    els.taskForm.addEventListener('submit', createTask);
    els.taskForm.elements.effort.addEventListener('change', updateTaskPreview);
    els.taskForm.elements.priority.addEventListener('change', updateTaskPreview);
    if (els.cancelHabitEditBtn) els.cancelHabitEditBtn.addEventListener('click', () => closeHabitForm({ clearForm: true }));
    if (els.cancelTaskEditBtn) els.cancelTaskEditBtn.addEventListener('click', () => closeTaskForm({ clearForm: true }));
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
      if (action === 'move-task') moveTaskToStatus(id, actionEl.dataset.status);
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
      if (action === 'delete-alcohol') deleteAlcoholLog(id);
      if (action === 'delete-alcohol-unit') deleteAlcoholUnit(id);
      if (action === 'rotate-craving-tip') rotateSmokingTip();
      if (action === 'log-meditation') logMeditationTechnique(id);
      if (action === 'open-coach') openCoachModal();
      if (action === 'start-coach-delay') startCoachDelay();
      if (action === 'coach-breath-reset') coachBreathReset();
      if (action === 'coach-record-smoke') coachRecordSmoke();
      if (action === 'save-smoke-trigger') saveSmokeTrigger(id, actionEl.dataset.trigger);
      if (action === 'dismiss-smoke-trigger') dismissSmokeTrigger();
      if (action === 'start-experiment') startExperiment(actionEl.dataset.experiment);
      if (action === 'finish-experiment') finishExperiment(id, actionEl.dataset.result);
      if (action === 'activate-party-plan') activatePartyPlan();
      if (action === 'complete-party-plan') completePartyPlan(id);
      if (action === 'start-recovery-mode') startRecoveryMode();
      if (action === 'next-best-action') handleNextBestAction(actionEl.dataset.nextAction);
      if (action === 'select-day') {
        selectedCalendarDate = actionEl.dataset.day;
        renderCalendar();
        renderDayDetails();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && els.coachModal && !els.coachModal.classList.contains('hidden')) closeCoachModal();
    });

    document.addEventListener('dragstart', event => {
      const card = event.target.closest('[data-task-card]');
      if (!card) return;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.dataset.id || '');
      card.classList.add('is-dragging');
    });

    document.addEventListener('dragover', event => {
      const column = event.target.closest('[data-task-drop]');
      if (!column) return;
      event.preventDefault();
      column.classList.add('is-over');
    });

    document.addEventListener('dragleave', event => {
      const column = event.target.closest('[data-task-drop]');
      if (column && !column.contains(event.relatedTarget)) column.classList.remove('is-over');
    });

    document.addEventListener('drop', event => {
      const column = event.target.closest('[data-task-drop]');
      if (!column) return;
      event.preventDefault();
      column.classList.remove('is-over');
      const taskId = event.dataTransfer.getData('text/plain');
      moveTaskToStatus(taskId, column.dataset.status);
    });

    document.addEventListener('dragend', () => {
      $$('[data-task-card].is-dragging').forEach(card => card.classList.remove('is-dragging'));
      $$('[data-task-drop].is-over').forEach(column => column.classList.remove('is-over'));
    });
  }

  function defaultState() {
    const created = nowIso();
    return {
      version: 1,
      habits: [],
      habitEntries: [],
      cigarettes: [],
      alcoholLogs: [],
      alcoholUnits: [],
      tasks: [],
      pointsLedger: [],
      coachEvents: [],
      experiments: [],
      partyPlans: [],
      recoverySessions: [],
      deletedRemoteIds: createEmptyDeletedRemoteIds()
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
    next.alcoholUnits = Array.isArray(next.alcoholUnits) ? next.alcoholUnits : [];
    next.tasks = Array.isArray(next.tasks) ? next.tasks.map(normalizeTask) : [];
    next.pointsLedger = Array.isArray(next.pointsLedger) ? next.pointsLedger : [];
    next.habits = next.habits.map(normalizeHabit);
    next.coachEvents = Array.isArray(next.coachEvents) ? next.coachEvents : [];
    next.experiments = Array.isArray(next.experiments) ? next.experiments : [];
    next.partyPlans = Array.isArray(next.partyPlans) ? next.partyPlans : [];
    next.recoverySessions = Array.isArray(next.recoverySessions) ? next.recoverySessions : [];
    next.deletedRemoteIds = normalizeDeletedRemoteIds(next.deletedRemoteIds);
    dedupeStateCollections(next);
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
      target_period: 'day',
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
    return nextState;
  }

  function createEmptyDeletedRemoteIds() {
    return SYNC_TABLES.reduce((acc, table) => {
      acc[table] = {};
      return acc;
    }, {});
  }

  function normalizeDeletedRemoteIds(input = {}) {
    const normalized = createEmptyDeletedRemoteIds();
    Object.keys(normalized).forEach(table => {
      const value = input?.[table];
      if (Array.isArray(value)) value.forEach(id => { if (id) normalized[table][id] = nowIso(); });
      else if (value && typeof value === 'object') Object.assign(normalized[table], value);
    });
    return normalized;
  }

  function normalizeTask(task = {}) {
    return {
      ...task,
      status: TASK_COLUMNS.some(column => column.status === task.status) ? task.status : 'open',
      priority: normalizeTaskPriority(task.priority)
    };
  }

  function normalizeHabit(habit = {}) {
    return {
      ...habit,
      target_period: normalizeHabitTargetPeriod(habit.target_period || habit.goal_period || habit.period || 'day')
    };
  }

  function normalizeHabitTargetPeriod(period) {
    const key = String(period || '').trim().toLowerCase();
    return HABIT_TARGET_PERIODS[key] ? key : 'day';
  }

  function habitTargetPeriodMeta(habitOrPeriod) {
    const key = typeof habitOrPeriod === 'string' ? normalizeHabitTargetPeriod(habitOrPeriod) : normalizeHabitTargetPeriod(habitOrPeriod?.target_period);
    return HABIT_TARGET_PERIODS[key] || HABIT_TARGET_PERIODS.day;
  }

  function normalizeTaskPriority(priority) {
    const key = String(priority || '').trim().toLowerCase();
    return TASK_PRIORITIES[key] ? key : 'medium';
  }

  function taskPriorityMeta(taskOrPriority) {
    const key = typeof taskOrPriority === 'string' ? normalizeTaskPriority(taskOrPriority) : normalizeTaskPriority(taskOrPriority?.priority);
    return TASK_PRIORITIES[key] || TASK_PRIORITIES.medium;
  }

  function taskPriorityClass(priority) {
    return `priority-${normalizeTaskPriority(priority)}`;
  }

  function isActiveTask(task) {
    return ['open', 'in_progress'].includes(task?.status || 'open');
  }

  function taskSortScore(task) {
    const due = task.due_at ? new Date(task.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    return [-(taskPriorityMeta(task).rank), due, sortDate(task.created_at || task.updated_at)];
  }

  function compareTasks(a, b) {
    const aa = taskSortScore(a);
    const bb = taskSortScore(b);
    for (let i = 0; i < aa.length; i += 1) {
      if (aa[i] !== bb[i]) return aa[i] - bb[i];
    }
    return String(a.title || '').localeCompare(String(b.title || ''), 'de-CH');
  }


  function markRemoteDeleted(table, id) {
    if (!table || !id) return;
    state.deletedRemoteIds = normalizeDeletedRemoteIds(state.deletedRemoteIds);
    state.deletedRemoteIds[table][id] = nowIso();
  }

  function markRemoteDeletedMany(table, ids = []) {
    ids.filter(Boolean).forEach(id => markRemoteDeleted(table, id));
  }

  function isRemoteDeleted(table, id) {
    return Boolean(id && state.deletedRemoteIds?.[table]?.[id]);
  }

  function dedupeStateCollections(nextState = state) {
    dedupeHabits(nextState);
    dedupeAlcoholLogs(nextState);
  }

  function isBuiltInDefaultHabit(habit) {
    return Object.values(DEFAULT_HABIT_IDS).includes(habit?.id);
  }

  function dedupeHabits(nextState = state) {
    const byKey = new Map();
    const removedHabitIds = [];
    const normalizedName = habit => String(habit?.name || '').trim().toLowerCase();
    const keyFor = habit => (isBuiltInDefaultHabit(habit) || BUILT_IN_DEFAULT_HABIT_NAMES.has(normalizedName(habit)))
      ? `seed:${normalizedName(habit) || habit.id}`
      : `name:${normalizedName(habit)}`;
    nextState.habits.forEach(habit => {
      const key = keyFor(habit);
      if (!normalizedName(habit)) return;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, habit);
        return;
      }
      const existingTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
      const currentTime = new Date(habit.updated_at || habit.created_at || 0).getTime();
      const keepCurrent = currentTime > existingTime;
      const keep = keepCurrent ? habit : existing;
      const drop = keepCurrent ? existing : habit;
      byKey.set(key, keep);
      removedHabitIds.push(drop.id);
      nextState.habitEntries.forEach(entry => {
        if (entry.habit_id === drop.id) entry.habit_id = keep.id;
      });
    });
    if (removedHabitIds.length) {
      nextState.habits = nextState.habits.filter(h => !removedHabitIds.includes(h.id));
      if (nextState === state) markRemoteDeletedMany('habit_definitions', removedHabitIds);
    }
  }

  function dedupeAlcoholLogs(nextState = state) {
    const byDate = new Map();
    const removedIds = [];
    [...nextState.alcoholLogs].forEach(log => {
      if (!log?.log_date) return;
      const existing = byDate.get(log.log_date);
      if (!existing) {
        byDate.set(log.log_date, log);
        return;
      }
      const existingTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
      const currentTime = new Date(log.updated_at || log.created_at || 0).getTime();
      const keepCurrent = currentTime > existingTime || (!existing.consumed && log.consumed);
      const keep = keepCurrent ? log : existing;
      const drop = keepCurrent ? existing : log;
      byDate.set(log.log_date, keep);
      removedIds.push(drop.id);
    });
    if (removedIds.length) {
      nextState.alcoholLogs = nextState.alcoholLogs.filter(log => !removedIds.includes(log.id));
      if (nextState === state) markRemoteDeletedMany('alcohol_logs', removedIds);
    }
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
  }

  function openHabitForm() {
    habitFormOpen = true;
    syncHabitFormPanel();
    requestAnimationFrame(() => els.habitForm?.elements?.name?.focus({ preventScroll: true }));
  }

  function closeHabitForm({ clearForm = false } = {}) {
    if (clearForm || editingHabitId) resetHabitFormMode({ clearForm });
    habitFormOpen = false;
    syncHabitFormPanel();
  }

  function syncHabitFormPanel() {
    if (!els.habitFormPanel) return;
    els.habitFormPanel.classList.toggle('hidden', !habitFormOpen);
    els.habitFormToggleBtn?.classList.toggle('is-active', habitFormOpen);
    els.habitFormToggleBtn?.setAttribute('aria-expanded', String(habitFormOpen));
  }

  function openTaskForm() {
    taskFormOpen = true;
    syncTaskFormPanel();
    requestAnimationFrame(() => els.taskForm?.elements?.title?.focus({ preventScroll: true }));
  }

  function closeTaskForm({ clearForm = false } = {}) {
    if (clearForm || editingTaskId) resetTaskFormMode({ clearForm });
    taskFormOpen = false;
    syncTaskFormPanel();
  }

  function syncTaskFormPanel() {
    if (!els.taskFormPanel) return;
    els.taskFormPanel.classList.toggle('hidden', !taskFormOpen);
    els.taskFormToggleBtn?.classList.toggle('is-active', taskFormOpen);
    els.taskFormToggleBtn?.setAttribute('aria-expanded', String(taskFormOpen));
  }


  function openCoachModal() {
    if (!els.coachModal) return;
    els.coachModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    renderCoach();
    requestAnimationFrame(() => els.coachUrgeLevel?.focus({ preventScroll: true }));
  }

  function closeCoachModal() {
    if (!els.coachModal) return;
    els.coachModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
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
    els.openTasksCount.textContent = state.tasks.filter(isActiveTask).length;
    const score = calculateDailyScore(todayKey);
    if (els.dailyScore) els.dailyScore.textContent = `${score.score}%`;
    if (els.dailyScoreHint) els.dailyScoreHint.textContent = score.label;

    els.dashboardTitle.textContent = 'Dein Fortschritt auf einen Blick.';
    els.dashboardSubtitle.textContent = habitLogsToday || completedToday || todayCount
      ? `${habitLogsToday} Habit-Log${habitLogsToday === 1 ? '' : 's'}, ${completedToday} erledigte Aufgabe${completedToday === 1 ? '' : 'n'} und ${todayCount} Zigarette${todayCount === 1 ? '' : 'n'} heute.`
      : 'Wähle eine Auswertung, erfasse kleine Schritte und halte deine wichtigsten Muster sichtbar.';

    renderTrendOptions();
    renderInsights();
    renderWeeklyReview();
    renderBehaviorIntelligence();
    renderHabitHeatmap();
    renderCharts();
  }

  function renderInsights() {
    const last7 = daysBack(7);
    const cigarettes7 = state.cigarettes.filter(c => last7.includes(toDateKey(c.smoked_at))).length;
    const alcoholUnits7 = state.alcoholUnits.filter(unit => last7.includes(toDateKey(unit.occurred_at))).length;
    const completed7 = state.tasks.filter(t => t.status === 'done' && last7.includes(toDateKey(t.completed_at || t.updated_at || t.created_at))).length;
    const activeTasks7 = state.tasks.filter(isActiveTask).length;
    const bestPause = bestPauseMinutes();
    const bestDaytimePause = bestDaytimePauseMinutes();
    const pattern = detectPrimaryPattern();
    const trigger = topSmokeTrigger(14);
    const score = calculateDailyScore(toDateKey(new Date()));
    const insights = [
      { title: 'Tages-Score', body: `${score.score}% heute · ${score.label}. Der Score kombiniert Rauchabstand, Konsum, Alkohol, Tasks und Habit-Rhythmus.` },
      { title: 'Muster-Erkennung', body: pattern.body },
      { title: 'Trigger-Analyse', body: trigger ? `${trigger.label} ist dein häufigster geloggter Trigger in den letzten 14 Tagen (${trigger.count}×).` : 'Noch keine Trigger nach Zigaretten geloggt. Nach dem nächsten Eintrag fragt die App kurz und ruhig nach dem Auslöser.' },
      { title: 'Task-Momentum', body: `${completed7} Aufgabe(n) diese Woche abgeschlossen, ${activeTasks7} aktiv. Priorität und Kanban-Status helfen beim Fokus.` },
      { title: 'Alkohol-Kontext', body: alcoholUnits7 ? `${alcoholUnits7} Alkohol-Einheit(en) in 7 Tagen. Vergleiche diese Zeitpunkte bewusst mit Rauch-Peaks.` : 'Keine Alkohol-Einheiten in den letzten 7 Tagen getrackt.' },
      { title: 'Beste Pause', body: bestPause ? `Längste Pause bisher: ${formatDuration(bestPause)}. Das ist dein aktueller Highscore.` : 'Noch keine Intervall-Daten vorhanden.' },
      { title: 'Beste Tagespause', body: bestDaytimePause ? `Längste Pause innerhalb eines Tages: ${formatDuration(bestDaytimePause)}. Übernacht-Pausen zählen hier bewusst nicht.` : 'Noch keine Tagespause zwischen zwei Zigaretten vorhanden.' }
    ];
    els.insightsGrid.innerHTML = insights.map(item => `<article class="insight-card"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p></article>`).join('');
  }

  function renderWeeklyReview() {
    if (!els.weeklyReview) return;
    const review = buildWeeklyReview();
    els.weeklyReview.innerHTML = `<div class="weekly-review-head"><div><p class="eyebrow">Wochenreview</p><h3>${escapeHtml(review.title)}</h3></div><span class="badge ${review.score >= 70 ? '' : 'muted'}">${review.score}%</span></div>
      <div class="weekly-review-grid">
        ${review.items.map(item => `<article><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong><p>${escapeHtml(item.text)}</p></article>`).join('')}
      </div>
      <div class="coach-callout"><b>Empfehlung nächste Woche:</b> ${escapeHtml(review.recommendation)}</div>`;
  }


  function calculateDailyScore(key) {
    const cigarettes = cigarettesOnDate(key).length;
    const alcohol = alcoholUnitsOnDate(key).length;
    const tasksDone = state.tasks.filter(t => t.status === 'done' && toDateKey(t.completed_at || t.updated_at || t.created_at) === key).length;
    const habitLogs = state.habitEntries.filter(e => toDateKey(e.occurred_at) === key).length;
    const last = getLastCigarette();
    const pauseHours = last ? Math.max(0, (Date.now() - new Date(last.smoked_at).getTime()) / 36e5) : 8;
    let score = 72;
    score += Math.min(18, pauseHours * 2.2);
    score += Math.min(14, habitLogs * 4);
    score += Math.min(12, tasksDone * 5);
    score -= Math.min(36, cigarettes * 8);
    score -= Math.min(18, alcohol * 5);
    score = Math.max(0, Math.min(100, Math.round(score)));
    const label = score >= 82 ? 'starker Tag' : score >= 62 ? 'stabil' : score >= 42 ? 'achtsam bleiben' : 'Akutmodus empfohlen';
    return { score, label };
  }

  function detectPrimaryPattern() {
    const keys = daysBack(14);
    const alcoholDays = new Set(state.alcoholUnits.filter(u => keys.includes(toDateKey(u.occurred_at))).map(u => toDateKey(u.occurred_at)));
    const byHour = new Map();
    state.cigarettes.filter(c => keys.includes(toDateKey(c.smoked_at))).forEach(c => {
      const h = new Date(c.smoked_at).getHours();
      const bucket = h < 11 ? 'Morgen' : h < 16 ? 'Mittag' : h < 21 ? 'Abend' : 'Spätabend';
      byHour.set(bucket, (byHour.get(bucket) || 0) + 1);
    });
    const alcoholSmoke = state.cigarettes.filter(c => alcoholDays.has(toDateKey(c.smoked_at))).length;
    const topTime = [...byHour.entries()].sort((a,b)=>b[1]-a[1])[0];
    if (alcoholSmoke >= 3) return { body: `Alkohol-Tage erzeugen aktuell auffällig viele Rauchmomente (${alcoholSmoke} in 14 Tagen). Plane vor dem ersten Drink einen Delay-Schritt.` };
    if (topTime) return { body: `${topTime[0]} ist dein stärkstes Rauchfenster (${topTime[1]}× in 14 Tagen). Der Coach priorisiert dort kurze Unterbrechungen.` };
    return { body: 'Noch zu wenig Verlauf für robuste Muster. Die App sammelt weiter lokal und via Supabase synchronisiert.' };
  }

  function topSmokeTrigger(days = 14) {
    const keys = daysBack(days);
    const counts = new Map();
    state.cigarettes.filter(c => keys.includes(toDateKey(c.smoked_at))).forEach(c => {
      const match = String(c.note || '').match(/trigger:([a-z_]+)/);
      const key = match?.[1];
      if (COACH_TRIGGER_META[key]) counts.set(key, (counts.get(key) || 0) + 1);
    });
    const top = [...counts.entries()].sort((a,b)=>b[1]-a[1])[0];
    return top ? { key: top[0], count: top[1], label: COACH_TRIGGER_META[top[0]].label } : null;
  }

  function buildWeeklyReview() {
    const keys = daysBack(7);
    const cigs = state.cigarettes.filter(c => keys.includes(toDateKey(c.smoked_at)));
    const tasks = state.tasks.filter(t => t.status === 'done' && keys.includes(toDateKey(t.completed_at || t.updated_at || t.created_at)));
    const habits = state.habitEntries.filter(e => keys.includes(toDateKey(e.occurred_at)));
    const best = bestPauseMinutes();
    const alcoholDays = new Set(state.alcoholUnits.filter(u => keys.includes(toDateKey(u.occurred_at))).map(u => toDateKey(u.occurred_at))).size;
    const score = Math.round(sum(keys.map(k => calculateDailyScore(k).score)) / Math.max(1, keys.length));
    const pattern = detectPrimaryPattern().body;
    return {
      score,
      title: score >= 70 ? 'Solide Woche mit sichtbarem Momentum' : 'Woche mit klaren Hebeln',
      items: [
        { label: 'Rauchen', value: `${cigs.length}×`, text: best ? `Beste Pause ${formatDuration(best)}.` : 'Noch kein Pausen-Highscore.' },
        { label: 'Aufgaben', value: `${tasks.length} erledigt`, text: tasks.length ? 'Task-Momentum wirkt als Schutzfaktor.' : 'Eine kleine Aufgabe pro Tag würde den Score stabilisieren.' },
        { label: 'Habits', value: `${habits.length} Logs`, text: 'Zielperioden werden neu pro Tag, Woche oder Monat gewertet.' },
        { label: 'Alkohol', value: `${alcoholDays} Tage`, text: alcoholDays ? 'Alkohol bleibt ein wichtiger Risikokontext.' : 'Kein Alkohol-Kontext in der Wochenansicht.' }
      ],
      recommendation: pattern
    };
  }


  function renderBehaviorIntelligence() {
    if (!els.nextBestActionCard) return;
    const forecast = buildUrgeForecast();
    const action = buildNextBestAction(forecast);
    const keystone = buildKeystoneHabitInsight();
    const recovery = buildRecoveryModeInsight();
    const experiment = buildExperimentInsight();
    const partyPlan = buildPartyPlanInsight();

    if (els.urgeForecastBadge) {
      els.urgeForecastBadge.className = `badge ${forecast.risk >= 72 ? 'danger-badge' : forecast.risk >= 48 ? 'warning-badge' : 'muted'}`;
      els.urgeForecastBadge.textContent = `${forecast.risk}% Risiko`;
    }

    els.nextBestActionCard.innerHTML = `<div class="next-action-copy"><p class="eyebrow">Next Best Action</p><h3>${escapeHtml(action.title)}</h3><p>${escapeHtml(action.body)}</p><small>${escapeHtml(action.reason)}</small></div><button class="pill primary" type="button" data-action="next-best-action" data-next-action="${escapeHtml(action.action)}">${escapeHtml(action.cta)}</button>`;
    els.urgeForecastCard.innerHTML = `<p class="eyebrow">Urge Forecast</p><h4>${escapeHtml(forecast.windowLabel)}</h4><p>${escapeHtml(forecast.body)}</p><div class="risk-meter"><i style="width:${forecast.risk}%"></i></div><small>${escapeHtml(forecast.reason)}</small>`;
    els.keystoneHabitCard.innerHTML = `<p class="eyebrow">Keystone Habit Finder</p><h4>${escapeHtml(keystone.title)}</h4><p>${escapeHtml(keystone.body)}</p><small>${escapeHtml(keystone.detail)}</small>`;
    els.recoveryModeCard.innerHTML = `<p class="eyebrow">Recovery Mode</p><h4>${escapeHtml(recovery.title)}</h4><p>${escapeHtml(recovery.body)}</p><div class="card-actions"><button class="mini-btn ${recovery.active ? 'primary' : ''}" type="button" data-action="start-recovery-mode">${escapeHtml(recovery.cta)}</button></div>`;
    els.experimentModeCard.innerHTML = `<p class="eyebrow">Experiment Mode</p><h4>${escapeHtml(experiment.title)}</h4><p>${escapeHtml(experiment.body)}</p><div class="card-actions">${experiment.active ? `<button class="mini-btn primary" type="button" data-action="finish-experiment" data-id="${experiment.id}" data-result="success">Hat geholfen</button><button class="mini-btn" type="button" data-action="finish-experiment" data-id="${experiment.id}" data-result="neutral">Neutral</button>` : `<button class="mini-btn primary" type="button" data-action="start-experiment" data-experiment="${escapeHtml(experiment.key)}">Experiment starten</button>`}</div>`;
    renderTriggerHeatmap();
    if (els.partyPlanBadge) {
      els.partyPlanBadge.className = `badge ${partyPlan.active ? 'warning-badge' : 'muted'}`;
      els.partyPlanBadge.textContent = partyPlan.active ? 'aktiv' : partyPlan.badge;
    }
    if (els.partyPlanCard) {
      els.partyPlanCard.innerHTML = `<h4>${escapeHtml(partyPlan.title)}</h4><p>${escapeHtml(partyPlan.body)}</p><div class="party-plan-list">${partyPlan.steps.map(step => `<span>${escapeHtml(step)}</span>`).join('')}</div><div class="card-actions">${partyPlan.active ? `<button class="mini-btn primary" type="button" data-action="complete-party-plan" data-id="${partyPlan.id}">Plan erfüllt</button>` : `<button class="mini-btn primary" type="button" data-action="activate-party-plan">30-Sekunden-Plan aktivieren</button>`}<button class="mini-btn" type="button" data-action="open-coach">Coach öffnen</button></div>`;
    }
  }

  function buildUrgeForecast() {
    const now = new Date();
    const hour = now.getHours();
    const keys = daysBack(21);
    const recentCigs = state.cigarettes.filter(c => keys.includes(toDateKey(c.smoked_at)));
    const currentBucket = dayPartKey(hour);
    const currentBucketCount = recentCigs.filter(c => dayPartKey(new Date(c.smoked_at).getHours()) === currentBucket).length;
    const weekdayCount = recentCigs.filter(c => new Date(c.smoked_at).getDay() === now.getDay()).length;
    const alcoholToday = alcoholUnitsOnDate(toDateKey(now)).length || alcoholForDate(toDateKey(now))?.consumed;
    const activeTasks = state.tasks.filter(isActiveTask).length;
    const last = getLastCigarette();
    const pauseMinutes = last ? Math.max(0, Math.round((Date.now() - new Date(last.smoked_at).getTime()) / 60000)) : 999;
    let risk = 24;
    risk += Math.min(28, currentBucketCount * 4);
    risk += Math.min(16, weekdayCount * 2);
    if ([5,6].includes(now.getDay()) && hour >= 17) risk += 12;
    if (alcoholToday) risk += 18;
    if (activeTasks >= 3) risk += 8;
    if (pauseMinutes < 45) risk += 10;
    else if (pauseMinutes > 180) risk -= 8;
    risk = Math.max(5, Math.min(95, Math.round(risk)));
    const windowLabel = `${dayPartLabel(currentBucket)} · ${forecastWindowLabel(hour)}`;
    const reasonBits = [];
    if (currentBucketCount) reasonBits.push(`${currentBucketCount} Rauchmoment(e) in diesem Zeitfenster`);
    if (alcoholToday) reasonBits.push('Alkohol-Kontext aktiv');
    if (activeTasks >= 3) reasonBits.push(`${activeTasks} offene Aufgaben`);
    if (!reasonBits.length) reasonBits.push('wenig akute Risikosignale');
    const body = risk >= 72 ? 'Jetzt aktiv vorbeugen: nicht diskutieren, sondern den kleinsten Reset starten.' : risk >= 48 ? 'Mittleres Risiko: Halte die nächste Lücke bewusst und vermeide Autopilot-Orte.' : 'Ruhiges Fenster: Nutze es, um Schutzfaktoren aufzubauen.';
    return { risk, windowLabel, body, reason: reasonBits.join(' · '), currentBucket };
  }

  function buildNextBestAction(forecast = buildUrgeForecast()) {
    const recovery = buildRecoveryModeInsight();
    const openTask = state.tasks.filter(isActiveTask).sort(compareTasks)[0];
    const focusHabit = state.habits.filter(h => !h.is_archived).find(h => !entriesForHabitOnDate(h.id, toDateKey(new Date())).length);
    const party = buildPartyPlanInsight();
    if (forecast.risk >= 72) return { title: 'Akut-Reset statt Autopilot', body: 'Starte den Coach, lege 10 Minuten Puffer ein und verlasse kurz den Trigger-Ort.', reason: forecast.reason, cta: 'Akutmodus starten', action: 'emergency' };
    if (recovery.active) return { title: 'Heute stabilisieren', body: 'Recovery Mode: nur eine kleine saubere Entscheidung. Kein Perfektionsdruck.', reason: recovery.reason, cta: 'Recovery starten', action: 'recovery' };
    if (!party.active && party.recommended) return { title: 'Abend vorher planen', body: 'Ein kurzer Plan senkt das Risiko stärker als spätere Willenskraft.', reason: party.reason, cta: 'Party-Plan', action: 'party' };
    if (openTask) return { title: 'Eine Aufgabe schließen', body: `Nächster kleinster Schritt: „${openTask.title}“. Task-Momentum wirkt als Schutzfaktor.`, reason: `${taskPriorityMeta(openTask).label} · Aufwand ${openTask.effort}/5`, cta: 'Tasks öffnen', action: 'tasks' };
    if (focusHabit) return { title: 'Keystone-Momentum setzen', body: `Logge heute eine kleine Einheit „${focusHabit.name}“.`, reason: 'Habit-Rhythmus stabilisiert den Tages-Score.', cta: 'Habits öffnen', action: 'habits' };
    return { title: 'Pause bewusst verlängern', body: 'Du hast gerade Spielraum. Setze dir ein Mini-Ziel bis zum nächsten vollen Zeitfenster.', reason: forecast.reason, cta: 'Coach öffnen', action: 'coach' };
  }

  function buildKeystoneHabitInsight() {
    const keys = daysBack(21);
    const candidates = state.habits.filter(h => !h.is_archived).map(habit => {
      const daysWith = keys.filter(key => state.habitEntries.some(e => e.habit_id === habit.id && toDateKey(e.occurred_at) === key));
      if (daysWith.length < 2) return null;
      const daysWithout = keys.filter(key => !daysWith.includes(key));
      const cigsWith = average(daysWith.map(key => cigarettesOnDate(key).length));
      const cigsWithout = average(daysWithout.map(key => cigarettesOnDate(key).length));
      const tasksWith = average(daysWith.map(key => state.tasks.filter(t => t.status === 'done' && toDateKey(t.completed_at || t.updated_at || t.created_at) === key).length));
      const tasksWithout = average(daysWithout.map(key => state.tasks.filter(t => t.status === 'done' && toDateKey(t.completed_at || t.updated_at || t.created_at) === key).length));
      const lift = (cigsWithout - cigsWith) + (tasksWith - tasksWithout) * .55;
      return { habit, lift, cigsWith, cigsWithout, tasksWith, days: daysWith.length };
    }).filter(Boolean).sort((a,b)=>b.lift-a.lift)[0];
    if (!candidates || candidates.lift <= 0) return { title: 'Noch kein klarer Keystone', body: 'Die App braucht ein paar geloggte Tage, um deinen stärksten Schutzfaktor fair zu erkennen.', detail: 'Tipp: Meditation, Sport oder Wasser regelmäßig loggen.' };
    const delta = candidates.cigsWithout - candidates.cigsWith;
    return { title: candidates.habit.name, body: `An Tagen mit diesem Habit wirkt dein System stabiler. ${delta > .2 ? `Ø ${delta.toFixed(1).replace('.', ',')} weniger Zigaretten.` : 'Vor allem Task- und Score-Momentum steigen.'}`, detail: `${candidates.days} aktive Tage in 21 Tagen · experimentell berechnet.` };
  }

  function buildRecoveryModeInsight() {
    const today = toDateKey(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = toDateKey(yesterdayDate);
    const yScore = calculateDailyScore(yesterday).score;
    const todayScore = calculateDailyScore(today).score;
    const active = yScore < 45 || todayScore < 42 || cigarettesOnDate(yesterday).length >= Math.max(5, averageDailyCigarettes(14) * 1.5);
    const already = state.recoverySessions.find(s => toDateKey(s.created_at) === today);
    return { active: Boolean(active || already), title: active || already ? 'Sanft zurück in den Rhythmus' : 'Nicht nötig – System stabil', body: active || already ? 'Heute zählt nicht Optimierung, sondern Rückkehr: Wasser, ein Mini-Habit, eine kleine Aufgabe, keine Eskalation.' : 'Kein Recovery-Signal. Die App hält den Modus bereit, falls ein Tag kippt.', cta: already ? 'Recovery aktiv' : 'Recovery starten', reason: `Gestern ${yScore}% · heute ${todayScore}%` };
  }

  function buildExperimentInsight() {
    const active = state.experiments.find(e => e.status === 'active');
    if (active) return { active: true, id: active.id, key: active.key, title: active.title, body: `${active.rule} Läuft seit ${formatDateTime(active.started_at)}.`, detail: 'Zum Review nach dem nächsten kritischen Moment.', };
    const trigger = topSmokeTrigger(21);
    const key = trigger?.key || 'delay_after_meal';
    const presets = experimentPresets();
    const preset = presets[key] || presets.delay_after_meal;
    return { active: false, key, title: preset.title, body: preset.rule, detail: 'Kleines Experiment statt großer Vorsatz.' };
  }

  function experimentPresets() {
    return {
      stress: { title: 'Stress-Delay testen', rule: '3 Tage lang: bei Stress erst 6 lange Ausatmungen, dann 5 Minuten warten.' },
      coffee: { title: 'Kaffee-Routine entkoppeln', rule: '3 Tage lang: nach Kaffee erst Wasser trinken und 7 Minuten warten.' },
      alcohol: { title: 'Drink ohne Autopilot', rule: 'Heute Abend: vor der ersten Zigarette 10 Minuten Delay + Glas Wasser.' },
      boredom: { title: 'Langeweile umlenken', rule: '3 Tage lang: bei Langeweile eine 2-Minuten-Aufgabe statt sofort rauchen.' },
      meal: { title: 'Nach-dem-Essen-Puffer', rule: '3 Tage lang: nach dem Essen 5 Minuten gehen oder Zähne putzen, dann neu entscheiden.' },
      tasks: { title: 'Task-Druck senken', rule: '3 Tage lang: vor einer Zigarette eine Aufgabe in den nächsten Mini-Schritt zerlegen.' },
      delay_after_meal: { title: '5-Minuten-Puffer testen', rule: '3 Tage lang: den ersten Impuls nur um 5 Minuten verschieben. Verzögern zählt als Erfolg.' }
    };
  }

  function renderTriggerHeatmap() {
    if (!els.triggerHeatmap) return;
    const buckets = ['morning','midday','evening','late'];
    const labels = ['Mo','Di','Mi','Do','Fr','Sa','So'];
    const matrix = Array.from({ length: 7 }, () => Object.fromEntries(buckets.map(b => [b, 0])));
    const keys = daysBack(21);
    state.cigarettes.filter(c => keys.includes(toDateKey(c.smoked_at))).forEach(c => {
      const date = new Date(c.smoked_at);
      const dayIndex = (date.getDay() + 6) % 7;
      matrix[dayIndex][dayPartKey(date.getHours())] += 1;
    });
    const max = Math.max(1, ...matrix.flatMap(row => buckets.map(b => row[b])));
    els.triggerHeatmap.innerHTML = `<div class="trigger-heatmap-head"><span></span>${buckets.map(b => `<strong>${dayPartShortLabel(b)}</strong>`).join('')}</div>${matrix.map((row, index) => `<div class="trigger-heatmap-row"><strong>${labels[index]}</strong>${buckets.map(b => { const value = row[b]; const level = Math.ceil((value / max) * 4); return `<span class="heat-cell level-${level}" title="${labels[index]} ${dayPartLabel(b)}: ${value}×"><em>${value || ''}</em></span>`; }).join('')}</div>`).join('')}`;
  }

  function buildPartyPlanInsight() {
    const today = toDateKey(new Date());
    const existing = state.partyPlans.find(p => p.status === 'active' && toDateKey(p.created_at) === today);
    const now = new Date();
    const weekendEvening = [5,6].includes(now.getDay()) && now.getHours() >= 14;
    const alcoholToday = Boolean(alcoholUnitsOnDate(today).length || alcoholForDate(today)?.consumed);
    const recommended = weekendEvening || alcoholToday;
    return { active: Boolean(existing), id: existing?.id, recommended, badge: recommended ? 'empfohlen' : 'bereit', reason: alcoholToday ? 'Alkohol-Kontext erkannt' : weekendEvening ? 'Wochenend-Abendfenster' : 'optional', title: existing ? 'Plan ist aktiv' : recommended ? 'Risikomoment vorher entscheiden' : 'Bereit für Ausgehen, Alkohol oder Wochenende', body: existing ? 'Du hast den Abend bewusst vorgeplant. Ziel ist nicht perfekt sein, sondern Autopilot reduzieren.' : 'Lege vor Alkohol, Ausgang oder sozialem Druck fest, was deine erste kleine Schutzhandlung ist.', steps: ['erste Zigarette verzögern', 'Wasser zwischen Drinks', 'Trigger-Ort kurz verlassen'] };
  }

  function handleNextBestAction(action) {
    if (action === 'emergency') return startEmergencyCravingFlow();
    if (action === 'recovery') return startRecoveryMode();
    if (action === 'party') return activatePartyPlan();
    if (action === 'tasks') { showScreen('tasks'); return; }
    if (action === 'habits') { showScreen('habits'); return; }
    openCoachModal();
  }

  function startExperiment(key) {
    const presets = experimentPresets();
    const preset = presets[key] || presets.delay_after_meal;
    state.experiments.forEach(e => { if (e.status === 'active') e.status = 'paused'; });
    state.experiments.push({ id: uid(), key, title: preset.title, rule: preset.rule, status: 'active', started_at: nowIso(), updated_at: nowIso(), results: [] });
    saveState();
    toast('Experiment gestartet');
  }

  function finishExperiment(id, result) {
    const experiment = state.experiments.find(e => e.id === id);
    if (!experiment) return;
    experiment.status = 'done';
    experiment.result = result || 'neutral';
    experiment.completed_at = nowIso();
    experiment.updated_at = nowIso();
    saveState();
    toast(result === 'success' ? 'Experiment als hilfreich markiert' : 'Experiment abgeschlossen');
  }

  function activatePartyPlan() {
    const today = toDateKey(new Date());
    const existing = state.partyPlans.find(p => p.status === 'active' && toDateKey(p.created_at) === today);
    if (existing) { toast('Party-Plan ist bereits aktiv'); return; }
    state.partyPlans.push({ id: uid(), status: 'active', created_at: nowIso(), updated_at: nowIso(), steps_done: [] });
    saveState();
    toast('Plan before Party aktiviert');
  }

  function completePartyPlan(id) {
    const plan = state.partyPlans.find(p => p.id === id);
    if (!plan) return;
    plan.status = 'done';
    plan.completed_at = nowIso();
    plan.updated_at = nowIso();
    saveState();
    toast('Party-Plan abgeschlossen');
  }

  function startRecoveryMode() {
    const today = toDateKey(new Date());
    const existing = state.recoverySessions.find(s => toDateKey(s.created_at) === today);
    if (!existing) state.recoverySessions.push({ id: uid(), created_at: nowIso(), updated_at: nowIso(), status: 'active' });
    coachSession.urgeLevel = Math.max(3, Number(coachSession.urgeLevel || 3));
    coachSession.trigger = 'stress';
    saveCoachSession();
    saveState();
    toast('Recovery Mode aktiv · heute nur stabilisieren');
  }

  function dayPartKey(hour) {
    if (hour < 11) return 'morning';
    if (hour < 16) return 'midday';
    if (hour < 21) return 'evening';
    return 'late';
  }

  function dayPartLabel(key) {
    return ({ morning: 'Morgen', midday: 'Mittag', evening: 'Abend', late: 'Spätabend' })[key] || 'Zeitfenster';
  }

  function dayPartShortLabel(key) {
    return ({ morning: 'Morg.', midday: 'Mittag', evening: 'Abend', late: 'Spät' })[key] || key;
  }

  function forecastWindowLabel(hour) {
    const start = Math.max(0, hour - 1);
    const end = Math.min(23, hour + 2);
    return `${String(start).padStart(2, '0')}:00–${String(end).padStart(2, '0')}:00`;
  }

  function average(values = []) {
    const nums = values.map(Number).filter(n => Number.isFinite(n));
    return nums.length ? nums.reduce((a,b)=>a+b,0) / nums.length : 0;
  }

  function averageDailyCigarettes(days = 14) {
    const keys = daysBack(days);
    return average(keys.map(key => cigarettesOnDate(key).length));
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
      { value: 'alcohol', label: 'Alkohol-Einheiten' },
      ...activeHabits.map(habit => ({ value: `habit:${habit.id}`, label: habit.name }))
    ];
  }

  function getTrendMetricConfig(keys) {
    if (selectedTrendMetric === 'cigarettes') {
      return { title: 'Zigaretten pro Tag', label: 'Zigaretten', data: keys.map(k => cigarettesOnDate(k).length), beginAtZero: true };
    }
    if (selectedTrendMetric === 'alcohol') {
      return { title: 'Alkohol-Einheiten', label: 'Einheiten', data: keys.map(k => alcoholUnitsOnDate(k).length), beginAtZero: true };
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
      return `<div class="heatmap-row-label"><span class="habit-icon mini">${svgIcon(habitIconKey(habit), 'ui-icon')}</span><strong>${escapeHtml(habit.name)}</strong></div>${cells}`;
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
    const meditationHabit = getMeditationHabit({ createIfMissing: false });
    els.meditationTechniqueGrid.innerHTML = MEDITATION_TECHNIQUES.map(technique => `<article class="meditation-card">
      <div>
        <strong>${escapeHtml(technique.title)}</strong>
        <p>${escapeHtml(technique.subtitle)}</p>
        <small>${escapeHtml(technique.pattern)} · ${technique.minutes} Min.</small>
      </div>
      <button class="mini-btn primary" type="button" data-action="log-meditation" data-id="${escapeHtml(technique.key)}">Loggen</button>
    </article>`).join('');

    const sessions = meditationHabit ? state.habitEntries
      .filter(entry => entry.habit_id === meditationHabit.id)
      .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
      .slice(0, 5) : [];

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
    return Boolean(habit && (habit.system_key === 'meditation' || habit.id === DEFAULT_HABIT_IDS.meditation));
  }

  function renderSmoking() {
    const last = getLastCigarette();
    els.lastSmokePoints.textContent = `${last?.points || 0} Pkt.`;
    renderSmokingTip(last);
    renderTriggerCapture();
    renderAlcoholUnitHistory();

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
        ? (() => {
            const [dateValue = '', timeValue = ''] = toDateTimeLocalValue(c.smoked_at).split('T');
            return `<div class="smoke-edit-row">
              <label><span>Datum</span><input id="smoke-date-${c.id}" type="date" value="${dateValue}" max="${toDateKey(new Date())}" /></label>
              <label><span>Zeit</span><input id="smoke-time-${c.id}" type="time" value="${timeValue}" step="60" /></label>
              <div class="smoke-edit-actions">
                <button class="mini-btn primary" type="button" data-action="save-smoke-time" data-id="${c.id}">Speichern</button>
                <button class="mini-btn" type="button" data-action="cancel-smoke-edit" data-id="${c.id}">Abbrechen</button>
              </div>
            </div>`;
          })()
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


  function renderAlcoholUnitHistory() {
    if (!els.alcoholUnitHistory) return;
    const units = [...state.alcoholUnits]
      .sort((a, b) => sortDate(b.occurred_at || b.created_at) - sortDate(a.occurred_at || a.created_at))
      .slice(0, 12);
    if (!units.length) {
      els.alcoholUnitHistory.innerHTML = '<div class="empty-state compact">Noch keine Alkohol-Einheit erfasst. Der + Button speichert einzelne Einheiten mit Zeitpunkt.</div>';
      return;
    }
    els.alcoholUnitHistory.innerHTML = units.map(unit => `<article class="list-card compact">
      <div class="list-card-main">
        <h4>${escapeHtml(alcoholTypeLabel(unit.drink_type))}</h4>
        <p class="meta">${formatDateTime(unit.occurred_at)}${unit.note ? ` · ${escapeHtml(unit.note)}` : ''}</p>
      </div>
      <div class="list-actions">
        <span class="badge muted">1 Einheit</span>
        <button class="mini-btn danger" type="button" data-action="delete-alcohol-unit" data-id="${unit.id}">Löschen</button>
      </div>
    </article>`).join('');
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

  function coachTaskBody(task) {
    if (!task) return 'Keine aktive Aufgabe blockiert gerade deinen Fokus. Nutze die freie Kapazität für einen kleinen Habit-Log.';
    const priority = taskPriorityMeta(task).label;
    const dueText = task.due_at ? ` · fällig ${formatDateTime(task.due_at)}` : '';
    const verb = task.status === 'in_progress' ? 'weiterführen' : 'in Bearbeitung ziehen';
    return `${priority}: „${task.title}“ ${verb}. Starte nur mit dem kleinsten nächsten Schritt von 5 Minuten${dueText}.`;
  }

  function coachHabitBody(habit, loggedCount, totalCount) {
    if (!habit) return totalCount ? `${loggedCount}/${totalCount} Habits sind heute bereits geloggt. Halte den Rhythmus ruhig weiter.` : 'Noch keine aktiven Habits vorhanden. Lege einen kleinen, messbaren Habit an.';
    const unit = habit.unit || defaultUnit(habit.type);
    const target = habit.target ? ` Ziel: ${habit.target}${unit ? ` ${unit}` : ''}.` : '';
    return `Heute fehlt noch „${habit.name}“. Logge eine kleine saubere Einheit statt perfekt zu planen.${target}`;
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
    const alcoholUnitsToday = alcoholUnitsOnDate(todayKey).length;
    const activeTasks = state.tasks.filter(isActiveTask).sort(compareTasks);
    const inProgressTasks = activeTasks.filter(task => task.status === 'in_progress');
    const overdueTasks = activeTasks.filter(task => task.due_at && new Date(task.due_at).getTime() < Date.now());
    const focusTask = [...activeTasks].sort(compareTasks)[0] || null;
    const activeHabits = state.habits.filter(habit => !habit.is_archived);
    const loggedHabitIdsToday = new Set(state.habitEntries.filter(entry => toDateKey(entry.occurred_at) === todayKey).map(entry => entry.habit_id));
    const missingHabits = activeHabits.filter(habit => !loggedHabitIdsToday.has(habit.id));
    const focusHabit = missingHabits[0] || null;
    const habitLoggedCount = activeHabits.length - missingHabits.length;
    const habitCompletion = activeHabits.length ? habitLoggedCount / activeHabits.length : 1;

    let risk = 14 + urge * 13;
    if (pauseMinutes == null) risk -= 6;
    else if (pauseMinutes < 10) risk += 20;
    else if (pauseMinutes < 30) risk += 16;
    else if (pauseMinutes < 60) risk += 8;
    else if (pauseMinutes >= 120) risk -= 8;
    if (urge >= 4) risk += 8;
    if (alcoholToday || coachSession.trigger === 'alcohol') risk += 15;
    if (todayCount > Math.max(1, Math.ceil(avgPerDay))) risk += 10;
    if (overdueTasks.length) risk += Math.min(12, overdueTasks.length * 4);
    if (focusTask && taskPriorityMeta(focusTask).rank >= 3) risk += 5;
    if (activeHabits.length && habitCompletion < .5) risk += 4;
    if (inProgressTasks.length) risk -= 3;
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
    } else if (urge >= 5) {
      headline = 'Akuter Drang: Entscheidung sofort verlangsamen.';
      coachLine = 'Der Drang ist gerade sehr hoch. Der Coach wechselt auf Akutmodus: keine grosse Diskussion, nur 90 Sekunden Reset und dann 10 Minuten Abstand.';
    } else if (pauseMinutes < 30) {
      headline = 'Nicht nachlegen. Erst 10 Minuten Puffer.';
      coachLine = urge >= 4
        ? 'Der Abstand ist kurz und der Drang hoch. Genau hier entstehen Ketten – starte den Puffer, bevor du neu entscheidest.'
        : 'Der Abstand ist noch kurz. Ziel ist nicht Verzicht für immer, sondern diese eine Lücke zu vergrössern.';
    } else if (coachSession.trigger === 'tasks' || overdueTasks.length) {
      headline = overdueTasks.length ? 'Fokus zurückholen: eine überfällige Aufgabe reicht.' : 'Aufgaben-Druck in Bewegung verwandeln.';
      coachLine = focusTask
        ? `Der Coach sieht deine offenen Aufgaben. Starte nicht alles, sondern nur „${focusTask.title}“ mit einem 5-Minuten-Schritt.`
        : 'Der Coach sieht gerade keinen aktiven Task. Lege bei Bedarf eine kleine Karte an und starte mit dem ersten sichtbaren Schritt.';
    } else if (coachSession.trigger === 'habits' || focusHabit) {
      headline = focusHabit ? 'Ein kleiner Habit-Log stabilisiert den Tag.' : 'Habit-Rhythmus halten, ohne Druck.';
      coachLine = focusHabit
        ? `Heute ist „${focusHabit.name}“ noch offen. Logge eine kleine Einheit – nicht perfekt, nur messbar.`
        : 'Deine aktiven Habits sind heute gut im Rhythmus. Halte es leicht und nutze den Flow für die nächste kleine Entscheidung.';
    } else if (alcoholToday || coachSession.trigger === 'alcohol') {
      headline = 'Alkohol-Trigger entschärfen.';
      coachLine = 'Heute zählt Umgebung stärker als Willenskraft. Verlasse kurz die Rauch-Situation und trink Wasser, bevor du neu entscheidest.';
    } else if (urge >= 4) {
      headline = 'Drang ist hoch – Welle reiten.';
      coachLine = 'Ein starkes Craving ist unangenehm, aber nicht automatisch ein Auftrag. Beobachte es ein paar Minuten und verschiebe die Entscheidung.';
    } else if (focusTask && inProgressTasks.length) {
      headline = 'Bleib bei der Aufgabe in Bearbeitung.';
      coachLine = 'Du hast bereits aktiven Fokus markiert. Nicht Kontext wechseln – mach den nächsten kleinsten Schritt sichtbar.';
    } else if (todayCount > Math.max(1, Math.ceil(avgPerDay))) {
      headline = 'Heute nicht eskalieren.';
      coachLine = 'Du liegst über deinem aktuellen Muster. Ein einziges Delay kann den Tag wieder stabilisieren.';
    }

    const nextGoal = getNextPauseGoalMinutes(pauseMinutes);
    const microGoal = pauseMinutes == null ? 'Erste Pause setzen' : `${formatDuration(pauseMinutes)} → ${formatDuration(nextGoal)}`;
    const comparison = avgPerDay ? `${todayCount} Zig. · Ø ${avgPerDay.toFixed(1).replace('.', ',')}/Tag · ${alcoholUnitsToday} Alk.-Einh.` : `${todayCount} Zig. · ${alcoholUnitsToday} Alk.-Einh. · wenig Historie`;
    const taskText = focusTask ? `${taskPriorityMeta(focusTask).short} · ${focusTask.title}` : activeTasks.length ? `${activeTasks.length} aktive Aufgaben` : 'keine aktive Aufgabe';
    const habitText = activeHabits.length ? `${habitLoggedCount}/${activeHabits.length} heute` : 'noch keine Habits';
    const bestText = bestPause ? formatDuration(bestPause) : '–';
    const stage = urge >= 5 ? 'Akutmodus' : pauseMinutes == null ? 'Start' : pauseMinutes < 30 ? 'Akutphase' : pauseMinutes < 120 ? 'Aufbau' : 'Highscore-Jagd';
    const urgency = urge >= 5
      ? { delay: activeDelay ? 'Timer fertig laufen lassen. Keine neue Diskussion starten.' : '90 Sekunden ruhig bleiben, dann die 10-Minuten-Challenge starten.', reset: 'Kaltes Wasser, 6 lange Ausatmungen und physisch weg vom Trigger.' }
      : urge >= 4
        ? { delay: activeDelay ? 'Timer fertig laufen lassen. Keine neue Diskussion starten.' : '10-Minuten-Challenge starten. Danach nicht automatisch rauchen, sondern neu bewerten.', reset: 'Craving-Welle loggen: benennen, atmen, warten, erst dann entscheiden.' }
        : urge <= 2
          ? { delay: activeDelay ? 'Timer fertig laufen lassen und nebenbei etwas Kleines erledigen.' : 'Nutze den niedrigen Drang: verlängere die Pause direkt bis zum nächsten Mini-Ziel.', reset: 'Kurz Wasser trinken und bewusst stolz registrieren, dass gerade Spielraum da ist.' }
          : { delay: activeDelay ? 'Timer fertig laufen lassen. Keine neue Diskussion starten.' : '10-Minuten-Challenge starten und erst danach neu entscheiden.', reset: 'Ein Glas Wasser und mindestens 20 Schritte weg vom Trigger-Ort.' };

    const steps = [
      focusTask ? { icon: 'tasks', title: 'Task-Fokus', body: coachTaskBody(focusTask) } : { icon: 'delay', title: 'Delay', body: urgency.delay },
      focusHabit ? { icon: habitIconKey(focusHabit), title: 'Habit-Fokus', body: coachHabitBody(focusHabit, habitLoggedCount, activeHabits.length) } : { icon: 'reset', title: 'Reset', body: urgency.reset },
      { icon: trigger.icon, title: trigger.label, body: trigger.action }
    ];

    return { risk, label, tone, headline, coachLine, microGoal, comparison, taskText, habitText, bestText, stage, pauseMinutes, todayCount, avgPerDay, alcoholToday, alcoholUnitsToday, trigger, urge, activeDelay, delayDone, activeTasks, overdueTasks, focusTask, focusHabit, habitLoggedCount, activeHabits, steps };
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
    const focusTaskTitle = insight.focusTask ? insight.focusTask.title : 'keine aktive Aufgabe';
    const focusHabitTitle = insight.focusHabit ? insight.focusHabit.name : (insight.activeHabits.length ? 'alle aktiven Habits geloggt' : 'noch keine Habits');
    els.coachResult.innerHTML = `
      <div class="coach-result-topline"><small>${escapeHtml(insight.stage)} · Drang ${insight.urge}/5</small><h3>${escapeHtml(insight.headline)}</h3><p>${escapeHtml(insight.coachLine)}</p></div>
      <div class="coach-context-grid">
        <article class="coach-context-card is-primary"><span>${svgIcon('delay', 'ui-icon')}</span><div><small>Mini-Ziel</small><strong>${escapeHtml(insight.microGoal)}</strong><p>${escapeHtml(insight.comparison)}</p></div></article>
        <article class="coach-context-card"><span>${svgIcon('tasks', 'ui-icon')}</span><div><small>Aufgaben</small><strong>${escapeHtml(focusTaskTitle)}</strong><p>${escapeHtml(insight.taskText)}</p></div></article>
        <article class="coach-context-card"><span>${svgIcon(insight.focusHabit ? habitIconKey(insight.focusHabit) : 'habits', 'ui-icon')}</span><div><small>Habits</small><strong>${escapeHtml(focusHabitTitle)}</strong><p>${escapeHtml(insight.habitText)}</p></div></article>
        <article class="coach-context-card"><span>${svgIcon(insight.trigger.icon, 'ui-icon')}</span><div><small>Kontext</small><strong>${insight.alcoholToday ? 'Alkohol aktiv' : escapeHtml(insight.trigger.label)}</strong><p>Beste Pause: ${escapeHtml(insight.bestText)}</p></div></article>
      </div>
      <div class="coach-callout"><b>Nächster Schritt:</b> ${escapeHtml(insight.steps[0].body)} <em>${escapeHtml(insight.microGoal)}</em></div>`;
    els.coachPlanGrid.innerHTML = insight.steps.map((step, index) => `<article class="coach-plan-card"><span>${svgIcon(step.icon, 'ui-icon')}</span><small>Schritt ${index + 1}</small><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.body)}</p></article>`).join('');
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
    closeCoachModal();
    showScreen('smoking');
  }

  function renderHabits() {
    const activeHabits = state.habits.filter(h => !h.is_archived).map(normalizeHabit);
    if (!activeHabits.length) {
      els.habitCards.innerHTML = '<div class="empty-state">Lege deine erste flexible Gewohnheit an. Unterstützt werden Gewicht, Zahlen, Ja/Nein und Dauer.</div>';
      return;
    }

    els.habitCards.innerHTML = activeHabits.map(habit => {
      const periodMeta = habitTargetPeriodMeta(habit);
      const periodValue = habitValueForPeriod(habit);
      const todayEntries = entriesForHabitOnDate(habit.id, toDateKey(new Date()));
      const todayValue = habit.type === 'boolean'
        ? todayEntries.some(e => e.value_bool)
        : todayEntries.reduce((sum, e) => sum + Number(e.value_num || 0), 0);
      const progress = habit.target ? Math.min(100, Math.abs(Number(periodValue.value || 0) / Number(habit.target)) * 100) : 0;
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
          <div class="habit-title"><span class="habit-icon">${svgIcon(habitIconKey(habit), 'ui-icon')}</span><div><strong>${escapeHtml(habit.name)}</strong><small>${habit.typeLabel || typeLabel(habit.type)}${unit ? ` · ${escapeHtml(unit)}` : ''} · ${escapeHtml(periodMeta.label)}</small></div></div>
          <div class="list-actions">${habitActions}</div>
        </div>
        ${control}
        <div class="meta" style="margin-top:10px">Heute: <strong>${formatHabitValue(habit, todayValue)}</strong>${habit.target ? ` · ${periodMeta.short}: <strong>${escapeHtml(periodValue.label)}</strong> / Ziel ${habit.target} ${escapeHtml(unit)}` : ''}</div>
        ${habit.target ? `<div class="habit-progress-track"><i style="width:${progress}%"></i></div>` : ''}
      </article>`;
    }).join('');
  }


  function renderTasks() {
    const tasks = [...state.tasks].map(normalizeTask).sort(compareTasks);
    const totalOpen = tasks.filter(isActiveTask).length;
    if (els.openTasksCount) els.openTasksCount.textContent = totalOpen;
    if (!tasks.length) {
      els.tasksList.innerHTML = '<div class="empty-state">Keine Aufgaben vorhanden. Neue Aufgaben erscheinen hier direkt als Kanban-Karte.</div>';
      return;
    }

    els.tasksList.innerHTML = `<div class="kanban-board" aria-label="Aufgaben Kanban Board">
      ${TASK_COLUMNS.map(column => {
        const columnTasks = tasks.filter(task => (task.status || 'open') === column.status);
        return `<section class="kanban-column" data-task-drop data-status="${column.status}">
          <div class="kanban-column-head">
            <div><strong>${escapeHtml(column.title)}</strong><small>${escapeHtml(column.hint)}</small></div>
            <span class="badge muted">${columnTasks.length}</span>
          </div>
          <div class="kanban-cards">
            ${columnTasks.length ? columnTasks.map(renderTaskCard).join('') : `<div class="kanban-empty">Hierhin ziehen</div>`}
          </div>
        </section>`;
      }).join('')}
    </div>`;
  }

  function renderTaskCard(task) {
    const status = task.status || 'open';
    const priority = normalizeTaskPriority(task.priority);
    const priorityMeta = taskPriorityMeta(priority);
    const statusLabel = TASK_COLUMNS.find(column => column.status === status)?.title || 'Offen';
    const isOverdue = task.due_at && status !== 'done' && new Date(task.due_at).getTime() < Date.now();
    const primaryAction = status === 'open'
      ? `<button class="mini-btn primary" type="button" data-action="move-task" data-status="in_progress" data-id="${task.id}">In Bearbeitung</button>`
      : status === 'in_progress'
        ? `<button class="mini-btn primary" type="button" data-action="move-task" data-status="done" data-id="${task.id}">Erledigt</button>`
        : status === 'done'
          ? `<button class="mini-btn" type="button" data-action="move-task" data-status="in_progress" data-id="${task.id}">Zurück in Arbeit</button>`
          : `<button class="mini-btn" type="button" data-action="move-task" data-status="open" data-id="${task.id}">Reaktivieren</button>`;
    const archiveAction = status === 'archived'
      ? ''
      : `<button class="mini-btn" type="button" data-action="move-task" data-status="archived" data-id="${task.id}">Archiv</button>`;
    return `<article class="kanban-card ${editingTaskId === task.id ? 'is-editing' : ''} ${isOverdue ? 'is-overdue' : ''}" draggable="true" data-task-card data-id="${task.id}">
      <div class="kanban-card-top">
        <span class="drag-handle" aria-hidden="true">⋮⋮</span>
        <div class="task-badges">
          <span class="badge muted ${taskPriorityClass(priority)}">${escapeHtml(priorityMeta.short)}</span>
          <span class="badge ${status === 'done' ? '' : 'muted'}">${status === 'done' ? `+${Number(task.points || taskPoints(task))} Pkt.` : `+${taskPoints(task)} Pkt.`}</span>
        </div>
      </div>
      <h4>${escapeHtml(task.title)}</h4>
      <p class="meta">${escapeHtml(statusLabel)} · Aufwand ${task.effort}/5 · Priorität ${escapeHtml(priorityMeta.label)} · ${task.due_at ? `${isOverdue ? 'Überfällig' : 'Fällig'} ${formatDateTime(task.due_at)}` : 'ohne Fälligkeitsdatum'}${task.description ? `<br>${escapeHtml(task.description)}` : ''}</p>
      <div class="list-actions compact-actions">
        ${primaryAction}
        <button class="mini-btn" type="button" data-action="edit-task" data-id="${task.id}">Bearbeiten</button>
        ${archiveAction}
        <button class="mini-btn danger" type="button" data-action="delete-task" data-id="${task.id}">Löschen</button>
      </div>
    </article>`;
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
      const alcoholUnits = alcoholUnitsOnDate(key).length;
      const points = calendarPointsOnDate(key);
      const chips = [];
      if (cigarettes) chips.push(`<span class="day-chip smoke">${cigarettes} Zig.</span>`);
      if (tasks.length) chips.push(`<span class="day-chip task">${tasks.length} Task</span>`);
      if (alcoholUnits) chips.push(`<span class="day-chip alcohol">${alcoholUnits} Alk.</span>`);
      else if (alcohol) chips.push('<span class="day-chip alcohol">Alk.</span>');
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
    const alcoholUnits = alcoholUnitsOnDate(key);
    if (alcoholUnits.length) details.push(`<article class="list-card"><div><h4>Alkohol</h4><p class="meta">${alcoholUnits.length} Einheit(en): ${escapeHtml(alcoholUnits.map(unit => alcoholTypeLabel(unit.drink_type)).join(', '))}</p></div></article>`);
    else if (alcohol) details.push(`<article class="list-card"><div><h4>Alkohol</h4><p class="meta">${alcohol.consumed ? 'Ja' : 'Nein'} getrackt</p></div></article>`);
    const tasks = state.tasks.filter(t => toDateKey(t.due_at || t.completed_at || t.created_at) === key);
    tasks.forEach(t => details.push(`<article class="list-card ${t.status === 'done' ? 'done' : ''}"><div><h4>${escapeHtml(t.title)}</h4><p class="meta">${escapeHtml(TASK_COLUMNS.find(column => column.status === (t.status || 'open'))?.title || 'Offen')} · ${escapeHtml(taskPriorityMeta(t).label)} · Aufwand ${t.effort}/5</p></div></article>`));
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
    const scoringContext = smokingScoringContext(last, { smoked_at: smokedAt });
    const points = cigarettePoints(interval, scoringContext);
    const todayAlcohol = Boolean(alcoholForDate(toDateKey(new Date()))?.consumed || alcoholUnitsOnDate(toDateKey(new Date())).length);
    const entry = { id: uid(), smoked_at: smokedAt, interval_minutes: interval, alcohol_context: todayAlcohol, points, note: '', created_at: smokedAt, updated_at: smokedAt, synced: false };
    state.cigarettes.push(entry);
    pendingTriggerSmokeId = entry.id;
    addPoints('cigarette', entry.id, points, cigarettePointReason(interval, scoringContext), smokedAt);
    saveState();
    toast(points > 0 ? `Zigarette erfasst · +${points} Punkte` : `Zigarette erfasst · ${points} Punkte`);
    syncWithSupabase({ silent: true });
  }

  function startEmergencyCravingFlow() {
    coachSession.urgeLevel = 5;
    coachSession.trigger = alcoholUnitsOnDate(toDateKey(new Date())).length ? 'alcohol' : 'stress';
    saveCoachSession();
    openCoachModal();
    toast('Akutmodus geöffnet · erst 90 Sekunden Reset, dann neu entscheiden.');
  }

  function renderTriggerCapture() {
    if (!els.triggerCaptureCard) return;
    const cigarette = pendingTriggerSmokeId ? state.cigarettes.find(c => c.id === pendingTriggerSmokeId) : null;
    if (!cigarette) {
      els.triggerCaptureCard.classList.add('hidden');
      els.triggerCaptureCard.innerHTML = '';
      return;
    }
    const options = ['stress', 'coffee', 'alcohol', 'boredom', 'reward', 'social', 'meal', 'tasks', 'habits'];
    els.triggerCaptureCard.classList.remove('hidden');
    els.triggerCaptureCard.innerHTML = `<div><p class="eyebrow">Trigger-Analyse</p><h4>Was war gerade der Auslöser?</h4><p class="subtle">Ein Tap reicht. Das verbessert Muster-Erkennung und Coach-Empfehlungen.</p></div><div class="trigger-chip-grid">${options.map(key => `<button class="trigger-chip" type="button" data-action="save-smoke-trigger" data-id="${cigarette.id}" data-trigger="${key}">${svgIcon(COACH_TRIGGER_META[key].icon, 'ui-icon')}<span>${escapeHtml(COACH_TRIGGER_META[key].label)}</span></button>`).join('')}</div><button class="mini-btn" type="button" data-action="dismiss-smoke-trigger">Später</button>`;
  }

  function saveSmokeTrigger(id, triggerKey) {
    const cigarette = state.cigarettes.find(c => c.id === id);
    const meta = COACH_TRIGGER_META[triggerKey];
    if (!cigarette || !meta) return;
    cigarette.note = `trigger:${triggerKey}`;
    cigarette.updated_at = nowIso();
    cigarette.synced = false;
    pendingTriggerSmokeId = null;
    saveState();
    toast(`Trigger gespeichert: ${meta.label}`);
    syncWithSupabase({ silent: true, pullFirst: false });
  }

  function dismissSmokeTrigger() {
    pendingTriggerSmokeId = null;
    renderTriggerCapture();
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
    const dateInput = $(`#smoke-date-${cssEscape(id)}`);
    const timeInput = $(`#smoke-time-${cssEscape(id)}`);
    const legacyInput = $(`#smoke-input-${cssEscape(id)}`);
    if (!cigarette || (!legacyInput && (!dateInput || !timeInput))) return;

    const nextDate = legacyInput
      ? new Date(legacyInput.value)
      : localDateTimeFromParts(dateInput.value, timeInput.value);
    if (Number.isNaN(nextDate.getTime())) {
      toast('Bitte Datum und Zeit vollständig eintragen.');
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
    markRemoteDeleted('cigarette_events', id);
    markRemoteDeletedMany('points_ledger', removedLedgerIds);
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
    let changed = false;
    const sorted = [...state.cigarettes].sort((a, b) => new Date(a.smoked_at) - new Date(b.smoked_at));
    sorted.forEach((c, index) => {
      const prev = sorted[index - 1] || null;
      const interval = prev ? Math.max(0, Math.round((new Date(c.smoked_at) - new Date(prev.smoked_at)) / 60000)) : null;
      const scoringContext = smokingScoringContext(prev, c);
      const points = cigarettePoints(interval, scoringContext);
      const hasChanged = c.interval_minutes !== interval || Number(c.points || 0) !== points;
      if (hasChanged) {
        c.interval_minutes = interval;
        c.points = points;
        changed = true;
      }
      if (markUpdated && hasChanged) {
        c.updated_at = touchedAt;
        c.synced = false;
      }
      if (addPoints('cigarette', c.id, c.points, cigarettePointReason(interval, scoringContext), c.smoked_at)) changed = true;
    });
    return changed;
  }

  function alcoholTypeLabel(type) {
    return ALCOHOL_TYPES[type] || ALCOHOL_TYPES.other;
  }

  function alcoholUnitsOnDate(key) {
    return state.alcoholUnits.filter(unit => toDateKey(unit.occurred_at) === key);
  }

  function ensureAlcoholDayLog(key, note = '') {
    const existing = alcoholForDate(key);
    if (existing) {
      existing.consumed = true;
      existing.note = existing.note || note || '';
      existing.updated_at = nowIso();
      existing.synced = false;
      return existing;
    }
    const created = nowIso();
    const log = { id: uid(), log_date: key, consumed: true, note, created_at: created, updated_at: created, synced: false };
    state.alcoholLogs.push(log);
    return log;
  }

  function recordAlcoholUnit() {
    const occurredAt = nowIso();
    const drinkType = els.alcoholTypeSelect?.value || 'beer';
    const label = alcoholTypeLabel(drinkType);
    state.alcoholUnits.push({
      id: uid(),
      occurred_at: occurredAt,
      drink_type: drinkType,
      note: '',
      created_at: occurredAt,
      updated_at: occurredAt,
      synced: false
    });
    ensureAlcoholDayLog(toDateKey(new Date()));
    dedupeAlcoholLogs(state);
    saveState();
    toast(`${label} erfasst · 1 Einheit`);
    syncWithSupabase({ silent: true });
  }

  async function deleteAlcoholUnit(id) {
    const unit = state.alcoholUnits.find(a => a.id === id);
    if (!unit) return;
    if (!confirm('Alkohol-Einheit wirklich löschen?')) return;
    state.alcoholUnits = state.alcoholUnits.filter(a => a.id !== id);
    markRemoteDeleted('alcohol_events', id);
    const key = toDateKey(unit.occurred_at);
    const remainingUnitsToday = alcoholUnitsOnDate(key);
    const dayLog = alcoholForDate(key);
    if (dayLog && !remainingUnitsToday.length) {
      dayLog.consumed = false;
      dayLog.updated_at = nowIso();
      dayLog.synced = false;
    }
    saveState();
    await deleteRemoteById('alcohol_events', id);
    toast('Alkohol-Einheit gelöscht');
    syncWithSupabase({ silent: true, pullFirst: false });
  }


async function deleteAlcoholLog(id) {
    const log = state.alcoholLogs.find(a => a.id === id);
    if (!log) return;
    if (!confirm('Alkohol-Eintrag wirklich löschen?')) return;
    state.alcoholLogs = state.alcoholLogs.filter(a => a.id !== id);
    markRemoteDeleted('alcohol_logs', id);
    saveState();
    await deleteRemoteById('alcohol_logs', id);
    toast('Alkohol-Eintrag gelöscht');
    syncWithSupabase({ silent: true, pullFirst: false });
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
      target_period: normalizeHabitTargetPeriod(data.get('target_period')),
      icon: String(data.get('icon') || 'number').trim().toLowerCase(),
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
      habitFormOpen = false;
      syncHabitFormPanel();
      saveState();
      toast('Habit aktualisiert');
      syncWithSupabase({ silent: true, pullFirst: false });
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
    habitFormOpen = false;
    syncHabitFormPanel();
    saveState();
    toast('Habit erstellt');
    syncWithSupabase({ silent: true, pullFirst: false });
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
    if (fields.target_period) fields.target_period.value = normalizeHabitTargetPeriod(habit.target_period);
    fields.icon.value = ICON_PATHS[habit.icon] ? habit.icon : habitIconKey(habit);
    els.habitFormTitle.textContent = 'Gewohnheit bearbeiten';
    els.habitSubmitBtn.textContent = 'Änderungen speichern';
    els.cancelHabitEditBtn.classList.remove('hidden');
    habitFormOpen = true;
    syncHabitFormPanel();
    showScreen('habits');
    els.habitForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    renderHabits();
  }

  function resetHabitFormMode({ clearForm = true } = {}) {
    editingHabitId = null;
    if (clearForm) {
      els.habitForm.reset();
      els.habitForm.elements.icon.value = 'number';
      if (els.habitForm.elements.target_period) els.habitForm.elements.target_period.value = 'day';
    }
    els.habitFormTitle.textContent = 'Gewohnheit anlegen';
    els.habitSubmitBtn.textContent = 'Habit erstellen';
    els.cancelHabitEditBtn.classList.add('hidden');
    syncHabitFormPanel();
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
    markRemoteDeleted('habit_definitions', id);
    markRemoteDeletedMany('habit_entries', removedEntryIds);
    markRemoteDeletedMany('points_ledger', removedLedgerIds);
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
      priority: normalizeTaskPriority(data.get('priority')),
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
      taskFormOpen = false;
      syncTaskFormPanel();
      saveState();
      toast('Aufgabe aktualisiert');
      syncWithSupabase({ silent: true, pullFirst: false });
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
    taskFormOpen = false;
    syncTaskFormPanel();
    saveState();
    toast('Aufgabe gespeichert');
    syncWithSupabase({ silent: true });
  }

  function completeTask(id) {
    moveTaskToStatus(id, 'done');
  }

  function moveTaskToStatus(id, nextStatus) {
    if (!TASK_COLUMNS.some(column => column.status === nextStatus)) return;
    const task = state.tasks.find(t => t.id === id);
    if (!task || task.status === nextStatus) return;
    const previousStatus = task.status || 'open';
    task.status = nextStatus;
    task.updated_at = nowIso();
    task.synced = false;

    if (nextStatus === 'done') {
      task.completed_at = nowIso();
      task.points = taskPoints(task);
      addPoints('task', task.id, task.points, `Aufgabe abgeschlossen: ${task.title}`, task.completed_at);
    } else if (previousStatus === 'done' && nextStatus !== 'archived') {
      task.completed_at = null;
      task.points = 0;
      markRemoteDeletedMany('points_ledger', removeTaskPoints(task.id));
    } else if (nextStatus === 'archived' && previousStatus !== 'done') {
      task.completed_at = null;
      task.points = 0;
      markRemoteDeletedMany('points_ledger', removeTaskPoints(task.id));
    }

    if (editingTaskId === id && nextStatus === 'archived') resetTaskFormMode({ clearForm: true });
    saveState();
    const label = TASK_COLUMNS.find(column => column.status === nextStatus)?.title || 'verschoben';
    toast(`Aufgabe: ${label}`);
    syncWithSupabase({ silent: true });
  }

  function removeTaskPoints(taskId) {
    const removed = state.pointsLedger.filter(p => p.source_type === 'task' && p.source_id === taskId).map(p => p.id);
    state.pointsLedger = state.pointsLedger.filter(p => !(p.source_type === 'task' && p.source_id === taskId));
    return removed;
  }


  function editTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    editingTaskId = id;
    const fields = els.taskForm.elements;
    fields.title.value = task.title || '';
    fields.description.value = task.description || '';
    fields.effort.value = String(task.effort || 3);
    fields.priority.value = normalizeTaskPriority(task.priority);
    fields.due_at.value = toDateTimeLocalValue(task.due_at);
    els.taskFormTitle.textContent = 'Aufgabe bearbeiten';
    els.taskSubmitBtn.textContent = 'Änderungen speichern';
    els.cancelTaskEditBtn.classList.remove('hidden');
    taskFormOpen = true;
    syncTaskFormPanel();
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
      els.taskForm.elements.priority.value = 'medium';
    }
    els.taskFormTitle.textContent = 'Aufgabe erfassen';
    els.taskSubmitBtn.textContent = 'Aufgabe speichern';
    els.cancelTaskEditBtn.classList.add('hidden');
    syncTaskFormPanel();
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
    markRemoteDeleted('tasks', id);
    markRemoteDeletedMany('points_ledger', removedLedgerIds);
    if (editingTaskId === id) resetTaskFormMode({ clearForm: true });
    saveState();
    await deleteRemoteByIds('points_ledger', removedLedgerIds);
    await deleteRemoteById('tasks', id);
    toast('Aufgabe gelöscht');
    syncWithSupabase({ silent: true, pullFirst: false });
  }

  function archiveTask(id) {
    moveTaskToStatus(id, 'archived');
  }

  function updateTaskPreview() {
    const effort = Number(els.taskForm.elements.effort.value || 3);
    const priority = normalizeTaskPriority(els.taskForm.elements.priority?.value || 'medium');
    const previewTask = { effort, priority };
    const bonus = taskPriorityMeta(priority).bonus;
    els.taskPointsPreview.textContent = bonus ? `+${taskPoints(previewTask)} Pkt. · Prio +${bonus}` : `+${taskPoints(previewTask)} Pkt.`;
  }

  function moveMonth(delta) {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + delta, 1);
    renderCalendar();
  }

  function addPoints(sourceType, sourceId, points, reason, earnedAt = nowIso()) {
    const existing = state.pointsLedger.find(p => p.source_type === sourceType && p.source_id === sourceId);
    if (existing) {
      const changed = Number(existing.points || 0) !== Number(points || 0) || existing.reason !== reason || existing.earned_at !== earnedAt;
      if (!changed) return false;
      existing.points = points;
      existing.reason = reason;
      existing.earned_at = earnedAt;
      existing.updated_at = nowIso();
      existing.synced = false;
      return true;
    }
    const createdAt = nowIso();
    state.pointsLedger.push({ id: uid(), source_type: sourceType, source_id: sourceId, points, reason, earned_at: earnedAt, created_at: createdAt, updated_at: createdAt, synced: false });
    return true;
  }

  function cigarettePoints(minutes, { isDaytimeInterval = false } = {}) {
    if (minutes == null) return 0;
    if (minutes < 30) return -40;
    if (minutes < 60) return -20;
    if (minutes < 120) return 0;
    if (minutes < 240) return 20;
    if (minutes < 480) return 40;
    return isDaytimeInterval ? 80 : 0;
  }

  function smokingScoringContext(previousCigarette, cigarette) {
    return {
      previousSmokedAt: previousCigarette?.smoked_at || null,
      smokedAt: cigarette?.smoked_at || null,
      isDaytimeInterval: isDaytimeSmokeInterval(previousCigarette?.smoked_at, cigarette?.smoked_at)
    };
  }

  function isDaytimeSmokeInterval(previousSmokedAt, smokedAt) {
    if (!previousSmokedAt || !smokedAt) return false;
    const prev = new Date(previousSmokedAt);
    const current = new Date(smokedAt);
    if (Number.isNaN(prev.getTime()) || Number.isNaN(current.getTime())) return false;
    return toDateKey(prev) === toDateKey(current);
  }

  function cigarettePointReason(minutes, { isDaytimeInterval = false } = {}) {
    if (minutes == null) return 'Erste Zigarette erfasst';
    if (minutes >= 480 && !isDaytimeInterval) return `Pause ${formatDuration(minutes)} · kein 8h-Tagesbonus`;
    return `Pause ${formatDuration(minutes)}`;
  }

  function migrateCigaretteScoring() {
    if (!state.cigarettes.length) return false;
    const changed = recalculateSmokeIntervals({ markUpdated: true });
    if (changed) saveState({ skipRender: true });
    return changed;
  }

  function taskPoints(task) {
    const effort = Math.max(1, Math.min(5, Number(task.effort || 3)));
    let points = effort * 20 + taskPriorityMeta(task).bonus;
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

  function habitValueForPeriod(habit, endDate = new Date()) {
    const meta = habitTargetPeriodMeta(habit);
    const endKey = toDateKey(endDate);
    const keys = meta.days === 1 ? [endKey] : daysBack(meta.days);
    const entries = state.habitEntries.filter(e => e.habit_id === habit.id && keys.includes(toDateKey(e.occurred_at)));
    if (!entries.length) return { value: habit.type === 'boolean' ? 0 : 0, label: formatHabitValue(habit, 0), entries };
    if (habit.type === 'boolean') {
      const value = new Set(entries.filter(e => e.value_bool).map(e => toDateKey(e.occurred_at))).size;
      return { value, label: `${value}/${keys.length} Tage`, entries };
    }
    const value = habit.type === 'weight' ? Number(entries.sort((a,b)=>new Date(a.occurred_at)-new Date(b.occurred_at)).at(-1)?.value_num || 0) : sum(entries.map(e => Number(e.value_num || 0)));
    return { value, label: formatHabitValue(habit, value), entries };
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

  function bestDaytimePauseMinutes() {
    const intervals = smokeIntervalSnapshots()
      .filter(item => item.isDaytimeInterval && Number.isFinite(item.interval_minutes))
      .map(item => Number(item.interval_minutes));
    return intervals.length ? Math.max(...intervals) : null;
  }

  function smokeIntervalSnapshots() {
    const sorted = [...state.cigarettes].sort((a, b) => new Date(a.smoked_at) - new Date(b.smoked_at));
    return sorted.map((c, index) => {
      const prev = sorted[index - 1] || null;
      const interval = prev ? Math.max(0, Math.round((new Date(c.smoked_at) - new Date(prev.smoked_at)) / 60000)) : null;
      return { cigarette: c, previous: prev, interval_minutes: interval, ...smokingScoringContext(prev, c) };
    });
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

  function localDateTimeFromParts(dateValue, timeValue) {
    const dateParts = String(dateValue || '').split('-').map(Number);
    const timeParts = String(timeValue || '').split(':').map(Number);
    const [year, month, day] = dateParts;
    const [hours, minutes] = timeParts;
    if (dateParts.length !== 3 || timeParts.length < 2 || [year, month, day, hours, minutes].some(value => !Number.isInteger(value))) {
      return new Date(NaN);
    }
    const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hours || date.getMinutes() !== minutes) {
      return new Date(NaN);
    }
    return date;
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
    if (mode === 'pending') {
      els.syncStatus.textContent = 'Sync ausstehend';
      els.syncStatus.className = 'badge warning-badge';
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
    if (syncInFlight) {
      pendingSyncRequest = {
        silent: pendingSyncRequest ? (pendingSyncRequest.silent && silent) : silent,
        pullFirst: pendingSyncRequest ? (pendingSyncRequest.pullFirst || pullFirst) : pullFirst
      };
      renderSyncStatus('pending');
      return;
    }
    syncInFlight = true;
    renderSyncStatus('syncing');
    try {
      if (pullFirst) await pullSupabaseData();
      await flushRemoteDeletes();
      dedupeStateCollections(state);
      migrateCigaretteScoring();
      await flushRemoteDeletes();

      await upsertHabitRows();

      await upsertRows('habit_entries', liveRowsForTable('habit_entries', state.habitEntries).map(e => ({
        id: e.id, habit_id: e.habit_id, value_num: e.value_num, value_bool: e.value_bool, note: e.note || null,
        occurred_at: e.occurred_at, created_at: e.created_at, updated_at: e.updated_at || nowIso()
      })));

      await upsertRows('cigarette_events', liveRowsForTable('cigarette_events', state.cigarettes).map(c => ({
        id: c.id, smoked_at: c.smoked_at, interval_minutes: c.interval_minutes, alcohol_context: Boolean(c.alcohol_context),
        points: Number(c.points || 0), note: c.note || null, created_at: c.created_at, updated_at: c.updated_at || nowIso()
      })));

      await upsertRows('alcohol_logs', liveRowsForTable('alcohol_logs', state.alcoholLogs).map(a => ({
        id: a.id, log_date: a.log_date, consumed: Boolean(a.consumed), note: a.note || null,
        created_at: a.created_at, updated_at: a.updated_at || nowIso()
      })));

      await upsertRows('alcohol_events', liveRowsForTable('alcohol_events', state.alcoholUnits).map(a => ({
        id: a.id, occurred_at: a.occurred_at, drink_type: a.drink_type || 'other', note: a.note || null,
        created_at: a.created_at, updated_at: a.updated_at || nowIso()
      })));

      await upsertTaskRows();

      await upsertRows('points_ledger', liveRowsForTable('points_ledger', state.pointsLedger).map(p => ({
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
      const queuedRequest = pendingSyncRequest;
      pendingSyncRequest = null;
      renderSyncStatus();
      if (queuedRequest) {
        setTimeout(() => syncWithSupabase(queuedRequest), 120);
      }
    }
  }

  async function upsertRows(table, rows) {
    if (!rows.length) return;
    const { error } = await supabaseClient.from(table).upsert(rows, { onConflict: 'id' });
    if (error && OPTIONAL_SYNC_TABLES.has(table) && isMissingRemoteRelationError(error)) {
      console.warn(`Optionale Sync-Tabelle ${table} fehlt. App läuft lokal weiter.`, error);
      return;
    }
    if (error) throw error;
  }

  function habitRowsForSync() {
    return liveRowsForTable('habit_definitions', state.habits).map(h => {
      const row = {
        id: h.id, name: h.name, type: h.type, unit: h.unit, direction: h.direction, target: h.target,
        icon: h.icon, color: h.color || '#4ad7d1', is_archived: Boolean(h.is_archived), created_at: h.created_at, updated_at: h.updated_at || nowIso()
      };
      if (remoteHabitTargetPeriodSupported) row.target_period = normalizeHabitTargetPeriod(h.target_period);
      return row;
    });
  }

  async function upsertHabitRows() {
    const rows = habitRowsForSync();
    if (!rows.length) return;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { error } = await supabaseClient.from('habit_definitions').upsert(habitRowsForSync(), { onConflict: 'id' });
      if (!error) return;
      if (remoteHabitTargetPeriodSupported && String(error.message || '').toLowerCase().includes('target_period')) {
        remoteHabitTargetPeriodSupported = false;
        console.warn('Remote Habit-Tabelle hat noch keine target_period-Spalte. Sync läuft ohne Zielperiode, bis supabase.sql angewendet ist.', error);
        continue;
      }
      throw error;
    }
  }

  function taskRowsForSync() {
    return liveRowsForTable('tasks', state.tasks).map(t => {
      const row = {
        id: t.id,
        title: t.title,
        description: t.description || null,
        effort: Number(t.effort || 3),
        status: taskStatusForRemote(t.status || 'open'),
        due_at: t.due_at,
        completed_at: t.completed_at,
        points: Number(t.points || 0),
        created_at: t.created_at,
        updated_at: t.updated_at || nowIso()
      };
      if (remoteTaskPrioritySupported) row.priority = normalizeTaskPriority(t.priority);
      return row;
    });
  }

  async function upsertTaskRows() {
    const rows = taskRowsForSync();
    if (!rows.length) return;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { error } = await supabaseClient.from('tasks').upsert(taskRowsForSync(), { onConflict: 'id' });
      if (!error) return;
      if (remoteTaskPrioritySupported && String(error.message || '').toLowerCase().includes('priority')) {
        remoteTaskPrioritySupported = false;
        console.warn('Remote Tasks-Tabelle hat noch keine priority-Spalte. Sync läuft ohne Priorität, bis supabase.sql angewendet ist.', error);
        continue;
      }
      if (remoteTaskInProgressSupported && isTaskStatusConstraintError(error)) {
        remoteTaskInProgressSupported = false;
        console.warn('Remote Tasks-Tabelle kennt in_progress noch nicht. Sync mappt diesen Status vorübergehend auf offen.', error);
        continue;
      }
      throw error;
    }
  }

  function taskStatusForRemote(status) {
    const normalized = TASK_COLUMNS.some(column => column.status === status) ? status : 'open';
    if (!remoteTaskInProgressSupported && normalized === 'in_progress') return 'open';
    return normalized;
  }

  function isTaskStatusConstraintError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('tasks_status_check') || (message.includes('check constraint') && message.includes('status'));
  }

  function isMissingRemoteRelationError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('does not exist') || message.includes('schema cache') || message.includes('could not find the table');
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

  function liveRowsForTable(table, rows = []) {
    return rows.filter(row => row?.id && !isRemoteDeleted(table, row.id));
  }

  async function flushRemoteDeletes() {
    if (!supabaseClient) return;
    state.deletedRemoteIds = normalizeDeletedRemoteIds(state.deletedRemoteIds);
    for (const table of SYNC_TABLES) {
      const ids = Object.keys(state.deletedRemoteIds[table] || {});
      if (ids.length) await deleteRemoteByIds(table, ids);
    }
  }

  function remoteRows(table, result) {
    return (result.data || []).filter(row => !isRemoteDeleted(table, row.id));
  }

  function applyRemoteHabitAuthority(remoteHabitRows) {
    const remoteIds = new Set(remoteHabitRows.map(h => h.id));
    const remoteSeedNames = new Set(remoteHabitRows.map(h => String(h.name || '').trim().toLowerCase()).filter(name => BUILT_IN_DEFAULT_HABIT_NAMES.has(name)));
    const removedHabitIds = state.habits
      .filter(habit => {
        const name = String(habit.name || '').trim().toLowerCase();
        const isSeed = isBuiltInDefaultHabit(habit) || BUILT_IN_DEFAULT_HABIT_NAMES.has(name);
        const hasUnsyncedLocalChanges = habit.synced === false || state.habitEntries.some(entry => entry.habit_id === habit.id && entry.synced === false);
        if (!isSeed || hasUnsyncedLocalChanges) return false;
        if (remoteIds.has(habit.id)) return false;
        return !remoteSeedNames.has(name);
      })
      .map(habit => habit.id);
    if (!removedHabitIds.length) return;
    const removedEntryIds = state.habitEntries.filter(entry => removedHabitIds.includes(entry.habit_id)).map(entry => entry.id);
    const removedLedgerIds = state.pointsLedger
      .filter(point => point.source_type === 'habit' && removedEntryIds.includes(point.source_id))
      .map(point => point.id);
    state.habits = state.habits.filter(habit => !removedHabitIds.includes(habit.id));
    state.habitEntries = state.habitEntries.filter(entry => !removedHabitIds.includes(entry.habit_id));
    state.pointsLedger = state.pointsLedger.filter(point => !(point.source_type === 'habit' && removedEntryIds.includes(point.source_id)));
    markRemoteDeletedMany('habit_definitions', removedHabitIds);
    markRemoteDeletedMany('habit_entries', removedEntryIds);
    markRemoteDeletedMany('points_ledger', removedLedgerIds);
  }

  async function pullSupabaseData() {
    if (!supabaseClient) return;
    const [habits, entries, cigarettes, alcohol, alcoholEvents, tasks, ledger] = await Promise.all([
      fetchRemoteTable('habit_definitions'),
      fetchRemoteTable('habit_entries'),
      fetchRemoteTable('cigarette_events'),
      fetchRemoteTable('alcohol_logs'),
      fetchRemoteTable('alcohol_events'),
      fetchRemoteTable('tasks'),
      fetchRemoteTable('points_ledger')
    ]);

    const remoteHabitRows = remoteRows('habit_definitions', habits);
    const remoteEntryRows = remoteRows('habit_entries', entries);
    const remoteCigaretteRows = remoteRows('cigarette_events', cigarettes);
    const remoteAlcoholRows = remoteRows('alcohol_logs', alcohol);
    const remoteAlcoholEventRows = remoteRows('alcohol_events', alcoholEvents);
    const remoteTaskRows = remoteRows('tasks', tasks);
    const remoteLedgerRows = remoteRows('points_ledger', ledger);
    const remoteHasData = [remoteHabitRows, remoteEntryRows, remoteCigaretteRows, remoteAlcoholRows, remoteAlcoholEventRows, remoteTaskRows, remoteLedgerRows].some(rows => rows.length > 0);

    applyRemoteHabitAuthority(remoteHabitRows);

    if (remoteHasData && isLocalPristine()) {
      state.habits = remoteHabitRows.map(mapRemoteHabit);
      state.habitEntries = remoteEntryRows.map(mapRemoteEntry);
      state.cigarettes = remoteCigaretteRows.map(mapRemoteCigarette);
      state.alcoholLogs = remoteAlcoholRows.map(mapRemoteAlcohol);
      state.alcoholUnits = remoteAlcoholEventRows.map(mapRemoteAlcoholEvent);
      state.tasks = remoteTaskRows.map(mapRemoteTask).map(normalizeTask);
      state.pointsLedger = remoteLedgerRows.map(mapRemoteLedger);
      dedupeStateCollections(state);
      return;
    }

    const localTasksBeforePull = new Map(state.tasks.map(task => [task.id, normalizeTask(task)]));
    const localHabitsBeforePull = new Map(state.habits.map(habit => [habit.id, normalizeHabit(habit)]));
    state.habits = mergeById(state.habits, remoteHabitRows, mapRemoteHabit).map(habit => preserveLocalHabitFallbacks(normalizeHabit(habit), localHabitsBeforePull.get(habit.id)));
    state.habitEntries = mergeById(state.habitEntries, remoteEntryRows, mapRemoteEntry);
    state.cigarettes = mergeById(state.cigarettes, remoteCigaretteRows, mapRemoteCigarette);
    state.alcoholLogs = mergeById(state.alcoholLogs, remoteAlcoholRows, mapRemoteAlcohol);
    state.alcoholUnits = mergeById(state.alcoholUnits, remoteAlcoholEventRows, mapRemoteAlcoholEvent);
    state.tasks = mergeById(state.tasks, remoteTaskRows, mapRemoteTask).map(task => preserveLocalTaskFallbacks(normalizeTask(task), localTasksBeforePull.get(task.id)));
    state.pointsLedger = mergeById(state.pointsLedger, remoteLedgerRows, mapRemoteLedger);
    dedupeStateCollections(state);
  }

  async function fetchRemoteTable(table) {
    const result = await supabaseClient.from(table).select('*');
    if (result.error) {
      if (OPTIONAL_SYNC_TABLES.has(table) && isMissingRemoteRelationError(result.error)) {
        console.warn(`Optionale Sync-Tabelle ${table} fehlt.`, result.error);
        return { data: [], error: null };
      }
      throw result.error;
    }
    return result;
  }

  function preserveLocalHabitFallbacks(remoteHabit, localHabit) {
    if (!localHabit) return remoteHabit;
    const next = { ...remoteHabit };
    if (!remoteHabitTargetPeriodSupported) next.target_period = localHabit.target_period || next.target_period;
    return next;
  }

  function preserveLocalTaskFallbacks(remoteTask, localTask) {
    if (!localTask) return remoteTask;
    const next = { ...remoteTask };
    if (!remoteTaskPrioritySupported) next.priority = localTask.priority || next.priority;
    if (!remoteTaskInProgressSupported && localTask.status === 'in_progress' && remoteTask.status === 'open') next.status = 'in_progress';
    return next;
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
    const hasOnlyDefaultHabits = state.habits.every(h => defaultIds.has(h.id) || BUILT_IN_DEFAULT_HABIT_NAMES.has(String(h.name || '').trim().toLowerCase()));
    return hasOnlyDefaultHabits && !state.habitEntries.length && !state.cigarettes.length && !state.alcoholLogs.length && !state.alcoholUnits.length && !state.tasks.length && !state.pointsLedger.length;
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

  const mapRemoteHabit = h => normalizeHabit({ id: h.id, name: h.name, type: h.type, unit: h.unit, direction: h.direction, target: h.target, target_period: h.target_period || 'day', icon: h.icon, color: h.color, is_archived: h.is_archived, created_at: h.created_at, updated_at: h.updated_at, synced: true });
  const mapRemoteEntry = e => ({ id: e.id, habit_id: e.habit_id, value_num: e.value_num, value_bool: e.value_bool, note: e.note, occurred_at: e.occurred_at, created_at: e.created_at, updated_at: e.updated_at, synced: true });
  const mapRemoteCigarette = c => ({ id: c.id, smoked_at: c.smoked_at, interval_minutes: c.interval_minutes, alcohol_context: c.alcohol_context, points: c.points, note: c.note, created_at: c.created_at, updated_at: c.updated_at, synced: true });
  const mapRemoteAlcohol = a => ({ id: a.id, log_date: a.log_date, consumed: a.consumed, note: a.note, created_at: a.created_at, updated_at: a.updated_at, synced: true });
  const mapRemoteAlcoholEvent = a => ({ id: a.id, occurred_at: a.occurred_at, drink_type: a.drink_type || 'other', note: a.note, created_at: a.created_at, updated_at: a.updated_at, synced: true });
  const mapRemoteTask = t => ({ id: t.id, title: t.title, description: t.description, effort: t.effort, priority: normalizeTaskPriority(t.priority), status: TASK_COLUMNS.some(column => column.status === t.status) ? t.status : 'open', due_at: t.due_at, completed_at: t.completed_at, points: t.points, created_at: t.created_at, updated_at: t.updated_at, synced: true });
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
