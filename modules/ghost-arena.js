(function registerHabitFlowGhostArena(window, document) {
  'use strict';

  if (window.__HabitFlowGhostArenaActive) return;
  window.__HabitFlowGhostArenaActive = true;

  const STORAGE_KEY = 'habitflow-state-v1';
  const DAY_MS = 24 * 60 * 60 * 1000;
  const CLOSED_TASK_STATUSES = new Set(['done', 'archived', 'closed', 'completed']);
  let renderTimer = 0;
  let lastFingerprint = '';
  let observer = null;

  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, Number(value) || 0));
  const sum = values => values.reduce((total, value) => total + (Number(value) || 0), 0);

  function readState() {
    try {
      const state = JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || '{}');
      return state && typeof state === 'object' ? state : {};
    } catch {
      return {};
    }
  }

  function asTime(value) {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function dateKey(value) {
    const date = value instanceof Date ? value : new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function comparisonWindows(now = new Date()) {
    const currentStart = new Date(now);
    currentStart.setHours(0, 0, 0, 0);
    currentStart.setDate(currentStart.getDate() - 6);
    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - 7);
    const previousEnd = new Date(now);
    previousEnd.setDate(previousEnd.getDate() - 7);
    return {
      now,
      current: { start: currentStart.getTime(), end: now.getTime() },
      previous: { start: previousStart.getTime(), end: previousEnd.getTime() },
      elapsedDays: 7
    };
  }

  function inWindow(value, range) {
    const time = asTime(value);
    return time >= range.start && time <= range.end;
  }

  function isPausedAt(value, scope, targetId, state) {
    const time = asTime(value);
    if (!time) return false;
    return (Array.isArray(state.pausePeriods) ? state.pausePeriods : []).some(period => {
      if (!period || period.is_archived) return false;
      const periodScope = period.scope || period.pause_scope;
      if (periodScope !== scope) return false;
      if (scope === 'habit' && String(period.target_id || '') !== String(targetId || '')) return false;
      const start = asTime(period.starts_at);
      const end = period.ends_at ? asTime(period.ends_at) : Infinity;
      return start && start <= time && time <= end;
    });
  }

  function habitKind(habit = {}) {
    const name = String(habit.name || '').toLowerCase();
    const icon = String(habit.icon || habit.system_key || '').toLowerCase();
    if (name.includes('wander') || icon.includes('hiking')) return 'hiking';
    if (name.includes('jogg') || name.includes('lauf') || icon.includes('jogging')) return 'jogging';
    if (name.includes('spazier') || icon.includes('walking')) return 'walking';
    return icon;
  }

  function activeHabits(state) {
    return (Array.isArray(state.habits) ? state.habits : []).filter(habit => habit && habit.id && !habit.is_archived);
  }

  function activeHabitEntries(state) {
    return (Array.isArray(state.habitEntries) ? state.habitEntries : []).filter(entry =>
      entry && entry.habit_id && entry.occurred_at && !isPausedAt(entry.occurred_at, 'habit', entry.habit_id, state)
    );
  }

  function activeCigarettes(state) {
    return (Array.isArray(state.cigarettes) ? state.cigarettes : [])
      .filter(item => item && item.smoked_at && !item.is_archived && !item.deleted_at)
      .filter(item => !isPausedAt(item.smoked_at, 'smoke', null, state))
      .sort((a, b) => asTime(a.smoked_at) - asTime(b.smoked_at));
  }

  function completedTaskTime(task = {}) {
    if (!CLOSED_TASK_STATUSES.has(String(task.status || '').toLowerCase())) return 0;
    return asTime(task.completed_at || task.updated_at || task.created_at);
  }

  function median(values = []) {
    const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function smokeIntervalsForRange(cigarettes, range) {
    const intervals = [];
    cigarettes.forEach((item, index) => {
      if (!index || !inWindow(item.smoked_at, range)) return;
      const minutes = (asTime(item.smoked_at) - asTime(cigarettes[index - 1].smoked_at)) / 60000;
      if (minutes > 0 && minutes <= 16 * 60) intervals.push(minutes);
    });
    return intervals;
  }

  function alcoholDateKeys(state) {
    const keys = new Set();
    (Array.isArray(state.alcoholLogs) ? state.alcoholLogs : []).forEach(item => {
      const key = String(item?.log_date || '').slice(0, 10);
      if (key && item?.consumed !== false && !isPausedAt(`${key}T12:00:00`, 'alcohol', null, state)) keys.add(key);
    });
    (Array.isArray(state.alcoholUnits) ? state.alcoholUnits : []).forEach(item => {
      const value = item?.occurred_at || item?.created_at;
      const key = dateKey(value);
      if (key && !isPausedAt(value, 'alcohol', null, state)) keys.add(key);
    });
    return keys;
  }

  function metricsForRange(state, range, elapsedDays) {
    const habits = activeHabits(state);
    const habitIds = new Set(habits.map(habit => String(habit.id)));
    const entries = activeHabitEntries(state).filter(entry => habitIds.has(String(entry.habit_id)) && inWindow(entry.occurred_at, range));
    const habitDays = new Set(entries.map(entry => `${entry.habit_id}:${dateKey(entry.occurred_at)}`).filter(Boolean));
    const fitnessIds = new Set(habits.filter(habit => ['hiking', 'jogging', 'walking'].includes(habitKind(habit))).map(habit => String(habit.id)));
    const tasks = (Array.isArray(state.tasks) ? state.tasks : []).filter(task => {
      const time = completedTaskTime(task);
      return time >= range.start && time <= range.end;
    });
    const cigarettes = activeCigarettes(state);
    const rangeCigarettes = cigarettes.filter(item => inWindow(item.smoked_at, range));
    const intervals = smokeIntervalsForRange(cigarettes, range);
    const alcoholKeys = [...alcoholDateKeys(state)].filter(key => inWindow(`${key}T12:00:00`, range));
    const coverageTarget = Math.max(1, habits.length * elapsedDays);
    return {
      habitDays: habitDays.size,
      habitLogs: entries.length,
      habitCoverage: clamp(habitDays.size / coverageTarget),
      tasks: tasks.length,
      distance: sum(entries.filter(entry => fitnessIds.has(String(entry.habit_id))).map(entry => entry.value_num)),
      cigarettes: rangeCigarettes.length,
      smokeMedian: median(intervals),
      smokeIntervals: intervals,
      alcoholDays: alcoholKeys.length,
      actionCount: habitDays.size + tasks.length * 2 + Math.ceil(sum(entries.filter(entry => fitnessIds.has(String(entry.habit_id))).map(entry => entry.value_num)))
    };
  }

  function pairStrength(current, previous, higherIsBetter = true) {
    const a = Math.max(0, Number(current) || 0);
    const b = Math.max(0, Number(previous) || 0);
    if (!a && !b) return 50;
    return clamp(higherIsBetter ? a / (a + b) : b / (a + b), 0, 1) * 100;
  }

  function ghostScore(current, previous) {
    const strengths = [
      { value: pairStrength(current.habitDays, previous.habitDays, true), weight: .3 },
      { value: pairStrength(current.tasks, previous.tasks, true), weight: .25 },
      { value: pairStrength(current.distance, previous.distance, true), weight: .2 },
      { value: pairStrength(current.cigarettes, previous.cigarettes, false), weight: .25 }
    ];
    const currentScore = Math.round(sum(strengths.map(item => item.value * item.weight)));
    return { current: currentScore, ghost: 100 - currentScore };
  }

  function peakSmokeWindow(cigarettes = []) {
    const buckets = new Map([['Morgen', 0], ['Mittag', 0], ['Abend', 0], ['Spätabend', 0]]);
    cigarettes.forEach(item => {
      const hour = new Date(item.smoked_at).getHours();
      const key = hour < 11 && hour >= 5 ? 'Morgen' : hour < 16 && hour >= 11 ? 'Mittag' : hour < 21 && hour >= 16 ? 'Abend' : 'Spätabend';
      buckets.set(key, (buckets.get(key) || 0) + 1);
    });
    const [label, count] = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0] || ['Abend', 0];
    return { label, count, share: cigarettes.length ? count / cigarettes.length : 0 };
  }

  function openOverdueTasks(state, now) {
    return (Array.isArray(state.tasks) ? state.tasks : []).filter(task => {
      if (!task || CLOSED_TASK_STATUSES.has(String(task.status || '').toLowerCase())) return false;
      const due = asTime(task.due_at || task.due_date);
      return due > 0 && due < now.getTime();
    });
  }

  function detectBoss(state, windows, current, previous, score) {
    const historyRange = { start: windows.current.start - 28 * DAY_MS, end: windows.current.start - 1 };
    const history = metricsForRange(state, historyRange, 28);
    const historyCigarettes = activeCigarettes(state).filter(item => inWindow(item.smoked_at, historyRange));
    const smokePeak = peakSmokeWindow(historyCigarettes);
    const overdue = openOverdueTasks(state, windows.now);
    const alcoholHistoryKeys = [...alcoholDateKeys(state)].filter(key => inWindow(`${key}T12:00:00`, historyRange));
    const weekendAlcohol = alcoholHistoryKeys.filter(key => [0, 6].includes(new Date(`${key}T12:00:00`).getDay())).length;
    const candidates = [];

    if (activeHabits(state).length) candidates.push({ key: 'habit', severity: clamp((.72 - history.habitCoverage) / .72) });
    if (overdue.length) candidates.push({ key: 'tasks', severity: clamp(overdue.length / 6) });
    if (historyCigarettes.length >= 5) candidates.push({ key: 'smoke', severity: clamp(historyCigarettes.length / 28) * .45 + clamp((smokePeak.share - .25) / .5) * .55 });
    if (alcoholHistoryKeys.length >= 3) candidates.push({ key: 'alcohol', severity: clamp(alcoholHistoryKeys.length / 8) * .45 + clamp(weekendAlcohol / alcoholHistoryKeys.length) * .55 });

    const selected = candidates.sort((a, b) => b.severity - a.severity)[0];
    const fallback = !selected || selected.severity < .22;
    const key = fallback ? 'momentum' : selected.key;
    let progress = score.current / 100;
    let model = {
      key,
      title: 'Trägheitsfeld',
      eyebrow: 'Wochen-Boss',
      description: 'Dein Gegner ist nicht fehlende Motivation, sondern ungenutztes Momentum zwischen guten Aktionen.',
      evidence: `${current.actionCount} wirksame Aktionen im fairen Wochenfenster`,
      nextMove: 'Schliesse heute einen kleinen Habit oder eine offene Aufgabe sauber ab.',
      tone: 'teal'
    };

    if (key === 'habit') {
      const target = Math.max(.65, previous.habitCoverage + .1);
      progress = clamp(current.habitCoverage / target);
      model = {
        key,
        title: 'Rhythmusbruch',
        eyebrow: 'Persönliches Muster',
        description: 'Deine schwierigste Phase entsteht aktuell dort, wo mehrere Habits gleichzeitig aus dem Takt geraten.',
        evidence: `${Math.round(history.habitCoverage * 100)}% Abdeckung im 28-Tage-Fenster`,
        nextMove: 'Logge heute die kleinste realistische Version eines noch offenen Habits.',
        tone: 'teal'
      };
    } else if (key === 'tasks') {
      const target = Math.max(3, previous.tasks + 1);
      progress = clamp(current.tasks / target);
      model = {
        key,
        title: 'Offene Schleifen',
        eyebrow: 'Fokus-Boss',
        description: 'Überfällige Aufgaben binden Aufmerksamkeit. Der Boss verliert Energie durch echte Abschlüsse, nicht durch neue Planung.',
        evidence: `${overdue.length} überfällige Aufgabe${overdue.length === 1 ? '' : 'n'} erkannt`,
        nextMove: 'Schliesse die kleinste überfällige Aufgabe oder reduziere sie auf den nächsten konkreten Schritt.',
        tone: 'violet'
      };
    } else if (key === 'smoke') {
      const baseline = Math.max(30, history.smokeMedian || 90);
      const qualifying = current.smokeIntervals.filter(minutes => minutes >= baseline).length;
      const target = Math.max(2, Math.ceil(windows.elapsedDays * .7));
      const reduction = previous.cigarettes ? clamp((previous.cigarettes - current.cigarettes) / previous.cigarettes) : 0;
      progress = Math.max(clamp(qualifying / target), reduction);
      model = {
        key,
        title: `${smokePeak.label}-Autopilot`,
        eyebrow: 'Konsum-Boss',
        description: `Dein stärkstes wiederkehrendes Rauchfenster liegt aktuell am ${smokePeak.label.toLowerCase()}. Bewusste Pausen verursachen hier den meisten Schaden.`,
        evidence: `${Math.round(smokePeak.share * 100)}% der letzten Rauchmomente in diesem Fenster`,
        nextMove: `Halte die nächste Pause mindestens ${formatDuration(baseline)} und entscheide danach neu.`,
        tone: 'orange'
      };
    } else if (key === 'alcohol') {
      const reduction = previous.alcoholDays ? clamp((previous.alcoholDays - current.alcoholDays) / previous.alcoholDays) : (current.alcoholDays ? 0 : clamp(windows.elapsedDays / 7));
      progress = reduction;
      model = {
        key,
        title: 'Wochenend-Sog',
        eyebrow: 'Kontext-Boss',
        description: 'Dein Muster verdichtet sich rund um Wochenenden. Bewusst freie Tage und geplante Grenzen schwächen es.',
        evidence: `${weekendAlcohol}/${alcoholHistoryKeys.length} Konsumtage lagen am Wochenende`,
        nextMove: 'Lege vor dem nächsten sozialen Fenster eine klare alkoholfreie oder begrenzte Entscheidung fest.',
        tone: 'amber'
      };
    }

    const damage = Math.round(clamp(progress) * 1000);
    return { ...model, progress: clamp(progress), damage, hp: Math.max(0, 1000 - damage), defeated: damage >= 1000 };
  }

  function formatNumber(value, digits = 0) {
    return Number(value || 0).toLocaleString('de-CH', { maximumFractionDigits: digits });
  }

  function formatDuration(minutes) {
    const value = Math.max(0, Math.round(Number(minutes) || 0));
    if (value >= 60) return `${Math.floor(value / 60)}h ${value % 60}m`;
    return `${value}m`;
  }

  function formatRange(range) {
    const start = new Date(range.start).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
    const end = new Date(range.end).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
    return `${start}–${end}`;
  }

  function metricCard(label, current, previous, options = {}) {
    const higher = options.higher !== false;
    const currentValue = Number(current) || 0;
    const previousValue = Number(previous) || 0;
    const difference = higher ? currentValue - previousValue : previousValue - currentValue;
    const tone = Math.abs(difference) < .01 ? 'even' : difference > 0 ? 'win' : 'watch';
    const format = options.format || (value => formatNumber(value));
    return `<article class="hf-ghost-metric is-${tone}">
      <div><small>${escapeHtml(label)}</small><span>${tone === 'win' ? '↗' : tone === 'watch' ? '↘' : '—'}</span></div>
      <strong>${escapeHtml(format(currentValue))}</strong>
      <p>Ghost <b>${escapeHtml(format(previousValue))}</b></p>
    </article>`;
  }

  function modelForState(state) {
    const windows = comparisonWindows(new Date());
    const current = metricsForRange(state, windows.current, windows.elapsedDays);
    const previous = metricsForRange(state, windows.previous, windows.elapsedDays);
    const score = ghostScore(current, previous);
    const boss = detectBoss(state, windows, current, previous, score);
    return { windows, current, previous, score, boss };
  }

  function arenaMarkup(model) {
    const { windows, current, previous, score, boss } = model;
    const contest = score.current > score.ghost ? 'ahead' : score.current < score.ghost ? 'behind' : 'even';
    const contestLabel = contest === 'ahead' ? 'Du führst' : contest === 'behind' ? 'Ghost führt' : 'Gleichstand';
    return `<div class="hf-ghost-arena-shell">
      <header class="hf-ghost-arena-head">
        <div>
          <p class="eyebrow">Ghost Arena</p>
          <h3 id="hfGhostArenaTitle">Du gegen dein wiederkehrendes Muster</h3>
          <span>Rollierender Vergleich: letzte 7 Tage gegen die 7 Tage davor.</span>
        </div>
        <div class="hf-ghost-live"><i></i><span>Lokal berechnet</span></div>
      </header>

      <div class="hf-ghost-arena-grid">
        <article class="hf-ghost-duel-card">
          <div class="hf-ghost-card-kicker"><span>Ghost Mode</span><small>${escapeHtml(formatRange(windows.current))} vs. ${escapeHtml(formatRange(windows.previous))}</small></div>
          <div class="hf-ghost-scoreboard is-${contest}">
            <div><small>Du</small><strong>${score.current}</strong></div>
            <span><b>${escapeHtml(contestLabel)}</b><small>Momentum Score</small></span>
            <div><small>Ghost</small><strong>${score.ghost}</strong></div>
          </div>
          <div class="hf-ghost-duel-track" aria-label="Momentum-Vergleich Du ${score.current}, Ghost ${score.ghost}">
            <span class="is-current" style="width:${score.current}%"></span><span class="is-ghost" style="width:${score.ghost}%"></span>
          </div>
          <div class="hf-ghost-metrics">
            ${metricCard('Habit-Tage', current.habitDays, previous.habitDays)}
            ${metricCard('Tasks erledigt', current.tasks, previous.tasks)}
            ${metricCard('Bewegung', current.distance, previous.distance, { format: value => `${formatNumber(value, 1)} km` })}
            ${metricCard('Zigaretten', current.cigarettes, previous.cigarettes, { higher: false })}
          </div>
        </article>

        <article class="hf-boss-card is-${escapeHtml(boss.tone)}">
          <div class="hf-boss-topline"><span>${escapeHtml(boss.eyebrow)}</span><small>${boss.defeated ? 'Besiegt' : 'Aktiv'}</small></div>
          <div class="hf-boss-identity">
            <div class="hf-boss-mark" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 5 40 11v12c0 10-6.7 17-16 20-9.3-3-16-10-16-20V11L24 5Z"/><path d="m17 24 5 5 10-11"/></svg></div>
            <div><h4>${escapeHtml(boss.title)}</h4><p>${escapeHtml(boss.description)}</p></div>
          </div>
          <div class="hf-boss-health">
            <div><span>Boss HP</span><strong>${boss.hp.toLocaleString('de-CH')} / 1’000</strong></div>
            <div class="hf-boss-health-track" role="progressbar" aria-label="Boss-Schaden" aria-valuemin="0" aria-valuemax="1000" aria-valuenow="${boss.damage}"><i style="width:${boss.progress * 100}%"></i></div>
            <small>${boss.damage.toLocaleString('de-CH')} echter Fortschrittsschaden</small>
          </div>
          <div class="hf-boss-evidence"><small>Warum dieser Boss?</small><strong>${escapeHtml(boss.evidence)}</strong></div>
          <div class="hf-boss-next"><span>Next Best Move</span><p>${escapeHtml(boss.nextMove)}</p></div>
        </article>
      </div>

      <footer class="hf-ghost-arena-footer">
        <span><b>Fairness:</b> zwei gleich lange 7-Tage-Fenster</span>
        <span><b>Datengrundlage:</b> Habits, Tasks, Fitness und Konsum</span>
        <span><b>Performance:</b> ereignisbasiert, ohne Daueranimation</span>
      </footer>
    </div>`;
  }

  function ensureRoot() {
    const overview = document.getElementById('habitsOverviewPane');
    const storyPanel = overview?.querySelector('.habit-story-panel');
    if (!overview || !storyPanel) return null;
    let root = document.getElementById('hfGhostArena');
    if (!root) {
      root = document.createElement('section');
      root.id = 'hfGhostArena';
      root.className = 'panel glass hf-ghost-arena';
      root.setAttribute('aria-labelledby', 'hfGhostArenaTitle');
      storyPanel.insertAdjacentElement('beforebegin', root);
    }
    return root;
  }

  function render() {
    const root = ensureRoot();
    if (!root) return;
    const model = modelForState(readState());
    const fingerprint = JSON.stringify({ current: model.current, previous: model.previous, score: model.score, boss: model.boss });
    if (fingerprint === lastFingerprint && root.childElementCount) return;
    lastFingerprint = fingerprint;
    root.innerHTML = arenaMarkup(model);
  }

  function queueRender(delay = 380) {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      renderTimer = 0;
      const run = () => render();
      if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 900 });
      else run();
    }, delay);
  }

  function start() {
    render();
    const observedNodes = ['habitCards', 'habitPlayfulStats'].map(id => document.getElementById(id)).filter(Boolean);
    if ('MutationObserver' in window && observedNodes.length) {
      observer = new MutationObserver(() => queueRender());
      observedNodes.forEach(node => observer.observe(node, { childList: true, subtree: true }));
    }
    window.addEventListener('storage', event => {
      if (!event.key || event.key === STORAGE_KEY) queueRender(120);
    });
    window.addEventListener('habitflow:consumption-live-update', () => queueRender(180));
    window.addEventListener('pageshow', () => queueRender(120));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) queueRender(120);
    });
    document.addEventListener('click', event => {
      const action = event.target?.closest?.('[data-action]')?.dataset?.action || '';
      if (/habit|task|smoke|alcohol|pause|fitness/.test(action)) queueRender(620);
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(window, document);
