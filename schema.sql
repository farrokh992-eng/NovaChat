-- BipolarChat system schema
-- Nova is the source/repository name only. The application name is BipolarChat.
-- Run this file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text not null default 'کاربر',
  username text,
  bio text not null default '',
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin','owner')),
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists is_verified boolean not null default false;
create unique index if not exists profiles_username_lower_uidx
  on public.profiles(lower(username)) where username is not null and username <> '';

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text not null default '',
  kind text not null default 'private' check (kind in ('private','group','channel')),
  is_group boolean not null default false,
  username text,
  is_public boolean not null default false,
  is_verified boolean not null default false,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.conversations add column if not exists description text not null default '';
alter table public.conversations add column if not exists kind text not null default 'private';
alter table public.conversations add column if not exists username text;
alter table public.conversations add column if not exists is_public boolean not null default false;
alter table public.conversations add column if not exists is_verified boolean not null default false;
alter table public.conversations add column if not exists owner_id uuid references public.profiles(id) on delete set null;
create unique index if not exists conversations_username_lower_uidx
  on public.conversations(lower(username)) where username is not null and username <> '';

create table if not exists public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);

create table if not exists public.conversation_admins (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'admin' check(role in ('admin','owner')),
  created_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);

create table if not exists public.bot_accounts (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  display_name text not null,
  description text not null default '',
  bot_type text not null default 'system',
  owner_id uuid references public.profiles(id) on delete set null,
  is_verified boolean not null default true,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists bot_accounts_username_lower_uidx
  on public.bot_accounts(lower(username));

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  bot_id uuid references public.bot_accounts(id) on delete set null,
  body text not null check(char_length(body)<=10000),
  created_at timestamptz not null default now(),
  check ((sender_id is not null) <> (bot_id is not null))
);
create index if not exists messages_conversation_created_idx
  on public.messages(conversation_id,created_at);

create table if not exists public.app_settings (
  id boolean primary key default true check(id=true),
  owner_user_id uuid references public.profiles(id) on delete set null,
  official_channel_id uuid references public.conversations(id) on delete set null,
  notification_bot_id uuid references public.bot_accounts(id) on delete set null,
  app_name text not null default 'BipolarChat',
  owner_username text not null default 'bipolar',
  official_channel_username text not null default 'bipolar_ir',
  notification_bot_username text not null default 'notification',
  updated_at timestamptz not null default now()
);
insert into public.app_settings(id) values(true) on conflict(id) do nothing;

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.conversation_admins enable row level security;
alter table public.bot_accounts enable row level security;
alter table public.messages enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "profiles authenticated read" on public.profiles;
create policy "profiles authenticated read" on public.profiles
for select to authenticated using (true);

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
for update to authenticated using (id=auth.uid()) with check(id=auth.uid());

drop policy if exists "members read own conversations" on public.conversations;
create policy "members read own conversations" on public.conversations
for select to authenticated
using (
  exists(select 1 from public.conversation_members m where m.conversation_id=id and m.user_id=auth.uid())
  or (is_public=true and kind in ('group','channel'))
);

drop policy if exists "members read membership" on public.conversation_members;
create policy "members read membership" on public.conversation_members
for select to authenticated
using (
  user_id=auth.uid()
  or exists(select 1 from public.conversation_members m where m.conversation_id=conversation_id and m.user_id=auth.uid())
);

drop policy if exists "admins read admins" on public.conversation_admins;
create policy "admins read admins" on public.conversation_admins
for select to authenticated
using (
  user_id=auth.uid()
  or exists(select 1 from public.conversation_admins a where a.conversation_id=conversation_id and a.user_id=auth.uid())
);

drop policy if exists "bots authenticated read" on public.bot_accounts;
create policy "bots authenticated read" on public.bot_accounts
for select to authenticated using (true);

drop policy if exists "members read messages" on public.messages;
create policy "members read messages" on public.messages
for select to authenticated
using (
  exists(select 1 from public.conversation_members m where m.conversation_id=conversation_id and m.user_id=auth.uid())
);

