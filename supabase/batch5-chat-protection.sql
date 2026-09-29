-- ============================================================================
-- Batch 5 — chat protection: rate limit, banned words, blocked users
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- ============================================================================

-- 1. Host-controlled banned words (per event).
alter table public.events
  add column if not exists chat_banned_words text[] not null default '{}';

-- 2. Users the host has blocked from an event's chat.
create table if not exists public.chat_blocks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  author_name text not null,               -- stored lowercase
  author_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists chat_blocks_event_name_idx
  on public.chat_blocks (event_id, author_name);

alter table public.chat_blocks enable row level security;

drop policy if exists "Hosts can view blocks in their event" on public.chat_blocks;
create policy "Hosts can view blocks in their event"
  on public.chat_blocks for select to authenticated
  using (exists (select 1 from public.events e where e.id = chat_blocks.event_id and e.host_id = auth.uid()));

drop policy if exists "Hosts can add blocks in their event" on public.chat_blocks;
create policy "Hosts can add blocks in their event"
  on public.chat_blocks for insert to authenticated
  with check (exists (select 1 from public.events e where e.id = chat_blocks.event_id and e.host_id = auth.uid()));

drop policy if exists "Hosts can remove blocks in their event" on public.chat_blocks;
create policy "Hosts can remove blocks in their event"
  on public.chat_blocks for delete to authenticated
  using (exists (select 1 from public.events e where e.id = chat_blocks.event_id and e.host_id = auth.uid()));

-- 3. Server-side guard on every new chat message. Enforced in the database
--    so it can't be bypassed by editing the website's code.
create or replace function public.chat_messages_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  banned text[];
  w text;
  recent_short int;
  recent_long int;
begin
  -- Blocked by the host (by name, or by account if signed in).
  if exists (
    select 1 from public.chat_blocks b
    where b.event_id = new.event_id
      and (b.author_name = lower(new.author_name)
           or (b.author_id is not null and b.author_id = new.author_id))
  ) then
    raise exception 'chat_blocked';
  end if;

  -- Rate limit: 1 message per 2 seconds, 10 per 30 seconds, per name.
  select count(*) into recent_short from public.chat_messages
    where event_id = new.event_id and lower(author_name) = lower(new.author_name)
      and created_at > now() - interval '2 seconds';
  if recent_short >= 1 then
    raise exception 'chat_rate_limited';
  end if;

  select count(*) into recent_long from public.chat_messages
    where event_id = new.event_id and lower(author_name) = lower(new.author_name)
      and created_at > now() - interval '30 seconds';
  if recent_long >= 10 then
    raise exception 'chat_rate_limited';
  end if;

  -- Banned words (whole-word, case-insensitive).
  select chat_banned_words into banned from public.events where id = new.event_id;
  foreach w in array coalesce(banned, '{}') loop
    if btrim(w) <> '' and new.body ~* ('\m' || regexp_replace(btrim(w), '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M') then
      raise exception 'chat_banned_word';
    end if;
  end loop;

  return new;
end;
$fn$;

drop trigger if exists chat_messages_guard_trigger on public.chat_messages;
create trigger chat_messages_guard_trigger
  before insert on public.chat_messages
  for each row execute procedure public.chat_messages_guard();
