# Dossier performance (347)

Dossier reads now use the existing persistence parse cache through a read-only
collection projection. Native storage is checked on every access, so writes from
other tabs, removals and account changes do not leave stale snapshots. Dossier
rows are cloned, normalized once per persisted collection and frozen. The full
write/repair pipeline remains in place for saves; no second durable store exists.

Remote headers, upsert acknowledgments and scoped entry pages are reconciled
against the latest durable local state and committed together. Unchanged results
perform no writes. Concurrent identical sync requests share one request; changed
context or local edits can queue a follow-up. Failed later requests retain earlier
acknowledgments, while quota failures leave local pending records available.

Status-only updates reuse cards and image elements. Hidden dossier screens do not
schedule rendering. Visible entries remain paginated at 20. Date formatting uses
one formatter, and dossier-only DOM mutations no longer trigger the unrelated
whole-app task badge scan. Forms and image upload/compression are unchanged.

## Validation

Run `node --test tests/dossiers-store.test.cjs tests/dossiers-ui.test.cjs tests/state-persistence.test.cjs tests/project-badge-render.test.cjs tests/project-detail-usability.test.cjs tests/exhibition.test.cjs`.

81 tests passed, covering persistence, concurrent edits, partial sync failures,
quota failures, account isolation, tombstones, stale app saves, pagination,
acknowledgment-only DOM reuse, hidden panels and existing project/image behavior.

The reproducible synthetic benchmark uses 2,000 dossier entries plus 10,000
unrelated records. For 25 warm snapshots, the prior store performed 25 full JSON
parses (~768 ms in the local run); the updated store performed zero parses and
completed in less than 1 ms. Timing is diagnostic, not a flaky test assertion or a
claim about end-to-end device latency. The old store is retained only as a test
fixture and is not shipped as an application script.

Interactive browser and live Supabase validation were unavailable in the execution
environment. No database migration is required. The service-worker cache version
and dossier asset URLs are bumped to deliver the updated modules.
