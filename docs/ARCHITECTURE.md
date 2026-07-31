# Architecture

> **Brand note:** MALIK is the product's current commercial name; the `rentrix-app/` path and other technical identifiers below intentionally keep the legacy `rentrix` spelling.

## Repository layout

- `rentrix-app/` — the application (Vite + React + TypeScript). This is the only workspace package (see `pnpm-workspace.yaml`).
- `supabase/migrations/` — the sole active SQL migration source for schema, RLS policies, functions, triggers, and RPCs. Reconcile the ordered files with the live `supabase_migrations.schema_migrations` ledger before assuming a migration is deployed.
- `scripts/collect-supabase-migration-evidence.sh` — a read-only preflight script that checks migration file naming/ordering and reports whether Supabase credentials/CLI are available. Run via `pnpm supabase:migration-evidence`. If `SUPABASE_DB_URL` and `psql` are available, it also reconciles local migration filenames against the live ledger without mutating the database.
- `.github/workflows/ci.yml` — CI pipeline (see `docs/TESTING.md` for the commands it runs).
- Root `package.json` — workspace-level scripts (`build`, `typecheck`, `lint`, `supabase:migration-evidence`) that delegate into `rentrix-app` via `pnpm --filter`.
- `tsconfig.base.json` / `tsconfig.json` — shared TypeScript compiler options; `rentrix-app` extends these.

There is no separate `lib/` package at the workspace root. The workspace's only package is `rentrix-app`.

## Frontend structure (`rentrix-app/src/`)

- `routes/` and `app/router/route-tree.ts` — thin TanStack Router adapters and the programmatic route tree. Routes are grouped under `_auth` (login) and `_protected` (everything requiring a session).
- `app/` — composition infrastructure only: app shell/layout, navigation, providers, router, and the app-level not-found boundary. Business pages and services belong to `features/`; this boundary is enforced by `scripts/check-architecture.mjs`.
- `features/<domain>/` — one folder per business area (e.g. `contracts`, `owners`, `financials`, `maintenance`, `leads`, `lands`, `settings`, `audit`, `system`, `communication`, `commissions`, `people`, `properties`, `tenants`, `units`). Each typically contains a page component, a `*Service.ts` (Supabase calls), a `use*` hook (TanStack Query wiring), and colocated tests.
- `components/` — shared UI: layout primitives (`components/layout/`) and design-system primitives (`components/ui/`), following shadcn/ui conventions with Tailwind.
- `domain/` — pure, Supabase-independent domain types and logic (`types.ts`, `financial-settlements.ts`, `validators.ts`).
- `lib/` — cross-cutting utilities: `supabase.ts` (client), `query-client.ts` (TanStack Query client), `env.ts` (env validation/placeholder detection), `i18n.ts`, `formatters.ts`, `csvExport.ts`, `moneyNormalization.ts`.
- `services/` — cross-feature services not tied to one domain folder (e.g. `services/documents/` for PDF/document generation, `services/auth-service.ts`).
- `store/ui-store.ts` — Zustand store for local UI-only state (theme, sidebar, sync status). Not a data-persistence layer.
- `types/database.ts` — generated Supabase database types; `types/domain.ts` — shared domain-adjacent types used across features.

Active execution priorities are maintained in [`NEXT.md`](./NEXT.md); verified implementation and live-state caveats are maintained in [`APP_STATUS.md`](./APP_STATUS.md).

## Routing

TanStack Router routes are declared programmatically in `routeTree.ts`. Each route has `beforeLoad` guards that check `supabase.auth.getSession()` and, where relevant, call `assertSessionPermission` (`features/auth/route-guards.ts`) against permissions defined in `features/auth/permissions.ts`. Route `staticData.title` values are in Arabic and drive page titles/breadcrumbs.

## Finance routes and the `finance-hub` folder

The finance area of the product is intentionally split across **two top-level routes** with different jobs, plus an **internal workspace shell** that is not a route:

