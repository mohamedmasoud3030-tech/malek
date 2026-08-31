# MALEK Reports Phase 1 — Coverage Matrix

Baseline: `128d980faa6ea9b22af7b513bbca51f9f41334b2`

Status: Phase 1 supporting audit artifact. This is **not** a new canonical source-of-truth document and does not replace `docs/source-of-truth/*`.

## Purpose

Inventory the active Reports Center surfaces, their business question, primary authority boundary, document-output status, and Phase 2 treatment. Merge recommendations are based on business question + audience, never on similar names alone.

## Workspace registry

The active registry is `src/features/reports/report-workspaces.ts`. It defines seven business workspaces and 15 named routed views, plus the statements workspace landing surface.

| Workspace | Routed views | Business question | Primary authority boundary | Document/output status | Phase 2 recommendation |
|---|---|---|---|---|---|
| `office` — أداء المكتب | `overview` | What needs management attention across collections, leasing, operations and property performance? | Workspace model composed from existing report authorities; drill-through owns the detail | Screen summary / drill-through | KEEP; presentation refactor only |
| `collections` — التحصيل والمتأخرات | `collections`, `overdue`, `follow_up`, `collection_movement` | What was billed/collected/outstanding, what is overdue, who needs follow-up, and how did collections move? | Canonical financial-reporting summaries + arrears reports + receipt/payment read models | Existing report screens; export behavior varies by view | KEEP; preserve distinct period vs as-of semantics |
| `leasing` — العقود والإشغال | `occupancy`, `expiring` | What is occupied/available/non-rentable, how long has vacancy lasted, and which contracts expire soon? | `buildVacancyAnalytics` + contract read models | Screen-focused | KEEP; resolve vacancy-classification semantics before presentation rewrite |
| `operations` — التشغيل والمصروفات | `operations_overview`, `maintenance_analytics`, `expenses`, `services` | Where do operational costs and interventions come from? | Maintenance, expense and utility/service authorities remain separate | Existing report screens | KEEP; never auto-sum independent operational sources into owner deductions |
| `properties` — العقارات والوحدات | `property_analytics` | How is each property performing across occupancy, collections, arrears, expenses and maintenance? | `buildPropertyPerformanceRows` composed from canonical/read-model inputs | `PropertyAnalyticsSection` + professional property PDF/print | REFACTOR; presentation target after vacancy semantics are clarified |
| `statements` — الكشوف | workspace landing (`defaultView: ''`) | What is the authoritative owner/tenant movement and settlement position? | `rpt_owner_statement`, `rpt_tenant_statement`, settlement lifecycle authorities | Owner professional document exists; statement workspace owns additional panels | KEEP; clarify workspace landing/view contract during presentation work |
| `financial_review` — المراجعة المالية | `accounting_reports`, `general_ledger`, `deferred_revenue` | What does the specialist/accounting reviewer need from GL and financial review? | Accounting/WP05/GL authorities | Specialist surfaces | KEEP; defer visual overhaul until daily-decision workspaces are stable |

## Confirmed wiring notes

- `report-workspaces.ts` is the single workspace IA registry and preserves legacy `?section=&view=` links while user-facing navigation uses `?workspace=&view=`.
- `workspace/adapters/report-adapter-contract.ts` is the stable adapter seam. New report families should be added through adapters rather than by replacing the workspace router.
- `AnalyticsReportsAdapter.tsx` exposes both `property_analytics` and `occupancy` as sibling views. This matters because they currently use different vacancy classifications even though their snapshot occupancy percentage is mathematically the same.
- `use-reports-workspace.ts` carries both `occupancyRows` and `vacancyAnalytics`; they are not interchangeable concepts.
- `PropertyAnalyticsSection.tsx` uses `occupancyRows` / `PropertyPerformanceRow` and outputs through the existing professional property document path.
- Statements are RPC-authoritative at the service boundary; client normalization should not become a second calculation authority.

## Clean areas — do not re-audit in Phase 2

- Owner-settlement screen/service separation of historical `net` vs current `outstandingNet`.
- Arrears `totalOutstanding` vs `totalOverdue` separation.
- Collections/collection-movement use of canonical `invoiced` / `paid` / `outstanding` report shapes.
- Statement totals are server/RPC-authoritative and only normalized client-side.
- `approved != paid` is already enforced in the settlement/document path.
- Maintenance activity is not automatically an owner deduction; posted owner-charged expenses remain the financial deduction authority.

## Phase 2 entry order

1. Start with clean semantic surfaces (`collections` / collection movement) to establish the presentation system.
2. Apply the same presentation system to the document workspace and Owner Statement golden report.
3. Resolve the vacancy classification naming/model gap before redesigning `property_analytics` and leasing occupancy visuals.
4. Apply the golden pattern to Property Performance.
5. Migrate remaining daily-decision report families.
6. Tackle `financial_review` last as a specialist surface.

## Non-goals of this artifact

- No business formula changes.
- No report UI redesign.
- No new document engine.
- No retirement/deletion decision without usage and business-question evidence.
