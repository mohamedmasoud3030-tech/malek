# Release Convergence & Production Repair — Report

> ## ⚠️ SUPERSEDED — 2026-09-17, later the same day. HISTORICAL RECORD ONLY.
>
> This is the phase-2 convergence report. Its corrections to the record (the
> `v_existing_match_id` non-finding, the 27 archived ledger-only statements)
> remain valid and are still relied on. Its status lines do not: the branch was
> subsequently re-based onto the current `main` (`8c2605e0`) and the phase-4
> work landed as `1a22e7af`. Current state and the owner-report reconciliation
> result are in `PHASE4_CONVERGENCE_REPORT_20260917.md`, which supersedes the
> status portion of this file.

**Date:** 2026-09-17
**Branch:** `arena/01a0ad8e-malek` (from `main` @ `e7943a5e`)
**Scope:** repository, CI, database, security surface, tests, deployment
**Method:** every claim below is backed by a command, a file and line, or a live
HTTP response. Documentation prose was never used as evidence, and no finding
was softened to match the project's self-reporting.

---

## 0. What changed in the record

Before the repair work, one widely-repeated conclusion had to be corrected. It
was wrong, and it was driving the whole database plan.

`docs/execution/evidence/live-parity-20260911/ledger-parity-crosswalk.md`
claimed the single net functional gap between production and this repository was
a missing `v_existing_match_id` dedupe guard inside the bank-reconciliation
matching RPC. **`v_existing_match_id` is a declared-but-unused local variable:**

```
$ grep -rn 'v_existing_match_id' --include='*.sql' .
./supabase/migrations/20260901000026_fix_bank_reconciliation_rpc_validation.sql:23:  v_existing_match_id uuid;
```

One hit in the entire repository — the declaration. It is never assigned and
never read, so it guards nothing in the repository either. A probe could not
have found it live, and its absence was never evidence of drift. The
"production is missing the dedupe guard" claim, and the "`db push` is unsafe
because a security guard is missing" framing that followed from it, do not
hold up.

Probing the same question directly gives the honest answer: **the repository's
own code is where the unused variable came from**, and the divergence between
live and repository versions of the five suspect migrations is
formatting-and-transient-check level, not missing-security-control level.

Two further corrections are recorded in place, in the files themselves, so the
stale claims cannot be re-cited:

| File | Correction added |
|---|---|
| `docs/execution/evidence/live-parity-20260911/ledger-parity-crosswalk.md` | Status banner: historical snapshot; the "net gap" claim is wrong; the snapshot's counts are from 2026-09-11 and seven later migrations are not in them. |
| `docs/RELEASE_EVIDENCE_LEDGER.md` | Status banner: its CI/deployment rows cite runs from 2026-07-27 at `7dde0036` and are **not** evidence for current `main` (`e7943a5e`). |

---

## 1. Repository

**Baseline is healthy and unchanged in behaviour.** No business logic was
altered. The working tree contains only additions that make release state
verifiable, plus one forward-only security convergence migration.

New, tracked artifacts:

| Path | Purpose |
|---|---|
| `.github/workflows/release-blocker-gate.yml` | Rebuilt. Was three echo-and-succeed jobs; now performs real validation and refuses to report green unless every gate ran. |
| `scripts/check-workflow-honesty.mjs` | Guard: fails on any workflow job that does no real work, and on green deferral placeholders. |
| `scripts/check-workflow-honesty.test.mjs` | Self-test for the above, including the two shapes that caused the original defect. |
| `rentrix-app/scripts/verify-deployment-identity.mjs` | Proves deployed SHA == expected SHA (and schema digest), fail-closed. |
| `rentrix-app/scripts/verify-deployment-identity.test.mjs` | Self-test pinning the verifier's failure modes. |
| `rentrix-app/playwright.release.config.ts` | Real-backend Playwright config: no `webServer`, requires explicit `E2E_BASE_URL`, `retries: 0`. |
| `rentrix-app/e2e/release/env.ts` | Fail-closed environment loader for real-backend suites. |
| `rentrix-app/e2e/release/production-smoke.spec.ts` | Read-only post-deploy smoke suite. |
| `rentrix-app/e2e/release/real-stack-journey.spec.ts` | Real end-to-end journey against a real Supabase project (isolated environment only). |
| `rentrix-app/src/test/release-boundary.test.ts` | Guard keeping the hermetic and real-backend categories from ever merging. |
| `supabase/migrations/20260917000001_converge_authenticated_delete_privileges.sql` | Forward-only, revoke-only ACL convergence (see §4). |
| `scripts/db0/acl-convergence.test.mjs` | Proves the convergence end state on a real PostgreSQL engine. |

