# Phase 2: Double-Entry Accounting Completion — Findings & Plan

**Status:** READ-ONLY AUDIT COMPLETE — PLAN ONLY — AWAITING APPROVAL  
**Date:** 2026-07-13  
**Prerequisite:** Phase 1 confirmed on origin/main (commit `a2847734`)

---

## Section 1: Phase 1 Closure Verification

### Findings CLOSED by Phase 1 ✅

| ID | Finding | Phase 1 Migration | Status |
|----|---------|-------------------|--------|
| A-04 | `contract_balances` CASCADE → RESTRICT | `20260713000001` | ✅ CLOSED |
| A-04 | `owner_balances` CASCADE → RESTRICT | `20260713000002` | ✅ CLOSED |
| A-05 | `receipt_allocations` CASCADE → RESTRICT | `20260713000003` | ✅ CLOSED |
| S-01 | `rpt_owner_statement` SECURITY DEFINER | `20260713000006` | ✅ CLOSED |
| S-01 | `rpt_tenant_statement` SECURITY DEFINER | `20260713000006` | ✅ CLOSED |
| S-02 | `create_expense_with_journal_atomic` role check | `20260713000004` | ✅ CLOSED |
| S-03 | Direct expense update bypass | `20260713000007` + frontend | ✅ CLOSED |
| S-04 | `void_receipt_atomic(jsonb)` anon grant | `20260713000005` | ✅ CLOSED |
| A-02 | Journal batch balance infrastructure | `20260713000008` | ✅ CLOSED (foundation) |

**9 of 35 original findings closed.**

---

## Section 2: Open Findings After Phase 1

### 2.1 CRITICAL / HIGH (Must Fix)

| ID | Finding | Severity | Evidence |
|----|---------|----------|----------|
| **A-01** | No journal entry for invoice creation | **HIGH** | `generate_invoices_from_active_contracts()` has zero references to `journal_entries`. Revenue (Cr) and AR (Dr) are never recorded. |
| **A-01b** | No payment_cycle awareness in invoice generation | **HIGH** | Function generates daily for all active contracts regardless of monthly/quarterly/annual cycle. Will create duplicate invoices if called multiple times in a billing period. |
| **A-01c** | No locking / race condition in invoice generation | **MEDIUM** | `NOT EXISTS` dedup check is not protected by `FOR UPDATE` or unique constraint. Concurrent calls can create duplicates. |
| **A-03** | `contract_balances` not trigger-maintained | **HIGH** | Zero triggers on `contract_balances`. Only refreshed by `recalculate_all_balances()` (manual/cron). Stale between runs. |
| **A-06** | `rpt_cash_flow` includes VOID payments | **HIGH** | `SUM(amount) FROM payments WHERE deleted_at IS NULL` — no VOID filter. Overstates collections. |
| **D-01** | `contracts.status` mixed-case enum | **HIGH** | CHECK allows `('draft', 'active', 'expired', 'terminated', 'ENDED', 'ACTIVE')`. Code uses `lower(status)` in some places, `status = 'ACTIVE'` in others. |
| **D-06** | Duplicate `soft_delete_contract_atomic` overloads | **HIGH** | `uuid` overload (20260712000000) lacks financial guards. `text` overload (20260712010000) has them. PostgreSQL may resolve wrong overload. |

### 2.2 MEDIUM

| ID | Finding | Severity | Evidence |
|----|---------|----------|----------|
| **A-07** | `rpt_vat_return` includes VOID/CANCELLED invoices | **MEDIUM** | No status filter. Inflates VAT liability. |
| **D-02** | `invoices.status` no CHECK constraint | **MEDIUM** | `status text not null default 'UNPAID'` — accepts any string. |
| **D-03** | `receipts.status` no CHECK constraint | **MEDIUM** | Accepts any string. Should be `('POSTED', 'VOID')`. |
| **D-09** | No unique constraint for invoice dedup | **MEDIUM** | Race condition in `generate_invoices`. |
| **D-10** | `property_owners.property_id` CASCADE | **MEDIUM** | Hard-delete destroys ownership history. |
| **S-05** | Bank reconciliation `app_private` schema | **MEDIUM** | 4 RLS policies use `app_private.is_app_user()` instead of `public.is_app_user()`. |
| **D-07** | `recalculate_all_balances` DELETE+INSERT | **MEDIUM** | Risky pattern. Should use UPSERT. |
| **A-09** | Trial Balance plug-based | **MEDIUM** | Always reports balanced. Cannot detect errors. |

