-- HabitFlow Learning Vault remote persistence
-- Run once in Supabase SQL editor. Safe to re-run.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.learning_vault (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  context text,
  tags text[] not null default array[]::text[],
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.learning_vault add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.learning_vault alter column user_id set default auth.uid();
alter table public.learning_vault add column if not exists title text;
alter table public.learning_vault add column if not exists body text;
alter table public.learning_vault add column if not exists context text;
alter table public.learning_vault add column if not exists tags text[] not null default array[]::text[];
alter table public.learning_vault add column if not exists is_archived boolean not null default false;
alter table public.learning_vault add column if not exists created_at timestamptz not null default now();
alter table public.learning_vault add column if not exists updated_at timestamptz not null default now();

alter table public.learning_vault drop constraint if exists learning_vault_title_length_check;
alter table public.learning_vault add constraint learning_vault_title_length_check check (char_length(title) <= 120);
alter table public.learning_vault drop constraint if exists learning_vault_body_length_check;
alter table public.learning_vault add constraint learning_vault_body_length_check check (char_length(body) <= 420);
alter table public.learning_vault drop constraint if exists learning_vault_context_length_check;
alter table public.learning_vault add constraint learning_vault_context_length_check check (context is null or char_length(context) <= 80);
alter table public.learning_vault drop constraint if exists learning_vault_tags_length_check;
alter table public.learning_vault add constraint learning_vault_tags_length_check check (coalesce(array_length(tags, 1), 0) <= 5);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.learning_vault'::regclass
      and conname = 'learning_vault_user_id_id_unique'
  ) then
    alter table public.learning_vault add constraint learning_vault_user_id_id_unique unique (user_id, id);
  end if;
end $$;

create index if not exists idx_learning_vault_user_updated on public.learning_vault(user_id, is_archived, updated_at desc);

drop trigger if exists set_learning_vault_updated_at on public.learning_vault;
create trigger set_learning_vault_updated_at before update on public.learning_vault for each row execute function public.set_updated_at();

alter table public.learning_vault enable row level security;
alter table public.learning_vault force row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'learning_vault' loop
    execute format('drop policy if exists %I on public.learning_vault', pol.policyname);
  end loop;
end $$;

create policy learning_vault_select_own on public.learning_vault
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy learning_vault_insert_own on public.learning_vault
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy learning_vault_update_own on public.learning_vault
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy learning_vault_delete_own on public.learning_vault
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.learning_vault from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.learning_vault to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.learning_vault;
  exception when others then
    null;
  end;
end $$;
