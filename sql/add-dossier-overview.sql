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
