# MALEK / Rentrix — Reconstruction Handoff

**Document type:** operational engineering handoff. Self-contained. A new agent must be able to continue from this file alone, without any prior conversation.

**Last updated:** 2026-09-10
**Branch:** `reconstruction/checkpoint-20260909`
**Last work commit (all code/schema/evidence):** `e6e2e44477db8e182dec6b05380941530fc61b15`
**Branch tip:** the documentation commit that adds this file — it is the child of the SHA above and contains **no** code, schema or data change.

A document cannot contain its own commit SHA, so confirm the tip yourself (§B):
```bash
git ls-remote https://github.com/mohamedmasoud3030-tech/malek.git refs/heads/reconstruction/checkpoint-20260909
```

---

## A. PROJECT OBJECTIVE

MALEK (application package name `rentrix`) is an Arabic/RTL, multi-company property-management and property-accounting system for the Omani market. Currency is **OMR with 3 decimals (baisa)**.

The reconstruction mission:

1. **Reconstruct the existing application into a clean implementation** — one canonical implementation per capability.
2. **Preserve valid product behaviour.** Reconstruction is not redesign. If a behaviour is correct, it survives.
3. **Remove unnecessary complexity and duplication.** No parallel `v2` / `new` / `final` / `backup` trees.
4. **Preserve financial correctness above all.** OMR 3-decimal precision, maker/checker, idempotency, correct retries.
5. **Preserve permissions, company/property/owner/tenant isolation, historical data, and workflows.**
6. **Never invent accounting rules.** If the lawful treatment of a financial event is not established by an approved source, the system must **fail closed** and surface the gap — never guess, never zero it, never present a partial figure as a complete one.

### Standing constraints (these are settled decisions — do not relitigate)

- Work only on `reconstruction/checkpoint-20260909`. **No new branch, no PR, no merge, no force-push.**
- **No `reset`, `revert`, `stash`, discarding, or replacing existing work.** Preserve newer/local changes found on arrival.
- Inspect the whole path before changing anything: **UI → state → business logic → API/database → persistence → UI.**
- **Fix the authoritative source. Never edit a report to hide a difference.**
- **Do not derive historical cash from `net_payable` minus current `offset_applied`.**
- Do not grant offset/allocation/historical-adoption rights from an accounting classification or a field name alone.
- **No rewriting of posted history.** Corrections are append-only or compensating entries; the original is retained.
- **No deletion before checking references, functions, data, and tests.**
- After each significant stage: execute → focused tests → actually-saved SQL → browser → diff review → commit → push → **verify the literal remote SHA**.
- Never claim local SQL with mocked auth proves JWT/PostgREST or hosted concurrency.
- **No stage credit and no completion claim without evidence.** State precisely what is and is not proven.

---

## B. CURRENT REPOSITORY STATE

| Item | Value |
|---|---|
| Repository | `https://github.com/mohamedmasoud3030-tech/malek` |
| Branch (only permitted) | `reconstruction/checkpoint-20260909` |
| Last work commit (code/schema/evidence) | `e6e2e44477db8e182dec6b05380941530fc61b15` |
| Branch tip | the docs-only commit adding this file (child of the above) |
| Working tree at handoff | **clean** (0 modified, 0 staged, 0 untracked) |
| Tracked files | 1,743 |
| Commits ahead of `origin/main` | 37 |
| Migrations in repo | **100** |
| Production migration ledger | **109 rows** (includes pre-baseline squashed history) |
| Unit/integration test files | 553 |
| Playwright e2e specs | 29 |

Confirm the true branch tip on arrival:

```bash
git ls-remote https://github.com/mohamedmasoud3030-tech/malek.git \
  refs/heads/reconstruction/checkpoint-20260909
```

### Repository structure

```
/                        root package.json OWNS the scripts (typecheck, build, gates…)
  rentrix-app/           the React/TypeScript/Vite PWA  (vitest runs from HERE)
    src/features/        feature modules (financials, owners, contracts, …)
    src/components/ui/   design system incl. entity-table.tsx (responsive table)
    e2e/                 29 Playwright specs
    e2e/support/         fake-supabase-backend.ts — hermetic fixture backend
    scripts/             e2e-static-preview.mjs, run-sharded-regression.mjs
  supabase/migrations/   100 forward-only SQL migrations
  scripts/db0/           replay engine + 7 integrity gates
  docs/source-of-truth/  canonical product/accounting rules — READ, DO NOT INVENT
  docs/execution/        RECONSTRUCTION_INVENTORY.md = the live ledger
  governance/  skills/
```

