# Database Architecture

## Overview

Rentrix uses PostgreSQL through Supabase for operational real-estate management, financial workflows, reporting, and access control.

The active database architecture is organized into:

- master/reference tables
- operational tenancy and property lifecycle tables
- financial transaction tables
- denormalized balance tables
- reporting functions and views
- security helpers, RLS, and browser-facing RPCs

## Core table groups

### Identity and application access

- `public.users`
- `public.profiles`
- `public.sessions`

### Property and ownership

- `public.owners`
- `public.properties`
- `public.property_owners`
- `public.owner_agreements`
- `public.units`

### Tenant and contract domain

- `public.people`
- `public.tenants` (legacy/supporting table retained in baseline)
- `public.contracts`
- `public.contract_documents`
- `public.payment_terms_templates`

### Billing and receipts

- `public.invoices`
- `public.payments`
- `public.receipts`
- `public.receipt_allocations`
- `public.financial_operation_idempotency`

### Expenses and maintenance

- `public.expenses`
- `public.maintenance_records`
- `public.cost_centers`
- `public.utility_bills`

### Accounting and balances

- `public.accounts`
- `public.journal_entries`
- `public.contract_balances`
- `public.owner_balances`
- `public.tenant_balances`
- `public.owner_settlements`

### Reporting and audit

- `public.audit_log`
- reporting views and `rpt_*` functions

## Contract lifecycle

Primary table:

- `public.contracts`

Lifecycle operations are enforced through RPCs rather than direct business-logic updates.

Main lifecycle states include:

- draft
- active
- expired
- terminated
- ended/legacy state values preserved where required by existing production behavior

Main lifecycle RPCs:

- `create_contract_atomic`
- `update_contract_atomic`
- `renew_contract_atomic`
- `terminate_contract_atomic`
- `soft_delete_contract_atomic`

Key protections:

- property/unit validation
- owner agreement coverage validation
- overlap prevention
- role checks
- row locking for mutation-sensitive flows

## Invoice lifecycle

Primary table:

- `public.invoices`

Invoices are tied to contracts and represent receivable obligations.

Core lifecycle patterns:

- generation from active contracts
- payment posting through receipt/payment RPC flows
- status recalculation based on `paid_amount`, amount, tax, and void state
- future unpaid invoice cancellation for certain contract termination/delete flows

Relevant functions:

- `generate_invoices_from_active_contracts`
- `recalculate_invoice_status`
- report functions reading invoice state

## Payment lifecycle

Primary table:

- `public.payments`

Payments represent collected money and are tightly coupled to receipts and invoice settlement behavior.

Core characteristics:

- payment posting is routed through atomic RPC logic
- overpayment guards are enforced
- idempotency is enforced using request IDs
- payment/receipt linkage is preserved for frontend and reporting compatibility

Relevant functions:

- `record_invoice_payment_atomic`
- `post_receipt_atomic`
- `find_payment_account_id`

## Receipt lifecycle

Primary tables:

- `public.receipts`
- `public.receipt_allocations`

Receipts are the formal collection records.
Receipt allocations connect receipts to invoices and drive invoice paid-state transitions.

Core behaviors:

- receipt posting is atomic
- invoice rows are locked during settlement-sensitive flows
- allocations update invoice balances
- voiding reverses effects and preserves transactional safety behavior

Relevant functions:

- `post_receipt_atomic`
- `void_receipt_atomic`

## Owner settlements

Primary table:

- `public.owner_settlements`

Owner settlements are retained in the baseline as part of the financial model and are used by owner reporting logic.
They participate in owner statement reporting and operational financial summaries.

## Accounting journal flow

Primary tables:

- `public.accounts`
- `public.journal_entries`

Accounting flow is operational and RPC-driven.
The application preserves journal integrity by posting journal entries within atomic financial routines.

Examples:

- payment posting creates debit/credit journal rows tied to receipt/payment flows
- expense posting can create journal entries through `create_expense_with_journal_atomic`
- journal immutability protections are enforced through triggers for posted entries

Supporting protections:

- `audit_journal_entry_insert`
- `prevent_posted_journal_entry_mutation`

## Reporting layer

Key views:

- `public.v_balance_reconciliation`
- `public.v_balance_reconciliation_drift`
- `public.vw_active_owner_agreements`

Key RPC reports:

- `rpt_financial_summary`
- `rpt_cash_flow`
- `rpt_vat_return`
- `rpt_owner_statement`
- `rpt_tenant_statement`
- `rpt_trial_balance`
- `rpt_income_statement`
- `rpt_balance_sheet`
- `rpt_daily_collection`
- `rpt_dashboard_overview`

## Security architecture summary

The schema is secured through:

- RLS on exposed tables
- role helper functions
- controlled browser-facing RPC grants
- `SECURITY DEFINER` for privileged routines where required
- explicit revocation for internal helper routines
