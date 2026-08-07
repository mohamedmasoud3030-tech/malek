# S08 — Real Schema Mapping (origin/main@6bc8eb4)

This document maps S08 conceptual entities to the actual physical schema in `origin/main`.

## Core tables (20250101000001_core_schema.sql)

| Concept | Physical table | Key columns (real) | Notes |
|---------|---------------|-------------------|-------|
| Company | `public.companies` | `id uuid`, `name text`, `slug text`, `currency text`, `is_active bool` | No `deleted_at`; use `is_active` |
| Owner | `public.owners` | `id uuid`, `full_name text` | Also `public.people` type=owner |
| Property | `public.properties` | `id uuid`, `title text` (NOT `name`), `type text`, `address text`, `deleted_at timestamptz` | UI name = `title` |
| Person/Tenant | `public.people` | `id uuid`, `full_name text`, `type text` | Tenant linkage via `contracts.tenant_id -> people.id` |
| Contract | `public.contracts` | `id uuid`, `property_id uuid`, `tenant_id uuid`, `start_date date`, `end_date date`, `rent_amount numeric` | Versioning via `renewed_from_id` |
| Invoice | `public.invoices` | `id uuid`, `contract_id uuid`, `issue_date date`, `due_date date`, `amount numeric`, `paid_amount numeric`, `status text` (UNPAID/PAID), `deleted_at timestamptz` | Soft delete via `deleted_at` |
| Payment | `public.payments` | `id uuid`, `invoice_id uuid`, `contract_id uuid`, `amount numeric`, `payment_date date`, `status text` (POSTED), `deleted_at timestamptz`, `receipt_id uuid` | Hardened `company_id` added in phase 2 (20260722) |
| Receipt | `public.receipts` | `id uuid`, `no text`, `contract_id uuid`, `amount numeric`, `status text`, `payment_id uuid`, `request_id text`, `deleted_at timestamptz` | 1-1 with payments via `payment_id` |
| Allocation | `public.receipt_allocations` | `id uuid`, `receipt_id uuid`, `invoice_id uuid`, `amount numeric` | Clears tenant receivable |
| Expense | `public.expenses` | `id uuid`, `property_id uuid`, `category text`, `amount numeric`, `expense_date date`, `deleted_at timestamptz` | `company_id` added phase 2; `charged_to` is extra app logic, not in core DDL |
| Tenant Deposit | `public.tenant_deposits` | `id text`, `contract_id uuid` (FK contracts.id), `property_id uuid`, `deposit_amount numeric`, `remaining_amount numeric`, `status text` (held/partially_refunded...) | Created 20260718100928 |
| Deposit Tx | `public.deposit_transactions` | `id uuid`, `deposit_id text`, `type text` (held/deduction/refund), `amount numeric`, `reason text`, `request_id text` | Immutable log |
| Owner Agreement | `public.owner_agreements` | `id uuid`, `owner_id uuid`, `property_id uuid`, `agreement_type text` (property_management/master_lease), `commission_type text`, `commission_value numeric`, `starts_on date`, `ends_on date` | Versioning via multiple rows per property |
| Owner Settlement | `public.owner_settlements` | `id text`, `no text`, `owner_id text`, `date text`, `amount numeric`, `status text` (PENDING/PAID/CANCELLED) | `company_id` added via phase 2 (composite FK) |
| Settlement Payment Link | `public.owner_settlement_payment_links` | `id uuid`, `company_id uuid`, `settlement_id text`, `payment_id uuid`, `released_at timestamptz` | FA003 atomic reservation |
| Settlement Expense Link | `public.owner_settlement_expense_links` | `id uuid`, `company_id uuid`, `settlement_id text`, `expense_id uuid`, `released_at timestamptz` | FA003 |
| Accounts (GL) | `public.accounts` | `id text`, `no text`, `name text`, + stage3: `account_type text`, `normal_balance text`, `currency_code text`, `precision smallint` | Company scoped in stage3 |
| Journal Batches | `public.journal_batches` | `id uuid`, `company_id uuid`, `status text` (DRAFT/POSTED/REVERSED), `source_type text`, `source_id text`, `event_id text`, `effective_date date`, `accounting_period_id uuid`, `posted_at timestamptz` | Stage3 canonical GL |
| Journal Lines | `public.journal_lines` | `id text`, `batch_id uuid`, `company_id uuid`, `account_id text`, `debit numeric(18,3)`, `credit numeric(18,3)` | OMR 3 dp |
| Accounting Periods | `public.accounting_periods` | `id uuid`, `company_id uuid`, `name text`, `start_date date`, `end_date date`, `status text` (OPEN/SOFT_CLOSED/HARD_CLOSED) | No `currency_code`; assume OMR |
| Audit Log | `public.audit_log` | `id uuid`, `action text`, `entity text`, `entity_id text`, `created_at timestamptz` | Append-only |

## Master lease note

There is **no dedicated `master_leases` table**. Master leases are encoded as `owner_agreements.agreement_type='master_lease'`. ROU asset / lease liability fields referenced in S08 spec are *conceptual*; physical storage is via journal batches with source_type='master_lease' and GL accounts 1600/2500. Therefore:

- `commencement_date` → `owner_agreements.starts_on`
- `lease_term` → `ends_on - starts_on` months
- `discount_rate` → NOT stored (INSUFFICIENT_HISTORY)
- `ROU Asset / Liability` → GL balances (account 1600/2500), NOT in agreement row → NOT_OBSERVABLE directly

S08 reports `MISSING_CRITICAL_DATA` when these are absent and `NOT_A_MASTER_LEASE` for property_management rows.

## Gaps and S08 handling

| Requested field | Real source | S08 action if missing |
|----------------|-------------|----------------------|
| `owner_name` from settlements | Join `owners.full_name` or `people.full_name` via `property_owners` | If `owner_id` text cannot be cast to uuid, emit `orphan_owner_id` finding |
| `property_name` | `properties.title` | Use `title`; if null emit NOT_OBSERVABLE |
| `company_id` on invoices/payments/expenses | Backfilled via 20260722 phase2; may be NULL for very old rows | Row classified `INSUFFICIENT_HISTORY` |
| `currency` per row | `companies.currency` (single per company) | Default OMR, 3 dp |
| `charged_to / beneficiary` on expenses | Not in core DDL; stored in app layer or `maintenance_records.charged_to` | If absent → `NOT_OBSERVABLE` + finding `MISSING_BENEFICIARY` |
| `claim/evidence` for deposits | `deposit_transactions.reason` + `request_id` | If `reason` null → `DEDUCTION_WITHOUT_BENEFICIARY` |

## Company isolation

Every S08 view/function filters by `company_id = :p_company_id`. RLS policies (`p0_tenant_isolation` restrictive) enforce the same at DB level. Cross-company reads are blocked.

## No financial writes

All S08 objects are `SELECT` only. Migration contains no `INSERT/UPDATE/DELETE/TRUNCATE` on financial tables (verified by `scripts/s08/check-read-only.mjs`).
