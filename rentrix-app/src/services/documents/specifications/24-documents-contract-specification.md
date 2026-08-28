# MALEK — 24 Business Documents Execution Specification

> **Status:** implementation specification only. This file defines the exact integration contract for a future implementation branch. It does **not** authorize creating a parallel document engine, inventing data sources, or bypassing existing finance/security boundaries.
>
> **Target:** `rentrix-app/` on the latest `main` at implementation time.
>
> **Core rule:** the 24 items below are **business artifacts**, not automatically 24 new technical `DocumentTypeId` values.

---

## 0. Purpose

Deliver 24 Arabic-first operational/financial documents through the **existing MALEK Document Platform**.

Canonical flow:

```text
Canonical domain/read service
        ↓
Feature-owned adapter
        ↓
CanonicalDocumentPayloadMap payload
        ↓
documentEngine.buildDocument(...)
        ↓
UnifiedDocumentModel
        ↓
DocumentController
        ↓
DocumentRenderer
        ↓
A4 Print OR real PDF download
```

The implementation is complete only when every enabled artifact uses this path and no feature owns its own print/PDF engine.

---

## 1. Current platform contract — do not replace

The implementation must extend these existing authorities:

```text
src/services/documents/
  documentPayloads.ts       # DocumentTypeId + CanonicalDocumentPayloadMap
  documentRegistry.ts       # typed/versioned output contract
  DocumentEngine.ts         # ONLY builder of UnifiedDocumentModel
  DocumentController.ts     # print/PDF orchestration boundary
  DocumentRenderer.ts       # scoped print + browser PDF
  DocumentService.ts        # ONLY UI-facing public service
  types.ts                  # UnifiedDocumentModel / SignatureRole
  renderer/documentHtml.ts  # canonical print/PDF markup
  TableGenerator.ts
```

Current canonical public API:

```ts
await documentService.printDocument(type, { settings, payload });
await documentService.downloadDocumentPdf(type, { settings, payload });
```

Do **not** implement or document a fictional API such as:

```ts
DocumentService.renderDocument(...)
```

The compatibility methods `print`, `downloadPdf`, and `renderPdf` remain legacy-only. New work must use the typed methods above.

---

## 2. Important corrections to the earlier draft

### 2.1 The 24 deliverables are business documents, not 24 mandatory registry types

The platform already has these technical types:

```text
contract
invoice
receipt
expense_voucher
payment
owner_statement
tenant_statement
trial_balance
income_statement
balance_sheet
generic_report
```

Reuse an existing type when it can represent the artifact truthfully. Add a new `DocumentTypeId` only where the business artifact has materially different required data, status semantics, signatures, or legal/operational structure.

### 2.2 Do not create React document templates in features

The current renderer builds canonical document markup in `renderer/documentHtml.ts`; `DocumentEngine` returns `UnifiedDocumentModel`.

Therefore do **not** create a second architecture based on:

```text
src/services/documents/templates/*.tsx
src/features/*/documents/templates/*.tsx
```

Feature code may own adapters/actions only. Shared printable markup stays in the existing document platform.

### 2.3 Do not add permission strings to `documentRegistry.ts`

`DocumentTemplateEntry` currently owns output/data/reference/status/signature/page/currency/empty-state/filename policies. It does not own application permission names.

Authorization remains enforced by the existing feature/route/service permission boundary before the document action is exposed. The document service must never grant access to data the caller could not already read.

### 2.4 Currency is company-derived, not globally hard-coded to OMR

MALEK commonly operates in OMR and OMR renders with 3 decimals, but the document engine deliberately derives precision from the real company currency.

Required rule:

```text
currency source = company settings
precision = currency-derived
```

Never hard-code `toFixed(3)` inside adapters/templates. Never recompute financial totals inside the document layer.

### 2.5 No invented hooks/read models

Names such as `useOwnerSettlementModel()` or `useBudgetVarianceModel()` are not contracts unless they actually exist in the repository.

For each artifact the implementer must locate the current canonical service/query/read model. If the required authority does not exist, mark that artifact `DATA_AUTHORITY_MISSING` and defer it. Do not invent a client-side calculation or parallel read model to make the document appear complete.

---

