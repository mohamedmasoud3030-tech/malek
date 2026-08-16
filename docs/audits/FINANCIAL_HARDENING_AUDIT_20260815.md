# Malik — Financial Hardening Audit Report

**Mission type:** Financial correctness audit only (no implementation, no redesign, no migrations).
**Repository:** `mohamedmasoud3030-tech/malik`
**Audit base SHA:** `656131da421fc36e95143d6b992a6dbac17228a3`
**Branch:** `arena/01a007aa-malik` (dedicated session branch, forked from exact `origin/main`)
**Ahead / behind `origin/main`:** 0 / 0 (identical)
**Working tree:** clean (restored after baseline test run regenerated evidence artifacts)
**Date:** 2026-08-15 (UTC)

> **Method note.** All findings below were re-verified against current `main@656131da`, not against any earlier audit. Canonical documents were read first; the repository (migrations + generated types `rentrix-app/src/types/database.ts` + RPC bodies + pgTAP/app tests) is treated as the authority for what exists today. No fixes were implemented.

---

## A. Executive Verdict

| Dimension | Verdict |
|---|---|
| **Financial foundation** | SOUND at the accounting core, but the operational tenant-receivable subledger (billing → invoice → collection) has material gaps. |
| **Production financial safety** | PARTIAL — not yet production-safe for the AR/billing surface. Invoice immutability, credit/reversal, billing-identity and OMR precision are not enforced at the authoritative (DB) layer. |
| **Accounting correctness** | SOUND for the canonical GL kernel (balanced, idempotent, immutable, 3dp) and period close; PARTIAL because the live collection posting path still writes to the legacy `journal_entries` stack while reconciliation reads `journal_batches`. |
| **Owner-money correctness** | SOUND — settlement server-derivation, source reservation, stale-total rejection, maker-checker, Due-from-Owner subledger and offset gating are well implemented. |
| **Banking / reconciliation** | PARTIAL — matching/reconciliation engine exists with strong pgTAP, but live proof is external and subledger precision mismatch (2dp AR vs 3dp GL) undermines exact reconciliation. |
| **Security / authority** | SOUND — RLS + SECURITY DEFINER revalidation + six-role + maker-checker; DB0 isolation gate clean (218 policies, no violations). |
| **Overall readiness** | **FINANCIAL FOUNDATION PARTIAL — fix identified blockers before expanding.** |

The database layer is far stronger than a typical brownfield property manager (GL engine, deposits, settlements, tax, numbering, isolation are genuinely hardened). The blockers are concentrated in the **tenant receivable / billing / invoice** surface and the **legacy-vs-canonical GL split**.

---

## B. Baseline

| Check | Result |
|---|---|
| `origin/main` SHA | `656131da421fc36e95143d6b992a6dbac17228a3` |
| Branch | `arena/01a007aa-malik` (0 ahead, 0 behind origin/main) |
| Working tree | clean |
| Install | `pnpm install --frozen-lockfile` — PASS |
| Migration replay | `pnpm db0:gate` — **7/7 PASS**; 255 migrations replay clean from zero (PGlite), idempotency no-op, generated types byte-match, contract-drift findings 42 (all governed/accepted), isolation gate PASS (87 tables / 218 policies / 293 functions / 10 views), 6/6 roles storable |
| Typecheck | `pnpm typecheck` — PASS |
| Lint | `pnpm lint` — PASS |
| Unit/integration tests | `pnpm test` — **2648/2648 PASS** across 422 files (incl. financial suites, GL stage-3 pgTAP shim 50/50, migration-contract tests) |
| Production build | `pnpm build` — PASS (only >500 kB chunk-size warnings) |
| Database tests | pgTAP shims run inside the app suite (e.g. `stage3_gl_core.sql` 50 assertions, `bank_csv_import_fail_closed`, `wp02_gap008/010`, etc.); full live-harness pgTAP not executed (no Supabase access token — `supabase:migration-evidence` BLOCKED, consistent with Document 7) |

**Interpretation:** all failures encountered are **pre-existing, documented, governed gaps** (e.g. DB0-07 OMR-precision boundary), not regressions introduced by recent work. No build/test defect was found in the current tree.

---

## C. Financial Audit Matrix (F01–F36)

Legend: `VERIFIED_IMPLEMENTED` = proven at authoritative layer; `PARTIAL` = some behavior but key guarantee missing; `INCORRECT` = violates the financial model; `MISSING` = absent; `IMPLEMENTED_UNVERIFIED` = exists, insufficient authoritative proof; `N/A` = not applicable.

