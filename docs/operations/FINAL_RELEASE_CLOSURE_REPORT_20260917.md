# MALEK — Final 4-Blocker Release Closure Report

**Generated:** 2026-09-17
**Verdict: NOT release-ready. All four blockers remain open. None can be closed from this environment, and no blocker is claimed as resolved.**

Every status below was measured today against live GitHub state, the live
deployment, and the live sandbox network — not read from a previous report.

---

## Release Candidate

**SHA:** `828ac232f93d7d4461c596c49833b987669da5e1` (branch tip;
parent `100b4662`, based on `main` @ `e7943a5e4e91afc730ae80992b44984b8788fcf2`)
**Branch:** `arena/01a0ad8e-malek` (pushed to `origin`)
**Deployment:** `https://malek-plus.vercel.app` — serves
`{"sha":"e7943a5e4e91afc730ae80992b44984b8788fcf2"}`, i.e. **`main` HEAD, not the
release candidate.** The candidate has never been built or deployed.

---

## Blocker 1 — CI

**Status: NOT RESOLVED — two independent external causes, both verified today.**

**Workflow run:** none exists for the release candidate. `total_count = 0` for
`head_sha=100b4662`. The latest run at `main` HEAD is `35099164627`
("CI / Typecheck, Lint & Build", push, `e7943a5e`, created 2026-09-16T13:00:14Z).

**Jobs:** `build` → `steps: 0`, conclusion `failure`; `heavy-validation` →
`skipped`.

**Result:** execution blocked at the account level. Current annotation on job
`104803915083`, read today (not from an old report):

> "The job was not started because recent account payments have failed or your
> spending limit needs to be increased. Please check the 'Billing & plans'
> section in your settings"

The billing restriction is therefore **still active** — the 2026-09-16 runs are
the same zero-step failures that were present on 2026-09-12, not recoveries.

A second, independent blocker: **the GitHub integration available here cannot
dispatch workflows.**

```
$ gh workflow run ci.yml --ref arena/01a0ad8e-malek
could not create workflow dispatch event: HTTP 403: Resource not accessible by integration
```

Admin endpoints are equally unreadable, so Actions enablement, spending limits
and billing state cannot be diagnosed further from here:

| Endpoint | Result |
|---|---|
| `repos/…/actions/permissions` | `403 Resource not accessible by integration` |
| `repos/…/actions/permissions/workflow` | `403 Resource not accessible by integration` |
| `repos/…/actions/runs/{id}/jobs` | OK (read) |
| `…/check-runs/{job}/annotations` | OK (read) |
| `…/branches/main/protection` | `403` |
| `…/environments` | OK (read) |

### Repository-controllable work: COMPLETE

| Check | Result |
|---|---|
| All workflow YAML valid | **PASS** — all 14 workflows parse with a real YAML parser, correct job and trigger counts |
| No job falsely reports success | **PASS** — `check-workflow-honesty.mjs` passes on 14 workflows; 6/6 self-tests |
| `release-verdict` requires all upstream jobs | **PASS** — now *enforced* by a new verdict-coverage check (see below) |
| Obsolete environment references | **1 found** — `hosted-qa-verification.yml` references `environment: qa`, which does not exist; GitHub would auto-create it with no protection |
| Environment naming | **No defect.** `name: production` correctly matches the `Production` environment — GitHub environment names are case-insensitive |
| Secret references | Readable; no reference resolves to a non-existent environment secret |

New in this pass: the honesty guard now verifies that any verdict job's `needs`
covers **every** other job in its workflow. Without it, a future PR could add a
gate that fails while the verdict still reports success. Two self-test cases pin
both directions.

### Findings requiring the repository owner

1. **`Production` environment has zero protection rules** (`protection_rules: []`,
   measured today). The deploy job is named *"approved production migration
   deploy"* and the workflow is described as *"manual, approval-gated"*, but
   **no reviewer approval is enforced**. `can_admins_bypass: false` is set, which
   only matters once a rule exists. This is a governance gap, not a code defect;
   it cannot be fixed from YAML and was not faked in YAML.
