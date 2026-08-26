-- Frontend/backend contract hardening: restore the minimum runtime ACLs that
-- direct PostgREST property writes require and lock the private attachments
-- bucket to the reviewed tenant + ADMIN/MANAGER mutation contract.
--
-- This is a forward-only correction. Existing tenant scoping remains intact;
-- the storage mutation policies only add the role gate that the application
-- and storage smoke contract already require.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'properties'
      AND c.relkind = 'r'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'public.properties must have RLS enabled before restoring authenticated write privileges';
  END IF;
END
$$;

-- The frontend performs governed direct INSERT/UPDATE operations on properties.
-- Table privileges are only the outer PostgreSQL gate; existing RLS policies
-- continue to enforce company isolation and ADMIN/MANAGER authority.
GRANT INSERT, UPDATE ON TABLE public.properties TO authenticated;

-- Canonical private attachment bucket contract used by the application and
-- isolated Storage smoke: 5 MiB max, PDFs and common web images only.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'attachments',
  'attachments',
  false,
  5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Read access remains tenant-scoped for authenticated app users. Mutations are
-- tenant-scoped AND limited to ADMIN/MANAGER. Never widen the canonical
-- vault/<company_id>/... object boundary.
DROP POLICY IF EXISTS "attachments_tenant_insert" ON storage.objects;
DROP POLICY IF EXISTS "attachments_tenant_update" ON storage.objects;
DROP POLICY IF EXISTS "attachments_tenant_delete" ON storage.objects;

CREATE POLICY "attachments_tenant_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND public.is_admin_or_manager()
  AND (storage.foldername(name))[1] = 'vault'
  AND (storage.foldername(name))[2] = public.current_company_id()::text
);

CREATE POLICY "attachments_tenant_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND public.is_admin_or_manager()
  AND (storage.foldername(name))[1] = 'vault'
  AND (storage.foldername(name))[2] = public.current_company_id()::text
)
WITH CHECK (
  bucket_id = 'attachments'
  AND public.is_admin_or_manager()
  AND (storage.foldername(name))[1] = 'vault'
  AND (storage.foldername(name))[2] = public.current_company_id()::text
);

CREATE POLICY "attachments_tenant_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND public.is_admin_or_manager()
  AND (storage.foldername(name))[1] = 'vault'
  AND (storage.foldername(name))[2] = public.current_company_id()::text
);
