# MALEK — Business Constitution & Accounting (Document 2)

> **Execution-Ready Source of Truth.** Created on 2026-08-07. This document represents the binding business logic, canonical double-entry accounting specifications, legal evidence requirements, and print standards for the MALEK application.

---

## SECTION 1: THE BUSINESS CONSTITUTION (RULES D01–D18)

This section restates and consolidates the core, change-controlled business and operating policies of the platform. In any wording dispute, the Arabic locked constitution (`docs/business/CANONICAL_BUSINESS_AND_CONTRACT_RULES_AR.md`) wins.

### 1. Invoices & Tenant Receivables [D01]
- **OWNER_IS_CREDITOR Model (Agency):** The lease invoice and resulting receivable belong in the tenant subledger, not the office GL. Rent is never recorded as office revenue. A collection into the office bank account creates a corresponding `Owner Funds Payable` liability.
- **OFFICE_IS_CREDITOR Model (Master Lease):** Invoicing posts `Dr Tenant Receivable` and `Cr Rental Revenue`. Collections post `Dr Bank` and `Cr Tenant Receivable`.
- The `collection_role` is determined by the active operating model and snapshotted directly into the contract at activation.

### 2. Office Fees & Revenue Recognition [D02, D03]
- **RATE (%) Management Fees:** Office revenue is recognized **only upon actual cash collection** from the tenant. Management fees cannot be recognized on mere invoicing or billing.
- **FIXED_MONTHLY Fees:** Office revenue accrues **daily** over the service period. **There is no FULL_MONTH default.** Mid-month activations or cancellations are prorated based on the exact day count.
- **Brokerage Fees:** Recognized only upon the activation of a signed lease contract. Any pre-activation collections are classified as deferred liabilities.
- **Renewal Fees:** Recognized on activation of the renewed contract version.
- **Setup Fees:** Recognized upon accepted and signed property handover records.
- **VAT on Fees:** Applicable only when VAT is explicitly enabled in company settings; is added as a separate line-level credit to `VAT Payable` (account **2100**).
- Voids, refunds, or reversals must automatically and proportionally reverse the related office fee with a clear audit trail.

### 3. Master Leases [D07]
- The office is the sole principal toward sub-tenants. The office's obligation to pay the landlord persists **regardless of sub-tenant occupancy or vacancy**.
- Master-lease obligations must be posted to dedicated lease liability accounts, never to regular owner-payables accounts.
- Initial measurement at commencement creates a Right-of-Use (ROU) asset and corresponding lease liability, using the implicit interest rate (or incremental borrowing rate).

### 4. Owner Expenses & Offsetting [D04]
- Payments made by the office on behalf of an owner are posted as `Dr Due from Owner / Cr Bank`. They are never office expenses.
- Offsetting owner expenses against rental payouts requires explicit contractual rights and must follow this rigid sequence:
  1. Outstanding due owner expenses.
  2. Office fees and related VAT.
  3. Approved reserve top-ups.
  4. Net owner payout.
- If owner payables are insufficient to cover expenses, the remaining balance is held as `Due from Owner` (account **1205**). An owner's payable account balance **must never go negative**.

### 5. Tenant Deposits [D05]
- Tenant deposits are strictly held as a **liability** (account **2200** Tenant Deposits Payable) and are never recognized as revenue upon receipt.
- Application of a deposit to damages or rent arrears requires: an approved invoice, documented evidence, allocation links, and an atomic deposit transaction.
- Refunding a deposit requires an explicit Payment-Out transaction. Deletion of deposit records is forbidden.

### 6. Accounting Periods [D06]
- Monthly periods follow the workflow: `OPEN → SOFT_CLOSED → HARD_CLOSED`.
- `SOFT_CLOSED` blocks ordinary user postings. Only approved adjusting entries are allowed. Reopening requires administrative role with logged justification.
- `HARD_CLOSED` is final and irreversible.
- Events occurring after a period is closed must be posted into the **first eligible open period**, preserving the original `effective_date` while writing `late_posting=true` and current `posted_at` date.

### 7. Late Fees & Penalties [D09]
- Disabled by default. Requires explicit contract clauses detailing grace periods and caps.
- Compound penalties are strictly banned. A late fee is billed as an independent charge line with its own account.

