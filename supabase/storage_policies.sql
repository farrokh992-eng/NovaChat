-- Run this ONCE in Supabase SQL Editor (Dashboard) as the project database owner.
-- The automated migration cannot create policies on storage.objects because that table is owned by Supabase's storage role.

drop policy if exists "BipolarChat media upload own" on storage.objects;
create policy "BipolarChat media upload own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'bipolarchat-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "BipolarChat media read own" on storage.objects;
create policy "BipolarChat media read own"
on storage.objects for select to authenticated
using (
  bucket_id = 'bipolarchat-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "BipolarChat media delete own" on storage.objects;
create policy "BipolarChat media delete own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'bipolarchat-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
