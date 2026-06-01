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

    const hasOriginalStructure = Boolean(
      section.querySelector('#habitsOverviewPane.habits-pane')
      && section.querySelector('#habitCards.habit-card-grid')
      && section.querySelector('#habitFormToggleBtn')
      && !section.querySelector('.habits-section-toolbar')
    );
    if (hasOriginalStructure) return;

    section.innerHTML = `
      <div class="section-toolbar glass">
        <div><p class="eyebrow">Flexible Habits</p><h3>Gewohnheiten, Meditation & Quick Logging</h3></div>
        <button id="habitFormToggleBtn" class="bubble-add-btn" type="button" aria-label="Habit-Formular öffnen"><span data-icon="plus"></span></button>
      </div>
      <div id="habitsOverviewPane" class="habits-pane">
        <section id="habitFormPanel" class="panel glass drawer-form-panel hidden">
          <div class="panel-head"><div><p class="eyebrow">Flexible Habits</p><h3 id="habitFormTitle">Gewohnheit anlegen</h3></div><button id="habitFormCloseBtn" class="icon-btn" type="button" aria-label="Habit-Formular schliessen">×</button></div>
          <form id="habitForm" class="form-grid">
            <label><span>Name</span><input name="name" required placeholder="z. B. Gewicht, Wasser, Sport" /></label>
            <label><span>Typ</span><select name="type"><option value="number">Anzahl / Zahl</option><option value="weight">Gewicht</option><option value="boolean">Ja/Nein</option><option value="duration">Dauer</option></select></label>
            <label><span>Einheit</span><input name="unit" placeholder="kg, Stück, Minuten" /></label>
            <label><span>Zielrichtung</span><select name="direction"><option value="increase">mehr ist besser</option><option value="decrease">weniger ist besser</option></select></label>
            <label><span>Zielwert</span><input name="target" type="number" step="0.01" placeholder="optional" /></label>
            <label><span>Zielperiode</span><select name="target_period"><option value="day">Tagesziel</option><option value="week">Wochenziel</option><option value="month">Monatsziel</option></select></label>
            <label><span>Icon-Stil</span><input name="icon" value="number" placeholder="number, water, sport, standingDesk, pushups, bread, jogging, hiking, walking" /></label>
            <label><span>Schwierigkeit</span><select name="dna_difficulty"><option value="1">1 · sehr leicht</option><option value="2" selected>2 · eher leicht</option><option value="3">3 · mittel</option><option value="4">4 · anspruchsvoll</option><option value="5">5 · sehr anspruchsvoll</option></select></label>
            <label><span>Energielevel</span><select name="dna_energy"><option value="1">1 · sehr niedrig</option><option value="2">2 · niedrig</option><option value="3" selected>3 · mittel</option><option value="4">4 · hoch</option><option value="5">5 · sehr hoch</option></select></label>
            <label><span>Ideale Tageszeit</span><select name="dna_preferred_time"><option value="flexible" selected>Flexibel</option><option value="early">Früh</option><option value="morning">Morgens</option><option value="midday">Mittags</option><option value="afternoon">Nachmittags</option><option value="evening">Abends</option><option value="late">Spät</option></select></label>
            <label><span>Emotionale Hürde</span><select name="dna_emotional_hurdle"><option value="consistency" selected>Dranbleiben</option><option value="resistance">Innerer Widerstand</option><option value="stress">Stress / Druck</option><option value="perfectionism">Perfektionismus</option><option value="boredom">Langeweile</option><option value="tiredness">Müdigkeit</option></select></label>
            <label><span>Auslöser</span><select name="dna_trigger"><option value="routine" selected>Routine</option><option value="wakeup">Nach dem Aufstehen</option><option value="coffee">Nach Kaffee</option><option value="workstart">Arbeitsstart</option><option value="meal">Nach dem Essen</option><option value="afterwork">Feierabend</option><option value="workout">Nach Bewegung</option><option value="bedtime">Vor dem Schlafen</option></select></label>
            <label><span>Belohnung</span><select name="dna_reward"><option value="progress" selected>Fortschritt</option><option value="pride">Stolz</option><option value="calm">Ruhe</option><option value="clarity">Klarheit</option><option value="energy">Energie</option><option value="relief">Erleichterung</option></select></label>
            <div class="full form-inline-hint"><span class="form-inline-icon" data-icon="jogging"></span><div><strong>Fitness-ready:</strong><span>Wenn du ein Habit wie Joggen oder Wandern mit Icon <em>jogging</em> oder <em>hiking</em> anlegst, interpretiert die App den Log als Strecke in km und zeigt automatisch die Motivationslinien im Fitness-Tab.</span></div></div>
            <div class="form-actions full"><button id="habitSubmitBtn" class="pill primary" type="submit">Habit erstellen</button><button id="cancelHabitEditBtn" class="pill secondary hidden" type="button">Abbrechen</button></div>
          </form>
        </section>
        <section class="panel glass">
          <div class="panel-head"><div><p class="eyebrow">Habit DNA</p><h3>Muster statt nur Listen</h3></div><span class="subtle">lernt mit jedem Log</span></div>
          <div id="habitDnaOverview" class="habit-dna-overview"></div>
        </section>
        <section class="panel glass">
          <div class="panel-head"><div><p class="eyebrow">Heute</p><h3>Solide Kategorie-Tiles</h3></div><span class="subtle">antippen öffnet Details</span></div>
          <div id="habitCards" class="habit-card-grid"></div>
        </section>
        <section class="panel glass habit-story-panel">
          <div class="panel-head"><div><p class="eyebrow">Spielerische Stats</p><h3>Habits mit Story statt nur Zahlen</h3></div><span class="subtle">automatisch berechnet</span></div>
          <div id="habitPlayfulStats" class="habit-playful-grid"></div>
        </section>
      </div>`;
  }

  function ensureFallbackSections(main) {
    appendOnce(main, 'screen-fitness', '<section id="screen-fitness" class="screen" data-screen="fitness" hidden aria-hidden="true"><section class="panel glass fitness-screen-panel"><div id="fitnessHubContent"></div></section></section>');
    appendOnce(main, 'screen-tasks', '<section id="screen-tasks" class="screen" data-screen="tasks" hidden aria-hidden="true"><section class="panel glass"><div id="tasksList" class="kanban-shell"></div></section></section>');
    appendOnce(main, 'screen-calendar', '<section id="screen-calendar" class="screen" data-screen="calendar" hidden aria-hidden="true"><section class="panel glass calendar-panel"><div id="calendarGrid" class="calendar-grid"></div></section><section class="panel glass"><div id="dayDetails" class="stack-list"></div></section></section>');
    appendOnce(main, 'screen-settings', '<section id="screen-settings" class="screen" data-screen="settings" hidden aria-hidden="true"><section class="panel glass"><form id="settingsForm" class="form-grid"></form><pre id="sqlPreview" class="sql-preview"></pre><button id="copySqlBtn" class="mini-btn" type="button">SQL kopieren</button></section></section>');
  }

  function repair() {
    const main = document.querySelector('main.content');
    if (!main) return;
    ensureHabitsSection(main);
    ensureFallbackSections(main);
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

  function chartId(chart) { return chart?.canvas?.id || ''; }
  function selectedTrendMetric() { return document.getElementById('trendMetricSelect')?.value || ''; }
  function isLowerBetterTrend(chart) {
    const metric = selectedTrendMetric();
    return chartId(chart) === 'trendChart' && (metric === 'cigarettes' || metric === 'alcohol');
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
    if (chartId(chart) === 'pointsChart' || selectedTrendMetric() === 'points') return { target: 'origin', above: POSITIVE, below: NEGATIVE };
    const color = isLowerBetterTrend(chart) ? NEGATIVE : POSITIVE;
    return { target: 'origin', above: color, below: color };
  }
  function applyDashboardDatasetStyle(chart) {
    if (!DASHBOARD_CHART_IDS.has(chartId(chart))) return;
    chart.data.datasets.forEach(dataset => {
      dataset.fill = fillForChart(chart);
      dataset.backgroundColor = context => pointTone(chart, numericValue(context.raw));
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

  Chart.register({ id: 'habitflow-native-dashboard-fills', beforeUpdate: applyDashboardDatasetStyle });
})(window, document);
