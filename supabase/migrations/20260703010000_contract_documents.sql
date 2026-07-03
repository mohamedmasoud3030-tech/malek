begin;

-- Real contract document management (upload/list/delete), backed by the existing
-- public 'attachments' storage bucket. Previously the UI shell was a disabled
-- no-op; this closes that gap with real persistence + RLS.
create table if not exists public.contract_documents (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  storage_path text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists contract_documents_contract_idx
  on public.contract_documents (contract_id, created_at desc)
  where deleted_at is null;

alter table public.contract_documents enable row level security;

drop policy if exists app_user_contract_documents on public.contract_documents;
create policy app_user_contract_documents
  on public.contract_documents for all to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());

grant select, insert, update on public.contract_documents to authenticated;
revoke delete on public.contract_documents from authenticated;

commit;
