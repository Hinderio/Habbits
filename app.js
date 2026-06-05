(() => {
  'use strict';

  const STORAGE_KEY = 'habitflow-state-v1';
  const APP_DATA_SCHEMA_KEY = 'habitflow-app-data-schema-version';
  const APP_DATA_SCHEMA_VERSION = 'v144-points-rework';
  const SETTINGS_KEY = 'habitflow-settings-v1';
  const THEME_KEY = 'habitflow-theme';
  const TREND_METRIC_KEY = 'habitflow-trend-metric';
  const DASHBOARD_CHART_WINDOW_KEY = 'habitflow-dashboard-chart-window-v1';
  const COACH_SESSION_KEY = 'habitflow-coach-session-v1';
  const MORNING_ROUTINE_SESSION_KEY = 'habitflow-morning-routine-session-v1';
  const MORNING_ROUTINE_VARIANT_KEY = 'habitflow-morning-routine-variant-offset-v1';
  const RULES_UI_KEY = 'habitflow-rules-open';
  const HABIT_DNA_UI_KEY = 'habitflow-habit-dna-open';
  const HABIT_CARD_UI_KEY = 'habitflow-habit-cards-open';
  const CONSUMPTION_MODE_KEY = 'habitflow-consumption-mode';
  const LEISURE_FILTER_KEY = 'habitflow-leisure-filters-v1';
  const GAMIFICATION_LOCKED_KEY = 'habitflow-gamification-show-locked-v1';
  const GAMIFICATION_BADGE_SHELF_KEY = 'habitflow-gamification-badge-shelf-v1';
  const HABITS_EXPERIENCE_KEY = 'habitflow-habits-experience-v1';
  const FITNESS_FILTER_KEY = 'habitflow-fitness-filter-v1';
  const FITNESS_DETAIL_TAB_KEY = 'habitflow-fitness-detail-tab-v1';
  const FITNESS_MOBILE_SECTIONS_KEY = 'habitflow-fitness-mobile-sections-v1';
  const FITNESS_COACH_STATE_KEY = 'habitflow-fitness-coach-state-v1';
  const REMOTE_DELETE_ARCHIVE_KEY = 'habitflow-remote-delete-archive-v1';
  const MONTHLY_MISSION_FORM_KEY = 'habitflow-monthly-mission-form-v1';
  const EVOLUTION_LEVEL_RULES = Object.freeze({ maxStage: 20, baseCost: 250, growth: 1.18 });
  const HIKING_POINTS_BASE = 50;
  const HIKING_POINTS_PER_KM = 10;
  const HIKING_POINTS_PER_100M = 10;
  const SMOKE_RECOVERY_REPEAT_MINUTES = 120;
  const SMOKE_RECOVERY_REPEAT_BONUS = 10;
  const SMOKE_DAILY_TARGET = 10;
  const SMOKE_DAILY_BASE_BONUS = 50;
  const SMOKE_DAILY_BONUS_PER_LESS = 10;
  const TASK_RECURRENCE_MARKER_RE = /\n?\s*<!--hf-task-rec:([^>]+)-->/;
  const TASK_MEDIA_MARKER_RE = /\n?\s*<!--hf-task-media:([^>]+)-->/;
  const TASK_IMAGE_LIMIT = 3;
  const TASK_IMAGE_MAX_EDGE = 1280;
  const TASK_IMAGE_QUALITY = 0.78;
  const TASK_IDEA_META_MARKER_RE = /\n?\s*<!--hf-idea-meta:([^>]+)-->/;
  const FITNESS_ROUTE_START = Object.freeze({ lat: 47.459945, lng: 9.032719 });
  const FITNESS_TOWN_MILESTONES = Object.freeze([
    { name: 'Wil SG', km: 0 },
    { name: 'Uzwil', km: 8.0 },
    { name: 'Frauenfeld', km: 14.8 },
    { name: 'Winterthur', km: 23.6 },
    { name: 'St. Gallen', km: 26.2 },
    { name: 'Rorschach', km: 34.4 },
    { name: 'Zürich', km: 38.1 },
    { name: 'Zug', km: 50.9 },
    { name: 'Luzern', km: 71.1 },
    { name: 'Davos', km: 95.0 },
    { name: 'Basel', km: 109.0 },
    { name: 'Bern', km: 132.6 },
    { name: 'Bellinzona', km: 140.7 },
    { name: 'Lugano', km: 162.0 },
    { name: 'Neuchâtel', km: 167.2 },
    { name: 'Sion', km: 186.5 },
    { name: 'Montreux', km: 197.6 }
  ]);
  const FITNESS_MOUNTAIN_MILESTONES = Object.freeze([
    { name: 'Napf', meters: 1408, region: 'Emmental' },
    { name: 'Kronberg', meters: 1663, region: 'Appenzell' },
    { name: 'Säntis', meters: 2502, region: 'Alpstein' },
    { name: 'Pizol', meters: 2844, region: 'St. Galler Alpen' },
    { name: 'Titlis', meters: 3238, region: 'Urner Alpen' },
    { name: 'Tödi', meters: 3614, region: 'Glarner Alpen' },
    { name: 'Finsteraarhorn', meters: 4274, region: 'Berner Alpen' },
    { name: 'Matterhorn', meters: 4478, region: 'Wallis' },
    { name: 'Dufourspitze', meters: 4634, region: 'Monte Rosa' },
    { name: 'Mont Blanc', meters: 4808, region: 'Alpen-Klassiker' },
    { name: 'Elbrus', meters: 5642, region: 'Kaukasus' },
    { name: 'Kilimanjaro', meters: 5895, region: 'Tansania' },
    { name: 'Denali', meters: 6190, region: 'Alaska' },
    { name: 'Aconcagua', meters: 6961, region: 'Anden' },
    { name: 'Mount Everest', meters: 8849, region: 'Himalaya' }
  ]);
  const HALF_WHITE_BREAD_KCAL_PER_100G = 255;
  const ACTIVITY_CATALOG_URL = './data/activity-ideas.json';
  const ACTIVITY_REMOTE_SEED_KEY = 'habitflow-activity-remote-seeded-v1';
  const ACTIVITY_ARCHIVED_IDS_KEY = 'habitflow-activity-archived-ids-v1';
  const ACTIVITY_CATALOG_TABLE = 'activity_ideas';
  const LEISURE_RESULT_LIMIT = 12;
  const COMPANION_POSTER_BUCKET = 'companion-posters';
  const COMPANION_POSTER_EXTENSION = 'png';
  const MONTHLY_MAGAZINE_COVERS = Object.freeze([
    { file: 'stage-21.png', label: 'Calm Reset', minScore: 0 },
    { file: 'stage-22.png', label: 'Momentum Issue', minScore: 45 },
    { file: 'stage-23.png', label: 'Peak Issue', minScore: 75 }
  ]);
  const SUPABASE_CONFIG = window.HABITFLOW_SUPABASE_CONFIG || {};

  function appDomainFacade() {
    return window.HabitFlowRuntime?.appDomainFacade || null;
  }
  const MEDITATION_TECHNIQUES = [
    { key: '7-3-11', title: '7-3-11 Atemtechnik', subtitle: 'Runterfahren mit langer Ausatmung', minutes: 6, pattern: '7 ein · 3 halten · 11 aus' },
    { key: 'box', title: 'Box Breathing', subtitle: 'Klarer Fokus vor schwierigen Momenten', minutes: 5, pattern: '4 · 4 · 4 · 4' },
    { key: 'body-scan', title: 'Body Scan', subtitle: 'Körper wahrnehmen und Spannung lösen', minutes: 10, pattern: 'ruhig scannen' },
    { key: 'urge-surf', title: 'Craving-Welle', subtitle: 'Drang beobachten, ohne sofort zu handeln', minutes: 4, pattern: 'wahrnehmen · warten · wählen' },
    { key: 'gratitude', title: 'Dankbarkeits-Minute', subtitle: 'Kurzer mentaler Reset mit positiver Ankerung', minutes: 3, pattern: '3 Dinge benennen' }
  ];


  const FITNESS_COACH_TABS = Object.freeze([
    { key: 'training', label: 'Training' },
    { key: 'sports', label: 'Sportarten' },
    { key: 'mind', label: 'Mind' },
    { key: 'nutrition', label: 'Ernährung' },
    { key: 'recipes', label: 'Rezepte' },
    { key: 'foodmap', label: 'Food Map' }
  ]);

  const FITNESS_COACH_EXERCISES = Object.freeze([
    { title: 'Tempo Squat', focus: 'Beine · Core', minutes: 6, level: 'Basis', cue: 'Füsse hüftbreit, Knie folgen den Zehen, 3 Sek. runter, ruhig hoch.', steps: ['8–12 Wiederholungen', 'Brust bleibt offen', 'Pause, sobald die Technik kippt'] },
    { title: 'Incline Push-up', focus: 'Brust · Schulter', minutes: 5, level: 'Skalierbar', cue: 'Hände auf Tischkante oder Sofa, Körper bleibt wie ein Brett.', steps: ['Ellbogen ca. 45°', 'Langsam absenken', 'Explosiv, aber kontrolliert hoch'] },
    { title: 'Reverse Lunge', focus: 'Beine · Balance', minutes: 6, level: 'Mittel', cue: 'Ein Bein nach hinten, vorderer Fuss bleibt stabil, Oberkörper aufrecht.', steps: ['6–10 pro Seite', 'Knie weich landen lassen', 'Mit dem vorderen Bein hochdrücken'] },
    { title: 'Glute Bridge', focus: 'Gesäss · Rücken', minutes: 4, level: 'Basis', cue: 'Rückenlage, Füsse nah am Gesäss, Becken bewusst nach oben rollen.', steps: ['2 Sek. oben halten', 'Rippen unten lassen', '12–15 Wiederholungen'] },
    { title: 'Dead Bug', focus: 'Core · Kontrolle', minutes: 5, level: 'Ruhig', cue: 'Rückenlage, Lendenwirbelsäule sanft am Boden, diagonal Arm/Bein strecken.', steps: ['Langsam ausatmen', '6–8 pro Seite', 'Qualität vor Tempo'] },
    { title: 'Bird Dog', focus: 'Rücken · Stabilität', minutes: 5, level: 'Basis', cue: 'Vierfüsslerstand, diagonal strecken, Becken bleibt parallel zum Boden.', steps: ['2 Sek. halten', 'Blick zum Boden', '8 pro Seite'] },
    { title: 'Side Plank', focus: 'Seitlicher Core', minutes: 4, level: 'Mittel', cue: 'Ellbogen unter Schulter, Körper lang, Hüfte aktiv anheben.', steps: ['20–35 Sek. pro Seite', 'Knie ablegen erlaubt', 'Nicht in die Schulter sinken'] },
    { title: 'Wall Sit', focus: 'Beine · Willenskraft', minutes: 4, level: 'Kurz & stark', cue: 'Rücken an die Wand, Knie ca. 90°, Gewicht auf den ganzen Fuss.', steps: ['30–45 Sek. halten', '2–3 Runden', 'Atmung ruhig halten'] },
    { title: 'Mountain Climber langsam', focus: 'Puls · Core', minutes: 5, level: 'Aktiv', cue: 'Plank-Position, Knie kontrolliert Richtung Brust, kein Hohlkreuz.', steps: ['20–30 Sek. Arbeit', '30 Sek. Pause', '3–5 Runden'] },
    { title: 'Calf Raise', focus: 'Waden · Fusskraft', minutes: 4, level: 'Basis', cue: 'Aufrecht stehen, langsam auf die Zehenspitzen, kontrolliert absenken.', steps: ['12–20 Wiederholungen', 'Oben 1 Sek. halten', 'Optional einbeinig'] },
    { title: 'Hip Hinge Drill', focus: 'Hüfte · Rücken', minutes: 5, level: 'Technik', cue: 'Hände an Hüfte, Gesäss nach hinten, Rücken lang, Knie leicht gebeugt.', steps: ['10 saubere Wiederholungen', 'Bewegung aus der Hüfte', 'Perfekt für Wandern/Joggen'] },
    { title: 'Mobility Flow', focus: 'Nacken · Hüfte', minutes: 7, level: 'Recovery', cue: 'Langsame Gelenkbewegungen ohne Schmerz, ruhig durch die Nase atmen.', steps: ['Nacken kreisen', 'Brustwirbelsäule öffnen', 'Hüfte und Sprunggelenke mobilisieren'] }
  ]);

  const FITNESS_COACH_SPORTS = Object.freeze([
    { title: 'Spazieren', kcal: 220, note: 'sehr niedrigschwellig, ideal als Reset nach Stress' },
    { title: 'Joggen locker', kcal: 620, note: 'starker Ausdauerreiz, aber Belastung langsam steigern' },
    { title: 'Wandern', kcal: 430, note: 'mehr Höhenmeter erhöhen den Verbrauch deutlich' },
    { title: 'Radfahren moderat', kcal: 520, note: 'gelenkschonend und gut für Grundlagenausdauer' },
    { title: 'Schwimmen', kcal: 560, note: 'Ganzkörpertraining mit wenig Stossbelastung' },
    { title: 'Tanzen', kcal: 390, note: 'spielerisch, sozial und überraschend effektiv' },
    { title: 'Treppensteigen', kcal: 650, note: 'kurz, intensiv, perfekt als Mini-Workout' },
    { title: 'Fussball locker', kcal: 580, note: 'Intervalle, Koordination und Spass in einem' },
    { title: 'Tennis / Padel', kcal: 520, note: 'schnelle Richtungswechsel und Fokus' },
    { title: 'Yoga dynamisch', kcal: 260, note: 'Beweglichkeit, Kraft und Nervensystem' },
    { title: 'Bodyweight-Zirkel', kcal: 480, note: 'ohne Geräte, schnell anpassbar' },
    { title: 'Nordic Walking', kcal: 360, note: 'mehr Oberkörper als normales Gehen' }
  ]);

  const FITNESS_MIND_EXERCISES = Object.freeze([
    { title: 'Physiological Sigh', minutes: 2, body: 'Zwei kurze Einatmungen durch die Nase, eine lange Ausatmung. 5–8 Wiederholungen für schnellen Druckabbau.' },
    { title: '5-4-3-2-1 Grounding', minutes: 3, body: '5 Dinge sehen, 4 fühlen, 3 hören, 2 riechen, 1 schmecken. Gut bei innerer Unruhe.' },
    { title: 'Mindful Walk', minutes: 10, body: 'Ohne Podcast gehen. Schritte, Atmung und Umgebung wahrnehmen. Perfekt als Craving- oder Stress-Reset.' },
    { title: 'Gedanken-Parkplatz', minutes: 5, body: 'Alles aufschreiben, was mental offen ist. Danach genau eine nächste Aktion markieren.' },
    { title: 'Progressive Entspannung', minutes: 8, body: 'Füsse, Beine, Bauch, Hände, Schultern nacheinander 5 Sek. anspannen und lösen.' },
    { title: 'Selbstmitgefühls-Reset', minutes: 2, body: 'Satz: „Das ist gerade schwer. Ich darf klein anfangen. Der nächste gute Schritt reicht.“' },
    { title: 'Box Breathing', minutes: 4, body: '4 Sekunden ein, 4 halten, 4 aus, 4 halten. Ruhig, gleichmässig, 4 Runden.' },
    { title: 'Schlaf-Offload', minutes: 6, body: 'Vor dem Schlafen: Sorgen, offene Aufgaben und morgige Top-1 notieren. Kopf wird entlastet.' }
  ]);

  const FITNESS_NUTRITION_TIPS = Object.freeze([
    { title: 'Protein-Anker pro Mahlzeit', body: 'Baue jede Hauptmahlzeit um eine Proteinquelle. Das stabilisiert Sättigung und hilft beim Muskelerhalt.' },
    { title: 'Volumen zuerst', body: 'Gemüse, Salat, Beeren, Suppen und Kartoffeln geben viel Volumen bei moderater Energiedichte.' },
    { title: '80/20 statt Perfektion', body: 'Plane bewusst einfache Standard-Mahlzeiten und lasse Platz für Genuss. Konstanz schlägt Extremregeln.' },
    { title: 'Flüssige Kalorien prüfen', body: 'Säfte, Alkohol, süsse Kaffeegetränke und Softdrinks sind oft der leichteste Hebel für ein Defizit.' },
    { title: 'Meal-Prep minimal', body: 'Nicht 7 Tage vorkochen: 1 Protein, 1 Kohlenhydrat, 2 Gemüse und 1 Sauce reichen als Baukasten.' },
    { title: 'Gewichtsverlust ohne Crash', body: 'Ein kleines, nachhaltiges Defizit ist sinnvoller als aggressive Diäten. Bei Erkrankungen bitte ärztlich abklären.' }
  ]);

  const FITNESS_RECIPE_PARTS = Object.freeze({
    bases: ['Haferflocken', 'Quinoa', 'Vollkornreis', 'Kartoffeln', 'Süsskartoffeln', 'Linsenpasta', 'Couscous', 'Bulgur', 'Vollkornwrap'],
    proteins: ['Poulet', 'Lachs', 'Thunfisch', 'Tofu', 'Tempeh', 'Eier', 'Skyr', 'Kichererbsen', 'Linsen', 'Hüttenkäse'],
    vegetables: ['Brokkoli', 'Spinat', 'Peperoni', 'Zucchini', 'Karotten', 'Tomaten', 'Gurke', 'Blumenkohl', 'Edamame'],
    sauces: ['Zitronen-Joghurt', 'Tomaten-Basilikum', 'Tahini-Limette', 'Salsa', 'Soja-Ingwer', 'Avocado-Limette', 'Kräuterquark'],
    formats: ['Bowl', 'Pfanne', 'Salat', 'Wrap', 'Ofenblech', 'Suppe', 'Meal-Prep-Box']
  });

  const COMPANION_STAGE_POSTERS = [
    { file: 'stage-01.png', mood: 'Opening Frame', cue: 'Foundation', align: 'left' },
    { file: 'stage-02.png', mood: 'Clean Lines', cue: 'Momentum', align: 'right' },
    { file: 'stage-03.png', mood: 'Street Focus', cue: 'Intent', align: 'left' },
    { file: 'stage-04.png', mood: 'Poolside Calm', cue: 'Warmup', align: 'left' },
    { file: 'stage-05.png', mood: 'Alpine Air', cue: 'Breath', align: 'right' },
    { file: 'stage-06.png', mood: 'Sharp Turn', cue: 'Change', align: 'left' },
    { file: 'stage-07.png', mood: 'Snowline', cue: 'Clarity', align: 'left' },
    { file: 'stage-08.png', mood: 'Coastal Motion', cue: 'Flow', align: 'right' },
    { file: 'stage-09.png', mood: 'Stadium Energy', cue: 'Drive', align: 'left' },
    { file: 'stage-10.png', mood: 'Cloud Focus', cue: 'Lift', align: 'left' },
    { file: 'stage-11.png', mood: 'Stage Heat', cue: 'Pulse', align: 'right' },
    { file: 'stage-12.png', mood: 'Design in Motion', cue: 'Precision', align: 'left' },
    { file: 'stage-13.png', mood: 'Glacier Quiet', cue: 'Discipline', align: 'right' },
    { file: 'stage-14.png', mood: 'Palm Rhythm', cue: 'Balance', align: 'left' },
    { file: 'stage-15.png', mood: 'Tropical Light', cue: 'Focus', align: 'right' },
    { file: 'stage-16.png', mood: 'Water Control', cue: 'Control', align: 'left' },
    { file: 'stage-17.png', mood: 'Golden Hours', cue: 'Build', align: 'right' },
    { file: 'stage-18.png', mood: 'Above the Clouds', cue: 'Ascend', align: 'left' },
    { file: 'stage-19.png', mood: 'Summit Frame', cue: 'Apex', align: 'right' },
    { file: 'stage-20.png', mood: 'Final Form', cue: 'Champ', align: 'left' }
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
      key: 'low-energy-rescue'