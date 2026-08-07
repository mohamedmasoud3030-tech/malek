# 04 — Accounting (canonical)

> Consolidates all accounting logic found in the docs into one reading path. Binding texts remain the LOCKED sources listed in `03_Business_Rules.md`; for the GL platform the binding ADR is `docs/decisions/0010-stage3-general-ledger-core.md`.

## Sources merged here

| Source | What was taken |
|---|---|
| ADR 0009 (superseded) + ADR 0010 + ADR 0011 (D01–D08, D14–D17) | Accounting model & invariants |
| ADR 0003-coa, 0005, 0006 | Company-scoped account resolution doctrine |
| `docs/accounting/CANONICAL_ACCOUNTING_EVENT_SPEC_AR.md` | 30-event posting spec |
| `docs/accounting/ACCOUNTING_ACCEPTANCE_SCENARIOS_AR.md` | Numeric acceptance scenarios |
| `docs/accounting/ACCOUNTING_IMPLEMENTATION_IMPACT_MAP_AR.md` | Field/table/function impact map |
| `docs/accounting/S03_T01_GL_GAP_AUDIT.md` | Reality gap matrix (2026-08-06) |
| `docs/accounting/SETTLEMENT_ITEM_RESERVATION_DESIGN_AR.md` + OWNER_SETTLEMENT_DUPLICATION_DIAGNOSTIC | Settlement reservation design |
| `docs/DATABASE_ARCHITECTURE.md` (journal/reporting sections) | Current physical model |
| `docs/audits/PHASE3A1A/B/C`, P1 audit, PHASE2 report | Build records of resolution/derivation |
| `docs/s08/schema-mapping.md` | Physical schema mapping incl. master-lease encoding |

---

## 1. Money representation (LOCKED)

- Base currency **OMR**, storage & posting precision **3 decimals**, final rounding unit **0.001**, applied **once, server-side**. Intermediate calculations may use higher precision. The UI is never the money source of truth.
- Any older `0.01` tolerance convention is superseded for OMR. (Report-acceptance tolerance 0.01 in ADR 0003 is a *display parity* tolerance, not a posting unit.)
- ⚠️ Heritage conflict **C-03**: the Supabase project is named "RENTRIX EGY", and `docs/s08/schema-mapping.md` says "Default EGP, 2 dp" / "journal_lines EGP 2 dp". Canonical policy = OMR 3dp; S08's own runbook forbids assuming EGP. Owner clarification requested (OD-05).

## 2. Financial invariants (constitution, machine-enforced)

1. GL is the financial-statement source of truth; subledgers are the operational source of truth and must reconcile to control accounts.
2. Posted financial records are append-only; corrections use reversal batches, never delete.
3. Financial mutations are server-side, atomic, and idempotent.
4. The browser cannot post free-form journals.
5. Owner expenses are `Due from Owner`, never office expenses.
6. Owner settlements aggregate existing obligations; they never create rent/commission.
7. Tenant deposits are liabilities until contractually applied or refunded.

## 3. The canonical GL platform (ADR 0010, Stage 3)

- **`journal_batches`** — company-scoped, `DRAFT → POSTED → REVERSED`, business traceability (`source_type, source_id, event_id`), resolved `accounting_period_id`, idempotency key `UNIQUE (company_id, source_type, source_id, event_id)`.
- **`journal_lines`** — immutable; `numeric(18,3)` debit/credit (exactly one positive side), composite FKs enforcing company consistency; legacy compatibility columns preserved.
- **`journal_entries`** — now a **read-only compatibility VIEW** (`security_invoker`) so legacy reports/RPCs keep working; legacy INSERTs route through an INSTEAD OF trigger into canonical batches, but only for trusted server contexts (`postgres`/`supabase_admin`/`service_role`); browser writes are rejected.
- **`journal_entries_archive`** — frozen historical table; deterministic backfill grouped by legacy `batch_id`/event identity; unbalanced legacy groups marked DRAFT (no invented balances, no deleted history).
- **Chart of accounts** — `accounts` upgraded: `account_type, normal_balance, currency_code, precision, is_active`; global `UNIQUE(no)` replaced by `UNIQUE(company_id, no)`; `provision_company_chart_of_accounts(uuid)` (service_role) and `ensure_company_chart_of_accounts()` (ADMIN/MANAGER, JWT-derived company) idempotently provision the **18 required accounts** per company without overwriting customized names. Deleting a referenced account is blocked.
- **Accounting periods** — `OPEN/SOFT_CLOSED/HARD_CLOSED`; non-overlap per company; DELETE always rejected; direct UPDATEs only via `update_accounting_period_status`; hard-close irreversible; soft-close reopen needs reason; every change audited; server resolves late events into the first eligible open period preserving `effective_date`.
- **Posting engine** — `gl_create_journal_batch / gl_post_journal_batch / post_journal_event / reverse_journal_batch`: SECURITY DEFINER, pinned `search_path`, `service_role` only (browser roles have no EXECUTE); validation: company scope, account existence/active, one positive side, canonical round(·,3), exact balance, empty/zero/negative/two-sided line rejection, closed-period rules, idempotent retries (same event ⇒ same batch; conflicting amounts ⇒ `GL_EVENT_CONFLICT`); balance additionally enforced by DEFERRABLE constraint triggers; reversal creates an equal-and-opposite batch via `reversal_of_batch_id`, idempotent.

