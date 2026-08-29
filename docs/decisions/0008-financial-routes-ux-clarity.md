# 0008. UX separation of `/financials` and `/reports`

## Context

MALEK exposes two top-level destinations that concern money but serve different jobs:

- `/financials` is the operational Money workspace for invoices, receipts, expenses, commissions, management-fee accruals, deposits, owner settlements, and bank reconciliation.
- `/reports` is the canonical reporting/accounting workspace for analysis, statements, GL-backed accounting reports, reconciliation evidence, filtering, and exports.

The routes intentionally share lower-level reporting/data services where appropriate, but they do not share navigation ownership or page composition.

A second distinction is equally important: the Money workspace must be organized around the operator's job, not around internal modules. The routine collection path is "find invoice → understand who/property/period → collect → receipt confirmation" and must not require navigating through several registers.

## Decision

1. Keep `/financials` and `/reports` as separate top-level routes.
2. Keep operational mutations and day-to-day Money work under `/financials`.
3. Keep detailed reports, accounting statements, and reporting permissions under `/reports`.
4. Make `/financials` task-first: the default destination is the unpaid invoice register, not an additional dashboard/cockpit.
5. Keep one routine finance navigation surface for `الفواتير والتحصيل`, `دخل المكتب`, `المصروفات`, `الأمانات والملاك`, and `البنوك`. Do not add a desktop sidebar inside the application's existing shell.
6. Treat the receipt view as a register/history destination; invoice collection starts from the invoice row and completes in-context.
7. Keep arrears analysis deep-linkable, but routine overdue collection is reachable through invoice status filtering rather than advertising a duplicate daily destination.
8. Invoice identity must expose business context — reference, tenant, property/unit, billing period, due date, amount/remaining, and status — before asking the operator to open detail.
9. Billing-readiness diagnostics belong to the invoice-generation action, not above the daily invoice register.
10. Preserve compatibility deep links by resolving them into the canonical Money or Reports workspace rather than reviving retired page shells.
11. Keep bilingual shared terminology in `rentrix-app/src/lib/i18n.ts`; do not create route-local language state.
12. Do not change financial calculations, permissions, RPCs, RLS, or persistence merely to change the information architecture.

## Current canonical implementation

- `/financials` resolves directly to `rentrix-app/src/features/finance/FinancePage.tsx`.
- Finance navigation/deep-link/permission resolution has one source of truth: `rentrix-app/src/features/finance/shell/financeShellModel.ts`.
- The default Money location is `collections / invoices`.
- `FinancePage` renders one horizontal section navigation and embeds the existing authoritative business workspaces; it does not own a second desktop sidebar.
- The invoice workspace uses the existing `EntityTable` register and direct quick-collect flow. It does not introduce a second table/card system.
- Invoice search resolves invoice reference plus tenant/phone/property/unit context through the canonical contract relations already used by the product.
- Billing readiness is shown only when the operator starts invoice generation.
- `receipts`, `arrears`, fee accruals, commissions, deposits, owner settlements, and bank reconciliation remain available according to permission and context without becoming separate top-level products.
- The retired `features/finance-hub/` shell has been removed and must not be restored.
- The retired duplicate `features/financials/financials-page.tsx` and `features/financials/finance-shell-model.ts` are not compatibility boundaries and must not be restored.
- `/reports` remains independent and routes accounting report reads through the canonical Accounting reports facade.

## Alternatives rejected

- **Merge `/financials` and `/reports` into one giant hub.** Rejected because operational Money work and reporting/accounting have different jobs, permissions, and interaction density.
- **Keep a finance dashboard as the mandatory first step.** Rejected because it adds a navigation layer before the most frequent operator jobs.
- **Keep an internal desktop finance sidebar plus sub-tabs.** Rejected because it duplicates the application shell and increases navigation depth.
- **Require opening the receipts register before collecting an invoice.** Rejected because the invoice itself is the task anchor and the canonical quick-collect flow can complete in-context.
- **Keep duplicate Finance page shells for compatibility.** Rejected because route compatibility belongs in route/deep-link resolution; duplicate renderers create drift and buried work.
- **Move operational financial mutations into Reports.** Rejected because Reports is an analysis/accounting destination, not the day-to-day mutation workspace.

## Consequences

- A routine user entering Money sees actionable invoices first.
- Finding a debt by tenant/property/unit does not require knowing an internal invoice UUID.
- Desktop and PWA use the same invoice register and collection action; the invoice register defaults to table mode while retaining the canonical register view choice.
- Specialist registers and history remain available without competing with the routine workflow.
- Users get one operational Money workspace and one reporting/accounting workspace.
- Legacy URLs may remain as redirects/resolution aliases without creating additional product destinations.
- Tests target `FinancePage`, `financeShellModel`, and the invoice-register task flow as executable IA contracts.

## Evidence

- `rentrix-app/src/routes/_protected.financials.tsx` — canonical `/financials` route export.
- `rentrix-app/src/features/finance/FinancePage.tsx` — canonical operational Money renderer.
- `rentrix-app/src/features/finance/shell/financeShellModel.ts` — canonical Finance sections, views, permissions, and deep-link resolution.
- `rentrix-app/src/features/financials/components/invoice-list-section.tsx` — canonical invoice register and direct collection affordance.
- `rentrix-app/src/features/financials/invoices/invoiceService.ts` — invoice/context read contract.
- `rentrix-app/src/features/reports/reports-page.tsx` — canonical Reports workspace.
- `rentrix-app/src/features/accounting/reports/accountingReportsFacade.ts` — canonical accounting-report read boundary.
- `rentrix-app/src/app/navigation/app-nav-items.ts` — task-centric product navigation.
- `rentrix-app/src/features/finance/finance-task-first-ux.test.ts` — focused UX/IA guard.
- PR #1577 — Finance Hub unification.
- PR #1592 — retired finance-hub removal and architecture debt harvest.
- PR #1597 — Reports → Accounting canonical read-boundary consolidation.
