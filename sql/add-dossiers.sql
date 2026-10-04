-- HabitFlow Dossiers. Run once in the Supabase SQL editor after add-projects.sql.
-- Additive: does not modify existing project or list data.
begin;
create table if not exists public.dossiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  description text not null default '' check (length(description) <= 600),
  project_id uuid references public.projects(id) on delete set null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, id)
);
create table if not exists public.dossier_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dossier_id uuid not null,
  body text not null default '' check (length(body) <= 10000),
  link text not null default '' check (link = '' or (length(link) <= 4000 and link ~ '^https?://')),
  image_path text not null default '',
  image_alt text not null default '' check (length(image_alt) <= 200),
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, dossier_id) references public.dossiers(user_id, id) on delete cascade,
  check (is_archived or length(trim(body)) > 0 or link <> '' or image_path <> ''),
  check (image_path = '' or (length(image_path) <= 160 and image_path like user_id::text || '/' || dossier_id::text || '/%' and image_path ~ '^[0-9a-f/-]+\.(webp|jpg)$'))
);
-- Optional dossier entry titles; existing entries retain an empty title.
alter table public.dossier_entries
  add column if not exists title text not null default '' check (length(title) <= 120);
notify pgrst, 'reload schema';

create index if not exists dossiers_owner_updated on public.dossiers(user_id, updated_at, id);
create index if not exists dossier_entries_owner_dossier on public.dossier_entries(user_id, dossier_id, id);
alter table public.dossiers enable row level security;
alter table public.dossier_entries enable row level security;

