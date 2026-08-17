# MALEK Canonical Pack — Document 2: Operating Models and Journeys

> **Status:** CANONICAL  
> **Baseline:** `main@da9a98a38e61e9547df1e328ad91084e79b78410` (sequential financial hardening and WP-07 closeout)

## Canonical operating models

MALEK supports two financially distinct rental models and one limited compatibility category:

1. **OWNER_AGENCY / property management** — MALEK’s office acts as agent for an owner. Gross tenant rent is not automatically office revenue.
2. **MASTER_LEASE** — the office is principal under a head lease and subleases onward. It is not owner-agency and must use its own accounting lifecycle.
3. **OFFICE_OWNED** — operational ownership may exist where the repository supports it, but it must not be used to bypass the accounting rules of either model.

`OFFICE_IS_CREDITOR` is a collection/legal-right classification inside owner-agency; it is **not** the same thing as MASTER_LEASE.

## Canonical operating rules

| Rule ID | Canonical rule |
|---|---|
| `OPS-001` | Owner-agency/property-management is an agent-net model: the office earns its management/brokerage/service consideration, not gross owner rent. |
| `OPS-002` | MASTER_LEASE is a separate principal model with its own head-lease, ROU/liability and sublease lifecycle; it is never implemented through owner settlements or Owner Funds Payable. |
| `OPS-003` | Every owner-agency agreement has an explicit `collection_role`: `OWNER_IS_CREDITOR` or `OFFICE_IS_CREDITOR`; legal right drives receivable treatment. |
| `OPS-004` | Property onboarding follows a controlled evidence workflow; identity/safety gates are non-waivable and any allowed waiver is admin-authorized and auditable. |
| `OPS-005` | Material owner-agreement changes create a version/amendment; no silent retroactive mutation of financial/legal history is allowed. |
| `OPS-006` | Material tenant contracts follow `DRAFT → REVIEW → APPROVED → SIGNED → ACTIVE`; the signed artifact/version is immutable. |
| `OPS-007` | Material contract/financial approvals use Maker-Checker by default; the creator/requester cannot final-approve the same sensitive action except an explicitly audited sole-admin exception. |
| `OPS-008` | Invoice/tenant-receivable behavior follows `collection_role`: OWNER creditor uses an operational tenant subledger; OFFICE creditor may recognize Tenant Receivable in GL. |
| `OPS-009` | RATE management fees recognize on actual collection; FIXED_MONTHLY fees accrue daily over the service period unless the approved agreement defines another valid basis. |
| `OPS-010` | Collection, receipt, void, credit-note and refund actions are controlled lifecycle events; posted history is not deleted or silently edited. |
| `OPS-011` | Owner-settlement inputs are reserved atomically; a payment/expense cannot belong to two active settlements; values are rederived before approval/payment. |
| `OPS-012` | Owner-paid-on-behalf expenses become Due from Owner; offset requires contractual/legal right and follows the approved order before payout. |
| `OPS-013` | Tenant deposits remain liabilities until a valid claim/application/refund; application requires evidence/allocation and reversal is compensating, not destructive. |
| `OPS-014` | Bank CSV import is preview-first and fail-closed: ambiguous/invalid rows block the batch; no silent partial financial import is permitted. |
| `OPS-015` | Historical remediation is two-stage: read-only analysis first; only approved, source/company/period-scoped append-only correction batches may follow. |

## Journey control matrix

This matrix is the operational acceptance contract. “Repository layer” identifies what physically exists at the baseline; it is not a completion claim.

