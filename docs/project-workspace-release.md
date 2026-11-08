# Projekt-Workspace – Release 1

Stand: 8. November 2026. Ausgangsstand: `7729e5402ff4e7b107dcf9aedc08995bb6676634`.

## Produktumfang

Der äussere Switch Projekte | Dossiers sowie Portfolio und Portfolio-Timeline bleiben bestehen. Derselbe Projektmodal bietet jetzt Cockpit, Planung und Wissen. Die bestehenden Phasen-, Meilenstein-, Aufgaben- und Notizfunktionen bleiben erreichbar. Es gibt keine neue Datenbanktabelle, Migration, Library oder KI-Anbindung.

- **Cockpit:** bestehender Fortschritt, Status, Outcome und nächster Schritt; Tasks, Dossiers und Entscheidungen; letzte Entscheidung und zuletzt aktualisiertes Dossier. Unvollständige Daten werden nicht als gesicherte Nullwerte ausgegeben.
- **Planung:** bestehende Phasen/Meilensteine, Timeline, Task-Verknüpfung, gemeinsame Task-Priorisierung und einklappbare erledigte Aufgaben.
- **Wissen:** Suche und Filter Alle / Links / Gedanken / Entscheide / Dossiers. Quellen sind Projektionen validierter `links[]`, keine neuen Datensätze. Links öffnen sicher extern; der Eintrag-Button öffnet den bestehenden Dossier-Dialog an der richtigen Stelle.
- **Erfassen:** Gedanke/Link wählen bewusst ein Dossier; unzugeordnete Dossiers werden nur durch explizites Weiter verknüpft. Dossier erstellen öffnet den bestehenden Editor mit vorausgewähltem Projekt. Die Task-Aktion nutzt den vorhandenen Task-Bridge-Handler.
- **Entscheidung:** geführte Eingabe mit Entscheid/Begründung sowie optional Alternativen/Konsequenz. Speichert `category=Entscheidung` und lesbaren Text über den bestehenden Remote-First-Notizpfad. Bearbeiten und Löschen bleiben vorhandene Notizaktionen; ältere Notizen werden nicht umgeschrieben. Offene Fragen bleiben normale Notizen.
- **Coach:** höchstens drei deterministische Hinweise; keine Analyse von Freitext. Leeres Outcome, fehlende offene Tasks, fehlende Phasen und vergangenes Meilensteindatum. Vor vollständigem Projektabgleich und bei abgeschlossenen Projekten keine Warnungen.

## Daten, Leistung und Entwürfe

Tabwechsel blenden vorhandene Panels um, ohne Formulare zu ersetzen. Datenaktualisierungen erneuern nur Listen und Anzeigeabschnitte. Hintergrundereignisse aus dem Dossier-Store werden über einen einzelnen Animation-Frame zusammengefasst. Genau ein Dossier-Abonnement pro geöffnetem Projekt; beim Schliessen wird es entfernt.

Dossier-Inhalte werden nur explizit geladen: höchstens drei Dossiers nacheinander pro Ladeaktion. Die bestehende Store-Queue bleibt unverändert. Das rein abgeleitete `metrics[id].loaded` unterscheidet vollständig geladene Einträge von bloss exakten Header-Zählungen. Abbruch-/Auth-Generation verhindert die Übernahme verspäteter Antworten in einen anderen Projektkontext. Ein allein erfolgreich abgeschlossener fremder Queue-Auftrag gilt nicht als erfolgreicher Download des angeforderten Dossiers.

Wissen zeigt zunächst 20 Treffer, danach weitere 20 auf Wunsch. Projektnotizen sind ebenfalls schrittweise verfügbar. Die Listen signieren oder laden keine Bilder. Die Suchprojektion wird anhand der vorhandenen Collection-Referenzen wiederverwendet. Für 1’200 Einträge mit je zwei Links wurden 3’602 Projektionszeilen in rund 20 ms erzeugt (lokaler Node-Test, keine Browser-Messung).

Entscheidungs-/Notiz-Saves verhindern Doppelsubmit, behalten bei Fehler den Entwurf und die ID für einen sicheren erneuten Versuch und übernehmen nach dem Netzwerkaufruf den aktuellen State. Kein offline vorgetäuschtes Erfolgssignal. Projekt→Dossier→Projekt nutzt weiterhin den vorhandenen Return-Callback mit Fokus und Scrollposition.

