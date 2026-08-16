# Malik — Financial Hardening Delivery Report

**Mission:** Autonomous Sequential Financial Hardening Execution (Phases 1–3).
**Authoritative audit:** `docs/audits/FINANCIAL_HARDENING_AUDIT_20260815.md`.
**Repository:** `mohamedmasoud3030-tech/malik`

---

## Repository

| Item | Value |
|---|---|
| Base `origin/main` SHA | `656131da421fc36e95143d6b992a6dbac17228a3` |
| Final local HEAD | `667c6328a12e60d700a5c79a7f3ab41d1f2a7b71` |
| Branch | `arena/01a007aa-malik` |
| Ahead / behind `origin/main` | 4 ahead (audit + 3 phases + docs) |
| Working tree | clean |
| Remote state | Phases 1 & 2 pushed (`6dd1a5d`); **Phase 3 + docs committed locally only — push blocked by expired GitHub token** |
| PR(s) | **Not created — blocked by expired GitHub token** |

> **Blocker (external):** the GitHub token (`GH_TOKEN`/`GITHUB_TOKEN`) expired/revoked
> mid-session. Phases 1 & 2 were pushed before expiry. Phase 3 (`97dc789`) and the
> documentation commit (`667c632`) are fully committed and verified on the local
> branch but could not be pushed, and no PR was created. Reconnect GitHub in Arena to
> push the remaining commits and open the PR. **All implementation work is complete,
> committed, and test-green locally.**

---

## Phase 1 — Canonical Financial Posting Convergence

- **Legacy/canonical divergence found:** the audit reported `record_invoice_payment_atomic → post_receipt_atomic → legacy journal_entries` while reconciliation reads `journal_batches`. **Investigation on current main proved this is already converged**: `journal_entries` is a **compatibility VIEW** over `journal_batches`/`journal_lines` whose INSTEAD-OF trigger blocks browser writes and routes legacy business-RPC inserts into canonical `journal_batches` (idempotent event keys, `is_legacy_compat`). The live collection path already runs `record_invoice_payment_atomic → post_receipt_atomic → post_journal_event`.
- **Final authoritative posting path:** `post_journal_event → journal_batches / journal_lines`, used by payments, receipts, invoice generation and the new credit RPCs.
- **Affected RPCs:** `generate_invoices_from_active_contracts` rewritten to post via `post_journal_event` (was `journal_entries` compat INSERT), plus a period bootstrap (`gl_ensure_initial_open_period`).
- **Precision changes:** widened to `numeric(18,3)` — `contracts.rent_amount`, `invoices.amount/paid_amount/tax_amount`, `payments.amount`, `receipts.amount`, `receipt_allocations.amount`, `expenses.amount`; OMR 3dp checks; invoice tax rounding to 3dp.
- **Historical compatibility:** no legacy history deleted/rewritten; compat VIEW preserved; security_invoker analysis views (`v_balance_reconciliation`, `v_balance_reconciliation_drift`, `s08_retroactive_version_differences`) preserved across widening.
- **Reconciliation proof:** `phase1-omr-precision-reconciliation.test.ts` drives the real RPCs (generate + pay) and asserts OMR 3dp exactness, canonical `journal_batches` posting, balanced batches, AR↔1201 reconciliation, and cross-company rejection.
- **Migration:** `20260819000000_phase1_omr_precision_convergence.sql`.
- **Tests:** phase1 4/4; db0:gate 7/7.

## Phase 2 — Invoice Truth & Billing Integrity

- **Billing obligation identity:** `invoices.charge_type` (default `RENT`) + `billing_period_start/end`; unique index `ux_invoices_billing_obligation (company, contract, charge_type, billing_period_start)` — the final DB protection against duplicate recurring charges, while allowing distinct charge types per period. Dropped the legacy `invoices_contract_issue_date_unique`.
- **Recurring generation:** `generate_invoices_from_active_contracts` is deterministic, idempotent, and concurrent-safe (per-contract advisory lock + unique index as final guard).
- **Invoice immutability:** `invoice_document_integrity` trigger blocks edits to financially meaningful posted fields and hard-deletes of posted invoices; `invoice_lineage_guard` enforces `invoice.company_id == contract.company_id`; direct invoice INSERT/UPDATE/DELETE revoked from `authenticated` (server-only writes).
- **Lifecycle separation:** `document_status` (DRAFT/POSTED/VOIDED/REVERSED) separated from derived payment `status` (UNPAID/PARTIALLY_PAID/PAID; OVERDUE derived).
- **Deterministic dates:** `contracts.billing_day` (1..28) + `grace_days`; `issue_date = billing_day of period`, `due_date = period_end + grace_days`.
- **Migration:** `20260819010000_phase2_invoice_truth.sql`.
- **Tests:** `phase2-invoice-truth.test.ts` 8/8 (determinism, idempotency, DB duplicate rejection, distinct charge type, immutability + hard-delete block, DRAFT→POSTED lifecycle, settlement update allowed, cross-company lineage).

## Phase 3 — Credit / Reversal / AR Allocation Integrity

