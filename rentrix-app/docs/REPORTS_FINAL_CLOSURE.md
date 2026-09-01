# MALEK Reports — Final Closure Certificate

**Reports repository scope: CLOSED**

Reports functionality is complete in this repository. This document is a
record, not a plan. It contains no planned phases and no future Reports work.

A later runtime date-boundary defect in
`product-workflow-scenarios.test.ts` (calendar-bound payment/settlement dates
against `generate_invoices_from_active_contracts()` `current_date`) is
**outside Reports**. That harness is repaired on
`fix/runtime-workflow-date-boundary-20260901` / this follow-up branch. Do not
treat GitHub CI as green until the pipeline itself proves it.

## Baseline

- Reports closure `main` baseline: `a7d96367389786315593a78c65d9206fc903a153`
  (`feat(reports): close documents and owner report wave`).
- Subsequent `main` at runtime-hygiene handoff:
  `ae01598071d5f5d587a89dbba0e52a6b9c3d9b4f`
  (`test(reports): lock property scope wiring behaviour`).

## Report workspaces covered

Seven workspaces, all reachable from the Reports primary navigation and all
locked by `report-center-ia-contract.test.ts` and
`reports-final-closure.test.ts`:

| Workspace | Views |
| --- | --- |
| أداء المكتب | Office overview |
| التحصيل والمتأخرات | Period summary, arrears & ageing, follow-up, collection movement |
| العقود والإشغال | Occupancy & vacancy, expiring contracts |
| التشغيل والمصروفات | Operations overview, maintenance, expenses, services/utilities |
| العقارات والوحدات | Property analytics |
| الكشوف | Statements workspace (owner / tenant perspectives) |
| المراجعة المالية (specialist) | Trial balance & statements, general ledger, deferred revenue |

## Golden Reports covered

- **Owner Golden Report** — `documents/professional-owner-report.ts`.
  Financial traceability: entitlements, deductions, settlement, owner money.
- **Property Golden Report** — `documents/professional-property-report.ts`.
  Performance: executive KPIs, current vs previous comparable period,
  portfolio benchmark at single-property scope, collection/arrears/expenses,
  maintenance, vacancy, expiring contracts, unit detail, deterministic print
  charts, final property performance summary.

The two documents are deliberately different and are contract-tested against
each other so their purposes cannot blur.

## Financial semantic invariants (locked by tests)

- `approved ≠ paid`; `outstanding ≠ overdue`; not-yet-due ≠ overdue.
- Occupancy denominator is the three-way universe
  `occupied + vacant + nonRentable`. Non-rentable stock is never vacant and
  never lettable opportunity — including in the monthly occupancy trend and in
  the portfolio benchmark population.
- **Unavailable ≠ zero.** Any ratio without a valid denominator, any metric
  without an authoritative source, and any comparison without a previous
  period is `null` and renders as `—` in app and as `—` in print.
- Maintenance recorded cost ≠ owner/posted expense. Unposted maintenance cost
  is operational pressure only; the posted expense remains the financial
  authority. No double counting.
- Reference vacant rent is a letting reference value — never income, never a
  receivable.
- Rate comparisons are in percentage POINTS; amount comparisons are absolute
  differences. No percent-of-percent anywhere.
- Collection rate is only shown from the authoritative portfolio source; at
  single-property scope the rate is omitted rather than invented.
- `collections − expenses` is never labelled profit. `netCash ≠ profit`.
- The property "priority" value is a deterministic operational ordering, not a
  risk probability, renewal probability or predictive confidence.
- No synthetic opening/closing/running balance is produced in Reports.

## Document outputs covered

Registered in `services/documents/documentRegistry.ts`, all A4 Arabic RTL with
print + PDF outputs, company identity, header/footer, page numbering and
signature roles:

- `owner_report` (Owner Golden Report)
- `property_report` (Property Golden Report)
- `tenant_statement`
- `owner_statement`
- `generic_report` (operational report outputs)
- accounting statements: `trial_balance`, `income_statement`, `balance_sheet`

Chart payloads use the single existing document chart architecture
(`ReportChartData` → deterministic print-safe SVG). There is no second chart
engine inside documents.

## Closure test / gate references

Reports-owned:

- `src/features/reports/reports-final-closure.test.ts` — the closure contract
  (semantics, presentation grammar, IA reachability, document inventory,
  charts).
- `src/features/reports/property-analytics-model.test.ts` — deterministic
  analytics model: unavailable-vs-zero, three-way occupancy, comparison
  points/amounts, portfolio benchmark, insight determinism.
- `src/features/reports/components/property-analytics-presentation.test.tsx`
  — presentation contract for the Property Analytics workspace.
- `src/features/reports/property-benchmark-wiring.test.tsx` — **wiring**
  contract: renders the real `useReportsWorkspace` at single-property scope and
  proves the benchmark population is the unfiltered portfolio while the
  property's own figures stay scoped, and that every previous-period query is
  scoped to the same property.
- `src/features/reports/documents/property-report-scope.test.ts` — **wiring**
  contract for the Property Golden Report: previous period and current period
  measure the same population, and the printed benchmark survives the scoped
  workspace rows.
- `src/features/reports/documents/professional-property-report.test.ts`
- `src/features/reports/documents/professional-owner-report.test.ts`
- `src/features/reports/report-center-ia-contract.test.ts`
- `src/features/reports/reports-touch-targets.test.ts`
- `src/features/reports/directory/report-directory-groups.test.ts`
- `src/features/reports/workspace/reports-workspace-structure.test.ts`

Shared:

- `src/components/ui/report-section-primitives.test.tsx`
- `src/services/documents/**` (registry, output inventory, readiness,
  professional report engine, renderer contracts)
- `src/app/product-simplification-contract.test.ts`

## Repository gate status (measured, not assumed)

Reports closed while the runtime contract suite was still red because the
lifecycle workflow test mixed `current_date` invoices with hard-coded August
dates. That defect is **not a Reports defect**. GitHub CI green is recorded
only after the pipeline proves it — this document does not claim a green
GitHub run in advance.

## Known external-only validation remaining

Everything achievable inside this repository is complete. The following can
only be exercised outside it:

- **Playwright browser runs.** The Playwright Chromium binary could not be
  downloaded in the build sandbox (`cdn.playwright.dev` is unreachable:
  `ECONNRESET` during `playwright install chromium`). The Reports E2E specs
  (`e2e/reports-workspace.spec.ts`, including its no-horizontal-overflow
  assertions across 375×812, 768×1024 and 1440×1000) are unchanged and run in
  CI, where the browser is available. The dev server was started and served
  `/reports` successfully (HTTP 200) as a live smoke check.
- **Rendered PDF byte inspection on staging/production data.** Document
  composition, pagination, identity and chart payloads are contract-tested
  here; visual confirmation against real customer data is a hosted-environment
  activity.
