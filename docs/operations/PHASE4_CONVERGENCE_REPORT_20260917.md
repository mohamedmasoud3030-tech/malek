# Phase 4 — Final Convergence Report

**Date:** 2026-09-17
**Branch:** `arena/01a0ad8e-malek`
**Fix commit:** `1a22e7af77b619bff6d4887fd90aa8e4e5b7a51b`
**Branch tip:** `e356c810` — an `ours` merge that records the phase-2/3 branch
history; `git diff 1a22e7af e356c810` is **empty**, so every result below applies
to the exact tree at the tip.
**Baseline:** `main` `8c2605e0c140a25b1c04ff1c10d70594a05da1ff`, deployed at
`https://malek-plus.vercel.app`.

Every number here was produced by a command run in this session. Exit codes were
captured directly, never through a pipe. No CI run and no production QA are
claimed, because neither executed — see *Remaining blockers*.

---

## 1. Owner financial report — the contradiction is fixed at the source

### What was reported

For property A-201 the report showed **Due 360.000 / Collected 360.000 /
Unpaid 360.000** beside a status of **غير مسدد** (not settled).

### Root cause — three independent authorities, not a label problem

| # | Location | Defect |
|---|---|---|
| 1 | `rentrix-app/src/features/reports/documents/professional-owner-report.ts` (`:240`, `:244` before the fix) | Printed the **unclamped** expression `bill.amount - bill.paid_amount` for the remainder, while the status came from the stored flag. Two unrelated inputs, printed side by side. |
| 2 | `rentrix-app/src/features/utilities/utilities-service.ts` — `mapStatusToBillStatus` / `deriveBillStatus` | Derived status from the stored `utility_bills.status` column, returning `'paid'` whenever that flag said PAID, regardless of the amounts actually recorded. |
| 3 | `rpt_owner_financial_position` (baseline `20260901000000_canonical_baseline.sql`) | Published `owner_funds.held = coalesce(sum(<owner_funds_events>), 0)`, so an **empty** register surfaced as a confident `0` balance. |

A row could therefore carry `paid_amount = amount` with a stored flag of
`UNPAID`, or `paid_amount = 0` with a stored flag of `PAID`, and the report
would print whichever each column happened to read.

### The fix

The invariant is now **`unpaid = max(due − collected, 0)`**, and the printed
status is derived from that same remainder, so the two cannot diverge.

* `rentrix-app/src/features/utilities/utility-obligations.ts` owns
  `billSettlementStatus({ amount, paid_amount })` — `'paid'` **iff** the clamped
  remainder is `0`, otherwise `'partially_paid'` / `'unpaid'`.
  `deriveUtilityObligation` keys off it instead of the stored flag.
* `utilities-service.ts` drops `deriveBillStatus` / `mapStatusToBillStatus` and
  calls the shared derivation on **both** the read path and the create path.
* `professional-owner-report.ts` clamps every row and every total through
  `utilityBillRemaining()` and prints the derived status.
* `supabase/migrations/20260917000003_utility_bill_settlement_status_authority.sql`
  converges `utility_bills.status` to `paid_amount >= amount` with a
  post-condition check and a `BEFORE INSERT OR UPDATE` trigger. `OVERDUE` is a
  real state that the amounts cannot reconstruct, so it is **deliberately
  preserved**; only the settled/unsettled contradiction is repaired. No row is
  inserted or deleted, and the migration is idempotent.
* `supabase/migrations/20260917000002_owner_funds_held_authority.sql` redefines
  `rpt_owner_financial_position` in full, behind a pre-image guard, so
  `owner_funds.held` is **`NULL` unless the register holds evidence**. It adds
  `held_proven_total` and `held_evidence_missing_count` and mirrors the existing
  `paid_cash` evidence contract. **No amounts are backfilled and no balances are
  invented.**