| Journey | Actor / trigger | Preconditions | Authoritative records and boundary | Success state | Failure / reversal | Repository layer at baseline |
|---|---|---|---|---|---|---|
| A — owner-agency onboarding | Admin/Manager creates or changes mandate | active company; owner/property; evidence; approved commercial terms | `owner_agreements` identity; `owner_agreement_versions`; atomic identity+first-version creation; `create_owner_agreement_version_atomic`; RLS/RPC company checks | current non-retroactive version available for contract snapshot | invalid scope/retroactivity fails closed; later change creates a version | RC1 UI shows immutable version history and creates future amendments; legal template approval remains `GAP-019` |
| B — tenant contract | Maker submits; distinct checker approves; authorized actor activates | valid company/tenant/property/unit; governing agreement version; signatures/evidence | `contracts`; `submit_contract_for_approval_atomic`; `approve_contract_atomic`; activation RPC; immutable snapshots | ACTIVE contract with maker/checker evidence and agreement/collection-role snapshot | reject/cancel/terminate through lifecycle; signed evidence is not overwritten | Full service/UI lifecycle, draft-only renewal and immutable snapshot authority are repository-proven; hosted/legal evidence remains external |
| C — owner-creditor collection | authorized collector records actual cash | active contract/invoice; `OWNER_IS_CREDITOR`; open period; idempotency identity | payment/receipt event → business RPC → journal batch/lines | cash/bank and Owner Funds Payable posted; fee split only on qualifying collection | void/refund uses reversal/compensating event | `gl_pm_post_collection_owner_is_creditor` kernel/tests exist; browser journey wiring incomplete; `GAP-006/011` |
| D — office-creditor billing/collection | billing then collection event | active contract; `OFFICE_IS_CREDITOR`; valid invoice/payment | invoice posts 1201/2000; collection clears 1201 | tenant subledger and GL control agree | credit note/reversal/refund; no delete | S04 GL contracts exist; complete user-event/reconciliation proof open; `GAP-006/013` |
| E — expenses/maintenance | authorized user resolves work or records expense | company/property/party scope; expense classification; evidence | `expenses`, maintenance record, expense RPC, journal batch | company expense or Due from Owner posted once according to economic owner | correction reverses prior posting; owner recovery remains separate | expense/maintenance RPCs exist; full Due-from-Owner recovery open; `GAP-008/011` |
| F — deposit | authorized receipt, approved claim/application, or refund | valid contract/beneficiary; evidence; amount ≤ remaining; 3dp/idempotency | `tenant_deposits`, `deposit_transactions`, application GL event | liability changes exactly once and reconciles to 2200 | compensating refund/application reversal | legacy 2dp/direct-write deposit path coexists with S04 kernels; `GAP-009` |
| G — owner settlement | preparer drafts; approver/payor acts under permissions | eligible unreserved payments/expenses; rederived totals; lawful offset | settlement + payment/expense link tables; atomic create/approve/pay/cancel RPCs | immutable paid settlement; sources remain reserved | cancellation releases eligible reservations; post-payout refund creates Due from Owner | reservations/stale-total tests exist; full offset/recovery/approval separation open; `GAP-002/008` |
| H — MASTER_LEASE | authorized principal-accounting workflow | approved head lease; classification; discount-rate snapshot; open periods | measurement/schedule/GL lifecycle tables and `gl_ml_*` RPCs | ROU/liability/sublease events reconcile to control accounts | remeasurement/modification/termination events, never owner settlement | DB/TypeScript kernels exist; no complete UI/report journey; `GAP-012` |
| I — banking/reconciliation | authorized importer/matcher | parsable file; server row/size/count/3dp limits; no ambiguity | import batch/rows; preview/finalize RPC; bank match RPC | whole valid batch imported and matched/approved as applicable | any invalid/ambiguous row rejects the batch; unmatch/review is audited | fail-closed migrations/pgTAP exist; hosted/current-SHA acceptance open; `GAP-017` |
| J — historical remediation | reviewer approves frozen analysis; later authorized correction | S08 governed approval; exact company/period/source inventory | read-only S08 views/evidence, then future append-only S09 batches | reconciled before/after evidence without rewriting posted history | correction batch itself is reversible/traceable | S08 code/tests exist without governed approval; S09 not authorized; `GAP-015/016` |

## Journey A — Owner-agency onboarding

**Actor:** Admin/Manager with effective write permissions.  
**Preconditions:** active company, owner/property records, required evidence.  
**Flow:** property/owner → owner agreement → collection role/fee basis → approval/signatures/version → activation.  
**Financial effect:** none merely from data entry unless an approved fee/accrual event is triggered.  
**Permission boundary:** backend/RLS/RPC authority is controlling; UI visibility is not authorization.  
**Failure/reversal:** invalid evidence or permissions fail closed; material corrections create versions rather than rewriting history.

## Journey B — Tenant contract lifecycle

**Flow:** draft → review → approval → signed artifact → active schedule → invoices/collections → renewal/termination.  
**Required controls:** Maker-Checker for material approval, immutable signed version, explicit termination record, future schedule cancellation rather than deletion.  
**Current reality:** `20260808010000_s04_contract_lifecycle_maker_checker_v2.sql` and its pgTAP tests enforce distinct maker/checker identities and signature evidence in the database. Under the current Release Candidate, the React contract flow has been fully wired to invoke that complete lifecycle through atomic RPCs, and Maker-Checker (including the audited sole-admin exception setting) has been fully implemented and verified locally across all designated approvals (unblocking `GAP-002` and `GAP-004`).

## Journey C — OWNER_IS_CREDITOR collection

