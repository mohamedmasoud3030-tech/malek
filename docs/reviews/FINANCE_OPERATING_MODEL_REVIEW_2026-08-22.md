# MALEK Finance Operating Model Review — 2026-08-22

> **Purpose:** product/operating-model correction across Finance, Reports, Settings, and the contract-to-cash journey.  
> **Baseline:** `main@0a55f4ff3d6d7da75956e8ec53748e1bf2e242d7` (after squash-merging PR #1549).  
> **Authority boundary:** this review does not replace `docs/source-of-truth/04_FINANCE_AND_ACCOUNTING_MODEL.md`; where UI wording conflicts with the canonical accounting model, the canonical accounting model wins.  
> **Change boundary for this PR:** no SQL, migration, RPC, authorization, posting formula, tax calculation, or financial-history mutation is changed.

## Why this review exists

MALEK's accounting backend is materially more mature than some of the user-facing product language and navigation around it. That creates a dangerous class of failure: a feature can be technically implemented and tested while the office operator is still led to the wrong operational conclusion.

This review therefore evaluates each financial surface by five questions:

1. What business event starts the workflow?
2. Which record or server boundary is authoritative?
3. What does the user believe the action changes?
4. What accounting/operational effect actually occurs?
5. What is the next action or failure/reversal path?

The target journey is:

`Contract authority → billing obligation → invoice → collection → receipt/allocation → accounting posting → owner/deposit/expense consequences → reconciliation → statement/report`

## Corrected vocabulary

These terms must not be used interchangeably:

| Term | Product meaning |
|---|---|
| Contract | Commercial/legal authority and billing terms. A contract is not itself a cash event or accounting revenue. |
| Billing obligation | Amount/date obligation derived from the active contract/agreement rules. |
| Invoice | A demand/obligation record. Its GL treatment depends on the operating model and collection role. |
| Collection | The controlled business event of receiving money. |
| Payment | The cash/bank movement recorded by the collection event. |
| Receipt | Evidence/acknowledgement produced for the collection; not a second independent collection. |
| Allocation | Link between collected value and the exact obligation/invoice it settles. |
| Revenue | Office-earned consideration recognized by the authoritative accounting model. Gross owner rent is not automatically office revenue. |
| Operational collection summary | A convenience view of invoiced/collected/outstanding/recorded expenses. It is not automatically P&L or a complete cash-flow statement. |
| Cash-flow statement | Accounting output based on complete classified cash/bank movements under the canonical GL/report contract. |
| Accounting control | COA, periods, journals, close/reversal controls. These are operational accounting controls, not merely reports. |
| Setting | A user-editable configuration only when the edited value is genuinely authoritative for the downstream workflow. Legacy/reference values must be labelled as such. |

## Confirmed findings

### FOM-001 — Legacy VAT settings falsely implied current tax authority — HIGH — corrected in this PR

**Observed product behavior**

The Settings workspace exposed `default_vat_rate`, `vat_rate`, and `vat_enabled` with wording that said or strongly implied these values were the tax applied to new invoices/contracts and the operational VAT switch.

**Canonical reality**

The current finance model requires effective-dated, approved tax authority. Recurring rent invoices resolve an active `company_tax_profiles` policy; management fees use the independent `company_fee_tax_treatments` authority. The canonical RC1 model explicitly does not fall back to `company_settings.vat_rate` for invoice tax truth.

**Risk**

An office administrator could change a visible percentage, believe invoicing tax changed, and operate under a false tax assumption even though the authoritative posting path follows a different policy.

**Correction in this PR**

- The settings navigation now calls these values reference/compatibility data.
- The documents/tax section explicitly states that changing the legacy/reference VAT fields does not create or activate an authoritative invoice or management-fee tax policy.
- Labels no longer call the legacy VAT rate the operational invoice authority.

**Remaining gap**

A clear, governed self-service product surface for viewing/configuring the effective-dated rent tax profile and independent fee-tax treatments is still required. It must preserve approval/versioning and must not be implemented as direct browser table writes.

### FOM-002 — Fixed-monthly management-fee accrual was grouped with custody funds — MEDIUM — corrected in this PR

**Observed product behavior**

The Money IA placed `fixed_monthly_accruals` inside the `funds` section labelled "التأمينات والملاك" alongside tenant deposits and owner settlements.

**Why this was conceptually wrong**

Tenant deposits are liabilities/custody funds. Owner settlements concern amounts due to/from owners. Fixed-monthly management-fee accrual is office consideration/receivable recognition under the management agreement. These have different economic ownership and different questions for the operator.

**Correction in this PR**

A distinct `fees` section labelled "الأتعاب والاستحقاقات" now owns fixed-monthly management-fee accrual. Old deep links that referenced the former funds location are resolved to the new section.

### FOM-003 — Operational collection report used `revenue` terminology for gross payments — HIGH — user-facing meaning corrected, compatibility debt retained

**Observed implementation**

The operational report calculation maps payment amounts into a field named `revenue`, totals that field as `totalRevenue`, and separately records expenses.

**Canonical conflict**

Under OWNER_AGENCY/agent-net, gross tenant rent collected on behalf of an owner is not office revenue. Office revenue is earned management/brokerage/service consideration according to the canonical accounting model.

**Additional scope problem**

The same operational view only compares payment rows with expense rows. It does not represent every movement through Cash/Bank control accounts: owner payouts, deposit receipts/refunds, commission payments, reversals, and other governed cash/bank events can exist outside that narrow pair of sources.

**Correction in this PR**

- User-facing reporting now calls the surface "التحصيل والمصروفات المسجلة" rather than presenting it as a cash-flow statement.
- The difference is labelled "فرق التحصيل والمصروفات" rather than a profitability implication.
- The UI explicitly states that the view is not the accounting cash-flow statement and not office profit.
- The TypeScript compatibility fields `revenue` and `totalRevenue` are documented as legacy names representing gross collections, not GL revenue.

**Remaining gap**

A later compatibility-safe migration may rename the internal DTO fields to `collections`/`totalCollections`. The official cash-flow and profitability outputs must continue to come from their GL-backed reporting contracts.

### FOM-004 — Reports mixed accounting controls with report outputs under one ambiguous label — MEDIUM — corrected in this PR

The Reports workspace contains Chart of Accounts, accounting periods, journal batches, trial balance, financial statements, detailed statements, and analytics. COA/periods/journal controls are not merely reports.

**Correction in this PR**

The section is now labelled "المحاسبة والرقابة" and its description distinguishes ledger controls from accounting outputs. The Finance overview link likewise points to "المحاسبة والرقابة والتقارير".

### FOM-005 — Authoritative tax policy is implemented but not surfaced as an obvious office setup journey — HIGH — open

Repository evidence contains the effective-dated tax-profile and fee-tax-treatment authority and tests, while the ordinary Settings UI still edits legacy/reference VAT fields. The product therefore lacks a clear setup journey that answers:

- Is rent tax policy configured for the invoice date?
- Is management-fee tax treatment configured independently?
- What version is active?
- Who approved it?
- From what date is it effective?
- Would invoice generation/fee accrual fail closed today?

**Required next implementation**

Create a finance-readiness/settings surface backed by governed read/write RPCs (or existing governed boundaries where already present), not by direct client-authored accounting state.

### FOM-006 — Canonical operating-journey documentation has status drift — MEDIUM — documented, not silently rewritten here

`02_OPERATING_MODELS_AND_JOURNEYS.md` still carries an older baseline and some "repository layer at baseline" statements that describe previously open gaps, while the newer finance model and later repository evidence record several of those areas as closed or forward-corrected.

This is dangerous because an agent can read an old journey row and conclude either:

- implemented behavior is missing when it is not, or
- an old partial path remains authoritative after a forward correction.

**Required follow-up**

Perform a canonical-pack reconciliation against the exact post-finance-correction main SHA. Do not update status by assumption; every row must cite current repository/runtime evidence.

### FOM-007 — Batch invoice generation is a valid recovery/operations action, but not proof of a complete billing operating system — MEDIUM — open product decision

Current UI provides an explicit "توليد فواتير العقود النشطة" batch action. The RPC is idempotent around missing periodic invoices and is a valid operator/recovery mechanism.

However, the existence of this button does not answer the complete operating questions:

- What billing obligations are due next?
- What was expected to be issued but was not?
- Is generation automated/scheduled or intentionally manual?
- Which contracts are blocked by missing tax/agreement/readiness data?
- How does an operator distinguish "not due" from "failed to issue"?

Do not replace the governed generator merely to automate the button. First define the billing schedule/readiness/exception contract; then decide whether automation is appropriate.

### FOM-008 — A single happy-path journey is not sufficient product acceptance for finance — HIGH — open test mission

The deterministic core journey is valuable: contract → invoice generation → collection/receipt → report/dashboard. But production finance acceptance requires a scenario matrix, not one non-taxable full-cash case.

Minimum scenario matrix for release confidence:

1. OWNER_IS_CREDITOR collection.
2. OFFICE_IS_CREDITOR billing/collection.
3. Taxable rent.
4. Zero-rated/non-taxable rent.
5. RATE management fee.
6. FIXED_MONTHLY fee accrual.
7. Full collection.
8. Partial collection.
9. Cash collection.
10. Bank collection.
11. Receipt void/reversal.
12. Invoice credit and credit reversal.
13. Deposit receipt/refund.
14. Deposit claim/application with required evidence.
15. Deposit reversal.
16. Owner settlement/payout.
17. Owner expense paid by office / Due from Owner.
18. Company operating expense.
19. Commission approval/payment/reversal.
20. Bank import/matching/reconciliation.
21. Soft/hard close and late posting.
22. Tenant statement reconciliation.
23. Owner statement reconciliation.
24. Subledger-to-GL controls for 1201/1300/2000/2200/2300.

## What is intentionally not changed here

This PR does **not** alter:

- double-entry posting formulas;
- OWNER_AGENCY agent-net accounting;
- OFFICE_IS_CREDITOR / OWNER_IS_CREDITOR treatment;
- tax-profile resolution logic;
- fee-tax resolution logic;
- invoice generation RPC behavior;
- collection/payment/receipt RPC behavior;
- deposit RPC behavior;
- owner-settlement RPC behavior;
- accounting periods;
- RLS/authorization;
- posted history or historical correction.

Those are governed financial boundaries. Product terminology and navigation are corrected around them without inventing new accounting truth in the browser.

## Operating model that the UI should converge on

### 1. Setup readiness

Before financial operation, the office should be able to see one readiness surface covering at least:

- company/currency/document identity;
- chart/accounting readiness;
- rent tax profile for current/effective dates;
- fee tax treatments;
- payment/bank methods supported by controlled accounts;
- payment terms and billing policy;
- owner agreement model/collection role;
- open accounting period;
- reconciliation/cutover warnings where applicable.

Missing authoritative policy should be visible before the operator reaches invoice generation or accrual failure.

### 2. Billing

Active contract + governing agreement/version + billing policy + effective tax authority → due obligation/invoice. A batch generator may execute the event, but the operator should see due/missing/blocked state rather than infer it from a button result.

### 3. Collection

Select collectible obligation → record controlled Cash/Bank receipt → server creates payment/receipt/allocation atomically → invoice/subledger updates → operator receives one confirmed receipt result. The user should not need to reason about Payment versus Receipt as two separate business actions.

### 4. Corrections

Credit/void/refund/reversal are explicit governed events. Posted financial history is never silently edited or deleted.

### 5. Owner/deposit consequences

Owner funds, Due from Owner, tenant deposits, and office-earned fees must stay visibly distinct because they represent different economic owners and control accounts.

### 6. Accounting and reporting

- Operational views answer work questions: what is due, collected, overdue, awaiting settlement, unmatched, or blocked.
- Accounting controls answer integrity questions: accounts, periods, journals, reversals, reconciliation.
- Statements answer party/account questions: tenant, owner, office, VAT.
- Financial statements answer accounting performance/position/cash-flow questions from the GL.
- Analytics may combine operational signals but must never relabel gross collections as office revenue/profit.

## Immediate follow-up priority after this PR

1. **Finance readiness + authoritative tax policy setup/read surface** — highest product risk because current backend authority exists without a clear ordinary-office setup journey.
2. **Billing obligations/readiness/exception workspace** — distinguish due, generated, blocked, failed, and recovered billing.
3. **Complete finance scenario matrix** — prove the operating system, not just individual RPCs.
4. **Canonical D02/D04/D07 reconciliation** — remove status drift after implementation evidence is rechecked.
5. **Compatibility cleanup** — rename legacy report DTO `revenue` fields only after callers/tests are migrated safely.

## Review conclusion

The primary issue is not that MALEK lacks accounting structure. The core accounting model is comparatively strong. The risk is that product surfaces can lag behind that model and make a technically correct backend feel like an inconsistent office workflow.

The governing rule for future work is therefore:

> A feature is not complete merely because its table, RPC, service, page, and tests exist. It is complete when the office user can identify the business event, perform it through the authoritative boundary, understand the resulting state, recover from failure, and obtain reports whose labels match the actual accounting meaning.
