(function initHabitFlowCravingCoachV2(window, document) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (modules?.has?.('craving-coach-v2')) return;

  const STORAGE_KEY = 'habitflow-state-v1';
  const LEARNING_KEY = 'habitflow-coach-interventions-v1';
  const TRIGGER_KEYS = ['coffee', 'alcohol', 'reward', 'boredom', 'stress', 'social', 'meal', 'morning', 'habits', 'unknown'];
  const TRIGGER_LABELS = Object.freeze({
    coffee: 'Kaffee', alcohol: 'Alkohol', reward: 'Reward', boredom: 'Langeweile', stress: 'Stress', social: 'Sozial', meal: 'Essen', morning: 'Morgen', habits: 'Habits', tasks: 'Tasks', unknown: 'Autopilot'
  });
  const DAY_PART_LABELS = Object.freeze({ morning: 'Morgen', midday: 'Mittag', afternoon: 'Nachmittag', evening: 'Abend', night: 'Nacht' });
  const OUTCOME_LABELS = Object.freeze({ not_smoked: 'Nicht geraucht', delayed: 'Verzogert', smoked: 'Trotzdem geraucht', not_helpful: 'Hat nicht geholfen' });
  const TIMER_SECONDS = Object.freeze({ reset90: 90, breathe3: 180, timer7: 420, timer10: 600 });
  const PAUSE_HINTS = Object.freeze({
    under_30: 'Sehr kurzer Abstand. Jetzt zahlt nur: 10 Minuten gewinnen.',
    '30_60': 'Du bist kurz vor der ersten stabilen Zone. Ziel: 60 Minuten vollmachen.',
    '60_90': 'Du bist uber der Basisschwelle. Jetzt ware 90 Minuten ein starker nachster Schritt.',
    '90_120': 'Du bist nah an einer starken 2h-Pause. Verzogern lohnt sich jetzt besonders.',
    '120_plus': 'Das ist ein Recovery-Fenster. Nicht aus Autopilot beenden. Wenn du rauchst, dann bewusst.',
    none: 'Noch keine Rauchdaten. Der Coach startet trotzdem mit einem kleinen, ruhigen Schritt.'
  });
  const INTERVENTIONS = Object.freeze({
    coffee: { title: 'Kaffee bleibt. Zigarette wartet.', body: 'Kaffee ist nicht das Problem. Die Kopplung ist das Problem. Trink zuerst Wasser, dann Kaffee, dann warte 7 Minuten. Ziel: Kaffee ist nicht sofort Zigarette.', actions: [{ key: 'timer7', label: '7-Minuten-Timer starten' }, { key: 'water', label: 'Wasser zuerst' }, { key: 'log_smoke', label: 'Trotzdem rauchen loggen' }] },
    alcohol: { title: 'Alkohol macht dein System schneller.', body: 'Heute zahlt nicht Perfektion, sondern Abstand. Nach jedem Drink erst Wasser oder 10 Minuten Pause. Keine Zigarette direkt anschliessen.', actions: [{ key: 'timer10', label: '10-Minuten-Timer' }, { key: 'move_water', label: 'Wasser + Ortswechsel' }, { key: 'mark_alcohol', label: 'Alkohol-Kontext merken' }] },
    reward: { title: 'Das ist ein Belohnungsmoment.', body: 'Nimm die Belohnung, aber nicht automatisch als Zigarette. Musik, Tee, kurzer Walk oder Nachricht. Danach neu entscheiden.', actions: [{ key: 'reward_alt', label: 'Ersatzbelohnung wahlen' }, { key: 'timer10', label: '10-Minuten-Vertrag' }, { key: 'decide_later', label: 'Spater entscheiden' }] },
    boredom: { title: 'Langeweile braucht Reizwechsel.', body: 'Nicht diskutieren. 90 Sekunden Bewegung: kurzer Gang, Treppe, Kuche aufraumen oder kaltes Wasser uber Hande. Danach neu prufen.', actions: [{ key: 'reset90', label: '90-Sekunden-Reset' }, { key: 'mini_walk', label: 'Mini-Walk' }, { key: 'decide_later', label: 'Neu entscheiden' }] },
    stress: { title: 'Nimm die Pause - zuerst ohne Zigarette.', body: 'Die Zigarette ware gerade eine Pause-Markierung. Atme 10 Mal langsam aus, lose Schultern, schreibe einen Satz: Was stresst mich wirklich?', actions: [{ key: 'breathe3', label: '3-Minuten-Atemreset' }, { key: 'name_stress', label: 'Stress benennen' }, { key: 'keep_open', label: 'Coach offen lassen' }] },
    social: { title: 'Kein Gruppendruck-Autopilot.', body: 'Mach es nicht zur Willenskraft-Challenge. Andere die Szene: Getrank holen, kurz weggehen, Person ohne Zigarette ansprechen.', actions: [{ key: 'change_place', label: 'Ort wechseln' }, { key: 'support_msg', label: 'Support-Nachricht' }, { key: 'timer10', label: '10-Minuten-Regel' }] },
    meal: { title: 'Neuer Abschluss nach dem Essen.', body: 'Der Korper erwartet den alten Abschluss. Nimm einen neuen: Zahne putzen, Kaugummi, Wasser, 3 Minuten gehen.', actions: [{ key: 'gum_water', label: 'Kaugummi / Wasser' }, { key: 'breathe3', label: '3-Minuten-Walk' }, { key: 'decide_later', label: 'Spater entscheiden' }] },
    morning: { title: 'Morgenanker erkannt.', body: 'Die erste Zigarette setzt oft den Rhythmus. Heute kein grosses Ziel. Nur: erste Zigarette 10 Minuten spater als normal.', actions: [{ key: 'timer10', label: '10 Minuten spater' }, { key: 'water', label: 'Wasser zuerst' }, { key: 'morning_routine', label: 'Morgenroutine offnen' }] },
    habits: { title: 'Habit-Druck erkannt.', body: 'Das ist ein Steuerungsmoment, kein Urteil. Wahle einen kleinen Habit-Haken oder eine 3-Minuten-Pause, bevor du neu entscheidest.', actions: [{ key: 'breathe3', label: '3-Minuten-Pause' }, { key: 'open_habits', label: 'Habits offnen' }, { key: 'decide_later', label: 'Spater entscheiden' }] },
    tasks: { title: 'Aufgaben-Druck ist gerade der Trigger.', body: 'Du brauchst nicht die Zigarette, sondern eine Grenze. Schreib genau den nachsten Task-Schritt auf, dann 10 Minuten Abstand.', actions: [{ key: 'timer10', label: '10-Minuten-Abstand' }, { key: 'open_tasks', label: 'Task ansehen' }, { key: 'name_stress', label: 'Druck benennen' }] },
    unknown: { title: 'Autopilot erkannt.', body: 'Du musst gerade nicht uber den ganzen Tag entscheiden. Gewinne nur 10 Minuten. Danach darfst du neu wahlen.', actions: [{ key: 'timer10', label: '10-Minuten-Timer' }, { key: 'choose_trigger', label: 'Trigger wahlen' }, { key: 'log_smoke', label: 'Trotzdem loggen' }] }
  });

  let selectedTrigger = null;
  let activeMode = 'context';
  let timer = null;
  let renderTimer = null;

  function safeArray(value) { return Array.isArray(value) ? value : []; }
  function parseDate(value) { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date : null; }
  function nowIso() { return new Date().toISOString(); }
  function uid() { return `coach_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }
  function dateKey(value) { const date = parseDate(value) || new Date(); return date.toISOString().slice(0, 10); }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }

  function readJson(key, fallback) {
    try {
      const raw = window.localStorage?.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn('[HabitFlow/coach-v2] local read failed', key, error);
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage?.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('[HabitFlow/coach-v2] local write failed', key, error);
      return false;
    }
  }

  function readState() {
    const state = readJson(STORAGE_KEY, {});
    return state && typeof state === 'object' ? state : {};
  }

  function coachLearningFromState(state) {
    const inState = safeArray(state?.coachInterventions);
    const standalone = safeArray(readJson(LEARNING_KEY, []));
    const seen = new Set();
    return inState.concat(standalone).filter(item => {
      const id = item?.id || `${item?.created_at}:${item?.trigger}:${item?.outcome}`;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function persistIntervention(entry) {
    const state = readState();
    const stateRows = safeArray(state.coachInterventions).concat(entry).slice(-120);
    const localRows = safeArray(readJson(LEARNING_KEY, [])).concat(entry).slice(-120);
    writeJson(LEARNING_KEY, localRows);
    writeJson(STORAGE_KEY, { ...state, coachInterventions: stateRows });
    showToast('Geloggt. Daraus lernt dein Coach lokal.');
  }

  function eventTime(event) { return parseDate(event?.smoked_at || event?.occurred_at || event?.created_at || event?.updated_at); }
  function sortedSmokeEvents(state) { return safeArray(state?.cigarettes).filter(item => item && !item.deleted_at).sort((a, b) => (eventTime(a)?.getTime() || 0) - (eventTime(b)?.getTime() || 0)); }
  function getLastSmokeEvent(state) { const events = sortedSmokeEvents(state); return events.length ? events[events.length - 1] : null; }
  function getCurrentPauseMinutes(state) { const last = getLastSmokeEvent(state); const time = eventTime(last); if (!time) return null; return Math.max(0, Math.round((Date.now() - time.getTime()) / 60000)); }
  function getTodayCigaretteCount(state) { const today = dateKey(new Date()); return sortedSmokeEvents(state).filter(item => dateKey(eventTime(item)) === today).length; }

  function getDayPart(date = new Date()) {
    const hour = date.getHours();
    if (hour < 5) return 'night';
    if (hour < 11) return 'morning';
    if (hour < 14) return 'midday';
    if (hour < 18) return 'afternoon';
    if (hour < 23) return 'evening';
    return 'night';
  }

  function getPauseBand(minutes) {
    if (minutes == null) return 'none';
    if (minutes < 30) return 'under_30';
    if (minutes < 60) return '30_60';
    if (minutes < 90) return '60_90';
    if (minutes < 120) return '90_120';
    return '120_plus';
  }

  function getAlcoholContext(state) {
    const today = dateKey(new Date());
    const todayUnits = safeArray(state?.alcoholUnits).concat(safeArray(state?.alcoholEvents)).filter(item => dateKey(item?.occurred_at || item?.created_at) === today);
    const todayLog = safeArray(state?.alcoholLogs).find(item => dateKey(item?.log_date || item?.created_at) === today && item?.consumed);
    const lastSmoke = getLastSmokeEvent(state);
    return Boolean(todayUnits.length || todayLog || lastSmoke?.alcohol_context);
  }

  function normalizeTrigger(value) {
    const key = String(value || '').trim().toLowerCase().replace(/^trigger:/, '');
    if (TRIGGER_KEYS.includes(key)) return key;
    if (key === 'routine') return 'morning';
    if (key === 'task') return 'tasks';
    return null;
  }

  function getRecentTrigger(state) {
    const events = sortedSmokeEvents(state).slice(-8).reverse();
    for (const event of events) {
      const note = String(event?.note || event?.notes || '');
      const marker = note.match(/trigger:([a-z_-]+)/i)?.[1];
      const direct = normalizeTrigger(event?.trigger || event?.inferredTrigger || marker);
      if (direct) return direct;
      const lower = note.toLowerCase();
      const found = TRIGGER_KEYS.find(key => key !== 'unknown' && lower.includes(`trigger:${key}`));
      if (found) return found;
    }
    return 'unknown';
  }

  function recommendedGoalMinutes(pauseMinutes) {
    if (pauseMinutes == null || pauseMinutes < 30) return 10;
    if (pauseMinutes < 60) return 60;
    if (pauseMinutes < 90) return 90;
    if (pauseMinutes < 120) return 120;
    return Math.max(130, Math.ceil((pauseMinutes + 10) / 10) * 10);
  }

  function riskLevel(context) {
    let score = 0;
    if (context.pauseMinutes == null) score += 1;
    else if (context.pauseMinutes < 30) score += 3;
    else if (context.pauseMinutes < 60) score += 2;
    else if (context.pauseMinutes < 120) score += 1;
    if (context.alcoholContext) score += 2;
    if (context.todayCount >= 10) score += 2;
    else if (context.todayCount >= 6) score += 1;
    if (context.dayPart === 'evening' || context.dayPart === 'night') score += 1;
    if (context.isWeekend) score += 1;
    if (context.inferredTrigger === 'stress' || context.inferredTrigger === 'alcohol') score += 1;
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  function getCravingContext(state, override = {}) {
    const date = new Date();
    const pauseMinutes = getCurrentPauseMinutes(state);
    const alcoholContext = getAlcoholContext(state);
    let inferredTrigger = normalizeTrigger(override.trigger) || normalizeTrigger(selectedTrigger) || getRecentTrigger(state);
    if (alcoholContext && inferredTrigger === 'unknown') inferredTrigger = 'alcohol';
    if (getDayPart(date) === 'morning' && inferredTrigger === 'unknown') inferredTrigger = 'morning';
    const context = {
      pauseMinutes,
      pauseBand: getPauseBand(pauseMinutes),
      dayPart: getDayPart(date),
      isWeekend: [0, 6].includes(date.getDay()),
      todayCount: getTodayCigaretteCount(state),
      alcoholContext,
      inferredTrigger: inferredTrigger || 'unknown',
      recommendedGoalMinutes: recommendedGoalMinutes(pauseMinutes),
      primaryMode: override.mode || activeMode || 'context'
    };
    context.riskLevel = riskLevel(context);
    return context;
  }

  function getCoachRecommendation(context) {
    return INTERVENTIONS[context.inferredTrigger] || INTERVENTIONS.unknown;
  }

  function formatPause(minutes) {
    if (minutes == null) return 'keine Daten';
    if (minutes < 60) return `${minutes} Min.`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
  }

  function situationText(context) {
    return `${DAY_PART_LABELS[context.dayPart] || context.dayPart} · ${TRIGGER_LABELS[context.inferredTrigger] || 'Autopilot'} · ${formatPause(context.pauseMinutes)} Pause`;
  }

  function goalText(context) {
    if (context.recommendedGoalMinutes <= 10) return 'Nachstes Ziel: 10 Minuten gewinnen';
    return `Nachstes Ziel: ${context.recommendedGoalMinutes} Min.`;
  }

  function learningHint(context, state) {
    const rows = coachLearningFromState(state).filter(item => normalizeTrigger(item.trigger) === context.inferredTrigger);
    if (rows.length < 3) return '';
    const helpful = rows.filter(item => ['not_smoked', 'delayed'].includes(item.outcome));
    if (helpful.length < 2) return '';
    const actionCounts = helpful.reduce((map, item) => map.set(item.actionKey || 'timer10', (map.get(item.actionKey || 'timer10') || 0) + 1), new Map());
    const best = Array.from(actionCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    if (!best || best[1] < 2) return '';
    const actionLabel = actionLabelFor(best[0]);
    return `Bei deinen Daten scheint zuletzt ${actionLabel} bei ${TRIGGER_LABELS[context.inferredTrigger] || 'diesem Trigger'} besser funktioniert zu haben.`;
  }

  function actionLabelFor(key) {
    return ({ timer7: 'der 7-Minuten-Timer', timer10: 'der 10-Minuten-Timer', reset90: 'der 90-Sekunden-Reset', breathe3: 'der Atemreset', water: 'Wasser zuerst', move_water: 'Wasser + Ortswechsel', reward_alt: 'eine Ersatzbelohnung' })[key] || 'Verzogern';
  }

  function injectStyle() {
    if (document.getElementById('habitflow-craving-coach-v2-style')) return;
    const style = document.createElement('style');
    style.id = 'habitflow-craving-coach-v2-style';
    style.textContent = `
      .hf-coach-v2-extra{display:grid;gap:12px;margin-top:2px}.hf-coach-v2-situation{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.hf-coach-v2-situation .badge{min-height:32px}.hf-coach-v2-pause{padding:11px 12px;border-radius:18px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.07);color:var(--muted);font-size:.9rem;line-height:1.42}.hf-coach-v2-actions,.hf-coach-v2-feedback,.hf-coach-v2-chips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.hf-coach-v2-actions .mini-btn,.hf-coach-v2-feedback .mini-btn,.hf-coach-v2-chips .mini-btn{min-height:44px;white-space:normal;line-height:1.2}.hf-coach-v2-chips{grid-template-columns:repeat(3,minmax(0,1fr))}.hf-coach-v2-timer{display:grid;gap:9px;padding:12px;border-radius:20px;background:rgba(74,215,209,.09);border:1px solid rgba(74,215,209,.16)}.hf-coach-v2-timer strong{font-size:1.1rem}.hf-coach-v2-timer-track{height:8px;border-radius:999px;background:rgba(255,255,255,.09);overflow:hidden}.hf-coach-v2-timer-track i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--primary),var(--accent));border-radius:inherit}.coach-result .hf-coach-v2-extra{margin-top:0}.hf-coach-v2-modal-card{display:grid;gap:13px}.hf-coach-v2-modal-card h3{font-size:1.24rem}.hf-coach-v2-modal-card p{color:var(--muted);line-height:1.48}.hf-coach-v2-learning{padding:12px;border-radius:18px;background:rgba(143,240,167,.08);border:1px solid rgba(143,240,167,.14);color:var(--muted);line-height:1.4}.hf-coach-v2-risk-low{color:var(--accent)}.hf-coach-v2-risk-medium{color:var(--warning)}.hf-coach-v2-risk-high{color:var(--danger)}body.light .hf-coach-v2-pause,body.light .hf-coach-v2-timer,body.light .hf-coach-v2-learning{background:rgba(255,255,255,.66);border-color:rgba(17,36,58,.08)}@media (max-width:760px){.hf-coach-v2-actions,.hf-coach-v2-feedback,.hf-coach-v2-chips{grid-template-columns:1fr}.hf-coach-v2-situation{align-items:stretch}.hf-coach-v2-situation .badge{width:100%;justify-content:center}.craving-actions{grid-template-columns:1fr!important}}
    `;
    document.head.appendChild(style);
  }

  function actionButtonsHtml(recommendation) {
    return `<div class="hf-coach-v2-actions">${recommendation.actions.map(action => `<button class="mini-btn ${action.key === 'log_smoke' ? 'danger' : 'primary'}" type="button" data-coach-action="${escapeHtml(action.key)}">${escapeHtml(action.label)}</button>`).join('')}</div>`;
  }

  function triggerChipsHtml(context) {
    const keys = context.inferredTrigger === 'unknown' ? ['stress', 'coffee', 'reward', 'boredom', 'alcohol', 'social', 'meal', 'habits', 'unknown'] : ['stress', 'coffee', 'reward', 'boredom', 'alcohol', 'social'];
    return `<div class="hf-coach-v2-chips" aria-label="Trigger wahlen">${keys.map(key => `<button class="mini-btn" type="button" data-coach-trigger="${key}">${escapeHtml(TRIGGER_LABELS[key] || key)}</button>`).join('')}</div>`;
  }

  function feedbackHtml(actionKey) {
    return `<div class="hf-coach-v2-feedback" aria-label="Coach Feedback">${Object.entries(OUTCOME_LABELS).map(([key, label]) => `<button class="mini-btn" type="button" data-coach-feedback="${key}" data-action-key="${escapeHtml(actionKey || 'manual')}">${escapeHtml(label)}</button>`).join('')}</div>`;
  }

  function timerHtml() {
    if (!timer) return '';
    const remaining = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
    const total = Math.max(1, timer.seconds || 1);
    const elapsed = Math.max(0, total - remaining);
    const width = Math.min(100, Math.round((elapsed / total) * 100));
    if (remaining <= 0) {
      return `<div class="hf-coach-v2-timer"><strong>Stark. Du hast den Autopilot unterbrochen.</strong><span class="subtle">Was ist passiert?</span>${feedbackHtml(timer.actionKey)}</div>`;
    }
    const label = remaining >= 60 ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : `${remaining}s`;
    return `<div class="hf-coach-v2-timer"><strong>${label}</strong><span class="subtle">Nur diesen Abstand halten. Danach neu entscheiden.</span><div class="hf-coach-v2-timer-track"><i style="width:${width}%"></i></div><button class="mini-btn" type="button" data-coach-action="cancel_timer">Timer abbrechen</button></div>`;
  }

  function renderExtra(context, recommendation, state, options = {}) {
    const hint = learningHint(context, state);
    return `<div class="hf-coach-v2-extra" data-hf-coach-v2="${options.scope || 'inline'}">
      <div class="hf-coach-v2-situation"><span class="badge muted">${escapeHtml(situationText(context))}</span><span class="badge ${context.riskLevel === 'high' ? 'danger-badge' : context.riskLevel === 'medium' ? 'warning-badge' : 'muted'}">${escapeHtml(goalText(context))}</span></div>
      <div class="hf-coach-v2-pause">${escapeHtml(PAUSE_HINTS[context.pauseBand] || PAUSE_HINTS.none)}</div>
      ${timerHtml()}
      ${actionButtonsHtml(recommendation)}
      ${context.inferredTrigger === 'unknown' || options.showChips ? triggerChipsHtml(context) : ''}
      ${hint ? `<div class="hf-coach-v2-learning">${escapeHtml(hint)}</div>` : ''}
    </div>`;
  }

  function renderInline() {
    const card = document.querySelector('#screen-smoking .craving-coach-card');
    if (!card) return;
    const state = readState();
    const context = getCravingContext(state);
    const recommendation = getCoachRecommendation(context);
    const title = document.getElementById('cravingTipTitle');
    const meta = document.getElementById('cravingTipMeta');
    const body = document.getElementById('cravingTipBody');
    if (title) title.textContent = recommendation.title;
    if (meta) meta.textContent = context.riskLevel === 'high' ? 'Akut' : goalText(context).replace('Nachstes Ziel: ', 'Ziel ');
    if (body) body.textContent = recommendation.body;
    card.querySelectorAll('[data-hf-coach-v2]').forEach(node => node.remove());
    const actions = card.querySelector('.craving-actions');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderExtra(context, recommendation, state, { scope: 'inline', showChips: context.inferredTrigger === 'unknown' }).trim();
    if (actions) actions.insertAdjacentElement('beforebegin', wrapper.firstElementChild);
    else card.appendChild(wrapper.firstElementChild);
  }

  function renderModal() {
    const modal = document.getElementById('coachModal');
    if (!modal) return;
    const state = readState();
    const triggerSelect = document.getElementById('coachTrigger');
    const overrideTrigger = normalizeTrigger(triggerSelect?.value) || selectedTrigger;
    const context = getCravingContext(state, { trigger: overrideTrigger, mode: activeMode });
    const recommendation = getCoachRecommendation(context);
    if (triggerSelect && overrideTrigger && triggerSelect.value !== overrideTrigger && Array.from(triggerSelect.options).some(option => option.value === overrideTrigger)) triggerSelect.value = overrideTrigger;
    const riskBadge = document.getElementById('coachRiskBadge');
    if (riskBadge) {
      riskBadge.textContent = context.riskLevel === 'high' ? 'Hohes Risiko' : context.riskLevel === 'medium' ? 'Mittleres Risiko' : 'Ruhiger Bereich';
      riskBadge.className = `badge ${context.riskLevel === 'high' ? 'danger-badge' : context.riskLevel === 'medium' ? 'warning-badge' : 'muted'}`;
    }
    const confidence = document.getElementById('coachConfidence');
    if (confidence) {
      const percent = context.riskLevel === 'high' ? 82 : context.riskLevel === 'medium' ? 54 : 24;
      confidence.className = `coach-confidence-score is-${context.riskLevel === 'high' ? 'high' : context.riskLevel === 'medium' ? 'mid' : 'low'}`;
      confidence.innerHTML = `<strong>${percent}%</strong><span>Risiko</span>`;
    }
    const challenge = document.getElementById('coachChallengeCard');
    if (challenge) {
      challenge.innerHTML = `<div class="hf-coach-v2-modal-card"><span class="badge muted">${escapeHtml(situationText(context))}</span><h3>${escapeHtml(recommendation.title)}</h3><p>${escapeHtml(recommendation.body)}</p></div>`;
    }
    const result = document.getElementById('coachResult');
    if (result) {
      result.innerHTML = `<div class="coach-result-topline"><small>${escapeHtml(goalText(context))}</small><h3>${escapeHtml(PAUSE_HINTS[context.pauseBand] || PAUSE_HINTS.none)}</h3><p>Du bist nicht schwach. Dein Kontext ist stark. Also andern wir den Kontext.</p></div>${renderExtra(context, recommendation, state, { scope: 'modal', showChips: true })}`;
    }
    const plan = document.getElementById('coachPlanGrid');
    if (plan) {
      const steps = [
        { label: '1', title: 'Autopilot stoppen', body: context.pauseMinutes == null ? 'Erst Daten sammeln, dann bewusst entscheiden.' : PAUSE_HINTS[context.pauseBand] },
        { label: '2', title: recommendation.title, body: recommendation.body },
        { label: '3', title: 'Feedback loggen', body: 'Nicht geraucht, verzogert oder trotzdem geraucht: Loggen statt verdrangen. Daraus lernt dein System.' }
      ];
      plan.innerHTML = steps.map(step => `<article class="coach-plan-card"><span>${step.label}</span><small>Coach 2.0</small><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.body)}</p></article>`).join('');
    }
  }

  function renderAll() {
    injectStyle();
    renderInline();
    renderModal();
  }

  function scheduleRender(delay = 80) {
    clearTimeout(renderTimer);
    renderTimer = window.setTimeout(renderAll, delay);
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.add('hidden'), 2600);
  }

  function startDelay(actionKey) {
    const seconds = TIMER_SECONDS[actionKey] || 600;
    timer = { actionKey, seconds, startsAt: Date.now(), endsAt: Date.now() + seconds * 1000 };
    clearInterval(startDelay.interval);
    startDelay.interval = window.setInterval(() => {
      if (!timer) return;
      if (Date.now() >= timer.endsAt) {
        clearInterval(startDelay.interval);
        showToast('Stark. Du hast den Autopilot unterbrochen. Was ist passiert?');
      }
      renderAll();
    }, 1000);
    renderAll();
  }

  function openScreen(target) {
    const button = document.querySelector(`.bottom-nav .nav-btn[data-target="${target}"]`);
    if (button) button.click();
  }

  function handleAction(actionKey) {
    if (TIMER_SECONDS[actionKey]) { startDelay(actionKey); return; }
    if (actionKey === 'cancel_timer') { timer = null; clearInterval(startDelay.interval); renderAll(); return; }
    if (actionKey === 'log_smoke') { document.getElementById('recordSmokeBtn')?.click(); return; }
    if (actionKey === 'choose_trigger') { selectedTrigger = 'unknown'; showToast('Wahle den wahrscheinlichsten Trigger.'); renderAll(); return; }
    if (actionKey === 'mark_alcohol') { selectedTrigger = 'alcohol'; showToast('Alkohol-Kontext fur den Coach gemerkt.'); renderAll(); return; }
    if (actionKey === 'morning_routine') { document.getElementById('heroMorningRoutineBtn')?.click(); return; }
    if (actionKey === 'open_habits') { openScreen('habits'); return; }
    if (actionKey === 'open_tasks') { openScreen('tasks'); return; }
    if (actionKey === 'keep_open') { showToast('Coach bleibt offen. Nur den nachsten kleinen Schritt.'); return; }
    showToast(actionLabelFor(actionKey));
  }

  function handleFeedback(outcome, actionKey) {
    const state = readState();
    const context = getCravingContext(state);
    persistIntervention({
      id: uid(),
      created_at: nowIso(),
      trigger: context.inferredTrigger,
      dayPart: context.dayPart,
      pauseMinutes: context.pauseMinutes,
      actionKey: actionKey || timer?.actionKey || 'manual',
      outcome,
      alcoholContext: context.alcoholContext,
      todayCount: context.todayCount
    });
    if (outcome === 'smoked') document.getElementById('recordSmokeBtn')?.click();
    timer = null;
    clearInterval(startDelay.interval);
    scheduleRender(40);
  }

  function handleClick(event) {
    const coachAction = event.target?.closest?.('[data-coach-action]')?.dataset?.coachAction;
    if (coachAction) { event.preventDefault(); handleAction(coachAction); return; }
    const feedback = event.target?.closest?.('[data-coach-feedback]');
    if (feedback) { event.preventDefault(); handleFeedback(feedback.dataset.coachFeedback, feedback.dataset.actionKey); return; }
    const trigger = event.target?.closest?.('[data-coach-trigger]')?.dataset?.coachTrigger;
    if (trigger) { event.preventDefault(); selectedTrigger = normalizeTrigger(trigger) || 'unknown'; showToast(`${TRIGGER_LABELS[selectedTrigger] || 'Trigger'} erkannt.`); renderAll(); return; }
    const action = event.target?.closest?.('[data-action]')?.dataset?.action || '';
    if (action === 'start-emergency-craving') activeMode = 'acute';
    if (action === 'open-coach') activeMode = 'context';
    if (['open-coach', 'start-emergency-craving', 'rotate-craving-tip', 'record-cigarette', 'coach-record-smoke', 'start-coach-delay', 'coach-breath-reset'].includes(action)) scheduleRender(180);
  }

  function bindControls() {
    document.addEventListener('click', handleClick, true);
    document.addEventListener('change', event => {
      if (event.target?.id === 'coachTrigger') { selectedTrigger = normalizeTrigger(event.target.value) || selectedTrigger; scheduleRender(40); }
      if (event.target?.id === 'coachUrgeLevel') scheduleRender(40);
    }, true);
    window.addEventListener('storage', event => { if (event.key === STORAGE_KEY || event.key === LEARNING_KEY) scheduleRender(120); });
    window.addEventListener('focus', () => scheduleRender(120));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleRender(120); });
    [100, 500, 1200, 2600].forEach(delay => window.setTimeout(renderAll, delay));
    window.setInterval(() => scheduleRender(0), 60000);
  }

  function start() {
    injectStyle();
    bindControls();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  modules?.register?.('craving-coach-v2', {
    description: 'Situational anti-autopilot coach for smoking cravings. Reads local smoke/alcohol context and stores local coach feedback only.',
    dataWrites: Object.freeze(['habitflow-coach-interventions-v1', 'state.coachInterventions']),
    remoteTables: Object.freeze([])
  });
})(window, document);
