# Production hardening audit — 2026-07-11

## Scope

Audit requested for Supabase `public` functions, RLS, financial data integrity, accounting protection, React/Supabase boundaries, auth posture, report aggregation, and performance indexes.

## Changes implemented

- Added migration `20260711120000_production_hardening_security_rls_performance.sql` for the first hardening pass.
- Added migration `20260711123000_bank_reconciliation_atomic_and_journal_status_hardening.sql` for the follow-up hardening pass.
- Added no-op future migration placeholder `20260711124000_organization_isolation_future_todo.sql` to track the future organization-isolation expand-contract sequence.
- Removed `PUBLIC`/`anon` execute access from audited sensitive RPCs and re-applied the grants in the follow-up migration.
- Kept `authenticated` execute only for RPCs that are directly called by the web app and already enforce role checks internally.
- Restricted `recalculate_all_balances()` to `service_role` because it is an operational maintenance function that rewrites balance tables.
- Re-pinned audited `SECURITY DEFINER` functions to `SET search_path = public, pg_temp` and assigned ownership to the database owner role (`postgres`).
- Re-enabled RLS on the audited table set to protect future drift.
- Added requested FK indexes on `bank_statement_lines(import_id)` and `owner_agreements(owner_id)` using `CREATE INDEX IF NOT EXISTS`, plus report-oriented supporting indexes without dropping existing indexes.
- Fixed journal-entry protection to block only rows whose `status = 'posted'`; draft journal entries remain editable/deletable until posted.
- Added `process_bank_reconciliation_match_atomic(jsonb)` so bank reconciliation match creation, statement-line status update, and audit logging happen in one RPC transaction.
- Moved dashboard overview KPI aggregation from multiple frontend/service count queries into `rpt_dashboard_overview(date,date,date)`.

## Security-definer decision log

| Function | Decision | Reason |
| --- | --- | --- |
| `record_invoice_payment_atomic(jsonb)` | Keep `SECURITY DEFINER`; revoke `PUBLIC`/`anon`; grant `authenticated`, `service_role` | Must atomically insert payment, receipt, allocation, journals, idempotency, and balance side effects while bypassing direct-table browser write policies. Internal role check remains required. |
| `void_receipt_atomic(jsonb)` | Keep `SECURITY DEFINER`; revoke `PUBLIC`/`anon`; grant `authenticated`, `service_role` | Voiding must create reversal journals and update receipt/payment state atomically. |
| `create_contract_atomic(...)` | Keep `SECURITY DEFINER`; revoke `PUBLIC`/`anon`; grant `authenticated`, `service_role` | Contract creation needs server-side validation and protected updates to contract/unit state. |
| `renew_contract_atomic(text,jsonb)` | Keep `SECURITY DEFINER`; revoke `PUBLIC`/`anon`; grant `authenticated`, `service_role` | Renewal is a multi-row lifecycle operation. |
| `update_contract_atomic(...)` | Keep `SECURITY DEFINER`; revoke `PUBLIC`/`anon`; grant `authenticated`, `service_role` | Edit path must preserve atomic validation instead of raw table updates. |
| `terminate_contract_atomic(text,text)` | Keep `SECURITY DEFINER`; revoke `PUBLIC`/`anon`; grant `authenticated`, `service_role` | Termination updates contract lifecycle and unit availability together. |
| `generate_invoices_from_active_contracts()` | Keep `SECURITY DEFINER`; revoke `PUBLIC`/`anon`; grant `authenticated`, `service_role` | Invoice generation is a controlled business operation exposed through the app. |
| `recalculate_all_balances()` | Keep `SECURITY DEFINER`; revoke `authenticated`; grant `service_role` only | Maintenance recalculation should not be callable by ordinary browser sessions. |
| `rpt_cash_flow(date,date)` | Keep `SECURITY DEFINER`; revoke `PUBLIC`/`anon`; grant `authenticated`, `service_role` | Report RPC is read-only but must evaluate consistently under RLS. |
| `rpt_vat_return(date,date)` | Keep `SECURITY DEFINER`; revoke `PUBLIC`/`anon`; grant `authenticated`, `service_role` | Report RPC is read-only but must evaluate consistently under RLS. |
| `process_bank_reconciliation_match_atomic(jsonb)` | New `SECURITY DEFINER`; grant `authenticated`, `service_role` | Performs match insert, line update, and audit write atomically with permission checks. |
| `rpt_dashboard_overview(date,date,date)` | New `SECURITY DEFINER`; grant `authenticated`, `service_role` | Moves dashboard KPI aggregation to PostgreSQL. |

## RLS and organization isolation finding

The local schema baseline does **not** consistently contain `organization_id` on the requested tables. This change does **not** implement multi-tenant RLS yet. The future path is documented in `docs/ORGANIZATION_ISOLATION_PLAN.md` and tracked by `20260711124000_organization_isolation_future_todo.sql`.

## Financial integrity assessment

Current payment recording routes through `record_invoice_payment_atomic(jsonb)`, which builds a receipt payload containing allocations and journal entries before calling `post_receipt_atomic`. Receipt voiding routes through `void_receipt_atomic(jsonb)`. Bank reconciliation matching now routes through `process_bank_reconciliation_match_atomic(jsonb)` instead of split client writes.

## Frontend architecture review

The changed frontend flows keep `UI -> hooks -> services -> Supabase`: components continue to call hooks/services, and service files own Supabase access. Bank reconciliation matching now uses an RPC service boundary, and dashboard overview KPI aggregation now uses a database RPC instead of multiple service-layer count requests.

## Auth security

Leaked Password Protection is a Supabase Auth project setting and cannot be enabled safely from a repository migration. The required task was recorded in `docs/GOVERNANCE_LOG.md`; enable it in the Supabase dashboard or Management API for the production project and then add live evidence.

## Remaining issues

- Organization isolation is not fully implementable until the schema has complete `organization_id` coverage and JWT/session organization claims.
- Live production schema verification was not possible from this checkout because no `SUPABASE_DB_URL`/database connection environment variable was available.
- Full browser E2E for create property/unit/contract/invoice/payment/receipt/journal/report was not executed in this non-interactive terminal pass.
- Unused indexes were intentionally not dropped; they require production `pg_stat_user_indexes` observation over time.

## Production readiness score

**84 / 100**

Rationale: audited RPC grants/search paths/ownership are hardened, posted journal immutability is now status-aware, bank reconciliation matching is atomic, dashboard overview aggregation moved to PostgreSQL, and the organization-isolation roadmap is documented. Score remains capped by missing live Supabase verification, pending Supabase Auth dashboard setting evidence, and future organization-scoped RLS work.