### Environment notes (this sandbox loses state between sessions)

These are **not** repository defects. Expect them and fix them silently:

1. **`.git/config` is not snapshot-persistent.** `origin` and `user.name`/`user.email` disappear. Re-add:
   ```bash
   git remote add origin https://github.com/mohamedmasoud3030-tech/malek.git
   git config user.name "Reconstruction Agent"; git config user.email "reconstruction@arena.local"
   ```
2. **`node_modules/` is not persistent.** `cd /home/user/malek && pnpm install --frozen-lockfile` (~12 s).
3. **`/home/user/bin/pnpm` loses its exec bit.** `chmod +x /home/user/bin/pnpm`; export `PATH="/home/user/bin:$PATH"` in **every** shell.
4. **`skills/**/*.py` exec bits are lost**, appearing as 8 phantom `mode change 100755 => 100644` entries. **Do not commit these.** Restore instead:
   ```bash
   git diff --summary skills/ | awk '/100755 => 100644/ {print $NF}' | xargs -r chmod +x
   ```
   (`skills/skill-creator/scripts/__init__.py` and `utils.py` are legitimately **644**.)
5. **Playwright browsers are not persistent.** `pnpm exec playwright install chromium --with-deps`.
6. **Sandbox RAM is ~1.9 GB.** Use `node rentrix-app/scripts/run-sharded-regression.mjs` for the full suite. A `SIGKILL`/`signal=null` worker death is **INFRA, not a test verdict** — re-run that spec in isolation before drawing any conclusion.

### Architecture areas already reconstructed

Authentication/session, navigation/permissions, owner & contract dossiers, VAT/credit/invoice calculation, report snapshots and caches, CSV/Office import, configuration/security hardening, PWA/offline, deposits & retry safety, tenant statements, payment history, receipt allocation, owner receivables, historical reconciliation, owner expense handling, lawful offsets, agreement pagination, migration chain, and RLS/company isolation.

---

## C. WHAT HAS BEEN COMPLETED

Grouped by area. Everything here is committed on the branch.

### Authentication, session, permissions
- Consolidated auth/session handling into a single implementation; removed duplicate session bootstrap paths.
- Six-role authorization model is **physically representable** and gate-enforced (`role-model` gate).
- Effective-permission resolution consolidated; `request_permission` / `decide_permission_request` / `set_employee_permission` governed via RPC with maker/checker.
- Navigation and route guards consolidated to one permission source.
- `custom_access_token_hook` (JWT claim minting) is the single claim authority — **verified byte-equivalent between repo and production**.

### Financial calculation
- VAT, credit notes, and invoice calculation consolidated into one canonical path (duplicate implementations deleted after reference checks).
- Commission/deal identity and OMR precision normalised.
- Collections, payments and period-close fixes.
- Fixed monthly accruals: posting, late posting, zero-amount, and **compensating reversal** (original accrual always retained).
- Tenant statements and payment-history correction.
- Receipt-allocation handling; `receipt_allocations` and `invoice_payment_tax_allocations` as governed sources.
- Deposits: over-claim prevention and retry safety (`financial_operation_idempotency`).

### Owner financial chain
- `calculate_owner_net_payout` established as the single derivation authority (ADR 0001).
- `rpt_owner_statement` authority rebuilt (migration `20260909000017`): movements key on `s.paid_at` (not legacy `s.date`), value on `app_private.owner_settlement_paid_cash` (not legacy frozen `s.amount`), and filter on `status='PAID' AND paid_at IS NOT NULL` so a **CANCELLED settlement is no longer shown as a deduction**.
- `app_private.owner_settlement_paid_cash` — proven-cash reader. Absence of a journal is **not** proof of zero cash: a lawful fully-offset closure is proven from the persisted payment acknowledgement.
- **Owner position separates settled entitlement from proven cash** (migration `20260909000016` + `owner-financial-authority-service.ts`): `paid_cash` is `NULL` when any historical evidence is missing, `paid_cash_proven_total` carries the partial figure explicitly labelled as *not* a full total, and `paid_cash_evidence_missing_count` surfaces the gap. The parser **rejects** any response where these three contradict each other, and refuses to coerce `null`/empty/boolean/array/object into `0`.
- Professional owner report separates cash from entitlement; every lifecycle figure is labelled "كل الفترات" (all periods) and the document states in-line that an all-period disbursement is **never** subtracted from a single period's entitlement.
- Co-ownership allocation authority (`20260909000018`/`19`); **fixed a double-count of co-owned expenses** in the stored owner balance.
- Owner-funds events are **append-only**, enforced by `trg_owner_funds_event_immutable` (probed live: both UPDATE and DELETE raise `OWNER_FUNDS_EVENT_IMMUTABLE`). Compensating directions are first-class: `INVOICE_CREDIT_REVERSAL`, `RECEIPT_VOID_REVERSAL`, `OWNER_OFFSET_REVERSAL`.
- Historical cutoff: `owner_funds_event_cutovers` carries an APPROVED, S08-review-backed `opening_balance` with maker/checker in a CHECK constraint. Requesting a position **before** the cutover raises `OWNER_FUNDS_PRE_CUTOVER_REPORT_REVIEW_REQUIRED` instead of inventing or zeroing a missing balance.
- S09 corrections post a **new** journal batch and retain `original_journal_batch_id`; an expense already adopted into the receivable subledger is refused (`OWNER_EXPENSE_USE_RECEIVABLE_ADJUSTMENT`) so it is corrected through one path, not two.
- Lawful offset integration (`offset_owner_receivable_atomic`) with offset finality (`20260909000013`).

