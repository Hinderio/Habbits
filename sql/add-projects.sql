-- HabitFlow Project Tab schema extension
-- Run after the base supabase.sql. Additive and safe for existing installs.

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
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_time_check check (end_date is null or start_date is null or end_date >= start_date)
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
  constraint project_phases_time_check check (end_date >= start_date)
);

alter table public.tasks add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.tasks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.tasks alter column user_id set default auth.uid();

create index if not exists idx_projects_user_status on public.projects(user_id, status, updated_at desc);
create index if not exists idx_project_phases_project_dates on public.project_phases(project_id, start_date, end_date);
create index if not exists idx_tasks_project on public.tasks(user_id, project_id, status);

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at before update on public.projects for each row execute function public.set_updated_at();

drop trigger if exists set_project_phases_updated_at on public.project_phases;
create trigger set_project_phases_updated_at before update on public.project_phases for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
alter table public.projects force row level security;
alter table public.project_phases enable row level security;
alter table public.project_phases force row level security;

drop policy if exists projects_select_own on public.projects;
drop policy if exists projects_insert_own on public.projects;
drop policy if exists projects_update_own on public.projects;
drop policy if exists projects_delete_own on public.projects;
create policy projects_select_own on public.projects for select to authenticated using (user_id = (select auth.uid()));
create policy projects_insert_own on public.projects for insert to authenticated with check (user_id = (select auth.uid()));
create policy projects_update_own on public.projects for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy projects_delete_own on public.projects for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists project_phases_select_own on public.project_phases;
drop policy if exists project_phases_insert_own on public.project_phases;
drop policy if exists project_phases_update_own on public.project_phases;
drop policy if exists project_phases_delete_own on public.project_phases;
create policy project_phases_select_own on public.project_phases for select to authenticated using (user_id = (select auth.uid()));
create policy project_phases_insert_own on public.project_phases for insert to authenticated with check (user_id = (select auth.uid()));
create policy project_phases_update_own on public.project_phases for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy project_phases_delete_own on public.project_phases for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_phases to authenticated;

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
end $$;
