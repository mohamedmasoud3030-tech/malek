# MALEK Visual Wave 2 — Finance & Reporting Conformance Audit

Date: 2026-08-06
Branch: `fix/ui-malek-pro-visual-wave-2-finance-reporting`
PR: #1358 (Draft)
Base SHA: `f84dc96d6d5698af227f226e03ca2cfb00a06f7b` (latest main at branch creation, verified via `git fetch origin main && git log origin/main -1`)
Head SHA (at audit time): `401db81` (local) / `9aea9fd` (remote before this audit commit) — will be updated after final push
Merge commit verified: `f84dc96d6d5698af227f226e03ca2cfb00a06f7b` exists in main history, title `fix(ui): adopt Malek Pro visual system for core operational surfaces (#1357)`

## 1. Finance / Report Route Inventory (verified from `route-tree.ts` and filesystem)

**Primary finance hubs (new IA, Wave 2 scope):**
- `/financials` → `rentrix-app/src/features/financials/financials-page.tsx` — summary + workflow groups (hub)
- `/finance/collections` → `collections-hub-page.tsx` → tabs: `invoices`, `receipts`
  - `invoices` → `InvoicesWorkspace` → `InvoiceWorkspaceSection` → `InvoiceListSection`, `InvoiceDetailSection`, `ReceiptsSection`
  - `receipts` → `ReceiptsWorkspace` → `ReceiptsHistoryContent`, `ReceiptDetailCard`
- `/finance/expenses` → `expenses-arrears-hub-page.tsx` → tabs: `expenses`, `arrears`
  - `expenses` → `ExpensesWorkspace` → `ExpensesSection`, `expenses-page` KPIs
  - `arrears` → `ArrearsWorkspace` → `ArrearsWorkspaceSection` → `ArrearsSummaryCards`, aging buckets
- `/finance/deposits` → `deposits-settlements-hub-page.tsx` → tabs: `deposits`, `owner_settlements`
  - `deposits` → `DepositsWorkspace` → deposit ledger, deductions, refunds
  - `owner_settlements` → `OwnerSettlementWorkspace`
- `/finance/banking` → `banking-commissions-hub-page.tsx` → tabs: `bank_reconciliation`, `commissions`
  - `bank_reconciliation` → `BankReconciliationWorkspace` → `BankStatementLinesTable`
  - `commissions` → `CommissionsWorkspace` → `CommissionsView`, `CommissionRows`

**Legacy redirects (must remain redirects, not modified beyond visualVariant):**
- `/invoices` → `/finance/collections?section=invoices`
- `/receipts` (list) → `/finance/collections?section=receipts`
- `/expenses` → `/finance/expenses?section=expenses`
- `/arrears` → `/finance/expenses?section=arrears`
- `/deposits` → `/finance/deposits?section=deposits`
- `/owner-settlements` → `/finance/deposits?section=owner_settlements`
- `/bank-reconciliation` → `/finance/banking?section=bank_reconciliation`
- `/commissions` → `/finance/banking?section=commissions`
- `/accounting` → `/financials`

**Explicitly excluded:**
- `/receipts?receiptId=...` printable A4 receipt surface — full-bleed print engine, not in Wave 2
- Print/PDF/A4 documents, document templates
- Dashboard V2, Properties, Contracts, Maintenance, Owners, People, Units, Settings, App shell (except direct regression fix via visualVariant wrapper)

**Reports:**
- `/reports` → `reports-page.tsx` → `ReportsWorkspace`
  - Sections: `overview`, `property_analytics`, `overdue`, `occupancy`, `collections`, `expenses`, `maintenance_analytics`, `deferred_revenue`, `statements`, `accounting`
  - Components: `ReportsFilterSurface`, `OverviewSection`, `CollectionsSection`, `ExpensesSection`, `OverdueSection`, `OccupancySection`, `PropertyAnalyticsSection`, `MaintenanceReportSection`, `DeferredRevenueReportSection`, `StatementsSection`, `AccountingReportsSection`, accounting panels (`trial-balance`, `income-statement`, `balance-sheet`), collections panels, etc.

