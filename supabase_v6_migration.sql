-- BipolarChat v6 Supabase migration
-- Run AFTER the existing schema/v5 migration. Idempotent and designed to preserve data.
-- Application name: BipolarChat. Nova is only the source repository name.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) Normalize the single application owner
-- ------------------------------------------------------------

do $$
declare
  owner_id uuid;
begin
  select id into owner_id
  from auth.users
  where lower(email) = 'farrokhzad743@gmail.com'
  order by created_at
  limit 1;

  if owner_id is not null then
    update public.profiles
      set role='user', is_verified=false
      where id <> owner_id;

    update public.profiles
      set username=null
      where id <> owner_id and lower(coalesce(username,''))='bipolar';

    insert into public.profiles(id,email,display_name,username,bio,role,is_verified)
    select owner_id, lower(email), 'Bipolar', 'bipolar', 'مالک اصلی BipolarChat', 'owner', true
    from auth.users where id=owner_id
    on conflict(id) do update set
      email=excluded.email,
      username='bipolar',
      role='owner',
      is_verified=true;
  end if;
end $$;

-- ------------------------------------------------------------
-- 2) Remove direct profile privilege escalation
-- ------------------------------------------------------------

drop policy if exists "own profile update" on public.profiles;
revoke update on public.profiles from authenticated;

-- Keep profile edits behind the controlled RPC only.

create or replace function public.update_my_profile(
  p_display_name text,
  p_username text,
  p_bio text
) returns public.profiles
language plpgsql security definer set search_path=public as $$
declare
  out_profile public.profiles;
  current_role text;
  current_username text;
  clean_username text := nullif(lower(trim(coalesce(p_username,''))),'');
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select role, username into current_role, current_username
  from public.profiles where id=auth.uid();

  if current_role='owner' then
    if clean_username <> 'bipolar' then
      raise exception 'owner username is reserved as bipolar';
    end if;
    clean_username := 'bipolar';
  elsif clean_username is not null then
    if clean_username !~ '^[a-z0-9_]{3,32}$' then
      raise exception 'invalid username';
    end if;
    if clean_username in ('bipolar','bipolar_ir','notification') then
      raise exception 'reserved username';
    end if;
    if exists(select 1 from public.profiles where lower(username)=clean_username and id<>auth.uid())
       or exists(select 1 from public.conversations where lower(username)=clean_username)
       or exists(select 1 from public.bot_accounts where lower(username)=clean_username) then
      raise exception 'username already exists';
    end if;
  end if;

  update public.profiles
    set display_name=coalesce(nullif(trim(p_display_name),''),'کاربر'),
        username=clean_username,
        bio=coalesce(p_bio,'')
  where id=auth.uid()
  returning * into out_profile;

  if out_profile.id is null then raise exception 'profile not found'; end if;
  return out_profile;
end $$;

grant execute on function public.update_my_profile(text,text,text) to authenticated;

-- ------------------------------------------------------------
-- 3) Fix community creation: groups/channels are created via RPC
-- ------------------------------------------------------------

create or replace function public.create_community(
  p_kind text,
  p_title text,
  p_username text default null,
  p_description text default '',
  p_is_public boolean default true
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  c uuid;
  clean_username text := nullif(lower(trim(coalesce(p_username,''))),'');
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_kind not in ('group','channel') then raise exception 'invalid community type'; end if;
  if trim(coalesce(p_title,''))='' then raise exception 'title required'; end if;

  if clean_username is not null then
    if clean_username !~ '^[a-z0-9_]{3,32}$' then raise exception 'invalid username'; end if;
    if clean_username in ('bipolar','bipolar_ir','notification') then
      raise exception 'reserved username';
    end if;
    if exists(select 1 from public.profiles where lower(username)=clean_username)
       or exists(select 1 from public.conversations where lower(username)=clean_username)
       or exists(select 1 from public.bot_accounts where lower(username)=clean_username) then
      raise exception 'username already exists';
    end if;
  end if;

  insert into public.conversations(title,description,kind,is_group,username,is_public,is_verified,owner_id)
  values(trim(p_title),coalesce(p_description,''),p_kind,p_kind='group',clean_username,coalesce(p_is_public,true),false,auth.uid())
  returning id into c;

  insert into public.conversation_members(conversation_id,user_id)
  values(c,auth.uid()) on conflict do nothing;

  insert into public.conversation_admins(conversation_id,user_id,role)
  values(c,auth.uid(),'owner') on conflict do nothing;

  return c;
end $$;

grant execute on function public.create_community(text,text,text,text,boolean) to authenticated;

-- ------------------------------------------------------------
-- 4) Owner bootstrap: @bipolar + official channel + notification bot
-- ------------------------------------------------------------

create or replace function public.bootstrap_bipolarchat()
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  uid uuid := auth.uid();
  email_value text;
  official_id uuid;
  bot_id uuid;
