# MALEK Reports — Final Closure Certificate

**Status: Reports work complete in this repository; closure is PENDING REVIEW
and pending a green CI run on `main`.** This document does not itself declare
Reports closed — see "Repository gate status" below for the literal state.

This document records the state of Reports at the end of the work. It is a
record, not a plan. It contains no planned phases and no future Reports work.

## Baseline

- Final `main` baseline used: `a7d96367389786315593a78c65d9206fc903a153`
  (`feat(reports): close documents and owner report wave`).
- Closure branch: `arena/01a05a36-malek`.

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
- `src/features/reports/reports-scope-wiring-regression.test.ts` — source
  guard pinning the scope wiring in the hook and the document.
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

Every step of `.github/workflows/ci.yml` was run locally against this branch.
The result is reported literally, including what is failing.

| CI step | Result |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm lint` | pass |
| `check:architecture` | pass |
| `check:frontend-db-contract` | pass |
| `Frontend ↔ Backend runtime contract suite` | **FAIL — 3 tests** |
| `pnpm build` | pass |

Also run outside CI: canonical business rules, documentation link check,
10-stage execution plan guard — all pass. Full Vitest suite: 3369 passed,
15 failed.

### The failing gate, stated plainly

`Frontend ↔ Backend runtime contract suite` fails on three tests in
`src/features/lifecycle/product-workflow-scenarios.test.ts` (Scenario 2 reads
`receiptRes.rows[0].id` on an empty result; Scenario 4 violates
`owner_settlements_payment_state_check`).

These failures are **pre-existing and unrelated to Reports**. This was
verified, not assumed:

- a clean worktree at the untouched baseline `a7d9636` reproduces the same
  three failures with the same messages;
- the three most recent CI runs on `main` — including the run for the baseline
  commit itself — all concluded `failure`.

No Reports file is involved in any of the three. Fixing the lifecycle/owner
settlement scenarios is outside the Reports scope and is not attempted here.
**CI for this branch will therefore be red until that separate defect is
fixed**, and Reports must not be recorded as closed on the basis of a green
pipeline that does not exist.

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