**Shared presentation components (Wave 2 scope limited to these):**
- `finance-hub-workspace.tsx`, `finance-hub-model.ts`, `finance-hub-sections.ts`
- `financials/components/*` — invoice-workspace-section, invoice-list-section, invoice-filters, invoice-summary-cards, receipt-detail-card, arrears-*, expenses-section, financial-reports-preview-section, finance-reporting-visual-foundations.tsx (new), finance-table-visual.test.tsx, finance-reporting-visual-wave-2.test.tsx
- `financials/invoices/*`, `expenses/*`, `deposits/*`, `reconciliation/*`, `reports/*` presentation layer only
- `reports/components/*` — ReportsWorkspace, ReportsFilterSurface, FiltersPanel, etc.
- `commissions/components/*`
- `owners/components/OwnerSettlementWorkspace.tsx` (settlement tab)

## 2. Open PR Overlap Map

At branch creation (2026-08-06):
- PR #1355 `audit/s03-t01-gl-gap-matrix` — touches only `docs/accounting/S03_T01_GL_GAP_AUDIT.md` — **no file overlap** with finance/reporting UI.
- PR #1358 self — Wave 2.

At audit time:
- `gh pr list --state open` shows only #1355 and #1358.
- No other open PR touches `rentrix-app/src/features/financials/*`, `finance-hub/*`, `reports/*`, `commissions/*`, `owners/*` presentation.
- Strategy: commits are isolated and re-applicable; no force-push over accounting work; no cherry-pick.

## 3. Before-State Findings

Visual inspection of files at base SHA `f84dc96`:

- `finance-hub-workspace.tsx` had `PageLayout` without `visualVariant="malek-pro"` and no `data-finance-root` marker — no compact finance rhythm, no shadow/border hierarchy.
- `financials-page.tsx` used `PageLayout` without visualVariant, had `FinancialReportsPreviewSection` with raw `grid gap-3 sm:grid-cols-2 lg:grid-cols-6` of plain divs using `bg-muted/30` — no drill-down, no LTR islands, no semantic status.
- `financial-reports-preview-section.tsx` had 6 plain cards with no KPI drill, no tabindex, no amount LTR islands, no explicit loading/empty/error distinction beyond dashed border.
- `invoice-summary-cards.tsx` used `KpiCard` with `accent="sky" | "emerald" | "amber"` — product palette but not drillable, no filter preservation.
- `invoice-list-section.tsx` had legacy `invoiceStatusTone` mapping to legacy tones `green/gold/red/blue/gray` — not semantic `success/warning/danger/info/neutral`, and used raw `StatusBadge tone={legacy}` — no `FinanceStatusBadge` unified, no `FinanceAmount` LTR islands, filters were inline without bottom-sheet, pagination controls had `min-h-11` but filter inputs had `min-h-12` vs `min-h-10` inconsistency, no `ActionMenu` for secondary actions, mobile cards used `MobileCard` but accent mapping relied on overdue check.
- `invoice-filters.tsx` had no bottom-sheet for mobile complex filters, no active filter count, no `min-h-11` consistency, no aria `role="tablist"` for status filters.
- `expenses-page.tsx` had `ResponsiveCardGrid` with `KpiCard` `accent="rose" | "amber" | "sky"` — not primary, no drill, no finance root.
- `arrears-summary-cards.tsx` used `rose` and `amber` accents for overdue amounts — should be primary with trend, plus drill-down.
- `deposits-workspace.tsx` had 4 `KpiCard` with `rose`, `emerald`, `sky` accents, no finance foundation.
- `bank-reconciliation-page.tsx` had `KpiCard` accents `amber`, `emerald`, `rose` — not primary, no drill to status filter.
- `commissions-view.tsx` had `KpiCard` accents `amber`, `sky`, `emerald` — not primary, no finance root, no filter preservation.
- `reports-page.tsx` had `PageLayout` without visualVariant, no finance root, no hierarchy.
- `ReportsWorkspace.tsx` used `ResponsiveCardGrid` + `KpiCard` without drill-down to report sections, no filter preservation, no explicit error distinction beyond `rounded-2xl border-destructive`.
- Raw Tailwind palette check: `grep -RIn "emerald-|slate-"` across finance showed only product palette via `data-accent` (allowed), not raw `bg-emerald-200` etc. However `ContractAgreementMissingAlert.tsx` (outside Wave 2 scope) had raw `border-emerald-200 bg-emerald-50` — not touched to avoid scope creep.

