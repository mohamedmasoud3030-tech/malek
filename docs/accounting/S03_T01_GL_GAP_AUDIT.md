# S03-T01 — GL Gap Audit (ADR 0010 + ADR 0011)

**Task:** `S03-T01 — Audit existing GL schema against ADR 0010 and ADR 0011; produce gap matrix before SQL.`
**Scope:** Documentation / analysis audit ONLY. **No SQL executed, no migrations, no schema/RPC/RLS/grants, no app code changed.**
**Branch:** `audit/s03-t01-gl-gap-matrix`
**Base SHA (origin/main):** `282e7f8b0b6a02c189df423d132879cf637e09e8` (fetched `git fetch --all --prune`, branch created from this exact SHA)

> **Explicit confirmation — no SQL was executed.** This audit produced a static evidence matrix from the repository. No migration was created or modified, no schema object was touched, and nothing was merged.

---

## A. Executive Summary

### What actually exists and is present on `origin/main`

The Stage 3 canonical GL model described by ADR 0010 **is present as forward migrations** (unapplied-at-a-live-cluster is unknown from the repo alone, but the schema baseline is defined by these files, which are on `main`):

| Migrations | Objects |
|---|---|
| `20260804030000_stage3_gl_core_chart_of_accounts_and_periods.sql` | `accounts` additive upgrade (company-scoped), `accounting_periods`, provisioning/period RPCs, write guards |
| `20260804030100_stage3_gl_core_journal_batches_and_lines.sql` | `journal_batches`, `journal_lines`, `journal_entries` **view**, `journal_entries_archive`, balance constraint triggers, backfill |
| `20260804030200_stage3_gl_core_posting_engine_and_rpcs.sql` | `gl_create_journal_batch`, `gl_post_journal_batch`, `post_journal_event`, `reverse_journal_batch`, period RPCs, read RPCs |

So at a **schema level**, ADR 0010's canonical model, company-scoped chart of accounts, accounting periods (OPEN/SOFT_CLOSED/HARD_CLOSED), posting engine, idempotency key, immutability triggers, and balance enforcement are **implemented and shipped in the migration baseline**.

### What is PARTIAL / effectively dormant

The critical finding is that **the new posting engine is NOT wired into any live business posting path.** Every current business/financial RPC that writes a journal entry still writes through the legacy `journal_entries` **compatibility view** (`INSTEAD OF INSERT` → canonical batches with `is_legacy_compat = true`), **not** through the engine.

- The engine functions (`gl_create_journal_batch`, `gl_post_journal_batch`, `post_journal_event`, `reverse_journal_batch`) are referenced only in:
  - `20260804030100` (backfill/trigger internal refs)
  - `20260804030200` (their own definitions)
  - `supabase/rollback/...` and `supabase/tests/stage3_gl_core.sql`
  - **No business migration or RPC calls them.**
- All live posting RPCs write via `insert into public.journal_entries (...)` (compat path):
  - `pay_commission_atomic` / `reverse_commission_atomic` — `20260801000002`
  - `record_invoice_payment_atomic` — `20260728090000` (final form `20260723000000` grants)
  - `void_receipt_atomic` — `20260728090000`
  - `create_expense_with_journal_atomic` — `20260727091000`
  - `update_expense_with_journal_atomic` — `20260727094000`
  - `create_deposit_atomic` (deposits) — `20260718100928_real_deposits_ledger.sql`
  - `pay_owner_settlement_atomic` — `20260804010100`
  - `generate_invoices_from_active_contracts` + automation `execute_automation_rule` (cron) — `20260714000002`, `20260718101201`
- Consequences of the compat path:
  - Batches are created as `is_legacy_compat = true` → **exempt from accounting-period resolution** → `accounting_period_id` stays `NULL` for every live posting.
  - Business postings **do not use `event_id`**; idempotency is via `financial_operation_idempotency (operation_name, request_id)`, not the `(company_id, source_type, source_id, event_id)` engine key.
  - Reversal paths (`void_receipt_atomic`, `reverse_commission_atomic`) are **not** the engine `reverse_journal_batch`; `void_receipt_atomic` accepts **client-supplied reverse entries** (`p_reverse_entries`).

### What is ABSENT

