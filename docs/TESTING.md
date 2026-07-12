# Testing

All commands run from the repository root using pnpm workspaces.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build
pnpm supabase:migration-evidence
pnpm --filter ./rentrix-app run typecheck:test
pnpm --filter ./rentrix-app test
pnpm --filter ./rentrix-app run test:financials
pnpm e2e
pnpm supabase:live-readiness # optional; requires SUPABASE_DB_URL + psql
# For 99.9% readiness claims, also complete docs/RELEASE_EVIDENCE_LEDGER.md
# and docs/SEEDED_STAGING_READINESS_RUNBOOK.md.
```

This is the same core sequence `.github/workflows/ci.yml` runs (plus a `pnpm supabase:migration-evidence` preflight step before typecheck). CI sets placeholder `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` values so the app builds without real credentials; do the same locally if you hit Supabase-config errors during build. Browser smoke coverage now lives in `.github/workflows/browser-readiness.yml` and runs `pnpm e2e` on pull requests. For optional live read-only migration/schema/RPC/RLS reconciliation, run `pnpm supabase:live-readiness` with `SUPABASE_DB_URL` in an operator environment that has `psql` installed. A 99.9% readiness claim additionally requires completing `docs/RELEASE_EVIDENCE_LEDGER.md` and `docs/SEEDED_STAGING_READINESS_RUNBOOK.md` for the exact release commit.

## What each command does

- **`pnpm install --frozen-lockfile`** — installs dependencies exactly as locked. Use this instead of a plain `pnpm install` to match CI.
- **`pnpm typecheck`** — runs `tsc -b` at the root, then delegates into `rentrix-app`'s own `typecheck` script (`tsc -p tsconfig.json --noEmit`). Run this after any TypeScript change.
- **`pnpm lint`** — runs `tsc -p tsconfig.json --noEmit` inside `rentrix-app` (same as `typecheck`). There is no ESLint in this project's toolchain (no `eslint` dependency is installed, no ESLint config exists); "lint passes" means "typechecks," nothing more. Adding real ESLint later requires installing the dependency and configuring it from scratch, not just changing this script.
- **`pnpm build`** — builds the production bundle via Vite (`vite build`). Run this before merging any change that could affect the build (new imports, config changes, route additions).
- **`pnpm --filter ./rentrix-app run typecheck:test`** — typechecks test files against `tsconfig.test.json`. Run this when you add or change test files, since it can catch type errors the main typecheck script won't (test files are excluded from the main `tsconfig.json`).
- **`pnpm --filter ./rentrix-app test`** — runs the main Vitest suite through Vitest's default test-file discovery (`*.test.ts(x)` / `*.spec.ts(x)` under `src`), so new colocated test files are picked up automatically without manual registration in `package.json`.
- **`pnpm --filter ./rentrix-app run test:financials`** — runs all tests under `rentrix-app/src/features/financials` (`vitest run --dir src/features/financials`), independent of the file list above. Always run this for any change touching `src/features/financials/**`, invoicing, payments, receipts, expenses, or money formatting/rounding logic (`lib/moneyNormalization.ts`, `features/financials/financialMath.ts`), even if the change looks unrelated on the surface.
- **`pnpm e2e`** — runs Playwright browser smoke tests in Chromium at desktop/tablet/mobile breakpoints. The default local/PR mode starts Vite with placeholder Supabase env values and verifies unauthenticated login/protected-route behavior, captures screenshots, and runs an axe scan on the login surface. Authenticated staging coverage is opt-in and requires `E2E_BASE_URL`, `E2E_TEST_EMAIL`, and `E2E_TEST_PASSWORD`.
- **`pnpm supabase:live-readiness`** — runs read-only live database checks through `scripts/verify-supabase-live-readiness.sh`. It requires `SUPABASE_DB_URL` and `psql`; without those, the script exits with an environment-limitation status instead of pretending live readiness was verified.

## When to run what

- Small, isolated change with no schema/type impact: run `pnpm --filter ./rentrix-app test` (and `test:financials` if it touches financials) before opening a PR; run the full sequence above before merging.
- Any change to Supabase migrations, RPCs, or RLS policies: in addition to the standard suite, inspect the live Supabase project schema directly (see `docs/ARCHITECTURE.md` and `docs/CURRENT_STATE.md`). If `SUPABASE_DB_URL` is available, run `pnpm supabase:migration-evidence` to reconcile local migration filenames against the live ledger; passing local tests alone does not confirm a migration was applied correctly to a live database.
- Any change to routing, permissions, or navigation: run the full `test` suite so Vitest discovers and executes all colocated route-guard and permission tests.
- Any change to shared UI primitives (`components/ui/`, `components/layout/`): run the full `test` suite, since many features share these components.
- Any change that affects route reachability, auth/session UX, visual layout, RTL behavior, or release readiness should also run `pnpm e2e`.
- Any production-readiness claim involving Supabase schema, RLS, grants, or RPC definitions should run `pnpm supabase:live-readiness` in an approved read-only operator environment.

## Browser and manual checks

The repository now has a Playwright browser-smoke foundation, but it is not a full replacement for manual product validation. `pnpm e2e` covers unauthenticated login/protected-route smoke, screenshots at 375px/768px/1440px-class breakpoints, an axe scan for the login surface, keyboard focus order through the login form, and a mobile horizontal-overflow guard for the login route. For UI changes, still manually verify in a running `pnpm --filter ./rentrix-app dev` session, including RTL layout, Arabic text rendering, keyboard/focus behavior, and any authenticated or mutating workflow that cannot safely run without seeded staging credentials.

## Financial consistency checks

When touching receipts, payments, or collection reports, run the full app checks plus `pnpm --filter ./rentrix-app run test:financials`. Tests should prove that posted payments appear in receipts and reports, voided receipts remain visible as void history where applicable, and VOID amounts are excluded from financial totals.


## Release-candidate rule

Historical passing results do not transfer automatically to a new commit. For release sign-off, run every required command against one immutable release-candidate SHA and archive the output with the evidence described in `docs/RELEASE_READINESS.md`.

Documentation-only changes may skip application tests when they cannot affect executable behavior, but they still require link/path review, internal-consistency review, and a branch-to-main diff review.
