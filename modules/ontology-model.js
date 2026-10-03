(function (root) {
  'use strict';
  const groups = Object.freeze({ habits: { label: 'Habits & Fitness', color: '#149b93' }, planning: { label: 'Planung & Projekte', color: '#7b6bd6' }, consumption: { label: 'Konsum & Pausen', color: '#d17b41' }, knowledge: { label: 'Wissen & Listen', color: '#4485b5' }, progress: { label: 'Fortschritt & Coaching', color: '#b28925' }, system: { label: 'Weitere Daten', color: '#768696' } });
  const definitions = new Map(), relations = [];
  const active = row => row && !row.is_archived && !row.isArchived;
  function register(definition) {
    if (!definition?.id || !definition.label || !groups[definition.group]) throw new Error('Ontology: id, label und gültige group erforderlich.');
    if (definitions.has(definition.id)) throw new Error('Ontology: doppelte Entität ' + definition.id);
    definitions.set(definition.id, Object.freeze({ fields: [], ...definition }));
  }
  function relate(from, to, label, kind = 'stored', evidence = '') {
    if (!['stored', 'derived', 'contains'].includes(kind)) throw new Error('Ontology: ungültiger Beziehungstyp.');
    relations.push(Object.freeze({ from, to, label, kind, evidence }));
  }
  const target = (screen, anchor, kind) => ({ screen, ...(anchor ? { anchor } : {}), ...(kind ? { kind } : {}) });
  function entity(id, label, group, key, description, fields, destination) {
    register({ id, label, group, key, description, fields: fields.split('|'), target: destination });
  }
  const H = target('habits'), F = target('fitness'), T = target('tasks'), P = target('projects'), D = target('dashboard'), L = target('lists'), C = target('calendar'), S = target('smoking');
  entity('habits', 'Habits', 'habits', 'habits', 'Definitionen deiner Gewohnheiten. Ein Habit legt Messart, Ziel, Rhythmus und Darstellung fest.', 'Name|Messart|Einheit|Zielwert|Zielperiode|Richtung|Icon|Archivstatus', H);
  entity('entries', 'Habit-Einträge', 'habits', 'habitEntries', 'Zeitpunktbezogene Messungen eines Habits. Fitness und viele Auswertungen verwenden dieselben Einträge.', 'habit_id → Habit|occurred_at|value_num|value_bool|Notiz', H);
  entity('fitness', 'Fitness-Sessions', 'habits', null, 'Jogging- und Wander-Sessions werden aus positiven Distanz-Einträgen aktiver Habits abgeleitet. Keine eigene Session-Tabelle.', 'Habit|Eintrag|Distanz|Dauer|Höhenmeter', F);
  entity('jogging', 'Joggen', 'habits', null, 'Distanz-Habits mit Laufdauer. Die App erkennt sie anhand von Icon oder Name.', 'Kilometer|Laufdauer|Pace', F);
  entity('hiking', 'Wandern', 'habits', null, 'Distanz-Habits mit Höhenmetern und Wander-Punkteformel.', 'Kilometer|Höhenmeter|Dauer', F);
  entity('swimming', 'Schwimmen', 'habits', null, 'Schwimm-Habits und deren Dauer-Einträge. Die Punktelogik verwendet die erfassten Minuten.', 'Dauer|Habit-Eintrag|Punkte', H);
  entity('fitnessMetrics', 'Fitness-Kennzahlen', 'habits', null, 'Distanz und erfasste Dauer/Höhenmeter bilden die Basis. Kalorien, Splits und fehlende Messwerte werden teilweise geschätzt; keine zusätzlichen Messdaten.', 'Pace|Dauer|Kalorien (geschätzt)|Splits (modelliert)|Höhenmeter', F);
  entity('compass', 'Trainingskompass', 'habits', null, 'Wochenmodell aus Ausdauer, Liegestützen, Meditation und weiteren gesunden Gewohnheiten.', 'Ausdauer|Kraft|Mind|Gesunde Tage', F);
  entity('records', 'Persönliche Bestleistungen', 'habits', null, 'Aus Habit- und Fitness-Verläufen abgeleitete Rekorde und Vergleiche.', 'Bestwert|Historie|Fortschritt', F);
  entity('tasks', 'Aufgaben', 'planning', 'tasks', 'Aufgaben mit Status, Aufwand, Priorität, Fälligkeit und optionalem Projekt.', 'Titel|Status|Aufwand|Priorität|Kategorie|Fälligkeit|project_id|Zwischenschritte', T);
  entity('steps', 'Zwischenschritte', 'planning', null, 'Checklisten innerhalb einer Aufgabe; gespeichert als steps und teilweise in älteren Beschreibungs-Metadaten.', 'Aufgabe|Text|Erledigt', T);
  entity('taskSeries', 'Aufgaben-Zyklen', 'planning', null, 'Monatliche Wiederholungen einer Aufgabe. Die App verwaltet den Zyklus in Aufgaben-Metadaten.', 'Serienbezug|Zyklus|Folgefälligkeit', T);
  entity('taskMedia', 'Aufgaben-Bildanhänge', 'planning', null, 'Bis zu drei komprimierte Bilder einer Aufgabe, in deren Metadaten gespeichert.', 'Aufgabe|Bilddaten', T);
  entity('ideas', 'Aufgabenideen', 'planning', 'taskIdeas', 'Ideen können zu Aufgaben oder Backlog-Karten werden und einem Projekt zugeordnet sein.', 'Titel|Kategorie|Story Points|project_id|generated_task_id|Status', target('tasks', 'taskIdeasPanel', 'ideas'));
  entity('activities', 'Aktivitätsideen', 'planning', 'activityIdeas', 'Eigene Freizeitideen mit Dauer, Budget, Energie und Umfeld. Der separate Vorschlagskatalog wird für diese Karte nicht geladen.', 'Kategorie|Dauer|Budget|Energie|Wetter|Personen|project_id', target('tasks', 'taskIdeasPanel', 'ideas'));
  entity('projects', 'Projekte', 'planning', 'projects', 'Übergreifende Planung mit Phasen, Meilensteinen, Aufgaben und Notizen.', 'Titel|Status|Priorität|Start|Ende', P);
  entity('phases', 'Projektphasen', 'planning', 'projectPhases', 'Geordnete Abschnitte innerhalb eines Projekts.', 'project_id|Name|Reihenfolge|Start|Ende', P);
  entity('milestones', 'Meilensteine', 'planning', 'projectMilestones', 'Meilensteine gehören zu einem Projekt und können auf eine Phase verweisen.', 'project_id|phase_id|Titel|Fälligkeit|Status', P);
  entity('projectNotes', 'Projektnotizen', 'planning', 'projectNotes', 'Notizen zum Projekt, unabhängig von dessen Aufgaben.', 'project_id|Text|Zeitpunkt', P);
  entity('appointments', 'Termine', 'planning', 'appointments', 'Kalendereinträge inklusive Terminart, Ort und optionalem Geburtstag oder Event-Typ.', 'Titel|Start|Ende|Ort|Terminart|Event-Typ|series_id', C);
  entity('appointmentSeries', 'Terminserien', 'planning', null, 'Wiederkehrende Termine sind über series_id und series_index verbunden.', 'series_id|series_index|Wiederholung', C);
  entity('calendar', 'Kalender', 'planning', null, 'Gemeinsame Zeitansicht für Termine, Aufgaben und Konsumkontext. Zeitliche Zusammenführung ist keine Fremdschlüssel-Beziehung.', 'Datum|Termine|Fälligkeiten|Konsumkontext', C);
  entity('goals', 'Roadmap-Ziele', 'planning', 'goals', 'Ziele sind spezielle Listeneinträge. Gewichts- und Zählziele referenzieren ein Habit über metadata.habitId.', 'Titel|Zielart|habitId|Startdatum|Zieldatum|Zielwert', { ...C, kind: 'roadmap' });
  entity('roadmap', 'Roadmap', 'planning', null, 'Gemeinsame Zeitleiste von Projekten, Meilensteinen, Aufgaben, Wochenzetteln und persönlichen Zielen.', 'Zeitraum|Fortschritt|Planung', { ...C, kind: 'roadmap' });
  entity('smoke', 'Zigaretten', 'consumption', 'cigarettes', 'Einzelne Rauchereignisse mit Zeit, Rauchabstand und Alkoholkontext.', 'smoked_at|interval_minutes|alcohol_context|Punkte|Notiz', { ...S, kind: 'smoke' });
  entity('alcoholDays', 'Alkohol-Tageslogs', 'consumption', 'alcoholLogs', 'Tagesbezogene Konsumintensität mit daraus berechneten Abzügen.', 'log_date|consumed|consumption_level|consumption_key|Punkte', { ...S, kind: 'alcohol' });
  entity('alcoholEvents', 'Alkohol-Ereignisse', 'consumption', 'alcoholUnits', 'Einzeln erfasste Getränke mit Typ und Zeitpunkt. Tagesbezug wird aus dem Datum hergestellt.', 'occurred_at|drink_type|Notiz', { ...S, kind: 'alcohol' });
  entity('pauses', 'Pausenzeiträume', 'consumption', 'pausePeriods', 'Pausen gelten für ein Habit, Rauchen oder Alkohol. Sie beeinflussen die sichtbaren Einträge und Auswertungen.', 'scope|target_id|Start|Ende|Notiz', target('smoking', 'consumptionPauseList', 'pauses'));
  entity('smokeAnalytics', 'Konsum-Auswertungen', 'consumption', null, 'Intervalle, Tagesmuster, Heatmaps und Kosten werden aus Konsumereignissen berechnet.', 'Rauchabstände|Konsumtage|Verteilung|Kosten', S);
  entity('lists', 'Listen', 'knowledge', 'lists', 'Sammlungen mit unterschiedlichen Fachansichten. Neue Listen erscheinen automatisch als eigene Knoten.', 'Titel|Typ|Icon|Farbe', L);
  entity('listItems', 'Listeneinträge', 'knowledge', 'listItems', 'Gemeinsames Datenmodell der Listen. Fachspezifische Werte stehen in metadata.', 'listId → Liste|Titel|Notiz|metadata|Erledigt|Archivstatus', L);
  entity('dossiers', 'Dossiers', 'knowledge', 'dossiers', 'Sammlungen von Notizen, Links und Bildern, optional mit Projektbezug.', 'Titel|Beschreibung|project_id', { ...P, kind: 'dossier' });
  entity('dossierEntries', 'Dossier-Einträge', 'knowledge', 'dossierEntries', 'Einträge gehören genau zu einem Dossier. Im lokalen Snapshot sind gegebenenfalls erst bereits geladene Einträge enthalten.', 'dossier_id|Titel|Text|Link|image_path|Angeheftet', { ...P, kind: 'dossier' });
  entity('dossierMedia', 'Dossier-Bilder & Links', 'knowledge', null, 'Anhänge und Links sind Felder des Eintrags. Bilder werden erst in der Dossier-Ansicht angefordert.', 'Bildpfad|Alternativtext|Weblink', { ...P, kind: 'dossier' });
  entity('learnings', 'Learning Vault', 'knowledge', 'learnings', 'Learnings, Zitate und Beobachtungen mit Kontext und Tags. Erzeugen keine Aufgaben und keine Punkte.', 'Titel|Text|Kontext|Tags|Zeitpunkt', target('dashboard', 'learningVaultSection'));
  entity('points', 'Punktebuchungen', 'progress', 'pointsLedger', 'Buchungen verweisen polymorph über source_type und source_id auf ihren Ursprung. Habit-Buchungen referenzieren den Eintrag, nicht die Habit-Definition.', 'source_type|source_id|Punkte|Grund|earned_at', { ...D, kind: 'points' });
  entity('companion', 'Companion & Stufen', 'progress', null, 'Stufe und Fortschritt folgen dem gültigen Punktestand. Energie und Bindung sind separate Werte.', 'Punktesumme|Stufe|Stufenfortschritt|Energie|Bindung', target('dashboard', 'companionCard'));
  entity('routine', 'Morgenroutine', 'progress', 'morningRoutineLogs', 'Tägliche Abschlüsse einer Routine. Wenn ein Morgenroutine-Habit besteht, wird dazu ein Habit-Eintrag erzeugt.', 'date_key|routine_key|completed_at', { ...D, kind: 'routine' });
  entity('missions', 'Monats-Missionen', 'progress', 'monthlyMissions', 'Monatliche Ziele mit manueller oder berechneter Fortschrittsmetrik.', 'Monat|Kategorie|Metrik|Ziel|Manueller Stand|Abschluss', target('dashboard', 'monthlyMissionsPanel'));
  entity('reviews', 'Wochenrückblicke', 'progress', 'weeklyReviews', 'Gespeicherte Auswertungen mit Kennzahlen, Highlights und Empfehlung.', 'Woche|Zeitraum|Score|Kennzahlen|Highlights', { ...D, kind: 'reviews' });
  entity('weeklyPoints', 'Wochenpunkte', 'progress', null, 'Wochenbasierte Auswertung aus den bestehenden Habit- und Konsumdaten.', 'Woche|Aktivitäten|Konsum|Wochenwert', target('dashboard', 'weeklyReview'));
  entity('magazine', 'Monatsmagazin', 'progress', null, 'Monatlicher Rückblick mit Score, Geschichten und Bildern aus dem Magazin-Katalog.', 'Monat|Score|Kennzahlen|Titelbild', D);
  entity('coach', 'Life Coach', 'progress', null, 'Empfehlungen und Tagesplanung aus Habits, Aufgaben, Terminen und Listen.', 'Tagesplanung|Empfehlungen|Kontext', { ...D, kind: 'coach' });
  entity('coachEvents', 'Coach-Ereignisse', 'progress', 'coachEvents', 'Lokale Coach-Historie; kein eigener Supabase-Fremdschlüssel zu Habits.', 'Typ|Zeitpunkt|Kontext', { ...D, kind: 'coach' });
  entity('experiments', 'Experimente', 'progress', 'experiments', 'Lokale Experimente mit Regel, Status und Ergebnissen.', 'Schlüssel|Regel|Status|Ergebnisse', target('smoking', 'experimentModeCard'));
  entity('partyPlans', 'Party-Pläne', 'progress', 'partyPlans', 'Lokale Checklisten für bewusste Konsumplanung.', 'Status|Schritte|Zeitpunkt', target('smoking', 'partyPlanCard'));
  entity('recovery', 'Recovery-Sessions', 'progress', 'recoverySessions', 'Lokale Erholungseinheiten im Konsum-Coaching.', 'Status|Zeitpunkt', target('smoking', 'recoveryModeCard'));
  entity('badges', 'Erfolge & Badges', 'progress', null, 'Freigeschaltete Erfolge aus Habit-, Aufgaben-, Konsum- und Coaching-Kennzahlen.', 'Erfolg|Schwelle|Fortschritt|Freigeschaltet', target('dashboard','gamificationPanel'));
  entity('ghosts', 'Ghost Arena', 'progress', null, 'Vergleicht aktuelle und vorherige Zeitfenster und macht wiederkehrende Habit- und Konsummuster sichtbar.', 'Vergleichszeitraum|Muster|Fortschritt|Nächster Schritt', target('habits','hfGhostArena'));
  entity('photoTours', 'Fototouren', 'knowledge', 'photoTours', 'Touren gruppieren Fotospots zu einer geordneten Route.', 'Titel|Region|Reihenfolge', { ...L, kind:'list', id:'photos' });
  entity('photoStops', 'Fotospots', 'knowledge', 'photoStops', 'Orte innerhalb einer Fototour, mit optionalem Bild und Reihenfolge. Die Ontology lädt keine Bilder.', 'tourId|Titel|Ort|Bild|stopOrder', { ...L, kind:'list', id:'photos' });
  const listFields = {
    vouchers:['Titel','Code / Notiz','metaA','metaB'], shopping:['Titel','Kategorie','Menge','Laden','Erledigt'], photos:['Fototour','Region','Fotospots','Bilder'],
    subscriptions:['Titel','Kosten','Zyklus','Gekündigt','Vertragsende'], terms:['Begriff','Notiz','Kategorie'], finance:['Art','Betrag','Gesamtbetrag','Einheit','Richtung','Gegenpartei','Fälligkeit'],
    chatgpt:['Titel','Projektgruppe (Text)','URL','Notiz'], weblinks:['Titel','URL','Kategorie'], gifts:['Person','Titel','Notiz','promotedTaskId'], weekly:['weekStart','carriedFromId','carriedToId','Text','Erledigt'], exhibition:['Bild','Text','Typografie','Darstellung']
  };
  const R = (from, to, label, evidence) => relate(from, to, label, 'stored', evidence);
  const A = (from, to, label, evidence) => relate(from, to, label, 'derived', evidence);
  R('habits','entries','hat Einträge','habit_entries.habit_id → habit_definitions.id · 1:n');
  A('entries','fitness','liefert Distanz-Sessions','buildFitnessSessions(): aktive Distanz-Habits, sichtbare Einträge, value_num > 0');
  A('habits','jogging','wird als Lauf-Habit erkannt','isFitnessDistanceHabit / fitnessHabitType'); A('habits','hiking','wird als Wander-Habit erkannt','isFitnessDistanceHabit / fitnessHabitType'); A('habits','swimming','wird als Schwimm-Habit erkannt','isSwimmingHabit');
  A('jogging','fitness','liefert Läufe'); A('hiking','fitness','liefert Wanderungen'); A('swimming','points','bewertet Schwimmdauer');
  A('fitness','fitnessMetrics','berechnet / schätzt Kennzahlen','buildFitnessSession; Schätzwerte sind keine aufgezeichneten Messungen'); A('fitness','records','liefert Rekorde'); A('entries','records','liefert Bestwerte'); A('entries','compass','prägt Wochenprofil'); A('fitness','compass','liefert Ausdauer');
  R('projects','tasks','enthält Aufgaben','tasks.project_id · 1:n'); R('projects','phases','gliedert sich in','project_phases.project_id · 1:n'); R('projects','milestones','hat Meilensteine','project_milestones.project_id · 1:n'); R('phases','milestones','ordnet Meilensteine','project_milestones.phase_id · 1:n, optional'); R('projects','projectNotes','sammelt Notizen','project_notes.project_id · 1:n'); R('projects','ideas','bündelt Ideen','task_ideas.project_id'); R('projects','activities','bündelt Aktivitäten','activity_ideas.project_id');
  R('ideas','tasks','wird zur Aufgabe','task_ideas.generated_task_id'); A('activities','ideas','kann als Idee übernommen werden','activity-to-idea');
  relate('tasks','steps','enthält Checkliste','contains','tasks.steps / Beschreibungs-Metadaten'); relate('tasks','taskMedia','enthält Bildanhänge','contains','Beschreibungs-Metadaten'); relate('tasks','taskSeries','enthält Zyklus','contains','Wiederholungs-Metadaten');
  R('appointmentSeries','appointments','gruppiert Termine','appointments.series_id / series_index'); A('appointments','calendar','erscheint am Datum'); A('tasks','calendar','erscheint bei Fälligkeit'); A('smoke','calendar','liefert Tageskontext'); A('alcoholDays','calendar','liefert Tageskontext');
  R('habits','goals','misst Ziel-Fortschritt','list_items.metadata.habitId; nur Gewichts- / Zählziele'); relate('listItems','goals','enthält Roadmap-Ziele','contains','listId = roadmap-goals');
  for (const id of ['projects','milestones','tasks','goals']) A(id,'roadmap','erscheint auf Zeitachse');
  R('habits','pauses','kann pausiert sein','pause_periods.scope = habit, target_id → Habit'); A('pauses','entries','beeinflusst Sichtbarkeit'); A('pauses','smoke','berücksichtigt Rauch-Pausen','scope = smoke'); A('pauses','alcoholDays','berücksichtigt Alkohol-Pausen','scope = alcohol'); A('alcoholEvents','alcoholDays','wird nach Tag zusammengeführt','Zeitlicher Bezug, kein gespeicherter Fremdschlüssel'); A('alcoholDays','smoke','liefert Alkoholkontext','Zeitlicher Kontext; alcohol_context am Rauchereignis');
  for (const id of ['smoke','alcoholDays','alcoholEvents']) A(id,'smokeAnalytics','liefert Auswertungsdaten');
  R('lists','listItems','enthält Einträge','list_items.list_id / lokal listId · 1:n'); R('projects','dossiers','hat optionale Dossiers','dossiers.project_id · 1:n'); R('dossiers','dossierEntries','enthält Einträge','dossier_entries.dossier_id · 1:n'); relate('dossierEntries','dossierMedia','enthält Bild oder Link','contains','image_path / image_alt / link');
  R('entries','points','ist Buchungsquelle','source_type = habit, source_id → habit_entries.id'); R('tasks','points','ist Buchungsquelle','source_type = task, source_id → tasks.id'); R('smoke','points','ist Buchungsquelle','source_type = cigarette'); A('alcoholDays','points','erzeugt Tagesabzüge'); A('pauses','points','beeinflusst gültige Punkte'); A('points','companion','bestimmt Stufe'); A('routine','entries','kann Habit-Eintrag erzeugen','Abschluss erzeugt boolean-Eintrag für Morgenroutine-Habit, falls vorhanden'); A('routine','points','belohnt Abschluss','Habit-Buchung oder Routine-Bonus');
  for (const id of ['entries','tasks','smoke','alcoholDays','routine']) { A(id,'missions','misst passende Mission'); A(id,'reviews','fliesst in Wochenrückblick ein'); }
  for (const id of ['entries','smoke','alcoholDays']) A(id,'weeklyPoints','liefert Wochendaten');
  for (const id of ['tasks','routine','smoke','alcoholDays','alcoholEvents','fitness','missions']) A(id,'magazine','liefert Monatsdaten');
  A('points','weeklyPoints','liefert Wochenbuchungen');
  R('photoTours','photoStops','enthält Fotospots','photo_stops.tour_id / lokal tourId · 1:n');
  for (const id of ['entries','tasks','smoke','alcoholDays','routine','coachEvents']) A(id,'badges','liefert Erfolgs-Kennzahlen');
  for (const id of ['entries','smoke','alcoholDays']) A(id,'ghosts','liefert Vergleichsdaten'); A('entries','magazine','liefert Monatsverlauf'); A('points','magazine','liefert Punkteverlauf');
  for (const id of ['habits','tasks','appointments','listItems','smoke','alcoholDays']) A(id,'coach','liefert Kontext');
  for (const id of ['experiments','partyPlans','recovery','coachEvents']) A(id,'companion','ergänzt Coaching-Kennzahlen');

  function build(snapshot = {}) {
    const nodes = new Map(), edges = [], collections = new Map(), indexes = new Map();
    const rows = key => { if (!collections.has(key)) collections.set(key, (Array.isArray(snapshot[key]) ? snapshot[key] : []).filter(active)); return collections.get(key); };
    const index = (key, field) => {
      const cacheKey = key + ':' + field;
      if (!indexes.has(cacheKey)) { const map = new Map(); for (const row of rows(key)) { const id = row[field]; if (!map.has(id)) map.set(id, []); map.get(id).push(row); } indexes.set(cacheKey, map); }
      return indexes.get(cacheKey);
    };
    function add(def) { const list = def.rows || (def.key ? rows(def.key) : null); nodes.set(def.id, { ...def, rows: list, count: list ? list.length : null }); }
    for (const def of definitions.values()) add(def);
    const edge = (from, to, label, kind = 'stored', evidence = '') => { if (nodes.has(from) && nodes.has(to)) edges.push({ from, to, label, kind, evidence }); };
    for (const rel of relations) edge(rel.from, rel.to, rel.label, rel.kind, rel.evidence);
    const habitMeta = new Map((snapshot.ontologyHabits || []).map(row => [row.id, row]));
    const entryIndex = index('habitEntries','habit_id'), fitnessIds = new Set();
    for (const habit of rows('habits')) {
      const id = 'habit:' + habit.id, meta = habitMeta.get(habit.id), entries = entryIndex.get(habit.id) || [];
      const type = meta?.fitness;
      if (type === 'jogging' || type === 'hiking') fitnessIds.add(habit.id);
      add({ id, label: habit.name || 'Habit', group: 'habits', description: `${meta?.category || 'Habit'} · ${habit.type || 'Messung'} · ${habit.target ?? '–'} ${habit.unit || ''} / ${habit.target_period || 'day'}. Die Anzahl zeigt lokal geladene Einträge.`, fields: nodes.get('habits').fields, rows: entries, target: { ...H, kind: 'habit', id: habit.id }, rowTarget: row => ({ ...H, kind: 'habit', id: row.habit_id }) });
      edge('habits',id,'enthält Habit','contains'); edge(id,'entries','hat '+entries.length+' Einträge','stored','habit_entries.habit_id');
      if (type && nodes.has(type)) edge(id,type,'gehört zu','derived','Klassifikation der bestehenden App');
    }
    const fitness = rows('habitEntries').filter(row => fitnessIds.has(row.habit_id) && Number(row.value_num) > 0);
    // Raw loaded rows are intentionally not rescored and no synthetic session metrics are built here.
    nodes.get('fitness').rows = fitness; nodes.get('fitness').count = fitness.length;
    for (const list of rows('lists')) {
      const id = 'list:' + list.id, items = list.id === 'photos' ? rows('photoTours') : index('listItems','listId').get(list.id) || [];
      add({ id, label: list.title || list.id, group: 'knowledge', description: list.description || 'Liste mit fachspezifischen Einträgen.', fields: listFields[list.id] || nodes.get('listItems').fields, rows: items, target: { ...L, kind:'list', id:list.id }, rowTarget: row => ({ ...L, kind:'list', id:list.id, itemId:row.id }) });
      edge('lists',id,'enthält Liste','contains'); if (list.id === 'photos') edge(id,'photoTours','enthält '+items.length+' Touren','contains');
      else edge(id,'listItems','enthält '+items.length+' Einträge','stored','listId');
      if (list.id === 'gifts') edge(id,'tasks','verknüpft Geschenk-Aufgabe','stored','metadata.promotedTaskId → tasks.id, nach Übernahme');
      if (list.id === 'weekly') { edge(id,'roadmap','erscheint auf Zeitachse','derived'); edge(id,'coach','liefert Wochenkontext','derived'); }
    }
    for (const project of rows('projects')) {
      const id = 'project:' + project.id, tasks = index('tasks','project_id').get(project.id) || [];
      add({ id, label: project.title || project.name || 'Projekt', group:'planning', description:'Projekt mit '+tasks.length+' lokal geladenen Aufgaben.', fields:nodes.get('projects').fields, rows:tasks, target:{ ...P, kind:'project', id:project.id }, rowTarget:row => ({ ...T, kind:'task', id:row.id }) });
      edge('projects',id,'enthält Projekt','contains');
      for (const [key,type,field] of [['tasks','tasks','project_id'],['projectPhases','phases','project_id'],['projectMilestones','milestones','project_id'],['projectNotes','projectNotes','project_id'],['dossiers','dossiers','project_id'],['taskIdeas','ideas','project_id']]) {
        const count = index(key,field).get(project.id)?.length || 0;
        if (count) edge(id,type,'verknüpft '+count,'stored',field+' → Projekt');
      }
    }
    const covered = new Set([...definitions.values()].map(def => def.key).filter(Boolean));
    covered.add('ontologyHabits');
    for (const [key,value] of Object.entries(snapshot)) if (Array.isArray(value) && !covered.has(key)) {
      add({ id:'collection:'+key, label:key, group:'system', key, description:'Automatisch erkannte Sammlung. Fachliche Beziehungen und ein direkter Sprung können über die Registry ergänzt werden.', fields:Object.keys(value[0] || {}).filter(k => !['user_id','synced'].includes(k)).slice(0,12), target:null });
    }
    const adjacency = new Map([...nodes.keys()].map(id => [id, []]));
    for (const rel of edges) { adjacency.get(rel.from).push(rel); adjacency.get(rel.to).push(rel); }
    return { nodes, edges, adjacency };
  }
  function sliceGraph(model, selected, options = {}) {
    const { group = '', query = '', overview = false, limit = 80 } = options;
    const search = query.trim().toLocaleLowerCase('de');
    const neighbors = new Set([selected]);
    for (const edge of model.adjacency.get(selected) || []) { neighbors.add(edge.from); neighbors.add(edge.to); }
    const matches = [...model.nodes.values()].filter(node => (!group || node.group === group) && (!search || (node.label+' '+node.description+' '+node.fields.join(' ')).toLocaleLowerCase('de').includes(search)));
    const candidates = matches.filter(node => overview || search || group || neighbors.has(node.id));
    candidates.sort((a,b) => Number(b.id === selected)-Number(a.id === selected));
    const nodes = candidates.slice(0, limit), ids = new Set(nodes.map(node => node.id));
    return { nodes, edges:model.edges.filter(edge => ids.has(edge.from) && ids.has(edge.to)), total:candidates.length };
  }
  const api = Object.freeze({ groups, register, relate, build, sliceGraph });
  root.HabitFlowOntologyModel = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window === 'object' ? window : globalThis);
