# Rentrix — Full Product, Business Logic & Technical Audit
**Date**: 2026-07-24  
**Status**: Completed  
**Auditor**: Arena Agent Mode (Lead Software Architect)

---

## 1. Executive Summary

This audit presents a comprehensive, transaction-level verification of the **Rentrix SaaS Property Management System** as of **July 24, 2026**. This evaluation is anchored directly on the active codebase, database schema, and transaction ledger, bypassing outdated documentation to verify physical reality.

### Key Takeaways
1. **Structural Integrity**: The system’s foundational multi-tenant architecture (**PR #1276**) and landlord settlement calculations (**PR #1277**) have been successfully merged into `main` and verified directly on the production instance (`nnggcnpcuomwfuupupwg`). The server-side calculation engine `calculate_owner_net_payout` is live, securely isolated, and structurally sound.
2. **The "Pre-Launch" Paradox**: While the database structure, security model (98 active RLS policies), and atomic transactions are production-grade, the active databases contain zero live client rows. This represents a "sandbox" or QA stage.
3. **Critical Financial Reports Breakdown**: A deep audit of the 8+ report RPCs revealed that **six reports are completely broken in production** due to severe syntax errors, data type mismatches, and incorrect function applications.
4. **Data Model Redundancy**: The legacy `tenants` table is orphaned and unused, with all active tenant entities correctly resolved through the unified `people` table.
5. **Partial Overlap/Interval Vulnerabilities**: Period calculations (e.g., fixed monthly commission fees and master lease obligations) lack partial-month proration, exposing owners to overcharging when agreements cover a fraction of a month.

---

## 2. Module-by-Module Technical Status

### 2.1 Properties & Units
*   **Database Objects**: `public.properties`, `public.units`.
*   **Logical Implementation**: 
    *   `properties` uses `title` as its primary text identifier. There is **no `name` column** on this table.
    *   `units` contains both a custom descriptive text `name` and a structured `unit_number` text column.
    *   **Unit Status Resolution**: Controlled via `resolve_unit_operational_status()`. Status constraint enforces `check (status in ('available', 'occupied', 'maintenance', 'reserved'))`.
*   **Audit Verdict**: **MAPPED & CORRECT**. Unit status transitions are correctly automated upon contract creation or termination, preventing double booking.

### 2.2 Owners & Owner Agreements
*   **Database Objects**: `public.owners`, `public.owner_agreements`.
*   **Logical Implementation**:
    *   `owner_agreements` maps a landlord's properties to specific commission structures: `starts_on`, `ends_on` (optional), `agreement_type` (`management`, `master_lease`), `commission_type` (`RATE`, `FIXED_MONTHLY`), and `commission_value`.
    *   Role-scoping is fully operational, preventing tenant-level access.
*   **Audit Verdict**: **MAPPED & CORRECT**. Fully integrated into the landlord settlement derivation ledger.

### 2.3 Tenants, People, & Contracts
*   **Database Objects**: `public.people`, `public.contracts`, `public.tenants` (legacy).
*   **Logical Implementation**:
    *   **The Tenant Identity Shift**: The dedicated `public.tenants` table has been deprecated. All operational tenant entities are modeled as records in `public.people` with `type = 'tenant'`. 
    *   `public.tenant_balances` was retargeted to `public.people(id)` in migration `20260712020000_fix_tenant_balances_people_fk.sql`.
    *   `create_contract_atomic` validates dates, checks unit availability (blocking units in `maintenance` or `reserved`), and asserts that a contract period is covered entirely by a valid `owner_agreement`.
*   **Audit Verdict**: **HYBRID (LEGACY ORPHANED / CANONICAL CORRECT)**. 
    *   The `public.tenants` table still exists with legacy seed data (40 rows) but is completely bypassed by the React application.
    *   **Bug in Contract Date Validation**: The date overlap validation in `create_contract_atomic` evaluates overlapping periods via text casts:
        ```sql
        btrim(contract_record.start_date::text)::date <= p_end_date
        and btrim(contract_record.end_date::text)::date >= p_start_date
        ```
        This is structurally safe but represents unnecessary type-casting overhead.

### 2.4 Invoices, Payments, Receipts, & VOID Flow
*   **Database Objects**: `public.invoices`, `public.payments`, `public.receipts` (legacy view/unwired table).
*   **Logical Implementation**:
    *   An **Invoice** represents a receivable with `amount`, `paid_amount`, and `tax_amount`.
    *   A **Payment** records actual cash collected. It has `payment_date` and `status` ('POSTED', 'VOID').
    *   A **Receipt** in the application represents a *payment-backed view*. The UI loads receipts by querying `public.payments` and formats receipt numbers as `formatReceiptNumber(payment.id)`.
    *   **VOID Flow**: `void_receipt_atomic(payload)` soft-deletes receipts and reverses journal entries. It is fully company-isolated.
*   **Audit Verdict**: **MAPPED & CORRECT**. The payment-backed architecture ensures zero divergence between payment entries and customer-facing receipts.

### 2.5 Expenses, Maintenance, & Utilities
*   **Database Objects**: `public.expenses`, `public.maintenance`, `public.utility_bills`.
*   **Logical Implementation**:
    *   `expenses` handles operating expenses with `expense_date` (of type `date`) and `charged_to` ('OWNER', 'TENANT', 'OFFICE').
    *   `maintenance` links maintenance tickets to direct unit work, with resolution costs posting directly to `expenses` via `resolve_maintenance_with_expense`.
*   **Audit Verdict**: **MAPPED BUT UNUSED**. All related production tables currently have **0 active rows**.

### 2.6 Deposits, Commissions, & Bank Reconciliation
*   **Database Objects**: `public.deposit_txs`, `public.commissions`, `public.bank_reconciliation` (not an actual table, matches bank files to transactions).
*   **Logical Implementation**:
    *   `deposit_txs` tracks tenant security deposits (DRAFT/POSTED/REFUNDED).
    *   `process_bank_reconciliation_match_atomic` handles automatic debit/credit reconciliation.
*   **Audit Verdict**: **MAPPED BUT UNUSED**. All related production tables have **0 active rows**.

---

## 3. The 6 Broken Reports Audit

Six key reporting RPCs in `supabase/migrations/20260724120000_p0_company_isolation_reports_rls.sql` fail with fatal database errors. 

| Report | Code Line / Context | Root Cause Error | Impact | Required Remediation |
|---|---|---|---|---|
| **1. `rpt_trial_balance`** | `WHERE company_id = v_company_id AND date <= p_as_of` | **`operator does not exist: text <= date`** | Fails compiling and execution; completely blocks trial balance preview and export. | Change query to cast `date` to date, or use `public._safe_date(date) <= p_as_of`. |
| **2. `rpt_balance_sheet`** | `WHERE company_id = v_company_id AND date <= p_as_of` | **`operator does not exist: text <= date`** | Fails compiling and execution; blocks balance sheet page. | Apply the same fix: use `public._safe_date(date) <= p_as_of`. |
| **3. `rpt_aged_receivables`** | `(p_as_of - public._safe_date(i.due_date))::int days_overdue` | **Implicit text-to-date cast failure / Function overload mismatch** | Raises error because `i.due_date` is already of type `date`. Wrapping it in `_safe_date(text)` triggers implicit cast exceptions. | Remove the wrapper; compare dates directly: `(p_as_of - i.due_date)::int`. |
| **4. `rpt_overdue_invoices`** | `(p_as_of - public._safe_date(i.due_date))::int` | **Implicit cast failure / Mismatch** | Raises compilation error. | Remove `_safe_date` wrap on `i.due_date`. |
| **5. `rpt_rent_roll`** | `public._safe_date(c.start_date) <= p_as_of` and `public._safe_date(c.end_date) >= p_as_of` | **Implicit cast failure / Mismatch** | Raises compilation error. `c.start_date` and `c.end_date` are canonical `date` fields in the database. | Remove `_safe_date` wrapper on `contracts` start/end date fields. |
| **6. `rpt_tenant_statement`** | `JOIN properties pr ON pr.id=u.property_id WHERE c.id=p_contract_id::text` | **`column pr.name does not exist`** and **`operator does not exist: uuid = text`** | Completely blocks the tenant ledger print/export and PDF view. | 1. Change `pr.name` to `pr.title` (since properties has only `title`). <br> 2. Change `c.id=p_contract_id::text` to `c.id=p_contract_id` (since both are uuid). |

---

## 4. End-to-End Workflow Analysis

```
[Company Created] ──> [User Added] ──> [Landlord Registered] ──> [Property Registered]
                                                                        │
[Tenant Contract] <── [Unit Allocated] <── [Agreement Link] <───────────┘
       │
[Invoices Generated] ──> [Payments Received] ──> [Receipt View (Payment-Backed)]
       │
[Posted Expenses] ──> [calculate_owner_net_payout] ──> [Owner Settlement Draft]
       │                                                         │
[Journal Reversals] <─── [Settlement Paid] <─────────────────────┘
```

### 4.1 The Tenant Lifecycle
1.  **Creation**: A tenant is created as a record in `people` with `type = 'tenant'`.
2.  **Contract Drafting**: `create_contract_atomic` registers the contract, linking the tenant, unit, and property. The unit's operational status is set to `'occupied'` (handled via trigger).
3.  **Invoicing**: Periodic invoices are generated based on contract lease cycles.
4.  **Payment**: Rent is collected via `record_invoice_payment_atomic` or `post_receipt_atomic`.
5.  **Termination/Soft-Delete**: Soft delete marks contract as deleted, triggering unit status to revert to `'available'`.

### 4.2 The Landlord Lifecycle
1.  **Creation**: Landlord is created as a record in `people` with `type = 'owner'`.
2.  **Property Link**: Property is added, and linked to the owner in `property_owners` mapping.
3.  **Agreement Binding**: `owner_agreements` defines billing commissions.
4.  **Settlement Generation**: `calculate_owner_net_payout` evaluates periods. Draft settlements are persisted atomically via `create_owner_settlement_draft_atomic`.
5.  **Payout**: Approved drafts are marked `PAID` via atomic cash/payout journals.

---

## 5. Business & Calculation Logic Verification

### 5.1 Source of Authorized Values
*   **Collected Gross**: Calculated as the sum of all non-VOID, non-deleted payments tied to the owner's active contracts. **Master lease** collections belong entirely to the agency and are never counted toward owner gross.
*   **Office Commission Fee**: 
    *   *RATE Basis*: Sum of per-payment commission based on agreement percentage (calculated with 3-decimal `public._r3` precision).
    *   *FIXED_MONTHLY Basis*: Calculated as `commission_value * calendar months covered`.
*   **Expenses**: Sum of posted, owner-charged expenses during the period, restricted to properties where ownership is active during the expense date.
*   **VAT**: configures a 5% standard rate (or customizable per company setting) strictly calculated over the office commission fee, not the lease rent.
*   **Net Payable**: Derived server-side as: `greatest(gross_collected - office_fee - owner_expenses - tax_amount, 0)`.

### 5.2 Status Transitions
*   **Invoices**: `UNPAID` ──> `PARTIALLY_PAID` ──> `PAID` / `OVERDUE` / `VOID`
*   **Payments**: `POSTED` ──> `VOID` (causes soft-delete of receipt allocations)
*   **Owner Settlements**: `DRAFT` ──> `PAID` / `CANCELLED`

### 5.3 Overlap & Interval Calculation Flaw
*   **The Crucial Business Gap**: In `calculate_owner_net_payout()`, month calculations are determined as follows:
    ```sql
    greatest(
      (extract(year from least(coalesce(oa.ends_on, p_period_end), p_period_end))
         - extract(year from greatest(oa.starts_on, p_period_start))) * 12
      + extract(month from least(coalesce(oa.ends_on, p_period_end), p_period_end))
         - extract(month from greatest(oa.starts_on, p_period_start))
      + 1,
      0
    )::int as months
    ```
    This calculation treats any partial month overlap as a **full calendar month**. If an agreement begins on the 29th of July, Rentrix will charge the landlord the **entire** fixed monthly fee for July. There is no partial-month proration logic, which represents a massive business risk.

---

## 6. Frontend-to-Backend Alignment

| Frontend Layer | Backend / DB Table | Contract Alignment Status | Notes / Discrepancy |
|---|---|---|---|
| `contracts` Page Forms | `public.contracts` | **ALIGNED** | Matches fields: `start_date`, `end_date`, `rent_amount`, `payment_cycle`, `payment_terms_id`. |
| `owner-settlements` Preview | `calculate_owner_net_payout` | **ALIGNED (P1)** | Renders read-only, server-derived estimates safely. |
| `receipts` UI List | `public.payments` | **ALIGNED** | Payment-backed; view utilizes formatting helper on payment IDs. |
| `TenantWorkspaceRow` | `public.people` | **ALIGNED** | Pulls from `people` with `type='tenant'`, ignoring legacy `tenants` table. |
| Reports UI Views | `public.rpt_*` functions | **DE-ALIGNED** | The UI attempts to fetch and parse fields like `unit_name` or `property_name` from broken JSON structures. |

---

## 7. Comprehensive Gap Matrix (Current vs. Target)

| Current Behavior | Identified Problem | Target Behavior | Priority | Associated Files / DB Objects | Proposed Phase |
|---|---|---|---|---|---|
| Broken reporting RPCs | **6 RPC reports crash** due to `text <= date` and `uuid = text` mismatches. | Compile and execute flawless reports with matched types. | **P0 (Emergency)** | `supabase/migrations/20260724120000_p0_company_isolation_reports_rls.sql` | Phase 2 (Immediate) |
| Missing RLS `initplan` index optimization | RLS evaluates `auth.uid()` once per row (**79 warnings from advisor**). | Cache JWT role resolution at the query plan stage. | **P1 (High)** | `public.*` table security policies | Phase 2 (Intermediate) |
| Legacy `tenants` table exists | Redundant table with orphaned seed data causes architectural confusion. | Completely drop/purge `public.tenants` table and references. | **P2 (Medium)** | `public.tenants` | Phase 3 (Hardening) |
| Fixed monthly fees lack proration | Partial-month overlap charges full calendar monthly rate. | Implement strict day-basis proration for agreements bridging mid-months. | **P1 (High)** | `calculate_owner_net_payout()` | Phase 2 (Core Business) |
| Multi-chart-of-accounts gap | Chart of accounts is seeded globally; lacks customized corporate ledgers. | Enable per-company isolated, custom charts of accounts. | **P2 (Medium)** | `public.account_balances`, `public.settings` | Phase 3 (Hardening) |
| Leaked Password Protection disabled | Supabase Auth has standard brute-force risk on simple passwords. | Enforce leaked password checking on Supabase Auth console. | **P0 (Immediate)** | Supabase Auth Settings | Phase 2 (Security) |
