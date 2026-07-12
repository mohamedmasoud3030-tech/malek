# Rentrix Financial Core Audit Report

**Auditor:** Senior ERP Financial Architect & PostgreSQL Security Reviewer  
**Date:** 2026-07-12  
**Repository:** `mohamedmasoud3030-tech/rentrixxx`  
**Scope:** READ-ONLY production audit — zero modifications made  

---

## 1. Files Inspected

### Database Migrations (54 files, 5,949 lines total)
| File | Purpose |
|------|---------|
| `20250101000001_core_schema.sql` | Core tables: users, properties, units, people, contracts, invoices, payments, receipts, receipt_allocations, expenses, maintenance_records, accounts, journal_entries, contract_balances, owner_balances, financial_operation_idempotency |
| `20250101000002_rls_policies_and_grants.sql` | RLS enablement, role helpers, all table policies |
| `20250101000003_functions_triggers_and_rpcs.sql` | Core RPCs: post_receipt_atomic, record_invoice_payment_atomic, void_receipt_atomic, renew_contract_atomic, generate_invoices_from_active_contracts, rpt_financial_summary |
| `20250101000004_financial_integrity_views_and_indexes.sql` | v_balance_reconciliation, v_balance_reconciliation_drift, report indexes |
| `20250101000005_security_advisor_cleanup.sql` | Security cleanup |
| `20260628000200_add_vat_support.sql` | VAT columns, rpt_vat_return |
| `20260628000400_add_rpt_cash_flow.sql` | rpt_cash_flow RPC |
| `20260628100000_owner_agreements_core.sql` | owner_agreements table, create_property_with_agreement, vw_active_owner_agreements |
| `20260628200000_create_contract_atomic.sql` | create_contract_atomic RPC |
| `20260703000000_resolve_maintenance_with_expense.sql` | resolve_maintenance_with_expense RPC |
| `20260705000005_bank_reconciliation_foundation.sql` | bank_accounts, bank_statement_imports/lines, bank_reconciliation_matches |
| `20260706014138_fix_custom_access_token_hook_role_source.sql` | Auth hook fix |
| `20260706021140_post_receipt_atomic_add_row_lock_and_overpayment_guard.sql` | Row locking + overpayment guard |
| `20260706090000_fix_record_invoice_payment_void_receipt_shared_id.sql` | Shared payment/receipt ID, hardened void_receipt_atomic |
| `20260706101000_align_payment_receipt_reporting_source.sql` | rpt_daily_collection |
| `20260708044657_contract_lifecycle_atomic_rpcs.sql` | update_contract_atomic, terminate_contract_atomic |
| `20260710120000_resolve_maintenance_with_expense_role_check.sql` | Role check hardening |
| `20260710120001_recalculate_all_balances_security_definer.sql` | recalculate_all_balances hardening |
| `20260711000001_add_rpt_trial_balance.sql` | rpt_trial_balance |
| `20260711000002_add_rpt_income_statement.sql` | rpt_income_statement |
| `20260711000003_add_rpt_balance_sheet.sql` | rpt_balance_sheet |
| `20260711000004_add_create_expense_with_journal_atomic.sql` | create_expense_with_journal_atomic |
| `20260711013304_fix_owner_balance_trigger_receipts_no_property_id.sql` | Trigger fix |
| `20260711013339_fix_tenant_balance_trigger_receipt_allocations_no_contract_id.sql` | Trigger fix |
| `20260711120000_production_hardening_security_rls_performance.sql` | Grant hardening, journal immutability triggers |
| `20260711123000_bank_reconciliation_atomic_and_journal_status_hardening.sql` | process_bank_reconciliation_match_atomic, journal status column |
| `20260712000000_contract_lifecycle_hardening.sql` | soft_delete_contract_atomic (uuid), renew_contract_atomic (text) |
| `20260712010000_soft_delete_contract_atomic.sql` | soft_delete_contract_atomic (text) — financial guard checks |
| `20260712020000_fix_tenant_balances_people_fk.sql` | FK retargeting to people(id) |

### Frontend Services
| File | Purpose |
|------|---------|
| `features/financials/payments/paymentService.ts` | Payment recording via RPC |
| `features/financials/receipts/receiptService.ts` | Receipt listing (from payments), void via RPC |
| `features/financials/invoices/invoiceService.ts` | Invoice listing, generation via RPC |
| `features/financials/expenses/expenseService.ts` | Expense CRUD — mixed RPC/direct |
| `features/financials/reports/financialReportsService.ts` | 1,276-line report service — heavy client-side aggregation |
| `features/financials/reconciliation/bankReconciliationService.ts` | Bank reconciliation — direct table writes |
| `features/financials/financialMath.ts` | Financial number helpers |
| `features/contracts/services/contractService.ts` | Contract lifecycle via atomic RPCs |

### Documentation
| File | Purpose |
|------|---------|
| `docs/CURRENT_STATE.md` | State-of-the-system document |
| `docs/DOMAIN.md` | Domain model documentation |
| `docs/ARCHITECTURE.md` | Architecture overview |
| `docs/PRODUCTION_HARDENING_AUDIT_20260711.md` | Prior hardening audit |
| `docs/PRODUCT_ACCOUNTING_DECISION_GATES.md` | Accounting policy decisions |

### Tests
- **102 total test files** across the application
- **44 financial-domain test files** covering payments, receipts, invoices, expenses, reports, reconciliation, contracts

---

## 2. Current Financial Architecture

### Entity Relationship Map

