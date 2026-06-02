-- HabitFlow points_ledger duplicate cleanup
-- Run once in Supabase SQL Editor after deploying the app fix.
-- Purpose:
-- 1) Collapse legacy Rauchziel/Tagesbonus rows that synced with source_id = null.
-- 2) Give the remaining deterministic bonus rows a stable UUID source_id.
-- 3) Protect future deterministic rows with a partial unique index.

begin;

-- 1) Delete duplicate smoke daily bonus rows first.
-- Keeps the newest/final row per user/day. This also removes older same-day
-- intermediate bonuses like +110, +100, +90, etc. for the same smoke day.
with smoke_daily as (
  select
    id,
    row_number() over (
      partition by user_id, earned_at::date
      order by created_at desc, earned_at desc, id desc
    ) as rn
  from public.points_ledger
  where source_type = 'bonus'
    and reason like 'Rauchziel:%Tagesbonus%'
)
delete from public.points_ledger p
using smoke_daily s
where p.id = s.id
  and s.rn > 1;

-- 2) Canonicalize the remaining old smoke daily bonus rows.
-- Legacy rows can have source_id = null because older app code could not persist
-- string source IDs into the uuid source_id column. We key them by smoke day.
with smoke_daily as (
  select
    id,
    ('00000000-0000-4000-8001-0000' || to_char(earned_at::date, 'YYYYMMDD'))::uuid as canonical_source_id
  from public.points_ledger
  where source_type = 'bonus'
    and reason like 'Rauchziel:%Tagesbonus%'
)
update public.points_ledger p
set source_id = s.canonical_source_id
from smoke_daily s
where p.id = s.id
  and p.source_id is distinct from s.canonical_source_id;

-- 3) Remove duplicate rows where source_id is already deterministic.
-- Keeps the newest row for each logical source.
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

-- 4) Protect all future deterministic ledger rows.
create unique index if not exists idx_points_ledger_user_source_unique
  on public.points_ledger(user_id, source_type, source_id)
  where source_id is not null;

commit;