drop policy if exists dossiers_read on public.dossiers;
create policy dossiers_read on public.dossiers for select to authenticated using (user_id = auth.uid());
drop policy if exists dossiers_insert on public.dossiers;
create policy dossiers_insert on public.dossiers for insert to authenticated with check (
  user_id = auth.uid() and (project_id is null or exists(select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
);
drop policy if exists dossiers_update on public.dossiers;
create policy dossiers_update on public.dossiers for update to authenticated using (user_id = auth.uid()) with check (
  user_id = auth.uid() and (project_id is null or exists(select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
);
drop policy if exists dossier_entries_read on public.dossier_entries;
create policy dossier_entries_read on public.dossier_entries for select to authenticated using (user_id = auth.uid());
drop policy if exists dossier_entries_insert on public.dossier_entries;
create policy dossier_entries_insert on public.dossier_entries for insert to authenticated with check (user_id = auth.uid());
drop policy if exists dossier_entries_update on public.dossier_entries;
create policy dossier_entries_update on public.dossier_entries for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.dossiers, public.dossier_entries to authenticated;
revoke all on public.dossiers, public.dossier_entries from anon;

-- Local timestamps implement the same newest-row merge as the client; tombstones
-- are permanent to stop a stale device from restoring deleted content.
create or replace function public.habitflow_dossier_keep_newest() returns trigger language plpgsql set search_path = public as $$
begin
  if old.user_id <> new.user_id or old.id <> new.id then raise exception 'Record ownership is immutable'; end if;
  if old.updated_at > new.updated_at or (old.is_archived and not new.is_archived) then return old; end if;
  new.created_at := old.created_at;
  return new;
end;
$$;
drop trigger if exists dossiers_keep_newest on public.dossiers;
create trigger dossiers_keep_newest before update on public.dossiers for each row execute function public.habitflow_dossier_keep_newest();
drop trigger if exists dossier_entries_keep_newest on public.dossier_entries;
create trigger dossier_entries_keep_newest before update on public.dossier_entries for each row execute function public.habitflow_dossier_keep_newest();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('dossier-images', 'dossier-images', false, 135000, array['image/webp','image/jpeg'])
on conflict(id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists dossier_images_read on storage.objects;
create policy dossier_images_read on storage.objects for select to authenticated using (
  bucket_id = 'dossier-images' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists dossier_images_upload on storage.objects;
create policy dossier_images_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'dossier-images' and (storage.foldername(name))[1] = auth.uid()::text
  and exists(select 1 from public.dossiers d where d.user_id = auth.uid() and d.id::text = (storage.foldername(name))[2] and not d.is_archived)
);
drop policy if exists dossier_images_remove on storage.objects;
create policy dossier_images_remove on storage.objects for delete to authenticated using (
  bucket_id = 'dossier-images' and (storage.foldername(name))[1] = auth.uid()::text
);
commit;

-- Optional icons, task links and lightweight overview metrics.
-- Additive upgrade after add-dossiers.sql. Existing projects/tasks are unchanged.
begin;
alter table public.dossiers add column if not exists icon_key text not null default 'life'
  check (icon_key in ('education','holiday','work','leisure','sport','life'));
alter table public.dossiers add column if not exists linked_task_ids uuid[] not null default '{}'
  check (cardinality(linked_task_ids) <= 100);

-- Validate only new links: removal remains possible after a task is deleted.
create or replace function public.habitflow_dossier_validate_tasks()
returns trigger language plpgsql set search_path = public as $$
declare previous_ids uuid[] := '{}';
begin
  if TG_OP = 'UPDATE' then previous_ids := old.linked_task_ids; end if;
  if exists (
    select 1 from unnest(new.linked_task_ids) as linked(id)
    where linked.id is null or (not (linked.id = any(previous_ids)) and not exists (
      select 1 from public.tasks t where t.id = linked.id and t.user_id = new.user_id
    ))
  ) then raise exception 'Task link unavailable' using errcode = '23503'; end if;
  return new;
end;
$$;
drop trigger if exists dossiers_validate_tasks on public.dossiers;
create trigger dossiers_validate_tasks before insert or update on public.dossiers
  for each row execute function public.habitflow_dossier_validate_tasks();

-- RLS and the current user apply to both tables; no security-definer bypass.
create or replace function public.habitflow_dossier_summaries()
returns table(id uuid, entry_count bigint, last_update timestamptz)
language sql stable security invoker set search_path = public as $$
  select d.id, count(e.id) filter (where not e.is_archived),
    greatest(d.updated_at, coalesce(max(e.updated_at), d.updated_at))
  from public.dossiers d
  left join public.dossier_entries e on e.dossier_id = d.id and e.user_id = d.user_id
  where d.user_id = auth.uid() and not d.is_archived
  group by d.id, d.updated_at;
$$;
revoke all on function public.habitflow_dossier_summaries() from public, anon;
grant execute on function public.habitflow_dossier_summaries() to authenticated;
notify pgrst, 'reload schema';
commit;
-- Run once after add-dossiers.sql; safe to run again. No timestamps are changed.
begin;
alter table public.dossier_entries add column if not exists links text[] not null default '{}';
create or replace function public.habitflow_valid_dossier_links(values_ text[])
returns boolean language sql immutable set search_path = public as $$
  select values_ is not null and not exists (
    select 1 from unnest(values_) value
    where value is null or length(value) > 4000 or value !~ '^https?://'
  );
$$;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.dossier_entries'::regclass and conname = 'dossier_entries_links_valid') then
    alter table public.dossier_entries add constraint dossier_entries_links_valid
      check (public.habitflow_valid_dossier_links(links));
  end if;
end $$;

-- Keep the original first-link column compatible with older app versions.
create or replace function public.habitflow_dossier_entry_links()
returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    if cardinality(new.links) = 0 and new.link <> '' then new.links := array[new.link]; end if;
  elsif new.links is not distinct from old.links and new.link is distinct from old.link then
    new.links := (case when new.link = '' then '{}'::text[] else array[new.link] end)
      || coalesce(old.links[2:cardinality(old.links)], '{}'::text[]);
  end if;
  new.link := coalesce(new.links[1], '');
  return new;
end;
$$;
drop trigger if exists dossier_entries_links on public.dossier_entries;
-- Alphabetically after keep_newest so stale writes cannot replace current links.
create trigger dossier_entries_links before insert or update on public.dossier_entries
  for each row execute function public.habitflow_dossier_entry_links();
update public.dossier_entries set links = array[link] where cardinality(links) = 0 and link <> '';
notify pgrst, 'reload schema';
commit;
