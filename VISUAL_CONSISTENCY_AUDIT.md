# Visual Consistency Audit — MALEK Frontend

> **Date:** 2026-08-19  
> **Type:** Static code analysis of styles, components, layouts, and page structures  
> **Methods:** CSS token inventory, component class analysis, page-structure comparison, accessibility attribute review  
> **Commit:** `75227e17fa16ab63276d7a1d9ce06a7b2dfc5591`

---

## 1. Design Token System

### Current State

The project uses Tailwind CSS v4 with custom CSS custom properties in `styles/tokens.css` (456 lines).  
The `@theme` directive registers tokens so Tailwind utility classes resolve correctly.

**Light/Dark mode:** Achieved via `:root` (light) and `.dark` (dark) selectors.  
All color tokens use CSS `hsl()` with `--color-*` naming.

**Tokens defined:**
- Typography (font-sans: Cairo, font-mono: monospace)
- Status colors (success, danger, warning, info — each with `-text`, `-bg`, `-border` variants)
- Product accent (primary ramp: 50–900)
- Sidebar ramp (sidebar-accent, sidebar-foreground, sidebar-border)
- Shadow system (shadow-card, shadow-elevated, shadow-sidebar)
- Radius scale (rounded-xl, rounded-2xl)
- Spacing (via Tailwind defaults)
- Animation/motion (duration-200, motion-reduce)

### Token Consistency

| Surface | Token | Hardcoded? | Assessment |
|---------|-------|------------|------------|
| Card border | `border-border/70` | Uses token | ✅ Consistent |
| Page header | `rounded-2xl border border-border/70 bg-card` | Uses tokens | ✅ Consistent |
| Sidebar | `bg-sidebar text-sidebar-foreground` | Uses tokens | ✅ Consistent |
| Error state | `border-danger/25` `bg-danger/5` | Uses tokens | ✅ Consistent |
| Warning notice | `border-[hsl(var(--color-warning-text)/0.25)]` | Computed from token | ⚠️ Inline calc, prefer `border-warning-text/25` |
| Offline state | `bg-warning-bg text-warning` | Uses tokens | ✅ Consistent |
| Primary button | `bg-primary text-primary-foreground` | Uses tokens | ✅ Consistent |
| KPI card | `accent="primary"` (component prop) | Uses tokens | ✅ Consistent |

**Assessment:** Token usage is strong. No evidence of hardcoded colors outside of a few legacy inline `#` or `rgb()` values in page-polish.css which should be migrated.

### CSS File Organization — Fragmented

| File | Lines | Role | OK? |
|------|-------|------|-----|
| `styles/tokens.css` | 456 | Design tokens + `@theme` bridge | ✅ Single source |
| `styles/globals.css` | 317 | Element resets, base styles, font loading | ✅ Needed |
| `styles/product-palette.css` | 109 | Product color ramp | ❌ Merged into tokens.css |
| `styles/ux-foundation.css` | 246 | Layout foundations (grid, flex, spacing) | ❌ Partial duplication with tokens |
| `styles/page-polish.css` | 76 | Component-level overrides | ❌ Should be in component Tailwind classes |
| `styles/malek-pro-visual-wave.css` | 378 | Scoped visual wave | ✅ Feature-scoped, legitimate |

**Recommendation:** Merge `product-palette.css` into `tokens.css`. Audit `ux-foundation.css` and `page-polish.css` — most rules are either covered by Tailwind utilities or should move to `tokens.css` `@theme`.

---

## 2. App Shell & Navigation

### 2.1 Desktop Sidebar
- Fixed right edge, z-30, `bg-sidebar text-sidebar-foreground`
- Collapsed state: `w-[4.5rem]`, expanded: `w-64`
- Clean padding transition (`transition-[padding] duration-200`)
- ✅ Consistent across authenticated routes

