# MALEK Canonical Pack — Document 4: Finance and Accounting Model

> **Status:** CANONICAL  
> **Baseline:** `main@75832b2f139f3b759325dcf17cf78101093671b4`

## Accounting authority

MALEK uses double-entry accounting with the General Ledger as the source of truth for financial statements and operational subledgers as the source of detailed operational schedules. The two must reconcile through explicit control accounts.

Owner-agency/property-management is an **agent-net** model. MASTER_LEASE is a **principal** model and must remain separate.

## Canonical finance rules

| Rule ID | Canonical rule |
|---|---|
| `FIN-001` | Owner-agency/property-management uses agent-net accounting; gross managed rent is not office revenue. |
| `FIN-002` | MASTER_LEASE is a separate principal module and must not use Owner Funds Payable as a lease-liability substitute. |
| `FIN-003` | For `OWNER_IS_CREDITOR`, tenant AR remains operational; collecting office-held cash creates Owner Funds Payable, not gross revenue. |
| `FIN-004` | For `OFFICE_IS_CREDITOR`, invoice may post Tenant Receivable against Owner Funds Payable; collection clears Tenant Receivable. |
| `FIN-005` | RATE management fees recognize on actual collection and are calculated authoritatively server-side. |
| `FIN-006` | FIXED_MONTHLY management fees accrue daily over the service period unless the agreement explicitly defines another approved basis. |
| `FIN-007` | Owner expenses paid by the office post to Due from Owners (1300), not Company Operating Expense (6100). |
| `FIN-008` | Owner-fund offset is permitted only with enforceable contractual/legal right and documented settlement ordering; payable must not be forced negative to represent owner debt. |
| `FIN-009` | Tenant deposits remain liabilities in account 2200 until valid refund/application; receipt alone is not revenue. |
| `FIN-010` | Deposit application follows beneficiary/economic destination and an approved claim/allocation; reversal is compensating and auditable. |
| `FIN-011` | Broker commission approval recognizes Broker Commission Expense (6110) and Broker Commissions Payable (2300); payment clears 2300 against cash/bank. |
| `FIN-012` | Tax/VAT is configuration-driven and versioned; no statutory rate may be hard-coded as universal truth. |
| `FIN-013` | OMR authoritative precision is three decimals; server/database posting logic owns final financial rounding. |
| `FIN-014` | The canonical Stage-3 chart provisions exactly 18 required accounts per company, listed below. |
| `FIN-015` | Journal batches are balanced and lifecycle-controlled (`DRAFT/POSTED/REVERSED` where implemented); arbitrary browser-authored debit/credit lines are prohibited. |
| `FIN-016` | Posting/reversal is idempotent and traceable by company, source/event identity, effective date and reversal relationship. |
| `FIN-017` | Accounting periods are monthly OPEN/SOFT_CLOSED/HARD_CLOSED; hard close is irreversible and late events post to the first open period while preserving effective date. |
| `FIN-018` | Posted financial history is append-only; correction uses reversal/adjustment/correction batches, never destructive UPDATE/DELETE of the posted journal. |
| `FIN-019` | GL is authoritative for financial statements; each operational subledger must reconcile to its applicable GL control account. |
| `FIN-020` | MASTER_LEASE requires ROU asset, lease liability, payment/interest schedule, depreciation and modification/remeasurement treatment; repository kernels do not justify a claim of complete IFRS reporting until the end-to-end module and reports are verified. |

## Canonical chart of accounts — 18 required accounts

The repository’s `REQUIRED_ACCOUNT_DEFINITIONS` and Stage-3 provisioning contract define these 18 accounts:

| Account | Name | Type | Normal balance |
|---|---|---|---|
| 1111 | Cash | Asset | Debit |
| 1120 | Bank | Asset | Debit |
| 1201 | Tenant Receivable | Asset | Debit |
| 1300 | Due from Owners | Asset | Debit |
| 1600 | Right-of-Use Asset | Asset | Debit |
| 2000 | Owner Funds Payable | Liability | Credit |
| 2100 | VAT Payable | Liability | Credit |
| 2200 | Tenant Deposits Payable | Liability | Credit |
| 2300 | Broker Commissions Payable | Liability | Credit |
| 2500 | Lease Liability | Liability | Credit |
| 4000 | Sublease Rental Revenue | Revenue | Credit |
| 4100 | Management Fee Revenue | Revenue | Credit |
| 4200 | Brokerage Revenue | Revenue | Credit |
| 4300 | Damage Compensation Revenue | Revenue | Credit |
| 6100 | Company Operating Expense | Expense | Debit |
| 6110 | Broker Commission Expense | Expense | Debit |
| 6200 | ROU Depreciation | Expense | Debit |
| 6300 | Lease Interest Expense | Expense | Debit |

