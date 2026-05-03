-- HabitFlow direct Supabase schema
-- Same operating model as FishTrack: the frontend uses the public anon client directly.
-- Important: This creates a shared/global dataset for everyone using this project URL/key.

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
  log_date date not null,
  consumed boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alcohol_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  drink_type text not null default 'other' check (drink_type in ('beer','wine','cocktail','shot','other')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  effort smallint not null default 3 check (effort between 1 and 5),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','done','archived')),
  due_at timestamptz,
  completed_at timestamptz,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


alter table public.habit_definitions drop constraint if exists habit_definitions_type_check;
alter table public.habit_definitions add constraint habit_definitions_type_check check (type in ('number','weight','boolean','duration'));

alter table public.tasks add column if not exists priority text not null default 'medium';
alter table public.tasks drop constraint if exists tasks_priority_check;
alter table public.tasks add constraint tasks_priority_check check (priority in ('low','medium','high','urgent'));
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check check (status in ('open','in_progress','done','archived'));

create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('cigarette','task','habit','bonus','manual')),
  source_id uuid,
  points integer not null,
  reason text,
  earned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Compatibility with the older private/RLS schema: allow direct anon writes by making user_id nullable if those columns already exist.
do $$
declare tbl text;
begin
  foreach tbl in array array['habit_definitions','habit_entries','cigarette_events','alcohol_logs','alcohol_events','tasks','points_ledger'] loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = tbl and column_name = 'user_id'
    ) then
      execute format('alter table public.%I alter column user_id drop not null', tbl);
    end if;
  end loop;
end $$;

create index if not exists idx_habit_entries_time on public.habit_entries(occurred_at desc);
create index if not exists idx_habit_entries_habit_time on public.habit_entries(habit_id, occurred_at desc);
create index if not exists idx_cigarette_events_time on public.cigarette_events(smoked_at desc);
create index if not exists idx_alcohol_logs_date on public.alcohol_logs(log_date desc);
create index if not exists idx_alcohol_events_time on public.alcohol_events(occurred_at desc);
create index if not exists idx_tasks_due on public.tasks(status, due_at);
create index if not exists idx_points_ledger_time on public.points_ledger(earned_at desc);

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

alter table public.habit_definitions enable row level security;
alter table public.habit_entries enable row level security;
alter table public.cigarette_events enable row level security;
alter table public.alcohol_logs enable row level security;
alter table public.alcohol_events enable row level security;
alter table public.tasks enable row level security;
alter table public.points_ledger enable row level security;

-- Remove old private policies if this project previously used Magic-Link auth.
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
drop policy if exists "alcohol_events_select_own" on public.alcohol_events;
drop policy if exists "alcohol_events_insert_own" on public.alcohol_events;
drop policy if exists "alcohol_events_update_own" on public.alcohol_events;
drop policy if exists "alcohol_events_delete_own" on public.alcohol_events;
drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;
drop policy if exists "points_ledger_select_own" on public.points_ledger;
drop policy if exists "points_ledger_insert_own" on public.points_ledger;
drop policy if exists "points_ledger_update_own" on public.points_ledger;
drop policy if exists "points_ledger_delete_own" on public.points_ledger;

drop policy if exists "habit_definitions_direct_public" on public.habit_definitions;
drop policy if exists "habit_entries_direct_public" on public.habit_entries;
drop policy if exists "cigarette_events_direct_public" on public.cigarette_events;
drop policy if exists "alcohol_logs_direct_public" on public.alcohol_logs;
drop policy if exists "alcohol_events_direct_public" on public.alcohol_events;
drop policy if exists "tasks_direct_public" on public.tasks;
drop policy if exists "points_ledger_direct_public" on public.points_ledger;

create policy "habit_definitions_direct_public" on public.habit_definitions for all to anon, authenticated using (true) with check (true);
create policy "habit_entries_direct_public" on public.habit_entries for all to anon, authenticated using (true) with check (true);
create policy "cigarette_events_direct_public" on public.cigarette_events for all to anon, authenticated using (true) with check (true);
create policy "alcohol_logs_direct_public" on public.alcohol_logs for all to anon, authenticated using (true) with check (true);
create policy "alcohol_events_direct_public" on public.alcohol_events for all to anon, authenticated using (true) with check (true);
create policy "tasks_direct_public" on public.tasks for all to anon, authenticated using (true) with check (true);
create policy "points_ledger_direct_public" on public.points_ledger for all to anon, authenticated using (true) with check (true);

-- Optional realtime support for the running app. Ignore notices if a table is already part of the publication.
do $$
declare tbl text;
begin
  foreach tbl in array array['habit_definitions','habit_entries','cigarette_events','alcohol_logs','alcohol_events','tasks','points_ledger'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    exception when others then
      null;
    end;
  end loop;
end $$;