1. Invoice exists in the operational subledger with immutable agreement/version, role and tax-profile lineage; it does **not** create 1201, 2000 or 4000 at issuance.
2. Tenant collection to server-derived 1111/1120 posts `Dr Cash/Bank gross / Cr Owner Funds Payable net / Cr 2100 original tax` where the original configured profile has tax.
3. RATE management fee when collection occurs reduces owner payable and recognizes 4100 from collected rent net of original rent tax; no separate fee VAT is inferred without an approved service-fee basis.
4. Fixed monthly fee accrues independently according to service time.
5. Owner expenses appear as Due from Owner, not office operating expense.
6. Settlement aggregates eligible/reserved items and documents any lawful offset.
7. Owner payout reduces Owner Funds Payable through an append-only owner-funds event.

## Journey D — OFFICE_IS_CREDITOR collection

1. Invoice posts `Dr Tenant Receivable gross / Cr Owner Funds Payable net / Cr 2100 original tax` where applicable; it never uses 4000 for ordinary owner-agency rent.
2. Collection posts `Dr Cash/Bank / Cr Tenant Receivable`.
3. Office consideration is then separated from owner funds under the same server-derived fee rules; a credit reverses the original invoice economics and tax snapshot.
4. OFFICE_IS_CREDITOR does not turn the relationship into MASTER_LEASE.

## Journey E — Expenses and maintenance

- Company expense: office P&L expense.
- Owner expense paid by office: Due from Owner.
- Tenant-recoverable amount: one receivable/claim path only; no duplicate AR recognition.
- Maintenance resolution must preserve company/property/party scope and link supporting evidence.

## Journey F — Deposits

Receive deposit → liability → approved claim/application or refund → allocation to exact obligation → compensating reversal when required. Beneficiary determines whether an application reduces Tenant Receivable, increases Owner Funds Payable, or recognizes an office right expressly created by contract.

## Journey G — Owner settlement

Draft/reserve inputs → rederive → approval → documented offsets → payout → immutable paid state. Cancellation releases only reservations that are legally/operationally releasable. A refund after owner payout creates Due from Owner instead of forcing Owner Funds Payable negative.

## Journey H — MASTER_LEASE

Head-lease inception → ROU asset + lease liability → payment/interest schedule → depreciation → sublease revenue → modification/remeasurement/termination. Until this is fully wired through UI/service/database/reporting/reconciliation, MASTER_LEASE reporting must not be described as complete IFRS reporting.

## Journey I — Banking and reconciliation

Import preview → validation/count/limits/3dp checks → atomic import or full rejection → matching/reconciliation → approval where sensitive → close controls. Repository features exist, but fail-closed and hosted/runtime behavior must be proven before release.

## Journey J — Historical correction

Read-only inventory by company/period/source/owner/property/agreement/transaction → approval → append-only correction/reversal batches → before/after evidence → reconciliation. No UPDATE/DELETE of posted historical journals.

## Cross-journey invariants

- Company context is revalidated at the authoritative write boundary; a route guard is never enough.
- A business retry carries a stable request/event identity; a timestamp/random retry identity is not acceptable for financially material idempotency.
- An operational record and its accounting effect remain linked through source type, source id, event id and resulting batch.
- A posted/paid/signed state is immutable. Corrections create explicit subsequent events.
- UI success is shown only after the authoritative operation succeeds; optimistic display cannot manufacture a financial state.
- Financial reports state their basis (`posted`, `collected`, `invoiced`, `paid` or `accrued`) and exclude/reverse VOID, CANCELLED and deleted rows according to the owning rule.

## Evidence anchors

- Locked decisions D01–D18: `governance/final-decision-register.json`.
- Owner-agreement isolation migration/tests: `supabase/migrations/20260804000000_fix_owner_agreement_company_isolation.sql`, `supabase/tests/owner_agreement_company_isolation.sql`.
- Settlement reservation foundation: `supabase/migrations/20260804010000_fa003_owner_settlement_input_reservation_foundation.sql` and `20260804010100_fa003_owner_settlement_atomic_reservation_rpcs.sql`.
- Property-management GL surfaces: `supabase/migrations/20260809010000_s04_property_management_gl_rpcs.sql` and `rentrix-app/src/s4/s04-property-management-gl.test.ts`.
- MASTER_LEASE repository surfaces: `supabase/migrations/20260809020000_s06_master_lease_gl_lifecycle.sql`, `supabase/tests/master_lease_gl_lifecycle.sql`, `rentrix-app/src/s6/`.
- Historical-analysis repository surfaces: `scripts/s08/`, `evidence/s08/`, `rentrix-app/src/s08/`.
