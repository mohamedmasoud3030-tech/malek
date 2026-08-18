# Frontend Architecture Audit — MALEK (Rentrix)

> **Date:** 2026-08-19  
> **Type:** Read-only static analysis  
> **Scope:** All 347 `.tsx` + 298 `.ts` source files in `rentrix-app/src/`  
> **Commit:** `75227e17fa16ab63276d7a1d9ce06a7b2dfc5591`

---

## 1. Executive Summary

MALEK is a single-page React application built with TanStack Router, TanStack Query, Tailwind CSS v4, and Supabase. The architecture has been iteratively evolved through many automated agent sessions, resulting in a functionally complete but architecturally fragmented codebase.

**Strengths:**
- Clear route → page → feature decomposition with lazy loading
- Strong shared component layer (`EntityTable`, `EntityForm`, `PageHeader`, `ConfirmDialog`)
- Extensive contract-test coverage (474 test files protecting against drift)
- Single CSS custom-property token file (`styles/tokens.css` → 456 lines)

**Weaknesses:**
- **Redundant formatter layer:** 5+ formatting utilities with overlapping responsibilities
- **Hub-workspace copy-paste:** 4 structurally identical hub shells that drift in redirect logic
- **Multiple state-surface components:** `AsyncContentState`, `DataErrorScreen`, `ErrorState`, `EmptyState` (with re-export), `PageStateCard`, `WriteErrorCard` — overlapping responsibilities
- **Query-hook pattern fragmentation:** each feature defines its own key factory; invalidation is inconsistent
- **CSS file fragmentation:** 6 top-level CSS files (1,582 lines total) with partial duplication
- **Provider layering without memoization:** `AppProviders` → `AuthProvider` → `CompanyProvider` children re-render on any auth state change

---

## 2. Architecture Overview

### Layer Diagram

```
App.tsx
  └─ AppRouterProvider
       └─ RootRoute (CatchBoundary)
            ├─ AuthRoute (login, forgot-password)
            └─ ProtectedRoute (EntityFormVisualProvider + BackgroundLocationProvider)
                 └─ AppShell
                      ├─ Sidebar (NavigationLinks)
                      ├─ Header (sync_status, notifications, QuickAddMenu, AiAssistant)
                      ├─ MobileDrawer
                      └─ <Outlet /> (page content)
```

### Data Flow

```
Route → Page component → useXxxQuery hook → xxService → supabase client → PostgREST/PostgreSQL
                                                    ↕
                                             TanStack Query cache
                                           (staleTime 60s, gcTime 10m)
```

### Key Architectural Numbers

| Metric | Count |
|--------|-------|
| Routes (pages) | ~45 |
| Feature directories | 30 |
| Shared UI components | ~55 |
| Custom hooks (app-level) | 10 |
| Service modules | ~20 |
| Test files | 474 |
| CSS file count | 6 (1,582 lines) |

---

## 3. Router Structure

- **Framework:** TanStack Router v? with file-based conventions
- **Parent routes:** `root` → `auth` + `protected`
- `root` — error boundary, toaster, PWA install prompt, visual viewport CSS
- `auth` — session guard (redirect to /dashboard if logged in)
- `protected` — session guard (redirect to /login if not), wraps `AppShell`
- Each page is lazy-loaded via `lazyRouteComponent(() => import(...))`
- Route `staticData` carries page title used in `<AppShell>` `document.title`

### Route Map (abbreviated)

```
/login
/forgot-password
/reset-password
/dashboard
/properties (→ /properties?section=units, /properties?section=lands, /properties?section=owners)
/properties/new
/properties/$propertyId (→ /, /units, /units/$unitId, /edit)
/contracts (→ ?workspace=tenants|people|leads|communication)
/contracts/new
/contracts/$contractId (/edit)
/financials (→ ?section=collections|expenses|funds|banking)
/maintenance (→ ?section=maintenance|utilities|providers)
/reports
/settings
/owners, /owners/$ownerId (edit)
/tenants, /tenants/$tenantId
/people, /people/$personId (edit, new)
/lands, /lands/$landId
/leads
/units (redirect → /properties?section=units)
/commissions
/communication
/automation
/utilities
/documents-vault
/audit-log
/data-integrity
/system
/change-password
/ai-assistant
/landing
/privacy
/terms
```

---

## 4. Component Layer

### 4.1 Shared UI Components (components/ui/)

Approximately 55 components in the UI primitive library. Key ones:

