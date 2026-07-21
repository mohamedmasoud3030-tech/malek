-- Harden the private attachments bucket: pin the storage contract that the
-- application and release gate enforce end-to-end.
--
-- Contract (must stay in sync with rentrix-app/src/lib/attachments-contract.ts
-- and supabase/tests/security_drift_checks.sql test #6):
--   public            = false
--   file_size_limit   = 5242880 bytes (5MB)
--   allowed_mime_types = application/pdf, image/jpeg, image/png, image/webp (exact set)
--
-- The canonical storage.objects policies (attachments_authenticated_read /
-- attachments_authenticated_insert / attachments_manager_write /
-- attachments_manager_delete) are owned by 20260717000002_real_documents_vault.sql,
-- and 20260719150000_drop_rogue_permissive_attachments_upload_policy.sql already
-- removed the legacy broad uploader; both stay the source of truth for policy
-- shape. This migration does not recreate them — supabase/tests pgTAP check #7
-- proves on every replay that every attachments mutation policy requires
-- is_admin_or_manager().
--
-- Applying this migration to production requires explicit product-owner approval.

begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'attachments',
  'attachments',
  false,
  5242880,
  array['application/pdf','image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types,
    updated_at = now();

-- Defence in depth: idempotently re-drop the legacy permissive uploader in case
-- it was manually recreated in an environment where 20260719150000 did not run.
drop policy if exists "authenticated upload attachments" on storage.objects;

commit;
