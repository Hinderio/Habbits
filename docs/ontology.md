# Ontology

Zugang: Dashboard → Info / Punkte-Regelwerk → **Ontology**.

Die Ontology beschreibt das Datenmodell und die fachlichen Beziehungen der App. Sie ist eine lesende Momentaufnahme der **bereits lokal geladenen** Daten, kein zusätzlicher Datenspeicher. Dossier-Einträge können erst nach dem Öffnen des Dossiers lokal vorliegen. `Aktualisieren` liest die aktuellen App-Snapshots erneut ein, startet aber keinen Netzwerksync. Archivierte Datensätze mit Archiv-Flag werden ausgeschlossen. Einträge während Pausen bleiben für die Modellanalyse sichtbar; daraus abgeleitete App-Auswertungen können sie ausschliessen.

## Bedienung

- Eine Entität links, auf der Karte oder in der Beziehungsliste auswählen: ihr direktes Beziehungsnetz wird fokussiert. Der Graph beginnt in lesbarer Zoomstufe; Randbereiche erreicht man durch Verschieben oder `Einpassen`.
- `↗` am Knoten oder `In der App öffnen` führt zur bestehenden App-Ansicht. Habit-, Aufgaben-, Projekt-, Dossier-, Termin- und Listendatensätze verwenden die vorhandenen Detail- bzw. Navigationspfade. Nicht jede Unterstruktur besitzt einen separaten Editor; dann öffnet sich ihr übergeordneter Bereich.
- Suche und Bereichsfilter grenzen Entitäten ein. `Gesamtkarte` zeigt eine begrenzte Übersicht, `Fokus` wieder die direkten Nachbarn der Auswahl.
- Karte mit Maus oder Finger verschieben; Zoom über +/− oder Ctrl/⌘ + Mausrad. Tastatur: Karte fokussieren, Pfeiltasten verschieben, +/− zoomen, 0 passt ein. Alle Entitäten und Beziehungen sind auch als normale Buttons erreichbar.
- Escape schliesst den nativen Dialog. Fokus und vorhandene Scrollsperren werden wiederhergestellt. Auf Mobilgeräten stehen Details unter der Karte.

## Analysierte Quellen und Modellgrenzen

- `app.js`, `supabase.sql`: Habit-Definitionen, Einträge, Aufgaben, Ideen, Termine, Zigaretten, Alkohol-Tageslogs und -Ereignisse, Pausen, Punkte, Routinen, Missionen und Rückblicke.
- `modules/projects.js`: Projekte, Phasen, Meilensteine, Notizen und Projektverknüpfungen.
- `modules/dossiers-store.js`: Dossiers, Einträge, Projektbezug, Links und Bilder. Der Store filtert nach aktuellem Benutzer.
- `modules/lists.js`: Listen und Einträge, Gutscheine, Einkäufe, Abos, Begriffe, Finanzen, ChatGPT-Links, Weblinks, Geschenke, Wochenzettel, Exhibition sowie separate Fototouren und Fotospots.
- `HabitFlowRoadmapGoals`: Roadmap-Ziele mit `metadata.habitId`; `roadmap-goals` ist eine spezielle Liste.
- `modules/learning-vault.js`: Learnings mit Kontext und Tags, ohne automatische Aufgaben- oder Punkteerzeugung.
- `modules/weekly-points-domain.js`, `modules/ghost-arena.js` und die Auswertungen in `app.js`: Wochenpunkte, Ghost Arena, Trainingskompass, Bestleistungen, Erfolge, Companion und Monatsmagazin.

**Durchgezogene Linie:** gespeicherter Bezug (auch JSON-Metadaten / polymorphe IDs, nicht zwingend ein SQL-Foreign-Key). **Gestrichelt:** Berechnung oder fachlicher Zusammenhang. **Gepunktet:** Unterstruktur / Zugehörigkeit. Die Detailansicht nennt Richtung, Bedeutung und bei gespeicherten Verweisen das Referenzfeld.

