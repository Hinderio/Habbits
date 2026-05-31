-- HabitFlow points_ledger duplicate cleanup
-- Keeps one row per user/source_type/source_id and removes duplicate daily bonus rows caused by old NULL source_id syncs.
-- Run once in Supabase SQL Editor after deploying the app fix.

begin;

-- 1) Remove duplicate rows where source_id is already present.
--    Keeps the newest created row for each logical source.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, source_type, source_id
      order by created_at desc, earned_at desc, id desc
    ) as rn
  from public.points_ledger
  where source_id is not null
)
delete from public.points_ledger p
using ranked r
where p.id = r.id
  and r.rn > 1;

-- 2) Remove old duplicate smoke daily bonus rows that synced with source_id = null.
--    These are identifiable by the German reason text, for example:
--    "Rauchziel: 7 Zigaretten · +80 Tagesbonus".
--    Keeps only the newest row per user/day/reason/points bucket.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, source_type, earned_at::date, reason, points
      order by created_at desc, id desc
    ) as rn
  from public.points_ledger
  where source_type = 'bonus'
    and source_id is null
    and reason like 'Rauchziel:%Tagesbonus%'
)
delete from public.points_ledger p
using ranked r
where p.id = r.id
  and r.rn > 1;

-- 3) Protect all future deterministic ledger rows.
create unique index if not exists idx_points_ledger_user_source_unique
  on public.points_ledger(user_id, source_type, source_id)
  where source_id is not null;

commit;
