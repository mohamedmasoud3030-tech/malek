# MALEK — Foundation / IA Contract / Migration Safety — Phase 1+2

> **Status:** Phase 3 — Route-native entity dialogs completed. People/Lands/Commissions canonical + Contracts/Properties/Units/Owners now route-native (dialog over background vs full page). Foundation contracts updated, no business logic/schema change.
> **Phase 3 Commit baseline:** on top of Phase 2 commit `62ad49a`. Date: 2026-08-09

---


---

## 1) Current State — Actual IA (code-verified 2026-08-09 — updated Phase 2: people/lands/commissions now canonical, hub sections pruned)

### 1.1 Primary navigation actually rendered (7 entries — sidebar)
| Group | Route | Label | Permission |
|-------|-------|-------|------------|
| الرئيسية | `/dashboard` | لوحة التحكم | — |
| إدارة العقارات | `/properties`, `/owners`, `/tenants`, `/contracts` | العقارات، الملاك، المستأجرون، العقود | owners.hub.view on /owners |
| التشغيل | `/maintenance` | التشغيل والصيانة | — |
| المالية والمحاسبة | `/financials`, `/reports` | المالية، المحاسبة والتقارير | — |
| الأدوات | `/ai-assistant` | المساعد الذكي | — |
| الإدارة | `/settings` | الإعدادات | settings.manage |

*All other operational paths are NOT top-level — they live as redirects or hub views.*

### 1.2 Child / hub workspaces (secondary, not in sidebar)
| Hub | Children (redirect → `?section=`/`?view=`) | Notes |
|-----|---------------------------------------------|-------|
| `/properties` | `/units` → `?section=units`, `/lands` → `?section=lands` | lands requires `lands.view` |
| `/contracts` | `/people` → `?section=people`, `/leads` → `?section=leads`, `/communication` → `?section=communication` | people direct routes `/people/new` and `/people/$id/edit` are real pages (modal), not redirects |
| `/maintenance` | `/utilities`, `/automation`, `/documents-vault` → `?section=` | |
| `/financials` | `/finance/collections|expenses|deposits|banking` + `/invoices|/receipts|/expenses|/arrears|/deposits|/owner-settlements|/bank-reconciliation|/commissions` → `?section=&view=` | `receipts` has exception: `/receipts?receiptId=X` renders print shell, otherwise redirects |
| `/reports` | `/accounting` → `?section=accounting&view=general_ledger` | |
| `/settings` | `/change-password`, `/audit-log`, `/data-integrity`, `/system` | |

### 1.3 Bottom / mobile navigation (5 entries)
`/dashboard` · `/properties` · `/tenants` · `/contracts` · `/financials`

*Owners, maintenance, reports, ai-assistant only in drawer — intentional per current design.*

### 1.4 Routes inventory (42 canonical + 21 redirecting aliases)
Full typed list in `rentrix-app/src/app/navigation/route-contract.ts` (`ROUTE_CONTRACT`). Every entry records `canonical`, `titleAr`, `sidebarRoot`, `permission`, `viewBinding`, `targetIANote`.

**Redirect inventory (21):**
`/landing`, `/units`, `/lands`, `/people`, `/leads`, `/communication`, `/utilities`, `/automation`, `/documents-vault`, `/finance/collections`, `/finance/expenses`, `/finance/deposits`, `/finance/banking`, `/commissions`, `/expenses`, `/invoices`, `/receipts` (conditional), `/arrears`, `/deposits`, `/owner-settlements`, `/bank-reconciliation`, `/accounting`

**Deep-link inventory (preserved):**
- Entity detail: `/properties/$propertyId`, `.../units/$unitId`, `/owners/$ownerId`, `/contracts/$contractId`, `/receipts?receiptId=UUID` (print), `?invoiceId=&collect=1` (quick collect), `/finance/*?section=`, `/financials?section=&view=`
- All above carry search-preserving redirect: `search: (prev) => ({...prev, section:..., view:...})`

### 1.5 Properties / Units / Lands — current coupling
- Properties owns units as nested routes (`/properties/$propertyId/units`). Units global `/units` redirects into properties workspace.
- Lands has no standalone workspace — `/lands` redirects; the lands list renders inside `/properties?section=lands`.

### 1.6 People / Owners / Tenants — current coupling
- Owners & tenants are standalone entities (`/owners`, `/tenants`) with own services.
- People directory (`/people`) is a unified contact table that **redirects to `/contracts?section=people`** in its list form, but `/people/new` and `/people/$id/edit` are direct modal routes. This is the most confusing coupling.

### 1.7 Reports — current separation
- `/reports` is one hub with `ReportsWorkspace` (category-grouped sections, `?section=` deep links). Logic already separated from Finance; page chrome is independent. `/accounting` is alias → `?section=accounting`.

### 1.8 Commissions — business semantics (verification needed)
- Current code: `commissions.view` permission, `CommissionSourceSelector` queries contracts/leads/lands/people/properties to build a typed source selector (see `commissions-page.tsx`). Business meaning = sales/collection commission (not banking fee). Currently rendered as a view under `/financials` expenses section.