| ID | Requirement | Status | Evidence | Risk | Recommended Action |
|---|---|---|---|---|---|
| F01 | Contract → Invoice lineage | **PARTIAL** | `invoices.contract_id` FK → `contracts`; invoice has no denormalized tenant/unit/property (so `invoice.tenant != contract.tenant` is structurally impossible). Company coherence (invoice.company_id == contract.company_id) is **not** enforced by a composite FK — only by RLS (`p0_tenant_isolation`, `20260724120000`) and RPC checks. | MEDIUM | Add composite company-scoped FKs or an authoritative lineage view; keep denormalized copies out. |
| F02 | Billing obligation identity / duplicate prevention | **PARTIAL → MISSING identity** | No `billing_period` on `invoices`, no `contract_schedule_item`/`billing_obligation` table. `generate_invoices_from_active_contracts` (`20250101000003`) dedups only by `(contract_id, issue_date=current_date)` — idempotent within a day, but a second run on another day creates a **new** obligation for the same rent period. No `UNIQUE(contract_id, billing_period)`. | **HIGH** | Introduce a billing-obligation identity (contract + period + charge_type) with a DB-level unique guard; make recurring generation idempotent on period, not day. |
| F03 | Invoice document lifecycle | **PARTIAL (combined)** | Single `invoices.status` string mixes document lifecycle (`draft`/`void`/`cancelled`) with settlement (`UNPAID/PARTIALLY_PAID/PAID/OVERDUE`). Overdue is derived in `rpt_overdue_invoices` (`due_date<as_of AND outstanding>0`) but there is no authoritative `POSTED`/`VOIDED` document lifecycle distinct from payment status. | MEDIUM | Separate document lifecycle from derived settlement status; derive paid/overdue. |
| F04 | Posted invoice immutability | **MISSING** | No DB trigger protecting invoice `amount/paid_amount/due_date/contract/tax`. `manager_write_invoices FOR ALL` policy (`20250101000002`) still grants ADMIN/MANAGER direct UPDATE/DELETE; no revoke on `invoices` (unlike `payments`/`expenses`, revoked in `20260806000000`). Frontend guard (`check-sensitive-financial-write-boundary.mjs`) is not authoritative. | **CRITICAL** | Revoke direct DML on `invoices`; add immutability trigger on posted/financially-relevant fields; route corrections through RPC. |
| F05 | Credit notes / reversal | **MISSING** | No credit-note table and no invoice credit/adjustment RPC (types list only `void_receipt_*`, `record_invoice_payment_atomic`, `recalculate_invoice_status`). `void_receipt_atomic` reduces `paid_amount` but cannot credit or adjust a posted invoice amount. | **CRITICAL** | Add credit-note/reversal/controlled-adjustment model linked to the original invoice (reason, actor, timestamp, approval). |
| F06 | Payment allocation as AR truth | **PARTIAL** | AR truth = `invoices.amount+tax - paid_amount` where `paid_amount` is a **cached mutable column** updated by `post_receipt_atomic`, not derived from allocations. `payments.invoice_id` is single (one payment → one invoice structurally); receipt can allocate to multiple invoices via `receipt_allocations`. No explicit unallocated-balance concept. Overpayment guard + row lock exist (`20260706021140`). | HIGH | Derive outstanding from posted invoice − valid credits − valid allocations; support one→many and many→one; add unallocated payment balance. |
| F07 | Payment ≠ Receipt | **PARTIAL** | `payments` and `receipts` are separate tables with shared identity (`receipts.payment_id UNIQUE`, `payments.receipt_id`). But the **financial allocation lives on `receipt_allocations`** (receipt-owned), and the live posting RPC `post_receipt_atomic` is a receipt that also writes payment via wrapper `record_invoice_payment_atomic`. Semantic risk of Receipt acting as financial truth (DOM-006 concern). | MEDIUM | Decide single allocation owner (payment); treat receipt as evidence only; keep identity link. |
| F08 | Deposit liability separation | **VERIFIED_IMPLEMENTED** (governed path) | `tenant_deposits` + `deposit_transactions` + `deposit_application_claims` + `deposit_refund_events` (3dp). RPCs use `FOR UPDATE` + `remaining_amount` ceiling + `request_id` idempotency + maker-checker approval: `create_deposit_application_claim_atomic`, `apply_deposit_claim_atomic`, `refund_deposit_governed_atomic`, `reverse_deposit_claim_atomic` (`20260817085000`/`20260817090000`). Deposits stay 2200 liabilities until approved application/refund. | LOW (governed path) | Retain; ensure legacy direct-write deposit paths remain revoked (`GAP-009`). |
| F09 | Duplicate financial protection | **PARTIAL** | Strong: `financial_operation_idempotency` PK(`operation_name,request_id`), advisory locks, `request_id` unique on receipts/deposits/void-requests, server numbering, settlement reservation partial-unique. **Missing:** no `UNIQUE` on `payments.reference_number` (external reference), no billing-period unique. | MEDIUM | Add DB unique on external payment reference; add billing-obligation unique. |
| F10 | Exact OMR money (3dp) | **INCORRECT for AR surface** | `invoices/payments/receipts/receipt_allocations/expenses/contracts.rent_amount` = `numeric(14,2)`; only deposits and GL (`journal_lines numeric(18,3)`), claims, refunds and tax snapshots are 3dp. Frontend uses JS `Number`. This is governed gap **DB0-07**. | **HIGH** | Widen AR/collection/expense subledgers to `numeric(18,3)`; keep rounding server-side; no binary-float financial truth. |
| F11 | Transactional money ceilings | **PARTIAL** | Ceilings with row locks + idempotency for: invoice overpayment (`post_receipt_atomic` `FOR UPDATE`, `paid+new ≤ amount+tax+0.001`), deposit refund/apply (`remaining_amount` ceiling), settlement stale-total/pay. Coverage incomplete where features are missing (no credit, no refund-on-invoice). | MEDIUM | Extend ceilings to new credit/reversal paths; add ceilings for refunds/commissions. |
| F12 | Derived outstanding balances | **PARTIAL** | `paid_amount`, `contract_balances`, `owner_balances`, `tenant_balances` are cached aggregates maintained by triggers + `recalculate_all_balances`; not purely derived from events. wp05 reconciliation detects drift but does not prevent it. | MEDIUM | Keep cache only as derived projection with reconciliation; treat events as truth. |
| F13 | Aging | **PARTIAL** | `rpt_overdue_invoices` computes `days_overdue`; frontend `arrears-aging-buckets.tsx` + `arrears-reports-service.ts` compute Current/1–30/31–60/61–90/90+ buckets client-side from invoice rows, groupable by contract/tenant/property/unit, with `as_of`. Not an authoritative server bucketed report; uses cached `paid_amount`. | MEDIUM | Promote bucket aging to an authoritative RPC; group by owner where logically applicable. |
| F14 | Deterministic due dates | **MISSING** | `generate_invoices_from_active_contracts` sets `due_date = issue_date = current_date`. `contracts` has `payment_cycle` but **no `billing_day` / `grace_period`**; `payment_terms_id` is nullable and not used in generation. No timezone/date-boundary policy. | **HIGH** | Add billing policy to contract/agreement and derive invoice/due/grace deterministically. |
| F15 | Owner funds accounting | **PARTIAL → VERIFIED (core)** | `due_from_owners` subledger (source_type OWNER_EXPENSE/RECOVERY/OFFSET/ADJUSTMENT, `lawful_offset_right`, status lifecycle, reversal batch) implemented via `20260817100000_wp02_gap008`. Office-paid owner expense posts to 1300, offset gated by `offset_allowed` + right. | MEDIUM | Wire end-to-end reports/settlement offsets; keep 2000 vs 1300 separation. |
| F16 | OWNER_AGENCY vs MASTER_LEASE | **PARTIAL** | `owner_agreement_versions.collection_role` (`OWNER_IS_CREDITOR`/`OFFICE_IS_CREDITOR`); MASTER_LEASE has separate `gl_ml_*` kernels (ROU/lease liability/depreciation) `20260809020000`. FIN-002 separation held; no complete master-lease product workflow (GAP-012). | MEDIUM | Do not reuse owner-funds logic for master-lease obligations; complete master-lease module separately. |
| F17 | Owner settlement derivation | **VERIFIED_IMPLEMENTED** | `calculate_owner_net_payout` derives gross/fee/expenses/tax/net server-side; amounts never read from payload; immutability trigger on settlement amounts (`20260725000000`). Re-derivation + stale-total rejection at approve/pay (`20260807163000`). | LOW | Retain; extend for FIXED_MONTHLY accrual basis end-to-end. |
| F18 | Settlement source reservation | **VERIFIED_IMPLEMENTED** | `owner_settlement_payment_links`/`expense_links` with partial unique active indexes (one active settlement per source), reserve via RPC, `FOR UPDATE` (`20260804010000`/`10100`). | LOW | Retain. |
| F19 | Settlement re-derivation before approval | **VERIFIED_IMPLEMENTED** | DRAFT→APPROVED→PAID; approve/pay re-derive from locked source rows and reject stale totals; reservation survives paid. | LOW | Retain. |
| F20 | Settlement snapshot at approval | **PARTIAL** | Amounts frozen by immutability trigger + reservation persists, but an explicit snapshot of agreement version / fee policy at approval is not evidenced (only `agreement_version_id`/snapshots on contract). | MEDIUM | Snapshot agreement version + fee policy + source items into the approved settlement. |
| F21 | Settlement correction | **PARTIAL** | `cancel_owner_settlement_atomic` (release, no hard delete), status CANCELLED. Paid-settlement reversal / payout correction (post-payout refund → 1300) is partial. | MEDIUM | Add governed paid-settlement reversal/re-fund path. |
| F22 | Commission / management-fee policy | **PARTIAL** | `owner_agreements.commission_type` (`RATE` | `FIXED_MONTHLY`), `commission_value`; RATE basis is collected rent (canonical preference) in `calculate_owner_net_payout`. FIXED_MONTHLY daily accrual implemented (`20260813210000`) but end-to-end wiring incomplete (FIN-006 canonical NOT_IMPLEMENTED end-to-end). | MEDIUM | Finish FIXED_MONTHLY accrual wiring; keep policy agreement-driven. |
| F23 | Expense responsibility | **MISSING (multi-party)** | `expenses.charged_to` is a single string (`OWNER/TENANT/COMPANY`); no responsibility-allocation table. Cannot represent Office 20 / Owner 70 / Tenant 10 summing to 100. | MEDIUM | Add responsibility allocations that sum exactly to expense amount. |
| F24 | Expense evidence | **PARTIAL** | `expenses`: property/category/amount/date/description/attachment_url/contract_id/charged_to/status/reference. No supplier/payee field; no explicit approval workflow on expense RPCs. | MEDIUM | Add supplier/payee + approval where required. |
| F25 | Maintenance → financial event | **PARTIAL → IMPLEMENTED_UNVERIFIED** | `resolve_maintenance_with_expense` (`20260703000000`) creates an expense linked via `expenses.ref = maintenance id` and stamps cost/status; `charged_to` on expense. Responsibility/owner-settlement/tenant-charge end-to-end open. | MEDIUM | Complete responsibility + destination chain. |
| F26 | Proportionate approvals | **PARTIAL → VERIFIED (coverage)** | Maker-checker on contract approval, owner settlement (create→approve→pay), receipt VOID, deposit claims, tax-profile activation, permission review, S08/S09. No approval on every record. Large-expense/write-off approval not explicit. | LOW | Add approval only to genuinely high-risk actions (write-off, reversal, settlement, deposit deduction, large expense, refund). |
| F27 | Server-side authority | **VERIFIED_IMPLEMENTED** | RPCs are SECURITY DEFINER with role guards (`is_admin_or_manager`, `is_accountant`), company checks (`require_company_id`, `current_company_id`), pinned `search_path`; restrictive RLS `p0_tenant_isolation`; DB0 isolation gate PASS (293 functions, no violations). | LOW | Retain; re-run inventory on release SHA. |
| F28 | Maker-checker | **PARTIAL → VERIFIED (coverage)** | `owner_settlement_maker_checker_guard` + `settlements_maker_checker_distinct_chk`; receipt-void checker `<> requester`; contract activation; deposit claims; permission review. Some high-risk ops (large expense, refund, write-off) lack maker-checker. | LOW | Add to genuinely sensitive ops only; avoid bureaucracy. |
| F29 | Mandatory reason | **PARTIAL** | Reason required for receipt VOID (`receipt_void_requests.reason`), deposit claims/refunds/deductions, settlement cancellation, S09 corrections (controlled `reason_code`). Most reasons are free-text, not a controlled code list. | MEDIUM | Add controlled reason codes where auditors need analytics. |
| F30 | Discounts / waivers / concessions | **MISSING** | No discount/waiver/concession field or RPC. No mechanism to apply a concession without rewriting the posted invoice amount (which is currently unprotected — F04). | **HIGH** | Add controlled concession/waiver linked to invoice without mutating posted history. |
| F31 | Late-fee policy | **MISSING** | No late-fee policy/table/calculation (only an `OVERDUE` status and overdue index). No hardcoded commercial rule — good default to keep policy-driven. | LOW | Add only as explicit policy/configuration if a business need exists. |
| F32 | Bank transaction matching | **IMPLEMENTED_UNVERIFIED** | `bank_accounts`, `bank_statement_imports` (`payload_digest`, status), `bank_statement_lines`, `bank_reconciliation_matches`; RPCs `preview/import_bank_statement_batch_atomic`, `process_bank_reconciliation_match_atomic`; pgTAP `bank_csv_import_fail_closed.sql` (55). Live/hosted proof external (GAP-017). | MEDIUM | Keep repo contract; require live-SHA import proof. |
| F33 | Payment recorded ≠ reconciled | **VERIFIED_IMPLEMENTED** | `payments.status` (POSTED/VOID) is separate from `bank_reconciliation_matches`; recording does not auto-reconcile. | LOW | Retain. |
| F34 | Subledger ↔ GL reconciliation | **PARTIAL** | wp05 reconciliation engine (`wp05_reconcile_all`, `wp05_assert_reconciliation`, `wp05_subledger_*`, S08 `subledger_gl_reconciliation`) reads canonical `journal_batches`. **But the live AR/collection posting path writes legacy `journal_entries`**, and AR subledger is 2dp vs GL 3dp → genuine variance risk. | **HIGH** | Unify posting onto one GL stack; align precision; reconcile AR/2000/1300/2200/2300. |
| F35 | Stable financial numbering | **VERIFIED_IMPLEMENTED** | `next_document_reference` (row-lock upsert per company/type/year), unique partial indexes `(company_id, reference)`, server BEFORE-INSERT triggers, prefixes `INV/RCT/CNT/EXP/STL`. No reuse after cancel (partial index excludes deleted). | LOW | Retain; add `CRN` if credit notes are introduced. |
| F36 | Delivery history | **IMPLEMENTED_UNVERIFIED** | `automation` (WhatsApp) + `communication` features exist; no authoritative server delivery-history ledger (timestamps of sent/printed/downloaded) found. | LOW | Deprioritize; add evidence ledger only after financial truth stable. |

