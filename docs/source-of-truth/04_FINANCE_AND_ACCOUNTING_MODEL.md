# MALEK Canonical Pack — Document 4: Finance and Accounting Model

> **Status:** CANONICAL  
> **Rule ID Prefix:** FIN-###  
> **Effective Date:** 2026-08-10

---

## 1. Accounting Model Overview

### 1.1 Agent vs. Principal Treatment

**FIN-101 — OWNER_IS_CREDITOR (Agent Model)**

| Element | Treatment |
|---------|-----------|
| Tenant Receivable | Tracked in operational subledger, not office GL |
| Rent Collection | Dr Cash/Bank → Cr Owner Funds Payable (2000) |
| Management Fee | Dr Owner Funds Payable → Cr Management Fee Revenue (4100) |
| Office Revenue | Recognized on collection (RATE) or daily accrual (FIXED_MONTHLY) |

**FIN-102 — OFFICE_IS_CREDITOR (Principal Model)**

| Element | Treatment |
|---------|-----------|
| Tenant Receivable | Posted to GL: Dr Tenant Receivable (1201) |
| Rent Collection | Dr Cash/Bank → Cr Tenant Receivable (1201) |
| Rental Revenue | Posted at invoice: Dr Tenant Receivable → Cr Rental Revenue (4000) |
| Office as Principal | Recognizes full rent as revenue |

**FIN-103 — MASTER_LEASE Separation**

Master lease is a **separate principal model** with its own accounting module:
- **NOT** merged with owner settlement accounts
- ROU Asset (1600) and Lease Liability (2500) tracked separately
- Sublease rent tracked independently from head-lease payments

---

## 2. Chart of Accounts

### 2.1 Canonical Account Structure

**FIN-201 — Required Accounts per Company**

The system seeds 18 required accounts per company:

| Account No | Name | Type | Normal Balance |
|------------|------|------|----------------|
| 1111 | Cash on Hand | Asset | Debit |
| 1201 | Tenant Receivables | Asset | Debit |
| 1205 | Due from Owners | Asset | Debit |
| 1600 | Right-of-Use Asset | Asset | Debit |
| 2000 | Owner Funds Payable | Liability | Credit |
| 2100 | VAT Payable | Liability | Credit |
| 2200 | Tenant Deposits Payable | Liability | Credit |
| 2500 | Lease Liability | Liability | Credit |
| 3001 | Retained Earnings | Equity | Credit |
| 4000 | Rental Revenue | Revenue | Credit |
| 4100 | Management Fee Revenue | Revenue | Credit |
| 4200 | Commission Revenue | Revenue | Credit |
| 4300 | Damage Compensation Revenue | Revenue | Credit |
| 6100 | Operating Expenses | Expense | Debit |
| 6200 | Administrative Expenses | Expense | Debit |
| 6300 | Utility Expenses | Expense | Debit |
| 6400 | Depreciation Expense | Expense | Debit |

**Note:** Account numbers 1112 (Bank), 1120, 1300, 2300, 6110, 6200, 6300 may exist in code but canonical numbers are as above.

**FIN-202 — Account Attributes**

Each account carries:
- `company_id`: Scoped to company
- `account_type`: asset/liability/equity/revenue/expense
- `normal_balance`: debit/credit
- `currency_code`: OMR (locked for pilot)
- `precision`: 3 decimal places

---

## 3. Journal Entries

### 3.1 Journal Batch Lifecycle

**FIN-301 — Batch States**

```
DRAFT → POSTED → REVERSED
```

- **DRAFT:** Entries editable; not yet committed
- **POSTED:** Entries immutable; part of financial history
- **REVERSED:** Original batch voided; reversal batch linked

**FIN-302 — Batch Attributes**

- `company_id`: Company boundary
- `status`: DRAFT/POSTED/REVERSED
- `source_type`: invoice/receipt/expense/settlement/manual
- `source_id`: Reference to source document
- `event_id`: Unique event identifier for idempotency
- `effective_date`: Original business date
- `posting_date`: GL posting date
- `late_posting`: Boolean flag for late events
- `reversal_of_batch_id`: Link to reversed batch (if any)

**FIN-303 — Journal Line Attributes**

- `account_id`: Target account
- `debit`: Debit amount (positive or null)
- `credit`: Credit amount (positive or null)
- `line_description`: Line description
- `ref_source_id`: Source document ID
- `ref_entity_type`: Source entity type
- `ref_entity_id`: Source entity ID

---

## 4. Event-to-Accounting Mappings

### 4.1 Invoice Events

**FIN-401 — Invoice Issuance (OFFICE_IS_CREDITOR)**

