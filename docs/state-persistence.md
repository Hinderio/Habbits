# State persistence

`modules/state-persistence.js` loads before the storage normalizers. App saves
and project writes pass an object to `HabitFlowPersistence.writeState`. Smoking,
alcohol, ledger and project modules register transformations instead of nesting
JSON wrappers. The pipeline serializes the result once, then writes synchronously
to the existing `habitflow-state-v1` localStorage key.

Compatibility and ownership:

- Existing string-based `getItem`/`setItem` callers remain supported. Read stages
  run in registration order; write stages run in reverse order, as in the former
  wrapper chain. Other storage keys retain native behavior.
- Project merging still reads the latest persisted snapshot, including project
  tombstones and explicit task unlink markers.
- The in-memory cache owns a parsed storage snapshot, not the caller's live state.
  Each read checks the native storage string, so another tab, direct native write,
  removal or clear cannot leave the snapshot stale. Transformations use copies
  of changed branches and do not mutate the cached snapshot.
- Time-sensitive normalization still runs on reads. Only verified smoking values
  from successful writes bypass duplicate smoking normalization, preserving the
  previous app-save contract.
- Ledger repairs still persist on reads. Unchanged canonical rows keep their
  identity and no longer trigger a repair or misleading changed-source statistics.
- Quota/write errors propagate. The successful-write marker changes only after
  native storage accepts the write. Pending rows and deletion tombstones retain
  their previous format; no asynchronous flush or IndexedDB migration is involved.
- When the new module is unavailable, modules retain their legacy wrappers. If
  any old wrapper remains installed during a partial asset update, object writes
  route through the active storage chain rather than bypassing it.

Regression coverage: `node --test tests/state-persistence.test.cjs`. This loads
the actual normalizer modules with a simulated Storage/DOM shell and checks
preservation, legacy repairs, unlinking, other-tab writes, failures, reopening,
time-dependent aggregates, optional remote authority and large-state JSON counts.
It is not a real browser/offline end-to-end test.