### Cross-cutting requirements (explicit evaluation)

**Financial Audit Trail — PARTIAL.** `audit_log` table exists (`20250101000001`) and several RPCs write audit entries and `financial_operation_idempotency`, but there is no comprehensive DB trigger capturing before/after for every financial event (posting/payment/allocation/reversal/approval). F29 reason coverage is partial (free-text for most).

**No Hard Delete — PARTIAL.** `payments`/`expenses` direct DML revoked (`20260806000000`); receipts use `deleted_at`/VOID; settlements use CANCELLED. **`invoices` still permit ADMIN/MANAGER UPDATE/DELETE** via `manager_write_invoices` (no revoke) — a hard-delete/rewrite path remains for the most financially sensitive operational table.

**Structural Coherence — PARTIAL.** Some impossibilities are structurally prevented by design (invoice has no tenant/unit/property columns; it inherits via contract FK). Others rely on RLS/RPC, not constraints: `invoice.company_id` vs `contract.company_id`, `payment.company_id` vs `invoice.company_id`, `settlement.owner` vs source property owner, and cross-company UUID injection are blocked by restrictive RLS (`p0_tenant_isolation`) + SECURITY DEFINER revalidation (DB0 isolation gate PASS), **not** by composite FKs. Direct PostgREST updates by an admin bypass some of these only if they craft cross-company rows (blocked by RLS).

