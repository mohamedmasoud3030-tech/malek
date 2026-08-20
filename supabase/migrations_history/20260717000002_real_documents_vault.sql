-- Phase: Real Documents Vault
-- Creates vault_documents table for general document archiving
-- Uses storage bucket 'attachments' (existing) and enhanced metadata

begin;

-- 1. Create vault_documents table if not exists (general vault, not just contracts)
create table if not exists public.vault_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  category text not null default 'contracts' check (category in ('all','contracts','identity','receipts','maintenance','expenses','utilities','other')),
  related_entity_type text check (related_entity_type in ('property','unit','person','contract','invoice','payment','receipt','expense','maintenance','utility_bill','tenant','owner')),
  related_entity_id text,
  file_name text not null,
  file_url text not null,
  storage_path text not null,
  file_size bigint check (file_size is null or file_size > 0),
  mime_type text,
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_vault_documents_category on public.vault_documents(category) where deleted_at is null;
create index if not exists idx_vault_documents_entity on public.vault_documents(related_entity_type, related_entity_id) where deleted_at is null;
create index if not exists idx_vault_documents_created on public.vault_documents(created_at desc) where deleted_at is null;

alter table public.vault_documents enable row level security;

drop policy if exists app_read_vault_documents on public.vault_documents;
drop policy if exists manager_write_vault_documents on public.vault_documents;
drop policy if exists app_user_vault_documents on public.vault_documents;

create policy app_read_vault_documents on public.vault_documents
  for select to authenticated
  using (public.is_app_user());

create policy manager_write_vault_documents on public.vault_documents
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

grant select on public.vault_documents to authenticated;
grant insert, update on public.vault_documents to authenticated;
revoke delete on public.vault_documents from authenticated;

-- 2. Ensure contract_documents also hardened to manager write (already exists but ensure policy)
alter table public.contract_documents enable row level security;

drop policy if exists app_user_contract_documents on public.contract_documents;
drop policy if exists app_read_contract_documents on public.contract_documents;
drop policy if exists manager_write_contract_documents on public.contract_documents;

create policy app_read_contract_documents on public.contract_documents
  for select to authenticated
  using (public.is_app_user());

create policy manager_write_contract_documents on public.contract_documents
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

grant select on public.contract_documents to authenticated;
grant insert, update on public.contract_documents to authenticated;
revoke delete on public.contract_documents from authenticated;

-- 3. Trigger for updated_at
drop trigger if exists trg_vault_documents_updated_at on public.vault_documents;
create trigger trg_vault_documents_updated_at
  before update on public.vault_documents
  for each row execute function public.set_updated_at();

-- 4. Ensure storage bucket exists (idempotent)
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('attachments', 'attachments', false)
    on conflict (id) do update set public = false;
  end if;
end $$;

-- 5. Storage RLS for attachments bucket
do $$
begin
  if to_regclass('storage.objects') is not null then
    -- Drop existing policies if they exist
    drop policy if exists attachments_authenticated_read on storage.objects;
    drop policy if exists attachments_authenticated_insert on storage.objects;
    drop policy if exists attachments_manager_write on storage.objects;
    drop policy if exists attachments_manager_delete on storage.objects;

    -- Read for all app users
    execute 'create policy attachments_authenticated_read on storage.objects for select to authenticated using (bucket_id = ''attachments'' and public.is_app_user())';
    -- Insert for managers/admins only
    execute 'create policy attachments_authenticated_insert on storage.objects for insert to authenticated with check (bucket_id = ''attachments'' and public.is_admin_or_manager())';
    -- Update for managers/admins only
    execute 'create policy attachments_manager_write on storage.objects for update to authenticated using (bucket_id = ''attachments'' and public.is_admin_or_manager()) with check (bucket_id = ''attachments'' and public.is_admin_or_manager())';
    -- Delete revoked (soft delete via metadata, but storage delete also restricted)
    execute 'create policy attachments_manager_delete on storage.objects for delete to authenticated using (bucket_id = ''attachments'' and public.is_admin_or_manager())';
  end if;
end $$;

commit;