2. **`SONAR_TOKEN` is an orphaned environment**, not a secret.
   `sonar.yml` uses the *secret* `secrets.SONAR_TOKEN`. **No workflow references
   an environment named `SONAR_TOKEN`.** It was created 2026-07-15 with
   `protection_rules: []` and never updated. Delete it.

### Exact external actions required (Blocker 1)

1. Repository owner/account admin: clear the failed payment or raise the
   spending limit in **Settings → Billing & plans**.
2. Grant the Arena GitHub integration `actions:write` (and `administration:read`
   to diagnose) — otherwise no run can be dispatched from here.
3. Add **required reviewers** to the `Production` environment.
4. Delete the orphaned `SONAR_TOKEN` environment.

---

## Blocker 2 — Production DB

**Status: NOT RESOLVED — production access is unavailable, and the sandbox
cannot reach the Supabase API even with the supplied token.**

**Project:** `nnggcnpcuomwfuupupwg.supabase.co` ("Malek-Plus (live)",
ap-southeast-1), per the committed production demo template.

**Migration state:** **not re-measured today.** The last available measurement
remains the read-only crosswalk captured 2026-09-11 (109 ledger rows).

**Drift found:** not re-measurable today. Last known: the seven repository
migrations listed in Blocker 3 are absent from the production ledger.

**Drift resolved:** **none.** No production mutation was attempted. Nothing was
marked applied. No ledger repair was run.

### Why this is blocked — measured, not assumed

The sandbox egress allowlist is narrow. Probed directly:

| Host | Result |
|---|---|
| `registry.npmjs.org` | **200** |
| `api.supabase.com/v1/projects` | **ECONNRESET** |
| `malek-plus.vercel.app` | **ECONNRESET** |
| `cdn.playwright.dev` | **ECONNRESET** |

The Supabase Management API is **unreachable at the network layer**, not merely
unauthenticated. The supplied personal access token cannot be used from here at
all: the Management API requires a `Bearer` header, and the only egress channel
that works (`fetch_page`) cannot set headers and cannot POST the
`database/query` endpoint. The token was therefore never sent anywhere; it was
staged outside the repository, never printed, and **has been deleted** from the
sandbox.

> **Security note:** that token was pasted in plaintext in chat. It should be
> **rotated** regardless of this report, since chat transcripts are not a
> secret store.

### Exact external actions required (Blocker 2)

Any one of these unblocks the read-only inventory:

1. Run the inventory from a machine with Supabase egress, using
   `SUPABASE_READONLY_DB_URL` (see Blocker 3 for the exact command), **or**
2. Add `api.supabase.com` to this sandbox's egress allowlist and re-supply a
   token, **or**
3. Dispatch `.github/workflows/supabase-production-migrations.yml` with
   `action=production-inspect` from GitHub once Blocker 1 is resolved, and paste
   the resulting `production-inspect-<run_id>` artifact's `summary.txt`.

---

## Blocker 3 — Migrations

**Status: NOT RESOLVED — nothing was applied, and nothing was falsified.**

Eight migrations require reconciliation. **For every one of them the production
before/after state is unmeasurable from here**, so no action was taken. Applying
them blind would violate the standing rule against overwriting production
without understanding the delta.

| Migration | Production before | Action | Production after | Verification |
|---|---|---|---|---|
| `20260912000001_units_direct_write_acl_restore` | Not measurable — access unavailable | **None** (deliberately not applied) | Unchanged | None |
| `20260912000002_people_direct_write_acl_restore` | Not measurable | **None** | Unchanged | None |
| `20260912000003_complete_direct_write_acl_surface_restore` | Not measurable | **None** | Unchanged | None |
| `20260913000001_owner_valuation_omr_precision` | Not measurable | **None** | Unchanged | None |
| `20260913030547_fix_authenticated_acl_delete_and_spc_grants` | **Likely already applied** — the file header records its own live ledger version `20260913030547`; requires confirmation against the live ledger | **None** | Unchanged | None |
| `20260915000000_contract_people_defect_convergence` | Not measurable | **None** | Unchanged | None |
| `20260915000001_contract_release_blocker_remediation` | Not measurable | **None** | Unchanged | None |
| `20260917000001_converge_authenticated_delete_privileges` (new) | Not measurable | **None** | Unchanged | Proved only against a clean 108-migration replay, not against production |

