-- Tenant-scoped Storage boundary for the private attachments bucket.
-- Canonical object layout: vault/<company_id>/...

DROP POLICY IF EXISTS "attachments_tenant_select" ON storage.objects;
DROP POLICY IF EXISTS "attachments_tenant_insert" ON storage.objects;
DROP POLICY IF EXISTS "attachments_tenant_update" ON storage.objects;
DROP POLICY IF EXISTS "attachments_tenant_delete" ON storage.objects;

CREATE POLICY "attachments_tenant_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = 'vault'
  AND (storage.foldername(name))[2] = public.current_company_id()::text
);

CREATE POLICY "attachments_tenant_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = 'vault'
  AND (storage.foldername(name))[2] = public.current_company_id()::text
);

CREATE POLICY "attachments_tenant_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = 'vault'
  AND (storage.foldername(name))[2] = public.current_company_id()::text
)
WITH CHECK (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = 'vault'
  AND (storage.foldername(name))[2] = public.current_company_id()::text
);

CREATE POLICY "attachments_tenant_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = 'vault'
  AND (storage.foldername(name))[2] = public.current_company_id()::text
);
