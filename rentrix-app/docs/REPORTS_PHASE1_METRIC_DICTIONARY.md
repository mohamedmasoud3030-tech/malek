# MALEK Reports Phase 1 — Metric Dictionary

Baseline: `128d980faa6ea9b22af7b513bbca51f9f41334b2`

Status: supporting audit artifact. Canonical business rules remain owned by the existing source-of-truth pack and backend/report authorities.

## Financial metrics

| Metric | Arabic meaning | Definition | Canonical source / boundary | Time semantics | Notes |
|---|---|---|---|---|---|
| `invoiced` | المستحق / المفوتر للفترة | Sum of gross invoice face value for the filtered report scope | `financial-reporting/report-calculations.ts` → invoice summary | Period/filter scoped | Distinct from contractual rent and from collected cash |
| `paid` | المحصل | Sum of actual payment amounts in the filtered payment scope | `financial-reporting/report-calculations.ts` → payment summary | Payment-date / period | Cash-basis receipt metric |
| `outstanding` | المتبقي | Remaining invoice balance (`gross - paid_amount`) for invoices with remaining > 0 | `financial-reporting/report-calculations.ts` | Snapshot/filter cutoff | Can include not-yet-due receivables |
| `totalOutstanding` | إجمالي المتبقي | Sum across all aged-receivable buckets including `current` | `arrears-reports-service.ts` → aged receivables summary | As-of | Always >= `totalOverdue` |
| `totalOverdue` | المتأخرات | Remaining balances whose due date is overdue; `current` bucket excluded | `arrears-reports-service.ts` | As-of | Do not label all outstanding as overdue |
| `referenceRevenue` | إيجارات العقود حسب دورتها | Sum of `rent_amount` for active contracts in property performance | `buildPropertyPerformanceRows` | Current active-contract state | Not monthly-normalized; not billed; not collected |
| `gross_rent_collected` | إجمالي الإيجار المحصل للتسوية | Actual tenant collections included in an owner settlement | settlement backend/service authority | Settlement period / lifecycle record | Distinct from `referenceRevenue` |
| `management_fee_amount` | أتعاب الإدارة | Management fee applied to the settlement | settlement authority | Settlement record | Office revenue; not owner rent revenue |
| `fee_vat_amount` | ضريبة أتعاب الإدارة | VAT charged on management fee | settlement authority (`tax_amount` normalized to fee VAT field) | Settlement record | Do not mix with utilities/taxes unrelated to the fee |
| `owner_expenses` | مصروفات محملة على المالك | Posted owner-charged expenses included in settlement calculation | settlement/accounting authority | Settlement record | Maintenance activity is not automatically included |
| `net_payable_amount` | صافي المستحق للمالك في التسوية | `gross_rent_collected - management_fee_amount - fee_vat_amount - owner_expenses` | server-derived settlement field | Settlement record | Canonical owner-payable net for that settlement |
| `outstandingNet` | صافي مستحقات الملاك غير المصروفة | Sum of settlement `net_payable_amount` for pending/approved settlements only | `summarizeLiveOwnerSettlements` | Current lifecycle liability | PAID and CANCELLED excluded |
| settlement `net` | صافي التسويات التاريخي | Sum of non-cancelled settlement net values including PAID | settlement totals service | Lifecycle/historical | Never substitute for `outstandingNet` |
| `netCash` | صافي الحركة النقدية للفترة | `paid - expenses` | `summarizeFinancialPeriodSummaryReport` | Period / cash basis | Never label as owner payable or profit |
| owner-statement row `net` | صافي حركة كشف المالك | Server/RPC-derived `gross - deduction` per statement row | `rpt_owner_statement` via `statements-reports-service.ts` | Statement transaction / selected scope | Distinct from both settlement net and `netCash` |

## Settlement lifecycle

Client settlement status currently normalizes to:

- `pending`
- `approved`
- `paid`
- `cancelled`

Confirmed truth constraint: **approved is not paid**. Current liability calculations exclude paid settlements.

Caveat: server `DRAFT` may normalize to client `pending`; this is tracked as a data-gap/semantic-normalization question rather than silently treated as a new canonical state.

## Arrears aging

| Bucket | Meaning |
|---|---|
| `current` | Not overdue yet, or no usable due date |
| `days_1_30` | 1–30 calendar days overdue |
| `days_31_60` | 31–60 days overdue |
| `days_61_90` | 61–90 days overdue |
| `days_90_plus` | >90 days overdue |

`totalOutstanding` includes `current`; `totalOverdue` excludes it.

## Occupancy and vacancy

### Canonical operating vacancy analytics

Source: `src/features/units/vacancy-analytics.ts` → `buildVacancyAnalytics`.

For current unit status:

- `totalUnits = all units in the supplied unit set`
- `occupiedUnits = status occupied/rented`
- `availableUnits = status available`
- `nonRentableUnits = every other status`
- `occupancyRate = occupiedUnits / totalUnits`
- `vacancyRate = availableUnits / totalUnits`

Important semantic rule in code: maintenance/reserved/non-rentable units are **not** vacant.

### Report occupancy rows

Source: `src/features/reports/reports-page.helpers.ts` → `buildOccupancyRows`.

This is a binary chart model:

- occupied/rented → `occupied`
- every other status → `vacant`

Therefore `vacant` in this row type is **not equivalent** to canonical `availableUnits`.

However, the current snapshot occupancy percentage derived as:

`occupied / (occupied + vacant)`

is mathematically equal to `occupiedUnits / totalUnits` because the binary row model partitions the same full unit set into occupied vs every-other-status.

Example: occupied + available + maintenance = 3 units.

- `buildVacancyAnalytics`: occupancy = `1/3 = 33.3%`, available/vacant = 1, non-rentable = 1.
- `buildOccupancyRows`: occupied = 1, `vacant` = 2, occupancy = `1/(1+2) = 33.3%`.

So the confirmed conflict is **vacancy classification/count/labeling**, not the current snapshot occupancy-rate denominator.

### Historical / trend occupancy

`buildVacancyAnalytics` reconstructs historical occupied units from contract coverage for previous-month comparison while retaining the supplied unit universe as denominator.

`professional-property-report.ts` also builds an occupancy trend from contract coverage (`unitOccupiedAsOf`) and labels it as contractual coverage.

This is a different semantic axis from current unit-status occupancy and must remain explicitly labeled as historical contractual coverage.

## Vacancy analytics

| Metric | Definition | Authority |
|---|---|---|
| `vacancyRate` | `availableUnits / totalUnits` | `buildVacancyAnalytics` |
| `averageVacancyDays` | Mean `daysVacant` over truly available units | `buildVacancyAnalytics` |
| `vacancySince` | Latest effective contract end; fallback to unit creation date | `buildVacancyAnalytics` |
| `referenceVacantRent` | Sum of reference rent for available/vacant units | `buildVacancyAnalytics` |
| `occupancyChangePoints` | Current occupancy rate minus previous-month occupancy rate | `buildVacancyAnalytics` |

`referenceVacantRent` is opportunity-cost context, not a receivable.

## Naming rules for Phase 2

Do not display a generic `net` without context. Prefer explicit presentation/view-model names such as:

- `ownerPayableNet`
- `ownerOutstandingPayable`
- `periodOperatingCash`
- `statementTransactionNet`

Do not use `revenue` as a synonym for collections. Existing `revenue` / `totalRevenue` legacy names that actually mean collections should remain visibly deprecated until removed through a dedicated compatibility cleanup.
