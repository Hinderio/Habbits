# HabitFlow Zugriffssicherheit einrichten

Diese Version nutzt ein simples, aber echtes Sicherheitsmodell für GitHub Pages:

- Die App bleibt statisch hostbar.
- Der Supabase Anon Key darf im Browser liegen.
- Sensible Daten werden erst nach Supabase Auth Login gelesen/geschrieben.
- Row Level Security filtert jede relevante Tabelle auf `user_id = auth.uid()`.

## 1. Supabase SQL anwenden

1. Supabase Dashboard öffnen.
2. SQL Editor öffnen.
3. Inhalt von `supabase.sql` vollständig ausführen.

Das Script entfernt alte `direct_public`/unrestricted Policies, ergänzt `user_id` und erstellt private RLS-Policies.

## 2. Eigenen Auth-User erstellen

Für eine private persönliche App ist am einfachsten:

1. Supabase Dashboard → Authentication → Users.
2. Eigenen User erstellen oder einladen.
3. Authentication → Providers / Email prüfen: Magic Link muss aktiv sein.
4. Authentication → URL Configuration: GitHub-Pages-URL als Site URL und Redirect URL eintragen.
5. Authentication → Signups deaktivieren, wenn nur du Zugriff haben sollst.

## 3. Bestehende Daten übernehmen

Wenn bereits Daten aus der alten unrestricted Version existieren, gibt es zwei Wege:

### Weg A: App mit lokalem Cache öffnen

Wenn dein Browser noch die lokalen Daten hat, nach Login einmal synchronisieren. Die App schreibt die vorhandenen lokalen Rows mit deiner `user_id` zurück.

### Weg B: Manuell per SQL claimen

Wenn du auf einem neuen Gerät keinen lokalen Cache mehr hast, nimm deine User-ID aus Authentication → Users und führe danach aus:

```sql
update public.habit_definitions set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.habit_entries set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.cigarette_events set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.alcohol_logs set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.alcohol_events set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.tasks set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.appointments set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.points_ledger set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
```

## 4. Prüfen

- App öffnen: Login-Gate muss erscheinen.
- Magic-Link anfordern und öffnen.
- Sync-Seite zeigt den angemeldeten User.
- Neue Einträge speichern und in Supabase prüfen: `user_id` muss gesetzt sein.
- In Supabase Table Editor sollten die bisherigen `UNRESTRICTED`-Hinweise für die gesicherten Tabellen verschwinden.

## Hinweis

Der App-Code selbst ist bei GitHub Pages weiterhin öffentlich. Das ist normal. Geschützt werden die Daten über Supabase Auth und RLS, nicht über versteckte Frontend-Secrets.
