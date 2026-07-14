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

| Risk                          | Executable evidence                                                                                    | Environment                                                   | Pass condition                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Data loss / partial writes    | `supabase/tests/release_blockers.sql` after a full empty-database migration replay                     | Isolated local Supabase in CI                                 | Every migration applies; rejected overpayment leaves invoice, payment, and receipt counts unchanged                                      |
| Authentication                | `rentrix-app/e2e/release-blocker-auth.spec.ts`                                                         | Deployed staging with a dedicated test account                | Valid login, invalid password, invalidated session, and logout all execute with zero skips                                               |
| Contract creation             | `supabase/tests/release_blockers.sql`                                                                  | Isolated local Supabase in CI                                 | ADMIN creates one valid contract; USER is denied; overlapping dates are rejected                                                         |
| Collection / financial safety | `supabase/tests/release_blockers.sql` plus the existing financial suite                                | Isolated local Supabase in CI                                 | One payment and one receipt per request ID; correct paid amount; negative and excessive amounts fail without partial writes              |
| Critical security             | SQL RLS/role tests, safe `search_path` catalog assertions, and `scripts/check-release-secret-leaks.sh` | Isolated local Supabase and production browser build artifact | Anonymous/USER access is denied where required; critical definer RPCs pin search path; no private-key/service-role marker reaches `dist` |

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

Repository source of truth on 2026-07-15 is `main` commit
`f661bf39fc3b1204fc46f60243bdbab6d2ffee5c`, which contains the release-blocker
finalization merged through PR #1159. PR #1160 was closed without merge because
it duplicated an older subset of the same work.

The authoritative completed checks are on PR #1159 head
`2cd5201fa3e9548d7bc2f631b193f125790a6693`:

| Check                                   | Result                     | Evidence                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI / Typecheck, Lint & Build            | **PASS**                   | Workflow run `29371714348`                                                                                                                                                                                                                                                                                                                           |
| Browser Readiness / E2E Smoke           | **PASS**                   | Workflow run `29371714179`                                                                                                                                                                                                                                                                                                                           |
| `release-blocker-code`                  | **PASS**                   | Application/test typechecks, full and financial suites, production build, and browser secret scan completed                                                                                                                                                                                                                                          |
| `release-blocker-database`              | **PASS**                   | Workflow run `29371714202` started isolated Supabase, replayed every migration from an empty database, then passed contract, payment, rollback, and RLS pgTAP blockers                                                                                                                                                                               |
| `release-blocker-authenticated-staging` | **FAIL — fix in PR #1161** | Run `29375862284` received all five staging values and ran four real browser scenarios. Valid login, invalid credentials, and logout passed. Session invalidation failed before exercising the app because the test searched for Supabase's default `sb-...-auth-token` key while the application deliberately persists under `rentrix-auth-session` |

The database phase is therefore verified. PR #1161 aligns the authenticated
browser test with the application's explicit storage-key contract and must pass
all four staging scenarios with zero skips before release/staging sign-off.

Required staging/auth secrets for the authenticated release blocker remain:

- `E2E_STAGING_BASE_URL`
- `E2E_TEST_EMAIL`
- `E2E_TEST_PASSWORD`
- `E2E_SUPABASE_URL`
- `E2E_SUPABASE_ANON_KEY`

Required live/read-only Supabase inputs remain:

- `SUPABASE_DB_URL` for `pnpm supabase:live-readiness`
- `SUPABASE_PROJECT_REF` or `VITE_SUPABASE_URL`, plus `SUPABASE_ACCESS_TOKEN` and/or `SUPABASE_DB_URL`, for live migration evidence reconciliation

Overall status: **BLOCKED — NOT RELEASE READY** for production/staging sign-off.
Code, build, Browser Readiness, empty-database migration replay, and pgTAP are
green. The staging secrets are now available, but authenticated staging must be
rerun after the storage-key test correction. Live Supabase readiness remains
unverified without approved read-only inputs.

Reports/UI Phase 1 remains blocked until the authenticated staging job executes
successfully with zero skips on the exact candidate head.

## Deferred observations

Any non-blocking UX, architecture, naming, code organization, or documentation preference discovered while this gate runs is recorded separately and is not implemented in this scope.