### 2.2 Mobile Drawer
- Radix Dialog as drawer, `w-[min(20rem,88vw)] lg:hidden`
- Sidebar-brand header, scrollable nav, permission warning, logout
- 🔍 **Check:** Drawer styles may differ from sidebar (uses `bg-sidebar` but applies via Dialog)

### 2.3 Header Bar
- Sticky top-0, `bg-card/95 backdrop-blur` — consistent glass effect
- Left side: Menu button + Brand + CommandPaletteTrigger
- Right side: SyncStatus + Notifications + QuickAdd + AiAssistant + Theme toggle + User avatar
- ✅ Consistent across all protected routes

### 2.4 Offline Banner
- Full-width notice below header, `bg-warning-bg/12 border-warning` — distinct but harmonious
- ✅ Single implementation in `AppShell`

### 2.5 Write-Access Notice
- Below offline banner, same pattern as offline notice — ✅ consistent

---

## 3. Page Layout & Containers

### 3.1 PageLayout Component Usage

`PageLayout` is the canonical page container offering three sizes:
- `default` → `max-w-7xl`
- `wide` → `max-w-[96rem]`
- `full` → `w-full`

**Adoption:** ~25 pages use `PageLayout`. ~10 full pages do not (audit-log, automation-center, communication-hub, commissions-view, etc.).

**Non-adopters drift:**
- `features/audit/components/audit-log-view.tsx` — uses raw `<Card>` layout
- `features/automation/components/automation-center-view.tsx` — uses raw `<div className="space-y-4 sm:space-y-5">` (similar but not identical to PageLayout spacing)
- `features/communication/components/communication-hub-view.tsx` — same raw spacing
- `features/commissions/components/commissions-view.tsx` — uses `PageHeader` + raw Card, no PageLayout wrapper

**Impact:** Page gutters and max-width vary: pages using PageLayout have `max-w-7xl` constraint; pages using raw containers may fill full width or have different side padding.

### 3.2 PageHeader Adoption

`PageHeader` is the canonical page title surface:
- Card-like border/bg/shadow: `rounded-2xl border border-border/70 bg-card`
- Title (`text-xl font-bold sm:text-2xl`) + optional description + count badge
- Back button + primary action + secondary actions via `PageHeaderActions`

**Adoption:** ~35 feature pages import PageHeader. **All feature-level pages appear to use it.** ✅

**Minor drift in PageHeader usage:**
- Some pages pass `backTo` and `backLabel` — others don't
- Description presence varies (acceptable — contextual)
- Some use `action` prop (deprecated), others use `primaryAction`

### 3.3 EntityDetailHeader

`components/layout/entity-detail-header.tsx` — shared dossier header; used by:
- Contract Detail ✅
- Owner Dossier ✅
- Property Dossier ✅

Not used by Tenant Dossier (TenantsPage uses raw PageHeader + h2).  
This is the dossier vs list-page distinction — legitimate.

---

## 4. Page Content Patterns

### 4.1 List Pages (Properties, Contracts, Owners, Tenants, People)

**Common pattern:**
```
PageLayout
  └─ PageHeader (title + description + actions)
  └─ ListControlSurface (search + filters)  [optional KPI grid above]
  └─ EntityTable (rows + loading/empty/error)
```

✅ This pattern is consistent across: properties, contracts, owners, tenants, people, service-providers.

**Drift:**
- `properties-list-page.tsx` — has KPI summary cards BEFORE the title area (inside card grid) — different from others
- `ContractsListPage` — has `ContractKpiGrid` between header and list controls — similar but positioned differently
- `owners-page.tsx` — uses `OwnerWorkspaceTable` which wraps EntityTable internally

### 4.2 Detail/Dossier Pages (Contract, Owner, Property, Tenant, Provider, Land)