### Reconciliation
- Bank reconciliation hardened fail-closed: entity/company match, economic identity, expanded entity types, duplicate-match guards, and **10 cross-company guards**.
- Owner payout can only be reconciled against **proven cash** (`OWNER_PAYOUT_CASH_EVIDENCE_REQUIRED`), never against the entitlement.

### Data platform, security, migrations
- Migration chain repaired; **100 migrations replay 100/100 from a clean database**.
- **Production ↔ repository parity proven** (see §D).
- RLS/company isolation across 107 tenant tables; **0 RLS-disabled**, **0 anon grants**, **0 SECURITY DEFINER functions missing `search_path`**, **0 non-`security_invoker` views**.
- **SEC-003 / SEC-004** cross-company read leaks closed in repo *and* production.
- OMR precision normalised to `numeric(18,3)` across all 74 money columns.
- `secure_function_default_privileges` + Guardian `function-default-acl` layer.

### UI / UX / platform
- PWA/offline: production shell installs its worker, precaches `/offline.html`, and serves an Arabic `dir="rtl"` offline page with zero forms.
- **PWA cache privacy:** no `/rest/v1/`, `/auth/v1/` or `/storage/v1/` response is present in any cache store; `navigateFallback: null` with an explicit `NetworkOnly` navigation rule.
- RTL, responsiveness and ≥44 px touch targets verified across 5 viewports in light and dark.
- **Tablet status visibility fixed** (commit `b11b5da3`) — see §F.
- Accessibility: `primitives.axe.test.tsx` 15/15. **This file is on the sharded runner's `EXCLUDED` list — it must be run explicitly.**
- Dead code/dependencies: 8/8 runtime dependencies referenced; 0 unreferenced sources.

### Tooling
- `scripts/db0/` replay engine + 7 integrity gates.
- `run-sharded-regression.mjs` — reports signal-kills as **INFRA**, not as test failures (necessary in a 1.9 GB sandbox).
- `e2e-static-preview.mjs` — serves the production build so browser specs exercise real bundles.

---

## D. PRODUCTION VERIFICATION

Live Supabase project `Malek-Plus` (`nnggcnpcuomwfuupupwg`). The user confirmed production currently holds **test data** and explicitly authorised applying the migration chain.

> **Access note:** the Supabase management token and GitHub PATs used were held **in-process only** and were never written to any file. They should be treated as **revoked/expired**; a new agent must request fresh credentials and must not expect any to be present in the repo.

### ✅ PROVEN IN PRODUCTION (hosted, not inferred)