- **`late_posting` flag** required by ADR 0011 D06 (`late_posting=true` on late events). Not present on `journal_batches` or anywhere in the codebase (grep = no matches).
- **`posting_date` column**: `journal_batches` carries `posted_at timestamptz` but there is **no separate `posting_date`** column; ADR 0011 D06 names `posting_date`.
- **Wiring of business postings to accounting periods / first-open resolution.** `gl_resolve_accounting_period` exists engine-side, but no live posting reaches it. There is **no seeding/auto-creation of the first OPEN accounting period** per company (an admin must create one; dormant because business postings bypass periods).
- **GL as financial-statement source of truth.** Current financial reports (`rpt_trial_balance`, `rpt_income_statement`, `rpt_balance_sheet`, `rpt_cash_flow`) are computed from **operational subledgers** (`payments`, `receipts`, `expenses`, `tenant_deposits`, `commissions`) — **not** from `journal_entries`/`journal_batches`/`journal_lines`. This conflicts with the canonical rule `gl_is_financial_statement_source_of_truth = True` and the ADR 0010 "consolidated ledger" intent. (ADR 0010 explicitly acknowledges "no financial reports beyond the existing operational ones," so reports are currently operational by design.)

### Most serious conflicts vs ADR 0010 / ADR 0011

1. **Two posting paradigms coexist.** Engine (service_role only, idempotent, period-resolved) is unused; legacy compat path (authenticated RPCs, `is_legacy_compat`, no period, no `event_id`) is the live path. This violates the ADR 0010 "one canonical boundary" and the ADR 0011 D18 "if the code conflicts with the ADR, fix the code" principle.
2. **Accounting periods are cosmetic for live data** — no live posting resolves a period, so `DRAFT→POSTED` business entries carry `accounting_period_id = NULL` and never honor OPEN/SOFT/HARD close.
3. **Reversal is not engine-managed** for receipts (client-supplied reverse entries) — ADR 0010/0011 D15 require compensating/reversal transactions that link to the original, and prohibit delete; `void_receipt_atomic` inserts caller-supplied reversing entries.
4. **`late_posting` and `posting_date` (D06) are unimplemented.**
5. **Reports do not use GL** as the financial-statement source of truth (canonical rule + ADR 0010 intent), so GL gaps propagate into reports.

---

## B. Object-by-Object Gap Matrix

Legend — Classification: **KEEP / CHANGE / ADD / DEPRECATE**. *No historical/financial object is marked REMOVE; deprecated objects retain an explicit safe deprecation path.*