```
┌─────────────┐    ┌──────────────────┐    ┌──────────────┐
│   owners    │◄───│ owner_agreements │───►│  properties  │
│             │    │ (commission)     │    │              │
└──────┬──────┘    └──────────────────┘    └──────┬───────┘
       │                                          │
       │                                   ┌──────┴───────┐
       │                                   │    units     │
       │                                   └──────┬───────┘
       │                                          │
       │                                   ┌──────┴───────┐
       │                                   │  contracts   │◄──┐
       │                                   │ (leases)     │   │
       │                                   └──────┬───────┘   │
       │                                          │           │
       │                              ┌───────────┼──────────┐│
       │                              │           │          ││
       │                       ┌──────┴──┐  ┌─────┴────┐    ││
       │                       │invoices │  │ receipts │    ││
       │                       │         │  │          │    ││
       │                       └────┬────┘  └────┬─────┘    ││
       │                            │            │          ││
       │                       ┌────┴────┐  ┌────┴──────────┐│
       │                       │payments │  │receipt_       ││
       │                       │         │  │allocations    ││
       │                       └────┬────┘  └───────────────┘│
       │                            │                        │
       │                       ┌────┴────────────┐           │
       │                       │journal_entries  │           │
       │                       └─────────────────┘           │
       │                                                     │
  ┌────┴──────┐  ┌──────────────────┐  ┌────────────────┐   │
  │owner_     │  │contract_balances │  │tenant_balances │   │
  │balances   │  │(denormalized)    │  │(denormalized)  │   │
  └───────────┘  └──────────────────┘  └────────────────┘   │
                                                            │
  ┌───────────┐  ┌──────────────────┐                       │
  │ expenses  │  │maintenance_      │                       │
  │           │◄─│records           │                       │
  └───────────┘  └──────────────────┘                       │
                                                            │
  ┌───────────┐  ┌──────────────────┐                       │
  │  people   │◄─│  contracts       │───────────────────────┘
  │(tenants)  │  │  (tenant_id FK)  │
  └───────────┘  └──────────────────┘
```

### Table Inventory

| Table | PK | Purpose | FK Rules | RLS |
|-------|----|---------|----------|-----|
| `invoices` | `uuid` | Tenant billing records | `contract_id → contracts RESTRICT` | ✅ |
| `payments` | `uuid` | Cash receipts against invoices | `invoice_id → invoices RESTRICT`, `contract_id → contracts RESTRICT`, `receipt_id → receipts SET NULL` | ✅ |
| `receipts` | `uuid` | Formal receipt documents | `contract_id → contracts RESTRICT`, `payment_id → payments RESTRICT`, `tenant_id → people SET NULL` | ✅ |
| `receipt_allocations` | `uuid` | Links receipts to invoices (many-to-many) | `receipt_id → receipts CASCADE ⚠️`, `invoice_id → invoices RESTRICT` | ✅ |
| `journal_entries` | `uuid` | Double-entry accounting records | `account_id → accounts RESTRICT` | ✅ (read: admin/mgr, write: blocked) |
| `accounts` | `text` | Chart of accounts (1111=Cash, 1201=AR, 6100=Expenses) | — | ✅ (read: app user, write: admin) |
| `contract_balances` | `uuid` | Denormalized contract totals | `contract_id → contracts CASCADE ⚠️` | ✅ |
| `owner_balances` | `uuid` | Denormalized owner financials | `owner_id → owners CASCADE ⚠️` | ✅ |
| `financial_operation_idempotency` | `(operation_name, request_id)` | Idempotency guard | — | ✅ (no direct access) |
| `expenses` | `uuid` | Property operating expenses | `property_id → properties RESTRICT` | ✅ |
| `owner_agreements` | `uuid` | Owner-property management contracts | `owner_id → owners RESTRICT`, `property_id → properties RESTRICT` | ✅ |
| `contracts` | `uuid` | Tenant lease agreements | `property_id → properties RESTRICT`, `unit_id → units RESTRICT`, `tenant_id → people RESTRICT` | ✅ |
| `bank_accounts` | `uuid` | Bank account registry | — | ✅ |
| `bank_statement_lines` | `uuid` | Imported bank transactions | `import_id → bank_statement_imports CASCADE` | ✅ |
| `bank_reconciliation_matches` | `uuid` | Bank line ↔ entity matches | `statement_line_id → bank_statement_lines CASCADE` | ✅ |

### RPC Inventory

| RPC | Security | Idempotency | Row Locking | Role Check |
|-----|----------|-------------|-------------|------------|
| `record_invoice_payment_atomic(jsonb)` | DEFINER ✅ | ✅ via idempotency table | ✅ `FOR UPDATE` on invoice | ✅ `is_admin_or_manager()` |
| `post_receipt_atomic(jsonb)` | DEFINER ✅ | ✅ via `request_id` check | ✅ `FOR UPDATE` on invoices (sorted) | ✅ Direct users table check |
| `void_receipt_atomic(jsonb)` | DEFINER ✅ | ✅ Idempotent on VOID | ✅ `FOR UPDATE` on receipt | ✅ Direct users table check |
| `void_receipt_atomic(text,bigint,jsonb,jsonb)` | DEFINER ✅ | ✅ Idempotent on VOID | ✅ `FOR UPDATE` on receipt | ✅ Direct users table check |
| `create_contract_atomic(...)` | DEFINER ✅ | ❌ No idempotency | ❌ No `FOR UPDATE` | ✅ `is_admin_or_manager()` |
| `update_contract_atomic(...)` | DEFINER ✅ | ❌ No idempotency | ✅ `FOR UPDATE` on contract | ✅ `is_admin_or_manager()` |
| `terminate_contract_atomic(text,text)` | DEFINER ✅ | ❌ No idempotency | ✅ `FOR UPDATE` on contract | ✅ `is_admin_or_manager()` |
| `soft_delete_contract_atomic(text)` | DEFINER ✅ | ❌ No idempotency | ✅ `FOR UPDATE` on contract | ✅ `is_admin_or_manager()` |
| `soft_delete_contract_atomic(uuid)` | DEFINER ⚠️ | ❌ No idempotency | ✅ `FOR UPDATE` on contract | ✅ `is_admin_or_manager()` |
| `renew_contract_atomic(text,jsonb)` | DEFINER ✅ | ❌ No idempotency | ✅ `FOR UPDATE` on contract | ✅ `is_admin_or_manager()` |
| `generate_invoices_from_active_contracts()` | DEFINER ✅ | ❌ Dedup by date only | ❌ No locking | ✅ `is_admin_or_manager()` |
| `create_expense_with_journal_atomic(jsonb)` | DEFINER ✅ | ✅ via idempotency table | ❌ No `FOR UPDATE` | ⚠️ `is_app_user()` only |
| `resolve_maintenance_with_expense(text,numeric,text)` | DEFINER ✅ | ❌ No idempotency | ✅ `FOR UPDATE` on record | ✅ ADMIN/MANAGER check |
| `recalculate_all_balances()` | DEFINER ✅ | ❌ | ❌ | ✅ ADMIN/MANAGER (service_role only) |
| `process_bank_reconciliation_match_atomic(jsonb)` | DEFINER ✅ | ❌ No idempotency | ✅ `FOR UPDATE` on line | ✅ `is_app_user()` |
| `rpt_financial_summary(date,date)` | DEFINER ✅ | — | — | — (reads only) |
| `rpt_cash_flow(date,date)` | DEFINER ✅ | — | — | — (reads only) |
| `rpt_vat_return(date,date)` | DEFINER ✅ | — | — | — (reads only) |
| `rpt_trial_balance(date)` | DEFINER ✅ | — | — | — (reads only) |
| `rpt_income_statement(date,date)` | DEFINER ✅ | — | — | — (reads only) |
| `rpt_balance_sheet(date)` | DEFINER ✅ | — | — | — (reads only) |
| `rpt_owner_statement(uuid,date,date)` | INVOKER ⚠️ | — | — | — (reads only) |
| `rpt_tenant_statement(uuid)` | INVOKER ⚠️ | — | — | — (reads only) |
| `rpt_daily_collection(date,date)` | DEFINER ✅ | — | — | ✅ `is_app_user()` |
| `rpt_dashboard_overview(date,date,date)` | DEFINER ✅ | — | — | ✅ `is_app_user()` |

