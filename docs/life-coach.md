# Dashboard coach

The dashboard uses `modules/life-coach.js` and the scoped `life-coach.css`.
`app.js` supplies its live state only when the modal is open. Lists supply their
in-memory collections through `HabitFlowListsCoach`. The coach does not read,
serialize or write the application cache, request AI services, or add remote
queries. Navigation uses the existing task, habit, calendar and list screens.

The overview shows at most three recommendations. Filters expose all areas,
with eight cards per batch. Hiding a recommendation is temporary and is cleared
on reload or the next local date. No domain records change automatically.

Selection rules:

- Overdue tasks, nearby deadlines and appointments come first. Task horizon is
  seven days; appointment horizon is fourteen. Undated active tasks remain
  available. Birthdays use actual appointment instances, including the existing
  materialized recurrence series.
- Habit history is grouped once by ID. Trends compare distinct active days in
  the two previous complete seven-day windows. False boolean entries do not
  count as active days. Rolling seven- and thirty-day targets are respected;
  weight and reduction goals never produce prompts to increase their values.
- Smoking compares recorded counts in complete seven-day windows. Alcohol
  merges daily records and individual events into distinct consumption dates.
  Missing days remain unknown, and daily intensity is reported as self-recorded.
- Vouchers use their entered expiry date (ISO or Swiss date). Subscription
  contract ends are not presented as cancellation deadlines. Open weekly notes
  exclude promoted and carried notes; other open list collections can resurface.
- Archived/deleted rows and active habit pauses are excluded. Logs inside the
  relevant pause periods are excluded from trend calculations.

No analysis runs while the coach is closed or the document is hidden. Refreshes
coalesce through requestAnimationFrame. Filtering reuses the existing model.
The optional pause timer updates only its text, and its interval stops when the
coach closes, the document is hidden, or the timer ends. The legacy craving
module retains the consumption-screen experience and cannot overwrite this modal.

Validation:

```sh
node --test tests/*.test.cjs
TZ=Europe/Zurich node --test tests/life-coach.test.cjs
node tests/life-coach.bench.cjs
```

Implementation validation: 67 passing tests. Synthetic Node benchmark on the
implementation machine: approximately 5 ms median for 4,045 records and 29 ms
for 30,150 records. This measures analysis, not browser rendering or mobile
hardware. Browser visual/E2E verification could not run in the implementation
environment: the available browser aborted at launch. Verify light/dark themes,
320px mobile layout, keyboard focus, and the actual authenticated dashboard in a
working browser before treating visual QA as complete.
