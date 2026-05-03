(() => {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const SETTINGS_KEY = 'habitflow-settings-v1';
  const THEME_KEY = 'habitflow-theme';
  const TREND_METRIC_KEY = 'habitflow-trend-metric';
  const MEDITATION_TECHNIQUES = [
    { key: '7-3-11', title: '7-3-11 Atemtechnik', subtitle: 'Runterfahren mit langer Ausatmung', minutes: 6, pattern: '7 ein · 3 halten · 11 aus' },
    { key: 'box', title: 'Box Breathing', subtitle: 'Klarer Fokus vor schwierigen Momenten', minutes: 5, pattern: '4 · 4 · 4 · 4' },
    { key: 'body-scan', title: 'Body Scan', subtitle: 'Körper wahrnehmen und Spannung lösen', minutes: 10, pattern: 'ruhig scannen' },
    { key: 'urge-surf', title: 'Craving-Welle', subtitle: 'Drang beobachten, ohne sofort zu handeln', minutes: 4, pattern: 'wahrnehmen · warten · wählen' },
    { key: 'gratitude', title: 'Dankbarkeits-Minute', subtitle: 'Kurzer mentaler Reset mit positiver Ankerung', minutes: 3, pattern: '3 Dinge benennen' }
  ];
  const DAY_MS = 24 * 60 * 60 * 1000;
  const nowIso = () => new Date().toISOString();
  const uid = () => (crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  let state = loadState();
  let settings = loadSettings();
  let supabaseClient = null;
  let currentUser = null;
  let selectedCalendarDate = toDateKey(new Date());
  let calendarCursor = new Date();
  let charts = { trend: null, points: null };
  let selectedTrendMetric = localStorage.getItem(TREND_METRIC_KEY) || 'points';
  let renderQueued = false;

  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheEls();
    applyTheme();
    fillSettingsForm();
    bindEvents();
    await initSupabase();
    registerServiceWorker();
    render();
    setInterval(renderTimers, 30_000);
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
      meditationTechniqueGrid: $('#meditationTechniqueGrid'),
      meditationHistory: $('#meditationHistory'),
      habitForm: $('#habitForm'),
      habitCards: $('#habitCards'),
      taskForm: $('#taskForm'),
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
      sendMagicLinkBtn: $('#sendMagicLinkBtn'),
      logoutBtn: $('#logoutBtn'),
      syncStatus: $('#syncStatus'),
      exportBtn: $('#exportBtn'),
      importInput: $('#importInput'),
      resetBtn: $('#resetBtn'),
      sqlPreview: $('#sqlPreview'),
      copySqlBtn: $('#copySqlBtn')
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
    els.recordSmokeBtn.addEventListener('click', () => recordCigarette());
    els.alcoholTodayBtn.addEventListener('click', () => toggleAlcoholToday());
    els.trendMetricSelect.addEventListener('change', () => {
      selectedTrendMetric = els.trendMetricSelect.value;
      localStorage.setItem(TREND_METRIC_KEY, selectedTrendMetric);
      renderCharts();
    });
    els.habitForm.addEventListener('submit', createHabit);
    els.taskForm.addEventListener('submit', createTask);
    els.taskForm.effort.addEventListener('change', updateTaskPreview);
    els.prevMonthBtn.addEventListener('click', () => moveMonth(-1));
    els.nextMonthBtn.addEventListener('click', () => moveMonth(1));
    els.todayMonthBtn.addEventListener('click', () => {
      calendarCursor = new Date();
      selectedCalendarDate = toDateKey(new Date());
      renderCalendar();
      renderDayDetails();
    });
    els.settingsForm.addEventListener('submit', saveSettings);
    els.sendMagicLinkBtn.addEventListener('click', sendMagicLink);
    els.logoutBtn.addEventListener('click', logout);
    els.syncNowBtn.addEventListener('click', syncWithSupabase);
    els.exportBtn.addEventListener('click', exportJson);
    els.importInput.addEventListener('change', importJson);
    els.resetBtn.addEventListener('click', resetDemo);
    els.copySqlBtn.addEventListener('click', copySql);

    document.addEventListener('click', event => {
      const actionEl = event.target.closest('[data-action]');
      if (!actionEl) return;
      const { action, id } = actionEl.dataset;
      if (action === 'complete-task') completeTask(id);
      if (action === 'archive-task') archiveTask(id);
      if (action === 'archive-habit') archiveHabit(id);
      if (action === 'log-habit') logHabit(id);
      if (action === 'delete-smoke') deleteSmoke(id);
      if (action === 'log-meditation') logMeditationTechnique(id);
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
        { id: uid(), name: 'Gewicht', type: 'weight', unit: 'kg', direction: 'decrease', target: null, icon: '⚖️', color: '#4ad7d1', is_archived: false, created_at: created, updated_at: created },
        { id: uid(), name: 'Wasser', type: 'number', unit: 'Gläser', direction: 'increase', target: 8, icon: '💧', color: '#66e7ff', is_archived: false, created_at: created, updated_at: created },
        { id: uid(), name: 'Sport', type: 'duration', unit: 'Min.', direction: 'increase', target: 30, icon: '🏃', color: '#8ff0a7', is_archived: false, created_at: created, updated_at: created },
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
      id: uid(),
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
      return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || { supabaseUrl: '', supabaseAnonKey: '', email: '' };
    } catch {
      return { supabaseUrl: '', supabaseAnonKey: '', email: '' };
    }
  }

  function saveSettingsToStorage() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function applyTheme() {
    document.body.classList.toggle('light', localStorage.getItem(THEME_KEY) === 'light');
  }

  function fillSettingsForm() {
    els.settingsForm.supabaseUrl.value = settings.supabaseUrl || '';
    els.settingsForm.supabaseAnonKey.value = settings.supabaseAnonKey || '';
    els.settingsForm.email.value = settings.email || '';
    els.sqlPreview.textContent = window.HABITFLOW_SUPABASE_SQL || 'supabase.sql konnte nicht geladen werden.';
  }

  function showScreen(screen) {
    els.navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.target === screen));
    els.screens.forEach(view => view.classList.toggle('active', view.dataset.screen === screen));
    if (screen === 'calendar') {
      renderCalendar();
      renderDayDetails();
    }
  }

  function render() {
    renderTimers();
    renderDashboard();
    renderSmoking();
    renderMeditation();
    renderHabits();
    renderTasks();
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

  function renderSmoking() {
    const todayAlcohol = alcoholForDate(toDateKey(new Date()));
    els.alcoholTodayBtn.textContent = todayAlcohol?.consumed ? 'Ja' : 'Nein';
    els.alcoholTodayBtn.classList.toggle('is-on', Boolean(todayAlcohol?.consumed));
    els.alcoholTodayBtn.setAttribute('aria-pressed', String(Boolean(todayAlcohol?.consumed)));
    const last = getLastCigarette();
    els.lastSmokePoints.textContent = `${last?.points || 0} Pkt.`;

    const items = [...state.cigarettes]
      .sort((a, b) => new Date(b.smoked_at) - new Date(a.smoked_at))
      .slice(0, 25);

    if (!items.length) {
      els.smokeHistory.innerHTML = '<div class="empty-state">Noch keine Zigarette erfasst. Der Button ist bewusst gross, damit Tracking in 1 Sekunde erledigt ist.</div>';
      return;
    }

    els.smokeHistory.innerHTML = items.map(c => {
      const cls = c.points < 0 ? 'danger-text' : c.points >= 40 ? 'positive-text' : '';
      return `<article class="list-card">
        <div class="list-card-main">
          <h4>${formatDateTime(c.smoked_at)}</h4>
          <p class="meta">Pause davor: <strong>${c.interval_minutes == null ? '–' : formatDuration(c.interval_minutes)}</strong>${c.alcohol_context ? ' · Alkohol-Kontext' : ''}</p>
        </div>
        <div class="list-actions">
          <span class="badge ${cls ? '' : 'muted'} ${cls}">${c.points > 0 ? '+' : ''}${c.points} Pkt.</span>
          <button class="mini-btn danger" type="button" data-action="delete-smoke" data-id="${c.id}">Löschen</button>
        </div>
      </article>`;
    }).join('');
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

      return `<article class="habit-card">
        <div class="habit-card-head">
          <div class="habit-title"><span class="habit-icon">${escapeHtml(habit.icon || '✨')}</span><div><strong>${escapeHtml(habit.name)}</strong><small>${habit.typeLabel || typeLabel(habit.type)}${unit ? ` · ${escapeHtml(unit)}` : ''}</small></div></div>
          <button class="mini-btn" type="button" data-action="archive-habit" data-id="${habit.id}">Archiv</button>
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
    els.tasksList.innerHTML = open.map(task => `<article class="list-card">
      <div class="list-card-main">
        <h4>${escapeHtml(task.title)}</h4>
        <p class="meta">Aufwand ${task.effort}/5 · ${task.due_at ? `Fällig ${formatDateTime(task.due_at)}` : 'ohne Fälligkeitsdatum'}${task.description ? `<br>${escapeHtml(task.description)}` : ''}</p>
      </div>
      <div class="list-actions">
        <span class="badge">+${taskPoints(task)} Pkt.</span>
        <button class="mini-btn primary" type="button" data-action="complete-task" data-id="${task.id}">Erledigt</button>
        <button class="mini-btn" type="button" data-action="archive-task" data-id="${task.id}">Archiv</button>
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

  function deleteSmoke(id) {
    const index = state.cigarettes.findIndex(c => c.id === id);
    if (index === -1) return;
    state.cigarettes.splice(index, 1);
    state.pointsLedger = state.pointsLedger.filter(p => !(p.source_type === 'cigarette' && p.source_id === id));
    recalculateSmokeIntervals();
    saveState();
    toast('Zigaretten-Eintrag entfernt');
  }

  function recalculateSmokeIntervals() {
    const sorted = [...state.cigarettes].sort((a, b) => new Date(a.smoked_at) - new Date(b.smoked_at));
    sorted.forEach((c, index) => {
      const prev = sorted[index - 1];
      c.interval_minutes = prev ? Math.max(0, Math.round((new Date(c.smoked_at) - new Date(prev.smoked_at)) / 60000)) : null;
      c.points = cigarettePoints(c.interval_minutes);
      const ledger = state.pointsLedger.find(p => p.source_type === 'cigarette' && p.source_id === c.id);
      if (ledger) ledger.points = c.points;
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
    const habit = {
      id: uid(),
      name: String(data.get('name') || '').trim(),
      type,
      unit: String(data.get('unit') || defaultUnit(type)).trim(),
      direction: data.get('direction') || 'increase',
      target: data.get('target') ? Number(data.get('target')) : null,
      icon: String(data.get('icon') || '✨').trim().slice(0, 2),
      color: '#4ad7d1',
      is_archived: false,
      created_at: nowIso(),
      updated_at: nowIso(),
      synced: false
    };
    if (!habit.name) return;
    state.habits.push(habit);
    els.habitForm.reset();
    els.habitForm.icon.value = '✨';
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
    saveState();
    toast('Habit archiviert');
    syncWithSupabase({ silent: true });
  }

  function createTask(event) {
    event.preventDefault();
    const data = new FormData(els.taskForm);
    const created = nowIso();
    const task = {
      id: uid(),
      title: String(data.get('title') || '').trim(),
      description: String(data.get('description') || '').trim(),
      effort: Number(data.get('effort') || 3),
      status: 'open',
      due_at: data.get('due_at') ? new Date(data.get('due_at')).toISOString() : null,
      completed_at: null,
      points: 0,
      created_at: created,
      updated_at: created,
      synced: false
    };
    if (!task.title) return;
    state.tasks.push(task);
    els.taskForm.reset();
    els.taskForm.effort.value = '3';
    updateTaskPreview();
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
    saveState();
    toast(`Aufgabe erledigt · +${task.points} Punkte`);
    syncWithSupabase({ silent: true });
  }

  function archiveTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    task.status = 'archived';
    task.updated_at = nowIso();
    saveState();
    toast('Aufgabe archiviert');
    syncWithSupabase({ silent: true });
  }

  function updateTaskPreview() {
    const effort = Number(els.taskForm.effort.value || 3);
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

  async function initSupabase() {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey || !window.supabase) {
      renderSyncStatus();
      return;
    }
    try {
      supabaseClient = window.supabase.createClient(settings.supabaseUrl, settings.supabaseAnonKey);
      const { data } = await supabaseClient.auth.getSession();
      currentUser = data?.session?.user || null;
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
        renderSyncStatus();
        if (currentUser) syncWithSupabase({ silent: true });
      });
      if (currentUser) await syncWithSupabase({ silent: true });
    } catch (error) {
      console.warn('Supabase init error', error);
      toast('Supabase konnte nicht initialisiert werden.');
    }
    renderSyncStatus();
  }

  function renderSyncStatus() {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
      els.syncStatus.textContent = 'Lokal';
      els.syncStatus.className = 'badge muted';
      return;
    }
    if (!currentUser) {
      els.syncStatus.textContent = 'Nicht eingeloggt';
      els.syncStatus.className = 'badge muted';
      return;
    }
    els.syncStatus.textContent = 'Sync aktiv';
    els.syncStatus.className = 'badge';
  }

  async function saveSettings(event) {
    event.preventDefault();
    settings = {
      supabaseUrl: els.settingsForm.supabaseUrl.value.trim(),
      supabaseAnonKey: els.settingsForm.supabaseAnonKey.value.trim(),
      email: els.settingsForm.email.value.trim()
    };
    saveSettingsToStorage();
    await initSupabase();
    toast('Einstellungen gespeichert');
  }

  async function sendMagicLink() {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
      toast('Bitte zuerst Supabase URL und Anon Key speichern.');
      return;
    }
    if (!supabaseClient) await initSupabase();
    const email = els.settingsForm.email.value.trim() || settings.email;
    if (!email) {
      toast('Bitte E-Mail eintragen.');
      return;
    }
    settings.email = email;
    saveSettingsToStorage();
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href.split('#')[0] }
    });
    if (error) {
      toast(`Login-Link Fehler: ${error.message}`);
      return;
    }
    toast('Login-Link wurde gesendet.');
  }

  async function logout() {
    if (supabaseClient) await supabaseClient.auth.signOut();
    currentUser = null;
    renderSyncStatus();
    toast('Logout erledigt');
  }

  async function syncWithSupabase({ silent = false } = {}) {
    if (!supabaseClient || !currentUser) {
      if (!silent) toast('Supabase ist noch nicht verbunden.');
      return;
    }
    try {
      const userId = currentUser.id;
      await supabaseClient.from('profiles').upsert({ id: userId, timezone: 'Europe/Zurich', updated_at: nowIso() });

      await upsertRows('habit_definitions', state.habits.map(h => ({
        id: h.id, user_id: userId, name: h.name, type: h.type, unit: h.unit, direction: h.direction, target: h.target,
        icon: h.icon, color: h.color || '#4ad7d1', is_archived: Boolean(h.is_archived), created_at: h.created_at, updated_at: h.updated_at || nowIso()
      })));

      await upsertRows('habit_entries', state.habitEntries.map(e => ({
        id: e.id, user_id: userId, habit_id: e.habit_id, value_num: e.value_num, value_bool: e.value_bool, note: e.note || null,
        occurred_at: e.occurred_at, created_at: e.created_at, updated_at: e.updated_at || nowIso()
      })));

      await upsertRows('cigarette_events', state.cigarettes.map(c => ({
        id: c.id, user_id: userId, smoked_at: c.smoked_at, interval_minutes: c.interval_minutes, alcohol_context: Boolean(c.alcohol_context),
        points: Number(c.points || 0), note: c.note || null, created_at: c.created_at, updated_at: c.updated_at || nowIso()
      })));

      await upsertRows('alcohol_logs', state.alcoholLogs.map(a => ({
        id: a.id, user_id: userId, log_date: a.log_date, consumed: Boolean(a.consumed), note: a.note || null,
        created_at: a.created_at, updated_at: a.updated_at || nowIso()
      })));

      await upsertRows('tasks', state.tasks.map(t => ({
        id: t.id, user_id: userId, title: t.title, description: t.description || null, effort: Number(t.effort || 3), status: t.status,
        due_at: t.due_at, completed_at: t.completed_at, points: Number(t.points || 0), created_at: t.created_at, updated_at: t.updated_at || nowIso()
      })));

      await upsertRows('points_ledger', state.pointsLedger.map(p => ({
        id: p.id, user_id: userId, source_type: p.source_type, source_id: p.source_id, points: Number(p.points || 0), reason: p.reason || null,
        earned_at: p.earned_at, created_at: p.created_at || nowIso()
      })));

      await pullSupabaseData(userId);
      saveState({ skipRender: true });
      render();
      if (!silent) toast('Sync abgeschlossen');
    } catch (error) {
      console.error(error);
      if (!silent) toast(`Sync Fehler: ${error.message || error}`);
    }
  }

  async function upsertRows(table, rows) {
    if (!rows.length) return;
    const { error } = await supabaseClient.from(table).upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  async function pullSupabaseData(userId) {
    const [habits, entries, cigarettes, alcohol, tasks, ledger] = await Promise.all([
      supabaseClient.from('habit_definitions').select('*').eq('user_id', userId),
      supabaseClient.from('habit_entries').select('*').eq('user_id', userId),
      supabaseClient.from('cigarette_events').select('*').eq('user_id', userId),
      supabaseClient.from('alcohol_logs').select('*').eq('user_id', userId),
      supabaseClient.from('tasks').select('*').eq('user_id', userId),
      supabaseClient.from('points_ledger').select('*').eq('user_id', userId)
    ]);
    for (const result of [habits, entries, cigarettes, alcohol, tasks, ledger]) if (result.error) throw result.error;

    state.habits = mergeById(state.habits, habits.data || [], mapRemoteHabit);
    state.habitEntries = mergeById(state.habitEntries, entries.data || [], mapRemoteEntry);
    state.cigarettes = mergeById(state.cigarettes, cigarettes.data || [], mapRemoteCigarette);
    state.alcoholLogs = mergeById(state.alcoholLogs, alcohol.data || [], mapRemoteAlcohol);
    state.tasks = mergeById(state.tasks, tasks.data || [], mapRemoteTask);
    state.pointsLedger = mergeById(state.pointsLedger, ledger.data || [], mapRemoteLedger);
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

  const mapRemoteHabit = h => ({ id: h.id, name: h.name, type: h.type, unit: h.unit, direction: h.direction, target: h.target, icon: h.icon, color: h.color, is_archived: h.is_archived, created_at: h.created_at, updated_at: h.updated_at, synced: true });
  const mapRemoteEntry = e => ({ id: e.id, habit_id: e.habit_id, value_num: e.value_num, value_bool: e.value_bool, note: e.note, occurred_at: e.occurred_at, created_at: e.created_at, updated_at: e.updated_at, synced: true });
  const mapRemoteCigarette = c => ({ id: c.id, smoked_at: c.smoked_at, interval_minutes: c.interval_minutes, alcohol_context: c.alcohol_context, points: c.points, note: c.note, created_at: c.created_at, updated_at: c.updated_at, synced: true });
  const mapRemoteAlcohol = a => ({ id: a.id, log_date: a.log_date, consumed: a.consumed, note: a.note, created_at: a.created_at, updated_at: a.updated_at, synced: true });
  const mapRemoteTask = t => ({ id: t.id, title: t.title, description: t.description, effort: t.effort, status: t.status, due_at: t.due_at, completed_at: t.completed_at, points: t.points, created_at: t.created_at, updated_at: t.updated_at, synced: true });
  const mapRemoteLedger = p => ({ id: p.id, source_type: p.source_type, source_id: p.source_id, points: p.points, reason: p.reason, earned_at: p.earned_at, created_at: p.created_at, updated_at: p.created_at, synced: true });

  function exportJson() {
    const blob = new Blob([JSON.stringify({ state, settings: { ...settings, supabaseAnonKey: '' } }, null, 2)], { type: 'application/json' });
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
