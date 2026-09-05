# MALEK Reports Phase 1 — Data & Semantic Gaps

Baseline: `128d980faa6ea9b22af7b513bbca51f9f41334b2`

Status: supporting audit artifact. This register separates confirmed semantic conflicts from authority gaps, naming debt, and presentation-only issues.

## G1 — Vacancy classification mismatch in property analytics

**Severity:** High for presentation correctness; not a financial-accounting defect.

**Confirmed behavior:**

`src/features/units/vacancy-analytics.ts` → `buildVacancyAnalytics` uses a three-way status model:

- occupied/rented → occupied
- available → available/vacant
- every other status → non-rentable

The code explicitly states that maintenance/reserved units are not silently counted as vacant.

`src/features/reports/reports-page.helpers.ts` → `buildOccupancyRows` uses a binary model:

- occupied/rented → occupied
- every other status → `vacant`

Therefore a maintenance/reserved/non-rentable unit is shown as `vacant` in property analytics rows even though the shared vacancy authority does not classify it as vacant.

**Important correction to the original agent audit:** this does **not** create a current snapshot occupancy-rate denominator conflict. Because the binary row model partitions all units, `occupied/(occupied+vacant)` still equals `occupied/totalUnits` for the same unit set.

Example:

- units: occupied + available + maintenance
- canonical operating analytics: occupied 1, available 1, non-rentable 1, occupancy 33.3%
- binary property rows: occupied 1, `vacant` 2, occupancy 33.3%

The defect is the **vacant count/label and any downstream risk logic using that count**, not the current snapshot occupancy percentage.

**Affected surfaces:**

- `PropertyAnalyticsSection.tsx`
- `PropertyPerformanceRow.vacantUnits`
- `buildPropertyPerformanceRows` vacancy-pressure/risk inputs
- current property PDF occupancy block created from `occupancyFromRows`
- any portfolio benchmark using the binary occupancy rows

**Future presentation requirement:** choose one explicit presentation contract. Preferred direction is to preserve `buildVacancyAnalytics` semantics (`available` is the only vacancy state) and evolve report row types to carry `nonRentable` separately instead of silently folding it into `vacant`.

## G2 — Historical occupancy uses contract coverage, current snapshot uses unit status

**Severity:** Medium; potentially legitimate but must be explicit.

Current occupancy comes from current unit status. Historical comparison/trend reconstructs occupancy from contract coverage (`unitOccupiedAsOf` / `buildVacancyAnalytics` historical logic).

This is not inherently wrong, but it compares two different evidence sources. The property document already labels the trend as contractual coverage; Future presentation work must preserve that distinction and must not present the trend as a pure replay of historical `unit.status`.

Additional caveat: historical occupancy functions use the supplied/current unit universe as denominator. A unit created after the historical comparison date can therefore affect a historical rate unless the caller supplies a historically valid unit universe. Treat this as an authority caveat requiring focused verification before changing formulas.

## G3 — Opening/closing balance authority gap

**Severity:** High for any future cash-position statement that promises opening/closing balances.

The professional owner report intentionally does not invent opening/closing running balance where no authoritative read source is available to that report. This is a known authority gap, not a UI omission to patch with client math.

Any future opening/closing balance feature must be sourced from an explicit backend/GL authority and covered by financial parity tests.

## G4 — Settlement `DRAFT` vs client `pending` collapse

**Severity:** Medium / product-semantic question.

The client settlement status union exposes `pending | approved | paid | cancelled`; server `DRAFT` can normalize to `pending` through fallback logic.

Do not add a visible DRAFT state during presentation refactoring unless the lifecycle product contract is intentionally changed. Record/verify whether this collapse is deliberate before surfacing workflow-state copy.

## G6 — Overloaded `net`

**Severity:** Medium naming risk.

At least three distinct concepts use `net` language:

1. settlement `net_payable_amount` — owner payable for settlement;
2. period `netCash` — paid minus expenses;
3. owner-statement transaction `net` — RPC-derived gross minus deduction.

This is not a calculation bug. It is a high-risk presentation naming issue. New view models and UI copy must use explicit names.

## G7 — `revenue` / `totalRevenue` legacy naming

**Severity:** Medium semantic debt.

Some legacy report types use `revenue` terminology for gross collections/payment-derived values. Existing code already carries deprecation markers in parts of this path.

Do not perform an unrelated accounting refactor inside the presentation phase. New code must avoid extending this terminology and should prefer `collections`, `paid`, or the exact canonical metric name.

## Presentation-only clarity items

These do not require backend authority changes:

- `totalOutstanding` / "المتبقي" should be explained as including not-yet-due balances, while `totalOverdue` is past-due only.
- `referenceVacantRent` is opportunity-cost/reference rent, not a receivable.
- contract `referenceRevenue` is active-contract rent by its configured cycle, not monthly-normalized revenue.

## Phase 1 closure decision

The originally proposed new regression test for "occupancy-rate divergence when nonRentableUnits > 0" should **not** be added because that asserted divergence is false. Existing tests already prove that `buildOccupancyRows` folds maintenance into its binary `vacant` bucket.

A future test should be added only when the product/engineering decision for G1 is implemented, so the test protects the chosen canonical vacancy classification rather than freezing the known semantic mismatch.

## Guardrail for future presentation work

Do not redesign property occupancy/vacancy cards, property-performance vacancy counts, or related PDF blocks until G1 is resolved explicitly. Any future work must preserve the canonical product-route architecture and the authority boundaries recorded here.
