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
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

-- A user can only update their own profile row.
drop policy if exists "Users can update their own profile" on public.profiles;
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

-- ============================================================================
-- Batch 3 — events
-- ============================================================================
--
-- One row per broadcast a user sets up (a class, a match, a service, etc).
-- `status` tracks it through its lifecycle; Batch 4 (LiveKit) is what will
-- actually flip a row from 'scheduled' to 'live' and later 'ended'.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'general', -- 'class' | 'football' | 'church' | 'school' | 'conference' | 'general'
  status text not null default 'scheduled', -- 'scheduled' | 'live' | 'ended' | 'cancelled'
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;

-- Anyone (including signed-out visitors browsing the public events page)
-- can view scheduled or live events.
drop policy if exists "Scheduled and live events are publicly viewable" on public.events;
create policy "Scheduled and live events are publicly viewable"
  on public.events for select
  to anon, authenticated
  using (status in ('scheduled', 'live'));

-- A host can always see their own events, including ended/cancelled ones.
drop policy if exists "Hosts can view their own events" on public.events;
create policy "Hosts can view their own events"
  on public.events for select
  to authenticated
  using (auth.uid() = host_id);

drop policy if exists "Signed-in users can create their own events" on public.events;
create policy "Signed-in users can create their own events"
  on public.events for insert
  to authenticated
  with check (auth.uid() = host_id);

drop policy if exists "Hosts can update their own events" on public.events;
create policy "Hosts can update their own events"
  on public.events for update
  to authenticated
  using (auth.uid() = host_id);

drop policy if exists "Hosts can delete their own events" on public.events;
create policy "Hosts can delete their own events"
  on public.events for delete
  to authenticated
  using (auth.uid() = host_id);

create or replace function public.handle_event_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_event_updated on public.events;
create trigger on_event_updated
  before update on public.events
  for each row execute procedure public.handle_event_updated_at();

create index if not exists events_host_id_idx on public.events (host_id);
create index if not exists events_status_scheduled_for_idx on public.events (status, scheduled_for);