| Object / capability | Current evidence | ADR requirement | Classification | Required action | Risk | Dependencies | Tests/evidence |
|---|---|---|---|---|---|---|---|
| `accounts` (chart of accounts) | Upgraded in place: `account_type`, `normal_balance`, `currency_code`, `precision`, `is_active`, `updated_at`; `UNIQUE(company_id,no)`; `(id,company_id)` composite key; CHECKs (OMR ⇒ precision 3). Migration `20260804030000`. | ADR 0010 §2 company-scoped chart, OMR precision 3 (C7) | **KEEP** | None structurally; wire new business postings to it | Low if left untouched; high if accounts drift vs provisioned set | provisioning RPCs | `stage3-chart-of-accounts.test.ts`, `stage3_gl_core.sql` plan 1–6 |
| `accounts` legacy `admin_write_accounts` policy (FOR ALL, `is_admin()`) | Still present; not dropped anywhere after creation (`20250101000002`). `is_admin()` granted to `authenticated` by `20260804030000`. | ADR 0010 §5 "no write grants to authenticated" intent for new objects; chart writes via RPC | **CHANGE** | Restrict direct browser writes to `accounts`; force provisioning via `ensure_company_chart_of_accounts()`/`provision_company_chart_of_accounts()` | Medium (authenticated ADMIN can mutate chart via PostgREST table API, bypassing RPC) | RLS audit | `20250101000002_rls_policies_and_grants.sql:128`; `20260804030000` lines 323–332 |
| `provision_company_chart_of_accounts` | Idempotent, 18 accounts provisioned, advisory-locked; service_role only. Migration `20260804030000`. (Migration comment says "17" but array has 18 — cosmetic.) | ADR 0010 §2 "18 required accounts"; idempotent | **KEEP** | Fix the "17/18" comment; keep as canonical seed | Low | account resolution | `stage3_gl_core.sql`; `stage3-chart-of-accounts.test.ts` |
| `ensure_company_chart_of_accounts` / `ensure_company_account` / `require_company_account_id` | Browser-facing boundary, JWT company derived, ADMIN/MANAGER gate; service_role variants. | ADR 0010 §2 account resolution; ADR 0005 | **KEEP** | None structural | Low | — | `stage3_gl_core.sql` |
| Account uniqueness (account_no) | `UNIQUE(company_id,no)`; global `UNIQUE(no)` dropped after fail-closed duplicate check. | ADR 0010 §2: account_no repeats across companies, never within one | **KEEP** | None | Low | — | `20260804030000` lines 196–198 |
| `journal_batches` | Canonical batch table: `DRAFT/POSTED/REVERSED`, idempotency key `UNIQUE(company_id,source_type,source_id,event_id)`, traceability CHECK, immutability/lifecycle trigger, RLS. | ADR 0010 §1, §4 | **KEEP** | Wire business postings into it (via engine) | Low (schema) / High (if left unused) | posting engine | `20260804030100`; `stage3_gl_core.sql` |
| `journal_lines` | Immutable lines, `numeric(18,3)`, debit XOR credit CHECK, precision CHECK, composite FKs `(batch_id,company_id)`+`(account_id,company_id)`, immutability trigger. | ADR 0010 §1 | **KEEP** | None structural | Low | — | `20260804030100`; `stage3_gl_core.sql` |
| `journal_entries` (view) | Read-only compatibility **VIEW** (`security_invoker=true`) with INSTEAD OF INSERT routing to canonical batches (`is_legacy_compat=true`), INSERT/UPDATE/DELETE mutation triggers; grant SELECT only to `authenticated`. | ADR 0010 §1 compatibility view; browser writes rejected | **KEEP** (transitional) | Keep as read compatibility; migrate writers to engine; eventually narrow to read-only | High (it is the only live write path today) | engine wiring | `20260804030100` lines 600–780; `stage3_gl_core.sql` |
| `journal_entries_archive` | Frozen archive (rename of historical table), DML-blocking trigger, backfill done. | ADR 0010 §1 archive frozen; no rewrite of history | **KEEP** | None; never un-freeze | Low | — | `20260804030100` lines 578–604 |
| Balance enforcement (debit=credit @ 0.001 OMR) | DEFERRABLE constraint triggers on `journal_lines` and `journal_batches`; engine validates rounded balance; line precision CHECK. | ADR 0010 §4; ADR 0009 C7 | **KEEP** | None | Low | — | `20260804030100` `gl_assert_batch_balance`; `stage3-posting-engine.test.ts` |
| `accounting_periods` | OPEN/SOFT_CLOSED/HARD_CLOSED; no-overlap trigger; write-guard trigger; HARD_CLOSED immutable; reopen requires reason; DELETE rejected; RLS; RPCs `create_accounting_period`/`update_accounting_period_status`. | ADR 0010 §3; ADR 0011 D06 | **KEEP** | None structural | Low | engine wiring | `20260804030000`; `20260804030200`; `stage3-periods-reversal-security.test.ts` |
| **Period wiring to business postings** | No live business posting resolves `accounting_period_id` (compat path → NULL). Engine resolver `gl_resolve_accounting_period` exists but unused by business RPCs. | ADR 0010 §3 server-side resolution; ADR 0011 D06 | **CHANGE** | Route business postings through the engine so every POSTED batch carries a resolved period | High (periods currently cosmetic) | engine wiring | grep: no business RPC calls engine |
| **`late_posting` flag** | **Absent** (no matches in migrations, app, docs/accounting). | ADR 0011 D06 `late_posting=true` | **ADD** | Add `late_posting boolean` on `journal_batches` set by resolver when redirecting | Medium | period resolution | grep = no matches |
| **`posting_date`** | `posted_at timestamptz` exists; **no `posting_date` column** separate from `posted_at`. | ADR 0010 §3/§4 `posted_at`; ADR 0011 D06 `posting_date` | **CHANGE/ADD** | Align column name/derivation (posting_date = period-open date for late events) | Medium | — | `journal_batches` DDL; ADR 0011 D06 |
| **First-open-period seeding** | No auto-creation of the first OPEN period per company; resolution logic exists but dormant. | ADR 0011 D06 "first open period" semantics | **ADD** | Seed/require first OPEN period; document first-open logic and late-event handling in a runbook | Medium | S03-T07/T08 | no seeding migration found |
| Posting engine RPCs (`gl_create_journal_batch`, `gl_post_journal_batch`, `post_journal_event`, `reverse_journal_batch`) | Service_role only, SECURITY DEFINER, pinned `search_path`, idempotent by `event_id`, conflict detection, period resolution, reverse links via `reversal_of_batch_id`. | ADR 0010 §4 | **KEEP** | **Wire business paths to it (the required change); add browser-safe, allowed business-event facades** | High if left orphaned | all business posting paths | `stage3-posting-engine.test.ts`; `stage3_gl_core.sql` |
| Reversal model | Engine `reverse_journal_batch` (equal-and-opposite, idempotent) **unused**; `void_receipt_atomic` uses **caller-supplied `p_reverse_entries`**; `reverse_commission_atomic` own reversal. | ADR 0010 §4; ADR 0011 D15 (compensating transaction, no delete, link to original) | **CHANGE** | Move void/reversal to engine-managed reversal; never trust client reverse lines | High | engine wiring | `void_receipt_atomic` `20260706090000` lines 307–324 |
| `financial_operation_idempotency` | Legacy idempotency by `(operation_name, request_id)`; used by all legacy posting RPCs. | ADR 0010 §4 idempotency by `event_id` | **DEPRECATE (safe)** | Keep for audit; new postings use engine `(company_id,source_type,source_id,event_id)`; back-compat retained | Medium | engine wiring | `pay_commission_atomic` insert (line 219) |

