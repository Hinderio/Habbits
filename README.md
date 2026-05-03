# HabitFlow

Premium PWA für schlechte Gewohnheiten reduzieren, Zigarettenkonsum tracken, flexible Habits führen, Aufgaben erledigen und Gamification auswerten.

## Enthalten

- Zigaretten-Quick-Button mit Intervallberechnung
- Pausen-basiertes Punktesystem
- Alkohol-Tages-Toggle
- Flexible Habits: Gewicht, Anzahl/Zahl, Ja/Nein, Dauer
- Meditation-Schnellerfassung mit 7-3-11, Box Breathing, Body Scan, Craving-Welle und Dankbarkeits-Minute
- Aufgaben mit Aufwand 1–5 und Punktebelohnung
- Dashboard mit KPIs, auswählbarem Trend pro Habit, Heatmap und Insights
- Kalender mit Aufgaben, Zigaretten und Alkohol-Kontext; Habit-Verläufe bleiben im Dashboard/Heatmap
- Supabase Magic-Link Login und Sync mit hinterlegter App-Konfiguration
- Lokale Offline-Nutzung via localStorage
- SQL-Schema mit RLS Policies

## Supabase Setup

Die Supabase URL und der Anon Key sind in `supabase-config.js` hinterlegt und werden nicht mehr in der App-Oberfläche angezeigt.

1. `supabase.sql` im Supabase SQL Editor ausführen, falls das HabitFlow-Schema im Zielprojekt noch nicht existiert.
2. In Supabase Authentication Magic Link aktivieren.
3. Redirect URL auf die gehostete App-URL setzen.
4. App öffnen, unter Konto die E-Mail eintragen und Magic Link senden.
5. Nach Login synchronisiert die App automatisch; zusätzlich kann der Sync-Button manuell genutzt werden.

Wichtig: Der Supabase Anon Key ist bei statischen Frontend-Apps technisch öffentlich, aber durch RLS-Policies geschützt. Niemals einen Service-Role-Key in dieses Projekt legen.

## Lokal starten

Da die App eine statische PWA ist, reicht ein kleiner Webserver:

```bash
python3 -m http.server 8080
```

Dann `http://localhost:8080` öffnen.

## Designbasis

Die visuelle Richtung orientiert sich am bereitgestellten FishTrack-ZIP: dunkle Premium-PWA, Glass-Cards, Bottom Navigation, KPI-Hero, ruhige Farbpalette, mobile-first Layout und datengetriebene Panels. Die FishTrack-Fachlogik wurde nicht übernommen.