## Dateien und Begründung

| Datei | Änderung |
| --- | --- |
| `modules/projects.js` | Projektpanels, gezielte Anzeigeupdates, Capture-Launcher, Coach-CTAs, Wissensprojektion und Notiz-Save-Guards; vorhandene CRUD-/Task-/Timeline-Helfer weiterverwendet. |
| `modules/project-workspace-model.js` | Kleine reine Funktionen für Knowledge-Projektion, Filter/Batches, Coach und Entscheidungstext; keine Seiteneffekte. |
| `modules/project-workspace.css` | Auf das Projektdetail begrenzte responsive Styles, bestehende Tokens und Buttons, Sticky-Tabs, 44-px-Aktionen. |
| `modules/dossiers.js` | Bestehende Open-API um explizite Erstellungs-/Composer-/Eintragoptionen erweitert. |
| `modules/dossiers-store.js` | Nur abgeleitetes Loaded-Flag ergänzt; Schreibpfade und Queue unverändert. |
| `index.html`, `service-worker.js` | Modell vor dem Projektmodul laden; neue Assets offline berücksichtigen und Cache-Version anheben. |
| `tests/project-workspace-release.test.cjs` | Neue Projektions-, Lade-, Draft-, Save-, Auth-, Coach- und Navigationsfälle. |
| `tests/project-detail-usability.test.cjs`, `tests/dossiers-store.test.cjs` | Bestehende Harnesses/Assertions an zusätzlichen flüchtigen UI-Zustand bzw. Loaded-Flag angepasst. |
| `tests/service-worker-native-source.test.cjs`, `tests/weekly-list-sync.test.cjs` | Bereits im Ausgangsstand fehlerhafte exakte Versionsvergleiche durch weiterhin verbindliche Mindestversionen ersetzt. |
| `tests/weekly-capture-save.test.cjs` | Bereits fehlerhafte, zeitabhängige Wochenfixture auf ihr Testdatum fixiert; Verhaltenstest bleibt erhalten. |

## Prüfprotokoll und Grenzen

Ausgangsstand: 464 Tests, davon 461 erfolgreich. Drei bestehende Fehler: zwei veraltete Asset-Versionsassertions, eine aufgrund fortgeschrittener Kalenderzeit nicht mehr editierbare Testwoche. Diese Testprobleme wurden ohne Änderungen an den betroffenen Produktfunktionen behoben.

Finaler Hauptlauf: `node --test tests/*.test.cjs`: **478/478 erfolgreich**, 0 Fehler (rund 5 Sekunden). Zusätzlich Syntaxprüfung der geänderten JavaScript-Dateien und gezielte Projekt-/Dossier-Tests. Neue Fälle prüfen unter anderem 0/1/n Dossiers, 1’200 Einträge, mehrere URLs/Duplikate/unsichere Protokolle, Eigentümergrenzen, Tombstones, 20er-Batches, Coach-Guards, Tab-/Formularerhalt, Doppelsubmit, Offlinefehler, Retry-ID, konkurrierende State-Änderungen und Auth-Wechsel während eines Save/Loads.

**Nicht als abgenommen behauptet:** Der automatisierte Browserstart ist in dieser Umgebung nicht verfügbar (kein gebündeltes Playwright-Chromium; installierter Brave-Prozess beendet sich beim Start). Es gibt keinen Zugriff auf ein angemeldetes Supabase-Testkonto. Daher bleiben echte Visual-/Mobile- und Live-Supabase-Checks offen. Die DOM-Interaktionen sind durch isolierte Node-Harnesses geprüft, nicht durch einen echten Browser.

Manuelle Restabnahme: 360/390/430/768/1280 px, hell/dunkel, 200 % Zoom und Smartphone-Tastatur; Erfassung/CRUD mit Testkonto; Hintergrundsync und Offline/Online; Projekt→Dossier→Eintrag→Projekt und Task-Rückkehr; Hard Refresh mit neuem Service Worker; Benutzerwechsel mit laufender Anfrage. Die PDF-Wireframes dienen als Richtung; das bestehende App-Design wurde übernommen.

Der vollständige Quellstand kann nach Veröffentlichung als GitHub-Source-ZIP des Release-Commits heruntergeladen werden. Das Archiv behält alle bisherigen Assets und enthält weder `.git` noch lokale Test-/Browserdateien oder `node_modules`.