### Account numbers in active use / target

| No. | Use | Status |
|---|---|---|
| 1111 | Cash on hand | Live (payments, settlements, deposits, expenses all resolve it company-scoped) |
| 1112 | Bank account | Target (Target-architecture doc; bank rec uses bank tables) |
| 1201 | Tenant receivables | Live (invoice generation, payments) |
| 2000 / 2201 | Owner (funds) payable | Live as **2000** (settlement payouts); vision doc proposed **2201** — numbering conflict **C-04** |
| 2100 | VAT payable | Live (required only when VAT charged) |
| 2200 / 2301 | Tenant deposits payable | Live as **2200**; vision doc proposed **2301** — C-04 |
| 3001 | Retained earnings | Target (removed as balancing plug in PHASE2 recovery) |
| 4000 / 4101 / 4201 | Rental revenue / agency commission | Live **4000**; 4101/4201 target — C-04 |
| 6100 | Operating expenses | Live (expense & commission payouts) |
| 1600 / 2500 | ROU asset / lease liability | Introduced by S06 (master lease) via journal batches `source_type='master_lease'`; **no dedicated `master_leases` table** — master leases are `owner_agreements.agreement_type='master_lease'` (S08 schema-mapping) |

## 4. Event-level posting spec (from the 30-event spec; statuses updated to ADR 0011)

| # | Event | Posting rule (server-side, atomic, idempotent) |
|---|---|---|
| 1 | Issue PM invoice | Subledger event at issue in agency model; GL depends on `collection_role` (D01) |
| 2 | Rent collection | `Dr Cash/Bank / Cr Owner Funds Payable (OWNER_IS_CREDITOR)` or `/ Cr Tenant Receivable (OFFICE_IS_CREDITOR)`; `request_id` + payload fingerprint |
| 3 | RATE fee | At collection: `Dr Owner Funds Payable / Cr Management Fee Revenue (+ Cr VAT Payable if enabled)`; reverses with the collection |
| 4 | FIXED_MONTHLY fee | **Daily accrual over service period (D02)** — the spec's "FULL_MONTH per ADR 0004" note is superseded (C-02); no silent recalculation of history |
| 5 | Office expense | `Dr Company Expense / Cr Cash/Bank` |
| 6 | Owner expense | `Dr Due from Owner / Cr Cash/Bank`; approved offset: `Dr Owner Funds Payable / Cr Due from Owner` |
| 7 | Tenant-recoverable expense | One claim/recovery invoice; never duplicate the receivable |
| 8–12 | Deposit receive/refund/apply | Receive: `Dr Cash / Cr Tenant Deposits Payable`; refund: reverse with approval; arrears application allocates to real invoices atomically and updates their status; owner-damage: `/ Cr Owner Funds Payable` only after proving owner is economic beneficiary; office-damage: `/ Cr Damage Compensation Revenue` only if office is beneficiary per contract |
| 13–15 | Settlement draft/approve/pay | Draft: subledger only, no GL, amounts server-derived from **atomically reserved** links. Approve: re-derive from actual links; changed values bounce to review, never silently approved; do not re-create an owner liability already raised at collection. Pay: `Dr Owner Funds Payable (2000) / Cr Cash (1111)`, idempotent, never twice |
| 16–18 | Refunds around settlement | Before settlement: reverse original collection. After approval before payment: settlement goes STALE → re-derive + re-approve. After owner paid: the disbursed part becomes `Due from Owner`; never negative Owner Payable |
| 19–22 | Broker commissions | Accrual per D03 (after qualifying event + approval); pay: `Dr Broker Commissions Payable / Cr Cash/Bank` (implemented today as POSTED operating expense 6100 with balanced journals per the August consolidation); reversal append-only |
| 23–27 | Master lease | Commencement: ROU asset + lease liability; implicit rate else IBR snapshot; interest/depreciation per D07; variable payments when realized; sublease revenue separate (office as principal) |
| 28–30 | Amendments / void / late period | New version, no silent edits; VOID never deletes (linked reversal); prior-period adjustments post to first open period preserving effective date |

**Mandatory fields per financial event:** `company_id, source_type, source_id, event_id, request_id, accounting_effective_date, posting_date, accounting_period_id, currency_code, currency_precision, reversal_of_batch_id, owner_id, property_id, contract_id, invoice_id, payment_id, settlement_id`.

**General rules:** server builds journals (never the client); every batch balanced to 0.001 OMR; every operation idempotent; no direct writes to posted entries; reversals append-only; every subledger reconciles to its GL control account; no backfill before historical analysis + approval.

