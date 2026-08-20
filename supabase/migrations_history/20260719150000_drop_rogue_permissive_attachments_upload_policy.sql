-- Found during release verification (2026-07-19): an untracked duplicate INSERT
-- policy "authenticated upload attachments" on storage.objects allowed ANY
-- authenticated user (any role) to upload to the private 'attachments' bucket,
-- with no admin/manager check. It overlapped with attachments_authenticated_insert
-- (which correctly requires is_admin_or_manager()) — RLS OR-combines policies for
-- the same command, so the weaker policy effectively won and defeated the
-- role restriction. Not present in any migration file; likely created manually
-- or via an untracked baseline capture, and never cleaned up when
-- 20260717000002_real_documents_vault.sql recreated attachments_authenticated_insert
-- under the same intended rule but a different underlying policy name survived.
--
-- This migration only drops the rogue duplicate. attachments_authenticated_read
-- (is_app_user(), i.e. any logged-in user can view/download) is left untouched —
-- confirmed intentional design per 20260717000002_real_documents_vault.sql
-- (shared company document vault, not per-owner scoped).

begin;

drop policy if exists "authenticated upload attachments" on storage.objects;

commit;