---

## 3. Financial Flow Maps

### Scenario A — Invoice Creation

```
generate_invoices_from_active_contracts()
  │
  ├─→ Filter: active contracts (lower(status)='active'), not deleted
  ├─→ Dedup: NOT EXISTS invoice with same contract_id + issue_date = current_date
  ├─→ INSERT: invoices(contract_id, issue_date, due_date, amount, status='UNPAID')
  │
  ├─→ ⚠️ NO journal entry created
  ├─→ ⚠️ NO contract_balances update
  ├─→ ⚠️ NO tenant_balances update (relies on trigger)
  ├─→ ✅ Trigger: update_tenant_balance (on invoices INSERT)
  └─→ ❌ No payment_cycle awareness (generates daily for all active contracts)
```

**Findings:**
- Invoice generation does NOT create journal entries (Dr AR, Cr Revenue) — the journal is only populated during payment recording.
- No payment_cycle awareness: generates invoices every day for every active contract regardless of monthly/quarterly/annual cycle.
- Deduplication is date-only: `i.issue_date = current_date` — running twice on different days for the same billing period creates duplicates.
- No `FOR UPDATE` locking — concurrent runs could create duplicates in a race condition window.

### Scenario B — Payment Collection

```
record_invoice_payment_atomic(payload)
  │
  ├─→ Auth: actor_id + is_admin_or_manager()
  ├─→ Advisory lock on request_id
  ├─→ Idempotency check via financial_operation_idempotency
  ├─→ Invoice lock: SELECT ... FOR UPDATE
  ├─→ Validate: outstanding balance + 0.001 tolerance
  ├─→ Validate: accounts configured (1111 Cash, 1201 AR)
  │
  ├─→ post_receipt_atomic(payload)
  │     ├─→ Auth: direct users table role check
  │     ├─→ Idempotency: check receipts.request_id
  │     ├─→ Invoice locks: FOR UPDATE sorted by id
  │     ├─→ Overpayment guard: paid_amount + allocation_total > amount + tax + 0.001
  │     ├─→ INSERT receipts
  │     ├─→ INSERT receipt_allocations
  │     ├─→ UPDATE invoices SET paid_amount += allocation.total
  │     └─→ INSERT journal_entries (DEBIT cash, CREDIT receivable)
  │
  ├─→ INSERT payments (shared ID with receipt)
  ├─→ UPDATE receipts SET payment_id = payment.id
  ├─→ INSERT financial_operation_idempotency
  │
  ├─→ ✅ Trigger: update_tenant_balance (via receipt_allocations INSERT)
  ├─→ ✅ Trigger: update_owner_balance_on_expense (via receipts INSERT)
  └─→ ⚠️ contract_balances NOT updated (relies on recalculate_all_balances)
```

**Findings:**
- Payment and receipt share the same UUID — this was a deliberate fix (20260706090000).
- Journal entries are created server-side within `post_receipt_atomic` from the caller's payload — the caller constructs DEBIT/CREIT entries.
- The `record_invoice_payment_atomic` constructs journal entries internally and passes them to `post_receipt_atomic` — this is properly atomic.
- `contract_balances` is NOT updated by triggers — it's only refreshed by `recalculate_all_balances()` (a manual/cron operation).
- The 0.001 tolerance for overpayment is appropriate for floating-point rounding.

### Scenario C — Owner Settlement

```
rpt_owner_statement(p_owner_id, p_from, p_to)
  │
  ├─→ Load owner commission_type/commission_value from owners table
  ├─→ Find owner_contracts via properties.owner_id
  │
  ├─→ Receipts CTE:
  │     ├─→ JOIN receipts → owner_contracts
  │     ├─→ Calculate deduction: commission_value% of amount (if RATE)
  │     └─→ Filter: status='POSTED', date range
  │
  ├─→ Expenses CTE:
  │     ├─→ JOIN expenses → contracts → units → properties
  │     ├─→ Filter: status='POSTED', charged_to='OWNER'
  │     └─→ Match: property owned by this owner OR contract unit's property
  │
  ├─→ Settlements CTE:
  │     ├─→ FROM owner_settlements WHERE owner_id = p_owner_id::text
  │     └─→ Filter: date range
  │
  └─→ Aggregate: total_gross, total_deductions, total_net
```

