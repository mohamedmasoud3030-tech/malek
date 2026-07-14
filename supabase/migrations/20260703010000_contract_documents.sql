-- STATUS AS OF 2026-07-05: APPLIED to production via apply_migration.
--
-- Historical production used text contract identifiers, while the code-first
-- baseline uses UUIDs. Derive contract_documents.contract_id from contracts(id)
-- so clean replay and the supported live schema both retain a valid foreign key.

begin;

DO $$
DECLARE
  v_contract_id_type text;
  v_document_contract_id_type text;
BEGIN
  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_contract_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation
    ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'contracts'
    AND attribute.attname = 'id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF v_contract_id_type IS NULL THEN
    RAISE EXCEPTION 'Cannot create contract documents: public.contracts(id) was not found';
  END IF;

  IF v_contract_id_type NOT IN ('uuid', 'text') THEN
    RAISE EXCEPTION
      'Cannot create contract documents: unsupported public.contracts(id) type %',
      v_contract_id_type;
  END IF;

  IF to_regclass('public.contract_documents') IS NULL THEN
    EXECUTE format(
      $sql$
        CREATE TABLE public.contract_documents (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          contract_id %s NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
          file_name text NOT NULL,
          file_url text NOT NULL,
          storage_path text NOT NULL,
          file_size bigint,
          mime_type text,
          uploaded_by uuid DEFAULT auth.uid(),
          created_at timestamptz NOT NULL DEFAULT now(),
          deleted_at timestamptz
        )
      $sql$,
      v_contract_id_type
    );
  END IF;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_document_contract_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation
    ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'contract_documents'
    AND attribute.attname = 'contract_id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF v_document_contract_id_type IS NULL THEN
    RAISE EXCEPTION 'Cannot validate contract documents: public.contract_documents(contract_id) was not found';
  END IF;

  IF v_document_contract_id_type <> v_contract_id_type THEN
    RAISE EXCEPTION
      'Cannot link contract documents: contracts.id type % differs from contract_documents.contract_id type %',
      v_contract_id_type,
      v_document_contract_id_type;
  END IF;
END
$$;

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
