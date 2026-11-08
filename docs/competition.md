# Competition

Personal challenges live under Konsum → Competition. Rauchfrei measures elapsed wall-clock time from the explicit start. Daily challenges (alcohol-free, no bread, meditation, movement, reading, fruit) count confirmed consecutive calendar days in the device's local timezone. Targets, completed attempts and personal bests persist separately from scoring/exclusion pauses. Starting a challenge does not suppress consumption logs or points.

## One-time database setup

Run `sql/add-competition.sql` in the SQL editor of the application's existing Supabase project. It creates `competition_events`, an indexed append-only event log with authenticated own-row SELECT/INSERT policies. No service-role key belongs in the client. The migration is repeatable and does not alter existing consumption tables.

Then open Competition while signed in and click the sync status. It should read **Cloud synchronisiert**. Verify a new challenge appears with the same start time after signing into another device. Test with two different users to confirm that neither can read the other's rows. The database migration and live RLS check require access to that Supabase project; they cannot be completed by the repository-only test suite.

Before the migration or while offline, every action is written to localStorage first. The UI explicitly reports pending sync or missing cloud setup. A failed browser write prevents a successful action. Once the table is available, the next sync uploads pending events without overwriting prior attempts. Local storage alone does not survive clearing browser data; use the Competition export while cloud setup is pending.

## Storage and concurrency

- Events have UUIDs and belong to one account. A separate localStorage key per immutable event prevents parallel tabs from overwriting each other's actions.
- Corrections append new `check` events. Finishes persist their original end timestamp. Data is merged deterministically by event timestamp and UUID. Cloud insert retries ignore duplicate IDs.
- The store paginates incremental pulls (200 rows), uploads batches of 100, and keeps pending writes until acknowledged. Sync runs on activation, mutation, focus, online and cross-tab changes; it has no continuous polling loop.
- Guest records are a separate device-local namespace. They are intentionally not automatically reassigned to a signed-in account. Competition's JSON export is separate from the legacy full-app export.
- UI prevents a second active attempt of the same type on the current device. Simultaneous offline starts on two devices can produce two attempts; both are preserved and can be ended independently.
- Smoke/alcohol observations end relevant attempts, including records synced later. Meditation logs contribute to days unless explicitly overridden by a manual correction. Removing a consumption record after a finish does not erase the saved attempt history.
- Alcohol, bread and legacy sweets attempts are confirmed only after the day ends. Meditation, movement, fruit and reading can be confirmed today. Unconfirmed days never count as success. A gap resets the current strike, retaining the best strike.

## Performance and verification

Competition does not create a live timer before activation. While visible, smoke time updates text once per second; cards refresh only when whole-percent progress or date changes. Timer work stops when leaving the section or hiding the page. Daily-only views check for date rollover once per minute. State reads use the existing parse cache. History initially renders eight attempts; no charting library is added. New assets are included in the service worker.

Run:

```sh
TZ=Europe/Zurich node --test tests/competition-*.test.cjs
node --check app.js
node --check modules/competition.js
node --check service-worker.js
```

Tests cover restart persistence, streak gaps/undo, daylight saving, consumption-triggered finishes, inherited meditation logs, offline retry, missing schema, quota failure, account switching during sync, cross-tab writes, pagination and live timer suspension. Store tests use a Supabase contract mock; UI tests use a minimal DOM harness. They do not replace a browser layout/accessibility check or a live Supabase RLS check.

Manual UI acceptance: desktop and 375px mobile, light/dark themes, all three tabs via mouse and arrow keys, start/check/correct/end/restart, smoke logging through both tabs, reload, offline/online, another device and another account. No horizontal overflow; dialogs should retain keyboard focus and return it on close.

## Personal records and Habit integration (v393)

Hall of Fame displays one positive personal record per active challenge type, preserving independent units (smoke elapsed time versus daily streak days). Retired sweets challenges remain readable and finishable but cannot be restarted; fruit has a new independent type and does not inherit sweets results.

The attempts section uses native details/summary, starts collapsed, and remembers its disclosure state locally across renders and reloads.

Alcohol-free and meditation challenges automatically match an unambiguous active Habit by system key or known name for older attempts. New attempts offer a Habit selector and persist the chosen ID (or explicit manual mode) in the existing start payload. Positive Habit entries are deduplicated by local calendar day and read on state changes; there are no duplicate Habit writes. Alcohol only counts completed days and a consumption log takes precedence. Corrections/removals of Habit entries affect the derived streak; earlier manual challenge overrides are retained. Archived Habits are not offered for new links. A missing linked Habit is shown explicitly.

No additional SQL migration is required for v393: the existing JSON payload supports the selected Habit ID and fruit type. The original competition_events migration is still required for cloud sync.
