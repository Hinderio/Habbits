# HabitFlow

Premium PWA für schlechte Gewohnheiten reduzieren, Zigarettenkonsum tracken, flexible Habits führen, Aufgaben erledigen und Gamification auswerten.

## Enthalten

- Zigaretten-Quick-Button mit Intervallberechnung
- Pausen-basiertes Punktesystem
- Vereinfachte Alkohol-Einheiten-Erfassung mit automatisch gespeichertem Zeitpunkt
- Flexible Habits: Gewicht, Anzahl/Zahl, Ja/Nein, Dauer
- Meditation-Schnellerfassung mit 7-3-11, Box Breathing, Body Scan, Craving-Welle und Dankbarkeits-Minute
- Aufgaben mit Aufwand 1–5 und Punktebelohnung
- Termine mit Start-/Endzeit, Ort, Typ und Notiz direkt im Kalender
- Dashboard mit KPIs, auswählbarem Trend pro Habit, Heatmap und Insights
- Kalender mit Terminen, Aufgaben, Zigaretten und Alkohol-Kontext; Habit-Verläufe bleiben im Dashboard/Heatmap
- Direkte Supabase-Verbindung über die hinterlegte App-Konfiguration wie bei FishTrack
- Automatischer Sync beim App-Start, nach Aktionen, bei Rückkehr in die App, periodisch und optional per Realtime-Event
- Lokale Offline-Nutzung via localStorage

## Supabase Setup

Die Supabase URL und der Anon Key sind in `supabase-config.js` hinterlegt und werden nicht in der App-Oberfläche angezeigt.

Die App arbeitet bewusst wie FishTrack mit direktem anon-client Sync. Das bedeutet: kein Magic-Link-Login, keine Account-Seite und keine Eingabe von Supabase-Zugangsdaten in der UI.

Falls die HabitFlow-Tabellen im Supabase-Projekt noch nicht existieren oder die neue `appointments`-Tabelle für Termine fehlt, `supabase.sql` einmal im Supabase SQL Editor ausführen. Das Schema aktiviert public anon Policies für diese App-Tabellen.

Wichtig: Dieses Modell erzeugt eine gemeinsame globale Datenbasis für alle, die dieselbe App-URL und denselben Supabase anon key nutzen. Für ein späteres privates Multi-User-Produkt sollte wieder RLS mit Login verwendet werden.

## Lokal starten

Da die App eine statische PWA ist, reicht ein kleiner Webserver:

```bash
python3 -m http.server 8080
```

Dann `http://localhost:8080` öffnen.

## Designbasis

Die visuelle Richtung orientiert sich am bereitgestellten FishTrack-ZIP: dunkle Premium-PWA, Glass-Cards, Bottom Navigation, KPI-Hero, ruhige Farbpalette, mobile-first Layout und datengetriebene Panels. Die FishTrack-Fachlogik wurde nicht übernommen.
