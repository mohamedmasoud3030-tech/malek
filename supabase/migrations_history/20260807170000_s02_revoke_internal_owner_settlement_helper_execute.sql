-- =============================================================================
-- S02-T10 — close residual browser EXECUTE on FA-003 internal settlement helpers
-- =============================================================================
-- The FA-003 foundation explicitly classifies these functions as internal/system
-- helpers. They accept or enumerate financial identity using a supplied company
-- context and therefore must never be callable by the authenticated browser role.
--
-- CREATE OR REPLACE preserves function ACLs. Earlier migrations revoked PUBLIC
-- and anon but did not explicitly revoke authenticated, leaving residual EXECUTE
-- in a full replay. T10 catalog enumeration exposed that drift.
--
-- This migration changes privileges only. No function body, data, accounting,
-- settlement formula, status, route, UI, ADR, or UX artifact is changed.
-- =============================================================================

begin;

-- Deterministic owner-settlement source-set helpers: system/internal only.
revoke all on function public.owner_settlement_reservable_payments(
  uuid, uuid, date, date, text
) from public, anon, authenticated;
revoke all on function public.owner_settlement_reservable_expenses(
  uuid, uuid, date, date, text
) from public, anon, authenticated;

-- Historical migration/backfill controls: system/internal only.
revoke all on function public.assert_owner_settlement_links_backfillable()
  from public, anon, authenticated;
revoke all on function public.backfill_owner_settlement_links()
  from public, anon, authenticated;

-- Preserve the intentionally approved system caller.
grant execute on function public.owner_settlement_reservable_payments(
  uuid, uuid, date, date, text
) to service_role;
grant execute on function public.owner_settlement_reservable_expenses(
  uuid, uuid, date, date, text
) to service_role;
grant execute on function public.assert_owner_settlement_links_backfillable()
  to service_role;
grant execute on function public.backfill_owner_settlement_links()
  to service_role;

commit;
