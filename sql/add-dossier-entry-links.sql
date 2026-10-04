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