### 2.3 NOT IN SCOPE for Phase 2

| ID | Finding | Reason |
|----|---------|--------|
| S-06 | Organization isolation | Explicitly deferred — requires multi-tenant design decisions |
| P-01 | Client-side report aggregation | Phase 3 scope — performance, not correctness |
| P-02 | N+1 receipt hydration | Phase 3 scope |
| P-03 | Balance reconciliation full scan | Phase 3 scope |
| D-05 | `owner_agreements.property_id` type mismatch | Low risk — implicit cast works, needs design decision |

---

## Section 3: Phase 2 Plan — Double-Entry Accounting Completion

### Wave 1: Invoice Journal Entries + Payment Cycle (3 migrations)

#### Migration 1: Seed Revenue Account
**File:** `20260714000001_seed_revenue_account.sql`  
**Scope:** Database only  
**Purpose:** Add `4000 = Rental Revenue` to chart of accounts (required for invoice journal entries)

**What it does:**
- INSERT account `4000` (Rental Revenue) if not exists
- INSERT account `1201` (Tenant Receivables) if not exists (already seeded, defensive)
- Validates both accounts exist post-insert

**Risk:** LOW — additive only  
**Rollback:** DELETE FROM accounts WHERE id IN ('4000')

---

#### Migration 2: Rewrite `generate_invoices_from_active_contracts`
**File:** `20260714000002_hardened_invoice_generation.sql`  
**Scope:** Database only  
**Purpose:** Fix A-01 (journal entries), A-01b (payment_cycle), A-01c (locking), D-09 (dedup)

**What it does:**
1. **Payment cycle awareness:**
   - Monthly: generate if no invoice for current month
   - Quarterly: generate if no invoice for current quarter
   - Semi-annual: generate if no invoice for current 6-month period
   - Annual: generate if no invoice for current year
2. **Journal entries:** For each invoice created:
   - DEBIT `1201` (Tenant Receivables) for `amount + tax_amount`
   - CREDIT `4000` (Rental Revenue) for `amount`
   - CREDIT `2100` (VAT Payable) for `tax_amount` (if tax > 0)
3. **Advisory lock:** `pg_advisory_xact_lock` on contract_id to prevent race conditions
4. **Unique partial index:** `ON invoices (contract_id, issue_date) WHERE deleted_at IS NULL`
5. **Batch tracking:** Uses `batch_id` from Phase 1D for journal entries
6. **Audit log:** Records how many invoices were generated

**Risk:** MEDIUM — rewrites core financial function  
**Rollback:** CREATE OR REPLACE with original function body (preserved in migration comment)  
**Frontend impact:** None — `invoiceService.ts` already calls this RPC

---

#### Migration 3: Contract Balances Triggers
**File:** `20260714000003_contract_balances_triggers.sql`  
**Scope:** Database only  
**Purpose:** Fix A-03 — maintain `contract_balances` incrementally

**What it does:**
1. **Trigger on `invoices` (INSERT/UPDATE/DELETE):**
   - Recalculates `total_invoiced` for the affected contract
   - Updates `balance_due = total_invoiced - total_paid`
2. **Trigger on `receipt_allocations` (INSERT/DELETE):**
   - Recalculates `total_paid` for the affected contract (via invoice → contract)
   - Updates `balance_due = total_invoiced - total_paid`
3. **Upsert pattern:** Uses `INSERT ... ON CONFLICT DO UPDATE` to create balance row if missing
4. **Backfill:** Runs initial backfill for all existing contracts

**Risk:** MEDIUM — adds trigger overhead to invoice/payment paths  
**Rollback:** DROP TRIGGER + DROP FUNCTION  
**Frontend impact:** None

---

### Wave 2: Report Accuracy (3 migrations)

#### Migration 4: Fix `rpt_cash_flow` VOID Filter
**File:** `20260714000004_fix_rpt_cash_flow_void_filter.sql`  
**Scope:** Database only  
**Purpose:** Fix A-06