| Claim | Evidence |
|---|---|
| **Anon boundary** | Live REST returns `42501 permission denied` for `companies`/`users`/`audit_log`/`owner_balances`; `anon` holds **0** grants; root discovery 401 with 0 exposed paths. Closes the "local SQL with mocked auth can't prove PostgREST" gap. |
| **JWT-based isolation** | Impersonated the real `authenticated` role with real JWT claims. Admin of company `5138ff36` went from **6 users / 41 audit rows** to **2 users / 0 audit rows**; admin of `ae96d298` sees its own 6 members and its own 7 attributed rows. |
| **SEC-003 + SEC-004 CLOSED** | Applied `20260910000000`. **Zero data loss**: 41 audit rows before and after; 7 recovered attribution from embedded evidence, **34 correctly withheld as unproven (fail-closed)**. |
| **Full migration chain applied** | Ledger **109 rows**. Matching repo files by version **and** name: **0 truly unapplied**. |
| **Zero data change from the chain** | Row counts identical to `pre-financial-baseline.json` and re-confirmed at handoff: journal_batches 26, journal_lines 70, owner_balances 5, expenses 4, contracts 16, invoices 14, audit_log 41, users 6. |
| **Repo ↔ production function parity** | **431 repo functions vs 432 production; 0 semantic differences** after normalising comments/whitespace/semicolons/`public.` prefixes. Includes `custom_access_token_hook`. |
| **Money precision** | **74/74** money columns `numeric(18,3)` in **both**. The 7 scale-2 columns are identical in both and none is ledger money (2 percentage rates, 1 duration, 1 valuation, 3 meter/consumption). |
| **Security posture** | 116 public tables / 107 tenant tables, **0** RLS-disabled, **254–260** policies, **0** definers missing `search_path`, **0** anon grants, **0** non-`security_invoker` views. |
| **`rpt_owner_statement` deployed body** | Identical both sides at 4,519 chars: legacy `s.date` **0**, legacy `s.amount` **0**, `owner_settlement_paid_cash` **3**, `s.paid_at` **3**, `_owner_statement_expenses` **1**. |
| **Production-safe no-op migration** | `20260910000003` applied HTTP 201 as a **verified no-op** — function length `16886` unchanged, state `cash_reader 1 / guard 1 / legacy 0 / cross_guards 10`. |

One function exists **only** in production: `public.wp05_rpt_cash_flow_gl(date,date)`. This is **not drift** — `20260901000064` relocated the body to `app_private.financial_cash_flow_gl_core` and left this thin wrapper, which *adds* `require_financial_reports_view()`, is `SECURITY DEFINER` with a pinned `search_path`, and is called by **no** application code.

### ⚠️ PROVEN ONLY LOCALLY / IN REPLAY

- All **3,943** unit/integration tests — PGlite (real PostgreSQL in WASM) with **mocked auth**. This proves SQL logic; it does **not** prove PostgREST behaviour, JWT handling, or hosted concurrency.
- All browser specs — run against a **hermetic fixture backend** (`fake-supabase-backend.ts`), never against production.
- Migration replay 100/100 — clean local database, not production.
- Guardian and the 7 gates — static/replay analysis.

---

## E. VALIDATION EVIDENCE (latest actually-measured figures)

All measured on **2026-09-10** at or near `e6e2e444`. Do not reuse these numbers after changing code — re-measure.

| Check | Command | Result |
|---|---|---|
| Full regression | `node rentrix-app/scripts/run-sharded-regression.mjs` | **552 files / 3,943 tests / 0 failures**, 0 INFRA kills |
| Financials + owners focus | `pnpm vitest run src/features/financials src/features/owners` | **135 files / 933 tests PASS** |
| Migration replay | `node scripts/db0/replay-migrations.mjs` | **100/100**, 0 failures |
| Integrity gates | `pnpm db0:gate` | **7/7 PASS** |
| Guardian | `pnpm db:guardian` | **PASS**, 5 layers (incl. privileged-key scan, function-default-ACL) |
| TypeScript | `pnpm typecheck` | clean |
| Migration hygiene | `pnpm check:migration-hygiene` | OK |
| Business rules | `pnpm check:business-rules` | `v2.0.0 382a0b8c00bb605be0e6e5e2310f7f8ee3c59d584b3a7468a6b49ecaa5e74a79` |
| Accessibility | `pnpm vitest run src/components/ui/primitives.axe.test.tsx` | **15/15** (excluded from sharded runner — run explicitly) |
| Build + PWA | `pnpm build` | OK, 28 precache entries / 428.87 KiB, **0** private API paths in `sw.js` |
| PWA runtime contract | `E2E_PRODUCTION=true playwright test e2e/pwa-production-contract.spec.ts` | **3/3** desktop/tablet/mobile |
| Owner position browser | `playwright test e2e/owner-position-cash.spec.ts` | **3/3**, retries 0 |
| Financial journey browser | `playwright test e2e/financial-persisted-journey.spec.ts` | **6/6** after the tablet fix |
| UI/RTL/responsive | owners + maintenance-polish + single-office + documents-vault | **95 passed / 0 failed** (40 skipped: desktop-only journeys, width-conditional assertions, and credential-gated auth specs) |

### How to reproduce the browser runs

