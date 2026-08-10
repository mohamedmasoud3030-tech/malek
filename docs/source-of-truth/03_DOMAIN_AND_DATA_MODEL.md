# MALEK Canonical Pack — Document 3: Domain and Data Model

> **Status:** CANONICAL  
> **Rule ID Prefix:** DOM-###  
> **Effective Date:** 2026-08-10

---

## 1. Domain Entities Overview

### 1.1 Entity List

| Entity | Table | Purpose | Status |
|--------|-------|---------|--------|
| Company | `companies` | Tenant boundary | VERIFIED_COMPLETE |
| User | `users` | Authentication and authorization | VERIFIED_COMPLETE |
| Person | `people` | Canonical person record (owner/tenant/contact) | VERIFIED_COMPLETE |
| Property | `properties` | Real estate unit container | VERIFIED_COMPLETE |
| Unit | `units` | Individual rentable space | VERIFIED_COMPLETE |
| PropertyOwnership | `property_ownership` | Temporal owner link | VERIFIED_COMPLETE |
| OwnerAgreement | `owner_agreements` | Owner contract terms | PARTIAL |
| Contract | `contracts` | Tenant lease agreement | PARTIAL |
| Invoice | `invoices` | Rent billing | IMPLEMENTED_UNVERIFIED |
| Receipt | `receipts` | Payment records | IMPLEMENTED_UNVERIFIED |
| Expense | `expenses` | Operational costs | PARTIAL |
| Deposit | `deposits` | Tenant security | IMPLEMENTED_UNVERIFIED |
| OwnerSettlement | `owner_settlements` | Owner payment runs | PARTIAL |
| Commission | `commissions` | Brokerage/service fees | IMPLEMENTED_UNVERIFIED |
| MaintenanceRecord | `maintenance_records` | Work orders | IMPLEMENTED_UNVERIFIED |
| BankImportBatch | `bank_import_batches` | CSV import batches | IMPLEMENTED_UNVERIFIED |
| BankTransaction | `bank_transactions` | Imported bank rows | IMPLEMENTED_UNVERIFIED |
| Account | `accounts` | Chart of accounts | IMPLEMENTED_UNVERIFIED |
| AccountingPeriod | `accounting_periods` | Fiscal periods | IMPLEMENTED_UNVERIFIED |
| JournalBatch | `journal_batches` | GL posting batches | IMPLEMENTED_UNVERIFIED |
| JournalLine | `journal_lines` | GL entry lines | IMPLEMENTED_UNVERIFIED |
| ServiceProvider | `service_providers` | Maintenance vendors | PARTIAL |

**Note:** `tenants` table is deprecated; all tenant references must use `people` with `type='tenant'`.

---

## 2. Ownership and Company Scope

### 2.1 Company Boundary

**DOM-101 — Company as Tenant Boundary**

Every operational table contains a `company_id` column establishing the tenant boundary. Multi-company support is enabled via `app_metadata.company_id` in JWT claims.

**DOM-102 — Active Company Resolution**

```sql
current_company_id() → company_id
```

This function extracts the user's active company from their Supabase Auth JWT claims.

**DOM-103 — Company Membership**

Users may belong to multiple companies via `company_memberships` table. Active company is selected at login or switch.

---

## 3. Key Entity Relationships

### 3.1 Property Hierarchy

```
Company
  └── Property (property_ownership temporal links to Owner)
        └── Unit(s)
```

**DOM-201 — Property**

- `id`: UUID primary key
- `company_id`: FK to companies
- `owner_id`: Optional FK to people (nullable; ownership via property_ownership preferred)
- `title`, `address`, `type`, `status`
- `is_archived`: Soft delete flag

**DOM-202 — Unit**

- `id`: UUID primary key
- `property_id`: FK to properties
- `company_id`: FK to companies
- `unit_number`, `floor`, `rent_amount`, `status` (vacant/occupied/maintenance)
- `is_archived`: Soft delete flag

**DOM-203 — PropertyOwnership (Temporal)**

- Links property to owner with date range
- `starts_on`, `ends_on`: Temporal validity
- `owner_id`: FK to people

---

### 3.2 Owner Agreement Hierarchy

```
Company
  └── OwnerAgreement
        ├── operating_model (OWNER_AGENCY / MASTER_LEASE / OFFICE_OWNED)
        ├── collection_role (OWNER_IS_CREDITOR / OFFICE_IS_CREDITOR)
        ├── commission_type (RATE / FIXED_MONTHLY)
        └── commission_value
  └── Contract (references OwnerAgreement)
        └── Unit (within Property)
```

**DOM-210 — OwnerAgreement**

