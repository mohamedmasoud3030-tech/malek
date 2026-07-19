-- Harden the private attachments bucket and remove a legacy broad upload policy.
-- The legacy policy allowed every authenticated user to insert objects and
-- bypassed the intended ADMIN/MANAGER-only write contract.

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

-- Historical policy from the original bucket setup. It only checked bucket_id
-- and therefore allowed any authenticated account to upload.
drop policy if exists "authenticated upload attachments" on storage.objects;

-- Recreate the canonical policy set explicitly so future replay does not depend
-- on whatever policies happened to exist on the target project.
drop policy if exists attachments_authenticated_read on storage.objects;
drop policy if exists attachments_authenticated_insert on storage.objects;
drop policy if exists attachments_manager_write on storage.objects;
drop policy if exists attachments_manager_delete on storage.objects;

create policy attachments_authenticated_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'attachments'
  and public.is_app_user()
);

create policy attachments_authenticated_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'attachments'
  and public.is_admin_or_manager()
);

create policy attachments_manager_write
on storage.objects
for update
to authenticated
using (
  bucket_id = 'attachments'
  and public.is_admin_or_manager()
)
with check (
  bucket_id = 'attachments'
  and public.is_admin_or_manager()
);

create policy attachments_manager_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'attachments'
  and public.is_admin_or_manager()
);

commit;
