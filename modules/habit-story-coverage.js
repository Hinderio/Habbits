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
    if (name.includes('wander')) return 'hiking';
    if (name.includes('jogg') || name.includes('lauf')) return 'jogging';
    if (name.includes('spazier')) return 'walking';
    if (name.includes('liegest')) return 'pushups';
    if (name.includes('hantel')) return 'dumbbells';
    if (name.includes('schwimm')) return 'swimming';
    if (name.includes('stehpult')) return 'standingDesk';
    if (name.includes('brot')) return 'bread';
    if (name.includes('meditation')) return 'meditation';
    if (name.includes('gewicht')) return 'weight';
    if (raw.includes('hiking')) return 'hiking';
    if (raw.includes('jogging')) return 'jogging';
    if (raw.includes('walking')) return 'walking';
    if (raw.includes('pushups')) return 'pushups';
    if (raw.includes('dumbbell')) return 'dumbbells';
    if (raw.includes('swimming')) return 'swimming';
    if (raw.includes('standing')) return 'standingDesk';
    if (raw.includes('bread')) return 'bread';
    if (raw.includes('meditation')) return 'meditation';
    if (raw.includes('weight')) return 'weight';
    return raw || 'habits';
  }

  function categoryLabel(habit = {}) {
    const key = iconKey(habit);
    if (['jogging', 'hiking', 'walking', 'pushups', 'dumbbells', 'swimming', 'sport'].includes(key)) return 'Sport';
    if (key === 'standingDesk') return 'Ergonomie';
    if (key === 'meditation') return 'Mind';
    if (['bread', 'weight'].includes(key)) return 'Ernaehrung';
    return 'Habit';
  }

  function unitFor(habit = {}) {
    const key = iconKey(habit);
    if (key === 'hiking' || key === 'jogging' || key === 'walking') return 'km';
    if (key === 'swimming') return String(habit.unit || 'Min.').trim();
    if (key === 'dumbbells') return String(habit.unit || 'Sätze').trim();
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

  function normalizedName(value) {
    return String(value || '').trim().toLocaleLowerCase('de-CH');
  }

  function formatChartValue(value, unit = '') {
    const numeric = Number(value || 0);
    const formatted = Number.isInteger(numeric)
      ? numeric.toLocaleString('de-CH')
      : numeric.toLocaleString('de-CH', { maximumFractionDigits: 1 });
    return `${formatted}${unit ? ` ${unit}` : ''}`;
  }

  function chartUnit(habit = {}) {
    const key = iconKey(habit);
    if (habit.type === 'boolean' || key === 'bread') return 'Check-ins';
    if (habit.type === 'duration' || key === 'swimming') return 'Min.';
    return unitFor(habit);
  }

  function buildChartPoints(habit = {}, entries = []) {
    const grouped = new Map();
    const sortedEntries = entries
      .filter(entry => entry && entry.habit_id === habit.id && entry.occurred_at)
      .slice()
      .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));

    sortedEntries.forEach(entry => {
      const dateKey = toDateKey(entry.occurred_at);
      if (!dateKey) return;
      const current = grouped.get(dateKey) || 0;
      const value = habit.type === 'boolean' ? (entry.value_bool ? 1 : 0) : Number(entry.value_num || 0);
      grouped.set(dateKey, habit.type === 'weight' ? value : current + value);
    });

    return [...grouped.entries()]
      .map(([date, value]) => ({ date, value }))
      .slice(-14);
  }

  function chartIcon() {
    return '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 4-4 3 2 5-6"/></svg>';
  }

  function renderHabitChart(habit = {}, entries = []) {
    const points = buildChartPoints(habit, entries);
    const unit = chartUnit(habit);
    if (!points.length) {
      return `<div class="habit-story-chart-empty">${chartIcon()}<strong>Noch kein Verlauf</strong><span>Der erste Log setzt den Startpunkt.</span></div>`;
    }

    const width = 520;
    const height = 210;
    const left = 32;
    const right = 18;
    const top = 24;
    const bottom = 34;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const values = points.map(point => point.value);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const range = Math.max(maximum - minimum, Math.abs(maximum) * .12, 1);
    const xFor = index => points.length === 1 ? left + plotWidth / 2 : left + (index / (points.length - 1)) * plotWidth;
    const yFor = value => top + ((maximum + range * .08 - value) / (range * 1.16)) * plotHeight;
    const coordinates = points.map((point, index) => ({ ...point, x: xFor(index), y: yFor(point.value) }));
    const linePath = coordinates.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
    const grid = [0, .5, 1].map(position => {
      const y = top + position * plotHeight;
      return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" class="habit-story-chart-grid"/>`;
    }).join('');
    const dots = coordinates.map(point => `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="5" class="habit-story-chart-dot"><title>${escapeHtml(new Date(`${point.date}T12:00:00`).toLocaleDateString('de-CH'))}: ${escapeHtml(formatChartValue(point.value, unit))}</title></circle>`).join('');
    const firstDate = new Date(`${points[0].date}T12:00:00`).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
    const lastDate = new Date(`${points.at(-1).date}T12:00:00`).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });

    return `<div class="habit-story-chart-shell">
      <svg class="habit-story-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Verlauf von ${escapeHtml(habit.name || 'Habit')}">
        ${grid}
        <path d="${linePath}" class="habit-story-chart-line"/>
        ${dots}
        <text x="${left}" y="${height - 8}" class="habit-story-chart-label">${escapeHtml(firstDate)}</text>
        <text x="${width - right}" y="${height - 8}" text-anchor="end" class="habit-story-chart-label">${escapeHtml(lastDate)}</text>
      </svg>
      <div class="habit-story-chart-summary"><span>Letzter Wert</span><strong>${escapeHtml(formatChartValue(points.at(-1).value, unit))}</strong></div>
    </div>`;
  }

  function syncStoryIcon(card, habit) {
    const source = document.querySelector(`#habitCards [data-action="open-habit-detail"][data-id="${CSS.escape(habit.id)}"] .habit-card-art`);
    if (!source?.innerHTML) return;
    card.querySelectorAll('.habit-story-icon').forEach(target => {
      if (target.innerHTML !== source.innerHTML) target.innerHTML = source.innerHTML;
    });
  }

  function renderStoryBack(habit, entries) {
    return `<div class="habit-story-chart-head">
      <div class="habit-story-icon" aria-hidden="true">${iconMarkup({ id: habit.id })}</div>
      <div><p class="eyebrow">Verlauf</p><h4>${escapeHtml(habit.name || 'Habit')}</h4></div>
      <span class="habit-story-switch-indicator" title="Statistik schließen" aria-hidden="true">${chartIcon()}</span>
    </div>
    ${renderHabitChart(habit, entries)}`;
  }

  function enhanceHabitStoryCards(container, habits, entries) {
    const habitsByName = new Map(habits.map(habit => [normalizedName(habit.name), habit]));
    container.querySelectorAll('.habit-story-card').forEach(card => {
      const title = card.querySelector('h4')?.textContent || '';
      const fallbackId = card.dataset.habitStoryFallback || '';
      const habit = habits.find(item => item.id === fallbackId) || habitsByName.get(normalizedName(title));
      if (!habit) return;

      card.dataset.habitStoryId = habit.id;
      syncStoryIcon(card, habit);
      if (card.dataset.habitStoryEnhanced === 'true') return;

      const frontContent = card.innerHTML;
      const habitEntries = entries.filter(entry => entry && entry.habit_id === habit.id);
      card.dataset.habitStoryEnhanced = 'true';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-pressed', 'false');
      card.setAttribute('aria-label', `${habit.name || 'Habit'} Verlauf anzeigen`);
      card.innerHTML = `<div class="habit-story-flip-inner">
        <div class="habit-story-face habit-story-front">${frontContent}<span class="habit-story-switch-indicator" title="Verlauf anzeigen" aria-hidden="true">${chartIcon()}</span></div>
        <div class="habit-story-face habit-story-back">${renderStoryBack(habit, habitEntries)}</div>
      </div>`;
      syncStoryIcon(card, habit);
    });
  }

  function bindStoryCardInteraction(container) {
    if (container.dataset.habitStoryInteractionBound === 'true') return;
    container.dataset.habitStoryInteractionBound = 'true';

    const toggle = card => {
      const flipped = card.classList.toggle('is-flipped');
      card.setAttribute('aria-pressed', String(flipped));
      const title = card.querySelector('.habit-story-front h4')?.textContent?.trim() || 'Habit';
      card.setAttribute('aria-label', `${title} ${flipped ? 'Statistik schließen' : 'Verlauf anzeigen'}`);
    };

    container.addEventListener('click', event => {
      if (event.target.closest('button, a, input, select, textarea')) return;
      const card = event.target.closest('.habit-story-card[data-habit-story-enhanced="true"]');
      if (card && container.contains(card)) toggle(card);
    });
    container.addEventListener('keydown', event => {
      const card = event.target.closest('.habit-story-card[data-habit-story-enhanced="true"]');
      if (!card || event.target !== card || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      toggle(card);
    });
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

    if (missingCards.length) {
      const emptyState = container.querySelector('.empty-state');
      if (emptyState) emptyState.remove();
      container.insertAdjacentHTML('beforeend', missingCards.map(renderStoryCard).join(''));
    }
    enhanceHabitStoryCards(container, habits, entries);
    bindStoryCardInteraction(container);
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