Fitness-Sessions sind aus Habit-Einträgen abgeleitete Jogging-/Wander-Sessions, keine eigene Tabelle. Die Ontology verwendet dieselbe Habit-Klassifikation wie die App und berechnet beim Öffnen keine Splits oder Kalorien. Diese Werte sind teilweise geschätzt und werden entsprechend beschrieben. Schwimmen wird separat als Habit-Verbindung erfasst. Habit-Punkte verweisen auf **habit_entries.id**, nicht auf die Habit-Definition. Alkohol-Tageszuordnung ist ein zeitlicher Zusammenhang, kein Fremdschlüssel. ChatGPT-Projektgruppen sind Text-Metadaten, keine Verknüpfung zu HabitFlow-Projekten.

## Erweiterung

`modules/ontology-model.js` enthält die deklarative Registry. Renderer und Datenmodell sind getrennt. Weitere Entitäten vor dem nächsten `open()` registrieren:

```js
HabitFlowOntologyModel.register({
  id: 'example',
  label: 'Neue Entität',
  group: 'planning', // habits, planning, consumption, knowledge, progress, system
  key: 'exampleRows', // Collection im Snapshot
  description: 'Fachliche Bedeutung.',
  fields: ['Titel', 'habit_id'],
  target: { screen: 'tasks' }
});
HabitFlowOntologyModel.relate(
  'habits', 'example', 'verknüpft', 'stored',
  'exampleRows.habit_id → Habit'
);
```

Die neue Collection muss über einen lesenden Provider in `snapshot()` verfügbar sein. Bestehende Kern-State-Arrays werden automatisch mitgegeben. Unbekannte Arrays erscheinen ohne erfundene Beziehungen unter „Weitere Daten“ und haben bis zur Registrierung kein Sprungziel. Neue Habits, Listen und Projekte werden automatisch als individuelle Knoten ergänzt. Neue Tabellen ausserhalb des App-Snapshots benötigen einen Provider; ein allgemeines Auslesen privater Datenbanktabellen findet nicht statt.

`rowTarget(row)` kann bei einer registrierten Entität ein genaueres Datensatz-Sprungziel liefern. Alle Navigation läuft über `HabitFlowOntologyBridge.open` bzw. die vorhandenen Modul-Bridges; keine synthetischen Schreibaktionen oder separat duplizierte Editorlogik.

## Performance und Offline

- Beim App-Start nur ein kleiner Loader. CSS, Modell und Dialog kommen erst beim Öffnen dazu. Alle vier Assets sind im Service Worker vorgemerkt; die verzögert geladenen URLs entsprechen exakt den vorab gecachten URLs, auch offline.
- Keine Graph-Bibliothek, keine Force-Simulation, keine Timer für Hintergrundanalysen, kein Laden von Bildern oder Katalogen.
- Modellaufbau mit Maps und einmaligen Collection-Indizes. Historieneinträge werden nicht als Graph-Knoten expandiert.
- Maximal 80 Knoten im sichtbaren Graph; Suchergebnisliste in 60er-, Beziehungen in 30er- und Datensätze in 25er-Schritten. Die Statuszeile zeigt die Begrenzung. Beziehungen des ausgewählten Knotens bleiben über Nachladen vollständig in dessen Details erreichbar.
- Verschieben/Zoom ändern nur einen CSS-Transform, gebündelt über `requestAnimationFrame`; Suche wartet 120 ms auf weitere Eingabe.
- Schliessen und Benutzerwechsel entfernen gerenderte persönliche Inhalte und Snapshot-Referenzen.

## Prüfung

`node --test tests/ontology.test.cjs tests/ontology-ui.test.cjs`

Prüft Modellbeziehungen, automatische Erweiterung, Navigation über die tatsächliche App-Bridge, 100'000 Einträge, Knotenbegrenzung, HTML-Escaping, Seitennachladen, Dialog-Schliessen, Fokus-/Scroll-Wiederherstellung, Benutzerwechsel und Offline-Asset-URLs. UI-Tests verwenden eine DOM-Testumgebung; sie ersetzen keinen Browser-Layouttest.