```bash
export PATH="/home/user/bin:$PATH"
cd /home/user/malek && pnpm install --frozen-lockfile
cd rentrix-app && pnpm exec playwright install chromium --with-deps

# Fixture-driven specs need the VITE_E2E bundle:
VITE_E2E=true pnpm build
node scripts/e2e-static-preview.mjs &          # serves dist/public on :5173
E2E_BASE_URL=http://127.0.0.1:5173 pnpm exec playwright test <spec> --retries=0 --workers=1
```

> **Two-build trap (documented, do not re-enter):** `pnpm build` + preview proves the **production shell** (PWA/SW/offline). `VITE_E2E=true` build + preview proves the **fixture-driven UI specs**. Neither build can prove the other's specs. *A login screen with disabled inputs is the signature of running a fixture spec against a production bundle — an INFRASTRUCTURE signature, never a product verdict.*

---

## F. IMPORTANT DEFECTS FOUND AND FIXED

### F1. Authorization NULL fall-through
- **Root cause:** permission evaluation treated a `NULL` result as permissive.
- **Correction:** fail-closed evaluation; `role_has_app_permission` returns an explicit boolean.
- **Validation:** role-model gate + permission suites.
- **Production affected:** no.

### F2. Deposit over-claiming
- **Root cause:** retries could claim a deposit more than once.
- **Correction:** idempotency keyed through `financial_operation_idempotency`; bounded retry.
- **Validation:** deposit controller/retry suites; persisted browser journey.
- **Production affected:** no.

### F3. Payment-history gaps / tenant statement drift
- **Root cause:** statement read model did not reflect posted credits and voided receipts.
- **Correction:** statement rebuilt from posted sources.
- **Validation:** tenant statement + read-model suites; `reconstruction-financial-read-model` 6/6.
- **Production affected:** no.

### F4. Historical-cutoff error (inventing a missing balance)
- **Root cause:** a pre-cutover owner position silently produced a number.
- **Correction:** fail closed with `OWNER_FUNDS_PRE_CUTOVER_REPORT_REVIEW_REQUIRED` unless an S08-backed, maker/checker-approved cutover exists.
- **Validation:** `owner-agency-invoice-accounting.test.ts` 17 PASS incl. "fails closed for a historical 2000 position".
- **Production affected:** no.

### F5. Owner-receivable / settlement reconciliation error
- **Root cause:** settlement movements used legacy `s.date` and frozen `s.amount`; CANCELLED settlements were presented as deductions.
- **Correction:** migration `20260909000017` — key on `paid_at`, value on proven cash, filter `status='PAID' AND paid_at IS NOT NULL`.
- **Validation:** verified against the **deployed** body in both repo and production (identical, 4,519 chars).
- **Production affected:** yes — **now fixed in production**.

### F6. Co-owned expense double-count
- **Root cause:** stored owner balance counted a co-owned expense once per owner link.
- **Correction:** unallocated co-owned expenses stay unallocated instead of being double counted (commits `3168c2e1`, `d80261d8`).
- **Validation:** dedicated regression proving the money path is fail-closed.
- **Production affected:** no (repo-side balance derivation).

### F7. Migration drift / production ↔ replay function drift
- **Root cause:** **rewriting already-merged migrations.** 24 migrations patch functions by string-matching `pg_get_functiondef()` output; commit `8258c528` edited `20260901000038` *after* production had applied it, so anchors stopped matching.
- **Correction:** forward-carry migrations only. `20260910000001` (whitespace normaliser, refuses to act unless whitespace-identical) and `20260910000002` (carries lines 1–776 of `20260901000033` **verbatim by line range**, omitting only the obsolete wp05 DO block).
- **Validation:** repo ↔ production parity now **0 semantic differences across 431 functions**.
- **Production affected:** yes — **now reconciled**.

### F8. Cross-company RLS leaks — SEC-003 (`audit_log`) and SEC-004 (`users`)
- **Root cause:** both tables were readable across company boundaries by an authenticated admin.
- **Correction:** `20260910000000` — company-scoped policies; audit rows whose company cannot be proven are **withheld**, not guessed.
- **Validation:** impersonated real JWT claims. 6 users/41 audit rows → 2 users/0 audit rows for a foreign admin; 41 rows preserved, 7 attributed, **34 withheld fail-closed**.
- **Production affected:** **YES — these were live. Both are now closed in production.** Whether they were ever exploited is **unknown** (no historical access logs).