**What it does:**
- Adds `AND COALESCE(UPPER(status), 'POSTED') <> 'VOID'` to payment filter
- Preserves all other logic

**Risk:** LOW  
**Rollback:** CREATE OR REPLACE with original body

---

#### Migration 5: Fix `rpt_vat_return` VOID/CANCELLED Filter
**File:** `20260714000005_fix_rpt_vat_return_void_filter.sql`  
**Scope:** Database only  
**Purpose:** Fix A-07

**What it does:**
- Adds `AND COALESCE(UPPER(status), '') NOT IN ('VOID', 'CANCELLED')` to invoice filter
- Preserves all other logic

**Risk:** LOW  
**Rollback:** CREATE OR REPLACE with original body

---

#### Migration 6: Enhance `rpt_financial_summary` Status Freshness
**File:** `20260714000006_fix_rpt_financial_summary_status.sql`  
**Scope:** Database only  
**Purpose:** Fix A-08

**What it does:**
- Overdue calculation: uses `due_date < current_date AND status IN ('UNPAID', 'PARTIALLY_PAID')` (removes redundant 'OVERDUE' check)
- Adds VOID filter to collected total (defensive — already correct but explicit)

**Risk:** LOW  
**Rollback:** CREATE OR REPLACE with original body

---

### Wave 3: Schema Constraints (4 migrations)

#### Migration 7: Standardize `contracts.status`
**File:** `20260714000007_standardize_contract_status.sql`  
**Scope:** Database only  
**Purpose:** Fix D-01

**What it does:**
1. **Normalize existing data:** `UPDATE contracts SET status = lower(status) WHERE status <> lower(status)`
2. **Drop old CHECK constraint**
3. **Add new CHECK:** `status IN ('draft', 'active', 'expired', 'terminated')`
4. **Update RPCs:** `renew_contract_atomic`, `terminate_contract_atomic`, `soft_delete_contract_atomic` to use lowercase only

**Risk:** MEDIUM — data normalization + constraint change  
**Rollback:** Reverse UPDATE + restore old CHECK  
**Frontend impact:** None — frontend already uses lowercase values

---

#### Migration 8: Add CHECK Constraints on Status Columns
**File:** `20260714000008_add_status_check_constraints.sql`  
**Scope:** Database only  
**Purpose:** Fix D-02, D-03

**What it does:**
- `invoices.status`: `CHECK (status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID', 'CANCELLED'))`
- `receipts.status`: `CHECK (status IN ('POSTED', 'VOID'))`
- `payments.status`: `CHECK (status IN ('POSTED', 'VOID'))` (defensive addition)

**Risk:** LOW — additive constraints  
**Rollback:** ALTER TABLE DROP CONSTRAINT

---

#### Migration 9: Fix `property_owners` CASCADE + Unique Index for Invoices
**File:** `20260714000009_fix_property_owners_cascade_and_invoice_dedup.sql`  
**Scope:** Database only  
**Purpose:** Fix D-10, D-09

**What it does:**
1. `property_owners.property_id`: CASCADE → RESTRICT
2. `invoices`: Add `CREATE UNIQUE INDEX invoices_contract_issue_date_unique ON invoices (contract_id, issue_date) WHERE deleted_at IS NULL`

**Risk:** LOW  
**Rollback:** Reverse constraint + DROP INDEX

---

#### Migration 10: Drop Stale `soft_delete_contract_atomic(uuid)` Overload
**File:** `20260714000010_drop_stale_soft_delete_contract_uuid_overload.sql`  
**Scope:** Database only  
**Purpose:** Fix D-06

**What it does:**
- `DROP FUNCTION IF EXISTS public.soft_delete_contract_atomic(uuid)`
- Preserves the `text` overload which has full financial guards
- Verifies frontend calls resolve to `text` overload

**Risk:** LOW — removes dead code  
**Rollback:** Re-create from migration `20260712000000`

---

### Wave 4: RLS & Cleanup (2 migrations)

#### Migration 11: Fix Bank Reconciliation RLS Schema Qualification
**File:** `20260714000011_fix_bank_reconciliation_rls_schema.sql`  
**Scope:** Database only  
**Purpose:** Fix S-05