## 5. Settlement mathematics (P1 derivation, locked)

- **Gross collected** = posted, non-VOID, non-deleted payments for the owner's contracts via their agreements within period/company (property filter optional); master-lease collections excluded (office entitlement).
- **RATE fee** = `Σ round(payment_amount × rate/100, 3)` per payment (matches `rpt_owner_statement`).
- **FIXED_MONTHLY fee** = accrues **daily** over covered service, clipped by agreement validity (basis changed from month-count to daily by D02 — C-02).
- **Master-lease settlement** = obligation basis: `gross = commission_value × covered period`, `fee = 0` (P1), superseded by the independent S06 module for full accounting.
- **Owner expenses** = `status=POSTED`, `charged_to=OWNER`, within period, covered by `property_owners` at expense date.
- **VAT on office fee** = `round(fee × vat_rate/100, 3)` when enabled in the executing company's settings; else 0.
- **Net** = `greatest(gross − fee − expenses − tax, 0)`.
- Client-supplied amounts are ignored; write path re-derives after the idempotency guard; storage-level trigger makes amount columns immutable after insert; totals re-derived at approval and payment with stale-input rejection (FA-003 + P1 + 3A-1C).

## 6. Numeric acceptance scenarios (from the scenarios doc)

1. **Agency, 1,000 OMR invoice, 10% RATE, full collection:** office revenue 100.000; owner payable rises 1,000 on collection, −100 fee, −900 payout ⇒ 0.000; office cash +100; income statement shows 100 only (not the gross 1,000).
2. **Partial collection 400:** fee recognized on collected only = 40; invoice `partially_paid`, balance 600; owner payable from this payment 360.
3. **Mid-month fixed fee (300/month, service from day 16 of 30):** DAILY rule ⇒ 300/30 × 15 = **150.000**. (The doc also preserves the old FULL_MONTH = 300.000 case for contrast — the live default is daily; material difference = 150.000, hence explicit basis per agreement.)
4. **Owner expense 150 with 1,000 collection, 100 fee:** payable 900 − 150 ⇒ **net 750** paid.
5. **Owner expense 600 > payable 450:** `Due from Owner` 150; Owner Payable never negative; **no active collection mechanism for Due from Owner balances** (noted gap — OD-08).
6. OFFICE_IS_CREDITOR produces identical cash/net numbers but different GL structure (receivable posted at issue) and mandatory subledger↔GL reconciliation.

## 7. Reality gaps vs the canonical model (S03-T01 audit, 2026-08-06 — still true as of this consolidation)

1. **Two posting paradigms coexist.** The engine exists but **no business RPC calls it**; live postings still write through the `journal_entries` compat view (`is_legacy_compat=true`).
2. **Accounting periods are cosmetic live** — compat postings skip period resolution (`accounting_period_id = NULL`); D06's `late_posting` flag and a distinct `posting_date` column are **unimplemented**.
3. **Reversal is not engine-managed**: `void_receipt_atomic` accepts client-supplied reverse entries (`p_reverse_entries`) — directly at odds with ADR 0005's "clone originals" doctrine (conflict **C-08**, OD-02).
4. **Reports don't read the GL**: `rpt_trial_balance/income_statement/balance_sheet/cash_flow` are computed from operational subledgers — contradicts the "GL is source of truth" invariant until S07 rewiring lands (S07 kernel merged #1363, pending review).
5. Idempotency for business postings uses `financial_operation_idempotency (operation_name, request_id)` (company-namespaced keys), not the engine `event_id` key.
6. No seeding/auto-creation of the first OPEN period per company (dormant until business postings reach the engine).

**Consequence:** `04_Accounting` §§3–4 describe the *target* (locked) platform; §7 describes the *current* live wiring. S04–S07 close the gap per the 10-stage plan.

## 8. Company-scoped account resolution doctrine (0003/0005/0006 — implemented)

- `require_company_account_id(company_id, no)` — fails closed on zero/multiple matches; `ensure_company_account(...)` — serialized provisioning with `coa:<company_uuid>:<no>` IDs. Neither is exposed to browser roles; a standing pre-check repairs ensured `is_admin()` EXECUTE for authenticated chart reads.
- No client-supplied account IDs are trusted (`post_receipt_atomic` rejects foreign ones, 42501, atomic rollback).
- VOID clones the **original entry's** account IDs (structural equality) — doctrine; note implementation gap C-08.
- Idempotency/advisory keys are company-namespaced `<operation>:<company_uuid>`; `request_id` binds one immutable financial request with a canonical SHA-256 fingerprint + target; reuse with changed payload ⇒ `IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST` (22023) before any write.
- Global `UNIQUE(accounts.no)` was kept until composite uniqueness landed in Stage 3 ("3A-2"), which resolved the `ACCOUNT_NUMBER_GLOBAL_UNIQUENESS_BLOCKED` interim state.