**Tenant / Company Isolation — VERIFIED at repository level.** DB0 isolation gate PASS (no violations); wp01 six-role; SECURITY DEFINER search_path pinned; `require_company_id`/`current_company_id` revalidation. Live/hosted proof external (GAP-021).

**Concurrency — PARTIAL.** 
- Invoice over-allocation (A=70, B=70 vs 100): **prevented** — `post_receipt_atomic`/`record_invoice_payment_atomic` lock the invoice row `FOR UPDATE` and check `paid + new ≤ amount+tax`.
- Deposit simultaneous refunds/deductions: **prevented** — `FOR UPDATE` on `tenant_deposits` + `remaining_amount` ceiling + idempotency.
- Owner-settlement double consumption: **prevented** — partial-unique reservation indexes + `FOR UPDATE`.
- Numbering: **prevented** — row-lock upsert.
- **Billing duplication across days: NOT prevented** — no billing-period unique guard (F02). This is the one concurrency gap that can create duplicate obligations.

**Tax configuration — VERIFIED_IMPLEMENTED.** `company_tax_profiles` (versioned), `tax_code_catalog`, `taxable_line_tax_snapshots`, `resolve_active_tax_profile`, maker-checker activation (`approve_tax_profile_atomic`), 3dp; FIN-012 satisfied; pgTAP `wp02_gap010_tax_authority.sql` (19). No hardcoded statutory rate. Versioned profile resolution (`effective_history_resolution`).