* The app contract (`OwnerFundsHeld`, `parseOwnerFunds` in
  `owner-financial-authority-service.ts`) rejects inconsistent responses; the
  three render sites show `غير متاح — لا توجد سلطة بيانات` instead of a figure.

### Evidence

**Real-PostgreSQL regression tests** (PGlite replay of the full migration chain):

```
node --test scripts/db0/utility-settlement-status.test.mjs
# tests 5  pass 5  fail 0
```

* an unsupported `PAID` flag on `amount 360 / paid_amount 0` is refused and
  stored `UNPAID` — the exact reported row;
* a settled bill is stored `PAID`, including the overpaid case;
* an unsettled `OVERDUE` bill keeps its overdue state;
* editing `paid_amount` alone leaves the status agreeing with the balance;
* a whole-table sweep asserts no stored row violates
  `status = 'PAID' ⟺ paid_amount >= amount`.

```
node --test scripts/db0/owner-funds-authority.test.mjs
# tests 3  pass 3  fail 0
```

These drive the real RPC through its **full authorization path** (a real
`auth.uid()` plus an active company membership), not through a stub:

* **empty register** → `{"held": null, "held_proven_total": 0,
  "held_evidence_missing_count": 1, "events": []}`;
* **one `OWNER_COLLECTION` of 1928.250 dated 2026-03-01** →
  `{"held": 1928.25, …, "held_evidence_missing_count": 0}` with the event still
  visible.

This is the direct answer to the **1,928.250 OMR "owner funds held"** question:
the figure is *derivable* when register events back it, and is now published as
**unavailable/data-authority-gap** when they do not. It is no longer asserted
unconditionally.

**Mutation check** — the new report tests are real regression tests, not
decorative ones. Reverting `professional-owner-report.ts` `:240`/`:244` to the
unclamped expression and the raw status flag:

```
Test Files  1 failed (1)
     Tests  2 failed | 18 passed (20)
  × never prints a remaining balance that contradicts the printed status
  × never prints a negative remaining for an overpaid bill
```

Restoring the fix returns 20/20.

**`rpt_owner_statement` was investigated and ruled out.** It returns only
`owner_name / commission_type / commission_value / transactions / total_gross /
total_deductions / total_net / period_from / period_to`
(`20260901000000_canonical_baseline.sql:19033-19114`) — it has no
due/collected/unpaid/status fields, so it was never the origin of the
contradiction.

---

## 2. Verification results on the fix commit

All run on `1a22e7af` (tree identical to the tip). Every line is a directly
captured exit code.

| Gate | Result |
|---|---|
| `pnpm typecheck` | **exit 0** |
| `pnpm db0:gate` | **exit 0 — 7/7** |
| `pnpm db0:isolation` | **exit 0** — 107 tables, 255 policies, 412 functions, 11 views, 0 violations |
| `pnpm test:supabase:rls` | **exit 0** — 84 passed, 0 failed, 0 skipped |
| `pnpm test:workflow-honesty` | **exit 0** |
| `pnpm test:migration-hygiene` | **exit 0** — 11 passed, 0 failed |
| `pnpm check:docs` | **exit 0** — 108 maintained Markdown files |
| `pnpm test:deployment-identity` | **exit 0** |
| `pnpm build` | **exit 0** — built in 16.49s |
| `pnpm test` | **exit 0** — 556 files, 4084 tests passed (668.73s) |

`db0:gate` detail: regressions 45.7s · migration-chain 5.1s · idempotency 0.1s ·
schema-type-drift 5.1s · contract 5.6s · isolation 5.1s · role-model 0.1s.

The test count rose from 4078 to 4084 across this phase: the three
`owner-funds-authority` RPC tests and the three report regressions.

---

## 3. CI honesty — the guard is real and its detection is proven

`origin/main` shipped three jobs in `release-blocker-gate.yml` and one in
`browser-readiness.yml` that echoed a sentence and exited zero. A check named
"Release Blocker Gate" reported green on every pull request while validating
nothing.

