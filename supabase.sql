-- HabitFlow private Supabase schema
-- Security model: browser app uses the public anon key, but all sensitive rows require Supabase Auth + RLS.
-- Recommended for this personal app: create/invite your own Auth user and disable public signups in Supabase Auth settings.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.habit_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('number','weight','boolean','duration')),
  unit text,
  direction text not null default 'increase' check (direction in ('increase','decrease')),
  target numeric(12,2),
  target_period text not null default 'day' check (target_period in ('day','week','month')),
  icon text default '✨',
  color text default '#4ad7d1',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habit_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id uuid references public.habit_definitions(id) on delete set null,
  value_num numeric(12,2),
  value_bool boolean,
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cigarette_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
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
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  log_date date not null,
  consumed boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alcohol_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  drink_type text not null default 'other' check (drink_type in ('beer','wine','cocktail','shot','other')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  effort smallint not null default 3 check (effort between 1 and 5),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','done','archived')),
  due_at timestamptz,
  completed_at timestamptz,
  points integer not null default 0,
  backlog_rank numeric(12,4),
  done_archived_at timestamptz,
  done_archive_rank numeric(12,4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  location text,
  appointment_type text not null default 'other' check (appointment_type in ('personal','work','health','social','admin','other')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_time_check check (ends_at is null or ends_at >= starts_at)
);

create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('cigarette','task','habit','bonus','manual')),
  source_id uuid,
  points integer not null,
  reason text,
  earned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Compatible upgrades for existing HabitFlow installs.
alter table public.habit_definitions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.habit_entries add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.cigarette_events add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.alcohol_logs add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.alcohol_events add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.tasks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.appointments add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.points_ledger add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.habit_definitions alter column user_id set default auth.uid();
alter table public.habit_entries alter column user_id set default auth.uid();
alter table public.cigarette_events alter column user_id set default auth.uid();
alter table public.alcohol_logs alter column user_id set default auth.uid();
alter table public.alcohol_events alter column user_id set default auth.uid();
alter table public.tasks alter column user_id set default auth.uid();
alter table public.appointments alter column user_id set default auth.uid();
alter table public.points_ledger alter column user_id set default auth.uid();

alter table public.appointments add column if not exists description text;
alter table public.appointments add column if not exists location text;
alter table public.appointments add column if not exists appointment_type text not null default 'other';
alter table public.appointments add column if not exists starts_at timestamptz not null default now();
alter table public.appointments add column if not exists ends_at timestamptz;
alter table public.appointments add column if not exists created_at timestamptz not null default now();
alter table public.appointments add column if not exists updated_at timestamptz not null default now();
alter table public.appointments drop constraint if exists appointments_type_check;
alter table public.appointments add constraint appointments_type_check check (appointment_type in ('personal','work','health','social','admin','other'));
alter table public.appointments drop constraint if exists appointments_time_check;
alter table public.appointments add constraint appointments_time_check check (ends_at is null or ends_at >= starts_at);

alter table public.habit_definitions add column if not exists target_period text not null default 'day';
alter table public.habit_definitions drop constraint if exists habit_definitions_target_period_check;
alter table public.habit_definitions add constraint habit_definitions_target_period_check check (target_period in ('day','week','month'));
alter table public.habit_definitions drop constraint if exists habit_definitions_type_check;
alter table public.habit_definitions add constraint habit_definitions_type_check check (type in ('number','weight','boolean','duration'));

alter table public.tasks add column if not exists priority text not null default 'medium';
alter table public.tasks add column if not exists backlog_rank numeric(12,4);
alter table public.tasks add column if not exists done_archived_at timestamptz;
alter table public.tasks add column if not exists done_archive_rank numeric(12,4);
alter table public.tasks drop constraint if exists tasks_priority_check;
alter table public.tasks add constraint tasks_priority_check check (priority in ('low','medium','high','urgent'));
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check check (status in ('open','in_progress','done','archived'));

-- If you already have rows from the old unrestricted setup, run this once after creating your Auth user:
-- update public.habit_definitions set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
-- update public.habit_entries set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
-- update public.cigarette_events set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
-- update public.alcohol_logs set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
-- update public.alcohol_events set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
-- update public.tasks set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
-- update public.appointments set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;
-- update public.points_ledger set user_id = '<YOUR_AUTH_USER_ID>' where user_id is null;

create index if not exists idx_habit_definitions_user on public.habit_definitions(user_id, updated_at desc);
create index if not exists idx_habit_entries_user_time on public.habit_entries(user_id, occurred_at desc);
create index if not exists idx_habit_entries_habit_time on public.habit_entries(habit_id, occurred_at desc);
create index if not exists idx_cigarette_events_user_time on public.cigarette_events(user_id, smoked_at desc);
create index if not exists idx_alcohol_logs_user_date on public.alcohol_logs(user_id, log_date desc);
create index if not exists idx_alcohol_events_user_time on public.alcohol_events(user_id, occurred_at desc);
create index if not exists idx_tasks_user_due on public.tasks(user_id, status, due_at);
create index if not exists idx_tasks_user_done_archive on public.tasks(user_id, done_archived_at desc, done_archive_rank);
create index if not exists idx_appointments_user_starts_at on public.appointments(user_id, starts_at desc);
create index if not exists idx_appointments_type_starts_at on public.appointments(user_id, appointment_type, starts_at desc);
create index if not exists idx_points_ledger_user_time on public.points_ledger(user_id, earned_at desc);

drop trigger if exists set_habit_definitions_updated_at on public.habit_definitions;
create trigger set_habit_definitions_updated_at before update on public.habit_definitions for each row execute function public.set_updated_at();

drop trigger if exists set_habit_entries_updated_at on public.habit_entries;
create trigger set_habit_entries_updated_at before update on public.habit_entries for each row execute function public.set_updated_at();

drop trigger if exists set_cigarette_events_updated_at on public.cigarette_events;
create trigger set_cigarette_events_updated_at before update on public.cigarette_events for each row execute function public.set_updated_at();

drop trigger if exists set_alcohol_logs_updated_at on public.alcohol_logs;
create trigger set_alcohol_logs_updated_at before update on public.alcohol_logs for each row execute function public.set_updated_at();

drop trigger if exists set_alcohol_events_updated_at on public.alcohol_events;
create trigger set_alcohol_events_updated_at before update on public.alcohol_events for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at before update on public.appointments for each row execute function public.set_updated_at();

-- Remove all old public/unrestricted policies and create strict owner policies.
do $$
declare
  tbl text;
  pol record;
begin
  foreach tbl in array array[
    'habit_definitions','habit_entries','cigarette_events','alcohol_logs','alcohol_events','tasks','appointments','points_ledger',
    'participants','catches','duels','duel_events','duel_participants','duel_tracks','tournaments'
  ] loop
    if to_regclass(format('public.%I', tbl)) is null then
      continue;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl and column_name = 'user_id'
    ) then
      execute format('alter table public.%I add column user_id uuid references auth.users(id) on delete cascade', tbl);
    end if;

    execute format('alter table public.%I alter column user_id set default auth.uid()', tbl);
    execute format('alter table public.%I enable row level security', tbl);
    execute format('alter table public.%I force row level security', tbl);

    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = tbl loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
    end loop;

    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', tbl || '_select_own', tbl);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', tbl || '_insert_own', tbl);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid()) or user_id is null) with check (user_id = (select auth.uid()))', tbl || '_update_own', tbl);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', tbl || '_delete_own', tbl);
  end loop;