**Period close — VERIFIED_IMPLEMENTED.** `accounting_periods` OPEN/SOFT_CLOSED/HARD_CLOSED; HARD_CLOSED immutable (trigger blocks reopen); SOFT_CLOSED rejects normal posting; late events post to first open period preserving effective date (`gl_resolve_accounting_period`, `20260807173000_s03_late_posting_contract`). FIN-017 satisfied.

**Statements — PARTIAL.** `rpt_tenant_statement`, `rpt_owner_statement` exist; wp05 GL reports (`wp05_rpt_trial_balance_gl`, `balance_sheet_gl`, `profit_loss_gl`, `general_ledger_gl`, `cash_flow_gl`) derive from posted GL with reconciliation tests. Tenant/owner statements reconcile to operational subledgers; end-to-end authoritative statement covering opening/credits/allocations/closing is partial.

---

## D. Critical Defects (ranked)

| Rank | ID | Defect | Impact |
|---|---|---|---|
| **CRITICAL** | F04 | Posted invoice fields are mutable at DB level (`manager_write_invoices FOR ALL`, no immutability trigger, no revoke on `invoices`). | Historical mutation of receivable/amount/due date; destroys append-only truth. |
| **CRITICAL** | F05 | No credit note / invoice reversal / controlled adjustment. | Cannot correct an invoice without rewriting history; F30 concessions impossible. |
| **CRITICAL** | F02 | No billing-obligation identity / billing-period dedup. `generate_invoices_from_active_contracts` dedups per contract per day only. | Running generation on another day duplicates the same rent obligation → duplicate receivables. |
| **HIGH** | F14 | Due date = issue date = `current_date`, no billing_day/grace policy. | Non-deterministic, un-auditable due dates; aging/late-fee basis unreliable. |
| **HIGH** | F10/F34 | AR/collection/expense subledger is 2dp while deposits and GL are 3dp; live collection posts to legacy `journal_entries` while reconciliation reads `journal_batches`. | Exact-money divergence and subledger↔GL variance; 0.125 OMR not representable in invoices/payments. |
| **HIGH** | F30 | No discount/waiver/concession mechanism. | Can't grant concessions except by mutating posted amount (which is unprotected). |
| **MEDIUM** | F06/F12 | AR truth is cached `paid_amount`, not allocation-derived. | Cached balance can drift; only wp05 detects. |
| **MEDIUM** | F09 | `payments.reference_number` has no unique constraint. | Duplicate external payment references not DB-blocked. |
| **MEDIUM** | F07 | Financial allocation owned by receipt (`receipt_allocations`), not payment. | Semantic risk; receipt doubles as financial truth (DOM-006 concern). |
| **MEDIUM** | F23 | No multi-party expense responsibility allocation. | Cannot allocate an expense across office/owner/tenant accurately. |
| **MEDIUM** | F20 | Settlement lacks explicit agreement-version/fee-policy snapshot at approval. | Later policy drift could conceptually affect approved history. |