## 3. Technical classification of the 24 business artifacts

Legend:

- **REUSE** = use an existing `DocumentTypeId`; only adapter/action work is expected.
- **NEW TYPE** = add a dedicated typed payload + registry entry + engine builder.
- **GENERIC** = use `generic_report` when the source already supplies canonical rows/totals and no separate legal state machine is required.

| # | Business artifact | Technical path | Suggested adapter home | Canonical authority requirement |
|---:|---|---|---|---|
| 1 | Lease Summary Sheet | **REUSE `contract`** | `features/contracts/documents/` | Existing contract read model/service |
| 2 | Move-In / Move-Out Snagging | **NEW TYPE `unit_inspection`** | `features/maintenance/documents/` or unit workflow owner | Canonical inspection/condition evidence; otherwise defer |
| 3 | Lease Renewal / Vacate Notice | **NEW TYPE `lease_notice`** | `features/contracts/documents/` | Contract dates/status + real notice decision |
| 4 | Rent Receipt Voucher | **REUSE `receipt`** | receipt/financial feature documents | Canonical receipt/payment authority |
| 5 | Rent Due Invoice | **REUSE `invoice`** | invoice/financial feature documents | Canonical invoice/schedule authority |
| 6 | Security Deposit Voucher | **NEW TYPE `deposit_voucher`** | deposits/financial documents | Canonical deposit ledger/transaction authority |
| 7 | Aged Arrears Ledger | **GENERIC `generic_report`** | `features/reports/documents/` | Canonical arrears report/read model |
| 8 | Debt Rescheduling Agreement | **NEW TYPE `debt_rescheduling`** | contracts/financial documents | Approved rescheduling domain data; never derive schedule in adapter |
| 9 | Commercial VAT Statement | **GENERIC `generic_report`** | `features/reports/documents/` | Canonical tax/invoice tax snapshots |
| 10 | Tenant Final Clearance | **NEW TYPE `tenant_clearance`** | contracts/tenant documents | Canonical contract + invoices/payments/deposit clearance result |
| 11 | Owner Settlement Statement | **NEW TYPE `owner_settlement`** | owner/settlement documents | Existing owner settlement authority only |
| 12 | Annual Portfolio Report | **GENERIC `generic_report`** | `features/reports/documents/` | Canonical portfolio report inputs |
| 13 | Management Exit Clearance | **NEW TYPE `management_exit`** | properties/owners documents | Property + owner agreement + handover evidence |
| 14 | Vacancy Loss Audit | **GENERIC `generic_report`** | `features/reports/documents/` | Canonical occupancy/vacancy data |
| 15 | Unit Lifecycle Passport | **NEW TYPE `unit_passport`** | properties/units documents | Canonical unit + leases + maintenance history projections |
| 16 | Budget Variance Report | **GENERIC `generic_report`** | `features/reports/documents/` | Canonical budget authority; if none exists => defer |
| 17 | Portfolio Benchmark Ranking | **GENERIC `generic_report`** | `features/reports/documents/` | Canonical benchmark/scoring authority; no client scoring |
| 18 | Building Rent Roll | **GENERIC `generic_report`** | `features/reports/documents/` | Canonical lease/unit/rent-roll projection |
| 19 | Maintenance Work Order | **NEW TYPE `maintenance_work_order`** | `features/maintenance/documents/` | Canonical maintenance record/provider assignment |
| 20 | Maintenance Completion Certificate | **NEW TYPE `maintenance_completion`** | `features/maintenance/documents/` | Completed maintenance + evidence + approved cost |
| 21 | Annual Preventive Plan | **GENERIC `generic_report`** | maintenance/report documents | Canonical preventive schedule; if absent => defer |
| 22 | Utility / CAM Split Sheet | **GENERIC `generic_report`** | utilities/report documents | Canonical utility obligations/allocation authority |
| 23 | Petty Cash Statement | **GENERIC `generic_report`** | financial/report documents | Canonical petty-cash ledger; if absent => defer |
| 24 | Eviction / Rental Dispute Legal Dossier | **NEW TYPE `legal_dossier`** | contracts/documents | Read-only aggregation of canonical evidence; no invented legal conclusions |

