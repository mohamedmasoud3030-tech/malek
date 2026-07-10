# Phase 0 UX, navigation, and responsive audit

## 1. Inspection reference

- Branch inspected: `refactor/ui-foundation-rebuild`.
- Commit SHA inspected: `1bd0d059e943cce5211256f7e1a242995d4c8287`.
- Inspection date: 2026-07-06.
- Scope: code-reading audit only, primarily under `rentrix-app/src` using `rg --files` and `rg` as requested.
- This document is based on code evidence, class names, route declarations, and component composition. It is **not** proof of real mobile-device behavior, keyboard behavior, viewport behavior, visual contrast, or touch ergonomics. Any claim that cannot be proven from code is classified as `Needs human device validation`.

## 2. Route inventory

| Route | Screen/component | Evidence file(s) | Desktop behavior visible from code | Mobile behavior visible from code | Classification |
| --- | --- | --- | --- | --- | --- |
| `/login` | `LoginPage` via `_auth.login` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_auth.login.tsx`; `rentrix-app/src/app/login-page.tsx`; `rentrix-app/src/components/layout/auth-layout.tsx` | Auth layout centers a login card in a `min-h-screen` grid. | Same auth layout with smaller padding; no device validation. | Desktop layout compressed responsively |
| `/` | `DashboardPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.index.tsx`; `rentrix-app/src/app/dashboard/DashboardPage.tsx` | Dashboard sections use KPI grids, cards, and quick actions. | Uses responsive grids; bottom nav points here. No device proof. | Desktop layout compressed responsively |
| `/properties` | `PropertiesListPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.properties.tsx`; `rentrix-app/src/features/properties/properties-list-page.tsx` | List page with cards/tables and route actions. | Code has responsive grid/card patterns in property feature; exact phone usability needs device validation. | Needs human device validation |
| `/properties/new` | `PropertyFormPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.properties.new.tsx`; `rentrix-app/src/features/properties/property-form-page.tsx` | Full-page create form route. | Form grid compresses; keyboard/scroll not proven. | Needs human device validation |
| `/properties/$propertyId` | `PropertyDetailPage` shell | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.properties.$propertyId.tsx`; `rentrix-app/src/features/properties/property-detail-page.tsx` | Detail route shell with nested property tabs. | Nested route/tab behavior needs mobile validation. | Needs human device validation |
| `/properties/$propertyId/` | `PropertyOverview` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.properties.$propertyId.index.tsx`; `rentrix-app/src/features/properties/property-detail-page.tsx` | Detail overview content. | Responsive grid compression only from code. | Desktop layout compressed responsively |
| `/properties/$propertyId/units` | `PropertyUnitsPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.properties.$propertyId.units.tsx`; `rentrix-app/src/features/properties/property-detail-page.tsx` | Property-scoped unit list. | Table/card behavior inferred from feature code; needs human device validation. | Needs human device validation |
| `/properties/$propertyId/units/$unitId` | `PropertyUnitDetailPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.properties.$propertyId.units.$unitId.tsx`; `rentrix-app/src/features/properties/property-detail-page.tsx` | Unit detail page under property. | No dedicated mobile behavior found beyond layout compression. | No clear mobile behavior found |
| `/properties/$propertyId/edit` | `PropertyFormPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.properties.$propertyId.edit.tsx`; `rentrix-app/src/features/properties/property-form-page.tsx` | Full-page edit form route. | Keyboard/form visibility not proven. | Needs human device validation |
| `/units` | `UnitsPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.units.tsx`; `rentrix-app/src/features/units/units-page.tsx`; `rentrix-app/src/features/units/units-list.tsx` | Unit list/dashboard with list components. | Unit code includes mobile list/card paths, but no device validation. | Needs human device validation |
| `/people` | `PeopleListPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.people.tsx`; `rentrix-app/src/features/people/people-list-page.tsx` | People list with create/edit flows. | Responsive behavior not consistently centralized; needs validation. | Needs human device validation |
| `/people/new` | `PersonFormPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.people.new.tsx`; `rentrix-app/src/features/people/person-form-page.tsx` | Full-page create form. | Keyboard/form visibility not proven. | Needs human device validation |
| `/people/$personId/edit` | `PersonFormPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.people.$personId.edit.tsx`; `rentrix-app/src/features/people/person-form-page.tsx` | Full-page edit form. | Keyboard/form visibility not proven. | Needs human device validation |
| `/tenants` | `TenantsPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.tenants.tsx`; `rentrix-app/src/features/tenants/TenantsPage.tsx` | Tenant workspace page. | No clear dedicated mobile behavior found in route declaration. | No clear mobile behavior found |
| `/owners` | `OwnersPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.owners.tsx`; `rentrix-app/src/features/owners/OwnersPage.tsx` | Permission-gated owners hub. | Responsive behavior needs human device validation. | Needs human device validation |
| `/owners/$ownerId` | `OwnerDetailPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.owners.$ownerId.tsx`; `rentrix-app/src/features/owners/owner-detail-page.tsx` | Permission-gated owner detail page. | Detail page mobile state/back behavior needs validation. | Needs human device validation |
| `/lands` | `LandsPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.lands.tsx`; `rentrix-app/src/features/lands/lands-page.tsx`; `rentrix-app/src/features/lands/components/lands-view.tsx` | Permission-gated land management page with stats, filters, table. | Land view explicitly renders `md:hidden` cards and `md:block` table. | Implemented intentionally |
| `/leads` | `LeadsPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.leads.tsx`; `rentrix-app/src/features/leads/leads-page.tsx`; `rentrix-app/src/features/leads/components/leads-view.tsx` | Permission-gated leads view with stats, filters, dialog form, table. | Leads view explicitly renders `md:hidden` cards and `md:block` table. | Implemented intentionally |
| `/contracts` | `ContractsListPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.contracts.tsx`; `rentrix-app/src/features/contracts/ContractsListPage.tsx` | Contract list with filters, cards/table, confirm dialog. | Code has separate `ContractCardList` and hidden desktop table. | Implemented intentionally |
| `/contracts/new` | `ContractFormPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.contracts.new.tsx`; `rentrix-app/src/features/contracts/ContractFormPage.tsx` | Full-page contract form. | Form grid compresses; keyboard/scroll needs validation. | Needs human device validation |
| `/contracts/$contractId` | `ContractDetailPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.contracts.$contractId.tsx`; `rentrix-app/src/features/contracts/ContractDetailPage.tsx` | Detail page with tabs/dialog renewal/payment tables. | Table/mobile behavior varies by tab; modal/back state needs validation. | Needs human device validation |
| `/contracts/$contractId/edit` | `ContractFormPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.contracts.$contractId.edit.tsx`; `rentrix-app/src/features/contracts/ContractFormPage.tsx` | Full-page edit form. | Keyboard/form visibility not proven. | Needs human device validation |
| `/financials` | `FinancialsPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.financials.tsx`; `rentrix-app/src/features/financials/financials-page.tsx` | Financial hub/dashboard route. | Uses responsive grids but no dedicated mobile workflow evidence. | Desktop layout compressed responsively |
| `/receipts` | `ReceiptsPage` or `ReceiptDetailPage` based on search param | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.receipts.tsx`; `rentrix-app/src/features/financials/receipts/receipts-page.tsx`; `rentrix-app/src/features/financials/receipts/receipt-detail-page.tsx` | Header, KPI cards, filters, receipt table/detail/void dialog. | Explicit `md:hidden` receipt cards plus desktop `EntityTable`; query-param detail route changes screen. | Implemented intentionally |
| `/expenses` | `ExpensesPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.expenses.tsx`; `rentrix-app/src/features/financials/expenses/expenses-page.tsx` | Expenses financial page. | Uses grids/forms; some list rows compress. Needs device validation. | Needs human device validation |
| `/invoices` | `InvoicesPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.invoices.tsx`; `rentrix-app/src/features/financials/invoices/invoices-page.tsx` | Invoice workspace sections. | Mostly responsive grids; table/card behavior from subcomponents only. | Needs human device validation |
| `/arrears` | `ArrearsPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.arrears.tsx`; `rentrix-app/src/features/financials/arrears/arrears-page.tsx`; `rentrix-app/src/features/financials/components/overdue-invoices-table.tsx` | Arrears page with filters, aging, overdue tables. | Overdue table uses `EntityTable` with mobile card rendering. | Implemented intentionally |
| `/bank-reconciliation` | `BankReconciliationPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.bank-reconciliation.tsx`; `rentrix-app/src/features/financials/reconciliation/bank-reconciliation-page.tsx` | Bank reconciliation workspace. | No clear mobile behavior found from route/component scan. | No clear mobile behavior found |
| `/accounting` | redirect route | `rentrix-app/src/routeTree.ts` | Redirects to `/financials`; no standalone UI. | Same redirect. | Implemented intentionally |
| `/reports` | `ReportsPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.reports.tsx`; `rentrix-app/src/features/reports/reports-page.tsx`; `rentrix-app/src/features/reports/components/*` | Report hub with report sections/tabs/filters. | Section navigation uses horizontal overflow tabs; visual validation needed. | Needs human device validation |
| `/communication` | `CommunicationPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.communication.tsx`; `rentrix-app/src/features/communication/communication-page.tsx` | Permission-gated communication hub. | No clear mobile behavior found from route/component scan. | No clear mobile behavior found |
| `/commissions` | `CommissionsPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.commissions.tsx`; `rentrix-app/src/features/commissions/commissions-page.tsx` | Permission-gated commissions page. | No clear mobile behavior found from route/component scan. | No clear mobile behavior found |
| `/system` | `SystemPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.system.tsx`; `rentrix-app/src/features/system/system-page.tsx` | Permission-gated governance card grid. | Grid compresses to one column; customer exposure depends on role. | Desktop layout compressed responsively |
| `/audit-log` | `AuditLogPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.audit-log.tsx`; `rentrix-app/src/features/audit/audit-log-page.tsx` | Permission-gated audit log. | Audit table/log behavior needs human device validation. | Needs human device validation |
| `/data-integrity` | `DataIntegrityPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.data-integrity.tsx`; `rentrix-app/src/features/system/data-integrity-page.tsx`; `rentrix-app/src/features/system/components/data-integrity-view.tsx` | Permission-gated data integrity checks. | Responsive grids; role-limited internal content. | Desktop layout compressed responsively |
| `/change-password` | `ChangePasswordPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.change-password.tsx`; `rentrix-app/src/features/auth/change-password-page.tsx` | Permission-gated account form outside sidebar. | Keyboard/form visibility not proven. | Needs human device validation |
| `/settings` | `SettingsPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.settings.tsx`; `rentrix-app/src/features/settings/settings-page.tsx` | Permission-gated settings center with sections/forms. | Settings forms need phone/keyboard validation. | Needs human device validation |
| `/maintenance` | `MaintenancePage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/routes/_protected.maintenance.tsx`; `rentrix-app/src/features/maintenance/maintenance-page.tsx` | Permission-gated maintenance workspace. | Mobile cards implemented (grid below `md`, `EntityTable` above); filter `Select`s now carry `aria-label`. | Implemented intentionally |
| not found | `NotFoundPage` | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/app/not-found-page.tsx` | Error/not-found route. | No special mobile behavior found. | Desktop layout compressed responsively |

## 3. Navigation matrix

| Surface | Code source | Contents | Primary/contextual assessment | Duplications or conflicts |
| --- | --- | --- | --- | --- |
| Desktop sidebar | `navGroups` rendered by `NavigationLinks` in `AppShell` | Full grouped app IA: dashboard, portfolio, people, operations, financials, reports, sales, settings, system. | Primary navigation on desktop. | Includes `/financials` hub but the desktop sidebar lists `/invoices`, `/receipts`, `/expenses`, `/arrears`, and `/bank-reconciliation` as primary financial routes; this makes `/financials` contextual/hub-like rather than the only primary financial entry. |
| Mobile drawer/dialog | `MobileNavigationDrawer` uses same `NavigationLinks` and `WorkspaceCard` | Same grouped IA as desktop plus quick links. | Primary navigation on mobile when menu is opened. | It duplicates all sidebar routes and quick actions; this is intentional if drawer is the full IA, but it competes with bottom nav for top-level destinations. |
| Bottom navigation | `mobileNavItems` rendered by `MobileBottomNav` | `/`, `/properties`, `/contracts`, `/financials`, `/arrears`. | Primary quick mobile navigation. | `/arrears` is both inside the `/financials` group and a bottom-nav item. `/financials` is a bottom-nav hub while detailed financial routes are in drawer/sidebar. Product should confirm whether arrears deserves top-level mobile prominence. |
| Dashboard shortcuts / workspace card | `quickLinks` and `WorkspaceCard` | `/properties/new`, `/people/new`, `/contracts/new`. | Contextual action shortcuts, not primary IA. | Same shortcuts appear in sidebar workspace card, mobile drawer, and top quick-action popover. This is duplication of actions, not routes; acceptable if intentional. |
| Top navigation / quick action popover | `AppShell` header with breadcrumb title, search icon opens `WorkspaceCard`, notifications, theme. | Header controls and quick actions. | Contextual actions and status, not primary navigation. | Search icon currently opens quick create actions, not global search. That can confuse users because icon semantics imply search. |
| Route tabs | Feature-level tabs such as property detail nested routes, reports sections, `SectionTabs`, `FilterTabs`. | Context-specific section switching/filtering. | Contextual navigation/state. | Horizontal scroll tabs exist, but there is no global rule defining when tabs are route state vs local filter state. |

## 4. Shared UX pattern inventory

- Page headers: `PageHeader` exists and is used by some screens, while other screens hand-roll header blocks. This is inconsistent but should not be unified in Phase 0.
- Search: shared `SearchInput` exists with clear button, but many pages use raw `Input` for search-like fields.
- Filters: `FilterTabs`, `SectionTabs`, raw `Select`, date `Input`, and feature-local filter bars coexist.
- Tabs: `FilterTabs` and `SectionTabs` use horizontal overflow; reports/property/contract details also have route or local tabs.
- Tables: low-level `Table` primitives and higher-level `EntityTable` coexist. `EntityTable` supports optional mobile cards, sorting, pagination, loading, error, and empty states.
- Cards: `Card`, `EntityCard`, `KpiCard`, `InlineStatCard`, `StatCard`, and feature cards coexist.
- Dialogs: Radix `Dialog` wrapper with constrained `100dvh` height is shared; some feature dialogs specify their own max heights.
- Drawers/sheets: `BottomSheet` exists and `EntityForm.Modal` can choose bottom sheet on mobile, but this is not a global navigation drawer implementation. The mobile nav uses a native `<dialog>` plus `<aside>`.
- Forms: `EntityForm` primitives exist; route forms and feature modal forms still vary.
- Empty/loading/error states: `EmptyState`, `LoadingState`, `PageStateCard`, `AsyncContentState`, `DataErrorScreen`, and `EntityTable` states coexist.
- Pagination: implemented in `EntityTable` only when caller passes pagination; many list pages appear client-filtered or custom.
- Row actions: `EntityActions`, buttons inside `EntityTable`, custom card actions, and inline feature buttons coexist.
- Detail pages: `EntityDetailHeader`, feature detail pages, nested property routes, contract detail tabs, receipt print/detail page.


## 4a. Pattern-consistency comparison table

| Feature group | Header | Primary action | Search | Filters | Desktop table/card behavior | Mobile list/card behavior | Forms | Details | Loading/empty/error states |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| people / tenants / owners | Mixed: people uses list-page patterns; owners/tenants use feature-specific page structures. | People has create/edit routes; owners and tenants expose feature-specific actions. | People has list search; owners/tenants search behavior is feature-specific. | Mixed raw selects/tabs/feature filters. | Mostly cards/tables by feature rather than one shared pattern. | Needs human device validation; no single intentional mobile contract found across all three. | People uses route forms; owners/tenants use feature-specific flows. | Owner detail route exists; tenants detail route was not found in route inventory. | Mixed shared `AsyncContentState`/feature states; consistency belongs in Phase 3, rollout in Phases 4-7. |
| lands / properties / units | Properties uses `ListPage`; lands uses feature-specific header/card composition; units uses unit feature layout. | Properties has `/properties/new`; lands has dialog create/edit; units has modal/list actions. | Properties uses shared search through `ListPage`; lands uses raw inputs/select filters; units is feature-specific. | Mixed `ListPage` filters, raw selects, and local filters. | Properties uses `EntityTable`; lands uses custom desktop table; units uses unit list components. | Lands has explicit `md:hidden` cards; properties/units have responsive/card evidence but still need human device validation. | Properties use route forms and modal code; lands uses dialog form; units uses modal. | Property detail/nested unit detail routes exist; lands detail route not found; units detail appears property-scoped. | Mixed `AsyncContentState`, `RouteLoadingState`, `EmptyState`, and table states. |
| contracts / invoices / payments / receipts / expenses | Contracts and receipts use page/detail headers; invoices/expenses/payment-related sections are feature-specific. | Contracts create route; receipts print/void actions; invoices generate/payment actions; expenses create form/actions. | Contracts/receipts/invoices include search/filter controls; payment search is mostly contextual to invoice/contract workflows. | Filters vary between `FilterTabs`, raw `Select`, date inputs, and feature filter components. | Contracts and receipts use table/card split; invoices/arrears use `EntityTable` in subcomponents; expenses uses custom rows/cards. | Contracts, receipts, and overdue invoices show mobile cards; invoices/payments/expenses need human device validation for dense flows. | Contracts route form; payments are contextual forms/sections; receipts have dialog for void reason; expenses has inline form. | Contract detail and receipt detail exist; invoice/payment details are mostly embedded sections rather than full route-backed detail pages. | Mixed `AsyncContentState`, `EmptyState`, `EntityTable` states, and feature-specific errors. |

## 4b. Complete tabs inventory

| Classification | Route/feature | Evidence file(s) | Evidence and notes |
| --- | --- | --- | --- |
| Route-backed tabs | Property detail: overview / units / unit detail | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/features/properties/property-detail-page.tsx`; `rentrix-app/src/routes/_protected.properties.$propertyId.*.tsx` | Nested routes render through an `Outlet`; these are route-backed subviews. |
| In-page view switch | Reports page sections | `rentrix-app/src/features/reports/reports-page.tsx`; `rentrix-app/src/features/reports/components/*` | Report sections appear to switch in-page between overview/collections/expenses/occupancy/overdue/statements patterns. Confirm UX semantics before changes. |
| In-page view switch | Contract detail internal sections | `rentrix-app/src/features/contracts/ContractDetailPage.tsx`; `rentrix-app/src/features/contracts/contractPaymentsTab.tsx`; `rentrix-app/src/features/contracts/contractDocumentsShell.tsx` | Contract detail has contextual sections such as payments/documents/renewal; not all are route-backed. |
| Segmented control or filter | `FilterTabs` | `rentrix-app/src/components/ui/filter-tabs.tsx`; `rentrix-app/src/features/contracts/components/ContractFilters.tsx` | Component declares `role="tablist"` but is used as a status/filter control; product/accessibility should decide whether to keep tab semantics or make it a segmented filter. |
| Segmented control or filter | `SectionTabs` | `rentrix-app/src/components/ui/section-tabs.tsx` | Shared horizontal tab/panel primitive; current uses may be in-page view switches or filters depending on feature. |
| Segmented control or filter | Reports filters/date ranges/status controls | `rentrix-app/src/features/reports/components/FiltersPanel.tsx`; `rentrix-app/src/features/reports/reports-page.tsx` | Filter controls are not primary route navigation. |
| Segmented control or filter | Invoice/arrears status filters | `rentrix-app/src/features/financials/components/invoice-filters.tsx`; `rentrix-app/src/features/financials/components/arrears-filters.tsx` | Status/date/query filters control result sets, not route-backed tabs. |
| Unknown / product decision required | Financial hub vs financial child routes | `rentrix-app/src/routeTree.ts`; `rentrix-app/src/components/layout/app-nav-items.ts`; `rentrix-app/src/features/financials/financials-page.tsx` | `/financials` is a hub while `/invoices`, `/receipts`, `/expenses`, `/arrears`, and `/bank-reconciliation` are standalone routes; product should decide whether this is a hub, tab family, or navigation group. |
| Unknown / product decision required | Mobile bottom nav `/financials` plus `/arrears` | `rentrix-app/src/components/layout/app-nav-items.ts`; `rentrix-app/src/components/layout/layout-navigation-view.tsx` | Bottom nav includes both a financial hub and one financial child route, so classification as primary IA vs shortcut needs product confirmation. |