Deleted, because they were inert or obsolete rather than merely old:

| Path | Why |
|---|---|
| `.github/workflows/release-blocker-gate.yml` jobs `release-blocker-code`, `release-blocker-database`, `release-blocker-authenticated-staging` | Each ran `echo` and exited zero on every pull request. |
| `.github/workflows/browser-readiness.yml` job `browser-smoke` | Echoed a deferral notice and succeeded on ordinary PRs, producing a green browser check for a matrix that never ran. The real `browser-smoke-shard` job is untouched. |

The tree is otherwise clean: `git status --short` shows only intended
modifications and the new files above, with no scratch, temp, debug or generated
artifacts.

`pnpm typecheck`, `pnpm --filter ./rentrix-app run typecheck:test`, `pnpm build`,
`pnpm check:docs`, `pnpm check:business-rules`, `pnpm check:execution-plan`,
`pnpm --filter ./rentrix-app run check:architecture` and
`pnpm --filter ./rentrix-app run check:frontend-db-contract` all pass — see §7.

---

## 2. CI

### The defect

`.github/workflows/release-blocker-gate.yml` exposed a job literally named
"Release Blocker Gate" that ran `echo` and exited zero on every pull request.
Any branch protection rule requiring it was satisfied by a job that validated
nothing. That is worse than having no gate: it manufactures confidence.

### The repair

The workflow was rebuilt, not restyled:

- **No `pull_request` trigger.** Ordinary PRs can no longer acquire a misleading
  green release context. It runs on `workflow_dispatch` and on `release/**`
  pushes.
- Each job now does the work its name claims: full install, governance guards,
  typecheck, test-typecheck, lint, architecture check, the full application test
  suite, the accessibility gate, the financial safety suite, the runtime
  contract suite, migration↔type parity, the canonical database gate, the RLS
  matrix, the frontend↔database contract gate, and a production build.
- `migration-ledger-parity` now runs `scripts/verify-migration-ledger-parity.sh`
  and `scripts/verify-supabase-live-readiness.sh` as **hard-failing** steps. A
  missing read-only database credential is an error, not a skip.
- `deployment-identity` runs the new verifier against the deployed origin.
- `production-smoke` runs the new read-only suite against the deployment.
- `real-stack-journey` runs the real end-to-end journey against an isolated
  environment, and fails — loudly, with an explicit message — when no isolated
  target is configured, so a missing environment can never read as "verified".
- `release-verdict` re-checks every dependency's result and fails unless all are
  `success`.

### The guard against regression

`scripts/check-workflow-honesty.mjs` scans every workflow and fails on a job
whose steps are only `echo`/`true`/`:`/`exit 0`, and on a step whose text admits
it is deferring work while still exiting zero. It runs from `ci.yml`'s
governance guard and from the release gate itself. Its self-test proves it
rejects the two shapes that caused this defect and accepts honest workflows.
Current result: **passes for 14 workflow files.**

### External blocker (not a repository defect)

GitHub Actions is not executing on this repository. Every check on `main` @
`e7943a5e` failed with zero steps and the annotation *"The job was not started
because recent account payments have failed or your spending limit needs to be
increased."* This is a GitHub account-level billing limitation. It cannot be
repaired from inside the repository.

Consequence: the rebuilt gate is structurally correct and locally reproducible,
but its first real hosted execution is pending. It must not be described as
"green in CI" until it has actually run.

Also observed, and worth an owner decision: the repository has a GitHub
*environment* literally named `SONAR_TOKEN` — an environment misnamed after a
secret. It is inert but confusing and should be removed or renamed.

---

## 3. Database

### What was verified

`supabase/migrations/` contains 107 migrations; the canonical chain replays from
a clean database and passes all six integrity gates (§5). `20260910000002` and
`20260910000003` are **applied in production** — they are the forward-carry pair
that exists precisely because `20260901000033`'s DO-block anchor is stale:
`20260901000064` moved `public.wp05_rpt_cash_flow_gl` into
`app_private.financial_cash_flow_gl_core`, so the original anchor can no longer
match. That is a correct forward-carried re-application, not drift.

