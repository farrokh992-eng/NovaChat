-- BipolarChat v6 Pro messaging core
alter table public.messages add column if not exists message_type text not null default 'text';
alter table public.messages add column if not exists file_url text;
alter table public.messages add column if not exists file_name text;
alter table public.messages add column if not exists file_size bigint;
alter table public.messages add column if not exists mime_type text;
alter table public.messages add column if not exists duration_seconds integer;
alter table public.messages add column if not exists reply_to_id uuid references public.messages(id) on delete set null;

-- The production database also contains:
-- create_private_conversation(uuid)
-- join_public_channel(text)
-- ensure_notification_chat()
-- send_notification(uuid,text)
-- ensure_saved_messages_chat()
-- save_message_and_copy(uuid)
-- These were applied to project dxuwbxjqacizrguofivk.
-- Storage bucket: bipolarchat-media.
-- Storage policies are in ../storage_policies.sql and must be run by the DB owner.
