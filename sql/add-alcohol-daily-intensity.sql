-- HabitFlow: tägliche Alkohol-Intensität statt einzelner Getränke
-- Sicher additiv: bestehende alcohol_events bleiben als historische Quelle erhalten.
begin;

alter table public.alcohol_logs
  add column if not exists consumption_level smallint,
  add column if not exists consumption_key text,
  add column if not exists points integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'alcohol_logs_consumption_level_check'
      and conrelid = 'public.alcohol_logs'::regclass
  ) then
    alter table public.alcohol_logs
      add constraint alcohol_logs_consumption_level_check
      check (consumption_level is null or consumption_level between 1 and 4);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'alcohol_logs_consumption_key_check'
      and conrelid = 'public.alcohol_logs'::regclass
  ) then
    alter table public.alcohol_logs
      add constraint alcohol_logs_consumption_key_check
      check (
        consumption_key is null
        or consumption_key in ('light', 'moderate', 'elevated', 'heavy')
      );
  end if;
end
$$;

create unique index if not exists idx_alcohol_logs_user_daily_intensity
  on public.alcohol_logs(user_id, log_date)
  where consumption_key is not null;

comment on column public.alcohol_logs.consumption_level is
  'Tagesintensität 1 bis 4; null kennzeichnet historische Datensätze.';
comment on column public.alcohol_logs.consumption_key is
  'light, moderate, elevated oder heavy; null kennzeichnet historische Datensätze.';
comment on column public.alcohol_logs.points is
  'Zum Tagesniveau gehörender HabitFlow-Punktewert.';

commit;

-- Bewusst kein Backfill:
-- Historische alcohol_events werden von der App tagweise gruppiert und lesbar gehalten.
-- Neue oder bearbeitete Tage werden nativ in alcohol_logs gespeichert.