end $$;

-- Profiles often use id = auth.uid(); support that shape without forcing a migration.
do $$
declare pol record;
begin
  if to_regclass('public.profiles') is not null then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'user_id'
    ) then
      alter table public.profiles add column user_id uuid references auth.users(id) on delete cascade;
    end if;

    alter table public.profiles enable row level security;
    alter table public.profiles force row level security;

    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
      execute format('drop policy if exists %I on public.profiles', pol.policyname);
    end loop;

    create policy profiles_select_own on public.profiles
      for select to authenticated
      using (id = (select auth.uid()) or user_id = (select auth.uid()));

    create policy profiles_insert_own on public.profiles
      for insert to authenticated
      with check (id = (select auth.uid()) or user_id = (select auth.uid()));

    create policy profiles_update_own on public.profiles
      for update to authenticated
      using (id = (select auth.uid()) or user_id = (select auth.uid()))
      with check (id = (select auth.uid()) or user_id = (select auth.uid()));

    create policy profiles_delete_own on public.profiles
      for delete to authenticated
      using (id = (select auth.uid()) or user_id = (select auth.uid()));
  end if;
end $$;

-- Minimize accidental API exposure for anonymous table access. Auth endpoints continue to work.
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Optional realtime support; app subscriptions are additionally filtered by user_id.
do $$
declare tbl text;
begin
  foreach tbl in array array['habit_definitions','habit_entries','cigarette_events','alcohol_logs','alcohol_events','tasks','appointments','points_ledger'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    exception when others then
      null;
    end;
  end loop;
end $$;

-- If the analytics view exists, make it respect caller permissions where supported.
do $$
begin
  if to_regclass('public.habitflow_daily_kpis') is not null then
    begin
      execute 'alter view public.habitflow_daily_kpis set (security_invoker = true)';
    exception when others then
      null;
    end;
  end if;
end $$;