**What it does:**
- Drop and recreate 4 RLS policies on bank reconciliation tables
- Replace `app_private.is_app_user()` with `public.is_app_user()`

**Risk:** LOW — schema qualification fix  
**Rollback:** Recreate policies with `app_private`

---

#### Migration 12: Improve `recalculate_all_balances` (UPSERT Pattern)
**File:** `20260714000012_improve_recalculate_all_balances_upsert.sql`  
**Scope:** Database only  
**Purpose:** Fix D-07

**What it does:**
- Replace `DELETE ... WHERE true` + `INSERT` with `INSERT ... ON CONFLICT DO UPDATE`
- Preserves all calculation logic
- Adds `WHERE` clause to skip contracts with no invoices (optimization)

**Risk:** LOW — same result, safer pattern  
**Rollback:** Restore original function body

---

## Section 4: Migration Summary

| # | Migration | Wave | Scope | Risk | Frontend? |
|---|-----------|------|-------|------|-----------|
| 1 | `seed_revenue_account` | 1 | DB only | LOW | No |
| 2 | `hardened_invoice_generation` | 1 | DB only | MEDIUM | No |
| 3 | `contract_balances_triggers` | 1 | DB only | MEDIUM | No |
| 4 | `fix_rpt_cash_flow_void_filter` | 2 | DB only | LOW | No |
| 5 | `fix_rpt_vat_return_void_filter` | 2 | DB only | LOW | No |
| 6 | `fix_rpt_financial_summary_status` | 2 | DB only | LOW | No |
| 7 | `standardize_contract_status` | 3 | DB only | MEDIUM | No |
| 8 | `add_status_check_constraints` | 3 | DB only | LOW | No |
| 9 | `fix_property_owners_cascade_and_invoice_dedup` | 3 | DB only | LOW | No |
| 10 | `drop_stale_soft_delete_contract_uuid_overload` | 3 | DB only | LOW | No |
| 11 | `fix_bank_reconciliation_rls_schema` | 4 | DB only | LOW | No |
| 12 | `improve_recalculate_all_balances_upsert` | 4 | DB only | LOW | No |

**Total: 12 migrations, ALL database-only, ZERO frontend changes required.**

---

## Section 5: Findings Addressed by Phase 2

| ID | Finding | Phase 2 Migration | Status After Phase 2 |
|----|---------|-------------------|---------------------|
| A-01 | No journal entry for invoices | #1 + #2 | ✅ CLOSED |
| A-01b | No payment_cycle awareness | #2 | ✅ CLOSED |
| A-01c | No locking in invoice generation | #2 + #9 | ✅ CLOSED |
| A-03 | `contract_balances` stale | #3 | ✅ CLOSED |
| A-06 | `rpt_cash_flow` VOID filter | #4 | ✅ CLOSED |
| A-07 | `rpt_vat_return` VOID filter | #5 | ✅ CLOSED |
| A-08 | `rpt_financial_summary` status | #6 | ✅ CLOSED |
| D-01 | `contracts.status` mixed-case | #7 | ✅ CLOSED |
| D-02 | `invoices.status` no CHECK | #8 | ✅ CLOSED |
| D-03 | `receipts.status` no CHECK | #8 | ✅ CLOSED |
| D-06 | Duplicate `soft_delete_contract_atomic` | #10 | ✅ CLOSED |
| D-07 | `recalculate_all_balances` DELETE+INSERT | #12 | ✅ CLOSED |
| D-09 | No unique index for invoice dedup | #9 | ✅ CLOSED |
| D-10 | `property_owners` CASCADE | #9 | ✅ CLOSED |
| S-05 | Bank reconciliation `app_private` | #11 | ✅ CLOSED |

**15 findings closed. Combined with Phase 1 (9 closed) = 24 of 35 total findings resolved.**

**Remaining after Phase 2 (11 findings):**
- S-06: Organization isolation (deferred — multi-tenant design)
- A-09: Trial Balance plug-based (documented limitation)
- D-04: `payments.payment_method` no CHECK (LOW)
- D-05: `owner_agreements.property_id` type mismatch (needs design decision)
- D-08: `payments` NULL+CHECK dual constraint (informational)
- P-01: Client-side report aggregation (Phase 3)
- P-02: N+1 receipt hydration (Phase 3)
- P-03: Balance reconciliation full scan (Phase 3)
- P-05: JavaScript `number` for financial math (LOW)
- DOC-01 through DOC-05: Documentation drift (ongoing)

