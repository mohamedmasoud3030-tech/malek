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

Integrated gate commit: PR #1148, head `e71b411fa95ad94ee1aead5634549f4fef48c85e`.

First observed run: GitHub Actions run `29347228855` on 2026-07-14.

| Job | Result | Evidence |
| --- | --- | --- |
| `release-blocker-code` | **PASS** | Typecheck, application tests, financial tests, production build, and browser secret-marker scan succeeded |
| `release-blocker-database` | **SKIPPED / BLOCKED** | The original workflow restricted the job to an optional manual input, so the PR run did not replay migrations or execute pgTAP blockers |
| `release-blocker-authenticated-staging` | **BLOCKED** | Preflight failed because all five staging/auth secrets were absent; Chromium and the real authentication scenarios did not run |

Overall status: **BLOCKED — NOT RELEASE READY**.

The follow-up change removes the conditional database skip so the isolated migration and pgTAP suite runs on every gate execution. Readiness still cannot be declared until the five staging secrets point to a non-production environment and all authentication scenarios execute successfully with zero skips.

## Deferred observations

Any non-blocking UX, architecture, naming, code organization, or documentation preference discovered while this gate runs is recorded separately and is not implemented in this scope.
