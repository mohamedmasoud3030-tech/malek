-- =============================================================================
-- Manual rollback for 20260816100000_wp05_gap018_proposal_governance_hardening.sql — not auto-applied; run by hand only.
-- WP-05 GAP-018 proposal governance hardening rollback.
--
-- Safety note: the tenant-isolation fix in
-- wp05_assert_no_unapproved_correction_postings is intentionally forward-only.
-- This rollback never reintroduces the SECURITY DEFINER/current_user bug.
--
-- The request-id index can only be restored to its pre-hardening unconditional
-- form if no regenerated history now shares (company, request, class). We fail
-- closed rather than delete or rewrite accounting-governance evidence.
-- =============================================================================
begin;

drop trigger if exists a_wp05_correction_proposal_governance_hardening on public.wp05_correction_proposals;
drop function if exists public.wp05_enforce_proposal_governance_hardening();

drop index if exists public.wp05_correction_proposals_request_uidx;

do $$
begin
  if exists (
    select 1
    from public.wp05_correction_proposals
    group by company_id, request_id, reconciliation_class
    having count(*) > 1
  ) then
    raise exception 'WP05_HARDENING_ROLLBACK_BLOCKED: regenerated proposal history would violate the pre-hardening request uniqueness rule; no rows were deleted or rewritten.'
      using errcode = '23505';
  end if;
end;
$$;

create unique index wp05_correction_proposals_request_uidx
  on public.wp05_correction_proposals (company_id, request_id, reconciliation_class);

-- Intentionally keep the hardened wp05_assert_no_unapproved_correction_postings
-- implementation. Rolling back a feature must not restore a known tenant escape
-- in a SECURITY DEFINER proof function.

commit;