### 8. Early Lease Termination [D10]
- Cancels future unpaid invoices; all paid invoices and historical ledger lines are preserved.
- Termination penalties are generated only if explicitly specified by contract rules.

### 9. Maker-Checker Approvals & Signatures [D11]
- The creator of a lease contract is blocked from approving it. Dual sign-off is mandatory.
- Contracts cannot be activated without recorded signature evidence (document hash, signer identities, IP, and timestamp).

### 10. Property Onboarding [D12]
- Follows a structured checklist: data entry → owner agreement creation → document uploads → units provisioning → initial inspection → risk assessment → final handover.
- Key ownership identities, company bounds, and structural safety checks cannot be waived.

### 11. Amendments & Contract Versions [D13]
- Silent retroactive edits are prohibited. Changes spawn a new version with an `effective_from` date, preserving previous version snapshots.

### 12. Owner Settlements [D14]
- Rent collections and expenses are **atomically reserved** at draft settlement. Once reserved, they cannot be pulled into any other settlement.
- Payout amounts are **server-derived** and re-derived at approval and payment.

### 13. Voids, Reversals, & Credit Notes [D15]
- Posted transactions are never deleted. Errors are corrected via append-only reversals or credit notes.
- Voids generate balanced opposite journal entries, restore unpaid status to invoices, and update statement balances immediately.

### 14. Bank CSV Imports [D16]
- Validates the entire batch before writing. Any validation failure in a single row blocks the entire file import.
- Row-level duplicate checks are enforced on date, amount, reference, and batch hashes.

### 15. Historical Corrections [D17]
- Requires a read-only analysis run followed by authorized append-only correction batches carrying extensive audit metadata.

### 16. Execution Governance [D18]
- All feature additions or migrations must go through the 10-stage master plan. No shortcuts are permitted.

---

## SECTION 2: CANONICAL GL PLATFORM SPECIFICATIONS

The ledger platform represents the absolute financial truth of the application.

### 1. Storage Precision & Money Representation
- Currency: **OMR** (Omani Rial).
- Decimal Precision: **3 decimal places** (e.g., `1,250.500`).
- Rounding: Bank-standard rounding (`round(value, 3)`) performed strictly **once, server-side**, before writing to database.
- Frontends must never perform rounding math for ledger insertion.

### 2. Physical Database Tables
- **`journal_batches`:** Captures batch lifecycle (`DRAFT → POSTED → REVERSED`), company bounds, posting dates, and unique business event links.
- **`journal_lines`:** Holds balanced, double-entry rows. debits or credits only.
- **`journal_entries` View:** Read-only compatibility view wrapping canonical lines, allowing legacy reports to function without changes.
- **`journal_entries_archive`:** Frozen table preserving unbalanced legacy transactions prior to Stage-3.

### 3. Chart of Accounts (COA)
The platform seeds and locks **18 required accounts** per company upon creation:

| Account Number | Account Name | Normal Balance | Account Type |
|---|---|---|---|
| **1111** | Cash on Hand | Debit | Asset |
| **1112** | Bank Account | Debit | Asset |
| **1201** | Tenant Receivables | Debit | Asset |
| **1205** | Due from Owners | Debit | Asset |
| **1600** | Right-of-Use Asset | Debit | Asset |
| **2000** | Owner Payables | Credit | Liability |
| **2100** | VAT Payable | Credit | Liability |
| **2200** | Tenant Deposits Payable | Credit | Liability |
| **2500** | Lease Liability | Credit | Liability |
| **3001** | Retained Earnings | Credit | Equity |
| **4000** | Rental Revenue | Credit | Revenue |
| **4100** | Management Fee Revenue | Credit | Revenue |
| **4200** | Commission Revenue | Credit | Revenue |
| **4300** | Damage Compensation Revenue | Credit | Revenue |
| **6100** | Operating Expenses | Debit | Expense |
| **6200** | Administrative Expenses | Debit | Expense |
| **6300** | Utility Expenses | Debit | Expense |
| **6400** | Depreciation Expense | Debit | Expense |

---

## SECTION 3: double-entry event posting specification

Every financial transaction in the system triggers a predefined balanced posting batch. Below are the primary operational events:

### Event 1: Invoice Issuance (OFFICE_IS_CREDITOR Model)
- **Debit:** 1201 Tenant Receivables
- **Credit:** 4000 Rental Revenue
- **Credit:** 2100 VAT Payable (if applicable)

### Event 2: Rent Collection (OFFICE_IS_CREDITOR Model)
- **Debit:** 1111 Cash on Hand (or 1112 Bank Account)
- **Credit:** 1201 Tenant Receivables

### Event 3: Rent Collection (OWNER_IS_CREDITOR Model)
- **Debit:** 1111 Cash on Hand (or 1112 Bank Account)
- **Credit:** 2000 Owner Payables

### Event 4: Management Fee Recognition (Collection-Triggered RATE)
- **Debit:** 2000 Owner Payables
- **Credit:** 4100 Management Fee Revenue
- **Credit:** 2100 VAT Payable (if applicable)

### Event 5: Management Fee Recognition (Daily Accrued FIXED_MONTHLY)
- **Debit:** 2000 Owner Payables
- **Credit:** 4100 Management Fee Revenue

### Event 6: Booking Owner Expense
- **Debit:** 1205 Due from Owners
- **Credit:** 1111 Cash on Hand (or 1112 Bank Account)

### Event 7: Offsetting Owner Expense against Payables
- **Debit:** 2000 Owner Payables
- **Credit:** 1205 Due from Owners

### Event 8: Receiving Tenant Deposit
- **Debit:** 1111 Cash on Hand
- **Credit:** 2200 Tenant Deposits Payable

### Event 9: Applying Tenant Deposit to Arrears
- **Debit:** 2200 Tenant Deposits Payable
- **Credit:** 1201 Tenant Receivables

### Event 10: Disbursing Owner Settlement
- **Debit:** 2000 Owner Payables
- **Credit:** 1111 Cash on Hand (or 1112 Bank Account)

### Event 11: Voiding a Receipt
- Balanced reversal appending opposite entries of original receipt journal batch.

---

## SECTION 4: LEGAL WORKFLOWS & EVIDENCE MATRIX

To protect operations from legal liability, no manual edits or historical corrections can occur without verifying actual contract evidence.

### 1. Active Entity Rules
- **The Tenant is a Person:** All tenant references must link to `public.people` with `type='tenant'`. The old `tenants` table is deprecated.
- **Agreements Cover Contracts:** Lease contracts must fall strictly within the start and end dates of the landlord's active `owner_agreements` record for that property.

### 2. Legal Evidence Check
Before backfilling historical databases or activating automated contract printing templates, operators must gather and review these 7 legal artifacts:
1. **Property Management Contract Template:** Confirming the management fee structure, grace periods, and proration rules.
2. **Tenant Lease Agreement Template:** Verifying the penalty caps and late fee clauses.
3. **Master Lease Template:** Confirming office principal liabilities.
4. **Offset Authorization Clause:** Verifying the legal right to offset owner expenses directly from cash collections.
5. **Commission Entitlement Clause:** Confirming when commissions become fully earned and payable.
6. **Deposit Forfeiture Clause:** Outlining when deposit funds are legally transferred from the liability account to damage revenue.
7. **VAT Tax Registration Certificate:** Certifying the office's right to collect VAT.

---

## SECTION 5: BRAND & PRINT STANDARDS

Visual representation represents the core corporate identity of the platform.

### 1. The MALEK Identity
- The platform's authorized name is **MALEK**.
- The former name *MALIK* is deprecated. All visible consumer text must use MALEK.
- Technical identifiers in the codebase (e.g. repo name `malik`, paths, DB schemas) are frozen as `malik` for backwards compatibility and stability.

### 2. Printed PDF Standards
All contracts, receipts, invoices, and settlement sheets exported by the `documentService` must follow these rules:
- **Logical Alignment:** Clean Right-to-Left (RTL) output. Text cannot overlap.
- **Branding:** Feature the official MALEK lockup. Legacy *Rentrix* raster icons are banned.
- **Numbers:** Display in Latin numerals (`tabular-nums` formatting) to ensure decimal alignment.
- **OMR Precision:** Display money values to exactly 3 decimal places with the explicit currency tag `ر.ع.` (Omani Rial).
