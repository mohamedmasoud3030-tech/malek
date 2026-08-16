# MALEK Canonical Pack — Document 4: Finance and Accounting Model

> **Status:** CANONICAL  
> **Baseline:** `main@da9a98a38e61e9547df1e328ad91084e79b78410` (sequential financial hardening and WP-07 closeout)

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

The status column describes the complete product path at the baseline, not merely whether a posting function exists.

| Event | Preconditions | Debit | Credit | Source record / repository evidence | Reversal method | Status |
|---|---|---|---|---|---|---|
| OWNER creditor tenant collection | valid company/contract/payment; `OWNER_IS_CREDITOR`; open period; stable event id | 1111/1120 | 2000 | payment/receipt; `gl_pm_post_collection_owner_is_creditor` in `20260809010000_s04_property_management_gl_rpcs.sql` | payment/receipt VOID plus `reverse_journal_batch`/compensating refund | PARTIAL — kernel tested, UI event wiring/reconciliation open |
| OFFICE creditor invoice | active approved contract; `OFFICE_IS_CREDITOR`; valid invoice | 1201 | 2000 | invoice; `gl_pm_post_invoice_office_is_creditor` | credit note/reversal, never delete | PARTIAL — kernel tested, complete journey open |
| OFFICE creditor collection | open 1201 balance; valid payment | 1111/1120 | 1201 | payment; `gl_pm_post_collection_office_is_creditor` | controlled refund/reversal | PARTIAL — kernel tested, complete journey open |
| RATE management fee | qualifying actual collection; agreement RATE/ON_COLLECTION; server amount/tax | 2000 | 4100 and 2100 when configured | collection source/event; S04 GL RPC fee split | reverse the source event/fee batch | PARTIAL — posting kernel exists; browser/service trigger not proven |
| FIXED_MONTHLY fee accrual | active service dates; DAILY_ACCRUAL terms; open period; idempotent day/source key | 1300 | 4100 and 2100 when configured | daily accrual event | catch-up or reversal batch | NOT_IMPLEMENTED end-to-end; policy/version fields exist |
| Company operating expense | approved company obligation and payment basis | 6100 | 1111/1120 or payable where implemented | `expenses`; expense atomic RPCs | expense reversal/adjustment | IMPLEMENTED_UNVERIFIED across all UI variants |
| Owner expense paid by office | approved owner obligation; owner/property/agreement scope | 1300 | 1111/1120 | owner expense/payment; S04 Due-from-Owner surface | reversal or recovery adjustment | PARTIAL — posting support exists; full recovery path open |
| Lawful owner offset | enforceable agreement `offset_allowed`; approved settlement order; sufficient 2000 | 2000 | 1300 | settlement and reserved sources | compensating settlement adjustment | PARTIAL — decision/data fields exist; end-to-end offset proof open |
| Deposit receipt | valid contract/custodian/beneficiary; 3dp amount; atomic request | 1111/1120 | 2200 | deposit + held transaction | refund/application/reversal transaction | CONFLICT — legacy 2dp/direct-write path coexists with kernels |
| Deposit applied to OFFICE creditor AR | approved evidence/allocation; `OFFICE_IS_CREDITOR`; amount ≤ remaining | 2200 | 1201 | deposit application; `gl_pm_post_deposit_application` | compensating deposit reversal | PARTIAL |
| Deposit applied for owner benefit | approved evidence/allocation; owner beneficiary | 2200 | 2000 | deposit application; `gl_pm_post_deposit_application` | compensating deposit reversal | PARTIAL |
| Office damage compensation right | explicit contract right and approved claim | 2200 | 4300 | approved deposit claim | compensating reversal | PARTIAL |
| Broker commission approved | valid source; distinct approval where designated | 6110 | 2300 | commission; S04 commission posting / commission lifecycle migrations | commission reversal | IMPLEMENTED_UNVERIFIED end-to-end |
| Broker commission paid | approved unpaid commission; stable request id | 2300 | 1111/1120 | `pay_commission_atomic`; `commission_payment_lifecycle.sql` | `reverse_commission_atomic` | VERIFIED_IMPLEMENTED in repository; live proof external |
| Owner payout | approved rederived settlement; reserved sources; payment authority | 2000 | 1111/1120 | owner settlement pay RPC | controlled settlement correction; post-payout refund → 1300 | PARTIAL — reservation/stale-total path tested, wider lifecycle open |
| Receipt/payment VOID | posted original; reason; authorized actor; idempotent reversal identity | reverse original credits | reverse original debits | `void_receipt_atomic`; Stage-3 engine-managed receipt void | reversal batch linked to original | VERIFIED_IMPLEMENTED for receipt contract; broader credit/refund matrix open |
| MASTER_LEASE inception | approved/classified head lease; payment schedule; rate snapshot | 1600 | 2500 | measurement + `gl_ml_create_initial_measurement` | modification/termination/remeasurement | PARTIAL — DB and TypeScript kernels, no complete product workflow |
| MASTER_LEASE payment/interest | due schedule item; open period | 2500 principal + 6300 interest | 1111/1120 | master-lease schedule/posting intent | controlled adjustment/reversal | PARTIAL |
| MASTER_LEASE depreciation | approved ROU schedule/period | 6200 | 1600 or accumulated-depreciation treatment explicitly defined by engine | schedule/posting intent | controlled adjustment | PARTIAL |
| Sublease rent income | valid principal sublease invoice/collection | cash or AR as event requires | 4000 | sublease event | credit/reversal | PARTIAL |

