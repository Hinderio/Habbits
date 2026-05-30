# HabitFlow Modularization Roadmap

HabitFlow is a static GitHub Pages app. The safe path is incremental: keep `app.js` active, add clear module boundaries, and move only small pure helpers when a feature is touched anyway.

## Data ownership

- Supabase after login is the primary data source.
- Local storage is cache and UI persistence.
- Cached values must not overwrite fresher remote rows without an explicit merge rule.
- Sync changes should be timestamp-aware and easy to review.

## Current shell

The browser now loads `window.HabitFlowModules` before `app.js`. The shell registers future boundaries for:

- `state`
- `sync`
- `dashboard`
- `habits`
- `tasks`
- `fitness`
- `consumption`
- `gamification`
- `monthly-missions`

Existing runtime behavior stays in `app.js`.

## Recommended extraction order

1. Readonly constants and catalogs.
2. Pure date, format and scoring helpers.
3. DOM anchor contracts and small render helpers.
4. Feature event handlers only after their state flow is fully understood.
5. Sync and write paths last.

## Regression checks

Before each extraction, check login, navigation, dashboard KPIs, charts, weekly review, habits, tasks, fitness, consumption, calendar, mobile layout, desktop layout, refresh behavior and PWA cache updates.