### F9. Regression introduced by this reconstruction, then fixed
- **Root cause:** `20260910000002` (the forward-carry) runs `create or replace function public.process_bank_reconciliation_match_atomic`. On a **clean replay** filename order places it *after* `20260909000015`, silently reverting it — the match authority fell back to reading `s.net_payable` (**entitlement**) instead of `app_private.owner_settlement_paid_cash` (**proven cash**) and lost `OWNER_PAYOUT_CASH_EVIDENCE_REQUIRED`. A bank line could have been reconciled against a payout never actually paid.
- **Correction:** `20260910000003` re-applies migration 15's DO block **copied verbatim by line range** (`diff` vs lines 69–89 of `...015`: IDENTICAL). Neither merged migration was edited. **Strictly idempotent**: skips when the replacement is already present exactly once, aborts on any unrecognised state, never double-applies.
- **Validation:** replaying the full chain **plus the migration a second time** yields `cash_reader 1 / guard 1 / cross_guards 10`, 101 applied, 0 failures. `owner-payout-cash-authority.test.ts` 8/8 (was 3 failing).
- **Production affected:** **NO.** In production `...015` was applied *after* the forward-carry, so the live function already held both changes. **Clean-replay-only** — exactly what the replay gate exists to catch.

### F10. Reversed accruals invisible on tablet
- **Root cause:** `fixed-monthly-accrual-workspace.tsx` declared `status` as `priority: 'secondary'`. `resolveTabletColumns` (`entity-table.tsx:236-246`) keeps only the first **1–2** secondary columns; with 4 stable columns the limit is 2 and `monthly`/`net` come first, so **`status` was dropped entirely at 768 px** — a REVERSED accrual ("تم العكس") looked identical to a live one.
- **Correction:** promoted to `priority: 'primary'`, matching automation/communication/billing-readiness/lands. The shared table component was **not** weakened and the assertion was **not** relaxed.
- **Validation:** `financial-persisted-journey` 6/6 (was failing on tablet); accrual + entity-table unit suites 44 PASS.
- **Production affected:** presentation only. **Pre-existing** — `git diff 81ee3671..HEAD` shows these files were untouched by the session that found it.

### F11. Silent migration-ledger gap
- **Root cause:** `20260909000012` and `20260909000014` executed successfully, but their `schema_migrations` rows were missing — both files contain `$s$`, which collided with the dollar-quote tag used by the recording step, so the bookkeeping INSERT failed after the DDL had committed.
- **Correction:** rows re-inserted using base64 encoding so no tag collision is possible.
- **Lesson (now a rule):** **executing migration SQL is not applying a migration — confirm the ledger row.**

---

## G. REMAINING WORK

Only items with **no** supporting evidence are listed. Anything not here has evidence in §D/§E.

### G1. Authenticated app-shell E2E — **BLOCKED (missing credentials)**
Every spec that logs in is gated:
```ts
test.skip(!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD, …)
```
in `e2e/readiness-smoke.spec.ts` and `e2e/release-blocker-auth.spec.ts`. `e2e/single-office-isolated.spec.ts` additionally requires `E2E_ENVIRONMENT_KIND` ∈ {local, qa}, `E2E_SINGLE_OFFICE_ENABLED`, and `QA_MUTATION_APPROVED=1` for QA.
**No local browser test ever reaches the authenticated app shell.** Needs seeded staging credentials or hosted QA. **Do not fabricate a login bypass to make these run.**

### G2. Intermittent bootstrap stall — root cause **OPEN**
- The async-auth-callback deadlock hypothesis is **structurally excluded, by inspection not guesswork**: both `onAuthStateChange` listeners (`src/hooks/use-auth.tsx:88`, `src/features/onboarding/useOnboarding.ts:66`) contain **zero** `await`/`async` tokens — they only call `setState`. A callback that never awaits cannot hold the GoTrue Web Lock across I/O.
- A **fail-closed mitigation is deployed and is not a masking fallback**: `withCompanyResolutionTimeout` (`src/hooks/use-company.tsx:17`) rejects with `ACTIVE_COMPANY_ERROR` after a bounded wait and routes to a recovery screen. It never substitutes a fabricated company. Covered by `use-company.test.tsx` 10 PASS.
- Two clean reproduction rounds (12 passed each, `--retries=0`) did **not** reproduce the stall. **Two clean rounds do not prove it fixed.**
- **Blocked by G1** — the defect was observed on full-page navigation in an *authenticated* session, which is exactly the uncovered path.
- **Do not change auth or Web Locks by guessing.**

### G3. Hosted concurrency / Web Locks — **NOT EXERCISED**
No contended-RPC or concurrent-session testing has been performed against the hosted database.

