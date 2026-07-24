# Rentrix — Target Product & Financial Architecture
**Date**: 2026-07-24  
**Status**: Target Vision  
**Auditor**: Arena Agent Mode (Lead Software Architect)

---

## 1. The Target System Architecture

The target architecture for **Rentrix** aims to achieve complete modular separation, strict type alignment, and secure multi-tenant data isolation. The application must bridge high-performance React frontends with transactional database-level business logic.

```
       [ Client-Side Frontend (React 19 / Vite / Tailwind v4) ]
                               │
       [ Route-Guards & Permissive Auth (TanStack Router) ]
                               │
            [ TanStack Query (State & Cache Layer) ]
                               │
     ===================[ Supabase API Boundary ]===================
                               │
               [ RLS (Restrictive Policy Isolation) ]
                               │
       [ Security Definer transactional API (Atomic RPCs) ]
                               │
         [ Double-Entry Ledger Engine (Journal & Accounts) ]
```

### Key Pillars
1.  **Zero-Leak Multi-Tenancy**: Maintain the `company_isolation` RESTRICTIVE security policies verified in P0. All direct REST access and RPC execution must check the active JWT-based `company_id`.
2.  **No Client-Side Financial Derivation**: Prevent client-side math drift. All cash math, Vat calculation, and payout values are generated inside SECURE DEFINER SQL functions and presented on the frontend as read-only states.
3.  **Atomic Write Paths**: All database write operations (Contract Creation, Payment receipts, Settlement drafting) are handled via atomic transaction blocks, wrapped inside SQL RPCs with advisory locking, preventing double-clicks or race conditions.

---

## 2. Final Financial Module Structure (Double-Entry Ledger)

Rentrix's financial module will migrate from direct table aggregations to a unified **Double-Entry Bookkeeping Ledger**.

### 2.1 The Unified Chart of Accounts (COA)
Every transaction must map to the unified Chart of Accounts, isolated per company:

*   **1000 - Assets**
    *   `1111 - Cash on Hand` (Rent collections custody)
    *   `1112 - Bank Account` (Custom bank-reconciled account)
    *   `1201 - Tenant Receivables` (Accounts Receivable)
*   **2000 - Liabilities**
    *   `2100 - VAT Payable` (GCC 5% Tax liability)
    *   `2201 - Owner Payables` (Net settlements owed to landlords)
    *   `2301 - Security Deposits Held` (Escrow/Trust liabilities)
*   **3000 - Equity**
    *   `3001 - Retained Earnings` (Balancing equity node)
*   **4000 - Revenue**
    *   `4101 - Rental Income` (Direct tenant charges)
    *   `4201 - Agency Commission Fees` (Office earnings)
*   **5000 - Expenses**
    *   `5101 - Operational & Maintenance Expenses` (Property repairs)

### 2.2 Atomic Journal Entries
Every financial operation (such as Invoice Generation, Receipt Post, Owner Settlement, Expense Payment) inserts balanced, non-deletable double-entry credit/debit records into a central journal:

```
[Invoice Created]   ──> Debit  (1201 - Tenant Receivables)
                    ──> Credit (4101 - Rental Income)
                    ──> Credit (2100 - VAT Payable) [If Commercial]

[Payment Received]  ──> Debit  (1111 - Cash on Hand)
                    ──> Credit (1201 - Tenant Receivables)

[Settlement Draft]  ──> Debit  (4101 - Rental Income)  [Owner payout deduction]
                    ──> Credit (2201 - Owner Payables) [Net payable]
                    ──> Credit (4201 - Commission Fee) [Office revenue]
```

---

## 3. Final Reports & Document Engine

### 3.1 Structural Reporting Engine
Instead of querying raw tables directly (which causes drift and type-casting issues), all financial statements (Trial Balance, Profit & Loss, Cash Flow) query the unified **`journal_entries`** and **`account_balances`** ledgers:

```sql
-- Target report query structure for Balance Sheet
SELECT COALESCE(SUM(debit - credit), 0) as balance
FROM public.journal_entries
WHERE company_id = public.current_company_id()
  AND account_code = '1111'
  AND entry_date <= p_as_of;
```

This single-source-of-truth strategy guarantees that the **Trial Balance always balances** and matches active transaction statements perfectly.

### 3.2 Drilled-Down Statement UX
The reporting interface will support hierarchical drill-downs:
```
[Balance Sheet] ──(Click "Tenant Receivables")──> [Tenant Subledger List]
                                                           │
                                                  (Click Tenant A)
                                                           │
                                                           ▼
                                               [Tenant Ledger Statement]
                                                           │
                                                  (Click Invoice #102)
                                                           │
                                                           ▼
                                                  [Tax Invoice Modal]
```

### 3.3 GCC Tax-Compliant Documents & Printing
*   **Official Correspondence**: Standardized print layouts in Arabic and English, utilizing RTL CSS page controls (`@media print { body { direction: rtl; } }`).
*   **Spell-Out Numbers**: Implementation of server-side/client-side Arabic numeric-to-words spelling helpers for physical contract submissions to Oman judicial portals.

---

## 4. Navigation Flow & System Mapping

```
                                [ DASHBOARD ]
                                 │       │
            ┌────────────────────┘       └────────────────────┐
            ▼                                                 ▼
     [ Operational Hub ]                              [ Financial Hub ]
      ├── Properties                                   ├── Invoices
      │     └── Unit Allocation                        │     └── Quick Collect Form
      ├── Tenants & Leases                             ├── Receipts & Voids
      │     └── Active Contracts                       ├── Expenses & Maintenance
      └── Landlords                                    └── Owner Settlements
            └── Owner Agreements                             └── Preview Payouts
                    │                                                 │
                    └─────────────────> [ REPORTING ] <───────────────┘
                                         ├── Trial Balance
                                         ├── Balance Sheet
                                         └── Tenant Ledger Statement (PDF/Print)
```