**Ledger integrity: preserved.** No migration was marked applied. No history was
rewritten. No `supabase migration repair` was run. No `db push` was attempted.
No `db reset` was run.

**What *is* proven about the new migration** (locally, on real PostgreSQL):
`scripts/db0/acl-convergence.test.mjs` replays all 108 migrations into a clean
PGlite database and asserts the converged end state — no DELETE/TRUNCATE for
browser roles, the 16-table direct-write surface intact, `maintenance_records`
UPDATE-only, RLS on every public base table. That proves the migration is
correct and safe **on a conformant database**; it does **not** prove anything
about production.

**Exact command for the owner** (read-only, safe, from any machine with
Supabase egress):

```bash
export SUPABASE_DB_URL='<read-only connection string>'
bash scripts/verify-migration-ledger-parity.sh      # repo manifest vs live ledger
bash scripts/verify-supabase-live-readiness.sh      # includes the 5 security probes
```

---

## Blocker 4 — Real E2E

**Status: NOT RESOLVED — the suite has never executed.**

| Item | Value |
|---|---|
| Environment | None. `E2E_BASE_URL` unreachable from this sandbox (`ECONNRESET`); no QA target provisioned |
| Browser | **Not installable.** `cdn.playwright.dev` → `ECONNRESET` (and `playwright install --with-deps chromium` previously failed on unavailable apt packages) |
| Tests | **0 executed** |
| Passed | 0 |
| Failed | 0 (nothing ran — this is not a pass) |
| Production smoke | **Not executed** — also blocked by missing `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` (secret list is `403`) |

The suites are written, wired and fail-closed (`e2e/production-smoke.spec.ts`,
`e2e/real-stack-journey.spec.ts`), and `release-boundary.test.ts` keeps them from
ever being confused with the hermetic suite. But **written is not executed**, and
this report does not claim otherwise.

**Exact external actions required (Blocker 4):**
1. An isolated QA Supabase project plus a deployment serving the release SHA.
2. Secrets: `E2E_BASE_URL`, `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`,
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. A runner with browser download access (or an allowlisted
   `cdn.playwright.dev`) — CI would satisfy this once Blocker 1 is resolved.

---

## Final Integrity

| Link in the chain | Value |
|---|---|
| Git SHA (branch tip) | `828ac232f93d7d4461c596c49833b987669da5e1` |
| CI SHA | **none** — no workflow has ever executed for this SHA |
| Build SHA | `local` — the local build correctly stamps `local` when no CI/Vercel SHA is present |
| Deployment SHA | `e7943a5e4e91afc730ae80992b44984b8788fcf2` (`main` HEAD) |
| Production build-proof SHA | `e7943a5e4e91afc730ae80992b44984b8788fcf2` |

**They do not match. The integrity chain is unproven and cannot be closed until
the candidate is merged to `main`, deployed, and CI runs against it.**

The build-proof mechanism remains enabled and was not hand-edited: the digest is
derived at build time and `verify-deployment-identity.mjs` rejects a `local`
stamp, a missing field, or any SHA mismatch outright.

---

## Final Validation

Run from `828ac232` with **exit codes captured directly** — no pipe through
`tail` or `grep` that could mask a failure. (An earlier run in this session made
exactly that mistake and hid a real test failure; that is why this table is
built this way.)

