-- =============================================================================
-- S08 replay compatibility preflight
--
-- Some isolated legacy replay fixtures intentionally omit the Stage 3
-- accounting-period and journal tables while still replaying later read-only
-- migrations. Production/staging environments that already have the canonical
-- tables are untouched. In dependency-incomplete replay environments only,
-- expose empty, read-only compatibility views so S08 analysis objects can be
-- created and correctly return zero observable GL periods/movements instead of
-- aborting the migration chain.
--
-- No financial rows are inserted, updated, deleted, or truncated.
-- Reversal companion:
-- supabase/rollback/20260807_rollback_s08_accounting_periods_replay_compatibility.sql
-- =============================================================================

begin;

do $compatibility$
begin
  if to_regclass('public.accounting_periods') is null then
    execute $view$
      create view public.accounting_periods
      with (security_invoker = true) as
      select
        null::uuid as id,
        null::uuid as company_id,
        null::text as name,
        null::date as start_date,
        null::date as end_date,
        null::text as status,
        null::timestamptz as closed_at,
        null::uuid as closed_by,
        null::text as reopen_reason,
        null::timestamptz as created_at,
        null::uuid as created_by,
        null::timestamptz as updated_at
      where false
    $view$;

    comment on view public.accounting_periods is
      'Replay-only empty compatibility surface. Canonical environments use the Stage 3 accounting_periods table.';
  end if;

  if to_regclass('public.journal_batches') is null then
    execute $view$
      create view public.journal_batches
      with (security_invoker = true) as
      select
        null::uuid as id,
        null::uuid as company_id,
        null::text as status,
        null::text as source_type,
        null::text as source_id,
        null::text as event_id,
        null::uuid as reversal_of_batch_id,
        null::boolean as is_legacy_compat,
        null::date as effective_date,
        null::uuid as accounting_period_id,
        null::text as period_resolution_reason,
        null::timestamptz as posted_at,
        null::uuid as posted_by,
        null::text as description,
        null::timestamptz as created_at,
        null::uuid as created_by,
        null::timestamptz as updated_at
      where false
    $view$;

    comment on view public.journal_batches is
      'Replay-only empty compatibility surface. Canonical environments use the Stage 3 journal_batches table.';
  end if;

  if to_regclass('public.journal_lines') is null then
    execute $view$
      create view public.journal_lines
      with (security_invoker = true) as
      select
        null::text as id,
        null::text as no,
        null::text as date,
        null::uuid as batch_id,
        null::uuid as company_id,
        null::text as account_id,
        null::numeric as debit,
        null::numeric as credit,
        null::text as line_description,
        null::text as ref_source_id,
        null::text as ref_entity_type,
        null::text as ref_entity_id,
        null::text as request_id,
        null::timestamptz as deleted_at,
        null::timestamptz as created_at
      where false
    $view$;

    comment on view public.journal_lines is
      'Replay-only empty compatibility surface. Canonical environments use the Stage 3 journal_lines table.';
  end if;
end
$compatibility$;

commit;
