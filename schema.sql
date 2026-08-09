-- NovaChat database. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 email text unique not null,
 display_name text not null default 'کاربر',
 avatar_url text,
 created_at timestamptz not null default now()
);

create table if not exists public.conversations(
 id uuid primary key default gen_random_uuid(),
 title text,
 is_group boolean not null default false,
 created_at timestamptz not null default now()
);

create table if not exists public.conversation_members(
 conversation_id uuid references public.conversations(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete cascade,
 joined_at timestamptz not null default now(),
 primary key(conversation_id,user_id)
);

create table if not exists public.messages(
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(body)<=10000),
 created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx on public.messages(conversation_id,created_at);

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,email,display_name) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'display_name','کاربر')); return new; end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create policy "profiles authenticated read" on public.profiles for select to authenticated using (true);
create policy "own profile update" on public.profiles for update to authenticated using (id=auth.uid()) with check(id=auth.uid());

create policy "members read own conversations" on public.conversations for select to authenticated using (exists(select 1 from public.conversation_members m where m.conversation_id=id and m.user_id=auth.uid()));
create policy "members read membership" on public.conversation_members for select to authenticated using (user_id=auth.uid() or exists(select 1 from public.conversation_members m where m.conversation_id=conversation_id and m.user_id=auth.uid()));
create policy "members read messages" on public.messages for select to authenticated using (exists(select 1 from public.conversation_members m where m.conversation_id=conversation_id and m.user_id=auth.uid()));
create policy "members send messages" on public.messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.conversation_members m where m.conversation_id=conversation_id and m.user_id=auth.uid()));

create or replace function public.create_private_conversation(other_user uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare c uuid;
begin
 if other_user=auth.uid() then raise exception 'cannot chat with yourself'; end if;
 select cm1.conversation_id into c from public.conversation_members cm1 join public.conversation_members cm2 on cm2.conversation_id=cm1.conversation_id join public.conversations co on co.id=cm1.conversation_id where cm1.user_id=auth.uid() and cm2.user_id=other_user and co.is_group=false limit 1;
 if c is not null then return c; end if;
 insert into public.conversations(title,is_group) values(null,false) returning id into c;
 insert into public.conversation_members values(c,auth.uid()),(c,other_user);
 return c;
end $$;

grant execute on function public.create_private_conversation(uuid) to authenticated;

alter publication supabase_realtime add table public.messages;