- `id`: UUID primary key
- `owner_id`: FK to people (owner)
- `property_id`: FK to properties
- `agreement_type`: 'property_management' | 'master_lease'
- `commission_type`: 'RATE' | 'FIXED_MONTHLY'
- `commission_value`: Numeric
- `starts_on`, `ends_on`: Date range
- `status`: 'draft' | 'active' | 'terminated' | 'expired'
- `operating_model`: Stored explicitly
- `collection_role`: Stored explicitly

**Constraints:**
- Overlap check prevents multiple active agreements for same property
- Agreement must cover contract period

---

### 3.3 Contract Hierarchy

**DOM-220 — Contract**

- `id`: UUID primary key
- `company_id`: FK to companies
- `tenant_id`: FK to people (tenant)
- `unit_id`: FK to units
- `property_id`: FK to properties
- `agreement_id`: FK to owner_agreements (references covering agreement)
- `start_date`, `end_date`: Contract period
- `rent_amount`: Per payment cycle
- `payment_cycle`: 'monthly' | 'quarterly' | 'semi-annual' | 'annual'
- `status`: 'draft' | 'active' | 'expired' | 'terminated'
- `renewed_from_id`: FK to previous contract (for renewals)

**Constraints:**
- No overlap with existing active/draft contract for same unit
- `collection_role` snapshotted from agreement at activation

---

### 3.4 Financial Entities

**DOM-230 — Invoice**

- `id`: UUID primary key
- `contract_id`: FK to contracts
- `amount`, `due_date`
- `status`: 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
- `period_key`: YYYY-MM for period matching
- `tax_amount`, `tax_code_id`: VAT support

**DOM-231 — Receipt**

- `id`: UUID primary key
- `invoice_id`: FK to invoices (nullable for standalone payments)
- `amount`, `payment_date`
- `payment_method`: 'cash' | 'bank_transfer' | 'check'
- `reference_number`: Bank reference
- `status`: 'completed' | 'voided'
- `void_reason`, `voided_at`, `voided_by`

**DOM-232 — Receipt Allocation**

- Links receipt to invoice(s) for partial payments
- `receipt_id`, `invoice_id`, `amount`

---

### 3.5 Deposit Entities

**DOM-240 — Deposit**

- `id`: UUID primary key
- `tenant_id`: FK to people
- `contract_id`: FK to contracts (nullable until contract created)
- `amount`, `received_date`
- `status`: 'held' | 'applied' | 'refunded'
- `beneficiary`: 'tenant' | 'owner' | 'office'

**DOM-241 — Deposit Transaction**

- Atomic movement of deposit funds
- `deposit_id`, `type` (receive/apply/refund)
- `amount`, `date`, `reference_invoice_id`, `notes`

---

### 3.6 Expense Entities

**DOM-250 — Expense**

- `id`: UUID primary key
- `property_id`, `unit_id`: FKs
- `amount`, `expense_date`, `description`
- `responsibility`: 'owner' | 'office' | 'shared'
- `cost_center_id`: FK for reporting
- `status`: 'pending' | 'approved' | 'paid'
- `is_archived`: Soft delete

---

### 3.7 Owner Settlement Entities

**DOM-260 — OwnerSettlement**

- `id`: UUID primary key
- `owner_id`: FK to people
- `agreement_id`: FK to owner_agreements
- `period_start`, `period_end`: Settlement period
- `gross_revenue`, `expenses_deducted`, `fees_deducted`, `net_payout`
- `status`: 'draft' | 'approved' | 'paid'
- `paid_at`, `payment_method`, `payment_reference`

**DOM-261 — SettlementPaymentLink**

- Links collection receipts to settlement
- `settlement_id`, `receipt_id`
- `amount`, `reservation_id`

**DOM-262 — SettlementExpenseLink**

- Links owner expenses to settlement
- `settlement_id`, `expense_id`
- `amount`

---

## 4. Aggregate and Lifecycle Boundaries

### 4.1 Immutable Records

**DOM-301 — Posted Financial Records**

The following records are append-only after POSTED status:
- `journal_batches` with status 'POSTED'
- `journal_lines` in POSTED batches
- `invoices` with status 'paid'
- `receipts` with status 'completed'
- `owner_settlements` with status 'paid'

**DOM-302 — Void/Reversal**

Errors are corrected via:
- Balanced reversal journal batches
- Credit notes (planned)
- Adjustment entries (planned)

**DOM-303 — Soft Delete**

Most entities support `is_archived` or `deleted_at` for soft deletion. Financial records are never physically deleted.

---

### 4.2 Status Enums

**DOM-310 — Contract Status**
```
draft → active → expired
              ↘ terminated
```

**DOM-311 — Invoice Status**
```
unpaid → partially_paid → paid
       ↘ overdue
Any → cancelled (void)
```

**DOM-312 — Owner Agreement Status**
```
draft → active → terminated
              ↘ expired
```

**DOM-313 — Accounting Period Status**
```
OPEN → SOFT_CLOSED → HARD_CLOSED
                  ↺ (reopen with permission)
```