| Component | Role | Health |
|-----------|------|--------|
| `EntityTable` | Generic data table with mobile card hierarchy, loading/empty/error | ✅ Strong, well-tested |
| `EntityForm` | Generic form with overlay, sections, error summary | ✅ Strong, well-tested |
| `PageHeader` | Page title + actions (back, primary, secondary) | ✅ Used by ~35 feature pages |
| `ConfirmDialog` | Destructive-confirmation dialog | ✅ Good |
| `Dialog` | Wrapper around Radix Dialog | ✅ Good |
| `Card` | Generic card container | ✅ Good |
| `StatusBadge` | Status indicator | ✅ Good |
| `FilterBar` | Filter surface | ✅ Good |
| `ErrorState` | Recoverable error card | ✅ Good |
| `EmptyState` | Empty list state | ✅ Good |
| `LoadingState` | Multiple loading skeleton variants | ✅ Good |
| `DataTable` (alias) | Re-exports EntityTable | ✅ Clean |

### 4.2 State-Surface Inconsistency

There are **6 state surface components** with overlapping contracts:

| Component | Location | When used |
|-----------|----------|-----------|
| `AsyncContentState` | `components/async-content-state.tsx` | Generic loading/error/empty wrapper (2 features) |
| `DataErrorScreen` | `components/data-error-screen.tsx` | Error screen with diagnostics (used by AsyncContentState) |
| `ErrorState` | `components/ui/error-state.tsx` | Recoverable error card (used across features) |
| `EmptyState` | `components/empty-state.tsx` | Empty list (used across features) |
| `PageStateCard` | `components/page-state-card.tsx` | Loading/empty card (6+ ad-hoc uses) |
| `WriteErrorCard` | `components/page-state-card.tsx` | Write failure card |
| `OfflineState` | `components/ui/state-surfaces.tsx` | Offline state |
| `NoPermissionState` | `components/ui/state-surfaces.tsx` | Permission-denied state |

**Recommendation:** Split `PageStateCard` into its two distinct roles (loading vs empty), then unify. `WriteErrorCard` should be a variant of `ErrorState`. `AsyncContentState` should use `ErrorState` and `EmptyState` internally instead of wrapping them with a `status` enum that adds no value over the caller already knowing its query state.

### 4.3 Formatter Layer — Redundant

| File | Lines | Exports | Relationship |
|------|-------|---------|-------------|
| `lib/formatters.ts` | 230 | `formatMoney`, `formatNumber`, `formatDate`, `formatDateTime`, `formatLatinNumber`, `formatLatinDate`, `formatLatinTime` | **Canonical lower-level** |
| `lib/companyFormatters.ts` | 37 | `formatCompanyMoney`, `formatCompanyDate`, `formatCompanyDateTime`, `formatCompanyNumber` | **Thin wrapper** around lib/formatters with company-settings lookup |
| `features/financials/components/financials-formatters.ts` | 31 | `formatMoney`, `formatDate`, `getErrorMessage`, `formatShortId` | **Duplicate** — implements its own `formatMoney` and `formatDate` with simpler locale assumptions |
| `features/financials/components/receipt-formatters.ts` | 51 | `paymentMethodLabels`, `receiptStatusLabels`, `formatReceiptContext`, `formatReceiptNumber` | **Feature-specific** — legitimate |
| `features/contracts/contractDisplayFormatters.ts` | 39 | `formatContractMoney`, `formatContractDate`, `formatContractDateTime`, `formatContractDayCount` | **Duplicate** — wraps company-settings same as `companyFormatters.ts` but with different name |
| `lib/contractStatus.ts` | ~80 | `normalizeContractStatus`, status labels | **Legitimate** — domain normalization |
| `lib/maintenanceStatus.ts` | ~80 | `normalizeMaintenanceStatus`, `normalizeMaintenancePriority` | **Legitimate** — domain normalization |
| `features/financials/components/invoice-status-labels.ts` | ~20 | `invoiceStatusLabels` | **Feature-specific** — legitimate |
| `hooks/useCompanyFormatters.ts` | ~? | `useCompanyFormatters()` hook returning formatters bound to settings | **Duplicates** `companyFormatters.ts` as a hook |

**Impact:** When a developer needs to format money, they can choose among `formatMoney()` from formatters.ts, `formatMoney()` from financials-formatters.ts, `formatContractMoney()`, `formatCompanyMoney()`, or `formatDefaultCompanyMoney()`. These may produce different outputs.

### 4.4 Hub-Workspace Pattern — Copy-Paste Drift

Four hub-workspace components have near-identical structure:

| File | Lines |
|------|-------|
| `features/portfolio-hub/portfolio-hub-workspace.tsx` | 135 |
| `features/operations-hub/operations-hub-workspace.tsx` | 149 |
| `features/relationships-hub/leasing-hub-workspace.tsx` | 131 |
| `features/finance-hub/money-page.tsx` | 110 |

