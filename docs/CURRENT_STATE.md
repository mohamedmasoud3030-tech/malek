# Current State

This document describes the current checked-out repository state.
Verify code, migrations, tests, and CI before relying on it.

## Application

The active app lives in `rentrix-app/`. It is a Vite + React + TypeScript single-page app using TanStack Router (`rentrix-app/src/routeTree.ts`, `src/app/router.tsx`) and TanStack Query (`src/lib/query-client.ts`). It talks to Supabase (Postgres + Auth) as its backend via `src/lib/supabase.ts`.

## What has been verified from code and tests

- All feature service files under `rentrix-app/src/features/**` that read or write domain data (properties, units, people, owners, owner agreements, tenants, contracts, invoices, payments, receipts, expenses, maintenance, leads, lands, commissions, communication, settings, cost centers, payment terms, audit log, data integrity) import and call the Supabase client — none of the checked feature services persist domain data to `localStorage`, IndexedDB, or an in-memory store.
- `zustand` is used only for local UI state (`rentrix-app/src/store/ui-store.ts`: sidebar/theme/sync-status), not for domain data.
- Route guards (`rentrix-app/src/features/auth/route-guards.ts`, `rentrix-app/src/routeTree.ts`) check a Supabase session and, for permission-gated routes, an app permission (`rentrix-app/src/features/auth/permissions.ts`) before rendering.
- `supabase/migrations/` contains a migration (`20250101000003_functions_triggers_and_rpcs.sql`) defining `record_invoice_payment_atomic` and `find_payment_account_id`, and a contract test (`rentrix-app/src/features/financials/payment-account-resolution-migration-contract.test.ts`) that asserts the function is text-based (not casting to `uuid`) and revokes public execute access on the helper function. **Verified live** on `nnggcnpcuomwfuupupwg`: the fix is applied (see `20260615000100_fix_invoice_payment_account_resolution` in the live migration ledger).
- Owner agreements (`supabase/migrations/20260628100000_owner_agreements_core.sql`), cost centers, VAT support, payment terms, and a cash-flow report migration all exist under `supabase/migrations/` **and are confirmed applied live**.
- Maintenance cost resolution (`supabase/migrations/20260703000000_resolve_maintenance_with_expense.sql`) is confirmed applied live. Contract document management (`supabase/migrations/20260703010000_contract_documents.sql`) and `20260616090000_complete_planned_product_modules.sql` (communication log) exist as migration files but are **NOT applied to the live database** — `contract_documents` and `communication_records` tables do not exist on `nnggcnpcuomwfuupupwg` as of 2026-07-05. Any frontend feature depending on these tables (e.g. contract document upload from PR #1036) will fail against production until an operator runs these two migrations live.
- Running `pnpm --filter ./rentrix-app run test` and `pnpm --filter ./rentrix-app run test:financials` locally with placeholder Supabase env vars passes (60 test files / 319 tests, and 20 test files / 77 tests, respectively, at the time of this check).
- `pnpm typecheck`, `pnpm lint` (an alias that also runs `tsc` project-wide; there is no ESLint dependency or config in the project), and `pnpm build` all pass locally.

## Known gaps or unknowns

- No dedicated bank reconciliation feature (matching bank statement lines against recorded transactions) was found in migrations or `src/features`.
- No security deposit management, deferred revenue handling, or multi-currency support was found in migrations or `src/features`.
- The Supabase migration-evidence script (`scripts/collect-supabase-migration-evidence.sh`, run in CI via `pnpm supabase:migration-evidence`) only performs local, read-only checks (file ordering, presence of env vars); it does not verify that migrations have actually been applied to any live Supabase project. Live schema state must be checked separately via the Supabase project directly before relying on any migration as "deployed."

### Migration consolidation audit findings (2026-07-05, live-verified against `nnggcnpcuomwfuupupwg`)

1. **~31 live tables are not represented in any file under `supabase/migrations/`.** The live `public` schema has 54 base tables; the migration files (18 files, 25 `create table` statements) only account for 25 of them, and 2 of those 25 (`contract_documents`, `communication_records`) are not actually live — so the real overlap is 23/54. Untracked live tables include ones with real data (`tenants`: 40 rows, `sessions`: 15 rows, `automation_jobs`: 9 rows) as well as empty scaffolding tables (`budgets`, `commissions`, `leads`, `lands`, `missions`, `governance`, `kpi_snapshots`, `attachments`, `auto_backups`, `automation_run_logs`, `automation_runs`, `account_balances`, `app_notifications`, `company-assets`, `deposit_txs`, `notification_templates`, `notifications`, `outgoing_notifications`, `owner_settlements`, `profiles`, `schema_refactor_notes`, `serials`, `settings`, `snapshots`, `status_history`, `status_transition_rules`, `tenant_balances`, `utility_bills`). **This means the migrations directory cannot currently be treated as a source of truth for the live schema.** Closing this gap is now in progress; see "Baseline capture strategy and ordering" below for the approach, the file split, and a related enum-type gap discovered along the way.
2. **Two committed migrations were never applied to production**: `20260616090000_complete_planned_product_modules.sql` (creates `communication_records`) and `20260703010000_contract_documents.sql` (creates `contract_documents`, referenced by the PR #1036 contract-document-upload feature). Confirmed via direct query against `information_schema.tables` on `nnggcnpcuomwfuupupwg` — neither table exists live. Any user hitting the contract documents feature in production will get a runtime error. **Needs an operator decision + `apply_migration` run as its own action**, separate from this consolidation.
3. **`20260628000000_fix_find_payment_account_id.sql` is an intentional no-op** (`SELECT 1;`) — its header explains the fix it describes was already applied live under a different migration (`20260615000100_fix_invoice_payment_account_resolution`, hardened by `20260615000300`). No action needed; kept for changelog continuity.
4. **The live `supabase_migrations.schema_migrations` ledger (117 entries) has ~10 duplicate-named entries** from past incidents (e.g. two rows named `custom_access_token_hook`, two named `p0_harden_rls_user_scoped`, `_dup1`-suffixed rows for `lock_down_custom_access_token_hook_execute` / `enable_rls_on_exposed_tables` / `harden_internal_rpc_execution`). These are historical facts already applied to production; rewriting a live project's own migration ledger is high-risk for no schema benefit, so they were left as-is and are documented here as an informational finding only.
5. The 5 oldest local migration files (formerly `0001`–`0005`, non-timestamped from the PR #916 baseline squash) were renamed to `20250101000001`–`20250101000005` and registered as already-applied in the live ledger (metadata-only, no DDL re-run) so `scripts/collect-supabase-migration-evidence.sh` reports zero "invalid filename timestamp" / "non-monotonic" findings going forward.

**Status: baseline capture merged (2026-07-05, PR #1045).** The three files below (`20260705000000`–`20260705000002`) are now on `main`. Two follow-ups remain open and are tracked in `docs/NEXT.md` under "Ready now": applying the 2 committed-but-unapplied migrations (`communication_records`, `contract_documents`) to production, and auditing the 9 orphaned enum types for non-column usage before deciding to capture or drop them.

### Baseline capture strategy and ordering (2026-07-05)

**Strategy**: every statement in the baseline files below was generated by direct introspection of the live schema on `nnggcnpcuomwfuupupwg` (`information_schema.columns`, `pg_constraint`, `pg_indexes`, `pg_policies`, `information_schema.triggers`, `pg_type`/`pg_enum`) — not hand-written or simplified from assumption or from docs. All three files are registered in the live `supabase_migrations.schema_migrations` ledger as already-applied (metadata-only insert, no DDL executed), because the schema they describe is already live. The goal is to make `supabase/migrations/` match reality, not to re-run DDL against tables/types that already exist.

**File split and required order** (dependencies flow forward only):

1. `20260705000000_capture_live_enums_and_users_compatibility.sql` — creates the 4 live enum types that are actually used by a column (`user_role`, `entity_status`, `charged_to_type`, `utility_status`), then migrates `public.users.role`/`public.users.status` from the `text + check` shape in `20250101000001_core_schema.sql` to the enum types, matching what's live today (no check constraints remain on `public.users` live).
2. `20260705000001_baseline_capture_untracked_tables_batch_b.sql` — the 4 untracked tables holding live data: `tenants`, `sessions`, `automation_jobs`, `profiles`. Must sort before Batch A because `automation_jobs.id` is referenced by `automation_run_logs.job_id` / `automation_runs.job_id`, and `tenants.id` is referenced by `tenant_balances.tenant_id`, both in Batch A.
3. `20260705000002_baseline_capture_untracked_tables_batch_a.sql` — the remaining 27 untracked tables, all empty/scaffolding. Depends on both files above (enum types for `utility_bills`, and `automation_jobs`/`tenants` for the FKs noted above).

**Notable findings captured (not corrected) during this pass:**
- `sessions_select_own` and `sessions_delete_own` RLS policies compare `auth.uid()` to `sessions.id` (the session row's own primary key) rather than `sessions.user_id`. This looks like a live bug but is documented as-is rather than silently fixed, since the goal of the baseline is to describe live reality.
- `tenants` and, within Batch A, `deposit_txs` and `owner_settlements` have `FORCE ROW LEVEL SECURITY` enabled live (not just `ENABLE ROW LEVEL SECURITY`) — captured explicitly in the corresponding `alter table ... force row level security` statements.
- `profiles.id` and `profiles.auth_user_id` both have foreign keys to `auth.users(id)` (`profiles_id_fkey` with `ON DELETE CASCADE`, `profiles_auth_user_id_fkey` with no action) — both are captured in Batch B.

**Orphaned live-schema enum types — audit complete (2026-07-05).** Live introspection of `pg_type`/`pg_enum` on `nnggcnpcuomwfuupupwg` found 13 enum types total; only 4 are referenced by any live column (captured in `20260705000000_...`). The other 9 — `contract_status`, `invoice_status`, `invoice_type`, `journal_entry_type`, `maintenance_status`, `payment_method`, `property_status`, `transaction_status`, `unit_status` — were audited for usage beyond columns and confirmed to have **zero references** across every location checked:
- Function/RPC signatures (`pg_get_function_arguments` / `pg_get_function_result`): none.
- Function bodies, checked for actual `::type_name` casts (not string-literal matches — an earlier regex pass on raw body text falsely flagged `update_unit_status`, `update_invoice_status`, `normalize_unit_status_contract`, and `record_invoice_payment_atomic`, but all four only assign plain string literals like `'ACTIVE'`/`'PAID'` to `text` columns; `units.status`, `contracts.status`, `invoices.status`, and `maintenance_records.status` are all `text`, not enum, confirmed via `information_schema.columns`): none.
- View definitions (`pg_views.definition`): none.
- RLS policy `qual`/`with_check` expressions (`pg_policies`): none.
- Composite type attributes, domain base types, index expressions: none.

**Conclusion**: these 9 types are genuinely unused scaffolding, not enums quietly relied on elsewhere. Either dropping them or leaving them in place is safe — no code or data depends on them today. Decision on which is a product-owner call, tracked in `docs/NEXT.md` under "Ready now"; not made unilaterally here since dropping live database objects is a deliberate action outside a routine capture pass.

## Before claiming a feature is complete

1. Confirm the relevant service file(s) under `rentrix-app/src/features/<module>/` call Supabase (not a local store).
2. Confirm a matching migration exists under `supabase/migrations/` and check the live Supabase project schema and RLS policies, not just the migration file.
3. Run the relevant test command(s) from `docs/TESTING.md` and confirm they pass.
4. Check CI (`.github/workflows/ci.yml`) status on the branch/PR.