**No single pattern** — each dossier implements its own layout:
- Contract: `AsyncContentState` → Sectioned layout (`ContractOverviewSection`, `ContractTimelineSection`, etc.)
- Owner: PageLayout → KPI grid → filter → OwnerWorkspaceTable + DossierBody
- Property: PageLayout → property header → sub-navigation (units, contracts, etc.)
- Tenant: PageLayout → KPI cards → EntityTable
- Provider: PageLayout → sections similar to owner

**Recommendation:** Standardize dossier page structure: sticky sub-navigation or accordion sections, with KPI summary, then detail sections. The EntityDetailHeader component provides the chrome; the sections should follow a shared `DossierSection` pattern.

### 4.3 Hub/Workspace Pages (Portfolio, Operations, Leasing, Finance)

All 4 follow the same structure:
```
PageHeader (title + back)
Suspense + lazy sections
  └─ Section components
AccessDenied (for permission-blocked sections)
```

✅ Shared structure, but D-003 identifies it as copy-paste with drift.

### 4.4 Dashboard

The dashboard (`DashboardPage`) uses a unique structure:
- HeroBanner → KpiGrid → QuickActions → ExpiringContracts → OverdueSection → ArrearsBreakdown → DashboardCharts → AlertCenter
- Uses `PageLayout` for content wrapper
- ✅ Appropriate for a dashboard — one-of-a-kind layout

### 4.5 Forms

Mutations use `EntityForm` `Overlay`/`Root`/`Section`/`Actions` pattern.

✅ Consistent across: properties, contracts, invoices, receipts, expenses, maintenance, utilities, automation, documents-vault.

**Form overlay style:**
- Same `Dialog` structure, same section header, same action footer
- Same `FieldShell`/`Input`/`Select`/`Textarea` field components
- Validation via `EntityForm.ErrorSummary`

✅ This is the strongest consistent pattern in the app.

---

## 5. EntityTable Mobile Hierarchy

The PR #1497 consolidated column priorities across all registers. ✅  
Every `EntityTable` in the codebase now specifies `priority` for each column and a `mobileVisibleSecondaryKey`.

**Evidence from `interface-register-hierarchy.contract.test.ts`:**
- 28 register files tested, all pass ✅
- `mobileVisibleSecondaryKey` set to the operational datum for each register
- `priority: 'identity'` / `priority: 'primary'` / `priority: 'actions'` present in all

This is a recent improvement and is up-to-date.

---

## 6. Responsive Design

### 6.1 Breakpoints Used
- `sm:` (640px) — tablet
- `md:` (768px) — small laptop
- `lg:` (1024px) — desktop sidebar visible
- `xl:` (1280px) — wide desktop

### 6.2 Mobile Navigation
- Fixed bottom floating control bar with Menu + Search buttons
- `pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]` — safe area ✅
- Mobile drawer replaces sidebar with overlay
- `fixed bottom-0 left-auto right-0 top-0 z-[101] flex h-dvh` — full-height drawer
- ✅ Consistent mobile navigation pattern

### 6.3 EntityTable Mobile Cards
- Cards show identity + primary datum + secondary datum
- Actions accessible via tap (min-h-11 touch targets)
- ✅ Covered by mobile-visual-hierarchy tests

### 6.4 Safe Area Handling
- `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`
- `--visual-viewport-*` CSS variables for mobile keyboard avoidance
- ✅ Present in root component and app shell

### 6.5 Known Issues (from code)

| Issue | Location | Evidence |
|-------|----------|----------|
| Some pages lack `safe-bottom-overlay` | Several feature pages | `safe-top-app` present, `safe-bottom-overlay` absent in `automation-center-view.tsx`, `communication-hub-view.tsx` |
| Floating control bar may overlap content on very short screens | Global | `fixed inset-x-0 bottom-0 z-40` in `MobileFloatingControl` — no dynamic offset for content below it |
| EntityTable horizontal scroll on small mobile | EntityTable | `overflow-x-auto` present; may need `overscroll-contain` for touch scroll |

---

## 7. RTL & Directionality