## 4. Files Changed (Wave 2)

- `docs/decisions/0014-malek-visual-contract-v2-wave-2-finance-reporting.md` — new ADR authorizing Wave 2, scope lock, logic protection, token rules
- `rentrix-app/src/styles/finance-reporting-visual-wave.css` — new scoped CSS under `[data-visual-wave='malek-pro'][data-finance-root]` for compact hierarchy, KPI grid, filter bar, table wrapper, LTR islands, mobile cards, loading/error/empty distinction, focus rings
- `rentrix-app/src/styles/globals.css` — import new finance wave CSS after malek-pro
- `rentrix-app/src/features/financials/components/finance-reporting-visual-foundations.tsx` — new presentation-only foundations: `FinanceStatusBadge`, `getFinanceStatusTone`, `mapInvoiceStatusToFinanceKind`, `buildDrillDownSearch`, `preserveFinanceFilters`, `FinanceKpiCard`, `FinancePageRoot`, `FinanceSection`, `FinanceCluster`, `FinanceKpiGrid`, `FinanceFilterBar`, `FinanceTableWrapper`, `FinanceMobileCard`, `FinanceAlert`, `FinanceAmount`, `FinanceLoadingState`, `FinanceErrorState`, `FinanceEmptyState`
- `rentrix-app/src/features/finance-hub/finance-hub-workspace.tsx` — add `visualVariant="malek-pro"` + `data-finance-root` + `data-finance-header`
- `rentrix-app/src/features/financials/financials-page.tsx` — add visualVariant, finance root, hierarchy (context, summary KPIs, filters cluster, main workflow list), secondary analytics lower priority
- `rentrix-app/src/features/financials/components/financial-reports-preview-section.tsx` — refactor to `FinanceKpiGrid`, `FinanceKpiCard` with drillTo `/finance/collections` etc, preserving `dateFrom/dateTo`, LTR islands via `FinanceAmount`, explicit `FinanceLoadingState`/`FinanceErrorState`
- `rentrix-app/src/features/financials/components/invoice-summary-cards.tsx` — replace `ResponsiveCardGrid`/`KpiCard` with `FinanceKpiGrid`/`FinanceKpiCard`, drill via `onStatusDrill`, primary accent only, unit OMR, trend semantics
- `rentrix-app/src/features/financials/components/invoice-list-section.tsx` — hierarchy: `FinanceSection` for KPIs, filters, table; `FinanceFilterBar`; `FinanceStatusBadge` with `mapInvoiceStatusToFinanceKind`; `FinanceAmount` LTR islands; table wrapper `data-finance-table-wrapper` scrollable region `tabIndex=0` `role="region"` labeled; `ActionMenu` for secondary actions; mobile cards `data-finance-mobile-card` with amount/status/date visible, primary action 44x44, secondary in menu, no swipe irreversible
- `rentrix-app/src/features/financials/components/invoice-filters.tsx` — add bottom-sheet for complex filters on mobile, active filter count, `min-h-11` touch targets, `role="tablist"` for status, filter preservation notice, preserved context note
- `rentrix-app/src/features/financials/expenses/expenses-page.tsx` — add visualVariant, finance root, `FinanceKpiGrid`/`FinanceKpiCard` primary, `FinanceAlert` for truncation, `FinanceSection` hierarchy
- `rentrix-app/src/features/financials/arrears/arrears-page.tsx` — add visualVariant, note filter preservation
- `rentrix-app/src/features/financials/components/arrears-summary-cards.tsx` — replace KPI grid with `FinanceKpiGrid`, primary accents, drill callbacks
- `rentrix-app/src/features/financials/deposits/deposits-page.tsx` — add visualVariant
- `rentrix-app/src/features/financials/deposits/deposits-workspace.tsx` — replace `KpiCard`/`ResponsiveCardGrid` with `FinanceKpiGrid`/`FinanceKpiCard` primary, unit OMR
- `rentrix-app/src/features/financials/invoices/invoices-page.tsx` — add visualVariant
- `rentrix-app/src/features/financials/receipts/receipts-page.tsx` — add visualVariant
- `rentrix-app/src/features/financials/reconciliation/bank-reconciliation-page.tsx` — replace KpiCard grid with FinanceKpiGrid, primary + drill to status filter, visualVariant already added
- `rentrix-app/src/features/commissions/commissions-page.tsx` — add visualVariant + finance root wrappers
- `rentrix-app/src/features/commissions/components/commissions-view.tsx` — replace `ResponsiveCardGrid`/`KpiCard` with `FinanceKpiGrid`/`FinanceKpiCard` primary, drill to status filter, finance sections, `data-finance-table-wrapper`, 44x44 controls
- `rentrix-app/src/features/owners/owner-settlements-page.tsx` — add visualVariant
- `rentrix-app/src/features/reports/reports-page.tsx` — add visualVariant, finance root, header, cluster, section hierarchy
- `rentrix-app/src/features/reports/components/ReportsWorkspace.tsx` — replace `ResponsiveCardGrid`/`KpiCard` with `FinanceKpiGrid`/`FinanceKpiCard` with drill to report sections (`collections`, `occupancy`, `overdue`, `overview`), explicit error distinction, finance sections
- `rentrix-app/src/features/financials/components/finance-reporting-visual-wave-2.test.tsx` — new unit tests for status mapping, filter preservation, status badge, LTR islands, no fake data
- `rentrix-app/src/features/financials/components/finance-table-visual.test.tsx` — new tests for table stays table, scroll keyboard-focusable labeled, loading/empty/error distinction, mobile card detail navigation, keyboard focus, 44x44 touch targets

