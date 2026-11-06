# Project task and dossier integration

Project arrow controls call the task application's shared ordering function and comparator. Both task backlog arrows and project arrows modify the existing `backlog_rank`, `updated_at` and `synced` fields and use the existing persistence and Supabase task sync. No parallel project rank or database migration is introduced. All incomplete, non-deleted tasks share this ordering; the backlog remains a filtered view. Status, urgency, points and task content are not changed. Existing installations need the same `backlog_rank` database column already required by task backlog arrows.

The project's task list includes associated backlog tasks (whose legacy status value is `archived`), and excludes deleted records. Completed tasks use a native disclosure with session-level expansion state. Status and open/unlink actions have labelled SVG icons, keyboard focus and mobile touch targets. Returning from a task popup refreshes only the linked task region, retaining project context.

Linked dossiers use the existing owner-filtered dossier store. Only headers are synchronized on project opening. Expanding one dossier loads its entries through the existing serialized sync queue, at most once per project opening. The project shows the latest three short text previews per dossier, without image signing/loading. A single subscription exists only while project details are open; preview updates replace only their own region, preserve expansion/focus and never rewrite project forms. Links lead to the existing dossier dialog.

Validation covers shared cross-view ordering, unchanged completion/points/urgency, newer persisted task data, icon accessibility, safe and bounded previews, and duplicate-request prevention, plus existing project return-navigation, task actions, persistence and dossier sync tests. No real-device visual check or authenticated live Supabase operation was available in this environment.

## Dossier return and note links (v381)

Opening a dossier from a project temporarily hides (rather than destroys) the project modal and keeps the Projects view selected. A single explicit dismissal callback restores project context, scroll and focus. Draft cancellation keeps the dossier open; deliberate navigation, task editing and account changes discard the return context. No additional observer or event listener is needed.

Project cards retain one accessible button and display the existing open SVG treatment in their footer. Project notes apply the same HTTP(S)/www link renderer used for task descriptions: escaped text, external links with opener isolation, and preserved line breaks. Long-note snippets remain plain text until expanded so truncated URLs are not turned into incorrect links.