- **Credit/reversal model:** `invoice_credits` append-only ledger — company, invoice, amount (3dp), `credit_type` (PARTIAL/FULL), reason, `reason_code`, actor, timestamp, `effective_date`, idempotent `request_id`, status (POSTED/REVERSED), canonical journal linkage, reversal linkage/reason/actor. RLS company-scoped select; no client writes.
- **Original immutable:** credits never UPDATE the original posted amount; original remains historical truth.
- **Canonical GL integration:** `create_invoice_credit_atomic` posts via `post_journal_event` (CR 1201 reduce AR, DR 4000 reduce revenue, DR 2100 reduce VAT), balanced and idempotent; `reverse_invoice_credit_atomic` uses compensating `reverse_journal_batch`.
- **Allocation truth / outstanding derivation:** outstanding = `amount + tax − paid_amount − credited_amount`; `credited_amount` maintained transactionally under row locks. Derived status (UNPAID/PARTIALLY_PAID/PAID/OVERDUE) and wp05 AR subledger + `rpt_overdue_invoices` account for credits.
- **Ceilings:** credit ≤ eligible outstanding (row-locked); duplicate reversal rejected; replay idempotency; cross-company rejected.
- **Migration:** `20260819020000_phase3_credit_and_ar_integrity.sql`.
- **Tests:** `phase3-credit-reversal.test.ts` 9/9 (credit reduces outstanding + reconciles 1201, original immutable, idempotent replay, ceiling rejection, cross-company rejection, full-clear → PAID + AR zero, reversal restores AR, duplicate-reversal rejection, wp05 subledger = 1201).

## Security

- **Server-side authority:** all new/rewritten RPCs are SECURITY DEFINER with role guards (ADMIN/MANAGER/ACCOUNTANT), company from JWT, pinned `search_path`, and company-scoped account resolution.
- **Cross-company isolation:** invoice lineage trigger + RLS `p0_tenant_isolation` + credit/invoice company checks; db0 isolation gate PASS (218 policies, no violations).
- **SECURITY DEFINER review:** new trigger helpers (`invoice_lineage_guard`, `invoice_document_integrity`) and credit RPCs revoke execution from `anon`/`public`; credit RPCs granted to `authenticated`/`service_role`.
- **Direct-write prevention:** invoice INSERT/UPDATE/DELETE revoked from `authenticated`; invoice_credits revoked (server-only RPCs); GL-write-boundary guard PASS (new code uses `post_journal_event`, no new legacy journal writes).
- **Replay protection:** `financial_operation_idempotency` + advisory locks + fingerprint reuse rejection across payment, credit, and credit-reversal.

## Regression Evidence

| Gate | Result |
|---|---|
| Migration replay | 258/258 clean (db0:gate migration-chain) |
| db0:gate | **7/7 PASS** (replay, idempotency, schema-type-drift, contract, isolation, role-model, regressions) |
| DB/pgTAP | All pgTAP shims pass within suite; phase1/2/3 focused replay tests pass |
| Security | GL-write-boundary OK; sensitive-financial-write-boundary OK; migration-hygiene OK; enterprise-freeze PASS |
| Concurrency | Billing-obligation unique index; credit ceilings row-locked; over-allocation blocked; tests cover duplicate/ceiling/idempotency |
| Type drift | schema-type-drift PASS (generated types match) |
| Typecheck | PASS |
| Lint | PASS |
| Tests | **425 files / 2669 tests, 0 failures** (full `pnpm test`) |
| Build | PASS (production build) |
| `git diff --check` | clean |

## Remaining Risks

- **Payment-allocation depth:** the live payment entry point `record_invoice_payment_atomic` remains single-invoice; one-payment→multiple-invoices and an explicit unallocated-payment-balance surface are supported at the engine level (`post_receipt_atomic` multi-allocation) but not exposed through a multi-invoice convenience RPC. Documented, not addressed in this wave.
- **FIXED_MONTHLY management-fee / commission multi-policy** and **multi-party expense responsibility allocations** remain open (Phase B/C of the audit roadmap) and were intentionally out of scope.
- **Legacy report RPCs** (`rpt_trial_balance`, `rpt_income_statement`, `rpt_balance_sheet`) still round to 2dp; they are superseded by the wp05 3dp GL reports but remain present.
- **Live/hosted proof** (authenticated deployment, real bank data) is external; repository-level verification only.

## Final Decision

**READY FOR FINANCIAL HARDENING MERGE REVIEW** (implementation-wise) **with an external push blocker.**

All three phases are implemented, committed, and fully green locally (db0:gate 7/7, 2669/2669 tests, typecheck, lint, build, all guards). The specific architecture failure identified by the audit — live AR/collection transactions not equal to canonical reconciled accounting truth — is resolved: the live path now posts through `post_journal_event` → `journal_batches` at exact OMR 3dp, with deterministic billing, billing-obligation identity, posted-invoice immutability, controlled credits/reversals, allocation-based outstanding derivation, concurrency safety, company isolation, and append-only history.

**The only blocker to shipping is external:** the GitHub token expired mid-session, so Phase 3 (`97dc789`) and the documentation commit (`667c632`) could not be pushed and no PR was created. **Reconnect GitHub in Arena** to push the remaining commits to `arena/01a007aa-malik` and open the review PR. All safe completed work is preserved in local commits; nothing is lost.