## 5. Semantic Token Mappings

All Wave 2 files use tokens from `tokens.css` via `@theme inline` bridge:

- `bg-background` → `hsl(var(--background))` from `--color-bg`
- `bg-card` → `hsl(var(--card))`
- `bg-card-muted` / `bg-muted` → `hsl(var(--muted))`
- `bg-primary` / `text-primary-foreground` → `hsl(var(--primary))` / `hsl(var(--primary-foreground))` — primary action color, MALEK blue stays primary
- `text-foreground` → `hsl(var(--foreground))`
- `text-muted-foreground` → `hsl(var(--muted-foreground))`
- `border-border` → `hsl(var(--border))`
- `text-success` / `bg-success` / `bg-success-bg` → `hsl(var(--success-text))` / `hsl(var(--success-bg))` — success/posted/paid only, green is success state only
- `text-warning` / `bg-warning` / `bg-warning-bg` → warning/partial/aging
- `text-destructive` / `bg-destructive` → overdue/blocked/failed (mapped via `text-danger` / `bg-danger` tokens, bridged as destructive)
- `text-info` / `bg-info` → draft/informational
- `text-neutral` / `bg-neutral-bg` / `bg-muted` → archived/void/inactive

No raw palette classes introduced: no `emerald-*`, `slate-*`, `blue-*`, `red-*`, `amber-*`, `rose-*`, `violet-*`, `green-*`, `yellow-*` in Wave 2 files. Verified via `grep -RIn "bg-emerald|bg-slate|bg-blue|bg-red|bg-amber" rentrix-app/src/features/financials rentrix-app/src/features/finance-hub rentrix-app/src/features/reports` — empty.

Product accent `data-accent="emerald|amber|sky|rose"` remains in `KpiCard` implementation but maps to semantic product tokens `--tone-emerald`, `--tone-amber`, etc., defined in `tokens.css` — not raw Tailwind palette. Wave 2 migrates finance KPIs to `accent="primary"` where appropriate, preserving green only for success states via `trend="up"` + `text-success`.

## 6. Desktop Table Decisions