---

## E. Existing Strengths (do not rebuild)

1. **Canonical GL engine** (`20260804030000`–`04030200`): balanced, idempotent (`event_id` + fingerprint + advisory locks), immutable POSTED/REVERSED, company-scoped, 3dp.
2. **Period close** FIN-017 (OPEN/SOFT/HARD, HARD immutable, late-posting contract).
3. **Deposits** (GAP-009): 3dp, row locks, remaining-balance ceilings, claims/refund/application/reversal, maker-checker.
4. **Owner settlements** (P1/FA-003/S02): server derivation, source reservation (partial-unique), stale-total rejection, immutability trigger, maker-checker.
5. **Due-from-Owner** (GAP-008): separate 1300 subledger with lawful-offset gating.
6. **Tax** (GAP-010): versioned company tax profiles, per-line snapshots, maker-checker activation, 3dp, no hardcoded rate.
7. **Server-side numbering** (F35): row-lock upsert, company/year scope, unique partial indexes.
8. **Idempotency framework** (`financial_operation_idempotency` + advisory locks) across payment/deposit/settlement/receipt-void/GL.
9. **Security**: six-role + maker-checker + restrictive RLS + SECURITY DEFINER revalidation; DB0 isolation gate clean.
10. **Reconciliation & correction tooling** (wp05, S08/S09): variance diagnostics, frozen review, governed corrections — engineering complete, gated by accounting sign-off.
11. **Concurrency guards** on payment over-allocation, deposit ceilings, settlement reservation, numbering.
12. **Extensive test evidence**: 2648 app tests + migration replay + pgTAP shims.

---

## F. Canonical vs Reality Differences

| Area | Canonical (doc) | Current `main@656131da` reality | Notes |
|---|---|---|---|
| FIN-013 / OMR 3dp | Authoritative precision 3dp | **Not enforced on AR/collection/expense subledger** (`numeric(14,2)`); only deposits/GL/tax 3dp. | Canonical doc overstates coverage; governed gap **DB0-07**. |
| FIN-009/FIN-010 deposits | Document 4 baseline (8ada4e7) still lists deposit as `CONFLICT` (2dp/direct-write) | Current main **widened deposits to 3dp** with governed lifecycle and revoked legacy direct deposit/deduct writes (GAP-009). | Canonical doc **lags** current main — deposits largely resolved. |
| FIN-005/FIN-006 fees | RATE + FIXED_MONTHLY policies | RATE-on-collection wired; FIXED_MONTHLY daily accrual kernel exists but end-to-end open. | Matches doc's partial stance. |
| F02 billing identity | Not explicitly a canonical rule (implied by DOM-006/journeys) | No billing-period identity in schema. | Missing; requires new concept. |
| DOM-006 payment/receipt | Payment = cash truth, receipt = evidence | Records separated but **allocation owned by receipt**; live post via receipt RPC. | Doc intent vs runtime partially conflicting. |
| FIN-019 subledger↔GL | Reconcile to GL control accounts | Engine exists but **live posting writes legacy `journal_entries`**; wp05 reads `journal_batches`. | Runtime wiring does not yet fully satisfy canonical GL-as-truth. |
| Document 7 baseline | `main@edf57aae` (GAP-010) | `main@656131da` (post WP-06, newer) | Doc 7 is recent/current; index doc baseline `8ada4e7` is older. |

---

## G. Hidden Design Problems (beyond the checklist)