**The fix (in the fix commit):**

* `release-blocker-gate.yml` — the `pull_request` trigger and the echo-only jobs
  are gone. It is now `workflow_dispatch` (with required `release_sha` and
  `base_url` inputs) plus `push` to `release/**`, so a green "Release Blocker
  Gate" context can only appear when the real gates ran: `release-validation`,
  `migration-ledger-parity`, `deployment-identity`, `production-smoke`,
  `real-stack-journey`, and `release-verdict`, which fails unless **every** one
  succeeded. `migration-ledger-parity` fails closed when the read-only
  production credential is absent rather than passing by skipping.
* `scripts/check-workflow-honesty.mjs` (194 lines) enforces this from `ci.yml`
  and fails on any workflow that reintroduces an inert job.

**Detection proven, not asserted.** Pointing the guard at pristine `origin/main`
workflows:

```
git archive origin/main .github/workflows | tar -x -C /tmp/mainwf
node scripts/check-workflow-honesty.mjs --root /tmp/mainwf
# exit 1
```

> `.github/workflows/browser-readiness.yml`: job `browser-smoke` executes no real
> command …
> `.github/workflows/release-blocker-gate.yml`: job `release-blocker-code`
> executes no real command …
> 2 violation(s). A green check must mean the named work ran.

Against the fix commit the same guard exits 0. Its self-test suite passes
6/6, and grep confirms no echo-only `run:` step remains in any workflow.

**Release e2e honesty:** `rentrix-app/e2e/release/env.ts` **throws** on a missing
value instead of skipping, rejects placeholder Supabase hosts and non-HTTPS
origins, and refuses to run the mutating journey outside
`E2E_ENVIRONMENT_KIND=qa`. `playwright.config.ts` ignores `release/**`, so the
hermetic suite can never be mistaken for release coverage.

---

## 4. Repository hygiene

* **`build-proof.json` is no longer tracked.** Its committed value was the
  literal placeholder `{"sha":"local"}` — a value
  `verify-deployment-identity.mjs:91` explicitly rejects
  (`the deployed proof reports "local"`). It is regenerated on every build, and
  only `write-build-proof.mjs` reads the local path; every other consumer reads
  the deployed URL. It is now gitignored, following the existing
  `.golden-entry.cjs` precedent. The writer additionally records `builtAt`,
  `schemaDigest` and `migrationCount`.
* **No duplicate migration prefixes** — `ls supabase/migrations/*.sql | cut -d_ -f1
  | sort | uniq -d` is empty, 111 `.sql` files.
* **The two live-timestamp migrations are preserved at their actual live
  timestamps**: `20260913073735_align_receipt_void_request_acl_with_company_role.sql`
  and `20260917055325_contract_release_blocker_remediation.sql`.
* **No junk**: no `.bak`, `.orig`, `.tmp`, `.rej`, debug or scratch files
  anywhere; the only untracked paths are legitimate source, test, migration and
  documentation files.
* **No credentials** in any new file; the release e2e harness holds none and
  redacts them from error messages.
* Two previously-cited figures were corrected inside the honesty notes:
  the crosswalk's migration count (107 → 111, "measured 2026-09-17") and
  `RELEASE_EVIDENCE_LEDGER.md`'s current-main revision (`e7943a5e` →
  `8c2605e0`).

---

## 5. Supabase migration parity

**Status: not verified. Blocked, and not claimed as resolved.**

The sandbox has **no** Supabase credential (`env | grep -i supabase` is empty),
**no** `supabase` or `psql` binary, and no
`supabase/.temp/project-ref` (`config.toml` carries `project_id = "rentrix-ci"`,
a CI placeholder). Migrations therefore cannot be compared against live
`schema_migrations`, and **none were applied or replayed against production**.

What *was* verified, repository-side:

* the full migration chain replays cleanly from an empty database
  (`migration-chain` gate, exit 0) and is idempotent on a second replay
  (`idempotency` gate, exit 0);