---

## C. Posting Path Inventory

Columns: RPC/function/service, company scoping, idempotency key, debit/credit enforcement, reversal model, browser-write exposure, tests, classification.

| Posting path | Signature / path | Company scoping | Idempotency key | Debit/credit enforcement | Reversal model | Browser-write exposure | Tests | Classification |
|---|---|---|---|---|---|---|---|---|
| Invoice payment | `record_invoice_payment_atomic(jsonb)` — `20260728090000` (def `20250101000003`), grant `20260723000000` | DEFINER; scoped (S02 inventory flags "NOT DETECTED" for company predicate on one variant — review) | `financial_operation_idempotency` (request_id) | via `journal_entries` compat view | via `void_receipt_atomic` | EXECUTE granted to `authenticated` (browser can invoke RPC) | `paymentService.test.ts`, `payment-account-resolution-migration-contract.test.ts` | **CHANGE** → engine |
| Receipts | `post_receipt_atomic(jsonb)` — `20260728090000` | DEFINER; `current_company_id()` | `financial_operation_idempotency` | compat view | void | EXECUTE `authenticated` (S02: n/a for anon) | `receiptService.test.ts`, `receipt-rpc-migration-contract.test.ts` | **CHANGE** → engine |
| Receipt void / reversal | `void_receipt_atomic(text,bigint,jsonb,jsonb)` — `20260728090000` | DEFINER; ADMIN/MANAGER gate; `current_company_id()` | none (caller-triggered) | inserts **caller-supplied** reverse entries into `journal_entries` | caller-supplied reverse entries | EXECUTE `authenticated` | `payment-void-report-parity-migration-contract.test.ts` | **CHANGE** → engine reversal |
| Expenses | `create_expense_with_journal_atomic(jsonb)` — `20260727091000`; `update_expense_with_journal_atomic` — `20260727094000` | DEFINER; scoped (S02: derivation source unknown) | `financial_operation_idempotency` | compat view | n/a (delete/void path) | EXECUTE `authenticated` (some) | `expense-atomic-migration-contract.test.ts` | **CHANGE** → engine |
| Deposits | `create_deposit_atomic` / deposit ledger — `20260718100928_real_deposits_ledger.sql` | DEFINER; company scoped | `financial_operation_idempotency` | compat view | deposit refund/void | EXECUTE `authenticated, service_role` | `deposit-service.test.ts` | **CHANGE** → engine (S05) |
| Owner settlement | `pay_owner_settlement_atomic` — `20260804010100` (reservation RPCs) | DEFINER; scoped | reservation + idempotency | compat view | post-payment refund → Due from Owner | not authenticated (S02: n/a) | `owner-settlement-live-workspace.test.ts` | **CHANGE** → engine (S04) |
| Commissions | `pay_commission_atomic` — `20260801000002`; `reverse_commission_atomic`; `create/cancel/update_commission_atomic` — `20260804020000` | DEFINER; `current_company_id()` | `financial_operation_idempotency` | compat view | own reversal RPC | EXECUTE `authenticated` | `commissions-financial.test.ts` | **CHANGE** → engine (S04/S05) |
| Invoice generation / automation (cron) | `generate_invoices_from_active_contracts()` — `20260714000002`; `execute_automation_rule`/`_internal` + `cron.schedule` — `20260718101201` | DEFINER; ADMIN/MANAGER + service_role | none / rule run | compat view (`journal_entries` INSERT lines 186/203/221) | n/a | service_role for scheduled; authenticated for manual | `product-workflow-scenarios.test.ts` | **CHANGE** → engine (S04) |
| Bank reconciliation | `bank_*` RPCs — `20260705000005`, `20260711123000` | company scoped | bank subledger | **does NOT write journal entries** (bank subledger only) | n/a | authenticated | `bank-csv-import-s02-contract-replay.test.ts` | **KEEP** (no GL write) |
| Generic/manual journal | **None exposed to browser.** Engine RPCs are service_role only; view blocks browser writes. | n/a | n/a | n/a | n/a | none | `stage3-posting-engine.test.ts` (free-form blocked) | **KEEP** (correct per ADR; no free-form journal) |