## 5. Mobile stability audit

- Safe-area usage: present in mobile drawer footer (`env(safe-area-inset-bottom)`) and bottom-sheet content via `safe-bottom-overlay`; no repo-wide safe-area rule was proven.
- `100vh` / dynamic viewport: code uses `h-dvh`, `100dvh`, and `min-h-screen`. Dynamic viewport appears in dialogs/drawer; `min-h-screen` remains in app/auth shells and may need visual validation on mobile browser chrome.
- Keyboard/form visibility: not provable from code. Dialogs and sheets use scrollable max heights, but route forms and keyboard overlap require human device validation.
- iOS accidental input zoom risk: shared `Input` and `Select` use mobile `text-base`, reducing iOS zoom risk. `SearchInput` uses `text-sm`, and raw inputs in features may vary; needs human device validation.
- Scroll locking behind dialogs/drawers: Radix dialog likely handles focus/scroll semantics, but the custom mobile navigation `<dialog>` does not set `document.body.style.overflow`. `BottomSheet` locks body overflow. Drawer background scroll behavior requires human device validation.
- Horizontal overflow: app shell and main use `overflow-x-hidden`, `EntityTable` wraps desktop tables in `overflow-x-auto`, and tabs use horizontal overflow. Hidden overflow can mask layout bugs; `mobile-scroll-x` should not be treated as the default mobile table solution.
- Touch target density: shared `Button` min-height is 44px-ish (`min-h-11`), shared `Input`/`Select` are `min-h-12` on mobile. Some inline custom buttons use `h-9` or compact classes and need device validation.
- Route/state loss on back or modal close: receipt detail selection is query-param driven; many dialogs use local component state. Back-button behavior for modals and local tabs is not proven from code and needs human device validation.
- Claims not proven: no claim is made that mobile, keyboard, or real-device behavior is good; all such items remain validation tasks.

