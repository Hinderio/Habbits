create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.custom_lists (
  id text not null,
  user_id uuid not null default auth.uid(),
  slug text not null,
  title text not null,
  description text null,
  list_type text not null default 'generic',
  icon text not null default 'list',
  color text not null default '#59d4cc',
  sort_rank numeric not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_lists_pkey primary key (user_id, id),
  constraint custom_lists_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint custom_lists_slug_unique unique (user_id, slug),
  constraint custom_lists_type_check check (list_type = any (array['generic','voucher','shopping','photos','subscription']))
);

create table if not exists public.custom_list_items (
  id text not null,
  user_id uuid not null default auth.uid(),
  list_id text not null,
  title text not null,
  note text null,
  metadata jsonb not null default '{}'::jsonb,
  is_done boolean not null default false,
  is_archived boolean not null default false,
  sort_rank numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_list_items_pkey primary key (user_id, id),
  constraint custom_list_items_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint custom_list_items_list_fkey foreign key (user_id, list_id) references public.custom_lists(user_id, id) on delete cascade
);

create table if not exists public.photo_spot_tours (
  id text not null,
  user_id uuid not null default auth.uid(),
  title text not null,
  region text null,
  note text null,
  cover_url text null,
  sort_rank numeric not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photo_spot_tours_pkey primary key (user_id, id),
  constraint photo_spot_tours_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

create table if not exists public.photo_spot_tour_stops (
  id text not null,
  user_id uuid not null default auth.uid(),
  tour_id text not null,
  title text not null,
  location text null,
  note text null,
  image_url text null,
  stop_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photo_spot_tour_stops_pkey primary key (user_id, id),
  constraint photo_spot_tour_stops_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint photo_spot_tour_stops_tour_fkey foreign key (user_id, tour_id) references public.photo_spot_tours(user_id, id) on delete cascade
);

create index if not exists idx_custom_lists_user_active on public.custom_lists(user_id, is_archived, sort_rank);
create index if not exists idx_custom_list_items_user_list on public.custom_list_items(user_id, list_id, is_archived, sort_rank);
create index if not exists idx_photo_spot_tours_user_active on public.photo_spot_tours(user_id, is_archived, sort_rank);
create index if not exists idx_photo_spot_stops_user_tour on public.photo_spot_tour_stops(user_id, tour_id, is_archived, stop_order);

drop trigger if exists set_custom_lists_updated_at on public.custom_lists;
create trigger set_custom_lists_updated_at before update on public.custom_lists for each row execute function public.set_updated_at();

drop trigger if exists set_custom_list_items_updated_at on public.custom_list_items;
create trigger set_custom_list_items_updated_at before update on public.custom_list_items for each row execute function public.set_updated_at();

drop trigger if exists set_photo_spot_tours_updated_at on public.photo_spot_tours;
create trigger set_photo_spot_tours_updated_at before update on public.photo_spot_tours for each row execute function public.set_updated_at();

drop trigger if exists set_photo_spot_tour_stops_updated_at on public.photo_spot_tour_stops;
create trigger set_photo_spot_tour_stops_updated_at before update on public.photo_spot_tour_stops for each row execute function public.set_updated_at();

alter table public.custom_lists enable row level security;
alter table public.custom_list_items enable row level security;
alter table public.photo_spot_tours enable row level security;
alter table public.photo_spot_tour_stops enable row level security;

revoke all on public.custom_lists from anon;
revoke all on public.custom_list_items from anon;
revoke all on public.photo_spot_tours from anon;
revoke all on public.photo_spot_tour_stops from anon;
grant select, insert, update, delete on public.custom_lists to authenticated;
grant select, insert, update, delete on public.custom_list_items to authenticated;
grant select, insert, update, delete on public.photo_spot_tours to authenticated;
grant select, insert, update, delete on public.photo_spot_tour_stops to authenticated;

drop policy if exists "custom_lists_select_own" on public.custom_lists;
create policy "custom_lists_select_own" on public.custom_lists for select using (auth.uid() = user_id);
drop policy if exists "custom_lists_insert_own" on public.custom_lists;
create policy "custom_lists_insert_own" on public.custom_lists for insert with check (auth.uid() = user_id);
drop policy if exists "custom_lists_update_own" on public.custom_lists;
create policy "custom_lists_update_own" on public.custom_lists for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "custom_lists_delete_own" on public.custom_lists;
create policy "custom_lists_delete_own" on public.custom_lists for delete using (auth.uid() = user_id);

drop policy if exists "custom_list_items_select_own" on public.custom_list_items;
create policy "custom_list_items_select_own" on public.custom_list_items for select using (auth.uid() = user_id);
drop policy if exists "custom_list_items_insert_own" on public.custom_list_items;
create policy "custom_list_items_insert_own" on public.custom_list_items for insert with check (auth.uid() = user_id);
drop policy if exists "custom_list_items_update_own" on public.custom_list_items;
create policy "custom_list_items_update_own" on public.custom_list_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "custom_list_items_delete_own" on public.custom_list_items;
create policy "custom_list_items_delete_own" on public.custom_list_items for delete using (auth.uid() = user_id);

drop policy if exists "photo_spot_tours_select_own" on public.photo_spot_tours;
create policy "photo_spot_tours_select_own" on public.photo_spot_tours for select using (auth.uid() = user_id);
drop policy if exists "photo_spot_tours_insert_own" on public.photo_spot_tours;
create policy "photo_spot_tours_insert_own" on public.photo_spot_tours for insert with check (auth.uid() = user_id);
drop policy if exists "photo_spot_tours_update_own" on public.photo_spot_tours;
create policy "photo_spot_tours_update_own" on public.photo_spot_tours for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "photo_spot_tours_delete_own" on public.photo_spot_tours;
create policy "photo_spot_tours_delete_own" on public.photo_spot_tours for delete using (auth.uid() = user_id);

drop policy if exists "photo_spot_stops_select_own" on public.photo_spot_tour_stops;
create policy "photo_spot_stops_select_own" on public.photo_spot_tour_stops for select using (auth.uid() = user_id);
drop policy if exists "photo_spot_stops_insert_own" on public.photo_spot_tour_stops;
create policy "photo_spot_stops_insert_own" on public.photo_spot_tour_stops for insert with check (auth.uid() = user_id);
drop policy if exists "photo_spot_stops_update_own" on public.photo_spot_tour_stops;
create policy "photo_spot_stops_update_own" on public.photo_spot_tour_stops for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "photo_spot_stops_delete_own" on public.photo_spot_tour_stops;
create policy "photo_spot_stops_delete_own" on public.photo_spot_tour_stops for delete using (auth.uid() = user_id);