### G4. Runtime behaviour of newly-applied migrations under real traffic — **NOT EXERCISED**
The 11 migrations applied on 2026-09-10 are structurally verified (parity, row counts, probes) but have not been exercised by live usage.

### G5. Remaining financial-chain review items
Backend authorities exist and are tested; these remain **reviews**, not known defects:
- Governed historical **adoption/allocation** of expenses, and unblocking legacy settlements **only after correct legal/accounting review**.
- Post-payment adjustment workflow, and adjustment/recovery/offset interfaces showing their effect on the **original source**.
- Remaining S08/S09 review paths: sources, cache/rebuild, permissions, read limits, retries, reconciliations.
- Cash/fees/tax/offset/collection/recovery truth in owner statements **and documents** — statement path verified; the full document surface is not exhaustively re-verified after the latest migrations.

### G6. UI surfaces for backend-complete capabilities — **RESOLVED (inspection + one canonical build)**

**Verified first, built second (2026-09-10, later session):**
- Allocation/adoption-of-expenses UI **already existed** — `features/financials/expenses/owner-expense-allocation-fields.tsx` (hosted in `expenses-section.tsx` and `maintenance-detail-resolve-overlays.tsx`, browser-covered by `e2e/owner-expense-source.spec.ts`). Nothing was built for it.
- Governed **historical adoption** (owner-funds cutover) had **no application call sites** although both RPCs are granted to `authenticated`. One canonical surface was built: `features/owners/services/owner-funds-cutover-service.ts` + `features/owners/components/OwnerFundsCutoverPanel.tsx`, hosted once in `OwnerSettlementWorkspace.tsx` (see `docs/execution/RECONSTRUCTION_INVENTORY.md`).
- Real-SQL testing of the panel found and fixed one real defect (idempotent envelope read as an unknown status) and corrected one wrong instruction (the app cannot re-baseline a drifted draft).

**Still unproven:** hosted parity re-measurement for this session, browser execution for the new panel, G3/G4 concurrency.
The prior ledger listed "governed adoption/allocation workflow UI (migration18 follow-on)" as NEXT. **This was never confirmed as missing.** The next agent must first establish whether a UI exists (`grep` the owners/financials features for the allocation/adoption RPCs) before building anything — building a parallel surface would violate "one capability = one approved implementation".

### G7. Whether SEC-003/SEC-004 were ever exploited — **UNKNOWABLE HERE**
No historical access logs are available. Do not claim they were not exploited.

---

## H. OPEN RISKS

### Code risks
- **24 migrations patch functions by string-matching `pg_get_functiondef()` output**; 12 raise anchor/precondition errors. Any future anchor migration can halt if a body drifts. *Mitigation:* parity is currently exact — keep it that way and never rewrite a merged migration.
- **Ordering hazard (proven real — F9):** a `create or replace function` in a **later** migration silently reverts an **earlier** anchor patch on clean replay while production, applied in a different order, looks fine. **Always run a clean replay plus the focused suite before trusting a function-level migration.**

### Production risks
- Newly-applied migrations are unexercised under real traffic (G4).
- No hosted concurrency proof (G3).

### Data risks
- Production holds **test data** (user-confirmed) — but the same code will run against real ledgers. Treat every financial change as production-grade.
- **Never** perform production data fixes. Only forward migrations, only with explicit authorization.

### Security risks
- SEC-003/SEC-004 exploitation history is unknowable (G7).
- Credentials used in prior sessions were in-process only and are **not** in the repo; assume revoked.

### Infrastructure / environment limitations
- Sandbox ~1.9 GB RAM → use the sharded runner; treat SIGKILL as INFRA.
- `.git/config`, `node_modules`, Playwright browsers, and skills exec bits do **not** persist (see §B).
- Supabase **preview branches are unusable** in this environment (previously attempted, dead end).
- No hosted QA environment and no seeded staging credentials.

---

## I. NEXT RECOMMENDED EXECUTION ORDER

Follow in order. Do not skip ahead.

### Step 0 — Restore and verify (before any edit)
1. Re-add `origin` + git identity; `chmod +x /home/user/bin/pnpm`; `export PATH="/home/user/bin:$PATH"`.
2. `pnpm install --frozen-lockfile`.
3. Restore skills exec bits (§B item 4). **Confirm `git status` is clean — do not commit mode changes.**
4. Confirm branch tip via `git ls-remote` and compare to `git rev-parse HEAD`.
5. Read `HANDOFF.md` (this file), then `docs/execution/RECONSTRUCTION_INVENTORY.md`, `AGENTS.md`, `DATABASE_RULES.md`, `docs/source-of-truth/00_INDEX.md`.
6. Establish a fresh baseline: `pnpm typecheck`, `pnpm db0:gate`, `node scripts/db0/replay-migrations.mjs`. **Record the numbers.**