## 6. RTL and theme audit

- RTL usage: app shell sets `dir` from language state, many page roots explicitly set `dir="rtl"`, and components use logical classes (`ps`, `pe`, `ms`, `me`, `start`, `end`) in many places. Some literal `left/right` positioning remains where it may be intentional (e.g., drawer enters from right, Git-like fixed positions) and should be reviewed visually.
- Light/dark token usage: shared components mostly use semantic tokens (`background`, `foreground`, `card`, `muted`, `primary`, `border`, `destructive`) and `dark:` variants where needed.
- Hardcoded colors: sidebar/auth gradients and status accents use `slate`, `emerald`, `amber`, `rose`, etc. These may be acceptable brand/status tokens but are not fully normalized into theme tokens.
- Active/hover/focus states: buttons, inputs, nav links, dialogs, and tables have focus/hover states in code. Consistency across feature-local custom buttons and cards needs review.
- Contrast risks needing visual test: sidebar text opacity variants, amber diagnostic text in drawer, muted text over gradient backgrounds, rose/danger surfaces, and dark-mode status colors require visual contrast checks.

## 7. Internal customer-facing copy

Search terms checked included: `planned`, `coming soon`, `partial`, `debug`, `internal`, `development`, `قيد التنفيذ`, `جزئي`, `ملاحظة`, `هذه الصفحة مكتملة`.