---

## Section 6: Accounting Flow After Phase 2

### Invoice Creation (After Phase 2)
```
generate_invoices_from_active_contracts()
  │
  ├─→ Advisory lock per contract
  ├─→ Payment cycle check (monthly/quarterly/semi-annual/annual)
  ├─→ Unique index prevents duplicates at DB level
  ├─→ INSERT invoices
  ├─→ INSERT journal_entries:
  │     DEBIT  1201 (Tenant Receivables)  amount + tax
  │     CREDIT 4000 (Rental Revenue)       amount
  │     CREDIT 2100 (VAT Payable)          tax (if > 0)
  ├─→ Trigger: update contract_balances (total_invoiced += amount + tax)
  ├─→ Trigger: update tenant_balances
  └─→ Audit log entry
```

### Payment Collection (Unchanged — Already Correct)
```
record_invoice_payment_atomic(payload)
  │
  ├─→ post_receipt_atomic(payload)
  │     ├─→ INSERT receipts
  │     ├─→ INSERT receipt_allocations
  │     ├─→ UPDATE invoices SET paid_amount += amount
  │     └─→ INSERT journal_entries:
  │           DEBIT  1111 (Cash)            amount
  │           CREDIT 1201 (Tenant Receivables) amount
  │
  ├─→ Trigger: update contract_balances (total_paid += amount)
  ├─→ Trigger: update tenant_balances
  └─→ Trigger: update_owner_balance
```

### Journal Balance After Phase 2
```
For a complete invoice + payment cycle:

Invoice creation:
  Dr 1201 Tenant Receivables    1000
  Cr 4000 Rental Revenue        1000

Payment collection:
  Dr 1111 Cash                  1000
  Cr 1201 Tenant Receivables    1000

Net effect:
  Dr 1111 Cash                  1000
  Cr 4000 Rental Revenue        1000
  (1201 nets to zero — correct!)
```

---

## Section 7: Testing Strategy

### Wave 1 Tests (Critical)
- [ ] Generate invoices for monthly contract → verify 1 invoice per month
- [ ] Generate invoices for quarterly contract → verify 1 invoice per quarter
- [ ] Verify journal entries created with correct DEBIT/CREDIT
- [ ] Verify `contract_balances` updated immediately after invoice creation
- [ ] Verify `contract_balances` updated immediately after payment
- [ ] Verify trial balance reflects revenue from journal entries

### Wave 2 Tests (Report Accuracy)
- [ ] `rpt_cash_flow` excludes VOID payments
- [ ] `rpt_vat_return` excludes VOID/CANCELLED invoices
- [ ] `rpt_financial_summary` overdue count is accurate

### Wave 3 Tests (Constraints)
- [ ] Cannot insert contract with status 'ACTIVE' (uppercase)
- [ ] Cannot insert invoice with arbitrary status
- [ ] Cannot insert receipt with arbitrary status
- [ ] Cannot create duplicate invoice for same contract+date
- [ ] Cannot hard-delete property with ownership records

### Wave 4 Tests (RLS & Cleanup)
- [ ] Bank reconciliation RLS works with `public.is_app_user()`
- [ ] `recalculate_all_balances` uses UPSERT (no empty window)

---

## Section 8: Approval Gate

### ⛔ NO CHANGES MADE

This is a READ-ONLY audit + plan document. No files were modified.

### Summary

| Metric | Value |
|--------|-------|
| Findings closed by Phase 1 | 9 |
| Findings to close in Phase 2 | 15 |
| Findings remaining after Phase 2 | 11 |
| Migrations planned | 12 |
| Frontend changes | 0 |
| Breaking changes | 0 |
| Estimated implementation time | 3-4 hours |

### Approval Request

**To approve:** Reply with "APPROVED — Proceed with Phase 2 implementation"

**To modify scope:** Specify which waves or migrations to adjust

**To defer:** Specify which items to move to Phase 3

---

**Awaiting explicit approval before any implementation.**
