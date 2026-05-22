(() => {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const SETTINGS_KEY = 'habitflow-settings-v1';
  const THEME_KEY = 'habitflow-theme';
  const TREND_METRIC_KEY = 'habitflow-trend-metric';
  const COACH_SESSION_KEY = 'habitflow-coach-session-v1';
  const MORNING_ROUTINE_SESSION_KEY = 'habitflow-morning-routine-session-v1';
  const MORNING_ROUTINE_VARIANT_KEY = 'habitflow-morning-routine-variant-offset-v1';
  const RULES_UI_KEY = 'habitflow-rules-open';
  const HABIT_DNA_UI_KEY = 'habitflow-habit-dna-open';
  const HABIT_CARD_UI_KEY = 'habitflow-habit-cards-open';
  const CONSUMPTION_MODE_KEY = 'habitflow-consumption-mode';
  const LEISURE_FILTER_KEY = 'habitflow-leisure-filters-v1';
  const ACTIVITY_CATALOG_URL = './data/activity-ideas.json';
  const ACTIVITY_REMOTE_SEED_KEY = 'habitflow-activity-remote-seeded-v1';
  const ACTIVITY_CATALOG_TABLE = 'activity_ideas';
  const LEISURE_RESULT_LIMIT = 12;
  const SUPABASE_CONFIG = window.HABITFLOW_SUPABASE_CONFIG || {};
  const MEDITATION_TECHNIQUES = [
    { key: '7-3-11', title: '7-3-11 Atemtechnik', subtitle: 'Runterfahren mit langer Ausatmung', minutes: 6, pattern: '7 ein · 3 halten · 11 aus' },
    { key: 'box', title: 'Box Breathing', subtitle: 'Klarer Fokus vor schwierigen Momenten', minutes: 5, pattern: '4 · 4 · 4 · 4' },
    { key: 'body-scan', title: 'Body Scan', subtitle: 'Körper wahrnehmen und Spannung lösen', minutes: 10, pattern: 'ruhig scannen' },
    { key: 'urge-surf', title: 'Craving-Welle', subtitle: 'Drang beobachten, ohne sofort zu handeln', minutes: 4, pattern: 'wahrnehmen · warten · wählen' },
    { key: 'gratitude', title: 'Dankbarkeits-Minute', subtitle: 'Kurzer mentaler Reset mit positiver Ankerung', minutes: 3, pattern: '3 Dinge benennen' }
  ];


  const MORNING_ROUTINES = [
    {
      key: 'energy-start',
      title: 'Energy Start',
      subtitle: 'Aktivierender Start mit kurzen Kraftimpulsen',
      mood: 'aktiv',
      steps: [
        { title: 'Wasser & Licht', minutes: 2, icon: 'water', body: 'Trink Wasser, öffne kurz das Fenster und nimm drei lange Atemzüge.' },
        { title: 'Mobility Flow', minutes: 4, icon: 'walking', body: 'Nacken kreisen, Schultern öffnen, Hüfte mobilisieren und Rücken rund/hohl bewegen.' },
        { title: '6-Minuten-Kraft', minutes: 6, icon: 'sport', body: '3 Runden: 10 Squats, 6 Push-ups, 20 Sekunden Plank. Ruhig, sauber, ohne Maximaldruck.' },
        { title: 'Tagesfokus', minutes: 2, icon: 'tasks', body: 'Schreib oder sag: Was ist heute die eine Sache, die wirklich zählt?' },
        { title: 'Commit', minutes: 1, icon: 'check', body: 'Routine bewusst abschliessen. Kleine Energie zählt.' }
      ]
    },
    {
      key: 'soft-start',
      title: 'Soft Start',
      subtitle: 'Sanft wach werden, ohne Stress ins System zu bringen',
      mood: 'ruhig',
      steps: [
        { title: 'Ankommen', minutes: 2, icon: 'meditation', body: 'Setz dich aufrecht hin, entspanne die Schultern und atme länger aus als ein.' },
        { title: 'Ganzkörper-Mobility', minutes: 4, icon: 'walking', body: 'Langsame Cat-Cows, Hüftkreise, Fussgelenke und Brustwirbelsäule öffnen.' },
        { title: 'Low Impact Fitness', minutes: 6, icon: 'standingDesk', body: '2 Runden: 12 Good Mornings, 10 Wall Push-ups, 12 Glute Bridges, 30 Sekunden Dead Bug.' },
        { title: 'Klarer Satz', minutes: 2, icon: 'edit', body: 'Beende den Satz: Heute wird leichter, wenn ich ____.' },
        { title: 'Startsignal', minutes: 1, icon: 'check', body: 'Steh auf, richte dich gross auf und starte ohne neues Grübeln.' }
      ]
    },
    {
      key: 'core-wakeup',
      title: 'Core Wakeup',
      subtitle: 'Bauch, Rücken und Haltung stabilisieren',
      mood: 'stabil',
      steps: [
        { title: 'Reset-Atem', minutes: 2, icon: 'reset', body: '4 ruhige Atemzüge, dann Bauchspannung sanft aktivieren.' },
        { title: 'Rücken öffnen', minutes: 4, icon: 'walking', body: 'Cat-Cow, Child’s Pose, Hüftbeuger-Stretch und Schulterkreisen.' },
        { title: 'Core Block', minutes: 6, icon: 'pushups', body: '3 Runden: 20 Sekunden Plank, 8 Dead Bugs pro Seite, 10 Bird Dogs.' },
        { title: 'Fokus-Minute', minutes: 2, icon: 'tasks', body: 'Wähle eine Aufgabe, die nach der Routine nur 5 Minuten bekommt.' },
        { title: 'Abschluss', minutes: 1, icon: 'check', body: 'Kurz stehen, Rücken lang, Routine als erledigt markieren.' }
      ]
    },
    {
      key: 'no-excuses-mini',
      title: 'No Excuses Mini',
      subtitle: 'Einfach, direkt und fast unmöglich zu überspringen',
      mood: 'klar',
      steps: [
        { title: 'Wasser', minutes: 2, icon: 'water', body: 'Ein Glas Wasser. Kein Handy. Nur starten.' },
        { title: 'Gelenke wecken', minutes: 4, icon: 'walking', body: 'Je 30 Sekunden: Hals, Schultern, Hüfte, Knie, Fussgelenke, Rücken.' },
        { title: 'Simple Circuit', minutes: 6, icon: 'sport', body: '6 Minuten im Wechsel: 10 Squats, 10 Incline Push-ups, 20 Sekunden Hollow Hold.' },
        { title: 'Eine Sache', minutes: 2, icon: 'tasks', body: 'Sag laut: Die eine Sache heute ist ____.' },
        { title: 'Haken setzen', minutes: 1, icon: 'check', body: 'Fertig. Nicht perfekt, aber durchgeführt.' }
      ]
    },
    {
      key: 'posture-reset',
      title: 'Posture Reset',
      subtitle: 'Rücken, Schultern und Nacken für den Tag öffnen',
      mood: 'aufrecht',
      steps: [
        { title: 'Ausrichten', minutes: 2, icon: 'standingDesk', body: 'Steh aufrecht, Füsse stabil, Schultern tief, Kopf lang.' },
        { title: 'Schulter-Mobility', minutes: 4, icon: 'walking', body: 'Armkreise, Wall Angels, Brust öffnen und Nacken langsam bewegen.' },
        { title: 'Haltungs-Kraft', minutes: 6, icon: 'pushups', body: '3 Runden: 12 Reverse Flys ohne Gewicht, 10 Squats, 20 Sekunden Side Plank je Seite.' },
        { title: 'Arbeit klarziehen', minutes: 2, icon: 'tasks', body: 'Welche Haltung braucht dein Tag: ruhig, schnell oder sauber?' },
        { title: 'Setzen', minutes: 1, icon: 'check', body: 'Richte deinen Arbeitsplatz oder ersten Ort bewusst ein.' }
      ]
    },
    {
      key: 'runner-prep',
      title: 'Runner Prep',
      subtitle: 'Beine, Hüfte und Kreislauf sanft aktivieren',
      mood: 'dynamisch',
      steps: [
        { title: 'Warm werden', minutes: 2, icon: 'walking', body: 'Leicht marschieren, Arme mitschwingen, Atmung ruhig halten.' },
        { title: 'Bein-Mobility', minutes: 4, icon: 'jogging', body: 'Leg Swings, Hüftkreise, Wadenfedern und Ausfallschritt-Dehnung.' },
        { title: 'Bein-Block', minutes: 6, icon: 'sport', body: '3 Runden: 10 Lunges, 12 Calf Raises, 20 Sekunden Mountain Climbers langsam.' },
        { title: 'Tagesroute', minutes: 2, icon: 'tasks', body: 'Plane einen Mini-Walk oder eine kurze Treppe als Bonus im Tag.' },
        { title: 'Fertig', minutes: 1, icon: 'check', body: 'Beine wach, Kopf klar, +50 Punkte möglich.' }
      ]
    },
    {
      key: 'stress-down',
      title: 'Stress Down',
      subtitle: 'Atem, Mobility und leichte Aktivierung gegen Morgenstress',
      mood: 'beruhigend',
      steps: [
        { title: 'Lange Ausatmung', minutes: 2, icon: 'meditation', body: 'Atme 4 Sekunden ein und 6–8 Sekunden aus. Sechs ruhige Runden.' },
        { title: 'Spannung lösen', minutes: 4, icon: 'reset', body: 'Kiefer, Schultern, Hände, Hüfte und Rücken bewusst lockern.' },
        { title: 'Sanfte Fitness', minutes: 6, icon: 'walking', body: '2 Runden: 12 Squats langsam, 8 Push-ups erhöht, 30 Sekunden Plank auf Knien.' },
        { title: 'Entlasten', minutes: 2, icon: 'edit', body: 'Schreib eine Sache auf, die heute bewusst kleiner sein darf.' },
        { title: 'Ruhig starten', minutes: 1, icon: 'check', body: 'Ein kleiner Start ist heute genug.' }
      ]
    },
    {
      key: 'strength-light',
      title: 'Strength Light',
      subtitle: 'Leichte Kraft ohne Überforderung',
      mood: 'stark',
      steps: [
        { title: 'Körpercheck', minutes: 2, icon: 'meditation', body: 'Kurz scannen: Rücken, Beine, Schultern. Nichts erzwingen.' },
        { title: 'Mobilisieren', minutes: 4, icon: 'walking', body: 'Hüfte, Sprunggelenke, Brustwirbelsäule und Handgelenke vorbereiten.' },
        { title: 'Kraftzirkel', minutes: 6, icon: 'pushups', body: 'EMOM 6: Minute 1 Squats, Minute 2 Push-ups, Minute 3 Plank – zweimal wiederholen.' },
        { title: 'Fokus setzen', minutes: 2, icon: 'tasks', body: 'Was erledigst du heute besser langsam als gar nicht?' },
        { title: 'Abschliessen', minutes: 1, icon: 'check', body: 'Routine speichern und Energie mitnehmen.' }
      ]
    },
    {
      key: 'weekend-flow',
      title: 'Weekend Flow',
      subtitle: 'Spielerisch, locker und trotzdem wirksam',
      mood: 'locker',
      steps: [
        { title: 'Frische Luft', minutes: 2, icon: 'water', body: 'Wasser trinken, Fenster öffnen, kurz lächeln. Kein Druck.' },
        { title: 'Flow Mobility', minutes: 4, icon: 'walking', body: 'Freier Flow: Rücken, Hüfte, Schultern, was sich heute gut anfühlt.' },
        { title: 'Fun Fitness', minutes: 6, icon: 'sport', body: '6 Minuten freie Mischung: Squats, Shadow Boxing, Plank, Hampelmänner low impact.' },
        { title: 'Wochenend-Fokus', minutes: 2, icon: 'reward', body: 'Was macht den Tag heute bewusst schön statt nur voll?' },
        { title: 'Fertig', minutes: 1, icon: 'check', body: 'Locker abgeschlossen. Genau richtig.' }
      ]
    },
    {
      key: 'low-energy-rescue',
      title: 'Low Energy Rescue',
      subtitle: 'Minimum-Version für müde Tage',
      mood: 'minimal',
      steps: [
        { title: 'Nur starten', minutes: 2, icon: 'water', body: 'Wasser, Licht, einmal tief ausatmen. Mehr muss noch nicht sein.' },
        { title: 'Mini Mobility', minutes: 4, icon: 'walking', body: 'Langsame Bewegungen im Sitzen oder Stehen: Nacken, Schultern, Rücken, Hüfte.' },
        { title: 'Mini Fitness', minutes: 6, icon: 'standingDesk', body: '3 Runden leicht: 8 Chair Squats, 8 Wall Push-ups, 20 Sekunden ruhiges Stehen.' },
        { title: 'Heute klein', minutes: 2, icon: 'edit', body: 'Schreib: Das Minimum, das heute reicht, ist ____.' },
        { title: 'Erhalten', minutes: 1, icon: 'check', body: 'Du hast das System am Leben gehalten.' }
      ]
    }
  ];


  const SMOKING_TIPS = [
    {
      title: '10-Minuten-Verzögerung',
      body: 'Stell dir innerlich nur ein kleines Ziel: nicht nie wieder, sondern jetzt 10 Minuten später. Öffne danach bewusst neu, ob du wirklich rauchen willst.',
      meta: '+10 Min.'
    },
    {
      title: 'Wasser + kurzer Weg',
      body: 'Trink ein Glas Wasser und geh einmal kurz weg vom Trigger-Ort. Die App soll genau diesen Moment zwischen Reiz und Zigarette stärker machen.',
      meta: 'Reset'
    },
    {
      title: 'Atmung statt Autopilot',
      body: 'Mach 3 ruhige Atemzüge mit langer Ausatmung. Wenn der Druck noch da ist, logge die Craving-Welle und warte eine weitere Minute.',
      meta: 'Atem'
    },
    {
      title: 'Hände beschäftigen',
      body: 'Nimm für 2 Minuten etwas in die Hand: Tee, Kaugummi, Stift, kurzer Notiz-Check. Ziel ist Ablenkung ohne Ersatz-Stress.',
      meta: 'Ablenkung'
    },
    {
      title: 'Trigger bewusst benennen',
      body: 'Sag dir kurz: „Das ist gerade ein Craving, kein Befehl.“ Benenne Ort, Gefühl und nächster kleiner Schritt – dann erst entscheiden.',
      meta: 'Klarheit'
    },
    {
      title: 'Mini-Vertrag mit dir',
      body: 'Schreib innerlich nur einen Satz: „Ich warte bis zur nächsten vollen Viertelstunde.“ Das ist konkret genug, um den Autopilot zu stoppen.',
      meta: 'Vertrag'
    },
    {
      title: 'Ort wechseln, Entscheidung behalten',
      body: 'Du musst gerade nichts endgültig entscheiden. Wechsle nur den Ort: Fenster, Küche, kurzer Gang. Danach darfst du neu bewerten.',
      meta: 'Ort'
    },
    {
      title: 'Craving als Timer sehen',
      body: 'Behandle den Drang wie eine Welle mit Ablaufzeit. Starte 90 Sekunden ruhiges Atmen und prüfe erst danach, ob er wirklich stärker wurde.',
      meta: '90 Sek.'
    },
    {
      title: 'Erste Handlung ändern',
      body: 'Mach nicht die erste typische Bewegung. Nicht Packung nehmen, nicht rausgehen. Erst Wasser, Kaugummi oder Hände waschen.',
      meta: 'Pattern'
    },
    {
      title: 'Belohnung tauschen',
      body: 'Wenn Rauchen gerade Belohnung wäre, gib deinem Kopf sofort eine kleine Alternative: Musik an, Tee machen oder 3 Minuten frische Luft ohne Zigarette.',
      meta: 'Tausch'
    },
    {
      title: 'Nur eine Zigarette weniger',
      body: 'Heute muss nicht perfekt werden. Eine einzige Zigarette weniger als sonst ist bereits ein echter Eingriff ins Muster.',
      meta: '-1'
    },
    {
      title: 'Nach dem Essen brechen',
      body: 'Wenn Essen der Trigger ist: Tisch direkt verlassen, Zähne putzen oder Tee machen. Die Routine wird in den ersten 2 Minuten entschieden.',
      meta: 'Essen'
    },
    {
      title: 'Stress nicht mit Nikotin lösen',
      body: 'Frag dich kurz: „Welches Problem ist nach der Zigarette wirklich kleiner?“ Wenn keines, wähle erst den kleinsten praktischen Schritt.',
      meta: 'Stress'
    },
    {
      title: 'Kosten sichtbar machen',
      body: 'Eine Zigarette sind 40 Rappen. Nicht als Schuldgefühl, sondern als klares Feedback: Jede verschobene Zigarette ist messbar gespart.',
      meta: 'CHF'
    },
    {
      title: 'Rückfall ohne Kette',
      body: 'Falls du doch rauchst: direkt loggen, Trigger wählen und danach wieder Abstand bauen. Ein Log ist kein Scheitern, sondern Kontrolle zurückholen.',
      meta: 'Reset'
    }
  ];

  const COACH_TRIGGER_META = {
    stress: { label: 'Stress / Druck', action: 'Schultern senken, 3 lange Ausatmungen, dann die kleinste Aufgabe statt Zigarette wählen.', icon: 'stress' },
    coffee: { label: 'Kaffee / Routine', action: 'Tasse wegstellen, Wasser nachziehen und den Ort für 2 Minuten wechseln.', icon: 'coffee' },
    alcohol: { label: 'Alkohol / Ausgang', action: 'Rauch-Situation verlassen, Glas Wasser bestellen und die nächste Zigarette aktiv um 10 Minuten schieben.', icon: 'alcohol' },
    boredom: { label: 'Langeweile', action: 'Hände beschäftigen: kurze Nachricht, Kaugummi, Stift oder 20 Schritte gehen.', icon: 'boredom' },
    reward: { label: 'Belohnung', action: 'Belohnung ersetzen: Tee, Musik, kurze Dusche oder 5 Minuten frische Luft ohne Zigarette.', icon: 'reward' },
    social: { label: 'Sozialer Moment', action: 'Kurz draussen mitgehen ohne zu rauchen oder bewusst innen bleiben und später neu entscheiden.', icon: 'social' },
    meal: { label: 'Nach dem Essen', action: 'Direkt Zähne putzen, Tee machen oder Küche verlassen. Die Routine wird zuerst gebrochen.', icon: 'meal' },
    tasks: { label: 'Aufgaben-Druck', action: 'Wähle eine offene Karte, ziehe sie in Bearbeitung und arbeite nur 5 Minuten am kleinsten nächsten Schritt.', icon: 'tasks' },
    habits: { label: 'Habit-Check', action: 'Logge den kleinsten heute noch offenen Habit. Eine Mini-Einheit reicht, um Momentum zu halten.', icon: 'habits' }
  };
  const DAY_MS = 24 * 60 * 60 * 1000;
  const DEFAULT_HABIT_IDS = Object.freeze({
    weight: '00000000-0000-4000-8000-000000000101',
    water: '00000000-0000-4000-8000-000000000102',
    sport: '00000000-0000-4000-8000-000000000103',
    meditation: '00000000-0000-4000-8000-000000000104'
  });
  const SYNC_TABLES = ['habit_definitions', 'habit_entries', 'cigarette_events', 'alcohol_logs', 'alcohol_events', 'tasks', 'task_ideas', 'appointments', 'points_ledger'];
  const REMOTE_DELETE_TOMBSTONE_TTL_DAYS = 14;
  const OPTIONAL_SYNC_TABLES = new Set(['alcohol_events', 'appointments', 'task_ideas']);
  const BUILT_IN_DEFAULT_HABIT_NAMES = new Set(['gewicht', 'wasser', 'sport', 'meditation']);
  const TASK_COLUMNS = [
    { status: 'open', title: 'Offen', hint: 'geplant und noch nicht gestartet' },
    { status: 'in_progress', title: 'In Bearbeitung', hint: 'aktiver Fokus für heute' },
    { status: 'done', title: 'Erledigt', hint: 'abgeschlossen und bepunktet' },
    { status: 'archived', title: 'Backlog', hint: 'später priorisieren, noch nicht aktiv' }
  ];
  const TASK_BOARD_COLUMNS = TASK_COLUMNS.filter(column => column.status !== 'archived');
  const TASK_BACKLOG_STATUS = 'archived';
  const TASK_PRIORITIES = {
    low: { label: 'Niedrig', short: 'Low', rank: 1, bonus: 0 },
    medium: { label: 'Normal', short: 'Normal', rank: 2, bonus: 10 },
    high: { label: 'Hoch', short: 'Hoch', rank: 3, bonus: 25 },
    urgent: { label: 'Kritisch', short: 'Kritisch', rank: 4, bonus: 40 }
  };
  const TASK_IDEA_CATEGORIES = {
    focus: { label: 'Fokus', short: 'Fokus' },
    health: { label: 'Gesundheit', short: 'Health' },
    consumption: { label: 'Konsum', short: 'Konsum' },
    habit: { label: 'Habit', short: 'Habit' },
    admin: { label: 'Admin', short: 'Admin' },
    experiment: { label: 'Experiment', short: 'Test' }
  };
  const TASK_IDEA_STATUSES = new Set(['open', 'accepted', 'dismissed']);
  const APPOINTMENT_TYPES = {
    personal: { label: 'Privat', short: 'Privat' },
    work: { label: 'Arbeit', short: 'Arbeit' },
    health: { label: 'Gesundheit', short: 'Health' },
    social: { label: 'Sozial', short: 'Sozial' },
    admin: { label: 'Admin', short: 'Admin' },
    other: { label: 'Sonstiges', short: 'Termin' }
  };
  const ALCOHOL_TYPES = {
    beer: 'Bier', wine: 'Wein', cocktail: 'Cocktail', shot: 'Shot', other: 'Anderes'
  };
  const ALCOHOL_POINTS_BY_TYPE = Object.freeze({ beer: -20, shot: -25, cocktail: -30, wine: -20, other: -25 });
  const HABIT_TARGET_PERIODS = {
    day: { label: 'Tagesziel', short: 'Tag', days: 1 },
    week: { label: 'Wochenziel', short: 'Woche', days: 7 },
    month: { label: 'Monatsziel', short: 'Monat', days: 30 }
  };
  const HABIT_DNA_TIME_META = {
    early: { label: 'Früh', adverb: 'früh', range: [5, 7] },
    morning: { label: 'Morgens', adverb: 'morgens', range: [7, 11] },
    midday: { label: 'Mittags', adverb: 'mittags', range: [11, 14] },
    afternoon: { label: 'Nachmittags', adverb: 'nachmittags', range: [14, 18] },
    evening: { label: 'Abends', adverb: 'abends', range: [18, 22] },
    late: { label: 'Spät', adverb: 'spät', range: [22, 24] },
    flexible: { label: 'Flexibel', adverb: 'flexibel', range: null }
  };
  const HABIT_DNA_HURDLES = {
    consistency: 'Dranbleiben',
    resistance: 'Innerer Widerstand',
    stress: 'Stress / Druck',
    perfectionism: 'Perfektionismus',
    boredom: 'Langeweile',
    tiredness: 'Müdigkeit'
  };
  const HABIT_DNA_TRIGGERS = {
    routine: 'Routine',
    wakeup: 'Nach dem Aufstehen',
    coffee: 'Nach Kaffee',
    workstart: 'Arbeitsstart',
    meal: 'Nach dem Essen',
    afterwork: 'Feierabend',
    workout: 'Nach Bewegung',
    bedtime: 'Vor dem Schlafen'
  };
  const HABIT_DNA_REWARDS = {
    progress: 'Fortschritt',
    pride: 'Stolz',
    calm: 'Ruhe',
    clarity: 'Klarheit',
    energy: 'Energie',
    relief: 'Erleichterung'
  };
  const HABIT_DNA_LOCAL_FIELDS = ['dna_difficulty', 'dna_energy', 'dna_preferred_time', 'dna_emotional_hurdle', 'dna_trigger', 'dna_reward'];
  const nowIso = () => new Date().toISOString();
  const uid = () => (crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const ICON_PATHS = {
    dashboard: '<path d="M4 13h7V4H4v9Z"/><path d="M13 20h7V4h-7v16Z"/><path d="M4 20h7v-5H4v5Z"/>',
    smoke: '<path d="M4 15h11"/><path d="M17 15h3"/><path d="M6 18h12"/><path d="M15 8c1.8-1.6 1.8-3.3 0-4.8"/><path d="M19 10c1.2-1.1 1.2-2.4 0-3.5"/>',
    coach: '<path d="M12 4 19 8v5c0 4-2.8 6.7-7 8-4.2-1.3-7-4-7-8V8l7-4Z"/><path d="M9 12h6"/><path d="M12 9v6"/>',
    habits: '<path d="M12 3v18"/><path d="M12 8c-4.5 0-7 2.1-7 6 4.5 0 7-2.1 7-6Z"/><path d="M12 11c4.5 0 7 2.1 7 6-4.5 0-7-2.1-7-6Z"/>',
    tasks: '<path d="M5 7h14"/><path d="M5 12h14"/><path d="M5 17h8"/><path d="m15 17 2 2 4-5"/>',
    idea: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2.1V17h6v-.2c0-.9.4-1.6 1-2.1A7 7 0 0 0 12 2Z"/><path d="M10 9h4"/><path d="M12 7v4"/>',
    calendar: '<path d="M7 3v4"/><path d="M17 3v4"/><path d="M4 8h16"/><rect x="4" y="5" width="16" height="16" rx="3"/>',
    sync: '<path d="M20 7h-5V2"/><path d="M20 7a8 8 0 0 0-13.7-2.4"/><path d="M4 17h5v5"/><path d="M4 17a8 8 0 0 0 13.7 2.4"/>',
    weight: '<path d="M7 8h10l2 12H5L7 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    water: '<path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z"/>',
    sport: '<path d="M7 20 10 11l4 3 3 6"/><path d="m10 11 3-4 4 2"/><path d="M14 4h.01"/><path d="M4 14h4"/>',
    meditation: '<path d="M12 5a2 2 0 1 0 0 .01"/><path d="M8 20c1.5-2 2.7-3 4-3s2.5 1 4 3"/><path d="M5 15c2.5-2 4.8-3 7-3s4.5 1 7 3"/>',
    standingDesk: '<path d="M5 10h14"/><path d="M7 10v10"/><path d="M17 10v10"/><path d="M9 20h6"/><rect x="8" y="4" width="8" height="5" rx="1.5"/><path d="M12 9v3"/>',
    pushups: '<path d="M5 9a1.7 1.7 0 1 0 0 .01"/><path d="M7 10h6l4 3"/><path d="M9 14h7"/><path d="M7 11l-2 6"/><path d="M16 13l3 5"/><path d="M4 18h16"/>',
    bread: '<path d="M5 20V10a7 7 0 0 1 14 0v10H5Z"/><path d="M8 20v-8a4 4 0 0 1 8 0v8"/><path d="M9 15h.01"/><path d="M15 15h.01"/>',
    jogging: '<path d="M13 4a1.8 1.8 0 1 0 0 .01"/><path d="m11 8 3 2 3-1"/><path d="m14 10-3 4"/><path d="m11 14 4 6"/><path d="M10 14 6 19"/><path d="M4 9h3"/><path d="M3 13h4"/>',
    hiking: '<path d="m3 20 6-10 4 6 3-5 5 9H3Z"/><path d="M9 10 12 4l4 7"/><path d="M15 20v-7"/><path d="M12 16h6"/>',
    walking: '<path d="M12 5a1.8 1.8 0 1 0 0 .01"/><path d="M12 8v5"/><path d="m12 11 3 2"/><path d="M12 13 9 20"/><path d="m12 13 5 7"/><path d="M7 21h2"/><path d="M17 21h2"/>',
    number: '<path d="M9 4 7 20"/><path d="M17 4l-2 16"/><path d="M4 9h16"/><path d="M3 15h16"/>',
    duration: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/>',
    boolean: '<path d="m5 13 4 4L19 7"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13 7 4 4"/>',
    trash: '<path d="M5 7h14"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M8 7l1-3h6l1 3"/><path d="M7 7l1 14h8l1-14"/>',
    archive: '<path d="M4 7h16v4H4V7Z"/><path d="M6 11v9h12v-9"/><path d="M10 15h4"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    check: '<path d="m5 13 4 4L19 7"/>',
    alcohol: '<path d="M8 3h8l-1 9a3 3 0 0 1-6 0L8 3Z"/><path d="M12 15v5"/><path d="M9 21h6"/><path d="M9 8h6"/>',
    beer: '<path d="M8 5h7a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V7a2 2 0 0 1 2-2Z"/><path d="M15 8h2a2 2 0 0 1 0 4h-2"/><path d="M9 8h4"/><path d="M9 11h4"/>',
    wine: '<path d="M8 4h8v2a4 4 0 0 1-8 0V4Z"/><path d="M12 10v7"/><path d="M9 21h6"/><path d="M8 4h8"/>',
    cocktail: '<path d="M5 5h14l-7 7-7-7Z"/><path d="M12 12v6"/><path d="M9 21h6"/><path d="m15 5 2-2"/><path d="M12 5V3"/>',
    shot: '<path d="M9 4h6l-1 13a2 2 0 0 1-4 0L9 4Z"/><path d="M9 8h6"/><path d="M10 20h4"/>',
    stress: '<path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z"/>',
    coffee: '<path d="M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2"/><path d="M8 4v2"/><path d="M12 4v2"/>',
    boredom: '<path d="M5 12h14"/><path d="M7 8h.01"/><path d="M17 16h.01"/>',
    reward: '<path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M9 18h6"/><path d="M12 13v5"/><path d="M5 6H3a3 3 0 0 0 4 3"/><path d="M19 6h2a3 3 0 0 1-4 3"/>',
    social: '<path d="M8 11a3 3 0 1 0 0-.01"/><path d="M16 11a3 3 0 1 0 0-.01"/><path d="M3 20c1-3 2.8-5 5-5s4 2 5 5"/><path d="M11 20c1-2.6 2.7-4 5-4s4 1.4 5 4"/>',
    meal: '<path d="M7 3v9"/><path d="M5 3v4"/><path d="M9 3v4"/><path d="M7 12v9"/><path d="M16 3v18"/><path d="M14 3h4v8h-4"/>',
    money: '<path d="M4 7h16v10H4z"/><path d="M4 10h16"/><path d="M12 10v7"/><path d="M8 15h.01"/><path d="M16 15h.01"/>',
    dna: '<path d="M8 4c4 2 4 4 8 6"/><path d="M8 20c4-2 4-4 8-6"/><path d="M9 7h6"/><path d="M9 12h6"/><path d="M9 17h6"/>',
    delay: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
    reset: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>'
  };

  function svgIcon(name = 'number', className = 'ui-icon') {
    const key = ICON_PATHS[name] ? name : 'number';
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[key]}</svg>`;
  }

  function renderStaticIcons() {
    $$('[data-icon]').forEach(node => {
      node.innerHTML = svgIcon(node.dataset.icon || 'number');
    });
  }

  function normalizeIconSearch(value = '') {
    return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function habitIconKey(habit = {}) {
    const iconRaw = String(habit.icon || '').trim().toLowerCase();
    const nameRaw = String(habit.name || '').trim().toLowerCase();
    const raw = normalizeIconSearch(iconRaw);
    const name = normalizeIconSearch(nameRaw);
    if (iconRaw.includes('💧') || name.includes('wasser')) return 'water';
    if (iconRaw.includes('⚖') || name.includes('gewicht')) return 'weight';
    if (iconRaw.includes('🧘') || name.includes('meditation')) return 'meditation';
    if (name.includes('stehpult') || name.includes('standing desk') || name.includes('stehschreibtisch')) return 'standingDesk';
    if (name.includes('liegestutz') || name.includes('liegestuetz') || name.includes('pushup') || name.includes('push-up')) return 'pushups';
    if (name.includes('brot') || name.includes('bread')) return 'bread';
    if (name.includes('joggen') || name.includes('jogging')) return 'jogging';
    if (name.includes('wandern') || name.includes('hiking')) return 'hiking';
    if (name.includes('spazieren') || name.includes('spaziergang') || name.includes('walking')) return 'walking';
    if (iconRaw.includes('🏃') || name.includes('sport')) return 'sport';
    if (ICON_PATHS[raw]) return raw;
    return ICON_PATHS[habit.type] ? habit.type : 'number';
  }

  var state = loadState();
  let settings = loadSettings();
  let supabaseClient = null;
  let authSession = null;
  let currentUser = null;
  let authSubscription = null;
  let passwordRecoveryMode = false;
  let syncSubscription = null;
  let syncInFlight = false;
  let pendingSyncRequest = null;
  let lastSyncAt = null;
  let remotePullTimer = null;
  let leisurePullTimer = null;
  let selectedCalendarDate = toDateKey(new Date());
  let calendarCursor = new Date();
  let charts = { trend: null, points: null };
  let selectedTrendMetric = localStorage.getItem(TREND_METRIC_KEY) || 'points';
  let activeSmokingTipIndex = 0;
  let coachSession = loadCoachSession();
  let morningRoutineSession = loadMorningRoutineSession();
  let editingSmokeId = null;
  let editingHabitId = null;
  let editingHabitEntryId = null;
  let expandedMeditationHabitId = null;
  let historyModalMode = null;
  let historyModalHabitId = null;
  let editingTaskId = null;
  let editingAppointmentId = null;
  let renderQueued = false;
  let deferredRenderPending = false;
  let habitFormOpen = false;
  let taskFormOpen = false;
  let taskIdeasOpen = false;
  let taskBacklogOpen = false;
  let taskArchiveOpen = false;
  let taskTimelineOpen = false;
  let taskWeeklyOpen = false;
  let taskWeeklyCursor = startOfWeekDate(new Date());
  let taskTimelineScrollLeft = null;
  let taskTimelineDragState = null;
  let appointmentFormOpen = false;
  let remoteTaskPrioritySupported = true;
  let remoteTaskInProgressSupported = true;
  let remoteTaskBacklogRankSupported = true;
  let remoteTaskDoneArchiveSupported = true;
  let remoteTaskIdeasSupported = true;
  let remoteActivityIdeasSupported = true;
  let remoteHabitTargetPeriodSupported = true;
  let pendingTriggerSmokeId = null;
  let rulesExpanded = localStorage.getItem(RULES_UI_KEY) !== 'collapsed';
  let expandedHabitDnaIds = loadExpandedHabitDnaIds();
  let expandedHabitCardIds = loadExpandedHabitCardIds();
  let activeConsumptionMode = localStorage.getItem(CONSUMPTION_MODE_KEY) === 'alcohol' ? 'alcohol' : 'smoke';
  let leisureSeedCatalog = [];
  let leisureCatalog = [];
  let leisureCatalogError = null;
  let editingActivityIdeaId = null;
  let activityCatalogFormOpen = false;
  let leisureCatalogLoaded = false;
  let leisureFilters = loadLeisureFilters();
  let leisureResultOffset = 0;

  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheEls();
    applyRulesVisibility();
    applyConsumptionMode();
    applyTheme();
    fillSettingsForm();
    bindEvents();
    showScreen(document.querySelector('.nav-btn.active')?.dataset.target || 'dashboard', { refresh: false });
    renderStaticIcons();
    await loadLeisureCatalog();
    migrateCigaretteScoring();
    migrateAlcoholScoring();
    await initSupabase();
    initOngoingSync();
    registerServiceWorker();
    render();
    setInterval(() => {
      renderTimers();
      renderCoach();
    }, 30_000);
  }


  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./service-worker.js').catch(error => console.warn('Service Worker konnte nicht registriert werden.', error));
  }

  function cacheEls() {
    Object.assign(els, {
      toast: $('#toast'),
      authGate: $('#authGate'),
      authForm: $('#authForm'),
      authEmailInput: $('#authEmailInput'),
      authPasswordInput: $('#authPasswordInput'),
      authPasswordConfirmInput: $('#authPasswordConfirmInput'),
      authPasswordConfirmField: $('#authPasswordConfirmField'),
      authPasswordLabel: $('#authPasswordLabel'),
      authResetBtn: $('#authResetBtn'),
      authSubmitBtn: $('#authSubmitBtn'),
      authStatusText: $('#authStatusText'),
      authUserEmail: $('#authUserEmail'),
      themeToggle: $('#themeToggle'),
      syncNowBtn: $('#syncNowBtn'),
      navButtons: $$('.nav-btn'),
      screens: $$('.screen'),
      dashboardTitle: $('#dashboardTitle'),
      dashboardSubtitle: $('#dashboardSubtitle'),
      heroSmokeBtn: $('#heroSmokeBtn'),
      heroMorningRoutineBtn: $('#heroMorningRoutineBtn'),
      heroTaskBtn: $('#heroTaskBtn'),
      heroCoachBtn: $('#heroCoachBtn'),
      heroEmergencyBtn: $('#heroEmergencyBtn'),
      morningRoutineModal: $('#morningRoutineModal'),
      morningRoutineModalCloseBtn: $('#morningRoutineModalCloseBtn'),
      coachModal: $('#coachModal'),
      coachCloseBtn: $('#coachCloseBtn'),
      totalPoints: $('#totalPoints'),
      levelLabel: $('#levelLabel'),
      levelProgress: $('#levelProgress'),
      currentPause: $('#currentPause'),
      todayCigarettes: $('#todayCigarettes'),
      avgPause7: $('#avgPause7'),
      openTasksCount: $('#openTasksCount'),
      dailyScore: $('#dailyScore'),
      dailyScoreHint: $('#dailyScoreHint'),
      morningRoutineCard: $('#morningRoutineCard'),
      insightsGrid: $('#insightsGrid'),
      weeklyReview: $('#weeklyReview'),
      habitHeatmap: $('#habitHeatmap'),
      trendMetricSelect: $('#trendMetricSelect'),
      trendChartTitle: $('#trendChartTitle'),
      trendChart: $('#trendChart'),
      pointsChart: $('#pointsChart'),
      recordSmokeBtn: $('#recordSmokeBtn'),
      emergencyCravingBtn: $('#emergencyCravingBtn'),
      triggerCaptureCard: $('#triggerCaptureCard'),
      smokePauseLive: $('#smokePauseLive'),
      smokePauseHint: $('#smokePauseHint'),
      alcoholTypeSelect: $('#alcoholTypeSelect'),
      recordAlcoholUnitBtn: $('#recordAlcoholUnitBtn'),
      toggleRulesBtn: $('#toggleRulesBtn'),
      rulesContent: $('#rulesContent'),
      consumptionModeButtons: $$('.consumption-switch-btn'),
      consumptionPanes: $$('.consumption-pane'),
      alcoholUnitHistory: $('#alcoholUnitHistory'),
      alcoholTodayUnits: $('#alcoholTodayUnits'),
      alcoholTodayHint: $('#alcoholTodayHint'),
      lastAlcoholPoints: $('#lastAlcoholPoints'),
      smokeHistory: $('#smokeHistory'),
      smokeMobileInsight: $('#smokeMobileInsight'),
      smokeMobileKpis: $('#smokeMobileKpis'),
      alcoholMobileInsight: $('#alcoholMobileInsight'),
      alcoholMobileKpis: $('#alcoholMobileKpis'),
      historyModal: $('#historyModal'),
      historyModalCloseBtn: $('#historyModalCloseBtn'),
      historyModalContent: $('#historyModalContent'),
      cigaretteHeatmapVisual: $('#cigaretteHeatmapVisual'),
      cigaretteHeatmapBadge: $('#cigaretteHeatmapBadge'),
      smokeIntervalVisual: $('#smokeIntervalVisual'),
      smokeIntervalQuality: $('#smokeIntervalQuality'),
      alcoholHeatmapVisual: $('#alcoholHeatmapVisual'),
      alcoholHeatmapBadge: $('#alcoholHeatmapBadge'),
      alcoholIntervalVisual: $('#alcoholIntervalVisual'),
      alcoholIntervalQuality: $('#alcoholIntervalQuality'),
      lastSmokePoints: $('#lastSmokePoints'),
      cravingTipTitle: $('#cravingTipTitle'),
      cravingTipBody: $('#cravingTipBody'),
      cravingTipMeta: $('#cravingTipMeta'),
      meditationTechniqueGrid: $('#meditationTechniqueGrid'),
      meditationHistory: $('#meditationHistory'),
      habitFormPanel: $('#habitFormPanel'),
      habitFormToggleBtn: $('#habitFormToggleBtn'),
      habitFormCloseBtn: $('#habitFormCloseBtn'),
      habitForm: $('#habitForm'),
      habitFormTitle: $('#habitFormTitle'),
      habitSubmitBtn: $('#habitSubmitBtn'),
      cancelHabitEditBtn: $('#cancelHabitEditBtn'),
      habitCards: $('#habitCards'),
      habitDnaOverview: $('#habitDnaOverview'),
      taskFormPanel: $('#taskFormPanel'),
      taskFormToggleBtn: $('#taskFormToggleBtn'),
      taskFormCloseBtn: $('#taskFormCloseBtn'),
      taskForm: $('#taskForm'),
      taskFormTitle: $('#taskFormTitle'),
      taskSubmitBtn: $('#taskSubmitBtn'),
      cancelTaskEditBtn: $('#cancelTaskEditBtn'),
      taskPointsPreview: $('#taskPointsPreview'),
      tasksList: $('#tasksList'),
      taskIdeasToggleBtn: $('#taskIdeasToggleBtn'),
      taskWeeklyToggleBtn: $('#taskWeeklyToggleBtn'),
      taskWeeklyPanel: $('#taskWeeklyPanel'),
      taskWeeklyRange: $('#taskWeeklyRange'),
      taskWeeklyOverview: $('#taskWeeklyOverview'),
      taskWeeklySuggestions: $('#taskWeeklySuggestions'),
      taskWeeklyDays: $('#taskWeeklyDays'),
      taskWeeklyPrevBtn: $('#taskWeeklyPrevBtn'),
      taskWeeklyTodayBtn: $('#taskWeeklyTodayBtn'),
      taskWeeklyNextBtn: $('#taskWeeklyNextBtn'),
      taskIdeasCount: $('#taskIdeasCount'),
      taskIdeasPanel: $('#taskIdeasPanel'),
      taskIdeaForm: $('#taskIdeaForm'),
      taskIdeaList: $('#taskIdeaList'),
      activityFinderForm: $('#activityFinderForm'),
      activityFinderMeta: $('#activityFinderMeta'),
      activitySuggestionList: $('#activitySuggestionList'),
      activityCatalogForm: $('#activityCatalogForm'),
      activityCatalogFormPanel: $('#activityCatalogFormPanel'),
      activityCatalogFormTitle: $('#activityCatalogFormTitle'),
      activityCatalogSubmitBtn: $('#activityCatalogSubmitBtn'),
      taskBacklogToggleBtn: $('#taskBacklogToggleBtn'),
      taskArchiveToggleBtn: $('#taskArchiveToggleBtn'),
      taskTimelineToggleBtn: $('#taskTimelineToggleBtn'),
      taskBacklogCount: $('#taskBacklogCount'),
      taskArchiveCount: $('#taskArchiveCount'),
      taskBacklogPanel: $('#taskBacklogPanel'),
      taskBacklogList: $('#taskBacklogList'),
      taskArchivePanel: $('#taskArchivePanel'),
      taskArchiveList: $('#taskArchiveList'),
      taskTimelinePanel: $('#taskTimelinePanel'),
      taskTimeline: $('#taskTimeline'),
      appointmentFormPanel: $('#appointmentFormPanel'),
      appointmentFormToggleBtn: $('#appointmentFormToggleBtn'),
      appointmentFormCloseBtn: $('#appointmentFormCloseBtn'),
      appointmentForm: $('#appointmentForm'),
      appointmentFormTitle: $('#appointmentFormTitle'),
      appointmentSubmitBtn: $('#appointmentSubmitBtn'),
      cancelAppointmentEditBtn: $('#cancelAppointmentEditBtn'),
      calendarTitle: $('#calendarTitle'),
      calendarGrid: $('#calendarGrid'),
      selectedDateTitle: $('#selectedDateTitle'),
      dayDetails: $('#dayDetails'),
      prevMonthBtn: $('#prevMonthBtn'),
      todayMonthBtn: $('#todayMonthBtn'),
      nextMonthBtn: $('#nextMonthBtn'),
      settingsForm: $('#settingsForm'),
      manualSyncBtn: $('#manualSyncBtn'),
      logoutBtn: $('#logoutBtn'),
      syncStatus: $('#syncStatus'),
      exportBtn: $('#exportBtn'),
      importInput: $('#importInput'),
      resetBtn: $('#resetBtn'),
      sqlPreview: $('#sqlPreview'),
      copySqlBtn: $('#copySqlBtn'),
      coachUrgeLevel: $('#coachUrgeLevel'),
      coachTrigger: $('#coachTrigger'),
      coachRiskBadge: $('#coachRiskBadge'),
      coachChallengeCard: $('#coachChallengeCard'),
      coachResult: $('#coachResult'),
      coachConfidence: $('#coachConfidence'),
      coachPlanGrid: $('#coachPlanGrid'),
      behaviorIntelligencePanel: $('#behaviorIntelligencePanel'),
      urgeForecastBadge: $('#urgeForecastBadge'),
      nextBestActionCard: $('#nextBestActionCard'),
      urgeForecastCard: $('#urgeForecastCard'),
      keystoneHabitCard: $('#keystoneHabitCard'),
      recoveryModeCard: $('#recoveryModeCard'),
      experimentModeCard: $('#experimentModeCard'),
      triggerHeatmap: $('#triggerHeatmap'),
      partyPlanBadge: $('#partyPlanBadge'),
      partyPlanCard: $('#partyPlanCard')
    });
  }

  function bindEvents() {
    els.themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light');
      localStorage.setItem(THEME_KEY, document.body.classList.contains('light') ? 'light' : 'dark');
    });

    if (els.authForm) els.authForm.addEventListener('submit', handleAuthForm);
    if (els.authResetBtn) els.authResetBtn.addEventListener('click', requestPasswordRecoveryEmail);

    els.navButtons.forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.target)));
    els.heroSmokeBtn.addEventListener('click', () => recordCigarette());
    if (els.heroMorningRoutineBtn) els.heroMorningRoutineBtn.addEventListener('click', openMorningRoutineFromHero);
    els.heroTaskBtn.addEventListener('click', () => { showScreen('tasks'); openTaskForm(); });
    if (els.heroCoachBtn) els.heroCoachBtn.addEventListener('click', openCoachModal);
    if (els.heroEmergencyBtn) els.heroEmergencyBtn.addEventListener('click', startEmergencyCravingFlow);
    if (els.morningRoutineModalCloseBtn) els.morningRoutineModalCloseBtn.addEventListener('click', closeMorningRoutineModal);
    if (els.morningRoutineModal) {
      els.morningRoutineModal.addEventListener('click', event => {
        if (event.target === els.morningRoutineModal) closeMorningRoutineModal();
      });
    }
    if (els.coachCloseBtn) els.coachCloseBtn.addEventListener('click', closeCoachModal);
    if (els.historyModalCloseBtn) els.historyModalCloseBtn.addEventListener('click', closeHistoryModal);
    if (els.historyModal) {
      els.historyModal.addEventListener('click', event => {
        if (event.target === els.historyModal) closeHistoryModal();
      });
    }
    if (els.coachModal) {
      els.coachModal.addEventListener('click', event => {
        if (event.target === els.coachModal) closeCoachModal();
      });
    }
    els.recordSmokeBtn.addEventListener('click', () => recordCigarette());
    if (els.emergencyCravingBtn) els.emergencyCravingBtn.addEventListener('click', startEmergencyCravingFlow);
    if (els.recordAlcoholUnitBtn) els.recordAlcoholUnitBtn.addEventListener('click', () => recordAlcoholUnit());
    if (els.toggleRulesBtn) els.toggleRulesBtn.addEventListener('click', toggleRulesVisibility);
    els.trendMetricSelect.addEventListener('change', () => {
      selectedTrendMetric = els.trendMetricSelect.value;
      localStorage.setItem(TREND_METRIC_KEY, selectedTrendMetric);
      renderCharts();
    });
    if (els.habitFormToggleBtn) els.habitFormToggleBtn.addEventListener('click', () => openHabitForm());
    if (els.habitFormCloseBtn) els.habitFormCloseBtn.addEventListener('click', () => closeHabitForm({ clearForm: !editingHabitId }));
    if (els.taskFormToggleBtn) els.taskFormToggleBtn.addEventListener('click', toggleTaskForm);
    if (els.taskIdeasToggleBtn) els.taskIdeasToggleBtn.addEventListener('click', toggleTaskIdeas);
    if (els.taskWeeklyToggleBtn) els.taskWeeklyToggleBtn.addEventListener('click', toggleTaskWeekly);
    if (els.taskWeeklyPrevBtn) els.taskWeeklyPrevBtn.addEventListener('click', () => moveTaskPlanningWeek(-1));
    if (els.taskWeeklyTodayBtn) els.taskWeeklyTodayBtn.addEventListener('click', () => moveTaskPlanningWeek(0, { reset: true }));
    if (els.taskWeeklyNextBtn) els.taskWeeklyNextBtn.addEventListener('click', () => moveTaskPlanningWeek(1));
    if (els.taskBacklogToggleBtn) els.taskBacklogToggleBtn.addEventListener('click', toggleTaskBacklog);
    if (els.taskArchiveToggleBtn) els.taskArchiveToggleBtn.addEventListener('click', toggleTaskArchive);
    if (els.taskTimelineToggleBtn) els.taskTimelineToggleBtn.addEventListener('click', toggleTaskTimeline);
    if (els.taskFormCloseBtn) els.taskFormCloseBtn.addEventListener('click', () => closeTaskForm({ clearForm: !editingTaskId }));
    if (els.appointmentFormToggleBtn) els.appointmentFormToggleBtn.addEventListener('click', () => openAppointmentForm({ dateKey: selectedCalendarDate }));
    if (els.appointmentFormCloseBtn) els.appointmentFormCloseBtn.addEventListener('click', () => closeAppointmentForm({ clearForm: !editingAppointmentId }));
    els.habitForm.addEventListener('submit', createHabit);
    els.taskForm.addEventListener('submit', createTask);
    if (els.taskIdeaForm) els.taskIdeaForm.addEventListener('submit', createTaskIdea);
    if (els.activityFinderForm) {
      els.activityFinderForm.addEventListener('change', updateLeisureFiltersFromForm);
      els.activityFinderForm.addEventListener('input', updateLeisureFiltersFromForm);
    }
    if (els.activityCatalogForm) els.activityCatalogForm.addEventListener('submit', saveLeisureActivityFromForm);
    if (els.appointmentForm) els.appointmentForm.addEventListener('submit', createAppointment);
    els.taskForm.elements.effort.addEventListener('change', updateTaskPreview);
    els.taskForm.elements.priority.addEventListener('change', updateTaskPreview);
    if (els.appointmentForm?.elements?.starts_at) els.appointmentForm.elements.starts_at.addEventListener('change', syncAppointmentEndDefault);
    if (els.cancelHabitEditBtn) els.cancelHabitEditBtn.addEventListener('click', () => closeHabitForm({ clearForm: true }));
    if (els.cancelTaskEditBtn) els.cancelTaskEditBtn.addEventListener('click', () => closeTaskForm({ clearForm: true }));
    if (els.cancelAppointmentEditBtn) els.cancelAppointmentEditBtn.addEventListener('click', () => closeAppointmentForm({ clearForm: true }));
    els.prevMonthBtn.addEventListener('click', () => moveMonth(-1));
    els.nextMonthBtn.addEventListener('click', () => moveMonth(1));
    els.todayMonthBtn.addEventListener('click', () => {
      calendarCursor = new Date();
      selectedCalendarDate = toDateKey(new Date());
      renderCalendar();
      renderDayDetails();
    });
    if (els.settingsForm) {
      els.settingsForm.addEventListener('submit', async event => {
        event.preventDefault();
        await syncWithSupabase({ silent: false, pullFirst: true });
        await syncLeisureCatalogWithSupabase({ silent: false });
      });
    }
    if (els.logoutBtn) els.logoutBtn.addEventListener('click', logout);
    els.syncNowBtn.addEventListener('click', async () => {
      await syncWithSupabase({ silent: false, pullFirst: true });
      await syncLeisureCatalogWithSupabase({ silent: false });
    });
    els.exportBtn.addEventListener('click', exportJson);
    els.importInput.addEventListener('change', importJson);
    els.resetBtn.addEventListener('click', resetDemo);
    if (els.copySqlBtn) els.copySqlBtn.addEventListener('click', copySql);
    if (els.coachUrgeLevel) els.coachUrgeLevel.addEventListener('change', updateCoachCheckIn);
    if (els.coachTrigger) els.coachTrigger.addEventListener('change', updateCoachCheckIn);

    document.addEventListener('focusout', flushDeferredRender);
    document.addEventListener('change', flushDeferredRender);
    setupMobileResponsiveSections();
    setupTaskTimelineScroller();

    document.addEventListener('click', event => {
      const actionEl = event.target.closest('[data-action]');
      if (!actionEl) return;
      const { action, id } = actionEl.dataset;
      if (action === 'complete-task') completeTask(id);
      if (action === 'move-task') moveTaskToStatus(id, actionEl.dataset.status);
      if (action === 'move-task-to-backlog') moveTaskToBacklog(id);
      if (action === 'move-backlog-task') moveTaskToStatus(id, actionEl.dataset.status || 'open');
      if (action === 'backlog-rank-up') shiftBacklogTask(id, -1);
      if (action === 'backlog-rank-down') shiftBacklogTask(id, 1);
      if (action === 'archive-done-task') archiveDoneTask(id);
      if (action === 'restore-archived-task') restoreArchivedDoneTask(id);
      if (action === 'done-archive-rank-up') shiftArchivedDoneTask(id, -1);
      if (action === 'done-archive-rank-down') shiftArchivedDoneTask(id, 1);
      if (action === 'generate-task-ideas') generateTaskIdeas();
      if (action === 'idea-to-task') createTaskFromIdea(id, 'open');
      if (action === 'idea-to-backlog') createTaskFromIdea(id, TASK_BACKLOG_STATUS);
      if (action === 'dismiss-task-idea') dismissTaskIdea(id);
      if (action === 'reopen-task-idea') reopenTaskIdea(id);
      if (action === 'delete-task-idea') deleteTaskIdea(id);
      if (action === 'refresh-leisure-ideas') refreshLeisureIdeas();
      if (action === 'reset-leisure-filters') resetLeisureFilters();
      if (action === 'toggle-activity-form') toggleLeisureActivityForm();
      if (action === 'cancel-activity-edit') closeLeisureActivityForm({ clearForm: true });
      if (action === 'edit-activity') editLeisureActivity(id);
      if (action === 'delete-activity') deleteLeisureActivity(id);
      if (action === 'activity-to-idea') createTaskIdeaFromActivity(id);
      if (action === 'activity-to-task') createTaskFromActivity(id, 'open');
      if (action === 'activity-to-backlog') createTaskFromActivity(id, TASK_BACKLOG_STATUS);
      if (action === 'weekly-plan-task') planExistingTaskForWeek(id, actionEl.dataset.day);
      if (action === 'weekly-plan-backlog') planBacklogTaskForWeek(id, actionEl.dataset.day);
      if (action === 'weekly-plan-idea') planIdeaForWeek(id, actionEl.dataset.day);
      if (action === 'weekly-clear-task-date') clearTaskDueDate(id);
      if (action === 'edit-task') editTask(id);
      if (action === 'delete-task') deleteTask(id);
      if (action === 'archive-task') archiveTask(id);
      if (action === 'edit-appointment') editAppointment(id);
      if (action === 'delete-appointment') deleteAppointment(id);
      if (action === 'edit-habit') editHabit(id);
      if (action === 'delete-habit') deleteHabit(id);
      if (action === 'archive-habit') archiveHabit(id);
      if (action === 'toggle-habit-card') toggleHabitCard(id);
      if (action === 'toggle-habit-dna') toggleHabitDna(id);
      if (action === 'log-habit') logHabit(id);
      if (action === 'start-morning-routine') startMorningRoutine();
      if (action === 'next-morning-step') advanceMorningRoutine();
      if (action === 'finish-morning-routine') finishMorningRoutine();
      if (action === 'shuffle-morning-routine') shuffleMorningRoutine();
      if (action === 'reset-morning-routine') resetMorningRoutineSession();
      if (action === 'open-smoke-history') openHistoryModal('smoke');
      if (action === 'open-smoke-costs') openHistoryModal('smoke-costs');
      if (action === 'open-alcohol-history') openHistoryModal('alcohol');
      if (action === 'open-habit-logs') openHistoryModal('habit', id);
      if (action === 'close-history-modal') closeHistoryModal();
      if (action === 'toggle-meditation-techniques') toggleMeditationTechniques(id);
      if (action === 'edit-habit-entry') editHabitEntry(id);
      if (action === 'save-habit-entry') saveHabitEntry(id);
      if (action === 'cancel-habit-entry-edit') cancelHabitEntryEdit();
      if (action === 'delete-habit-entry') deleteHabitEntry(id);
      if (action === 'edit-smoke') editSmoke(id);
      if (action === 'save-smoke-time') saveSmokeTime(id);
      if (action === 'cancel-smoke-edit') cancelSmokeEdit();
      if (action === 'delete-smoke') deleteSmoke(id);
      if (action === 'delete-alcohol') deleteAlcoholLog(id);
      if (action === 'delete-alcohol-unit') deleteAlcoholUnit(id);
      if (action === 'log-alcohol-unit') recordAlcoholUnit(actionEl.dataset.drinkType);
      if (action === 'switch-consumption-mode') switchConsumptionMode(actionEl.dataset.mode);
      if (action === 'rotate-craving-tip') rotateSmokingTip();
      if (action === 'log-meditation') logMeditationTechnique(id);
      if (action === 'record-cigarette') { recordCigarette(); closeMobileQuickAdd(); }
      if (action === 'open-morning-routine') { openMorningRoutineFromHero(); closeMobileQuickAdd(); }
      if (action === 'open-task-form') { showScreen('tasks'); openTaskForm(); closeMobileQuickAdd(); }
      if (action === 'open-appointment-form') { showScreen('calendar'); openAppointmentForm({ dateKey: selectedCalendarDate, forceNew: true }); closeMobileQuickAdd(); }
      if (action === 'start-emergency-craving') { startEmergencyCravingFlow(); closeMobileQuickAdd(); }
      if (action === 'open-coach') { openCoachModal(); closeMobileQuickAdd(); }
      if (action === 'start-coach-delay') startCoachDelay();
      if (action === 'coach-breath-reset') coachBreathReset();
      if (action === 'coach-record-smoke') coachRecordSmoke();
      if (action === 'save-smoke-trigger') saveSmokeTrigger(id, actionEl.dataset.trigger);
      if (action === 'dismiss-smoke-trigger') dismissSmokeTrigger();
      if (action === 'start-experiment') startExperiment(actionEl.dataset.experiment);
      if (action === 'finish-experiment') finishExperiment(id, actionEl.dataset.result);
      if (action === 'activate-party-plan') activatePartyPlan();
      if (action === 'complete-party-plan') completePartyPlan(id);
      if (action === 'start-recovery-mode') startRecoveryMode();
      if (action === 'next-best-action') handleNextBestAction(actionEl.dataset.nextAction);
      if (action === 'new-appointment-for-day') openAppointmentForm({ dateKey: selectedCalendarDate, forceNew: true });
      if (action === 'select-day') {
        selectedCalendarDate = actionEl.dataset.day;
        renderCalendar();
        renderDayDetails();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (els.historyModal && !els.historyModal.classList.contains('hidden')) return closeHistoryModal();
      if (els.morningRoutineModal && !els.morningRoutineModal.classList.contains('hidden')) return closeMorningRoutineModal();
      if (els.coachModal && !els.coachModal.classList.contains('hidden')) closeCoachModal();
    });

    document.addEventListener('dragstart', event => {
      const card = event.target.closest('[data-task-card]');
      if (!card) return;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.dataset.id || '');
      card.classList.add('is-dragging');
    });

    document.addEventListener('dragover', event => {
      const archiveDrop = event.target.closest('[data-task-archive-drop]');
      if (archiveDrop) {
        event.preventDefault();
        archiveDrop.classList.add('is-over');
        return;
      }
      const backlogDrop = event.target.closest('[data-backlog-drop]');
      if (backlogDrop) {
        event.preventDefault();
        backlogDrop.classList.add('is-over');
        return;
      }
      const column = event.target.closest('[data-task-drop]');
      if (!column) return;
      event.preventDefault();
      column.classList.add('is-over');
    });

    document.addEventListener('dragleave', event => {
      const archiveDrop = event.target.closest('[data-task-archive-drop]');
      if (archiveDrop && !archiveDrop.contains(event.relatedTarget)) archiveDrop.classList.remove('is-over');
      const backlogDrop = event.target.closest('[data-backlog-drop]');
      if (backlogDrop && !backlogDrop.contains(event.relatedTarget)) backlogDrop.classList.remove('is-over');
      const column = event.target.closest('[data-task-drop]');
      if (column && !column.contains(event.relatedTarget)) column.classList.remove('is-over');
    });

    document.addEventListener('drop', event => {
      const archiveDrop = event.target.closest('[data-task-archive-drop]');
      if (archiveDrop) {
        event.preventDefault();
        archiveDrop.classList.remove('is-over');
        const taskId = event.dataTransfer.getData('text/plain');
        const targetCard = event.target.closest('[data-archive-card]');
        let insertAfter = false;
        if (targetCard) {
          const rect = targetCard.getBoundingClientRect();
          insertAfter = event.clientY > rect.top + rect.height / 2;
        }
        archiveDoneTask(taskId, targetCard?.dataset.id || null, { insertAfter });
        return;
      }
      const backlogDrop = event.target.closest('[data-backlog-drop]');
      if (backlogDrop) {
        event.preventDefault();
        backlogDrop.classList.remove('is-over');
        const taskId = event.dataTransfer.getData('text/plain');
        const targetCard = event.target.closest('[data-backlog-card]');
        let insertAfter = false;
        if (targetCard) {
          const rect = targetCard.getBoundingClientRect();
          insertAfter = event.clientY > rect.top + rect.height / 2;
        }
        moveTaskToBacklog(taskId, targetCard?.dataset.id || null, { insertAfter });
        return;
      }
      const column = event.target.closest('[data-task-drop]');
      if (!column) return;
      event.preventDefault();
      column.classList.remove('is-over');
      const taskId = event.dataTransfer.getData('text/plain');
      moveTaskToStatus(taskId, column.dataset.status);
    });

    document.addEventListener('dragend', () => {
      $$('[data-task-card].is-dragging').forEach(card => card.classList.remove('is-dragging'));
      $$('[data-task-drop].is-over').forEach(column => column.classList.remove('is-over'));
      $$('[data-backlog-drop].is-over').forEach(zone => zone.classList.remove('is-over'));
      $$('[data-task-archive-drop].is-over').forEach(zone => zone.classList.remove('is-over'));
    });
  }

  function defaultState() {
    const created = nowIso();
    return {
      version: 1,
      habits: [createSystemMeditationHabit(created)],
      habitEntries: [],
      cigarettes: [],
      alcoholLogs: [],
      alcoholUnits: [],
      tasks: [],
      taskIdeas: [],
      activityIdeas: [],
      appointments: [],
      pointsLedger: [],
      coachEvents: [],
      experiments: [],
      partyPlans: [],
      recoverySessions: [],
      morningRoutineLogs: [],
      deletedRemoteIds: createEmptyDeletedRemoteIds()
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
    next.alcoholUnits = Array.isArray(next.alcoholUnits) ? next.alcoholUnits : [];
    next.tasks = Array.isArray(next.tasks) ? next.tasks.map(normalizeTask) : [];
    next.taskIdeas = Array.isArray(next.taskIdeas) ? next.taskIdeas.map(normalizeTaskIdea) : [];
    next.activityIdeas = Array.isArray(next.activityIdeas) ? next.activityIdeas.map(normalizeLeisureActivity).filter(item => item.id && item.title) : [];
    next.appointments = Array.isArray(next.appointments) ? next.appointments.map(normalizeAppointment) : [];
    next.pointsLedger = Array.isArray(next.pointsLedger) ? next.pointsLedger.map(normalizeMorningRoutineLedgerPoint) : [];
    next.habits = next.habits.map(normalizeHabit);
    next.coachEvents = Array.isArray(next.coachEvents) ? next.coachEvents : [];
    next.experiments = Array.isArray(next.experiments) ? next.experiments : [];
    next.partyPlans = Array.isArray(next.partyPlans) ? next.partyPlans : [];
    next.recoverySessions = Array.isArray(next.recoverySessions) ? next.recoverySessions : [];
    next.morningRoutineLogs = Array.isArray(next.morningRoutineLogs) ? next.morningRoutineLogs : [];
    next.deletedRemoteIds = normalizeDeletedRemoteIds(next.deletedRemoteIds);
    ensureSystemHabits(next);
    dedupeStateCollections(next);
    return next;
  }

  function createSystemMeditationHabit(created = nowIso()) {
    return {
      id: DEFAULT_HABIT_IDS.meditation,
      name: 'Meditation',
      type: 'duration',
      unit: 'Min.',
      direction: 'increase',
      target: 10,
      target_period: 'day',
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
    const meditationHabit = nextState.habits.find(h => h.system_key === 'meditation' || String(h.name || '').trim().toLowerCase() === 'meditation');
    if (!meditationHabit) {
      nextState.habits.push(createSystemMeditationHabit());
      return nextState;
    }
    meditationHabit.system_key = 'meditation';
    meditationHabit.type = meditationHabit.type || 'duration';
    meditationHabit.unit = meditationHabit.unit || 'Min.';
    meditationHabit.icon = meditationHabit.icon || '🧘';
    meditationHabit.target_period = normalizeHabitTargetPeriod(meditationHabit.target_period || 'day');
    meditationHabit.is_archived = false;
    return nextState;
  }

  function createEmptyDeletedRemoteIds() {
    return SYNC_TABLES.reduce((acc, table) => {
      acc[table] = {};
      return acc;
    }, {});
  }

  function normalizeDeletedRemoteIds(input = {}) {
    const normalized = createEmptyDeletedRemoteIds();
    const cutoffMs = Date.now() - REMOTE_DELETE_TOMBSTONE_TTL_DAYS * DAY_MS;

    const remember = (table, id, meta = {}) => {
      if (!id || !normalized[table]) return;
      const raw = typeof meta === 'string' ? { deleted_at: meta } : (meta && typeof meta === 'object' ? meta : {});
      const deletedAt = raw.deleted_at || raw.at || raw.timestamp || nowIso();
      const deletedMs = new Date(deletedAt).getTime();
      if (Number.isFinite(deletedMs) && deletedMs < cutoffMs) return;
      normalized[table][id] = {
        deleted_at: deletedAt,
        synced_at: raw.synced_at || raw.flushed_at || null
      };
    };

    Object.keys(normalized).forEach(table => {
      const value = input?.[table];
      if (Array.isArray(value)) value.forEach(id => remember(table, id));
      else if (value && typeof value === 'object') Object.entries(value).forEach(([id, meta]) => remember(table, id, meta));
    });
    return normalized;
  }


  function normalizeTask(task = {}) {
    const status = TASK_COLUMNS.some(column => column.status === task.status) ? task.status : 'open';
    const doneArchivedAt = status === 'done' ? validIsoOrNull(task.done_archived_at || task.doneArchivedAt) : null;
    const doneArchiveRank = Number.isFinite(Number(task.done_archive_rank)) ? Number(task.done_archive_rank) : null;
    return {
      ...task,
      status,
      priority: normalizeTaskPriority(task.priority),
      done_archived_at: doneArchivedAt,
      done_archive_rank: doneArchivedAt ? doneArchiveRank : null
    };
  }

  function normalizeTaskIdea(idea = {}) {
    const created = idea.created_at || nowIso();
    const story = Number(idea.story_points ?? idea.storyPoints ?? 2);
    const status = TASK_IDEA_STATUSES.has(String(idea.idea_status || idea.status || '').trim()) ? String(idea.idea_status || idea.status).trim() : 'open';
    const category = TASK_IDEA_CATEGORIES[String(idea.category || '').trim()] ? String(idea.category).trim() : 'focus';
    return {
      ...idea,
      title: String(idea.title || '').trim(),
      description: String(idea.description || '').trim(),
      category,
      story_points: [1, 2, 3, 5, 8].includes(story) ? story : 2,
      priority: normalizeTaskPriority(idea.priority),
      idea_status: status,
      generated_task_id: idea.generated_task_id || idea.task_id || null,
      source_key: idea.source_key || null,
      accepted_at: validIsoOrNull(idea.accepted_at),
      dismissed_at: validIsoOrNull(idea.dismissed_at),
      created_at: created,
      updated_at: idea.updated_at || created
    };
  }

  function normalizeAppointment(appointment = {}) {
    const created = appointment.created_at || nowIso();
    const startsAt = validIsoOrFallback(appointment.starts_at || appointment.start_at || appointment.date || created, created);
    const rawEnd = validIsoOrNull(appointment.ends_at || appointment.end_at);
    const endsAt = rawEnd && new Date(rawEnd).getTime() >= new Date(startsAt).getTime() ? rawEnd : null;
    return {
      ...appointment,
      title: String(appointment.title || '').trim() || 'Termin',
      description: String(appointment.description || appointment.note || '').trim(),
      location: String(appointment.location || '').trim(),
      appointment_type: normalizeAppointmentType(appointment.appointment_type || appointment.type || 'other'),
      starts_at: startsAt,
      ends_at: endsAt,
      created_at: created,
      updated_at: appointment.updated_at || created
    };
  }

  function validIsoOrNull(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function validIsoOrFallback(value, fallback = nowIso()) {
    return validIsoOrNull(value) || validIsoOrNull(fallback) || nowIso();
  }

  function normalizeHabit(habit = {}) {
    const base = { ...habit };
    const defaults = defaultHabitDna(base);
    return {
      ...base,
      target_period: normalizeHabitTargetPeriod(base.target_period || base.goal_period || base.period || 'day'),
      dna_difficulty: normalizeScaleValue(base.dna_difficulty ?? base.difficulty, defaults.difficulty),
      dna_energy: normalizeScaleValue(base.dna_energy ?? base.energy, defaults.energy),
      dna_preferred_time: normalizeHabitPreferredTime(base.dna_preferred_time || base.preferred_time || defaults.preferred_time),
      dna_emotional_hurdle: normalizeHabitHurdle(base.dna_emotional_hurdle || base.emotional_hurdle || defaults.emotional_hurdle),
      dna_trigger: normalizeHabitTrigger(base.dna_trigger || base.trigger || defaults.trigger),
      dna_reward: normalizeHabitReward(base.dna_reward || base.reward || defaults.reward)
    };
  }

  function normalizeScaleValue(value, fallback = 3) {
    const next = Math.round(Number(value || fallback));
    return Math.max(1, Math.min(5, Number.isFinite(next) ? next : fallback));
  }

  function isPhysicalHabit(habit = {}) {
    return ['sport', 'jogging', 'hiking', 'walking', 'pushups', 'standingDesk'].includes(habitIconKey(habit));
  }

  function defaultHabitDna(habit = {}) {
    const type = habit.type || 'number';
    const icon = habitIconKey(habit);
    return {
      difficulty: type === 'boolean' ? 1 : type === 'duration' ? 3 : type === 'weight' ? 2 : 2,
      energy: ['sport', 'jogging', 'hiking', 'walking', 'pushups'].includes(icon) ? 4 : icon === 'meditation' ? 2 : type === 'boolean' ? 2 : 3,
      preferred_time: icon === 'meditation' ? 'evening' : type === 'weight' ? 'morning' : 'flexible',
      emotional_hurdle: icon === 'meditation' ? 'resistance' : ['sport', 'jogging', 'hiking', 'walking', 'pushups'].includes(icon) ? 'tiredness' : 'consistency',
      trigger: icon === 'meditation' ? 'bedtime' : ['sport', 'jogging', 'hiking', 'walking', 'pushups'].includes(icon) ? 'afterwork' : type === 'weight' ? 'wakeup' : 'routine',
      reward: icon === 'meditation' ? 'calm' : ['sport', 'jogging', 'hiking', 'walking', 'pushups'].includes(icon) ? 'energy' : type === 'weight' ? 'clarity' : 'progress'
    };
  }

  function normalizeHabitPreferredTime(value) {
    const key = String(value || '').trim().toLowerCase();
    return HABIT_DNA_TIME_META[key] ? key : 'flexible';
  }

  function normalizeHabitHurdle(value) {
    const key = String(value || '').trim().toLowerCase();
    return HABIT_DNA_HURDLES[key] ? key : 'consistency';
  }

  function normalizeHabitTrigger(value) {
    const key = String(value || '').trim().toLowerCase();
    return HABIT_DNA_TRIGGERS[key] ? key : 'routine';
  }

  function normalizeHabitReward(value) {
    const key = String(value || '').trim().toLowerCase();
    return HABIT_DNA_REWARDS[key] ? key : 'progress';
  }

  function normalizeHabitTargetPeriod(period) {
    const key = String(period || '').trim().toLowerCase();
    return HABIT_TARGET_PERIODS[key] ? key : 'day';
  }

  function habitTargetPeriodMeta(habitOrPeriod) {
    const key = typeof habitOrPeriod === 'string' ? normalizeHabitTargetPeriod(habitOrPeriod) : normalizeHabitTargetPeriod(habitOrPeriod?.target_period);
    return HABIT_TARGET_PERIODS[key] || HABIT_TARGET_PERIODS.day;
  }

  function normalizeTaskPriority(priority) {
    const key = String(priority || '').trim().toLowerCase();
    return TASK_PRIORITIES[key] ? key : 'medium';
  }

  function taskPriorityMeta(taskOrPriority) {
    const key = typeof taskOrPriority === 'string' ? normalizeTaskPriority(taskOrPriority) : normalizeTaskPriority(taskOrPriority?.priority);
    return TASK_PRIORITIES[key] || TASK_PRIORITIES.medium;
  }

  function taskPriorityClass(priority) {
    return `priority-${normalizeTaskPriority(priority)}`;
  }

  function taskIdeaCategoryMeta(category) {
    return TASK_IDEA_CATEGORIES[String(category || '').trim()] || TASK_IDEA_CATEGORIES.focus;
  }

  function storyPointsToEffort(storyPoints) {
    const points = Number(storyPoints || 2);
    if (points <= 1) return 1;
    if (points <= 2) return 2;
    if (points <= 3) return 3;
    if (points <= 5) return 4;
    return 5;
  }

  function compareTaskIdeas(a, b) {
    const statusRank = { open: 0, accepted: 1, dismissed: 2 };
    const ar = statusRank[a.idea_status || 'open'] ?? 3;
    const br = statusRank[b.idea_status || 'open'] ?? 3;
    if (ar !== br) return ar - br;
    const prio = taskPriorityMeta(b).rank - taskPriorityMeta(a).rank;
    if (prio) return prio;
    const story = Number(a.story_points || 2) - Number(b.story_points || 2);
    if (story) return story;
    return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
  }

  function normalizeAppointmentType(type) {
    const key = String(type || '').trim().toLowerCase();
    return APPOINTMENT_TYPES[key] ? key : 'other';
  }

  function appointmentTypeMeta(type) {
    return APPOINTMENT_TYPES[normalizeAppointmentType(type)] || APPOINTMENT_TYPES.other;
  }

  function compareAppointments(a, b) {
    const byStart = new Date(a.starts_at || a.created_at || 0).getTime() - new Date(b.starts_at || b.created_at || 0).getTime();
    if (byStart) return byStart;
    return String(a.title || '').localeCompare(String(b.title || ''), 'de-CH');
  }

  function appointmentOccursOnDate(appointment, key) {
    const startKey = toDateKey(appointment?.starts_at);
    const endKey = toDateKey(appointment?.ends_at || appointment?.starts_at);
    return Boolean(startKey && endKey && startKey <= key && endKey >= key);
  }

  function appointmentsOnDate(key) {
    return state.appointments.filter(appointment => appointmentOccursOnDate(appointment, key)).sort(compareAppointments);
  }

  function isActiveTask(task) {
    return ['open', 'in_progress'].includes(task?.status || 'open');
  }

  function taskSortScore(task) {
    const due = task.due_at ? new Date(task.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    return [-(taskPriorityMeta(task).rank), due, sortDate(task.created_at || task.updated_at)];
  }

  function compareTasks(a, b) {
    const aa = taskSortScore(a);
    const bb = taskSortScore(b);
    for (let i = 0; i < aa.length; i += 1) {
      if (aa[i] !== bb[i]) return aa[i] - bb[i];
    }
    return String(a.title || '').localeCompare(String(b.title || ''), 'de-CH');
  }


  function markRemoteDeleted(table, id, { synced = false } = {}) {
    if (!table || !id) return;
    state.deletedRemoteIds = normalizeDeletedRemoteIds(state.deletedRemoteIds);
    if (!state.deletedRemoteIds[table]) state.deletedRemoteIds[table] = {};
    state.deletedRemoteIds[table][id] = {
      deleted_at: nowIso(),
      synced_at: synced ? nowIso() : null
    };
  }

  function markRemoteDeletedMany(table, ids = [], options = {}) {
    ids.filter(Boolean).forEach(id => markRemoteDeleted(table, id, options));
  }

  function isRemoteDeleted(table, id) {
    return Boolean(id && state.deletedRemoteIds?.[table]?.[id]);
  }

  function hasPendingRemoteDeletes() {
    state.deletedRemoteIds = normalizeDeletedRemoteIds(state.deletedRemoteIds);
    return SYNC_TABLES.some(table => {
      if (table === 'task_ideas' && !remoteTaskIdeasSupported) return false;
      return Object.values(state.deletedRemoteIds?.[table] || {}).some(meta => !meta?.synced_at);
    });
  }

  function dedupeStateCollections(nextState = state) {
    dedupeHabits(nextState);
    dedupeAlcoholLogs(nextState);
    dedupeTaskIdeas(nextState);
    dedupeActivityIdeas(nextState);
  }

  function dedupeActivityIdeas(nextState = state) {
    if (!Array.isArray(nextState.activityIdeas)) nextState.activityIdeas = [];
    const byId = new Map();
    nextState.activityIdeas.map(normalizeLeisureActivity).filter(item => item.id && item.title).forEach(item => {
      const current = byId.get(item.id);
      if (!current || new Date(item.updated_at || item.created_at || 0) >= new Date(current.updated_at || current.created_at || 0)) {
        byId.set(item.id, item);
      }
    });
    nextState.activityIdeas = Array.from(byId.values());
  }

  function dedupeTaskIdeas(nextState = state) {
    if (!Array.isArray(nextState.taskIdeas)) nextState.taskIdeas = [];
    const byId = new Map();
    nextState.taskIdeas.map(normalizeTaskIdea).filter(idea => idea.id && idea.title).forEach(idea => {
      const current = byId.get(idea.id);
      if (!current || new Date(idea.updated_at || idea.created_at || 0) >= new Date(current.updated_at || current.created_at || 0)) {
        byId.set(idea.id, idea);
      }
    });
    nextState.taskIdeas = Array.from(byId.values());
  }

  function isBuiltInDefaultHabit(habit) {
    return Object.values(DEFAULT_HABIT_IDS).includes(habit?.id);
  }

  function dedupeHabits(nextState = state) {
    const byKey = new Map();
    const removedHabitIds = [];
    const normalizedName = habit => String(habit?.name || '').trim().toLowerCase();
    const keyFor = habit => (isBuiltInDefaultHabit(habit) || BUILT_IN_DEFAULT_HABIT_NAMES.has(normalizedName(habit)))
      ? `seed:${normalizedName(habit) || habit.id}`
      : `name:${normalizedName(habit)}`;
    nextState.habits.forEach(habit => {
      const key = keyFor(habit);
      if (!normalizedName(habit)) return;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, habit);
        return;
      }
      const existingTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
      const currentTime = new Date(habit.updated_at || habit.created_at || 0).getTime();
      const keepCurrent = currentTime > existingTime;
      const keep = keepCurrent ? habit : existing;
      const drop = keepCurrent ? existing : habit;
      byKey.set(key, keep);
      removedHabitIds.push(drop.id);
      nextState.habitEntries.forEach(entry => {
        if (entry.habit_id === drop.id) entry.habit_id = keep.id;
      });
    });
    if (removedHabitIds.length) {
      nextState.habits = nextState.habits.filter(h => !removedHabitIds.includes(h.id));
      if (nextState === state) markRemoteDeletedMany('habit_definitions', removedHabitIds);
    }
  }

  function dedupeAlcoholLogs(nextState = state) {
    const byDate = new Map();
    const removedIds = [];
    [...nextState.alcoholLogs].forEach(log => {
      if (!log?.log_date) return;
      const existing = byDate.get(log.log_date);
      if (!existing) {
        byDate.set(log.log_date, log);
        return;
      }
      const existingTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
      const currentTime = new Date(log.updated_at || log.created_at || 0).getTime();
      const keepCurrent = currentTime > existingTime || (!existing.consumed && log.consumed);
      const keep = keepCurrent ? log : existing;
      const drop = keepCurrent ? existing : log;
      byDate.set(log.log_date, keep);
      removedIds.push(drop.id);
    });
    if (removedIds.length) {
      nextState.alcoholLogs = nextState.alcoholLogs.filter(log => !removedIds.includes(log.id));
      if (nextState === state) markRemoteDeletedMany('alcohol_logs', removedIds);
    }
  }

  function saveState({ skipRender = false } = {}) {
    if (state?.deletedRemoteIds) state.deletedRemoteIds = normalizeDeletedRemoteIds(state.deletedRemoteIds);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!skipRender) queueRender();
  }

  function queueRender() {
    if (shouldDeferInteractiveRender()) {
      deferredRenderPending = true;
      return;
    }
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      safeRender();
    });
  }

  function safeRender() {
    if (shouldDeferInteractiveRender()) {
      deferredRenderPending = true;
      renderSyncStatus();
      return;
    }
    render();
  }

  function shouldDeferInteractiveRender() {
    const active = document.activeElement;
    if (!active || active === document.body) return false;
    if (!active.matches?.('input, textarea, select')) return false;
    return Boolean(active.closest('#habitCards, #habitFormPanel, #taskFormPanel, #taskIdeasPanel, #appointmentFormPanel, #smokeHistory, #historyModal, #coachModal'));
  }

  function flushDeferredRender() {
    if (!deferredRenderPending) return;
    setTimeout(() => {
      if (shouldDeferInteractiveRender()) return;
      deferredRenderPending = false;
      render();
    }, 180);
  }

  function collectHabitInputDrafts() {
    const drafts = new Map();
    $$('#habitCards input[id^="habit-input-"]').forEach(input => {
      drafts.set(input.id, input.value);
    });
    return drafts;
  }

  function loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
      return { email: stored.email || '' };
    } catch {
      return { email: '' };
    }
  }

  function saveSettingsToStorage() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function defaultLeisureFilters() {
    return { mood: 'any', duration: 'any', people: 'any', setting: 'any', budget: 'any', energy: 'any', transport: 'any', query: '' };
  }

  function loadLeisureFilters() {
    try {
      return { ...defaultLeisureFilters(), ...(JSON.parse(localStorage.getItem(LEISURE_FILTER_KEY)) || {}) };
    } catch {
      return defaultLeisureFilters();
    }
  }

  function saveLeisureFilters() {
    localStorage.setItem(LEISURE_FILTER_KEY, JSON.stringify(leisureFilters));
  }

  async function loadLeisureCatalog() {
    try {
      const response = await fetch(ACTIVITY_CATALOG_URL, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      leisureSeedCatalog = Array.isArray(payload?.items) ? payload.items.map(normalizeLeisureActivity).filter(item => item.id && item.title) : [];
      if (!state.activityIdeas?.length && leisureSeedCatalog.length) {
        state.activityIdeas = leisureSeedCatalog.map(item => ({ ...item, synced: true }));
        saveState({ skipRender: true });
      }
      refreshLeisureCatalogFromState();
      leisureCatalogError = null;
    } catch (error) {
      refreshLeisureCatalogFromState();
      leisureCatalogError = state.activityIdeas?.length ? null : error;
      if (!state.activityIdeas?.length) console.warn('Freizeit-Katalog konnte nicht geladen werden.', error);
    } finally {
      leisureCatalogLoaded = true;
      renderLeisureFinder();
    }
  }

  function refreshLeisureCatalogFromState() {
    leisureCatalog = (state.activityIdeas || [])
      .map(normalizeLeisureActivity)
      .filter(item => item.id && item.title && !item.is_archived);
  }

  function applyTheme() {
    document.body.classList.toggle('light', localStorage.getItem(THEME_KEY) === 'light');
  }

  function fillSettingsForm() {
    if (els.settingsForm?.email) els.settingsForm.email.value = settings.email || '';
    if (els.sqlPreview) els.sqlPreview.textContent = window.HABITFLOW_SUPABASE_SQL || 'supabase.sql konnte nicht geladen werden.';
  }

  function showScreen(screen, options = {}) {
    const targetScreen = screen || 'dashboard';
    const shouldRefresh = options.refresh !== false;
    closeMobileQuickAdd();
    els.navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.target === targetScreen));
    els.screens.forEach(view => {
      const isActive = view.dataset.screen === targetScreen;
      view.classList.toggle('active', isActive);
      view.hidden = !isActive;
      view.style.display = isActive ? '' : 'none';
      view.setAttribute('aria-hidden', String(!isActive));
      if ('inert' in view) view.inert = !isActive;
    });
    document.body.dataset.activeScreen = targetScreen;
    document.documentElement.dataset.activeScreen = targetScreen;
    if (!shouldRefresh) return;
    if (targetScreen === 'calendar') {
      renderCalendar();
      renderDayDetails();
    }
    if (targetScreen === 'dashboard') {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
        renderCharts();
      });
    }
  }

  function openHabitForm() {
    habitFormOpen = true;
    syncHabitFormPanel();
    requestAnimationFrame(() => els.habitForm?.elements?.name?.focus({ preventScroll: true }));
  }

  function closeHabitForm({ clearForm = false } = {}) {
    if (clearForm || editingHabitId) resetHabitFormMode({ clearForm });
    habitFormOpen = false;
    syncHabitFormPanel();
  }

  function syncHabitFormPanel() {
    if (!els.habitFormPanel) return;
    els.habitFormPanel.classList.toggle('hidden', !habitFormOpen);
    els.habitFormToggleBtn?.classList.toggle('is-active', habitFormOpen);
    els.habitFormToggleBtn?.setAttribute('aria-expanded', String(habitFormOpen));
  }

  function openTaskForm() {
    taskFormOpen = true;
    syncTaskFormPanel();
    requestAnimationFrame(() => els.taskForm?.elements?.title?.focus({ preventScroll: true }));
  }

  function closeTaskForm({ clearForm = false } = {}) {
    if (clearForm || editingTaskId) resetTaskFormMode({ clearForm });
    taskFormOpen = false;
    syncTaskFormPanel();
  }

  function toggleTaskForm() {
    if (taskFormOpen) {
      closeTaskForm({ clearForm: !editingTaskId });
      return;
    }
    openTaskForm();
  }

  function syncTaskFormPanel() {
    if (!els.taskFormPanel) return;
    els.taskFormPanel.classList.toggle('hidden', !taskFormOpen);
    els.taskFormToggleBtn?.classList.toggle('is-active', taskFormOpen);
    els.taskFormToggleBtn?.setAttribute('aria-expanded', String(taskFormOpen));
    els.taskFormToggleBtn?.setAttribute('aria-label', taskFormOpen ? 'Aufgaben-Formular schliessen' : 'Aufgaben-Formular öffnen');
    els.taskFormToggleBtn?.setAttribute('title', taskFormOpen ? 'Aufgaben-Formular schliessen' : 'Aufgabe anlegen');
  }

  function toggleTaskIdeas() {
    taskIdeasOpen = !taskIdeasOpen;
    syncTaskUtilityPanels();
    if (taskIdeasOpen) requestAnimationFrame(() => els.taskIdeasPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function toggleTaskWeekly() {
    taskWeeklyOpen = !taskWeeklyOpen;
    if (taskWeeklyOpen && !taskWeeklyCursor) taskWeeklyCursor = startOfWeekDate(new Date());
    syncTaskUtilityPanels();
    if (taskWeeklyOpen) requestAnimationFrame(() => els.taskWeeklyPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function moveTaskPlanningWeek(delta, { reset = false } = {}) {
    const base = reset ? new Date() : new Date(taskWeeklyCursor || startOfWeekDate(new Date()));
    const next = startOfWeekDate(base);
    if (!reset) next.setDate(next.getDate() + (Number(delta) || 0) * 7);
    taskWeeklyCursor = next;
    taskWeeklyOpen = true;
    syncTaskUtilityPanels();
    renderTaskWeeklyPlanning();
  }

  function toggleTaskBacklog() {
    taskBacklogOpen = !taskBacklogOpen;
    syncTaskUtilityPanels();
    if (taskBacklogOpen) requestAnimationFrame(() => els.taskBacklogPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function toggleTaskArchive() {
    taskArchiveOpen = !taskArchiveOpen;
    syncTaskUtilityPanels();
    if (taskArchiveOpen) requestAnimationFrame(() => els.taskArchivePanel?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function toggleTaskTimeline() {
    taskTimelineOpen = !taskTimelineOpen;
    syncTaskUtilityPanels();
    if (taskTimelineOpen) requestAnimationFrame(() => els.taskTimelinePanel?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function syncTaskUtilityPanels() {
    els.taskIdeasPanel?.classList.toggle('hidden', !taskIdeasOpen);
    els.taskIdeasToggleBtn?.classList.toggle('is-active', taskIdeasOpen);
    els.taskIdeasToggleBtn?.setAttribute('aria-expanded', String(taskIdeasOpen));
    els.taskWeeklyPanel?.classList.toggle('hidden', !taskWeeklyOpen);
    els.taskWeeklyToggleBtn?.classList.toggle('is-active', taskWeeklyOpen);
    els.taskWeeklyToggleBtn?.setAttribute('aria-expanded', String(taskWeeklyOpen));
    els.taskBacklogPanel?.classList.toggle('hidden', !taskBacklogOpen);
    els.taskBacklogToggleBtn?.classList.toggle('is-active', taskBacklogOpen);
    els.taskBacklogToggleBtn?.setAttribute('aria-expanded', String(taskBacklogOpen));
    els.taskArchivePanel?.classList.toggle('hidden', !taskArchiveOpen);
    els.taskArchiveToggleBtn?.classList.toggle('is-active', taskArchiveOpen);
    els.taskArchiveToggleBtn?.setAttribute('aria-expanded', String(taskArchiveOpen));
    els.taskTimelinePanel?.classList.toggle('hidden', !taskTimelineOpen);
    els.taskTimelineToggleBtn?.classList.toggle('is-active', taskTimelineOpen);
    els.taskTimelineToggleBtn?.setAttribute('aria-expanded', String(taskTimelineOpen));
  }

  function openAppointmentForm({ dateKey = selectedCalendarDate, forceNew = false } = {}) {
    appointmentFormOpen = true;
    if (forceNew || !editingAppointmentId) resetAppointmentFormMode({ clearForm: true, dateKey });
    syncAppointmentFormPanel();
    showScreen('calendar');
    requestAnimationFrame(() => els.appointmentForm?.elements?.title?.focus({ preventScroll: true }));
  }

  function closeAppointmentForm({ clearForm = true } = {}) {
    appointmentFormOpen = false;
    if (clearForm) resetAppointmentFormMode({ clearForm: true });
    syncAppointmentFormPanel();
  }

  function syncAppointmentFormPanel() {
    if (!els.appointmentFormPanel) return;
    els.appointmentFormPanel.classList.toggle('hidden', !appointmentFormOpen);
    els.appointmentFormToggleBtn?.classList.toggle('is-active', appointmentFormOpen);
    els.appointmentFormToggleBtn?.setAttribute('aria-expanded', String(appointmentFormOpen));
  }


  function openMorningRoutineModal() {
    if (!els.morningRoutineModal) return;
    els.morningRoutineModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    renderMorningRoutine();
    requestAnimationFrame(() => els.morningRoutineModal.querySelector('[data-action="start-morning-routine"], [data-action="next-morning-step"], [data-action="finish-morning-routine"], .coach-close-btn')?.focus({ preventScroll: true }));
  }

  function closeMorningRoutineModal() {
    if (!els.morningRoutineModal) return;
    els.morningRoutineModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }


  function openCoachModal() {
    if (!els.coachModal) return;
    els.coachModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    renderCoach();
    requestAnimationFrame(() => els.coachUrgeLevel?.focus({ preventScroll: true }));
  }

  function closeCoachModal() {
    if (!els.coachModal) return;
    els.coachModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  function render() {
    renderSection('timers', renderTimers);
    renderSection('dashboard', renderDashboard);
    renderSection('smoking', renderSmoking);
    renderSection('meditation', renderMeditation);
    renderSection('habits', renderHabits);
    renderSection('tasks', renderTasks);
    renderSection('coach', renderCoach);
    renderSection('calendar', renderCalendar);
    renderSection('day-details', renderDayDetails);
    renderSection('history-modal', renderHistoryModal);
    renderSection('sync-status', renderSyncStatus);
  }

  function renderSection(name, renderFn) {
    try {
      renderFn();
    } catch (error) {
      console.error(`Renderfehler in ${name}`, error);
    }
  }

  function renderTimers() {
    const last = getLastCigarette();
    const pauseText = last ? formatDuration((Date.now() - new Date(last.smoked_at).getTime()) / 60000) : '–';
    els.currentPause.textContent = pauseText;
    els.smokePauseLive.textContent = pauseText;
    els.smokePauseHint.textContent = last ? 'Pause läuft seit letzter Erfassung · Verlauf per Button öffnen' : 'Noch kein Eintrag vorhanden';
  }


  function legacyMorningRoutineSourceId(key = toDateKey(new Date())) {
    return `morning-routine-${key}`;
  }

  function todayMorningRoutineSourceId(key = toDateKey(new Date())) {
    const compactDate = String(key || toDateKey(new Date())).replace(/\D/g, '').slice(0, 8).padEnd(8, '0');
    return `00000000-0000-4000-8000-0000${compactDate}`;
  }

  function isMorningRoutineReason(reason = '') {
    return String(reason || '').trim().toLowerCase().startsWith('morgenroutine');
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
  }

  function normalizeMorningRoutineLedgerPoint(point = {}) {
    if (point.source_type !== 'bonus' || !isMorningRoutineReason(point.reason)) return point;
    const completedKey = toDateKey(point.earned_at || point.created_at || new Date());
    if (!completedKey) return point;
    const canonicalId = todayMorningRoutineSourceId(completedKey);
    if (point.source_id === canonicalId) return point;
    return { ...point, source_id: canonicalId, synced: false };
  }

  function isMorningRoutinePoint(point = {}, key = toDateKey(new Date())) {
    if (point.source_type !== 'bonus') return false;
    const canonicalId = todayMorningRoutineSourceId(key);
    const legacyId = legacyMorningRoutineSourceId(key);
    if (point.source_id === canonicalId || point.source_id === legacyId) return true;
    return isMorningRoutineReason(point.reason) && toDateKey(point.earned_at || point.created_at) === key;
  }

  function remoteLedgerSourceId(point = {}) {
    return isUuid(point.source_id) ? point.source_id : null;
  }

  function dateHash(value = toDateKey(new Date())) {
    return String(value || '').split('').reduce((hash, char) => hash + char.charCodeAt(0), 0);
  }

  function currentMorningRoutineOffset() {
    return Math.max(0, Number(localStorage.getItem(MORNING_ROUTINE_VARIANT_KEY) || 0));
  }

  function setMorningRoutineOffset(offset) {
    localStorage.setItem(MORNING_ROUTINE_VARIANT_KEY, String(Math.max(0, Number(offset || 0))));
  }

  function getMorningRoutineByKey(key) {
    return MORNING_ROUTINES.find(routine => routine.key === key) || MORNING_ROUTINES[0];
  }

  function getMorningRoutineForToday() {
    const todayKey = toDateKey(new Date());
    if (morningRoutineSession?.dateKey === todayKey && morningRoutineSession.routineKey) {
      return getMorningRoutineByKey(morningRoutineSession.routineKey);
    }
    const index = (dateHash(todayKey) + currentMorningRoutineOffset()) % MORNING_ROUTINES.length;
    return MORNING_ROUTINES[index];
  }

  function loadMorningRoutineSession() {
    try {
      const parsed = JSON.parse(localStorage.getItem(MORNING_ROUTINE_SESSION_KEY) || '{}');
      return {
        dateKey: parsed.dateKey || '',
        routineKey: parsed.routineKey || '',
        currentStep: Math.max(0, Math.min(4, Number(parsed.currentStep || 0))),
        startedAt: parsed.startedAt || null
      };
    } catch {
      return { dateKey: '', routineKey: '', currentStep: 0, startedAt: null };
    }
  }

  function saveMorningRoutineSession() {
    localStorage.setItem(MORNING_ROUTINE_SESSION_KEY, JSON.stringify(morningRoutineSession));
  }

  function morningRoutineCompletedLog(key = toDateKey(new Date())) {
    return state.morningRoutineLogs.find(log => log.date_key === key) ||
      state.pointsLedger.find(point => isMorningRoutinePoint(point, key)) ||
      null;
  }

  function morningRoutineProgressPercent(routine, currentStep) {
    const steps = routine?.steps || [];
    if (!steps.length) return 0;
    return Math.min(100, Math.round((Math.max(0, currentStep) / steps.length) * 100));
  }

  function morningRoutineTotalMinutes(routine) {
    return sum((routine?.steps || []).map(step => Number(step.minutes || 0))) || 15;
  }

  function renderMorningRoutine() {
    if (!els.morningRoutineCard) return;
    const todayKey = toDateKey(new Date());
    const completed = Boolean(morningRoutineCompletedLog(todayKey));
    const routine = getMorningRoutineForToday();
    const active = morningRoutineSession.dateKey === todayKey && morningRoutineSession.startedAt && !completed;
    const stepIndex = active ? Math.max(0, Math.min(routine.steps.length - 1, Number(morningRoutineSession.currentStep || 0))) : 0;
    const currentStep = routine.steps[stepIndex] || routine.steps[0];
    const totalMinutes = morningRoutineTotalMinutes(routine);
    const completedSteps = active ? stepIndex : completed ? routine.steps.length : 0;
    const progress = completed ? 100 : morningRoutineProgressPercent(routine, completedSteps);
    const cta = completed
      ? `<button class="pill secondary" type="button" data-action="shuffle-morning-routine">Morgen variieren</button>`
      : active
        ? `<button class="pill primary" type="button" data-action="${stepIndex >= routine.steps.length - 1 ? 'finish-morning-routine' : 'next-morning-step'}">${stepIndex >= routine.steps.length - 1 ? 'Abschliessen · +50' : 'Nächster Schritt'}</button><button class="pill secondary" type="button" data-action="reset-morning-routine">Neu starten</button>`
        : `<button class="pill primary" type="button" data-action="start-morning-routine">15 Min. starten</button><button class="pill secondary" type="button" data-action="shuffle-morning-routine">Andere Routine</button>`;

    els.morningRoutineCard.innerHTML = `<div class="morning-routine-shell ${active ? 'is-active' : ''} ${completed ? 'is-complete' : ''}">
      <div class="morning-routine-main">
        <div class="morning-routine-copy">
          <p class="eyebrow">Morgenroutine · 15 Min.</p>
          <h3>${escapeHtml(routine.title)}</h3>
          <p>${escapeHtml(routine.subtitle)}</p>
          <div class="morning-routine-meta">
            <span>${escapeHtml(routine.mood)}</span>
            <span>${totalMinutes} Minuten</span>
            <span>${completed ? '+50 Punkte geholt' : '+50 Punkte bei Abschluss'}</span>
          </div>
        </div>
        <div class="morning-routine-score">
          <strong>${completed ? '+50' : '15m'}</strong>
          <span>${completed ? 'erledigt' : 'Routine'}</span>
        </div>
      </div>

      <div class="morning-routine-progress" aria-hidden="true"><i style="width:${progress}%"></i></div>

      <div class="morning-routine-focus-card">
        <span class="history-open-icon">${svgIcon(completed ? 'check' : currentStep.icon, 'ui-icon')}</span>
        <div>
          <small>${completed ? 'Heute abgeschlossen' : active ? `Schritt ${stepIndex + 1}/${routine.steps.length} · ${currentStep.minutes} Min.` : 'Bereit zum Start'}</small>
          <strong>${completed ? 'Starker Start. Körper und Fokus aktiviert.' : active ? escapeHtml(currentStep.title) : 'Eine kurze Routine, die jeden Tag frisch variiert.'}</strong>
          <p>${completed ? 'Die 50 Punkte sind gespeichert. Morgen kommt automatisch wieder eine andere Variante.' : active ? escapeHtml(currentStep.body) : 'Wasser, Mobility, Mini-Fitness, Fokus und Abschluss – bewusst klein, aber wirksam.'}</p>
        </div>
      </div>

      <div class="morning-routine-steps">
        ${routine.steps.map((step, index) => `<article class="${completed || (active && index < stepIndex) ? 'is-done' : active && index === stepIndex ? 'is-current' : ''}">
          <span>${svgIcon(step.icon, 'ui-icon')}</span>
          <div><small>${step.minutes} Min.</small><strong>${escapeHtml(step.title)}</strong></div>
        </article>`).join('')}
      </div>

      <div class="morning-routine-actions">${cta}</div>
    </div>`;
  }

  function openMorningRoutineFromHero() {
    openMorningRoutineModal();
  }


  function startMorningRoutine() {
    const todayKey = toDateKey(new Date());
    if (morningRoutineCompletedLog(todayKey)) {
      toast('Morgenroutine heute bereits abgeschlossen.');
      return;
    }
    const routine = getMorningRoutineForToday();
    morningRoutineSession = {
      dateKey: todayKey,
      routineKey: routine.key,
      currentStep: 0,
      startedAt: nowIso()
    };
    saveMorningRoutineSession();
    renderMorningRoutine();
    toast(`${routine.title} gestartet`);
  }

  function advanceMorningRoutine() {
    const todayKey = toDateKey(new Date());
    if (morningRoutineCompletedLog(todayKey)) return;
    if (morningRoutineSession.dateKey !== todayKey || !morningRoutineSession.startedAt) return startMorningRoutine();
    const routine = getMorningRoutineByKey(morningRoutineSession.routineKey);
    const nextStep = Math.min(routine.steps.length - 1, Number(morningRoutineSession.currentStep || 0) + 1);
    morningRoutineSession.currentStep = nextStep;
    saveMorningRoutineSession();
    renderMorningRoutine();
    toast(nextStep >= routine.steps.length - 1 ? 'Letzter Schritt bereit' : 'Nächster Routine-Schritt');
  }

  function finishMorningRoutine() {
    const todayKey = toDateKey(new Date());
    if (morningRoutineCompletedLog(todayKey)) {
      toast('Morgenroutine heute bereits abgeschlossen.');
      return;
    }
    if (morningRoutineSession.dateKey !== todayKey || !morningRoutineSession.startedAt) return startMorningRoutine();
    const routine = getMorningRoutineByKey(morningRoutineSession.routineKey);
    const completedAt = nowIso();
    state.morningRoutineLogs.push({
      id: uid(),
      date_key: todayKey,
      routine_key: routine.key,
      completed_at: completedAt,
      created_at: completedAt,
      updated_at: completedAt,
      synced: false
    });
    addPoints('bonus', todayMorningRoutineSourceId(todayKey), 50, `Morgenroutine: ${routine.title}`, completedAt);
    morningRoutineSession.currentStep = routine.steps.length;
    saveMorningRoutineSession();
    saveState();
    toast('Morgenroutine abgeschlossen · +50 Punkte');
    syncWithSupabase({ silent: true, pullFirst: false });
  }

  function shuffleMorningRoutine() {
    const todayKey = toDateKey(new Date());
    if (morningRoutineSession.dateKey === todayKey && morningRoutineSession.startedAt && !morningRoutineCompletedLog(todayKey)) {
      toast('Laufende Routine zuerst abschliessen oder neu starten.');
      return;
    }
    const nextOffset = currentMorningRoutineOffset() + 1;
    setMorningRoutineOffset(nextOffset);
    const nextRoutine = MORNING_ROUTINES[(dateHash(todayKey) + nextOffset) % MORNING_ROUTINES.length];
    morningRoutineSession = { dateKey: todayKey, routineKey: nextRoutine.key, currentStep: 0, startedAt: null };
    saveMorningRoutineSession();
    renderMorningRoutine();
    toast('Neue Morgenroutine geladen');
  }

  function resetMorningRoutineSession() {
    const todayKey = toDateKey(new Date());
    if (morningRoutineCompletedLog(todayKey)) return;
    const routine = getMorningRoutineForToday();
    morningRoutineSession = { dateKey: todayKey, routineKey: routine.key, currentStep: 0, startedAt: nowIso() };
    saveMorningRoutineSession();
    renderMorningRoutine();
    toast('Morgenroutine neu gestartet');
  }

  function arrangeDashboardKpis(isMobile = window.matchMedia('(max-width: 760px)').matches) {
    const strip = document.querySelector('#screen-dashboard .dashboard-kpi-strip');
    const heroCopy = document.querySelector('#screen-dashboard .hero-copy');
    const heroCard = document.querySelector('#screen-dashboard .hero-card--premium');
    if (!strip || !heroCopy || !heroCard) return;
    if (isMobile) {
      if (strip.parentElement !== heroCopy) heroCopy.appendChild(strip);
      return;
    }
    if (strip.parentElement === heroCopy) heroCard.insertAdjacentElement('afterend', strip);
  }

  function closeMobileQuickAdd() {
    const quickAdd = document.getElementById('mobileQuickAdd');
    if (quickAdd) quickAdd.open = false;
  }

  function setupMobileResponsiveSections() {
    const dashboardSections = [...document.querySelectorAll('#screen-dashboard .mobile-dashboard-section')];
    const consumptionSections = [...document.querySelectorAll('#screen-smoking .mobile-consumption-section')];
    const sections = [...dashboardSections, ...consumptionSections];
    if (!sections.length) return;
    const apply = () => {
      const isMobile = window.matchMedia('(max-width: 760px)').matches;
      arrangeDashboardKpis(isMobile);
      sections.forEach(section => {
        if (isMobile) {
          if (!section.dataset.mobilePrepared) {
            section.open = section.hasAttribute('data-mobile-open');
            section.dataset.mobilePrepared = 'true';
          }
        } else {
          section.open = true;
          delete section.dataset.mobilePrepared;
        }
      });
    };
    apply();
    window.addEventListener('resize', apply, { passive: true });
    sections.forEach(section => {
      section.addEventListener('toggle', () => {
        if (section.open) requestAnimationFrame(() => {
          window.dispatchEvent(new Event('resize'));
          renderCharts();
        });
      });
    });
  }


  function setupTaskTimelineScroller() {
    if (!els.taskTimeline) return;
    els.taskTimeline.addEventListener('scroll', () => {
      taskTimelineScrollLeft = els.taskTimeline.scrollLeft;
    }, { passive: true });

    els.taskTimeline.addEventListener('pointerdown', event => {
      if (event.button && event.button !== 0) return;
      if (!els.taskTimeline || els.taskTimeline.scrollWidth <= els.taskTimeline.clientWidth) return;
      taskTimelineDragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startScrollLeft: els.taskTimeline.scrollLeft,
        active: false
      };
      els.taskTimeline.classList.add('is-grab-ready');
    });

    window.addEventListener('pointermove', event => {
      if (!taskTimelineDragState || !els.taskTimeline) return;
      const dx = event.clientX - taskTimelineDragState.startX;
      const dy = event.clientY - taskTimelineDragState.startY;
      if (!taskTimelineDragState.active && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        taskTimelineDragState.active = true;
        els.taskTimeline.classList.add('is-dragging');
      }
      if (!taskTimelineDragState.active) return;
      event.preventDefault();
      els.taskTimeline.scrollLeft = taskTimelineDragState.startScrollLeft - dx;
    }, { passive: false });

    const endDrag = () => {
      if (!taskTimelineDragState) return;
      taskTimelineScrollLeft = els.taskTimeline?.scrollLeft ?? taskTimelineScrollLeft;
      taskTimelineDragState = null;
      els.taskTimeline?.classList.remove('is-grab-ready', 'is-dragging');
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
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
    els.openTasksCount.textContent = state.tasks.filter(isActiveTask).length;
    const score = calculateDailyScore(todayKey);
    if (els.dailyScore) els.dailyScore.textContent = `${score.score}%`;
    if (els.dailyScoreHint) els.dailyScoreHint.textContent = score.label;

    els.dashboardTitle.textContent = 'Dein Fortschritt auf einen Blick';
    els.dashboardSubtitle.textContent = habitLogsToday || completedToday || todayCount
      ? `${habitLogsToday} Habit-Log${habitLogsToday === 1 ? '' : 's'}, ${completedToday} erledigte Aufgabe${completedToday === 1 ? '' : 'n'} und ${todayCount} Zigarette${todayCount === 1 ? '' : 'n'} heute.`
      : 'Wähle eine Auswertung, erfasse kleine Schritte und halte deine wichtigsten Muster sichtbar.';

    renderMorningRoutine();
    renderTrendOptions();
    renderInsights();
    renderWeeklyReview();
    renderBehaviorIntelligence();
    renderHabitHeatmap();
    renderCharts();
  }

  function renderInsights() {
    const last7 = daysBack(7);
    const cigarettes7 = state.cigarettes.filter(c => last7.includes(toDateKey(c.smoked_at))).length;
    const alcoholUnits7 = state.alcoholUnits.filter(unit => last7.includes(toDateKey(unit.occurred_at))).length;
    const completed7 = state.tasks.filter(t => t.status === 'done' && last7.includes(toDateKey(t.completed_at || t.updated_at || t.created_at))).length;
    const activeTasks7 = state.tasks.filter(isActiveTask).length;
    const bestPause = bestPauseMinutes();
    const bestDaytimePause = bestDaytimePauseMinutes();
    const pattern = detectPrimaryPattern();
    const trigger = topSmokeTrigger(14);
    const score = calculateDailyScore(toDateKey(new Date()));
    const insights = [
      { title: 'Tages-Score', body: `${score.score}% heute · ${score.label}. Der Score kombiniert Rauchabstand, Konsum, Alkohol, Tasks und Habit-Rhythmus.` },
      { title: 'Muster-Erkennung', body: pattern.body },
      { title: 'Trigger-Analyse', body: trigger ? `${trigger.label} ist dein häufigster geloggter Trigger in den letzten 14 Tagen (${trigger.count}×).` : 'Noch keine Trigger nach Zigaretten geloggt. Nach dem nächsten Eintrag fragt die App kurz und ruhig nach dem Auslöser.' },
      { title: 'Task-Momentum', body: `${completed7} Aufgabe(n) diese Woche abgeschlossen, ${activeTasks7} aktiv. Priorität und Kanban-Status helfen beim Fokus.` },
      { title: 'Alkohol-Kontext', body: alcoholUnits7 ? `${alcoholUnits7} Alkohol-Einheit(en) in 7 Tagen. Vergleiche diese Zeitpunkte bewusst mit Rauch-Peaks.` : 'Keine Alkohol-Einheiten in den letzten 7 Tagen getrackt.' },
      { title: 'Beste Pause', body: bestPause ? `Längste Pause bisher: ${formatDuration(bestPause)}. Das ist dein aktueller Highscore.` : 'Noch keine Intervall-Daten vorhanden.' },
      { title: 'Beste Tagespause', body: bestDaytimePause ? `Längste Pause innerhalb eines Tages: ${formatDuration(bestDaytimePause)}. Übernacht-Pausen zählen hier bewusst nicht.` : 'Noch keine Tagespause zwischen zwei Zigaretten vorhanden.' }
    ];
    els.insightsGrid.innerHTML = insights.map(item => `<article class="insight-card"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p></article>`).join('');
  }

  function renderWeeklyReview() {
    if (!els.weeklyReview) return;
    const review = buildWeeklyReview();
    els.weeklyReview.innerHTML = `<div class="weekly-review-head"><div><p class="eyebrow">Wochenreview</p><h3>${escapeHtml(review.title)}</h3></div><span class="badge ${review.score >= 70 ? '' : 'muted'}">${review.score}%</span></div>
      <div class="weekly-review-grid">
        ${review.items.map(item => `<article><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong><p>${escapeHtml(item.text)}</p></article>`).join('')}
      </div>
      <div class="coach-callout"><b>Empfehlung nächste Woche:</b> ${escapeHtml(review.recommendation)}</div>`;
  }


  function calculateDailyScore(key) {
    const cigarettes = cigarettesOnDate(key).length;
    const alcohol = alcoholUnitsOnDate(key).length;
    const tasksDone = state.tasks.filter(t => t.status === 'done' && toDateKey(t.completed_at || t.updated_at || t.created_at) === key).length;
    const habitLogs = state.habitEntries.filter(e => toDateKey(e.occurred_at) === key).length;
    const last = getLastCigarette();
    const pauseHours = last ? Math.max(0, (Date.now() - new Date(last.smoked_at).getTime()) / 36e5) : 8;
    let score = 72;
    score += Math.min(18, pauseHours * 2.2);
    score += Math.min(14, habitLogs * 4);
    score += Math.min(12, tasksDone * 5);
    score -= Math.min(36, cigarettes * 8);
    score -= Math.min(18, alcohol * 5);
    score = Math.max(0, Math.min(100, Math.round(score)));
    const label = score >= 82 ? 'starker Tag' : score >= 62 ? 'stabil' : score >= 42 ? 'achtsam bleiben' : 'Akutmodus empfohlen';
    return { score, label };
  }

  function detectPrimaryPattern() {
    const keys = daysBack(14);
    const alcoholDays = new Set(state.alcoholUnits.filter(u => keys.includes(toDateKey(u.occurred_at))).map(u => toDateKey(u.occurred_at)));
    const byHour = new Map();
    state.cigarettes.filter(c => keys.includes(toDateKey(c.smoked_at))).forEach(c => {
      const h = new Date(c.smoked_at).getHours();
      const bucket = h < 11 ? 'Morgen' : h < 16 ? 'Mittag' : h < 21 ? 'Abend' : 'Spätabend';
      byHour.set(bucket, (byHour.get(bucket) || 0) + 1);
    });
    const alcoholSmoke = state.cigarettes.filter(c => alcoholDays.has(toDateKey(c.smoked_at))).length;
    const topTime = [...byHour.entries()].sort((a,b)=>b[1]-a[1])[0];
    if (alcoholSmoke >= 3) return { body: `Alkohol-Tage erzeugen aktuell auffällig viele Rauchmomente (${alcoholSmoke} in 14 Tagen). Plane vor dem ersten Drink einen Delay-Schritt.` };
    if (topTime) return { body: `${topTime[0]} ist dein stärkstes Rauchfenster (${topTime[1]}× in 14 Tagen). Der Coach priorisiert dort kurze Unterbrechungen.` };
    return { body: 'Noch zu wenig Verlauf für robuste Muster. Die App sammelt weiter lokal und via Supabase synchronisiert.' };
  }

  function topSmokeTrigger(days = 14) {
    const keys = daysBack(days);
    const counts = new Map();
    state.cigarettes.filter(c => keys.includes(toDateKey(c.smoked_at))).forEach(c => {
      const match = String(c.note || '').match(/trigger:([a-z_]+)/);
      const key = match?.[1];
      if (COACH_TRIGGER_META[key]) counts.set(key, (counts.get(key) || 0) + 1);
    });
    const top = [...counts.entries()].sort((a,b)=>b[1]-a[1])[0];
    return top ? { key: top[0], count: top[1], label: COACH_TRIGGER_META[top[0]].label } : null;
  }

  function buildWeeklyReview() {
    const keys = daysBack(7);
    const cigs = state.cigarettes.filter(c => keys.includes(toDateKey(c.smoked_at)));
    const routineDays = keys.filter(key => Boolean(morningRoutineCompletedLog(key))).length;
    const tasks = state.tasks.filter(t => t.status === 'done' && keys.includes(toDateKey(t.completed_at || t.updated_at || t.created_at)));
    const habits = state.habitEntries.filter(e => keys.includes(toDateKey(e.occurred_at)));
    const best = bestPauseMinutes();
    const alcoholDays = new Set(state.alcoholUnits.filter(u => keys.includes(toDateKey(u.occurred_at))).map(u => toDateKey(u.occurred_at))).size;
    const score = Math.round(sum(keys.map(k => calculateDailyScore(k).score)) / Math.max(1, keys.length));
    const pattern = detectPrimaryPattern().body;
    return {
      score,
      title: score >= 70 ? 'Solide Woche mit sichtbarem Momentum' : 'Woche mit klaren Hebeln',
      items: [
        { label: 'Rauchen', value: `${cigs.length}×`, text: best ? `Beste Pause ${formatDuration(best)}.` : 'Noch kein Pausen-Highscore.' },
        { label: 'Aufgaben', value: `${tasks.length} erledigt`, text: tasks.length ? 'Task-Momentum wirkt als Schutzfaktor.' : 'Eine kleine Aufgabe pro Tag würde den Score stabilisieren.' },
        { label: 'Habits', value: `${habits.length} Logs`, text: 'Zielperioden werden neu pro Tag, Woche oder Monat gewertet.' },
        { label: 'Routinen', value: `${routineDays}×`, text: routineDays ? 'Morgenroutinen geben stabile Bonuspunkte ohne zusätzliche Aufgabe.' : 'Eine Morgenroutine pro Woche würde den Startanker stärken.' },
        { label: 'Alkohol', value: `${alcoholDays} Tage`, text: alcoholDays ? 'Alkohol bleibt ein wichtiger Risikokontext.' : 'Kein Alkohol-Kontext in der Wochenansicht.' }
      ],
      recommendation: pattern
    };
  }


  function renderBehaviorIntelligence() {
    if (!els.nextBestActionCard) return;
    const forecast = buildUrgeForecast();
    const action = buildNextBestAction(forecast);
    const keystone = buildKeystoneHabitInsight();
    const recovery = buildRecoveryModeInsight();
    const experiment = buildExperimentInsight();
    const partyPlan = buildPartyPlanInsight();

    if (els.urgeForecastBadge) {
      els.urgeForecastBadge.className = `badge ${forecast.risk >= 72 ? 'danger-badge' : forecast.risk >= 48 ? 'warning-badge' : 'muted'}`;
      els.urgeForecastBadge.textContent = `${forecast.risk}% Risiko`;
    }

    els.nextBestActionCard.innerHTML = `<div class="next-action-copy"><p class="eyebrow">Next Best Action</p><h3>${escapeHtml(action.title)}</h3><p>${escapeHtml(action.body)}</p><small>${escapeHtml(action.reason)}</small></div><button class="pill primary" type="button" data-action="next-best-action" data-next-action="${escapeHtml(action.action)}">${escapeHtml(action.cta)}</button>`;
    els.urgeForecastCard.innerHTML = `<p class="eyebrow">Urge Forecast</p><h4>${escapeHtml(forecast.windowLabel)}</h4><p>${escapeHtml(forecast.body)}</p><div class="risk-meter"><i style="width:${forecast.risk}%"></i></div><small>${escapeHtml(forecast.reason)}</small>`;
    els.keystoneHabitCard.innerHTML = `<p class="eyebrow">Keystone Habit Finder</p><h4>${escapeHtml(keystone.title)}</h4><p>${escapeHtml(keystone.body)}</p><small>${escapeHtml(keystone.detail)}</small>`;
    els.recoveryModeCard.innerHTML = `<p class="eyebrow">Recovery Mode</p><h4>${escapeHtml(recovery.title)}</h4><p>${escapeHtml(recovery.body)}</p><div class="card-actions"><button class="mini-btn ${recovery.active ? 'primary' : ''}" type="button" data-action="start-recovery-mode">${escapeHtml(recovery.cta)}</button></div>`;
    els.experimentModeCard.innerHTML = `<p class="eyebrow">Experiment Mode</p><h4>${escapeHtml(experiment.title)}</h4><p>${escapeHtml(experiment.body)}</p><div class="card-actions">${experiment.active ? `<button class="mini-btn primary" type="button" data-action="finish-experiment" data-id="${experiment.id}" data-result="success">Hat geholfen</button><button class="mini-btn" type="button" data-action="finish-experiment" data-id="${experiment.id}" data-result="neutral">Neutral</button>` : `<button class="mini-btn primary" type="button" data-action="start-experiment" data-experiment="${escapeHtml(experiment.key)}">Experiment starten</button>`}</div>`;
    renderTriggerHeatmap();
    if (els.partyPlanBadge) {
      els.partyPlanBadge.className = `badge ${partyPlan.active ? 'warning-badge' : 'muted'}`;
      els.partyPlanBadge.textContent = partyPlan.active ? 'aktiv' : partyPlan.badge;
    }
    if (els.partyPlanCard) {
      els.partyPlanCard.innerHTML = `<h4>${escapeHtml(partyPlan.title)}</h4><p>${escapeHtml(partyPlan.body)}</p><div class="party-plan-list">${partyPlan.steps.map(step => `<span>${escapeHtml(step)}</span>`).join('')}</div><div class="card-actions">${partyPlan.active ? `<button class="mini-btn primary" type="button" data-action="complete-party-plan" data-id="${partyPlan.id}">Plan erfüllt</button>` : `<button class="mini-btn primary" type="button" data-action="activate-party-plan">30-Sekunden-Plan aktivieren</button>`}<button class="mini-btn" type="button" data-action="open-coach">Coach öffnen</button></div>`;
    }
  }

  function buildUrgeForecast() {
    const now = new Date();
    const hour = now.getHours();
    const keys = daysBack(21);
    const recentCigs = state.cigarettes.filter(c => keys.includes(toDateKey(c.smoked_at)));
    const currentBucket = dayPartKey(hour);
    const currentBucketCount = recentCigs.filter(c => dayPartKey(new Date(c.smoked_at).getHours()) === currentBucket).length;
    const weekdayCount = recentCigs.filter(c => new Date(c.smoked_at).getDay() === now.getDay()).length;
    const alcoholToday = alcoholUnitsOnDate(toDateKey(now)).length || alcoholForDate(toDateKey(now))?.consumed;
    const activeTasks = state.tasks.filter(isActiveTask).length;
    const last = getLastCigarette();
    const pauseMinutes = last ? Math.max(0, Math.round((Date.now() - new Date(last.smoked_at).getTime()) / 60000)) : 999;
    let risk = 24;
    risk += Math.min(28, currentBucketCount * 4);
    risk += Math.min(16, weekdayCount * 2);
    if ([5,6].includes(now.getDay()) && hour >= 17) risk += 12;
    if (alcoholToday) risk += 18;
    if (activeTasks >= 3) risk += 8;
    if (pauseMinutes < 45) risk += 10;
    else if (pauseMinutes > 180) risk -= 8;
    risk = Math.max(5, Math.min(95, Math.round(risk)));
    const windowLabel = `${dayPartLabel(currentBucket)} · ${forecastWindowLabel(hour)}`;
    const reasonBits = [];
    if (currentBucketCount) reasonBits.push(`${currentBucketCount} Rauchmoment(e) in diesem Zeitfenster`);
    if (alcoholToday) reasonBits.push('Alkohol-Kontext aktiv');
    if (activeTasks >= 3) reasonBits.push(`${activeTasks} offene Aufgaben`);
    if (!reasonBits.length) reasonBits.push('wenig akute Risikosignale');
    const body = risk >= 72 ? 'Jetzt aktiv vorbeugen: nicht diskutieren, sondern den kleinsten Reset starten.' : risk >= 48 ? 'Mittleres Risiko: Halte die nächste Lücke bewusst und vermeide Autopilot-Orte.' : 'Ruhiges Fenster: Nutze es, um Schutzfaktoren aufzubauen.';
    return { risk, windowLabel, body, reason: reasonBits.join(' · '), currentBucket };
  }

  function buildNextBestAction(forecast = buildUrgeForecast()) {
    const recovery = buildRecoveryModeInsight();
    const openTask = state.tasks.filter(isActiveTask).sort(compareTasks)[0];
    const focusHabit = state.habits.filter(h => !h.is_archived).find(h => !entriesForHabitOnDate(h.id, toDateKey(new Date())).length);
    const party = buildPartyPlanInsight();
    if (forecast.risk >= 72) return { title: 'Akut-Reset statt Autopilot', body: 'Starte den Coach, lege 10 Minuten Puffer ein und verlasse kurz den Trigger-Ort.', reason: forecast.reason, cta: 'Akutmodus starten', action: 'emergency' };
    if (recovery.active) return { title: 'Heute stabilisieren', body: 'Recovery Mode: nur eine kleine saubere Entscheidung. Kein Perfektionsdruck.', reason: recovery.reason, cta: 'Recovery starten', action: 'recovery' };
    if (!party.active && party.recommended) return { title: 'Abend vorher planen', body: 'Ein kurzer Plan senkt das Risiko stärker als spätere Willenskraft.', reason: party.reason, cta: 'Party-Plan', action: 'party' };
    if (openTask) return { title: 'Eine Aufgabe schliessen', body: `Nächster kleinster Schritt: „${openTask.title}“. Task-Momentum wirkt als Schutzfaktor.`, reason: `${taskPriorityMeta(openTask).label} · Aufwand ${openTask.effort}/5`, cta: 'Tasks öffnen', action: 'tasks' };
    if (focusHabit) return { title: 'Keystone-Momentum setzen', body: `Logge heute eine kleine Einheit „${focusHabit.name}“.`, reason: 'Habit-Rhythmus stabilisiert den Tages-Score.', cta: 'Habits öffnen', action: 'habits' };
    return { title: 'Pause bewusst verlängern', body: 'Du hast gerade Spielraum. Setze dir ein Mini-Ziel bis zum nächsten vollen Zeitfenster.', reason: forecast.reason, cta: 'Coach öffnen', action: 'coach' };
  }

  function buildKeystoneHabitInsight() {
    const keys = daysBack(21);
    const candidates = state.habits.filter(h => !h.is_archived).map(habit => {
      const daysWith = keys.filter(key => state.habitEntries.some(e => e.habit_id === habit.id && toDateKey(e.occurred_at) === key));
      if (daysWith.length < 2) return null;
      const daysWithout = keys.filter(key => !daysWith.includes(key));
      const cigsWith = average(daysWith.map(key => cigarettesOnDate(key).length));
      const cigsWithout = average(daysWithout.map(key => cigarettesOnDate(key).length));
      const tasksWith = average(daysWith.map(key => state.tasks.filter(t => t.status === 'done' && toDateKey(t.completed_at || t.updated_at || t.created_at) === key).length));
      const tasksWithout = average(daysWithout.map(key => state.tasks.filter(t => t.status === 'done' && toDateKey(t.completed_at || t.updated_at || t.created_at) === key).length));
      const lift = (cigsWithout - cigsWith) + (tasksWith - tasksWithout) * .55;
      return { habit, lift, cigsWith, cigsWithout, tasksWith, days: daysWith.length };
    }).filter(Boolean).sort((a,b)=>b.lift-a.lift)[0];
    if (!candidates || candidates.lift <= 0) return { title: 'Noch kein klarer Keystone', body: 'Die App braucht ein paar geloggte Tage, um deinen stärksten Schutzfaktor fair zu erkennen.', detail: 'Tipp: Meditation, Sport oder Wasser regelmässig loggen.' };
    const delta = candidates.cigsWithout - candidates.cigsWith;
    return { title: candidates.habit.name, body: `An Tagen mit diesem Habit wirkt dein System stabiler. ${delta > .2 ? `Ø ${delta.toFixed(1).replace('.', ',')} weniger Zigaretten.` : 'Vor allem Task- und Score-Momentum steigen.'}`, detail: `${candidates.days} aktive Tage in 21 Tagen · experimentell berechnet.` };
  }

  function buildRecoveryModeInsight() {
    const today = toDateKey(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = toDateKey(yesterdayDate);
    const yScore = calculateDailyScore(yesterday).score;
    const todayScore = calculateDailyScore(today).score;
    const active = yScore < 45 || todayScore < 42 || cigarettesOnDate(yesterday).length >= Math.max(5, averageDailyCigarettes(14) * 1.5);
    const already = state.recoverySessions.find(s => toDateKey(s.created_at) === today);
    return { active: Boolean(active || already), title: active || already ? 'Sanft zurück in den Rhythmus' : 'Nicht nötig – System stabil', body: active || already ? 'Heute zählt nicht Optimierung, sondern Rückkehr: Wasser, ein Mini-Habit, eine kleine Aufgabe, keine Eskalation.' : 'Kein Recovery-Signal. Die App hält den Modus bereit, falls ein Tag kippt.', cta: already ? 'Recovery aktiv' : 'Recovery starten', reason: `Gestern ${yScore}% · heute ${todayScore}%` };
  }

  function buildExperimentInsight() {
    const active = state.experiments.find(e => e.status === 'active');
    if (active) return { active: true, id: active.id, key: active.key, title: active.title, body: `${active.rule} Läuft seit ${formatDateTime(active.started_at)}.`, detail: 'Zum Review nach dem nächsten kritischen Moment.', };
    const trigger = topSmokeTrigger(21);
    const key = trigger?.key || 'delay_after_meal';
    const presets = experimentPresets();
    const preset = presets[key] || presets.delay_after_meal;
    return { active: false, key, title: preset.title, body: preset.rule, detail: 'Kleines Experiment statt grosser Vorsatz.' };
  }

  function experimentPresets() {
    return {
      stress: { title: 'Stress-Delay testen', rule: '3 Tage lang: bei Stress erst 6 lange Ausatmungen, dann 5 Minuten warten.' },
      coffee: { title: 'Kaffee-Routine entkoppeln', rule: '3 Tage lang: nach Kaffee erst Wasser trinken und 7 Minuten warten.' },
      alcohol: { title: 'Drink ohne Autopilot', rule: 'Heute Abend: vor der ersten Zigarette 10 Minuten Delay + Glas Wasser.' },
      boredom: { title: 'Langeweile umlenken', rule: '3 Tage lang: bei Langeweile eine 2-Minuten-Aufgabe statt sofort rauchen.' },
      meal: { title: 'Nach-dem-Essen-Puffer', rule: '3 Tage lang: nach dem Essen 5 Minuten gehen oder Zähne putzen, dann neu entscheiden.' },
      tasks: { title: 'Task-Druck senken', rule: '3 Tage lang: vor einer Zigarette eine Aufgabe in den nächsten Mini-Schritt zerlegen.' },
      delay_after_meal: { title: '5-Minuten-Puffer testen', rule: '3 Tage lang: den ersten Impuls nur um 5 Minuten verschieben. Verzögern zählt als Erfolg.' }
    };
  }

  function renderTriggerHeatmap() {
    if (!els.triggerHeatmap) return;
    const buckets = ['morning','midday','evening','late'];
    const labels = ['Mo','Di','Mi','Do','Fr','Sa','So'];
    const matrix = Array.from({ length: 7 }, () => Object.fromEntries(buckets.map(b => [b, 0])));
    const keys = daysBack(21);
    state.cigarettes.filter(c => keys.includes(toDateKey(c.smoked_at))).forEach(c => {
      const date = new Date(c.smoked_at);
      const dayIndex = (date.getDay() + 6) % 7;
      matrix[dayIndex][dayPartKey(date.getHours())] += 1;
    });
    const max = Math.max(1, ...matrix.flatMap(row => buckets.map(b => row[b])));
    els.triggerHeatmap.innerHTML = `<div class="trigger-heatmap-head"><span></span>${buckets.map(b => `<strong>${dayPartShortLabel(b)}</strong>`).join('')}</div>${matrix.map((row, index) => `<div class="trigger-heatmap-row"><strong>${labels[index]}</strong>${buckets.map(b => { const value = row[b]; const level = Math.ceil((value / max) * 4); return `<span class="heat-cell level-${level}" title="${labels[index]} ${dayPartLabel(b)}: ${value}×"><em>${value || ''}</em></span>`; }).join('')}</div>`).join('')}`;
  }

  function buildPartyPlanInsight() {
    const today = toDateKey(new Date());
    const existing = state.partyPlans.find(p => p.status === 'active' && toDateKey(p.created_at) === today);
    const now = new Date();
    const weekendEvening = [5,6].includes(now.getDay()) && now.getHours() >= 14;
    const alcoholToday = Boolean(alcoholUnitsOnDate(today).length || alcoholForDate(today)?.consumed);
    const recommended = weekendEvening || alcoholToday;
    return { active: Boolean(existing), id: existing?.id, recommended, badge: recommended ? 'empfohlen' : 'bereit', reason: alcoholToday ? 'Alkohol-Kontext erkannt' : weekendEvening ? 'Wochenend-Abendfenster' : 'optional', title: existing ? 'Plan ist aktiv' : recommended ? 'Risikomoment vorher entscheiden' : 'Bereit für Ausgehen, Alkohol oder Wochenende', body: existing ? 'Du hast den Abend bewusst vorgeplant. Ziel ist nicht perfekt sein, sondern Autopilot reduzieren.' : 'Lege vor Alkohol, Ausgang oder sozialem Druck fest, was deine erste kleine Schutzhandlung ist.', steps: ['erste Zigarette verzögern', 'Wasser zwischen Drinks', 'Trigger-Ort kurz verlassen'] };
  }

  function openHistoryModal(mode, id = null) {
    if (!els.historyModal || !els.historyModalContent) return;
    historyModalMode = mode;
    historyModalHabitId = mode === 'habit' ? id : null;
    if (mode !== 'smoke') editingSmokeId = null;
    if (mode !== 'habit') editingHabitEntryId = null;
    els.historyModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    renderHistoryModal();
  }

  function closeHistoryModal() {
    if (!els.historyModal) return;
    els.historyModal.classList.add('hidden');
    historyModalMode = null;
    historyModalHabitId = null;
    editingSmokeId = null;
    editingHabitEntryId = null;
    document.body.classList.toggle('modal-open', Boolean(els.coachModal && !els.coachModal.classList.contains('hidden')));
    renderSmoking();
    renderHabits();
  }

  function renderHistoryModal() {
    if (!els.historyModal || !els.historyModalContent || els.historyModal.classList.contains('hidden')) return;
    if (historyModalMode === 'smoke') {
      const count = state.cigarettes.length;
      els.historyModalContent.innerHTML = `<div class="history-modal-head">
        <p class="eyebrow">Konsum</p>
        <h2 id="historyModalTitle">Zigarettenverlauf</h2>
        <p class="subtle">Nur bei Bedarf geöffnet. Hier kannst du Einträge prüfen, bearbeiten oder löschen.</p>
        <span class="badge muted">${count} Eintrag${count === 1 ? '' : 'e'}</span>
      </div>
      ${renderSmokeHistoryList()}`;
      return;
    }
    if (historyModalMode === 'smoke-costs') {
      const totalCost = formatCurrencyChf(smokeCostMetrics().totalCost);
      els.historyModalContent.innerHTML = `<div class="history-modal-head">
        <p class="eyebrow">Konsum</p>
        <h2 id="historyModalTitle">Zigarettenkosten</h2>
        <p class="subtle">Berechnet mit 40 Rappen pro Zigarette – damit du den finanziellen Effekt direkt siehst.</p>
        <span class="badge muted">${totalCost}</span>
      </div>
      ${renderSmokeCostSummary()}`;
      return;
    }
    if (historyModalMode === 'alcohol') {
      const count = state.alcoholUnits.length;
      els.historyModalContent.innerHTML = `<div class="history-modal-head">
        <p class="eyebrow">Konsum</p>
        <h2 id="historyModalTitle">Alkoholverlauf</h2>
        <p class="subtle">Auch Alkohol-Logs bleiben im Alltag ausgeblendet und werden nur bei Bedarf geöffnet.</p>
        <span class="badge muted">${count} Einheit${count === 1 ? '' : 'en'}</span>
      </div>
      ${renderAlcoholUnitHistoryList()}`;
      return;
    }
    if (historyModalMode === 'habit') {
      const habit = state.habits.find(item => item.id === historyModalHabitId);
      if (!habit) {
        els.historyModalContent.innerHTML = `<div class="history-modal-head"><p class="eyebrow">Habits</p><h2 id="historyModalTitle">Logs</h2></div><div class="empty-state">Habit nicht gefunden.</div>`;
        return;
      }
      const entries = state.habitEntries.filter(entry => entry.habit_id === habit.id);
      els.historyModalContent.innerHTML = `<div class="history-modal-head">
        <p class="eyebrow">Habits</p>
        <h2 id="historyModalTitle">${escapeHtml(habit.name)} · Logs</h2>
        <p class="subtle">Logs bleiben im Alltag ausgeblendet und können hier gezielt bearbeitet oder gelöscht werden.</p>
        <span class="badge muted">${entries.length} Log${entries.length === 1 ? '' : 's'}</span>
      </div>
      ${renderHabitEntryModalList(habit)}`;
    }
  }

  function startEmergencyCravingFlow() {
    const meditationHabit = getMeditationHabit({ createIfMissing: true });
    if (meditationHabit) expandedMeditationHabitId = meditationHabit.id;
    showScreen('habits');
    saveState();
    requestAnimationFrame(() => {
      const card = document.querySelector('.habit-card.is-meditation-habit');
      card?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    });
    toast('Craving-Welle in Meditation geöffnet');
  }

  function handleNextBestAction(action) {
    if (action === 'emergency') return startEmergencyCravingFlow();
    if (action === 'recovery') return startRecoveryMode();
    if (action === 'party') return activatePartyPlan();
    if (action === 'tasks') { showScreen('tasks'); return; }
    if (action === 'habits') { showScreen('habits'); return; }
    openCoachModal();
  }

  function startExperiment(key) {
    const presets = experimentPresets();
    const preset = presets[key] || presets.delay_after_meal;
    state.experiments.forEach(e => { if (e.status === 'active') e.status = 'paused'; });
    state.experiments.push({ id: uid(), key, title: preset.title, rule: preset.rule, status: 'active', started_at: nowIso(), updated_at: nowIso(), results: [] });
    saveState();
    toast('Experiment gestartet');
  }

  function finishExperiment(id, result) {
    const experiment = state.experiments.find(e => e.id === id);
    if (!experiment) return;
    experiment.status = 'done';
    experiment.result = result || 'neutral';
    experiment.completed_at = nowIso();
    experiment.updated_at = nowIso();
    saveState();
    toast(result === 'success' ? 'Experiment als hilfreich markiert' : 'Experiment abgeschlossen');
  }

  function activatePartyPlan() {
    const today = toDateKey(new Date());
    const existing = state.partyPlans.find(p => p.status === 'active' && toDateKey(p.created_at) === today);
    if (existing) { toast('Party-Plan ist bereits aktiv'); return; }
    state.partyPlans.push({ id: uid(), status: 'active', created_at: nowIso(), updated_at: nowIso(), steps_done: [] });
    saveState();
    toast('Plan before Party aktiviert');
  }

  function completePartyPlan(id) {
    const plan = state.partyPlans.find(p => p.id === id);
    if (!plan) return;
    plan.status = 'done';
    plan.completed_at = nowIso();
    plan.updated_at = nowIso();
    saveState();
    toast('Party-Plan abgeschlossen');
  }

  function startRecoveryMode() {
    const today = toDateKey(new Date());
    const existing = state.recoverySessions.find(s => toDateKey(s.created_at) === today);
    if (!existing) state.recoverySessions.push({ id: uid(), created_at: nowIso(), updated_at: nowIso(), status: 'active' });
    coachSession.urgeLevel = Math.max(3, Number(coachSession.urgeLevel || 3));
    coachSession.trigger = 'stress';
    saveCoachSession();
    saveState();
    toast('Recovery Mode aktiv · heute nur stabilisieren');
  }

  function dayPartKey(hour) {
    if (hour < 11) return 'morning';
    if (hour < 16) return 'midday';
    if (hour < 21) return 'evening';
    return 'late';
  }

  function dayPartLabel(key) {
    return ({ morning: 'Morgen', midday: 'Mittag', evening: 'Abend', late: 'Spätabend' })[key] || 'Zeitfenster';
  }

  function dayPartShortLabel(key) {
    return ({ morning: 'Morg.', midday: 'Mittag', evening: 'Abend', late: 'Spät' })[key] || key;
  }

  function forecastWindowLabel(hour) {
    const start = Math.max(0, hour - 1);
    const end = Math.min(23, hour + 2);
    return `${String(start).padStart(2, '0')}:00–${String(end).padStart(2, '0')}:00`;
  }

  function average(values = []) {
    const nums = values.map(Number).filter(n => Number.isFinite(n));
    return nums.length ? nums.reduce((a,b)=>a+b,0) / nums.length : 0;
  }

  function averageDailyCigarettes(days = 14) {
    const keys = daysBack(days);
    return average(keys.map(key => cigarettesOnDate(key).length));
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
      { value: 'alcohol', label: 'Alkohol-Einheiten' },
      ...activeHabits.map(habit => ({ value: `habit:${habit.id}`, label: habit.name }))
    ];
  }

  function getTrendMetricConfig(keys) {
    if (selectedTrendMetric === 'cigarettes') {
      return { title: 'Zigaretten pro Tag', label: 'Zigaretten', data: keys.map(k => cigarettesOnDate(k).length), beginAtZero: true };
    }
    if (selectedTrendMetric === 'alcohol') {
      return { title: 'Alkohol-Einheiten', label: 'Einheiten', data: keys.map(k => alcoholUnitsOnDate(k).length), beginAtZero: true };
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
      return `<div class="heatmap-row-label"><span class="habit-icon mini">${svgIcon(habitIconKey(habit), 'ui-icon')}</span><strong>${escapeHtml(habit.name)}</strong></div>${cells}`;
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
    const meditationHabit = getMeditationHabit({ createIfMissing: false });
    els.meditationTechniqueGrid.innerHTML = MEDITATION_TECHNIQUES.map(technique => `<article class="meditation-card">
      <div>
        <strong>${escapeHtml(technique.title)}</strong>
        <p>${escapeHtml(technique.subtitle)}</p>
        <small>${escapeHtml(technique.pattern)} · ${technique.minutes} Min.</small>
      </div>
      <button class="mini-btn primary" type="button" data-action="log-meditation" data-id="${escapeHtml(technique.key)}">Loggen</button>
    </article>`).join('');

    const sessions = meditationHabit ? state.habitEntries
      .filter(entry => entry.habit_id === meditationHabit.id)
      .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
      .slice(0, 5) : [];

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

  function isSystemMeditationHabit(habit) {
    const name = String(habit?.name || '').trim().toLowerCase();
    return Boolean(habit && (habit.system_key === 'meditation' || habit.id === DEFAULT_HABIT_IDS.meditation || name === 'meditation'));
  }

  function renderSmoking() {
    const last = getLastCigarette();
    const smokeCount = state.cigarettes.length;
    if (els.lastSmokePoints) els.lastSmokePoints.textContent = `${smokeCount} Eintrag${smokeCount === 1 ? '' : 'e'}`;
    renderSmokingTip(last);
    renderTriggerCapture();
    renderAlcoholUnitHistory();
    renderSmokingAnalytics();
    renderAlcoholAnalytics();
    renderAlcoholDashboard();
    renderConsumptionMobileOverview(last);
    renderSmokeHistoryLauncher();
    applyConsumptionMode();
  }

  function loadExpandedHabitCardIds() {
    try {
      const raw = JSON.parse(localStorage.getItem(HABIT_CARD_UI_KEY) || '[]');
      return new Set(Array.isArray(raw) ? raw : []);
    } catch {
      return new Set();
    }
  }

  function persistExpandedHabitCardIds() {
    try {
      localStorage.setItem(HABIT_CARD_UI_KEY, JSON.stringify([...expandedHabitCardIds]));
    } catch {}
  }

  function pruneExpandedHabitCardIds(activeIds = []) {
    const allowed = new Set(activeIds);
    const before = expandedHabitCardIds.size;
    expandedHabitCardIds = new Set([...expandedHabitCardIds].filter(id => allowed.has(id)));
    if (expandedHabitCardIds.size !== before) persistExpandedHabitCardIds();
  }

  function setHabitCardExpanded(id, expanded, { renderNow = true } = {}) {
    if (!id) return;
    const had = expandedHabitCardIds.has(id);
    if (expanded) expandedHabitCardIds.add(id);
    else expandedHabitCardIds.delete(id);
    if (expandedHabitCardIds.has(id) !== had) persistExpandedHabitCardIds();
    if (renderNow) renderHabits();
  }

  function toggleHabitCard(id) {
    if (!id) return;
    setHabitCardExpanded(id, !expandedHabitCardIds.has(id));
  }

  function loadExpandedHabitDnaIds() {
    try {
      const raw = JSON.parse(localStorage.getItem(HABIT_DNA_UI_KEY) || '[]');
      return new Set(Array.isArray(raw) ? raw : []);
    } catch {
      return new Set();
    }
  }

  function persistExpandedHabitDnaIds() {
    try {
      localStorage.setItem(HABIT_DNA_UI_KEY, JSON.stringify([...expandedHabitDnaIds]));
    } catch {}
  }

  function toggleHabitDna(id) {
    if (!id) return;
    if (expandedHabitDnaIds.has(id)) expandedHabitDnaIds.delete(id);
    else expandedHabitDnaIds.add(id);
    persistExpandedHabitDnaIds();
    renderHabits();
  }

  function renderSmokeHistoryLauncher() {
    if (!els.smokeHistory) return;
    const metrics = smokeCostMetrics();
    const smokeCount = state.cigarettes.length;
    const todayCount = cigarettesOnDate(toDateKey(new Date())).length;
    els.smokeHistory.innerHTML = `<div class="history-launch-grid">
      <button class="history-open-card" type="button" data-action="open-smoke-history">
        <span class="history-open-icon">${svgIcon('smoke', 'ui-icon')}</span>
        <span class="history-open-copy"><strong>Zigarettenverlauf öffnen</strong><small>${smokeCount ? `${smokeCount} Eintrag${smokeCount === 1 ? '' : 'e'} · ${todayCount} heute` : 'Noch keine Einträge · Verlauf erscheint im Pop-up'}</small></span>
        <span class="history-open-arrow">›</span>
      </button>
      <button class="history-open-card is-secondary" type="button" data-action="open-smoke-costs">
        <span class="history-open-icon is-money">${svgIcon('money', 'ui-icon')}</span>
        <span class="history-open-copy"><strong>Kosten ansehen</strong><small>${metrics.totalCount ? `${formatCurrencyChf(metrics.totalCost)} gesamt · ${formatCurrencyChf(metrics.todayCost)} heute` : '0,40 CHF pro Zigarette · Einsparung direkt sichtbar'}</small></span>
        <span class="history-open-arrow">›</span>
      </button>
    </div>`;
  }

  function renderSmokeHistoryList() {
    const items = [...state.cigarettes]
      .sort((a, b) => new Date(b.smoked_at) - new Date(a.smoked_at))
      .slice(0, 25);

    if (!items.length) {
      return '<div class="empty-state">Noch keine Zigarette erfasst. Neue Einträge erscheinen hier und können später bearbeitet oder gelöscht werden.</div>';
    }

    return `<div class="stack-list tall smoke-history-modal-list">${items.map(c => {
      const cls = c.points < 0 ? 'danger-text' : c.points >= 40 ? 'positive-text' : '';
      const isEditing = editingSmokeId === c.id;
      const editBlock = isEditing
        ? (() => {
            const [dateValue = '', timeValue = ''] = toDateTimeLocalValue(c.smoked_at).split('T');
            return `<div class="smoke-edit-row">
              <label><span>Datum</span><input id="smoke-date-${c.id}" type="date" value="${dateValue}" max="${toDateKey(new Date())}" /></label>
              <label><span>Zeit</span><input id="smoke-time-${c.id}" type="time" value="${timeValue}" step="60" /></label>
              <div class="smoke-edit-actions">
                <button class="mini-btn primary" type="button" data-action="save-smoke-time" data-id="${c.id}">Speichern</button>
                <button class="mini-btn" type="button" data-action="cancel-smoke-edit" data-id="${c.id}">Abbrechen</button>
              </div>
            </div>`;
          })()
        : '';
      return `<article class="list-card ${isEditing ? 'is-editing' : ''}">
        <div class="list-card-main">
          <h4>${formatDateTime(c.smoked_at)}</h4>
          <p class="meta">Pause davor: <strong>${c.interval_minutes == null ? '–' : formatDuration(c.interval_minutes)}</strong>${c.alcohol_context ? ' · Alkohol-Kontext' : ''}</p>
          ${editBlock}
        </div>
        <div class="list-actions">
          <span class="badge ${cls ? '' : 'muted'} ${cls}">${c.points > 0 ? '+' : ''}${c.points} Pkt.</span>
          ${isEditing ? '' : `<button class="mini-btn" type="button" data-action="edit-smoke" data-id="${c.id}">Bearbeiten</button>`}
          <button class="mini-btn danger" type="button" data-action="delete-smoke" data-id="${c.id}">Löschen</button>
        </div>
      </article>`;
    }).join('')}</div>`;
  }




  function renderAlcoholUnitHistory() {
    if (!els.alcoholUnitHistory) return;
    const units = [...state.alcoholUnits]
      .sort((a, b) => sortDate(b.occurred_at || b.created_at) - sortDate(a.occurred_at || a.created_at));
    const todayCount = units.filter(unit => toDateKey(unit.occurred_at || unit.created_at) === toDateKey(new Date())).length;
    els.alcoholUnitHistory.innerHTML = `<button class="history-open-card" type="button" data-action="open-alcohol-history">
      <span class="history-open-icon">${svgIcon('alcohol', 'ui-icon')}</span>
      <span class="history-open-copy"><strong>Alkoholverlauf öffnen</strong><small>${units.length ? `${units.length} Einheit${units.length === 1 ? '' : 'en'} · ${todayCount} heute` : 'Noch keine Einheiten · Verlauf erscheint im Pop-up'}</small></span>
      <span class="history-open-arrow">›</span>
    </button>`;
  }

  function renderAlcoholUnitHistoryList() {
    const units = [...state.alcoholUnits]
      .sort((a, b) => sortDate(b.occurred_at || b.created_at) - sortDate(a.occurred_at || a.created_at))
      .slice(0, 50);
    if (!units.length) {
      return '<div class="empty-state">Noch keine Alkohol-Einheit erfasst. Neue Einheiten erscheinen hier und können später gelöscht werden.</div>';
    }
    return `<div class="stack-list tall alcohol-history-modal-list">${units.map(unit => {
      const points = alcoholPointsForUnit(unit.id);
      const pointsLabel = points ? `${formatSignedPoints(points)} Pkt.` : '0 Pkt.';
      return `<article class="list-card compact">
        <div class="list-card-main">
          <h4>${escapeHtml(alcoholTypeLabel(unit.drink_type))}</h4>
          <p class="meta">${formatDateTime(unit.occurred_at || unit.created_at)}${unit.note ? ` · ${escapeHtml(unit.note)}` : ''}</p>
        </div>
        <div class="list-actions">
          <span class="badge muted">${escapeHtml(pointsLabel)}</span>
          <button class="mini-btn danger" type="button" data-action="delete-alcohol-unit" data-id="${unit.id}">Löschen</button>
        </div>
      </article>`;
    }).join('')}</div>`;
  }

  function renderAlcoholDashboard() {
    const todayKey = toDateKey(new Date());
    const todayUnits = alcoholUnitsOnDate(todayKey);
    const todayPoints = sum(todayUnits.map(unit => alcoholPointsForUnit(unit.id)));
    const units7 = state.alcoholUnits.filter(unit => daysBack(7).includes(toDateKey(unit.occurred_at || unit.created_at))).length;
    if (els.alcoholTodayUnits) els.alcoholTodayUnits.textContent = String(todayUnits.length);
    if (els.alcoholTodayHint) {
      els.alcoholTodayHint.textContent = todayUnits.length
        ? `${formatSignedPoints(todayPoints)} Pkt. heute · ${units7} Einheiten in 7 Tagen`
        : 'Noch keine Einheit erfasst';
    }
    if (els.lastAlcoholPoints) {
      els.lastAlcoholPoints.textContent = `${state.alcoholUnits.length} Einheit${state.alcoholUnits.length === 1 ? '' : 'en'}`;
    }
  }

  function renderConsumptionMobileOverview(last = getLastCigarette()) {
    renderSmokeMobileOverview(last);
    renderAlcoholMobileOverview();
  }

  function renderSmokeMobileOverview(last = getLastCigarette()) {
    const todayKey = toDateKey(new Date());
    const cigarettesToday = cigarettesOnDate(todayKey).length;
    const cigarettes7 = state.cigarettes.filter(c => daysBack(7).includes(toDateKey(c.smoked_at))).length;
    const pauseMinutes = last ? Math.max(0, Math.floor((Date.now() - new Date(last.smoked_at).getTime()) / 60000)) : null;
    const nextGoal = getNextPauseGoalMinutes(pauseMinutes);
    const trigger = topSmokeTrigger(14);
    const bestPause = bestPauseMinutes();
    const avgPause = averagePauseText(7);
    const goalText = pauseMinutes == null
      ? 'erste Pause bewusst starten'
      : pauseMinutes >= nextGoal
        ? 'starke Pause halten'
        : `${formatDuration(nextGoal)} als nächstes Ziel`;

    if (els.smokeMobileInsight) {
      const title = cigarettesToday ? `${cigarettesToday} heute · ${goalText}` : 'Noch keine Zigarette heute';
      const body = trigger
        ? `${trigger.label} ist dein häufigster Trigger der letzten 14 Tage. Nutze den Coach, bevor der Autopilot greift.`
        : 'Der nächste Log fragt ruhig nach dem Auslöser. So wird aus Verlauf ein konkretes Muster.';
      els.smokeMobileInsight.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(body)}</span>`;
    }

    if (els.smokeMobileKpis) {
      const cards = [
        { label: 'Heute', value: `${cigarettesToday}×`, detail: cigarettesToday ? 'erfasst' : 'clean start' },
        { label: '7 Tage', value: `${cigarettes7}×`, detail: 'sichtbares Fenster' },
        { label: 'Ø Pause', value: avgPause, detail: 'letzte 7 Tage' },
        { label: 'Beste Pause', value: bestPause == null ? '–' : formatDuration(bestPause), detail: 'bisher gemessen' }
      ];
      els.smokeMobileKpis.innerHTML = cards.map(card => `<article><small>${escapeHtml(card.label)}</small><strong>${escapeHtml(card.value)}</strong><span>${escapeHtml(card.detail)}</span></article>`).join('');
    }
  }

  function renderAlcoholMobileOverview() {
    const todayKey = toDateKey(new Date());
    const todayUnits = alcoholUnitsOnDate(todayKey);
    const units7 = state.alcoholUnits.filter(unit => daysBack(7).includes(toDateKey(unit.occurred_at || unit.created_at))).length;
    const todayPoints = sum(todayUnits.map(unit => alcoholPointsForUnit(unit.id)));
    const sortedUnits = [...state.alcoholUnits].sort((a, b) => sortDate(b.occurred_at || b.created_at) - sortDate(a.occurred_at || a.created_at));
    const lastUnit = sortedUnits[0] || null;
    const lastMinutes = lastUnit ? Math.max(0, Math.floor((Date.now() - sortDate(lastUnit.occurred_at || lastUnit.created_at)) / 60000)) : null;
    const activeDays7 = new Set(state.alcoholUnits.filter(unit => daysBack(7).includes(toDateKey(unit.occurred_at || unit.created_at))).map(unit => toDateKey(unit.occurred_at || unit.created_at))).size;
    const densityLabel = units7 >= 8 ? 'Dichte senken' : units7 >= 4 ? 'kontrollieren' : 'ruhig halten';

    if (els.alcoholMobileInsight) {
      const title = todayUnits.length ? `${todayUnits.length} Einheit${todayUnits.length === 1 ? '' : 'en'} heute · ${formatSignedPoints(todayPoints)} Pkt.` : 'Heute noch keine Alkohol-Einheit';
      const body = units7
        ? `${units7} Einheiten in 7 Tagen. Fokus: ${densityLabel}, Wasser-Puffer und klare Konsumfenster.`
        : 'Guter Startpunkt: Erfasse nur per Tap, die Muster entstehen automatisch im Hintergrund.';
      els.alcoholMobileInsight.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(body)}</span>`;
    }

    if (els.alcoholMobileKpis) {
      const cards = [
        { label: 'Heute', value: `${todayUnits.length}×`, detail: todayUnits.length ? 'Einheiten' : 'keine Einheit' },
        { label: '7 Tage', value: `${units7}×`, detail: `${activeDays7} aktive Tage` },
        { label: 'Punkte', value: `${formatSignedPoints(todayPoints)}`, detail: 'heute' },
        { label: 'Letzter Log', value: lastMinutes == null ? '–' : compactDuration(lastMinutes), detail: lastUnit ? alcoholTypeLabel(lastUnit.drink_type) : 'noch keiner' }
      ];
      els.alcoholMobileKpis.innerHTML = cards.map(card => `<article><small>${escapeHtml(card.label)}</small><strong>${escapeHtml(card.value)}</strong><span>${escapeHtml(card.detail)}</span></article>`).join('');
    }
  }

  function renderAlcoholAnalytics() {
    renderAlcoholWeekHeatmap();
    renderAlcoholIntervalVisual();
  }

  function renderAlcoholWeekHeatmap(weeksCount = 12) {
    if (!els.alcoholHeatmapVisual) return;
    if (els.alcoholHeatmapBadge) els.alcoholHeatmapBadge.textContent = `${weeksCount} KW`;

    const weeks = calendarWeeksBack(weeksCount);
    const weekKeys = new Set(weeks.map(week => week.key));
    const rows = [1, 2, 3, 4, 5, 6, 0].map(day => ({
      day,
      total: 0,
      cells: weeks.map(week => ({ key: week.key, count: 0 }))
    }));
    const relevant = state.alcoholUnits.filter(unit => weekKeys.has(isoWeekInfo(unit.occurred_at || unit.created_at).key));

    if (!relevant.length) {
      els.alcoholHeatmapVisual.innerHTML = '<div class="empty-state">Noch keine Alkohol-Einheiten im Kalenderwochen-Fenster. Sobald Verlauf vorhanden ist, zeigt diese Matrix, an welchen Tagen die Einheiten liegen.</div>';
      return;
    }

    const rowByDay = new Map(rows.map(row => [row.day, row]));
    const weekTotals = new Map(weeks.map(week => [week.key, 0]));
    relevant.forEach(unit => {
      const date = new Date(unit.occurred_at || unit.created_at);
      if (Number.isNaN(date.getTime())) return;
      const info = isoWeekInfo(date);
      const row = rowByDay.get(date.getDay());
      const cell = row?.cells.find(item => item.key === info.key);
      if (!cell) return;
      cell.count += 1;
      row.total += 1;
      weekTotals.set(info.key, (weekTotals.get(info.key) || 0) + 1);
    });

    const flatCells = rows.flatMap(row => row.cells.map(cell => ({ ...cell, day: row.day })));
    const maxValue = Math.max(...flatCells.map(cell => cell.count), 1);
    const peakEntry = [...flatCells].sort((a, b) => b.count - a.count)[0] || { count: 0, day: 1, key: weeks.at(-1)?.key };
    const peakWeek = weeks.find(week => week.key === peakEntry.key) || weeks.at(-1);
    const dominantDay = [...rows].sort((a, b) => b.total - a.total)[0] || rows[0];
    const dominantWeek = [...weekTotals.entries()]
      .map(([key, count]) => ({ key, count, week: weeks.find(item => item.key === key) }))
      .sort((a, b) => b.count - a.count)[0] || { count: 0, week: weeks.at(-1) };
    const pointsInWindow = sum(relevant.map(unit => alcoholPointsForUnit(unit.id)));
    const summary = [
      {
        label: 'Stärkste Zelle',
        value: `${peakWeek?.label || 'KW'} · ${smokingWeekdayLabel(peakEntry.day, { short: true })}`,
        detail: `${peakEntry.count} Einheit${peakEntry.count === 1 ? '' : 'en'} in diesem Wochen-/Tages-Cluster.`
      },
      {
        label: 'Stärkste KW',
        value: dominantWeek.week?.label || '–',
        detail: `${dominantWeek.count} Einheiten · ${dominantWeek.week?.rangeLabel || 'Kalenderwoche'}.`
      },
      {
        label: 'Dominanter Tag',
        value: smokingWeekdayLabel(dominantDay.day),
        detail: `${dominantDay.total} Einheiten über ${weeksCount} Kalenderwochen.`
      },
      {
        label: 'Punktedruck',
        value: `${formatSignedPoints(pointsInWindow)} Pkt.`,
        detail: 'Summe aus Basisabzug und Zusatzregeln im sichtbaren Fenster.'
      }
    ];

    const header = weeks.map(week => `<div class="smoke-week-label" title="${escapeHtml(week.rangeLabel)}"><span>${escapeHtml(week.label)}</span><small>${escapeHtml(week.rangeLabel)}</small></div>`).join('');
    const body = rows.map(row => `
      <div class="smoke-week-row-label"><strong>${smokingWeekdayLabel(row.day, { short: true })}</strong><small>${row.total}×</small></div>
      ${row.cells.map((cell, index) => {
        const week = weeks[index];
        const level = cell.count ? Math.max(1, Math.ceil((cell.count / maxValue) * 5)) : 0;
        const title = `${smokingWeekdayLabel(row.day)}, ${week.label} (${week.rangeLabel}) · ${cell.count} Alkohol-Einheit${cell.count === 1 ? '' : 'en'}`;
        return `<span class="smoke-week-cell level-${level}" title="${escapeHtml(title)}"><em>${cell.count || ''}</em></span>`;
      }).join('')}
    `).join('');

    els.alcoholHeatmapVisual.innerHTML = `
      <div class="smoking-visual-summary-grid smoking-visual-summary-grid--compact">
        ${summary.map(item => `<article><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong><p>${escapeHtml(item.detail)}</p></article>`).join('')}
      </div>
      <div class="smoke-week-grid-wrap" aria-label="Alkohol-Heatmap nach Kalenderwoche und Wochentag">
        <div class="smoke-week-grid" style="--smoke-week-columns:${weeks.length}">
          <div class="smoke-week-corner">Tag</div>
          ${header}
          ${body}
        </div>
      </div>
      <div class="smoke-hour-legend"><span>wenig</span>${[1, 2, 3, 4, 5].map(level => `<i class="level-${level}"></i>`).join('')}<span>hoch</span></div>
      <p class="meta">Pattern Readout: Die Matrix verdichtet Alkohol-Einheiten zu Kalenderwochen-Clustern. Aktuell ist <strong>${dominantWeek.week?.label || 'eine KW'}</strong> am auffälligsten; der stärkste Wochentag ist <strong>${smokingWeekdayLabel(dominantDay.day)}</strong>.</p>
    `;
  }

  function alcoholIntervalSnapshots() {
    const sorted = [...state.alcoholUnits].sort((a, b) => new Date(a.occurred_at || a.created_at) - new Date(b.occurred_at || b.created_at));
    return sorted.map((unit, index) => {
      const prev = sorted[index - 1] || null;
      const occurredAt = unit.occurred_at || unit.created_at;
      const previousAt = prev?.occurred_at || prev?.created_at;
      const interval = prev ? Math.max(0, Math.round((new Date(occurredAt) - new Date(previousAt)) / 60000)) : null;
      return { unit, previous: prev, interval_minutes: interval };
    });
  }

  function alcoholIntervalTone(minutes) {
    if (minutes == null) return 'is-neutral';
    if (minutes < 120) return 'is-critical';
    if (minutes < 360) return 'is-warning';
    if (minutes < 1440) return 'is-neutral';
    if (minutes < 2880) return 'is-positive';
    return 'is-recovery';
  }

  function renderAlcoholIntervalVisual(days = 28) {
    if (!els.alcoholIntervalVisual) return;
    const keys = new Set(daysBack(days));
    const snapshots = alcoholIntervalSnapshots().filter(item => keys.has(toDateKey(item.unit.occurred_at || item.unit.created_at)) && Number.isFinite(Number(item.interval_minutes)));

    if (!snapshots.length) {
      if (els.alcoholIntervalQuality) els.alcoholIntervalQuality.textContent = 'lernt noch';
      els.alcoholIntervalVisual.innerHTML = '<div class="empty-state">Für die Sequenz-Analyse braucht es mindestens zwei Alkohol-Einheiten. Danach zeigt die App Abstände, Verteilung und Konsumdichte.</div>';
      return;
    }

    const durations = snapshots.map(item => Number(item.interval_minutes));
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const median = percentile(sortedDurations, 0.5);
    const p75 = percentile(sortedDurations, 0.75);
    const longBreakShare = Math.round((durations.filter(value => value >= 1440).length / durations.length) * 100);
    const denseShare = Math.round((durations.filter(value => value < 360).length / durations.length) * 100);
    const recent = snapshots.slice(-20);
    const cap = Math.max(2880, percentile(sortedDurations, 0.9));
    const bucketConfig = [
      { label: '<2 Std.', detail: 'sehr dicht', test: value => value < 120, tone: 'is-critical' },
      { label: '2–6 Std.', detail: 'dicht', test: value => value >= 120 && value < 360, tone: 'is-warning' },
      { label: '6–24 Std.', detail: 'Tagesfenster', test: value => value >= 360 && value < 1440, tone: 'is-neutral' },
      { label: '1–2 Tage', detail: 'Pause', test: value => value >= 1440 && value < 2880, tone: 'is-positive' },
      { label: '2+ Tage', detail: 'Recovery', test: value => value >= 2880, tone: 'is-recovery' }
    ];
    const qualityLabel = median >= 2880 ? 'stark' : longBreakShare >= 40 ? 'stabil' : denseShare >= 55 ? 'verdichtet' : 'in Bewegung';
    if (els.alcoholIntervalQuality) els.alcoholIntervalQuality.textContent = qualityLabel;

    const summary = [
      { label: 'Median-Abstand', value: compactDuration(median), detail: 'Robuster Mittelpunkt zwischen zwei Einheiten.' },
      { label: '75. Perzentil', value: compactDuration(p75), detail: 'Diesen Abstand erreichst du im oberen Viertel.' },
      { label: '24h+ Quote', value: `${longBreakShare}%`, detail: 'Abstände von mindestens einem Tag.' },
      { label: 'Dichte Phasen', value: `${denseShare}%`, detail: 'Abstände unter sechs Stunden im Analysefenster.' }
    ];

    const skyline = recent.map(item => {
      const minutes = Number(item.interval_minutes);
      const height = Math.max(14, Math.round((Math.min(minutes, cap) / cap) * 100));
      return `<div class="interval-skyline-bar ${alcoholIntervalTone(minutes)}" title="${escapeHtml(`${formatDateTime(item.unit.occurred_at || item.unit.created_at)} · Abstand ${formatDuration(minutes)}`)}"><i style="height:${height}%"></i></div>`;
    }).join('');

    const buckets = bucketConfig.map(bucket => {
      const count = durations.filter(bucket.test).length;
      const share = Math.round((count / durations.length) * 100);
      return `<article class="interval-bucket-card ${bucket.tone}">
        <div class="interval-bucket-copy"><small>${escapeHtml(bucket.label)}</small><strong>${share}%</strong><p>${count}/${durations.length} Abstände · ${escapeHtml(bucket.detail)}</p></div>
        <div class="interval-bucket-track"><i style="width:${Math.max(8, share)}%"></i></div>
      </article>`;
    }).join('');

    const signal = denseShare >= 55
      ? 'Viele Einheiten liegen nah beieinander. Hier greifen die Zusatzabzüge und der Coach sollte den nächsten alkoholfreien Block priorisieren.'
      : longBreakShare >= 40
        ? 'Die Abstände enthalten bereits mehrere klare Pausen. Das ist ein gutes Signal für kontrollierbare Konsumfenster.'
        : 'Die Folge ist gemischt. Beobachte vor allem, ob sich kurze Abstände häufen.';

    els.alcoholIntervalVisual.innerHTML = `
      <div class="smoking-visual-summary-grid">
        ${summary.map(item => `<article><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong><p>${escapeHtml(item.detail)}</p></article>`).join('')}
      </div>
      <div class="interval-skyline-card">
        <div class="interval-skyline-head"><strong>Sequenz der letzten ${recent.length} Abstände</strong><small>höher = längerer Abstand</small></div>
        <div class="interval-skyline">${skyline}</div>
        <div class="interval-skyline-axis"><span>älter</span><span>neu</span></div>
      </div>
      <div class="interval-bucket-grid">${buckets}</div>
      <div class="coach-callout interval-callout"><b>Signal:</b> ${escapeHtml(signal)}</div>
    `;
  }

  function renderSmokingTip(last = getLastCigarette()) {
    if (!els.cravingTipTitle || !els.cravingTipBody || !els.cravingTipMeta) return;
    const pauseMinutes = last ? Math.max(0, Math.floor((Date.now() - new Date(last.smoked_at).getTime()) / 60000)) : null;
    const contextIndex = getContextualSmokingTipIndex(pauseMinutes);
    const tip = SMOKING_TIPS[(activeSmokingTipIndex || contextIndex) % SMOKING_TIPS.length] || SMOKING_TIPS[contextIndex] || SMOKING_TIPS[0];
    const nextGoal = getNextPauseGoalMinutes(pauseMinutes);
    const goalText = pauseMinutes == null
      ? 'Erste Pause bewusst starten'
      : `Mini-Ziel: ${formatDuration(nextGoal)}`;

    els.cravingTipTitle.textContent = tip.title;
    els.cravingTipBody.innerHTML = `${escapeHtml(tip.body)} <strong>${escapeHtml(goalText)}</strong>`;
    els.cravingTipMeta.textContent = tip.meta;
  }

  function getContextualSmokingTipIndex(pauseMinutes) {
    const alcoholToday = Boolean(alcoholForDate(toDateKey(new Date()))?.consumed);
    if (alcoholToday) return 4;
    if (pauseMinutes == null) return 0;
    if (pauseMinutes < 10) return 2;
    if (pauseMinutes < 30) return 0;
    if (pauseMinutes < 90) return 1;
    return 3;
  }

  function getNextPauseGoalMinutes(pauseMinutes) {
    if (pauseMinutes == null) return 10;
    if (pauseMinutes < 30) return Math.min(30, pauseMinutes + 10);
    if (pauseMinutes < 60) return 60;
    if (pauseMinutes < 120) return 120;
    if (pauseMinutes < 240) return 240;
    return pauseMinutes + 30;
  }

  function rotateSmokingTip() {
    activeSmokingTipIndex = (activeSmokingTipIndex + 1) % SMOKING_TIPS.length;
    renderSmokingTip();
  }


  function renderSmokingAnalytics() {
    renderSmokingWeekHeatmap();
    renderSmokeIntervalVisual();
  }

  function renderSmokingWeekHeatmap(weeksCount = 12) {
    if (!els.cigaretteHeatmapVisual) return;
    if (els.cigaretteHeatmapBadge) els.cigaretteHeatmapBadge.textContent = `${weeksCount} KW`;

    const weeks = calendarWeeksBack(weeksCount);
    const weekKeys = new Set(weeks.map(week => week.key));
    const weekIndex = new Map(weeks.map((week, index) => [week.key, index]));
    const rows = [1, 2, 3, 4, 5, 6, 0].map(day => ({
      day,
      total: 0,
      cells: weeks.map(week => ({ key: week.key, count: 0 }))
    }));
    const relevant = state.cigarettes.filter(c => weekKeys.has(isoWeekInfo(c.smoked_at).key));

    if (!relevant.length) {
      els.cigaretteHeatmapVisual.innerHTML = '<div class="empty-state">Noch keine Zigaretten im Kalenderwochen-Fenster. Sobald Verlauf vorhanden ist, zeigt diese Matrix, an welchen Wochentagen welche Wochen wirklich auffällig waren.</div>';
      return;
    }

    const rowByDay = new Map(rows.map(row => [row.day, row]));
    const weekTotals = new Map(weeks.map(week => [week.key, 0]));

    relevant.forEach(entry => {
      const date = new Date(entry.smoked_at);
      if (Number.isNaN(date.getTime())) return;
      const info = isoWeekInfo(date);
      const columnIndex = weekIndex.get(info.key);
      const row = rowByDay.get(date.getDay());
      if (!row || columnIndex == null) return;
      row.cells[columnIndex].count += 1;
      row.total += 1;
      weekTotals.set(info.key, (weekTotals.get(info.key) || 0) + 1);
    });

    const flatCells = rows.flatMap(row => row.cells.map(cell => ({ ...cell, day: row.day })));
    const maxValue = Math.max(...flatCells.map(cell => cell.count), 1);
    const peakEntry = [...flatCells].sort((a, b) => b.count - a.count)[0] || { count: 0, day: 1, key: weeks.at(-1)?.key };
    const peakWeek = weeks.find(week => week.key === peakEntry.key) || weeks.at(-1);
    const dominantDay = [...rows].sort((a, b) => b.total - a.total)[0] || rows[0];
    const dominantWeek = [...weekTotals.entries()]
      .map(([key, count]) => ({ key, count, week: weeks.find(item => item.key === key) }))
      .sort((a, b) => b.count - a.count)[0] || { count: 0, week: weeks.at(-1) };
    const topCellShare = relevant.length
      ? Math.round((flatCells
          .map(cell => cell.count)
          .filter(Boolean)
          .sort((a, b) => b - a)
          .slice(0, 3)
          .reduce((total, value) => total + value, 0) / relevant.length) * 100)
      : 0;
    const weekCounts = weeks.map(week => weekTotals.get(week.key) || 0);
    const splitIndex = Math.max(1, Math.floor(weekCounts.length / 2));
    const earlyAverage = average(weekCounts.slice(0, splitIndex));
    const lateAverage = average(weekCounts.slice(splitIndex));
    const weekDelta = Math.round((lateAverage - earlyAverage) * 10) / 10;
    const trendText = weekCounts.length < 4
      ? 'noch wenig Wochenhistorie'
      : weekDelta > 0.4
        ? `+${weekDelta.toLocaleString('de-CH')} / KW`
        : weekDelta < -0.4
          ? `${weekDelta.toLocaleString('de-CH')} / KW`
          : 'stabil';

    const summary = [
      {
        label: 'Stärkste Zelle',
        value: `${peakWeek?.label || 'KW'} · ${smokingWeekdayLabel(peakEntry.day, { short: true })}`,
        detail: `${peakEntry.count} Zigarette${peakEntry.count === 1 ? '' : 'n'} in diesem Wochen-/Tages-Cluster.`
      },
      {
        label: 'Stärkste KW',
        value: dominantWeek.week?.label || '–',
        detail: `${dominantWeek.count} Einträge · ${dominantWeek.week?.rangeLabel || 'Kalenderwoche'}.`
      },
      {
        label: 'Dominanter Tag',
        value: smokingWeekdayLabel(dominantDay.day),
        detail: `${dominantDay.total} Einträge über ${weeksCount} Kalenderwochen.`
      },
      {
        label: 'Trenddruck',
        value: trendText,
        detail: `Vergleich neue vs. ältere Wochen · Top-3 Zellen bündeln ${topCellShare}% des Konsums.`
      }
    ];

    const header = weeks.map(week => `<div class="smoke-week-label" title="${escapeHtml(week.rangeLabel)}"><span>${escapeHtml(week.label)}</span><small>${escapeHtml(week.rangeLabel)}</small></div>`).join('');
    const body = rows.map(row => `
      <div class="smoke-week-row-label"><strong>${smokingWeekdayLabel(row.day, { short: true })}</strong><small>${row.total}×</small></div>
      ${row.cells.map((cell, index) => {
        const week = weeks[index];
        const level = cell.count ? Math.max(1, Math.ceil((cell.count / maxValue) * 5)) : 0;
        const title = `${smokingWeekdayLabel(row.day)}, ${week.label} (${week.rangeLabel}) · ${cell.count} Zigarette${cell.count === 1 ? '' : 'n'}`;
        return `<span class="smoke-week-cell level-${level}" title="${escapeHtml(title)}"><em>${cell.count || ''}</em></span>`;
      }).join('')}
    `).join('');

    const weekdaySignature = rows
      .map(row => ({
        day: row.day,
        label: smokingWeekdayLabel(row.day, { short: true }),
        count: row.total,
        share: relevant.length ? Math.round((row.total / relevant.length) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);
    const weekdayPeak = Math.max(...weekdaySignature.map(item => item.count), 1);
    const weekdaySignatureMarkup = weekdaySignature.map(item => {
      const width = item.count ? Math.max(10, Math.round((item.count / weekdayPeak) * 100)) : 0;
      const level = item.count ? Math.max(1, Math.ceil((item.count / weekdayPeak) * 5)) : 0;
      return `<div class="smoke-signature-row" title="${escapeHtml(`${smokingWeekdayLabel(item.day)} · ${item.count} Zigarette${item.count === 1 ? '' : 'n'} · ${item.share}% Anteil`)}">
        <strong>${escapeHtml(item.label)}</strong>
        <div class="smoke-signature-track"><i class="level-${level}" style="width:${width}%"></i></div>
        <span>${item.count}× · ${item.share}%</span>
      </div>`;
    }).join('');

    const weekPulse = weeks.map((week, index) => ({
      week,
      count: weekCounts[index] || 0
    }));
    const pulseMax = Math.max(...weekPulse.map(item => item.count), 1);
    const weekPulseMarkup = weekPulse.map(item => {
      const height = item.count ? Math.max(14, Math.round((item.count / pulseMax) * 100)) : 8;
      const level = item.count ? Math.max(1, Math.ceil((item.count / pulseMax) * 5)) : 0;
      return `<div class="smoke-pulse-bar level-${level}" title="${escapeHtml(`${item.week.label} (${item.week.rangeLabel}) · ${item.count} Zigarette${item.count === 1 ? '' : 'n'}`)}"><i style="height:${height}%"></i><small>${escapeHtml(item.week.label.replace('KW ', ''))}</small></div>`;
    }).join('');
    const weekendCount = rows.filter(row => [5, 6, 0].includes(row.day)).reduce((total, row) => total + row.total, 0);
    const weekdayCount = Math.max(0, relevant.length - weekendCount);
    const weekendShare = relevant.length ? Math.round((weekendCount / relevant.length) * 100) : 0;
    const cadenceText = weekendShare >= 45
      ? `Wochenenden bündeln ${weekendShare}% des sichtbaren Konsums – die Map kippt dort klar nach oben.`
      : weekdayCount > weekendCount
        ? `Werktage tragen aktuell ${Math.round((weekdayCount / relevant.length) * 100)}% des Musters – die Woche ist der Haupttreiber.`
        : 'Das Muster verteilt sich aktuell relativ ausgewogen zwischen Woche und Wochenende.';

    els.cigaretteHeatmapVisual.innerHTML = `
      <div class="smoking-visual-summary-grid smoking-visual-summary-grid--compact">
        ${summary.map(item => `<article><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong><p>${escapeHtml(item.detail)}</p></article>`).join('')}
      </div>
      <div class="smoke-week-grid-wrap" aria-label="Zigaretten-Heatmap nach Kalenderwoche und Wochentag">
        <div class="smoke-week-grid" style="--smoke-week-columns:${weeks.length}">
          <div class="smoke-week-corner">Tag</div>
          ${header}
          ${body}
        </div>
      </div>
      <div class="smoke-hour-legend"><span>wenig</span>${[1, 2, 3, 4, 5].map(level => `<i class="level-${level}"></i>`).join('')}<span>hoch</span></div>
      <p class="meta">Pattern Readout: Die Matrix verdichtet einzelne Rauchmomente zu Kalenderwochen-Clustern. Aktuell ist <strong>${dominantWeek.week?.label || 'eine KW'}</strong> am auffälligsten; der stärkste Wochentag ist <strong>${smokingWeekdayLabel(dominantDay.day)}</strong>.</p>
      <div class="smoke-map-support-grid">
        <article class="smoke-map-support-card">
          <div class="smoke-map-support-head"><strong>Wochentag-Signatur</strong><small>welche Tage den Kalender dominieren</small></div>
          <div class="smoke-signature-list">${weekdaySignatureMarkup}</div>
          <p class="meta">${escapeHtml(cadenceText)}</p>
        </article>
        <article class="smoke-map-support-card">
          <div class="smoke-map-support-head"><strong>Wochen-Puls</strong><small>12 Kalenderwochen im Direktvergleich</small></div>
          <div class="smoke-pulse-chart" aria-label="Wochenpuls der letzten Kalenderwochen">${weekPulseMarkup}</div>
          <div class="interval-skyline-axis smoke-pulse-axis"><span>älter</span><span>neu</span></div>
          <p class="meta">Der Wochen-Puls ergänzt die Heatmap um ein kompaktes Trendbild, ohne mit der Pausen-Analyse zu konkurrieren.</p>
        </article>
      </div>
    `;
  }

  function renderSmokeIntervalVisual(days = 28) {
    if (!els.smokeIntervalVisual) return;
    const keys = new Set(daysBack(days));
    const snapshots = smokeIntervalSnapshots().filter(item => keys.has(toDateKey(item.cigarette.smoked_at)) && Number.isFinite(Number(item.interval_minutes)));

    if (!snapshots.length) {
      if (els.smokeIntervalQuality) els.smokeIntervalQuality.textContent = 'lernt noch';
      els.smokeIntervalVisual.innerHTML = '<div class="empty-state">Für die Intervall-Analyse braucht es mindestens zwei Einträge im Verlauf. Danach zeigt die App Median, Verteilung und den Verlauf deiner Pausen.</div>';
      return;
    }

    const durations = snapshots.map(item => Number(item.interval_minutes));
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const q1 = percentile(sortedDurations, 0.25);
    const median = percentile(sortedDurations, 0.5);
    const p75 = percentile(sortedDurations, 0.75);
    const recoveryShare = Math.round((durations.filter(value => value >= 120).length / durations.length) * 100);
    const compressionShare = Math.round((durations.filter(value => value < 60).length / durations.length) * 100);
    const daytimeBest = snapshots.filter(item => item.isDaytimeInterval).map(item => Number(item.interval_minutes));
    const bestDaytime = daytimeBest.length ? Math.max(...daytimeBest) : null;
    const recent = snapshots.slice(-20);
    const cap = Math.max(240, percentile(sortedDurations, 0.9));
    const violinCap = Math.max(cap, sortedDurations[sortedDurations.length - 1] || 0, 120);
    const halfIndex = Math.floor(recent.length / 2);
    const earlierSample = recent.slice(0, halfIndex);
    const laterSample = recent.slice(halfIndex);
    const earlyAverage = average(earlierSample.map(item => item.interval_minutes));
    const lateAverage = average(laterSample.map(item => item.interval_minutes));
    const delta = earlierSample.length && laterSample.length ? Math.round(lateAverage - earlyAverage) : 0;
    const bucketConfig = [
      { label: '<30 Min.', detail: 'sehr dicht', test: value => value < 30, tone: 'is-critical' },
      { label: '30–59 Min.', detail: 'verdichtet', test: value => value >= 30 && value < 60, tone: 'is-warning' },
      { label: '1–2 Std.', detail: 'neutral', test: value => value >= 60 && value < 120, tone: 'is-neutral' },
      { label: '2–4 Std.', detail: 'stark', test: value => value >= 120 && value < 240, tone: 'is-positive' },
      { label: '4+ Std.', detail: 'Recovery', test: value => value >= 240, tone: 'is-recovery' }
    ];
    const qualityLabel = median >= 150 ? 'stark' : recoveryShare >= 40 ? 'stabil' : compressionShare >= 55 ? 'verdichtet' : 'in Bewegung';
    if (els.smokeIntervalQuality) els.smokeIntervalQuality.textContent = qualityLabel;

    const summary = [
      {
        label: 'Median-Pause',
        value: compactDuration(median),
        detail: 'Robuster Mittelpunkt deiner Pausen.'
      },
      {
        label: '75. Perzentil',
        value: compactDuration(p75),
        detail: 'Diesen Abstand erreichst du in deinem oberen Viertel.'
      },
      {
        label: 'Recovery-Quote',
        value: `${recoveryShare}%`,
        detail: 'Intervalle ≥ 2 Stunden im Analysefenster.'
      },
      {
        label: 'Beste Tagespause',
        value: bestDaytime ? compactDuration(bestDaytime) : '–',
        detail: bestDaytime ? 'Längste Pause ohne Nacht-Effekt.' : 'Noch keine Tagespause vorhanden.'
      }
    ];

    const violinMarkup = buildHorizontalIntervalViolin(durations, {
      maxValue: violinCap,
      median,
      q1,
      q3: p75,
      qualityLabel,
      subtitle: `Analysefenster ${days} Tage · ${durations.length} Pause${durations.length === 1 ? '' : 'n'}`
    });

    const skyline = recent.map(item => {
      const minutes = Number(item.interval_minutes);
      const height = Math.max(14, Math.round((Math.min(minutes, cap) / cap) * 100));
      return `<div class="interval-skyline-bar ${smokeIntervalTone(minutes)}" title="${escapeHtml(`${formatDateTime(item.cigarette.smoked_at)} · Pause ${formatDuration(minutes)}`)}"><i style="height:${height}%"></i></div>`;
    }).join('');

    const buckets = bucketConfig.map(bucket => {
      const count = durations.filter(bucket.test).length;
      const share = Math.round((count / durations.length) * 100);
      return `<article class="interval-bucket-card ${bucket.tone}">
        <div class="interval-bucket-copy"><small>${escapeHtml(bucket.label)}</small><strong>${share}%</strong><p>${count}/${durations.length} Intervalle · ${escapeHtml(bucket.detail)}</p></div>
        <div class="interval-bucket-track"><i style="width:${Math.max(8, share)}%"></i></div>
      </article>`;
    }).join('');

    const trendText = recent.length < 4
      ? 'Noch wenig Intervallhistorie – sammle ein paar weitere Einträge für belastbare Trend-Aussagen.'
      : delta >= 10
        ? `Die neueren Pausen sind im Schnitt ${compactDuration(delta)} länger als die älteren im sichtbaren Verlauf.`
        : delta <= -10
          ? `Die neueren Pausen sind im Schnitt ${compactDuration(Math.abs(delta))} kürzer – hier lohnt sich ein gezielter Coach-Einsatz.`
          : 'Die letzten Pausen liegen stabil nahe am bisherigen Niveau.';

    els.smokeIntervalVisual.innerHTML = `
      <div class="smoking-visual-summary-grid">
        ${summary.map(item => `<article><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong><p>${escapeHtml(item.detail)}</p></article>`).join('')}
      </div>
      ${violinMarkup}
      <div class="interval-skyline-card">
        <div class="interval-skyline-head"><strong>Sequenz der letzten ${recent.length} Pausen</strong><small>höher = längerer Abstand</small></div>
        <div class="interval-skyline">${skyline}</div>
        <div class="interval-skyline-axis"><span>älter</span><span>neu</span></div>
      </div>
      <div class="interval-bucket-grid">${buckets}</div>
      <div class="coach-callout interval-callout"><b>Signal:</b> ${escapeHtml(trendText)}</div>
    `;
  }

  function calendarWeeksBack(count = 12) {
    const currentStart = startOfIsoWeek(new Date());
    const weeks = [];
    for (let i = count - 1; i >= 0; i--) {
      const start = new Date(currentStart);
      start.setDate(currentStart.getDate() - (i * 7));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const info = isoWeekInfo(start);
      weeks.push({
        ...info,
        start,
        end,
        label: `KW ${info.week}`,
        rangeLabel: formatWeekRange(start, end)
      });
    }
    return weeks;
  }

  function startOfIsoWeek(value) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return new Date();
    date.setHours(12, 0, 0, 0);
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
    return date;
  }

  function isoWeekInfo(value) {
    const raw = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(raw.getTime())) return { year: 0, week: 0, key: '' };
    const date = new Date(Date.UTC(raw.getFullYear(), raw.getMonth(), raw.getDate()));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const year = date.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((date - yearStart) / DAY_MS) + 1) / 7);
    return { year, week, key: `${year}-W${String(week).padStart(2, '0')}` };
  }

  function formatWeekRange(start, end) {
    const format = date => date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
    return `${format(start)}–${format(end)}`;
  }

  function smokingWeekdayLabel(day, { short = false } = {}) {
    const labels = {
      0: { short: 'So', long: 'Sonntag' },
      1: { short: 'Mo', long: 'Montag' },
      2: { short: 'Di', long: 'Dienstag' },
      3: { short: 'Mi', long: 'Mittwoch' },
      4: { short: 'Do', long: 'Donnerstag' },
      5: { short: 'Fr', long: 'Freitag' },
      6: { short: 'Sa', long: 'Samstag' }
    };
    const entry = labels[day] || labels[1];
    return short ? entry.short : entry.long;
  }

  function percentile(values = [], ratio = 0.5) {
    if (!values.length) return 0;
    const index = Math.max(0, Math.min(values.length - 1, (values.length - 1) * ratio));
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return values[lower];
    return values[lower] + (values[upper] - values[lower]) * (index - lower);
  }

  function compactDuration(minutes) {
    const totalMinutes = Math.max(0, Math.round(Number(minutes) || 0));
    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60);
      const rest = totalMinutes % 60;
      return rest ? `${hours}h ${rest}m` : `${hours}h`;
    }
    return `${totalMinutes}m`;
  }

  function smokeIntervalTone(minutes) {
    if (minutes < 30) return 'is-critical';
    if (minutes < 60) return 'is-warning';
    if (minutes < 120) return 'is-neutral';
    if (minutes < 240) return 'is-positive';
    return 'is-recovery';
  }



  function buildHorizontalIntervalViolin(values = [], { maxValue = null, median = null, q1 = null, q3 = null, qualityLabel = '', subtitle = '' } = {}) {
    const durations = values.map(value => Number(value)).filter(Number.isFinite).sort((a, b) => a - b);
    if (!durations.length) return '';

    const upperBound = Math.max(Number(maxValue) || 0, durations[durations.length - 1] || 0, 60);
    const lowerBound = 0;
    const safeMedian = Number.isFinite(Number(median)) ? Number(median) : percentile(durations, 0.5);
    const safeQ1 = Number.isFinite(Number(q1)) ? Number(q1) : percentile(durations, 0.25);
    const safeQ3 = Number.isFinite(Number(q3)) ? Number(q3) : percentile(durations, 0.75);
    const width = 720;
    const height = 260;
    const paddingX = 28;
    const topPad = 28;
    const bottomPad = 54;
    const centerY = 118;
    const halfHeight = 62;
    const innerWidth = width - (paddingX * 2);
    const sampleCount = Math.max(30, Math.min(48, Math.round(durations.length * 1.4)));
    const bandwidth = Math.max(16, Math.min(120, upperBound / Math.max(6, Math.min(14, Math.round(Math.sqrt(durations.length) + 4)))));
    const valueToX = value => paddingX + (1 - ((Math.max(lowerBound, Math.min(upperBound, value)) - lowerBound) / (upperBound - lowerBound || 1))) * innerWidth;

    const densityPoints = Array.from({ length: sampleCount }, (_, index) => {
      const ratio = sampleCount === 1 ? 0 : index / (sampleCount - 1);
      const value = lowerBound + ((upperBound - lowerBound) * ratio);
      const density = durations.reduce((sum, current) => {
        const z = (current - value) / bandwidth;
        return sum + Math.exp(-0.5 * z * z);
      }, 0);
      return { value, density };
    }).map((point, index, array) => {
      const neighbours = [array[index - 1], point, array[index + 1]].filter(Boolean);
      return {
        ...point,
        density: average(neighbours.map(entry => entry.density))
      };
    });

    const maxDensity = Math.max(...densityPoints.map(point => point.density), 1);
    const scaledPoints = densityPoints.map(point => ({
      ...point,
      radius: (point.density / maxDensity) * halfHeight,
      x: valueToX(point.value)
    }));

    const upperPath = scaledPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${(centerY - point.radius).toFixed(2)}`).join(' ');
    const lowerPath = [...scaledPoints].reverse().map(point => `L ${point.x.toFixed(2)} ${(centerY + point.radius).toFixed(2)}`).join(' ');
    const violinPath = `${upperPath} ${lowerPath} Z`;
    const centerLine = `M ${paddingX} ${centerY} L ${width - paddingX} ${centerY}`;
    const q1x = valueToX(safeQ1);
    const q3x = valueToX(safeQ3);
    const medianX = valueToX(safeMedian);
    const peakPoint = scaledPoints.reduce((best, point) => point.density > best.density ? point : best, scaledPoints[0]);
    const peakValue = peakPoint?.value || safeMedian;

    const tickStep = upperBound <= 90 ? 15 : upperBound <= 180 ? 30 : upperBound <= 360 ? 60 : upperBound <= 720 ? 120 : 240;
    const tickValues = [];
    for (let value = 0; value <= upperBound + 0.001; value += tickStep) tickValues.push(value);
    if (!tickValues.length || tickValues[tickValues.length - 1] < upperBound) tickValues.push(upperBound);
    const uniqueTicks = [...new Set(tickValues.map(value => Math.max(0, Math.min(upperBound, Math.round(value)))))];
    const tickMarkup = uniqueTicks.map(value => {
      const x = valueToX(value);
      return `<g class="interval-violin-tick"><line x1="${x}" y1="${centerY + halfHeight + 8}" x2="${x}" y2="${centerY + halfHeight + 18}" /><text x="${x}" y="${height - 14}" text-anchor="middle">${escapeHtml(compactDuration(value))}</text></g>`;
    }).join('');

    return `
      <section class="interval-violin-card" aria-label="Verteilung der Rauchpausen als horizontaler Violin-Plot">
        <div class="interval-violin-head">
          <div>
            <strong>Verteilung der Rauchpausen</strong>
            <small>${escapeHtml(subtitle || 'Horizontaler Violin-Plot')}</small>
          </div>
          <span class="badge muted">${escapeHtml(qualityLabel || 'Verteilung')}</span>
        </div>
        <div class="interval-violin-shell">
          <svg class="interval-violin-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Links liegen längere Pausen, rechts kürzere Abstände zwischen Zigaretten.">
            <defs>
              <linearGradient id="interval-violin-fill" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#8ff0a7" stop-opacity="0.88" />
                <stop offset="45%" stop-color="#4ad7d1" stop-opacity="0.9" />
                <stop offset="100%" stop-color="#b79cff" stop-opacity="0.82" />
              </linearGradient>
            </defs>
            <rect class="interval-violin-bg" x="${paddingX}" y="${topPad}" width="${innerWidth}" height="${(halfHeight * 2)}" rx="28" />
            <path class="interval-violin-axis-line" d="${centerLine}"></path>
            <line class="interval-violin-iqr" x1="${q3x}" y1="${centerY}" x2="${q1x}" y2="${centerY}"></line>
            <path class="interval-violin-area" d="${violinPath}"></path>
            <line class="interval-violin-median" x1="${medianX}" y1="${centerY - halfHeight - 8}" x2="${medianX}" y2="${centerY + halfHeight + 8}"></line>
            <circle class="interval-violin-peak" cx="${valueToX(peakValue)}" cy="${centerY}" r="5"></circle>
            ${tickMarkup}
          </svg>
        </div>
        <div class="interval-violin-caption">
          <p><b>Leserichtung:</b> links = längere Pausen · rechts = dichtere Rauchmomente.</p>
          <div class="interval-violin-legend">
            <span><i class="is-fill"></i>Dichteform</span>
            <span><i class="is-iqr"></i>mittlere 50%</span>
            <span><i class="is-median"></i>Median</span>
            <span><i class="is-peak"></i>Dichte-Peak ${escapeHtml(compactDuration(peakValue))}</span>
          </div>
        </div>
      </section>
    `;
  }



  function loadCoachSession() {
    try {
      const raw = localStorage.getItem(COACH_SESSION_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        urgeLevel: Math.max(1, Math.min(5, Number(parsed.urgeLevel || 3))),
        trigger: COACH_TRIGGER_META[parsed.trigger] ? parsed.trigger : 'stress',
        delayUntil: Number(parsed.delayUntil || 0),
        delayStartedAt: Number(parsed.delayStartedAt || 0)
      };
    } catch {
      return { urgeLevel: 3, trigger: 'stress', delayUntil: 0, delayStartedAt: 0 };
    }
  }

  function saveCoachSession() {
    localStorage.setItem(COACH_SESSION_KEY, JSON.stringify(coachSession));
  }

  function updateCoachCheckIn() {
    coachSession.urgeLevel = Math.max(1, Math.min(5, Number(els.coachUrgeLevel?.value || 3)));
    coachSession.trigger = COACH_TRIGGER_META[els.coachTrigger?.value] ? els.coachTrigger.value : 'stress';
    saveCoachSession();
    renderCoach();
  }

  function coachTaskBody(task) {
    if (!task) return 'Keine aktive Aufgabe blockiert gerade deinen Fokus. Nutze die freie Kapazität für einen kleinen Habit-Log.';
    const priority = taskPriorityMeta(task).label;
    const dueText = task.due_at ? ` · fällig ${formatDateTime(task.due_at)}` : '';
    const verb = task.status === 'in_progress' ? 'weiterführen' : 'in Bearbeitung ziehen';
    return `${priority}: „${task.title}“ ${verb}. Starte nur mit dem kleinsten nächsten Schritt von 5 Minuten${dueText}.`;
  }

  function coachHabitBody(habit, loggedCount, totalCount) {
    if (!habit) return totalCount ? `${loggedCount}/${totalCount} Habits sind heute bereits geloggt. Halte den Rhythmus ruhig weiter.` : 'Noch keine aktiven Habits vorhanden. Lege einen kleinen, messbaren Habit an.';
    const unit = habit.unit || defaultUnit(habit.type);
    const target = habit.target ? ` Ziel: ${habit.target}${unit ? ` ${unit}` : ''}.` : '';
    return `Heute fehlt noch „${habit.name}“. Logge eine kleine saubere Einheit statt perfekt zu planen.${target}`;
  }

  function buildCoachInsight() {
    const now = new Date();
    const todayKey = toDateKey(now);
    const last = getLastCigarette();
    const pauseMinutes = last ? Math.max(0, Math.floor((Date.now() - new Date(last.smoked_at).getTime()) / 60000)) : null;
    const todayCount = cigarettesOnDate(todayKey).length;
    const last7Keys = daysBack(7);
    const cigarettes7 = state.cigarettes.filter(c => last7Keys.includes(toDateKey(c.smoked_at))).length;
    const avgPerDay = cigarettes7 ? cigarettes7 / 7 : 0;
    const alcoholToday = Boolean(alcoholForDate(todayKey)?.consumed);
    const trigger = COACH_TRIGGER_META[coachSession.trigger] || COACH_TRIGGER_META.stress;
    const urge = Math.max(1, Math.min(5, Number(coachSession.urgeLevel || 3)));
    const bestPause = bestPauseMinutes();
    const hour = now.getHours();
    const activeDelay = coachSession.delayUntil && coachSession.delayUntil > Date.now();
    const delayDone = coachSession.delayUntil && coachSession.delayUntil <= Date.now() && Date.now() - coachSession.delayUntil < 90 * 60 * 1000;
    const alcoholUnitsToday = alcoholUnitsOnDate(todayKey).length;
    const activeTasks = state.tasks.filter(isActiveTask).sort(compareTasks);
    const inProgressTasks = activeTasks.filter(task => task.status === 'in_progress');
    const overdueTasks = activeTasks.filter(task => task.due_at && new Date(task.due_at).getTime() < Date.now());
    const focusTask = [...activeTasks].sort(compareTasks)[0] || null;
    const activeHabits = state.habits.filter(habit => !habit.is_archived);
    const loggedHabitIdsToday = new Set(state.habitEntries.filter(entry => toDateKey(entry.occurred_at) === todayKey).map(entry => entry.habit_id));
    const missingHabits = activeHabits.filter(habit => !loggedHabitIdsToday.has(habit.id));
    const focusHabit = missingHabits[0] || null;
    const habitLoggedCount = activeHabits.length - missingHabits.length;
    const habitCompletion = activeHabits.length ? habitLoggedCount / activeHabits.length : 1;

    let risk = 14 + urge * 13;
    if (pauseMinutes == null) risk -= 6;
    else if (pauseMinutes < 10) risk += 20;
    else if (pauseMinutes < 30) risk += 16;
    else if (pauseMinutes < 60) risk += 8;
    else if (pauseMinutes >= 120) risk -= 8;
    if (urge >= 4) risk += 8;
    if (alcoholToday || coachSession.trigger === 'alcohol') risk += 15;
    if (todayCount > Math.max(1, Math.ceil(avgPerDay))) risk += 10;
    if (overdueTasks.length) risk += Math.min(12, overdueTasks.length * 4);
    if (focusTask && taskPriorityMeta(focusTask).rank >= 3) risk += 5;
    if (activeHabits.length && habitCompletion < .5) risk += 4;
    if (inProgressTasks.length) risk -= 3;
    if (hour >= 21 || hour < 7) risk += 6;
    if (activeDelay) risk -= 10;
    risk = Math.max(8, Math.min(95, Math.round(risk)));

    let label = 'Stabil';
    let tone = 'low';
    if (risk >= 72) { label = 'Akut'; tone = 'high'; }
    else if (risk >= 48) { label = 'Wachsam'; tone = 'mid'; }

    let headline = 'Baue die nächste Pause aus.';
    let coachLine = 'Du bist nicht im Autopilot. Du brauchst jetzt keine perfekte Entscheidung, nur den nächsten kleinen besseren Schritt.';
    if (!last) {
      headline = 'Starte deinen Referenzpunkt.';
      coachLine = 'Noch kein Rauchverlauf vorhanden. Tracke ehrlich, dann kann der Coach immer genauer werden.';
    } else if (activeDelay) {
      headline = 'Nicht verhandeln – halten.';
      coachLine = 'Der wichtigste Teil läuft bereits: Du hast eine Pause aktiv verlängert. Bleib bei der Challenge bis der Timer durch ist.';
    } else if (urge >= 5) {
      headline = 'Akuter Drang: Entscheidung sofort verlangsamen.';
      coachLine = 'Der Drang ist gerade sehr hoch. Der Coach wechselt auf Akutmodus: keine grosse Diskussion, nur 90 Sekunden Reset und dann 10 Minuten Abstand.';
    } else if (pauseMinutes < 30) {
      headline = 'Nicht nachlegen. Erst 10 Minuten Puffer.';
      coachLine = urge >= 4
        ? 'Der Abstand ist kurz und der Drang hoch. Genau hier entstehen Ketten – starte den Puffer, bevor du neu entscheidest.'
        : 'Der Abstand ist noch kurz. Ziel ist nicht Verzicht für immer, sondern diese eine Lücke zu vergrössern.';
    } else if (coachSession.trigger === 'tasks' || overdueTasks.length) {
      headline = overdueTasks.length ? 'Fokus zurückholen: eine überfällige Aufgabe reicht.' : 'Aufgaben-Druck in Bewegung verwandeln.';
      coachLine = focusTask
        ? `Der Coach sieht deine offenen Aufgaben. Starte nicht alles, sondern nur „${focusTask.title}“ mit einem 5-Minuten-Schritt.`
        : 'Der Coach sieht gerade keinen aktiven Task. Lege bei Bedarf eine kleine Karte an und starte mit dem ersten sichtbaren Schritt.';
    } else if (coachSession.trigger === 'habits' || focusHabit) {
      headline = focusHabit ? 'Ein kleiner Habit-Log stabilisiert den Tag.' : 'Habit-Rhythmus halten, ohne Druck.';
      coachLine = focusHabit
        ? `Heute ist „${focusHabit.name}“ noch offen. Logge eine kleine Einheit – nicht perfekt, nur messbar.`
        : 'Deine aktiven Habits sind heute gut im Rhythmus. Halte es leicht und nutze den Flow für die nächste kleine Entscheidung.';
    } else if (alcoholToday || coachSession.trigger === 'alcohol') {
      headline = 'Alkohol-Trigger entschärfen.';
      coachLine = 'Heute zählt Umgebung stärker als Willenskraft. Verlasse kurz die Rauch-Situation und trink Wasser, bevor du neu entscheidest.';
    } else if (urge >= 4) {
      headline = 'Drang ist hoch – Welle reiten.';
      coachLine = 'Ein starkes Craving ist unangenehm, aber nicht automatisch ein Auftrag. Beobachte es ein paar Minuten und verschiebe die Entscheidung.';
    } else if (focusTask && inProgressTasks.length) {
      headline = 'Bleib bei der Aufgabe in Bearbeitung.';
      coachLine = 'Du hast bereits aktiven Fokus markiert. Nicht Kontext wechseln – mach den nächsten kleinsten Schritt sichtbar.';
    } else if (todayCount > Math.max(1, Math.ceil(avgPerDay))) {
      headline = 'Heute nicht eskalieren.';
      coachLine = 'Du liegst über deinem aktuellen Muster. Ein einziges Delay kann den Tag wieder stabilisieren.';
    }

    const nextGoal = getNextPauseGoalMinutes(pauseMinutes);
    const microGoal = pauseMinutes == null ? 'Erste Pause setzen' : `${formatDuration(pauseMinutes)} → ${formatDuration(nextGoal)}`;
    const comparison = avgPerDay ? `${todayCount} Zig. · Ø ${avgPerDay.toFixed(1).replace('.', ',')}/Tag · ${alcoholUnitsToday} Alk.-Einh.` : `${todayCount} Zig. · ${alcoholUnitsToday} Alk.-Einh. · wenig Historie`;
    const taskText = focusTask ? `${taskPriorityMeta(focusTask).short} · ${focusTask.title}` : activeTasks.length ? `${activeTasks.length} aktive Aufgaben` : 'keine aktive Aufgabe';
    const habitText = activeHabits.length ? `${habitLoggedCount}/${activeHabits.length} heute` : 'noch keine Habits';
    const bestText = bestPause ? formatDuration(bestPause) : '–';
    const stage = urge >= 5 ? 'Akutmodus' : pauseMinutes == null ? 'Start' : pauseMinutes < 30 ? 'Akutphase' : pauseMinutes < 120 ? 'Aufbau' : 'Highscore-Jagd';
    const urgency = urge >= 5
      ? { delay: activeDelay ? 'Timer fertig laufen lassen. Keine neue Diskussion starten.' : '90 Sekunden ruhig bleiben, dann die 10-Minuten-Challenge starten.', reset: 'Kaltes Wasser, 6 lange Ausatmungen und physisch weg vom Trigger.' }
      : urge >= 4
        ? { delay: activeDelay ? 'Timer fertig laufen lassen. Keine neue Diskussion starten.' : '10-Minuten-Challenge starten. Danach nicht automatisch rauchen, sondern neu bewerten.', reset: 'Craving-Welle loggen: benennen, atmen, warten, erst dann entscheiden.' }
        : urge <= 2
          ? { delay: activeDelay ? 'Timer fertig laufen lassen und nebenbei etwas Kleines erledigen.' : 'Nutze den niedrigen Drang: verlängere die Pause direkt bis zum nächsten Mini-Ziel.', reset: 'Kurz Wasser trinken und bewusst stolz registrieren, dass gerade Spielraum da ist.' }
          : { delay: activeDelay ? 'Timer fertig laufen lassen. Keine neue Diskussion starten.' : '10-Minuten-Challenge starten und erst danach neu entscheiden.', reset: 'Ein Glas Wasser und mindestens 20 Schritte weg vom Trigger-Ort.' };

    const personality = buildCoachPersonality({ activeHabits, focusHabit, activeTasks, overdueTasks, habitCompletion });
    if (!activeDelay && urge <= 4 && personality) {
      if (personality.planningStyle === 'overplanned' && focusHabit) {
        coachLine = `Dein Muster wirkt gerade eher überplant als unmotiviert. Reduziere „${focusHabit.name}“ auf die Minimum-Version und schliesse genau diese eine Sache sauber ab.`;
      } else if (personality.strongerTime === 'evening' && focusHabit && hour < 17) {
        coachLine = `Dein Verlauf zeigt: abends klappt es besser als morgens. Plane „${focusHabit.name}“ bewusst für ${personality.suggestedTimeLabel} und halte es bis dahin klein statt mit Druck.`;
      } else if (personality.strongerTime === 'morning' && focusHabit && hour >= 18) {
        coachLine = `Du bist morgens verlässlicher als spät am Tag. Wenn „${focusHabit.name}“ heute noch offen ist, entscheide dich eher für eine Minimum-Version und plane die Hauptsession auf morgen früh.`;
      } else if (personality.highRiskWeekday?.isToday) {
        coachLine = `${personality.highRiskWeekday.label} kippen bei dir schneller. Heute zählt ein ruhiger Einstieg mehr als Motivation – Minimum-Version, dann neu bewerten.`;
      }
    }

    const steps = [
      focusTask ? { icon: 'tasks', title: 'Task-Fokus', body: coachTaskBody(focusTask) } : { icon: 'delay', title: 'Delay', body: urgency.delay },
      focusHabit ? { icon: habitIconKey(focusHabit), title: 'Habit-Fokus', body: personality?.planningStyle === 'overplanned' ? `${coachHabitBody(focusHabit, habitLoggedCount, activeHabits.length)} Minimum-Version reicht heute vollkommen.` : coachHabitBody(focusHabit, habitLoggedCount, activeHabits.length) } : { icon: 'reset', title: 'Reset', body: urgency.reset },
      { icon: trigger.icon, title: trigger.label, body: trigger.action }
    ];

    return { risk, label, tone, headline, coachLine, microGoal, comparison, taskText, habitText, bestText, stage, pauseMinutes, todayCount, avgPerDay, alcoholToday, alcoholUnitsToday, trigger, urge, activeDelay, delayDone, activeTasks, overdueTasks, focusTask, focusHabit, habitLoggedCount, activeHabits, steps, personality };
  }

  function renderCoach() {
    if (!els.coachResult || !els.coachPlanGrid) return;
    if (els.coachUrgeLevel && String(els.coachUrgeLevel.value) !== String(coachSession.urgeLevel)) els.coachUrgeLevel.value = String(coachSession.urgeLevel);
    if (els.coachTrigger && els.coachTrigger.value !== coachSession.trigger) els.coachTrigger.value = coachSession.trigger;

    const insight = buildCoachInsight();
    const badgeClass = insight.tone === 'high' ? 'danger-badge' : insight.tone === 'mid' ? 'warning-badge' : 'muted';
    if (els.coachRiskBadge) {
      els.coachRiskBadge.className = `badge ${badgeClass}`;
      els.coachRiskBadge.textContent = insight.label;
    }
    if (els.coachConfidence) {
      els.coachConfidence.className = `coach-confidence-score is-${insight.tone}`;
      els.coachConfidence.innerHTML = `<strong>${insight.risk}%</strong><span>Risiko</span>`;
    }

    els.coachChallengeCard.innerHTML = renderCoachChallenge(insight);
    const focusTaskTitle = insight.focusTask ? insight.focusTask.title : 'keine aktive Aufgabe';
    const focusHabitTitle = insight.focusHabit ? insight.focusHabit.name : (insight.activeHabits.length ? 'alle aktiven Habits geloggt' : 'noch keine Habits');
    const personality = insight.personality || null;
    const personalityBlock = personality ? `<article class="coach-personality-card">
      <div class="coach-personality-head">
        <span>${svgIcon('coach', 'ui-icon')}</span>
        <div><small>Coach-Persönlichkeit</small><strong>${escapeHtml(personality.title)}</strong><p>${escapeHtml(personality.body)}</p></div>
      </div>
      <div class="coach-personality-tags">
        ${personality.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}
      </div>
    </article>` : '';
    els.coachResult.innerHTML = `
      <div class="coach-result-topline"><small>${escapeHtml(insight.stage)} · Drang ${insight.urge}/5</small><h3>${escapeHtml(insight.headline)}</h3><p>${escapeHtml(insight.coachLine)}</p></div>
      <div class="coach-context-grid">
        <article class="coach-context-card is-primary"><span>${svgIcon('delay', 'ui-icon')}</span><div><small>Mini-Ziel</small><strong>${escapeHtml(insight.microGoal)}</strong><p>${escapeHtml(insight.comparison)}</p></div></article>
        <article class="coach-context-card"><span>${svgIcon('tasks', 'ui-icon')}</span><div><small>Aufgaben</small><strong>${escapeHtml(focusTaskTitle)}</strong><p>${escapeHtml(insight.taskText)}</p></div></article>
        <article class="coach-context-card"><span>${svgIcon(insight.focusHabit ? habitIconKey(insight.focusHabit) : 'habits', 'ui-icon')}</span><div><small>Habits</small><strong>${escapeHtml(focusHabitTitle)}</strong><p>${escapeHtml(insight.habitText)}</p></div></article>
        <article class="coach-context-card"><span>${svgIcon(insight.trigger.icon, 'ui-icon')}</span><div><small>Kontext</small><strong>${insight.alcoholToday ? 'Alkohol aktiv' : escapeHtml(insight.trigger.label)}</strong><p>Beste Pause: ${escapeHtml(insight.bestText)}</p></div></article>
      </div>
      ${personalityBlock}
      <div class="coach-callout"><b>Nächster Schritt:</b> ${escapeHtml(insight.steps[0].body)} <em>${escapeHtml(insight.microGoal)}</em></div>`;
    els.coachPlanGrid.innerHTML = insight.steps.map((step, index) => `<article class="coach-plan-card"><span>${svgIcon(step.icon, 'ui-icon')}</span><small>Schritt ${index + 1}</small><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.body)}</p></article>`).join('');
  }

  function renderCoachChallenge(insight) {
    const remainingMs = Math.max(0, Number(coachSession.delayUntil || 0) - Date.now());
    if (remainingMs > 0) {
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      return `<div><p class="eyebrow">Challenge läuft</p><h3>${remainingMinutes} Min. halten</h3><span>Bis ${new Date(coachSession.delayUntil).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}. Danach bewusst neu entscheiden – nicht automatisch.</span></div><div class="coach-challenge-meter"><i style="width:${coachChallengeProgress()}%"></i></div>`;
    }
    if (insight.delayDone) {
      return `<div><p class="eyebrow">Geschafft</p><h3>Delay abgeschlossen.</h3><span>Du hast den Autopilot unterbrochen. Jetzt neu wählen: noch 10 Minuten, Atem-Reset oder bewusst loggen.</span></div>`;
    }
    return `<div><p class="eyebrow">Mini-Challenge</p><h3>Nur die nächste Lücke zählt.</h3><span>Starte einen 10-Minuten-Puffer. Der Coach merkt sich den Timer auch nach einem Refresh.</span></div>`;
  }

  function coachChallengeProgress() {
    const start = Number(coachSession.delayStartedAt || 0);
    const end = Number(coachSession.delayUntil || 0);
    if (!start || !end || end <= start) return 0;
    return Math.max(4, Math.min(100, ((Date.now() - start) / (end - start)) * 100));
  }

  function startCoachDelay() {
    const now = Date.now();
    coachSession.delayStartedAt = now;
    coachSession.delayUntil = now + 10 * 60 * 1000;
    saveCoachSession();
    renderCoach();
    toast('10-Minuten-Challenge gestartet');
  }

  function coachBreathReset() {
    logMeditationTechnique('urge-surf');
    startCoachDelay();
  }

  function coachRecordSmoke() {
    recordCigarette();
    coachSession.delayUntil = 0;
    coachSession.delayStartedAt = 0;
    saveCoachSession();
    closeCoachModal();
    showScreen('smoking');
  }

  function renderHabits() {
    const activeInput = document.activeElement?.closest?.('#habitCards input[id^="habit-input-"]') || null;
    const activeInputId = activeInput?.id || '';
    const activeInputSelection = activeInput ? { start: activeInput.selectionStart, end: activeInput.selectionEnd } : null;
    const habitInputDrafts = collectHabitInputDrafts();
    const activeHabits = state.habits.filter(h => !h.is_archived).map(normalizeHabit);
    pruneExpandedHabitCardIds(activeHabits.map(habit => habit.id));
    renderHabitDnaOverview(activeHabits);
    if (!activeHabits.length) {
      els.habitCards.innerHTML = '<div class="empty-state">Lege deine erste flexible Gewohnheit an. Unterstützt werden Gewicht, Zahlen, Ja/Nein und Dauer.</div>';
      return;
    }

    els.habitCards.innerHTML = activeHabits.map(habit => {
      const periodMeta = habitTargetPeriodMeta(habit);
      const periodValue = habitValueForPeriod(habit);
      const todayEntries = entriesForHabitOnDate(habit.id, toDateKey(new Date()));
      const todayValue = habit.type === 'boolean'
        ? todayEntries.some(e => e.value_bool)
        : todayEntries.reduce((sum, e) => sum + Number(e.value_num || 0), 0);
      const progress = habit.target ? Math.min(100, Math.abs(Number(periodValue.value || 0) / Number(habit.target)) * 100) : 0;
      const unit = habit.unit || defaultUnit(habit.type);
      const isSystemHabit = isSystemMeditationHabit(habit);
      const isExpanded = expandedHabitCardIds.has(habit.id) || editingHabitId === habit.id || editingHabitEntryId && state.habitEntries.some(entry => entry.id === editingHabitEntryId && entry.habit_id === habit.id);
      const dna = buildHabitDna(habit);
      const control = isSystemHabit
        ? renderMeditationHabitControl(habit)
        : habit.type === 'boolean'
          ? `<button class="pill primary" type="button" data-action="log-habit" data-id="${habit.id}">${todayValue ? 'Heute erledigt' : 'Heute abhaken'}</button>`
          : `<div class="habit-log-row"><input id="habit-input-${habit.id}" type="number" step="0.01" placeholder="Wert ${unit ? `(${escapeHtml(unit)})` : ''}" /><button class="pill primary" type="button" data-action="log-habit" data-id="${habit.id}">Loggen</button></div>`;
      const habitActions = isSystemHabit
        ? `<button class="mini-btn" type="button" data-action="edit-habit" data-id="${habit.id}">Bearbeiten</button><span class="badge muted">System</span>`
        : `<button class="mini-btn" type="button" data-action="edit-habit" data-id="${habit.id}">Bearbeiten</button><button class="mini-btn" type="button" data-action="archive-habit" data-id="${habit.id}">Archiv</button><button class="mini-btn danger" type="button" data-action="delete-habit" data-id="${habit.id}">Löschen</button>`;
      const todayLabel = formatHabitValue(habit, todayValue);
      const completionLabel = `${Math.round(dna.completionRate * 100)}% Treffer`;
      const targetLabel = habit.target ? `${periodMeta.short}: ${periodValue.label} / Ziel ${habit.target}${unit ? ` ${unit}` : ''}` : 'ohne Zielwert';
      const activityLabel = todayEntries.length ? `${todayEntries.length} Log${todayEntries.length === 1 ? '' : 's'} heute` : 'heute offen';
      const detailsId = `habit-details-${escapeHtml(habit.id)}`;

      return `<article class="habit-card ${isSystemHabit ? 'is-meditation-habit' : ''} ${editingHabitId === habit.id ? 'is-editing' : ''} ${isExpanded ? 'is-expanded' : 'is-collapsed'}">
        <button class="habit-card-summary" type="button" data-action="toggle-habit-card" data-id="${habit.id}" aria-expanded="${isExpanded}" aria-controls="${detailsId}">
          <span class="habit-title"><span class="habit-icon">${svgIcon(habitIconKey(habit), 'ui-icon')}</span><span><strong>${escapeHtml(habit.name)}</strong><small>${habit.typeLabel || typeLabel(habit.type)}${unit ? ` · ${escapeHtml(unit)}` : ''} · ${escapeHtml(periodMeta.label)}</small></span></span>
          <span class="habit-card-status">
            <span class="habit-card-value">Heute: <strong>${escapeHtml(todayLabel)}</strong></span>
            <span class="habit-expand-indicator" aria-hidden="true">${isExpanded ? '−' : '+'}</span>
          </span>
          <span class="habit-card-compact-meta">
            <span>${escapeHtml(activityLabel)}</span>
            <span>${escapeHtml(completionLabel)}</span>
            <span>${escapeHtml(targetLabel)}</span>
          </span>
        </button>
        <div id="${detailsId}" class="habit-card-details">
          <div class="habit-card-actions-row"><span class="badge ${dna.riskMeta.tone === 'high' ? 'danger-badge' : dna.riskMeta.tone === 'mid' ? 'warning-badge' : 'muted'}">Risiko ${escapeHtml(dna.riskMeta.label)}</span><div class="list-actions">${habitActions}</div></div>
          ${control}
          <div class="meta">Heute: <strong>${escapeHtml(todayLabel)}</strong>${habit.target ? ` · ${periodMeta.short}: <strong>${escapeHtml(periodValue.label)}</strong> / Ziel ${habit.target} ${escapeHtml(unit)}` : ''}</div>
          ${habit.target ? `<div class="habit-progress-track"><i style="width:${progress}%"></i></div>` : ''}
          ${renderHabitDnaVisual(dna)}
          ${renderHabitEntryList(habit)}
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

  function timeBucketForHour(hour) {
    const h = Math.max(0, Math.min(23, Number(hour || 0)));
    if (h < 7) return 'early';
    if (h < 11) return 'morning';
    if (h < 14) return 'midday';
    if (h < 18) return 'afternoon';
    if (h < 22) return 'evening';
    return 'late';
  }

  function modeOf(values = [], fallback = '') {
    if (!values.length) return fallback;
    const scores = new Map();
    values.forEach(value => scores.set(value, (scores.get(value) || 0) + 1));
    return [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || fallback;
  }

  function aggregateHabitEntriesValue(habit, entries = []) {
    if (!entries.length) return 0;
    if (habit.type === 'boolean') return entries.some(entry => entry.value_bool) ? 1 : 0;
    if (habit.type === 'weight') return Number(entries.sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at)).at(-1)?.value_num || 0);
    return sum(entries.map(entry => Number(entry.value_num || 0)));
  }

  function habitPeriodWindows(periodKey, count = 4) {
    const windows = [];
    const now = new Date();
    if (periodKey === 'day') {
      for (let i = count - 1; i >= 0; i -= 1) {
        const day = new Date(now);
        day.setDate(now.getDate() - i);
        day.setHours(0, 0, 0, 0);
        const end = new Date(day);
        end.setHours(23, 59, 59, 999);
        windows.push({ start: day, end, key: toDateKey(day) });
      }
      return windows;
    }
    if (periodKey === 'week') {
      for (let i = count - 1; i >= 0; i -= 1) {
        const start = startOfIsoWeek(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7));
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        windows.push({ start, end, key: isoWeekInfo(start).key });
      }
      return windows;
    }
    for (let i = count - 1; i >= 0; i -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      end.setHours(23, 59, 59, 999);
      windows.push({ start, end, key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}` });
    }
    return windows;
  }

  function habitCompletionRate(habit) {
    if (!habit.target) return state.habitEntries.some(entry => entry.habit_id === habit.id) ? 0.72 : 0;
    const period = normalizeHabitTargetPeriod(habit.target_period);
    const windows = habitPeriodWindows(period, period === 'month' ? 3 : period === 'week' ? 5 : 10);
    if (!windows.length) return 0;
    const successes = windows.filter(window => {
      const entries = state.habitEntries.filter(entry => entry.habit_id === habit.id && new Date(entry.occurred_at) >= window.start && new Date(entry.occurred_at) <= window.end);
      return aggregateHabitEntriesValue(habit, entries) >= Number(habit.target || 0);
    }).length;
    return successes / windows.length;
  }

  function habitShapeKey(habit, entries = []) {
    if (habit.type === 'boolean') return 'short';
    if (habit.type === 'duration') {
      const avg = entries.length ? sum(entries.map(entry => Number(entry.value_num || 0))) / entries.length : Number(habit.target || 0);
      if (avg <= 12) return 'short';
      if (avg <= 30) return 'medium';
      return 'long';
    }
    if (habit.type === 'number') {
      const avg = entries.length ? sum(entries.map(entry => Number(entry.value_num || 0))) / entries.length : Number(habit.target || 0);
      if (avg <= 2) return 'short';
      if (avg <= 6) return 'medium';
      return 'long';
    }
    return 'medium';
  }

  function habitBodyKey(habit) {
    return isPhysicalHabit(habit) ? 'physical' : habitIconKey(habit) === 'meditation' ? 'calming' : 'abstract';
  }

  function habitRiskMeta(score) {
    if (score >= 68) return { label: 'hoch', tone: 'high' };
    if (score >= 40) return { label: 'mittel', tone: 'mid' };
    return { label: 'niedrig', tone: 'low' };
  }

  function habitShapeLabel(key) {
    return { short: 'kurz', medium: 'mittel', long: 'lang' }[key] || 'flexibel';
  }

  function habitBodyLabel(key) {
    return { physical: 'körperlich', calming: 'beruhigend', abstract: 'abstrakt' }[key] || 'flexibel';
  }

  function buildHabitDna(habit) {
    const entries = state.habitEntries.filter(entry => entry.habit_id === habit.id).sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
    const recent = entries.filter(entry => Date.now() - new Date(entry.occurred_at).getTime() <= 45 * DAY_MS);
    const lastLoggedAt = entries[0]?.occurred_at || null;
    const daysSinceLog = lastLoggedAt ? Math.max(0, Math.floor((Date.now() - new Date(lastLoggedAt).getTime()) / DAY_MS)) : 999;
    const dominantTime = recent.length >= 3
      ? modeOf(recent.slice(0, 18).map(entry => timeBucketForHour(new Date(entry.occurred_at).getHours())), habit.dna_preferred_time)
      : habit.dna_preferred_time;
    const completionRate = habitCompletionRate(habit);
    let riskScore = Math.round((1 - completionRate) * 52 + daysSinceLog * 3 + Math.max(0, normalizeScaleValue(habit.dna_difficulty) - 3) * 7);
    if (!entries.length) riskScore += 15;
    riskScore = Math.max(8, Math.min(92, riskScore));
    const shapeKey = habitShapeKey(habit, recent.length ? recent : entries);
    const bodyKey = habitBodyKey(habit);
    const timeMeta = HABIT_DNA_TIME_META[normalizeHabitPreferredTime(dominantTime)] || HABIT_DNA_TIME_META.flexible;
    const riskMeta = habitRiskMeta(riskScore);
    const strengthScore = Math.max(0, Math.min(100, Math.round(100 - riskScore + completionRate * 18)));
    const patternText = `${habitShapeLabel(shapeKey)}, ${timeMeta.adverb} und ${habitBodyLabel(bodyKey)}`;
    const summary = completionRate >= 0.7
      ? `Läuft stabil, wenn du es ${timeMeta.adverb} und klar messbar hältst.`
      : `Braucht Reibung raus: ${HABIT_DNA_HURDLES[normalizeHabitHurdle(habit.dna_emotional_hurdle)]} ist hier der grösste Hebel.`;
    return {
      habit,
      entries,
      recent,
      completionRate,
      lastLoggedAt,
      daysSinceLog,
      difficulty: normalizeScaleValue(habit.dna_difficulty),
      energy: normalizeScaleValue(habit.dna_energy),
      timeKey: normalizeHabitPreferredTime(dominantTime),
      timeMeta,
      hurdleKey: normalizeHabitHurdle(habit.dna_emotional_hurdle),
      hurdleLabel: HABIT_DNA_HURDLES[normalizeHabitHurdle(habit.dna_emotional_hurdle)],
      triggerKey: normalizeHabitTrigger(habit.dna_trigger),
      triggerLabel: HABIT_DNA_TRIGGERS[normalizeHabitTrigger(habit.dna_trigger)],
      rewardKey: normalizeHabitReward(habit.dna_reward),
      rewardLabel: HABIT_DNA_REWARDS[normalizeHabitReward(habit.dna_reward)],
      riskScore,
      riskMeta,
      strengthScore,
      shapeKey,
      bodyKey,
      patternText,
      summary
    };
  }

  function groupPatternSummary(items = []) {
    if (!items.length) return 'noch ohne klares Muster';
    const shape = modeOf(items.map(item => item.shapeKey), 'short');
    const time = modeOf(items.map(item => item.timeKey), 'flexible');
    const body = modeOf(items.map(item => item.bodyKey), 'abstract');
    const timeMeta = HABIT_DNA_TIME_META[time] || HABIT_DNA_TIME_META.flexible;
    return `${habitShapeLabel(shape)}, ${timeMeta.adverb} und ${habitBodyLabel(body)}`;
  }

  function buildHabitDnaPortfolio(activeHabits = state.habits.filter(habit => !habit.is_archived)) {
    const profiles = activeHabits.map(habit => buildHabitDna(normalizeHabit(habit)));
    const dataRich = profiles.filter(profile => profile.entries.length || profile.habit.target);
    if (!profiles.length) return { profiles: [], headline: 'Noch keine Habit DNA vorhanden.', summary: 'Lege deine erste Gewohnheit an – danach entstehen automatisch Profile und Muster.', stableText: '–', fragileText: '–', coachStyle: 'ruhig starten' };
    const sortedByStrength = [...profiles].sort((a, b) => b.strengthScore - a.strengthScore);
    const strongest = sortedByStrength.slice(0, Math.min(2, sortedByStrength.length));
    const weakest = [...profiles].sort((a, b) => b.riskScore - a.riskScore).slice(0, Math.min(2, profiles.length));
    const stableText = groupPatternSummary(strongest);
    const fragileText = groupPatternSummary(weakest);
    const coachStyle = strongest.every(profile => profile.difficulty <= 3) && weakest.some(profile => profile.difficulty >= 4) ? 'sanfter Druck' : 'klare Challenges';
    const headline = dataRich.length >= 2
      ? `Deine stärksten Habits sind ${stableText}.`
      : 'Noch wenig Daten – die Habit DNA wird mit jedem Log persönlicher.';
    const summary = dataRich.length >= 2
      ? `Deine fragilsten Habits sind aktuell ${fragileText}. Genau dort sollte der Coach kleiner und gezielter werden.`
      : 'Sobald ein paar Logs vorhanden sind, erkennt Habbit ideale Zeiten, Reibung und Abbruchrisiko automatisch.';
    return { profiles, headline, summary, stableText, fragileText, strongest, weakest, coachStyle };
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

  function renderHabitDnaVisual(dna) {
    const riskText = dna.riskMeta.label === 'hoch' ? 'hoch' : dna.riskMeta.label === 'mittel' ? 'mittel' : 'niedrig';
    const expanded = expandedHabitDnaIds.has(dna.habit.id);
    const nodes = [
      { cls: 'difficulty', label: 'Schwierigkeit', value: `${dna.difficulty}/5` },
      { cls: 'energy', label: 'Energie', value: `${dna.energy}/5` },
      { cls: 'time', label: 'Zeit', value: dna.timeMeta.label },
      { cls: 'hurdle', label: 'Hürde', value: dna.hurdleLabel },
      { cls: 'trigger', label: 'Auslöser', value: dna.triggerLabel },
      { cls: 'reward', label: 'Belohnung', value: dna.rewardLabel },
      { cls: `risk is-${dna.riskMeta.tone}`, label: 'Abbruchrisiko', value: riskText }
    ];
    return `<section class="habit-dna-card ${expanded ? 'is-expanded' : 'is-collapsed'}">
      <button class="habit-dna-toggle" type="button" data-action="toggle-habit-dna" data-id="${dna.habit.id}" aria-expanded="${expanded}">
        <div class="habit-dna-toggle-copy">
          <p class="eyebrow">DNA-Profil</p>
          <strong>${escapeHtml(dna.patternText)}</strong>
          <small>${expanded ? 'Profil einklappen' : 'Profil anzeigen'}</small>
        </div>
        <div class="habit-dna-toggle-meta">
          <span class="badge ${dna.riskMeta.tone === 'high' ? 'danger-badge' : dna.riskMeta.tone === 'mid' ? 'warning-badge' : 'muted'}">${Math.round(dna.completionRate * 100)}% Treffer</span>
          <span class="habit-dna-toggle-arrow" aria-hidden="true">${expanded ? '–' : '+'}</span>
        </div>
      </button>
      <div class="habit-dna-body">
        <div class="habit-dna-map">
          ${nodes.map(node => `<article class="dna-node ${node.cls}"><small>${escapeHtml(node.label)}</small><strong>${escapeHtml(node.value)}</strong></article>`).join('')}
        </div>
        <p class="habit-dna-copy">${escapeHtml(dna.summary)}</p>
      </div>
    </section>`;
  }


  function riskySmokingWeekday(days = 42) {
    const cutoff = Date.now() - days * DAY_MS;
    const rows = state.cigarettes.filter(item => new Date(item.smoked_at).getTime() >= cutoff);
    if (rows.length < 8) return null;
    const counts = new Map();
    rows.forEach(item => {
      const day = new Date(item.smoked_at).getDay();
      counts.set(day, (counts.get(day) || 0) + 1);
    });
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!best) return null;
    const [day] = best;
    return { key: day, label: smokingWeekdayLabel(day), isToday: day === new Date().getDay() };
  }

  function dominantHabitTime(activeHabits = []) {
    const entries = state.habitEntries.filter(entry => activeHabits.some(habit => habit.id === entry.habit_id));
    if (entries.length < 4) return 'balanced';
    const buckets = entries.reduce((acc, entry) => {
      const hour = new Date(entry.occurred_at).getHours();
      if (hour >= 5 && hour < 11) acc.morning += 1;
      else if (hour >= 17 && hour < 23) acc.evening += 1;
      else acc.mid += 1;
      return acc;
    }, { morning: 0, evening: 0, mid: 0 });
    if (buckets.evening >= buckets.morning * 1.3 && buckets.evening >= 3) return 'evening';
    if (buckets.morning >= buckets.evening * 1.3 && buckets.morning >= 3) return 'morning';
    return 'balanced';
  }

  function buildCoachPersonality({ activeHabits = [], activeTasks = [], habitCompletion = 1 } = {}) {
    const portfolio = buildHabitDnaPortfolio(activeHabits);
    const strongerTime = dominantHabitTime(activeHabits);
    const highRiskWeekday = riskySmokingWeekday();
    const openLoad = activeHabits.length + activeTasks.length;
    const planningStyle = openLoad >= 8 && habitCompletion < 0.55 ? 'overplanned' : 'balanced';
    const supportStyle = portfolio.coachStyle === 'sanfter Druck' ? 'gentle' : 'challenge';
    const title = planningStyle === 'overplanned'
      ? 'Weniger Plan, mehr Abschluss'
      : strongerTime === 'evening'
        ? 'Timing schlägt Motivation'
        : strongerTime === 'morning'
          ? 'Frühe Fenster sind stärker'
          : 'Ruhige, klare Führung';
    const body = planningStyle === 'overplanned'
      ? 'Du planst aktuell mehr, als du sauber schliessen kannst. Der Coach reduziert deshalb lieber auf kleine machbare Schritte statt extra Druck zu machen.'
      : strongerTime === 'evening'
        ? 'Dein Verlauf zeigt mehr Zug am Abend als am Morgen. Der Coach priorisiert deshalb passende Uhrzeiten und Minimum-Versionen statt stumpfer Gamification.'
        : strongerTime === 'morning'
          ? 'Deine verlässlichsten Fenster liegen früher am Tag. Später wird der Coach eher auf Erhalt statt Eskalation setzen.'
          : `Dein System reagiert gut auf ${supportStyle === 'gentle' ? 'sanften Druck und klare Mini-Schritte' : 'sichtbare Mini-Challenges und klare Struktur'}.`;
    const tags = [];
    if (highRiskWeekday) tags.push(`${highRiskWeekday.label} sensibel`);
    if (strongerTime === 'evening') tags.push('abends stärker');
    else if (strongerTime === 'morning') tags.push('morgens stärker');
    if (planningStyle === 'overplanned') tags.push('Überplanung erkannt');
    tags.push(supportStyle === 'gentle' ? 'sanfter Druck' : 'klare Challenges');
    return { title, body, tags, strongerTime, planningStyle, supportStyle, highRiskWeekday, suggestedTimeLabel: strongerTime === 'evening' ? '20:30' : '08:00' };
  }

  function smokeCostMetrics() {
    const unitCost = 0.4;
    const todayKey = toDateKey(new Date());
    const last7 = daysBack(7);
    const last30 = daysBack(30);
    const totalCount = state.cigarettes.length;
    const todayCount = cigarettesOnDate(todayKey).length;
    const weekCount = state.cigarettes.filter(item => last7.includes(toDateKey(item.smoked_at))).length;
    const monthCount = state.cigarettes.filter(item => last30.includes(toDateKey(item.smoked_at))).length;
    const averagePerDay7 = weekCount / 7;
    return {
      unitCost,
      totalCount,
      todayCount,
      weekCount,
      monthCount,
      totalCost: totalCount * unitCost,
      todayCost: todayCount * unitCost,
      weekCost: weekCount * unitCost,
      monthCost: monthCount * unitCost,
      averagePerDay7,
      projectedMonthCost: averagePerDay7 * 30 * unitCost,
      projectedYearCost: averagePerDay7 * 365 * unitCost,
      saveTwoLessPerDay: 2 * 30 * unitCost
    };
  }

  function formatCurrencyChf(value) {
    return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(Number(value || 0));
  }

  function renderSmokeCostSummary() {
    const metrics = smokeCostMetrics();
    const breakdown = daysBack(10).reverse().map(key => {
      const count = cigarettesOnDate(key).length;
      return { key, count, cost: count * metrics.unitCost };
    }).filter(item => item.count > 0);
    return `<section class="smoke-cost-card">
      <div class="smoke-cost-hero">
        <div>
          <p class="eyebrow">40 Rappen pro Zigarette</p>
          <h3>${formatCurrencyChf(metrics.totalCost)} bisher</h3>
          <p>Heute ${metrics.todayCount} Zigarette${metrics.todayCount === 1 ? '' : 'n'} · ${formatCurrencyChf(metrics.todayCost)}. Auf Basis der letzten 7 Tage liegt dein aktuelles Monatsniveau bei ${formatCurrencyChf(metrics.projectedMonthCost)}.</p>
        </div>
        <span class="history-open-icon is-money">${svgIcon('money', 'ui-icon')}</span>
      </div>
      <div class="smoke-cost-grid">
        <article><small>Heute</small><strong>${formatCurrencyChf(metrics.todayCost)}</strong><span>${metrics.todayCount} Zigaretten</span></article>
        <article><small>7 Tage</small><strong>${formatCurrencyChf(metrics.weekCost)}</strong><span>${metrics.weekCount} Zigaretten</span></article>
        <article><small>30 Tage</small><strong>${formatCurrencyChf(metrics.monthCost)}</strong><span>${metrics.monthCount} Zigaretten</span></article>
        <article><small>Jahresprojektion</small><strong>${formatCurrencyChf(metrics.projectedYearCost)}</strong><span>auf aktuellem 7-Tage-Schnitt</span></article>
      </div>
      <div class="smoke-savings-strip">
        <span>${svgIcon('dna', 'ui-icon')}</span>
        <div><strong>Schon 2 Zigaretten weniger pro Tag sparen dir rund ${formatCurrencyChf(metrics.saveTwoLessPerDay)} pro Monat.</strong><small>Kleine Reduktionen sind finanziell sofort sichtbar – genau dafür ist dieser zweite Log-Button gedacht.</small></div>
      </div>
      <div class="habit-entry-list is-modal-list">
        <div class="habit-entry-list-head"><span>Letzte Tage</span><small>Kosten pro Tag</small></div>
        ${breakdown.length ? breakdown.map(item => `<article class="habit-entry-card"><div class="habit-entry-main"><strong>${new Date(item.key).toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit' })}</strong><span>${item.count} Zigaretten · ${formatCurrencyChf(item.cost)}</span></div><span class="badge muted">${formatCurrencyChf(item.cost)}</span></article>`).join('') : '<div class="habit-entry-list is-empty"><span>Noch keine Zigaretten erfasst – Kostenübersicht erscheint automatisch.</span></div>'}
      </div>
    </section>`;
  }

  function renderMeditationHabitControl(habit) {
    const expanded = expandedMeditationHabitId === habit.id;
    const sessionsToday = entriesForHabitOnDate(habit.id, toDateKey(new Date()));
    const minutesToday = sum(sessionsToday.map(entry => Number(entry.value_num || 0)));
    const latest = state.habitEntries
      .filter(entry => entry.habit_id === habit.id)
      .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))[0];
    return `<div class="meditation-habit-control">
      <div class="meditation-habit-copy">
        <strong>${minutesToday ? `${minutesToday} Min. heute` : 'Atemtechnik auswählen'}</strong>
        <span>${latest ? `Zuletzt: ${escapeHtml(latest.note || 'Meditation')} · ${formatDateTime(latest.occurred_at)}` : 'Techniken öffnen und als normalen Habit-Log speichern.'}</span>
      </div>
      <button class="pill primary" type="button" data-action="toggle-meditation-techniques" data-id="${habit.id}">${expanded ? 'Techniken ausblenden' : 'Techniken anzeigen'}</button>
    </div>
    ${expanded ? renderMeditationTechniqueDrawer() : ''}`;
  }

  function renderMeditationTechniqueDrawer() {
    return `<div class="meditation-technique-drawer">
      ${MEDITATION_TECHNIQUES.map(technique => `<article class="meditation-card compact">
        <div>
          <strong>${escapeHtml(technique.title)}</strong>
          <p>${escapeHtml(technique.subtitle)}</p>
          <small>${escapeHtml(technique.pattern)} · ${technique.minutes} Min.</small>
        </div>
        <button class="mini-btn primary" type="button" data-action="log-meditation" data-id="${escapeHtml(technique.key)}">Loggen</button>
      </article>`).join('')}
    </div>`;
  }

  function renderHabitEntryList(habit) {
    const entries = state.habitEntries
      .filter(entry => entry.habit_id === habit.id)
      .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
    const total = entries.length;
    const todayCount = entries.filter(entry => toDateKey(entry.occurred_at) === toDateKey(new Date())).length;
    const label = isSystemMeditationHabit(habit) ? 'Meditationslogs' : 'Habit-Logs';
    return `<button class="habit-log-open-card" type="button" data-action="open-habit-logs" data-id="${habit.id}">
      <span class="history-open-icon">${svgIcon('calendar', 'ui-icon')}</span>
      <span class="history-open-copy"><strong>${label} anzeigen</strong><small>${total ? `${total} Log${total === 1 ? '' : 's'} · ${todayCount} heute` : 'Noch keine Logs · später hier öffnen'}</small></span>
      <span class="history-open-arrow">›</span>
    </button>`;
  }

  function renderHabitEntryModalList(habit) {
    const entries = state.habitEntries
      .filter(entry => entry.habit_id === habit.id)
      .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
      .slice(0, 50);
    if (!entries.length) return `<div class="habit-entry-list is-empty"><span>Noch keine Logs für diesen Habit.</span></div>`;
    return `<div class="habit-entry-list is-modal-list">
      <div class="habit-entry-list-head"><span>${isSystemMeditationHabit(habit) ? 'Meditationslogs' : 'Letzte Logs'}</span><small>bearbeiten oder löschen</small></div>
      ${entries.map(entry => renderHabitEntryCard(habit, entry)).join('')}
    </div>`;
  }


  function renderHabitEntryCard(habit, entry) {
    const isEditing = editingHabitEntryId === entry.id;
    if (isEditing) return renderHabitEntryEditCard(habit, entry);
    const value = habit.type === 'boolean' ? Boolean(entry.value_bool) : Number(entry.value_num || 0);
    const title = isSystemMeditationHabit(habit) ? (entry.note || 'Meditation') : formatHabitValue(habit, value);
    const note = !isSystemMeditationHabit(habit) && entry.note ? ` · ${entry.note}` : '';
    return `<article class="habit-entry-card">
      <div class="habit-entry-main">
        <strong>${escapeHtml(title)}</strong>
        <span>${formatDateTime(entry.occurred_at)}${escapeHtml(note)}</span>
      </div>
      <div class="list-actions compact-actions">
        <button class="mini-btn" type="button" data-action="edit-habit-entry" data-id="${entry.id}">Bearbeiten</button>
        <button class="mini-btn danger" type="button" data-action="delete-habit-entry" data-id="${entry.id}">Löschen</button>
      </div>
    </article>`;
  }

  function renderHabitEntryEditCard(habit, entry) {
    const [dateValue = '', timeValue = ''] = toDateTimeLocalValue(entry.occurred_at).split('T');
    const valueInput = habit.type === 'boolean'
      ? `<label><span>Status</span><select id="habit-entry-bool-${entry.id}"><option value="true" ${entry.value_bool ? 'selected' : ''}>Ja</option><option value="false" ${!entry.value_bool ? 'selected' : ''}>Nein</option></select></label>`
      : `<label><span>Wert</span><input id="habit-entry-value-${entry.id}" type="number" step="0.01" value="${Number(entry.value_num || 0)}" /></label>`;
    return `<article class="habit-entry-card is-editing">
      <div class="habit-entry-edit-grid">
        <label><span>Datum</span><input id="habit-entry-date-${entry.id}" type="date" value="${dateValue}" /></label>
        <label><span>Zeit</span><input id="habit-entry-time-${entry.id}" type="time" value="${timeValue}" step="60" /></label>
        ${valueInput}
        <label class="habit-entry-note"><span>Notiz</span><input id="habit-entry-note-${entry.id}" type="text" value="${escapeHtml(entry.note || '')}" placeholder="optional" /></label>
      </div>
      <div class="habit-entry-edit-actions">
        <button class="mini-btn primary" type="button" data-action="save-habit-entry" data-id="${entry.id}">Speichern</button>
        <button class="mini-btn" type="button" data-action="cancel-habit-entry-edit" data-id="${entry.id}">Abbrechen</button>
      </div>
    </article>`;
  }

  function toggleMeditationTechniques(habitId) {
    const habit = state.habits.find(h => h.id === habitId);
    if (!isSystemMeditationHabit(habit)) return;
    expandedMeditationHabitId = expandedMeditationHabitId === habit.id ? null : habit.id;
    renderHabits();
  }

  function editHabitEntry(id) {
    if (!state.habitEntries.some(entry => entry.id === id)) return;
    const entry = state.habitEntries.find(item => item.id === id);
    if (entry?.habit_id) setHabitCardExpanded(entry.habit_id, true, { renderNow: false });
    editingHabitEntryId = id;
    renderHabits();
    renderHistoryModal();
  }

  function cancelHabitEntryEdit() {
    editingHabitEntryId = null;
    renderHabits();
    renderHistoryModal();
  }

  function saveHabitEntry(id) {
    const entry = state.habitEntries.find(item => item.id === id);
    if (!entry) return;
    const habit = state.habits.find(item => item.id === entry.habit_id);
    if (!habit) return;
    const dateValue = $(`#habit-entry-date-${cssEscape(id)}`)?.value || toDateKey(entry.occurred_at);
    const timeValue = $(`#habit-entry-time-${cssEscape(id)}`)?.value || (toDateTimeLocalValue(entry.occurred_at).split('T')[1] || '00:00');
    const nextDate = new Date(`${dateValue}T${timeValue || '00:00'}`);
    if (Number.isNaN(nextDate.getTime())) {
      toast('Bitte gültiges Datum und Zeit eintragen.');
      return;
    }

    if (habit.type === 'boolean') {
      entry.value_bool = $(`#habit-entry-bool-${cssEscape(id)}`)?.value !== 'false';
      entry.value_num = null;
    } else {
      const value = Number($(`#habit-entry-value-${cssEscape(id)}`)?.value || 0);
      if (!Number.isFinite(value) || value === 0) {
        toast('Bitte einen gültigen Wert eintragen.');
        return;
      }
      entry.value_num = value;
      entry.value_bool = null;
    }

    entry.note = String($(`#habit-entry-note-${cssEscape(id)}`)?.value || '').trim();
    entry.occurred_at = nextDate.toISOString();
    entry.updated_at = nowIso();
    entry.synced = false;
    const points = habitPoints(habit, entry);
    const reason = isSystemMeditationHabit(habit) && entry.note ? `${entry.note} abgeschlossen` : `${habit.name} geloggt`;
    addPoints('habit', entry.id, points, reason, entry.occurred_at);
    editingHabitEntryId = null;
    saveState();
    renderHabits();
    renderHistoryModal();
    toast('Habit-Log aktualisiert');
    syncWithSupabase({ silent: true, pullFirst: false });
  }

  async function deleteHabitEntry(id) {
    const entry = state.habitEntries.find(item => item.id === id);
    if (!entry) return;
    const habit = state.habits.find(item => item.id === entry.habit_id);
    const label = habit ? habit.name : 'Habit';
    if (!confirm(`Log für „${label}“ wirklich löschen?`)) return;
    const removedLedgerIds = state.pointsLedger
      .filter(point => point.source_type === 'habit' && point.source_id === id)
      .map(point => point.id);
    state.habitEntries = state.habitEntries.filter(item => item.id !== id);
    state.pointsLedger = state.pointsLedger.filter(point => !(point.source_type === 'habit' && point.source_id === id));
    markRemoteDeleted('habit_entries', id);
    markRemoteDeletedMany('points_ledger', removedLedgerIds);
    if (editingHabitEntryId === id) editingHabitEntryId = null;
    saveState();
    renderHabits();
    renderHistoryModal();
    await deleteRemoteByIds('points_ledger', removedLedgerIds);
    await deleteRemoteById('habit_entries', id);
    toast('Habit-Log gelöscht');
    syncWithSupabase({ silent: true, pullFirst: false });
  }

  function taskOverdueDays(task) {
    if (!task?.due_at || (task.status || 'open') === 'done') return 0;
    const dueMs = new Date(task.due_at).getTime();
    if (!Number.isFinite(dueMs) || dueMs >= Date.now()) return 0;
    return Math.max(1, Math.ceil((Date.now() - dueMs) / DAY_MS));
  }

  function taskDueState(task) {
    const days = taskOverdueDays(task);
    if (days > 0) return { overdue: true, days, label: days === 1 ? '1 Tag überfällig' : `${days} Tage überfällig` };
    if (!task?.due_at) return { overdue: false, days: 0, label: 'ohne Fälligkeitsdatum' };
    return { overdue: false, days: 0, label: `Fällig ${formatDateTime(task.due_at)}` };
  }

  function renderOverdueDots(task, { compact = false } = {}) {
    const dueState = taskDueState(task);
    if (!dueState.overdue) return '';
    const dots = Array.from({ length: Math.min(dueState.days, 7) }, (_, index) => `<span aria-hidden="true" class="${index > 3 ? 'is-late' : ''}"></span>`).join('');
    const more = dueState.days > 7 ? '<em aria-hidden="true">+</em>' : '';
    return `<div class="task-overdue-dots ${compact ? 'is-compact' : ''}" title="${escapeHtml(dueState.label)}" aria-label="${escapeHtml(dueState.label)}"><div>${dots}${more}</div><small>${escapeHtml(dueState.label)}</small></div>`;
  }

  function backlogTasks() {
    return state.tasks
      .map(normalizeTask)
      .filter(task => (task.status || 'open') === TASK_BACKLOG_STATUS)
      .sort(compareBacklogTasks);
  }

  function compareBacklogTasks(a, b) {
    const ar = Number.isFinite(Number(a.backlog_rank)) ? Number(a.backlog_rank) : Number.MAX_SAFE_INTEGER;
    const br = Number.isFinite(Number(b.backlog_rank)) ? Number(b.backlog_rank) : Number.MAX_SAFE_INTEGER;
    if (ar !== br) return ar - br;
    return compareTasks(a, b);
  }

  function compactBacklogRanks() {
    backlogTasks().forEach((task, index) => {
      const source = state.tasks.find(item => item.id === task.id);
      if (source) source.backlog_rank = index + 1;
    });
  }

  function nextBacklogRank() {
    const ranks = state.tasks
      .filter(task => (task.status || 'open') === TASK_BACKLOG_STATUS)
      .map(task => Number(task.backlog_rank))
      .filter(Number.isFinite);
    return ranks.length ? Math.max(...ranks) + 1 : 1;
  }

  function isDoneArchivedTask(task) {
    return (task?.status || 'open') === 'done' && Boolean(task.done_archived_at);
  }

  function archivedDoneTasks() {
    return state.tasks
      .map(normalizeTask)
      .filter(isDoneArchivedTask)
      .sort(compareArchivedDoneTasks);
  }

  function compareArchivedDoneTasks(a, b) {
    const ar = Number.isFinite(Number(a.done_archive_rank)) ? Number(a.done_archive_rank) : Number.MAX_SAFE_INTEGER;
    const br = Number.isFinite(Number(b.done_archive_rank)) ? Number(b.done_archive_rank) : Number.MAX_SAFE_INTEGER;
    if (ar !== br) return ar - br;
    return new Date(b.done_archived_at || b.completed_at || b.updated_at || 0).getTime() - new Date(a.done_archived_at || a.completed_at || a.updated_at || 0).getTime();
  }

  function compactDoneArchiveRanks() {
    archivedDoneTasks().forEach((task, index) => {
      const source = state.tasks.find(item => item.id === task.id);
      if (source) source.done_archive_rank = index + 1;
    });
  }

  function nextDoneArchiveRank() {
    const ranks = state.tasks
      .filter(isDoneArchivedTask)
      .map(task => Number(task.done_archive_rank))
      .filter(Number.isFinite);
    return ranks.length ? Math.max(...ranks) + 1 : 1;
  }


  function startOfWeekDate(value = new Date()) {
    const date = value instanceof Date ? new Date(value) : new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return startOfWeekDate(new Date());
    date.setHours(0, 0, 0, 0);
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
    return date;
  }

  function addDays(value, days = 0) {
    const date = value instanceof Date ? new Date(value) : new Date(value || Date.now());
    date.setDate(date.getDate() + Number(days || 0));
    return date;
  }

  function taskPlanningWeekDays() {
    const start = startOfWeekDate(taskWeeklyCursor || new Date());
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }

  function dayKeyToDueIso(dayKey, hour = 17) {
    if (!dayKey) return null;
    const date = new Date(`${dayKey}T${String(hour).padStart(2, '0')}:00:00`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function formatWeekRange(days = taskPlanningWeekDays()) {
    const first = days[0];
    const last = days[days.length - 1];
    if (!first || !last) return 'Diese Woche';
    return `${first.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })} – ${last.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  }

  function appointmentDurationHours(appointment) {
    const start = new Date(appointment?.starts_at || 0).getTime();
    const end = new Date(appointment?.ends_at || appointment?.starts_at || 0).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 1;
    return Math.max(0.5, Math.min(12, (end - start) / 3_600_000));
  }

  function taskWeeklyDayLoad(dayKey) {
    const tasks = state.tasks.map(normalizeTask).filter(task => isActiveTask(task) && toDateKey(task.due_at) === dayKey);
    const appointments = appointmentsOnDate(dayKey);
    const effort = sum(tasks.map(task => Number(task.effort || 3)));
    const appointmentHours = appointments.reduce((total, appointment) => total + appointmentDurationHours(appointment), 0);
    return { tasks, appointments, effort, appointmentHours, load: effort + appointmentHours };
  }

  function suggestWeeklyPlanningDay({ effort = 2, preferOffset = 0 } = {}) {
    const days = taskPlanningWeekDays();
    const todayKey = toDateKey(new Date());
    const candidates = days.map((date, index) => {
      const key = toDateKey(date);
      const load = taskWeeklyDayLoad(key);
      const pastPenalty = key < todayKey ? 100 : 0;
      const todayPenalty = key === todayKey ? 0.4 : 0;
      const spreadPenalty = Math.abs(index - Number(preferOffset || 0)) * 0.18;
      return { key, score: load.load + Number(effort || 2) * 0.35 + pastPenalty + todayPenalty + spreadPenalty };
    });
    candidates.sort((a, b) => a.score - b.score || a.key.localeCompare(b.key));
    return candidates[0]?.key || todayKey;
  }

  function buildWeeklyPlanningSuggestions() {
    const suggestions = [];
    const add = suggestion => {
      if (!suggestion?.title) return;
      if (suggestions.some(item => item.key === suggestion.key)) return;
      suggestions.push(suggestion);
    };

    state.tasks.map(normalizeTask)
      .filter(task => isActiveTask(task) && taskDueState(task).overdue)
      .sort((a, b) => taskOverdueDays(b) - taskOverdueDays(a) || compareTasks(a, b))
      .slice(0, 3)
      .forEach((task, index) => add({
        key: `overdue:${task.id}`,
        type: 'task',
        id: task.id,
        day: suggestWeeklyPlanningDay({ effort: task.effort, preferOffset: index }),
        tone: 'danger',
        label: 'Ueberfaellig',
        title: task.title,
        body: `${taskDueState(task).label}. Neu einplanen, damit die Karte wieder handhabbar wird.`,
        action: 'Neu planen'
      }));

    state.tasks.map(normalizeTask)
      .filter(task => isActiveTask(task) && !task.due_at)
      .sort(compareTasks)
      .slice(0, 4)
      .forEach((task, index) => add({
        key: `undated:${task.id}`,
        type: 'task',
        id: task.id,
        day: suggestWeeklyPlanningDay({ effort: task.effort, preferOffset: index + 1 }),
        tone: 'focus',
        label: 'Ohne Datum',
        title: task.title,
        body: `Aufwand ${task.effort}/5 · ${taskPriorityMeta(task).label}. Ein konkreter Tag macht die Aufgabe sichtbar.`,
        action: 'Einplanen'
      }));

    backlogTasks().slice(0, 3).forEach((task, index) => add({
      key: `backlog:${task.id}`,
      type: 'backlog',
      id: task.id,
      day: suggestWeeklyPlanningDay({ effort: task.effort, preferOffset: index + 2 }),
      tone: 'backlog',
      label: 'Backlog',
      title: task.title,
      body: `Prioritaet ${taskPriorityMeta(task).label} · Aufwand ${task.effort}/5. Als aktive Aufgabe fuer diese Woche uebernehmen.`,
      action: 'Aktivieren'
    }));

    taskIdeas().filter(idea => idea.idea_status === 'open').slice(0, 3).forEach((idea, index) => add({
      key: `idea:${idea.id}`,
      type: 'idea',
      id: idea.id,
      day: suggestWeeklyPlanningDay({ effort: storyPointsToEffort(idea.story_points), preferOffset: index + 3 }),
      tone: 'idea',
      label: 'Idee',
      title: idea.title,
      body: `${Number(idea.story_points || 2)} Story Points · ${taskPriorityMeta(idea).label}. Direkt als geplanten Task erstellen.`,
      action: 'Als Task planen'
    }));

    taskPlanningWeekDays().forEach(date => {
      const key = toDateKey(date);
      const load = taskWeeklyDayLoad(key);
      if (load.load >= 8) add({
        key: `load:${key}`,
        type: 'info',
        day: key,
        tone: 'warning',
        label: 'Dichter Tag',
        title: date.toLocaleDateString('de-CH', { weekday: 'long', day: '2-digit', month: '2-digit' }),
        body: `${load.tasks.length} Task(s), ${load.appointments.length} Termin(e). Besser nur kleine Karten dort planen.`,
        action: ''
      });
    });

    return suggestions.slice(0, 9);
  }

  function renderTaskWeeklyPlanning() {
    if (!els.taskWeeklyPanel) return;
    const days = taskPlanningWeekDays();
    const keys = days.map(toDateKey);
    const active = state.tasks.map(normalizeTask).filter(isActiveTask);
    const plannedThisWeek = active.filter(task => keys.includes(toDateKey(task.due_at)));
    const unplanned = active.filter(task => !task.due_at);
    const overdue = active.filter(task => taskDueState(task).overdue);
    const weekLoad = keys.reduce((total, key) => total + taskWeeklyDayLoad(key).load, 0);
    const score = active.length ? Math.round((plannedThisWeek.length / active.length) * 100) : 100;
    const suggestions = buildWeeklyPlanningSuggestions();

    if (els.taskWeeklyRange) els.taskWeeklyRange.textContent = formatWeekRange(days);
    if (els.taskWeeklyOverview) {
      const focus = overdue.length ? `${overdue.length} ueberfaellige Karte(n) zuerst beruhigen` : unplanned.length ? `${unplanned.length} Aufgabe(n) brauchen noch ein Datum` : 'Woche ist sauber geplant';
      els.taskWeeklyOverview.innerHTML = `
        <article class="weekly-command-card">
          <small>Planbarkeit</small>
          <strong>${score}%</strong>
          <span>${escapeHtml(focus)}</span>
        </article>
        <article><small>Geplant</small><strong>${plannedThisWeek.length}</strong><span>aktive Tasks diese Woche</span></article>
        <article><small>Offen ohne Datum</small><strong>${unplanned.length}</strong><span>direkt einplanbar</span></article>
        <article><small>Backlog</small><strong>${backlogTasks().length}</strong><span>Kandidaten fuer Fokus</span></article>
        <article><small>Wochenlast</small><strong>${Math.round(weekLoad)}</strong><span>SP + Termin-Stunden</span></article>`;
    }
    if (els.taskWeeklySuggestions) {
      els.taskWeeklySuggestions.innerHTML = suggestions.length
        ? suggestions.map(renderWeeklyPlanningSuggestion).join('')
        : '<div class="empty-state">Keine offenen Planungsvorschlaege. Die Woche wirkt ruhig und gut sortiert.</div>';
    }
    if (els.taskWeeklyDays) {
      els.taskWeeklyDays.innerHTML = days.map(renderWeeklyPlanningDay).join('');
    }
  }

  function renderWeeklyPlanningSuggestion(item) {
    const dateLabel = item.day ? new Date(`${item.day}T12:00:00`).toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit' }) : '';
    const actionMap = { task: 'weekly-plan-task', backlog: 'weekly-plan-backlog', idea: 'weekly-plan-idea' };
    const action = actionMap[item.type];
    const actionButton = action
      ? `<button class="mini-btn primary" type="button" data-action="${action}" data-id="${escapeHtml(item.id)}" data-day="${escapeHtml(item.day)}">${escapeHtml(item.action)} · ${escapeHtml(dateLabel)}</button>`
      : '';
    return `<article class="weekly-suggestion-card is-${escapeHtml(item.tone || 'focus')}">
      <div class="weekly-suggestion-top"><span class="badge muted">${escapeHtml(item.label || 'Plan')}</span>${dateLabel ? `<span class="subtle">${escapeHtml(dateLabel)}</span>` : ''}</div>
      <h4>${escapeHtml(item.title)}</h4>
      <p>${escapeHtml(item.body || '')}</p>
      ${actionButton ? `<div class="list-actions compact-actions">${actionButton}</div>` : ''}
    </article>`;
  }

  function renderWeeklyPlanningDay(date) {
    const key = toDateKey(date);
    const load = taskWeeklyDayLoad(key);
    const loadLevel = Math.min(100, Math.round((load.load / 8) * 100));
    const weekday = date.toLocaleDateString('de-CH', { weekday: 'short' });
    const dateLabel = date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
    const taskCards = load.tasks.length
      ? load.tasks.map(task => `<article class="weekly-day-item task"><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(taskPriorityMeta(task).label)} · Aufwand ${Number(task.effort || 3)}/5</span><button class="mini-btn" type="button" data-action="weekly-clear-task-date" data-id="${task.id}">Datum entfernen</button></article>`).join('')
      : '<div class="weekly-day-empty">Noch kein Task</div>';
    const appointmentCards = load.appointments.slice(0, 3).map(appointment => `<article class="weekly-day-item appointment"><strong>${escapeHtml(formatAppointmentRange(appointment))}</strong><span>${escapeHtml(appointment.title)}</span></article>`).join('');
    const moreAppointments = load.appointments.length > 3 ? `<div class="weekly-day-more">+${load.appointments.length - 3} weitere Termine</div>` : '';
    return `<article class="weekly-day-card ${key === toDateKey(new Date()) ? 'is-today' : ''}">
      <div class="weekly-day-head"><div><small>${escapeHtml(weekday)}</small><strong>${escapeHtml(dateLabel)}</strong></div><span>${load.tasks.length} Task</span></div>
      <div class="weekly-load-meter" aria-label="Auslastung ${loadLevel}%"><i style="width:${loadLevel}%"></i></div>
      <div class="weekly-day-stack">${appointmentCards}${moreAppointments}${taskCards}</div>
    </article>`;
  }

  function planExistingTaskForWeek(id, dayKey) {
    const task = state.tasks.find(item => item.id === id);
    const dueAt = dayKeyToDueIso(dayKey);
    if (!task || !dueAt) return;
    if (!isActiveTask(task)) {
      toast('Nur offene oder laufende Aufgaben werden in die Woche geplant.');
      return;
    }
    task.due_at = dueAt;
    task.updated_at = nowIso();
    task.synced = false;
    saveState();
    toast('Aufgabe eingeplant');
    syncWithSupabase({ silent: true });
  }

  function planBacklogTaskForWeek(id, dayKey) {
    const task = state.tasks.find(item => item.id === id);
    const dueAt = dayKeyToDueIso(dayKey);
    if (!task || !dueAt) return;
    task.status = 'open';
    task.due_at = dueAt;
    task.backlog_rank = null;
    task.completed_at = null;
    task.done_archived_at = null;
    task.done_archive_rank = null;
    task.points = 0;
    task.updated_at = nowIso();
    task.synced = false;
    compactBacklogRanks();
    saveState();
    toast('Backlog-Task fuer die Woche aktiviert');
    syncWithSupabase({ silent: true });
  }

  function planIdeaForWeek(id, dayKey) {
    const dueAt = dayKeyToDueIso(dayKey);
    if (!dueAt) return;
    createTaskFromIdea(id, 'open', { dueAt });
  }

  function clearTaskDueDate(id) {
    const task = state.tasks.find(item => item.id === id);
    if (!task || !task.due_at) return;
    task.due_at = null;
    task.updated_at = nowIso();
    task.synced = false;
    saveState();
    toast('Fälligkeitsdatum entfernt');
    syncWithSupabase({ silent: true });
  }

  function renderTasks() {
    const tasks = [...state.tasks].map(normalizeTask).sort(compareTasks);
    const boardTasks = tasks.filter(task => !isDoneArchivedTask(task));
    const totalOpen = tasks.filter(isActiveTask).length;
    const backlog = backlogTasks();
    const archive = archivedDoneTasks();
    if (els.openTasksCount) els.openTasksCount.textContent = totalOpen;
    const openIdeas = taskIdeas().filter(idea => idea.idea_status === 'open');
    if (els.taskIdeasCount) els.taskIdeasCount.textContent = openIdeas.length;
    if (els.taskBacklogCount) els.taskBacklogCount.textContent = backlog.length;
    if (els.taskArchiveCount) els.taskArchiveCount.textContent = archive.length;
    syncTaskUtilityPanels();
    renderTaskIdeas();
    renderLeisureFinder();
    renderTaskWeeklyPlanning();
    renderTaskBacklog(backlog);
    renderTaskArchive(archive);
    renderTaskTimeline();
    if (!tasks.length) {
      els.tasksList.innerHTML = '<div class="empty-state">Keine Aufgaben vorhanden. Neue Aufgaben erscheinen hier direkt als Kanban-Karte.</div>';
      return;
    }

    els.tasksList.innerHTML = `<div class="kanban-board" aria-label="Aufgaben Kanban Board">
      ${TASK_BOARD_COLUMNS.map(column => {
        const columnTasks = boardTasks.filter(task => (task.status || 'open') === column.status);
        return `<section class="kanban-column" data-task-drop data-status="${column.status}">
          <div class="kanban-column-head">
            <div><strong>${escapeHtml(column.title)}</strong><small>${escapeHtml(column.hint)}</small></div>
            <span class="badge muted">${columnTasks.length}</span>
          </div>
          <div class="kanban-cards">
            ${columnTasks.length ? columnTasks.map(renderTaskCard).join('') : `<div class="kanban-empty">Hierhin ziehen</div>`}
          </div>
        </section>`;
      }).join('')}
    </div>`;
  }

  function taskIdeas() {
    return (state.taskIdeas || [])
      .map(normalizeTaskIdea)
      .filter(idea => idea.title)
      .sort(compareTaskIdeas);
  }

  function normalizeLeisureActivity(item = {}) {
    const created = item.created_at || nowIso();
    const id = String(item.id || '').trim();
    const title = String(item.title || '').trim();
    const summary = String(item.summary || item.task_description || '').trim();
    const story = Number(item.story_points || 2);
    const list = (value, fallback = []) => {
      if (Array.isArray(value)) return value.map(entry => String(entry).trim()).filter(Boolean);
      if (typeof value === 'string') return value.split(',').map(entry => entry.trim()).filter(Boolean);
      return fallback;
    };
    return {
      ...item,
      id,
      title,
      summary,
      category: String(item.category || 'random_fun').trim(),
      category_label: String(item.category_label || item.category || 'Idee').trim(),
      idea_category: TASK_IDEA_CATEGORIES[item.idea_category] ? item.idea_category : 'experiment',
      mood: String(item.mood || 'curious').trim(),
      energy: ['low', 'medium', 'high'].includes(String(item.energy || '').trim()) ? String(item.energy).trim() : 'medium',
      duration_band: String(item.duration_band || '1h').trim(),
      minutes: Number(item.minutes || 60),
      budget: ['free', 'low', 'medium', 'high'].includes(String(item.budget || '').trim()) ? String(item.budget).trim() : 'low',
      setting: ['indoor', 'outdoor', 'mixed'].includes(String(item.setting || '').trim()) ? String(item.setting).trim() : 'mixed',
      people: list(item.people, ['solo']),
      weather: list(item.weather, ['any']),
      transport: list(item.transport, ['any']),
      story_points: [1, 2, 3, 5, 8].includes(story) ? story : 2,
      priority: normalizeTaskPriority(item.priority),
      task_title: String(item.task_title || title).trim(),
      task_description: String(item.task_description || summary).trim(),
      tags: list(item.tags, []),
      source: String(item.source || 'custom').trim(),
      is_archived: Boolean(item.is_archived || item.deleted_at),
      created_at: created,
      updated_at: item.updated_at || created
    };
  }

  function updateLeisureFilterForm() {
    if (!els.activityFinderForm) return;
    const fields = els.activityFinderForm.elements;
    Object.entries(defaultLeisureFilters()).forEach(([key, fallback]) => {
      if (fields[key]) fields[key].value = leisureFilters[key] ?? fallback;
    });
  }

  function updateLeisureFiltersFromForm() {
    if (!els.activityFinderForm) return;
    const data = new FormData(els.activityFinderForm);
    leisureFilters = {
      mood: String(data.get('mood') || 'any'),
      duration: String(data.get('duration') || 'any'),
      people: String(data.get('people') || 'any'),
      setting: String(data.get('setting') || 'any'),
      budget: String(data.get('budget') || 'any'),
      energy: String(data.get('energy') || 'any'),
      transport: String(data.get('transport') || 'any'),
      query: String(data.get('query') || '').trim()
    };
    leisureResultOffset = 0;
    saveLeisureFilters();
    renderLeisureFinder();
  }

  function resetLeisureFilters() {
    leisureFilters = defaultLeisureFilters();
    leisureResultOffset = 0;
    saveLeisureFilters();
    updateLeisureFilterForm();
    renderLeisureFinder();
    toast('Freizeit-Filter zurückgesetzt');
  }


  function toggleLeisureActivityForm() {
    if (activityCatalogFormOpen) closeLeisureActivityForm({ clearForm: true });
    else openLeisureActivityForm();
  }

  function openLeisureActivityForm(activity = null) {
    if (!els.activityCatalogForm || !els.activityCatalogFormPanel) return;
    activityCatalogFormOpen = true;
    editingActivityIdeaId = activity?.id || null;
    els.activityCatalogFormPanel.classList.remove('hidden');
    els.activityCatalogFormPanel.setAttribute('aria-hidden', 'false');
    if (els.activityCatalogFormTitle) els.activityCatalogFormTitle.textContent = editingActivityIdeaId ? 'Vorschlag bearbeiten' : 'Eigenen Vorschlag erfassen';
    if (els.activityCatalogSubmitBtn) els.activityCatalogSubmitBtn.textContent = editingActivityIdeaId ? 'Vorschlag aktualisieren' : 'Vorschlag speichern';
    fillLeisureActivityForm(activity || {});
    if (!activity) requestAnimationFrame(() => els.activityCatalogForm?.elements?.title?.focus());
  }

  function closeLeisureActivityForm({ clearForm = false } = {}) {
    activityCatalogFormOpen = false;
    editingActivityIdeaId = null;
    if (els.activityCatalogFormPanel) {
      els.activityCatalogFormPanel.classList.add('hidden');
      els.activityCatalogFormPanel.setAttribute('aria-hidden', 'true');
    }
    if (els.activityCatalogFormTitle) els.activityCatalogFormTitle.textContent = 'Eigenen Vorschlag erfassen';
    if (els.activityCatalogSubmitBtn) els.activityCatalogSubmitBtn.textContent = 'Vorschlag speichern';
    if (clearForm && els.activityCatalogForm) resetLeisureActivityForm();
  }

  function fillLeisureActivityForm(activity = {}) {
    if (!els.activityCatalogForm) return;
    const normalized = normalizeLeisureActivity(activity);
    const fields = els.activityCatalogForm.elements;
    fields.title.value = normalized.title || '';
    fields.summary.value = normalized.summary || '';
    fields.category_label.value = normalized.category_label || '';
    fields.category.value = normalized.category || 'random_fun';
    fields.mood.value = normalized.mood || 'curious';
    fields.duration_band.value = normalized.duration_band || '1h';
    fields.people.value = normalized.people.join(', ');
    fields.setting.value = normalized.setting || 'mixed';
    fields.budget.value = normalized.budget || 'low';
    fields.energy.value = normalized.energy || 'medium';
    fields.transport.value = normalized.transport.join(', ');
    fields.story_points.value = String(normalized.story_points || 2);
    fields.priority.value = normalizeTaskPriority(normalized.priority);
    fields.tags.value = normalized.tags.join(', ');
  }

  function resetLeisureActivityForm() {
    if (!els.activityCatalogForm) return;
    els.activityCatalogForm.reset();
    const fields = els.activityCatalogForm.elements;
    fields.mood.value = 'curious';
    fields.duration_band.value = '1h';
    fields.setting.value = 'mixed';
    fields.budget.value = 'low';
    fields.energy.value = 'medium';
    fields.story_points.value = '2';
    fields.priority.value = 'medium';
  }

  function formListValue(value, fallback = []) {
    const entries = String(value || '').split(',').map(item => item.trim()).filter(Boolean);
    return entries.length ? entries : fallback;
  }

  async function saveLeisureActivityFromForm(event) {
    event.preventDefault();
    if (!els.activityCatalogForm) return;
    const data = new FormData(els.activityCatalogForm);
    const title = String(data.get('title') || '').trim();
    if (!title) return;
    const now = nowIso();
    const existing = editingActivityIdeaId ? (state.activityIdeas || []).find(item => item.id === editingActivityIdeaId) : null;
    const activity = normalizeLeisureActivity({
      ...(existing || {}),
      id: existing?.id || `activity_custom_${uid()}`,
      title,
      summary: String(data.get('summary') || '').trim(),
      category: String(data.get('category') || 'random_fun').trim(),
      category_label: String(data.get('category_label') || data.get('category') || 'Idee').trim(),
      idea_category: 'experiment',
      mood: String(data.get('mood') || 'curious'),
      duration_band: String(data.get('duration_band') || '1h'),
      minutes: durationBandToMinutes(String(data.get('duration_band') || '1h')),
      people: formListValue(data.get('people'), ['solo']),
      weather: existing?.weather || ['any'],
      setting: String(data.get('setting') || 'mixed'),
      budget: String(data.get('budget') || 'low'),
      energy: String(data.get('energy') || 'medium'),
      transport: formListValue(data.get('transport'), ['any']),
      story_points: Number(data.get('story_points') || 2),
      priority: normalizeTaskPriority(data.get('priority')),
      task_title: title,
      task_description: String(data.get('summary') || '').trim(),
      tags: formListValue(data.get('tags'), []),
      source: existing?.source || 'custom',
      is_archived: false,
      created_at: existing?.created_at || now,
      updated_at: now,
      synced: false
    });
    const list = Array.isArray(state.activityIdeas) ? state.activityIdeas : [];
    const index = list.findIndex(item => item.id === activity.id);
    if (index >= 0) list[index] = activity;
    else list.unshift(activity);
    state.activityIdeas = list;
    refreshLeisureCatalogFromState();
    closeLeisureActivityForm({ clearForm: true });
    saveState();
    toast(existing ? 'Freizeit-Vorschlag aktualisiert' : 'Freizeit-Vorschlag gespeichert');
    await upsertLeisureActivityRemote(activity, { silent: true });
  }

  function durationBandToMinutes(band) {
    return { '15m': 15, '30m': 30, '1h': 60, '2h': 120, evening: 180, halfday: 240, day: 480 }[band] || 60;
  }

  function editLeisureActivity(id) {
    const activity = (state.activityIdeas || []).map(normalizeLeisureActivity).find(item => item.id === id);
    if (!activity) return;
    openLeisureActivityForm(activity);
    requestAnimationFrame(() => els.activityCatalogFormPanel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  async function deleteLeisureActivity(id) {
    const activity = (state.activityIdeas || []).find(item => item.id === id);
    if (!activity) return;
    if (!confirm(`Freizeit-Vorschlag „${activity.title}“ wirklich löschen?`)) return;
    const now = nowIso();
    activity.is_archived = true;
    activity.updated_at = now;
    activity.synced = false;
    if (editingActivityIdeaId === id) closeLeisureActivityForm({ clearForm: true });
    refreshLeisureCatalogFromState();
    saveState();
    toast('Freizeit-Vorschlag gelöscht');
    await upsertLeisureActivityRemote(activity, { silent: true });
  }

  function leisureActivityRowsForRemote(items = []) {
    return items.map(item => normalizeLeisureActivity(item)).filter(item => item.id && item.title).map(item => ({
      id: item.id,
      title: item.title,
      summary: item.summary || null,
      category: item.category || 'random_fun',
      category_label: item.category_label || 'Idee',
      idea_category: TASK_IDEA_CATEGORIES[item.idea_category] ? item.idea_category : 'experiment',
      mood: item.mood || 'curious',
      energy: item.energy || 'medium',
      duration_band: item.duration_band || '1h',
      minutes: Number(item.minutes || 60),
      budget: item.budget || 'low',
      setting: item.setting || 'mixed',
      people: item.people || ['solo'],
      weather: item.weather || ['any'],
      transport: item.transport || ['any'],
      story_points: Number(item.story_points || 2),
      priority: normalizeTaskPriority(item.priority),
      task_title: item.task_title || item.title,
      task_description: item.task_description || item.summary || null,
      tags: item.tags || [],
      source: item.source || 'custom',
      is_archived: Boolean(item.is_archived),
      created_at: item.created_at || nowIso(),
      updated_at: item.updated_at || nowIso()
    }));
  }

  const mapRemoteLeisureActivity = item => normalizeLeisureActivity({ ...item, synced: true });

  function mergeActivityIdeas(localRows = [], remoteRows = []) {
    const map = new Map(localRows.map(row => [row.id, normalizeLeisureActivity(row)]));
    remoteRows.map(mapRemoteLeisureActivity).forEach(remote => {
      const local = map.get(remote.id);
      if (!local || new Date(remote.updated_at || remote.created_at || 0) >= new Date(local.updated_at || local.created_at || 0)) {
        map.set(remote.id, remote);
      }
    });
    return Array.from(map.values());
  }

  function activitySeededUsers() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ACTIVITY_REMOTE_SEED_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function markActivitySeededForUser(userId) {
    if (!userId) return;
    const seeded = activitySeededUsers();
    seeded[userId] = nowIso();
    localStorage.setItem(ACTIVITY_REMOTE_SEED_KEY, JSON.stringify(seeded));
  }

  function hasActivitySeededForUser(userId) {
    return Boolean(userId && activitySeededUsers()[userId]);
  }

  function isMissingActivityRelationError(error) {
    return isMissingRemoteRelationError(error) || String(error?.message || '').toLowerCase().includes(ACTIVITY_CATALOG_TABLE);
  }

  async function fetchRemoteLeisureActivities() {
    const userId = currentUserId();
    if (!supabaseClient || !userId || !remoteActivityIdeasSupported) return null;
    const { data, error } = await supabaseClient
      .from(ACTIVITY_CATALOG_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) {
      if (isMissingActivityRelationError(error)) {
        remoteActivityIdeasSupported = false;
        console.warn('Remote Freizeit-Tabelle fehlt. Freizeit-Finder bleibt lokal, bis supabase.sql angewendet ist.', error);
        return null;
      }
      throw error;
    }
    return Array.isArray(data) ? data : [];
  }

  async function upsertLeisureActivityRemote(activity, { silent = true } = {}) {
    if (!supabaseClient || !currentUserId() || !remoteActivityIdeasSupported) return false;
    try {
      const rows = rowsForCurrentUser(leisureActivityRowsForRemote([activity]));
      const { error } = await supabaseClient.from(ACTIVITY_CATALOG_TABLE).upsert(rows, { onConflict: 'user_id,id' });
      if (error) {
        if (isMissingActivityRelationError(error)) {
          remoteActivityIdeasSupported = false;
          if (!silent) toast('Freizeit-Tabelle fehlt noch in Supabase. Lokal gespeichert.');
          return false;
        }
        throw error;
      }
      const local = (state.activityIdeas || []).find(item => item.id === activity.id);
      if (local) local.synced = true;
      saveState({ skipRender: true });
      return true;
    } catch (error) {
      console.warn('Freizeit-Vorschlag konnte nicht remote gespeichert werden.', error);
      if (!silent) toast('Freizeit-Vorschlag lokal gespeichert, Remote-Sync prüfen.');
      return false;
    }
  }

  async function upsertLeisureActivitiesRemote(items = [], { chunkSize = 150 } = {}) {
    if (!supabaseClient || !currentUserId() || !remoteActivityIdeasSupported || !items.length) return false;
    const rows = leisureActivityRowsForRemote(items);
    try {
      for (let index = 0; index < rows.length; index += chunkSize) {
        const batch = rows.slice(index, index + chunkSize);
        const { error } = await supabaseClient.from(ACTIVITY_CATALOG_TABLE).upsert(rowsForCurrentUser(batch), { onConflict: 'user_id,id' });
        if (error) {
          if (isMissingActivityRelationError(error)) {
            remoteActivityIdeasSupported = false;
            console.warn('Remote Freizeit-Tabelle fehlt. Freizeit-Finder bleibt lokal, bis supabase.sql angewendet ist.', error);
            return false;
          }
          throw error;
        }
      }
      const syncedIds = new Set(rows.map(row => row.id));
      (state.activityIdeas || []).forEach(item => { if (syncedIds.has(item.id)) item.synced = true; });
      saveState({ skipRender: true });
      return true;
    } catch (error) {
      console.warn('Freizeit-Katalog konnte nicht remote gespeichert werden.', error);
      return false;
    }
  }

  async function syncLeisureCatalogWithSupabase({ silent = true } = {}) {
    if (!supabaseClient || !currentUserId() || !remoteActivityIdeasSupported) return;
    try {
      const userId = currentUserId();
      const remoteRows = await fetchRemoteLeisureActivities();
      if (!remoteRows) return;
      const localRows = Array.isArray(state.activityIdeas) ? state.activityIdeas.map(normalizeLeisureActivity) : [];
      const unsyncedLocal = localRows.filter(item => item.synced === false);
      if (!remoteRows.length && localRows.length && !hasActivitySeededForUser(userId)) {
        const seeded = await upsertLeisureActivitiesRemote(localRows);
        if (seeded) markActivitySeededForUser(userId);
      } else if (remoteRows.length) {
        state.activityIdeas = mergeActivityIdeas(localRows, remoteRows);
        if (unsyncedLocal.length) await upsertLeisureActivitiesRemote(unsyncedLocal);
        saveState({ skipRender: true });
      }
      refreshLeisureCatalogFromState();
      renderLeisureFinder();
    } catch (error) {
      console.warn('Freizeit-Katalog-Sync fehlgeschlagen.', error);
      if (!silent) toast('Freizeit-Katalog-Sync fehlgeschlagen.');
    }
  }

  function refreshLeisureIdeas() {
    leisureResultOffset = (leisureResultOffset + LEISURE_RESULT_LIMIT) % Math.max(LEISURE_RESULT_LIMIT, filteredLeisureActivities().length || LEISURE_RESULT_LIMIT);
    renderLeisureFinder();
  }

  function filteredLeisureActivities() {
    const query = normalizeSearchText(leisureFilters.query || '');
    return leisureCatalog
      .map(activity => ({ activity, score: leisureActivityScore(activity, leisureFilters, query) }))
      .filter(item => item.score > -1000)
      .sort((a, b) => b.score - a.score || String(a.activity.title).localeCompare(String(b.activity.title), 'de-CH'))
      .map(item => item.activity);
  }

  function leisureActivityScore(activity, filters, query) {
    let score = 0;
    const mood = String(filters.mood || 'any');
    const duration = String(filters.duration || 'any');
    const people = String(filters.people || 'any');
    const setting = String(filters.setting || 'any');
    const budget = String(filters.budget || 'any');
    const energy = String(filters.energy || 'any');
    const transport = String(filters.transport || 'any');
    if (mood !== 'any') {
      if (activity.mood === mood || activity.category === mood || activity.tags.includes(mood)) score += 22;
      else if ((mood === 'nightlife' && activity.category === 'nightlife') || (mood === 'active' && ['movement', 'sport_game', 'nature'].includes(activity.category))) score += 18;
      else score -= 8;
    }
    if (duration !== 'any') score += activity.duration_band === duration ? 18 : durationDistanceScore(activity.duration_band, duration);
    if (people !== 'any') score += activity.people.includes(people) ? 18 : -20;
    if (setting !== 'any') score += (activity.setting === setting || activity.setting === 'mixed') ? 12 : -12;
    if (budget !== 'any') score += budgetRank(activity.budget) <= budgetRank(budget) ? 12 : -14;
    if (energy !== 'any') score += activity.energy === energy ? 12 : (energy === 'low' && activity.energy === 'medium' ? -4 : -10);
    if (transport !== 'any') score += (activity.transport.includes(transport) || activity.transport.includes('any')) ? 10 : -8;
    if (query) {
      const haystack = normalizeSearchText([activity.title, activity.summary, activity.category_label, activity.tags.join(' ')].join(' '));
      if (haystack.includes(query)) score += 35;
      else return -1001;
    }
    if (activity.source === 'seed') score += 4;
    return score;
  }

  function durationDistanceScore(actual, wanted) {
    const order = ['15m', '30m', '1h', '2h', 'evening', 'halfday', 'day'];
    const ai = order.indexOf(actual);
    const wi = order.indexOf(wanted);
    if (ai < 0 || wi < 0) return -3;
    const diff = Math.abs(ai - wi);
    if (diff === 1) return 5;
    if (diff === 2) return -2;
    return -9;
  }

  function budgetRank(value) {
    return { free: 0, low: 1, medium: 2, high: 3 }[value] ?? 1;
  }

  function normalizeSearchText(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u00df/g, 'ss').trim();
  }

  function renderLeisureFinder() {
    if (!els.activitySuggestionList || !els.activityFinderMeta) return;
    updateLeisureFilterForm();
    if (!leisureCatalogLoaded) {
      els.activityFinderMeta.textContent = 'Lade Freizeit-Vorschläge...';
      els.activitySuggestionList.innerHTML = '<div class="empty-state">Freizeit-Finder wird vorbereitet.</div>';
      return;
    }
    if (leisureCatalogError) {
      els.activityFinderMeta.textContent = 'Katalog konnte nicht geladen werden.';
      els.activitySuggestionList.innerHTML = '<div class="empty-state">Der Freizeit-Katalog ist gerade nicht verfügbar. Nach einem Hard Refresh sollte die JSON-Datei neu geladen werden.</div>';
      return;
    }
    const matches = filteredLeisureActivities();
    if (!matches.length) {
      els.activityFinderMeta.textContent = `${leisureCatalog.length} aktive Vorschläge · 0 Treffer`;
      els.activitySuggestionList.innerHTML = '<div class="empty-state">Keine passende Idee gefunden. Setze einzelne Filter zurück oder nutze ein anderes Stichwort.</div>';
      return;
    }
    const start = Math.min(leisureResultOffset, Math.max(0, matches.length - 1));
    const rotated = matches.slice(start).concat(matches.slice(0, start));
    const visible = rotated.slice(0, LEISURE_RESULT_LIMIT);
    els.activityFinderMeta.textContent = `${leisureCatalog.length} aktive Vorschläge · ${matches.length} passende Treffer · ${visible.length} angezeigt${remoteActivityIdeasSupported && currentUserId() ? ' · DB bereit' : ' · lokal'}`;
    els.activitySuggestionList.innerHTML = visible.map(renderLeisureActivityCard).join('');
  }

  function renderLeisureActivityCard(activity) {
    const duration = leisureDurationLabel(activity.duration_band, activity.minutes);
    const people = leisurePeopleLabel(activity.people);
    const budget = leisureBudgetLabel(activity.budget);
    const setting = leisureSettingLabel(activity.setting);
    return `<article class="activity-suggestion-card" data-activity-id="${escapeHtml(activity.id)}">
      <div class="activity-card-top">
        <span class="idea-card-icon">${svgIcon('idea', 'ui-icon')}</span>
        <div class="task-badges">
          <span class="badge muted">${escapeHtml(activity.category_label)}</span>
          <span class="badge muted">${Number(activity.story_points || 2)} SP</span>
        </div>
      </div>
      <h4>${escapeHtml(activity.title)}</h4>
      <p>${escapeHtml(activity.summary)}</p>
      <div class="activity-meta-strip">
        <span>${escapeHtml(duration)}</span>
        <span>${escapeHtml(people)}</span>
        <span>${escapeHtml(budget)}</span>
        <span>${escapeHtml(setting)}</span>
      </div>
      <div class="activity-tags">${activity.tags.slice(0, 4).map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
      <div class="list-actions compact-actions idea-actions">
        <button class="mini-btn primary" type="button" data-action="activity-to-idea" data-id="${escapeHtml(activity.id)}">Als Idee</button>
        <button class="mini-btn" type="button" data-action="activity-to-task" data-id="${escapeHtml(activity.id)}">Als Task</button>
        <button class="mini-btn" type="button" data-action="activity-to-backlog" data-id="${escapeHtml(activity.id)}">In Backlog</button>
        <button class="mini-btn" type="button" data-action="edit-activity" data-id="${escapeHtml(activity.id)}">Bearbeiten</button>
        <button class="mini-btn danger-text" type="button" data-action="delete-activity" data-id="${escapeHtml(activity.id)}">Löschen</button>
      </div>
    </article>`;
  }

  function leisureDurationLabel(band, minutes) {
    const map = { '15m': '15 Min.', '30m': '30 Min.', '1h': '1 Std.', '2h': '2 Std.', halfday: 'Halbtag', day: 'Tag', evening: 'Abend' };
    return map[band] || `${Number(minutes || 60)} Min.`;
  }

  function leisurePeopleLabel(people = []) {
    const map = { solo: 'Solo', duo: 'Zu zweit', friends: 'Freunde', family: 'Familie', club: 'Club' };
    return people.slice(0, 2).map(key => map[key] || key).join(' / ') || 'Flexibel';
  }

  function leisureBudgetLabel(value) {
    return { free: 'Gratis', low: 'Klein', medium: 'Normal', high: 'Premium' }[value] || 'Budget offen';
  }

  function leisureSettingLabel(value) {
    return { indoor: 'Drinnen', outdoor: 'Draussen', mixed: 'Flexibel' }[value] || 'Flexibel';
  }

  function findLeisureActivity(id) {
    return leisureCatalog.find(activity => activity.id === id);
  }

  function leisureActivityToIdeaPayload(activity) {
    return normalizeTaskIdea({
      id: uid(),
      title: activity.task_title || activity.title,
      description: [activity.task_description || activity.summary, `Freizeit-Finder · ${activity.category_label} · ${leisureDurationLabel(activity.duration_band, activity.minutes)}`].filter(Boolean).join('\n\n'),
      category: activity.idea_category || 'experiment',
      story_points: activity.story_points || 2,
      priority: normalizeTaskPriority(activity.priority),
      idea_status: 'open',
      source_key: `activity:${activity.id}`,
      generated_task_id: null,
      created_at: nowIso(),
      updated_at: nowIso(),
      synced: false
    });
  }

  function createTaskIdeaFromActivity(id) {
    const activity = findLeisureActivity(id);
    if (!activity) return;
    const sourceKey = `activity:${activity.id}`;
    const existing = state.taskIdeas.find(idea => idea.source_key === sourceKey && idea.idea_status === 'open');
    if (existing) {
      toast('Diese Freizeit-Idee ist bereits im Ideenpool');
      return;
    }
    state.taskIdeas.push(leisureActivityToIdeaPayload(activity));
    taskIdeasOpen = true;
    saveState();
    toast('Freizeit-Idee in den Ideenpool übernommen');
    syncWithSupabase({ silent: true });
  }

  function createTaskFromActivity(id, targetStatus = 'open') {
    const activity = findLeisureActivity(id);
    if (!activity) return;
    const created = nowIso();
    const nextStatus = targetStatus === TASK_BACKLOG_STATUS ? TASK_BACKLOG_STATUS : 'open';
    state.tasks.push({
      id: uid(),
      title: activity.task_title || activity.title,
      description: [activity.task_description || activity.summary, `Freizeit-Finder · ${activity.category_label} · ${Number(activity.story_points || 2)} Story Points`].filter(Boolean).join('\n\n'),
      effort: storyPointsToEffort(activity.story_points),
      priority: normalizeTaskPriority(activity.priority),
      due_at: null,
      status: nextStatus,
      backlog_rank: nextStatus === TASK_BACKLOG_STATUS ? nextBacklogRank() : null,
      completed_at: null,
      done_archived_at: null,
      done_archive_rank: null,
      points: 0,
      created_at: created,
      updated_at: created,
      synced: false
    });
    if (nextStatus === TASK_BACKLOG_STATUS) taskBacklogOpen = true;
    saveState();
    toast(nextStatus === TASK_BACKLOG_STATUS ? 'Freizeit-Idee als Backlog-Task erstellt' : 'Freizeit-Idee als Task erstellt');
    syncWithSupabase({ silent: true });
  }

  function renderTaskIdeas(ideas = taskIdeas()) {
    if (!els.taskIdeaList) return;
    const open = ideas.filter(idea => idea.idea_status === 'open').length;
    const converted = ideas.filter(idea => idea.idea_status === 'accepted').length;
    const dismissed = ideas.filter(idea => idea.idea_status === 'dismissed').length;
    if (!ideas.length) {
      els.taskIdeaList.innerHTML = '<div class="empty-state">Noch keine Ideen im Pool. Speichere eine Idee oder lass dir Vorschläge aus Tasks, Habits und Konsum-Mustern generieren.</div>';
      return;
    }
    els.taskIdeaList.innerHTML = `
      <div class="task-idea-stats" aria-label="Ideenpool Übersicht">
        <article><small>Offen</small><strong>${open}</strong><span>bereit zum Übernehmen</span></article>
        <article><small>Umgesetzt</small><strong>${converted}</strong><span>als Aufgabe erzeugt</span></article>
        <article><small>Verworfen</small><strong>${dismissed}</strong><span>sauber geparkt</span></article>
      </div>
      <div class="task-idea-grid">${ideas.map(renderTaskIdeaCard).join('')}</div>`;
  }

  function renderTaskIdeaCard(idea) {
    const priority = normalizeTaskPriority(idea.priority);
    const priorityMeta = taskPriorityMeta(priority);
    const category = taskIdeaCategoryMeta(idea.category);
    const status = idea.idea_status || 'open';
    const statusLabel = status === 'accepted' ? 'Umgesetzt' : status === 'dismissed' ? 'Verworfen' : 'Idee';
    const meta = `${escapeHtml(category.label)} · ${Number(idea.story_points || 2)} SP · ${escapeHtml(priorityMeta.label)}`;
    const actionBlock = status === 'open'
      ? `<button class="mini-btn primary" type="button" data-action="idea-to-task" data-id="${idea.id}">Als Task</button>
         <button class="mini-btn" type="button" data-action="idea-to-backlog" data-id="${idea.id}">In Backlog</button>
         <button class="mini-btn" type="button" data-action="dismiss-task-idea" data-id="${idea.id}">Verwerfen</button>`
      : `<button class="mini-btn" type="button" data-action="reopen-task-idea" data-id="${idea.id}">Wieder öffnen</button>`;
    const source = idea.source_key ? '<span class="badge muted">Smart</span>' : '<span class="badge muted">Manuell</span>';
    return `<article class="kanban-card idea-card idea-status-${escapeHtml(status)}">
      <div class="kanban-card-top">
        <span class="idea-card-icon">${svgIcon('idea', 'ui-icon')}</span>
        <div class="task-badges">
          ${source}
          <span class="badge muted ${taskPriorityClass(priority)}">${escapeHtml(priorityMeta.short)}</span>
          <span class="badge muted">${escapeHtml(statusLabel)}</span>
        </div>
      </div>
      <h4>${escapeHtml(idea.title)}</h4>
      <p class="meta">${meta}${idea.description ? `<br>${escapeHtml(idea.description)}` : ''}</p>
      <div class="idea-value-strip">
        <span>${Number(idea.story_points || 2)} Story Points</span>
        <span>Aufwand ${storyPointsToEffort(idea.story_points)}/5</span>
      </div>
      <div class="list-actions compact-actions idea-actions">
        ${actionBlock}
        <button class="mini-btn danger" type="button" data-action="delete-task-idea" data-id="${idea.id}">Löschen</button>
      </div>
    </article>`;
  }

  function renderTaskBacklog(backlog = backlogTasks()) {
    if (!els.taskBacklogList) return;
    if (!backlog.length) {
      els.taskBacklogList.innerHTML = '<div class="empty-state">Dein Backlog ist leer. Ziehe eine Karte hierhin oder nutze auf einer Karte den Backlog-Button.</div>';
      return;
    }
    els.taskBacklogList.innerHTML = backlog.map((task, index) => renderBacklogTaskCard(task, index, backlog.length)).join('');
  }

  function renderBacklogTaskCard(task, index, total) {
    const priority = normalizeTaskPriority(task.priority);
    const priorityMeta = taskPriorityMeta(priority);
    const dueState = taskDueState(task);
    const dueLabel = task.due_at ? `${dueState.overdue ? 'überfällig' : 'fällig'} ${formatDateTime(task.due_at)}` : 'ohne Fälligkeitsdatum';
    return `<article class="kanban-card backlog-card ${editingTaskId === task.id ? 'is-editing' : ''} ${dueState.overdue ? 'is-overdue' : ''}" draggable="true" data-task-card data-backlog-card data-id="${task.id}">
      <div class="kanban-card-top">
        <span class="drag-handle" aria-hidden="true">⋮⋮</span>
        <div class="task-badges">
          <span class="badge muted ${taskPriorityClass(priority)}">${escapeHtml(priorityMeta.short)}</span>
          <span class="badge muted">#${index + 1}</span>
        </div>
      </div>
      <h4>${escapeHtml(task.title)}</h4>
      <p class="meta">Backlog · Aufwand ${task.effort}/5 · Priorität ${escapeHtml(priorityMeta.label)} · ${escapeHtml(dueLabel)}${task.description ? `<br>${escapeHtml(task.description)}` : ''}</p>
      ${renderOverdueDots(task)}
      <div class="list-actions compact-actions backlog-actions">
        <button class="mini-btn primary" type="button" data-action="move-backlog-task" data-status="open" data-id="${task.id}">In Offen</button>
        <button class="mini-btn" type="button" data-action="edit-task" data-id="${task.id}">Bearbeiten</button>
        <button class="mini-btn" type="button" data-action="backlog-rank-up" data-id="${task.id}" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button class="mini-btn" type="button" data-action="backlog-rank-down" data-id="${task.id}" ${index === total - 1 ? 'disabled' : ''}>↓</button>
        <button class="mini-btn danger" type="button" data-action="delete-task" data-id="${task.id}">Löschen</button>
      </div>
    </article>`;
  }

  function renderTaskArchive(archive = archivedDoneTasks()) {
    if (!els.taskArchiveList) return;
    if (!archive.length) {
      els.taskArchiveList.innerHTML = '<div class="empty-state">Noch keine archivierten erledigten Aufgaben. Sobald eine Aufgabe erledigt ist, kannst du sie aus der Erledigt-Spalte hierhin archivieren.</div>';
      return;
    }
    els.taskArchiveList.innerHTML = archive.map((task, index) => renderArchivedDoneTaskCard(task, index, archive.length)).join('');
  }

  function renderArchivedDoneTaskCard(task, index, total) {
    const priority = normalizeTaskPriority(task.priority);
    const priorityMeta = taskPriorityMeta(priority);
    const archivedAt = task.done_archived_at || task.completed_at || task.updated_at || task.created_at;
    const completedLabel = task.completed_at ? `Erledigt ${formatDateTime(task.completed_at)}` : 'erledigt';
    const archivedLabel = archivedAt ? `archiviert ${formatDateTime(archivedAt)}` : 'archiviert';
    return `<article class="kanban-card backlog-card archive-card ${editingTaskId === task.id ? 'is-editing' : ''}" draggable="true" data-task-card data-archive-card data-id="${task.id}">
      <div class="kanban-card-top">
        <span class="drag-handle" aria-hidden="true">⋮⋮</span>
        <div class="task-badges">
          <span class="badge muted ${taskPriorityClass(priority)}">${escapeHtml(priorityMeta.short)}</span>
          <span class="badge">+${Number(task.points || taskPoints(task))} Pkt.</span>
          <span class="badge muted">#${index + 1}</span>
        </div>
      </div>
      <h4>${escapeHtml(task.title)}</h4>
      <p class="meta">Archiv · ${escapeHtml(completedLabel)} · ${escapeHtml(archivedLabel)} · Aufwand ${task.effort}/5 · Priorität ${escapeHtml(priorityMeta.label)}${task.description ? `<br>${escapeHtml(task.description)}` : ''}</p>
      <div class="list-actions compact-actions backlog-actions">
        <button class="mini-btn primary" type="button" data-action="restore-archived-task" data-id="${task.id}">Zurück zu Erledigt</button>
        <button class="mini-btn" type="button" data-action="edit-task" data-id="${task.id}">Bearbeiten</button>
        <button class="mini-btn" type="button" data-action="done-archive-rank-up" data-id="${task.id}" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button class="mini-btn" type="button" data-action="done-archive-rank-down" data-id="${task.id}" ${index === total - 1 ? 'disabled' : ''}>↓</button>
        <button class="mini-btn danger" type="button" data-action="delete-task" data-id="${task.id}">Löschen</button>
      </div>
    </article>`;
  }

  function renderTaskCard(task) {
    const status = task.status || 'open';
    const priority = normalizeTaskPriority(task.priority);
    const priorityMeta = taskPriorityMeta(priority);
    const statusLabel = TASK_COLUMNS.find(column => column.status === status)?.title || 'Offen';
    const dueState = taskDueState(task);
    const isOverdue = dueState.overdue;
    const primaryAction = status === 'open'
      ? `<button class="mini-btn primary" type="button" data-action="move-task" data-status="in_progress" data-id="${task.id}">In Bearbeitung</button>`
      : status === 'in_progress'
        ? `<button class="mini-btn primary" type="button" data-action="move-task" data-status="done" data-id="${task.id}">Erledigt</button>`
        : status === 'done'
          ? `<button class="mini-btn" type="button" data-action="move-task" data-status="in_progress" data-id="${task.id}">Zurück in Arbeit</button>`
          : `<button class="mini-btn" type="button" data-action="move-task" data-status="open" data-id="${task.id}">Reaktivieren</button>`;
    const archiveAction = status === 'done'
      ? `<button class="mini-btn" type="button" data-action="archive-done-task" data-id="${task.id}">Archivieren</button>`
      : status === TASK_BACKLOG_STATUS
        ? ''
        : `<button class="mini-btn" type="button" data-action="move-task-to-backlog" data-id="${task.id}">Backlog</button>`;
    return `<article class="kanban-card ${editingTaskId === task.id ? 'is-editing' : ''} ${isOverdue ? 'is-overdue' : ''}" draggable="true" data-task-card data-id="${task.id}">
      <div class="kanban-card-top">
        <span class="drag-handle" aria-hidden="true">⋮⋮</span>
        <div class="task-badges">
          <span class="badge muted ${taskPriorityClass(priority)}">${escapeHtml(priorityMeta.short)}</span>
          <span class="badge ${status === 'done' ? '' : 'muted'}">${status === 'done' ? `+${Number(task.points || taskPoints(task))} Pkt.` : `+${taskPoints(task)} Pkt.`}</span>
        </div>
      </div>
      <h4>${escapeHtml(task.title)}</h4>
      <p class="meta">${escapeHtml(statusLabel)} · Aufwand ${task.effort}/5 · Priorität ${escapeHtml(priorityMeta.label)} · ${task.due_at ? `${isOverdue ? 'Überfällig' : 'Fällig'} ${formatDateTime(task.due_at)}` : 'ohne Fälligkeitsdatum'}${task.description ? `<br>${escapeHtml(task.description)}` : ''}</p>
      ${renderOverdueDots(task)}
      <div class="list-actions compact-actions">
        ${primaryAction}
        <button class="mini-btn" type="button" data-action="edit-task" data-id="${task.id}">Bearbeiten</button>
        ${archiveAction}
        <button class="mini-btn danger" type="button" data-action="delete-task" data-id="${task.id}">Löschen</button>
      </div>
    </article>`;
  }

  function renderTaskTimeline() {
    if (!els.taskTimeline) return;
    const active = state.tasks
      .map(normalizeTask)
      .filter(task => isActiveTask(task) && task.due_at && Number.isFinite(new Date(task.due_at).getTime()))
      .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
    if (!active.length) {
      els.taskTimeline.innerHTML = '<div class="empty-state">Keine offenen oder laufenden Aufgaben mit Fälligkeitsdatum. Sobald du ein Datum setzt, erscheint hier der Planer.</div>';
      return;
    }
    const now = Date.now();
    const dueTimes = active.map(task => new Date(task.due_at).getTime()).filter(Number.isFinite);
    const minTime = Math.min(now - 3 * DAY_MS, ...dueTimes.map(time => Math.min(time, now))) - DAY_MS;
    const maxTime = Math.max(now + 10 * DAY_MS, ...dueTimes.map(time => Math.max(time, now))) + DAY_MS;
    const range = Math.max(DAY_MS, maxTime - minTime);
    const pos = (time) => Math.max(0, Math.min(100, ((time - minTime) / range) * 100));
    const todayLeft = pos(now);
    const ticks = Array.from({ length: 8 }, (_, index) => {
      const time = minTime + (range / 7) * index;
      return `<span style="left:${pos(time).toFixed(2)}%">${escapeHtml(new Date(time).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' }))}</span>`;
    }).join('');
    const rows = active.map(task => renderTaskTimelineRow(task, minTime, range, todayLeft)).join('');
    const preferredScrollLeft = Number.isFinite(Number(taskTimelineScrollLeft)) ? Number(taskTimelineScrollLeft) : null;
    els.taskTimeline.innerHTML = `<div class="task-timeline-scroll">
      <div class="task-timeline-axis"><span class="timeline-today-label" style="left:${todayLeft.toFixed(2)}%">Heute</span>${ticks}</div>
      <div class="task-timeline-rows">${rows}</div>
    </div>`;
    restoreTaskTimelineScroll(todayLeft, preferredScrollLeft);
  }

  function restoreTaskTimelineScroll(todayLeft = 0, preferredScrollLeft = null) {
    if (!els.taskTimeline) return;
    requestAnimationFrame(() => {
      const scroller = els.taskTimeline;
      const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      if (!maxScroll) {
        taskTimelineScrollLeft = 0;
        return;
      }
      const todayTarget = Math.max(0, Math.min(maxScroll, (todayLeft / 100) * scroller.scrollWidth - scroller.clientWidth * 0.52));
      const target = Number.isFinite(Number(preferredScrollLeft))
        ? Math.max(0, Math.min(maxScroll, Number(preferredScrollLeft)))
        : todayTarget;
      scroller.scrollLeft = target;
      taskTimelineScrollLeft = scroller.scrollLeft;
    });
  }

  function renderTaskTimelineRow(task, minTime, range, todayLeft) {
    const due = new Date(task.due_at).getTime();
    const now = Date.now();
    const dueState = taskDueState(task);
    const start = Math.min(due, now);
    const end = Math.max(due, now);
    const left = Math.max(0, Math.min(100, ((start - minTime) / range) * 100));
    const width = Math.max(1.2, ((end - start) / range) * 100);
    const dueLeft = Math.max(0, Math.min(100, ((due - minTime) / range) * 100));
    const priority = taskPriorityMeta(task);
    const stateLabel = task.status === 'in_progress' ? 'In Bearbeitung' : 'Offen';
    return `<article class="task-timeline-row ${dueState.overdue ? 'is-overdue' : 'is-future'}">
      <div class="task-timeline-meta">
        <span class="badge muted ${taskPriorityClass(task.priority)}">${escapeHtml(priority.short)}</span>
        <strong>${escapeHtml(task.title)}</strong>
        <small>${escapeHtml(stateLabel)} · ${escapeHtml(dueState.label)}</small>
        ${renderOverdueDots(task, { compact: true })}
      </div>
      <div class="task-timeline-track">
        <span class="task-today-line" style="left:${todayLeft.toFixed(2)}%"></span>
        <span class="task-timebar" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%"></span>
        <span class="task-due-marker" style="left:${dueLeft.toFixed(2)}%"></span>
        <span class="task-time-label" style="left:${dueLeft.toFixed(2)}%">${escapeHtml(formatDateTime(task.due_at))}</span>
      </div>
    </article>`;
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
      const routineLog = morningRoutineCompletedLog(key);
      const tasks = state.tasks.filter(t => toDateKey(t.due_at || t.completed_at || t.created_at) === key);
      const appointments = appointmentsOnDate(key);
      const alcohol = alcoholForDate(key)?.consumed;
      const alcoholUnits = alcoholUnitsOnDate(key).length;
      const points = calendarPointsOnDate(key);
      const chips = [];
      if (cigarettes) chips.push(`<span class="day-chip smoke">${cigarettes} Zig.</span>`);
      if (routineLog) chips.push('<span class="day-chip habit">Routine</span>');
      if (appointments.length) chips.push(`<span class="day-chip appointment">${appointments.length} Termin</span>`);
      if (tasks.length) chips.push(`<span class="day-chip task">${tasks.length} Task</span>`);
      if (alcoholUnits) chips.push(`<span class="day-chip alcohol">${alcoholUnits} Alk.</span>`);
      else if (alcohol) chips.push('<span class="day-chip alcohol">Alk.</span>');
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
    const alcoholUnits = alcoholUnitsOnDate(key);
    if (alcoholUnits.length) details.push(`<article class="list-card"><div><h4>Alkohol</h4><p class="meta">${alcoholUnits.length} Einheit(en): ${escapeHtml(alcoholUnits.map(unit => alcoholTypeLabel(unit.drink_type)).join(', '))}</p></div></article>`);
    else if (alcohol) details.push(`<article class="list-card"><div><h4>Alkohol</h4><p class="meta">${alcohol.consumed ? 'Ja' : 'Nein'} getrackt</p></div></article>`);
    const routineLog = morningRoutineCompletedLog(key);
    if (routineLog) {
      const routine = MORNING_ROUTINES.find(item => item.key === routineLog.routine_key);
      details.push(`<article class="list-card done"><div><h4>Morgenroutine</h4><p class="meta">${escapeHtml(routine?.title || '15-Minuten-Routine')} · +50 Punkte</p></div></article>`);
    }
    const appointments = appointmentsOnDate(key);
    appointments.forEach(appointment => details.push(renderAppointmentDetailCard(appointment)));
    const tasks = state.tasks.filter(t => toDateKey(t.due_at || t.completed_at || t.created_at) === key);
    tasks.forEach(t => details.push(`<article class="list-card ${t.status === 'done' ? 'done' : ''}"><div><h4>${escapeHtml(t.title)}</h4><p class="meta">${escapeHtml(TASK_COLUMNS.find(column => column.status === (t.status || 'open'))?.title || 'Offen')} · ${escapeHtml(taskPriorityMeta(t).label)} · Aufwand ${t.effort}/5</p></div></article>`));
    const empty = `<div class="empty-state">Für diesen Tag gibt es noch keine Einträge.<div class="empty-actions"><button class="pill secondary" type="button" data-action="new-appointment-for-day">Termin anlegen</button></div></div>`;
    els.dayDetails.innerHTML = details.length ? details.join('') : empty;
  }

  function renderAppointmentDetailCard(appointment) {
    const type = appointmentTypeMeta(appointment.appointment_type);
    const location = appointment.location ? ` · ${escapeHtml(appointment.location)}` : '';
    const description = appointment.description ? `<br>${escapeHtml(appointment.description)}` : '';
    return `<article class="list-card appointment-card ${editingAppointmentId === appointment.id ? 'is-editing' : ''}">
      <div class="list-card-main">
        <h4>${escapeHtml(appointment.title)}</h4>
        <p class="meta">${escapeHtml(formatAppointmentRange(appointment))} · ${escapeHtml(type.label)}${location}${description}</p>
      </div>
      <div class="list-actions">
        <button class="mini-btn" type="button" data-action="edit-appointment" data-id="${appointment.id}">Bearbeiten</button>
        <button class="mini-btn danger" type="button" data-action="delete-appointment" data-id="${appointment.id}">Löschen</button>
      </div>
    </article>`;
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
    const scoringContext = smokingScoringContext(last, { smoked_at: smokedAt });
    const points = cigarettePoints(interval, scoringContext);
    const todayAlcohol = Boolean(alcoholForDate(toDateKey(new Date()))?.consumed || alcoholUnitsOnDate(toDateKey(new Date())).length);
    const entry = { id: uid(), smoked_at: smokedAt, interval_minutes: interval, alcohol_context: todayAlcohol, points, note: '', created_at: smokedAt, updated_at: smokedAt, synced: false };
    state.cigarettes.push(entry);
    pendingTriggerSmokeId = entry.id;
    addPoints('cigarette', entry.id, points, cigarettePointReason(interval, scoringContext), smokedAt);
    saveState();
    toast(points > 0 ? `Zigarette erfasst · +${points} Punkte` : `Zigarette erfasst · ${points} Punkte`);
    syncWithSupabase({ silent: true });
  }
  function renderTriggerCapture() {
    if (!els.triggerCaptureCard) return;
    const cigarette = pendingTriggerSmokeId ? state.cigarettes.find(c => c.id === pendingTriggerSmokeId) : null;
    if (!cigarette) {
      els.triggerCaptureCard.classList.add('hidden');
      els.triggerCaptureCard.innerHTML = '';
      return;
    }
    const options = ['stress', 'coffee', 'alcohol', 'boredom', 'reward', 'social', 'meal', 'tasks', 'habits'];
    els.triggerCaptureCard.classList.remove('hidden');
    els.triggerCaptureCard.innerHTML = `<div><p class="eyebrow">Trigger-Analyse</p><h4>Was war gerade der Auslöser?</h4><p class="subtle">Ein Tap reicht. Das verbessert Muster-Erkennung und Coach-Empfehlungen.</p></div><div class="trigger-chip-grid">${options.map(key => `<button class="trigger-chip" type="button" data-action="save-smoke-trigger" data-id="${cigarette.id}" data-trigger="${key}">${svgIcon(COACH_TRIGGER_META[key].icon, 'ui-icon')}<span>${escapeHtml(COACH_TRIGGER_META[key].label)}</span></button>`).join('')}</div><button class="mini-btn" type="button" data-action="dismiss-smoke-trigger">Später</button>`;
  }

  function saveSmokeTrigger(id, triggerKey) {
    const cigarette = state.cigarettes.find(c => c.id === id);
    const meta = COACH_TRIGGER_META[triggerKey];
    if (!cigarette || !meta) return;
    cigarette.note = `trigger:${triggerKey}`;
    cigarette.updated_at = nowIso();
    cigarette.synced = false;
    pendingTriggerSmokeId = null;
    saveState();
    toast(`Trigger gespeichert: ${meta.label}`);
    syncWithSupabase({ silent: true, pullFirst: false });
  }

  function dismissSmokeTrigger() {
    pendingTriggerSmokeId = null;
    renderTriggerCapture();
  }

  function editSmoke(id) {
    if (!state.cigarettes.some(c => c.id === id)) return;
    editingSmokeId = id;
    renderSmoking();
    renderHistoryModal();
  }

  function cancelSmokeEdit() {
    editingSmokeId = null;
    renderSmoking();
    renderHistoryModal();
  }

  function saveSmokeTime(id) {
    const cigarette = state.cigarettes.find(c => c.id === id);
    const dateInput = $(`#smoke-date-${cssEscape(id)}`);
    const timeInput = $(`#smoke-time-${cssEscape(id)}`);
    const legacyInput = $(`#smoke-input-${cssEscape(id)}`);
    if (!cigarette || (!legacyInput && (!dateInput || !timeInput))) return;

    const nextDate = legacyInput
      ? new Date(legacyInput.value)
      : localDateTimeFromParts(dateInput.value, timeInput.value);
    if (Number.isNaN(nextDate.getTime())) {
      toast('Bitte Datum und Zeit vollständig eintragen.');
      return;
    }
    if (nextDate.getTime() > Date.now() + 60_000) {
      toast('Der Zeitpunkt darf nicht in der Zukunft liegen.');
      return;
    }

    const nextIso = nextDate.toISOString();
    cigarette.smoked_at = nextIso;
    cigarette.updated_at = nowIso();
    cigarette.synced = false;
    editingSmokeId = null;
    recalculateSmokeIntervals({ markUpdated: true });
    saveState();
    renderHistoryModal();
    toast('Zigaretten-Zeitpunkt aktualisiert');
    syncWithSupabase({ silent: true, pullFirst: false });
  }

  async function deleteSmoke(id) {
    const index = state.cigarettes.findIndex(c => c.id === id);
    if (index === -1) return;
    const removedLedgerIds = state.pointsLedger.filter(p => p.source_type === 'cigarette' && p.source_id === id).map(p => p.id);
    state.cigarettes.splice(index, 1);
    state.pointsLedger = state.pointsLedger.filter(p => !(p.source_type === 'cigarette' && p.source_id === id));
    markRemoteDeleted('cigarette_events', id);
    markRemoteDeletedMany('points_ledger', removedLedgerIds);
    if (editingSmokeId === id) editingSmokeId = null;
    recalculateSmokeIntervals({ markUpdated: true });
    saveState();
    renderHistoryModal();
    await deleteRemoteById('cigarette_events', id);
    await deleteRemoteByIds('points_ledger', removedLedgerIds);
    toast('Zigaretten-Eintrag entfernt');
    syncWithSupabase({ silent: true, pullFirst: false });
  }

  function recalculateSmokeIntervals({ markUpdated = false } = {}) {
    const touchedAt = nowIso();
    let changed = false;
    const sorted = [...state.cigarettes].sort((a, b) => new Date(a.smoked_at) - new Date(b.smoked_at));
    sorted.forEach((c, index) => {
      const prev = sorted[index - 1] || null;
      const interval = prev ? Math.max(0, Math.round((new Date(c.smoked_at) - new Date(prev.smoked_at)) / 60000)) : null;
      const scoringContext = smokingScoringContext(prev, c);
      const points = cigarettePoints(interval, scoringContext);
      const hasChanged = c.interval_minutes !== interval || Number(c.points || 0) !== points;
      if (hasChanged) {
        c.interval_minutes = interval;
        c.points = points;
        changed = true;
      }
      if (markUpdated && hasChanged) {
        c.updated_at = touchedAt;
        c.synced = false;
      }
      if (addPoints('cigarette', c.id, c.points, cigarettePointReason(interval, scoringContext), c.smoked_at)) changed = true;
    });
    return changed;
  }

  function alcoholTypeLabel(type) {
    return ALCOHOL_TYPES[type] || ALCOHOL_TYPES.other;
  }

  function formatSignedPoints(points) {
    const value = Number(points || 0);
    return `${value > 0 ? '+' : ''}${value}`;
  }

  function alcoholBasePoints(drinkType) {
    return ALCOHOL_POINTS_BY_TYPE[drinkType] ?? ALCOHOL_POINTS_BY_TYPE.other;
  }

  function alcoholRollingPenalty(count) {
    if (count >= 12) return -15;
    if (count >= 8) return -10;
    if (count >= 5) return -5;
    return 0;
  }

  function alcoholConsecutiveDaysThrough(dateKey, dayKeys) {
    let streak = 0;
    let cursor = new Date(`${dateKey}T12:00:00`);
    while (dayKeys.has(toDateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function alcoholStreakPenalty(streak) {
    if (streak >= 5) return -10;
    if (streak >= 3) return -5;
    return 0;
  }

  function alcoholPointsEntryReason(unit, rollingCount, streakDays, totalPoints) {
    const basePoints = alcoholBasePoints(unit.drink_type);
    const bits = [`${alcoholTypeLabel(unit.drink_type)} ${formatSignedPoints(basePoints)} Pkt.`];
    const rolling = alcoholRollingPenalty(rollingCount);
    const streak = alcoholStreakPenalty(streakDays);
    if (rolling) bits.push(`7 Tage / ${rollingCount} Einh. ${formatSignedPoints(rolling)} Pkt.`);
    if (streak) bits.push(`${streakDays} Alkohol-Tage in Folge ${formatSignedPoints(streak)} Pkt.`);
    bits.push(`Total ${formatSignedPoints(totalPoints)} Pkt.`);
    return `Alkohol: ${bits.join(' · ')}`;
  }

  function isAlcoholPointsEntry(entry) {
    return entry?.source_type === 'bonus' && String(entry?.reason || '').startsWith('Alkohol:');
  }

  function alcoholPointsForUnit(unitId) {
    return Number(state.pointsLedger.find(entry => isAlcoholPointsEntry(entry) && entry.source_id === unitId)?.points || 0);
  }

  function recalculateAlcoholScores({ markUpdated = false } = {}) {
    if (!state.alcoholUnits.length) {
      const removedIds = state.pointsLedger.filter(isAlcoholPointsEntry).map(entry => entry.id);
      if (removedIds.length) {
        state.pointsLedger = state.pointsLedger.filter(entry => !isAlcoholPointsEntry(entry));
        markRemoteDeletedMany('points_ledger', removedIds);
        return true;
      }
      return false;
    }

    const units = [...state.alcoholUnits]
      .filter(unit => unit?.id)
      .sort((a, b) => sortDate(a.occurred_at || a.created_at) - sortDate(b.occurred_at || b.created_at));
    const allDayKeys = new Set(units.map(unit => toDateKey(unit.occurred_at || unit.created_at)));
    const activeIds = new Set(units.map(unit => unit.id));
    let changed = false;

    const removedIds = state.pointsLedger
      .filter(entry => isAlcoholPointsEntry(entry) && !activeIds.has(entry.source_id))
      .map(entry => entry.id);
    if (removedIds.length) {
      state.pointsLedger = state.pointsLedger.filter(entry => !(isAlcoholPointsEntry(entry) && !activeIds.has(entry.source_id)));
      markRemoteDeletedMany('points_ledger', removedIds);
      changed = true;
    }

    units.forEach(unit => {
      const occurredAt = new Date(unit.occurred_at || unit.created_at || nowIso());
      const dateKey = toDateKey(occurredAt);
      const windowStart = occurredAt.getTime() - (6 * DAY_MS);
      const rollingCount = units.filter(candidate => {
        const candidateTime = new Date(candidate.occurred_at || candidate.created_at || 0).getTime();
        return candidateTime >= windowStart && candidateTime <= occurredAt.getTime();
      }).length;
      const streakDays = alcoholConsecutiveDaysThrough(dateKey, allDayKeys);
      const totalPoints = alcoholBasePoints(unit.drink_type) + alcoholRollingPenalty(rollingCount) + alcoholStreakPenalty(streakDays);
      const reason = alcoholPointsEntryReason(unit, rollingCount, streakDays, totalPoints);
      if (addPoints('bonus', unit.id, totalPoints, reason, unit.occurred_at || unit.created_at || nowIso())) changed = true;
      if (markUpdated) {
        unit.updated_at = nowIso();
        unit.synced = false;
      }
    });
    return changed;
  }

  function migrateAlcoholScoring() {
    const changed = recalculateAlcoholScores({ markUpdated: false });
    if (changed) saveState({ skipRender: true });
    return changed;
  }

  function alcoholUnitsOnDate(key) {
    return state.alcoholUnits.filter(unit => toDateKey(unit.occurred_at) === key);
  }

  function ensureAlcoholDayLog(key, note = '') {
    const existing = alcoholForDate(key);
    if (existing) {
      existing.consumed = true;
      existing.note = existing.note || note || '';
      existing.updated_at = nowIso();
      existing.synced = false;
      return existing;
    }
    const created = nowIso();
    const log = { id: uid(), log_date: key, consumed: true, note, created_at: created, updated_at: created, synced: false };
    state.alcoholLogs.push(log);
    return log;
  }

  function recordAlcoholUnit(drinkTypeOverride) {
    const occurredAt = nowIso();
    const drinkType = drinkTypeOverride || els.alcoholTypeSelect?.value || 'beer';
    const label = alcoholTypeLabel(drinkType);
    const unit = {
      id: uid(),
      occurred_at: occurredAt,
      drink_type: drinkType,
      note: '',
      created_at: occurredAt,
      updated_at: occurredAt,
      synced: false
    };
    state.alcoholUnits.push(unit);
    ensureAlcoholDayLog(toDateKey(new Date()));
    dedupeAlcoholLogs(state);
    recalculateAlcoholScores();
    saveState();
    toast(`${label} erfasst · ${formatSignedPoints(alcoholPointsForUnit(unit.id))} Pkt.`);
    syncWithSupabase({ silent: true });
  }

  async function deleteAlcoholUnit(id) {
    const unit = state.alcoholUnits.find(a => a.id === id);
    if (!unit) return;
    if (!confirm('Alkohol-Einheit wirklich löschen?')) return;
    const removedLedgerIds = state.pointsLedger.filter(entry => isAlcoholPointsEntry(entry) && entry.source_id === id).map(entry => entry.id);
    state.alcoholUnits = state.alcoholUnits.filter(a => a.id !== id);
    state.pointsLedger = state.pointsLedger.filter(entry => !(isAlcoholPointsEntry(entry) && entry.source_id === id));
    markRemoteDeleted('alcohol_events', id);
    markRemoteDeletedMany('points_ledger', removedLedgerIds);
    const key = toDateKey(unit.occurred_at);
    const remainingUnitsToday = alcoholUnitsOnDate(key);
    const dayLog = alcoholForDate(key);
    if (dayLog && !remainingUnitsToday.length) {
      dayLog.consumed = false;
      dayLog.updated_at = nowIso();
      dayLog.synced = false;
    }
    recalculateAlcoholScores();
    saveState();
    renderHistoryModal();
    await deleteRemoteByIds('points_ledger', removedLedgerIds);
    await deleteRemoteById('alcohol_events', id);
    toast('Alkohol-Einheit gelöscht');
    syncWithSupabase({ silent: true, pullFirst: false });
  }


async function deleteAlcoholLog(id) {
    const log = state.alcoholLogs.find(a => a.id === id);
    if (!log) return;
    if (!confirm('Alkohol-Eintrag wirklich löschen?')) return;
    state.alcoholLogs = state.alcoholLogs.filter(a => a.id !== id);
    markRemoteDeleted('alcohol_logs', id);
    saveState();
    await deleteRemoteById('alcohol_logs', id);
    toast('Alkohol-Eintrag gelöscht');
    syncWithSupabase({ silent: true, pullFirst: false });
  }

  function createHabit(event) {
    event.preventDefault();
    const data = new FormData(els.habitForm);
    const type = data.get('type');
    const values = {
      name: String(data.get('name') || '').trim(),
      type,
      unit: String(data.get('unit') || defaultUnit(type)).trim(),
      direction: data.get('direction') || 'increase',
      target: data.get('target') ? Number(data.get('target')) : null,
      target_period: normalizeHabitTargetPeriod(data.get('target_period')),
      icon: String(data.get('icon') || 'number').trim().toLowerCase(),
      dna_difficulty: normalizeScaleValue(data.get('dna_difficulty'), defaultHabitDna({ type }).difficulty),
      dna_energy: normalizeScaleValue(data.get('dna_energy'), defaultHabitDna({ type }).energy),
      dna_preferred_time: normalizeHabitPreferredTime(data.get('dna_preferred_time')),
      dna_emotional_hurdle: normalizeHabitHurdle(data.get('dna_emotional_hurdle')),
      dna_trigger: normalizeHabitTrigger(data.get('dna_trigger')),
      dna_reward: normalizeHabitReward(data.get('dna_reward')),
      updated_at: nowIso(),
      synced: false
    };
    if (!values.name) return;

    if (editingHabitId) {
      const habit = state.habits.find(h => h.id === editingHabitId);
      if (!habit) {
        resetHabitFormMode();
        toast('Habit wurde nicht gefunden.');
        return;
      }
      Object.assign(habit, values, { is_archived: false });
      expandedHabitCardIds.add(habit.id);
      persistExpandedHabitCardIds();
      resetHabitFormMode({ clearForm: true });
      habitFormOpen = false;
      syncHabitFormPanel();
      saveState();
      toast('Habit aktualisiert');
      syncWithSupabase({ silent: true, pullFirst: false });
      return;
    }

    const created = nowIso();
    const habitId = uid();
    state.habits.push({
      id: habitId,
      ...values,
      color: '#4ad7d1',
      is_archived: false,
      created_at: created,
      updated_at: created
    });
    resetHabitFormMode({ clearForm: true });
    expandedHabitCardIds.add(habitId);
    persistExpandedHabitCardIds();
    habitFormOpen = false;
    syncHabitFormPanel();
    saveState();
    toast('Habit erstellt');
    syncWithSupabase({ silent: true, pullFirst: false });
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
    if (isSystemMeditationHabit(habit)) {
      toast('Meditation bleibt als System-Habit aktiv.');
      return;
    }
    habit.is_archived = true;
    habit.updated_at = nowIso();
    expandedHabitCardIds.delete(id);
    expandedHabitDnaIds.delete(id);
    persistExpandedHabitCardIds();
    persistExpandedHabitDnaIds();
    if (editingHabitId === id) resetHabitFormMode({ clearForm: true });
    saveState();
    toast('Habit archiviert');
    syncWithSupabase({ silent: true });
  }


  function editHabit(id) {
    const habit = state.habits.find(h => h.id === id);
    if (!habit) return;
    editingHabitId = id;
    expandedHabitCardIds.add(id);
    persistExpandedHabitCardIds();
    const fields = els.habitForm.elements;
    fields.name.value = habit.name || '';
    fields.type.value = habit.type || 'number';
    fields.unit.value = habit.unit || '';
    fields.direction.value = habit.direction || 'increase';
    fields.target.value = habit.target ?? '';
    if (fields.target_period) fields.target_period.value = normalizeHabitTargetPeriod(habit.target_period);
    if (fields.dna_difficulty) fields.dna_difficulty.value = String(normalizeScaleValue(habit.dna_difficulty));
    if (fields.dna_energy) fields.dna_energy.value = String(normalizeScaleValue(habit.dna_energy));
    if (fields.dna_preferred_time) fields.dna_preferred_time.value = normalizeHabitPreferredTime(habit.dna_preferred_time);
    if (fields.dna_emotional_hurdle) fields.dna_emotional_hurdle.value = normalizeHabitHurdle(habit.dna_emotional_hurdle);
    if (fields.dna_trigger) fields.dna_trigger.value = normalizeHabitTrigger(habit.dna_trigger);
    if (fields.dna_reward) fields.dna_reward.value = normalizeHabitReward(habit.dna_reward);
    fields.icon.value = ICON_PATHS[habit.icon] ? habit.icon : habitIconKey(habit);
    els.habitFormTitle.textContent = 'Gewohnheit bearbeiten';
    els.habitSubmitBtn.textContent = 'Änderungen speichern';
    els.cancelHabitEditBtn.classList.remove('hidden');
    habitFormOpen = true;
    syncHabitFormPanel();
    showScreen('habits');
    els.habitForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    renderHabits();
  }

  function resetHabitFormMode({ clearForm = true } = {}) {
    editingHabitId = null;
    if (clearForm) {
      els.habitForm.reset();
      els.habitForm.elements.icon.value = 'number';
      if (els.habitForm.elements.target_period) els.habitForm.elements.target_period.value = 'day';
      if (els.habitForm.elements.dna_difficulty) els.habitForm.elements.dna_difficulty.value = '2';
      if (els.habitForm.elements.dna_energy) els.habitForm.elements.dna_energy.value = '3';
      if (els.habitForm.elements.dna_preferred_time) els.habitForm.elements.dna_preferred_time.value = 'flexible';
      if (els.habitForm.elements.dna_emotional_hurdle) els.habitForm.elements.dna_emotional_hurdle.value = 'consistency';
      if (els.habitForm.elements.dna_trigger) els.habitForm.elements.dna_trigger.value = 'routine';
      if (els.habitForm.elements.dna_reward) els.habitForm.elements.dna_reward.value = 'progress';
    }
    els.habitFormTitle.textContent = 'Gewohnheit anlegen';
    els.habitSubmitBtn.textContent = 'Habit erstellen';
    els.cancelHabitEditBtn.classList.add('hidden');
    syncHabitFormPanel();
    renderHabits();
  }

  async function deleteHabit(id) {
    const habit = state.habits.find(h => h.id === id);
    if (!habit) return;
    if (isSystemMeditationHabit(habit)) {
      toast('Meditation ist ein System-Habit und bleibt für Atem-Logs aktiv.');
      return;
    }
    if (!confirm(`Habit „${habit.name}“ und zugehörige Logs wirklich löschen?`)) return;
    const removedEntryIds = state.habitEntries.filter(e => e.habit_id === id).map(e => e.id);
    const removedLedgerIds = state.pointsLedger
      .filter(p => p.source_type === 'habit' && removedEntryIds.includes(p.source_id))
      .map(p => p.id);
    state.habits = state.habits.filter(h => h.id !== id);
    state.habitEntries = state.habitEntries.filter(e => e.habit_id !== id);
    expandedHabitCardIds.delete(id);
    expandedHabitDnaIds.delete(id);
    persistExpandedHabitCardIds();
    persistExpandedHabitDnaIds();
    state.pointsLedger = state.pointsLedger.filter(p => !(p.source_type === 'habit' && removedEntryIds.includes(p.source_id)));
    markRemoteDeleted('habit_definitions', id);
    markRemoteDeletedMany('habit_entries', removedEntryIds);
    markRemoteDeletedMany('points_ledger', removedLedgerIds);
    if (editingHabitId === id) resetHabitFormMode({ clearForm: true });
    saveState();
    renderHabits();
    renderHistoryModal();
    await deleteRemoteByIds('points_ledger', removedLedgerIds);
    await deleteRemoteByIds('habit_entries', removedEntryIds);
    await deleteRemoteById('habit_definitions', id);
    toast('Habit gelöscht');
    syncWithSupabase({ silent: true, pullFirst: false });
  }

  function createTask(event) {
    event.preventDefault();
    const data = new FormData(els.taskForm);
    const values = {
      title: String(data.get('title') || '').trim(),
      description: String(data.get('description') || '').trim(),
      effort: Number(data.get('effort') || 3),
      priority: normalizeTaskPriority(data.get('priority')),
      due_at: data.get('due_at') ? new Date(data.get('due_at')).toISOString() : null,
      updated_at: nowIso(),
      synced: false
    };
    if (!values.title) return;

    if (editingTaskId) {
      const task = state.tasks.find(t => t.id === editingTaskId);
      if (!task) {
        resetTaskFormMode();
        toast('Aufgabe wurde nicht gefunden.');
        return;
      }
      Object.assign(task, values);
      if (task.status === 'done') {
        task.points = taskPoints(task);
        addPoints('task', task.id, task.points, `Aufgabe abgeschlossen: ${task.title}`, task.completed_at || nowIso());
      }
      resetTaskFormMode({ clearForm: true });
      taskFormOpen = false;
      syncTaskFormPanel();
      saveState();
      toast('Aufgabe aktualisiert');
      syncWithSupabase({ silent: true, pullFirst: false });
      return;
    }

    const created = nowIso();
    state.tasks.push({
      id: uid(),
      ...values,
      status: 'open',
      completed_at: null,
      done_archived_at: null,
      done_archive_rank: null,
      points: 0,
      created_at: created,
      updated_at: created
    });
    resetTaskFormMode({ clearForm: true });
    taskFormOpen = false;
    syncTaskFormPanel();
    saveState();
    toast('Aufgabe gespeichert');
    syncWithSupabase({ silent: true });
  }

  function suggestedTaskIdeas() {
    const todayKey = toDateKey(new Date());
    const openIdeaKeys = new Set((state.taskIdeas || []).map(idea => idea.source_key).filter(Boolean));
    const suggestions = [];
    const add = idea => {
      if (!idea.source_key || openIdeaKeys.has(idea.source_key)) return;
      if (suggestions.some(item => item.source_key === idea.source_key)) return;
      suggestions.push(idea);
    };

    const overdue = state.tasks
      .map(normalizeTask)
      .filter(task => isActiveTask(task) && taskDueState(task).overdue)
      .sort((a, b) => taskOverdueDays(b) - taskOverdueDays(a))[0];
    if (overdue) add({
      source_key: `overdue:${overdue.id}`,
      title: `Mini-Schritt für: ${overdue.title}`,
      description: `Diese Aufgabe ist ${taskDueState(overdue).label}. Vorschlag: nächsten kleinsten Schritt formulieren und 15 Minuten blocken.`,
      category: 'focus',
      story_points: 2,
      priority: 'high'
    });

    const backlog = backlogTasks()[0];
    if (backlog) add({
      source_key: `backlog:${backlog.id}`,
      title: `Backlog prüfen: ${backlog.title}`,
      description: 'Entscheide, ob diese Karte diese Woche aktiv werden soll oder bewusst im Backlog bleibt.',
      category: 'focus',
      story_points: 1,
      priority: normalizeTaskPriority(backlog.priority)
    });

    const activeHabits = state.habits.filter(habit => !habit.is_archived);
    const missedHabit = activeHabits.find(habit => !entriesForHabitOnDate(habit.id, todayKey).length);
    if (missedHabit) add({
      source_key: `habit-gap:${missedHabit.id}:${todayKey}`,
      title: `${missedHabit.name} heute absichern`,
      description: 'Kleinen Slot oder Mini-Version planen, damit der Habit nicht nur im Kopf bleibt.',
      category: 'habit',
      story_points: 2,
      priority: 'medium'
    });

    const cigsToday = state.cigarettes.filter(cigarette => toDateKey(cigarette.smoked_at) === todayKey).length;
    if (cigsToday >= 3) add({
      source_key: `smoke-reset:${todayKey}`,
      title: '10-Minuten Craving-Reset einplanen',
      description: `${cigsToday} Zigaretten heute. Vorschlag: Wasser, kurzer Walk und Delay-Check als konkrete Gegenaktion.`,
      category: 'consumption',
      story_points: 2,
      priority: 'high'
    });

    const alcoholLast7 = state.alcoholUnits.filter(unit => {
      const time = new Date(unit.occurred_at || unit.created_at || 0).getTime();
      return Number.isFinite(time) && Date.now() - time <= 7 * DAY_MS;
    }).length;
    if (alcoholLast7 > 0) add({
      source_key: `alcohol-window:${todayKey}`,
      title: 'Alkoholfreies Abendfenster festlegen',
      description: 'Ein ruhiges Abendfenster reduziert Folge-Cravings und hält den nächsten Tag planbarer.',
      category: 'consumption',
      story_points: 1,
      priority: 'medium'
    });

    if (!state.tasks.some(isActiveTask)) add({
      source_key: `focus-task:${todayKey}`,
      title: 'Eine wichtigste Aufgabe für heute definieren',
      description: 'Nur eine aktive Karte wählen und in Bearbeitung ziehen. Das senkt Task-Druck sofort.',
      category: 'focus',
      story_points: 1,
      priority: 'medium'
    });

    const appointmentsToday = appointmentsOnDate(todayKey);
    if (appointmentsToday.length >= 3) add({
      source_key: `calendar-buffer:${todayKey}`,
      title: 'Puffer nach dichtem Kalender setzen',
      description: `${appointmentsToday.length} Termine heute. Plane einen kleinen Recovery-Puffer, statt direkt in die nächste Aufgabe zu springen.`,
      category: 'health',
      story_points: 1,
      priority: 'medium'
    });

    return suggestions.slice(0, 6);
  }

  function generateTaskIdeas() {
    const suggestions = suggestedTaskIdeas();
    if (!suggestions.length) {
      toast('Keine neuen Vorschläge gefunden');
      return;
    }
    const created = nowIso();
    suggestions.forEach(idea => {
      state.taskIdeas.push(normalizeTaskIdea({
        id: uid(),
        ...idea,
        idea_status: 'open',
        generated_task_id: null,
        created_at: created,
        updated_at: created,
        synced: false
      }));
    });
    taskIdeasOpen = true;
    saveState();
    toast(`${suggestions.length} Vorschlag/Vorschläge im Ideenpool`);
    syncWithSupabase({ silent: true });
  }

  function createTaskIdea(event) {
    event.preventDefault();
    if (!els.taskIdeaForm) return;
    const data = new FormData(els.taskIdeaForm);
    const title = String(data.get('title') || '').trim();
    if (!title) return;
    const created = nowIso();
    state.taskIdeas.push(normalizeTaskIdea({
      id: uid(),
      title,
      description: String(data.get('description') || '').trim(),
      category: data.get('category'),
      story_points: Number(data.get('story_points') || 2),
      priority: normalizeTaskPriority(data.get('priority')),
      idea_status: 'open',
      source_key: null,
      generated_task_id: null,
      created_at: created,
      updated_at: created,
      synced: false
    }));
    els.taskIdeaForm.reset();
    els.taskIdeaForm.elements.story_points.value = '2';
    els.taskIdeaForm.elements.priority.value = 'medium';
    saveState();
    toast('Idee gespeichert');
    syncWithSupabase({ silent: true });
  }

  function createTaskFromIdea(id, targetStatus = 'open', { dueAt = null } = {}) {
    const idea = state.taskIdeas.find(item => item.id === id);
    if (!idea || idea.idea_status !== 'open') return;
    const created = nowIso();
    const nextStatus = targetStatus === TASK_BACKLOG_STATUS ? TASK_BACKLOG_STATUS : 'open';
    const task = {
      id: uid(),
      title: idea.title,
      description: [idea.description, `Aus Ideenpool übernommen · ${Number(idea.story_points || 2)} Story Points`].filter(Boolean).join('\n\n'),
      effort: storyPointsToEffort(idea.story_points),
      priority: normalizeTaskPriority(idea.priority),
      due_at: dueAt || null,
      status: nextStatus,
      backlog_rank: nextStatus === TASK_BACKLOG_STATUS ? nextBacklogRank() : null,
      completed_at: null,
      done_archived_at: null,
      done_archive_rank: null,
      points: 0,
      created_at: created,
      updated_at: created,
      synced: false
    };
    state.tasks.push(task);
    idea.idea_status = 'accepted';
    idea.accepted_at = created;
    idea.generated_task_id = task.id;
    idea.updated_at = created;
    idea.synced = false;
    if (nextStatus === TASK_BACKLOG_STATUS) taskBacklogOpen = true;
    saveState();
    toast(dueAt ? 'Idee als geplante Aufgabe erstellt' : (nextStatus === TASK_BACKLOG_STATUS ? 'Idee als Backlog-Task erstellt' : 'Idee als Aufgabe erstellt'));
    syncWithSupabase({ silent: true });
  }

  function dismissTaskIdea(id) {
    const idea = state.taskIdeas.find(item => item.id === id);
    if (!idea) return;
    idea.idea_status = 'dismissed';
    idea.dismissed_at = nowIso();
    idea.updated_at = idea.dismissed_at;
    idea.synced = false;
    saveState();
    toast('Idee verworfen');
    syncWithSupabase({ silent: true });
  }

  function reopenTaskIdea(id) {
    const idea = state.taskIdeas.find(item => item.id === id);
    if (!idea) return;
    idea.idea_status = 'open';
    idea.accepted_at = null;
    idea.dismissed_at = null;
    idea.updated_at = nowIso();
    idea.synced = false;
    saveState();
    toast('Idee wieder geöffnet');
    syncWithSupabase({ silent: true });
  }

  async function deleteTaskIdea(id) {
    const idea = state.taskIdeas.find(item => item.id === id);
    if (!idea) return;
    if (!confirm(`Idee „${idea.title}“ wirklich löschen?`)) return;
    state.taskIdeas = state.taskIdeas.filter(item => item.id !== id);
    markRemoteDeleted('task_ideas', id);
    saveState();
    await deleteRemoteById('task_ideas', id);
    toast('Idee gelöscht');
    syncWithSupabase({ silent: true, pullFirst: false });
  }

  function completeTask(id) {
    moveTaskToStatus(id, 'done');
  }

  function moveTaskToStatus(id, nextStatus) {
    if (!TASK_COLUMNS.some(column => column.status === nextStatus)) return;
    const task = state.tasks.find(t => t.id === id);
    if (!task || task.status === nextStatus) return;
    const previousStatus = task.status || 'open';
    const wasDoneArchived = isDoneArchivedTask(task);
    task.status = nextStatus;
    if (nextStatus !== 'done') {
      task.done_archived_at = null;
      task.done_archive_rank = null;
    }
    if (nextStatus === TASK_BACKLOG_STATUS && !Number.isFinite(Number(task.backlog_rank))) task.backlog_rank = nextBacklogRank();
    task.updated_at = nowIso();
    task.synced = false;

    if (nextStatus === 'done') {
      task.done_archived_at = null;
      task.done_archive_rank = null;
      task.completed_at = nowIso();
      task.points = taskPoints(task);
      addPoints('task', task.id, task.points, `Aufgabe abgeschlossen: ${task.title}`, task.completed_at);
    } else if (previousStatus === 'done' && nextStatus !== TASK_BACKLOG_STATUS) {
      task.completed_at = null;
      task.points = 0;
      markRemoteDeletedMany('points_ledger', removeTaskPoints(task.id));
    } else if (nextStatus === TASK_BACKLOG_STATUS) {
      task.completed_at = null;
      task.points = 0;
      markRemoteDeletedMany('points_ledger', removeTaskPoints(task.id));
    }

    if (editingTaskId === id && nextStatus === TASK_BACKLOG_STATUS) resetTaskFormMode({ clearForm: true });
    if (previousStatus === TASK_BACKLOG_STATUS || nextStatus === TASK_BACKLOG_STATUS) compactBacklogRanks();
    if (wasDoneArchived || nextStatus !== 'done') compactDoneArchiveRanks();
    saveState();
    const label = TASK_COLUMNS.find(column => column.status === nextStatus)?.title || 'verschoben';
    toast(`Aufgabe: ${label}`);
    syncWithSupabase({ silent: true });
  }

  function moveTaskToBacklog(id, targetId = null, { insertAfter = false } = {}) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    if (targetId === id && (task.status || 'open') === TASK_BACKLOG_STATUS) return;
    const ordered = backlogTasks().filter(item => item.id !== id);
    const wasBacklog = (task.status || 'open') === TASK_BACKLOG_STATUS;
    task.status = TASK_BACKLOG_STATUS;
    task.completed_at = null;
    task.done_archived_at = null;
    task.done_archive_rank = null;
    task.points = 0;
    task.updated_at = nowIso();
    task.synced = false;
    markRemoteDeletedMany('points_ledger', removeTaskPoints(task.id));

    let insertIndex = ordered.length;
    if (targetId) {
      const targetIndex = ordered.findIndex(item => item.id === targetId);
      if (targetIndex >= 0) insertIndex = targetIndex + (insertAfter ? 1 : 0);
    }
    ordered.splice(insertIndex, 0, task);
    ordered.forEach((item, index) => {
      const source = state.tasks.find(t => t.id === item.id);
      if (source) source.backlog_rank = index + 1;
    });
    taskBacklogOpen = true;
    if (editingTaskId === id) resetTaskFormMode({ clearForm: true });
    saveState();
    toast(wasBacklog ? 'Backlog neu priorisiert' : 'Aufgabe ins Backlog verschoben');
    syncWithSupabase({ silent: true });
  }

  function shiftBacklogTask(id, delta) {
    const ordered = backlogTasks();
    const index = ordered.findIndex(task => task.id === id);
    if (index < 0) return;
    const nextIndex = Math.max(0, Math.min(ordered.length - 1, index + delta));
    if (nextIndex === index) return;
    const [item] = ordered.splice(index, 1);
    ordered.splice(nextIndex, 0, item);
    ordered.forEach((task, orderIndex) => {
      const source = state.tasks.find(t => t.id === task.id);
      if (source) {
        source.backlog_rank = orderIndex + 1;
        source.updated_at = nowIso();
        source.synced = false;
      }
    });
    saveState();
    toast('Backlog priorisiert');
    syncWithSupabase({ silent: true });
  }

  function archiveDoneTask(id, targetId = null, { insertAfter = false } = {}) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    if ((task.status || 'open') !== 'done') {
      toast('Nur erledigte Aufgaben können archiviert werden.');
      return;
    }
    if (targetId === id && isDoneArchivedTask(task)) return;
    const ordered = archivedDoneTasks().filter(item => item.id !== id);
    const wasArchived = isDoneArchivedTask(task);
    if (!task.completed_at) task.completed_at = nowIso();
    if (!task.points) task.points = taskPoints(task);
    task.done_archived_at = task.done_archived_at || nowIso();
    task.done_archive_rank = Number.isFinite(Number(task.done_archive_rank)) ? Number(task.done_archive_rank) : nextDoneArchiveRank();
    task.updated_at = nowIso();
    task.synced = false;

    let insertIndex = ordered.length;
    if (targetId) {
      const targetIndex = ordered.findIndex(item => item.id === targetId);
      if (targetIndex >= 0) insertIndex = targetIndex + (insertAfter ? 1 : 0);
    }
    ordered.splice(insertIndex, 0, task);
    ordered.forEach((item, index) => {
      const source = state.tasks.find(t => t.id === item.id);
      if (source) {
        source.done_archive_rank = index + 1;
        source.updated_at = nowIso();
        source.synced = false;
      }
    });
    taskArchiveOpen = true;
    saveState();
    toast(wasArchived ? 'Archiv neu sortiert' : 'Erledigte Aufgabe archiviert');
    syncWithSupabase({ silent: true });
  }

  function restoreArchivedDoneTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task || !isDoneArchivedTask(task)) return;
    task.done_archived_at = null;
    task.done_archive_rank = null;
    task.updated_at = nowIso();
    task.synced = false;
    compactDoneArchiveRanks();
    saveState();
    toast('Aufgabe wieder in Erledigt');
    syncWithSupabase({ silent: true });
  }

  function shiftArchivedDoneTask(id, delta) {
    const ordered = archivedDoneTasks();
    const index = ordered.findIndex(task => task.id === id);
    if (index < 0) return;
    const nextIndex = Math.max(0, Math.min(ordered.length - 1, index + delta));
    if (nextIndex === index) return;
    const [item] = ordered.splice(index, 1);
    ordered.splice(nextIndex, 0, item);
    ordered.forEach((task, orderIndex) => {
      const source = state.tasks.find(t => t.id === task.id);
      if (source) {
        source.done_archive_rank = orderIndex + 1;
        source.updated_at = nowIso();
        source.synced = false;
      }
    });
    saveState();
    toast('Archiv sortiert');
    syncWithSupabase({ silent: true });
  }

  function removeTaskPoints(taskId) {
    const removed = state.pointsLedger.filter(p => p.source_type === 'task' && p.source_id === taskId).map(p => p.id);
    state.pointsLedger = state.pointsLedger.filter(p => !(p.source_type === 'task' && p.source_id === taskId));
    return removed;
  }


  function editTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    editingTaskId = id;
    const fields = els.taskForm.elements;
    fields.title.value = task.title || '';
    fields.description.value = task.description || '';
    fields.effort.value = String(task.effort || 3);
    fields.priority.value = normalizeTaskPriority(task.priority);
    fields.due_at.value = toDateTimeLocalValue(task.due_at);
    els.taskFormTitle.textContent = 'Aufgabe bearbeiten';
    els.taskSubmitBtn.textContent = 'Änderungen speichern';
    els.cancelTaskEditBtn.classList.remove('hidden');
    taskFormOpen = true;
    syncTaskFormPanel();
    updateTaskPreview();
    showScreen('tasks');
    els.taskForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    renderTasks();
  }

  function resetTaskFormMode({ clearForm = true } = {}) {
    editingTaskId = null;
    if (clearForm) {
      els.taskForm.reset();
      els.taskForm.elements.effort.value = '3';
      els.taskForm.elements.priority.value = 'medium';
    }
    els.taskFormTitle.textContent = 'Aufgabe erfassen';
    els.taskSubmitBtn.textContent = 'Aufgabe speichern';
    els.cancelTaskEditBtn.classList.add('hidden');
    syncTaskFormPanel();
    updateTaskPreview();
    renderTasks();
  }

  async function deleteTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    if (!confirm(`Aufgabe „${task.title}“ wirklich löschen?`)) return;
    const removedLedgerIds = state.pointsLedger
      .filter(p => p.source_type === 'task' && p.source_id === id)
      .map(p => p.id);
    state.tasks = state.tasks.filter(t => t.id !== id);
    state.pointsLedger = state.pointsLedger.filter(p => !(p.source_type === 'task' && p.source_id === id));
    markRemoteDeleted('tasks', id);
    markRemoteDeletedMany('points_ledger', removedLedgerIds);
    if (editingTaskId === id) resetTaskFormMode({ clearForm: true });
    saveState();
    renderHabits();
    renderHistoryModal();
    await deleteRemoteByIds('points_ledger', removedLedgerIds);
    await deleteRemoteById('tasks', id);
    toast('Aufgabe gelöscht');
    syncWithSupabase({ silent: true, pullFirst: false });
  }

  function archiveTask(id) {
    moveTaskToStatus(id, 'archived');
  }

  function updateTaskPreview() {
    const effort = Number(els.taskForm.elements.effort.value || 3);
    const priority = normalizeTaskPriority(els.taskForm.elements.priority?.value || 'medium');
    const previewTask = { effort, priority };
    const bonus = taskPriorityMeta(priority).bonus;
    els.taskPointsPreview.textContent = bonus ? `+${taskPoints(previewTask)} Pkt. · Prio +${bonus}` : `+${taskPoints(previewTask)} Pkt.`;
  }

  function createAppointment(event) {
    event.preventDefault();
    if (!els.appointmentForm) return;
    const data = new FormData(els.appointmentForm);
    const startsAt = validIsoOrNull(data.get('starts_at'));
    const endsAt = validIsoOrNull(data.get('ends_at'));
    const values = {
      title: String(data.get('title') || '').trim(),
      description: String(data.get('description') || '').trim(),
      location: String(data.get('location') || '').trim(),
      appointment_type: normalizeAppointmentType(data.get('appointment_type')),
      starts_at: startsAt,
      ends_at: endsAt,
      updated_at: nowIso(),
      synced: false
    };
    if (!values.title) return;
    if (!startsAt) {
      toast('Bitte Startzeit für den Termin setzen.');
      return;
    }
    if (endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
      toast('Ende darf nicht vor dem Start liegen.');
      return;
    }

    if (editingAppointmentId) {
      const appointment = state.appointments.find(item => item.id === editingAppointmentId);
      if (!appointment) {
        resetAppointmentFormMode({ clearForm: true });
        toast('Termin wurde nicht gefunden.');
        return;
      }
      Object.assign(appointment, values);
      resetAppointmentFormMode({ clearForm: true, dateKey: toDateKey(values.starts_at) || selectedCalendarDate });
      appointmentFormOpen = false;
      syncAppointmentFormPanel();
      selectedCalendarDate = toDateKey(values.starts_at) || selectedCalendarDate;
      calendarCursor = new Date(`${selectedCalendarDate}T12:00:00`);
      saveState();
      toast('Termin aktualisiert');
      syncWithSupabase({ silent: true, pullFirst: false });
      return;
    }

    const created = nowIso();
    const appointment = normalizeAppointment({ id: uid(), ...values, created_at: created, updated_at: created });
    state.appointments.push(appointment);
    selectedCalendarDate = toDateKey(appointment.starts_at) || selectedCalendarDate;
    calendarCursor = new Date(`${selectedCalendarDate}T12:00:00`);
    resetAppointmentFormMode({ clearForm: true, dateKey: selectedCalendarDate });
    appointmentFormOpen = false;
    syncAppointmentFormPanel();
    saveState();
    toast('Termin gespeichert');
    syncWithSupabase({ silent: true });
  }

  function editAppointment(id) {
    const appointment = state.appointments.find(item => item.id === id);
    if (!appointment || !els.appointmentForm) return;
    editingAppointmentId = id;
    appointmentFormOpen = true;
    const fields = els.appointmentForm.elements;
    fields.title.value = appointment.title || '';
    fields.starts_at.value = toDateTimeLocalValue(appointment.starts_at);
    fields.ends_at.value = toDateTimeLocalValue(appointment.ends_at);
    fields.appointment_type.value = normalizeAppointmentType(appointment.appointment_type);
    fields.location.value = appointment.location || '';
    fields.description.value = appointment.description || '';
    els.appointmentFormTitle.textContent = 'Termin bearbeiten';
    els.appointmentSubmitBtn.textContent = 'Änderungen speichern';
    els.cancelAppointmentEditBtn.classList.remove('hidden');
    syncAppointmentFormPanel();
    showScreen('calendar');
    els.appointmentForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    renderCalendar();
    renderDayDetails();
  }

  function resetAppointmentFormMode({ clearForm = true, dateKey = selectedCalendarDate } = {}) {
    editingAppointmentId = null;
    if (clearForm && els.appointmentForm) {
      els.appointmentForm.reset();
      const defaults = defaultAppointmentRange(dateKey);
      els.appointmentForm.elements.starts_at.value = defaults.start;
      els.appointmentForm.elements.ends_at.value = defaults.end;
      els.appointmentForm.elements.appointment_type.value = 'personal';
    }
    if (els.appointmentFormTitle) els.appointmentFormTitle.textContent = 'Termin erfassen';
    if (els.appointmentSubmitBtn) els.appointmentSubmitBtn.textContent = 'Termin speichern';
    els.cancelAppointmentEditBtn?.classList.add('hidden');
    syncAppointmentFormPanel();
    renderCalendar();
    renderDayDetails();
  }

  async function deleteAppointment(id) {
    const appointment = state.appointments.find(item => item.id === id);
    if (!appointment) return;
    if (!confirm(`Termin „${appointment.title}“ wirklich löschen?`)) return;
    state.appointments = state.appointments.filter(item => item.id !== id);
    markRemoteDeleted('appointments', id);
    if (editingAppointmentId === id) resetAppointmentFormMode({ clearForm: true });
    saveState();
    await deleteRemoteById('appointments', id);
    toast('Termin gelöscht');
    syncWithSupabase({ silent: true, pullFirst: false });
  }

  function defaultAppointmentRange(dateKey = selectedCalendarDate) {
    const now = new Date();
    let start;
    if (dateKey === toDateKey(now)) {
      start = new Date(now);
      start.setMinutes(now.getMinutes() > 30 ? 0 : 30, 0, 0);
      if (start.getTime() <= now.getTime()) start.setHours(start.getHours() + 1);
    } else {
      start = new Date(`${dateKey || toDateKey(now)}T09:00:00`);
      if (Number.isNaN(start.getTime())) start = new Date(now);
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return { start: toDateTimeLocalValue(start.toISOString()), end: toDateTimeLocalValue(end.toISOString()) };
  }

  function syncAppointmentEndDefault() {
    if (!els.appointmentForm) return;
    const fields = els.appointmentForm.elements;
    const start = new Date(fields.starts_at.value);
    const end = new Date(fields.ends_at.value);
    if (Number.isNaN(start.getTime())) return;
    if (Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
      fields.ends_at.value = toDateTimeLocalValue(new Date(start.getTime() + 60 * 60 * 1000).toISOString());
    }
  }

  function moveMonth(delta) {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + delta, 1);
    renderCalendar();
  }

  function addPoints(sourceType, sourceId, points, reason, earnedAt = nowIso()) {
    const existing = state.pointsLedger.find(p => p.source_type === sourceType && p.source_id === sourceId);
    if (existing) {
      const changed = Number(existing.points || 0) !== Number(points || 0) || existing.reason !== reason || existing.earned_at !== earnedAt;
      if (!changed) return false;
      existing.points = points;
      existing.reason = reason;
      existing.earned_at = earnedAt;
      existing.updated_at = nowIso();
      existing.synced = false;
      return true;
    }
    const createdAt = nowIso();
    state.pointsLedger.push({ id: uid(), source_type: sourceType, source_id: sourceId, points, reason, earned_at: earnedAt, created_at: createdAt, updated_at: createdAt, synced: false });
    return true;
  }

  function cigarettePoints(minutes, { isDaytimeInterval = false } = {}) {
    if (minutes == null) return 0;
    if (minutes < 30) return -40;
    if (minutes < 60) return -20;
    if (minutes < 120) return 0;
    if (minutes < 240) return 20;
    if (minutes < 480) return 40;
    return isDaytimeInterval ? 80 : 0;
  }

  function smokingScoringContext(previousCigarette, cigarette) {
    return {
      previousSmokedAt: previousCigarette?.smoked_at || null,
      smokedAt: cigarette?.smoked_at || null,
      isDaytimeInterval: isDaytimeSmokeInterval(previousCigarette?.smoked_at, cigarette?.smoked_at)
    };
  }

  function isDaytimeSmokeInterval(previousSmokedAt, smokedAt) {
    if (!previousSmokedAt || !smokedAt) return false;
    const prev = new Date(previousSmokedAt);
    const current = new Date(smokedAt);
    if (Number.isNaN(prev.getTime()) || Number.isNaN(current.getTime())) return false;
    return toDateKey(prev) === toDateKey(current);
  }

  function cigarettePointReason(minutes, { isDaytimeInterval = false } = {}) {
    if (minutes == null) return 'Erste Zigarette erfasst';
    if (minutes >= 480 && !isDaytimeInterval) return `Pause ${formatDuration(minutes)} · kein 8h-Tagesbonus`;
    return `Pause ${formatDuration(minutes)}`;
  }

  function migrateCigaretteScoring() {
    if (!state.cigarettes.length) return false;
    const changed = recalculateSmokeIntervals({ markUpdated: true });
    if (changed) saveState({ skipRender: true });
    return changed;
  }

  function taskPoints(task) {
    const effort = Math.max(1, Math.min(5, Number(task.effort || 3)));
    let points = effort * 20 + taskPriorityMeta(task).bonus;
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

  function habitValueForPeriod(habit, endDate = new Date()) {
    const meta = habitTargetPeriodMeta(habit);
    const endKey = toDateKey(endDate);
    const keys = meta.days === 1 ? [endKey] : daysBack(meta.days);
    const entries = state.habitEntries.filter(e => e.habit_id === habit.id && keys.includes(toDateKey(e.occurred_at)));
    if (!entries.length) return { value: habit.type === 'boolean' ? 0 : 0, label: formatHabitValue(habit, 0), entries };
    if (habit.type === 'boolean') {
      const value = new Set(entries.filter(e => e.value_bool).map(e => toDateKey(e.occurred_at))).size;
      return { value, label: `${value}/${keys.length} Tage`, entries };
    }
    const value = habit.type === 'weight' ? Number(entries.sort((a,b)=>new Date(a.occurred_at)-new Date(b.occurred_at)).at(-1)?.value_num || 0) : sum(entries.map(e => Number(e.value_num || 0)));
    return { value, label: formatHabitValue(habit, value), entries };
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

  function bestDaytimePauseMinutes() {
    const intervals = smokeIntervalSnapshots()
      .filter(item => item.isDaytimeInterval && Number.isFinite(item.interval_minutes))
      .map(item => Number(item.interval_minutes));
    return intervals.length ? Math.max(...intervals) : null;
  }

  function smokeIntervalSnapshots() {
    const sorted = [...state.cigarettes].sort((a, b) => new Date(a.smoked_at) - new Date(b.smoked_at));
    return sorted.map((c, index) => {
      const prev = sorted[index - 1] || null;
      const interval = prev ? Math.max(0, Math.round((new Date(c.smoked_at) - new Date(prev.smoked_at)) / 60000)) : null;
      return { cigarette: c, previous: prev, interval_minutes: interval, ...smokingScoringContext(prev, c) };
    });
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

  function formatTime(value) {
    if (!value) return '–';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '–';
    return date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
  }

  function formatAppointmentRange(appointment) {
    if (!appointment?.starts_at) return 'ohne Zeit';
    const startKey = toDateKey(appointment.starts_at);
    const endKey = toDateKey(appointment.ends_at || appointment.starts_at);
    if (appointment.ends_at && startKey !== endKey) return `${formatDateTime(appointment.starts_at)} – ${formatDateTime(appointment.ends_at)}`;
    if (appointment.ends_at) return `${formatTime(appointment.starts_at)}–${formatTime(appointment.ends_at)}`;
    return formatTime(appointment.starts_at);
  }

  function toDateTimeLocalValue(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function localDateTimeFromParts(dateValue, timeValue) {
    const dateParts = String(dateValue || '').split('-').map(Number);
    const timeParts = String(timeValue || '').split(':').map(Number);
    const [year, month, day] = dateParts;
    const [hours, minutes] = timeParts;
    if (dateParts.length !== 3 || timeParts.length < 2 || [year, month, day, hours, minutes].some(value => !Number.isInteger(value))) {
      return new Date(NaN);
    }
    const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hours || date.getMinutes() !== minutes) {
      return new Date(NaN);
    }
    return date;
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

  function getSupabaseConfig() {
    return {
      url: String(SUPABASE_CONFIG.url || SUPABASE_CONFIG.supabaseUrl || '').trim(),
      anonKey: String(SUPABASE_CONFIG.anonKey || SUPABASE_CONFIG.supabaseAnonKey || '').trim()
    };
  }

  function isSupabaseConfigured() {
    const config = getSupabaseConfig();
    return Boolean(config.url && config.anonKey && window.supabase);
  }

  async function initSupabase() {
    const config = getSupabaseConfig();
    if (!config.url || !config.anonKey || !window.supabase) {
      renderAuthUi('offline');
      renderSyncStatus('offline');
      return;
    }
    try {
      supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      passwordRecoveryMode = window.location.hash.includes('type=recovery');
      attachAuthListener();
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      setAuthSession(data?.session || null);
      if (!currentUser) {
        renderSyncStatus('auth');
        console.log('HabitFlow wartet auf Supabase Auth Login');
        return;
      }
      renderSyncStatus('syncing');
      await syncWithSupabase({ silent: true, pullFirst: true });
      await syncLeisureCatalogWithSupabase({ silent: true });
      subscribeToRemoteChanges();
      renderSyncStatus('connected');
      console.log('HabitFlow Supabase Auth verbunden');
    } catch (error) {
      console.warn('Supabase init error', error);
      renderAuthUi('error');
      renderSyncStatus('error');
      toast('Supabase konnte nicht initialisiert werden. App läuft lokal weiter.');
    }
  }

  function setAuthSession(session) {
    authSession = session || null;
    currentUser = authSession?.user || null;
    if (settings && currentUser?.email) {
      settings.email = currentUser.email;
      saveSettingsToStorage();
    }
    renderAuthUi();
  }

  function attachAuthListener() {
    if (!supabaseClient || authSubscription) return;
    const { data } = supabaseClient.auth.onAuthStateChange((event, session) => {
      const wasSignedOut = !currentUser;
      if (event === 'PASSWORD_RECOVERY') passwordRecoveryMode = true;
      setAuthSession(session || null);
      renderSyncStatus(currentUser ? 'connected' : 'auth');
      if (!currentUser) clearRemoteSubscription();
      if (currentUser && (wasSignedOut || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        subscribeToRemoteChanges();
        syncWithSupabase({ silent: true, pullFirst: true }).then(() => syncLeisureCatalogWithSupabase({ silent: true }));
      }
    });
    authSubscription = data?.subscription || null;
  }

  function currentUserId() {
    return currentUser?.id || authSession?.user?.id || null;
  }

  function isAuthenticated() {
    return Boolean(supabaseClient && currentUserId());
  }

  function requireAuthenticatedUserId() {
    const userId = currentUserId();
    if (!userId) throw new Error('Bitte zuerst anmelden.');
    return userId;
  }

  function rowsForCurrentUser(rows = []) {
    if (!rows.length) return [];
    const userId = requireAuthenticatedUserId();
    return rows.map(row => ({ ...row, user_id: userId }));
  }

  function renderAuthUi(mode) {
    if (!els.authGate) return;
    const configured = isSupabaseConfigured();
    const signedIn = Boolean(currentUserId());
    const showGate = configured && (!signedIn || passwordRecoveryMode);
    els.authGate.classList.toggle('hidden', !showGate);
    document.body.classList.toggle('auth-locked', showGate);
    if (els.authEmailInput && currentUser?.email) els.authEmailInput.value = currentUser.email;
    if (els.authEmailInput && !els.authEmailInput.value && settings?.email) els.authEmailInput.value = settings.email;
    if (els.authEmailInput) els.authEmailInput.disabled = passwordRecoveryMode;
    if (els.authPasswordInput) {
      els.authPasswordInput.value = '';
      els.authPasswordInput.autocomplete = passwordRecoveryMode ? 'new-password' : 'current-password';
      els.authPasswordInput.placeholder = passwordRecoveryMode ? 'Neues sicheres Passwort' : 'Dein Passwort';
    }
    if (els.authPasswordConfirmInput) els.authPasswordConfirmInput.value = '';
    if (els.authPasswordConfirmField) els.authPasswordConfirmField.classList.toggle('hidden', !passwordRecoveryMode);
    if (els.authPasswordLabel) els.authPasswordLabel.textContent = passwordRecoveryMode ? 'Neues Passwort' : 'Passwort';
    if (els.authSubmitBtn) els.authSubmitBtn.textContent = passwordRecoveryMode ? 'Passwort speichern' : 'Einloggen';
    if (els.authResetBtn) els.authResetBtn.classList.toggle('hidden', passwordRecoveryMode);
    if (els.authUserEmail) els.authUserEmail.textContent = currentUser?.email || 'nicht angemeldet';
    if (!els.authStatusText) return;
    if (!configured) {
      els.authStatusText.textContent = 'Supabase ist nicht konfiguriert. Die App läuft lokal ohne Remote-Schutz.';
    } else if (mode === 'offline') {
      els.authStatusText.textContent = 'Supabase ist nicht erreichbar oder nicht konfiguriert. Lokale Daten bleiben auf diesem Gerät.';
    } else if (mode === 'error') {
      els.authStatusText.textContent = 'Auth konnte nicht initialisiert werden. Prüfe Supabase URL, Anon Key und Redirect URL.';
    } else if (passwordRecoveryMode) {
      els.authStatusText.textContent = 'Lege jetzt ein neues Passwort fest. Danach öffnet sich deine private, RLS-geschützte App.';
    } else if (signedIn) {
      els.authStatusText.textContent = `Angemeldet als ${currentUser?.email || 'Supabase User'}.`;
    } else {
      els.authStatusText.textContent = 'Melde dich mit E-Mail und Passwort an. Deine Session bleibt auf diesem Gerät gespeichert.';
    }
  }

  async function handleAuthForm(event) {
    if (passwordRecoveryMode) return updateRecoveredPassword(event);
    return requestPasswordLogin(event);
  }

  async function requestPasswordLogin(event) {
    if (event) event.preventDefault();
    if (!supabaseClient) {
      toast('Supabase ist nicht bereit.');
      return;
    }
    const email = String(els.authEmailInput?.value || '').trim().toLowerCase();
    const password = String(els.authPasswordInput?.value || '');
    if (!email || !password) {
      toast('Bitte E-Mail und Passwort eintragen.');
      return;
    }
    try {
      if (els.authSubmitBtn) els.authSubmitBtn.disabled = true;
      settings.email = email;
      saveSettingsToStorage();
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (els.authStatusText) els.authStatusText.textContent = 'Login erfolgreich. Deine private Datenansicht wird geladen.';
      toast('Eingeloggt');
    } catch (error) {
      console.warn('Auth password login error', error);
      const message = /Invalid login credentials/i.test(error?.message || '')
        ? 'Login fehlgeschlagen. Prüfe E-Mail und Passwort oder setze dein Passwort neu.'
        : (error?.message || 'Login fehlgeschlagen.');
      if (els.authStatusText) els.authStatusText.textContent = message;
      toast('Login fehlgeschlagen.');
    } finally {
      if (els.authSubmitBtn) els.authSubmitBtn.disabled = false;
    }
  }

  async function requestPasswordRecoveryEmail() {
    if (!supabaseClient) {
      toast('Supabase ist nicht bereit.');
      return;
    }
    const email = String(els.authEmailInput?.value || '').trim().toLowerCase();
    if (!email) {
      toast('Bitte E-Mail eintragen.');
      return;
    }
    try {
      if (els.authResetBtn) els.authResetBtn.disabled = true;
      settings.email = email;
      saveSettingsToStorage();
      const redirectTo = window.location.href.split('#')[0];
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      if (els.authStatusText) els.authStatusText.textContent = 'Passwort-Link wurde gesendet. Öffne den Link einmalig, um dein Passwort festzulegen.';
      toast('Passwort-Link gesendet');
    } catch (error) {
      console.warn('Auth password recovery error', error);
      if (els.authStatusText) els.authStatusText.textContent = error?.message || 'Passwort-Link konnte nicht gesendet werden.';
      toast('Passwort-Link konnte nicht gesendet werden.');
    } finally {
      if (els.authResetBtn) els.authResetBtn.disabled = false;
    }
  }

  async function updateRecoveredPassword(event) {
    if (event) event.preventDefault();
    if (!supabaseClient || !currentUserId()) {
      toast('Passwort-Link ist nicht aktiv.');
      return;
    }
    const password = String(els.authPasswordInput?.value || '');
    const confirmation = String(els.authPasswordConfirmInput?.value || '');
    if (password.length < 8) {
      toast('Passwort braucht mindestens 8 Zeichen.');
      return;
    }
    if (password !== confirmation) {
      toast('Passwörter stimmen nicht überein.');
      return;
    }
    try {
      if (els.authSubmitBtn) els.authSubmitBtn.disabled = true;
      const { error } = await supabaseClient.auth.updateUser({ password });
      if (error) throw error;
      passwordRecoveryMode = false;
      if (window.history?.replaceState) window.history.replaceState(null, document.title, window.location.href.split('#')[0]);
      renderAuthUi();
      renderSyncStatus('syncing');
      await syncWithSupabase({ silent: true, pullFirst: true });
      await syncLeisureCatalogWithSupabase({ silent: true });
      subscribeToRemoteChanges();
      renderSyncStatus('connected');
      toast('Passwort gespeichert');
    } catch (error) {
      console.warn('Auth update password error', error);
      if (els.authStatusText) els.authStatusText.textContent = error?.message || 'Passwort konnte nicht gespeichert werden.';
      toast('Passwort konnte nicht gespeichert werden.');
    } finally {
      if (els.authSubmitBtn) els.authSubmitBtn.disabled = false;
    }
  }

  function initOngoingSync() {
    if (!isSupabaseConfigured()) return;
    setInterval(() => syncWithSupabase({ silent: true, pullFirst: true }), 60_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        syncWithSupabase({ silent: true, pullFirst: true });
        syncLeisureCatalogWithSupabase({ silent: true });
      }
      if (document.visibilityState === 'hidden' && hasPendingSyncWork()) syncWithSupabase({ silent: true, pullFirst: false });
    });
    window.addEventListener('online', () => {
      syncWithSupabase({ silent: true, pullFirst: true });
      syncLeisureCatalogWithSupabase({ silent: true });
    });
    window.addEventListener('pagehide', () => { if (hasPendingSyncWork()) syncWithSupabase({ silent: true, pullFirst: false }); });
    window.addEventListener('beforeunload', () => { if (hasPendingSyncWork()) syncWithSupabase({ silent: true, pullFirst: false }); });
  }

  function applyRulesVisibility() {
    if (!els.rulesContent || !els.toggleRulesBtn) return;
    els.rulesContent.classList.toggle('is-collapsed', !rulesExpanded);
    els.toggleRulesBtn.setAttribute('aria-expanded', String(rulesExpanded));
    els.toggleRulesBtn.textContent = rulesExpanded ? 'Regelwerk ausblenden' : 'Regelwerk einblenden';
  }

  function toggleRulesVisibility() {
    rulesExpanded = !rulesExpanded;
    localStorage.setItem(RULES_UI_KEY, rulesExpanded ? 'expanded' : 'collapsed');
    applyRulesVisibility();
  }

  function applyConsumptionMode() {
    const mode = activeConsumptionMode === 'alcohol' ? 'alcohol' : 'smoke';
    els.consumptionPanes?.forEach(pane => pane.classList.toggle('is-active', pane.dataset.consumptionPane === mode));
    els.consumptionModeButtons?.forEach(button => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
  }

  function switchConsumptionMode(mode) {
    const next = mode === 'alcohol' ? 'alcohol' : 'smoke';
    if (activeConsumptionMode === next) return;
    activeConsumptionMode = next;
    localStorage.setItem(CONSUMPTION_MODE_KEY, next);
    applyConsumptionMode();
  }

  function hasPendingSyncWork() {
    if (!state) return false;
    if (hasPendingRemoteDeletes()) return true;
    return ['habits', 'habitEntries', 'cigarettes', 'alcoholLogs', 'alcoholUnits', 'tasks', ...(remoteTaskIdeasSupported ? ['taskIdeas'] : []), 'appointments', 'pointsLedger'].some(key => (state[key] || []).some(entry => entry?.synced === false));
  }

  function renderSyncStatus(mode) {
    if (!els.syncStatus) return;
    renderAuthUi();
    if (!isSupabaseConfigured()) {
      els.syncStatus.textContent = 'Lokal';
      els.syncStatus.className = 'badge muted';
      return;
    }
    if (!isAuthenticated()) {
      els.syncStatus.textContent = 'Login nötig';
      els.syncStatus.className = 'badge warning-badge';
      return;
    }
    if (mode === 'syncing' || syncInFlight) {
      els.syncStatus.textContent = 'Synchronisiert';
      els.syncStatus.className = 'badge muted';
      return;
    }
    if (mode === 'error') {
      els.syncStatus.textContent = 'Sync prüfen';
      els.syncStatus.className = 'badge danger-badge';
      return;
    }
    if (mode === 'pending') {
      els.syncStatus.textContent = 'Sync ausstehend';
      els.syncStatus.className = 'badge warning-badge';
      return;
    }
    els.syncStatus.textContent = lastSyncAt ? 'Privat sync aktiv' : 'Verbunden';
    els.syncStatus.className = 'badge';
  }

  async function manualSyncFromSettings(event) {
    if (event) event.preventDefault();
    await syncWithSupabase({ silent: false, pullFirst: true });
  }

  async function logout() {
    if (!supabaseClient) return;
    try {
      if (hasPendingSyncWork()) await syncWithSupabase({ silent: false, pullFirst: false });
      clearRemoteSubscription();
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      passwordRecoveryMode = false;
      setAuthSession(null);
      renderSyncStatus('auth');
      toast('Abgemeldet');
    } catch (error) {
      console.warn('Logout fehlgeschlagen', error);
      toast(`Abmelden fehlgeschlagen: ${error.message || error}`);
    }
  }

  async function syncWithSupabase({ silent = false, pullFirst = true } = {}) {
    if (!supabaseClient) {
      if (!silent) toast(isSupabaseConfigured() ? 'Supabase ist noch nicht bereit.' : 'Supabase ist nicht konfiguriert.');
      return;
    }
    if (!isAuthenticated()) {
      renderSyncStatus('auth');
      if (!silent) toast('Bitte zuerst anmelden.');
      return;
    }
    if (syncInFlight) {
      pendingSyncRequest = {
        silent: pendingSyncRequest ? (pendingSyncRequest.silent && silent) : silent,
        pullFirst: pendingSyncRequest ? (pendingSyncRequest.pullFirst || pullFirst) : pullFirst
      };
      renderSyncStatus('pending');
      return;
    }
    syncInFlight = true;
    renderSyncStatus('syncing');
    try {
      if (pullFirst) await pullSupabaseData();
      await flushRemoteDeletes();
      dedupeStateCollections(state);
      migrateCigaretteScoring();
      migrateAlcoholScoring();
      await flushRemoteDeletes();

      await upsertHabitRows();

      await upsertHabitEntryRows();

      const cigaretteRows = liveRowsForTable('cigarette_events', state.cigarettes).map(c => ({
        id: c.id, smoked_at: c.smoked_at, interval_minutes: c.interval_minutes, alcohol_context: Boolean(c.alcohol_context),
        points: Number(c.points || 0), note: c.note || null, created_at: c.created_at, updated_at: c.updated_at || nowIso()
      }));
      if (await upsertRows('cigarette_events', cigaretteRows)) {
        markRowsSynced('cigarettes', cigaretteRows);
        saveState({ skipRender: true });
      }

      const alcoholLogRows = liveRowsForTable('alcohol_logs', state.alcoholLogs).map(a => ({
        id: a.id, log_date: a.log_date, consumed: Boolean(a.consumed), note: a.note || null,
        created_at: a.created_at, updated_at: a.updated_at || nowIso()
      }));
      if (await upsertRows('alcohol_logs', alcoholLogRows)) {
        markRowsSynced('alcoholLogs', alcoholLogRows);
        saveState({ skipRender: true });
      }

      const alcoholEventRows = liveRowsForTable('alcohol_events', state.alcoholUnits).map(a => ({
        id: a.id, occurred_at: a.occurred_at, drink_type: a.drink_type || 'other', note: a.note || null,
        created_at: a.created_at, updated_at: a.updated_at || nowIso()
      }));
      if (await upsertRows('alcohol_events', alcoholEventRows)) {
        markRowsSynced('alcoholUnits', alcoholEventRows);
        saveState({ skipRender: true });
      }

      await upsertTaskRows();

      await upsertTaskIdeaRows();

      const appointmentRows = liveRowsForTable('appointments', state.appointments).map(a => ({
        id: a.id, title: a.title, description: a.description || null, location: a.location || null,
        appointment_type: normalizeAppointmentType(a.appointment_type), starts_at: a.starts_at, ends_at: a.ends_at || null,
        created_at: a.created_at, updated_at: a.updated_at || nowIso()
      }));
      if (await upsertRows('appointments', appointmentRows)) {
        markRowsSynced('appointments', appointmentRows);
        saveState({ skipRender: true });
      }

      const ledgerRows = liveRowsForTable('points_ledger', state.pointsLedger).map(p => ({
        id: p.id, source_type: p.source_type, source_id: remoteLedgerSourceId(p), points: Number(p.points || 0), reason: p.reason || null,
        earned_at: p.earned_at, created_at: p.created_at || nowIso()
      }));
      if (await upsertRows('points_ledger', ledgerRows)) {
        markRowsSynced('pointsLedger', ledgerRows);
        saveState({ skipRender: true });
      }

      await pullSupabaseData();
      saveState({ skipRender: true });
      lastSyncAt = new Date();
      safeRender();
      if (!silent) toast('Sync abgeschlossen');
    } catch (error) {
      console.error(error);
      if (!silent) toast(`Sync Fehler: ${error.message || error}`);
      renderSyncStatus('error');
    } finally {
      syncInFlight = false;
      const queuedRequest = pendingSyncRequest;
      pendingSyncRequest = null;
      renderSyncStatus();
      if (queuedRequest) {
        setTimeout(() => syncWithSupabase(queuedRequest), 120);
      }
    }
  }

  async function upsertRows(table, rows) {
    if (!rows.length) return true;
    const scopedRows = rowsForCurrentUser(rows);
    const { error } = await supabaseClient.from(table).upsert(scopedRows, { onConflict: 'id' });
    if (error && OPTIONAL_SYNC_TABLES.has(table) && isMissingRemoteRelationError(error)) {
      console.warn(`Optionale Sync-Tabelle ${table} fehlt. App läuft lokal weiter.`, error);
      return false;
    }
    if (error) throw error;
    return true;
  }


  function habitEntryRowsForSync() {
    const habitIds = new Set(state.habits.map(habit => habit.id));
    return liveRowsForTable('habit_entries', state.habitEntries)
      .filter(entry => entry.id && entry.habit_id && habitIds.has(entry.habit_id))
      .map(entry => ({
        id: entry.id,
        habit_id: entry.habit_id,
        value_num: entry.value_num,
        value_bool: entry.value_bool,
        note: entry.note || null,
        occurred_at: entry.occurred_at,
        created_at: entry.created_at,
        updated_at: entry.updated_at || nowIso()
      }));
  }

  function isForeignKeySyncError(error) {
    const message = String(error?.message || error?.details || error?.hint || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    return code === '23503' || message.includes('foreign key') || message.includes('violates foreign key');
  }

  async function upsertRowsWithIsolation(table, rows, { beforeRetry } = {}) {
    if (!rows.length) return { ok: 0, failed: [] };
    const scopedRows = rowsForCurrentUser(rows);
    const { error } = await supabaseClient.from(table).upsert(scopedRows, { onConflict: 'id' });
    if (!error) return { ok: scopedRows.length, failed: [] };
    if (beforeRetry) await beforeRetry(error);
    const retry = await supabaseClient.from(table).upsert(scopedRows, { onConflict: 'id' });
    if (!retry.error) return { ok: rows.length, failed: [] };

    const failed = [];
    let ok = 0;
    for (const row of scopedRows) {
      const single = await supabaseClient.from(table).upsert([row], { onConflict: 'id' });
      if (single.error) {
        failed.push({ row, error: single.error });
      } else {
        ok += 1;
      }
    }
    if (failed.length) {
      console.warn(`Sync: ${failed.length} ${table}-Zeile(n) konnten nicht remote gespeichert werden.`, failed);
      const sample = failed[0]?.error;
      throw new Error(`${table}: ${failed.length} Eintrag/Einträge konnten nicht synchronisiert werden (${sample?.message || sample || 'unbekannter Fehler'}).`);
    }
    return { ok, failed };
  }

  async function upsertHabitEntryRows() {
    const rows = habitEntryRowsForSync();
    if (!rows.length) return;
    await upsertRowsWithIsolation('habit_entries', rows, {
      beforeRetry: async (error) => {
        if (isForeignKeySyncError(error)) {
          // A freshly created habit and its first log can happen very close together on mobile/desktop.
          // Re-upsert definitions before retrying entries so duration habits like "Spazieren" do not get stuck locally.
          await upsertHabitRows();
        }
      }
    });
  }

  function habitRowsForSync() {
    return liveRowsForTable('habit_definitions', state.habits).map(h => {
      const row = {
        id: h.id, name: h.name, type: h.type, unit: h.unit, direction: h.direction, target: h.target,
        icon: h.icon, color: h.color || '#4ad7d1', is_archived: Boolean(h.is_archived), created_at: h.created_at, updated_at: h.updated_at || nowIso()
      };
      if (remoteHabitTargetPeriodSupported) row.target_period = normalizeHabitTargetPeriod(h.target_period);
      return row;
    });
  }

  async function upsertHabitRows() {
    const rows = habitRowsForSync();
    if (!rows.length) return;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { error } = await supabaseClient.from('habit_definitions').upsert(rowsForCurrentUser(habitRowsForSync()), { onConflict: 'id' });
      if (!error) return;
      if (remoteHabitTargetPeriodSupported && String(error.message || '').toLowerCase().includes('target_period')) {
        remoteHabitTargetPeriodSupported = false;
        console.warn('Remote Habit-Tabelle hat noch keine target_period-Spalte. Sync läuft ohne Zielperiode, bis supabase.sql angewendet ist.', error);
        continue;
      }
      throw error;
    }
  }

  function taskIdeaRowsForSync() {
    return liveRowsForTable('task_ideas', state.taskIdeas || []).map(idea => ({
      id: idea.id,
      title: idea.title,
      description: idea.description || null,
      category: TASK_IDEA_CATEGORIES[idea.category] ? idea.category : 'focus',
      story_points: Number(idea.story_points || 2),
      priority: normalizeTaskPriority(idea.priority),
      idea_status: TASK_IDEA_STATUSES.has(idea.idea_status) ? idea.idea_status : 'open',
      source_key: idea.source_key || null,
      generated_task_id: idea.generated_task_id || null,
      accepted_at: idea.accepted_at || null,
      dismissed_at: idea.dismissed_at || null,
      created_at: idea.created_at,
      updated_at: idea.updated_at || nowIso()
    }));
  }

  async function upsertTaskIdeaRows() {
    if (!remoteTaskIdeasSupported) return;
    const rows = taskIdeaRowsForSync();
    if (!rows.length) return;
    const { error } = await supabaseClient.from('task_ideas').upsert(rowsForCurrentUser(rows), { onConflict: 'id' });
    if (!error) {
      markRowsSynced('taskIdeas', rows);
      saveState({ skipRender: true });
      return;
    }
    if (isMissingRemoteRelationError(error)) {
      remoteTaskIdeasSupported = false;
      console.warn('Remote Ideenpool-Tabelle fehlt. Ideenpool bleibt lokal, bis supabase.sql angewendet ist.', error);
      return;
    }
    throw error;
  }

  function taskRowsForSync() {
    return liveRowsForTable('tasks', state.tasks).map(t => {
      const row = {
        id: t.id,
        title: t.title,
        description: t.description || null,
        effort: Number(t.effort || 3),
        status: taskStatusForRemote(t.status || 'open'),
        due_at: t.due_at,
        completed_at: t.completed_at,
        points: Number(t.points || 0),
        created_at: t.created_at,
        updated_at: t.updated_at || nowIso()
      };
      if (remoteTaskPrioritySupported) row.priority = normalizeTaskPriority(t.priority);
      if (remoteTaskBacklogRankSupported && t.backlog_rank != null) row.backlog_rank = Number(t.backlog_rank) || null;
      if (remoteTaskDoneArchiveSupported) {
        row.done_archived_at = t.done_archived_at || null;
        row.done_archive_rank = t.done_archive_rank != null ? Number(t.done_archive_rank) || null : null;
      }
      return row;
    });
  }

  async function upsertTaskRows() {
    const rows = taskRowsForSync();
    if (!rows.length) return;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { error } = await supabaseClient.from('tasks').upsert(rowsForCurrentUser(taskRowsForSync()), { onConflict: 'id' });
      if (!error) return;
      if (remoteTaskPrioritySupported && String(error.message || '').toLowerCase().includes('priority')) {
        remoteTaskPrioritySupported = false;
        console.warn('Remote Tasks-Tabelle hat noch keine priority-Spalte. Sync läuft ohne Priorität, bis supabase.sql angewendet ist.', error);
        continue;
      }
      if (remoteTaskInProgressSupported && isTaskStatusConstraintError(error)) {
        remoteTaskInProgressSupported = false;
        console.warn('Remote Tasks-Tabelle kennt in_progress noch nicht. Sync mappt diesen Status vorübergehend auf offen.', error);
        continue;
      }
      if (remoteTaskBacklogRankSupported && isMissingRemoteColumnError(error, 'backlog_rank')) {
        remoteTaskBacklogRankSupported = false;
        console.warn('Remote Tasks-Tabelle hat noch keine backlog_rank-Spalte. Backlog-Reihenfolge bleibt lokal, bis supabase.sql angewendet ist.', error);
        continue;
      }
      if (remoteTaskDoneArchiveSupported && (isMissingRemoteColumnError(error, 'done_archived_at') || isMissingRemoteColumnError(error, 'done_archive_rank'))) {
        remoteTaskDoneArchiveSupported = false;
        console.warn('Remote Tasks-Tabelle hat noch keine Archiv-Spalten für erledigte Aufgaben. Das Archiv bleibt lokal, bis supabase.sql angewendet ist.', error);
        continue;
      }
      throw error;
    }
  }

  function taskStatusForRemote(status) {
    const normalized = TASK_COLUMNS.some(column => column.status === status) ? status : 'open';
    if (!remoteTaskInProgressSupported && normalized === 'in_progress') return 'open';
    return normalized;
  }

  function isTaskStatusConstraintError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('tasks_status_check') || (message.includes('check constraint') && message.includes('status'));
  }

  function isMissingRemoteColumnError(error, column) {
    const message = String(error?.message || error?.details || error?.hint || error || '').toLowerCase();
    const needle = String(column || '').toLowerCase();
    return Boolean(needle) && (message.includes(needle) || (message.includes('schema cache') && message.includes('column')));
  }

  function isMissingRemoteRelationError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('does not exist') || message.includes('schema cache') || message.includes('could not find the table');
  }

  async function deleteRemoteById(table, id) {
    const userId = currentUserId();
    if (!supabaseClient || !userId || !id) return false;
    try {
      const { error } = await supabaseClient.from(table).delete().eq('user_id', userId).eq('id', id);
      if (error) {
        if (table === 'task_ideas' && isMissingRemoteRelationError(error)) {
          remoteTaskIdeasSupported = false;
          console.warn('Remote Ideenpool-Tabelle fehlt. Delete wird lokal behandelt.', error);
          return true;
        }
        console.warn(`Remote-Delete ${table} fehlgeschlagen`, error);
        return false;
      }
      return true;
    } catch (error) {
      console.warn(`Remote-Delete ${table} nicht möglich`, error);
      return false;
    }
  }

  async function deleteRemoteByIds(table, ids) {
    const userId = currentUserId();
    if (!supabaseClient || !userId || !ids?.length) return false;
    try {
      const { error } = await supabaseClient.from(table).delete().eq('user_id', userId).in('id', ids);
      if (error) {
        if (table === 'task_ideas' && isMissingRemoteRelationError(error)) {
          remoteTaskIdeasSupported = false;
          console.warn('Remote Ideenpool-Tabelle fehlt. Delete wird lokal behandelt.', error);
          return true;
        }
        console.warn(`Remote-Delete ${table} fehlgeschlagen`, error);
        return false;
      }
      return true;
    } catch (error) {
      console.warn(`Remote-Delete ${table} nicht möglich`, error);
      return false;
    }
  }

  function liveRowsForTable(table, rows = []) {
    return rows.filter(row => row?.id && !isRemoteDeleted(table, row.id));
  }

  function markRowsSynced(localKey, syncedRows = []) {
    const ids = new Set(syncedRows.map(row => row?.id).filter(Boolean));
    if (!ids.size || !Array.isArray(state[localKey])) return;
    state[localKey].forEach(row => {
      if (ids.has(row?.id)) row.synced = true;
    });
  }

  async function flushRemoteDeletes() {
    if (!supabaseClient || !isAuthenticated()) return;
    state.deletedRemoteIds = normalizeDeletedRemoteIds(state.deletedRemoteIds);
    for (const table of SYNC_TABLES) {
      if (table === 'task_ideas' && !remoteTaskIdeasSupported) continue;
      const entries = Object.entries(state.deletedRemoteIds[table] || {});
      const ids = entries.filter(([, meta]) => !meta?.synced_at).map(([id]) => id);
      if (!ids.length) continue;
      const deleted = await deleteRemoteByIds(table, ids);
      if (deleted) {
        const syncedAt = nowIso();
        ids.forEach(id => {
          if (state.deletedRemoteIds[table]?.[id]) state.deletedRemoteIds[table][id].synced_at = syncedAt;
        });
      }
    }
  }

  function applyRemoteCollectionAuthority(table, localKey, remoteRowsForTable, { ledgerSourceType = null, ledgerMatcher = null } = {}) {
    const localRows = Array.isArray(state[localKey]) ? state[localKey] : [];
    if (!localRows.length) return [];
    const remoteIds = new Set(remoteRowsForTable.map(row => row.id).filter(Boolean));
    const removedRows = localRows
      .filter(row => row?.id && row.synced === true && !remoteIds.has(row.id) && !isRemoteDeleted(table, row.id));

    if (!removedRows.length) return [];
    const removedIds = removedRows.map(row => row.id);
    const removedSet = new Set(removedIds);
    state[localKey] = localRows.filter(row => !removedSet.has(row.id));
    markRemoteDeletedMany(table, removedIds, { synced: true });

    if (ledgerSourceType || ledgerMatcher) {
      const matchesLedger = point => ledgerMatcher
        ? ledgerMatcher(point, removedSet)
        : point.source_type === ledgerSourceType && removedSet.has(point.source_id);
      const removedLedgerIds = state.pointsLedger
        .filter(matchesLedger)
        .map(point => point.id);
      if (removedLedgerIds.length) {
        const removedLedgerSet = new Set(removedLedgerIds);
        state.pointsLedger = state.pointsLedger.filter(point => !removedLedgerSet.has(point.id));
        markRemoteDeletedMany('points_ledger', removedLedgerIds);
      }
    }
    return removedRows;
  }

  function clearAlcoholLogsWithoutUnits(removedUnits = []) {
    const touchedKeys = new Set(removedUnits.map(unit => toDateKey(unit.occurred_at || unit.created_at)).filter(Boolean));
    if (!touchedKeys.size) return;
    touchedKeys.forEach(key => {
      if (alcoholUnitsOnDate(key).length) return;
      const dayLog = alcoholForDate(key);
      if (!dayLog || !dayLog.consumed) return;
      dayLog.consumed = false;
      dayLog.updated_at = nowIso();
      dayLog.synced = false;
    });
  }

  function filterRemoteLedgerRows(remoteLedgerRows, { cigaretteRows = [], alcoholEventRows = [] } = {}) {
    const cigaretteIds = new Set(cigaretteRows.map(row => row.id).filter(Boolean));
    const alcoholEventIds = new Set(alcoholEventRows.map(row => row.id).filter(Boolean));
    const orphanLedgerIds = [];
    const filtered = remoteLedgerRows.filter(row => {
      if (row.source_type === 'cigarette') {
        const keep = row.source_id && cigaretteIds.has(row.source_id) && !isRemoteDeleted('cigarette_events', row.source_id);
        if (!keep && row.id) orphanLedgerIds.push(row.id);
        return keep;
      }
      if (isAlcoholPointsEntry(row)) {
        const keep = row.source_id && alcoholEventIds.has(row.source_id) && !isRemoteDeleted('alcohol_events', row.source_id);
        if (!keep && row.id) orphanLedgerIds.push(row.id);
        return keep;
      }
      return true;
    });
    if (orphanLedgerIds.length) markRemoteDeletedMany('points_ledger', orphanLedgerIds);
    return filtered;
  }

  function remoteRows(table, result) {
    return (result.data || []).filter(row => !isRemoteDeleted(table, row.id));
  }

  function applyRemoteHabitAuthority(remoteHabitRows) {
    const remoteIds = new Set(remoteHabitRows.map(h => h.id));
    const remoteSeedNames = new Set(remoteHabitRows.map(h => String(h.name || '').trim().toLowerCase()).filter(name => BUILT_IN_DEFAULT_HABIT_NAMES.has(name)));
    const removedHabitIds = state.habits
      .filter(habit => {
        const name = String(habit.name || '').trim().toLowerCase();
        const isSeed = isBuiltInDefaultHabit(habit) || BUILT_IN_DEFAULT_HABIT_NAMES.has(name);
        const hasUnsyncedLocalChanges = habit.synced === false || state.habitEntries.some(entry => entry.habit_id === habit.id && entry.synced === false);
        if (!isSeed || hasUnsyncedLocalChanges) return false;
        if (remoteIds.has(habit.id)) return false;
        return !remoteSeedNames.has(name);
      })
      .map(habit => habit.id);
    if (!removedHabitIds.length) return;
    const removedEntryIds = state.habitEntries.filter(entry => removedHabitIds.includes(entry.habit_id)).map(entry => entry.id);
    const removedLedgerIds = state.pointsLedger
      .filter(point => point.source_type === 'habit' && removedEntryIds.includes(point.source_id))
      .map(point => point.id);
    state.habits = state.habits.filter(habit => !removedHabitIds.includes(habit.id));
    state.habitEntries = state.habitEntries.filter(entry => !removedHabitIds.includes(entry.habit_id));
    state.pointsLedger = state.pointsLedger.filter(point => !(point.source_type === 'habit' && removedEntryIds.includes(point.source_id)));
    markRemoteDeletedMany('habit_definitions', removedHabitIds);
    markRemoteDeletedMany('habit_entries', removedEntryIds);
    markRemoteDeletedMany('points_ledger', removedLedgerIds);
  }

  async function pullSupabaseData() {
    if (!supabaseClient) return;
    const [habits, entries, cigarettes, alcohol, alcoholEvents, tasks, taskIdeasRemote, appointments, ledger] = await Promise.all([
      fetchRemoteTable('habit_definitions'),
      fetchRemoteTable('habit_entries'),
      fetchRemoteTable('cigarette_events'),
      fetchRemoteTable('alcohol_logs'),
      fetchRemoteTable('alcohol_events'),
      fetchRemoteTable('tasks'),
      fetchRemoteTable('task_ideas'),
      fetchRemoteTable('appointments'),
      fetchRemoteTable('points_ledger')
    ]);

    const remoteHabitRows = remoteRows('habit_definitions', habits);
    const remoteEntryRows = remoteRows('habit_entries', entries);
    const remoteCigaretteRows = remoteRows('cigarette_events', cigarettes);
    const remoteAlcoholRows = remoteRows('alcohol_logs', alcohol);
    const remoteAlcoholEventRows = remoteRows('alcohol_events', alcoholEvents);
    const remoteTaskRows = remoteRows('tasks', tasks);
    const remoteTaskIdeaRows = remoteRows('task_ideas', taskIdeasRemote);
    const remoteAppointmentRows = remoteRows('appointments', appointments);
    let remoteLedgerRows = remoteRows('points_ledger', ledger);

    applyRemoteCollectionAuthority('cigarette_events', 'cigarettes', remoteCigaretteRows, { ledgerSourceType: 'cigarette' });
    applyRemoteCollectionAuthority('appointments', 'appointments', remoteAppointmentRows);
    if (remoteTaskIdeasSupported) applyRemoteCollectionAuthority('task_ideas', 'taskIdeas', remoteTaskIdeaRows);
    const removedAlcoholUnits = applyRemoteCollectionAuthority('alcohol_events', 'alcoholUnits', remoteAlcoholEventRows, {
      ledgerMatcher: (point, removedSet) => isAlcoholPointsEntry(point) && removedSet.has(point.source_id)
    });
    if (removedAlcoholUnits.length) clearAlcoholLogsWithoutUnits(removedAlcoholUnits);
    remoteLedgerRows = filterRemoteLedgerRows(remoteLedgerRows, { cigaretteRows: remoteCigaretteRows, alcoholEventRows: remoteAlcoholEventRows });
    const remoteHasData = [remoteHabitRows, remoteEntryRows, remoteCigaretteRows, remoteAlcoholRows, remoteAlcoholEventRows, remoteTaskRows, remoteTaskIdeaRows, remoteAppointmentRows, remoteLedgerRows].some(rows => rows.length > 0);

    applyRemoteHabitAuthority(remoteHabitRows);

    if (remoteHasData && isLocalPristine()) {
      state.habits = remoteHabitRows.map(mapRemoteHabit);
      state.habitEntries = remoteEntryRows.map(mapRemoteEntry);
      state.cigarettes = remoteCigaretteRows.map(mapRemoteCigarette);
      state.alcoholLogs = remoteAlcoholRows.map(mapRemoteAlcohol);
      state.alcoholUnits = remoteAlcoholEventRows.map(mapRemoteAlcoholEvent);
      state.tasks = remoteTaskRows.map(mapRemoteTask).map(normalizeTask);
      state.taskIdeas = remoteTaskIdeaRows.map(mapRemoteTaskIdea).map(normalizeTaskIdea);
      state.appointments = remoteAppointmentRows.map(mapRemoteAppointment).map(normalizeAppointment);
      state.pointsLedger = remoteLedgerRows.map(mapRemoteLedger);
      dedupeStateCollections(state);
      return;
    }

    const localTasksBeforePull = new Map(state.tasks.map(task => [task.id, normalizeTask(task)]));
    const localHabitsBeforePull = new Map(state.habits.map(habit => [habit.id, normalizeHabit(habit)]));
    state.habits = mergeById(state.habits, remoteHabitRows, mapRemoteHabit).map(habit => preserveLocalHabitFallbacks(normalizeHabit(habit), localHabitsBeforePull.get(habit.id)));
    state.habitEntries = mergeById(state.habitEntries, remoteEntryRows, mapRemoteEntry);
    state.cigarettes = mergeById(state.cigarettes, remoteCigaretteRows, mapRemoteCigarette);
    state.alcoholLogs = mergeById(state.alcoholLogs, remoteAlcoholRows, mapRemoteAlcohol);
    state.alcoholUnits = mergeById(state.alcoholUnits, remoteAlcoholEventRows, mapRemoteAlcoholEvent);
    state.tasks = mergeById(state.tasks, remoteTaskRows, mapRemoteTask).map(task => preserveLocalTaskFallbacks(normalizeTask(task), localTasksBeforePull.get(task.id)));
    state.taskIdeas = mergeById(state.taskIdeas || [], remoteTaskIdeaRows, mapRemoteTaskIdea).map(normalizeTaskIdea);
    state.appointments = mergeById(state.appointments, remoteAppointmentRows, mapRemoteAppointment).map(normalizeAppointment);
    state.pointsLedger = mergeById(state.pointsLedger, remoteLedgerRows, mapRemoteLedger);
    dedupeStateCollections(state);
  }

  async function fetchRemoteTable(table) {
    if (table === 'task_ideas' && !remoteTaskIdeasSupported) return { data: [], error: null };
    const userId = currentUserId();
    if (!userId) return { data: [], error: null };
    const result = await supabaseClient.from(table).select('*').eq('user_id', userId);
    if (result.error) {
      if (OPTIONAL_SYNC_TABLES.has(table) && isMissingRemoteRelationError(result.error)) {
        if (table === 'task_ideas') remoteTaskIdeasSupported = false;
        console.warn(`Optionale Sync-Tabelle ${table} fehlt.`, result.error);
        return { data: [], error: null };
      }
      throw result.error;
    }
    return result;
  }

  function preserveLocalHabitFallbacks(remoteHabit, localHabit) {
    if (!localHabit) return remoteHabit;
    const next = { ...remoteHabit };
    if (!remoteHabitTargetPeriodSupported) next.target_period = localHabit.target_period || next.target_period;
    HABIT_DNA_LOCAL_FIELDS.forEach(field => {
      if (localHabit[field] != null) next[field] = localHabit[field];
    });
    return next;
  }

  function preserveLocalTaskFallbacks(remoteTask, localTask) {
    if (!localTask) return remoteTask;
    const next = { ...remoteTask };
    if (!remoteTaskPrioritySupported) next.priority = localTask.priority || next.priority;
    if (!remoteTaskInProgressSupported && localTask.status === 'in_progress' && remoteTask.status === 'open') next.status = 'in_progress';
    if (!remoteTaskBacklogRankSupported && localTask.backlog_rank != null) next.backlog_rank = localTask.backlog_rank;
    if (!remoteTaskDoneArchiveSupported) {
      next.done_archived_at = localTask.done_archived_at || next.done_archived_at || null;
      next.done_archive_rank = localTask.done_archive_rank ?? next.done_archive_rank ?? null;
    }
    return next;
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

  function isLocalPristine() {
    const defaultIds = new Set(Object.values(DEFAULT_HABIT_IDS));
    const hasOnlyDefaultHabits = state.habits.every(h => defaultIds.has(h.id) || BUILT_IN_DEFAULT_HABIT_NAMES.has(String(h.name || '').trim().toLowerCase()));
    return hasOnlyDefaultHabits && !state.habitEntries.length && !state.cigarettes.length && !state.alcoholLogs.length && !state.alcoholUnits.length && !state.tasks.length && !(state.taskIdeas || []).length && !state.appointments.length && !state.morningRoutineLogs?.length && !state.pointsLedger.length;
  }

  function subscribeToRemoteChanges() {
    const userId = currentUserId();
    if (!supabaseClient || !userId || syncSubscription || !supabaseClient.channel) return;
    try {
      const channel = supabaseClient.channel(`habitflow-private-sync-${userId.slice(0, 8)}`);
      SYNC_TABLES.forEach(table => {
        if (table === 'task_ideas' && !remoteTaskIdeasSupported) return;
        channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` }, scheduleRemotePull);
      });
      if (remoteActivityIdeasSupported) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: ACTIVITY_CATALOG_TABLE, filter: `user_id=eq.${userId}` }, scheduleLeisureRemotePull);
      }
      syncSubscription = channel.subscribe();
    } catch (error) {
      console.warn('Realtime Sync konnte nicht aktiviert werden.', error);
    }
  }

  function clearRemoteSubscription() {
    clearTimeout(leisurePullTimer);
    leisurePullTimer = null;
    if (!supabaseClient || !syncSubscription) return;
    try {
      if (supabaseClient.removeChannel) supabaseClient.removeChannel(syncSubscription);
    } catch (error) {
      console.warn('Realtime Sync konnte nicht sauber getrennt werden.', error);
    } finally {
      syncSubscription = null;
    }
  }

  function scheduleRemotePull() {
    clearTimeout(remotePullTimer);
    remotePullTimer = setTimeout(() => syncWithSupabase({ silent: true, pullFirst: true }), 900);
  }

  function scheduleLeisureRemotePull() {
    clearTimeout(leisurePullTimer);
    leisurePullTimer = setTimeout(() => syncLeisureCatalogWithSupabase({ silent: true }), 900);
  }

  const mapRemoteHabit = h => normalizeHabit({ id: h.id, name: h.name, type: h.type, unit: h.unit, direction: h.direction, target: h.target, target_period: h.target_period || 'day', icon: h.icon, color: h.color, is_archived: h.is_archived, created_at: h.created_at, updated_at: h.updated_at, synced: true });
  const mapRemoteEntry = e => ({ id: e.id, habit_id: e.habit_id, value_num: e.value_num, value_bool: e.value_bool, note: e.note, occurred_at: e.occurred_at, created_at: e.created_at, updated_at: e.updated_at, synced: true });
  const mapRemoteCigarette = c => ({ id: c.id, smoked_at: c.smoked_at, interval_minutes: c.interval_minutes, alcohol_context: c.alcohol_context, points: c.points, note: c.note, created_at: c.created_at, updated_at: c.updated_at, synced: true });
  const mapRemoteAlcohol = a => ({ id: a.id, log_date: a.log_date, consumed: a.consumed, note: a.note, created_at: a.created_at, updated_at: a.updated_at, synced: true });
  const mapRemoteAlcoholEvent = a => ({ id: a.id, occurred_at: a.occurred_at, drink_type: a.drink_type || 'other', note: a.note, created_at: a.created_at, updated_at: a.updated_at, synced: true });
  const mapRemoteTask = t => ({ id: t.id, title: t.title, description: t.description, effort: t.effort, priority: normalizeTaskPriority(t.priority), status: TASK_COLUMNS.some(column => column.status === t.status) ? t.status : 'open', due_at: t.due_at, completed_at: t.completed_at, points: t.points, backlog_rank: t.backlog_rank, done_archived_at: t.done_archived_at, done_archive_rank: t.done_archive_rank, created_at: t.created_at, updated_at: t.updated_at, synced: true });
  const mapRemoteTaskIdea = idea => normalizeTaskIdea({ id: idea.id, title: idea.title, description: idea.description, category: idea.category, story_points: idea.story_points, priority: idea.priority, idea_status: idea.idea_status, source_key: idea.source_key, generated_task_id: idea.generated_task_id, accepted_at: idea.accepted_at, dismissed_at: idea.dismissed_at, created_at: idea.created_at, updated_at: idea.updated_at, synced: true });
  const mapRemoteAppointment = a => normalizeAppointment({ id: a.id, title: a.title, description: a.description, location: a.location, appointment_type: a.appointment_type, starts_at: a.starts_at, ends_at: a.ends_at, created_at: a.created_at, updated_at: a.updated_at, synced: true });
  const mapRemoteLedger = p => normalizeMorningRoutineLedgerPoint({ id: p.id, source_type: p.source_type, source_id: p.source_id, points: p.points, reason: p.reason, earned_at: p.earned_at, created_at: p.created_at, updated_at: p.created_at, synced: true });

  function exportJson() {
    const blob = new Blob([JSON.stringify({ state, settings: { email: settings.email || '' } }, null, 2)], { type: 'application/json' });
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
