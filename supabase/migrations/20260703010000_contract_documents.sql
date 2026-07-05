-- STATUS AS OF 2026-07-05: APPLIED to nnggcnpcuomwfuupupwg (production) via
-- apply_migration. Confirmed via information_schema.tables that
-- public.contract_documents now exists live, unblocking the PR #1036
-- frontend feature (contract document upload/list/delete).
--
-- SCHEMA DRIFT FIX (2026-07-05): the original version of this file declared
-- contract_id as uuid, referencing public.contracts(id). Applying it against
-- production failed with "Key columns contract_id and id are of incompatible
-- types: uuid and text" — live public.contracts.id is text, not uuid
-- (confirmed via information_schema.columns). Corrected below to text to
-- match the live column and keep the foreign key valid. See
-- supabase/migrations/README.md.

begin;

-- Real contract document management (upload/list/delete), backed by the existing
-- public 'attachments' storage bucket. Previously the UI shell was a disabled
-- no-op; this closes that gap with real persistence + RLS.
create table if not exists public.contract_documents (
  id uuid primary key default gen_random_uuid(),
  contract_id text not null references public.contracts(id) on delete cascade,
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
