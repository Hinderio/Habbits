-- ONLY run with psql in an EMPTY disposable PostgreSQL database as administrator.
-- Creates mock Supabase roles/auth and business tables. Never run in production.
\set ON_ERROR_STOP on
do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
end $$;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth, public to authenticated;
insert into auth.users values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');
do $$
declare tbl text;
begin
  foreach tbl in array array['habit_definitions','habit_entries','tasks','cigarette_events','alcohol_logs','alcohol_events','task_ideas','appointments','points_ledger','pause_periods','weekly_reviews','monthly_missions'] loop
    execute format('create table public.%I (id uuid primary key, user_id uuid not null, points integer)', tbl);
    execute format('alter table public.%I enable row level security', tbl);
    execute format('create policy own on public.%I to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', tbl);
    execute format('grant select, insert, update, delete on public.%I to authenticated', tbl);
  end loop;
end $$;
insert into public.points_ledger values ('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001',1);
\ir ../../sql/add-incremental-sync.sql
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
do $$
declare result jsonb; base text; next_cursor text;
begin
  result := public.habitflow_sync_pull('points_ledger');
  if result->>'mode' <> 'snapshot' or jsonb_array_length(result->'rows') <> 1 then raise exception 'Initial snapshot failed'; end if;
  base := result->>'cursor';
  update public.points_ledger set points = 10 where id = '00000000-0000-4000-8000-000000000010';
  insert into public.points_ledger values ('00000000-0000-4000-8000-000000000011',auth.uid(),11);
  delete from public.points_ledger where id = '00000000-0000-4000-8000-000000000010';
  result := public.habitflow_sync_pull('points_ledger',base,1);
  if result->>'mode' <> 'delta' or result->>'has_more' <> 'true' or result#>>'{changes,0,row,points}' <> '11' then raise exception 'Paged upsert failed: %',result; end if;
  next_cursor := result->>'cursor';
  result := public.habitflow_sync_pull('points_ledger',next_cursor,1);
  if result->>'has_more' <> 'false' or result#>>'{changes,0,deleted}' <> 'true' then raise exception 'Tombstone failed: %',result; end if;
  result := public.habitflow_sync_pull('points_ledger',result->>'cursor');
  if jsonb_array_length(result->'changes') <> 0 then raise exception 'Unchanged pull sent rows'; end if;
  begin
    update public.habitflow_sync_clock set revision = 0;
    raise exception 'Authenticated user changed sync clock';
  exception when insufficient_privilege then null; end;
  begin
    perform public.habitflow_sync_record_change(auth.uid(),'points_ledger','forged',true);
    raise exception 'Authenticated user forged journal entry';
  exception when insufficient_privilege then null; end;
end $$;
-- Unlike timestamp watermarks, rolled-back revisions leave no cursor gap.
begin;
update public.points_ledger set points=99 where id='00000000-0000-4000-8000-000000000011';
rollback;
do $$
declare result jsonb;
begin
  result := public.habitflow_sync_pull('points_ledger','3');
  if result->>'cursor' <> '3' or jsonb_array_length(result->'changes') <> 0 then raise exception 'Rollback advanced cursor'; end if;
  update public.points_ledger set points=12 where id='00000000-0000-4000-8000-000000000011';
  result := public.habitflow_sync_pull('points_ledger','3');
  if result#>>'{changes,0,row,points}' <> '12' then raise exception 'Ledger edit without updated_at missed'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$
declare result jsonb;
begin
  result := public.habitflow_sync_pull('points_ledger');
  if jsonb_array_length(result->'rows') <> 0 then raise exception 'Snapshot leaked another account'; end if;
  result := public.habitflow_sync_pull('points_ledger','0');
  if jsonb_array_length(result->'changes') <> 0 then raise exception 'Journal leaked another account'; end if;
end $$;
reset role;
\echo 'Incremental sync integration checks passed'