This classification is the default implementation plan. It may only be changed when repository evidence proves an existing payload is insufficient or a supposedly new type can be represented truthfully by an existing type.

---

## 4. Required content of each business artifact

Every enabled artifact must specify and test these six things:

```text
1. real source authority
2. business reference policy
3. exact document sections/tables
4. truthful status wording
5. signature roles
6. empty/fail-closed behavior
```

### 4.1 Lease Summary Sheet

Technical type: `contract`.

Required content:
- real contract reference when present;
- contract status;
- tenant identity/contact already available to caller;
- property + unit;
- start/end dates;
- rent amount;
- payment cycle;
- canonical contract notes/terms already stored.

No duplicate contract calculation. No UUID fragment as contract number.

### 4.2 Move-In / Move-Out Snagging

Technical type: `unit_inspection`.

Minimum payload:
- reference, inspection date, inspection mode (`move_in` / `move_out` / `inspection`);
- property/unit;
- tenant when applicable;
- condition rows `{ areaOrItem, condition, note }`;
- meter readings when canonical data exists;
- key/asset handover facts;
- evidence/attachment references when available.

Block output if no canonical inspection evidence exists. Do not fabricate a clean-condition checklist.

### 4.3 Lease Renewal / Vacate Notice

Technical type: `lease_notice`.

Minimum payload:
- real contract reference;
- tenant/property/unit;
- current contract end date;
- notice date;
- notice kind (`renewal`, `vacate`, `non_renewal`);
- effective date;
- approved message/terms supplied by caller.

The document reports a decision already present in the domain; it must not decide renewal automatically.

### 4.4 Rent Receipt Voucher

Technical type: `receipt`.

Use the existing receipt payload and canonical receipt number. Show payment method/reference only when present. Never use invoice/payment UUIDs as visible receipt numbers.

### 4.5 Rent Due Invoice

Technical type: `invoice`.

Amounts, VAT, paid amount, total and remaining balance must be caller-supplied authoritative values exactly as supported by the current invoice payload. The engine must not recompute VAT or outstanding balance.

### 4.6 Security Deposit Voucher

Technical type: `deposit_voucher`.

Minimum payload:
- transaction reference/date;
- transaction kind (`received`, `returned`, `deducted`, `transferred` only if canonical domain supports it);
- tenant/property/unit;
- amount;
- canonical deposit balance/result only when supplied by deposit authority;
- reason/notes.

Do not map this to `expense_voucher` or `payment`; deposits are not ordinary office revenue/expense.

### 4.7 Aged Arrears Ledger

Technical type: `generic_report`.

Expected sections:
- report period/as-of date;
- tenant/property/unit;
- due amount;
- aging bucket supplied by canonical report logic;
- total overdue supplied by report authority.

Document layer must not calculate aging buckets.

### 4.8 Debt Rescheduling Agreement

Technical type: `debt_rescheduling`.

Minimum payload:
- agreement reference/date;
- tenant + contract/property/unit;
- authoritative debt amount at agreement time;
- approved installment schedule rows;
- effective date/status;
- terms/notes.

No schedule generation in adapter or DocumentEngine.

### 4.9 Commercial VAT Statement

Technical type: `generic_report`.

Use canonical VAT/tax snapshot values only. The document may present taxable amount, VAT amount and totals supplied by the source; it must not calculate tax rates from raw invoice rows.

### 4.10 Tenant Final Clearance

Technical type: `tenant_clearance`.

Minimum payload:
- contract/tenant/property/unit;
- clearance date;
- authoritative financial-clearance state;
- outstanding amount if supplied;
- deposit disposition if supplied;
- maintenance/utility obligations only when supplied by canonical authorities;
- final status.

The document must refuse to say "براءة ذمة" unless the canonical clearance result proves it.

### 4.11 Owner Settlement Statement

Technical type: `owner_settlement`.

Minimum payload must come directly from the owner-settlement lifecycle/read authority:
- settlement reference/status/period;
- owner/property;
- collected owner funds;
- management fee;
- owner expenses/offsets;
- net due/payout;
- payout reference/date when actually paid;
- supporting rows/evidence already linked to the settlement.

Critical rule: do not recompute `net due` in the adapter or document engine. Do not call managed owner rent "office revenue".