**Findings:**
- Owner settlement is a READ-ONLY report — no atomic settlement creation RPC exists.
- The `owner_settlements` table exists in production but is NOT defined in any migration file.
- Commission calculation only handles `RATE` type — `FIXED_MONTHLY` commissions show `0` deduction.
- The expense CTE uses a complex join chain that may miss expenses linked directly to properties without contracts.
- `rpt_owner_statement` is `SECURITY INVOKER` (not DEFINER) — inconsistent with other financial RPCs.

---

## 4. Security Findings

### S-01: `rpt_owner_statement` and `rpt_tenant_statement` are SECURITY INVOKER [MEDIUM]
**Affected:** `rpt_owner_statement(uuid,date,date)`, `rpt_tenant_statement(uuid)`  
**Impact:** These report functions run with the caller's privileges rather than the definer's. While RLS policies allow authenticated reads, this is inconsistent with the project's security baseline (all other financial RPCs use SECURITY DEFINER with pinned search_path). If RLS policies change, these functions could break or expose unexpected data.  
**Recommended Fix:** Convert to SECURITY DEFINER with `SET search_path = public, pg_temp`.

### S-02: `create_expense_with_journal_atomic` uses `is_app_user()` instead of `is_admin_or_manager()` [HIGH]
**Affected:** `create_expense_with_journal_atomic(jsonb)`  
**Files:** `supabase/migrations/20260711000004_add_create_expense_with_journal_atomic.sql`  
**Impact:** Any authenticated user (including USER role) can create expenses with journal entries. The app's permission model restricts expense management to ADMIN/MANAGER, but the RPC itself only checks `is_app_user()`. A USER-role attacker calling the RPC directly could post arbitrary expenses and journal entries.  
**Recommended Fix:** Replace `is_app_user()` with `is_admin_or_manager()` check.

### S-03: Direct expense update bypasses journal consistency [HIGH]
**Affected:** `expenseService.ts` line 27  
**Files:** `rentrix-app/src/features/financials/expenses/expenseService.ts`  
**Impact:** `updateExpense()` performs a direct `supabase.from('expenses').update(payload)`. If an expense amount is changed, the corresponding journal entry is NOT updated. This creates a journal/expense mismatch. The RLS policy allows any authenticated user to update expenses (manager_write_expenses policy grants ALL to authenticated).  
**Recommended Fix:** Create `update_expense_with_journal_atomic` RPC that updates both the expense and its journal entries atomically.

### S-04: `void_receipt_atomic` grants inconsistency [MEDIUM]
**Affected:** `void_receipt_atomic(jsonb)`  
**Files:** `supabase/migrations/20260706090000_fix_record_invoice_payment_void_receipt_shared_id.sql`  
**Impact:** The `jsonb` facade overload grants `EXECUTE TO authenticated, anon, service_role` — granting execute to `anon` is inconsistent with all other financial RPCs that revoke from anon. This allows unauthenticated callers to attempt void operations (they'll fail on the auth check inside, but it's a defense-in-depth violation).  
**Recommended Fix:** Revoke execute from `anon` on `void_receipt_atomic(jsonb)`.

### S-05: Bank reconciliation RLS uses `app_private.is_app_user()` [MEDIUM]
**Affected:** All bank reconciliation tables  
**Files:** `supabase/migrations/20260705000005_bank_reconciliation_foundation.sql`  
**Impact:** Bank reconciliation policies reference `app_private.is_app_user()` while all other tables use `public.is_app_user()`. If the `app_private` schema doesn't exist or the function differs, RLS either fails open or blocks all access. This is a schema qualification inconsistency.  
**Recommended Fix:** Replace `app_private.is_app_user()` with `public.is_app_user()`.

### S-06: No organization isolation [CRITICAL — Future Multi-Tenant]
**Affected:** All tables and policies  
**Files:** `supabase/migrations/20260711124000_organization_isolation_future_todo.sql`  
**Impact:** All RLS policies are role-based only. There is no organization_id column on any financial table. Any authenticated user can access ALL financial data regardless of organizational context. This is acceptable for single-office deployment but is a hard blocker for multi-tenant production. The migration file explicitly documents this as a no-op placeholder.  
**Recommended Fix:** Implement organization isolation per the 7-step plan in the migration file before multi-organization deployment.

---

## 5. Accounting Integrity Findings

### A-01: No journal entry for invoice creation [HIGH]
**Affected:** `generate_invoices_from_active_contracts()`, `invoices` table  
**Impact:** When invoices are generated, no journal entry is created (Dr Tenant Receivables 1201, Cr Rental Revenue 4000). The journal_entries table only has entries for payments and expenses. This means:
- The Trial Balance derives revenue from `invoices` directly, not from journal entries.
- The journal is incomplete — it cannot serve as a canonical general ledger.
- If an invoice is deleted without payment, there is no reversing entry needed because no entry was ever created.  
**Recommended Fix:** Create journal entries on invoice generation, or formally document the system as "partial journal" (which the trial balance migration already acknowledges).

### A-02: No double-entry balance enforcement on journal_entries [HIGH]
**Affected:** `journal_entries` table, `post_receipt_atomic`  
**Impact:** Journal entries are inserted individually with no constraint ensuring total DEBITs = total CREDITs for a given transaction group. The `post_receipt_atomic` function accepts journal entries from the caller's payload — if the caller constructs unbalanced entries, they're accepted without validation. There is no `transaction_id` or `batch_id` to group related entries.  
**Recommended Fix:** Add a `batch_id` column and a deferred constraint or trigger that validates `SUM(DEBIT) = SUM(CREDIT)` per batch.

### A-03: `contract_balances` is not trigger-maintained [HIGH]
**Affected:** `contract_balances` table  
**Impact:** Unlike `tenant_balances` (which has triggers on invoices and receipt_allocations), `contract_balances` has NO triggers. It's only refreshed by `recalculate_all_balances()`, which is a manual/cron operation restricted to `service_role`. Between recalculations, `contract_balances` is stale. Any report or UI reading from this table gets outdated totals.  
**Recommended Fix:** Add triggers on `invoices` and `receipt_allocations` to maintain `contract_balances` incrementally, or remove the table and compute balances from source tables on demand.

