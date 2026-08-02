alter table public.tasks
  add column if not exists category text;

create index if not exists idx_tasks_user_category
  on public.tasks (user_id, category)
  where category is not null;