### 7.1 Direction Handling
- `dir={appLanguage.direction}` on `data-app-shell` div
- `dir="rtl"` hardcoded on login page, empty states, permission dialog
- Directional icons: `rtl:rotate-180` on ArrowLeft, Chevron, LogOut
- `me-*`/`ms-*` (margin-inline-end/start) and `pe-*`/`ps-*` (padding-inline-end/start) used throughout instead of `mr-*`/`ml-*`/`pr-*`/`pl-*`

✅ Strong RTL support. Logical CSS properties consistently used.

### 7.2 Remaining RTL risks
- Some conditionally rendered icons may miss `rtl:rotate-180` class
- The floating control bar uses directional icons for Menu — no rotation needed (Menu is a hamburger)
- Third-party sonner `Toaster` has `position="top-left"` — correct for RTL ✅

---

## 8. Accessibility

### 8.1 Skip Link
- "تخطي إلى المحتوى الرئيسي" — present in `AppShell` ✅
- `sr-only focus:not-sr-only focus:fixed` behavior ✅

### 8.2 ARIA Attributes
- Buttons consistently have `aria-label` ✅
- Dialog titles defined ✅
- `role="status"` / `role="alert"` used on state components ✅
- `aria-busy` on submitting forms ✅
- `aria-invalid` on erroneous inputs ✅
- `aria-describedby` for errors ✅
- `aria-current="page"` on active nav items ✅
- `aria-expanded` on expandable buttons ✅
- `aria-haspopup` on menus ✅

### 8.3 Focus Management
- Mobile drawer restores focus to trigger on close ✅
- Dialog trapping via Radix ✅
- Skip link for keyboard users ✅
- Quick-add menu: ArrowDown/ArrowUp/Home/End/Escape keyboard handling ✅

### 8.4 Touch Targets
- Minimum 44px (min-h-11) touch targets on buttons ✅
- Icon-only buttons: `size-11` minimum ✅
- Mobile card rows: `min-h-[4.5rem]` ✅

### 8.5 Areas for Improvement

| Issue | Location | Severity |
|-------|----------|----------|
| Some icon buttons use Icon as `aria-label` content e.g. `aria-label={sharedLabel('quickAdd')}` — label should describe the outcome | QuickAddMenu | Medium |
| Login error uses `role="alert"` but page title may not update for screen readers | login-page.tsx | Low |
| Toast notifications (sonner) accessibility unclear — sonner positioning and announcements | Global | Low |
| Some `PageStateCard` lacks `role` attribute | page-state-card.tsx | Low |

---

## 9. Typography

- **Font:** Cairo (Cairo, ui-sans-serif, system-ui, sans-serif) — Arabic-first ✅
- **Mono font:** SF Mono, JetBrains Mono — for numbers and code ✅
- **Font weights used:** 400 (normal), 500 (medium), 600 (semibold), 700 (bold), 800 (extrabold), 900 (black)
- **Headings:** Page title `text-xl font-bold sm:text-2xl`, section headings `text-base font-black`
- **Body:** `text-sm` (0.875rem) standard, `text-xs` (0.75rem) for metadata, `text-[0.8125rem]` for descriptions

✅ Consistent typography scale. Font loading via `globals.css` `@font-face`.

---

## 10. Spacing & Rhythm

### Page padding
- `PageLayout` content: `space-y-4 pb-4 sm:space-y-5 sm:pb-6 md:space-y-6 md:pb-8`
- Cards: `p-3 sm:p-5 md:p-6`
- Headers: `px-3 py-3 sm:px-5 sm:py-4 md:px-6 md:py-5`
- Section spacing: consistent `gap-3 sm:gap-4 md:gap-5`

✅ Consistent page rhythm.