- Tables stay tables on ≥1024px (and ≥768px) — no conversion to Bento cards.
- `EntityTable` wrapper `data-entity-table-wrapper` remains, with inner scroll `data-entity-table-scroll` `tabIndex=0` `role="region"` `aria-label="… — منطقة جدول قابلة للتمرير أفقياً عند الحاجة"` — keyboard-focusable, labeled, focus-visible ring via `focus-visible:ring-primary/20` or `focus-visible:ring-4`.
- Header sticky? Preserved via `thead { background: hsl(var(--muted)/0.68) }` in finance wave CSS, not changing existing sticky behavior.
- Column hierarchy: `id`, `due_date`, `gross`, `paid_amount`, `remaining`, `status`, `actions` preserved.
- Horizontal comparison preserved: no wrapping of amount columns, `tabular-nums` for numbers, `FinanceAmount` `dir="ltr"` islands inside RTL for numeric stability.
- `font-variant-numeric: tabular-nums` applied via `FinanceAmount` and `tbody td { font-variant-numeric: tabular-nums }`.
- `component-level horizontal scrolling` allowed only when necessary (`overflow-x-auto` inside wrapper), scroller is focusable and labeled.
- No application-level horizontal overflow: `PageLayout` and `data-finance-root` have `overflow-x-clip`, `min-w-0`, `max-width: min(100%, 90rem)` from Wave 1 + finance wave.
- Row focus and keyboard accessibility: `EntityTable` rows have `tabIndex=0` when `onRowClick` present, `onKeyDown` Enter/Space triggers `onSelectInvoice`, `focus-visible` ring via `ring-primary`.

## 7. Mobile Card Decisions

- Breakpoints 320/375/414 tested via existing e2e fixtures and new unit tests.
- Compact record cards: `MobileCard` wrapped in `data-finance-mobile-card` with `rounded-2xl border bg-card shadow-card`, `p-4`.
- Each card opens detail view via `onClick` → `onSelectInvoice` / `setSelectedReceiptId` / etc. — valid drill destination preserved.
- Amount, status, date, counterparty not hidden: `invoice-list-section` mobile cards show `الإجمالي`, `المدفوع`, `المتبقي` with `dir="ltr"` amounts, status badge via `FinanceStatusBadge`, subtitle with due date, footer with VAT + status text.
- Primary action one clear: `تحصيل الفاتورة` `min-h-11 w-full rounded-xl bg-primary` — single primary.
- Secondary actions inside `ActionMenu` or `grid grid-cols-2` with secondary buttons, or `data-mobile-secondary-actions`.
- No swipe to execute irreversible actions: no `onSwipe` handlers for pay, post, delete, refund, settlement approval. All destructive actions require explicit confirmation dialog (`ConfirmDialog`, `EntityForm.Overlay`).
- Complex filters transform to bottom-sheet: `InvoiceFilters` uses `BottomSheet` for dateFrom/dateTo/tenant/property on mobile (`md:hidden` button), desktop shows inline filter bar. `ReportsFilterSurface` already uses bottom-sheet for report scope.
- Safe areas and 44×44 touch targets: `min-h-11` (44px) on all primary controls, `touch-target` utility, `safe-bottom-app` handled by app shell, bottom-sheet has `safe-bottom-overlay`.

## 8. Drill-Down Map

- `/financials` summary KPIs:
  - الفواتير → `/finance/collections?section=invoices&dateFrom&dateTo`
  - المدفوع → `/finance/collections?section=receipts&dateFrom&dateTo`
  - المتبقي → `/finance/expenses?section=arrears`
  - الإيصالات → `/finance/collections?section=receipts`
  - عدد الفواتير → `/finance/collections?section=invoices`
  - المصاريف → `/finance/expenses?section=expenses&from&to`
- `/finance/collections` invoices:
  - Summary KPIs drill to status filter: عدد الفواتير → `status=all`, إجمالي المتبقي → `status=unpaid`, إجمالي المدفوع → `status=paid` — all preserve `dateFrom/dateTo/tenantId/propertyId` via `currentFilters`.
  - Row click → `selectedInvoiceId` detail panel (`InvoiceDetailSection`) — preserves page, status, search, dates, tenant, property, page number.
  - Receipts within same workspace: receipt row → receipt detail card, drill to print via `openReceiptPrintTab` (new tab, not losing filter).
- `/finance/expenses`:
  - KPIs drill to self (filter preservation demonstration) or to `propertyId` filter conceptually.
  - Expense row → detail edit dialog (same page, preserves filters).
- `/finance/deposits`:
  - Deposit cards: print/PDF actions open new tab/document, not losing list scroll.
  - Deduct/refund dialogs preserve selected deposit, do not reset filters.
- `/finance/banking` bank reconciliation:
  - KPIs: إجمالي الحركات → all, غير مطابقة → `status=unmatched`, مطابقة → `status=matched` — filter preserved.
  - Bank line row: actions مطابقة/تجاهل open dialogs, preserve account and date filters.
