-- HabitFlow points_ledger duplicate cleanup
-- Run once in Supabase SQL Editor after deploying the app fix.
-- Purpose:
-- 1) Collapse legacy Rauchziel/Tagesbonus rows that synced with source_id = null.
-- 2) Give the remaining deterministic bonus rows a stable UUID source_id.
-- 3) Install a DB-level guard so future Rauchziel/Tagesbonus rows cannot be inserted with source_id = null.
-- 4) Protect future deterministic rows with a partial unique index.

begin;

-- DB guard: canonicalize Rauchziel/Tagesbonus source_id before insert/update.
-- This protects the database even if an old cached client still sends source_id = null.
create or replace function public.canonicalize_points_ledger_source_id()
returns trigger as $$
begin
  if new.source_type = 'bonus'
     and new.reason like 'Rauchziel:%Tagesbonus%'
     and new.earned_at is not null then
    new.source_id := ('00000000-0000-4000-8001-0000' || to_char(new.earned_at::date, 'YYYYMMDD'))::uuid;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists canonicalize_points_ledger_source_id on public.points_ledger;
create trigger canonicalize_points_ledger_source_id
before insert or update of source_type, source_id, reason, earned_at
on public.points_ledger
for each row execute function public.canonicalize_points_ledger_source_id();

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
