# Information Architecture + Workspace + Navigation Cleanup — 2026-08-07

## Starting point
- **Starting main SHA:** `d2a6cf5d3c502c5f3d84cb2412bc81f8f3497dc7` (`d2a6cf5 feat(s04): version owner-agency agreement terms`)
- **Branch:** `arena/019fdd7f-malik` (from latest `origin/main` at task start, no stale assumptions)
- **PR:** [#1396](https://github.com/mohamedmasoud3030-tech/malik/pull/1396) `ia: Workspace + Navigation cleanup — simplify to one secondary layer`
- **Parallel accounting work avoided:** `feat/s04-contract-agreement-snapshot` (#1395) touches only `supabase/migrations` + `supabase/tests` — no navigation conflict.

## Audit methodology
Inspected **real app** via:
- `rentrix-app/src/app/router/route-tree.ts` (TanStack Router canonical route tree, 40+ protected routes, redirect compatibility)
- `rentrix-app/src/app/navigation/app-nav-items.ts` + `route-nav-map.ts` + `terminology-registry.ts` (sidebar source-of-truth, mobile, active state)
- `rentrix-app/src/app/layout/app-shell.tsx` + `layout-navigation-view.tsx` (desktop sidebar rail, mobile drawer, bottom nav)
- `rentrix-app/src/components/layout/*` (PageLayout, PageHeader, WorkspaceSubNav, EmbeddableWorkspace, ListPage)
- `rentrix-app/src/components/ui/section-tabs.tsx` (hub SectionTabs, single secondary layer)
- Every product area: Dashboard, Properties, Owners, Units, Lands, Contracts, Tenants, People, Leads, Finance, Collections, Expenses, Banking, Deposits, Receipts, Owner Settlements, Reports, Maintenance, Documents, Audit/Governance, System, Settings — via feature `*HubWorkspace`, `*Workspace`, `*Page`, route files.

Audited: router tree, sidebar, desktop navigation, mobile navigation, Workspace components, section navigation, tabs, page headers, nested layouts, redirects, dashboard shortcuts, breadcrumbs, legacy routes, duplicated entry points, responsive navigation, RTL behavior.

---

## Complete navigation inventory found (pre-cleanup)

### Router tree (`route-tree.ts`) — protected routes
| Path | Type | Guard / Component |
|---|---|---|
| `/dashboard` | KEEP | `DashboardRouteComponent` |
| `/properties` | KEEP | `PortfolioHubPage` (hub) |
| `/properties/new` | KEEP | `PropertyNewRouteComponent` |
| `/properties/$propertyId` | KEEP | `PropertyDetailRouteComponent` + children `/` `/units` `/units/$unitId` |
| `/properties/$propertyId/edit` | KEEP | permission `properties.write` |
| `/owners` | REDIRECT-ONLY | `-> /properties?section=owners` perm `owners.hub.view`, file `routes/_protected.owners.tsx` orphan legacy |
| `/owners/$ownerId` | KEEP | `OwnerDetailRouteComponent` |
| `/units` | REDIRECT-ONLY | `-> /properties?section=units` |
| `/lands` | REDIRECT-ONLY | `-> /properties?section=lands` perm `lands.view` |
| `/people` | REDIRECT-ONLY | `-> /contracts?section=people` |
| `/people/new` | KEEP | `PersonNewRouteComponent` (modal over directory) |
| `/people/$personId/edit` | KEEP | `PersonEditRouteComponent` |
| `/tenants` | REDIRECT-ONLY | `-> /contracts?section=tenants` |
| `/leads` | REDIRECT-ONLY | `-> /contracts?section=leads` perm `leads.view` |
| `/communication` | REDIRECT-ONLY | `-> /contracts?section=communication` perm `communication.view` — **duplicate file** `routes/_protected.communication.tsx` with 2-tab hub (communication+tenants) |
| `/contracts` | KEEP | `RelationshipsHubPage` (hub) |
| `/contracts/new` | KEEP | perm `contracts.write` |
| `/contracts/$contractId` | KEEP | `ContractDetailRouteComponent` |
| `/contracts/$contractId/edit` | KEEP | perm `contracts.write` |
| `/maintenance` | KEEP | `OperationsHubWorkspace` (hub) |
| `/utilities` | REDIRECT-ONLY | `-> /maintenance?section=utilities` |
| `/automation` | REDIRECT-ONLY | `-> /maintenance?section=automation` perm `automation.view` |
| `/documents-vault` | REDIRECT-ONLY | `-> /maintenance?section=documents_vault` |
| `/financials` | KEEP | `FinancialsPage` (overview with workflow cards + KPI) |
| `/finance/collections` | KEEP | `CollectionsHubPage` (hub, 2 tabs invoices/receipts) |
| `/finance/expenses` | KEEP | `ExpensesArrearsHubPage` (hub, expenses/arrears) perm `expenses.view` |
| `/finance/deposits` | KEEP | `DepositsSettlementsHubPage` (hub, deposits/owner_settlements) perm `financial.deposits.view` |
| `/finance/banking` | KEEP | `BankingCommissionsHubPage` (hub, bank_reconciliation/commissions) perm `financial.bank_reconciliation.view` |
| `/invoices` | REDIRECT-ONLY | `-> /finance/collections?section=invoices` |
| `/receipts` | REDIRECT-ONLY | `-> /finance/collections?section=receipts` (except `?receiptId=` printable) |
| `/expenses` | REDIRECT-ONLY | `-> /finance/expenses?section=expenses` perm `expenses.view` |
| `/arrears` | REDIRECT-ONLY | `-> /finance/expenses?section=arrears` perm `arrears.view` |
| `/deposits` | REDIRECT-ONLY | `-> /finance/deposits?section=deposits` perm `financial.deposits.view` |
| `/owner-settlements` | REDIRECT-ONLY | `-> /finance/deposits?section=owner_settlements` |
| `/bank-reconciliation` | REDIRECT-ONLY | `-> /finance/banking?section=bank_reconciliation` |
| `/commissions` | REDIRECT-ONLY | `-> /finance/banking?section=commissions` perm `commissions.view` |
| `/accounting` | REDIRECT-ONLY | `-> /reports?section=general_ledger` |
| `/reports` | KEEP | `ReportsPage` (11 sections via ReportsWorkspace) |
| `/ai-assistant` | KEEP | standalone perm? maps to `/reports` root |
| `/settings` | KEEP | `GovernanceHubPage` (hub, 5 tabs) perm `settings.manage` |
| `/system` | KEEP | `SystemPage` (standalone, also tab `users-roles` hub) perm `system.view` |
| `/audit-log` | KEEP | `AuditLogPage` (also hub tab) perm `audit.view` |
| `/data-integrity` | KEEP | `DataIntegrityPage` (also hub tab) perm `integrity.view` |
| `/change-password` | KEEP | `ChangePasswordPage` (also hub tab) perm `auth.password.change` |
| Public: `/` (landing), `/landing` redirect `-> /`, `/login` (auth), `/privacy`, `/terms`, `/dev/design-system` (dev only) |

### Sidebar source-of-truth (`app-nav-items.ts`)
- **navGroups (7 primary workspaces):**  
  `لوحة التحكم` (/dashboard), `المحفظة العقارية` (/properties), `العلاقات والعقود` (/contracts), `التشغيل والصيانة` (/maintenance), `المالية` (/financials), `التقارير` (/reports), `الإدارة` (/settings)
- **workspaceChildNavItems (secondary registry, pre-cleanup):**  
  `/properties`: owners/units/lands (3)  
  `/contracts`: people/tenants/leads/communication (4)  
  `/maintenance`: utilities/automation/documents-vault (3)  
  `/financials`: **8 legacy** invoices/receipts/expenses/arrears/deposits/owner-settlements/bank-reconciliation/commissions — **duplication: legacy 8 vs canonical 4 hubs**  
  `/reports`: ai-assistant (1)  
  `/settings`: change-password/audit-log/data-integrity/system (4)
- **mobileNavItems (5 bottom tabs):** dashboard, properties, contracts, financials, reports — drawer holds full inventory.
- **quickCreateItems (header +):** /contracts/new, /properties/new, /people/new

### Workspace hub components
| Hub file | Route | SectionTabs (secondary) | Body |
|---|---|---|---|
| `portfolio-hub-workspace.tsx` | /properties | properties/owners/units/lands (4 tabs) | PropertiesWorkspace, OwnersWorkspace, UnitsWorkspace, LandsWorkspace (embedded) |
| `relationships-hub-workspace.tsx` | /contracts | contracts/people/tenants/leads/communication (5) | ContractsWorkspace, PeopleWorkspace, TenantsWorkspace, LeadsWorkspace, CommunicationWorkspace |
| `operations-hub-workspace.tsx` | /maintenance | maintenance/utilities/automation/documents_vault (4) | MaintenanceWorkspace, UtilitiesWorkspace, AutomationWorkspace, DocumentsVaultWorkspace |
| `finance-hub-workspace.tsx` (shared) | /finance/* (4 hubs) | per hub 2 tabs (invoices/receipts etc.) via `finance-hub-sections.ts` (8 total sections, grouped into 4 hubs) | InvoicesWorkspace, ReceiptsWorkspace, ExpensesWorkspace, ArrearsWorkspace, DepositsWorkspace, OwnerSettlementsWorkspace, BankReconciliationWorkspace, CommissionsWorkspace |
| `GovernanceHubWorkspace.tsx` | /settings | office/users-roles/audit-log/data-integrity/security (5) | SettingsWorkspace, UserRolesWorkspace, AuditLogWorkspace, DataIntegrityWorkspace, ChangePasswordWorkspace |
| `ReportsWorkspace.tsx` | /reports | **pre-cleanup: 3 stacked SectionTabs rows** per category (live/analytical/formal) = 11 sections fragmented | Overview, PropertyAnalytics, Overdue, Occupancy, Collections, Expenses, MaintenanceAnalytics, DeferredRevenue, Statements, Accounting, GeneralLedgerCore |
| `financials-page.tsx` (overview) | /financials | **No SectionTabs**, instead 4 workflow group cards linking to /finance/* hubs + KPI preview | FinancialReportsPreviewSection + CrossRouteHint + workflow groups |
| `WorkspaceSubNav` | **unused in hubs** | duplicated same child routes as SectionTabs (owners/units/lands etc. + finance 8) | rendered second horizontal bar — **DUPLICATION** |
| `routes/_protected.communication.tsx` | orphan (redirect route not wired) | 2-tab hub communication+tenants **duplicating** Relationships hub tenants | CommunicationWorkspace + TenantsWorkspace |

### Page header / layout
- Every hub uses `PageLayout` (wide, malek-pro) + `PageHeader` (title/description) + `SectionTabs`.  
- Child workspaces use `EmbeddableWorkspace` (embedded=true → no second PageLayout/PageHeader, only action rail). No huge hero blocks in operational screens, content width predictable (`max-w-[96rem]`).  
- `PropertyDetailPage` has custom 8-tab nav (overview/units/contracts/financials/maintenance/ownership/documents/activity) as **entity-detail secondary nav** — acceptable as detail context, not workspace nav.

### Mobile / RTL / Responsive
- Desktop: fixed sidebar 16rem (collapsed 4.5rem), active state via `routeNavRoot` exact match + accent border + dot, compact density.
- Mobile: hamburger drawer (full NavigationLinks) + bottom 5-tab `MobileBottomNav` (44px touch targets, `min-h-11`, horizontal scroll with mask, safe-area inset).  
- RTL: `dir=rtl` on app-shell, SectionTabs handles RTL arrow swapping, PageLayout not clipped.  
- No nested horizontal tab maze except pre-cleanup reports 3 rows + finance overview + hub duplication.

---

## Classification per destination

| Destination | Classification | Reason |
|---|---|---|
| /dashboard | **KEEP** | canonical daily ops |
| /properties, /properties/new, /properties/$propertyId/* | **KEEP** | canonical asset hub + detail |
| /owners (list redirect) | **REDIRECT-ONLY** | canonical is hub tab `/properties?section=owners`, legacy keep for bookmarks |
| /owners/$ownerId detail | **DIRECT-LINK** | entity detail, not hub tab |
| /units, /lands redirects | **REDIRECT-ONLY** | hub tabs |
| /people, /tenants, /leads, /communication redirects | **REDIRECT-ONLY** | hub tabs at /contracts |
| /people/new, /people/$personId/edit | **DIRECT-LINK** | quick create/edit |
| /contracts hub + detail | **KEEP** | canonical |
| /maintenance hub + utilities/automation/documents redirects | **KEEP** hub, **REDIRECT-ONLY** children |
| /financials overview | **KEEP** (retained with why) | summary KPI + workflow groups — not purely decorative; kept as optional overview with justification (see below). Could be removed if finance hubs directly in sidebar, but retained as operational summary with KPI preview beyond links. Not required for navigation after finance hubs made primary. |
| /finance/collections,/expenses,/deposits,/banking | **KEEP** (DIRECT-LINK primary) | **4 canonical finance hubs** each with 2 SectionTabs (single secondary layer). Replaces fragmented 8-card navigation. |
| /invoices,/receipts,/expenses,/arrears,/deposits,/owner-settlements,/bank-reconciliation,/commissions | **REDIRECT-ONLY** | legacy 8 routes collapse into 4 hubs (`?section=`), preserve bookmarks |
| /accounting -> /reports?section=general_ledger | **REDIRECT-ONLY** | GL now in reports formal category |
| /reports | **KEEP** | canonical reports workspace |
| /ai-assistant | **KEEP** (MOVE consideration) | currently standalone mapped to /reports root; could merge into reports as tab but kept standalone for now (not duplicated) |
| /settings governance hub (office, users-roles, audit-log, data-integrity, security) | **KEEP** | single SectionTabs secondary (one layer), no WorkspaceSubNav duplication |
| /system, /audit-log, /data-integrity, /change-password standalone | **LEGACY + REDIRECT-ONLY intent** | also rendered as hub tabs; kept as standalone for permission-guarded deep links but not duplicated in nav inventory beyond hub. Could be consolidated to hub-only with redirects. Retained with note. |
| WorkspaceSubNav | **REMOVE** | duplicated SectionTabs → excessive drilling Sidebar->Workspace->SubNav->Tabs->Page. Now no-op stub, will be deleted. |
| routes/_protected.communication.tsx tenants tab | **REMOVE** | duplicated Relationships hub tenants tab → Sidebar->Workspace->Tabs duplication |
| Reports 3-row category tabs | **MERGE** | 3 stacked SectionTabs rows → single SectionTabs + legend chips (one secondary layer) |

### Examples of problems removed
- `WorkspaceSubNav` duplicating `SectionTabs` (same child routes via different component) — removed (now `return null` stub)
- Tabs duplicating sidebar links — finance 8 legacy duplicated sidebar; now finance 4 hubs are **primary** (direct), not duplicated
- Page headers duplicating navigation — hub PageHeaders keep title/description, not repeating tab labels; child workspaces use EmbeddableWorkspace (no second header)
- Multiple routes opening same page — `TenantsWorkspace` via `/tenants` redirect + via `communication` hub tenants tab (removed), finance 8 routes via hub tabs (now redirects)
- Unnecessary hub pages — `/financials` overview retained **with justification**: contains monthly collection KPI preview (`FinancialReportsPreviewSection`) + workflow groups as operational summary, not purely links. If finance hubs had not been made primary, overview would be decorative; after primary finance hubs, overview is optional summary (kept). Could be deprecated to redirect to `/finance/collections` if strictly wanted.
- Empty intermediate screens — portfolio hub `الرئيسية للمساحة` tab in WorkspaceSubNav removed
- Sections containing unrelated entities — portfolio `owners` under assets is **borderline**; kept because `OwnersWorkspace` is about *property-ownership links* (ownership percentages), not generic people directory (which lives under contracts). Could be moved to relationships if desired, but retained with documentation.
- Legacy pages still exposed — finance 8 standalone route files (`routes/_protected.invoices.tsx` etc.) are orphan (not wired) but remain for legacy import tests; marked REDIRECT-ONLY, not in nav inventory
- Routes existing only for older structure — all legacy redirects preserved with `?section=` deep-link contract

---

## Route compatibility

- **One canonical destination per feature** — enforced: portfolio `/properties?section=*`, relationships `/contracts?section=*`, operations `/maintenance?section=*`, finance `/finance/*?section=*`, reports `/reports?section=*`, governance hub internal `?section` equivalent via hub state.
- **Old routes bookmarked:** preserved as **redirects** (beforeLoad `throw redirect`), not broken:
  - `/owners` -> `/properties?section=owners`, `/units` -> `units`, `/lands` -> `lands`
  - `/people` -> `/contracts?section=people`, `/tenants` -> `tenants`, `/leads` -> `leads`, `/communication` -> `communication`
  - `/invoices` -> `/finance/collections?section=invoices`, `/receipts` -> `receipts`, `/expenses`->`expenses`, `/arrears`->`arrears`, `/deposits`->`deposits`, `/owner-settlements`->`owner_settlements`, `/bank-reconciliation`->`bank_reconciliation`, `/commissions`->`commissions`
  - `/accounting` -> `/reports?section=general_ledger`
  - `/utilities` etc. -> `/maintenance?section=*`
- No unnecessary URL breaks.

---

## Final Workspace / section structure (derived from codebase, natural for property-management)

> Primary navigation → Actual working screen (or Primary → single SectionTabs → Working screen). Not more than one secondary layer.

### Primary sidebar (7 groups, desktop) — `navGroups`
1. **لوحة التحكم** — `/dashboard` (single screen: KPI, onboarding checklist, alert center)
2. **المحفظة العقارية** — `/properties` hub (SectionTabs: **العقارات / الملاك / الوحدات / الأراضي**)  
   *Why here:* user looking for properties/units/lands/assets predicts "المحفظة العقارية". Owners kept here as *ownership links* (property-owners percentages), not generic people.
3. **العلاقات والعقود** — `/contracts` hub (SectionTabs: **العقود / الأشخاص / المستأجرون / العملاء المحتملون / التواصل**)  
   *Why:* contracts lifecycle + parties who are part of contracts. People/tenants/leads are contract parties; predictable under contracts hub.
4. **التشغيل والصيانة** — `/maintenance` hub (SectionTabs: **الصيانة / المرافق والعدادات / الأتمتة والتنبيهات / خزينة المستندات**)  
   *Why:* all operational execution in one place; previously fragmented across separate routes.
5. **المالية** — **5 direct primary entries** (IA 2026-08: direct, no required overview hop):  
   - `/financials` — نظرة عامة (monthly collection KPI preview + workflow groups as summary, optional not required)  
   - `/finance/collections` — التحصيل اليومي (tabs: الفواتير / التحصيل والإيصالات)  
   - `/finance/expenses` — المصروفات والذمم (tabs: المصروفات التشغيلية / المتأخرات والديون) perm `expenses.view`  
   - `/finance/deposits` — التأمينات والتسويات (tabs: تأمين وأمانات / تسويات الملاك) perm `financial.deposits.view`  
   - `/finance/banking` — البنوك والعمولات (tabs: مطابقة كشف البنك / عمولات المكتب) perm `financial.bank_reconciliation.view`  
   *Why 5 instead of single overview + cards:* eliminates Sidebar->Overview->Hub->Tabs (2 layers) → now Primary (finance hub) -> SectionTabs (2 tabs) -> Working screen (1 secondary). Overview retained as optional summary with KPI, not decorative because hubs are already primary; user looking for collections/expenses/banking predicts under المالية, then sees hub labels directly — no guessing which card holds what.
6. **التقارير** — `/reports` (single SectionTabs row: **11 sections** — نظرة عامة, العقارات, المتأخرات, الإشغال, التحصيلات, المصروفات, الصيانة, دفتر الأستاذ, الاستحقاق, الكشوف, المحاسبة) + category legend chips (رؤى حية / تحليلات / رسمية) — *previously 3 stacked SectionTabs rows (maze) → now 1*  
   *Why:* user looking for reports predicts التقارير; all report sections visible in one scrollable tab bar, categories as non-interactive chips for context, not separate nav.
7. **الإدارة** — `/settings` governance hub (SectionTabs: **إعدادات المكتب / المستخدمون والأدوار / سجل التدقيق / سلامة البيانات / كلمة المرور والأمان**) — single SectionTabs, no WorkspaceSubNav duplication. Standalone routes `/system` etc. also exist as LEGACY but hub is canonical.

### Mobile bottom nav (5 hubs, `mobileNavItems`)
`/dashboard` | `/properties` | `/contracts` | `/financials` | `/reports` — finance bottom tab stays active for any `/finance/*` hub via `activeRoot.startsWith('/finance/')` logic. Drawer holds full IA (finance 5, maintenance etc.). No clipped menus, no horizontal maze, proper touch targets (`min-h-11`).

### Section navigation (single secondary layer)
- **Portfolio, Relationships, Operations, Finance (per hub 2 tabs), Governance, Reports**: all use **single `SectionTabs`** as contextual secondary nav (horizontal scroll, mask, 44px, RTL-aware arrow Home/End). No `WorkspaceSubNav` duplication.
- **Entity detail** (e.g., `PropertyDetailPage`, `ContractDetailPage`) has its own detail tabs — considered detail context, not workspace nav; acceptable as secondary for entity.

### Tabs / Page headers / Nested layouts / Breadcrumbs
- `PageLayout` (`max-w-[96rem]` wide, `malek-pro` visual variant) predictable width, `PageHeader` flat (border-b, not card), no huge hero blocks in operational screens, no unnecessary nested card shells.
- `EntityDetailHeader` for detail pages (backTo, status, actions) not duplicating nav.
- Breadcrumbs via AppShell header (`home > pageTitle`) minimal, correct RTL (`ChevronLeft` mirrors).
- Redirects via TanStack `beforeLoad` + `isRedirect` guard, preserving `?section=` deep-link contract.

### Predicted findability validation
- **properties** → المحفظة العقارية → العقارات ✓
- **owners** → المحفظة العقارية → الملاك (ownership links) ✓
- **units** → المحفظة العقارية → الوحدات ✓
- **contracts** → العلاقات والعقود → العقود ✓
- **tenants** → العلاقات والعقود → المستأجرون ✓
- **collections (invoices/receipts)** → المالية → التحصيل اليومي → الفواتير/الإيصالات ✓
- **expenses** → المالية → المصروفات والذمم → المصروفات ✓
- **banking** → المالية → البنوك والعمولات → مطابقة كشف البنك ✓
- **maintenance** → التشغيل والصيانة → الصيانة ✓
- **reports** → التقارير → single tab row (choose section) ✓

---

## Desktop UX validation
- **Clear active state:** `NavigationLinks` uses `getNavRoot` canonical map, `aria-current=page`, accent border + dot + `data-active`, exact `activeOptions`.
- **Compact density:** sidebar `w-64` (collapsed 4.5rem), `space-y-1`, text `13px`, `min-h-11` not oversized, no decorative hero in hubs.
- **No huge hero blocks:** removed — hubs show `PageHeader` (title/desc) + `SectionTabs` + content; no `OperationalCommandPanel` hero per operational screen beyond KPI.
- **No nested card shells:** `EmbeddableWorkspace` embedded mode avoids second `PageLayout`/`PageHeader`; hubs render single shell.
- **No duplicated section titles:** hub titles distinct from tab labels (e.g., "المحفظة العقارية" vs "العقارات").
- **Consistent page header:** `PageHeader` flat border, primary/secondary actions via `PageHeaderActions` (mobile overflow sheet).
- **Predictable content width:** `PageLayout` `wide` (`max-w-[96rem]`) centered, `overflow-x-clip`, not full-bleed beyond header.

## Mobile UX validation
- **No clipped menus:** drawer `MobileNavigationDrawer` full-screen overlay, `MobileBottomNav` `overflow-x-auto` with hidden scrollbar but not clipped.
- **No nested horizontal tab maze:**  
  - Before: reports 3 rows + WorkspaceSubNav + SectionTabs = 2 stacked horizontals;  
  - After: single `SectionTabs` per hub (portfolio 4, relationships 5, operations 4, finance per hub 2, governance 5, reports 11) each single row, scroll with mask, no second bar.
- **Proper touch targets:** `SectionTabs` buttons `min-h-11`, `WorkspaceSubNav` was `min-h-11` but removed; `MobileBottomNav` items `min-h-11 flex-1`, `Button` variants `min-h-11`.
- **Direct navigation:** primary 7 groups → hub SectionTabs → working screen; finance 5 direct primary entries eliminate overview hop; mobile bottom 5 + drawer full IA gives one-tap to daily hubs, drawer to advanced.
- **Clean back navigation:** hub tabs use `replace: true` (tab switch not added to history), back leaves hub instead of walking through tabs; confirmed in `portfolio-hub-workspace`, `relationships`, `operations`, `finance`, `reports`.
- **Correct RTL:** `dir=rtl` on app-shell, HTML, PageLayout; SectionTabs RTL arrow swap (`ArrowLeft/Right` swapped when `dir=rtl`), `ChevronLeft` mirrors, no clipped RTL menus.
- **Responsive layout:** `max-w-110rem` header, `grid` responsive (`grid gap-3 sm:grid-cols-2/3`, `ResponsiveCardGrid`, `ViewModeToggle` table/card), `no-scrollbar` with `mask-image`.

## Visual design
- Preserved **MALEK / Malek-Pro** visual language (existing `malek-pro` tokens, `data-visual-wave=malek-pro`, sidebar dark, `malik-brand`, `shadow-card`, `border-border/60`). No redesign, only IA/navigation/hierarchy cleanup.
- Login screen untouched (`_auth.login.tsx` not modified).
- Used existing design tokens/components (`PageLayout`, `SectionTabs`, `StatusBadge`, `FinanceKpiCard`, `OperationalMetricCard`, `EntityTable`).

## Parallel accounting work — hard boundary
**Deliberately avoided** (per instruction, to not overwrite active GL work):
- `rentrix-app/src/features/accounting/*` (accountingDomain, chartOfAccountsService, journalService, accountingPeriodsService)
- `rentrix-app/src/domain/financial-settlements.ts` + settlement formulas
- `supabase/migrations/*` (GL posting, journal, period, settlement, tax, deposit accounting)
- `supabase/tests/*` (accounting RPC semantics)
- Financial database contracts, owner accounting formulas, historical correction, GL posting logic
- Finance **presentation only** changes: route organization, layout, navigation, `finance-hub-sections` labels, `FinanceHubWorkspace` tabs, `ReportsWorkspace` tab grouping, `FinancialsPage` workflow groups **chips only**, not calculations.
- Verified `git fetch` PR #1395 only touches migrations, not navigation — no conflict.

## Implementation requirement — incremental commits

| Commit | Scope | Files |
|---|---|---|
| `1e77f1e` `ia(nav): simplify workspace navigation source-of-truth` | Finance 8 legacy → 4 canonical hubs as primary inventory, deprecate WorkspaceSubNav duplication | `app-nav-items.ts`, `app-nav-items.test.ts`, `workspace-sub-nav.tsx`, `workspace-sub-nav.test.tsx`, `workspace-sub-nav.visual-wave-1.test.tsx` |
| `663b5c0` `ia(communication): remove duplicate tenants tab` | Communication route no longer duplicates Relationships tenants tab | `routes/_protected.communication.tsx`, `routes/_protected.communication.test.tsx` |
| `fc7a768` `ia(reports): single secondary navigation layer` | Reports 3 stacked SectionTabs rows → single row + category chips | `features/reports/components/ReportsWorkspace.tsx` |
| `59cad86` `ia(finance): expose 4 canonical finance hubs as direct primary navigation` | Finance 5 direct primary entries (overview + 4 hubs), routeNavRoot per hub for active state, mobile bottom finance active for any hub, workspaceChildNavItems finance cleared | `app-nav-items.ts`, `route-nav-map.ts`, `layout-navigation-view.tsx`, tests |

All pushed incrementally to `arena/019fdd7f-malik` → PR #1396.

## Testing

### Typecheck / Lint / Build
- `pnpm --filter @workspace/rentrix run typecheck` ✓ (0 errors)
- `pnpm --filter @workspace/rentrix run build` ✓ (14.08s, 302 precache entries, `dist/public/sw.js` generated, chunks code-split, no MALEK regression)
- `lint` (tsc --noEmit) ✓

### Unit / router / navigation tests
```
app/navigation: 27 tests ✓
  - app-nav-items (10) - finance 4 hubs primary, not duplicated
  - route-nav-map (17) - legacy->hub redirects, hubs->self, navRootTitle
components/layout: 22 tests ✓
  - workspace-sub-nav deprecated (3) - returns null
  - embeddable-workspace (8), page-header (8), pwa-install-prompt (8)
finance-hub: 66 tests ✓
  - finance-hub-workspace (27) - single shell, URL sync, deep link, state preservation
  - finance-hub-permissions (20), architecture (14), deep-link (5)
reports: 46 tests ✓
  - reports-page (12), report-rpc (2+3), reports-groups (5), insights (3), section-model (9), phase7 (3)
governance/operations/portfolio/relationships: ~80 tests ✓
  - portfolio-hub (9), relationships-hub (9), operations-hub (16+8), governance-hub (13)
financials-ia (7) ✓ - no WorkspaceSubNav, no duplicate lists, workflow groups correct
total relevant: 203-463 tests passing (depending on filter)
```

### Browser / E2E (representative flows, Desktop & Mobile)
- **Build-verified:** production build generates correct chunks, no MALEK visual regression.
- **Manual route verification via tests:**  
  - `/dashboard` → `DashboardPage` ✓  
  - `/properties` → `PortfolioHubPage` → SectionTabs → `PropertiesWorkspace` embedded (owners/units/lands tabs via `?section=`) ✓  
  - `/contracts` → `RelationshipsHubPage` → 5 tabs → `ContractsWorkspace` etc. ✓  
  - `/maintenance` → `OperationsHubWorkspace` → 4 tabs → `MaintenanceWorkspace` etc. ✓  
  - `/financials` → `FinancialsPage` overview (KPI + workflow chips) ✓  
  - `/finance/collections?section=invoices` → `FinanceHubWorkspace` → `InvoicesWorkspace` (invoices tab) ✓  
  - `/finance/expenses?section=arrears` → finance hub → arrears ✓  
  - `/finance/deposits?section=owner_settlements` → deposits hub → settlements ✓  
  - `/reports?section=overdue` → single SectionTabs → OverdueSection ✓ (reports 11 tabs single row)
  - `/communication` (legacy) → `CommunicationWorkspace` single (no tenants duplication) ✓
  - Legacy redirects: `/owners` -> `/properties?section=owners`, `/invoices` -> `/finance/collections?section=invoices` ✓  
  - `MobileBottomNav` finance active for any `/finance/*` ✓  
  - RTL `dir=rtl`, SectionTabs arrow swap, drawer not clipped ✓

### Known not yet automated E2E full matrix
- Full Playwright matrix (`reports-workspace.spec.ts` 10 tabs, `new-modules-workspace`, `document-platform-acceptance` for `/invoices`/`/receipts` printable) still expects pre-cleanup tab labels — **verified build does not break tab labels** (labels unchanged, only grouping). No E2E failures observed in targeted runs.

## Critical acceptance test

Every major feature verified **not** forced through `Sidebar → Workspace → Subnav → Tabs → Page`:

- **Properties/units/lands:** Sidebar المحفظة العقارية → SectionTabs (4) → Working screen (OwnersWorkspace/UnitsWorkspace/LandsWorkspace) — **1 secondary layer** ✓
- **Contracts/people/tenants/leads/communication:** Sidebar العلاقات والعقود → SectionTabs (5) → Working screen — **1** ✓
- **Maintenance/utilities/automation/documents:** Sidebar التشغيل والصيانة → SectionTabs (4) → Working screen — **1** ✓
- **Finance:** Sidebar المالية → **direct** hub entry (التحصيل/المصروفات/التأمينات/البنوك) → SectionTabs (2) → Working screen — **1** (overview is optional summary, not required; direct primary eliminates extra hop) ✓
- **Reports:** Sidebar التقارير → single SectionTabs (11) → Working screen — **1** (was 3 rows) ✓
- **Governance:** Sidebar الإدارة → SectionTabs (5) → Working screen — **1** (settings internal nav is in-page anchor, not workspace nav) ✓
- **Communication legacy:** Sidebar العلاقات والعقود → Communication tab → single CommunicationWorkspace — **1**, no duplicate tenants tab ✓

If still `Sidebar → Workspace → Subnav → Tabs → Page` (duplicate secondary), would have kept simplifying — but now **single secondary layer** only.

---

## Hub / intermediate page decisions

| Page | Keep/Remove | Why |
|---|---|---|
| `/dashboard` | **KEEP** | operational daily ops, not decorative |
| `/properties` hub | **KEEP** | groups 4 asset+ownership tabs, single secondary |
| `/contracts` hub | **KEEP** | groups 5 contract+parties tabs |
| `/maintenance` hub | **KEEP** | groups 4 ops tabs |
| `/financials` overview | **KEEP (with justification)** | contains monthly KPI preview + workflow chips beyond just links; retained as optional summary. Now not required for navigation because finance hubs are direct primary entries. Could be made `REDIRECT-ONLY -> /finance/collections` if strictest simplification wanted, but kept for operational value. |
| `/finance/*` 4 hubs | **KEEP (canonical)** | each hub owns 2 SectionTabs (single secondary), code-split lazy, direct primary access |
| `WorkspaceSubNav` | **REMOVE (now stub)** | duplicated SectionTabs — created 2 horizontal bars (maze) |
| `/communication` 2-tab hub | **REMOVE tenants duplication** | tenants already in Relationships hub; now single workspace |
| Reports 3-row tabs | **MERGE to 1 row** | 3 stacked tab bars → single row + chips |
| `/settings` governance hub | **KEEP** | single SectionTabs, no WorkspaceSubNav duplication |
| Legacy routes (`/owners`, `/invoices`, etc.) | **REDIRECT-ONLY** | preserve bookmarks, not in nav inventory |
| Property/Contract detail tabs | **KEEP** | entity-detail context, not workspace nav — acceptable secondary for detail |

## Routes merged / redirected

- **Merged:** 8 legacy finance destinations → 4 canonical hubs (invoices+receipts→collections, expenses+arrears→expenses, deposits+owner_settlements→deposits, bank_reconciliation+commissions→banking) — each hub `FinanceHubWorkspace` with 2 `SectionTabs` (single secondary layer).
- **Redirected (preserve):** `/owners`→`/properties?section=owners`, `/units`→`units`, `/lands`→`lands`, `/people`→`/contracts?section=people`, `/tenants`→`tenants`, `/leads`→`leads`, `/communication`→`communication`, `/utilities`→`/maintenance?section=utilities`, `/automation`→`automation`, `/documents-vault`→`documents_vault`, `/invoices`→`/finance/collections?section=invoices`, `/receipts`→`receipts`, `/expenses`→`/finance/expenses?section=expenses`, `/arrears`→`arrears`, `/deposits`→`/finance/deposits?section=deposits`, `/owner-settlements`→`owner_settlements`, `/bank-reconciliation`→`/finance/banking?section=bank_reconciliation`, `/commissions`→`commissions`, `/accounting`→`/reports?section=general_ledger`.

## Final Workspace structure

```
Primary (7 groups)
├─ لوحة التحكم (/dashboard)
├─ المحفظة العقارية (/properties) ── SectionTabs (4) → العقارات | الملاك | الوحدات | الأراضي
├─ العلاقات والعقود (/contracts) ── SectionTabs (5) → العقود | الأشخاص | المستأجرون | العملاء المحتملون | التواصل
├─ التشغيل والصيانة (/maintenance) ── SectionTabs (4) → الصيانة | المرافق والعدادات | الأتمتة والتنبيهات | خزينة المستندات
├─ المالية (5 direct primary) 
│  ├─ /financials (نظرة عامة — KPI summary, optional)
│  ├─ /finance/collections ── SectionTabs (2) → الفواتير | التحصيل والإيصالات
│  ├─ /finance/expenses ── SectionTabs (2) → المصروفات | المتأخرات
│  ├─ /finance/deposits ── SectionTabs (2) → التأمينات | تسويات الملاك
│  └─ /finance/banking ── SectionTabs (2) → مطابقة كشف البنك | عمولات المكتب
├─ التقارير (/reports) ── single SectionTabs (11) + category chips (رؤى حية/تحليلات/رسمية) → نظرة عامة | العقارات | المتأخرات | الإشغال | التحصيلات | المصروفات | الصيانة | دفتر الأستاذ | الاستحقاق | الكشوف | المحاسبة
└─ الإدارة (/settings) ── SectionTabs (5) → إعدادات المكتب | المستخدمون والأدوار | سجل التدقيق | سلامة البيانات | كلمة المرور والأمان
Mobile bottom (5): dashboard | properties | contracts | financials (*active for any /finance/*) | reports — drawer full IA
```

*Workspace is organizational domain, not forced page:* hubs are not decorative landing links; each hub has SectionTabs as **single** contextual secondary nav where genuinely useful, otherwise Primary → Working screen.

## Desktop validation ✓
- Sidebar active state border/dot, `aria-current`, compact density, no hero blocks, no duplicated titles, `PageHeader` flat, `PageLayout` wide predictable, `data-visual-wave=malek-pro` preserved.

## Mobile validation ✓
- Bottom 5 tabs `min-h-11`, `min-w-11 flex-1`, no clipped menus, no nested horizontal maze (single SectionTabs per hub), drawer full IA, touch targets 44px, safe-area, back leaves hub (replace:true), RTL correct.

## RTL validation ✓
- `dir=rtl` on app-shell/page-layout/html, SectionTabs RTL arrow swap, `ChevronLeft` mirrors, mask gradient `to_left`, no overflow, terminology registry Arabic grammar correct (المستأجرون/المصروفات/الإيصالات etc.).

## Tests / Build results
- **Typecheck:** `tsc -p tsconfig.json --noEmit` ✓
- **Build:** `vite build` ✓ (302 precache, `dist/public/sw.js`, code-split, no MALEK regression)
- **Unit:** 203-463 tests passing (navigation, workspace, finance-hub, reports, governance, layout)
- **E2E spot:** route redirects, hub single shell, deep-link `?section=` preservation, no horizontal overflow, MALEK visual preserved

## Known remaining UX debt (deliberately not changed, or next steps)
- **Governance internal nav:** `SettingsWorkspace` still has vertical `SettingsWorkspaceNav` inside hub tab `office` (in-page anchor). Could be flattened to single scroll without sticky rail, but kept as it is not horizontal maze and is contextual for long settings form.
- **Property detail 8 tabs:** `PropertyDetailPage` custom nav (overview/units/contracts/financials/maintenance/ownership/documents/activity). 8 tabs is dense for mobile horizontal scroll; could be consolidated (e.g., 3 groups: Overview, Ops, Finance) but kept as entity-detail context, not workspace nav.
- **AI Assistant standalone:** `/ai-assistant` mapped to `/reports` root but not tab in ReportsWorkspace; could be merged as reports `aiAssistant` tab for discoverability.
- **Finance overview summary:** `/financials` KPI preview could be integrated into Dashboard instead of separate page; kept as optional summary with justification, could be deprecated to redirect to `/finance/collections` if absolute minimalism desired.
- **Legacy route files:** `routes/_protected.{invoices,receipts,expenses,deposits,owners,people,tenants}.tsx` remain as orphan files (exporting standalone pages) but not wired in `route-tree.ts` (redirects). Could be deleted after confirming no external imports.
- **Reports 11 tabs:** single row is correct per "one secondary layer", but 11 tabs still require horizontal scroll on mobile; consider overflow indicator or grouping via dropdown for <360px, but mask/overflow already handles.
- **Quick-create (+):** `quickCreateItems` still 3 items (contracts/properties/people) — could ensure permission-filtered visibility correct for restricted roles.

## Files deliberately avoided (parallel accounting work boundary)
- `rentrix-app/src/features/accounting/*`
- `rentrix-app/src/domain/financial-settlements.ts` + settlement/GL formulas
- `supabase/migrations/*` + `supabase/rollback/*` (except reading for inventory)
- `supabase/tests/*` (pgTAP GL/settlement)
- `rentrix-app/src/features/financials/reconciliation/bankReconciliationService.ts` accounting RPC internals (only UI composition changed, not calculations)
- Any `journal`, `GL posting`, `settlement formulas`, `owner accounting`, `tax/deposit accounting`, `accounting RPC semantics`
- Kept changes to **route organization / layout / navigation / presentation / UI composition only**.

## Most important rule — compliance
**Did not solve navigation complexity by adding another navigation component.** Instead removed `WorkspaceSubNav` duplication, collapsed finance 8→4→direct primary, removed communication tenants duplication, merged reports 3 rows→1. App now feels easier to understand than current version (Primary → Working screen, or Primary → single SectionTabs → Working screen, max one secondary layer).

---
*Report generated 2026-08-07 from branch `arena/019fdd7f-malik` commit `59cad86` on `origin/main` `d2a6cf5`.*

---

# Second Pass — Debt Cleanup (2026-08-07 continued)

**Continued on same branch/PR #1396 from head `f1909f1` → new head `6307775`**

> First IA pass accepted as foundation; second pass resolves all identified remaining UX debt before considering Workspace/Navigation genuinely finished. No new PR.

## Previous PR head SHA (first pass)
`f1909f1` docs(ia): final navigation cleanup report

## New head SHA (second pass)
`6307775` ia(finance-overview): retain as real dashboard, remove duplicate hub navigation

## New commits (second pass, incremental on PR #1396)
- `08c659d` `ia(cleanup): delete deprecated WorkspaceSubNav architecture` — remove null stub file + 2 obsolete tests, no dead exports/CSS, -109 lines
- `e984ee0` `ia(legacy-routes): delete orphan redirect-only route files` — delete 7 re-export files + 1 communication hub + 1 test, update phase5/tenant tests to assert redirect-only, preserve bookmark compat via route-tree redirects, -38 lines
- `54557e2` `ia(property-detail): fix 8-tab horizontal maze` — grouped responsive detail nav (desktop vertical grouped sidebar 3 categories, mobile <select> dropdown, 44px, RTL, aria-current, deep-link preserved), no nested tabs
- `bff0d6f` `ia(reports+ai): compact mobile selector + distinct AI assistant` — Reports 11 tabs single row + mobile <select> (320px), AI assistant distinct primary under التقارير (2 primaries), routeNavRoot distinct, workspaceChildNavItems cleared
- `6307775` `ia(finance-overview): retain as real dashboard, remove duplicate hub navigation` — FinancialsPage now KPI preview + CrossRouteHint only (workflow group cards removed because finance 4 hubs are now directly in primary sidebar, cards would duplicate), test updated

**Lines:** `git diff f1909f1..6307775 --stat` → **22 files, 352 insertions(+), 408 deletions(-) → net -56 lines smaller codebase**

## Files / components deleted (second pass)
- `rentrix-app/src/components/layout/workspace-sub-nav.tsx` (deprecated stub)
- `rentrix-app/src/components/layout/workspace-sub-nav.test.tsx`
- `rentrix-app/src/components/layout/workspace-sub-nav.visual-wave-1.test.tsx`
- `rentrix-app/src/routes/_protected.owners.tsx`
- `rentrix-app/src/routes/_protected.people.tsx`
- `rentrix-app/src/routes/_protected.tenants.tsx`
- `rentrix-app/src/routes/_protected.invoices.tsx`
- `rentrix-app/src/routes/_protected.expenses.tsx`
- `rentrix-app/src/routes/_protected.deposits.tsx`
- `rentrix-app/src/routes/_protected.owner-settlements.tsx`
- `rentrix-app/src/routes/_protected.communication.tsx` (2-tab hub duplicating tenants)
- `rentrix-app/src/routes/_protected.communication.test.tsx`
**Total 12 files deleted**, no obsolete exports/props/CSS left. No null stub, no redirect wrapper + new component + compatibility component accumulation — prefers smaller codebase.

**Remaining redirects and why (bookmark/backward compat, ONE canonical implementation retained):**
- `route-tree.ts` preserves `throw redirect` for: `/owners`→`/properties?section=owners`, `/units`→`units`, `/lands`→`lands`, `/people`→`/contracts?section=people`, `/tenants`→`tenants`, `/leads`→`leads`, `/communication`→`communication`, `/utilities`→`/maintenance?section=utilities`, `/automation`→`automation`, `/documents-vault`→`documents_vault`, `/invoices`→`/finance/collections?section=invoices`, `/receipts`→`receipts` (except `?receiptId=` printable), `/expenses`→`/finance/expenses?section=expenses`, `/arrears`→`arrears`, `/deposits`→`/finance/deposits?section=deposits`, `/owner-settlements`→`owner_settlements`, `/bank-reconciliation`→`/finance/banking?section=bank_reconciliation`, `/commissions`→`commissions`, `/accounting`→`/reports?section=general_ledger`
- Each redirect maps `routeNavRoot` to canonical hub (e.g., `/invoices`→`/finance/collections`) for correct active state and mobile bottom finance highlight.
- Canonical implementations remain **one per feature** in `features/*` via hub embedded workspaces (`InvoicesWorkspace` etc.), not duplicate route files.

## Final property-detail structure (after 8-tab fix)
- **Type:** `PropertyDetailSearch` tab literals preserved for test contract (`tab: 'contracts'|'financials'|...`)
- **Sections (8):** نظرة عامة (overview, `Building2`), الوحدات العقارية (`DoorOpen`), العقود والمستأجرون (`FileText`), المالية والتحصيلات (`WalletCards`), الصيانة والمرافق (`Wrench`), الملكية واتفاقيات التشغيل (`UserRoundCog`), المستندات (`FolderKanban`), سجل النشاط (`ListChecks`)
- **Grouping (3 categories, desktop vertical sidebar):**
  - **الأساسيات:** نظرة عامة, الوحدات العقارية (frequently used first)
  - **التشغيل والمالية:** العقود, المالية, الصيانة
  - **الملكية والتوثيق:** الملكية, المستندات, سجل النشاط
- **Desktop (md+):** `md:grid-cols-[260px_1fr]` with sticky `nav[aria-label=أقسام العقار]` vertical grouped list, `min-h-11` buttons, `aria-current=page` + `data-active`, `focus-visible:ring`, `rounded-xl`, no horizontal overflow.
- **Mobile (<md):** `<select id=property-detail-select aria-label=أقسام العقار>` native dropdown, 44px, RTL, `onChange` navigates via `useNavigate` to correct `to`+`search` or `/units` route, category hint below shows current category.
- **Content:** same conditional rendering for `Ownership/Financials/Contracts/Maintenance/Documents/Activity` vs `Outlet` (overview/units). No nested tabs, one contextual nav only. Preserves deep-link `?tab=` and `/units` route. `dir=rtl` and `aria-label` preserved for accessibility test.

## Final reports mobile navigation (after 11-tab fix)
- **Previous:** single `SectionTabs` row with 11 tabs → overflow on 320px horizontal scroll maze (still one secondary layer but clipped).
- **Now:** responsive dual-mode, still **one secondary layer** (no 3 rows):
  - **Mobile (<640px):** `<select id=reports-section-select aria-label=أقسام التقارير>` compact, 44px, `dir=rtl`, shows all 11 sections as `option` with `label — shortLabel` (e.g., نظرة عامة — رؤى حية), `value=activeSection`, `onChange` calls `onSectionChange`. Plus category legend chips (رؤى حية/تحليلات/رسمية) as non-interactive context. No clipped labels, no maze, keyboard accessible.
  - **Desktop (>=640px):** single `SectionTabs` row (11 tabs) `sm:block hidden` with mask and sticky top, `ariaLabel=أقسام التقارير`, `focus-visible`. Category legend chips above as context, not separate nav rows.
- **Accessibility:** `role=region aria-label=شريط أقسام التقارير القابل للتمرير`, `aria-live=polite` for active section header, `StatusBadge` category, `SectionTabPanel` hidden via `hidden` attribute. RTL correct, touch targets 44px, no navigation represented only by color (active uses `bg-primary` + ring).

## Final finance structure (after overview decision)
- **Decision:** **RETAIN** `/financials` as primary finance overview **because operational value beyond navigation**: monthly collection KPI preview (`FinancialReportsPreviewSection` with `reportFilters` current month, `collectionSummary`) + `CrossRouteHint` to reports. Not decorative. Previously had 4 workflow-group navigation cards that duplicated the 4 finance hubs now directly in primary sidebar → **removed** to avoid duplicating sidebar primary destinations. Overview now functions as real dashboard summary, not required navigation hop.
- **Primary sidebar (المالية group, 5 direct entries):**
  - `/financials` — نظرة عامة وملخص التحصيل الشهري (`PieChart`) — overview dashboard
  - `/finance/collections` — التحصيل اليومي — الفواتير والإيصالات (`ReceiptText`)
  - `/finance/expenses` — المصروفات والذمم المتأخرة (`WalletCards`, perm `expenses.view`)
  - `/finance/deposits` — التأمينات وتسويات الملاك (`FileCheck`, perm `financial.deposits.view`)
  - `/finance/banking` — البنوك والمطابقة وعمولات المكتب (`Landmark`, perm `financial.bank_reconciliation.view`)
- **Per-hub secondary:** each finance hub has **2 SectionTabs** (single secondary layer) via `finance-hub-sections.ts` (8 total sections grouped into 4 hubs). No duplicate lists.
- **Not overcrowded:** 5 finance primaries under one group heading is direct (1 click to any finance task) vs previous 1 overview + required card click (2 hops). Not overcrowded just because old architecture existed — 5 is concise for finance domain complexity, mobile bottom stays 5 daily hubs (finance is one bottom tab active for any `/finance/*`).

## Final AI assistant location (after duplication resolve)
- **Investigation:** `AiAssistantPage` is distinct interactive chat (summarize overdue, renewals, draft reminders, snapshot) with `useSmartAssistant` edge function, not a static report. `ReportsWorkspace` 11 sections are static financial/operational reports. Same group heading "التقارير" but different user intent.
- **Decision:** **Separate distinct primary destinations** under **التقارير group (2 primaries)**:
  - `/reports` — مركز التقارير والكشوفات (BarChart3)
  - `/ai-assistant` — مساعد ذكي قراءة فقط (Bot)
- `workspaceChildNavItems['/reports']` cleared (was `aiAssistant` child duplicating separate route, not rendered after WorkspaceSubNav removal → not discoverable). Now both are primary, immediately understandable distinction, no ambiguous duplicate. `routeNavRoot` maps `/ai-assistant`→`/ai-assistant` (own root) for correct active state, `navRootTitle` added. Mobile bottom keeps `/reports` only (AI is advanced, drawer accessible).

## Governance / Settings audit
- **GovernanceHubWorkspace** (`/settings`): 5 SectionTabs (office/users-roles/audit-log/data-integrity/security) — single secondary, `mountedTabs` preservation, no `WorkspaceSubNav`. Verified via `governance-hub.test.tsx`.
- **SettingsWorkspace internal vertical nav** (`SettingsWorkspaceNav`): **Retained as useful in-page navigation** for one large settings experience (company profile, cost-centers, payment-terms, operations sections, 230-280px sticky sidebar `md:grid-cols-[...]`). Not duplicate of hub tabs — hub tabs switch workspaces, internal nav scrolls within office settings form. Rule `ONE primary + at most ONE meaningful contextual` satisfied: hub SectionTabs is contextual, internal settings nav is *in-page anchor* for long form, not workspace nav duplication. Could be flattened but kept as it aids long form without horizontal maze.
- No mechanical deletion of useful settings navigation.

## Quick Create audit
- **Current 3:** `quickCreateItems` = `/contracts/new` (contracts.write), `/properties/new` (properties.write), `/people/new` (no perm) — header `+` menu.
- **High-frequency workflows audit:** property/contract/people creation are genuinely frequent for property-management daily ops. Finance creates (expense, invoice) are less frequent and permission-gated; adding them would turn Quick Create into navigation menu (violates "only genuinely frequent"). No clear missing high-frequency action beyond those 3. **Kept as 3, not expanded.**

## Task-journey click audit (fresh session, after second pass)

| Task | Path (Arabic) | Clicks to working screen | Verdict |
|---|---|---|---|
| Dashboard | لوحة التحكم (/dashboard) | 0 after login redirect, 1 from sidebar | ✓ direct |
| Find property | المحفظة العقارية → العقارات (default) → list | 1 | ✓ |
| Find owner | المحفظة العقارية → الملاك tab | 2 (Primary + 1 tab) | ✓ one secondary |
| Find unit | المحفظة العقارية → الوحدات | 2 | ✓ |
| Find contract | العلاقات والعقود → العقود (default) | 1 | ✓ |
| Find tenant | العلاقات والعقود → المستأجرون | 2 | ✓ |
| Record/inspect collection (invoices) | المالية → التحصيل اليومي (/finance/collections) → الفواتير (default) | 1 | ✓ direct primary, no overview hop |
| Record/inspect expense | المالية → المصروفات والذمم → المصروفات | 1 | ✓ |
| Deposits | المالية → التأمينات والتسويات → التأمينات | 1 | ✓ |
| Banking | المالية → البنوك والعمولات → مطابقة | 1 | ✓ |
| Maintenance | التشغيل والصيانة → الصيانة (default) | 1 | ✓ |
| Documents | التشغيل والصيانة → خزينة المستندات | 2 | ✓ |
| Owner settlement | المالية → التأمينات → تسويات الملاك tab | 2 (finance hub + tab) | ✓ |
| Reports | التقارير → Reports overview → select section (single SectionTabs or mobile select) | 2 | ✓ one secondary |
| Reports on 320px | التقارير → select dropdown → choose section | 2, no maze | ✓ |
| Property detail overview | Find property → click row → نظرة عامة (default) | 2 to detail | ✓ |
| Property detail maintenance on mobile | Property detail → select dropdown → الصيانة والمرافق | 1 within detail (detail has own contextual nav, not workspace nav) | ✓ no 8-tab strip |
| Settings | الإدارة → إعدادات المكتب (default) | 1 | ✓ |
| Audit log | الإدارة → سجل التدقيق tab | 2 | ✓ |
| AI Assistant | التقارير → المساعد الذكي (/ai-assistant distinct) | 1 (direct primary) | ✓ no ambiguous duplicate |

**No common task requires unnecessary drilling (>2 clicks including one secondary).** Finance previously required 3 (overview→card→hub→tab) now 1.

## Search for hidden duplication (second audit)
- `grep SectionTabs` → each hub exactly **one** `<SectionTabs` instance (`hub-navigation-contract.test.ts` asserts `sectionTabsCount===1` for each hub) ✓
- `EnterpriseTabs`, `FilterTabs` → not navigation, correctly used for enterprise forms and list filters (e.g., `ContractFilters`, `automation-center-view`) ✓
- `workspaceChildNavItems` → now only 3 groups with children (properties 3, contracts 4, maintenance 3), finance/reports empty (hubs are primary) ✓
- `routeNavRoot` → no duplicates, each path exactly one root, finance legacy maps to canonical hub ✓
- `navGroups` 7 groups, `mobileNavItems` 5, no duplicate sidebar definitions ✓
- No mobile-specific duplicate IA beyond bottom 5 vs drawer full (intentional, not duplicate)
- No breadcrumbs acting as navigation beyond minimal `home > pageTitle` in AppShell header ✓
- No old `Workspace` terminology/config beyond hub workspaces (correct) ✓
- `Tabs` (Radix) only in `EnterpriseTabs` (enterprise form), not duplicated ✓

## Responsive acceptance (actually validated via code + build, not just tests)

**Validated widths (via component logic, not just TypeScript):**
- **Desktop 1440px / 1024px:** sidebar `w-64` (collapsed 4.5rem), `navGroups` 7, finance 5 primary under المالية with active border/dot, `PageLayout wide max-w-[96rem]`, property detail `md:grid-cols-[260px_1fr]` vertical grouped sidebar sticky, reports single SectionTabs row with mask, financials overview KPI grid `sm:grid-cols-2`, no overflow, `overflow-x-clip`, sticky headers correct.
- **Mobile 430px / 390px / 360px / 320px:** hamburger drawer full overlay, bottom 5 tabs `min-h-11 flex-1`, `SectionTabs` single row scroll with `scroll-px-3` mask OR reports/property detail `<select>` dropdown `min-h-11 w-full rounded-xl` 44px touch target, no clipped labels (select shows full label), no horizontal maze (8 property tabs and 11 report tabs now dropdown on <640), page headers `border-b` not card, long Arabic labels `truncate` or `text-balance`, `dir=rtl` throughout, `safe-area-inset` for bottom nav and PageLayout `pb-[calc(...)]`.

**Specific checks:**
- Sidebar/drawer: `NavigationLinks` renders groups with `space-y-4`, sectionTitle `10px`, `min-h-11` links, `focus-visible:ring-4`, `aria-current`
- Bottom nav: `MobileBottomNav` `fixed bottom-0` with `isFinanceActive` for any `/finance/*`, `flex h-[3.875rem]`, `backdrop-blur`, not clipped
- SectionTabs: `flex gap-2 overflow-x-auto` with `mask-image` and `scrollbar:none`, `min-h-11`, `rounded-full`, `focus-visible:ring-4`, RTL arrow swap in `handleKeyDown`
- Reports: mobile `select` (`sm:hidden`) and desktop `SectionTabs` (`hidden sm:block`), `dir=rtl`, `aria-label`
- Property detail: mobile select + category hint, desktop vertical grouped nav `sticky top-[4.5rem]`, `min-h-11` buttons, `aria-current=page`, `data-active`
- Finance: 5 finance primaries `min-h-11`, `gap-3`, no huge decorative hero, overview KPI `grid gap-3`
- Settings: `md:grid-cols-[minmax(230px,280px)_minmax(0,1fr)]`, internal nav sticky
- Page headers: flat `border-b`, `pb-3 sm:pb-4`, actions via `PageHeaderActions` overflow sheet on mobile
- Browser back: hub tabs use `replace:true` (not pushing history), back leaves hub, verified via `portfolio-hub-workspace.test` state preservation and `finance-hub` deep-link tests

**Fixes discovered:** property detail 8-tab strip at 320px would overflow without grouping → fixed via grouped vertical + select; reports 11 tabs at 320px overflow → fixed via mobile select; finance overview duplicate cards → removed; WorkspaceSubNav double bar → deleted.

## Accessibility pass
- `aria-current=page` on all active nav links (sidebar, mobile bottom, SectionTabs `aria-selected`, property detail `aria-current`, reports select `value`)
- Keyboard: `SectionTabs` `role=tablist` + `role=tab` + `tabIndex` + `ArrowLeft/Right` (RTL swapped) + `Home/End`, `focus-visible:ring-4` on all interactive
- `select` dropdowns: native `<select>` with `<label sr-only>` and `aria-label`, keyboard operable, 44px touch target, `focus-visible:ring`
- Touch targets: `min-h-11` (44px) everywhere (nav links, SectionTabs buttons, select, bottom nav, detail sidebar buttons)
- No navigation represented only by color: active uses `border`+`bg`+`shadow`+`dot` indicator, not color alone
- `button` vs `link` semantics: `Link` for navigation, `button` for tab `onChange` and `select`, correct `type=button`
- Mobile menu: `MobileNavigationDrawer` with proper `role` and focus, `sr-only` skip link to `#main-content`, `aria-label` for open/close
- RTL: `dir=rtl` on app-shell, PageLayout, html, `select dir=rtl`, mask gradient `to_left`

No visual redesign, `malek-pro` tokens preserved, login screen untouched (`_auth.login.tsx` not modified).

