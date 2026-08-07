-- Live hardening parity: ensure S08 read-only views execute with caller privileges
-- so underlying RLS/company isolation remains authoritative.
begin;

alter view public.s08_analysis_scope
  set (security_invoker = true);

alter view public.s08_liability_balances_by_period
  set (security_invoker = true);

alter view public.s08_master_lease_readiness
  set (security_invoker = true);

alter view public.s08_subledger_gl_reconciliation
  set (security_invoker = true);

alter view public.s08_legacy_gl_context
  set (security_invoker = true);

commit;
