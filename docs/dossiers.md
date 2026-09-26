# Dossiers within Projects

The Projects navigation item now contains an accessible Projects / Dossiers switch.
Only one panel is visible. Existing project DOM, handlers and task dialogs remain
in place. A linked project and dossier are independent; deleting a dossier does
not delete the project. Project deletion clears the remote link via `ON DELETE
SET NULL`; an unavailable local project is simply not shown as a link.

## One-time deployment step

After deploying the files, run `sql/add-dossiers.sql` in this installation's
Supabase SQL editor, after the existing project migration. It creates two tables,
owner-scoped RLS policies, indexes, newest-row/tombstone triggers and a **private**
`dossier-images` bucket. It does not alter existing project or list data.
The migration is repeatable. It has not been executed by the coding agent: this
workspace has no Supabase administration/database connection.

Before this step, text changes can be stored locally after login, but cloud sync
reports that Dossier sync is not configured. Image upload is deliberately blocked
until the dossier has reached Supabase. Existing project sync remains independent.

## Storage and sync

- `modules/dossiers-store.js` registers one stage in `HabitFlowPersistence` and
  uses only the existing `habitflow-state-v1` key (`dossiers`, `dossierEntries`).
  No second feature database, localStorage mirror or additional auth client.
- The app exposes its existing Supabase client and user ID via `HabitFlowRemote`.
  A user-change event invalidates image URLs and closes/reset drafts. All feature
  reads, writes, uploads, queries and exports are scoped to that user.
- Text/link changes persist locally before notifying the UI. Quota failures leave
  the draft intact. Dirty rows retry on view open, manual refresh, reconnect,
  visibility resume or another save. Concurrent sync requests share one runner.
- Headers are pulled in pages of 500 before dirty rows are pushed in batches of
  100. Entry downloads are scoped to the opened dossier; all cached entries stay
  available offline. The database's standard 1,000-row response limit does not
  truncate collections. Soft-deletion tombstones are merged, not dropped.
- Timestamps use newest-row wins, and archived records cannot be resurrected by
  stale devices. As with the existing app, this is not collaborative text merging;
  simultaneous text edits resolve to the newest timestamp.
- Backup export includes fresh dossier metadata and all locally cached entries,
  including tombstones. It is not a complete remote archive if a dossier has never
  been opened on this device, and it does not embed the private image files.

## Images and rendering

The **unchanged** `HabitFlowExhibition.optimize` is reused: JPEG/PNG/WebP input,
20 MB input cap, 60 MP decode cap, at most 1440 px on the longest edge, progressive
WebP/JPEG compression. Its temporary result is immediately converted to a Blob.
Dossiers upload at most 135,000 bytes per image. Only an owner/dossier/UUID path is
saved; Blob previews, Base64 and expiring signed URLs are never feature state.
One image per entry; create additional entries for additional images.

The private bucket uses owner-scoped access. Visible entries request signed URLs
in a batch, cached only in memory (one hour, at most 100 URLs). Images decode
asynchronously and load lazily. Each overview/detail page contains at most 20
cards. Sync/status changes do not rebuild forms or unchanged entry lists. The
preview object URL is revoked when replaced, cancelled, saved or the user changes.

Removal is a soft deletion. Image objects for deleted entries/dossiers and replaced
images remain in the private bucket; this preserves references held by offline
clients. If storage reclamation is needed, use an administrative retention job
that compares object paths against live `dossier_entries.image_path` and active
parent dossiers, observes a grace period for offline edits, and deletes through
the Storage API. Never delete objects by directly deleting `storage.objects` rows.

## Validation

Run:

```
node --test tests/dossiers-store.test.cjs tests/dossiers-ui.test.cjs \
  tests/project-detail-usability.test.cjs tests/project-badge-render.test.cjs \
  tests/exhibition.test.cjs
```

These cover persistence, dirty write retries, timestamp conflicts, user changes,
pagination, image constraints, escaped rendering and existing behavior. They use
mocked Supabase/DOM boundaries, not a real database or a layout engine.

Manual release checks (desktop and 390 px mobile, light and dark themes):

1. Switch both ways, create/edit a project and open/close a linked task. Preserve
   project detail/scroll behavior and verify only one switch panel is visible.
2. Create a dossier, optionally link a project; add text-only, link-only,
   image-only and combined entries. Pin/unpin, edit, delete and paginate.
3. Close by Escape and X; preserve unsaved drafts when cancelling the prompt.
   Keyboard navigation must remain inside the native dialog and return to its
   opener. Test tabs with arrows, Home and End.
4. Save text offline, reload, reconnect and verify it appears on another device.
   Confirm an image upload error keeps its draft; sign out during an upload.
5. Verify authenticated user B cannot read/write user A's rows, sign image URLs
   or upload into A's folder. Anonymous access must fail for tables and images.
6. Create over 1,000 records, open a dossier and verify all records can be paged.
   Check that localStorage contains paths only, never `data:image` payloads.

A visual browser run and live SQL/RLS tests were not possible in the agent's
restricted environment. The installed Brave process aborts on launch.