1. **Two coexisting GL stacks.** The live operational collection path (`record_invoice_payment_atomic → post_receipt_atomic`) writes to legacy **`journal_entries`**, while the canonical GL (`journal_batches`) and the wp05 reconciliation engine read **`journal_batches`**. The `gl_pm_*`/`gl_ml_*` kernels that post via `post_journal_event` are referenced only by tests/types, not the app service (`recordInvoicePaymentAtomic` → `record_invoice_payment_atomic`). This is the single most important architectural risk: the canonical "GL is truth" story is not yet the runtime collection path. Document 4 explicitly flags this baseline limit; it is confirmed here.
2. **Precision split across the money model.** Deposits/GL/tax are 3dp; invoices/payments/receipts/expenses are 2dp. Any cross-layer comparison (S08 views, wp05 reconciliation at 0.001 tolerance) can report genuine variance from rounding that no business action caused, and 0.125 OMR obligations cannot be represented.
3. **Invoice mutation surface is wide-open at DB.** `invoices` is the one sensitive table with an unrestrained `FOR ALL` write policy, and there is no immutability trigger — a silent backdoor for correcting errors by editing history, exactly what the mission prohibits.
4. **Billing is not period-aware.** Because due date = issue date = today and dedup is per-day, "generate invoices" is a same-day convenience, not a schedule. There is no way to represent a billing month, and no guard stops overlapping obligations.
5. **`paid_amount` as cached truth** plus balance tables (`contract_balances`, `owner_balances`, `tenant_balances`) are maintained by triggers and a rebuild RPC; they can drift and are only detected, not prevented, by wp05.

---

## H. Recommended Implementation Waves

This ordering preserves transactional coherence (a Wave should not be merged half-open). It is the minimum safe sequence, not a parallelization fan-out.

**Wave A — Financial Truth** (fix the AR/receivable surface first)
- Billing obligation identity + idempotent generation (F02, F09)
- Invoice immutability at DB + revoke direct DML (F04)
- Credit note / reversal / controlled adjustment (F05, F30)
- Payment-allocation as derived truth + one→many/many→one + unallocated balance (F06, F07)
- AR precision widening to 3dp (F10)
- Deterministic due dates from contract policy (F14)

**Wave B — Money Separation**
- Deposit legacy-path closeout confirmation (F08) — already largely done; audit remaining direct-write grants
- Expense responsibility allocations (F23)
- Maintenance → expense responsibility/destination (F25)
- Refund/commission ceilings where exposed (F11)

**Wave C — Owner Accounting**
- Owner-agreement fee policy snapshot into settlement at approval (F20)
- Paid-settlement reversal / payout correction (F21)
- FIXED_MONTHLY accrual end-to-end (F22)
- Owner aging/statement (F13/F15/F17 report wiring)

**Wave D — Reconciliation**
- Unify posting onto the canonical GL stack (remove legacy `journal_entries` as live path) (F34)
- Bank matching → payment → GL reconciliation (F32/F33/F34)
- Server-authoritative aging report (F13)
- Period-close enforcement over the new paths (Period Close)

**Wave E — Governance**
- Reason codes (F29), audit before/after triggers (Audit Trail)
- No-delete hardening incl. `invoices` (No Hard Delete)
- Maker-checker on the remaining sensitive ops (F28)
- Composite company-scoped FKs / structural coherence (Structural Coherence)
- Credit-note numbering `CRN` (F35)

**Wave F — Automation** (only after financial truth stable)
- WhatsApp/email/reminders + delivery-history evidence ledger (F36)

---

## I. PR Plan (per recommended implementation PR)

> Grouped by Wave; each PR is small enough to review but preserves one atomic financial invariant. **Do not split a single atomic invariant across PRs** (e.g., billing identity + generation idempotency must land together).

**PR-A1 — Billing obligation identity + idempotent recurring generation**
- Goal: stop duplicate obligations; idempotent on (contract, period, charge_type).
- Why now: F02 CRITICAL — running generation twice can duplicate receivables.
- Scope: add billing period/obligation identity to invoice or a schedule; rewrite `generate_invoices_from_active_contracts`; add unique guard.
- Likely files: `supabase/migrations/*`, `invoiceService.ts`, `generate_invoices_from_active_contracts`, generated types.
- DB impact: new column/table + unique index + function replace. Migration: **yes**.
- Security: keep SECURITY DEFINER + role/company guards.
- Tests: pgTAP duplicate-generation (concurrent + sequential); app service tests.
- Dependencies: none. What must NOT change: payment/GL behavior.
- Release gate: db0:gate + financial tests.

**PR-A2 — Invoice immutability + revoke direct DML**
- Goal: posted invoices cannot be silently mutated.
- Why now: F04 CRITICAL historical mutation.
- Scope: revoke `manager_write_invoices` insert/update/delete; add immutability trigger; add edit/credit RPC path (ties to A3).
- DB impact: grants + trigger. Migration: **yes**.
- Tests: pgTAP direct-write rejection; migration-contract tests.
- Dependencies: A3 (correction path) to avoid breaking edits.

**PR-A3 — Credit note / reversal / controlled adjustment**
- Goal: authoritative corrections without rewriting history.
- Why now: F05 CRITICAL.
- Scope: credit-note lifecycle linked to original invoice (reason/actor/timestamp/approval), net-receivable derivation.
- DB impact: credit table + RPCs + numbering `CRN`. Migration: **yes**.
- Tests: pgTAP credit/reversal; concurrency ceilings.
- Dependencies: A2. What must NOT change: no hard delete.

