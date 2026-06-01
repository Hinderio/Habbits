(function repairHabitFlowIndexShell(window, document) {
  'use strict';

  function appendOnce(parent, id, html) {
    if (!parent || document.getElementById(id)) return;
    parent.insertAdjacentHTML('beforeend', html);
  }

  function ensureHabitsSection(main) {
    let section = document.getElementById('screen-habits');
    if (!section) {
      main.insertAdjacentHTML('beforeend', '<section id="screen-habits" class="screen" data-screen="habits" hidden aria-hidden="true"></section>');
      section = document.getElementById('screen-habits');
    }
    if (document.getElementById('habitCards')) return;
    section.innerHTML = `
      <div class="section-toolbar glass habits-section-toolbar">
        <div><p class="eyebrow">Habits</p><h3>Deine Gewohnheiten</h3></div>
        <div class="habits-toolbar-actions">
          <div class="habits-pane-switch" role="tablist" aria-label="Habit Ansicht wählen">
            <button id="habitsOverviewTabBtn" class="habits-pane-btn is-active" type="button" data-habits-pane="overview" role="tab" aria-selected="true">Übersicht</button>
            <button id="habitsFitnessTabBtn" class="habits-pane-btn" type="button" data-habits-pane="fitness" role="tab" aria-selected="false">Fitness</button>
          </div>
          <button id="habitFormToggleBtn" class="bubble-add-btn" type="button" aria-label="Habit-Formular öffnen"><span data-icon="plus"></span></button>
        </div>
      </div>
      <div id="habitsOverviewPane" data-habits-pane-panel="overview">
        <section id="habitFormPanel" class="panel glass drawer-form-panel hidden">
          <div class="panel-head"><div><p class="eyebrow">Habit</p><h3 id="habitFormTitle">Habit erfassen</h3></div><button id="habitFormCloseBtn" class="icon-btn" type="button" aria-label="Habit-Formular schliessen">×</button></div>
          <form id="habitForm" class="form-grid">
            <label class="full"><span>Name</span><input name="name" required placeholder="z. B. Gewicht messen" /></label>
            <label><span>Typ</span><select name="type"><option value="boolean">Ja/Nein</option><option value="number" selected>Zahl</option><option value="duration">Dauer</option><option value="weight">Gewicht</option></select></label>
            <label><span>Einheit</span><input name="unit" placeholder="z. B. kg, x, Min." /></label>
            <label><span>Ziel</span><input name="target" type="number" step="0.01" inputmode="decimal" placeholder="optional" /></label>
            <label><span>Richtung</span><select name="direction"><option value="increase" selected>mehr ist besser</option><option value="decrease">weniger ist besser</option></select></label>
            <label><span>Icon</span><input name="icon" placeholder="z. B. weight, pushups" /></label>
            <div class="form-actions full"><button id="habitSubmitBtn" class="pill primary" type="submit">Habit speichern</button><button id="cancelHabitEditBtn" class="pill secondary hidden" type="button">Abbrechen</button></div>
          </form>
        </section>
        <section class="panel glass"><div class="panel-head"><div><p class="eyebrow">Übersicht</p><h3>Habit Cards</h3></div></div><div id="habitCards" class="habit-grid"></div></section>
        <section class="panel glass"><div class="panel-head"><div><p class="eyebrow">DNA</p><h3>Habit DNA</h3></div></div><div id="habitDnaOverview" class="habit-dna-overview"></div></section>
        <section class="panel glass"><div class="panel-head"><div><p class="eyebrow">Pausen</p><h3>Pausierte Habits</h3></div></div><div id="habitPauseList" class="stack-list"></div></section>
        <section class="panel glass"><div id="habitPlayfulStats" class="habit-playful-stats"></div></section>
      </div>
      <div id="fitnessHubPane" class="hidden" data-habits-pane-panel="fitness"><div id="fitnessHubContent"></div></div>`;
  }

  function ensureFitnessSection(main) {
    appendOnce(main, 'screen-fitness', `
      <section id="screen-fitness" class="screen" data-screen="fitness" hidden aria-hidden="true">
        <div class="section-toolbar glass"><div><p class="eyebrow">Fitness</p><h3>Fitness Hub</h3></div><button id="fitnessCoachBtn" class="pill primary" type="button">Coach öffnen</button></div>
        <div id="fitnessHubContent"></div>
      </section>`);
    appendOnce(document.body, 'fitnessCoachModal', `
      <div id="fitnessCoachModal" class="coach-modal hidden" role="dialog" aria-modal="true">
        <section class="coach-modal-card"><button id="fitnessCoachCloseBtn" class="icon-btn coach-close-btn" type="button" aria-label="Fitness Coach schliessen">×</button><div id="fitnessCoachContent"></div></section>
      </div>`);
  }

  function ensurePauseModal() {
    appendOnce(document.body, 'pauseModal', `
      <div id="pauseModal" class="coach-modal hidden" role="dialog" aria-modal="true">
        <section class="coach-modal-card"><button id="pauseModalCloseBtn" class="icon-btn coach-close-btn" type="button" aria-label="Pause schliessen">×</button><div class="panel-head"><div><p id="pauseScopeLabel" class="eyebrow">Pause</p><h3 id="pauseModalTitle">Pause erfassen</h3></div></div><form id="pauseForm" class="form-grid"><label><span>Start</span><input name="starts_at" type="datetime-local" /></label><label><span>Ende</span><input name="ends_at" type="datetime-local" /></label><label class="full"><span>Notiz</span><textarea name="note" rows="3"></textarea></label><div class="form-actions full"><button class="pill primary" type="submit">Pause speichern</button></div></form></section>
      </div>`);
  }

  function ensureTasksSection(main) {
    appendOnce(main, 'screen-tasks', `
      <section id="screen-tasks" class="screen" data-screen="tasks" hidden aria-hidden="true">
        <div class="section-toolbar glass"><div><p class="eyebrow">Tasks</p><h3>Aufgaben</h3></div><button id="taskFormToggleBtn" class="bubble-add-btn" type="button" aria-label="Aufgaben-Formular öffnen"><span data-icon="plus"></span></button></div>
        <section id="taskFormPanel" class="panel glass drawer-form-panel hidden"><div class="panel-head"><div><p class="eyebrow">Task</p><h3 id="taskFormTitle">Aufgabe erfassen</h3></div><button id="taskFormCloseBtn" class="icon-btn" type="button" aria-label="Aufgaben-Formular schliessen">×</button></div>
          <form id="taskForm" class="form-grid"><label class="full"><span>Titel</span><input name="title" required /></label><label class="full"><span>Beschreibung</span><textarea name="description" rows="3"></textarea></label><label><span>Aufwand</span><input name="effort" type="number" min="1" max="8" value="2" /></label><label><span>Priorität</span><select name="priority"><option value="low">Niedrig</option><option value="medium" selected>Normal</option><option value="high">Hoch</option><option value="urgent">Kritisch</option></select></label><label><span>Fällig</span><input name="due_at" type="datetime-local" /></label><label><span>Wiederholung</span><select id="taskRecurrenceSelect" name="recurrence"><option value="none" selected>Keine</option><option value="monthly">Monatlich</option></select></label><label class="full"><span>Bilder</span><input name="images" type="file" accept="image/*" multiple /></label><label id="taskImageRemoveLabel" class="full hidden"><input name="remove_images" type="checkbox" /> Bilder entfernen</label><small id="taskRecurrenceHint" class="full subtle"></small><small id="taskImageHint" class="full subtle"></small><div class="form-actions full"><button id="taskSubmitBtn" class="pill primary" type="submit">Aufgabe speichern</button><button id="cancelTaskEditBtn" class="pill secondary hidden" type="button">Abbrechen</button><span id="taskPointsPreview" class="badge muted">Aufwand × 20 Pkt.</span></div></form>
        </section>
        <section id="taskIdeasPanel" class="panel glass hidden"><div class="panel-head"><div><p class="eyebrow">Ideen</p><h3>Task-Ideen</h3></div><span id="taskIdeasCount" class="badge muted">0</span></div><form id="taskIdeaForm" class="form-grid"><label class="full"><span>Idee</span><input name="title" /></label><div class="form-actions full"><button class="pill primary" type="submit">Idee speichern</button></div></form><div id="taskIdeaList"></div></section>
        <section id="taskWeeklyPanel" class="panel glass hidden"><div class="panel-head"><div><p class="eyebrow">Woche</p><h3 id="taskWeeklyRange">Planung</h3></div><div><button id="taskWeeklyPrevBtn" class="mini-btn" type="button">←</button><button id="taskWeeklyTodayBtn" class="mini-btn" type="button">Heute</button><button id="taskWeeklyNextBtn" class="mini-btn" type="button">→</button></div></div><div id="taskWeeklyOverview"></div><div id="taskWeeklySuggestions"></div><div id="taskWeeklyDays"></div></section>
        <section id="taskBacklogPanel" class="panel glass hidden"><div id="taskBacklogList" data-backlog-drop></div></section>
        <section id="taskArchivePanel" class="panel glass hidden"><div id="taskArchiveList" data-task-archive-drop></div></section>
        <section id="taskTimelinePanel" class="panel glass hidden"><div id="taskTimeline"></div></section>
        <div class="action-row"><button id="taskIdeasToggleBtn" class="pill secondary" type="button">Ideen <span id="taskIdeasCount">0</span></button><button id="taskWeeklyToggleBtn" class="pill secondary" type="button">Wochenplanung</button><button id="taskBacklogToggleBtn" class="pill secondary" type="button">Backlog <span id="taskBacklogCount">0</span></button><button id="taskArchiveToggleBtn" class="pill secondary" type="button">Archiv <span id="taskArchiveCount">0</span></button><button id="taskTimelineToggleBtn" class="pill secondary" type="button">Timeline</button></div>
        <section class="panel glass"><div id="tasksList" class="kanban-shell"></div></section>
      </section>`);
    appendOnce(document.body, 'taskDetailModal', `<div id="taskDetailModal" class="coach-modal task-detail-modal hidden" role="dialog" aria-modal="true"><section class="coach-modal-card task-detail-card"><button id="taskDetailCloseBtn" class="icon-btn coach-close-btn" type="button" aria-label="Task-Detail schliessen">×</button><div id="taskDetailContent" class="task-detail-content"></div></section></div>`);
  }

  function ensureCalendarSection(main) {
    appendOnce(main, 'screen-calendar', `
      <section id="screen-calendar" class="screen" data-screen="calendar" hidden aria-hidden="true">
        <div class="section-toolbar glass"><div><p class="eyebrow">Kalender</p><h3>Termine & Tagesplanung</h3></div><button id="appointmentFormToggleBtn" class="bubble-add-btn" type="button"><span data-icon="plus"></span></button></div>
        <section id="appointmentFormPanel" class="panel glass drawer-form-panel hidden"><div class="panel-head"><div><p class="eyebrow">Termin</p><h3 id="appointmentFormTitle">Termin erfassen</h3></div><button id="appointmentFormCloseBtn" class="icon-btn" type="button">×</button></div><form id="appointmentForm" class="form-grid"><label class="full"><span>Titel</span><input name="title" required /></label><label><span>Start</span><input name="starts_at" type="datetime-local" required /></label><label><span>Ende</span><input name="ends_at" type="datetime-local" /></label><label><span>Typ</span><select name="appointment_type"><option value="personal" selected>Privat</option><option value="work">Arbeit</option><option value="health">Gesundheit</option><option value="social">Sozial</option><option value="admin">Admin</option><option value="other">Sonstiges</option></select></label><label><span>Ort</span><input name="location" /></label><label class="full"><span>Notiz</span><textarea name="description" rows="3"></textarea></label><div class="form-actions full"><button id="appointmentSubmitBtn" class="pill primary" type="submit">Termin speichern</button><button id="cancelAppointmentEditBtn" class="pill secondary hidden" type="button">Abbrechen</button></div></form></section>
        <section class="panel glass calendar-panel"><div class="panel-head calendar-head"><div><p class="eyebrow">Kalender</p><h3 id="calendarTitle">Monat</h3></div><div class="action-row"><button id="prevMonthBtn" class="icon-btn" type="button">‹</button><button id="todayMonthBtn" class="pill secondary" type="button">Heute</button><button id="nextMonthBtn" class="icon-btn" type="button">›</button></div></div><div class="calendar-weekdays"><span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span></div><div id="calendarGrid" class="calendar-grid"></div></section>
        <section class="panel glass"><div class="panel-head"><div><p class="eyebrow">Tagesdetails</p><h3 id="selectedDateTitle">Heute</h3></div><button class="pill secondary" type="button" data-action="new-appointment-for-day">Termin anlegen</button></div><div id="dayDetails" class="stack-list"></div></section>
      </section>`);
  }

  function ensureSettingsSection(main) {
    appendOnce(main, 'screen-settings', `
      <section id="screen-settings" class="screen" data-screen="settings" hidden aria-hidden="true"><div class="grid two-columns"><section class="panel glass"><div class="panel-head"><div><p class="eyebrow">Supabase Auth</p><h3>Privater Sync</h3></div><span id="syncStatus" class="badge muted">Verbinde…</span></div><form id="settingsForm" class="form-grid"><div class="sync-live-card full"><strong>Angemeldet als <span id="authUserEmail">–</span></strong><span>Private Synchronisierung.</span></div><div class="form-actions full"><button id="manualSyncBtn" class="pill primary" type="submit">Jetzt synchronisieren</button><button id="logoutBtn" class="pill secondary" type="button">Abmelden</button></div></form><pre id="sqlPreview" class="sql-preview"></pre><button id="copySqlBtn" class="mini-btn" type="button">SQL kopieren</button></section><section class="panel glass"><div class="panel-head"><div><p class="eyebrow">Daten</p><h3>Backup & Restore</h3></div></div><div class="action-row data-actions"><button id="exportBtn" class="pill secondary" type="button">JSON exportieren</button><label class="pill secondary file-input-pill">JSON importieren<input id="importInput" type="file" accept=".json,application/json" /></label><button id="resetBtn" class="pill danger" type="button">Demo zurücksetzen</button></div></section></div></section>`);
  }

  function repair() {
    const main = document.querySelector('main.content');
    if (!main) return;
    ensureHabitsSection(main);
    ensureFitnessSection(main);
    ensurePauseModal();
    ensureTasksSection(main);
    ensureCalendarSection(main);
    ensureSettingsSection(main);
  }

  repair();
})(window, document);