### 1.9 Entity dialogs — current pattern
- Dialogs/modals use local state + `EntityPreviewDialog` + global `entity-preview-events` bus. Future target is router-native deep-link / TanStack Route Masking — deferred until backend contracts for masking exist.

---

## 2) Target IA (approved — built incrementally from Phase 2)

```
لوحة التحكم        /dashboard
الأشخاص            /people        (standalone — not child of contracts)
العقارات            /properties
الأراضي            /lands         (standalone — not child of properties)
العقود              /contracts
المالية             /financials
  ├ الفواتير               → view=invoices
  ├ الإيصالات والتحصيلات   → view=receipts
  ├ المصروفات              → view=expenses
  ├ الودائع                → view=deposits
  ├ تسويات الملاك          → view=owner_settlements
  └ التسوية البنكية        → banking
التقارير            /reports       (independent visually & conceptually from finance)
الخدمات             /maintenance   (route stays /maintenance for compat; concept = الخدمات)
العمولات            /commissions   (standalone module — not under banking/finance)
الإعدادات           /settings
```

**Target mobile top 5:** `/dashboard`, `/properties`, `/contracts`, `/financials`, plus one TBD (likely `/people` or `/maintenance` after usage data) — to be decided in Phase 2, not now.

> Phase 1 does NOT move domains. It only pins this target so Phase 2 can progressively disclose and migrate with legacy preservation.

---

## 3) Compatibility Contracts (must not break)

1. **Legacy URLs never 404.** Every path in `REDIRECT_ROUTES` must redirect (or, for `/receipts`, branch between redirect vs print shell). Tests: `route-contract.test.ts`, `legacy-compatibility.test.ts`.
2. **No blank route states.** Every `createRoute` with a `path` must have either `component` or `beforeLoad → redirect` (or `beforeLoad` permission check + redirect). Exception: `/dev/design-system` is dev-only. Tests: `route-blank-state.test.ts`.
3. **Active nav state coverage.** `route-nav-map.ts` (`routeNavRoot` + `getNavRoot`) must map every path in `ROUTE_CONTRACT` (and `params` variants) to a `SidebarRoot`. Tests: `route-nav-map.test.ts` + `navigation-active-state.test.ts`.
4. **Permission parity.** If a `NavItem` carries a permission, the corresponding route's `beforeLoad` must call `requirePermission(that permission)`. Tests: `app-nav-items.test.ts`, `permission-visibility.test.ts`.
5. **Bookmarked / deep-link preservation.** Redirects must use `search: (prev) => ({...prev, section/view})` to preserve incoming query (e.g. `/invoices?status=overdue` → `/financials?status=overdue&section=collections&view=invoices`). Tests: `legacy-compatibility.test.ts`.
6. **Finance split deferred.** No split of `/financials` into multiple top-level entries in Phase 1. Exposure is progressive-disclosure inside the existing hub.

---

## 4) Deferred Architectural Decisions (explicit — not in Phase 1)

| Decision | Why deferred |
|----------|--------------|
| Split `/financials` into 2–3 top-level finance routes | Needs usage metrics + progressive-disclosure design first |
| Move `people` out of contracts into standalone `/people` | Requires IA migration plan + route masking + nav restructuring in Phase 2 |
| Promote `/lands` to standalone | Same as above + permission implications |
| Promote `/commissions` to standalone module | Needs backend business-semantics verification + nav design |
| Router-native deep-link masking for dialogs (replace event-bus) | Requires TanStack Route masking contract + modal route nesting design |
| Per-user permission grants / notification requests | System is role-based only today; needs backend contract |
| New visual system | Freeze `enterprise/*` — no new usage |

---

## 5) Design-System Inventory (2026-08-09, production pages only)

*Generated by inspection of `rentrix-app/src/components` + `rentrix-app/src/features`.*

| System | Files | Production usage |
|--------|-------|------------------|
| `components/ui/*` | ~38 files (Button, Card, Dialog, DataTable, EntityTable, EntityCard, Select, Input, FilterBar, SectionHeader, TypeState etc.) | Used everywhere |
| `components/layout/*` | 7 files (`page-layout`, `page-header`, `list-page`, `embeddable-workspace`, `entity-detail-header`, `list-controls`, `page-header-actions`) | Used in all primary workspaces |
| `components/enterprise/*` | 26 files, ~4550 lines | **Production usage = 0** outside `features/design-system/showcase`. No feature imports `EnterprisePage/Header/DataTable`. Only tests/docs import it. (Wave 4A shipped, then frozen) |
| Headers in prod | `PageHeader` (all hubs/lists), `SectionHeader` (sections inside hubs), `EntityDetailHeader` (property/contract detail), `EnterpriseHeader` (never in prod) | Consolidate to `PageHeader` + `SectionHeader` + `EntityDetailHeader` — deprecate `EnterpriseHeader` for Phase 2 |

**Hardcoded radius/blur amnesty:** `rounded-[1.5rem]` / `rounded-2xl` appears extensively in `PageHeader`, `Card`, `ListPage`, `FinancialsPage` side nav, `ReportsWorkspace`. `blur-2xl` appears in KPI/metric cards and dashboard hero. No cleanup in Phase 1; inventory only.