---

## D. Migration and Object Map

| Migration | Objects created / altered | Latest effective migration | Rollback companion | Conflicts / duplicates |
|---|---|---|---|---|
| `20260804030000_stage3_gl_core_chart_of_accounts_and_periods.sql` | `accounts` (additive), `accounting_periods`, `provision_company_chart_of_accounts`, `ensure_company_chart_of_accounts`, `ensure_company_account`, `prevent_account_deletion_if_referenced`, `guard_accounting_period_no_overlap`, `guard_accounting_period_writes`, indexes, grants | `20260804030000` | `supabase/rollback/20260804_rollback_stage3_gl_core_chart_of_accounts_and_periods.sql` | Comment says "17 accounts" but provisions 18 (cosmetic). No structural duplicate. |
| `20260804030100_stage3_gl_core_journal_batches_and_lines.sql` | `journal_batches`, `journal_lines`, triggers (`guard_journal_batch_lifecycle`, `guard_journal_line_immutability`, `gl_assert_batch_balance`), backfill, `journal_entries_archive` (renamed), `journal_entries` view + INSTEAD OF triggers, RLS | `20260804030100` | `supabase/rollback/20260804_rollback_stage3_gl_core_journal_batches_and_lines.sql` | Prior `journal_entries` TABLE DDL (`20250101000001/02/04`) now applies to the frozen archive; the view is separate. No duplicate definition. |
| `20260804030200_stage3_gl_core_posting_engine_and_rpcs.sql` | `gl_resolve_accounting_period`, `gl_validate_and_normalize_lines`, `gl_lines_fingerprint`, `gl_create_journal_batch`, `gl_post_journal_batch`, `post_journal_event`, `reverse_journal_batch`, `create_accounting_period`, `update_accounting_period_status`, `list_chart_of_accounts`, `list_accounting_periods`, `list_journal_batches`, `list_journal_lines` | `20260804030200` | `supabase/rollback/20260804_rollback_stage3_gl_core_posting_engine_and_rpcs.sql` | None; these engine RPCs do not overlap legacy business RPCs. |
| Related (S02 scope) | `20260804000000`, `20260804010000/10100/10200`, `20260804020000`, `20260805110000`, `20260805120000` | — | `20260804_rollback_*` companions | S02 and S03 share the period/batch boundary; **S02-T01 inventory (`docs/execution/S02_SECURITY_DEFINER_INVENTORY.md`) should be treated as the parallel audit, not duplicated here.** |

*No historical migration was modified. No new migration was written by this audit.*

---

## E. Test Coverage Matrix