drop policy if exists "members send messages" on public.messages;
create policy "members send messages" on public.messages
for insert to authenticated
with check (
  sender_id=auth.uid()
  and bot_id is null
  and exists(select 1 from public.conversation_members m where m.conversation_id=conversation_id and m.user_id=auth.uid())
);

drop policy if exists "settings authenticated read" on public.app_settings;
create policy "settings authenticated read" on public.app_settings
for select to authenticated using (true);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,display_name,username,bio)
  values(
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name','کاربر'),
    nullif(lower(new.raw_user_meta_data->>'username'),''),
    coalesce(new.raw_user_meta_data->>'bio','')
  )
  on conflict(id) do update set email=excluded.email;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users for each row execute procedure public.handle_new_user();

-- Only this exact account can ever become the application owner.
create or replace function public.bootstrap_bipolarchat()
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  uid uuid := auth.uid();
  email_value text;
  owner_id uuid;
  official_id uuid;
  bot_id uuid;
begin
  if uid is null then raise exception 'authentication required'; end if;

  select lower(email) into email_value from auth.users where id=uid;
  if email_value <> 'farrokhzad743@gmail.com' then
    raise exception 'owner bootstrap denied';
  end if;

  insert into public.profiles(id,email,display_name,username,bio,role,is_verified)
  values(uid,email_value,'Bipolar','bipolar','مالک اصلی BipolarChat','owner',true)
  on conflict(id) do update set
    email=excluded.email,
    username='bipolar',
    role='owner',
    is_verified=true;

  update public.profiles
    set role='user', is_verified=false
    where id<>uid and role='owner';

  select uid into owner_id;

  insert into public.bot_accounts(username,display_name,description,bot_type,owner_id,is_verified,enabled)
  values(
    'notification',
    'BipolarChat Notifications',
    'ربات رسمی اعلانات ورود، امنیت و تغییرات حساب BipolarChat',
    'notification',
    owner_id,
    true,
    true
  )
  on conflict (username) do update set
    display_name=excluded.display_name,
    description=excluded.description,
    owner_id=excluded.owner_id,
    is_verified=true,
    enabled=true
  returning id into bot_id;

  select id into official_id
  from public.conversations
  where lower(username)='bipolar_ir'
  limit 1;

  if official_id is null then
    insert into public.conversations(
      title,description,kind,is_group,username,is_public,is_verified,owner_id
    ) values(
      'BipolarChat',
      'کانال رسمی اطلاع‌رسانی برنامه BipolarChat',
      'channel',false,'bipolar_ir',true,true,owner_id
    ) returning id into official_id;
  else
    update public.conversations set
      title='BipolarChat',
      description='کانال رسمی اطلاع‌رسانی برنامه BipolarChat',
      kind='channel',
      is_group=false,
      username='bipolar_ir',
      is_public=true,
      is_verified=true,
      owner_id=owner_id
    where id=official_id;
  end if;

  insert into public.conversation_members(conversation_id,user_id)
  values(official_id,owner_id)
  on conflict do nothing;

  insert into public.conversation_admins(conversation_id,user_id,role)
  values(official_id,owner_id,'owner')
  on conflict(conversation_id,user_id) do update set role='owner';

  insert into public.app_settings(
    id,owner_user_id,official_channel_id,notification_bot_id,
    app_name,owner_username,official_channel_username,notification_bot_username,updated_at
  ) values(
    true,owner_id,official_id,bot_id,
    'BipolarChat','bipolar','bipolar_ir','notification',now()
  )
  on conflict(id) do update set
    owner_user_id=excluded.owner_user_id,
    official_channel_id=excluded.official_channel_id,
    notification_bot_id=excluded.notification_bot_id,
    app_name='BipolarChat',
    owner_username='bipolar',
    official_channel_username='bipolar_ir',
    notification_bot_username='notification',
    updated_at=now();

  return jsonb_build_object(
    'owner_id',owner_id,
    'owner_username','bipolar',
    'official_channel_id',official_id,
    'official_channel_username','bipolar_ir',
    'notification_bot_id',bot_id,
    'notification_bot_username','notification'
  );
end $$;
grant execute on function public.bootstrap_bipolarchat() to authenticated;

