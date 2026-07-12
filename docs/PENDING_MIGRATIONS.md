# Pending Migrations

## Purpose

The migrations listed below are intentionally isolated from the active production baseline.
They remain packaged in:

- `supabase/migrations_consolidated/0005_pending_future.sql`

They were not merged into `0001`–`0004`.

## Pending migration list

1. `20260713000002_fix_owner_balances_cascade.sql`
2. `20260713000003_fix_receipt_allocations_cascade.sql`
3. `20260713000004_fix_expense_rpc_role_check.sql`
4. `20260713000005_fix_void_receipt_anon_grant.sql`
5. `20260713000006_fix_report_rpcs_security_definer.sql`
6. `20260713000007_add_update_expense_with_journal_atomic.sql`
7. `20260713000008_add_journal_batch_balance_check.sql`
8. `20260714000001_seed_revenue_account.sql`
9. `20260714000002_hardened_invoice_generation.sql`
10. `20260714000003_contract_balances_triggers.sql`
11. `20260714000004_fix_rpt_cash_flow_void_filter.sql`
12. `20260714000005_fix_rpt_vat_return_void_filter.sql`
13. `20260714000006_fix_rpt_financial_summary_status.sql`

## Reason for isolation

These migrations were verified as pending and intentionally excluded from the active production baseline.
The consolidated baseline reproduces the currently applied production state only.

## Deployment requirements

Before applying any pending migration:

- review the target object impact
- verify dependency order
- validate frontend and reporting compatibility
- run controlled rebuild/validation tests
- confirm grants, RLS, and `SECURITY DEFINER` effects
- obtain deployment approval for the isolated batch

## Review notes

The pending set contains changes affecting:

- balance foreign-key behavior
- receipt allocation protections
- expense RPC hardening
- void receipt execution grants
- report security posture
- expense update journaling
- journal batch validation
- revenue account seeding
- invoice generation hardening
- contract balance trigger maintenance
- report filtering/status correctness

## Operational rule

Do not merge these migrations into the baseline files unless they have been separately approved, validated, and promoted from pending state.