| Test type | Exists? | Proves? | Status |
|---|---|---|---|
| Engine contract tests (`rentrix-app/src/s3/stage3-posting-engine.test.ts`, `stage3-periods-reversal-security.test.ts`, `stage3-chart-of-accounts.test.ts`) | Yes (PGLite) | Engine correctness in isolation: idempotency, precision, balance, periods, reversals, tenant isolation | **Exists and passes (per suite), but does NOT prove business-path wiring.** |
| pgTAP (`supabase/tests/stage3_gl_core.sql`, 50 assertions; run via `stage3-pgtap-file.test.ts` PGLite shim) | Yes | Engine behavior + backfill/compat path in a full replay | **Exists; proves engine + compat view, NOT that business RPCs call the engine.** |
| Clean replay (`rentrix-app/src/p1/replay-bootstrap`, `createFullReplayedDatabase`) | Yes | All forward migrations apply cleanly in order on PGLite | Exists (used by s3 tests + s02 contract replay). |
| Concurrency/idempotency tests (engine) | Yes (s3) | Concurrent retries yield one batch for engine path | Exists; **engine-only. No concurrency test for legacy `financial_operation_idempotency` business paths.** |
| Frontend boundary tests (direct journal write) | Partial | Browser cannot directly write `journal_entries`/`journal_batches`/`journal_lines` | **Exists** for view/engine; **missing** a boundary test proving an authenticated client cannot bypass RPCs to write `accounts` (legacy `admin_write_accounts`). |
| Business-posting integration tests (record/void/expense/deposit/commission/settlement → canonical batches with resolved period) | **Absent** | Legacy RPCs route through engine with `event_id` + resolved period | **Gap — required for S03-T04/T05/T06/T09.** |
| Late-posting test (`late_posting=true`, preserved `effective_date`, open-period redirect) | **Absent** | ADR 0011 D06 late-event semantics | **Gap — `late_posting` not implemented.** |
| Period-lifecycle permission tests (hard-close irreversibility, reopen reason, unauthorized denial) | Yes (s3) | Engine period RPCs enforce lifecycle | Exists (engine-only). |
| CI gates (`check:docs`, `check:business-rules`, `check:execution-plan`, `check:migration-hygiene`, typecheck, lint, unit) | Yes | Documentation/integrity/execution-plan correctness | Pass on repo baseline; **this audit runs the three doc gates + `git diff --check` + secret scan (see Verification).** |

---

## F. Proposed S03 Execution Sequence (NOT executed)

> Suggested order only. **None of S03-T02..S03-T10 is implemented here.**

| Item | Prerequisites | Files/objects expected | Migration boundary | Tests required | Conflict risk | Backfill / approval |
|---|---|---|---|---|---|---|
| S03-T02 — company-scoped account identity complete | S03-T01 (this audit); confirm `accounts` RLS/write path | `accounts` (already scoped), provisioning | New forward migration (additive) | uniqueness `(company_id,no)`; account-type/normal-balance/currency/precision checks | Low (mostly present) | No |
| S03-T03 — seed required control/revenue/expense/master-lease accounts idempotently | S03-T02 | `provision_company_chart_of_accounts` (18) | Forward + rollback | repeated-run idempotency | Low | Backfill per company; needs approval for real companies |
| S03-T04 — enforce batch DRAFT/POSTED/REVERSED + immutable posted entries | engine already enforces; wire business | `journal_batches` triggers (exist) | Forward | update/delete denial tests on posted | Low | No |
| S03-T05 — require company_id/source_type/source_id/event_id/effective_date/posting_date/reversal linkage | **wire business postings to engine** | `journal_batches` traceability (exists); add `posting_date`/`late_posting` | Forward | schema contract + posting tests | **High — touches all posting RPCs** | No |
| S03-T06 — enforce debit=credit @ 0.001 + prohibit free-form browser journals | engine + view already do | engine validation (exists) | Forward | balanced/unbalanced rounding; frontend boundary | Low | No |
| S03-T07 — monthly OPEN/SOFT_CLOSED/HARD_CLOSED + irreversible hard close | periods exist engine-side | `accounting_periods` + RPCs (exist) | Forward | period lifecycle + permission tests | Medium (needs first-open seed) | No |
| S03-T08 — late events to first open period, preserve effective_date, `late_posting` | **add `late_posting`; resolve period on business postings** | `journal_batches`, resolver | Forward | closed-period acceptance (D06) | **High** | No |
| S03-T09 — every posting RPC idempotent by `event_id`, safe concurrency | **rewire business RPCs to `event_id`** | all posting RPCs → engine | Forward + rollback | concurrency = one batch; `GL_EVENT_CONFLICT` | **High** | Possibly backfill of event_id for legacy batches |
| S03-T10 — GL posting API contract + account-resolution runbook | all above | docs under `docs/accounting/` | n/a | docs linked to RPC signatures/error codes | Low | No |

