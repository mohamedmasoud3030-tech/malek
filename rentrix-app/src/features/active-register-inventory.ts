/**
 * Active-register inventory — the canonical mapping of every authenticated
 * register surface to the shared responsive register foundation.
 *
 * This is the regression anchor for the P0 mobile-register unification:
 * each component below MUST render its primary register through
 * `EntityTable`/`DataTable` (the single responsive register primitive) and
 * must NOT bypass it with a raw `<table>`, `mobile-scroll-x`, a fixed table
 * min-width, or a page-specific mobile card layout.
 *
 * The routes listed are the canonical route-contract destinations the
 * component serves (see `src/app/navigation/route-contract.ts` and
 * `src/app/router/route-tree.ts`).
 *
 * Justified exclusions (not operational registers):
 * - `features/financials/reconciliation/bank-csv-import-workflow.tsx` — raw
 *   `<table>` used only as the CSV column-mapping preview inside the bank
 *   import wizard; it is a file-preview surface, not an operational register.
 * - `features/reports/components/GeneralLedgerCoreSection.tsx` — raw `<table>`
 *   for the General Ledger report output under `/reports`; it is a financial
 *   report renderer, not a CRUD register.
 * - `components/ui/design-system-showcase.tsx` + `components/ui/table.tsx`
 *   consumers in tests — DEV-only route / test fixtures, never shipped.
 * - `*.e2e-fixture.tsx` files — VITE_E2E-only browser-qa harnesses that reuse
 *   the same production components; not production routes.
 */
export const ACTIVE_REGISTER_INVENTORY = [
  { component: 'features/people/people-list-page.tsx', routes: ['/people', '/people/$personId', '/people/new', '/people/$personId/edit'] },
  { component: 'features/tenants/TenantsPage.tsx', routes: ['/tenants', '/tenants/$tenantId'] },
  { component: 'features/owners/components/owner-workspace-table.tsx', routes: ['/owners', '/owners/$ownerId', '/owners/$ownerId/edit'] },
  { component: 'features/owners/components/owner-dossier-body.tsx', routes: ['/owners/$ownerId'] },
  { component: 'features/owners/components/OwnerSettlementWorkspace.tsx', routes: ['/financials?section=funds&view=owner_settlements', '/owner-settlements'] },
  { component: 'features/contracts/components/ContractTable.tsx', routes: ['/contracts', '/contracts/$contractId'] },
  { component: 'features/contracts/contractPaymentsTab.tsx', routes: ['/contracts/$contractId'] },
  { component: 'features/lands/components/lands-view.tsx', routes: ['/lands', '/lands/$landId'] },
  { component: 'features/leads/components/leads-view.tsx', routes: ['/leads'] },
  { component: 'features/communication/components/communication-hub-view.tsx', routes: ['/communication'] },
  { component: 'features/units/units-list.tsx', routes: ['/properties/$propertyId/units'] },
  { component: 'features/units/units-page.tsx', routes: ['/properties?section=units', '/units'] },
  { component: 'features/properties/properties-list-page.tsx', routes: ['/properties', '/properties/$propertyId'] },
  { component: 'features/maintenance/components/maintenance-list.tsx', routes: ['/maintenance'] },
  { component: 'features/utilities/components/utilities-workspace.tsx', routes: ['/maintenance?section=utilities', '/utilities'] },
  { component: 'features/automation/components/automation-center-view.tsx', routes: ['/settings?section=automation', '/automation'] },
  { component: 'features/audit/components/audit-log-view.tsx', routes: ['/settings?section=audit-log', '/audit-log'] },
  { component: 'features/commissions/components/commissions-view.tsx', routes: ['/commissions'] },
  { component: 'features/financials/components/invoice-list-section.tsx', routes: ['/financials?section=collections&view=invoices', '/invoices'] },
  { component: 'features/financials/components/receipts-section.tsx', routes: ['/financials?section=collections&view=receipts', '/receipts'] },
  { component: 'features/financials/components/overdue-invoices-table.tsx', routes: ['/financials?section=collections&view=arrears', '/arrears'] },
  { component: 'features/financials/components/expenses-section.tsx', routes: ['/financials?section=expenses', '/expenses'] },
  { component: 'features/financials/deposits/deposits-workspace.tsx', routes: ['/financials?section=funds&view=deposits', '/deposits'] },
  { component: 'features/financials/receipts/receipts-page.tsx', routes: ['/receipts'] },
  { component: 'features/financials/reconciliation/bank-reconciliation-page.tsx', routes: ['/financials?section=banking', '/bank-reconciliation'] },
  { component: 'features/service-providers/service-providers-page.tsx', routes: ['/service-providers'] },
  { component: 'features/service-providers/service-provider-detail-page.tsx', routes: ['/service-providers/$providerId'] },
  { component: 'features/service-providers/components/service-provider-categories-dialog.tsx', routes: ['/service-providers'] },
  { component: 'features/reports/components/collections/daily-collections-panel.tsx', routes: ['/reports?section=collections'] },
  { component: 'features/reports/components/collections/rent-roll-panel.tsx', routes: ['/reports?section=collections'] },
  { component: 'features/reports/components/overdue/overdue-invoices-panel.tsx', routes: ['/reports?section=collections'] },
] as const;