### Inconsistent spacing discovered
- `automation-center-view.tsx` uses `space-y-4 sm:space-y-5` (different from PageLayout's `md:space-y-6`)
- `communication-hub-view.tsx` uses `space-y-4 gap-4 sm:space-y-5` (similar drift)
- Some pages use `p-6` without `PageLayout` wrapper

---

## 11. Feedback States

### Loading
- `LoadingState` with variants (page/section/cards/table/inline) — central ✅
- `RouteLoadingState` — separate (should merge into LoadingState)
- `PageStateCard` used as loading in some pages (should use LoadingState)

### Empty
- `EmptyState` with icon, title, description, action — central ✅
- Inline empty text in some pages (e.g. financial-reports-preview-section: "لا توجد بيانات مالية ضمن النطاق الحالي")

### Error
- `ErrorState` with icon, title, description, retry — central ✅
- `DataErrorScreen` — used inside `AsyncContentState`
- `WriteErrorCard` — separate error surface for mutation failures
- Pages that directly render `{isError && <ErrorState />}` pattern: dashboard, properties, contracts, financials
- Pages using `AsyncContentState`: automation, communication

**Drift:** Two error patterns (`ErrorState` vs `DataErrorScreen`) coexist.

### Offline
- Global offline banner in AppShell ✅
- `OfflineState` component available but used only in surface tests

### Permission
- `NoPermissionState` (inline card) + `AccessDenied` (page-level)
- `PermissionRequestDialog` for requesting access

---

## 12. Summary of Visual Consistency Issues

### Severity: High

| # | Issue | Evidence |
|---|-------|----------|
| V-01 | Pages not using PageLayout container have inconsistent max-width + gutters | `audit-log-view.tsx`, `automation-center-view.tsx`, `communication-hub-view.tsx`, `commissions-view.tsx` all use raw containers |
| V-02 | Two error-state visual treatments (`ErrorState` vs `DataErrorScreen` + `AsyncContentState`) | Different icon placement, border treatment, action layout |

### Severity: Medium

| # | Issue | Evidence |
|---|-------|----------|
| V-03 | Dossier page layouts drift — contract/owner/property/tenant all use different section arrangements | Compare `ContractDetailPage` (AsyncContentState + sections) vs `OwnerDossierBody` (KPI grid + tables) vs `PropertyDossierContent` (tabs + cards) |
| V-04 | KPI card grid column counts vary per page (2, 3, 4, 6 columns) | Properties uses 3 columns, financials KPIs use 4 or 6, dashboard uses 4 |
| V-05 | CSS fragmentation — 6 files where 3 suffice; page-polish.css contains component overrides | `page-polish.css` styles `[data-entity-table]` which should be in EntityTable component |

### Severity: Low

| # | Issue | Evidence |
|---|-------|----------|
| V-06 | `RouteLoadingState` standalone component duplicates `LoadingState variant="page"` | Different skeleton shapes, same purpose |
| V-07 | Safe-area classes inconsistent across pages | Some pages have `safe-bottom-overlay`, some don't |
| V-08 | Mobile floating control bar z-index may conflict with drawer overlays | Fixed control at z-40, drawer at z-101; overlay may not cover control |
| V-09 | Some inline hardcoded spacing values (e.g. `p-4`, `p-6`) instead of component-level classes | Page-specific spacing not controlled by PageLayout |
| V-10 | AsyncContentState wrapping adds one more nesting level vs direct `if/else` pattern | Two patterns for state transitions |

---

## 13. Top Visual Consistency Targets

| Priority | Target | Impact |
|----------|--------|--------|
| 1 | Wrap all page-level components in `PageLayout` | Fixes max-width + gutter inconsistency |
| 2 | Consolidate error states into one component | Eliminates two visual treatments for the same semantic state |
| 3 | Standardize dossier page structure (one `DossierShell` component) | Makes contract/owner/property/tenant pages feel like the same product |
| 4 | Audit KPI grid columns → use `ResponsiveCardGrid` everywhere | Consistent card density across breakpoints |
| 5 | Merge page-polish.css rules into component classes | Reduces specificity battles and hardcoded values |