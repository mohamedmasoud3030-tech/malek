# Current State

This document describes the current checked-out repository state.
Verify code, migrations, tests, and CI before relying on it.

## Application

The active app lives in `rentrix-app/`. It is a Vite + React + TypeScript single-page app using TanStack Router (`rentrix-app/src/routeTree.ts`, `src/app/router.tsx`) and TanStack Query (`src/lib/query-client.ts`). It talks to Supabase (Postgres + Auth) as its backend via `src/lib/supabase.ts`.

## What has been verified from code and tests

- All feature service files under `rentrix-app/src/features/**` that read or write domain data (properties, units, people, owners, owner agreements, tenants, contracts, invoices, payments, receipts, expenses, maintenance, leads, lands, commissions, communication, settings, cost centers, payment terms, audit log, data integrity) import and call the Supabase client — none of the checked feature services persist domain data to `localStorage`, IndexedDB, or an in-memory store.
- `zustand` is used only for local UI state (`rentrix-app/src/store/ui-store.ts`: sidebar/theme/sync-status), not for domain data.
- `dexie` is listed as a dependency but has no import usages under `rentrix-app/src` at the time of this check — treat as unused/unverified rather than as an active persistence layer.
- Route guards (`rentrix-app/src/features/auth/route-guards.ts`, `rentrix-app/src/routeTree.ts`) check a Supabase session and, for permission-gated routes, an app permission (`rentrix-app/src/features/auth/permissions.ts`) before rendering.
- `supabase/migrations/` contains a migration (`0003_functions_triggers_and_rpcs.sql`) defining `record_invoice_payment_atomic` and `find_payment_account_id`, and a contract test (`rentrix-app/src/features/financials/payment-account-resolution-migration-contract.test.ts`) that asserts the function is text-based (not casting to `uuid`) and revokes public execute access on the helper function. This indicates the previously-known account-resolution bug has a code-level fix in the migration; live-database behavior still needs verification against the actual deployed Supabase project.
- Owner agreements (`supabase/migrations/20260628100000_owner_agreements_core.sql`), cost centers, VAT support, payment terms, and a cash-flow report migration all exist under `supabase/migrations/`.
- Maintenance cost resolution (`supabase/migrations/20260703000000_resolve_maintenance_with_expense.sql`) and contract document management (`supabase/migrations/20260703010000_contract_documents.sql`) exist as recent migrations, with matching frontend services/tests.
- Running `pnpm --filter ./rentrix-app run test` and `pnpm --filter ./rentrix-app run test:financials` locally with placeholder Supabase env vars passes (60 test files / 319 tests, and 20 test files / 77 tests, respectively, at the time of this check).
- `pnpm typecheck`, `pnpm lint` (which runs `tsc` project-wide, not ESLint, despite an `eslint.config.js` existing in `rentrix-app/`), and `pnpm build` all pass locally.

## Known gaps or unknowns

- No dedicated bank reconciliation feature (matching bank statement lines against recorded transactions) was found in migrations or `src/features`.
- No security deposit management, deferred revenue handling, or multi-currency support was found in migrations or `src/features`.
- `dexie` dependency's purpose is unverified — confirm whether it is dead weight or planned for an unbuilt feature before removing or building on it.
- The Supabase migration-evidence script (`scripts/collect-supabase-migration-evidence.sh`, run in CI via `pnpm supabase:migration-evidence`) only performs local, read-only checks (file ordering, presence of env vars); it does not verify that migrations have actually been applied to any live Supabase project. Live schema state must be checked separately via the Supabase project directly before relying on any migration as "deployed."
- `rentrix-app/eslint.config.js` exists but is not wired into `pnpm lint`; whether ESLint should run separately or was intentionally left out is unconfirmed.

## Before claiming a feature is complete

1. Confirm the relevant service file(s) under `rentrix-app/src/features/<module>/` call Supabase (not a local store).
2. Confirm a matching migration exists under `supabase/migrations/` and check the live Supabase project schema and RLS policies, not just the migration file.
3. Run the relevant test command(s) from `docs/TESTING.md` and confirm they pass.
4. Check CI (`.github/workflows/ci.yml`) status on the branch/PR.
