-- ============================================================================
-- S02: make public.assign_document_reference() resilient to row shapes
--
-- Root defect (S02 isolated replay): the generic BEFORE INSERT trigger read
-- NEW.created_at directly. public.bank_statement_imports has no created_at
-- column (its timestamp is imported_at), so inserting any import batch raised
-- 42703 `record "new" has no field "created_at"` and killed bank CSV imports.
--
-- Fix: derive the optional fields (reference, company_id, created_at,
-- imported_at) from to_jsonb(NEW) so a missing column can never raise a
-- RECORD field-access error again, for any current or future attached table.
-- Behavior is preserved for tables that do carry created_at, and tables that
-- carry imported_at (bank_statement_imports) now get their own occurrence
-- timestamp for the reference year. Singleton-company fallback and explicit
-- (non-null) reference handling are unchanged.
--
-- No table using the trigger is renumbered; the function assigns references
-- only when NEW.reference is null, exactly as before.
-- Rollback: supabase/rollback/20260805_rollback_s02_document_reference_trigger_resilience.sql
-- ============================================================================

begin;

create or replace function public.assign_document_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row         jsonb;
  v_company     uuid;
  v_occurred_at timestamptz;
  v_year        integer;
begin
  v_row := to_jsonb(NEW);

  -- Explicit reference always wins (idempotent retries, backfills).
  if nullif(btrim(coalesce(v_row ->> 'reference', '')), '') is not null then
    return NEW;
  end if;

  v_company := nullif(btrim(coalesce(v_row ->> 'company_id', '')), '')::uuid;
  if v_company is null then
    select c.id into v_company
    from public.company_settings c
    where c.singleton_key = true
    limit 1;
  end if;
  if v_company is null then
    return NEW;
  end if;

  -- Use the row's own occurrence timestamp when one exists. Tables without
  -- created_at (e.g. bank_statement_imports, which has imported_at) must not
  -- fail; any future timestamp-less table falls back to now().
  v_occurred_at := coalesce(
    nullif(btrim(coalesce(v_row ->> 'created_at', '')), '')::timestamptz,
    nullif(btrim(coalesce(v_row ->> 'imported_at', '')), '')::timestamptz,
    now()
  );
  v_year := extract(year from v_occurred_at)::integer;

  NEW.reference := public.next_document_reference(
    v_company,
    TG_ARGV[0],
    TG_ARGV[1],
    v_year
  );
  return NEW;
end;
$$;

alter function public.assign_document_reference() owner to postgres;

revoke all on function public.assign_document_reference() from public, anon;
grant execute on function public.assign_document_reference() to authenticated, service_role;

comment on function public.assign_document_reference() is
  'Generic BEFORE INSERT document-reference trigger. Derives optional fields from to_jsonb(NEW) so tables without created_at (bank_statement_imports) work; preserves created_at behavior everywhere else. Assigns only when NEW.reference is null.';

commit;
