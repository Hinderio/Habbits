-- HabitFlow Supabase Schema
-- Ausführen im Supabase SQL Editor.
-- Danach Authentication aktivieren und Magic Link Redirect URL auf die App-URL setzen.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text default 'Europe/Zurich',
  baseline_cigarettes_per_day numeric(8,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habit_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('number','weight','boolean','duration')),
  unit text,
  direction text not null default 'increase' check (direction in ('increase','decrease')),
  target numeric(12,2),
  icon text default '✨',
  color text default '#4ad7d1',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habit_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habit_definitions(id) on delete cascade,
  value_num numeric(12,2),
  value_bool boolean,
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cigarette_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  smoked_at timestamptz not null default now(),
  interval_minutes integer,
  alcohol_context boolean not null default false,
  points integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alcohol_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  consumed boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, log_date)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  effort smallint not null default 3 check (effort between 1 and 5),
  status text not null default 'open' check (status in ('open','done','archived')),
  due_at timestamptz,
  completed_at timestamptz,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('cigarette','task','habit','bonus','manual')),
  source_id uuid,
  points integer not null,
  reason text,
  earned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, source_type, source_id)
);

create index if not exists idx_habit_definitions_user on public.habit_definitions(user_id, is_archived);
create index if not exists idx_habit_entries_user_time on public.habit_entries(user_id, occurred_at desc);
create index if not exists idx_habit_entries_habit_time on public.habit_entries(habit_id, occurred_at desc);
create index if not exists idx_cigarette_events_user_time on public.cigarette_events(user_id, smoked_at desc);
create index if not exists idx_alcohol_logs_user_date on public.alcohol_logs(user_id, log_date desc);
create index if not exists idx_tasks_user_due on public.tasks(user_id, status, due_at);
create index if not exists idx_points_ledger_user_time on public.points_ledger(user_id, earned_at desc);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists set_habit_definitions_updated_at on public.habit_definitions;
create trigger set_habit_definitions_updated_at before update on public.habit_definitions for each row execute function public.set_updated_at();

drop trigger if exists set_habit_entries_updated_at on public.habit_entries;
create trigger set_habit_entries_updated_at before update on public.habit_entries for each row execute function public.set_updated_at();

drop trigger if exists set_cigarette_events_updated_at on public.cigarette_events;
create trigger set_cigarette_events_updated_at before update on public.cigarette_events for each row execute function public.set_updated_at();

drop trigger if exists set_alcohol_logs_updated_at on public.alcohol_logs;
create trigger set_alcohol_logs_updated_at before update on public.alcohol_logs for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.habit_definitions enable row level security;
alter table public.habit_entries enable row level security;
alter table public.cigarette_events enable row level security;
alter table public.alcohol_logs enable row level security;
alter table public.tasks enable row level security;
alter table public.points_ledger enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "habit_definitions_select_own" on public.habit_definitions;
drop policy if exists "habit_definitions_insert_own" on public.habit_definitions;
drop policy if exists "habit_definitions_update_own" on public.habit_definitions;
drop policy if exists "habit_definitions_delete_own" on public.habit_definitions;
drop policy if exists "habit_entries_select_own" on public.habit_entries;
drop policy if exists "habit_entries_insert_own" on public.habit_entries;
drop policy if exists "habit_entries_update_own" on public.habit_entries;
drop policy if exists "habit_entries_delete_own" on public.habit_entries;
drop policy if exists "cigarette_events_select_own" on public.cigarette_events;
drop policy if exists "cigarette_events_insert_own" on public.cigarette_events;
drop policy if exists "cigarette_events_update_own" on public.cigarette_events;
drop policy if exists "cigarette_events_delete_own" on public.cigarette_events;
drop policy if exists "alcohol_logs_select_own" on public.alcohol_logs;
drop policy if exists "alcohol_logs_insert_own" on public.alcohol_logs;
drop policy if exists "alcohol_logs_update_own" on public.alcohol_logs;
drop policy if exists "alcohol_logs_delete_own" on public.alcohol_logs;
drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;
drop policy if exists "points_ledger_select_own" on public.points_ledger;
drop policy if exists "points_ledger_insert_own" on public.points_ledger;
drop policy if exists "points_ledger_update_own" on public.points_ledger;
drop policy if exists "points_ledger_delete_own" on public.points_ledger;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "habit_definitions_select_own" on public.habit_definitions for select using (auth.uid() = user_id);
create policy "habit_definitions_insert_own" on public.habit_definitions for insert with check (auth.uid() = user_id);
create policy "habit_definitions_update_own" on public.habit_definitions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habit_definitions_delete_own" on public.habit_definitions for delete using (auth.uid() = user_id);

create policy "habit_entries_select_own" on public.habit_entries for select using (auth.uid() = user_id);
create policy "habit_entries_insert_own" on public.habit_entries for insert with check (auth.uid() = user_id);
create policy "habit_entries_update_own" on public.habit_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habit_entries_delete_own" on public.habit_entries for delete using (auth.uid() = user_id);

create policy "cigarette_events_select_own" on public.cigarette_events for select using (auth.uid() = user_id);
create policy "cigarette_events_insert_own" on public.cigarette_events for insert with check (auth.uid() = user_id);
create policy "cigarette_events_update_own" on public.cigarette_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cigarette_events_delete_own" on public.cigarette_events for delete using (auth.uid() = user_id);

create policy "alcohol_logs_select_own" on public.alcohol_logs for select using (auth.uid() = user_id);
create policy "alcohol_logs_insert_own" on public.alcohol_logs for insert with check (auth.uid() = user_id);
create policy "alcohol_logs_update_own" on public.alcohol_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "alcohol_logs_delete_own" on public.alcohol_logs for delete using (auth.uid() = user_id);

create policy "tasks_select_own" on public.tasks for select using (auth.uid() = user_id);
create policy "tasks_insert_own" on public.tasks for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on public.tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_delete_own" on public.tasks for delete using (auth.uid() = user_id);

create policy "points_ledger_select_own" on public.points_ledger for select using (auth.uid() = user_id);
create policy "points_ledger_insert_own" on public.points_ledger for insert with check (auth.uid() = user_id);
create policy "points_ledger_update_own" on public.points_ledger for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "points_ledger_delete_own" on public.points_ledger for delete using (auth.uid() = user_id);

create or replace view public.habitflow_daily_kpis with (security_invoker=true) as
select
  user_id,
  day,
  coalesce(sum(cigarettes),0) as cigarettes,
  bool_or(alcohol_consumed) as alcohol_consumed,
  coalesce(sum(tasks_done),0) as tasks_done,
  coalesce(sum(points),0) as points
from (
  select user_id, smoked_at::date as day, count(*)::int as cigarettes, false as alcohol_consumed, 0::int as tasks_done, sum(points)::int as points
  from public.cigarette_events
  group by user_id, smoked_at::date
  union all
  select user_id, log_date as day, 0, bool_or(consumed), 0, 0
  from public.alcohol_logs
  group by user_id, log_date
  union all
  select user_id, coalesce(completed_at, created_at)::date as day, 0, false, count(*) filter (where status='done')::int, sum(points)::int
  from public.tasks
  group by user_id, coalesce(completed_at, created_at)::date
  union all
  select user_id, earned_at::date as day, 0, false, 0, sum(points)::int
  from public.points_ledger
  where source_type not in ('cigarette','task')
  group by user_id, earned_at::date
) x
group by user_id, day;
