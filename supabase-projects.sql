-- HabitFlow project management schema extension
-- Safe to run multiple times after the main supabase.sql schema.

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  start_date date,
  end_date date,
  status text not null default 'planned' check (status in ('planned','active','paused','done')),
  outcome_note text,
  color text not null default '#4ad7d1',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_dates_check check (end_date is null or start_date is null or end_date >= start_date),
  constraint projects_color_check check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create table if not exists public.project_phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'open' check (status in ('open','active','done')),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_phases_dates_check check (end_date >= start_date)
);

create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  phase_id uuid references public.project_phases(id) on delete set null,
  title text not null,
  milestone_date date not null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.projects alter column user_id set default auth.uid();
alter table public.projects add column if not exists description text;
alter table public.projects add column if not exists start_date date;
alter table public.projects add column if not exists end_date date;
alter table public.projects add column if not exists status text not null default 'planned';
alter table public.projects add column if not exists outcome_note text;
alter table public.projects add column if not exists color text not null default '#4ad7d1';
alter table public.projects add column if not exists is_archived boolean not null default false;
alter table public.projects add column if not exists created_at timestamptz not null default now();
alter table public.projects add column if not exists updated_at timestamptz not null default now();
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check check (status in ('planned','active','paused','done'));
alter table public.projects drop constraint if exists projects_dates_check;
alter table public.projects add constraint projects_dates_check check (end_date is null or start_date is null or end_date >= start_date);
alter table public.projects drop constraint if exists projects_color_check;
alter table public.projects add constraint projects_color_check check (color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.project_phases add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.project_phases alter column user_id set default auth.uid();
alter table public.project_phases add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table public.project_phases add column if not exists name text;
alter table public.project_phases add column if not exists start_date date;
alter table public.project_phases add column if not exists end_date date;
alter table public.project_phases add column if not exists status text not null default 'open';
alter table public.project_phases add column if not exists is_archived boolean not null default false;
alter table public.project_phases add column if not exists created_at timestamptz not null default now();
alter table public.project_phases add column if not exists updated_at timestamptz not null default now();
alter table public.project_phases drop constraint if exists project_phases_status_check;
alter table public.project_phases add constraint project_phases_status_check check (status in ('open','active','done'));
alter table public.project_phases drop constraint if exists project_phases_dates_check;
alter table public.project_phases add constraint project_phases_dates_check check (end_date >= start_date);

alter table public.project_milestones add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.project_milestones alter column user_id set default auth.uid();
alter table public.project_milestones add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table public.project_milestones add column if not exists phase_id uuid references public.project_phases(id) on delete set null;
alter table public.project_milestones add column if not exists title text;
alter table public.project_milestones add column if not exists milestone_date date;
alter table public.project_milestones add column if not exists is_archived boolean not null default false;
alter table public.project_milestones add column if not exists created_at timestamptz not null default now();
alter table public.project_milestones add column if not exists updated_at timestamptz not null default now();

alter table public.tasks add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists idx_projects_user_updated on public.projects(user_id, updated_at desc);
create index if not exists idx_project_phases_user_project on public.project_phases(user_id, project_id, start_date);
create index if not exists idx_project_milestones_user_project on public.project_milestones(user_id, project_id, milestone_date);
create index if not exists idx_project_milestones_user_phase on public.project_milestones(user_id, phase_id, milestone_date);
create index if not exists idx_tasks_user_project on public.tasks(user_id, project_id);

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at before update on public.projects for each row execute function public.set_updated_at();

drop trigger if exists set_project_phases_updated_at on public.project_phases;
create trigger set_project_phases_updated_at before update on public.project_phases for each row execute function public.set_updated_at();

drop trigger if exists set_project_milestones_updated_at on public.project_milestones;
create trigger set_project_milestones_updated_at before update on public.project_milestones for each row execute function public.set_updated_at();

do $$
declare
  tbl text;
  pol record;
begin
  foreach tbl in array array['projects','project_phases','project_milestones'] loop
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

grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_phases to authenticated;
grant select, insert, update, delete on public.project_milestones to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.projects;
  exception when others then
    null;
  end;
  begin
    alter publication supabase_realtime add table public.project_phases;
  exception when others then
    null;
  end;
  begin
    alter publication supabase_realtime add table public.project_milestones;
  exception when others then
    null;
  end;
end $$;
