-- ===========================================================================
-- Manual/emergency rollback — not auto-applied; run by hand only.
-- Rollback for: 20260816090000_wp05_gap018_reconciliation_variance_diagnostics.sql
-- ===========================================================================
-- Drops the GAP-018 variance-diagnostics functions and the correction-proposal
-- register. Safe by construction: GAP-018 never posts to the general ledger, so
-- removing it cannot orphan a journal batch. Proposal rows are analysis records
-- only; export them before running this if the evidence is still needed.

begin;

drop function if exists public.wp05_assert_no_unapproved_correction_postings(uuid);
drop function if exists public.wp05_list_correction_proposals(text, date);
drop function if exists public.wp05_reject_correction_proposal(uuid, text);
drop function if exists public.wp05_approve_correction_proposal(uuid, text);
drop function if exists public.wp05_generate_correction_proposals(date, text, uuid);

drop trigger if exists guard_wp05_correction_proposal_writes on public.wp05_correction_proposals;
drop trigger if exists trg_wp05_correction_proposals_updated_at on public.wp05_correction_proposals;
drop function if exists public.guard_wp05_correction_proposal_writes();

drop table if exists public.wp05_correction_proposals;

drop function if exists public.wp05_variance_diagnostics(uuid, date);
drop function if exists public.wp05_gl_side_totals(uuid, text, date);

commit;
