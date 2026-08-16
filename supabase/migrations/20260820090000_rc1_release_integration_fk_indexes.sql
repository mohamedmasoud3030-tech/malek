-- ============================================================================
-- RC1 release integration closeout — supporting indexes for core-entity FKs
-- ============================================================================
--
-- The RC1 owner_funds_events table introduced owner_id and contract_id foreign
-- keys. The existing company/date/owner index is useful for reconciliation, but
-- contract_id had no supporting index and therefore violated the repository's
-- global FK-index invariant. This migration is intentionally index-only.
-- ============================================================================

begin;

create index if not exists owner_funds_events_owner_idx
  on public.owner_funds_events (owner_id);

create index if not exists owner_funds_events_contract_idx
  on public.owner_funds_events (contract_id)
  where contract_id is not null;

commit;
