# Kalender-Roadmap

Die zusätzliche Kalender-Schaltfläche öffnet eine eigenständige native Dialogansicht.
Standard: sechs Monate ab dem aktuellen Monat (aktueller Monat plus fünf weitere),
auch beim erneuten Öffnen. 3, 6 oder 12 Monate sind weiterhin wählbar.
Vor-/Zurückblättern, Heute, Quellenfilter und ein direkter
Absprung zur Wochenliste. Mobile Geräte behalten links die Themen und scrollen
horizontal durch die Zeitachse. Jede Quelle hat eine eigene Zeile.

## Quellen und Ziele

- Projekte und Projektmeilensteine über die bestehende Projektverwaltung.
  Jedes Projekt hat eine zusammenhängende Swimlane mit Projektzeitraum,
  eingerückten Meilensteinen und seinen hoch priorisierten Aufgaben. Diese
  Aufgaben erscheinen nicht erneut unter freien Aufgaben. Der Projektfilter
  enthält auch zugehörige Tasks; aktuelle Projektverknüpfungen und gelöste
  Zuordnungen kommen aus der Projektverwaltung. Gleiche Projektnamen werden
  anhand ihrer IDs getrennt. Liegt ein sichtbarer Task ausserhalb des
  Projektzeitraums, bleibt die Projektzeile als beschrifteter Kontext erhalten.
- Ausschliesslich Aufgaben mit Priorität `high` (Hoch), nach Fälligkeit.
  Termine und Geburtstage sind nicht Teil der Roadmap; der normale Kalender
  bleibt unverändert. Undatierte Arbeit bleibt
  als solche sichtbar; es werden keine Planungsdaten erfunden oder geschrieben.
- Persönliche Ziele mit frei wählbarer Kategorie, Start und Zieldatum.
- Manuelle Meilensteine, numerische Messwerte (höchstens/mindestens) oder die
  Anzahl erfolgreicher Habit-Einträge, beispielsweise Jogging-Sessions.
- Zählziele zählen Einträge, nicht Tage oder die Summe numerischer Werte.
  Boolean false, nichtpositive/ungültige numerische Werte, zukünftige Einträge
  und von der bestehenden Pausenlogik ausgeblendete Einträge zählen nicht.
- Messwertziele zeigen den letzten Wert im Zielzeitraum bis heute. Der erste
  Wert dieses Zeitraums bildet die Fortschrittsbasis. Erreicht bedeutet, dass
  der letzte Messwert die gewählte Schwelle erfüllt. Kein Messwert bleibt
  ausdrücklich unbekannt; es gibt keine angenommene Startmessung.
- Einträge ausserhalb des gewählten Fensters werden ausgefiltert; das Ziel
  muss sich mit dem Zeitfenster überschneiden. Aktualisieren liest die bereits
  verfügbaren App-Daten erneut; es erzwingt keinen zusätzlichen Netzwerkabruf.

## Speicherung

Keine SQL-Migration erforderlich: Systemliste `roadmap-goals` in `custom_lists`,
Ziele in `custom_list_items`. Bestehende RLS (user_id), lokale Speicherung,
Zeitstempel-Merge, Tombstones und Online-/Foreground-Synchronisierung gelten.
Die Systemliste erscheint nicht in normalen Listenkarten, offenen Listenmetriken
oder dem Listen-Coach-Snapshot.

Metadaten Version 1: `kind` (manual/weight/count), `category`, `startDate`,
`dueDate`, `habitId`, `target`, `unit`, `direction` (atMost/atLeast).
Titel/Abschluss/Archivstatus verwenden die vorhandenen Item-Felder. Die
Default-Liste wird bei der initialen vollständigen Synchronisierung vor ihren
Items angelegt. Zieländerungen synchronisieren gezielt nur das betroffene Item.
Lokale Schreibfehler veröffentlichen keinen vermeintlich gespeicherten Zustand.
Bestehende Sync-Fehlerbehandlung übernimmt Wiederholungen; Ziele haben denselben
Konten-/Offline-Lebenszyklus wie die vorhandenen Listen.

## Leistung und Prüfung

Nur der kleine Launcher wird beim Start geladen. CSS, Domain und UI folgen beim
Öffnen. Keine Hintergrund-Timer, Scroll-Listener oder DOM-Beobachter. Ein
Habit-Index pro Snapshot; Zielabfragen verwenden binäre Suche. Sortierung einmal
pro Snapshot. Standardmässig maximal 100 Zeilen, weitere jeweils explizit per
Schaltfläche. Beim Schliessen werden Snapshot und Zeilen freigegeben.

`node --test tests/roadmap.test.cjs tests/appointment-edit-performance.test.cjs tests/calendar-render-performance.test.cjs tests/weekly-list-sync.test.cjs`

Tests prüfen Datumsgrenzen, Ziele, Persistenzfehler, gezielte Änderungen,
Tombstones, Quellen, HTML-Escaping, Navigation und begrenzte Zeilenanzahl. Der
DOM-Test verwendet einen kleinen Harness, keinen Layout-Browser. Ein manueller
Browsercheck auf Mobil/Desktop und Light/Dark bleibt ergänzend sinnvoll.