### A-04: `contract_balances` and `owner_balances` use ON DELETE CASCADE [CRITICAL]
**Affected:** `contract_balances.contract_id → contracts.id ON DELETE CASCADE`, `owner_balances.owner_id → owners.id ON DELETE CASCADE`  
**Files:** `supabase/migrations/20250101000001_core_schema.sql` lines 332, 342  
**Impact:** If a contract is hard-deleted (e.g., via a direct SQL operation or admin tool), the corresponding `contract_balances` row is silently deleted. Similarly, hard-deleting an owner destroys all owner financial summary data. While the application uses soft-delete (`deleted_at`), any direct database access or future tooling that hard-deletes would cause irreversible data loss. Financial balance tables should NEVER cascade delete.  
**Recommended Fix:** Change to `ON DELETE RESTRICT` for both `contract_balances` and `owner_balances`.

### A-05: `receipt_allocations` uses ON DELETE CASCADE on `receipt_id` [CRITICAL]
**Affected:** `receipt_allocations.receipt_id → receipts.id ON DELETE CASCADE`  
**Files:** `supabase/migrations/20250101000001_core_schema.sql` line 222  
**Impact:** If a receipt row is hard-deleted (not voided), all allocation records are silently destroyed. The `void_receipt_atomic` function properly reverses allocations before deleting them, but a direct `DELETE FROM receipts` would skip this and destroy the allocation audit trail. This is the most dangerous CASCADE in the financial schema.  
**Recommended Fix:** Change to `ON DELETE RESTRICT`. The `void_receipt_atomic` function already handles explicit deletion.

### A-06: `rpt_cash_flow` doesn't filter VOID payments [HIGH]
**Affected:** `rpt_cash_flow(date,date)`  
**Files:** `supabase/migrations/20260628000400_add_rpt_cash_flow.sql`  
**Impact:** The cash flow report sums all non-deleted payments regardless of status. VOID payments are included in the `receipts` total, overstating cash collections. Every other financial report (daily collection, financial summary, trial balance) correctly excludes VOID payments.  
**Recommended Fix:** Add `AND COALESCE(UPPER(status), 'POSTED') <> 'VOID'` to the payment filter.

### A-07: `rpt_vat_return` doesn't filter VOID invoices [MEDIUM]
**Affected:** `rpt_vat_return(date,date)`  
**Files:** `supabase/migrations/20260628000200_add_vat_support.sql`  
**Impact:** The VAT return sums all non-deleted invoices regardless of status. VOID/CANCELLED invoices inflate the reported VAT liability.  
**Recommended Fix:** Add `AND COALESCE(LOWER(status), '') NOT IN ('void', 'cancelled')` to the invoice filter.

### A-08: `rpt_financial_summary` doesn't filter VOID payments [MEDIUM]
**Affected:** `rpt_financial_summary(date,date)`  
**Files:** `supabase/migrations/20250101000003_functions_triggers_and_rpcs.sql`  
**Impact:** The `collected` total uses `coalesce(status, 'POSTED') <> 'VOID'` which is correct, but the function was defined before the VOID status was standardized. Review shows it DOES filter VOID — this is actually correct. However, `overdue_amount` uses `status in ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE') and due_date < current_date` which is redundant — an invoice can't be 'OVERDUE' AND have `due_date < current_date` without the recalculate function having run. Status may not be current.  
**Recommended Fix:** Add `recalculate_invoice_status` call or rely on status being current.

### A-09: Trial Balance balances by construction (plug), not by accounting [MEDIUM]
**Affected:** `rpt_trial_balance(date)`  
**Impact:** The trial balance uses Retained Earnings as a plug figure so that total debits == total credits. It always reports `is_balanced: true`. This means it cannot detect accounting errors — if a journal entry is unbalanced, the plug absorbs the error silently.  
**Recommended Fix:** Document this clearly in the UI, and add a separate "journal integrity check" that validates DEBIT/CREDIT balance per source transaction.

---

## 6. Database Risks

### D-01: `contracts.status` enum inconsistency [HIGH]
**Affected:** `contracts` table  
**Files:** `supabase/migrations/20250101000001_core_schema.sql` line 136  
**Impact:** The CHECK constraint allows `('draft', 'active', 'expired', 'terminated', 'ENDED', 'ACTIVE')` — mixed case. Code uses `lower(status) = 'active'` in some places and `status = 'ACTIVE'` in others. The `renew_contract_atomic` (latest version) accepts `status IN ('active', 'expired', 'ACTIVE')`. This creates ambiguity about the canonical status values and risks inconsistent filtering.  
**Recommended Fix:** Standardize on lowercase values and add a migration to normalize existing data.

### D-02: `invoices.status` has no CHECK constraint [MEDIUM]
**Affected:** `invoices` table  
**Impact:** The `invoices.status` column is `text` with no CHECK constraint. Values seen in code: 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID', 'CANCELLED'. Any arbitrary string can be stored. This risks inconsistent status values that reports and filters don't handle.  
**Recommended Fix:** Add `CHECK (status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID', 'CANCELLED'))`.

### D-03: `receipts.status` has no CHECK constraint [MEDIUM]
**Affected:** `receipts` table  
**Impact:** Same as D-02 for receipts. Values seen: 'POSTED', 'VOID'. No constraint prevents arbitrary values.  
**Recommended Fix:** Add `CHECK (status IN ('POSTED', 'VOID'))`.

### D-04: `payments.payment_method` has no CHECK constraint [LOW]
**Affected:** `payments` table  
**Impact:** Free-text payment method. Frontend types define `'cash' | 'bank_transfer' | 'card' | 'check' | 'other'` but the database accepts any string.  
**Recommended Fix:** Add CHECK constraint matching the frontend enum.