| Field | Value |
|-------|-------|
| Preconditions | Contract active, invoice not voided |
| Debit | 1201 Tenant Receivables |
| Credit | 4000 Rental Revenue |
| Credit | 2100 VAT Payable (if applicable) |
| Source Record | `invoices` |
| Reversal Method | VOID creates balanced reversal batch |
| Status | IMPLEMENTED_UNVERIFIED (GL wiring in progress) |

**FIN-402 — Invoice Issuance (OWNER_IS_CREDITOR)**

| Field | Value |
|-------|-------|
| Preconditions | Contract active, OWNER_IS_CREDITOR |
| Debit | None |
| Credit | None |
| Source Record | `invoices` (operational only, not GL) |
| Reversal Method | N/A (operational tracking) |
| Status | PARTIAL (subledger tracking exists) |

---

### 4.2 Collection Events

**FIN-411 — Rent Collection (OFFICE_IS_CREDITOR)**

| Field | Value |
|-------|-------|
| Preconditions | Invoice exists, payment received |
| Debit | 1111/1112 Cash/Bank |
| Credit | 1201 Tenant Receivables |
| Source Record | `receipts` + `receipt_allocations` |
| Reversal Method | VOID creates balanced reversal |
| Status | IMPLEMENTED_UNVERIFIED (GL wiring in progress) |

**FIN-412 — Rent Collection (OWNER_IS_CREDITOR)**

| Field | Value |
|-------|-------|
| Preconditions | Contract active, OWNER_IS_CREDITOR |
| Debit | 1111/1112 Cash/Bank |
| Credit | 2000 Owner Funds Payable |
| Source Record | `receipts` |
| Reversal Method | VOID creates balanced reversal |
| Status | IMPLEMENTED_UNVERIFIED (GL wiring in progress) |

---

### 4.3 Fee Recognition Events

**FIN-421 — Management Fee (RATE on Collection)**

| Field | Value |
|-------|-------|
| Preconditions | Collection posted, RATE commission type |
| Debit | 2000 Owner Funds Payable |
| Credit | 4100 Management Fee Revenue |
| Credit | 2100 VAT Payable (if applicable) |
| Source Record | `owner_settlements` |
| Reversal Method | Settlement reversal or adjustment |
| Status | NOT_IMPLEMENTED (S04-T06/T07 planned) |

**FIN-422 — Management Fee (FIXED_MONTHLY Daily Accrual)**

| Field | Value |
|-------|-------|
| Preconditions | Agreement active, FIXED_MONTHLY type |
| Journal | Daily: Dr 2000 Owner Funds Payable → Cr 4100 |
| Basis | Prorated daily: fee / days_in_month |
| Source Record | `accounting_periods` accrual entries |
| Reversal Method | Period adjustment |
| Status | NOT_IMPLEMENTED (S04-T08 planned) |

**FIN-423 — Brokerage Commission**

| Field | Value |
|-------|-------|
| Preconditions | Signed contract activated |
| Debit | 6110 Broker Commission Expense |
| Credit | 2300 Broker Commissions Payable |
| Recognition | On activation, not before |
| Source Record | `commissions` |
| Reversal Method | Cancellation or adjustment |
| Status | NOT_IMPLEMENTED (S05-T05 planned) |

---

### 4.4 Expense Events

**FIN-431 — Owner Expense Booking**

| Field | Value |
|-------|-------|
| Preconditions | Expense incurred on owner's behalf |
| Debit | 1205 Due from Owners |
| Credit | 1111/1112 Cash/Bank |
| Source Record | `expenses` |
| Constraint | **NOT** posted to 6100 Operating Expenses |
| Status | IMPLEMENTED_UNVERIFIED (basic exists) |

**FIN-432 — Office Expense Booking**

| Field | Value |
|-------|-------|
| Preconditions | Expense is office responsibility |
| Debit | 6100 Operating Expenses |
| Credit | 1111/1112 Cash/Bank |
| Source Record | `expenses` |
| Status | IMPLEMENTED_UNVERIFIED (basic exists) |

**FIN-433 — Owner Expense Offset**

| Field | Value |
|-------|-------|
| Preconditions | Agreement grants offset right; payable sufficient |
| Journal | Dr 2000 Owner Payables → Cr 1205 Due from Owners |
| Order | Owner expenses → Fees/Tax → Reserve → Payout |
| Constraint | Owner Payables must never go negative |
| Status | NOT_IMPLEMENTED (S04-T09 planned) |

---

### 4.5 Deposit Events

**FIN-441 — Tenant Deposit Receipt**