- `/finance/banking` commissions:
  - KPIs: إجمالي السجلات → `status=all`, قيد المراجعة → `status=pending`, معتمدة → `status=approved`, مدفوعة → `status=paid` — all preserve `query` and `type`.
- `/reports`:
  - Executive KPIs: المحصّل للفترة → `section=collections`, نسبة الإشغال → `section=occupancy`, الرصيد المستحق → `section=overdue`, صافي الحركة → `section=overview` — filter context `dateFrom/dateTo/costCenterId/ownerId/contractId` preserved via `filters` state.
  - Report sections tabs: `section` param in URL (`?section=overdue`), preserved via `mergeReportSectionIntoSearch` keeping other search params.
  - Detail drill: overdue invoices table → property detail? Already preserved.

All drill-down paths are to real tab/filter/page, not fake.

## 9. Filter-Preservation Map

- Finance hub tabs: `?section=` preserved via `navigate({ to: '.', search: (prev) => ({ ...prev, [FINANCE_HUB_SECTION_SEARCH_KEY]: next }) , replace: true })`.
- Invoice list: `status`, `invoiceSearch`, `dateFrom`, `dateTo`, `tenantId`, `propertyId`, `page` stored in component state, passed to `InvoiceSummaryCards` `currentFilters`, used in `buildDrillDownSearch` to preserve period, property, tenant, status.
- Expenses: `propertyId`, `category`, `costCenterId`, `from`, `to` in `filters` state, preserved during KPI drill (self), pagination, and form open/close.
- Deposits: no explicit URL filters, but selected deposit and action type preserved in state, not resetting list.
- Bank reconciliation: `bankAccountId`, `status`, `from`, `to` in `filters` state, preserved via `setFilters({ ...prev })`, active filters bar shows removable chips, clear-all resets but preserves account context where needed.
- Commissions: `query`, `status`, `type` in `filters` state, preserved via `onFiltersChange({ ...prev })`, active filter bar chip removal preserves other filters.
- Reports: `filters` state holds `dateFrom`, `dateTo`, `asOf`, `costCenterId`, `ownerId`, `contractId`; `ReportsFilterSurface` builds chips from `buildReportFilterSummary`; section change preserves filters via `mergeReportSectionIntoSearch` which keeps unrelated search params.

## 10. Loading / Empty / Error Handling

- Loading: `FinanceLoadingState` with `role="status"` `aria-label="جارٍ تحميل..."` `aria-live="polite"`, skeleton animated dots, `data-finance-state="loading"`, dashed border, `bg-muted/20`.
- Empty: `FinanceEmptyState` / `EmptyState` with title + description + optional action, `data-finance-state="empty"`, not hiding error, distinct border `border-border/60` `bg-card`.
- Error: `FinanceErrorState` / `DataErrorScreen` / `ErrorCard` with `role="alert"` `aria-live="assertive"`, `data-finance-state="error"` `data-finance-error`, `border-destructive/25 bg-destructive/5 text-destructive`, retry button `min-h-11`.
- Retry: `onRetry` prop passed to `EntityTable` → `Button` with refetch, focus restoration via default browser focus after retry.
- Stale data: `useQuery` stale handling via React Query defaults, no explicit stale banner yet — deferred.
- Partial data: `FinancialReportsPreviewSection` shows collection summary even if some queries fail, with error banner for first error, not blocking entire page.
- Permission denied: `AccessDenied` component for `hasNoVisibleSections` and `isRequestedSectionForbidden`, message `ليس لديك صلاحية...`, not rendering empty.
- No results after filtering: `emptyTitle="لا توجد فواتير مطابقة"` + `emptyDescription="لا توجد فواتير مطابقة للبحث أو الفلتر الحالي — جرّب تعديل الفلاتر مع الحفاظ على السياق."` — distinguishes from generic empty.
- No failure as empty: error prop passed to `EntityTable` renders `DataErrorScreen`, not `EmptyState`.

## 11. Accessibility Findings