-- Backwards-compatible name used by the client, but it is now restricted to the exact owner email.
create or replace function public.claim_owner()
returns boolean
language plpgsql security definer set search_path=public as $$
declare ok boolean;
begin
  select (lower(email)='farrokhzad743@gmail.com') into ok
  from public.profiles where id=auth.uid();
  if not coalesce(ok,false) then raise exception 'owner claim denied'; end if;
  perform public.bootstrap_bipolarchat();
  return true;
end $$;
grant execute on function public.claim_owner() to authenticated;

create or replace function public.update_my_profile(
  p_display_name text,
  p_username text,
  p_bio text
) returns public.profiles
language plpgsql security definer set search_path=public as $$
declare out_profile public.profiles;
declare current_role text;
begin
  select role into current_role from public.profiles where id=auth.uid();

  if current_role='owner' and lower(trim(coalesce(p_username,''))) <> 'bipolar' then
    raise exception 'owner username is reserved as bipolar';
  end if;

  if p_username is not null and p_username<>'' then
    if p_username !~ '^[a-zA-Z0-9_]{3,32}$' then raise exception 'invalid username'; end if;
    if exists(select 1 from public.profiles where lower(username)=lower(p_username) and id<>auth.uid())
       or exists(select 1 from public.conversations where lower(username)=lower(p_username))
       or exists(select 1 from public.bot_accounts where lower(username)=lower(p_username)) then
      raise exception 'username already exists';
    end if;
  end if;

  update public.profiles
    set display_name=coalesce(nullif(trim(p_display_name),''),'کاربر'),
        username=case when current_role='owner' then 'bipolar' else nullif(lower(trim(p_username)),'') end,
        bio=coalesce(p_bio,'')
  where id=auth.uid()
  returning * into out_profile;
  return out_profile;
end $$;
grant execute on function public.update_my_profile(text,text,text) to authenticated;

