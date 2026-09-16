# Analytics read reuse

Daily cigarette, ledger and habit lookups use lazy date/habit indices during a
synchronous dashboard, habits, smoking, calendar or magazine render. Nested
renders share the scope; a `finally` block releases it even if rendering fails.
Outside these scopes helpers read current state. Returned arrays remain caller
owned. No cache relies on array identity or on save/sync invalidation hooks.
Ledger fallback checks all cigarette source IDs, including paused ledger rows,
matching the previous points behavior and preserving summation order.

The latest cigarette uses a linear maximum with stable ties. Malformed timestamps
retain the old sort behavior. Habit overview and cards share the same DNA profiles.

Monthly reviews cache at most the currently displayed archive (12 issues).
Content signatures group relevant visible inputs by local month and include:

- Month day keys and completion status; timezone and offset.
- Cigarettes, points and cross-month ledger fallback membership.
- Fitness sessions, habit logs/definitions, task content, routines, alcohol days,
  and normalized missions.
- Global latest weight, training focus and cover catalog. These are deliberately
  not frozen for historical issues: the existing feature uses current values.

Signatures project large session/task records onto relevant fields, avoiding
serialization of route data or task images. Visibility is reevaluated each render,
so pause edits, imports and in-place sync updates are observed. Review content
is never persisted; offline storage and sync behavior are unchanged. Opening the
reader still computes a fresh review. Historical issues are reused on daily
rollover unless a global dependency changes; the live issue is recomputed.

Validation: `node --test tests/analytics-cache.test.cjs` compares daily results,
review outputs and habit markup with functions saved from main at 73f62f3. It
covers scope cleanup, nested scopes, independent arrays, equal/invalid timestamps,
selective historical invalidation, pauses, moved dates, ledger fallback, missions,
weight goals, training focus, rollover and cache bounds. Tests use a VM and a
minimal DOM; browser/device profiling remains a separate manual check.