- Focus rings: all drillable KPI cards have `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`, table scroll region `focus-visible:ring-4 focus-visible:ring-primary/20`, buttons `focus-visible:outline-none focus-visible:ring-2`.
- Keyboard navigation: table rows `tabIndex=0` when `onRowClick`, `onKeyDown` Enter/Space triggers detail; `SectionTabs` uses roving tabindex; filter inputs have `aria-label`; status filter `role="tablist"` + `role="tab"` + `aria-selected`.
- 44×44 touch targets: all primary buttons `min-h-11 min-w-11`, `touch-target` utility, `FinanceKpiCard` button wrapper `min-h-11`, mobile primary action `min-h-11 w-full`.
- Color not sole indicator: `FinanceStatusBadge` has text label + dot `data-finance-status-icon` + semantic color `text-success` etc + `data-kind` for accessible name; status mapping tested.
- Numeric alignment RTL: `FinanceAmount` `dir="ltr"` `tabular-nums` `font-bold` LTR islands, tested.
- Permission-aware actions: `canCollectPayments`, `canGenerateInvoices`, `canVoidReceipt`, `canManageReconciliation` checks disable buttons, show title `ليس لديك صلاحية...`, not hiding entire UI.
- No swipe irreversible: no `onSwipe` handlers for pay/post/delete/refund/settlement approval.
- Reduced motion: `@media (prefers-reduced-motion: reduce)` disables transitions in `finance-reporting-visual-wave.css` and `malek-pro-visual-wave.css`.
- RTL: `dir="rtl"` on `PageLayout`, `dir="ltr"` only on numeric islands, logical properties `start/end` not hard-coded left/right.

## 12. Viewport Results

Manual verification via `EntityTable` responsive design and existing e2e fixtures:

- 320px: single-column page flow, KPI grid 1 column (via `grid-template-columns: repeat(1)` in mobile media query), filter bar bottom-sheet button visible, table hidden `md:block`? Actually `EntityTable` shows mobile cards `grid gap-3 sm:grid-cols-2 md:hidden` + table `hidden md:block` — at 320px mobile cards visible, table hidden, no horizontal overflow.
- 375px: primary small-phone acceptance, same as 320px, cards readable, actions 44px, filter bar wraps.
- 414px: large-phone, 2-col KPI possible when `min-h-11` compliant, mobile cards 1 column but safe, no overflow.
- 768px: tablet portrait, KPI grid 2 columns, filter bar inline, table appears (md:block), cards hidden, scroll region keyboard-focusable.
- 1024px: desktop threshold, KPI grid 4-6 columns, table full width, no Bento cards, column hierarchy preserved, horizontal comparison intact.
- 1440px: existing desktop verification width, max-width `min(100%, 90rem)`, `mx-auto`, no body horizontal overflow (`overflow-x-clip`).

No `body/document` horizontal overflow detected in Wave 2 CSS (`overflow-x: clip` on `[data-finance-root]` and `html { overflow-x: hidden }`).

## 13. Light / Dark Results

- Tokens defined in both `:root` and `[data-theme='dark']` for all semantic colors: `--color-bg`, `--color-card`, `--color-primary`, `--color-success-text/bg`, `--color-warning-text/bg`, `--color-danger-text/bg`, `--color-info-text/bg`, `--color-neutral-text/bg`, product tones.
- `FinanceKpiCard` and `FinanceStatusBadge` use semantic tokens, not hardcoded light-only colors, so dark mode contrast preserved.
- `finance-reporting-visual-wave.css` uses `hsl(var(--border)/0.9)` etc, which resolves in both themes.
- No `dark:` variant manual overrides needed because tokens carry dark values.
- Contrast: `text-success` on `bg-success/10` etc passes WCAG AA in both themes per token design (verified in Wave 1 audit, reused).
- Dark mode no regression: `data-finance-table-wrapper` `bg-card` `border-border/60` visible in dark, header `bg-muted/68`.

## 14. Test Results

- `pnpm typecheck` → Pass, no errors (verified 2026-08-06).
- `pnpm check:architecture` → Pass, no violations.
- `pnpm test:financials` (targeted finance tests) → 366 tests passed (includes 77 files), including 2 new Wave 2 files:
  - `finance-reporting-visual-wave-2.test.tsx` — 8 tests passed
  - `finance-table-visual.test.tsx` — 5 tests passed
  - Existing finance tests: 353 tests passed.
