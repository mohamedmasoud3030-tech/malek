# Current State

This document describes the current checked-out repository state.
Verify code, migrations, tests, and CI before relying on it.

## Agent-context layer (2026-07-06, revised)

`docs/agent-context/` holds a task-routing supplement for coding agents.
`CONTEXT_MAP.md` is the routing authority — it decides, per task type, what's
mandatory to read (including whether `WORKFLOW.md` or specific `DOMAIN.md`
sections apply); nothing in this layer is mandatory reading for every task.
`DOMAIN.md` separates durable verified invariants from currently-active
violations from open unknowns, with per-claim tags distinguishing what this
pass verified directly (file-level, not live) from what was previously
verified elsewhere. `docs/decisions/README.md` defines the format and rules
for future architecture decision records; none exist yet.

This layer doesn't change any fact in this document — it only adds
navigation and evidence tagging. No live Supabase mutation was made while
creating it, and no live read-only query was run either; all evidence
gathered for this layer is file-level (`rg`/`view` against the checked-out
repo). A later receipt/payment fix is now documented below as code-fixed but
not yet live/E2E verified; whoever next touches that area should confirm the
live RPC definitions, migration ledger, and app path before calling it
production-verified.

## Repository checkpoint (2026-07-18)

- Verified `main` head: `7bb098f530fdd0041aa5588cbccd223b04beba5c` (PR #1190).
- No open pull requests were returned by the GitHub repository query at this checkpoint.
- Architecture phases A–E remain complete; `docs/ARCHITECTURE_EXECUTION_PLAN.md` is historical evidence, not an active Phase F backlog.
- The deposit migration chain derives contract/property/unit identifier types from canonical tables and dynamically casts expense property references, eliminating the fixed-UUID replay blocker in code. The automation migration fails early when its baseline tables are absent and its dependency order is covered by a contract test. **As of 2026-07-18, this chain (`20260717000003`, `20260717000004`, `20260717000005`, `20260717000007`, `20260717000008`, `20260717000009`) has been applied to production in dependency order with explicit owner approval and live-verified**: `tenant_deposits`, `deposit_transactions`, `automation_rules` (6 seeded rows), `automation_notifications` exist; all seven RPCs (`create_deposit_atomic`, `deduct_deposit_atomic`, `refund_deposit_atomic`, `execute_automation_rule`, `execute_automation_rule_internal`, `run_scheduled_automation_rules`, `retry_automation_run`) are live; `pg_cron` is enabled with `rentrix-automation-hourly` active. Lifecycle/CRUD testing against production is still pending — see `docs/NEXT.md`.
- Do not describe Deposits or Automation as production-complete until their absent live tables/RPCs are staged, applied with approval, and lifecycle-tested.

## Application

The active app lives in `rentrix-app/`. It is a Vite + React + TypeScript single-page app using TanStack Router (`rentrix-app/src/routeTree.ts`, `src/app/router.tsx`) and TanStack Query (`src/lib/query-client.ts`). It talks to Supabase (Postgres + Auth) as its backend via `src/lib/supabase.ts`.

## What has been verified from code and tests

- All feature service files under `rentrix-app/src/features/**` that read or write domain data (properties, units, people, owners, owner agreements, tenants, contracts, invoices, payments, receipts, expenses, maintenance, leads, lands, commissions, communication, settings, cost centers, payment terms, audit log, data integrity) import and call the Supabase client — none of the checked feature services persist domain data to `localStorage`, IndexedDB, or an in-memory store.
- `zustand` is used only for local UI state (`rentrix-app/src/store/ui-store.ts`: sidebar/theme/sync-status), not for domain data.
- Route guards (`rentrix-app/src/features/auth/route-guards.ts`, `rentrix-app/src/routeTree.ts`) check a Supabase session and, for permission-gated routes, an app permission (`rentrix-app/src/features/auth/permissions.ts`) before rendering.
- `supabase/migrations/` contains a migration (`20250101000003_functions_triggers_and_rpcs.sql`) defining `record_invoice_payment_atomic` and `find_payment_account_id`, and a contract test (`rentrix-app/src/features/financials/payment-account-resolution-migration-contract.test.ts`) that asserts the function is text-based (not casting to `uuid`) and revokes public execute access on the helper function. **Verified live** on `nnggcnpcuomwfuupupwg`: the fix is applied (see `20260615000100_fix_invoice_payment_account_resolution` in the live migration ledger).
- Owner agreements (`supabase/migrations/20260628100000_owner_agreements_core.sql`), cost centers, VAT support, payment terms, and a cash-flow report migration all exist under `supabase/migrations/` **and are confirmed applied live**.
- Maintenance cost resolution (`supabase/migrations/20260703000000_resolve_maintenance_with_expense.sql`) is confirmed applied live. Contract document management (`supabase/migrations/20260703010000_contract_documents.sql`) and `20260616090000_complete_planned_product_modules.sql` (communication log) were applied to `nnggcnpcuomwfuupupwg` on 2026-07-05 via `apply_migration` — `contract_documents` and `communication_records` now exist live, confirmed via `information_schema.tables`. The PR #1036 contract-document-upload feature is unblocked. Note: the `contract_documents` migration file originally declared `contract_id uuid`; applying it against production surfaced a real type mismatch (`public.contracts.id` is `text` live, not `uuid`), so the column was corrected to `text` before applying — see the file's own header comment.
- Tenant financial identity is unified on `public.people`: `20260712020000_fix_tenant_balances_people_fk.sql` is present and registered in the live migration ledger; read-only production verification on 2026-07-14 confirmed `tenant_balances.tenant_id` references `people(id)` with `ON DELETE RESTRICT`, and zero orphan rows exist.
- Running `pnpm --filter ./rentrix-app run test` and `pnpm --filter ./rentrix-app run test:financials` locally with placeholder Supabase env vars passes (80 test files / 382 tests, and 22 test files / 81 tests, respectively, at the time of this check).
- `pnpm typecheck`, `pnpm lint` (an alias that also runs `tsc` project-wide; there is no ESLint dependency or config in the project), and `pnpm build` all pass locally.

## Known gaps or unknowns

- Bank reconciliation has a foundation migration (`20260705000005_bank_reconciliation_foundation.sql`) and a UI/service route (`/bank-reconciliation`) for bank accounts, statement lines, manual line entry, CSV paste import, one-to-one matching against recorded financial entities, and basic date/amount suggested matches. **Correction (2026-07-06): the migration file existed in the repo but was never actually applied to `nnggcnpcuomwfuupupwg`** — a frontend/backend reconciliation audit found the four bank_* tables missing live via direct `information_schema.tables` query, meaning `/bank-reconciliation` was broken in production despite this doc previously stating it was verified. Applied live on 2026-07-06 (ledger version `20260706081635`); all four tables, indexes, RLS policies, and grants are now confirmed live. Remaining gaps: bank-file upload/format mapping, duplicate detection, advanced reconciliation rules.

### Frontend/backend reconciliation audit (2026-07-06)

Cross-referenced every `.rpc(...)` and `.from(...)` call in `rentrix-app/src` against the live `public` schema (functions via `pg_proc`, tables via `information_schema.tables`):

- **Bank reconciliation tables were missing live** — see correction above. Now fixed.
- **Reports RPC wiring has changed since the original 2026-07-06 audit.** Current code now calls `rpt_owner_statement` and `rpt_tenant_statement` from the Reports page when owner/contract filters are selected, and also calls `rpt_cash_flow` / `rpt_vat_return`. Still-unwired report RPC sources include `rpt_daily_collection`, `rpt_overdue_invoices`, `rpt_aged_receivables`, `rpt_income_statement`, `rpt_balance_sheet`, `rpt_trial_balance`, and `rpt_rent_roll`; current UI/service code still computes daily collection/overdue/aged/rent-roll style outputs through service/client aggregation.
- **Two live function overloads have zero frontend callers**: `get_financial_summary(date,date)` and `get_financial_summary(date,date,date,date)` (neither overload is called anywhere in `rentrix-app/src`), and the legacy `void_receipt_atomic(text, bigint, jsonb, jsonb)` overload (frontend only calls the `void_receipt_atomic(jsonb)` facade). Candidates for `DROP FUNCTION`, pending confirmation these aren't reserved for planned-but-unbuilt screens.
- No security deposit management, deferred revenue handling, or multi-currency support was found in migrations or `src/features`.
- The Supabase migration-evidence script (`scripts/collect-supabase-migration-evidence.sh`, run in CI via `pnpm supabase:migration-evidence`) performs local, read-only checks by default (file ordering, presence of env vars). When `SUPABASE_DB_URL` and `psql` are available, it also performs a read-only reconciliation that fails if any local migration file is absent from `supabase_migrations.schema_migrations`; otherwise live schema state must still be checked separately before relying on a migration as deployed.

### Production loading incident and refreshed contract audit (2026-07-18)

- Live API logs showed the authenticated app issuing a broad dashboard request fan-out where the core tables returned `403` and `rpt_dashboard_overview` failed. The immediate RLS cause was contract drift: 49 authenticated policies still call `app_private.is_app_user()`, while migration `20260717000010` had revoked authenticated execution on that compatibility helper. The manager helper pair was also still recursive.
- Production migrations `20260718075311_fix_authorization_helper_grants_and_recursion` and `20260718075504_fix_dashboard_overview_live_type_compatibility` are applied and verified under an impersonated authenticated ADMIN JWT. Both public/private helper pairs now return true without recursion; reads across properties, units, owners, contracts, invoices, payments, expenses, and maintenance succeed; `rpt_dashboard_overview` returns the expected JSON shape. The dashboard RPC fix safely bridges the live `contracts.end_date text` shape to its date parameters.
- The dashboard frontend now loads the shared arrears invoice set once instead of issuing three duplicate arrears queries, and its page query does not retry the entire multi-request snapshot after a deterministic contract/permission failure.
- **Resolved 2026-07-18:** a previous cross-reference of every production `.from(...)` and `.rpc(...)` caller had found a deployment gap where `tenant_deposits`, `deposit_transactions`, `create_deposit_atomic`, `deduct_deposit_atomic`, `refund_deposit_atomic`, `automation_rules`, and `automation_notifications` were referenced by UI/services but absent live. An earlier attempt to apply the chain as-is had failed because `tenant_deposits.property_id uuid` conflicted with live `properties.id text`; the corrected chain (which derives identifier types dynamically instead of assuming UUID) was re-verified against the live schema and applied to production in dependency order with explicit owner approval. All listed tables and RPCs are now confirmed live.

### Migration consolidation audit findings (2026-07-05, live-verified against `nnggcnpcuomwfuupupwg`)

1. **~31 live tables are not represented in any file under `supabase/migrations/`.** The live `public` schema has 54 base tables; the migration files (18 files, 25 `create table` statements) only account for 25 of them. Untracked live tables include ones with real data (`tenants`: 40 rows, `sessions`: 15 rows, `automation_jobs`: 9 rows) as well as empty scaffolding tables (`budgets`, `commissions`, `leads`, `lands`, `missions`, `governance`, `kpi_snapshots`, `attachments`, `auto_backups`, `automation_run_logs`, `automation_runs`, `account_balances`, `app_notifications`, `company-assets`, `deposit_txs`, `notification_templates`, `notifications`, `outgoing_notifications`, `owner_settlements`, `profiles`, `schema_refactor_notes`, `serials`, `settings`, `snapshots`, `status_history`, `status_transition_rules`, `tenant_balances`, `utility_bills`). **This means the migrations directory cannot currently be treated as a source of truth for the live schema.** Closing this gap is now in progress; see "Baseline capture strategy and ordering" below for the approach, the file split, and a related enum-type gap discovered along the way.
2. **Two committed migrations that were previously unapplied are now applied to production**: `20260616090000_complete_planned_product_modules.sql` (creates `communication_records`) and `20260703010000_contract_documents.sql` (creates `contract_documents`, used by the PR #1036 contract-document-upload feature). Applied via `apply_migration` on 2026-07-05 and confirmed via direct query against `information_schema.tables` on `nnggcnpcuomwfuupupwg` — both tables now exist live. The `contract_documents` file's `contract_id` column was corrected from `uuid` to `text` before applying, to match the live `public.contracts.id` type (see the file's own header comment).
3. **`20260628000000_fix_find_payment_account_id.sql` is an intentional no-op** (`SELECT 1;`) — its header explains the fix it describes was already applied live under a different migration (`20260615000100_fix_invoice_payment_account_resolution`, hardened by `20260615000300`). No action needed; kept for changelog continuity.
4. **The live `supabase_migrations.schema_migrations` ledger had 117 entries as of 2026-07-05; re-checked on 2026-07-06 it has 139.** The ~10 duplicate-named entries noted previously are historical facts from past incidents (e.g. two rows named `custom_access_token_hook`, two named `p0_harden_rls_user_scoped`, `_dup1`-suffixed rows for `lock_down_custom_access_token_hook_execute` / `enable_rls_on_exposed_tables` / `harden_internal_rpc_execution`, and similarly for `rentrix_complete_production_setup`, `normalize_units_status_contract`, `audit_fix_all_schema_mismatches`, and `harden_audit_log_rls`). These are already applied to production; rewriting a live project's own migration ledger is high-risk for no schema benefit, so they were left as-is and are documented here as an informational finding only. The 22 new ledger rows between 2026-07-05 and 2026-07-06 correspond to RPC bug fixes merged as files on `main` the same day (`fix_custom_access_token_hook_role_source`, `fix_sessions_rls_user_id`, `post_receipt_atomic_add_row_lock_and_overpayment_guard`, `fix_renew_contract_atomic_payload_mismatch`, `drop_stale_renew_contract_atomic_uuid_overload`, `fix_void_receipt_atomic_receipt_id_type_mismatch`, `fix_create_contract_atomic_tenant_id_type_mismatch`, `fix_rpt_owner_statement_settlement_type_mismatch`, `fix_rpt_tenant_statement_contract_id_and_tenants_table`, `fix_rpt_owner_statement_expense_property_matching`). Two of those (`post_receipt_atomic_add_row_lock_and_overpayment_guard`, version `20260706021140`; `fix_rpt_owner_statement_expense_property_matching`, version `20260706031150`) were applied live via `apply_migration` but had no corresponding file under `supabase/migrations/` until this pass — both gaps are now closed with files captured directly from `pg_get_functiondef` against the live project.
5. The 5 oldest local migration files (formerly `0001`–`0005`, non-timestamped from the PR #916 baseline squash) were renamed to `20250101000001`–`20250101000005` and registered as already-applied in the live ledger (metadata-only, no DDL re-run) so `scripts/collect-supabase-migration-evidence.sh` reports zero "invalid filename timestamp" / "non-monotonic" findings going forward.
6. **`rpt_owner_statement` and `record_invoice_payment_atomic`/`find_payment_account_id` were independently re-verified live on 2026-07-06** via direct `pg_get_functiondef` inspection (not just migration filenames): `rpt_owner_statement`'s expense CTE correctly filters `pr.id in (select id from properties where owner_id = p_owner_id)`, and `record_invoice_payment_atomic`/`find_payment_account_id` remain correctly text-based with no `uuid` cast — both consistent with the fixes already documented above.

**Status: baseline capture merged (2026-07-05, PR #1045); drift follow-ups completed (2026-07-05, PR #1047 audit + this PR's execution).** The three baseline files (`20260705000000`–`20260705000002`) are on `main`. Both follow-ups that were tracked in `docs/NEXT.md` under "Ready now" are now done: the 2 previously-unapplied migrations (`communication_records`, `contract_documents`) are applied to production, and the 9 orphaned enum types have been dropped from production via `20260705000003_drop_orphaned_enum_types.sql`.

### Baseline capture strategy and ordering (2026-07-05)

**Strategy**: every statement in the baseline files below was generated by direct introspection of the live schema on `nnggcnpcuomwfuupupwg` (`information_schema.columns`, `pg_constraint`, `pg_indexes`, `pg_policies`, `information_schema.triggers`, `pg_type`/`pg_enum`) — not hand-written or simplified from assumption or from docs. All three files are registered in the live `supabase_migrations.schema_migrations` ledger as already-applied (metadata-only insert, no DDL executed), because the schema they describe is already live. The goal is to make `supabase/migrations/` match reality, not to re-run DDL against tables/types that already exist.

**File split and required order** (dependencies flow forward only):

1. `20260705000000_capture_live_enums_and_users_compatibility.sql` — creates the 4 live enum types that are actually used by a column (`user_role`, `entity_status`, `charged_to_type`, `utility_status`), then migrates `public.users.role`/`public.users.status` from the `text + check` shape in `20250101000001_core_schema.sql` to the enum types, matching what's live today (no check constraints remain on `public.users` live).
2. `20260705000001_baseline_capture_untracked_tables_batch_b.sql` — the 4 untracked tables holding live data: `tenants`, `sessions`, `automation_jobs`, `profiles`. Must sort before Batch A because `automation_jobs.id` is referenced by `automation_run_logs.job_id` / `automation_runs.job_id`, and the original live baseline still recorded `tenants.id` as the target for `tenant_balances.tenant_id` before the later corrective migration.
3. `20260705000002_baseline_capture_untracked_tables_batch_a.sql` — the remaining 27 untracked tables, all empty/scaffolding. Depends on both files above (enum types for `utility_bills`, and `automation_jobs`/the historical tenant baseline dependency). The later `20260712020000_fix_tenant_balances_people_fk.sql` is authoritative for the current tenant-balance FK.

**Notable findings captured (not corrected) during this pass:**
- `sessions_select_own`, `sessions_insert_own`, and `sessions_delete_own` were captured from live with ownership checks comparing `auth.uid()` to `sessions.id` (the session row's own primary key) rather than `sessions.user_id`. This is now corrected for future applies by `20260705000004_fix_sessions_rls_user_id.sql`; apply/verify it on production before considering the live bug closed.
- `tenants` and, within Batch A, `deposit_txs` and `owner_settlements` have `FORCE ROW LEVEL SECURITY` enabled live (not just `ENABLE ROW LEVEL SECURITY`) — captured explicitly in the corresponding `alter table ... force row level security` statements.
- `profiles.id` and `profiles.auth_user_id` both have foreign keys to `auth.users(id)` (`profiles_id_fkey` with `ON DELETE CASCADE`, `profiles_auth_user_id_fkey` with no action) — both are captured in Batch B.

**Orphaned live-schema enum types — audit complete (2026-07-05), dropped from production (2026-07-05).** Live introspection of `pg_type`/`pg_enum` on `nnggcnpcuomwfuupupwg` found 13 enum types total; only 4 are referenced by any live column (captured in `20260705000000_...`). The other 9 — `contract_status`, `invoice_status`, `invoice_type`, `journal_entry_type`, `maintenance_status`, `payment_method`, `property_status`, `transaction_status`, `unit_status` — were audited for usage beyond columns and confirmed to have **zero references** across every location checked:
- Function/RPC signatures (`pg_get_function_arguments` / `pg_get_function_result`): none.
- Function bodies, checked for actual `::type_name` casts (not string-literal matches — an earlier regex pass on raw body text falsely flagged `update_unit_status`, `update_invoice_status`, `normalize_unit_status_contract`, and `record_invoice_payment_atomic`, but all four only assign plain string literals like `'ACTIVE'`/`'PAID'` to `text` columns; `units.status`, `contracts.status`, `invoices.status`, and `maintenance_records.status` are all `text`, not enum, confirmed via `information_schema.columns`): none.
- View definitions (`pg_views.definition`): none.
- RLS policy `qual`/`with_check` expressions (`pg_policies`): none.
- Composite type attributes, domain base types, index expressions: none.

**Conclusion and action taken**: these 9 types were confirmed genuinely unused scaffolding, not enums quietly relied on elsewhere. Product-owner decision was to drop them to reduce schema clutter; dropped from `nnggcnpcuomwfuupupwg` via `apply_migration` on 2026-07-05 (`supabase/migrations/20260705000003_drop_orphaned_enum_types.sql`) and confirmed absent from `pg_type` afterward.

## Before claiming a feature is complete

1. Confirm the relevant service file(s) under `rentrix-app/src/features/<module>/` call Supabase (not a local store).
2. Confirm a matching migration exists under `supabase/migrations/` and check the live Supabase project schema and RLS policies, not just the migration file.
3. Run the relevant test command(s) from `docs/TESTING.md` and confirm they pass.
4. Check CI (`.github/workflows/ci.yml`) status on the branch/PR.

## Recently fixed in code — live verification pending: voidReceipt payment-backed void path

The stale `voidReceipt` incident is **not** documented as an active/current production incident in this checkout. PR #1064 merged a code fix for the payment-backed receipt void path on 2026-07-06, including migrations/tests that make `record_invoice_payment_atomic` and `void_receipt_atomic(jsonb)` resolve payment-backed receipt ids consistently.

What was previously found from the live receipt/payment write and void path:

1. The "Receipts" UI feature (`rentrix-app/src/features/financials/receipts/receiptService.ts`) reads and writes primarily via the **`payments`** table (`listReceipts`, `getReceiptDetail`, etc. all call `.from('payments')`).
2. Before PR #1064, recording a payment (`record_invoice_payment_atomic`, called from the frontend) could create separate `public.receipts` and `public.payments` rows with independently generated ids for what the user perceives as a single transaction.
3. Before PR #1064, `receiptService.ts`'s `voidReceipt()` sent `{ payload: { receipt_id: <payments.id>, ... } }` to `void_receipt_atomic`, which looked up `public.receipts.id` directly and could fail when the supplied id was a payment id rather than the corresponding receipt id.

**Precise status after PR #1064:** the code fix is merged, but live Supabase verification and real end-to-end production-path verification have **not** yet been performed. Do not claim the fix is live or verified in production until both are done and documented.

**Required warning for future receipt/payment work:** before relying on this fix, verify the live `void_receipt_atomic` / `record_invoice_payment_atomic` RPC definitions and the live `supabase_migrations.schema_migrations` ledger against the target Supabase project, then run a real production-path end-to-end check that records a payment and voids it through the app path.

## Reports page RPC wiring — current code audit (2026-07-08)

The reports page is no longer accurately described as having no owner/tenant statement UI. Current code has report filters for owner and contract selection, and `ReportsPage` calls `useOwnerStatementReport` / `useTenantStatementReport`; those hooks call `rpt_owner_statement` and `rpt_tenant_statement` through `financialReportsService.ts`, and `StatementsSection` renders RPC results, loading states, and RPC error messages. This is **partial statement wiring**, not a full accounting statement lifecycle.

Current source split from the checked-out code:

- **Client/service aggregation remains the source for** daily collection, period summary, financial cashflow, overdue invoices, aged receivables, expense breakdown, occupancy, rent-roll display, and expiring contracts. Payment-backed collection aggregation reads `public.payments`, excludes `deleted_at`, and excludes `status = 'VOID'`.
- **Direct report RPC calls exist for** `rpt_owner_statement`, `rpt_tenant_statement`, `rpt_cash_flow`, and `rpt_vat_return`.
- **Still not wired as report-page RPC sources**: `rpt_daily_collection`, `rpt_overdue_invoices`, `rpt_aged_receivables`, `rpt_income_statement`, `rpt_balance_sheet`, `rpt_trial_balance`, and `rpt_rent_roll`. `rpt_daily_collection` has an alignment migration that defines it on `public.payments`, but this checkout still does not call it from the frontend.

Practical effect: owner/tenant statement RPC fixes can now affect the Reports screen when the corresponding owner/contract filter is selected, but the statements remain read-only operational views. They do not yet cover security deposits, utility bills, tenant maintenance chargebacks, owner payout approval/payment lifecycle, opening balances, or export/print-ready accounting statements.

Dead overloads (`get_financial_summary` × 2, `void_receipt_atomic(text,bigint,jsonb,jsonb)`): left alone per explicit decision, documented only, not dropped.

## Financial consistency update (2026-07-06)

The payment/receipt voiding fix from commit `198d0e039653ddb5991bd6efbb757405fcfcd6cc` is present in this checkout. This PR adds a defensive report-layer rule: payment-backed reports exclude `payments.status = 'VOID'` as well as `deleted_at IS NOT NULL`. A new migration, `20260706101000_align_payment_receipt_reporting_source.sql`, defines `rpt_daily_collection` on `public.payments` so the guarded backend RPC source matches the Receipts UI source. The current frontend still does not call `rpt_daily_collection`; this is a backend-consistency improvement only. The migration's ledger entry exists live, but the production function was later overwritten back to a receipt-backed JSONB definition; a new forward migration is required to restore parity without changing the current API shape.

## First live end-to-end financial cycle test — 4 critical bugs found and fixed (2026-07-11)

All financial tables (`contracts`, `invoices`, `receipts`, `payments`, `expenses`, `maintenance_records`) were empty prior to this test, meaning the full contract → invoice → payment → receipt cycle had never been exercised end-to-end against live production. A test run using isolated `TEST-QA` / `00000000-0000-4000-900X`-prefixed rows found and fixed 4 real production bugs — see `docs/NEXT.md` for the full list and `docs/RELEASE_READINESS.md` for the updated Go/No-Go impact. Migrations: `20260711013008`, `20260711013116`, `20260711013304`, `20260711013339`.

The tenant-balance identity issue surfaced in that run is now fixed and live-verified: `tenant_balances.tenant_id` references canonical `people(id)` through `tenant_balances_tenant_id_people_fkey`, the relationship uses `ON DELETE RESTRICT`, migration version `20260712020000` is registered, and the 2026-07-14 verification found zero orphan rows.

QA remains open for permission-boundary evidence, the payment-backed `void_receipt_atomic` path, report reconciliation, and cleanup of all `TEST-QA` rows.
