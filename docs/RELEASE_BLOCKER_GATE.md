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

Repository source of truth on 2026-07-15 is `main` commit
`77d8cbe04b5bd2776fbedbd74bdbce3c791062a8` (PR #1156). It includes the
clean-replay compatibility fixes from PR #1157 and PR #1158.

The latest completed release-gate run before this status update was run #28
(`29366249857`) on PR #1156's temporary merge ref
`d44055275b29d8a48c40b95f974c3808be769019`:

| Job | Result | Evidence |
| --- | --- | --- |
| `release-blocker-code` | **PASS** | Typecheck, application tests, financial tests, production build, and browser secret scan completed successfully |
| `release-blocker-database` | **FAIL on superseded merge ref** | Empty-database startup reached migration replay and stopped at `schema "app_private" does not exist`; the run checked out a merge ref based on `fe3ce1b5`, immediately before PR #1158 added that compatibility schema to `main` |
| `release-blocker-authenticated-staging` | **BLOCKED** | The preflight correctly failed closed because all five required staging values were absent; the authenticated browser tests did not run |

The database result above was not evidence that current `main` still failed:
its root cause was exactly the compatibility gap addressed by PR #1158, and
the failed run did not contain that PR.

Fresh run #29 (`29368732725`) on PR #1160 verified the next boundary on current
`main`:

| Job | Result | Evidence |
| --- | --- | --- |
| `release-blocker-code` | **PASS** | The complete code/type/test/build/secret-scan job passed again |
| `release-blocker-database` | **FAIL — fix in PR #1160** | Replay passed the `app_private` boundary, then `20260712020000_fix_tenant_balances_people_fk.sql` failed because captured `tenant_balances.tenant_id` was `text` while baseline `people.id` was `uuid` (`SQLSTATE 42804`) |
| `release-blocker-authenticated-staging` | **BLOCKED** | The same five staging values remain absent, so authenticated tests correctly failed closed with zero false passes |

PR #1160 now adds a fail-closed compatibility migration before the canonical
people foreign key. It derives both identifier types, validates UUID shape and
person membership before mutation, converts only supported `uuid`/`text`
layouts, and leaves already-aligned live layouts unchanged. PGlite execution
tests cover UUID conversion, the historical text no-op path, and invalid-value
rollback.

Fresh run #30 (`29369696984`) on PR #1160's then-current head confirmed that
the tenant-balance compatibility fix replayed successfully and exposed the next
clean-baseline incompatibility in
`20260713000002_fix_owner_balances_cascade.sql`: its production-oriented
comparison evaluated `text = uuid` when the baseline has UUID columns on both
sides (`SQLSTATE 42883`). PR #1160 now casts both identifiers to text in the
orphan preflight and delete guard, preserving the intended comparison for both
the clean `uuid/uuid` and historical `uuid/text` layouts. PGlite execution tests
cover both layouts and prove that orphan data fails closed before the guard is
installed.

Fresh run #31 (`29370113816`) verified both replay fixes, then exposed a third
captured-layout assumption in
`20260714000003_contract_balances_triggers.sql`: the backfill forced
`contracts.unit_id` to text even though the clean target column is UUID
(`SQLSTATE 42804`). PR #1160 now anchors trigger variables to the target
`contract_balances` column types and performs the UUID/text representation
conversion through typed PL/pgSQL assignment in the backfill. PGlite execution
tests cover clean UUID backfill plus trigger maintenance and the historical text
balance layout. The database job must pass on the latest PR head before these
replay fixes are considered verified.

Fresh run #32 (`29370512641`) verified the contract-balance migration and
replayed through `20260714000005`, then failed while creating
`rpt_financial_summary` because `NULLIF(due_date, '')` coerced the empty string
to the clean baseline's DATE type (`SQLSTATE 22007`). PR #1160 now normalizes
the source through `due_date::text` before applying the blank-value guard and
date cast. Execution tests cover both the clean DATE layout and the historical
TEXT layout with a blank due date. A fresh database run is still required.

Fresh run #33 (`29370759271`) verified the financial-summary correction and
replayed through `20260715000001`, then stopped in the guarded QA seed purge
because UUID columns were compared directly with its text identifiers
(`SQLSTATE 42883`). PR #1160 now compares every mixed-layout identifier through
its text representation while preserving the same deterministic QA keys and
all fail-closed guards. PGlite execution tests prove an empty clean UUID schema
is a no-op, an unmarked row with a deterministic key is rejected without
deletion, and only an explicitly QA-marked deterministic row is removed. A
fresh database run is still required.

Required staging/auth secrets for the authenticated release blocker remain:

- `E2E_STAGING_BASE_URL`
- `E2E_TEST_EMAIL`
- `E2E_TEST_PASSWORD`
- `E2E_SUPABASE_URL`
- `E2E_SUPABASE_ANON_KEY`

Required live/read-only Supabase inputs remain:

- `SUPABASE_DB_URL` for `pnpm supabase:live-readiness`
- `SUPABASE_PROJECT_REF` or `VITE_SUPABASE_URL`, plus `SUPABASE_ACCESS_TOKEN` and/or `SUPABASE_DB_URL`, for live migration evidence reconciliation

Overall status: **BLOCKED — NOT RELEASE READY** for production/staging sign-off. Application CI and Browser Readiness passed on PR #1156. The current-main database replay still needs a fresh CI result, live Supabase readiness remains unverified without approved read-only inputs, and authenticated staging remains blocked by missing non-production secrets.

Reports/UI Phase 1 remains blocked until the fresh database gate passes and
the authenticated staging job executes successfully with zero skips.

## Deferred observations

Any non-blocking UX, architecture, naming, code organization, or documentation preference discovered while this gate runs is recorded separately and is not implemented in this scope.