**DOM-314 — Owner Settlement Status**
```
draft → approved → paid
```

---

## 5. Source of Truth for Balances

**DOM-401 — GL as Source of Truth**

The General Ledger is the authoritative source for financial statements:
- `journal_batches` + `journal_lines` = authoritative balances
- All financial reports derive from GL

**DOM-402 — Operational Subledgers**

Operational subledgers maintain detailed operational tracking:
- Tenant Receivables subledger (invoices, receipts, allocations)
- Owner Funds subledger (collections, settlements, due-from-owner)
- Deposit subledger (receipts, applications, refunds)

**DOM-403 — Reconciliation Requirement**

Subledger balances must reconcile to GL control accounts:
| Subledger | Control Account |
|-----------|-----------------|
| Tenant AR | 1201 Tenant Receivables |
| Owner Payables | 2000 Owner Funds Payable |
| Due from Owners | 1205 Due from Owners |
| Tenant Deposits | 2200 Tenant Deposits Payable |
| VAT | 2100 VAT Payable |

---

## 6. Cross-Entity Invariants

**DOM-501 — No Cross-Company References**

- All FK references must include company_id check
- Cross-company joins must be prohibited by RLS

**DOM-502 — Temporal Validity**

- Owner agreements must cover contract period
- Property ownership must be active for agreement validity
- Overlapping active agreements for same property are prohibited

**DOM-503 — Reservation Atomicity**

- Settlement inputs (receipts, expenses) cannot appear in two active settlements
- Reservation ID links source records to settlement

**DOM-504 — Collection Role Immutability**

- `collection_role` is snapshotted into contract at activation
- Cannot be changed after activation without new contract

---

## 7. Multi-Company Constraints

**DOM-601 — Account Isolation**

- `accounts.no` is globally unique but company-scoped in queries
- Account lookups must include company_id

**DOM-602 — Batch Isolation**

- Journal batches are company-scoped
- Period queries include company_id

**DOM-603 — Report Isolation**

- All reports filter by company_id from JWT
- Cross-company aggregation is prohibited

---

## 8. Implemented vs. Planned Entities

### Fully Implemented

| Entity | Evidence |
|--------|----------|
| Company, User, Person | Core schema migrations |
| Property, Unit | CRUD operations verified |
| PropertyOwnership | Temporal links implemented |
| Contract (basic) | 4-state lifecycle |
| Invoice (basic) | Create/void operations |
| Receipt (basic) | Record/void operations |
| Expense (basic) | CRUD operations |
| Deposit (basic) | Receive/refund operations |
| Journal batches/lines | Stage 3 GL engine |

### Partially Implemented

| Entity | Gap |
|--------|-----|
| OwnerAgreement | Versioning, full terms |
| Contract | Maker-Checker, signatures |
| Invoice | Full GL wiring |
| Receipt | Full GL wiring |
| Deposit | Full allocation workflow |
| OwnerSettlement | Due-from-Owner recovery |
| AccountingPeriod | Close checklist |

### Planned (Not Started)

| Entity | Blocker |
|--------|---------|
| Credit Note | S05 not started |
| Late Fee Engine | S05 not started |
| Master Lease Module | S06 not started |
| Historical Analysis (S08) | Blocked on S07 |
| Historical Correction (S09) | Blocked on S08 |
| Full Reconciliation | FGR-006 pending |

---

## 9. Database Schema Location

Primary schema definition:
- `supabase/migrations/20250101000001_core_schema.sql` — Base tables
- `supabase/migrations/20260804030000_stage3_gl_core_chart_of_accounts_and_periods.sql` — GL
- `supabase/migrations/20260804030100_stage3_gl_core_journal_batches_and_lines.sql` — Journal

RLS policies:
- `supabase/migrations/rls_per_table/` — Per-table RLS definitions
- `supabase/migrations/20260807232413_harden_rls_membership_and_invoker_helpers.sql` — Helpers

---

## 10. Key Constraints

**DOM-1001 — Financial Decimal Precision**

All monetary values stored with `NUMERIC(18,3)` precision.

**DOM-1002 — Date Format**

All dates stored as `DATE` or `TIMESTAMPTZ` in ISO 8601 format (YYYY-MM-DD).

**DOM-1003 — UUID Primary Keys**

All tables use UUID primary keys for global uniqueness.

**DOM-1004 — Audit Columns**

Core tables include:
- `created_at`: Creation timestamp
- `updated_at`: Last modification timestamp
- `deleted_at`: Soft delete timestamp (nullable)

---

## Cross-References

- **Financial Model:** `04_FINANCE_AND_ACCOUNTING_MODEL.md`
- **Architecture:** `05_SYSTEM_ARCHITECTURE_AND_SECURITY.md`
- **Traceability:** `07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`
- **Migrations:** `supabase/migrations/`