Potentially customer-visible findings from `rentrix-app/src`:

| Text | Route/file | Evidence and assessment |
| --- | --- | --- |
| `app_metadata.user_role`, `app_metadata.role`, and ADMIN setup diagnostic copy | Mobile drawer in `AppShell` | Visible when authorization is null; appears inside the mobile navigation drawer. This is internal/auth diagnostic language that could be exposed to a signed-in customer with misconfigured metadata. |
| `سجل التواصل الداخلي والمتابعات` | Navigation item `/communication` | The word `الداخلي` is in primary navigation copy. It may be acceptable for staff-only product, but is customer-facing if a customer account sees navigation. |
| `تتبع عمولات المكتب كحالة تشغيلية فقط` | Navigation item `/commissions` | Contains scope/status language (`فقط`) in primary navigation description. Not necessarily a bug, but product copy should confirm. |
| `لا يتم إنشاء مستأجر أو مالك تلقائياً؛ التحويل يبقى قراراً تشغيلياً منظماً.` | Leads dialog | Operational explanation in a customer-visible modal if leads are customer-facing. |
| `internal` in tests/services and invoice `partial` status labels | Multiple files | `internal` matches in test/RPC comments; `partial`/`جزئياً` are legitimate invoice status labels, not customer-facing implementation notes. No `coming soon`, `planned`, `debug`, `development`, `قيد التنفيذ`, or `هذه الصفحة مكتملة` route copy was confirmed in the scanned UI source. |

