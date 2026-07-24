(function registerHabitDefaultsExtension(window, document) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (modules?.has?.('habit-defaults-extension')) return;

  const STATE_KEY = 'habitflow-state-v1';
  const STYLE_ID = 'habitflow-default-habits-extension-style';
  const SPORT_TONE = '#5098b8';
  const SPORT_RGB = '80,152,184';
  const DEFAULTS = Object.freeze([
    {
      id: '00000000-0000-4000-8000-000000000105',
      system_key: 'dumbbells',
      name: 'Hanteln',
      type: 'number',
      unit: 'Sätze',
      direction: 'increase',
      target: 3,
      target_period: 'day',
      icon: 'pushups',
      visualIcon: 'dumbbells'
    },
    {
      id: '00000000-0000-4000-8000-000000000106',
      system_key: 'swimming',
      name: 'Schwimmen',
      type: 'duration',
      unit: 'Min.',
      direction: 'increase',
      target: 30,
      target_period: 'day',
      icon: 'sport',
      visualIcon: 'swimming'
    }
  ]);
  const ICON_PATHS = Object.freeze({
    dumbbells: '<path d="M3 9v6"/><path d="M6 7v10"/><path d="M9 11h6"/><path d="M18 7v10"/><path d="M21 9v6"/>',
    swimming: '<path d="M4 17c1.2-1 2.4-1 3.6 0s2.4 1 3.6 0 2.4-1 3.6 0 2.4 1 3.6 0"/><path d="M4 21c1.2-1 2.4-1 3.6 0s2.4 1 3.6 0 2.4-1 3.6 0 2.4 1 3.6 0"/><path d="m9 13 4-5 4 3"/><path d="M13 8 9 6"/><path d="M17 5a1.7 1.7 0 1 0 0 .01"/>'
  });

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeName(value = '') {
    return String(value || '').trim().toLowerCase();
  }

  function readState() {
    try {
      const raw = window.localStorage?.getItem(STATE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeState(state) {
    try {
      window.localStorage?.setItem(STATE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn('[HabitFlow/habit-defaults] State konnte nicht erweitert werden.', error);
      return false;
    }
  }

  function createHabit(template, created = nowIso()) {
    return {
      id: template.id,
      name: template.name,
      type: template.type,
      unit: template.unit,
      direction: template.direction,
      target: template.target,
      target_period: template.target_period,
      icon: template.icon,
      color: SPORT_TONE,
      system_key: template.system_key,
      is_archived: false,
      created_at: created,
      updated_at: created,
      synced: false
    };
  }

  function findHabit(habits, template) {
    return habits.find(habit => (
      habit?.id === template.id
      || habit?.system_key === template.system_key
      || normalizeName(habit?.name) === normalizeName(template.name)
    ));
  }

  function ensureDefaultHabits() {
    const state = readState();
    const created = nowIso();
    const habits = Array.isArray(state.habits) ? state.habits : [];
    let changed = !Array.isArray(state.habits);

    DEFAULTS.forEach(template => {
      const existing = findHabit(habits, template);
      if (!existing) {
        habits.push(createHabit(template, created));
        changed = true;
        return;
      }

      const next = {
        system_key: template.system_key,
        icon: existing.icon || template.icon,
        color: existing.color || SPORT_TONE,
        type: existing.type || template.type,
        unit: existing.unit || template.unit,
        direction: existing.direction || template.direction,
        target: existing.target ?? template.target,
        target_period: existing.target_period || template.target_period,
        is_archived: false
      };

      Object.entries(next).forEach(([key, value]) => {
        if (existing[key] !== value) {
          existing[key] = value;
          changed = true;
        }
      });
    });

    if (changed) writeState({ ...state, habits });
  }

  function svgIcon(key) {
    return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[key] || ICON_PATHS.dumbbells}</svg>`;
  }

  function injectStyle() {
    if (!document || document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #screen-habits [data-hf-default-habit="dumbbells"],
      #screen-habits [data-hf-default-habit="swimming"],
      .history-modal-content [data-hf-default-habit="dumbbells"],
      .history-modal-content [data-hf-default-habit="swimming"]{
        --habit-tone:${SPORT_TONE}!important;
        --habit-tone-rgb:${SPORT_RGB}!important;
      }
    `;
    document.head.appendChild(style);
  }

  function polishHabitSurface(root) {
    if (!root) return;
    const titleNode = root.querySelector?.('.habit-card-main strong, .habit-detail-title-row h2');
    const name = normalizeName(titleNode?.textContent);
    const template = DEFAULTS.find(item => normalizeName(item.name) === name);
    if (!template) return;
    root.dataset.hfDefaultHabit = template.visualIcon;
    root.style.setProperty('--habit-tone', SPORT_TONE);
    root.style.setProperty('--habit-tone-rgb', SPORT_RGB);
    const category = root.querySelector?.('.habit-category-pill');
    if (category) category.textContent = 'Sport';
    const art = root.querySelector?.('.habit-card-art');
    if (art && !art.dataset.hfDefaultHabitIcon) {
      art.innerHTML = svgIcon(template.visualIcon);
      art.dataset.hfDefaultHabitIcon = template.visualIcon;
    }
  }

  function polishRenderedHabits() {
    injectStyle();
    document.querySelectorAll?.('#screen-habits .habit-card, .history-modal-content .habit-detail-shell').forEach(polishHabitSurface);
  }

  function bindDomPolish() {
    if (!document?.body) return;
    polishRenderedHabits();
    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(polishRenderedHabits);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  ensureDefaultHabits();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindDomPolish, { once: true });
  else bindDomPolish();

  modules?.register?.('habit-defaults-extension', {
    description: 'Adds Hanteln and Schwimmen as built-in Habit cards with matching sport visuals.',
    dataWrites: Object.freeze(['habitflow-state-v1.habits']),
    exports: Object.freeze([])
  });
})(window, document);
