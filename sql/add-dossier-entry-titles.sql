-- Optional dossier entry titles; existing entries retain an empty title.
alter table public.dossier_entries
  add column if not exists title text not null default '' check (length(title) <= 120);
notify pgrst, 'reload schema';
