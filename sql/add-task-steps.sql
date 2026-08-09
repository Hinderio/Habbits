-- HabitFlow: persist ordered task subtasks/checklists in Supabase.
-- Safe to run repeatedly in the Supabase SQL Editor.

begin;

alter table public.tasks
  add column if not exists steps jsonb not null default '[]'::jsonb;

update public.tasks
set steps = '[]'::jsonb
where steps is null
   or jsonb_typeof(steps) <> 'array';

alter table public.tasks
  drop constraint if exists tasks_steps_array_check;

alter table public.tasks
  add constraint tasks_steps_array_check
  check (jsonb_typeof(steps) = 'array');

comment on column public.tasks.steps is
  'Ordered task checklist entries: [{id,title,done,created_at,completed_at}].';

commit;