| Field | Value |
|-------|-------|
| Preconditions | Deposit received from tenant |
| Debit | 1111 Cash on Hand |
| Credit | 2200 Tenant Deposits Payable |
| Source Record | `deposits` |
| Constraint | **Never** recognized as revenue |
| Status | IMPLEMENTED_UNVERIFIED (basic exists) |

**FIN-442 — Deposit Application to Arrears**

| Field | Value |
|-------|-------|
| Preconditions | Approved invoice, evidence, allocation |
| Debit | 2200 Tenant Deposits Payable |
| Credit | 1201 Tenant Receivables (or 1205 if owner damage) |
| Source Record | `deposit_transactions` |
| Constraint | Atomic transaction; evidence required |
| Status | NOT_IMPLEMENTED (S05-T02 planned) |

**FIN-443 — Deposit Refund**

| Field | Value |
|-------|-------|
| Preconditions | Contract ended, no claims, final inspection |
| Debit | 2200 Tenant Deposits Payable |
| Credit | 1111 Cash on Hand |
| Source Record | `deposit_transactions` |
| Constraint | Requires payment-out event |
| Status | NOT_IMPLEMENTED (S05-T02 planned) |

---

### 4.6 Settlement Events

**FIN-451 — Owner Settlement Payout**

| Field | Value |
|-------|-------|
| Preconditions | Settlement approved, payout executed |
| Debit | 2000 Owner Funds Payable |
| Credit | 1111/1112 Cash/Bank |
| Source Record | `owner_settlements` |
| Status | IMPLEMENTED_UNVERIFIED (basic exists) |

**FIN-452 — Due from Owner Creation (Post-Payment Refund)**

| Field | Value |
|-------|-------|
| Preconditions | Refund after settlement payment |
| Debit | 1205 Due from Owners |
| Credit | 2000 Owner Funds Payable |
| Source Record | `owner_settlements` + refund |
| Constraint | Owner Payables never go negative |
| Status | NOT_IMPLEMENTED (ADR 0015; planned) |

---

### 4.7 Void Events

**FIN-461 — Receipt Void**

| Field | Value |
|-------|-------|
| Preconditions | Receipt exists, not already voided, reason provided |
| Journal | Balanced reversal of original receipt batch |
| Effect | Invoice restored to unpaid/partially_paid |
| Reversal Method | New REVERSED batch with link to original |
| Idempotency | Request ID prevents duplicate voids |
| Status | IMPLEMENTED_UNVERIFIED (void exists; GL wiring in progress) |

**FIN-462 — Invoice Void**

| Field | Value |
|-------|-------|
| Preconditions | Invoice not fully paid |
| Effect | Cancel invoice; no GL entry if unpaid |
| If Paid | Create reversal for related receipts first |
| Status | IMPLEMENTED_UNVERIFIED (basic exists) |

---

## 5. Period Management

### 5.1 Period States

**FIN-501 — Period Lifecycle**

```
OPEN → SOFT_CLOSED → HARD_CLOSED
        ↺ (reopen with audit log)
```

| State | Normal Postings | Adjusting Entries | Hard Postings |
|-------|-----------------|-------------------|---------------|
| OPEN | ✓ Allowed | ✓ Allowed | ✓ Allowed |
| SOFT_CLOSED | ✗ Blocked | ✓ Allowed | ✗ Blocked |
| HARD_CLOSED | ✗ Blocked | ✗ Blocked | ✗ Blocked |

**FIN-502 — Late Posting**

Events occurring after close:
1. Route to first open period
2. Preserve `effective_date` (original business date)
3. Set `late_posting = true`
4. Set `posting_date` to current period

**FIN-503 — Period Attributes**

- `company_id`: Company boundary
- `start_date`, `end_date`: Period bounds
- `status`: OPEN/SOFT_CLOSED/HARD_CLOSED
- `closed_by`: User who closed
- `closed_at`: Timestamp
- `reopen_reason`: Reason for reopening (if applicable)

---

## 6. Currency and Rounding

**FIN-601 — OMR Precision**

- All monetary values: exactly **3 decimal places**
- Example: `1,250.500` OMR

**FIN-602 — Rounding Rules**

- Bank-standard rounding: `round(value, 3)`
- Performed **server-side only**
- Frontend never performs rounding for ledger insertion

**FIN-603 — Display**

- Latin numerals (`-u-nu-latn`) for alignment
- Currency tag: `ر.ع.`
- Tabular numerals for tables

---

## 7. GL to Subledger Reconciliation

**FIN-701 — Reconciliation Requirement**

Every financial period requires reconciliation:
1. Subledger totals vs. GL control account totals
2. Zero difference required for release
3. Differences logged and resolved before close

**FIN-702 — Control Accounts**