create or replace function public.create_private_conversation(other_user uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare c uuid;
begin
  if other_user=auth.uid() then raise exception 'cannot chat with yourself'; end if;
  if not exists(select 1 from public.profiles where id=other_user) then raise exception 'user not found'; end if;

  select cm1.conversation_id into c
  from public.conversation_members cm1
  join public.conversation_members cm2 on cm2.conversation_id=cm1.conversation_id
  join public.conversations co on co.id=cm1.conversation_id
  where cm1.user_id=auth.uid() and cm2.user_id=other_user and co.kind='private'
  limit 1;
  if c is not null then return c; end if;

  insert into public.conversations(title,kind,is_group,owner_id)
  values(null,'private',false,auth.uid()) returning id into c;
  insert into public.conversation_members values(c,auth.uid()),(c,other_user);
  return c;
end $$;
grant execute on function public.create_private_conversation(uuid) to authenticated;

create or replace function public.create_community(
  p_kind text,
  p_title text,
  p_username text default null,
  p_description text default '',
  p_is_public boolean default true
) returns uuid
language plpgsql security definer set search_path=public as $$
declare c uuid;
begin
  if p_kind not in ('group','channel') then raise exception 'invalid community type'; end if;
  if trim(coalesce(p_title,''))='' then raise exception 'title required'; end if;

  if p_username is not null and p_username<>'' then
    if p_username !~ '^[a-zA-Z0-9_]{3,32}$' then raise exception 'invalid username'; end if;
    if exists(select 1 from public.profiles where lower(username)=lower(p_username))
       or exists(select 1 from public.conversations where lower(username)=lower(p_username))
       or exists(select 1 from public.bot_accounts where lower(username)=lower(p_username)) then
      raise exception 'username already exists';
    end if;
  end if;

  insert into public.conversations(
    title,description,kind,is_group,username,is_public,owner_id
  ) values(
    trim(p_title),coalesce(p_description,''),p_kind,p_kind='group',
    nullif(lower(trim(p_username)),''),coalesce(p_is_public,true),auth.uid()
  ) returning id into c;

  insert into public.conversation_members(conversation_id,user_id)
  values(c,auth.uid());

  insert into public.conversation_admins(conversation_id,user_id,role)
  values(c,auth.uid(),'owner');

  return c;
end $$;
grant execute on function public.create_community(text,text,text,text,boolean) to authenticated;

-- ONLY the exact owner may verify users. Admins cannot grant verification.
create or replace function public.set_profile_verification(
  p_user_id uuid,
  p_verified boolean
) returns boolean
language plpgsql security definer set search_path=public as $$
declare owner_id uuid;
begin
  select owner_user_id into owner_id from public.app_settings where id=true;
  if auth.uid()<>owner_id then raise exception 'only the application owner can verify users'; end if;
  if p_user_id=owner_id and not p_verified then raise exception 'owner must remain verified'; end if;
  update public.profiles set is_verified=p_verified where id=p_user_id;
  return found;
end $$;
grant execute on function public.set_profile_verification(uuid,boolean) to authenticated;

-- ONLY the application owner may manage verification of official communities.
create or replace function public.set_conversation_verification(
  p_conversation_id uuid,
  p_verified boolean
) returns boolean
language plpgsql security definer set search_path=public as $$
declare owner_id uuid;
begin
  select owner_user_id into owner_id from public.app_settings where id=true;
  if auth.uid()<>owner_id then raise exception 'only the application owner can verify'; end if;
  update public.conversations set is_verified=p_verified where id=p_conversation_id;
  return found;
end $$;
grant execute on function public.set_conversation_verification(uuid,boolean) to authenticated;

-- Owner-only bot message function. Frontend users can never impersonate the bot.
create or replace function public.send_bot_message(
  p_bot_username text,
  p_conversation_id uuid,
  p_body text
) returns uuid
language plpgsql security definer set search_path=public as $$
declare owner_id uuid;
declare bot_uuid uuid;
declare message_uuid uuid;
begin
  select owner_user_id into owner_id from public.app_settings where id=true;
  if auth.uid()<>owner_id then raise exception 'only the application owner can send bot messages'; end if;

  select id into bot_uuid from public.bot_accounts
    where lower(username)=lower(p_bot_username) and enabled=true;
  if bot_uuid is null then raise exception 'bot not found'; end if;

  if trim(coalesce(p_body,''))='' then raise exception 'message body required'; end if;

  insert into public.messages(conversation_id,sender_id,bot_id,body)
  values(p_conversation_id,null,bot_uuid,trim(p_body))
  returning id into message_uuid;

  return message_uuid;
end $$;
grant execute on function public.send_bot_message(text,uuid,text) to authenticated;

-- Safe to run repeatedly.
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;


-- =========================================================
-- BipolarChat v5 safety migration
-- Run once after the base schema. Preserves existing data.
-- =========================================================

-- The client must never be able to directly change role/verification.
revoke update on public.profiles from authenticated;

-- Normalize legacy data: only the designated owner remains verified/owner.
update public.profiles
set role='user', is_verified=false
where lower(coalesce(email,'')) <> 'farrokhzad743@gmail.com';

-- Free the reserved owner username from any legacy account.
update public.profiles
set username=null
where lower(coalesce(username,''))='bipolar'
  and lower(coalesce(email,'')) <> 'farrokhzad743@gmail.com';

update public.profiles
set role='owner', username='bipolar', is_verified=true
where lower(coalesce(email,'')) = 'farrokhzad743@gmail.com';

-- Only the exact owner account can bootstrap the application.
create or replace function public.bootstrap_bipolarchat()
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  uid uuid := auth.uid();
  email_value text;
  owner_id uuid;
  official_id uuid;
  bot_id uuid;
begin
  if uid is null then raise exception 'authentication required'; end if;
  select lower(email) into email_value from auth.users where id=uid;
  if email_value <> 'farrokhzad743@gmail.com' then raise exception 'owner bootstrap denied'; end if;

  insert into public.profiles(id,email,display_name,username,bio,role,is_verified)
  values(uid,email_value,'Bipolar','bipolar','مالک اصلی BipolarChat','owner',true)
  on conflict(id) do update set
    email=excluded.email, username='bipolar', role='owner', is_verified=true;

  update public.profiles set role='user', is_verified=false
  where id<>uid;

  owner_id := uid;

  insert into public.bot_accounts(username,display_name,description,bot_type,owner_id,is_verified,enabled)
  values('notification','BipolarChat Notifications','ربات رسمی اعلانات ورود، امنیت و تغییرات حساب BipolarChat','notification',owner_id,true,true)
  on conflict(username) do update set
    display_name=excluded.display_name, description=excluded.description,
    bot_type=excluded.bot_type, owner_id=excluded.owner_id, is_verified=true, enabled=true
  returning id into bot_id;

  select id into official_id from public.conversations where lower(username)='bipolar_ir' limit 1;
  if official_id is null then
    insert into public.conversations(title,description,kind,is_group,username,is_public,is_verified,owner_id)
    values('BipolarChat','کانال رسمی اطلاع‌رسانی برنامه BipolarChat','channel',false,'bipolar_ir',true,true,owner_id)
    returning id into official_id;
  else
    update public.conversations set title='BipolarChat', description='کانال رسمی اطلاع‌رسانی برنامه BipolarChat',
      kind='channel', is_group=false, username='bipolar_ir', is_public=true, is_verified=true, owner_id=owner_id
    where id=official_id;
  end if;

  insert into public.conversation_members(conversation_id,user_id) values(official_id,owner_id) on conflict do nothing;
  insert into public.conversation_admins(conversation_id,user_id,role) values(official_id,owner_id,'owner')
  on conflict(conversation_id,user_id) do update set role='owner';

  insert into public.app_settings(id,owner_user_id,official_channel_id,notification_bot_id,app_name,owner_username,official_channel_username,notification_bot_username,updated_at)
  values(true,owner_id,official_id,bot_id,'BipolarChat','bipolar','bipolar_ir','notification',now())
  on conflict(id) do update set owner_user_id=excluded.owner_user_id, official_channel_id=excluded.official_channel_id, notification_bot_id=excluded.notification_bot_id, updated_at=now();

  return jsonb_build_object('owner_id',owner_id,'owner_username','bipolar','official_channel_id',official_id,'official_channel_username','bipolar_ir','notification_bot_id',bot_id,'notification_bot_username','notification');
end $$;

-- Verification is Owner-only and the owner cannot be unverified.
create or replace function public.set_profile_verification(p_user_id uuid, p_verified boolean)
returns boolean language plpgsql security definer set search_path=public as $$
declare owner_id uuid;
begin
  select owner_user_id into owner_id from public.app_settings where id=true;
  if auth.uid()<>owner_id then raise exception 'only the application owner can verify users'; end if;
  if p_user_id=owner_id and not p_verified then raise exception 'owner must remain verified'; end if;
  update public.profiles set is_verified=p_verified where id=p_user_id;
  return found;
end $$;

-- Profile changes happen only through the controlled RPC.
create or replace function public.update_my_profile(p_display_name text,p_username text,p_bio text)
returns public.profiles language plpgsql security definer set search_path=public as $$
declare out_profile public.profiles; current_role text; current_username text;
begin
  select role,username into current_role,current_username from public.profiles where id=auth.uid();
  if current_role='owner' then
    if lower(trim(coalesce(p_username,''))) <> 'bipolar' then raise exception 'owner username is reserved as bipolar'; end if;
  elsif p_username is not null and p_username<>'' then
    if p_username !~ '^[a-zA-Z0-9_]{3,32}$' then raise exception 'invalid username'; end if;
    if exists(select 1 from public.profiles where lower(username)=lower(p_username) and id<>auth.uid())
       or exists(select 1 from public.conversations where lower(username)=lower(p_username))
       or exists(select 1 from public.bot_accounts where lower(username)=lower(p_username)) then
      raise exception 'username already exists';
    end if;
  end if;
  update public.profiles set display_name=coalesce(nullif(trim(p_display_name),''),'کاربر'),
    username=case when current_role='owner' then 'bipolar' else nullif(lower(trim(p_username)),'') end,
    bio=coalesce(p_bio,'') where id=auth.uid() returning * into out_profile;
  return out_profile;
end $$;

grant execute on function public.bootstrap_bipolarchat() to authenticated;
grant execute on function public.set_profile_verification(uuid,boolean) to authenticated;
grant execute on function public.update_my_profile(text,text,text) to authenticated;


-- ============================================================
-- v6 migration is maintained separately in supabase_v6_migration.sql
-- Run that file after this base schema for an existing project.
-- ============================================================