### Step 1 — HIGHEST PRIORITY: unblock authenticated E2E (G1 → G2)
- **Evidence required:** whether `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` (or a disposable QA target) can be provided. **Ask the user — this is a genuine external blocker, not a routine decision.**
- **If provided:** run `readiness-smoke` and `release-blocker-auth` against the authenticated shell; attempt to reproduce the bootstrap stall on full-page navigation with tracing enabled.
- **Implementation target:** only after a reproduction exists. Fix the proven cause in `use-auth` / `use-company` / onboarding.
- **Validation:** repeated authenticated navigation rounds + existing `use-company` suite.
- **If NOT provided:** record the blocker explicitly and move to Step 2. **Do not guess at auth or Web Locks. Do not weaken `withCompanyResolutionTimeout`.**

### Step 2 — Confirm G6 before building any UI
- `grep` the owners/financials features for the adoption/allocation RPCs from `20260909000012` / `...018`.
- **If a surface exists:** mark G6 resolved with the file path as evidence.
- **If genuinely absent:** build one canonical surface. It must display *effect on the original source*, respect maker/checker, and never present an unproven figure as complete.
- **Validation:** focused unit tests + a browser spec with a **negative control** (break the disclosure, prove the spec fails, restore byte-for-byte).

### Step 3 — Close the G5 review items
Work the chain end to end: expense → source evidence → classification → allocation → offset → settlement → ledger → balance → historical cutoff → reports. For each, verify against the **deployed** function body, not documentation. Any gap → forward migration + focused SQL test.

### Step 4 — Re-verify parity and re-measure
Re-run the §D parity comparison (normalised function hashes both sides) and the full §E matrix. **Never reuse this document's numbers as current.**

### Step 5 — Checkpoint discipline (after every step)
```
execute → focused tests → real SQL → browser → diff review → commit → push → verify literal remote SHA
```
Never leave a large batch of completed work uncommitted. Update `docs/execution/RECONSTRUCTION_INVENTORY.md` (COMPLETED / IN PROGRESS / NEXT / BLOCKED / REMOVED / PRESERVED) in the same commit as the work it describes.

---

## J. SETTLED DECISIONS — DO NOT REOPEN OR INVENT

**Settled (treat as fact):**
- `calculate_owner_net_payout` is the single owner-payout derivation authority (ADR 0001).
- Proven cash comes from `app_private.owner_settlement_paid_cash`, never from `net_payable`, and never from `net_payable − offset_applied`.
- Owner-funds events are append-only; corrections are compensating entries.
- A missing historical balance fails closed; it is never invented or zeroed.
- OMR money is `numeric(18,3)`. Rates, durations, valuations and meter readings are legitimately scale-2.
- Merged migrations are immutable. Repairs are **forward-carry**, copied verbatim by line range.
- Fixture backends fail closed (404/PGRST205) on unseeded tables — **never** answer `200 []`.

**Must NOT be invented — require an approved source or the user:**
- Any accounting treatment not already established in `docs/source-of-truth/`.
- Any opening balance, cutover date, or historical allocation lacking S08/S09 approval.
- Any authorization rule inferred from a field name or accounting classification alone.
- Any production data fix.

---

## K. LATEST SAFE CHECKPOINT

| | |
|---|---|
| Branch | `reconstruction/checkpoint-20260909` |
| Last work commit (code/schema/evidence) | `e6e2e44477db8e182dec6b05380941530fc61b15` |
| Branch tip | the docs-only commit adding this file (child of the above) |
| Prior verified checkpoints | `e6e2e444`, `b11b5da3`, `e7ac2774`, `298739ad`, `274aa729`, `48037a69` |
| Tree state | clean |
| All gates (measured at `e6e2e444`; the tip adds documentation only, no code or schema) | replay 100/100 · gates 7/7 · Guardian PASS · typecheck clean · 3,943 tests / 0 failures |

**Reconstruction is NOT declared complete.** The financial chain, migrations, isolation and production parity are proven to the stated level, but §G items remain genuinely unfinished or unproven — most importantly the authenticated app shell (G1) and the bootstrap-stall root cause (G2).