All four:
- Import `Suspense, lazy, useCallback, useMemo, useRef, type ComponentType` from react
- Import `useNavigate, useSearch` from TanStack Router
- Import `AccessDenied` from layout
- Import `PageHeader` from layout
- Define workspace section search keys (different constants per file)
- Use `Suspense` + `lazy()` to load sub-sections
- Manage a `ref` array for section navigation
- Handle `AccessDenied` or permission-blocked sections

**Drift:** Different section-search-key constants, different default redirects when no section is selected, different back-to paths.

### 4.5 Entity Detail Pages — Structure Drift

Comparing `ContractDetailPage`, `OwnerDetailPage` (if exists), `PropertyDossier`, and `TenantPage`:

- Contract detail uses `AsyncContentState` wrapper
- Others use direct `isLoading/isError` branching
- Some use `EntityDetailHeader` component, others don't
- Different tab/wiring patterns for sub-sections

---

## 5. Data Layer

### 5.1 Query Key Patterns

Each feature defines its own key factory:
```
contractKeys = { all: ['contracts'], lists: () => [...], list: (p) => [...], detail: (id) => [...] }
invoiceKeys = { all: ['invoices'], lists: () => [...], list: (p) => [...], paginated: (p) => [...], detail: (id) => [...] }
expenseKeys = { all: ['expenses'], list: (f) => [...] }
receiptKeys = { all: ['receipts'], list: (p) => [...], detail: (id) => [...], pendingVoidRequests: () => [...] }
```

**Pattern is consistent but not formalized** — there's no shared key-factory helper. Each feature manually writes the same factory pattern.

### 5.2 Mutation Invalidation — Inconsistent

| Mutation | Invalidates |
|----------|-------------|
| `useCreateExpenseAtomic` | `expenseKeys.all` + `financialReportKeys.all` |
| `useUpdateExpense` | `expenseKeys.all` + `financialReportKeys.all` |
| `usePostPayment` | `invoiceKeys.all` + `receiptKeys.all` + `financialReportKeys.all` |
| `useGenerateInvoices` | `invoiceKeys.all` |
| `useCreateContract` | `contractKeys.all` |
| `useUpdateContract` | `contractKeys.all` |

Missing: `useUpdateExpense` doesn't invalidate `contractKeys.all` when an expense is linked to a contract. `usePostPayment` doesn't invalidate `dashboardKeys` (if it existed). **No central invalidation coordinator.**

### 5.3 Auth / Session

- `use-auth.tsx` — `AuthProvider` manages `user`, `session`, `authorization`, `login`, `logout`, `refreshPermissions`
- `use-company.tsx` — `CompanyProvider` manages `company`, `activeCompany`, `switchCompany`
- Auth uses Supabase Auth + `app_metadata.company_id` from JWT hook
- Permissions are derived from `authorization` context (role-based + capability-based)

**Issue:** `CompanyProvider` wraps `QueryClientProvider` children, but `QueryClientProvider` wraps `CompanyProvider` in `AppProviders`. The actual nesting order is: `QueryClientProvider` → `AuthProvider` → `CompanyProvider`. The `CompanyProvider` uses `queryClient.cancelQueries()` and `queryClient.clear()`, which is a valid pattern but couples a data-layer concern into a provider.

### 5.4 Services Layer

Services live in two locations:
1. `features/*/services/*.ts` — feature-specific (invoiceService, contractService, expenseService)
2. `services/*.ts` — cross-cutting (auth, pdf, whatsapp, documents)

This split is clean. No duplication found between the two levels.

---

## 6. Store & State

- `store/ui-store.ts` — Zustand store for: sidebar collapse, theme, sync status, last synced timestamp
- No Redux, no Jotai, no Recoil
- `use-company.tsx` — `CompanyProvider` context for active company
- `use-auth.tsx` — `AuthProvider` context for auth state
- `useUnsavedChangesGuard` — hook, not a store

This is lightweight and appropriate.

---

## 7. Architecture Decisions

| Decision | Current State | Assessment |
|----------|---------------|------------|
| Routing | TanStack Router with lazy routes | ✅ Good |
| Data fetching | TanStack Query with key factories | ✅ Good, inconsistent invalidation |
| Forms | EntityForm shared component | ✅ Good, widely adopted |
| Tables | EntityTable shared component | ✅ Good, widely adopted |
| Styling | Tailwind v4 with CSS custom properties | ✅ Good |
| Auth | Supabase Auth + JWT hook | ✅ Good |
| Permissions | Role + capability matrix | ✅ Good |
| State management | React Context + Zustand (minimal) | ✅ Good |

