-- BipolarChat security hardening (reviewed patch; apply in Supabase SQL Editor only after backup)
-- Fixes recursive RLS checks for memberships/admins and prevents ordinary group/channel
-- members from posting as channel admins. This does NOT replace a full production audit.

create or replace function public.bipolar_is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = auth.uid()
  );
$$;

create or replace function public.bipolar_is_conversation_admin(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1 from public.conversation_admins ca
    where ca.conversation_id = p_conversation_id
      and ca.user_id = auth.uid()
  );
$$;

revoke all on function public.bipolar_is_conversation_member(uuid) from public, anon;
revoke all on function public.bipolar_is_conversation_admin(uuid) from public, anon;
grant execute on function public.bipolar_is_conversation_member(uuid) to authenticated;
grant execute on function public.bipolar_is_conversation_admin(uuid) to authenticated;

-- Avoid policies that query their own RLS-protected table recursively.
drop policy if exists "members read membership" on public.conversation_members;
create policy "members read membership" on public.conversation_members
for select to authenticated
using (
  user_id = auth.uid()
  or public.bipolar_is_conversation_member(conversation_id)
);

drop policy if exists "admins read admins" on public.conversation_admins;
create policy "admins read admins" on public.conversation_admins
for select to authenticated
using (
  user_id = auth.uid()
  or public.bipolar_is_conversation_admin(conversation_id)
);

drop policy if exists "members read own conversations" on public.conversations;
create policy "members read own conversations" on public.conversations
for select to authenticated
using (
  public.bipolar_is_conversation_member(id)
  or (is_public = true and kind in ('group', 'channel'))
);

drop policy if exists "members read messages" on public.messages;
create policy "members read messages" on public.messages
for select to authenticated
using (public.bipolar_is_conversation_member(conversation_id));

drop policy if exists "members send messages" on public.messages;
create policy "members send messages" on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and bot_id is null
  and public.bipolar_is_conversation_member(conversation_id)
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.kind <> 'channel' or public.bipolar_is_conversation_admin(c.id))
  )
);

-- Important: do not apply a broad profile-email revocation without updating the app's
-- owner/admin flows and user lookup RPC. See SECURITY_AUDIT.md for the remaining privacy issue.
