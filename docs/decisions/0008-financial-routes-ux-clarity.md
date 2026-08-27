# 0008. UX separation of `/financials` and `/reports`

## Context

MALEK exposes two top-level destinations that concern money but serve different jobs:

- `/financials` is the operational Money workspace for invoices, receipts, arrears, expenses, commissions, management-fee accruals, deposits, owner settlements, and bank reconciliation.
- `/reports` is the canonical reporting/accounting workspace for analysis, statements, GL-backed accounting reports, reconciliation evidence, filtering, and exports.

The routes intentionally share lower-level reporting/data services where appropriate, but they do not share navigation ownership or page composition.

## Decision

1. Keep `/financials` and `/reports` as separate top-level routes.
2. Keep operational mutations and day-to-day Money work under `/financials`.
3. Keep detailed reports, accounting statements, and reporting permissions under `/reports`.
4. Preserve compatibility deep links by resolving them into the canonical Money or Reports workspace rather than reviving retired page shells.
5. Keep bilingual shared terminology in `rentrix-app/src/lib/i18n.ts`; do not create route-local language state.
6. Do not change financial calculations, permissions, RPCs, RLS, or persistence merely to change the information architecture.

## Current canonical implementation

The implementation has evolved since this ADR was first written:

- `/financials` now resolves directly to `rentrix-app/src/features/finance/FinancePage.tsx`.
- Finance navigation/deep-link/permission resolution has one source of truth: `rentrix-app/src/features/finance/shell/financeShellModel.ts`.
- The retired `features/finance-hub/` shell has been removed.
- The retired duplicate `features/financials/financials-page.tsx` and `features/financials/finance-shell-model.ts` are not compatibility boundaries and must not be restored.
- Live business workspaces under `features/financials/` remain authoritative for invoices, receipts, arrears, expenses, deposits, fee accruals, billing, and bank reconciliation; the canonical `FinancePage` embeds them.
- `/reports` remains independent and routes accounting report reads through the canonical Accounting reports facade.

## Alternatives rejected

- **Merge `/financials` and `/reports` into one giant hub.** Rejected because operational Money work and reporting/accounting have different jobs, permissions, and interaction density.
- **Keep duplicate Finance page shells for compatibility.** Rejected because route compatibility belongs in route/deep-link resolution; duplicate renderers create drift and buried work.
- **Move operational financial mutations into Reports.** Rejected because Reports is an analysis/accounting destination, not the day-to-day mutation workspace.

## Consequences

- Users get one operational Money workspace and one reporting/accounting workspace.
- Legacy URLs may remain as redirects/resolution aliases without creating additional product destinations.
- Tests must target `FinancePage` and `financeShellModel` as the canonical UI/IA contract instead of source-scanning retired renderers.
- Any future Finance shell replacement must migrate route ownership and executable IA tests before the previous shell is deleted.

## Evidence

- `rentrix-app/src/routes/_protected.financials.tsx` — canonical `/financials` route export.
- `rentrix-app/src/features/finance/FinancePage.tsx` — canonical operational Money renderer.
- `rentrix-app/src/features/finance/shell/financeShellModel.ts` — canonical Finance sections, views, permissions, and deep-link resolution.
- `rentrix-app/src/features/reports/reports-page.tsx` — canonical Reports workspace.
- `rentrix-app/src/features/accounting/reports/accountingReportsFacade.ts` — canonical accounting-report read boundary.
- `rentrix-app/src/app/navigation/app-nav-items.ts` — task-centric product navigation.
- PR #1577 — Finance Hub unification.
- PR #1592 — retired finance-hub removal and architecture debt harvest.
- PR #1597 — Reports → Accounting canonical read-boundary consolidation.