---

## 8. Key Risks

1. **Formatter fragmentation** — 5+ formatting entry points, possible inconsistent outputs
2. **Mutation invalidation gaps** — no cross-feature invalidation contract
3. **Hub-workspace drift** — copy-paste that will diverge further
4. **CSS fragmentation** — 6 CSS files, `page-polish.css` may conflict with token-based styling
5. **Provider re-render churn** — `AuthProvider` wraps `CompanyProvider`, both update context on session state, causing downstream re-renders through `QueryClientProvider` children
6. **No dedicated dashboard query keys** — dashboard snapshot uses ad-hoc key `['dashboard-snapshot', month, year, today]` in the page component, not extracted

---

## 9. Recommendations

### Architecture Direction
**Consolidate toward a single-formatter, single-state-surface, shared-hub-shell architecture** while keeping the existing EntityTable/EntityForm/PageHeader shared components as the foundation.

### Five Highest-Value Consolidation Targets

1. **Formatter unification** (risk: medium, effort: medium)
   - Move `financials-formatters.ts` `formatMoney`/`formatDate` consumers to `lib/companyFormatters.ts`
   - Replace `contractDisplayFormatters.ts` with `companyFormatters.ts` wrappers
   - Remove financials-formatters.ts `formatMoney`/`formatDate`
   - Add `useCompanyFormatters` hook to `lib/hooks/` and deprecate `hooks/useCompanyFormatters.ts`

2. **State-surface consolidation** (risk: low, effort: low)
   - Absorb `WriteErrorCard` into `ErrorState` as `variant="write-error"`
   - Replace `PageStateCard` ad-hoc uses with `LoadingState` or `EmptyState`
   - Merge `RouteLoadingState` into `LoadingState` as `variant="route"`
   - Merge `AsyncContentState` → simplify to use `ErrorState` + `EmptyState` internally, or remove and let callers use `LoadingState`/`ErrorState`/`EmptyState` directly

3. **Hub-workspace extraction** (risk: low, effort: medium)
   - Extract one shared `EmbeddedWorkspaceShell` component from the 4 hub patterns
   - Parameterize: section search key, default redirect, permission-guarded sections, back-to path
   - Migrate portfolio-hub, operations-hub, leasing-hub, finance-hub to use it

4. **CSS consolidation** (risk: low, effort: low)
   - Audit `page-polish.css` — most styles should move to component-level Tailwind classes or `tokens.css`
   - Audit `ux-foundation.css` — move unique rules into `tokens.css` `@theme` block or component classes
   - Target: 3 CSS files (tokens.css, globals.css, malek-pro-visual-wave.css)

5. **Query-key factory helper** (risk: low, effort: medium)
   - Create one `defineEntityKeys(name)` helper in `lib/query-keys.ts`
   - Migrate all feature key factories to it
   - Add a query-key registry for cross-feature invalidation coordination

### Five Strongest Visual Consistency Targets

1. **Page-level spacing consistency** — Some pages use `PageLayout` (standardized spacing), others use ad-hoc `mx-auto max-w-7xl` containers. Audit every route component and enforce `PageLayout` as mandatory.

2. **PageHeader usage** — 10+ workspace pages import PageHeader but vary in title style, description presence, and action positioning. Standardize across all entity workspaces.

3. **Empty state language** — Audit all 30+ empty-state instances for consistent pattern: "لا {شيء} بعد. {الخطوة التالية}."

4. **KPI card grid responsiveness** — Multiple grid-column layouts exist: `sm:grid-cols-2`, `sm:grid-cols-3`, `sm:grid-cols-4`, `desktopColumns=4`, `desktopColumns=6`. Standardize on the `ResponsiveCardGrid` component.

5. **Entity detail page structure** — Contract Detail, Owner Dossier, Property Dossier, Tenant Dossier have different layouts: tab bar vs section blocks vs accordion. Align to one dossier pattern.

### Safest First Implementation Milestone

**Milestone 1 — State-surface and CSS consolidation** (low risk, no behavior change, verifiable by existing tests)

1. Merge `RouteLoadingState` into `LoadingState` as `variant="route"`
2. Make `WriteErrorCard` a variant of `ErrorState`  
3. Audit `page-polish.css` → inline or delete rules covered by component classes
4. Run full typecheck + all 474 test suites to confirm zero regression

This milestone requires zero data-layer changes, zero route changes, and zero feature logic changes. It is verifiable entirely through existing contract tests and visual regression tests.