| Control Account | Subledger |
|-----------------|-----------|
| 1201 Tenant Receivables | Invoices, Receipts, Allocations |
| 2000 Owner Funds Payable | Collections, Settlements, Fees |
| 1205 Due from Owners | Owner Expenses, Offsets |
| 2200 Tenant Deposits Payable | Deposits, Transactions |

---

## 8. Master Lease Accounting

**FIN-801 — Scope**

Master lease accounting is a **separate module**, NOT merged with owner-agency settlement.

**FIN-802 — Initial Measurement at Commencement**

| Element | Treatment |
|---------|-----------|
| ROU Asset | Dr 1600 Right-of-Use Asset |
| Lease Liability | Cr 2500 Lease Liability |
| Discount Rate | Implicit rate or IBR (snapshot at commencement) |

**FIN-803 — Subsequent Measurement**

| Element | Treatment |
|---------|-----------|
| Lease Liability | Effective interest method |
| ROU Asset | Straight-line depreciation |
| Variable Payments | Expense when incurred |

**FIN-804 — Modifications**

- Scope increase at standalone price → separate lease
- Other modifications → remeasure liability, adjust ROU

**FIN-805 — Short-term Election**

- 12-month maximum original term
- No purchase option
- Company-level, asset-class-level election

**FIN-806 — Vacancy Treatment**

- Sublease rent: separate revenue posting
- Vacancy loss: office bears risk, exposed in results

**FIN-807 — Account Restrictions**

- Owner settlement accounts (2000) **never used** for master lease
- Separate accounts for ROU, liability, depreciation, interest

**FIN-808 — Implementation Status**

NOT_IMPLEMENTED. Schema kernel merged (S06); full modifier modules unwritten.

---

## 9. VAT Treatment

**FIN-901 — Tax Profile**

- No hard-coded statutory rate in code
- Company-level tax profile with versioned tax codes
- Each line item snapshots: `tax_code_id`, rate, basis, amount, inclusive/exclusive

**FIN-902 — Line-Level Snapshots**

Every taxable line records:
- `tax_code_id`: FK to tax codes
- `tax_rate`: Snapshot of rate
- `tax_basis`: Amount before tax
- `tax_amount`: Calculated tax
- `tax_inclusive`: Boolean

**FIN-903 — Posting Controls**

- Draft allowed with incomplete tax profile
- **Blocked:** Posting any taxable document without complete profile

---

## 10. Idempotency and Traceability

**FIN-1001 — Event ID**

Every journal event carries:
- `company_id`
- `source_type` (invoice/receipt/expense/settlement)
- `source_id` (document ID)
- `event_id` (unique per event)

**FIN-1002 — Idempotency Table**

`financial_operation_idempotency` prevents duplicate postings:
- Stores request fingerprint
- Rejects duplicates with SQLSTATE 22023

**FIN-1003 — Source Traceability**

Every journal line links to:
- `ref_source_id`: Original document
- `ref_entity_type`: Entity type
- `ref_entity_id`: Entity ID

---

## 11. Implementation Status Summary

| Accounting Event | Status | Evidence |
|-----------------|--------|----------|
| Invoice Posting (OFFICE_IS_CREDITOR) | NOT_IMPLEMENTED | GL wiring not wired |
| Collection Posting (OWNER_IS_CREDITOR) | IMPLEMENTED_UNVERIFIED | Basic exists |
| Collection Posting (OFFICE_IS_CREDITOR) | NOT_IMPLEMENTED | GL wiring not wired |
| Management Fee (RATE) | NOT_IMPLEMENTED | S04-T06 planned |
| Management Fee (FIXED_MONTHLY) | NOT_IMPLEMENTED | S04-T08 planned |
| Owner Expense | IMPLEMENTED_UNVERIFIED | Basic exists |
| Deposit Receipt | IMPLEMENTED_UNVERIFIED | Basic exists |
| Deposit Application | NOT_IMPLEMENTED | S05-T02 planned |
| Owner Settlement | IMPLEMENTED_UNVERIFIED | Basic exists |
| Receipt Void | IMPLEMENTED_UNVERIFIED | Void exists; GL wiring partial |
| Period Management | IMPLEMENTED_UNVERIFIED | Schema exists |
| Master Lease | NOT_STARTED | S06 not started |

---

## Cross-References

- **D01-D18:** `docs/decisions/0011-final-business-accounting-and-operating-policies.md`
- **Arabic Constitution:** `docs/business/CANONICAL_BUSINESS_AND_CONTRACT_RULES_AR.md`
- **Stage 3 GL:** `supabase/migrations/20260804030000_stage3_gl_core_chart_of_accounts_and_periods.sql`
- **Traceability:** `07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`
- **Execution Plan:** `governance/10-stage-master-plan.json`