- `/financials` — the operational index. A directory of workspace cards (invoices, receipts, expenses, arrears, deposits, owner settlements, bank reconciliation) plus a small `FinancialReportsPreviewSection` for a current-month collection summary. Title: **Quick summary** (`financialsSectionSummary`).
- `/reports` — the executive analytics center. Tabs for collection, cashflow, arrears, accounting, statements, VAT, deferred revenue, etc. with filtering and CSV export. Guarded by `financial.reports.export`. Title: **Detailed reports** (`financialsSectionReports`).
- `rentrix-app/src/features/finance-hub/` — **not a route**. This folder contains the reusable `FinanceHubWorkspace` component (and `finance-hub-sections.ts`, `finance-hub-model.ts`) consumed by the per-workflow pages (`/invoices`, `/receipts`, `/expenses`, `/arrears`, `/deposits`, `/owner-settlements`, `/bank-reconciliation`, `/commissions`). Do **not** mount it as a route, and do **not** look for a `_protected.finance-hub.tsx` file — it does not exist on purpose.

The two titles (`financialsSectionSummary` / `financialsSectionReports`) are a deliberate contrast pair so the sidebar reads "Quick summary … Detailed reports" at a glance. The decision is recorded in [ADR-0008](./decisions/0008-financial-routes-ux-clarity.md).

## Data layer

- `lib/supabase.ts` creates a typed Supabase client (`createClient<Database>`) using `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from `lib/env.ts`. `env.ts` treats known placeholder URLs/keys (used in CI) as "not configured" and surfaces that state to the UI via runtime diagnostics rather than crashing.
- Each feature's `*Service.ts` file wraps Supabase queries/RPCs for that domain; hooks (`use*.ts`) wrap those services with TanStack Query for caching, loading, and error states.
- All contract write operations are implemented as atomic Postgres RPCs (`create_contract_atomic`, `update_contract_atomic`, `renew_contract_atomic`, `terminate_contract_atomic`, and `soft_delete_contract_atomic`) rather than direct client-side table writes against `contracts`. Other multi-step domain operations are likewise atomic RPCs (e.g. `resolve_maintenance_with_expense`, `record_invoice_payment_atomic`, `void_receipt_atomic`), keeping related writes and financial/accounting invariants consistent.

## Automated dependency boundary — Guard v2

The architecture check governs every feature directory, not a selected subset:

- every current cross-feature dependency edge is explicit in `scripts/check-architecture.mjs`;
- a new feature has no cross-feature access by default;
- adding an edge requires a reviewed integration seam and allow-list update in the same PR;
- presentation components cannot add new cross-feature service imports;
- eight existing presentation/service debts are frozen by exact file path and may only be removed, not expanded;
- app-composition, direct-Supabase presentation, page-size, and circular-import checks remain enforced.

This is a ratchet: it preserves current behavior while preventing architecture drift. It does not certify that every grandfathered deep import is ideal.

## Tests

Tests are colocated with the code they cover (`*.test.ts(x)`, `*.spec.ts`) and run with Vitest (`happy-dom` environment, configured in `vite.config.ts`). `rentrix-app/package.json`'s `test` script uses Vitest's default test-file discovery so new colocated tests are picked up automatically; `test:financials` remains an explicit financials-only suite via `--dir src/features/financials`. See `docs/TESTING.md` for exact commands.

## CI

`.github/workflows/ci.yml` runs on push/PR to `main`: install, migration-evidence check, typecheck (with diagnostics uploaded on failure), lint, build, test-file typecheck, the main test suite, and the financial test suite (with diagnostics uploaded on failure). It sets placeholder `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` values so the app can build without real credentials.

## Deployment

`rentrix-app/vercel.json` configures the Vercel build (`pnpm install --frozen-lockfile`, `pnpm --filter @workspace/rentrix run build`, output directory `dist/public`) and sets security headers (CSP, `X-Frame-Options`, etc.) scoped to the Supabase origin.

## Financial reporting architecture note

Payment-backed receipt screens and collection reports must use the same source: `public.payments` filtered to non-deleted, non-VOID rows for financial totals. The `rpt_daily_collection` RPC is expected to follow that same rule to avoid frontend/RPC drift.

## Legacy brand assets

The MALIK identity is a text-only wordmark: there is no logo file, no drawn `M`
glyph, and no property/building icon anywhere in the shipped UI.

Two legacy raster icons remain on disk but are no longer referenced by the PWA
manifest, the HTML head, the service-worker precache list, or any component:

- `rentrix-app/public/icon-rentrix-192.png`
- `rentrix-app/public/icon-rentrix-512.png`

They are kept so git history and existing bundle-budget expectations stay
intact. They are safe to delete once a MALIK icon set is approved; nothing
imports them today, and `rentrix-app/src/lib/brand-contract.test.ts` fails if
anything starts referencing them again.