* schema/type drift and frontend↔database contract drift are clean
  (`schema-type-drift`, `contract` gates, both exit 0);
* no duplicate or competing version prefixes exist.

**External action required.** Configure the `SUPABASE_READONLY_DB_URL`
repository secret so `release-blocker-gate.yml`'s `migration-ledger-parity` job
can execute `scripts/verify-migration-ledger-parity.sh` and
`scripts/verify-supabase-live-readiness.sh`. Until then parity is genuinely
unproven — the job is designed to fail rather than report a pass.

---

## 6. GitHub governance

Read access worked; every write is refused with HTTP 403.

| Item | Measured state |
|---|---|
| `Production` environment | `protection_rules: []`, `can_admins_bypass: false` — **no reviewer or branch gate is enforced** |
| `SONAR_TOKEN` environment | **orphaned** — created 2026-07-15, referenced by **no** workflow (`grep -rn 'environment:' .github/workflows/` returns only `qa` and `production`) |
| `qa` environment | referenced by `hosted-qa-verification.yml:40,65` but **does not exist** among the 7 environments |
| Workflows using `production` | `supabase-ai-assistant-production-sync.yml:28`, `supabase-production-migrations.yml:96,145` (environment names are case-insensitive) |

Attempted remediations, exit codes captured directly:

```
gh api -X DELETE repos/…/environments/SONAR_TOKEN        → 403, exit 1
gh api -X PUT    repos/…/environments/Production …       → 403, exit 1
gh api          repos/…/environments/SONAR_TOKEN/secrets → 403, exit 1
```

**External action required** from a repository administrator (the agent's token
is `arena-ai-coding-agent[bot]`, which lacks the required scope): delete the
orphaned `SONAR_TOKEN` environment, add required reviewers / a branch policy to
`Production`, and either create the `qa` environment or correct the workflow
reference.

---

## 7. Remaining blockers

**Blocker 1 — GitHub Actions does not execute (account billing). Re-measured at
the current `main` SHA.**

```
gh run view 35187785615        # CI / Typecheck, Lint & Build #1715 @ 8c2605e0
```

* job `build` (id `105093482003`): started 05:57:32, completed 05:57:35 —
  **3 seconds, `steps: 0`**;
* job `heavy-validation`: skipped, `steps: 0`;
* annotation, verbatim: *"The job was not started because recent account payments
  have failed or your spending limit needs to be increased. Please check the
  'Billing & plans' section in your settings."*

The same pattern affects `sonarcloud`, `database-governance`,
`canonical-baseline-real-supabase`, `browser-smoke-chromium-{desktop,mobile,tablet}`,
`Verify locked business rules` and `Verify decisions, 10 stages and checklist parity`.

**No CI success is claimed or manufactured.** The required external action is
for the account owner to resolve the GitHub billing/spending limit; the honest
workflows will then execute for real.

**Blocker 2 — Supabase parity.** See §5; needs `SUPABASE_READONLY_DB_URL`.

**Blocker 3 — Governance writes.** See §6; needs a repository administrator.

**Blocker 4 — Production deployment of this fix.** This branch has **not** been
deployed. `https://malek-plus.vercel.app` still serves
`{"sha":"8c2605e0…"}`. Landing the fix requires merging this branch's pull
request into `main`; the Vercel production build follows from that merge. This
agent's session is restricted to the `arena/01a0ad8e-malek` branch and cannot
push to `main` directly.

---

## 8. What this report does *not* claim

* No GitHub Actions run executed on this revision.
* No production QA or release e2e run executed — they require a real Supabase QA
  project and a deployed origin, neither of which is reachable from here.
* No migration was applied to production.
* The owner-report fix is verified by unit, integration and real-PostgreSQL
  tests against the exact committed tree, and by mutation testing; it is **not**
  yet verified on the deployed application, because the fix is not yet deployed.