(function enhanceDashboardChartColors(window, document) {
  'use strict';

  const Chart = window.Chart;
  if (!Chart || Chart.registry?.plugins?.get?.('habitflow-native-dashboard-fills')) return;

  const POSITIVE = '#64D0CB';
  const NEGATIVE = '#FB9953';
  const DASHBOARD_CHART_IDS = new Set(['trendChart', 'pointsChart']);

  function chartId(chart) {
    return chart?.canvas?.id || '';
  }

  function selectedTrendMetric() {
    return document.getElementById('trendMetricSelect')?.value || '';
  }

  function isLowerBetterTrend(chart) {
    if (chartId(chart) !== 'trendChart') return false;
    const metric = selectedTrendMetric();
    return metric === 'cigarettes' || metric === 'alcohol';
  }

  function numericValue(raw) {
    if (raw && typeof raw === 'object') return Number(raw.y ?? raw.value ?? 0) || 0;
    return Number(raw || 0) || 0;
  }

  function pointTone(chart, value) {
    if (isLowerBetterTrend(chart)) return NEGATIVE;
    if (chartId(chart) === 'pointsChart' || selectedTrendMetric() === 'points') return value < 0 ? NEGATIVE : POSITIVE;
    return POSITIVE;
  }

  function fillForChart(chart) {
    if (chartId(chart) === 'pointsChart' || selectedTrendMetric() === 'points') {
      return { target: 'origin', above: POSITIVE, below: NEGATIVE };
    }
    const color = isLowerBetterTrend(chart) ? NEGATIVE : POSITIVE;
    return { target: 'origin', above: color, below: color };
  }

  function applyDashboardDatasetStyle(chart) {
    if (!DASHBOARD_CHART_IDS.has(chartId(chart))) return;
    chart.data.datasets.forEach(dataset => {
      dataset.fill = fillForChart(chart);
      dataset.backgroundColor = context => {
        const color = pointTone(chart, numericValue(context.raw));
        return color;
      };
      dataset.pointBorderColor = '#ffffff';
      dataset.pointBackgroundColor = context => pointTone(chart, numericValue(context.raw));
      dataset.borderColor = context => pointTone(chart, numericValue(context.raw));
      dataset.segment = {
        ...(dataset.segment || {}),
        borderColor: context => {
          const startValue = Number(context?.p0?.parsed?.y || 0);
          const endValue = Number(context?.p1?.parsed?.y || 0);
          if (isLowerBetterTrend(chart)) return NEGATIVE;
          if (chartId(chart) === 'pointsChart' || selectedTrendMetric() === 'points') return startValue < 0 || endValue < 0 ? NEGATIVE : POSITIVE;
          return POSITIVE;
        }
      };
    });
  }

  Chart.register({
    id: 'habitflow-native-dashboard-fills',
    beforeUpdate(chart) {
      applyDashboardDatasetStyle(chart);
    }
  });
})(window, document);