**Key dependency:** S03-T05/T08/T09 all require migrating the live posting paths (record_invoice_payment, void_receipt, expenses, deposits, commissions, owner settlement, invoice generation) onto the engine. That is the single largest risk and the true "before SQL" blocker.

---

## G. Blockers and Unknowns

Explicitly not-invented answers. Anything not provable from the repo is recorded as **UNKNOWN** with the evidence needed to prove it later.

| # | Item | Status | Missing evidence / required query or test |
|---|---|---|---|
| G1 | Are the Stage 3 migrations applied to the live/staging database cluster? | **UNKNOWN** | Repo defines schema baseline only. Need a live `supabase db` / cluster catalog query (`\d journal_batches`, `\d journal_entries`) or CI "migrations applied" evidence. |
| G2 | Does any live posting actually produce `journal_batches`/`journal_lines` rows? | **UNKNOWN** | Static code says business RPCs write via compat view; need a runtime query `select count(*) from journal_batches where is_legacy_compat`; prove whether period IDs are ever populated. |
| G3 | Exact company-predicate completeness of `record_invoice_payment_atomic`/`post_receipt_atomic` (S02 inventory flags "NOT DETECTED"). | **UNKNOWN** | Static review of the full body + a cross-company denial test in PGLite. |
| G4 | Whether `financial_operation_idempotency` truly blocks duplicate postings under concurrency. | **UNKNOWN** | No concurrency test targets it; need a concurrent-retry test. |
| G5 | Effect of `journal_entries` view change on all downstream report RPCs in production. | **UNKNOWN** | Static: reports read operational subledgers, so likely unaffected; need a clean-replay + report query test. |
| G6 | Is the legacy `admin_write_accounts` policy a live direct-browser-write vector? | **UNKNOWN** | Need a PostgREST-level boundary test as `authenticated ADMIN` attempting a direct `INSERT/UPDATE` on `accounts`. |
| G7 | Were the `18` provisioned accounts the intended canonical set (no missing master-lease/control accounts for later stages)? | **UNKNOWN** | ADR 0010 says 18; code provisions 18. Confirm against ADR 0011 D07/D08 required accounts in S03-T03 review. |
| G8 | Are `SOFT_CLOSED` business denials actually reachable, given business postings bypass period resolution today? | **UNKNOWN** | Proof required only after engine wiring (S03-T07/T08). |

---

## Verification (documentation-only gates, this branch)

Planned/executed for this change (none modify schema or app code):
- `pnpm check:docs` — doc-link gate
- `pnpm check:business-rules` — canonical rules guard
- `pnpm check:execution-plan` — 10-stage plan guard
- `git diff --check` — whitespace/conflict hygiene
- Secret scan on the modified file(s)

> **Stop point honored.** This is a Draft PR only. The PR is **not** merged; no S03-T02..T10 was started; S02/PR3/review-ledger/status/master-plan/checksums were **not** modified. Merge is deferred until S02 is formally closed and the branch is rebased onto the latest `main`.

---

## Evidence index (file paths)

- ADRs: `docs/decisions/0010-stage3-general-ledger-core.md`, `docs/decisions/0011-final-business-accounting-and-operating-policies.md`
- Governance: `governance/final-decision-register.json`, `governance/canonical-business-rules.json`, `governance/10-stage-master-plan.json`
- Checklist: `docs/execution/10_STAGE_AGENT_CHECKLIST_AR.md`
- Stage 3 migrations: `supabase/migrations/20260804030000`, `20260804030100`, `20260804030200`
- Rollbacks: `supabase/rollback/20260804_rollback_stage3_gl_core_*`
- Tests: `supabase/tests/stage3_gl_core.sql`, `rentrix-app/src/s3/*.test.ts`, `rentrix-app/src/p1/replay-bootstrap.ts`
- Business posting RPCs: `20250101000003`, `20260706090000`, `20260714000002`, `20260718100928`, `20260718101201`, `20260727091000`, `20260727094000`, `20260728090000`, `20260801000002`, `20260804010100`
- S02 parallel audit: `docs/execution/S02_SECURITY_DEFINER_INVENTORY.md`
- Accounting reference docs: `docs/accounting/*.md` (documentation-only, not proof of implementation)