### 4.12 Annual Portfolio Report

Technical type: `generic_report`.

Use canonical report inputs for occupancy, collections, arrears, expenses and other approved portfolio metrics. Every total must come from the report/domain source.

### 4.13 Management Exit Clearance

Technical type: `management_exit`.

Minimum payload:
- property + owner;
- agreement reference/end date/status;
- exit date;
- keys/documents/assets handed over;
- outstanding owner settlement state when canonical data supplies it;
- notes/evidence.

Do not imply final financial settlement merely because management ended.

### 4.14 Vacancy Loss Audit

Technical type: `generic_report`.

Rows may include unit, vacancy start/end/days and authoritative loss estimate only if a canonical report model already supplies that estimate. If only vacancy duration exists, print duration only.

### 4.15 Unit Lifecycle Passport

Technical type: `unit_passport`.

Minimum payload:
- property/unit identity;
- current operational status;
- lease history projection;
- maintenance history projection;
- utility/meter summary when canonical;
- financial summary only from existing read models.

This is a read-only dossier, not a new balance authority.

### 4.16 Budget Variance Report

Technical type: `generic_report`.

Requires a real budget source plus actual values from canonical reporting. If the product has no canonical budget domain, leave this artifact unavailable and record `DATA_AUTHORITY_MISSING`.

### 4.17 Portfolio Benchmark Ranking

Technical type: `generic_report`.

Ranking/scores must come from a canonical analytics authority. The document adapter cannot invent weights, ranking formulas or normalization.

### 4.18 Building Rent Roll

Technical type: `generic_report`.

Expected rows: unit, tenant, contract status, contract dates, rent amount/payment cycle and due/paid context only when canonical read models already expose them.

### 4.19 Maintenance Work Order

Technical type: `maintenance_work_order`.

Minimum payload:
- work-order reference/status/date;
- property/unit;
- maintenance issue/category/priority;
- assigned provider/technician when real;
- responsibility party when canonical;
- approved estimate/limit when canonical;
- instructions/notes.

Creating the printable order must not mutate maintenance state.

### 4.20 Maintenance Completion Certificate

Technical type: `maintenance_completion`.

Minimum payload:
- maintenance/work-order reference;
- completion date/status;
- property/unit;
- work performed;
- provider;
- approved final cost from canonical source;
- before/after evidence references when available;
- tenant/manager acceptance facts when actually recorded.

Do not call an open/in-progress record "مكتمل".

### 4.21 Annual Preventive Plan

Technical type: `generic_report`.

Requires a canonical preventive-maintenance schedule. If no such authority exists, defer the artifact rather than invent recurring tasks in the document layer.

### 4.22 Utility / CAM Split Sheet

Technical type: `generic_report`.

Allocation amounts/formulas must already be canonical. The document only presents supplied unit shares, meter/service periods, totals and responsibility.

### 4.23 Petty Cash Statement

Technical type: `generic_report`.

Requires a canonical petty-cash ledger/read model. If none exists, defer. Do not repurpose general expenses into a fictional petty-cash balance.

### 4.24 Eviction / Rental Dispute Legal Dossier

Technical type: `legal_dossier`.

This artifact is a read-only evidence package. Minimum payload may include:
- contract/tenant/property/unit references;
- timeline events supplied by domain/audit sources;
- unpaid invoices/receipts/arrears evidence supplied by canonical services;
- notices/attachments/contextual documents;
- current case/internal status when it exists.

The document must not make legal determinations, claim an eviction order exists, or fabricate statutory notices.

---

## 5. New dedicated technical types — exact implementation boundary

If repository discovery confirms the need for the 11 dedicated types above, extend `DocumentTypeId` with only:

```ts
| 'unit_inspection'
| 'lease_notice'
| 'deposit_voucher'
| 'debt_rescheduling'
| 'tenant_clearance'
| 'owner_settlement'
| 'management_exit'
| 'unit_passport'
| 'maintenance_work_order'
| 'maintenance_completion'
| 'legal_dossier'
```

For every added type, the implementation must update all of these in the same focused change:

```text
documentPayloads.ts
  - payload interface
  - DocumentTypeId
  - CanonicalDocumentPayloadMap

documentRegistry.ts
  - one DocumentTemplateEntry

DocumentEngine.ts
  - one canonical builder
  - builder dispatch/parity

renderer/documentHtml.ts
  - only if a truly reusable rendering primitive is missing

Tests
  - payload/registry parity
  - builder truthfulness
  - print/PDF rendering
  - empty/fail-closed behavior
```

Do not add a registry entry without a builder, and do not add a builder that bypasses the registry.

---

## 6. Signature roles

Current platform roles are:

```ts
'towner' | 'tenant' | 'accountant' | 'general_manager'
```

Some of the 24 business artifacts require an inspector/vendor signature. If those signatures are confirmed product requirements, extend the shared type centrally:

```ts
'inspector' | 'vendor'
```

Then update the canonical signature-label map in `renderer/documentHtml.ts` and its tests. Do not render ad-hoc signature boxes inside feature adapters.

Until that central extension is implemented, inspector/vendor names may be presented as document data/evidence, but they must not masquerade as canonical signature roles.

---

## 7. Feature adapter contract

Adapters belong with the domain that owns the data, for example:

```text
src/features/contracts/documents/
src/features/maintenance/documents/
src/features/owners/documents/
src/features/properties/documents/
src/features/reports/documents/
src/features/utilities/documents/
```

Create a directory only when a real adapter/action is implemented.

Adapter responsibilities:

```text
ALLOW
- map already-authoritative domain/read data into a typed document payload
- format descriptive labels only when they do not change business meaning
- omit unavailable optional data
- fail closed when required canonical data is unavailable

FORBID
- direct Supabase queries when the feature has a canonical service seam
- balance/revenue/VAT/commission/net-payout calculations
- generating business references from UUID fragments
- changing lifecycle state
- approving/voiding/posting anything
- creating alternate report truth
```

Company settings must be supplied through the existing document company-settings path; never hard-code company name, currency, address, tax number or logo.

---

## 8. UI action contract

A feature action should end at the existing typed service boundary:

```ts
import { documentService } from '@/services/documents/DocumentService';

await documentService.printDocument('receipt', {
  settings,
  payload,
});

await documentService.downloadDocumentPdf('receipt', {
  settings,
  payload,
});
```

The same rule applies to new technical types after they are registered.

No feature may call:

```text
window.print()
jsPDF
html2canvas-pro
DocumentRenderer directly
DocumentController directly
```

---

## 9. Renderer / A4 requirements

Keep the existing renderer as the single output engine.

Required behavior:

- Arabic-first RTL output with self-hosted Cairo;
- white print/PDF surface even when app theme is dark;
- real company identity;
- A4 page policy from registry;
- rows never split mid-row;
- repeated table headers through the existing chunking/pagination path;
- totals only on the final table chunk;
- signature block kept atomic;
- no blank trailing pages;
- filename from `buildDocumentFileName()` only;
- real PDF download continues through the existing jsPDF/html2canvas path inside `DocumentRenderer`.

Landscape should be used only for dense tabular artifacts such as arrears/rent-roll/variance/benchmark when the final registry entry explicitly selects it.

---

## 10. QR / barcode

No QR/barcode package is currently part of the platform contract.

QR is **not** a blocker for delivering the 24 artifacts. Do not add a QR dependency in the first implementation wave unless a specific artifact has an approved verification/deep-link requirement and the payload is safe to encode.

Never put private financial details, tenant identifiers, balances or unrestricted attachment URLs into a QR payload.

---

## 11. Data-authority readiness rule

Before implementing each adapter, record one of these statuses in the PR description/test matrix:

```text
READY_EXISTING_SOURCE
READY_AFTER_TYPED_ADAPTER
DATA_AUTHORITY_MISSING
DEFERRED_BY_PRODUCT
```

`DATA_AUTHORITY_MISSING` is a valid outcome and must **not** be bypassed by client calculations.

Particular artifacts likely to require explicit authority verification before implementation include:

```text
Budget Variance
Portfolio Benchmark Ranking
Annual Preventive Plan
Petty Cash Statement
Debt Rescheduling Agreement
Move-In/Out Inspection evidence
```

