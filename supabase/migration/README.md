BipolarChat v6 Pro migrations:
- 20260811000000_saved_messages.sql
- Messaging/attachments/official channel/notification functions were applied directly to project dxuwbxjqacizrguofivk.
- storage_policies.sql must be run once in Supabase Dashboard SQL Editor by the database owner because storage.objects ownership prevents the automation role from creating policies.
