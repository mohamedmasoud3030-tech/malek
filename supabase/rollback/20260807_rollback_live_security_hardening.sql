-- Manual emergency rollback guard — not auto-applied; run by hand only.
-- Rollback for: 20260807232056_s08_security_invoker_live_hardening.sql
-- Related forward migrations:
--   20260807232244_harden_cross_company_balance_maintenance_automation.sql
--   20260807232413_harden_rls_membership_and_invoker_helpers.sql
--   20260807232604_harden_bank_reconciliation_match_authorization.sql
--   20260807233224_harden_active_user_authorization_helpers.sql
--   20260807233732_harden_company_membership_rls_authority.sql
--
-- The forward migrations fixed confirmed cross-company/authorization defects.
-- Replaying the previous definitions would deliberately restore those defects:
--   * S08 views bypassing caller RLS via owner privileges
--   * inactive company memberships retaining RLS access
--   * global balance rebuilds crossing company boundaries
--   * maintenance resolution crossing company boundaries
--   * scheduled automation manual runs crossing company boundaries
--   * bank reconciliation matching bypassing server-side role/company checks
--   * disabled/deleted/demoted users retaining access through stale JWT state
--   * company membership administration trusting stale JWT role metadata
--
-- Therefore there is intentionally NO automatic destructive rollback.
-- If a compatibility regression is discovered, ship a forward migration that
-- changes only the affected behavior while preserving the security invariants.
-- This file aborts if somebody tries to execute it as an automatic rollback.

do $$
begin
  raise exception using
    errcode = 'P0001',
    message = 'Unsafe rollback blocked: use a forward migration that preserves company isolation and authorization.';
end
$$;