### D-05: `properties.id` type mismatch with `owner_agreements.property_id` [HIGH]
**Affected:** `owner_agreements.property_id` is `text NOT NULL REFERENCES public.properties(id)`, but `properties.id` is `uuid`  
**Files:** `supabase/migrations/20260628100000_owner_agreements_core.sql`, `20250101000001_core_schema.sql`  
**Impact:** PostgreSQL allows this implicit cast (uuid → text), but it creates subtle bugs when joining or comparing. The `owner_agreements` FK works because PostgreSQL implicitly casts the text value to uuid for the FK check. However, `create_property_with_agreement` declares `v_property_id text` and assigns from `properties.id RETURNING id` (which returns uuid). This works but is fragile.  
**Recommended Fix:** Align types — either make `owner_agreements.property_id` uuid, or document the intentional type mismatch.

### D-06: Duplicate `soft_delete_contract_atomic` signatures [HIGH]
**Affected:** `soft_delete_contract_atomic(uuid)` (20260712000000) and `soft_delete_contract_atomic(text)` (20260712010000)  
**Impact:** Two overloads exist with different parameter types. The `uuid` version (20260712000000) lacks the financial integrity checks (paid invoices, receipts) that the `text` version (20260712010000) has. The frontend calls `soft_delete_contract_atomic` with `{ p_contract_id: contractId }` — PostgreSQL resolves the overload based on the argument type. If the caller passes a string that's valid as both text and uuid, PostgreSQL may choose the wrong overload. The `text` overload also has stricter financial guards (rejects deletion if receipts exist).  
**Recommended Fix:** Drop the `uuid` overload and keep only the `text` version with full financial guards.

### D-07: `recalculate_all_balances` does DELETE+INSERT [MEDIUM]
**Affected:** `recalculate_all_balances()`  
**Impact:** The function does `DELETE FROM contract_balances WHERE true` followed by `INSERT INTO contract_balances ...`. During the brief window between DELETE and INSERT (within the same transaction), any concurrent read would see empty balance tables. While this is within a single transaction (so reads see either old or new, not empty), the `DELETE WHERE true` pattern is risky if the function is ever split or if an error occurs mid-execution.  
**Recommended Fix:** Use `INSERT ... ON CONFLICT DO UPDATE` (upsert) instead of DELETE+INSERT.

### D-08: `invoices.contract_id` and `payments.contract_id` allow NULL in FK but NOT NULL in CHECK [MEDIUM]
**Affected:** `payments.contract_id` and `payments.invoice_id`  
**Impact:** `payments.contract_id` has both `REFERENCES public.contracts(id) ON DELETE RESTRICT` (allows NULL) and `CONSTRAINT payments_contract_required CHECK (contract_id IS NOT NULL)`. Similarly for `invoice_id`. This is actually well-designed — the CHECK enforces non-null while the FK allows it in the type system. No issue found, but the dual constraint is worth documenting.

### D-09: No unique constraint on `(invoice_id, due_date)` for invoice deduplication [MEDIUM]
**Affected:** `invoices` table  
**Impact:** `generate_invoices_from_active_contracts()` uses `NOT EXISTS (select 1 from invoices where contract_id = c.id and issue_date = current_date)` to prevent duplicates. This is a race condition — two concurrent calls can both pass the NOT EXISTS check before either inserts. A unique partial index `ON invoices (contract_id, issue_date) WHERE deleted_at IS NULL` would prevent duplicates at the database level.  
**Recommended Fix:** Add `CREATE UNIQUE INDEX invoices_contract_issue_date_unique ON invoices (contract_id, issue_date) WHERE deleted_at IS NULL`.

### D-10: `property_owners.property_id` uses ON DELETE CASCADE [MEDIUM]
**Affected:** `property_owners.property_id → properties.id ON DELETE CASCADE`  
**Impact:** Hard-deleting a property silently destroys all ownership records. This is financial data (ownership percentages, periods) that should be preserved.  
**Recommended Fix:** Change to `ON DELETE RESTRICT`.

---

## 7. Performance Findings

### P-01: Client-side financial report aggregation [HIGH]
**Affected:** `financialReportsService.ts` (1,276 lines)  
**Impact:** Most financial reports (collection summary, daily collection, aged receivables, overdue invoices, expense breakdown, cashflow, period summary) are computed client-side by:
1. Loading all invoices/payments/expenses for the date range
2. Hydrating related context (contracts, properties, people, units) in batched queries
3. Filtering and aggregating in JavaScript

For a production deployment with thousands of invoices, this means:
- Multiple round-trips to the database per report
- Large JSON payloads transferred to the client
- Client-side memory pressure for large datasets
- Stale data risk between hydration and display

**Recommended Fix:** Move aggregation to server-side views or RPCs. `rpt_daily_collection` already exists server-side but isn't wired to the frontend.

### P-02: N+1 context hydration in receipt listing [MEDIUM]
**Affected:** `receiptService.ts` `loadReceiptRecords()`  
**Impact:** Listing receipts requires 5 sequential queries: payments → invoices → contracts → [units, properties, tenants]. While the last 3 are parallelized, the first 3 are sequential. For 25 receipts, this is 5 queries instead of 1.  
**Recommended Fix:** Create a server-side view `v_receipt_records` that joins all context in a single query, or use PostgREST embedded resources.

### P-03: `v_balance_reconciliation` view scans all contracts [MEDIUM]
**Affected:** `v_balance_reconciliation`, `v_balance_reconciliation_drift`  
**Impact:** The view joins all non-deleted contracts with all their invoices and payments, grouped by contract. For a large deployment, this is a full table scan of invoices and payments. No date filtering is possible.  
**Recommended Fix:** Add parameterized RPC version that accepts date/contract filters.

### P-04: Missing index on `receipts.payment_id` [LOW]
**Affected:** `receipts` table  
**Impact:** `void_receipt_atomic` looks up receipts by `payment_id` in some code paths. While there's a unique constraint on `payment_id`, the index is implicit from the constraint. No issue found.