begin
  if uid is null then raise exception 'authentication required'; end if;
  select lower(email) into email_value from auth.users where id=uid;
  if email_value <> 'farrokhzad743@gmail.com' then raise exception 'owner bootstrap denied'; end if;

  update public.profiles set role='user', is_verified=false where id<>uid;
  update public.profiles set username=null where id<>uid and lower(coalesce(username,''))='bipolar';

  insert into public.profiles(id,email,display_name,username,bio,role,is_verified)
  values(uid,email_value,'Bipolar','bipolar','مالک اصلی BipolarChat','owner',true)
  on conflict(id) do update set
    email=excluded.email, display_name='Bipolar', username='bipolar',
    role='owner', is_verified=true;

  insert into public.bot_accounts(username,display_name,description,bot_type,owner_id,is_verified,enabled)
  values('notification','BipolarChat Notifications','ربات رسمی اعلانات ورود، امنیت و تغییرات حساب BipolarChat','notification',uid,true,true)
  on conflict(username) do update set
    display_name=excluded.display_name,
    description=excluded.description,
    bot_type=excluded.bot_type,
    owner_id=excluded.owner_id,
    is_verified=true,
    enabled=true
  returning id into bot_id;

  select id into official_id from public.conversations where lower(username)='bipolar_ir' limit 1;
  if official_id is null then
    insert into public.conversations(title,description,kind,is_group,username,is_public,is_verified,owner_id)
    values('BipolarChat','کانال رسمی اطلاع‌رسانی برنامه BipolarChat','channel',false,'bipolar_ir',true,true,uid)
    returning id into official_id;
  else
    update public.conversations set
      title='BipolarChat',
      description='کانال رسمی اطلاع‌رسانی برنامه BipolarChat',
      kind='channel', is_group=false, username='bipolar_ir',
      is_public=true, is_verified=true, owner_id=uid
    where id=official_id;
  end if;

  insert into public.conversation_members(conversation_id,user_id) values(official_id,uid) on conflict do nothing;
  insert into public.conversation_admins(conversation_id,user_id,role) values(official_id,uid,'owner')
    on conflict(conversation_id,user_id) do update set role='owner';

  insert into public.app_settings(id,owner_user_id,official_channel_id,notification_bot_id,app_name,owner_username,official_channel_username,notification_bot_username,updated_at)
  values(true,uid,official_id,bot_id,'BipolarChat','bipolar','bipolar_ir','notification',now())
  on conflict(id) do update set
    owner_user_id=uid, official_channel_id=official_id, notification_bot_id=bot_id,
    app_name='BipolarChat', owner_username='bipolar',
    official_channel_username='bipolar_ir', notification_bot_username='notification', updated_at=now();

  return jsonb_build_object('owner_id',uid,'owner_username','bipolar','official_channel_id',official_id,'official_channel_username','bipolar_ir','notification_bot_id',bot_id,'notification_bot_username','notification');
end $$;

grant execute on function public.bootstrap_bipolarchat() to authenticated;

-- ------------------------------------------------------------
-- 5) Verification: owner only
-- ------------------------------------------------------------

create or replace function public.set_profile_verification(p_user_id uuid, p_verified boolean)
returns boolean language plpgsql security definer set search_path=public as $$
declare owner_id uuid;
begin
  select owner_user_id into owner_id from public.app_settings where id=true;
  if auth.uid() is null or auth.uid()<>owner_id then
    raise exception 'only the application owner can verify users';
  end if;
  if p_user_id=owner_id and not p_verified then raise exception 'owner must remain verified'; end if;
  update public.profiles set is_verified=p_verified, role=case when id=owner_id then 'owner' else role end where id=p_user_id;
  return found;
end $$;

grant execute on function public.set_profile_verification(uuid,boolean) to authenticated;

-- ------------------------------------------------------------
-- 6) RLS: no direct privilege escalation, but public/community read works
-- ------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.conversation_admins enable row level security;
alter table public.messages enable row level security;
alter table public.bot_accounts enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "own profile update" on public.profiles;
drop policy if exists "profiles authenticated read" on public.profiles;
create policy "profiles authenticated read" on public.profiles for select to authenticated using (true);

drop policy if exists "members read own conversations" on public.conversations;
create policy "members read own conversations" on public.conversations for select to authenticated
using (exists(select 1 from public.conversation_members m where m.conversation_id=id and m.user_id=auth.uid())
   or (is_public=true and kind in ('group','channel')));

drop policy if exists "members read membership" on public.conversation_members;
create policy "members read membership" on public.conversation_members for select to authenticated
using (user_id=auth.uid() or exists(select 1 from public.conversation_members m where m.conversation_id=conversation_id and m.user_id=auth.uid()));

drop policy if exists "members read messages" on public.messages;
create policy "members read messages" on public.messages for select to authenticated
using (exists(select 1 from public.conversation_members m where m.conversation_id=conversation_id and m.user_id=auth.uid()));

drop policy if exists "members send messages" on public.messages;
create policy "members send messages" on public.messages for insert to authenticated
with check (sender_id=auth.uid() and bot_id is null and exists(select 1 from public.conversation_members m where m.conversation_id=conversation_id and m.user_id=auth.uid()));

drop policy if exists "bots authenticated read" on public.bot_accounts;
create policy "bots authenticated read" on public.bot_accounts for select to authenticated using (true);

drop policy if exists "settings authenticated read" on public.app_settings;
create policy "settings authenticated read" on public.app_settings for select to authenticated using (true);

-- Explicitly remove direct writes that could bypass RPCs.
revoke insert, update, delete on public.profiles from authenticated;
revoke insert, update, delete on public.app_settings from authenticated;
revoke insert, update, delete on public.bot_accounts from authenticated;
revoke insert, update, delete on public.conversations from authenticated;
revoke insert, update, delete on public.conversation_members from authenticated;
revoke insert, update, delete on public.conversation_admins from authenticated;

-- ------------------------------------------------------------
-- 7) Ensure the official objects exist now if the owner is present
-- ------------------------------------------------------------

do $$
declare owner_id uuid;
begin
  select id into owner_id from auth.users where lower(email)='farrokhzad743@gmail.com' limit 1;
  if owner_id is not null then
    perform public.bootstrap_bipolarchat();
  end if;
exception when others then
  -- If the owner is not currently authenticated, the bootstrap can be called from the app after login.
  null;
end $$;

-- Realtime
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;
