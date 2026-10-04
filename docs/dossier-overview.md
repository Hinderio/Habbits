# Dossier overview, entry index and task links

## Deployment

Run sql/add-dossier-overview.sql once in the Supabase SQL editor after the existing
Dossier migrations. It is repeatable and adds icon_key, linked_task_ids, a link
ownership validation trigger and a read-only RLS-respecting aggregate function.
The full sql/add-dossiers.sql now includes these additions for new installations.
The agent has not executed SQL: no database administration connection is available.

Before migration, existing default-icon dossiers and image uploads continue to
sync. Custom icons/task links remain durable local pending changes, with an update
message rather than silently losing fields. Refresh the app after deployment and
use Aktualisieren after running the SQL. Other devices should also reload.

## Behavior

- Six lightweight inline SVG icons: Education, Ferien, Arbeit, Freizeit, Sport,
  Life. Choose under Dossier bearbeiten. Existing dossiers use Life.
- Cards show active entry count and latest dossier/entry modification, including
  deletion activity. Remote summaries cover unopened dossiers without downloading
  bodies or images. Partial offline counts are explicitly labelled lokal.
- Alle Einträge opens a searchable title directory spanning every loaded entry
  page. Opening a dossier fetches all its entries via existing 500-row pagination.
  The directory renders 100 titles initially, offers Weitere Titel, and searches
  the entire collection. A title jumps to its current page and expands/focuses it.
  Entries without titles use their content preview, link hostname or Bild.
- Verknüpfte Tasks allows searching existing tasks, linking, opening and unlinking.
  Task status and project assignment are not modified. One task can belong to
  several dossiers. Up to 100 task references per dossier; options are limited to
  50 matching tasks at a time with search across all locally available tasks.
  Removed/archived tasks remain removable links without opening unavailable data.
- Closing the standard task dialog restores the dossier, focus and scroll without
  rebuilding its forms. Editing a task intentionally navigates to the task editor;
  unsaved dossier drafts prompt before discard. One temporary observer is cleaned
  up on return, navigation and account change.

## Data and performance

The existing app state and persistence/merge pipeline remain authoritative. Icons
and task IDs live on the dossier row, not on task records. Remote task-link writes
validate newly added IDs against tasks owned by the dossier owner. Existing RLS
still controls dossier access. Removing references works after target deletion.
Conflicting dossier edits follow the existing newest-row policy, not set merging.

Counts are derived in memory from local complete entry sets or a paginated SQL
aggregate; there is no persistent second store, extra auth client or subscription.
Account changes clear aggregates. Missing aggregate RPC cannot block normal sync.
Canonical arrays compare by value so acknowledgments keep their previous behavior.
Unchanged snapshots remain cached and unchanged sync performs zero storage writes.
The entry index reuses the active collection sort; image loading stays restricted
to expanded entries on the current page. Existing mobile containment remains.

## Validation

106 automated tests passed, covering the new metrics (including unopened dossiers
and >1000 summaries), title navigation across pages, safe icons, task search and
return behavior, migration fallback, account filtering, offline data, sync races,
image uploads and existing project/persistence behavior. Run node --test tests/*.test.cjs.

Tests use DOM/Supabase boundary mocks. Live SQL/RLS execution and visual checks on
mobile/desktop remain manual because those environments are unavailable here.


## Editing and storage stability (v374)

- The shared persistence object API runs its merge stages even when native Web Storage keeps its prototype methods visible after method assignment. This prevents old app snapshots from replacing saved dossier icons and entries. Existing legacy wrapper fallback remains intact.
- Dossier forms follow remote updates while clean. Draft checks use the version opened for editing, and saves patch only changed fields. Entry editing likewise preserves unrelated background pin/image changes.
- Cards use the same teal outline icons without tiles, right aligned beside the title. Each card reserves one project-link row so metrics and the open action align. Entry actions reuse the app's pencil/trash SVG and color treatments with 44px touch targets and accessible labels.
- No SQL migration or additional listeners, dependencies, data sources, or image requests are introduced by this update.


## Multiple links and mobile layout (v376)

Run sql/add-dossier-entry-links.sql in the Supabase SQL editor once before using multiple links across devices. Fresh installations can use the updated add-dossiers.sql. The migration backfills the existing link, preserves timestamps and adds an ordered text array to the existing entry table. A compatibility trigger mirrors its first item to the original link column and preserves additional links when an older client changes the first link. Existing RLS policies apply unchanged.

Each entry supports additional URL fields via “+ Link hinzufügen”; added fields can be removed individually. Empty fields are ignored, duplicate URLs are consolidated, and every address must use HTTP(S). Existing single-link entries remain editable. Without the migration, single-link syncing continues; multiple links remain saved locally with an explicit sync notice, never silently dropped.

Mobile-only layout rules remove empty header placeholders, align creation/navigation controls, separate sorting from those actions, and place edit/delete alongside collapsed entry summaries. Expanded entries retain full-width text, links and images. Desktop spacing is unchanged. No additional listeners, network requests or libraries are needed.
