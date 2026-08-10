# MALEK Canonical Pack — Document 2: Operating Models and Journeys

> **Status:** CANONICAL  
> **Baseline:** `main@75832b2f139f3b759325dcf17cf78101093671b4`

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
**Current reality:** legacy and newer contract workflows exist, but the complete canonical lifecycle is not yet proven end-to-end; see `GAP-004` and `GAP-002`.

## Journey C — OWNER_IS_CREDITOR collection

1. Invoice exists in the operational subledger.
2. Tenant collection to office-controlled cash/bank: `Dr Cash/Bank / Cr Owner Funds Payable`.
3. RATE management fee when collection occurs: reduce owner payable and recognize office fee/tax.
4. Fixed monthly fee accrues independently according to service time.
5. Owner expenses appear as Due from Owner, not office operating expense.
6. Settlement aggregates eligible/reserved items and documents any lawful offset.
7. Owner payout reduces Owner Funds Payable.

## Journey D — OFFICE_IS_CREDITOR collection

1. Invoice may post `Dr Tenant Receivable / Cr Owner Funds Payable`.
2. Collection posts `Dr Cash/Bank / Cr Tenant Receivable`.
3. Office consideration is then separated from owner funds under the same fee/tax rules.
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

## Evidence anchors

- Locked decisions D01–D18: `governance/final-decision-register.json`.
- Owner-agreement isolation migration/tests: `supabase/migrations/20260804000000_fix_owner_agreement_company_isolation.sql`, `supabase/tests/owner_agreement_company_isolation.sql`.
- Settlement reservation foundation: `supabase/migrations/20260804010000_fa003_owner_settlement_input_reservation_foundation.sql` and `20260804010100_fa003_owner_settlement_atomic_reservation_rpcs.sql`.
- Property-management GL surfaces: `supabase/migrations/20260809010000_s04_property_management_gl_rpcs.sql` and `rentrix-app/src/s4/s04-property-management-gl.test.ts`.
- MASTER_LEASE repository surfaces: `supabase/migrations/20260809020000_s06_master_lease_gl_lifecycle.sql`, `supabase/tests/master_lease_gl_lifecycle.sql`, `rentrix-app/src/s6/`.
- Historical-analysis repository surfaces: `scripts/s08/`, `evidence/s08/`, `rentrix-app/src/s08/`.