Evidence: `rentrix-app/src/features/accounting/accountingDomain.ts` and `supabase/migrations/20260804030000_stage3_gl_core_chart_of_accounts_and_periods.sql`.

## Event-to-accounting mapping

| Event | Preconditions | Debit | Credit | Primary source / evidence | Reversal |
|---|---|---|---|---|---|
| OWNER creditor tenant collection | valid collection, company scope | 1111/1120 | 2000 | payment/collection event | compensating collection/refund event + GL reversal where required |
| OFFICE creditor invoice | valid contract/invoice | 1201 | 2000 | invoice | credit note / reversal, not delete |
| OFFICE creditor collection | open tenant receivable | 1111/1120 | 1201 | payment | refund/reversal path |
| RATE management fee | actual qualifying collection | 2000 (and/or owner settlement position) | 4100 + 2100 if tax | fee recognition event | controlled reversal |
| FIXED_MONTHLY fee accrual | active service period | 1300 | 4100 + 2100 if tax | accrual event | catch-up/reversal |
| Owner expense paid by office | approved owner expense | 1300 | 1111/1120 | expense/payment | reversal/owner recovery adjustment |
| Lawful owner offset | enforceable right + settlement evidence | 2000 | 1300 | settlement | compensating settlement adjustment |
| Deposit receipt | deposit received | 1111/1120 | 2200 | deposit transaction | refund/application/reversal |
| Deposit applied to OFFICE creditor AR | approved claim/allocation | 2200 | 1201 | deposit application | compensating reversal |
| Deposit applied for owner benefit | approved claim/allocation | 2200 | 2000 | deposit application | compensating reversal |
| Office damage compensation right | explicit contractual office right | 2200 | 4300 | approved claim | compensating reversal |
| Broker commission approved | approved commission | 6110 | 2300 | commission | reversal |
| Broker commission paid | approved payable | 2300 | 1111/1120 | payment | payment reversal |
| Owner payout | approved settlement | 2000 | 1111/1120 | settlement payment | controlled reversal/correction |
| MASTER_LEASE inception | approved head lease | 1600 | 2500 | master-lease lifecycle | modification/termination accounting |
| MASTER_LEASE depreciation | period charge | 6200 | 1600/accumulated treatment as engine defines | schedule | adjustment |
| MASTER_LEASE interest | liability schedule | 6300 | 2500 | schedule | adjustment |
| Sublease rent income | principal/sublease event | cash/AR | 4000 | sublease event | reversal/credit |

The exact line shape must be produced by approved server-side posting functions; this table defines accounting intent, not browser-authored journal payloads.

## GL and posting controls

Stage-3 repository evidence includes company-scoped accounts, accounting periods, journal batches/lines, posting/reversal functions and protected service boundaries. Existing migrations include:

- `20260804030000_stage3_gl_core_chart_of_accounts_and_periods.sql`
- `20260804030200_stage3_gl_core_posting_engine_and_rpcs.sql`
- `20260807172900_s03_wire_post_receipt_to_gl_engine.sql`

Property-management and master-lease GL kernels also exist:

- `20260809010000_s04_property_management_gl_rpcs.sql`
- `20260809020000_s06_master_lease_gl_lifecycle.sql`

Their presence proves repository implementation surfaces, not complete end-to-end user wiring or governed stage completion.

## Subledger reconciliation contract

- OFFICE_IS_CREDITOR tenant subledger ↔ 1201 Tenant Receivable.
- Owner funds subledger ↔ 2000 Owner Funds Payable.
- Owner receivable subledger ↔ 1300 Due from Owners.
- Deposit subledger ↔ 2200 Tenant Deposits Payable.
- Broker commission payable subledger ↔ 2300 Broker Commissions Payable.

Rent Roll, contract schedules and tenant/owner detailed statements remain operational-subledger reports; they are not reconstructed from GL lines.

## Period close and late posting

Monthly periods progress OPEN → SOFT_CLOSED → HARD_CLOSED. HARD_CLOSED is irreversible under the locked decision. A late event retains its economic effective date but posts to the first permitted open accounting period with traceable resolution metadata.

## Historical correction

S08 read-only analysis must precede S09 correction. Approved corrections are company/period/source-scoped, append-only and accompanied by before/after evidence. No global anonymous “one correction entry” is acceptable.

## External limits

This model does not claim legal/tax/IFRS certification. Tax configuration, contract offset rights, MASTER_LEASE judgments and production-period close require appropriate professional/runtime approval. Those are explicitly tracked in Document 7 rather than hidden as implementation success.
