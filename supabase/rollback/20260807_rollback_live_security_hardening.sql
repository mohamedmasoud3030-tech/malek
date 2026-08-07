-- Emergency rollback guard for the 2026-08-07 live security hardening series.
--
-- The forward migrations fixed confirmed cross-company authorization defects.
-- Replaying the previous definitions would deliberately restore those defects:
--   * S08 views bypassing caller RLS via owner privileges
--   * inactive company memberships retaining RLS access
--   * global balance rebuilds crossing company boundaries
--   * maintenance resolution crossing company boundaries
--   * scheduled automation manual runs crossing company boundaries
--   * bank reconciliation matching bypassing server-side role/company checks
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
