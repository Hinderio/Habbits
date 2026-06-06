-- Appointment series metadata for reliable recurrence edits/deletes.
-- Safe to run repeatedly on existing HabitFlow Supabase installs.

alter table public.appointments add column if not exists recurrence text;
alter table public.appointments add column if not exists series_id text;
alter table public.appointments add column if not exists series_index integer;

alter table public.appointments drop constraint if exists appointments_recurrence_check;
alter table public.appointments add constraint appointments_recurrence_check
  check (recurrence is null or recurrence in ('weekly','monthly','quarterly','yearly'));

alter table public.appointments drop constraint if exists appointments_series_index_check;
alter table public.appointments add constraint appointments_series_index_check
  check (series_index is null or series_index >= 0);

create index if not exists idx_appointments_user_series_starts_at
  on public.appointments(user_id, series_id, starts_at desc)
  where series_id is not null;
