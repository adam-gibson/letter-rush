-- Run in the Supabase dashboard → SQL Editor.
-- Each signed-in user can only see and change their own categories.

create table if not exists public.custom_categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 40),
  created_at  timestamptz not null default now()
);

create unique index if not exists custom_categories_user_name_idx
  on public.custom_categories (user_id, lower(name));

alter table public.custom_categories enable row level security;

create policy "Read own categories" on public.custom_categories
  for select to authenticated using (auth.uid() = user_id);

create policy "Insert own categories" on public.custom_categories
  for insert to authenticated with check (auth.uid() = user_id);

create policy "Delete own categories" on public.custom_categories
  for delete to authenticated using (auth.uid() = user_id);
