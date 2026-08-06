# PR 2 — Document caller migration inventory

This inventory is reviewed against the production source tree after PR 1 (`5f8da3bb`). A production print/PDF caller is considered migrated only when the handler constructs the typed payload and invokes `documentService.printDocument` or `documentService.downloadDocumentPdf` directly. `DocumentTemplates` is retained only as a compatibility adapter for legacy consumers and tests.

## Production callers

| Document / surface | Production entry point | Canonical service operation | Settings/readiness | Error path | Result |
|---|---|---|---|---|---|
| Invoice | `features/financials/invoices/useInvoiceWorkspaceController.ts` → `invoices/invoice-actions.ts` | `invoice` print/PDF | `useDocumentSettings().isReady`; permission and readiness gate both list and detail actions | `runDocumentAction`, Arabic renderer/settings message | **MIGRATED** |
| Receipt | `features/financials/receipts/receipt-detail-page.tsx` | `receipt` print/PDF | `useDocumentSettings().isReady`; toolbar and mobile handlers are guarded | `runDocumentAction`; print loading state always settles | **MIGRATED** |
| Contract | `features/contracts/pages/ContractDetailPage.tsx` → `contracts/actions/contractDetailActions.ts` | `contract` print/PDF | real company settings; direct buttons disabled and menu actions omitted while not ready | action helper surfaces original error | **MIGRATED** |
| Expense voucher | `features/financials/components/expenses-section.tsx` → `expenses/expense-actions.ts` | `expense_voucher` print/PDF | `useDocumentSettings().isReady`; menu items are disabled until ready | `runDocumentAction` | **MIGRATED** |
| Deposit clearance | `financials/deposits/deposits-workspace.tsx` | `generic_report` print/PDF | readiness gate already present and enforced in both handlers | `runDocumentAction` | **MIGRATED** |
| Owner settlement | `owners/components/OwnerSettlementWorkspace.tsx` | `owner_statement` print/PDF | readiness gate already present and enforced in both handlers | `runDocumentAction` | **MIGRATED** |
| Tenant statement | `reports/components/StatementsSection.tsx` | `tenant_statement` print/PDF | shared statement buttons disabled and notice shown when settings are incomplete | awaited service call with toast of real error | **MIGRATED** |
| Owner statement report | `reports/components/StatementsSection.tsx` | `owner_statement` print/PDF | shared statement buttons disabled and notice shown when settings are incomplete | awaited service call with toast of real error | **MIGRATED** |
| Trial balance | `reports/components/AccountingReportsSection.tsx` | `trial_balance` print/PDF | common accounting action readiness gate | `runDocumentAction` | **MIGRATED** |
| Income statement | `reports/components/AccountingReportsSection.tsx` | `income_statement` print/PDF | common accounting action readiness gate | `runDocumentAction` | **MIGRATED** |
| Balance sheet | `reports/components/AccountingReportsSection.tsx` | `balance_sheet` print/PDF | common accounting action readiness gate | `runDocumentAction` | **MIGRATED** |
| Collections | `reports/components/CollectionsSection.tsx` | `generic_report` print/PDF | existing readiness gate | awaited service call with toast of real error | **MIGRATED** |
| Deferred revenue | `reports/components/DeferredRevenueReportSection.tsx` | `generic_report` print/PDF | existing readiness gate | awaited service call with toast of real error | **MIGRATED** |
| Expenses report | `reports/components/ExpensesSection.tsx` | `generic_report` print/PDF | existing readiness gate | awaited service call with toast of real error | **MIGRATED** |
| Maintenance report | `reports/components/MaintenanceReportSection.tsx` | `generic_report` print/PDF | existing readiness gate | awaited service call with toast of real error | **MIGRATED** |
| Occupancy | `reports/components/OccupancySection.tsx` | `generic_report` print/PDF | existing readiness gate | awaited service call with toast of real error | **MIGRATED** |
| Overdue | `reports/components/OverdueSection.tsx` | `generic_report` print/PDF | existing readiness gate | awaited service call with toast of real error | **MIGRATED** |
| Property analytics | `reports/components/PropertyAnalyticsSection.tsx` | `generic_report` print/PDF | existing readiness gate | awaited service call with toast of real error | **MIGRATED** |
| Maintenance A4 list | `maintenance/components/maintenance-workspace.tsx` | `generic_report` print | readiness gate and visible settings notice | `runDocumentAction` | **MIGRATED** |
| Utilities report | `utilities/components/utilities-workspace.tsx` | `generic_report` print/PDF | readiness gate and visible settings notice | `runDocumentAction` | **MIGRATED** |

## Explicitly documented non-production compatibility

- `services/pdfService.ts` has no production imports in `src`; its exports remain promise-returning compatibility adapters and are covered by `pdfService.test.ts`. There is no production fire-and-forget caller to migrate.
- `services/documents/DocumentTemplates.tsx` has no production output caller after this PR. It remains for compatibility tests/consumers and delegates to the canonical service; its payload conversion functions are shared through `documentPayloadAdapters.ts`, not duplicated.
- CSV exports, vault/storage downloads, WhatsApp links, and receipt print-tab links are not document/PDF renderer callers and are intentionally unchanged.

## Boundary checks

- No caller uses the deprecated `documentService.print`, `documentService.downloadPdf`, or `documentService.renderPdf` methods.
- No production caller imports the `DocumentTemplates` object.
- No caller changes SQL, calculations, statuses, permissions, or business references.
- Internal UUID fragments are not supplied as document references; where the schema has no real number, the canonical payload carries `null`.
- Company identity comes from the saved `company_settings` record through `useDocumentSettings`; the client-facing document layer has no `MALEK` fallback.