Seven repository migrations post-date the last production inspection run
(`fd4dfd76`, 2026-09-12 02:52) and have never been applied:
`20260912000001`, `20260912000002`, `20260912000003`, `20260913000001`,
`20260913030547`, `20260915000000`, `20260915000001`. Their add-dates
(2026-09-12 19:34 → 2026-09-15 08:47) are all later than every inspection run,
so they were never in any deploy scope.

### The deploy job has never executed

Every inspected dispatch of `supabase-production-migrations.yml`
(`34668861090` @`fd4dfd76`, `34668860359`, `34663253441` @`4e3dd1fc`,
`34663252200`, `34662514549`) ran only `production inspect / read-only` or
`local preflight / no Production access`. The `approved production migration
deploy` job was **skipped in every single run**.

**No repository migration has ever reached production through CI.** Production
schema changes have come from manual, out-of-band application.

### The repair

`20260917000001_converge_authenticated_delete_privileges.sql` (see §4) is
forward-only and idempotent. It is deliberately written to **compute the end
state rather than replay an unknown history**, because the exact table list that
an out-of-band production grant touched cannot be enumerated from this
repository. A convergence migration is correct whether that grant ran, did not
run, or ran differently.

It has **not** been applied to production, and production has not been marked as
having applied it. Marking applied without applying is exactly the ledger fraud
this task forbids.

### Blocked, and honestly so

Production database credentials are not available in this environment
(`gh secret list` → `403 Resource not accessible by integration`), and the
`production-inspect` artifact is unreachable from this sandbox
(`gh run download` → `EOF` against the artifact blob store). The current live
schema therefore **cannot be re-measured here**, and this report does not claim
otherwise.

The path to convergence, not taken because it requires credentials:

1. Run `supabase-production-migrations.yml` with action `production-inspect` to
   freeze current truth read-only.
2. Run `supabase-live-readiness.sh` (now including the new security probes) to
   confirm the ACL end state.
3. Apply the seven outstanding migrations plus the convergence migration through
   the reviewed deploy path, in order, with a backup reference.
4. Re-run the parity check until it reports zero drift.

---

## 4. Security

No security control, RLS policy, authorization check, financial guard or
governance gate was weakened. One latent hazard was closed.

### The finding

