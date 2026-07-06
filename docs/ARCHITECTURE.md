# Architecture

## Repository layout

- `rentrix-app/` — the application (Vite + React + TypeScript). This is the only workspace package (see `pnpm-workspace.yaml`).
- `supabase/migrations/` — SQL migrations: schema, RLS policies, functions/triggers/RPCs, and later feature/fix migrations. Intended as the source of truth for the database, but as of 2026-07-05 it is known to be incomplete relative to the live `nnggcnpcuomwfuupupwg` project (~31 live tables have no corresponding migration file, and 2 committed migrations were never applied live) — see `supabase/migrations/README.md` and `docs/CURRENT_STATE.md` before assuming a file reflects live reality.
- `scripts/collect-supabase-migration-evidence.sh` — a read-only preflight script that checks migration file naming/ordering and reports whether Supabase credentials/CLI are available. Run via `pnpm supabase:migration-evidence`. If `SUPABASE_DB_URL` and `psql` are available, it also reconciles local migration filenames against the live `supabase_migrations.schema_migrations` ledger without mutating the database.
- `.github/workflows/ci.yml` — CI pipeline (see `docs/TESTING.md` for the commands it runs).
- Root `package.json` — workspace-level scripts (`build`, `typecheck`, `lint`, `supabase:migration-evidence`) that delegate into `rentrix-app` via `pnpm --filter`.
- `tsconfig.base.json` / `tsconfig.json` — shared TypeScript compiler options; `rentrix-app` extends these.

There is no separate `lib/` package at the workspace root; the prompt referenced one, but the workspace's only package is `rentrix-app`.

## Frontend structure (`rentrix-app/src/`)

- `routes/` and `routeTree.ts` — TanStack Router route definitions. `routeTree.ts` builds the route tree in code (not file-based routing) using `createRoute`/`createRootRoute`. Routes are grouped under `_auth` (login) and `_protected` (everything requiring a session).
- `app/` — app shell, providers (`providers.tsx` wraps `QueryClientProvider`), the dashboard page, and the router provider (`router.tsx`).
- `features/<domain>/` — one folder per business area (e.g. `contracts`, `owners`, `financials`, `maintenance`, `leads`, `lands`, `settings`, `audit`, `system`, `communication`, `commissions`, `people`, `properties`, `tenants`, `units`). Each typically contains a page component, a `*Service.ts` (Supabase calls), a `use*` hook (TanStack Query wiring), and colocated tests.
- `components/` — shared UI: layout primitives (`components/layout/`) and design-system primitives (`components/ui/`), following shadcn/ui conventions with Tailwind.
- `domain/` — pure, Supabase-independent domain types and logic (`types.ts`, `financial-settlements.ts`, `validators.ts`).
- `lib/` — cross-cutting utilities: `supabase.ts` (client), `query-client.ts` (TanStack Query client), `env.ts` (env validation/placeholder detection), `i18n.ts`, `formatters.ts`, `csvExport.ts`, `moneyNormalization.ts`.
- `services/` — cross-feature services not tied to one domain folder (e.g. `services/documents/` for PDF/document generation, `services/auth-service.ts`).
- `store/ui-store.ts` — Zustand store for local UI-only state (theme, sidebar, sync status). Not a data-persistence layer.
- `types/database.ts` — generated Supabase database types; `types/domain.ts` — shared domain-adjacent types used across features.

## Routing

TanStack Router routes are declared programmatically in `routeTree.ts`. Each route has `beforeLoad` guards that check `supabase.auth.getSession()` and, where relevant, call `assertSessionPermission` (`features/auth/route-guards.ts`) against permissions defined in `features/auth/permissions.ts`. Route `staticData.title` values are in Arabic and drive page titles/breadcrumbs.

## Data layer

- `lib/supabase.ts` creates a typed Supabase client (`createClient<Database>`) using `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from `lib/env.ts`. `env.ts` treats known placeholder URLs/keys (used in CI) as "not configured" and surfaces that state to the UI via runtime diagnostics rather than crashing.
- Each feature's `*Service.ts` file wraps Supabase queries/RPCs for that domain; hooks (`use*.ts`) wrap those services with TanStack Query for caching, loading, and error states.
- Some multi-step operations are implemented as atomic Postgres RPCs (e.g. `create_contract_atomic`, `resolve_maintenance_with_expense`, `record_invoice_payment_atomic`) rather than multiple client-side writes, to keep related writes consistent.

## Tests

Tests are colocated with the code they cover (`*.test.ts(x)`, `*.spec.ts`) and run with Vitest (`happy-dom` environment, configured in `vite.config.ts`). `rentrix-app/package.json`'s `test` script uses Vitest's default test-file discovery so new colocated tests are picked up automatically; `test:financials` remains an explicit financials-only suite via `--dir src/features/financials`. See `docs/TESTING.md` for exact commands.

## CI

`.github/workflows/ci.yml` runs on push/PR to `main`: install, migration-evidence check, typecheck (with diagnostics uploaded on failure), lint, build, test-file typecheck, the main test suite, and the financial test suite (with diagnostics uploaded on failure). It sets placeholder `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` values so the app can build without real credentials.

## Deployment

`rentrix-app/vercel.json` configures the Vercel build (`pnpm install --frozen-lockfile`, `pnpm --filter @workspace/rentrix run build`, output directory `dist/public`) and sets security headers (CSP, `X-Frame-Options`, etc.) scoped to the Supabase origin.

## Financial reporting architecture note

Payment-backed receipt screens and collection reports must use the same source: `public.payments` filtered to non-deleted, non-VOID rows for financial totals. The `rpt_daily_collection` RPC is expected to follow that same rule to avoid frontend/RPC drift.
