(() => {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const HALF_WHITE_BREAD_KCAL_PER_100G = 255;
  let renderQueued = false;

  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const sum = values => values.reduce((total, value) => total + (Number(value) || 0), 0);
  const toDateKey = value => {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const formatMetricNumber = (value, fractionDigits = 1) => {
    const numeric = Number(value || 0);
    return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(fractionDigits);
  };
  const formatDuration = minutes => {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    if (total >= 60) {
      const hours = Math.floor(total / 60);
      const rest = total % 60;
      return rest ? `${hours}h ${rest}m` : `${hours}h`;
    }
    return `${total}m`;
  };

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }

  function iconKey(habit = {}) {
    const raw = String(habit.icon || habit.system_key || '').trim().toLowerCase();
    const name = String(habit.name || '').trim().toLowerCase();
    if (raw.includes('hiking') || name.includes('wander')) return 'hiking';
    if (raw.includes('jogging') || name.includes('jogg') || name.includes('lauf')) return 'jogging';
    if (raw.includes('walking') || name.includes('spazier')) return 'walking';
    if (raw.includes('pushups') || name.includes('liegest')) return 'pushups';
    if (raw.includes('standing') || name.includes('stehpult')) return 'standingDesk';
    if (raw.includes('bread') || name.includes('brot')) return 'bread';
    if (raw.includes('meditation') || name.includes('meditation')) return 'meditation';
    if (raw.includes('weight') || name.includes('gewicht')) return 'weight';
    return raw || 'habits';
  }

  function categoryLabel(habit = {}) {
    const key = iconKey(habit);
    if (['jogging', 'hiking', 'walking', 'pushups', 'sport'].includes(key)) return 'Sport';
    if (key === 'standingDesk') return 'Ergonomie';
    if (key === 'meditation') return 'Mind';
    if (['bread', 'weight'].includes(key)) return 'Ernaehrung';
    return 'Habit';
  }

  function unitFor(habit = {}) {
    const key = iconKey(habit);
    if (key === 'hiking' || key === 'jogging' || key === 'walking') return 'km';
    return String(habit.unit || '').trim();
  }

  function successDateKeys(habit = {}, entries = []) {
    const key = iconKey(habit);
    const filtered = habit.type === 'boolean' && !['hiking', 'jogging', 'walking'].includes(key)
      ? entries.filter(entry => entry.value_bool)
      : entries.filter(entry => Number(entry.value_num || 0) > 0 || habit.type === 'weight');
    return [...new Set(filtered.map(entry => toDateKey(entry.occurred_at)).filter(Boolean))].sort();
  }

  function currentStreak(habit = {}, entries = []) {
    const keys = new Set(successDateKeys(habit, entries));
    if (!keys.size) return 0;
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (keys.has(toDateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    if (streak) return streak;
    const lastKey = [...keys].at(-1);
    if (!lastKey) return 0;
    const lastDate = new Date(`${lastKey}T12:00:00`);
    streak = 1;
    while (true) {
      lastDate.setDate(lastDate.getDate() - 1);
      if (!keys.has(toDateKey(lastDate))) break;
      streak += 1;
    }
    return streak;
  }

  function buildStoryMetric(habit = {}, entries = []) {
    const key = iconKey(habit);
    const unit = unitFor(habit);
    const streak = currentStreak(habit, entries);
    const successDays = successDateKeys(habit, entries).length;
    const base = {
      id: habit.id,
      iconKey: key,
      eyebrow: categoryLabel(habit),
      title: habit.name || 'Habit',
      badge: streak ? `${streak} Tage Serie` : `${entries.length} Logs`,
      main: 'Noch kein Log',
      detail: 'Sobald du startest, erscheinen hier kleine Story-Stats.',
      meta: habit.target ? `Ziel: ${habit.target} ${unit}` : 'Jeder Log baut Momentum auf.'
    };
    if (!entries.length) return base;

    if (key === 'bread' || String(habit.name || '').toLowerCase().includes('brot')) {
      const kcalPerBreadDay = HALF_WHITE_BREAD_KCAL_PER_100G * 2;
      const kcalSaved = successDays * kcalPerBreadDay;
      return { ...base, title: habit.name || 'Brotfreier Tag', badge: `${successDays} brotfreie Tage`, main: `${kcalSaved.toLocaleString('de-CH')} kcal`, detail: `≈ ${kcalPerBreadDay} kcal pro Tag weniger als bei 200 g Halbweissbrot.`, meta: `${successDays} Tage ohne Brot geloggt.` };
    }

    if (['hiking', 'jogging', 'walking'].includes(key)) {
      const totalKm = sum(entries.map(entry => Number(entry.value_num || 0)));
      const averageKm = totalKm / Math.max(entries.length, 1);
      const label = key === 'hiking' ? 'Touren' : key === 'jogging' ? 'Runs' : 'Walks';
      return { ...base, main: `${formatMetricNumber(totalKm, 1)} km`, detail: `${entries.length} ${label} · Ø ${formatMetricNumber(averageKm, 1)} km pro Log.`, meta: `${successDays} aktive Tage insgesamt.` };
    }

    if (habit.type === 'duration') {
      const totalMinutes = sum(entries.map(entry => Number(entry.value_num || 0)));
      return { ...base, main: formatDuration(totalMinutes), detail: `${Math.max(1, Math.round(totalMinutes / 25))} Fokus-Sprints à 25 Minuten als grobe Entsprechung.`, meta: `${entries.length} Sessions · ${successDays} aktive Tage.` };
    }

    if (habit.type === 'weight') {
      const first = Number(entries[0]?.value_num || 0);
      const latest = Number(entries.at(-1)?.value_num || 0);
      const delta = latest - first;
      return { ...base, main: `${formatMetricNumber(latest, 1)} ${unit}`.trim(), detail: delta ? `Seit Start ${delta > 0 ? '+' : ''}${formatMetricNumber(delta, 1)} ${unit}.` : 'Gewicht aktuell stabil im Verlauf.', meta: `${entries.length} Wiegepunkte gespeichert.` };
    }

    if (habit.type === 'boolean') {
      return { ...base, main: `${successDays} Check-ins`, detail: streak ? `Laufende Serie: ${streak} Tag${streak === 1 ? '' : 'e'}.` : 'Der naechste Check-in startet eine neue Serie.', meta: `${entries.length} Eintraege insgesamt.` };
    }

    const totalValue = sum(entries.map(entry => Number(entry.value_num || 0)));
    const averageValue = totalValue / Math.max(entries.length, 1);
    return { ...base, main: `${formatMetricNumber(totalValue, 1)} ${unit}`.trim(), detail: `Ø ${formatMetricNumber(averageValue, 1)} ${unit} pro Log - aktuell ${streak ? `${streak} Tage am Stueck` : 'sauber dokumentiert'}.`, meta: `${entries.length} Logs · ${successDays} aktive Tage.` };
  }

  function iconMarkup(card) {
    const source = document.querySelector(`#habitCards [data-action="open-habit-detail"][data-id="${CSS.escape(card.id)}"] .habit-card-art`);
    return source ? source.innerHTML : '';
  }

  function renderStoryCard(card) {
    return `<article class="habit-story-card" data-habit-story-fallback="${escapeHtml(card.id)}">
      <div class="habit-story-icon" aria-hidden="true">${iconMarkup(card)}</div>
      <div class="habit-story-copy">
        <div class="habit-story-head"><p class="eyebrow">${escapeHtml(card.eyebrow)}</p><span class="badge muted">${escapeHtml(card.badge)}</span></div>
        <h4>${escapeHtml(card.title)}</h4>
        <strong>${escapeHtml(card.main)}</strong>
        <p>${escapeHtml(card.detail)}</p>
        <small>${escapeHtml(card.meta)}</small>
      </div>
    </article>`;
  }

  function existingStoryTitles(container) {
    return new Set([...container.querySelectorAll('.habit-story-card h4')].map(node => node.textContent.trim().toLowerCase()).filter(Boolean));
  }

  function ensureHabitStories() {
    const container = document.getElementById('habitPlayfulStats');
    const habitCards = document.getElementById('habitCards');
    if (!container || !habitCards) return;
    const state = readState();
    const habits = Array.isArray(state.habits) ? state.habits.filter(habit => habit && !habit.is_archived && habit.id) : [];
    if (!habits.length) return;

    const entries = Array.isArray(state.habitEntries) ? state.habitEntries : [];
    const existingTitles = existingStoryTitles(container);
    const missingCards = habits
      .filter(habit => !existingTitles.has(String(habit.name || '').trim().toLowerCase()))
      .filter(habit => !container.querySelector(`[data-habit-story-fallback="${CSS.escape(habit.id)}"]`))
      .map(habit => buildStoryMetric(habit, entries.filter(entry => entry.habit_id === habit.id).sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at))));

    if (!missingCards.length) return;
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    container.insertAdjacentHTML('beforeend', missingCards.map(renderStoryCard).join(''));
  }

  function queueEnsureHabitStories() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      ensureHabitStories();
    });
  }

  function initHabitStoryCoverage() {
    queueEnsureHabitStories();
    const observer = new MutationObserver(queueEnsureHabitStories);
    ['habitCards', 'habitPlayfulStats'].forEach(id => {
      const node = document.getElementById(id);
      if (node) observer.observe(node, { childList: true, subtree: true });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHabitStoryCoverage, { once: true });
  } else {
    initHabitStoryCoverage();
  }
})();