This list is a verification priority, not an assertion that those sources are absent.

---

## 12. Execution sequence

### Stage D0 — Baseline and inventory

- start from latest remote `main`;
- run current document tests before edits;
- inventory the actual domain service/read-model source for all 24 artifacts;
- classify every artifact with the readiness status above;
- do not code adapters for missing authorities.

### Stage D1 — Shared document contract

- add only the dedicated `DocumentTypeId` values confirmed necessary;
- add typed payloads;
- extend signature roles centrally only if required;
- add registry entries;
- preserve all 11 existing document types unchanged unless a proven bug requires a focused compatibility fix.

### Stage D2 — DocumentEngine builders

- add exactly one builder per new registry type;
- pass numbers through unchanged;
- use existing money/date/reference helpers;
- build `UnifiedDocumentModel` only;
- no JSX/feature-specific renderer.

### Stage D3 — Reuse/generic adapters

Implement the artifacts mapped to `contract`, `invoice`, `receipt` and `generic_report` first. These should produce the smallest architecture diff and validate the extension pattern.

### Stage D4 — Dedicated operational/legal adapters

Implement inspection, notices, deposit voucher, rescheduling, clearance, owner settlement, management exit, unit passport, maintenance order/completion and legal dossier only when their canonical data authority is proven.

### Stage D5 — Feature actions

Wire contextual Print/PDF actions from the owning feature. Do not create a new global "documents application" or duplicate navigation root.

### Stage D6 — Verification

Required focused checks include the existing document-platform tests such as:

```text
src/services/documents/DocumentRenderer.test.ts
src/services/documents/DocumentService.test.ts
src/services/documents/DocumentTemplates.test.ts
src/services/documents/documentRegistry.test.ts
src/services/documents/companyIdentity.test.ts
```

Plus new tests for every added payload/builder/adapter and relevant feature actions.

Then run repository gates required by current `AGENTS.md` / CI, including typecheck, architecture, business rules and build as applicable.

---

## 13. Per-artifact acceptance checklist

An artifact is **DONE** only when all answers are YES:

```text
[ ] canonical source identified by real repository file/service/query
[ ] no invented financial calculation
[ ] typed payload exists or existing payload reused truthfully
[ ] registry contract exists when a dedicated type is used
[ ] exactly one canonical engine builder exists for each dedicated type
[ ] correct company identity is required/fail-closed
[ ] truthful business reference policy
[ ] truthful status wording
[ ] correct signature roles
[ ] empty state is explicit
[ ] print uses documentService.printDocument
[ ] PDF uses documentService.downloadDocumentPdf
[ ] A4/RTL/Cairo verified
[ ] long-table pagination verified where applicable
[ ] filename sanitized by central registry helper
[ ] permission/company isolation unchanged
[ ] focused tests pass
```

A document is **not** considered complete merely because a sample PDF renders.

---

## 14. Architecture guards / forbidden implementation

The implementation must be rejected if it introduces any of the following:

```text
second PDF engine
second print engine
@react-pdf/renderer
Puppeteer/Chromium service without a separate architecture decision
feature-level window.print()
feature-level jsPDF/html2canvas calls
hard-coded company identity
hard-coded OMR precision
UUID fragments displayed as document numbers
client-side owner settlement calculation
client-side VAT calculation
client-side arrears/benchmark/budget truth
new permission vocabulary invented only for documents
new hooks/read models named in the spec but unsupported by repository code
parallel global documents navigation/workspace
mutation side effects caused by generating a document
```

---

## 15. Final delivery definition

The 24-document package is complete when the repository contains:

```text
A. Business artifact matrix covering all 24 items
B. Real source-authority evidence for every enabled item
C. Reused existing document types wherever sufficient
D. Dedicated typed document types only where required
E. Canonical registry + engine parity
F. Feature adapters/actions that call DocumentService only
G. Print + PDF regression coverage
H. No parallel rendering/calculation/security authority
I. Explicit deferred list for any artifact whose canonical data source does not yet exist
```

The implementation objective is **not** "make 24 PDFs at any cost". The objective is to deliver 24 trustworthy MALEK business artifacts without weakening the existing architecture, finance truth, company isolation, or print/PDF platform.