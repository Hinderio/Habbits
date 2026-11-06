-- Competition: immutable events, isolated per authenticated account.
create table if not exists public.competition_events (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  challenge_id uuid not null,
  kind text not null check (kind in ('start','check','finish','archive')),
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 2048),
  created_at timestamptz not null default now()
);
create index if not exists competition_events_owner_cursor on public.competition_events(user_id, created_at, id);
alter table public.competition_events enable row level security;
drop policy if exists competition_events_select_own on public.competition_events;
create policy competition_events_select_own on public.competition_events for select to authenticated using (auth.uid() = user_id);
drop policy if exists competition_events_insert_own on public.competition_events;
create policy competition_events_insert_own on public.competition_events for insert to authenticated with check (auth.uid() = user_id);
revoke all on public.competition_events from anon;
grant select, insert on public.competition_events to authenticated;
-- No UPDATE/DELETE policy: corrections are new check/finish events, not overwrites.
notify pgrst, 'reload schema';
