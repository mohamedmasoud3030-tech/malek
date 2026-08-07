-- =============================================================================
-- S08 replay compatibility preflight
--
-- Some isolated legacy replay fixtures intentionally omit the Stage 3
-- accounting-periods table while still replaying later read-only migrations.
-- Production/staging environments that already have the canonical table are
-- untouched. In dependency-incomplete replay environments only, expose an
-- empty, read-only compatibility view so S08 analysis objects can be created
-- and correctly return zero observable periods instead of aborting the chain.
--
-- No financial rows are inserted, updated, deleted, or truncated.
-- Manual rollback:
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
end
$compatibility$;

commit;
