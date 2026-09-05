# MALEK Reports Phase 1 — Authority Map

Baseline: `128d980faa6ea9b22af7b513bbca51f9f41334b2`

Status: supporting implementation artifact. It maps report concepts to their existing authority boundaries; it does not replace canonical product/accounting source-of-truth documents.

## Rule

A future report redesign must answer: **Where is this number allowed to come from?**

Presentation components may format, group and explain canonical values, but must not silently create a second financial authority.

## Authority map

| Concept                                              | Canonical authority / derivation boundary                                    | Authority type                                      | Presentation may do                                  | Presentation must not do                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| Invoice gross / billed                               | financial-reporting invoice summary (`report-calculations.ts`)               | canonical report derivation over invoice read model | format, compare periods                              | recompute from unrelated contract rent                                   |
| Collected / paid                                     | financial-reporting payment summary                                          | canonical report derivation over payments           | format, group by period/method                       | infer from invoice status                                                |
| Invoice outstanding                                  | remaining invoice amount authority                                           | canonical report derivation                         | present as remaining                                 | relabel all remaining as overdue                                         |
| Aged outstanding / overdue                           | `arrears-reports-service.ts`                                                 | canonical aged-receivable derivation                | show buckets and as-of labels                        | collapse `current` into overdue                                          |
| Contractual/reference rent                           | active contract `rent_amount` via `buildPropertyPerformanceRows`             | analytical/current-contract metric                  | label explicitly as contract-cycle rent              | call it billed, collected, or normalized monthly revenue                 |
| Settlement gross/fees/VAT/owner expenses/net payable | settlement backend/service fields                                            | financial authority                                 | explain equation and lifecycle state                 | recompute owner payable from screen-only data                            |
| Owner outstanding payable                            | `summarizeLiveOwnerSettlements(...).outstandingNet`                          | lifecycle liability derivation                      | display current unpaid liability                     | include paid/cancelled settlements                                       |
| Owner statement rows/totals                          | `rpt_owner_statement` via `statements-reports-service.ts`                    | server/RPC authority                                | normalize/format only                                | rebuild totals in React                                                  |
| Tenant statement rows/balance                        | `rpt_tenant_statement` via `statements-reports-service.ts`                   | server/RPC authority                                | normalize/format only                                | create alternate balance logic                                           |
| Period net cash                                      | `summarizeFinancialPeriodSummaryReport` (`paid - expenses`)                  | period analytical/cash metric                       | label as period cash movement                        | call it profit or owner payable                                          |
| Current occupancy / operating vacancy                | `buildVacancyAnalytics`                                                      | shared operational derivation                       | present occupied, available, non-rentable separately | treat maintenance/reserved as vacant                                     |
| Property analytics occupancy rows                    | `buildOccupancyRows`                                                         | legacy/binary presentation derivation               | use only with explicit semantics                     | assume `vacant` means `available`                                        |
| Property performance composite row                   | `buildPropertyPerformanceRows`                                               | composed analytical read model                      | rank/compare properties                              | elevate derived risk/occupancy labels into financial authority           |
| Historical occupancy comparison                      | contract coverage in `buildVacancyAnalytics` / property report trend helpers | deterministic historical analytical derivation      | label as historical/contractual coverage             | imply it is the same source as current unit status without qualification |
| Maintenance cost/activity                            | maintenance service/read model                                               | operational authority                               | show operational activity/cost                       | automatically deduct from owner settlement                               |
| Owner-deductible expenses                            | posted owner-charged expense/settlement authority                            | financial authority                                 | show as actual deduction                             | infer deduction from maintenance ticket cost                             |
| Property professional PDF                            | existing `professional-property-report.ts` + canonical document platform     | presentation/document adapter                       | shape canonical/read-model values                    | introduce independent financial calculations                             |
| Owner professional PDF                               | existing `professional-owner-report.ts` + canonical document platform        | presentation/document adapter                       | explain canonical statement/settlement data          | invent opening/closing balances                                          |

## Document platform boundary

The existing document platform is canonical infrastructure:

- `DocumentEngine`
- `documentRegistry`
- `DocumentController`
- `DocumentRenderer`
- `DocumentService`
- guarded document actions / existing boundary tests

Future report work must extend this stack rather than introduce a second renderer/export engine.

## Product-route boundary

`report-products.ts` owns the product/target metadata and its `kind` presentation classification; `report-route.ts` owns deep-link normalization. `/reports` lists analytical/operational report products only. Owner and tenant account statements retain their canonical direct product route but are entered from owner, tenant/person-contract, and contract context. `premium/report-product-page.tsx` is the shared direct route: it uses report chrome for reports and entity-first statement chrome for statements. `components/report-view-panel.tsx` remains its direct canonical body dispatcher. Presentation work must preserve this product-route contract and extend shared primitives rather than restoring a workspace shell, a second registry, or unrelated app-wide primitives.

## Screen ↔ document parity contract

For a given metric and scope:

1. screen and document must use the same semantic definition;
2. period vs as-of vs lifecycle must remain explicit;
3. approved vs paid must remain distinct;
4. outstanding vs overdue must remain distinct;
5. maintenance activity must remain distinct from owner-deductible expense;
6. any comparison must compare commensurable definitions and clearly label historical reconstruction where the source differs.

## Known overloaded names

The following labels are not sufficient as canonical concepts and must be disambiguated in future view models/UI copy:

- `net`
- `revenue`
- `vacant`

Use the Metric Dictionary before introducing new presentation labels.
