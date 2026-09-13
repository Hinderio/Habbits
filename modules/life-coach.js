(function installLifeCoach(root) {
  'use strict';
  const DAY = 86400000;
  const CATEGORIES = { all: 'Für dich', agenda: 'Agenda', habits: 'Habits', consumption: 'Konsum', lists: 'Listen' };
  const AGENDA_GROUPS = [
    { key: 'birthdays', title: 'Geburtstage', window: 'Nächste 3 Tage · inklusive heute', empty: 'Keine Geburtstage in den nächsten 3 Tagen.' },
    { key: 'appointments', title: 'Termine', window: 'Nächste 7 Tage · inklusive heute', empty: 'Keine anstehenden Termine in den nächsten 7 Tagen.' },
    { key: 'tasks', title: 'Tasks', window: 'Überfällig, anstehend & offen · nach Dringlichkeit', empty: 'Keine offenen Tasks in deiner Agenda.' }
  ];
  const array = value => Array.isArray(value) ? value : [];
  const alive = row => row && !row.deleted_at && !row.is_archived && !row.isArchived;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function date(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isFinite(+value) ? value : null;
    const text = String(value);
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    const swiss = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
    if (iso || swiss) {
      const [y, m, d] = iso ? iso.slice(1).map(Number) : [Number(swiss[3]), Number(swiss[2]), Number(swiss[1])];
      const result = new Date(y, m - 1, d, 12);
      return result.getFullYear() === y && result.getMonth() === m - 1 && result.getDate() === d ? result : null;
    }
    const result = new Date(value);
    return Number.isFinite(+result) ? result : null;
  }
  function day(value) {
    const d = date(value);
    return d ? Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY : null;
  }
  function dateKey(value) {
    const d = date(value);
    return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
  }
  function when(offset) { return offset < 0 ? `Seit ${-offset} ${offset === -1 ? 'Tag' : 'Tagen'} überfällig` : offset === 0 ? 'Heute' : offset === 1 ? 'Morgen' : `In ${offset} Tagen`; }
  let dateFormatter, timeFormatter;
  function shortDate(value) {
    const d = date(value);
    if (!d) return '';
    dateFormatter ||= new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'short' });
    return dateFormatter.format(d);
  }
  function shortTime(value) {
    timeFormatter ||= new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' });
    return timeFormatter.format(date(value));
  }

  // Read-only, one index per collection. Never serialize state or request remote data.
  function analyze(state = {}, lists = {}, now = new Date()) {
    const today = day(now), cards = [], pauses = new Map();
    for (const p of array(state.pausePeriods).filter(alive)) {
      const start = date(p.starts_at), end = p.ends_at ? date(p.ends_at) : null;
      if (!start) continue;
      const key = p.scope === 'habit' ? `habit:${p.target_id}` : p.scope;
      if (!pauses.has(key)) pauses.set(key, []);
      pauses.get(key).push([+start, end ? +end : Infinity]);
    }
    const paused = (scope, value) => {
      const ranges = pauses.get(scope);
      if (!ranges?.length) return false;
      const t = date(value);
      return t && ranges.some(([start, end]) => +t >= start && +t <= end);
    };
    const add = (category, id, score, title, body, evidence, action, label, tag = '', agendaGroup = '') => cards.push({ category, id: `${category}:${id}`, score, title, body, evidence, action, label, tag, ...(agendaGroup ? { agendaGroup } : {}) });
    for (const t of array(state.tasks)) {
      if (!alive(t) || !['open', 'in_progress'].includes(t.status || 'open')) continue;
      const due = day(t.due_at), offset = due == null ? null : due - today;
      if (offset != null && offset > 7) continue;
      const next = array(t.steps).find(s => s && !s.is_done && !s.done && !s.completed);
      add('agenda', `task:${t.id}`, offset != null && offset < 0 ? 100 + Math.min(9, -offset / 10) : offset === 0 ? 92 : offset === 1 ? 82 : offset != null ? 60 - offset : t.status === 'in_progress' ? 52 : 28,
        t.title || 'Offene Aufgabe', next?.title ? `Nächster Schritt: ${next.title}` : 'Reserviere fünf Minuten für den kleinsten nächsten Schritt.',
        offset == null ? 'Ohne Termin · bewusst einplanen oder zurückstellen.' : `Fällig ${shortDate(t.due_at)}${String(t.due_at).includes('T') ? `, ${shortTime(t.due_at)}` : ''}`,
        { type: 'task', id: t.id }, 'Task öffnen', offset == null ? 'Offen' : when(offset), 'tasks');
    }
    // Recurrences are materialized by the app. Do not invent extra birthday instances.
    for (const a of array(state.appointments).filter(alive)) {
      const start = date(a.starts_at), end = date(a.ends_at || a.starts_at);
      const birthday = a.is_birthday || a.event_kind === 'birthday' || /<!--hf:event-kind=birthday-->/.test(a.description || '');
      if (!start || !end) continue;
      const startDay = day(start);
      // Local calendar days, including today: birthdays 0–2, appointments 0–6.
      // Birthdays remain visible all day; timed appointments must not have ended.
      if (birthday ? startDay < today || startDay >= today + 3 : startDay >= today + 7 || +end < +now) continue;
      const offset = Math.max(0, startDay - today);
      add('agenda', `appointment:${a.id}`, birthday ? 94 - offset * 2 : 86 - offset * 3,
        a.title || (birthday ? 'Geburtstag' : 'Termin'), birthday ? 'Plane Zeit für einen persönlichen Gruss oder eine kleine Aufmerksamkeit ein.' : a.location ? `Ort: ${a.location}. Plane einen Puffer ein.` : 'Prüfe die Vorbereitung und lass etwas Zeit zwischen deinen Terminen.',
        `${birthday ? 'Geburtstag' : 'Termin'} · ${shortDate(start)}${birthday ? '' : ` · ${shortTime(start)}`}`,
        { type: 'calendar', day: dateKey(day(start) < today ? now : start) }, 'Im Kalender öffnen', when(offset), birthday ? 'birthdays' : 'appointments');
    }
    const history = new Map();
    for (const entry of array(state.habitEntries)) {
      const t = date(entry?.occurred_at), d = day(t);
      if (!alive(entry) || d == null || d > today || +t > +now || paused(`habit:${entry.habit_id}`, t)) continue;
      if (!history.has(entry.habit_id)) history.set(entry.habit_id, []);
      history.get(entry.habit_id).push({ entry, d, t: +t });
    }
    const habitStats = [];
    for (const h of array(state.habits).filter(alive)) {
      if (paused(`habit:${h.id}`, now)) continue;
      const period = { day: 1, week: 7, month: 30 }[h.target_period] || 1;
      const days = new Set(), previous = new Set(), recent = new Set();
      let latest = null, lastEntry = null, lastTime = -Infinity, value = 0, periodLogs = 0;
      for (const { entry, d, t } of history.get(h.id) || []) {
        if (t > lastTime) { lastEntry = entry; lastTime = t; }
        latest = latest == null ? d : Math.max(latest, d);
        const positive = h.type !== 'boolean' || entry.value_bool === true;
        if (positive && d >= today - 7 && d < today) recent.add(d);
        if (positive && d >= today - 14 && d < today - 7) previous.add(d);
        if (d >= today - period + 1) {
          periodLogs++;
          if (positive) days.add(d);
          const n = Number(entry.value_num);
          if (Number.isFinite(n)) value += n;
        }
      }
      if (h.type === 'boolean') value = days.size;
      if (h.type === 'weight') value = Number(lastEntry?.value_num || 0);
      const gap = latest == null ? null : today - latest, target = Number(h.target);
      const reached = periodLogs > 0 && (target > 0 ? (h.direction === 'decrease' ? value <= target : value >= target) : days.size > 0);
      const declining = previous.size >= 2 && recent.size <= previous.size / 2;
      const dormant = gap != null && gap >= Math.max(3, period);
      habitStats.push({ id: h.id, name: h.name, recent: recent.size, previous: previous.size, gap, reached, period, value, target });
      const evidence = `Letzte 7 abgeschlossene Tage: ${recent.size} aktive Tage · davor ${previous.size}. ${gap == null ? 'Noch kein Eintrag.' : gap === 0 ? 'Zuletzt heute erfasst.' : `Letzter Eintrag vor ${gap} Tagen.`}`;
      const body = h.direction === 'decrease' || h.type === 'weight' ? 'Nimm dir kurz Zeit für einen Check-in und prüfe deinen Verlauf.'
        : reached ? 'Dein erfasstes Ziel ist erreicht. Behalte einen Rhythmus bei, der in deinen Alltag passt.'
          : period > 1 ? `Prüfe dein ${period === 7 ? 'Wochenziel' : 'Monatsziel'} und plane die nächste kleine Einheit.`
            : 'Mach den Einstieg klein: eine kurze Einheit oder ein bewusster Check-in reicht als nächster Schritt.';
      add('habits', h.id, reached ? 20 : dormant ? 70 : declining ? 65 : gap == null ? 38 : 35,
        h.name || 'Habit', body, evidence, { type: 'habit', id: h.id }, 'Habit ansehen', reached ? 'Ziel erreicht' : dormant ? 'Wieder aufnehmen' : declining ? 'Rhythmus prüfen' : gap == null ? 'Klein starten' : 'Dranbleiben');
    }
    let smokeRecent = 0, smokePrevious = 0, smokeToday = 0, smokeLast = null;
    for (const e of array(state.cigarettes)) {
      const t = date(e?.smoked_at), d = day(t);
      if (!alive(e) || !t || +t > +now || paused('smoke', t)) continue;
      if (!smokeLast || +t > +smokeLast) smokeLast = t;
      if (d === today) smokeToday++;
      if (d >= today - 7 && d < today) smokeRecent++;
      if (d >= today - 14 && d < today - 7) smokePrevious++;
    }
    const alcoholDays = new Set(), alcoholKnown = new Set(), levels = new Map();
    for (const e of array(state.alcoholLogs)) {
      const d = day(e?.log_date);
      if (!alive(e) || d == null || d > today || paused('alcohol', e.log_date)) continue;
      if (e.consumed === true || e.consumed === false) alcoholKnown.add(d);
      if (e.consumed === true) {
        alcoholDays.add(d);
        const rank = { light: 1, moderate: 2, elevated: 3, heavy: 4 }[e.consumption_key];
        if (rank) levels.set(d, Math.max(levels.get(d) || 0, rank));
      }
    }
    for (const e of array(state.alcoholUnits)) {
      const t = date(e?.occurred_at || e?.created_at), d = day(t);
      if (!alive(e) || !t || +t > +now || paused('alcohol', t)) continue;
      alcoholDays.add(d); alcoholKnown.add(d);
    }
    const count = (set, min, max) => [...set].filter(d => d >= min && d < max).length;
    const alcoholRecent = count(alcoholDays, today - 7, today), alcoholPrevious = count(alcoholDays, today - 14, today - 7);
    const knownRecent = count(alcoholKnown, today - 7, today);
    const elevated = [...levels].filter(([d, rank]) => d >= today - 7 && d < today && rank >= 3).length;
    const consumption = { smokeRecent, smokePrevious, smokeToday, smokeLast: smokeLast?.toISOString() || null, alcoholRecent, alcoholPrevious, knownRecent, alcoholToday: alcoholDays.has(today), alcoholTodayKnown: alcoholKnown.has(today), elevated };
    add('consumption', 'smoke', smokeRecent > smokePrevious && smokePrevious > 0 ? 67 : 24, 'Zigaretten im Blick',
      smokeLast ? 'Schau dir deinen Verlauf an und wähle einen konkreten Moment, den du heute bewusster gestalten möchtest.' : 'Noch keine Zigaretten erfasst. Dieser Bereich bleibt optional.',
      `${smokeRecent} erfasst in den letzten 7 abgeschlossenen Tagen · ${smokePrevious} in den 7 Tagen davor. Heute: ${smokeToday}.`,
      { type: 'smoke' }, 'Konsum ansehen', smokeLast ? smokeRecent > smokePrevious && smokePrevious > 0 ? 'Mehr erfasst' : 'Dein Verlauf' : 'Keine Daten');
    add('consumption', 'alcohol', elevated ? 72 : alcoholRecent > alcoholPrevious && alcoholPrevious > 0 ? 66 : 25, 'Alkohol bewusst einordnen',
      elevated ? `An ${elevated} Tagen hast du erhöhte oder hohe Intensität erfasst. Schau dir diese Situationen in Ruhe an.` : 'Behalte Anlässe und deine selbst erfasste Intensität im Blick.',
      `${alcoholRecent} erfasste Konsumtage in den letzten 7 abgeschlossenen Tagen · davor ${alcoholPrevious}. ${knownRecent}/7 Tage dokumentiert. Nicht erfasste Tage bleiben unbekannt.`,
      { type: 'alcohol' }, 'Alkoholverlauf öffnen', knownRecent ? 'Dein Verlauf' : 'Wenig Daten');
    const listMap = new Map(array(lists.lists).filter(alive).map(l => [l.id, l])), groups = new Map();
    for (const item of array(lists.items)) {
      const list = listMap.get(item?.listId);
      if (!alive(item) || item.isDone || !list || item.metadata?.promotedTaskId || item.metadata?.carriedToId) continue;
      const meta = item.metadata || {};
      const expiry = list.type === 'voucher' ? date(meta.metaB) : list.type === 'subscription' ? date(meta.contractEnd) : null;
      const offset = expiry ? day(expiry) - today : null;
      if (offset != null && offset >= -7 && offset <= 30) {
        add('lists', item.id, offset <= 3 ? 88 : 58 - Math.min(20, offset), item.title || list.title,
          list.type === 'voucher' ? offset < 0 ? 'Das erfasste Ablaufdatum ist vorbei. Prüfe den Status des Gutscheins.' : 'Prüfe, ob du den Gutschein vor Ablauf sinnvoll nutzen möchtest.' : 'Prüfe das hinterlegte Vertragsende und deinen aktuellen Bedarf.',
          `${list.title} · ${list.type === 'voucher' ? 'Ablauf' : 'Vertragsende'} ${shortDate(expiry)}`,
          { type: 'list', id: list.id, itemId: item.id }, 'Liste öffnen', offset < 0 ? 'Datum prüfen' : when(offset));
        continue;
      }
      if (list.id === 'weekly') {
        const week = day(meta.weekStart);
        if (week == null || week > today || week < today - 13) continue;
      }
      if (!groups.has(list.id)) groups.set(list.id, { list, count: 0, sample: item, latest: null });
      const g = groups.get(list.id); g.count++;
      const updated = day(item.updatedAt || item.createdAt);
      if (updated != null && (g.latest == null || updated > g.latest)) { g.latest = updated; g.sample = item; }
    }
    for (const { list, count: n, sample, latest } of groups.values()) {
      const dormant = latest != null && today - latest >= 30;
      add('lists', `group:${list.id}`, list.id === 'weekly' ? 54 : dormant ? 40 : 22,
        list.id === 'weekly' ? 'Gedanken in einen nächsten Schritt verwandeln' : `${list.title} wieder durchsehen`,
        `${n} offene ${n === 1 ? 'Notiz' : 'Einträge'}. Zum Beispiel: „${String(sample.title || 'Ohne Titel').slice(0, 140)}“.`,
        list.id === 'weekly' ? 'Offene Notizen der aktuellen und vorherigen Woche.' : dormant ? `Seit ${today - latest} Tagen kein Eintrag in dieser Auswahl aktualisiert.` : 'Aus deinen offenen Listeneinträgen.',
        { type: 'list', id: list.id, itemId: sample.id }, 'Liste öffnen', list.id === 'weekly' ? 'Wochenzettel' : dormant ? 'Neu entdecken' : 'Durchsehen');
    }
    cards.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return { cards, habits: habitStats, consumption, today: dateKey(now), generatedAt: +now };
  }
  if (typeof module === 'object' && module.exports) { module.exports = { analyze, dateKey, day }; return; }
  const document = root.document;
  if (!document || root.HabitFlowCoach) return;
  let api, model, category = 'all', frame = 0, deadline = 0, tick = 0, opener, dismissedDay = '', limit = 8;
  const dismissed = new Set();
  let agendaLimits = {};
  const modal = () => document.getElementById('coachModal');
  const visible = () => modal() && !modal().classList.contains('hidden') && !document.hidden;
  function cardHtml(card, primary = false, heading = 'h3') {
    return `<article class="lc-card${primary ? ' lc-featured' : ''}"><div class="lc-card-meta"><span>${escape(AGENDA_GROUPS.find(group => group.key === card.agendaGroup)?.title || CATEGORIES[card.category])}</span><span>${escape(card.tag)}</span></div><${heading}>${escape(card.title)}</${heading}><p>${escape(card.body)}</p><small class="lc-evidence">${escape(card.evidence)}</small><div class="lc-card-actions"><button type="button" class="lc-button${primary ? ' lc-primary' : ''}" data-lc-open="${escape(card.id)}">${escape(card.label)} <span aria-hidden="true">↗</span></button><button type="button" class="lc-dismiss" data-lc-dismiss="${escape(card.id)}" aria-label="${escape(card.title)} für diese Sitzung ausblenden" title="Für diese Sitzung ausblenden">Ausblenden</button></div></article>`;
  }
  function agendaHtml(cards) {
    return '<div class="lc-agenda-groups">' + AGENDA_GROUPS.map((group, index) => {
      const items = cards.filter(card => card.agendaGroup === group.key);
      const hiddenCount = model.cards.filter(card => card.agendaGroup === group.key && dismissed.has(card.id)).length;
      const count = agendaLimits[group.key] || 4;
      const shown = items.slice(0, count);
      const headingId = 'lc-agenda-' + group.key;
      const listId = headingId + '-cards';
      return '<section class="lc-agenda-group" aria-labelledby="' + headingId + '">'
        + '<header class="lc-agenda-heading"><span class="lc-agenda-number" aria-hidden="true">' + String(index + 1).padStart(2, '0') + '</span>'
        + '<div class="lc-agenda-title"><h4 id="' + headingId + '" tabindex="-1">' + group.title
        + '<span class="lc-agenda-count" aria-label="' + items.length + ' sichtbare Hinweise">' + items.length + '</span></h4><p>' + group.window + '</p></div>'
        + (hiddenCount ? '<span class="lc-agenda-hidden">' + hiddenCount + ' ausgeblendet</span>' : '') + '</header>'
        + '<div id="' + listId + '" class="lc-cards">' + (shown.length ? shown.map(card => cardHtml(card, false, 'h5')).join('')
          : '<div class="lc-agenda-empty"><p>' + (hiddenCount ? 'Alle Hinweise in diesem Bereich sind für diese Sitzung ausgeblendet.' : group.empty) + '</p></div>') + '</div>'
        + (items.length > count ? '<div class="lc-agenda-pagination"><span>' + shown.length + ' von ' + items.length + ' angezeigt</span>'
          + '<button class="lc-button" type="button" data-lc-agenda-more="' + group.key + '" aria-controls="' + listId + '">Weitere ' + group.title + ' anzeigen <span aria-hidden="true">↓</span></button></div>' : '')
        + '</section>';
    }).join('') + '</div>';
  }
  function render() {
    const content = document.getElementById('lifeCoachContent');
    if (!content || !model) return;
    const focus = document.activeElement;
    const focusKey = Object.entries(focus?.dataset || {}).find(([key]) => key.startsWith('lc'));
    const focusId = focus?.id;
    const explanationOpen = content.querySelector('.lc-footer details')?.open;
    const pauseOpen = content.querySelector('.lc-pause')?.open;
    const available = model.cards.filter(c => !dismissed.has(c.id));
    const filtered = category === 'all' ? available.filter(c => c.category !== 'consumption' || (c.action.type === 'smoke' ? model.consumption.smokeLast : model.consumption.knownRecent || model.consumption.alcoholPrevious || model.consumption.alcoholTodayKnown)) : available.filter(c => c.category === category);
    const chosen = category === 'all' ? filtered.slice(0, 3) : filtered.slice(0, limit);
    const c = model.consumption;
    const habitAttention = model.habits.filter(h => !h.reached && (h.gap >= Math.max(3, h.period) || (h.previous >= 2 && h.recent <= h.previous / 2))).length;
    content.innerHTML = `<div class="lc-summary"><div><span class="lc-kicker">Dein Überblick</span><h2 id="coachModalTitle">Was jetzt Aufmerksamkeit verdient.</h2><p>Ein klarer nächster Schritt. Aus deinem Alltag, für deinen Alltag.</p></div><button class="lc-button lc-refresh" type="button" data-lc-refresh aria-label="Coach aktualisieren">Aktualisieren</button></div>
      <div class="lc-metrics"><div><small>Agenda · anstehend & offen</small><strong>${model.cards.filter(x => x.category === 'agenda').length}</strong><span>relevante Aufgaben & Termine</span></div><div><small>Habit-Rhythmus</small><strong>${habitAttention}</strong><span>zum Wiederaufnehmen oder Prüfen</span></div><div><small>Zigaretten · heute</small><strong>${c.smokeToday}</strong><span>erfasste Zigaretten</span></div><div><small>Alkohol · heute</small><strong>${c.alcoholToday ? 'Erfasst' : c.alcoholTodayKnown ? 'Ohne' : 'Offen'}</strong><span>${c.alcoholToday ? 'Konsum dokumentiert' : c.alcoholTodayKnown ? 'als konsumfrei dokumentiert' : 'noch kein Tages-Check-in'}</span></div></div>
      <div class="lc-filters" role="group" aria-label="Coach-Bereich">${Object.entries(CATEGORIES).map(([key, label]) => `<button type="button" data-lc-filter="${key}" aria-pressed="${category === key}">${label}${key === 'all' ? '' : `<span>${available.filter(c => c.category === key).length}</span>`}</button>`).join('')}</div>
      <div class="lc-section-head"><h3>${category === 'all' ? 'Deine nächsten Schritte' : escape(CATEGORIES[category])}</h3><span>${category === 'all' ? 'Nach Dringlichkeit geordnet' : `${filtered.length} Hinweise`}</span></div>
      ${category === 'agenda' ? agendaHtml(filtered) : `<div class="lc-cards">${chosen.length ? chosen.map((card, i) => cardHtml(card, category === 'all' && i === 0)).join('') : '<div class="lc-empty"><h3>Hier ist gerade Raum.</h3><p>Keine offenen Hinweise in diesem Bereich. Schau in deine anderen Bereiche oder geniesse den freien Kopf.</p></div>'}</div>`}
      ${category !== 'all' && category !== 'agenda' && filtered.length > limit ? '<button class="lc-button" type="button" data-lc-more>Weitere Hinweise anzeigen</button>' : ''}
      ${dismissed.size ? `<button class="lc-restore" type="button" data-lc-restore>${dismissed.size} ausgeblendete Hinweise wieder anzeigen</button>` : ''}
      <details class="lc-pause" ${pauseOpen ? 'open' : ''}><summary id="lifeCoachPauseTitle">Du brauchst gerade eine Pause?</summary><p>Leg kurz beiseite, was dich beschäftigt. Löse die Schultern, atme ruhig und entscheide danach über deinen nächsten Schritt.</p><div class="lc-pause-actions"><button class="lc-button" type="button" data-lc-timer>3 Minuten für mich</button><output id="lifeCoachTimer" aria-live="off" aria-label="Verbleibende Pausenzeit"></output><button class="lc-restore" type="button" data-lc-cancel ${deadline ? '' : 'hidden'}>Beenden</button></div></details>
      <footer class="lc-footer"><span>Stand ${new Date(model.generatedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} · Aus deinen geladenen Daten</span><details ${explanationOpen ? 'open' : ''}><summary id="lifeCoachExplanationTitle">Wie der Coach auswählt</summary><p>Fristen und nahe Termine zuerst, danach auffällige Habit-Rhythmen und Konsumverläufe, dann offene Listen. Habit-Trends vergleichen aktive Tage, Konsumtrends die letzten zwei abgeschlossenen 7-Tage-Zeiträume. Wochen- und Monatsziele berücksichtigen 7 bzw. 30 Tage. Fehlende Einträge sind kein Beleg für Konsumfreiheit. Pausierte Habits und archivierte Einträge werden ausgelassen. Es werden keine Daten an einen KI-Dienst gesendet und keine Einträge automatisch verändert.</p></details></footer>`;
    if (focusKey) {
      const replacement = [...content.querySelectorAll('button')].find(b => b.dataset[focusKey[0]] === focusKey[1]);
      (replacement || content.querySelector(`[data-lc-filter="${category}"]`))?.focus({ preventScroll: true });
    }
    if (focusId && content.querySelector(`#${focusId}`)) content.querySelector(`#${focusId}`).focus({ preventScroll: true });
    if (deadline) { content.querySelector('.lc-pause').open = true; updateTimer(); }
  }
  function refresh() {
    if (!visible() || !api || frame) return;
    frame = root.requestAnimationFrame(() => {
      frame = 0;
      if (!visible()) return;
      const key = dateKey(new Date());
      if (dismissedDay !== key) { dismissed.clear(); dismissedDay = key; }
      model = analyze(api.snapshot(), root.HabitFlowListsCoach?.snapshot() || {});
      render();
    });
  }
  function updateTimer() {
    const output = document.getElementById('lifeCoachTimer');
    const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (output) output.textContent = deadline ? seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Pause beendet. Was passt jetzt für dich?' : '';
    if (!seconds) { root.clearInterval(tick); tick = 0; }
  }
  function resumeTimer() {
    root.clearInterval(tick); tick = 0;
    if (deadline && visible()) { updateTimer(); if (deadline > Date.now()) tick = root.setInterval(updateTimer, 1000); }
  }
  function open(bridge) {
    if (modal() && !modal().classList.contains('hidden')) { refresh(); return; }
    api = bridge; opener = document.activeElement; category = 'all'; limit = 8; agendaLimits = {};
    modal()?.classList.remove('hidden'); document.body.classList.add('modal-open');
    for (let current = modal(); current?.parentElement && current.parentElement !== document.body; current = current.parentElement) {
      [...current.parentElement.children].filter(child => child !== current).forEach(child => { child.dataset.lcWasInert = String(child.inert); child.inert = true; });
    }
    refresh(); resumeTimer(); document.getElementById('coachCloseBtn')?.focus({ preventScroll: true });
  }
  function close(restoreFocus = true) {
    root.clearInterval(tick); tick = 0;
    if (frame) root.cancelAnimationFrame(frame); frame = 0;
    modal()?.classList.add('hidden'); document.body.classList.remove('modal-open');
    document.querySelectorAll?.('[data-lc-was-inert]').forEach(child => { child.inert = child.dataset.lcWasInert === 'true'; delete child.dataset.lcWasInert; });
    if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
  }
  document.getElementById('coachDialog')?.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const d = button.dataset;
    if (d.lcFilter) { category = d.lcFilter; limit = 8; render(); }
    if (d.lcOpen) { const card = model?.cards.find(c => c.id === d.lcOpen); if (card) { close(false); api.navigate(card.action); } }
    if (d.lcDismiss) { dismissed.add(d.lcDismiss); render(); }
    if ('lcRestore' in d) { dismissed.clear(); render(); document.querySelector(`[data-lc-filter="${category}"]`)?.focus(); }
    if ('lcRefresh' in d) refresh();
    if (d.lcAgendaMore && AGENDA_GROUPS.some(group => group.key === d.lcAgendaMore)) {
      agendaLimits[d.lcAgendaMore] = (agendaLimits[d.lcAgendaMore] || 4) + 4;
      render();
      document.getElementById('lc-agenda-' + d.lcAgendaMore)?.focus({ preventScroll: true });
    }
    if ('lcMore' in d) { limit += 8; render(); document.querySelector(`[data-lc-filter="${category}"]`)?.focus(); }
    if ('lcTimer' in d) { deadline = Date.now() + 180000; document.querySelector('[data-lc-cancel]').hidden = false; resumeTimer(); }
    if ('lcCancel' in d) { deadline = 0; root.clearInterval(tick); tick = 0; updateTimer(); button.hidden = true; document.querySelector('[data-lc-timer]')?.focus(); }
  });
  modal()?.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const buttons = [...modal().querySelectorAll('button, summary, [tabindex="0"]')].filter(el => !el.hidden && el.getClientRects().length);
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  document.addEventListener('visibilitychange', () => { resumeTimer(); if (!document.hidden) refresh(); });
  root.addEventListener('focus', refresh);
  root.HabitFlowCoach = Object.freeze({ open, close, refresh, analyze });
})(typeof window === 'object' ? window : globalThis);