## 8. Candidate ideas from PR #953 — not adopted

PR #953 was reviewed as a reference only. No code was copied, cherry-picked, merged, or adopted.

- Button loading state: suitable for a later phase if implemented in the current branch's existing `Button` API without changing route behavior. It needs an accessible loading label, disabled semantics, spinner policy, and no blanket form rewrites in the same PR.
- Input/Select error state: suitable for a later phase because forms already show field errors inconsistently. It should integrate with current `Input`, `Select`, and `EntityForm` without forcing every form migration at once, and should define `aria-invalid`/`aria-describedby` rules.
- Responsive form overlay: suitable only after product chooses when forms should be routes vs dialogs/sheets. Current code has full-page form routes and `EntityForm.Modal`; adopting overlays globally could affect back-button state and keyboard behavior.
- Shared DataTable: conceptually useful, but the current branch already has `EntityTable`. Future work should evaluate whether to extend/adopt the current `EntityTable` rather than importing PR #953's table. `mobile-scroll-x` is **not** a default mobile solution for tables; mobile cards, priority columns, or product-specific responsive summaries should be considered first.

Do not carry forward PR #953 workspace, workflow, route, or Supabase-import changes as candidates for this branch.


## 8a. Future document/export touchpoints — inventory only

No design or implementation is proposed here. These are only surfaces that may later need print, PDF, export, or WhatsApp decisions:

- Contracts: contract detail, contract documents, create/edit lifecycle, renewal/termination output.
- Receipts: receipt detail/print route and receipt history actions.
- Invoices/payments: invoice workspace, payment recording, invoice status/payment evidence, and potential payment receipt handoff.
- Reports/statements: reports center, statements section, collections/overdue/occupancy/expenses reports, CSV/PDF export candidates.
- Expenses: expense records and supporting attachment/export needs.
- Owners/tenants/people: owner statements, tenant statements, contact/WhatsApp handoff, and profile exports if product asks.
- Properties/units/lands: property/unit/land summary sheets and attachments if product asks.
- Maintenance/communication/leads/commissions/audit/data-integrity: possible operational exports only after product confirms audience and compliance needs.

## 8b. PWA readiness observations — no implementation

Evidence from this docs-only scan is limited:

| Item | Observation |
| --- | --- |
| Web manifest | Unknown from the `rentrix-app/src` scan; no manifest evidence was recorded in this Phase 0 source-only audit. |
| App icons | Unknown from the `rentrix-app/src` scan. |
| Theme color | Unknown as PWA metadata; UI theme tokens exist in app code but do not prove manifest/theme-color configuration. |
| Display mode | Unknown. No standalone display-mode behavior was verified. |
| Standalone behavior | Unknown. No installed-PWA browser testing was performed. |
| Offline/update strategy | Unknown from the `rentrix-app/src` scan. `syncStatus` copy exists in the shell, but that does not prove service worker/offline update behavior. |

