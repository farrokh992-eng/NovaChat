create table if not exists public.saved_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 message_id uuid null,
 content text not null,
 created_at timestamptz not null default now()
);
create index if not exists saved_messages_user_created_idx on public.saved_messages(user_id,created_at desc);
alter table public.saved_messages enable row level security;
drop policy if exists saved_messages_select_own on public.saved_messages;
create policy saved_messages_select_own on public.saved_messages for select to authenticated using(user_id=auth.uid());
drop policy if exists saved_messages_insert_own on public.saved_messages;
create policy saved_messages_insert_own on public.saved_messages for insert to authenticated with check(user_id=auth.uid());
drop policy if exists saved_messages_update_own on public.saved_messages;
create policy saved_messages_update_own on public.saved_messages for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists saved_messages_delete_own on public.saved_messages;
create policy saved_messages_delete_own on public.saved_messages for delete to authenticated using(user_id=auth.uid());