### P-05: `financialMath.ts` uses JavaScript `number` type [LOW]
**Affected:** All client-side financial calculations  
**Impact:** JavaScript `number` is IEEE 754 double-precision floating point. For currency values up to ~15 significant digits, this is accurate. The `toFinancialNumber()` function coerces unknown values to 0 rather than NaN, which is defensive. However, `sumFinancialValues()` accumulates via `reduce` without using `Math.fround()` or integer-cents arithmetic. For typical rental amounts (4-6 digits), this is safe. For high-volume aggregation (thousands of transactions), rounding errors could accumulate to ~0.01 per 10,000 operations.  
**Recommended Fix:** Consider integer-cents arithmetic or `decimal.js` for client-side aggregation if amounts grow significantly.

---

## 8. Test Coverage Gaps

### Existing Coverage (44 financial test files)
- ✅ Payment service: `paymentService.test.ts`, `usePayments.test.ts`
- ✅ Receipt service: `receiptService.test.ts`, `useReceipts.test.ts`, `receipts-page.test.ts`
- ✅ Invoice service: `invoiceService.test.ts`, `invoiceService.pagination.test.ts`, `useInvoices.test.ts`
- ✅ Expense service: `expenses-page.test.ts`, `useExpenses.test.ts`, `operational-expenses.test.ts`
- ✅ Financial math: `financialMath.test.ts`
- ✅ Report service: `financialReportsService.test.ts`, `accounting-reports-service.test.ts`
- ✅ Bank reconciliation: `bankReconciliationService.test.ts`, `bankReconciliationAtomicRpc.test.ts`
- ✅ Contract service: `contractService.test.ts`
- ✅ Migration contracts: Multiple `*-migration-contract.test.ts` files

### Missing Coverage

| Gap | Risk | Priority |
|-----|------|----------|
| **No end-to-end payment flow test** (invoice → payment → receipt → allocation → journal) | HIGH | Critical regression risk — the most important financial path has no integration test |
| **No void receipt reversal test** (void → verify invoice paid_amount decremented → verify journal reversal) | HIGH | Void is the most error-prone path (historical bugs documented in CURRENT_STATE.md) |
| **No `recalculate_all_balances` correctness test** | HIGH | Balance tables could drift silently |
| **No concurrent payment race condition test** | MEDIUM | The advisory lock and FOR UPDATE patterns are untested under concurrency |
| **No overpayment boundary test** (amount = outstanding + 0.001) | MEDIUM | Rounding tolerance edge case |
| **No `rpt_trial_balance` balancing test** | MEDIUM | The plug-based balance is never validated against expected values |
| **No `rpt_owner_statement` commission calculation test for FIXED_MONTHLY** | MEDIUM | FIXED_MONTHLY shows 0 deduction — may be by design but untested |
| **No `generate_invoices_from_active_contracts` duplicate prevention test** | MEDIUM | Race condition potential is untested |
| **No `terminate_contract_atomic` future invoice cancellation test** | MEDIUM | Invoices with partial payments should not be cancelled |
| **No role-based access test** (USER role attempting financial writes) | MEDIUM | Role enforcement is the primary security boundary |
| **No `create_expense_with_journal_atomic` role bypass test** | HIGH | Currently only checks `is_app_user()` — USER role should be rejected |
| **No balance reconciliation drift detection test** | LOW | `v_balance_reconciliation_drift` view is never validated |

---

## 9. Documentation Drift

### DOC-01: DOMAIN.md references `OwnerSettlement` lifecycle not implemented
**Doc says:** "OwnerSettlement — a payout calculation for an Owner under an OwnerAgreement: grossRevenue, expensesDeducted, feesDeducted, netPayout, and status (draft | approved | paid)."  
**Reality:** No atomic RPC exists for creating, approving, or paying owner settlements. The `owner_settlements` table exists in production but is not defined in any migration file. The `rpt_owner_statement` report is read-only. The settlement lifecycle is aspirational.

### DOC-02: DOMAIN.md doesn't mention `journal_entries` immutability trigger
**Doc says:** Nothing about journal entry mutation rules.  
**Reality:** The `prevent_posted_journal_entry_mutation` trigger blocks all UPDATE/DELETE on posted journal entries, requiring reversing entries for corrections. This is a critical accounting invariant not documented in DOMAIN.md.

### DOC-03: CURRENT_STATE.md mentions `rpt_daily_collection` as "not wired"
**Doc says:** "still does not call it from the frontend."  
**Reality:** This is still accurate as of this audit. The RPC exists but the frontend computes daily collection client-side.

### DOC-04: Migration file count vs. live schema mismatch
**Doc says:** "54 base tables" in production.  
**Reality:** Migration files define ~30 tables. The remaining ~24 are captured in baseline migrations files (`20260705000001`, `20260705000002`) but many are scaffolding tables with no data and no frontend integration.

### DOC-05: `contracts.status` values in DOMAIN.md don't match CHECK constraint
**Doc says:** `status (draft | active | terminated | expired)`  
**Reality:** CHECK constraint allows `('draft', 'active', 'expired', 'terminated', 'ENDED', 'ACTIVE')` — includes uppercase variants and 'ENDED' not mentioned in docs.

---

## 10. Risk Classification

### CRITICAL

| ID | Finding | Affected | Impact | Recommended Fix |
|----|---------|----------|--------|-----------------|
| A-04 | `contract_balances` ON DELETE CASCADE | `contract_balances` table | Silent destruction of financial summary on hard-delete | Change to ON DELETE RESTRICT |
| A-04 | `owner_balances` ON DELETE CASCADE | `owner_balances` table | Silent destruction of financial summary on hard-delete | Change to ON DELETE RESTRICT |
| A-05 | `receipt_allocations` ON DELETE CASCADE | `receipt_allocations.receipt_id` | Silent destruction of allocation audit trail on receipt hard-delete | Change to ON DELETE RESTRICT |
| S-06 | No organization isolation | All tables | Any user can access all financial data | Implement per the 7-step plan before multi-tenant deployment |

### HIGH