The exact line shape must be produced by approved server-side posting functions; this table defines accounting intent, not browser-authored journal payloads.

## Recognition and report bases

| Output | Required basis | Inclusion / exclusion contract | Authoritative source at target |
|---|---|---|---|
| Daily collections | collected/posting date, explicitly labelled | non-VOID payment events; refunds/reversals reduce the period effect | payment subledger reconciled to cash/bank GL |
| Tenant statement | invoiced obligations and collected/applied amounts | excludes deleted/VOID/CANCELLED economic effects; shows reversal/credit events | tenant operational subledger; 1201 reconciliation only for OFFICE creditor |
| Owner statement/settlement | collected agent funds, earned fees/tax, owner expenses, lawful offsets and payouts | no gross owner rent as office revenue; cancelled settlements excluded | owner subledgers reconciled to 2000/1300 |
| Trial balance, P&L, balance sheet, general ledger | POSTED GL by resolved accounting period | DRAFT excluded; REVERSED economic effect represented by reversal batch | `journal_batches` + `journal_lines` |
| Cash flow | posted cash/bank movements by documented classification | VOID/reversal effects included correctly; all 1111/1120 movements covered | posted GL target; legacy report RPC requires reconciliation proof |
| Rent roll | contract/invoice schedule as-of date | active occupancy and valid scheduled obligations; not a GL reconstruction | operational contract/invoice subledger |
| VAT return | configured tax snapshots and posted taxable events | VOID/CANCELLED/reversal treatment explicit | tax subledger/posting lines reconciled to 2100 |

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

## Baseline conflicts and limits (Reconciled)

- *Reconciled:* `GAP-009` is closed; deposit transactions are RPC-only, 3dp, and reconciled.
- *Reconciled:* `GAP-013/014` are closed; reports now derive from canonical posted GL and reconcile.
- `gl_pm_*` and `gl_ml_*` functions are meaningful implementation, and owner-agency user journeys now invoke them on the current Release Candidate.
- No document in the repository can supply legal offset enforceability, statutory tax approval or complete IFRS judgment. Those remain external gates.

## External limits

This model does not claim legal/tax/IFRS certification. Tax configuration, contract offset rights, MASTER_LEASE judgments and production-period close require appropriate professional/runtime approval. Those are explicitly tracked in Document 7 rather than hidden as implementation success.
