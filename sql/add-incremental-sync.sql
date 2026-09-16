-- Run in Supabase SQL Editor after deploying the compatible client.
-- Existing business rows are untouched. Without this migration clients continue
-- using full, paginated reads. Journal tombstones must NOT be pruned/truncated.
begin;

create table if not exists public.habitflow_sync_clock (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0)
);
create table if not exists public.habitflow_sync_changes (
  user_id uuid not null references auth.users(id) on delete cascade,
  table_name text not null,
  row_id text not null,
  revision bigint not null,
  deleted boolean not null,
  primary key (user_id, table_name, row_id)
);
create index if not exists habitflow_sync_changes_revision
  on public.habitflow_sync_changes(user_id, table_name, revision);

alter table public.habitflow_sync_clock enable row level security;
alter table public.habitflow_sync_changes enable row level security;
drop policy if exists sync_clock_read_own on public.habitflow_sync_clock;
create policy sync_clock_read_own on public.habitflow_sync_clock
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists sync_changes_read_own on public.habitflow_sync_changes;
create policy sync_changes_read_own on public.habitflow_sync_changes
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.habitflow_sync_clock, public.habitflow_sync_changes from public, anon, authenticated;
grant select on public.habitflow_sync_clock, public.habitflow_sync_changes to authenticated;

-- Serialize authenticated writes before business-row locks are taken. The clock
-- is transactional (not a sequence): a committed cursor never skips an earlier
-- uncommitted transaction. This also avoids the usual per-user trigger lock race.
create or replace function public.habitflow_sync_lock_writer()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    insert into public.habitflow_sync_clock(user_id) values (auth.uid())
      on conflict (user_id) do nothing;
    perform 1 from public.habitflow_sync_clock where user_id = auth.uid() for update;
  end if;
  return null;
end;
$$;

create or replace function public.habitflow_sync_record_change(p_user uuid, p_table text, p_id text, p_deleted boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare next_revision bigint;
begin
  -- Account cascades need no tombstones for the removed account.
  if p_user is null or not exists (select 1 from auth.users where id = p_user) then return; end if;
  insert into public.habitflow_sync_clock(user_id, revision) values (p_user, 1)
    on conflict (user_id) do update set revision = public.habitflow_sync_clock.revision + 1
    returning revision into next_revision;
  insert into public.habitflow_sync_changes(user_id, table_name, row_id, revision, deleted)
    values (p_user, p_table, p_id, next_revision, p_deleted)
    on conflict (user_id, table_name, row_id) do update
      set revision = excluded.revision, deleted = excluded.deleted;
end;
$$;

create or replace function public.habitflow_sync_track_row()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.habitflow_sync_record_change(old.user_id, tg_table_name, old.id::text, true);
  else
    if tg_op = 'UPDATE' then
      if old.user_id is distinct from new.user_id or old.id is distinct from new.id then
        perform public.habitflow_sync_record_change(old.user_id, tg_table_name, old.id::text, true);
      end if;
    end if;
    perform public.habitflow_sync_record_change(new.user_id, tg_table_name, new.id::text, false);
  end if;
  return null;
end;
$$;
revoke all on function public.habitflow_sync_lock_writer() from public, anon, authenticated;
revoke all on function public.habitflow_sync_track_row() from public, anon, authenticated;
revoke all on function public.habitflow_sync_record_change(uuid, text, text, boolean) from public, anon, authenticated;

do $$
declare tbl text;
begin
  foreach tbl in array array['habit_definitions','habit_entries','tasks','cigarette_events','alcohol_logs','alcohol_events','task_ideas','appointments','points_ledger','pause_periods','weekly_reviews','monthly_missions'] loop
    if to_regclass(format('public.%I', tbl)) is null then continue; end if;
    execute format('drop trigger if exists habitflow_sync_writer on public.%I', tbl);
    execute format('create trigger habitflow_sync_writer before insert or update or delete on public.%I for each statement execute function public.habitflow_sync_lock_writer()', tbl);
    execute format('drop trigger if exists habitflow_sync_row on public.%I', tbl);
    execute format('create trigger habitflow_sync_row after insert or update or delete on public.%I for each row execute function public.habitflow_sync_track_row()', tbl);
  end loop;
end $$;

-- STABLE uses one MVCC snapshot for clock, journal and business rows throughout
-- the call. SECURITY INVOKER preserves the caller's existing business-table RLS.
create or replace function public.habitflow_sync_pull(p_table text, p_cursor text default null, p_limit integer default 1000)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  head bigint;
  cursor_value bigint;
  last_revision bigint;
  records jsonb;
  more boolean;
  batch_size integer := greatest(1, least(coalesce(p_limit, 1000), 1000));
begin
  if viewer is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_table is null or not (p_table = any(array['habit_definitions','habit_entries','tasks','cigarette_events','alcohol_logs','alcohol_events','task_ideas','appointments','points_ledger','pause_periods','weekly_reviews','monthly_missions'])) then
    raise exception 'Unsupported sync table' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_trigger where tgrelid = to_regclass(format('public.%I', p_table)) and tgname = 'habitflow_sync_row' and tgenabled = 'O') then
    raise exception 'Sync tracking not installed for %', p_table using errcode = '55000';
  end if;
  select coalesce((select revision from public.habitflow_sync_clock where user_id = viewer), 0) into head;
  if p_cursor is not null then
    if p_cursor !~ '^[0-9]{1,18}$' then raise exception 'Invalid sync cursor' using errcode = '22023'; end if;
    cursor_value := p_cursor::bigint;
  end if;
  if p_cursor is null or cursor_value > head then
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by t.id), ''[]''::jsonb) from public.%I t where t.user_id = $1', p_table)
      into records using viewer;
    return jsonb_build_object('protocol', 1, 'mode', 'snapshot', 'table', p_table, 'user_id', viewer, 'cursor', head::text, 'rows', records, 'has_more', false);
  end if;
  execute format($query$
    with batch as (
      select row_id, revision, deleted from public.habitflow_sync_changes
      where user_id = $1 and table_name = $2 and revision > $3
      order by revision limit $4
    )
    select coalesce(jsonb_agg(jsonb_build_object('id', c.row_id, 'revision', c.revision::text, 'deleted', c.deleted,
      'row', case when c.deleted then null else to_jsonb(t) end) order by c.revision), '[]'::jsonb), max(c.revision)
    from batch c left join public.%I t on t.id::text = c.row_id and t.user_id = $1
  $query$, p_table) into records, last_revision using viewer, p_table, cursor_value, batch_size;
  select exists (select 1 from public.habitflow_sync_changes where user_id = viewer and table_name = p_table and revision > coalesce(last_revision, head)) into more;
  return jsonb_build_object('protocol', 1, 'mode', 'delta', 'table', p_table, 'user_id', viewer,
    'cursor', (case when more then last_revision else head end)::text, 'changes', records, 'has_more', more);
end;
$$;
revoke all on function public.habitflow_sync_pull(text, text, integer) from public, anon;
grant execute on function public.habitflow_sync_pull(text, text, integer) to authenticated;
notify pgrst, 'reload schema';
commit;
