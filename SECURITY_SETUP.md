# HabitFlow Zugriffssicherheit mit E-Mail + Passwort

Diese Version nutzt ein bewusst simples Sicherheitsmodell für GitHub Pages:

- Die App bleibt eine statische PWA.
- Die Supabase URL und der Anon Key dürfen im Browser liegen.
- Login läuft über Supabase Auth mit E-Mail und Passwort.
- Sensible Daten werden erst nach Login gelesen/geschrieben.
- Row Level Security filtert relevante Tabellen auf `user_id = auth.uid()`.
- Die App enthält keinen Sign-up-Flow. Neue User werden also nicht aus der App heraus angelegt.

## 1. Code hochladen

1. Dieses ZIP lokal entpacken.
2. Den entpackten Inhalt ins GitHub-Repo kopieren.
3. Nicht nötig ins Repo gehören:
   - die ZIP-Datei selbst
   - `node_modules`
   - `.git` aus anderen Kopien
   - lokale Cache- oder Temp-Ordner
4. Committen und auf GitHub Pages deployen.

Wichtig: Nach dem Upload auf dem iPhone einmal hart neu laden oder die gespeicherte App neu öffnen, weil der Service Worker absichtlich auf `habitflow-v37-password-auth` erhöht wurde.

## 2. Supabase SQL ausführen

1. Supabase Dashboard öffnen.
2. SQL Editor öffnen.
3. Den gesamten Inhalt von `supabase.sql` ausführen.

Das Script:

- ergänzt `user_id`, falls noch nicht vorhanden,
- aktiviert RLS,
- entfernt alte `direct_public` / unrestricted Policies,
- erstellt private Policies pro User,
- setzt sinnvolle Indizes für Sync/Listen.

## 3. Supabase Auth konfigurieren

### 3.1 Email Provider prüfen

In Supabase:

```text
Authentication → Configuration → Sign In / Providers → Email
```

Prüfen:

```text
Enable email provider: ON
```

Das reicht für E-Mail/Passwort-Login.

### 3.2 Redirect URL prüfen

Für den normalen Passwort-Login ist keine Weiterleitung nötig. Für `Passwort festlegen oder vergessen?` aber schon.

In Supabase:

```text
Authentication → Configuration → URL Configuration
```

Setzen:

```text
Site URL:
https://DEINNAME.github.io/DEIN-REPO/
```

Zusätzlich bei Redirect URLs eintragen:

```text
https://DEINNAME.github.io/DEIN-REPO/
https://DEINNAME.github.io/DEIN-REPO/index.html
https://DEINNAME.github.io/DEIN-REPO/**
```

Wenn du lokal testest, zusätzlich:

```text
http://localhost:8080/
http://localhost:8080/**
```

`http://localhost:3000` ist für diese GitHub-Pages-App nicht nötig und war der Grund, warum frühere Links falsch gelandet sind.

### 3.3 Neue Signups einschränken

Für eine private persönliche App ideal:

```text
Authentication → Configuration → General / User Signups
Allow new users to sign up: OFF
```

Falls du diesen Schalter in deiner Supabase-Oberfläche nicht findest: Die App selbst ruft kein `signUp()` auf. Fremde können dadurch nicht über die App einen Account erstellen. RLS schützt deine Daten trotzdem, selbst wenn ein fremder User im Projekt existieren würde.

## 4. Passwort für deinen bestehenden User setzen

Wenn dein User vorher per Magic Link erstellt wurde, hat er eventuell noch kein Passwort. Dann einmalig so vorgehen:

1. Neue App öffnen.
2. Falls du durch die alte Session bereits eingeloggt bist: `Settings / Supabase Auth → Abmelden` klicken.
3. Auf dem Login-Screen deine E-Mail-Adresse eintragen.
4. Auf `Passwort festlegen oder vergessen?` klicken.
5. E-Mail öffnen.
6. Den Passwort-Link öffnen.
7. In der App ein neues Passwort zweimal eingeben.
8. `Passwort speichern` klicken.
9. Danach normal mit E-Mail + Passwort einloggen.

Hinweis für iPhone/PWA: Der Passwort-Link kann sich einmalig im Browser statt in der gespeicherten App öffnen. Das ist okay. Nach dem Speichern des Passworts öffnest du wieder die gespeicherte HabitFlow-App und loggst dich dort mit E-Mail + Passwort ein.

Danach brauchst du keine Magic Links mehr für den Alltag.

Auf dem iPhone empfiehlt sich:

- Passwort in iCloud Schlüsselbund speichern.
- Beim Login Face ID / AutoFill nutzen.
- Nicht ausloggen, wenn du die Session behalten möchtest.

## 5. Bestehende Daten übernehmen

Wenn deine alten Daten schon in Supabase liegen und noch keine `user_id` haben, müssen sie einmal deinem Auth-User zugewiesen werden.

Deine User-ID findest du hier:

```text
Authentication → Users → deinen User öffnen/kopieren → UID
```

Dann im SQL Editor ausführen und `<YOUR_AUTH_USER_ID>` ersetzen:

```sql
update public.habit_definitions set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.habit_entries set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.cigarette_events set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.alcohol_logs set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.alcohol_events set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.tasks set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.appointments set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.points_ledger set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;

update public.participants set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.catches set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.duels set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.duel_events set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.duel_participants set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.duel_tracks set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
update public.tournaments set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
```

## 6. End-to-End-Test

Nach Deploy und Supabase-Konfiguration:

1. App öffnen.
2. Login-Gate muss erscheinen.
3. Mit E-Mail + Passwort einloggen.
4. In `Settings / Supabase Auth` prüfen: `Angemeldet als ...`.
5. Eine Zigarette testweise speichern.
6. In Supabase `cigarette_events` prüfen:
   - neue Zeile vorhanden,
   - `user_id` ist deine UID.
7. Zigarette in der App löschen.
8. App refreshen.
9. Prüfen: gelöschte Zigarette bleibt gelöscht.
10. Dasselbe einmal mit einem Habit-Eintrag und einer Aufgabe testen.

## 7. Was bewusst nicht gemacht wurde

- Kein eigener Backend-Server.
- Keine neue Library.
- Kein hart codiertes App-Passwort.
- Kein Service-Role-Key im Frontend.
- Keine Datenbank-Secrets im Repo.

Die Sicherheit entsteht durch Supabase Auth + RLS, nicht durch versteckten Frontend-Code.
