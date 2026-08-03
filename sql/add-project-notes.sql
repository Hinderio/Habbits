-- HabitFlow project notes
-- Additive migration. Run once in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.project_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  category text not null default 'Allgemein',
  body text not null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_notes_category_check check (char_length(btrim(category)) between 1 and 60),
  constraint project_notes_body_check check (char_length(btrim(body)) between 1 and 2000)
);

create index if not exists idx_project_notes_project_updated
  on public.project_notes(user_id, project_id, updated_at desc)
  where is_archived = false;

drop trigger if exists set_project_notes_updated_at on public.project_notes;
create trigger set_project_notes_updated_at
before update on public.project_notes
for each row execute function public.set_updated_at();

alter table public.project_notes enable row level security;
alter table public.project_notes force row level security;

drop policy if exists project_notes_select_own on public.project_notes;
drop policy if exists project_notes_insert_own on public.project_notes;
drop policy if exists project_notes_update_own on public.project_notes;
drop policy if exists project_notes_delete_own on public.project_notes;

create policy project_notes_select_own on public.project_notes
for select to authenticated using (user_id = (select auth.uid()));

create policy project_notes_insert_own on public.project_notes
for insert to authenticated with check (user_id = (select auth.uid()));

create policy project_notes_update_own on public.project_notes
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy project_notes_delete_own on public.project_notes
for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.project_notes to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.project_notes;
  exception when duplicate_object then
    null;
  end;
end $$;