| Gate | Command | Result | Exit |
|---|---|---|---|
| Full tests | `pnpm --filter ./rentrix-app test` | **PASS** — 556 files, 4078 tests, 0 failed (557 s) | 0 |
| Typecheck | `pnpm typecheck` | **PASS** | 0 |
| Test typecheck | `pnpm --filter ./rentrix-app run typecheck:test` | **PASS** | 0 |
| Build | `pnpm build` | **PASS** — built in 14.65 s | 0 |
| DB gates | `pnpm db0:gate` | **PASS** — 7/7 gates | 0 |
| Migration↔type parity | `pnpm db0:check-types` | **PASS** | 0 |
| DB isolation | `pnpm db0:isolation` | **PASS** — 107 tables, 255 policies, 411 functions, 0 violations | 0 |
| RLS | `pnpm test:supabase:rls` | **PASS** — 84 checks | 0 |
| Financial | `pnpm --filter ./rentrix-app run test:financials` | **PASS** — 112 files, 792 tests | 0 |
| Runtime contracts | `pnpm --filter ./rentrix-app run test:frontend-backend-runtime-contract` | **PASS** — 7 files, 51 tests | 0 |
| Security / audit | `pnpm audit --prod` | **PASS** — no known vulnerabilities | 0 |
| A11y primitives | `pnpm --filter ./rentrix-app run test:a11y-primitives` | **PASS** — 15 tests | 0 |
| Governance — docs | `pnpm check:docs` | **PASS** — 108 markdown files | 0 |
| Governance — business rules | `pnpm check:business-rules` | **PASS** | 0 |
| Governance — execution plan | `pnpm check:execution-plan` | **PASS** — 10 stages, 98 tasks, 18 decisions | 0 |
| Governance — migration hygiene | `pnpm test:migration-hygiene` | **PASS** (exit 0) | 0 |
| Governance — enterprise freeze | `pnpm test:enterprise-freeze` | **PASS** (exit 0) | 0 |
| Governance — GL write boundary | `pnpm test:gl-write-boundary` | **PASS** (exit 0) | 0 |
| Governance — pilot seed | `pnpm test:pilot-seed` | **PASS** (exit 0) | 0 |
| Governance — prod demo preflight | `pnpm test:production-demo-preflight` | **PASS** (exit 0) | 0 |
| Governance — QA runtime | `pnpm test:qa-runtime` | **PASS** (exit 0) | 0 |
| Governance — architecture | `pnpm --filter ./rentrix-app run check:architecture` | **PASS** (exit 0) | 0 |
| Governance — frontend↔DB contract | `pnpm --filter ./rentrix-app run check:frontend-db-contract` | **PASS** — dynamic contract inventory closed and fail-closed | 0 |
| Workflow honesty (new) | `pnpm test:workflow-honesty` | **PASS** — 6 self-tests; guard passes on 14 workflows | 0 |
| Deployment identity (new) | `pnpm test:deployment-identity` | **PASS** — argument, HTTPS and fail-closed cases | 0 |
| **Real E2E** | `pnpm --filter ./rentrix-app run e2e:release` | **NOT EXECUTED** | — |
| **Production smoke** | `pnpm --filter ./rentrix-app run e2e:production-smoke` | **NOT EXECUTED** | — |

25 of 25 executable gates passed. The two real-backend rows are listed but
deliberately **not** counted as passes — they did not run.

**Executed and not executed are separated deliberately.** The real-backend E2E
and production smoke rows are absent from the table above because they did not
run; they are reported under Blocker 4 instead.

---

## Remaining Blockers

All four remain open. Each has an external dependency that cannot be satisfied
from this environment.

1. **CI execution** — external: GitHub account billing/spending limit, *plus*
   missing `actions:write` on the integration used here. Repository-controllable
   work is complete.
2. **Production DB access** — external: `api.supabase.com` is not reachable from
   this sandbox (measured `ECONNRESET`), and the integration cannot reach
   Supabase by any other channel.
3. **Migration convergence** — blocked by (2). Nothing applied, nothing
   falsified, ledger intact.
4. **Real-backend E2E** — external: no browser binary reachable, no QA
   environment, no release-test credentials.

**ALL 4 RELEASE BLOCKERS RESOLVED** is **not** claimed. The repository is
internally consistent and every executable gate passes locally, but tested
commit ≠ built artifact ≠ deployed commit ≠ production-verified, and the
production database has not been measured since 2026-09-11.

---

## Cleanup

- `AUDIT_REPORT_CODE_ONLY.md` — removed (superseded; its valid findings preserved
  in `RELEASE_CONVERGENCE_REPORT_20260917.md`).
- Supabase token staged for Blocker 2 — **deleted** from the sandbox; never
  committed, never written to the repository, never logged.
- Temporary YAML-parser install — outside the repository (`/tmp`), not tracked.
- No browser binaries, dumps, logs, scratch SQL or temporary workflow files were
  created or committed.
- `git status --short` on the final revision: **clean**.
