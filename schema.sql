-- NovaChat v3 database
-- Run this entire file in Supabase SQL Editor.
-- Safe to re-run: columns, indexes, policies and functions are recreated idempotently.

create extension if not exists pgcrypto;

-- =========================================================
-- PROFILES
-- =========================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text not null default 'کاربر',
  username text,
  bio text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists username text;

alter table public.profiles
  add column if not exists bio text not null default '';

alter table public.profiles
  add column if not exists avatar_url text;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null and username <> '';

-- =========================================================
-- CONVERSATIONS
-- =========================================================

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  title text,
  is_group boolean not null default false,
  kind text not null default 'private',
  username text,
  description text not null default '',
  created_at timestamptz not null default now(),
  constraint conversations_kind_check
    check (kind in ('private', 'group', 'channel'))
);

alter table public.conversations
  add column if not exists kind text not null default 'private';

alter table public.conversations
  add column if not exists username text;

alter table public.conversations
  add column if not exists description text not null default '';

update public.conversations
set kind = case
  when is_group = true then 'group'
  else 'private'
end
where kind is null or kind = '';

create unique index if not exists conversations_username_unique_idx
  on public.conversations (lower(username))
  where username is not null and username <> '';

create index if not exists conversations_kind_idx
  on public.conversations(kind);

-- =========================================================
-- MEMBERS
-- =========================================================

create table if not exists public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_user_idx
  on public.conversation_members(user_id);

create index if not exists conversation_members_conversation_idx
  on public.conversation_members(conversation_id);

-- =========================================================
-- MESSAGES
-- =========================================================

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) <= 10000),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages(conversation_id, created_at);

-- =========================================================
-- NEW USER PROFILE
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    display_name,
    username,
    bio,
    avatar_url
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'display_name', 'کاربر'),
    nullif(lower(new.raw_user_meta_data->>'username'), ''),
    coalesce(new.raw_user_meta_data->>'bio', ''),
    nullif(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    username = coalesce(excluded.username, public.profiles.username),
    bio = coalesce(excluded.bio, public.profiles.bio),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profiles authenticated read" on public.profiles;
drop policy if exists "own profile update" on public.profiles;

create policy "profiles authenticated read"
on public.profiles
for select
to authenticated
using (true);

create policy "own profile update"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "members read own conversations" on public.conversations;

create policy "members read own conversations"
on public.conversations
for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_members m
    where m.conversation_id = conversations.id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "members read membership" on public.conversation_members;

create policy "members read membership"
on public.conversation_members
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.conversation_members m
    where m.conversation_id = conversation_members.conversation_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "members read messages" on public.messages;
drop policy if exists "members send messages" on public.messages;

create policy "members read messages"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_members m
    where m.conversation_id = messages.conversation_id
      and m.user_id = auth.uid()
  )
);

create policy "members send messages"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.conversation_members m
    where m.conversation_id = messages.conversation_id
      and m.user_id = auth.uid()
  )
);

-- =========================================================
-- PRIVATE CHAT
-- =========================================================

create or replace function public.create_private_conversation(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if other_user is null or other_user = auth.uid() then
    raise exception 'invalid recipient';
  end if;

  select cm1.conversation_id
  into c
  from public.conversation_members cm1
  join public.conversation_members cm2
    on cm2.conversation_id = cm1.conversation_id
  join public.conversations co
    on co.id = cm1.conversation_id
  where cm1.user_id = auth.uid()
    and cm2.user_id = other_user
    and co.kind = 'private'
  limit 1;

  if c is not null then
    return c;
  end if;

  insert into public.conversations(title, is_group, kind)
  values (null, false, 'private')
  returning id into c;

  insert into public.conversation_members(conversation_id, user_id)
  values
    (c, auth.uid()),
    (c, other_user);

  return c;
end;
$$;

grant execute on function public.create_private_conversation(uuid)
to authenticated;

-- =========================================================
-- GROUP / CHANNEL
-- =========================================================

create or replace function public.create_group_or_channel(
  p_title text,
  p_username text default null,
  p_description text default null,
  p_is_channel boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c uuid;
  normalized_username text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if nullif(trim(p_title), '') is null then
    raise exception 'title is required';
  end if;

  normalized_username := nullif(lower(trim(p_username)), '');

  if normalized_username is not null
     and normalized_username !~ '^[a-z0-9_]{3,32}$' then
    raise exception 'invalid username';
  end if;

  insert into public.conversations(
    title,
    is_group,
    kind,
    username,
    description
  )
  values (
    trim(p_title),
    true,
    case when p_is_channel then 'channel' else 'group' end,
    normalized_username,
    coalesce(trim(p_description), '')
  )
  returning id into c;

  insert into public.conversation_members(conversation_id, user_id)
  values (c, auth.uid());

  return c;
exception
  when unique_violation then
    raise exception 'username already exists';
end;
$$;

grant execute on function public.create_group_or_channel(text, text, text, boolean)
to authenticated;

-- =========================================================
-- REALTIME
-- =========================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
