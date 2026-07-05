# Testing

All commands run from the repository root using pnpm workspaces.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build
pnpm --filter ./rentrix-app run typecheck:test
pnpm --filter ./rentrix-app test
pnpm --filter ./rentrix-app run test:financials
```

This is the same sequence `.github/workflows/ci.yml` runs (plus a `pnpm supabase:migration-evidence` preflight step before typecheck). CI sets placeholder `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` values so the app builds without real credentials; do the same locally if you hit Supabase-config errors during build. For an optional live read-only migration-ledger reconciliation, run `pnpm supabase:migration-evidence` with `SUPABASE_DB_URL` in an operator environment that has `psql` installed.

## What each command does

- **`pnpm install --frozen-lockfile`** — installs dependencies exactly as locked. Use this instead of a plain `pnpm install` to match CI.
- **`pnpm typecheck`** — runs `tsc -b` at the root, then delegates into `rentrix-app`'s own `typecheck` script (`tsc -p tsconfig.json --noEmit`). Run this after any TypeScript change.
- **`pnpm lint`** — runs `tsc -p tsconfig.json --noEmit` inside `rentrix-app` (same as `typecheck`). There is no ESLint in this project's toolchain (no `eslint` dependency is installed, no ESLint config exists); "lint passes" means "typechecks," nothing more. Adding real ESLint later requires installing the dependency and configuring it from scratch, not just changing this script.
- **`pnpm build`** — builds the production bundle via Vite (`vite build`). Run this before merging any change that could affect the build (new imports, config changes, route additions).
- **`pnpm --filter ./rentrix-app run typecheck:test`** — typechecks test files against `tsconfig.test.json`. Run this when you add or change test files, since it can catch type errors the main typecheck script won't (test files are excluded from the main `tsconfig.json`).
- **`pnpm --filter ./rentrix-app test`** — runs the main Vitest suite through Vitest's default test-file discovery (`*.test.ts(x)` / `*.spec.ts(x)` under `src`), so new colocated test files are picked up automatically without manual registration in `package.json`.
- **`pnpm --filter ./rentrix-app run test:financials`** — runs all tests under `rentrix-app/src/features/financials` (`vitest run --dir src/features/financials`), independent of the file list above. Always run this for any change touching `src/features/financials/**`, invoicing, payments, receipts, expenses, or money formatting/rounding logic (`lib/moneyNormalization.ts`, `features/financials/financialMath.ts`), even if the change looks unrelated on the surface.

## When to run what

- Small, isolated change with no schema/type impact: run `pnpm --filter ./rentrix-app test` (and `test:financials` if it touches financials) before opening a PR; run the full sequence above before merging.
- Any change to Supabase migrations, RPCs, or RLS policies: in addition to the standard suite, inspect the live Supabase project schema directly (see `docs/ARCHITECTURE.md` and `docs/CURRENT_STATE.md`). If `SUPABASE_DB_URL` is available, run `pnpm supabase:migration-evidence` to reconcile local migration filenames against the live ledger; passing local tests alone does not confirm a migration was applied correctly to a live database.
- Any change to routing, permissions, or navigation: run the full `test` suite, since route-guard and permission tests are part of the fixed file list.
- Any change to shared UI primitives (`components/ui/`, `components/layout/`): run the full `test` suite, since many features share these components.

## Manual checks

There is no automated visual regression or E2E suite in this repository at the time of writing. For UI changes, manually verify in a running `pnpm --filter ./rentrix-app dev` session, including RTL layout and Arabic text rendering, before considering the change complete.