**Parallel patterns found:** `ListPage` vs `EmbeddableWorkspace` vs `EnterprisePage` (three page shells, only first two in prod); `DataTable` vs `EntityTable` vs `EnterpriseDataTable`; `FilterBar` vs `ActiveFilterBar` vs `EnterpriseFilters`.

---

## 6) Accessibility Baseline (informational — gates kept, no redesign)

- **Heading hierarchy:** Every page renders one `PageHeader` with `<h1>` (verified in `page-header.test.tsx`, `entity-detail-header` normalized to same scale). Section headers use `SectionHeader` (h2/h3) — not audited for skip levels per page; spot-check needed in Phase 2.
- **Landmarks:** `AppShell` renders `header`, `aside` (sidebar nav), `nav[aria-label]` for primary + mobile nav, `main` inside `PageLayout`. Mobile drawer uses `Dialog` with proper `DialogTitle` hidden but present.
- **Sidebar/mobile semantics:** `NavigationLinks` uses `aria-current="page"` + `data-active`; mobile bottom nav uses same. Select-based mobile hub navs use native `<select aria-label>`.
- **Small text risk:** `text-[11px]` / `text-xs` carries decisive info in: active-filter chips, metric hints (`hint="ضمن الصفحة الحالية"`), collection status badges, integrity warnings. Tooling allows `11px` for dense data — keep but ensure contrast passes in upcoming audit (e.g., `axe-core` on key pages already in `e2e/`).
- **Existing coverage:** `mobile-accessibility-ux.test.ts`, `section-tabs.visual-wave-1.test.tsx`, `app-shell-menu-interactions` etc. already guard touch targets (min 44px).

*No a11y redesign in Phase 1. Baseline pinned for Phase 2 audit.*

---

## 7) Guard Policy

- **Freeze:** No new imports of `enterprise/*` in Phase 2+ (except `src/components/enterprise/*` internals and `features/design-system/*`). Guard: `scripts/check-no-new-enterprise-usage.mjs` (`pnpm run check:enterprise-freeze`).
- **No new parallel visual system.** New pages must compose from `components/ui` + `components/layout` only.
- **Legacy routes are append-only.** Adding a new alias redirect is allowed; removing one is not without a deprecation window.
- **Dialog masking:** New dialogs must file an ADR before using the event-bus path; prefer route `search` param as interim until masking lands.

---

## 8) What validates this foundation

| Check | Command |
|-------|---------|
| Route / nav parity | `vitest run src/app/navigation/route-contract.test.ts src/app/navigation/app-nav-items.test.ts src/app/navigation/route-nav-map.test.ts` |
| Legacy + blank + active-state | `vitest run src/app/navigation/legacy-compatibility.test.ts src/app/router/route-blank-state.test.ts src/app/navigation/navigation-active-state.test.ts` |
| Permission parity | `vitest run src/app/navigation/permission-visibility.test.ts` |
| Finance mounted-hidden | `vitest run src/features/financials/financials-mounted-hidden.test.ts` |
| Design-system inventory | `vitest run src/components/design-system-inventory.test.ts` |
| A11y baseline | `vitest run src/app/accessibility-baseline.test.ts` |
| Enterprise freeze | `node scripts/check-no-new-enterprise-usage.mjs` (+ `.test.mjs`) |
| Typecheck | `pnpm typecheck` |
| Full tests | `pnpm --filter @workspace/rentrix test` |
| Build | `pnpm build` |

---

## 9) Change log

- `2026-08-09` Phase 3: route-native dialogs for People (reference) + Properties/Units/Contracts/Owners via `BackgroundLocationProvider` (`background-location.tsx`), detail routes now check `useBackgroundLocation` → dialog over list (internal) vs full page (direct/refresh/new tab), list controllers now use `navigate({ to: '/.../$id' })` instead of `openEntityPreview`, `detail-preview-contract.test` updated to Phase 3, new `phase3-route-dialog.test.ts` (14 tests) covers internal/direct/back/forward/permissions/no-blank, no `replace:true` hiding, accessibility via `EntityPreviewDialog`, `enterprise/*` freeze still PASS.
- `2026-08-09` Phase 2: promoted `/people` (`PeopleListPage` standalone), `/lands` (`LandsWorkspace` standalone), `/commissions` (`CommissionsWorkspace` standalone) to first-class canonical routes; updated `route-contract.ts`, `route-nav-map.ts`, `app-nav-items.ts` (new groups: الأشخاص والعقارات / المالية / العمولات / التقارير), removed people/lands/commissions from hub children, added hub legacy redirects (`?section=people`→`/people`, `?section=lands`→`/lands`, `?view=commissions`→`/commissions` via `finance/banking` redirect + financials effect), kept all 21→19 redirect routes (people/lands/commissions no longer redirects) + 14 new regression tests; typecheck/build pass.
- `2026-08-09` Phase 1: pinned target IA (الأشخاص/الأراضي/التقارير/العمولات) and deferred finance split + masking + per-user grants. No page redesign. Prior doc status (01/02/03) remains; this file is the Phase-gate reference.
