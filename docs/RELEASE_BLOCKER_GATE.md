# Release blocker gate

## Decision rule

No visual improvement, refactor, naming cleanup, or repository reorganization is part of this gate. Release is blocked only by:

1. data loss or partial writes;
2. real authentication failure;
3. contract creation failure or invalid overlap;
4. collection failure or a serious financial inconsistency;
5. a critical authorization or secret-exposure defect.

A skipped or conditionally omitted blocker test is a failure. Missing staging secrets produce `BLOCKED`, never `PASS`.

## Executable coverage

| Risk | Executable evidence | Environment | Pass condition |
| --- | --- | --- | --- |
| Data loss / partial writes | `supabase/tests/release_blockers.sql` after a full empty-database migration replay | Isolated local Supabase in CI | Every migration applies; rejected overpayment leaves invoice, payment, and receipt counts unchanged |
| Authentication | `rentrix-app/e2e/release-blocker-auth.spec.ts` | Deployed staging with a dedicated test account | Valid login, invalid password, invalidated session, and logout all execute with zero skips |
| Contract creation | `supabase/tests/release_blockers.sql` | Isolated local Supabase in CI | ADMIN creates one valid contract; USER is denied; overlapping dates are rejected |
| Collection / financial safety | `supabase/tests/release_blockers.sql` plus the existing financial suite | Isolated local Supabase in CI | One payment and one receipt per request ID; correct paid amount; negative and excessive amounts fail without partial writes |
| Critical security | SQL RLS/role tests, safe `search_path` catalog assertions, and `scripts/check-release-secret-leaks.sh` | Isolated local Supabase and production browser build artifact | Anonymous/USER access is denied where required; critical definer RPCs pin search path; no private-key/service-role marker reaches `dist` |

## CI jobs

The workflow `.github/workflows/release-blocker-gate.yml` exposes three mandatory jobs:

- `release-blocker-code`
- `release-blocker-database`
- `release-blocker-authenticated-staging`

The database job creates an ephemeral Supabase configuration, starts an isolated stack, replays the complete migration chain from an empty database, then executes pgTAP tests. It does not connect to production and must not be conditionally skipped on pull requests or manual gate runs.

The staging authentication job fails before Playwright starts when any required value is absent:

- `E2E_STAGING_BASE_URL`
- `E2E_TEST_EMAIL`
- `E2E_TEST_PASSWORD`
- `E2E_SUPABASE_URL`
- `E2E_SUPABASE_ANON_KEY`

Playwright traces, screenshots, video, and reports are retained only on failure.

## Current execution status

Integrated gate baseline: PR #1150/#1151 merged in current local commit `8597d96bf8e64a57c06c5427c1707a9f23125ca8`. The container has no configured git remote, so PR #1152/main could not be fetched or verified locally in this pass.

Local CI/readiness pass on 2026-07-14 from branch `ci-release-readiness-phase`:

| Check | Result | Evidence |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | **PASS with warning** | Dependencies were already locked/current; pnpm reported ignored dependency build scripts for `core-js` and `esbuild` |
| `pnpm typecheck` | **PASS** | Root project references and app TypeScript completed successfully |
| `pnpm lint` | **PASS** | Project lint script is the app TypeScript no-emit check |
| `pnpm build` | **PASS** | Vite production build and PWA generation completed with placeholder Supabase env |
| `pnpm --filter ./rentrix-app run typecheck:test` | **PASS** | Test TypeScript project completed successfully |
| `pnpm --filter ./rentrix-app test` | **PASS** | 120 files / 546 tests passed |
| `pnpm --filter ./rentrix-app run test:financials` | **PASS** | 36 files / 157 tests passed, including payment/receipt void/report parity tests |
| `pnpm supabase:migration-evidence` | **BLOCKED for live reconciliation** | Local migration filename/order preflight passed; live migration-state reconciliation was blocked by missing `SUPABASE_PROJECT_REF` or `VITE_SUPABASE_URL`, `SUPABASE_ACCESS_TOKEN`, and `SUPABASE_DB_URL` |
| `pnpm supabase:live-readiness` | **BLOCKED** | Failed closed because `SUPABASE_DB_URL` is not set; no live/staging database read occurred |
| `pnpm e2e` | **BLOCKED** | Playwright Chromium executable was absent; `pnpm e2e:install` could not download Chromium because `https://cdn.playwright.dev/...` returned `403 Domain forbidden` in this environment |
| `pnpm check:docs` | **PASS** | Maintained Markdown link check passed |
| `pnpm --filter ./rentrix-app run check:architecture` | **PASS** | Architecture check completed successfully |
| Gate script validation and browser secret-marker scan | **PASS** | `bash -n scripts/check-release-secret-leaks.sh`, `node --check scripts/assert-release-blocker-env.mjs`, and `bash scripts/check-release-secret-leaks.sh rentrix-app/dist` completed successfully |

Release gate workflow review on 2026-07-14:

| Job | Current configuration | Blocking behavior |
| --- | --- | --- |
| `release-blocker-code` | Runs for pull requests to `main` and manual dispatch with no job-level skip condition | Code/type/test/build/secret checks must pass |
| `release-blocker-database` | Runs for pull requests to `main` and manual dispatch with no job-level skip condition | Starts isolated Supabase, replays migrations, and runs pgTAP blockers; local container could not execute this because Docker is not installed |
| `release-blocker-authenticated-staging` | Runs for pull requests to `main` and manual dispatch after `release-blocker-code`; it has no job-level skip condition | Fails closed before Playwright if any required staging secret is absent |

Required staging/auth secrets for the authenticated release blocker remain:

- `E2E_STAGING_BASE_URL`
- `E2E_TEST_EMAIL`
- `E2E_TEST_PASSWORD`
- `E2E_SUPABASE_URL`
- `E2E_SUPABASE_ANON_KEY`

Required live/read-only Supabase inputs remain:

- `SUPABASE_DB_URL` for `pnpm supabase:live-readiness`
- `SUPABASE_PROJECT_REF` or `VITE_SUPABASE_URL`, plus `SUPABASE_ACCESS_TOKEN` and/or `SUPABASE_DB_URL`, for live migration evidence reconciliation

Overall status: **BLOCKED — NOT RELEASE READY** for production/staging sign-off. Local TypeScript, build, unit/integration, financial, migration-contract, documentation, architecture, and secret-scan checks are green. Browser E2E, live Supabase readiness, and isolated Docker-backed Supabase pgTAP replay remain blocked by environment capabilities or missing non-production secrets, not by an in-repository code failure observed during this pass.

## Deferred observations

Any non-blocking UX, architecture, naming, code organization, or documentation preference discovered while this gate runs is recorded separately and is not implemented in this scope.
