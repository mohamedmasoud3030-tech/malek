# MALEK Canonical Pack — Document 4: Finance and Accounting Model

> **Status:** CANONICAL  
> **Historical baseline:** `main@da9a98a38e61e9547df1e328ad91084e79b78410` (PR #1470)
>
> **RC1 correction:** forward-only owner-agency invoice/credit/tax correction on the RC candidate branch; the final candidate SHA is recorded by the owning PR and release report.
>
> **Evidence boundary:** repository/PGlite evidence only unless expressly labelled live.

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
| OWNER creditor invoice (`OWNER_IS_CREDITOR`) | active OWNER_AGENCY contract with immutable agreement/version/role snapshot; effective configured tax profile; open/late-resolved period | — (operational tenant obligation only) | — | `invoices` immutable RC1 lineage + tax snapshot; `generate_invoices_from_active_contracts` | controlled credit/reversal; no delete | VERIFIED_IMPLEMENTED in repository/PGlite — no 1201, 2000, 2100 or 4000 entry at issuance |
| OWNER creditor collection | posted operational obligation; stable request; cash or bank method; original invoice tax snapshot | 1111/1120 gross | 2000 net; 2100 original tax where non-zero | `record_invoice_payment_atomic` → receipt/payment/allocation + `owner_funds_events` | governed receipt VOID compensates the original receipt-owned event | VERIFIED_IMPLEMENTED in repository/PGlite |
| OFFICE creditor invoice (`OFFICE_IS_CREDITOR`) | active OWNER_AGENCY contract with immutable snapshot; effective configured tax profile; open/late-resolved period | 1201 gross | 2000 net; 2100 original tax where non-zero | canonical `post_journal_event`; immutable invoice source batch + tax snapshot | model-aware credit/reversal, never delete | VERIFIED_IMPLEMENTED in repository/PGlite — 4000 is prohibited for this event |
| OFFICE creditor collection | posted 1201 obligation; stable request; server-derived cash/bank account | 1111/1120 | 1201 gross | `record_invoice_payment_atomic` → internal receipt engine | governed receipt VOID; original AR reopens | VERIFIED_IMPLEMENTED in repository/PGlite |
| RATE management fee | qualifying actual collection; frozen RATE/ON_COLLECTION agreement; collection **net of original rent tax**; active versioned `RATE_MANAGEMENT_FEE` treatment | 2000 gross fee | 4100 net + 2100 fee tax where configured | same receipt-owned batch + immutable management-fee tax snapshot + `owner_funds_events` | receipt VOID compensates fee with the collection | VERIFIED_IMPLEMENTED in repository/PGlite; missing fee treatment fails closed |
| Invoice credit — OFFICE creditor | posted invoice with immutable source batch/tax snapshot; ceiling; resolved period | 2000 net + 2100 original tax | 1201 gross | `create_invoice_credit_atomic` derives source accounts/amounts; `invoice_credits` components | `reverse_invoice_credit_atomic` reverses its own credit batch | VERIFIED_IMPLEMENTED in repository/PGlite |
| Invoice credit — OWNER creditor | posted operational obligation with immutable tax snapshot; ceiling; resolved period | — | — | append-only operational `invoice_credits`; no invented GL entry | append-only operational compensating reversal | VERIFIED_IMPLEMENTED in repository/PGlite |
| FIXED_MONTHLY fee accrual | active service dates; DAILY_ACCRUAL terms; active versioned `FIXED_MONTHLY` fee-tax treatment; open period; idempotent day/source key | 1300 gross | 4100 net + 2100 fee tax where configured | immutable daily accrual source row | catch-up or reversal batch | VERIFIED_IMPLEMENTED in repository/PGlite; missing fee treatment fails closed |
| Company operating expense | approved company obligation and payment basis | 6100 | 1111/1120 or payable where implemented | `expenses`; expense atomic RPCs | expense reversal/adjustment | IMPLEMENTED_UNVERIFIED across all UI variants |
| Owner expense paid by office | approved owner obligation; owner/property/agreement scope | 1300 | 1111/1120 | owner expense/payment; S04 Due-from-Owner surface | reversal or recovery adjustment | PARTIAL — posting support exists; full recovery path open |
| Lawful owner offset | enforceable agreement `offset_allowed`; approved settlement order; sufficient 2000 | 2000 | 1300 | settlement and reserved sources | compensating settlement adjustment | PARTIAL — decision/data fields exist; end-to-end offset proof open |
| Deposit receipt | valid contract/custodian/beneficiary; 3dp amount; atomic request | 1111/1120 | 2200 | governed deposit + held transaction | refund/application/reversal transaction | VERIFIED_IMPLEMENTED in repository/PGlite; live proof external |
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

## RC1 invoice, credit and tax authority (forward correction)

The historical `main@da9a98a` recurring generator did **not** derive an
owner-agency accounting model. It selected 4000 for every active contract and
read `company_settings.vat_enabled/vat_rate`; its generic credit routine then
assumed `Cr 1201 / Dr 4000 / Dr 2100`. That historical checkpoint is retained
in the audit trail but is not the RC1 model.

The RC1 forward migrations are:

- `20260820030000_rc1_owner_agency_invoice_accounting_model.sql` — immutable
  invoice agreement/model/role/accounting/tax lineage, role-specific generation,
  explicit `NON_TAXABLE` configured profile option, 1201 scope correction,
  owner-funds event control and read-only historical diagnostic;
- `20260820040000_rc1_invoice_credit_original_economics.sql` — source-derived,
  partial/full credit components and compensating reversal;
- `20260820050000_rc1_payment_tax_and_write_boundary.sql` — controlled
  cash/bank collection, rent-tax allocation lineage, owner-funds event compensation,
  settlement payout capture and service-only receipt journal engine;
- `20260820060000_rc1_cutover_fee_tax_and_legacy_fail_closed.sql` — strict
  legacy-payment denial, target-bound credit-reversal idempotency, S08-backed
  owner-funds opening/cutover baseline, independent versioned RATE/FIXED fee-tax
  treatment and snapshotting, and snapshot-missing historical diagnostics.

`resolve_active_tax_profile(company, issue_date)` is required for every
recurring rent invoice. `VAT`, `VAT_ZERO`, or explicitly configured
`NON_TAXABLE` treatment is snapshotted with code/rate/net/tax/effective date;
there is no rate fallback to `company_settings`. Credits reuse the source
invoice snapshot and do not recalculate under a later profile.

Management fees have a **separate** effective-dated authority:
`company_fee_tax_treatments` resolves `RATE_MANAGEMENT_FEE` and
`FIXED_MONTHLY` independently of rent. RATE collections and daily fixed-fee
accruals fail closed with `FEE_TAX_TREATMENT_MISSING` when that policy is
absent. Where configured, they snapshot fee code/rate/net/tax and post 2100;
the implementation never assumes service-fee VAT is zero.

`owner_funds_events` is the forward append-only 2000 operational control:
OFFICE creditor issue increases it; OWNER creditor collection increases it;
fees, credits, receipt VOID compensation and settlement payout decrease or
restore it as their controlled source event requires. A company with historical
2000 sources cannot silently switch to this ledger: it must have an
S08-approved immutable `owner_funds_event_cutovers` opening balance and
fingerprint, or new owner-funds events fail closed. Pre-RC1 rows are never
backfilled; S09 remains required for any historical correction.

Historical detection is read-only through
`rpt_rc1_owner_agency_invoice_mapping_diagnostics(from, to)`. It identifies
owner-agency source batches credited to 4000 or lacking RC1 lineage by caller
company/date/source. It never posts, updates or deletes history.

## Recognition and report bases

| Output | Required basis | Inclusion / exclusion contract | Authoritative source at target |
|---|---|---|---|
| Daily collections | collected/posting date, explicitly labelled | non-VOID payment events; refunds/reversals reduce the period effect | payment subledger reconciled to cash/bank GL |
| Tenant statement | invoiced obligations and collected/applied amounts | excludes deleted/VOID/CANCELLED economic effects; shows reversal/credit events | tenant operational subledger; 1201 reconciliation only for OFFICE creditor |
| Owner statement/settlement | collected agent funds, earned fees/tax, owner expenses, lawful offsets and payouts | no gross owner rent as office revenue; cancelled settlements excluded | owner subledgers reconciled to 2000/1300 |
| Trial balance, P&L, balance sheet, general ledger | POSTED GL by resolved accounting period | DRAFT excluded; REVERSED economic effect represented by reversal batch | `journal_batches` + `journal_lines` |
| Cash flow | posted cash/bank movements by documented classification | VOID/reversal effects included correctly; all 1111/1120 movements covered | posted GL target; legacy report RPC requires reconciliation proof |
| Rent roll | contract/invoice schedule as-of date | active occupancy and valid scheduled obligations; not a GL reconstruction | operational contract/invoice subledger |
| VAT return | configured immutable invoice/credit tax snapshots and posted taxable events | original profile/code/rate/basis retained through credit/reversal; VOID/CANCELLED treatment explicit | tax snapshots and 2100 GL control |

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
- Owner funds subledger (`owner_funds_event_cutovers.opening_balance` + post-cutover `owner_funds_events`; fail closed where historic 2000 has no approved cutover) ↔ 2000 Owner Funds Payable.
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
- RC1 owner-agency recurring billing/collection/credit now uses the controlled mapping documented above. MASTER_LEASE remains excluded from RC1; its `gl_ml_*` kernels are preserved but are not evidence of an included journey.
- Historical migrations retain 2dp report bodies, but current report wrappers delegate to wp05 3dp GL outputs. The RC1 UI/report services do not call the superseded bodies; a future non-wrapper consumer must not be added without a 3dp contract test.
- No document in the repository can supply legal offset enforceability, statutory tax approval or complete IFRS judgment. Those remain external gates.

## External limits

This model does not claim legal/tax/IFRS certification. Tax configuration, contract offset rights, MASTER_LEASE judgments and production-period close require appropriate professional/runtime approval. Those are explicitly tracked in Document 7 rather than hidden as implementation success.
