-- =============================================================================
-- FA-003 — backfill reservation links for pre-existing settlements (link-only)
-- =============================================================================
-- Creates link rows ONLY (no amount, status, date, or accounting change) for
-- settlements that existed before the reservation tables. It is fully guarded:
--
--   * public.assert_owner_settlement_links_backfillable() raises and aborts the
--     ENTIRE migration (no partial backfill) if any payment/expense belongs to
--     more than one non-cancelled settlement, or if any stored amount does not
--     match the deterministic derivation.
--   * We never choose a winner, never delete a link, never alter a settlement.
--
-- On a clean replay (empty/seed data) there are no settlements to backfill, so
-- this migration is a no-op. On a populated database it either backfills all
-- settlements atomically or fails loudly with OWNER_SETTLEMENT_BACKFILL_BLOCKED.
-- Rollback:
--   supabase/rollback/20260804_rollback_fa003_owner_settlement_input_reservation.sql
-- =============================================================================

begin;

do $$
declare
  v_result jsonb;
begin
  perform public.assert_owner_settlement_links_backfillable();
  v_result := public.backfill_owner_settlement_links();
  raise notice 'FA-003 backfill complete: %', v_result;
end;
$$;

commit;