## 8c. Manual human-device validation checklist

Run this checklist before claiming later UX PRs are mobile-ready:

- Android Chrome where available:
  - Open every route modified in the later UX PR.
  - Verify drawer open/close, bottom navigation, top actions, and scroll position.
  - Focus every changed text/date/search/select field and verify keyboard visibility, submit buttons, and no hidden focused fields.
- iPhone Safari where available:
  - Repeat the route checks above.
  - Verify no accidental input zoom on search, text, number, date, and select controls.
  - Verify `safe-area-inset-bottom`/notch/home-indicator spacing around bottom nav, drawers, sheets, and fixed actions.
- Keyboard and focused fields:
  - Validate route forms, dialog forms, bottom sheets, inline forms, and destructive confirmation forms.
  - Validate focus return after closing dialogs/sheets/drawers.
- Safe areas:
  - Check portrait and landscape where feasible.
  - Check bottom nav, mobile drawer footer, and any fixed/sticky action bars.
- Drawer and bottom navigation:
  - Confirm drawer and bottom nav do not compete for the same action in confusing ways.
  - Confirm background scroll/focus behavior while drawer is open.
- Dialogs and sheets:
  - Confirm body scroll lock, internal scroll, close buttons, Escape/back behavior where applicable, and focus trapping.
- Back navigation with unsaved forms:
  - Check full-page forms, modal forms, route-backed details, and query-param detail screens.
  - Record whether unsaved data is preserved, discarded, or prompts the user.
- RTL:
  - Verify icon direction, physical left/right positioning, logical spacing, truncation, table alignment, and drawer side.
- Light/dark mode:
  - Verify active, hover, focus, disabled, destructive, warning, and empty/error/loading states visually.
- Dense tables and mobile cards:
  - Verify table alternatives are readable without defaulting to horizontal scroll.
  - Confirm row actions are reachable, large enough, and not duplicated unexpectedly.
- All routes modified in later UX PRs:
  - Add each touched route to the validation notes with device/browser, account role, seed data, and pass/fail observations.

## 9. Prioritized issues