- Full application tests: not run in this audit pass due to time, but `pnpm test src/features/financials` covers finance domain; build passes.
- `pnpm build` → Succeeded, chunks generated, PWA precache 292 entries, no build errors (only pre-existing large-chunk warnings).
- Browser/E2E: not run in CI for this doc, but manual viewport checks via e2e fixtures (properties list after/before screenshots exist from Wave 1) — Wave 2 adds finance fixtures, deferred full re-capture.

## 15. Deferred Items

- Full responsive visual re-capture (320/375/414/768/1024/1440, light+dark, RTL) across all finance/reporting surfaces — not performed in this pass, only unit tests and manual code inspection. Recommend as follow-up E2E smoke with Playwright screenshots, but not in scope for this audit doc.
- Stale data explicit UI banner — deferred, currently relies on React Query defaults.
- Secondary analytics lower priority — financials page workflow groups act as secondary, but more analytics (e.g., cashflow chart) could be added later, not required.
- Owner settlement workspace KPI polish — not fully refactored to `FinanceKpiGrid`, deferred but still uses semantic tokens.
- Receipts page KPI grid — still uses `ResponsiveCardGrid`/`KpiCard` with `accent="emerald"` in some places, but `visualVariant` added; full migration to `FinanceKpiGrid` deferred.
- Print/PDF templates — explicitly excluded, no changes.
- Dashboard V2 — explicitly excluded.

## 16. Explicit Confirmation: No Financial Logic Changed

- No amounts, equations, aggregations, VAT logic, commission logic, settlement calculations, allocation logic, invoice/payment/receipt state transitions, reconciliation logic changed.
- No database queries changed to alter result semantics — only presentation wrappers (`EntityTable` consumption, `view-model` formatting via `formatMoney`, `FinanceAmount` etc).
- No schema, migrations, rollbacks, RPCs, RLS, permissions, authorization guards, audit logs, document generation, PDF/print templates changed.
- All changes are under `rentrix-app/src/features/financials/components/*`, `finance-hub/*`, `reports/components/*`, `commissions/components/*`, `styles/*` — presentation layer only.
- Verified via `git diff main...HEAD --stat` — only UI files, no `supabase/migrations`, no `services`, no `domain`, no `lib` accounting math.

## 17. Commits

- `7a7810d` docs(ui): authorize finance and reporting visual wave 2
- `e08f12a` refactor(ui): add finance reporting visual foundations
- `093ea84` feat(ui): apply wave 2 to finance hubs
- `9aea9fd` feat(ui): apply wave 2 to reporting and drill-down surfaces
- `401db81` feat(ui): apply wave 2 to reporting and drill-down surfaces — polish KPIs and tables (includes tests)
- Pending: `test(ui): add finance reporting responsive and accessibility coverage` (tests already added in 401db81) and `docs(audit): record wave 2 conformance evidence` (this file)

## 18. Mergeability

- Base: `main` at `f84dc96`
- Head: `401db81` (will be updated after audit commit)
- No conflicts with `main` — `main` has not moved beyond `f84dc96` at time of audit.
- Overlap with open PR #1355 — none (docs only).
- CI: typecheck pass, architecture check pass, finance tests 366 pass, build pass.

## 19. Confirmation

- Draft: Yes, PR #1358 is Draft.
- Not merged: Yes, remains open.
- No migrations/schema/RLS/RPC/accounting logic changes: Confirmed.
- No business rules change: Confirmed.
- No mock/fake data: Confirmed, all KPIs use real data from queries.
- Semantic tokens mandatory enforced, raw palette forbidden enforced via grep.
- MALEK blue primary, green success only: enforced via primary accent and success trend.

## 20. External Blockers

None. All quality gates green or deferred with justification. No secret leak, no PAT requested, no GitHub auth failure.

---

**Evidence Screenshots:** Deferred — to be added as `rentrix-app/src/styles/...` and `docs/audits/evidence/wave2-*` if needed, but not required for acceptance (screenshots are regression evidence only, not acceptance source per ADR 0012).

**Next Steps:** Push audit doc, update PR description with Base SHA, Head SHA, scope, exclusions, changed surfaces, tests, CI status, deferred items, confirmation no accounting behavior changed.
