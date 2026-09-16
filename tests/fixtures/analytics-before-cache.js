// Original functions from main 73f62f3, used as a behavior oracle.
  function pointsOnDate(key) {
    return sum(visibleLedgerPoints().filter(p => toDateKey(p.earned_at) === key).map(p => Number(p.points || 0))) +
      sum(visibleCigarettes().filter(c => toDateKey(c.smoked_at) === key && !state.pointsLedger.some(p => p.source_type === 'cigarette' && p.source_id === c.id)).map(c => Number(c.points || 0)));
  }

  function calendarPointsOnDate(key) {
    return sum(visibleLedgerPoints()
      .filter(p => p.source_type !== 'habit' && toDateKey(p.earned_at) === key)
      .map(p => Number(p.points || 0))) +
      sum(visibleCigarettes()
        .filter(c => toDateKey(c.smoked_at) === key && !state.pointsLedger.some(p => p.source_type === 'cigarette' && p.source_id === c.id))
        .map(c => Number(c.points || 0)));
  }

  function getLastCigarette() {
    return [...visibleCigarettes()].sort((a, b) => new Date(b.smoked_at) - new Date(a.smoked_at))[0] || null;
  }

  function cigarettesOnDate(key) {
    return visibleCigarettes().filter(c => toDateKey(c.smoked_at) === key);
  }

  function entriesForHabitOnDate(habitId, key) {
    return visibleHabitEntries(habitId).filter(e => e.habit_id === habitId && toDateKey(e.occurred_at) === key);
  }

  function buildMonthlyMagazineReview(monthKey = currentMonthKey(), source = {}) {
    const keys = monthMissionKeys(monthKey);
    const keySet = new Set(keys);
    const inMonth = value => keySet.has(toDateKey(value));
    const { end } = monthKeyRange(monthKey);
    const isComplete = toDateKey(end) < toDateKey(new Date());
    const missions = activeMonthlyMissions(monthKey);
    const missionStates = missions.map(monthlyMissionState);
    const missionSummary = monthlyMissionSummary(missions);
    const allSessions = source.sessions || buildFitnessSessions('all');
    const allCigarettes = source.cigarettes || visibleCigarettes();
    const allAlcoholUnits = source.alcoholUnits || alcoholDaysAsEvents();
    const allTasks = source.tasks || state.tasks.map(normalizeTask);
    const allHabitEntries = source.habitEntries || visibleHabitEntries();
    const sessions = allSessions.filter(session => inMonth(session.entry?.occurred_at || session.date));
    const jogs = sessions.filter(session => session.type === 'jogging');
    const hikes = sessions.filter(session => session.type === 'hiking');
    const runKm = sum(jogs.map(session => session.distanceKm));
    const hikeKm = sum(hikes.map(session => session.distanceKm));
    const ascent = sum(hikes.map(session => session.ascent));
    const cigarettes = allCigarettes.filter(cigarette => inMonth(cigarette.smoked_at));
    const eveningCigarettes = cigarettes.filter(cigarette => new Date(cigarette.smoked_at).getHours() >= 18).length;
    const alcoholUnits = allAlcoholUnits.filter(unit => inMonth(unit.occurred_at || unit.created_at));
    const tasksDone = allTasks.filter(task => task.status === 'done' && inMonth(task.completed_at || task.updated_at || task.created_at));
    const routineDayKeys = new Set((state.morningRoutineLogs || []).filter(log => inMonth(log.date_key || log.completed_at)).map(log => log.date_key || toDateKey(log.completed_at)));
    const routines = routineDayKeys.size;
    const habitEntries = allHabitEntries.filter(entry => inMonth(entry.occurred_at || entry.created_at));
    const habitDays = new Set(habitEntries.map(entry => toDateKey(entry.occurred_at || entry.created_at)).filter(Boolean)).size;
    const activeDayKeys = new Set([
      ...sessions.map(session => toDateKey(session.entry?.occurred_at || session.date)),
      ...tasksDone.map(task => toDateKey(task.completed_at || task.updated_at || task.created_at)),
      ...habitEntries.map(entry => toDateKey(entry.occurred_at || entry.created_at)),
      ...routineDayKeys
    ].filter(Boolean));
    const cigaretteDayKeys = new Set(cigarettes.map(cigarette => toDateKey(cigarette.smoked_at)).filter(Boolean));
    const alcoholDayKeys = new Set(alcoholUnits.map(unit => toDateKey(unit.occurred_at || unit.created_at)).filter(Boolean));
    const cleanDays = [...activeDayKeys].filter(key => !cigaretteDayKeys.has(key) && !alcoholDayKeys.has(key)).length;
    const smokeFreeEvenings = countMonthlyMissionProgress({ metric: 'smoke_free_evenings', target: 1, month_key: monthKey, title: 'Rauchfreie Abende' });
    const points = monthlyMagazinePoints(monthKey, keySet, source);
    const achievements = [
      missionSummary.completed ? { icon: 'reward', label: 'Missionen abgeschlossen', value: `${missionSummary.completed}/${missionSummary.count}`, detail: 'Monatsziele wirklich ins Ziel gebracht.', score: 120 + missionSummary.completed * 10 } : null,
      missionSummary.average ? { icon: 'habits', label: 'Missions-Fortschritt', value: `${missionSummary.average}%`, detail: `${missionSummary.count} aktive Mission${missionSummary.count === 1 ? '' : 'en'} im Fokus.`, score: missionSummary.average } : null,
      jogs.length ? { icon: 'jogging', label: 'Lauf-Momentum', value: `${jogs.length}×`, detail: `${formatKmValue(runKm)} im Monat.`, score: 45 + runKm * 2 + jogs.length * 8 } : null,
      hikes.length ? { icon: 'hiking', label: 'Wandern', value: `${hikes.length}×`, detail: `${formatKmValue(hikeKm)} · ${formatMetersValue(ascent)}.`, score: 45 + hikeKm * 1.6 + ascent / 35 } : null,
      smokeFreeEvenings ? { icon: 'smoke', label: 'Rauchfreie Abende', value: `${smokeFreeEvenings}`, detail: 'Abendfenster ohne Rauch-Log.', score: smokeFreeEvenings * 5 } : null,
      tasksDone.length ? { icon: 'tasks', label: 'Tasks erledigt', value: `${tasksDone.length}`, detail: 'sichtbares Produktivitäts-Momentum.', score: 35 + tasksDone.length * 4 } : null,
      routines ? { icon: 'meditation', label: 'Morgenroutine', value: `${routines}×`, detail: 'stabilisierende Starts in den Tag.', score: 35 + routines * 5 } : null,
      points ? { icon: 'reward', label: 'XP gesammelt', value: `${points.toLocaleString('de-CH')}`, detail: 'über Ledger, Habits und Entscheidungen.', score: Math.min(110, Math.abs(points) / 8) } : null
    ].filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 3);
    const strongestPattern = (() => {
      if (jogs.length + hikes.length >= 4) return { value: 'Bewegung trägt', body: `${jogs.length + hikes.length} Fitness-Signale zeigen: dein Monat profitiert sichtbar von Bewegung.` };
      if (smokeFreeEvenings >= Math.max(4, Math.round(keys.length * 0.65))) return { value: 'Ruhige Abende', body: `${smokeFreeEvenings} rauchfreie Abende sind dein stärkstes Konsum-Muster.` };
      if (eveningCigarettes >= Math.max(3, Math.round(cigarettes.length * 0.5))) return { value: 'Abendfenster', body: `${eveningCigarettes} Rauch-Logs liegen ab 18 Uhr. Ein Abend-Playbook wäre der grösste Hebel.` };
      if (tasksDone.length >= 8) return { value: 'Task-Momentum', body: `${tasksDone.length} erledigte Aufgaben machen Produktivität zum dominanten Muster.` };
      if (routines >= 5) return { value: 'Routine-Anker', body: `${routines} Morgenroutinen stabilisieren den Monat stärker als grosse Einzelaktionen.` };
      return { value: 'Daten entstehen', body: 'Noch kein dominantes Muster. Die Ausgabe wird mit jedem Log konkreter.' };
    })();
    const closeMission = missionStates
      .filter(item => !item.completed)
      .sort((a, b) => b.ratio - a.ratio || a.remaining - b.remaining)[0] || null;
    const missedMission = closeMission
      ? { value: closeMission.ratio >= 70 ? 'Knapp dran' : 'Offener Hebel', body: `${closeMission.mission.title}: ${closeMission.progress}/${closeMission.target}. Noch ${closeMission.remaining} ${monthlyMissionMetricMeta(closeMission.mission.metric).unit}.` }
      : missionStates.length
        ? { value: 'Keine Lücke', body: 'Alle aktiven Monatsmissionen sind erledigt oder aktuell ohne Rückstand.' }
        : { value: 'Noch frei', body: 'Erstelle 1–3 Monatsmissionen, dann erkennt das Magazine automatisch knapp verpasste Ziele.' };
    const bestDecision = buildMonthlyMagazineBestDay(keys, source);
    const compass = source.compass || buildTrainingCompassModel(allSessions);
    const nextFocus = closeMission
      ? { value: closeMission.mission.title, body: monthlyMissionStatusText(closeMission) }
      : (compass?.weakest?.label
        ? { value: compass.weakest.label, body: `Für nächste Woche: ${compass.weakest.cue}` }
        : { value: 'Ein Mini-Ziel', body: 'Wähle ein kleines Monatsziel und halte die Ausgabe bewusst fokussiert.' });
    const score = Math.round(clampNumber((missionSummary.average * 0.42) + Math.min(30, achievements.length * 10) + Math.min(18, Math.max(0, points) / 90) + Math.min(10, sessions.length * 2), 0, 100));
    const cover = monthlyMagazineCoverUrl(score, monthKey);
    return {
      monthKey,
      label: monthKeyLabel(monthKey),
      isComplete,
      score,
      cover,
      stats: [
        { label: 'Missionen', value: missionSummary.count ? `${missionSummary.completed}/${missionSummary.count}` : '0', detail: `${missionSummary.average}% Fortschritt` },
        { label: 'Fitness', value: `${sessions.length}×`, detail: `${formatKmValue(runKm + hikeKm)} · ${formatMetersValue(ascent)}` },
        { label: 'Konsum', value: `${cigarettes.length}×`, detail: `${smokeFreeEvenings} rauchfreie Abende · ${alcoholUnits.length} Alkohol-Konsumtage` },
        { label: 'Fokus', value: `${tasksDone.length}`, detail: `Tasks · ${routines} Routinen` }
      ],
      achievements: achievements.length ? achievements : [{ icon: 'reward', label: 'Ausgabe startet', value: 'Live', detail: 'Logge diesen Monat erste Signale, dann füllt sich das Magazine automatisch.' }],
      strongestPattern,
      missedMission,
      bestDecision,
      nextFocus,
      facts: {
        missionCount: missionSummary.count,
        missionCompleted: missionSummary.completed,
        missionAverage: missionSummary.average,
        fitnessSessions: sessions.length,
        jogs: jogs.length,
        hikes: hikes.length,
        runKm,
        hikeKm,
        ascent,
        cigarettes: cigarettes.length,
        eveningCigarettes,
        smokeFreeEvenings,
        alcoholUnits: alcoholUnits.length,
        tasksDone: tasksDone.length,
        routines,
        habitLogs: habitEntries.length,
        habitDays,
        activeDays: activeDayKeys.size,
        cleanDays,
        points
      }
    };
  }

  function renderHabits() {
    const activeInput = document.activeElement?.closest?.('#habitCards input[id^="habit-card-input-"]') || null;
    const activeInputId = activeInput?.id || '';
    const activeInputSelection = activeInput ? { start: activeInput.selectionStart, end: activeInput.selectionEnd } : null;
    const habitInputDrafts = collectHabitInputDrafts();
    const activeHabits = state.habits.filter(h => !h.is_archived).map(normalizeHabit);
    syncHabitsExperienceUi();
    pruneExpandedHabitCardIds(activeHabits.map(habit => habit.id));
    renderHabitDnaOverview(activeHabits);
    renderHabitPlayfulStats(activeHabits);
    if (!activeHabits.length) {
      els.habitCards.innerHTML = '<div class="empty-state">Lege deine erste flexible Gewohnheit an. Unterstützt werden Gewicht, Zahlen, Ja/Nein und Dauer.</div>';
      return;
    }

    els.habitCards.innerHTML = activeHabits.map(habit => {
      const periodMeta = habitTargetPeriodMeta(habit);
      const periodValue = habitValueForPeriod(habit);
      const todayEntries = entriesForHabitOnDate(habit.id, toDateKey(new Date()));
      const todayValue = habit.type === 'boolean' && !isFitnessDistanceHabit(habit)
        ? todayEntries.some(e => e.value_bool)
        : todayEntries.reduce((sum, e) => sum + Number(e.value_num || 0), 0);
      const unit = effectiveHabitUnit(habit);
      const category = habitCategoryMeta(habit);
      const iconKey = habitIconKey(habit);
      const habitPause = activePauseNow('habit', habit.id);
      const fulfilled = habitFulfillmentState(habit, { periodValue, todayEntries, todayValue });
      const progress = habitProgressPercent(habit, periodValue, todayEntries);
      const isSystemHabit = isSystemMeditationHabit(habit);
      const dna = buildHabitDna(habit);
      const todayLabel = formatHabitValue(habit, todayValue);
      const targetLabel = habit.target ? `${periodMeta.short}: ${periodValue.label} / ${habit.target}${unit ? ` ${unit}` : ''}` : 'ohne Zielwert';
      const pauseLabel = habitPause ? (habitPause.ends_at ? `bis ${formatDateTimeCompact(habitPause.ends_at)}` : 'ohne Enddatum') : '';
      const activityLabel = habitPause ? 'Pausiert' : fulfilled ? 'Erfüllt' : (todayEntries.length ? `${todayEntries.length} Log${todayEntries.length === 1 ? '' : 's'} heute` : 'Heute offen');
      const inputId = `habit-card-input-${habit.id}`;
      const quickControl = isSystemHabit
        ? `<button class="mini-btn primary habit-quick-check" type="button" data-action="open-habit-detail" data-id="${habit.id}">Techniken öffnen</button>`
        : renderHabitQuickLogControl(habit, { inputId, todayValue, buttonLabel: habit.type === 'boolean' && !isFitnessDistanceHabit(habit) ? 'Abhaken' : 'Loggen' });

      return `<article class="habit-card ${isSystemHabit ? 'is-meditation-habit' : ''} ${editingHabitId === habit.id ? 'is-editing' : ''} ${fulfilled ? 'is-complete' : ''} ${habitPause ? 'is-paused' : ''}" style="${habitCategoryStyle(category)}">
        <button class="habit-card-open" type="button" data-action="open-habit-detail" data-id="${habit.id}" aria-label="Details für ${escapeHtml(habit.name)} öffnen">
          <span class="habit-card-art" aria-hidden="true">${svgIcon(iconKey, 'ui-icon')}</span>
          <span class="habit-card-main">
            <span class="habit-category-pill">${escapeHtml(category.label)}</span>
            <strong>${escapeHtml(habit.name)}</strong>
            <small>${habit.typeLabel || typeLabel(habit.type)}${unit ? ` · ${escapeHtml(unit)}` : ''} · ${escapeHtml(periodMeta.label)}</small>
          </span>
          <span class="habit-card-status-badge">${escapeHtml(activityLabel)}</span>
          ${habitPause ? `<span class="habit-card-pause-note">${escapeHtml(pauseLabel)}</span>` : ''}
          <span class="habit-card-value-row"><span>Heute</span><strong>${escapeHtml(todayLabel)}</strong></span>
          <span class="habit-progress-track" aria-hidden="true"><i style="width:${progress}%"></i></span>
          <span class="habit-card-meta-row"><span>${Math.round(dna.completionRate * 100)}% Treffer</span><span>${escapeHtml(targetLabel)}</span></span>
        </button>
        <div class="habit-card-quick">
          ${quickControl}
          <button class="mini-btn habit-card-more" type="button" data-action="open-habit-detail" data-id="${habit.id}">Details</button>
        </div>
      </article>`;
    }).join('');

    habitInputDrafts.forEach((value, inputId) => {
      const input = document.getElementById(inputId);
      if (input && value) input.value = value;
    });
    if (activeInputId) {
      const restored = document.getElementById(activeInputId);
      if (restored) {
        requestAnimationFrame(() => {
          restored.focus({ preventScroll: true });
          if (activeInputSelection && typeof restored.setSelectionRange === 'function') {
            try { restored.setSelectionRange(activeInputSelection.start, activeInputSelection.end); } catch {}
          }
        });
      }
    }
  }

  function renderHabitDnaOverview(activeHabits = []) {
    if (!els.habitDnaOverview) return;
    if (!activeHabits.length) {
      els.habitDnaOverview.innerHTML = `<div class="empty-state">Noch keine Habit DNA. Lege einen Habit an, dann erscheinen Schwierigkeit, Energie, ideale Tageszeit und Abbruchrisiko automatisch hier.</div>`;
      return;
    }
    const portfolio = buildHabitDnaPortfolio(activeHabits);
    const highRisk = portfolio.profiles.filter(profile => profile.riskMeta.tone === 'high').length;
    els.habitDnaOverview.innerHTML = `<div class="habit-dna-hero">
      <div>
        <p class="eyebrow">Habit DNA</p>
        <h3>${escapeHtml(portfolio.headline)}</h3>
        <p>${escapeHtml(portfolio.summary)}</p>
      </div>
      <span class="badge muted">${portfolio.profiles.length} Profile · ${highRisk} sensibel</span>
    </div>
    <div class="habit-dna-insights">
      <article class="habit-dna-insight-card">
        <small>Starkes Muster</small>
        <strong>${escapeHtml(portfolio.stableText)}</strong>
        <p>${portfolio.strongest.length ? `Top: ${escapeHtml(portfolio.strongest.map(item => item.habit.name).join(' · '))}` : 'Noch kein klares Muster'}</p>
      </article>
      <article class="habit-dna-insight-card">
        <small>Fragiles Muster</small>
        <strong>${escapeHtml(portfolio.fragileText)}</strong>
        <p>${portfolio.weakest.length ? `Achte auf: ${escapeHtml(portfolio.weakest.map(item => item.habit.name).join(' · '))}` : 'Noch keine Risikohabits'}</p>
      </article>
      <article class="habit-dna-insight-card">
        <small>Coach-Stil</small>
        <strong>${escapeHtml(portfolio.coachStyle)}</strong>
        <p>${portfolio.coachStyle === 'sanfter Druck' ? 'Klein starten, sauber schliessen, dann steigern.' : 'Klare Mini-Challenges und sichtbare Schritte funktionieren gut.'}</p>
      </article>
    </div>`;
  }
