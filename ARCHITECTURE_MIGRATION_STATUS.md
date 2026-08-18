# Architecture Migration Status — MALEK Frontend

> **Last updated:** 2026-08-19  
> **Current baseline:** `615f6650bbd5c572fddffd33bfe962125cd0b2fb`  
> **Method:** Incremental vertical slices, each with full test coverage

---

## Migration Milestones

### ✅ Milestone 1 — State-surface consolidation
**Journey:** All pages (loading/empty/error states)  
**Status:** DONE — `99a89a3d`

| Old component | New component | Files changed |
|--------------|--------------|---------------|
| `RouteLoadingState` (standalone) | `LoadingState variant="route"` | 2 |
| `WriteErrorCard` (standalone) | `ErrorState variant="write"` | 2 |
| `[data-page-section]` CSS (dead) | Removed | 1 |

**Tests:** 162 component + state tests ✅  
**Verification:** RouteLoadingState aria-label contract test passes

### ✅ Milestone 2 — Hub-workspace shell consolidation
**Journey:** Portfolio hub, Operations hub, Leasing hub  
**Status:** DONE — `607a7b8d`, `615f6650` (leasing)

| Hub | Old shell | New shell | Embedded mode |
|-----|-----------|-----------|---------------|
| Portfolio | `shell()` function | `EmbeddableWorkspace` | ✅ |
| Operations | `shell()` function | `EmbeddableWorkspace` | ✅ |
| Leasing | `PageLayout`+`PageHeader` | `EmbeddableWorkspace` | ❌ (standalone only) |
| Money (Finance) | `PageLayout`+`PageHeader` + composition | **Not migrated** | N/A (different pattern) |

**Tests:** 23 hub tests ✅  
**Verification:** All 3 hubs render the same shell with `[data-page-layout]` + `[data-page-header]`

### ✅ Milestone 3 (bonus) — Commissions inline labels extraction
**Journey:** Commissions workspace  
**Status:** DONE — `615f6650`

| Old pattern | New pattern |
|-------------|-------------|
| `statusLabels`, `typeLabels`, `statusTone` inline in `commissions-view.tsx` | `features/commissions/labels.ts` |

**Tests:** 25 commission tests ✅

### ✅ Milestone 4 (bonus) — formatShortId fix
**Journey:** Invoices, receipts, receipts-page  
**Status:** DONE — `607a7b8d`

| Old behavior | New behavior |
|-------------|-------------|
| `value ? 'مرجع تجاري غير متاح' : '—'` | `value ? '#ABC12345' : '—'` (truncated UUID) |

---

## Planned Milestones

### ⬜ Milestone 5 — CSS consolidation
**Journey:** All pages (visual foundations)  
**Target:** Merge `product-palette.css` into `tokens.css` or component Tailwind classes  
**Risk:** Medium (test `design-tokens.test.ts` reads `product-palette.css`)  
**Dependencies:** None  
**Estimated effort:** Small

### ⬜ Milestone 6 — Query-key factory + invalidation coordinator
**Journey:** All data-fetching pages  
**Target:** `lib/query-keys.ts` with `defineEntityKeys(name)` helper + `invalidateEntity` matrix  
**Risk:** Low-Medium (key shapes must stay identical)  
**Dependencies:** None  
**Estimated effort:** Medium

### ⬜ Milestone 7 — Dossier header standardization
**Journey:** Tenant dossier, Land dossier  
**Target:** Use `EntityDetailHeader` for tenant and land detail pages  
**Risk:** Low  
**Dependencies:** None  
**Estimated effort:** Small

### ⬜ Milestone 8 — Empty-state copy contract test
**Journey:** All empty states  
**Target:** Contract test asserting `emptyDescription` contains a next-step guidance verb  
**Risk:** Low  
**Dependencies:** None  
**Estimated effort:** Small

### ⬜ Milestone 9 — Obsolete component removal
**Journey:** Codebase cleanup  
**Target:** Remove `RouteLoadingState` re-export (consumers updated), remove unused `PageStateCard` variants  
**Risk:** Low  
**Dependencies:** Milestone 1 (done)  
**Estimated effort:** Small

---

## Remaining Drift by Journey

| Journey | Drift level | Key issues |
|---------|-------------|------------|
| Dashboard | ✅ Low | Uses PageLayout, PageHeader, EntityTable, LoadingState, ErrorState |
| Properties | ✅ Low | Same as above |
| Contracts | ✅ Low | Same |
| Owners | ✅ Low | Same |
| Financials | ✅ Low | Same |
| Maintenance | ✅ Low | Same |
| Reports | ✅ Low | Same |
| Leasing hub | ✅ Migrated | Uses EmbeddableWorkspace |
| Portfolio hub | ✅ Migrated | Uses EmbeddableWorkspace |
| Operations hub | ✅ Migrated | Uses EmbeddableWorkspace |
| Money (Finance) | ⚠️ Medium | Custom composition — different pattern but legitimate |
| Settings | ⚠️ Medium | Separate page tree |
| System | ⚠️ Medium | Separate page tree |
| Audit | ✅ Low | Uses PageLayout + PageHeader |
| Automation | ✅ Low | PageLayout via AutomationWorkspace |
| Communication | ✅ Low | PageLayout via CommunicationWorkspace |
| Commission | ✅ Low | PageLayout via CommissionsWorkspace |

## Architectural Rules (enforced by this document)

1. **No page-level component shall omit `PageLayout`** for the page shell
2. **No page-level component shall omit `PageHeader`** for the page title
3. **No feature component shall re-implement loading/empty/error/offline/permission states** — use `LoadingState`, `EmptyState`, `ErrorState`, `OfflineState`, `NoPermissionState`
4. **No feature component shall re-implement formatting** — use `lib/formatters.ts` + `lib/companyFormatters.ts`
5. **No feature component shall define inline status label maps** — extract to `labels.ts` in the feature directory
6. **No hub workspace shall duplicate the shell pattern** — use `EmbeddableWorkspace` or `EmbeddedWorkspaceShell`