| Severity | Route/feature | Related files/components | Evidence file(s) | Evidence from code | User impact | Recommended phase | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| High | Mobile navigation architecture | `AppShell`, `app-nav-items`, `MobileBottomNav`, `WorkspaceCard` | `rentrix-app/src/components/layout/app-shell.tsx`; `rentrix-app/src/components/layout/app-nav-items.ts`; `rentrix-app/src/components/layout/layout-navigation-view.tsx` | Mobile drawer contains full IA, bottom nav contains a subset, top search icon opens quick create actions, and quick links repeat in multiple places. | Users may be unsure whether to use drawer, bottom nav, or top search/quick actions; financial routes may feel split. | Phase 1 | confirmed |
| High | Mobile drawer scroll locking/focus behavior | `MobileNavigationDrawer` in `AppShell` | `rentrix-app/src/components/layout/app-shell.tsx`; `rentrix-app/src/components/ui/dialog.tsx`; `rentrix-app/src/components/ui/bottom-sheet.tsx` | Custom `<dialog>` listens for Escape but does not visibly lock body scroll in code; Radix dialog is not used for this drawer. | Background scroll/focus escape may occur on real devices. | Phase 2 | human validation |
| High | Keyboard/form behavior | Form routes, `Dialog`, `BottomSheet`, `EntityForm` | `rentrix-app/src/features/*/*form*`; `rentrix-app/src/components/ui/dialog.tsx`; `rentrix-app/src/components/ui/bottom-sheet.tsx`; `rentrix-app/src/components/ui/entity-form.tsx` | Scrollable dialog/sheet code exists, but route forms and keyboard overlap cannot be proven. | Mobile users may lose submit buttons or active fields behind keyboard. | Phase 2 | human validation |
| Medium | Search icon semantics | `AppShell` header quick action popover | `rentrix-app/src/components/layout/app-shell.tsx`; `rentrix-app/src/components/layout/layout-navigation-view.tsx` | Header `Search` icon opens `WorkspaceCard` create shortcuts, not search results. | Users may expect global search and instead see create actions. | Phase 1 | product decision |
| Medium | Inconsistent mobile table/list patterns | `EntityTable`, feature local tables/cards | `rentrix-app/src/components/ui/entity-table.tsx`; `rentrix-app/src/features/*` | Some screens use explicit mobile cards, some use responsive grids, some have no clear mobile behavior. | Inconsistent scan/read/action patterns on mobile. | Phase 3 | confirmed |
| Medium | Internal diagnostic copy exposure | `AppShell` authorization diagnostic drawer block | `rentrix-app/src/components/layout/app-shell.tsx` | Metadata keys and ADMIN setup text can appear in mobile drawer when auth context is null. | Customer may see implementation details or confusing admin text. | Phase 1 | confirmed |
| Medium | RTL consistency review needed | App shell, feature pages, shared components | `rentrix-app/src/components/layout/app-shell.tsx`; `rentrix-app/src/features/*`; `rentrix-app/src/components/ui/*` | Mix of global `dir`, local `dir="rtl"`, logical spacing, and some physical left/right positioning. | Subtle alignment or drawer direction issues on RTL/LTR changes. | Phase 2 | inferred |
| Medium | Theme token normalization | Shared components and feature pages | `rentrix-app/src/components/layout/app-shell.tsx`; `rentrix-app/src/components/ui/*`; `rentrix-app/src/features/*` | Semantic tokens dominate, but status/brand colors use many Tailwind palette literals. | Dark-mode or contrast inconsistencies may persist. | Phase 1 | inferred |
| Low | Touch target density variance | Buttons/actions in cards/tables | `rentrix-app/src/components/ui/button.tsx`; `rentrix-app/src/features/*` | Shared controls are large, but some custom row/card buttons use `h-9`. | Smaller touch targets may be hard to tap. | Phase 2 | human validation |
| Low | Route/local modal state and back behavior | Receipts, dialogs, tabs | `rentrix-app/src/features/financials/receipts/receipts-page.tsx`; `rentrix-app/src/features/*`; `rentrix-app/src/components/ui/dialog.tsx` | Receipt detail uses query param; other dialogs use local state. | Back button may close route state on one screen but not modals on others. | Phase 2 | inferred |

## 10. Recommended phased scope

Phase mapping for follow-up work:

- Phase 1: navigation architecture and theme-token decisions only.
- Phase 2: safe areas, keyboard, viewport, scroll lock, and drawer/dialog/sheet stability.
- Phase 3: shared headers, filters, tabs, table/card/list patterns, and state primitives.
- Phases 4-7: entity/page-pattern rollouts after the shared decisions are validated.

Small, specific Phase 1 scope: **navigation architecture + theme token foundation only**.

Recommended Phase 1 work:

1. Define primary navigation rules:
   - Desktop sidebar is the full primary IA.
   - Mobile drawer is the full primary IA.
   - Bottom navigation is a short frequent-destination set.
   - Top quick action popover is contextual create actions, not global search unless product chooses to build search.
2. Product decisions before programming:
   - Should `/financials` be the main mobile financial destination, or should `/receipts`, `/invoices`, `/expenses`, `/arrears`, and `/bank-reconciliation` appear as first-class mobile entries?
   - Should `/arrears` remain in bottom navigation?
   - Should the search icon be changed to a plus/command/action icon, or should real global search be designed?
   - Should ADMIN/auth diagnostic copy ever appear in customer-facing navigation?
   - What is the approved token set for status colors beyond `primary`, `secondary`, `muted`, `destructive`, `card`, and `border`?
3. Routes affected by Phase 1 if approved:
   - Navigation shell only: `/`, `/properties`, `/contracts`, `/financials`, `/arrears`, plus drawer/sidebar destinations as labels/structure only.
   - No route implementation changes.
4. Shared components candidates for Phase 1:
   - `AppShell`, `NavigationLinks`, `MobileBottomNav`, `WorkspaceCard`, `app-nav-items`, theme/status token definitions if present.
   - Possibly `Button` only for icon/label semantics if the top quick action trigger changes.
5. What not to touch in Phase 1:
   - Do not create `PageHero`.
   - Do not unify page headers, forms, or tables.
   - Do not add a new DataTable, mobile drawer, or bottom navigation implementation.
   - Do not change routes, Supabase imports, migrations, workflows, package files, or production data logic.
   - Do not alter feature page layouts merely because PR #953 or PR #941 did so.
   - Do not claim mobile or keyboard stability without browser/device validation.