**PR-A4 — Allocation-derived AR truth + precision widening**
- Goal: outstanding derived from events; 3dp OMR throughout AR.
- Why now: F06/F10/F12/F34 HIGH.
- Scope: derive outstanding from posted invoice − credits − allocations; widen `invoices/payments/receipts/receipt_allocations/expenses` to `numeric(18,3)`.
- DB impact: column widening (widening-only conversion) + derivation view/RPC. Migration: **yes**.
- Tests: 3dp rounding + reconciliation tolerance; wp05 subledger.
- Dependencies: A1–A3. What must NOT change: none.

**PR-A5 — Deterministic due dates**
- Goal: due dates from contract/billing policy.
- Why now: F14 HIGH.
- Scope: add billing_day/grace to contract or agreement; derive invoice/due dates.
- DB impact: columns + generation logic. Migration: **yes**.
- Dependencies: A1.

**PR-B/C/D/E/F** — follow the same template (each carries Goal/Why now/Scope/Files/DB impact/Migration/Security/Tests/Deps/Not-changed/Gate) mapped to the F-IDs and Waves in Section H. Keep each Wave's atomic invariants within a single PR.

---

## J. Canonical Mapping

All recommended PRs map onto existing canonical structures rather than a second roadmap:

| Recommended PR | Canonical rules | Gap / WP | Existing artifacts to update |
|---|---|---|---|
| A1 (billing identity) | DOM-006, FIN-016 | new gap under GAP-002/WP-02 (idempotency) | `07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md` matrix |
| A2 (invoice immutability) | FIN-018, SEC-009 | GAP-018 (extend inventory to `invoices`) | sensitive-write boundary + traceability |
| A3 (credit/reversal) | FIN-016, FIN-018, DOM-006 | GAP-002 | traceability matrix |
| A4 (precision + derived AR) | FIN-013, FIN-019 | DB0-07 (precision boundary), GAP-013 | wp05 reconciliation + traceability |
| A5 (due dates) | FIN-017 (date determinism), OPS-007 | new gap / WP-02 | traceability |
| C (owner snapshot/reversal) | FIN-008, DOM-007 | GAP-002 | traceability |
| D (unify GL stack) | FIN-019, PRD-003 | GAP-013/021 | traceability + Document 4 |

**Roadmap adequacy:** the existing canonical pack + 23-gap register + 10-stage plan is adequate and should be updated in place (Document 7 matrix, gap register) rather than creating a competing roadmap. The one inadequacy: there is **no gap tracking the billing-obligation identity and invoice immutability/credit-note surface explicitly**; these should be added as a new gap(s) owned by one WP, consistent with the single-owner-gap discipline, before Wave A.

---

## K. Release Recommendation

> **FINANCIAL FOUNDATION PARTIAL — fix identified blockers before expansion.**

Reasoning, from repository evidence:
- The accounting core, owner-money, deposits, tax, numbering, security, period close and reconciliation tooling are genuinely hardened and verified (db0:gate 7/7, 2648/2648 tests, isolation clean, maker-checker present).
- But the **tenant-receivable/billing/invoice surface** — the most user-facing financial path — is not production-safe at the authoritative layer: posted invoices are mutable (F04), there is no credit/reversal (F05), no billing-period identity (F02), due dates are non-deterministic (F14), and the AR subledger is 2dp while GL is 3dp (F10/F34). The live collection path also still posts to legacy `journal_entries` while reconciliation reads `journal_batches` (F34 hidden issue).
- These are blockers for any expansion of the billing/collection surface. The owner-money and GL sides are close to ready; the AR side must complete Wave A before further feature expansion.

---

## L. Hard Stop

This mission ends with this report. **No fixes, migrations, redesigns, merges, or next-wave implementation were performed.** The working tree is clean at `656131da` on `arena/01a007aa-malik`. The next session should use this report to authorize and execute Wave A.

### Success-criterion answer

> **Exactly what financial truth does Malik enforce today at database level, and what can still go wrong with real money?**
> At DB level Malik today enforces, with real guarantees: a balanced, idempotent, immutable 3dp canonical GL with period close; a governed 3dp deposit subledger with row-lock ceilings and maker-checker; server-derived owner settlements with source reservation and stale-total rejection; a Due-from-Owner subledger with lawful-offset gating; versioned company tax profiles; concurrency-safe numbering; and strong RLS/company isolation + maker-checker + idempotency keys. 
> **What can still go wrong:** duplicate rent obligations across days (no billing-period identity); silent mutation/rewrite of posted invoices (no immutability, invoice direct-write still open); no way to credit or adjust an invoice without rewriting it; non-deterministic due dates; 0.125-OMR amounts unrepresentable in invoices/payments while deposits/GL use 3dp; and divergence between the live legacy `journal_entries` posting path and the canonical `journal_batches` reconciliation stack.
> **Minimum safe sequence:** Wave A (billing identity + invoice immutability + credit/reversal + allocation-derived 3dp AR + deterministic due dates), then Waves B–F as grouped in Section H — with the explicit, disciplined PR plan in Section I.
