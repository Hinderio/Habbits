# HabitFlow

Premium PWA für schlechte Gewohnheiten reduzieren, Zigarettenkonsum tracken, flexible Habits führen, Aufgaben erledigen und Gamification auswerten.

## Enthalten

- Zigaretten-Quick-Button mit Intervallberechnung
- Pausen-basiertes Punktesystem
- Vereinfachte Alkohol-Einheiten-Erfassung mit automatisch gespeichertem Zeitpunkt
- Flexible Habits: Gewicht, Anzahl/Zahl, Ja/Nein, Dauer
- Kompakte Habit-Cards: Details, Logging, DNA und Logs öffnen erst per Tap/Klick
- Meditation-Schnellerfassung mit 7-3-11, Box Breathing, Body Scan, Craving-Welle und Dankbarkeits-Minute
- Aufgaben mit Aufwand 1–5 und Punktebelohnung
- Termine mit Start-/Endzeit, Ort, Typ und Notiz direkt im Kalender
- Dashboard mit KPIs, auswählbarem Trend pro Habit, Heatmap und Insights
- Kalender mit Terminen, Aufgaben, Zigaretten und Alkohol-Kontext; Habit-Verläufe bleiben im Dashboard/Heatmap
- Direkte Supabase-Verbindung über die hinterlegte App-Konfiguration wie bei FishTrack
- Automatischer Sync beim App-Start, nach Aktionen, bei Rückkehr in die App, periodisch und optional per Realtime-Event
- Lokale Offline-Nutzung via localStorage

## Supabase Setup

Die Supabase URL und der Anon Key sind in `supabase-config.js` hinterlegt. Der Anon Key ist für Browser-Apps vorgesehen; die eigentliche Zugriffssicherheit entsteht durch Supabase Auth und Row Level Security.

Diese Version nutzt einen privaten Login mit E-Mail + Passwort. Die App lädt und synchronisiert Supabase-Daten erst nach erfolgreichem Login. Neue Datensätze werden mit `user_id = auth.uid()` gespeichert und die RLS-Policies in `supabase.sql` erlauben Zugriff nur auf die eigenen Rows.

Für ein neues oder bestehendes Supabase-Projekt zuerst `supabase.sql` vollständig im Supabase SQL Editor ausführen. Danach die Schritte in `SECURITY_SETUP.md` befolgen, insbesondere URL Configuration, Passwort festlegen und vorhandene alte Daten einmalig einem Auth-User zuweisen.

## Lokal starten

Da die App eine statische PWA ist, reicht ein kleiner Webserver:

```bash
python3 -m http.server 8080
```

Dann `http://localhost:8080` öffnen.

## Designbasis

Die visuelle Richtung orientiert sich am bereitgestellten FishTrack-ZIP: dunkle Premium-PWA, Glass-Cards, Bottom Navigation, KPI-Hero, ruhige Farbpalette, mobile-first Layout und datengetriebene Panels. Die FishTrack-Fachlogik wurde nicht übernommen.

- Raucher-Analytics erweitert: horizontale Violin-Plot-Visualisierung für Zigaretten-Intervalle (rechts→links lesbar, distributionsfokussiert).

- Deep Smoke Map erweitert: zusätzliche Visuals für Wochentag-Signatur und Wochen-Puls als Ergänzung zur KW-Heatmap.

## Monatsmagazin-Bilder

Magazinbilder liegen direkt im öffentlichen Supabase-Bucket `companion-posters`:
`stage-21.png`, `stage-22.png`, … ohne obere Grenze. PNG, JPG/JPEG, WebP und AVIF
werden unterstützt. Die Stages 1–20 bleiben für den Companion reserviert.

Nach dem Login liest die App alle Seiten der Storage-Dateiliste. Beim erneuten
Rendern des Magazins oder bei Rückkehr in die App wird die Liste nach frühestens
fünf Minuten erneut geladen; ein App-Neustart liest sie ebenfalls neu ein.
Neue Bilder werden in die drei bestehenden Score-Gruppen eingeordnet und für
Titelbilder und Innenseiten verwendet. Derselbe Monat und Score liefern bei
unverändertem Katalog dasselbe Titelbild. Zusätzliche Bilder können auch die
Titelbilder früherer Ausgaben ändern.

Zum Auflisten benötigt der angemeldete Benutzer eine Storage-SELECT-Policy.
Falls diese fehlt, einmal `sql/add-monthly-magazine-covers.sql` im Supabase SQL
Editor ausführen. Sie gewährt ausschliesslich Lesezugriff auf Magazinbild-Dateien
im Poster-Bucket. Bei Ladefehlern oder einer leeren Liste bleibt der zuletzt
geladene Katalog erhalten; beim ersten Start dienen die bisherigen zehn Bilder
als Rückfallauswahl.

Prüfung: `node --test tests/monthly-magazine-covers.test.cjs`.