| ID | Finding | Affected | Impact | Recommended Fix |
|----|---------|----------|--------|-----------------|
| S-02 | `create_expense_with_journal_atomic` uses `is_app_user()` | Expense creation RPC | USER role can post expenses + journal entries | Change to `is_admin_or_manager()` |
| S-03 | Direct expense update bypasses journal | `expenseService.ts:27` | Expense/journal mismatch after edit | Create `update_expense_atomic` RPC |
| A-01 | No journal entry for invoice creation | `generate_invoices_from_active_contracts()` | Incomplete journal — AR/Revenue not recorded | Add journal entries or formally document partial journal |
| A-02 | No double-entry balance enforcement | `journal_entries` table | Unbalanced entries possible | Add batch validation trigger |
| A-03 | `contract_balances` not trigger-maintained | `contract_balances` table | Stale balance data between recalculations | Add incremental triggers or remove table |
| A-06 | `rpt_cash_flow` includes VOID payments | Cash flow report | Overstated collections | Add VOID filter |
| D-01 | `contracts.status` mixed-case enum | `contracts` table | Inconsistent filtering | Standardize to lowercase |
| D-05 | `owner_agreements.property_id` type mismatch | `owner_agreements` table | Fragile implicit cast | Align types |
| D-06 | Duplicate `soft_delete_contract_atomic` signatures | Contract deletion | Wrong overload may be called | Drop `uuid` overload |
| D-09 | No unique constraint for invoice dedup | `invoices` table | Race condition duplicates possible | Add partial unique index |
| P-01 | Client-side report aggregation | `financialReportsService.ts` | Performance, stale data risk | Move to server-side RPCs |

### MEDIUM

| ID | Finding | Affected | Impact | Recommended Fix |
|----|---------|----------|--------|-----------------|
| S-01 | `rpt_owner_statement` SECURITY INVOKER | Owner statement RPC | Inconsistent security posture | Convert to SECURITY DEFINER |
| S-04 | `void_receipt_atomic(jsonb)` grants to anon | Void receipt RPC | Defense-in-depth violation | Revoke from anon |
| S-05 | Bank reconciliation `app_private` schema ref | Bank reconciliation RLS | Schema mismatch risk | Use `public.is_app_user()` |
| A-07 | `rpt_vat_return` includes VOID invoices | VAT report | Overstated VAT liability | Add VOID/CANCELLED filter |
| A-08 | `rpt_financial_summary` status staleness | Dashboard report | Overdue count may be wrong | Add status recalculation |
| A-09 | Trial Balance plug-based balancing | Trial balance report | Cannot detect accounting errors | Add journal integrity check |
| D-02 | `invoices.status` no CHECK constraint | `invoices` table | Arbitrary status values | Add CHECK constraint |
| D-03 | `receipts.status` no CHECK constraint | `receipts` table | Arbitrary status values | Add CHECK constraint |
| D-07 | `recalculate_all_balances` DELETE+INSERT | Balance tables | Brief empty window | Use UPSERT pattern |
| D-10 | `property_owners.property_id` CASCADE | `property_owners` table | Silent ownership history loss | Change to RESTRICT |
| P-02 | N+1 context hydration in receipts | Receipt listing | 5 queries per page | Create server-side view |
| P-03 | `v_balance_reconciliation` full scan | Reconciliation view | Performance at scale | Add parameterized RPC |

### LOW

| ID | Finding | Affected | Impact | Recommended Fix |
|----|---------|----------|--------|-----------------|
| D-04 | `payments.payment_method` no CHECK | `payments` table | Free-text method values | Add CHECK constraint |
| P-05 | JavaScript `number` for financial math | `financialMath.ts` | Potential rounding drift | Consider integer-cents or decimal.js |
| DOC-01 | Owner settlement lifecycle not implemented | `owner_settlements` | Feature gap | Implement or document as planned |
| DOC-02 | Journal immutability not documented | DOMAIN.md | Knowledge gap | Add to documentation |
| DOC-05 | Status values mismatch in docs | DOMAIN.md | Confusion | Align docs with schema |
| — | Dead function overloads | `get_financial_summary`, `void_receipt_atomic(text,...)` | Schema clutter | DROP unused overloads |
| — | `rpt_daily_collection` unwired | Frontend reports | Server RPC unused | Wire to frontend |
| — | Multiple `rpt_*` RPCs unwired | Frontend reports | Server RPCs unused | Wire to frontend or deprecate |

---

## 11. Approval Gate

---

### ⛔ NO CHANGES MADE

This audit was performed in **READ-ONLY** mode. No files were modified, no migrations were created, no SQL functions were changed, and nothing was committed.

### Summary Statistics

| Category | Count |
|----------|-------|
| CRITICAL findings | 4 |
| HIGH findings | 11 |
| MEDIUM findings | 12 |
| LOW findings | 8 |
| **Total findings** | **35** |
| Migration files inspected | 54 |
| Frontend service files inspected | 8 |
| Documentation files inspected | 5 |
| Test files inventoried | 44 |
| Test coverage gaps identified | 12 |

### Priority Recommendations (in order)

1. **Immediate (before next production deployment):**
   - A-04/A-05: Change CASCADE → RESTRICT on `contract_balances`, `owner_balances`, `receipt_allocations`
   - S-02: Fix `create_expense_with_journal_atomic` role check
   - D-06: Drop duplicate `soft_delete_contract_atomic(uuid)` overload
   - A-06: Fix `rpt_cash_flow` VOID payment filter

2. **Short-term (within 2 weeks):**
   - S-03: Create `update_expense_with_journal_atomic` RPC
   - D-01: Standardize `contracts.status` to lowercase
   - D-02/D-03: Add CHECK constraints on `invoices.status` and `receipts.status`
   - D-09: Add unique partial index for invoice deduplication
   - S-04: Revoke anon execute from `void_receipt_atomic(jsonb)`

3. **Medium-term (within 1 month):**
   - A-01: Decide on journal entry strategy for invoice creation
   - A-02: Add double-entry batch validation
   - A-03: Add triggers for `contract_balances` or compute on demand
   - P-01: Begin migrating client-side reports to server-side RPCs
   - S-06: Begin organization isolation implementation

---

**Awaiting explicit approval before any implementation.**
