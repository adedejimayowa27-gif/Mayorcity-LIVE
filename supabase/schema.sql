-- Mayorcity LIVE — Batch 2 schema: user profiles
--
-- Run this once in your Supabase project's SQL editor
-- (Dashboard → SQL Editor → New query → paste → Run).
--
-- Supabase's built-in `auth.users` table already handles credentials.
-- This adds a public `profiles` table that mirrors the parts of a user
-- later batches will need to read/join against (display name, avatar,
-- role), kept separate from `auth.users` because that table isn't
-- directly queryable from the frontend.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  role text not null default 'broadcaster', -- 'broadcaster' | 'admin' (used from Batch 9)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone signed in can read profiles (needed later for viewer-facing
-- pages that show who is broadcasting).
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

-- A user can only update their own profile row.
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Automatically create a profile row whenever someone signs up, using the
-- full name captured at sign-up time (see authService.js signUpWithEmail).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Keep updated_at current on every edit.
create or replace function public.handle_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_profile_updated on public.profiles;
create trigger on_profile_updated
  before update on public.profiles
  for each row execute procedure public.handle_profile_updated_at();