`20260901000001_restore_dump_acl_lock.sql:20` grants
`insert, update, delete on table public.audit_log to authenticated`. The DELETE
half is not required by any application path and contradicts the repository's
own stated design ("hard DELETE is never granted: the frontend archives via soft
`deleted_at` UPDATEs", `20260912000003_complete_direct_write_acl_surface_restore.sql:34`).

**It is not currently exploitable.** `audit_log` has RLS enabled
(`20260901000000_canonical_baseline.sql:31994`) and its only policy is
`admin_read_audit_log ... FOR SELECT`, so no DELETE policy exists and RLS denies
the operation.

It is nonetheless a latent hazard: the outer PostgreSQL gate is **open** on a
tamper-evident audit trail, so a future permissive policy — a `FOR ALL` clause,
a new DELETE policy — would immediately expose audit-log deletion to the browser
role, with no second layer to catch it.

### Independent evidence that hard deletes are never wanted

Three sources agree, so the fix is not a stylistic preference:

1. The migrations state the invariant explicitly.
2. The frontend never issues one: 16 `.delete(` occurrences in
   `rentrix-app/src`, all `Map`/`Set` operations or negated assertions; zero
   `method: 'DELETE'` in `src/` or `e2e/`; 697 `deleted_at` references.
3. The repository pins that absence with tests, e.g.
   `rentrix-app/src/features/owners/services/owner-service.test.ts:156` asserts
   `not.toContain('.delete()')`.

### The fix

`20260917000001_converge_authenticated_delete_privileges.sql` removes the DELETE
and TRUNCATE privilege class from `authenticated`, `anon` and `PUBLIC` on every
table in `public`, and sets matching default privileges so tables created later
cannot silently reintroduce the gap.

Safety properties, all machine-checked:

- **Revoke-only.** No row is read, written, moved or deleted; no table, policy,
  function or trigger is altered. Reversal is a re-grant.
- **Cannot break a working path.** No application code issues a hard DELETE, and
  every affected table's RLS already denies it.
- **Idempotent.** Re-running is a no-op.
- **Cannot silently over-revoke.** Its own post-condition block re-asserts that
  the 16-table direct-write surface still holds INSERT+UPDATE,
  `maintenance_records` is still UPDATE-only, and raises otherwise.

### Verification

`scripts/db0/acl-convergence.test.mjs` boots a real PostgreSQL engine (PGlite),
replays all 108 migrations, and asserts the converged end state directly from
`information_schema` — no table may carry DELETE/TRUNCATE for a browser role,
the write surface is intact, maintenance is UPDATE-only, every public base table
has RLS.

`rentrix-app/src/features/auth/company-unscoped-tables-isolation.pglite.test.ts`
was **strengthened**, not relaxed. It previously proved audit-log immutability
only indirectly (RLS silently matched zero rows). It now also asserts
`has_table_privilege('authenticated', 'public.audit_log', 'DELETE')` is `false`,
so the guarantee no longer depends on RLS continuing to omit a DELETE clause.

`scripts/verify-supabase-live-readiness.sh` gained five read-only production
probes (P1–P5) that **raise**, turning a drifted live database red: no
DELETE/TRUNCATE for browser roles; the direct-write surface is intact;
`maintenance_records` is UPDATE-only; every public base table has RLS; every
`SECURITY DEFINER` function pins `search_path`. Their assertion bodies are
executed against real PostgreSQL in `scripts/db0/acl-convergence.test.mjs`, so
the SQL shipped for production measurement is proven to parse and to hold.

---

## 5. Tests

### Category separation is now explicit and guarded

| Category | Location | Backend | Proves |
|---|---|---|---|
| Unit / integration | `rentrix-app/src/**` | In-memory, real SQL via PGlite | Logic, RLS policy semantics, financial invariants |
| Deterministic browser E2E | `rentrix-app/e2e/*.spec.ts` | `fake-supabase-backend.ts`, `e2e.supabase.invalid` | UI regression only |
| Production smoke | `rentrix-app/e2e/release/production-smoke.spec.ts` | Real deployed app + real Supabase | Liveness, auth, tenant context, denial |
| Release journey | `rentrix-app/e2e/release/real-stack-journey.spec.ts` | Real deployed app + real Supabase (isolated) | Full stack, including one authorised mutation |

The four are kept apart by construction, and
`rentrix-app/src/test/release-boundary.test.ts` fails the build if they are ever
blurred — it asserts the hermetic config ignores `release/**` and pinned to a
never-resolvable backend, the release config has no `webServer` and no retries,
and both real-backend suites fail closed instead of skipping.

`playwright.config.ts` now carries `testIgnore: ['release/**']` so the hermetic
suite can never collect — and therefore never green-light — the real-backend
suites.

The production smoke suite is deliberately **read-only**. Its only POST is the
`current_company_id` resolver, which writes nothing, and the boundary guard
enforces that by inspecting the file's own text. Performing a mutation against
live production was rejected on policy grounds: the repository already confines
write rehearsals to isolated environments
(`scripts/assert-release-blocker-env.mjs`), and weakening that to make the smoke
suite "more end-to-end" would be a security regression.

### Honest limitations

- **Playwright cannot run locally in this sandbox.** `playwright install
  --with-deps chromium` fails on missing apt packages; a bare install fails to
  download the browser. The new suites are therefore **written, guarded, and
  wired, but not yet executed**. They must not be described as passing.
- Real-backend suites require secrets that are not present here
  (`E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `QA_*`). They fail rather than skip, by
  design.

### Results from the final revision

See §7 for the executed gate table.

---

## 6. Deployment

### Built artifact identity

`rentrix-app/scripts/write-build-proof.mjs` previously emitted only a SHA.
It now also emits a `schemaDigest` (sha256 over the sorted
`migration.sql:sha256(sql)` manifest) and `migrationCount`. Two builds shipping
different schema files can never share a digest, so "deployed == built" is
machine-provable rather than asserted.

`rentrix-app/scripts/verify-deployment-identity.mjs` consumes it and fails
closed: missing `--base-url`, missing or abbreviated `--expected-sha`,
non-HTTPS targets, malformed JSON, absent `sha`, mismatched SHA, mismatched
schema digest, and a `local` stamp are all hard failures. A deployment that
cannot prove identity goes red.

**Live deployment, measured this session:**

- `https://malek-plus.vercel.app/build-proof.json` →
  `{"sha":"e7943a5e4e91afc730ae80992b44984b8788fcf2"}` — equal to `main` HEAD, so
  the deployment is not stale.
- That artifact has not yet been rebuilt with the digest fields, so the
  digest comparison is wired but unproven until the next deploy.

### Post-deploy smoke

Defined and wired: app loads, unauthenticated entry point serves, deployment
identity is stamped, authentication works, tenant context resolves, a critical
read path returns company-scoped data, anonymous and forged-token access are
denied, and public legal surfaces deploy. Every step fails closed.

### The release path

`install → governance guards → typecheck → lint → architecture → unit+integration
→ a11y → financials → runtime contract → migration↔type parity → database gate
→ RLS matrix → frontend↔database contract → build → ledger parity → deployment
identity → production smoke → real-stack journey → verdict`.

The verdict step fails unless every upstream gate reports `success`, so the
"green while nothing ran" failure mode cannot recur.

---

## 7. Executed gate results

Recorded from the final revision on branch `arena/01a0ad8e-malek`. Exit codes
are captured directly from each command, not through a pipe — an earlier run of
this session did pipe into `tail`, which reports `tail`'s status and masked one
real test failure. That failure was found, diagnosed and fixed (`audit_log`
immutability now enforced at the privilege layer and asserted explicitly), and
the table below is from a clean run.

| Gate | Command | Result |
|---|---|---|
| Typecheck | `pnpm typecheck` | **PASS** (exit 0) |
| Test-project typecheck | `pnpm --filter ./rentrix-app run typecheck:test` | **PASS** (exit 0) |
| Full application test suite | `pnpm --filter ./rentrix-app test` | **PASS** — 556 files, 4078 tests, 0 failed, 545 s |
| Accessibility primitives | `pnpm --filter ./rentrix-app run test:a11y-primitives` | **PASS** — 15 tests |
| Financial safety suite | `pnpm --filter ./rentrix-app run test:financials` | **PASS** — 112 files, 792 tests |
| Runtime contract | `pnpm --filter ./rentrix-app run test:frontend-backend-runtime-contract` | **PASS** — 7 files, 51 tests |
| Canonical database gate | `pnpm db0:gate` | **PASS** — 7/7, incl. the new ACL convergence regressions |
| Migration↔type parity | `pnpm db0:check-types` | **PASS** (exit 0) |
| RLS / isolation | `pnpm db0:isolation` | **PASS** — 107 tenant tables, 255 policies, 411 functions, 0 violations |
| Six-role RLS matrix | `pnpm test:supabase:rls` | **PASS** — 84 checks |
| Production build | `pnpm build` | **PASS** — built in 13.01 s |
| Dependency audit | `pnpm audit --prod` | **PASS** — no known vulnerabilities |
| Docs link check | `pnpm check:docs` | **PASS** — 108 maintained Markdown files |
| Business rules | `pnpm check:business-rules` | **PASS** |
| Execution plan | `pnpm check:execution-plan` | **PASS** — 10 stages, 98 tasks, 18 decisions |
| Migration hygiene | `pnpm test:migration-hygiene` | **PASS** — 11 tests |
| Enterprise freeze | `pnpm test:enterprise-freeze` | **PASS** (exit 0) |
| GL write boundary | `pnpm test:gl-write-boundary` | **PASS** — 13 tests |
| Pilot seed | `pnpm test:pilot-seed` | **PASS** — 3 tests |
| Production demo preflight | `pnpm test:production-demo-preflight` | **PASS** — 7 tests |
| QA runtime | `pnpm test:qa-runtime` | **PASS** — 4 tests |
| Workflow honesty (new) | `pnpm test:workflow-honesty` | **PASS** — 4 tests; guard passes on 14 workflows |
| Deployment identity (new) | `pnpm test:deployment-identity` | **PASS** — failure modes pinned |
| Frontend↔database contract | `pnpm --filter ./rentrix-app run check:frontend-db-contract` | **PASS** — 32/37, 0 failed, 5 skipped |
| Architecture | `pnpm --filter ./rentrix-app run check:architecture` | **PASS** (exit 0) |

**Independent confirmation of the build artifact.** The digest emitted by the
build matches a separate recomputation over the same files, and the migration
count reflects the new migration:

```
built   : 77078c6339e455debe24e9c9ad15ab786ed477f94ae22b1330534f0ff7df4e46  (108 migrations)
recomputed: 77078c6339e455debe24e9c9ad15ab786ed477f94ae22b1330534f0ff7df4e46  (108 files)
```

**Not executed here, and not claimed:** the three real-backend Playwright suites
(no browser binary, no credentials), and any hosted CI run (Actions
billing-blocked).

---

## 8. Remaining blockers

Ordered by what unblocks the most.

| # | Blocker | Kind | Exact pending verification |
|---|---|---|---|
| 1 | GitHub Actions billing — no workflow executes on this repository | **External** (account-level) | Restore Actions spending; then the rebuilt `release-blocker-gate.yml` must be dispatched at `main` and observed green with real step logs. Until then CI evidence does not exist for the current revision. |
| 2 | No production database credential here (`gh secret list` → 403; inspect artifact download → EOF) | **External** (access) | With `SUPABASE_READONLY_DB_URL`: run `scripts/verify-migration-ledger-parity.sh` and the extended `scripts/verify-supabase-live-readiness.sh` to freeze live truth and confirm the ACL probes pass. |
| 3 | Seven repository migrations plus the ACL convergence migration are unapplied in production | **Consequential** | Apply through the reviewed `production-inspect → deploy` path with a backup reference; then re-run parity until drift is zero. Never `supabase migration repair` to hide it. |
| 4 | Branch protection and secret inventory unreadable (`403 Resource not accessible by integration`) | **External** (scope) | A token with `administration:read` is needed to confirm which check names branch protection actually requires, and therefore whether the old fake check is still a required status. |
| 5 | Real-backend suites written but never executed | **Verification gap** | Run `pnpm --filter ./rentrix-app run e2e:production-smoke` after the next deploy, and `e2e:release` against an isolated QA target. Playwright is unusable in this sandbox. |
| 6 | No isolated release-test tenant exists | **Consequential** | Provision a disposable Supabase project plus a QA deployment, supply `QA_*` secrets, so the mutating journey can run without ever touching business records. |
| 7 | `release-blocker-gate.yml` requires job names not yet confirmed as the ones branch protection demands | **Verification gap** | Confirm against repository settings and add the new job names as required checks, replacing the deleted fake ones. |
| 8 | GitHub environment `SONAR_TOKEN` is misnamed after a secret | **Housekeeping** | Rename or delete in repository settings; cannot be changed from the repository. |
| 9 | `rentrix-app/public/build-proof.json` is tracked but is build output (`{"sha":"local"}` is the committed placeholder) | **Housekeeping** | It is regenerated by `pnpm build` on every release, so the committed copy is stale by construction. Untracking and gitignoring it is the correct fix, but that changes deploy-time behaviour and could not be verified from here. The failure mode is currently safe: `verify-deployment-identity.mjs` rejects a `local` stamp, so a missing regeneration fails the release gate rather than certifying a wrong build. |

### Carried forward from the code-only audit (still valid, not yet actioned)

These were established by direct measurement during the audit phase and remain
true. They are not release blockers; they are recorded so the evidence is not
lost.

- **Duplicated currency logic with no parity test.** `src/lib/money.ts`,
  `src/lib/formatters.ts`, `src/services/documents/currencyPrecision.ts`,
  `src/lib/numberToArabicWords.ts` and `src/features/contracts/contractSchema.ts:69`
  each encode OMR scale independently. They agree across the eight supported
  codes and diverge on unsupported ones (for example `EUR`). Four independent
  implementations of a money rule are a latent financial-correctness risk.
- **Test-shape measurement.** 556 unit test files in `rentrix-app/src`; 169 read
  source text via `readFileSync`, and some assert on substrings (for example
  `accessibility-baseline.test.ts` asserting `toContain('<header')`) rather than
  on behaviour. Real behavioural tests do exist — `paymentService.test.ts` and
  22 PGlite replays among them — so this is a partial-honesty issue, not a
  fabricated-coverage issue.
- **Accessibility contract is narrower than it appears.**
  `primitives.axe.test.tsx` disables `color-contrast` and `target-size`, and the
  only end-to-end axe scan is against `/login`.
- **Self-report contradictions** (`RELEASE_EVIDENCE_LEDGER.md:20`,
  `docs/execution/10_STAGE_STATUS_AR.md:3`, `HANDOFF.md:149`) — mitigated for the
  first by the status banner added in §0; the others remain.
- **Advertised role count is wrong.** `src/features/landing/i18n/legal.ts:47,188`
  describes three roles; the code (`src/features/auth/permissions.ts:3`) and the
  database implement six.

### Definition-of-done status

**Not met.** Items 1, 2, 3, 5 and 6 above are unsatisfied, and each is
release-critical. The repository is internally consistent and every executable
gate passes locally, but "tested commit = built artifact = deployed commit =
production-verified" is **not** yet machine-proven end to end, and this report
does not claim otherwise.
