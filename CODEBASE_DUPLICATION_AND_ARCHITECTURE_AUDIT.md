# Codebase Duplication and Architecture Audit — Rentrix

**Date:** 2026-07-12  
**Scope:** Frontend architecture cleanup + documentation/code quality hardening only  
**Branch:** main (merged)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total TypeScript/TSX files | ~452 |
| SonarQube Open Issues | 514 (before fixes) |
| Duplicated Lines | 13.6% (7,764 lines, 213 blocks, 65 files) |
| Test Coverage | 471 tests passing |
| Build Status | ✅ Passing |

---

## 1. Duplicated Files/Components/Hooks/Services

### 1.1 Dashboard Components (PARTIALLY FIXED)

| File | Duplication | Lines | Status | Risk |
|------|-------------|-------|--------|------|
| `rentrix-app/src/app/dashboard-page.tsx` | Inline `ExpiringContractsSection` + `OverdueSection` | ~70 | ✅ **FIXED** — extracted to standalone components | High |
| `rentrix-app/src/app/dashboard/ExpiringContractsSection.tsx` | Standalone component | 71 | Kept as source of truth | — |
| `rentrix-app/src/app/dashboard/OverdueSection.tsx` | Standalone component | 60 | Kept as source of truth | — |
| `rentrix-app/src/app/dashboard/dashboard.utils.ts` | Shared types + builders | 83 | Shared utility (good) | — |

**Details:** `dashboard-page.tsx` previously contained ~140 lines of inline JSX duplicated from the standalone components. Now imports and uses them.

---

### 1.2 Contract Forms (PARTIALLY FIXED)

| File | Duplication | Lines | Status | Risk |
|------|-------------|-------|--------|------|
| `rentrix-app/src/features/contracts/ContractFormPage.tsx` | Full form logic (queries, validation, submission) | ~100 | ✅ **FIXED** — uses `useContractForm` hook | High |
| `rentrix-app/src/features/contracts/contract-form-modal.tsx` | Full form logic (queries, validation, submission) | ~220 | ✅ **FIXED** — uses `useContractForm` hook | High |
| `rentrix-app/src/features/contracts/useContractForm.ts` | **NEW** Shared hook | ~160 | Created | — |

**Details:** Both components had identical:
- React Hook Form setup with zodResolver
- 6 useQuery calls (properties, people, paymentTerms, units, agreementCoverage, contract)
- useWatch for propertyId, startDate, endDate
- useEffect to populate form on edit
- handleSubmit with unit validation and agreement_id resolution
- Mutation hooks (create/update)

**Shared hook now provides:** form, isEdit, submitting, all queries, handleSubmit, selectedProperty, currentLinkedUnitId

---

### 1.3 CRUD Service Layer (HIGH PRIORITY)

| File | Duplication | Lines | Risk | Fix Strategy |
|------|-------------|-------|------|--------------|
| `rentrix-app/src/features/properties/property-service.ts` | Full CRUD + list + pagination | 118 | **High** | Create `createCrudService` factory |
| `rentrix-app/src/features/people/people-service.ts` | Full CRUD + list + pagination | 120 | **High** | Create `createCrudService` factory |
| `rentrix-app/src/features/units/unit-service.ts` | Full CRUD + list + pagination | ~120 | **High** | Create `createCrudService` factory |
| `rentrix-app/src/features/lands/land-service.ts` | Full CRUD + list + pagination | ~100 | **High** | Create `createCrudService` factory |
| `rentrix-app/src/features/leads/leads-service.ts` | Full CRUD + list + pagination | ~100 | **High** | Create `createCrudService` factory |
| `rentrix-app/src/features/maintenance/maintenance-service.ts` | Full CRUD + list + pagination | ~100 | **High** | Create `createCrudService` factory |
| `rentrix-app/src/features/commissions/commission-service.ts` | Full CRUD + list + pagination | ~100 | **High** | Create `createCrudService` factory |

**Pattern Analysis:** All services follow identical structure:
```typescript
// 1. Types: ListParams, PaginatedResult, Entity types
// 2. normalizePayload function
// 3. listEntities(params) — pagination, search, filter, soft-delete filter
// 4. getEntity(id) — single fetch with soft-delete filter
// 5. createEntity(payload) — insert with error handling
// 6. updateEntity(id, payload) — update with error handling
// 7. softDeleteEntity(id) — update deleted_at
```

**Estimated duplication:** ~700 lines across 7 services

---

### 1.4 Generic List Views (HIGH PRIORITY)

| File | Duplication | Lines | Risk | Fix Strategy |
|------|-------------|-------|------|--------------|
| `rentrix-app/src/features/lands/components/lands-view.tsx` | Full CRUD view: KPIs, filters, table, mobile cards, form overlay, confirm dialog | 277 | **High** | Extract `EntityListView` component |
| `rentrix-app/src/features/leads/components/leads-view.tsx` | Full CRUD view: KPIs, filters, table, mobile cards, form overlay, confirm dialog | 282 | **High** | Extract `EntityListView` component |
| `rentrix-app/src/features/contracts/components/contracts-view.tsx` | Similar pattern (if exists) | — | Medium | Extract `EntityListView` component |
| `rentrix-app/src/features/properties/components/properties-view.tsx` | Similar pattern (if exists) | — | Medium | Extract `EntityListView` component |
| `rentrix-app/src/features/units/components/units-view.tsx` | Similar pattern (if exists) | — | Medium | Extract `EntityListView` component |

**Shared structure:**
- PageLayout + PageHeader
- KPI grid (4 cards)
- Filter Card (Input + Select(s))
- Error/WriteErrorCard
- AsyncContentState wrapper
- EntityTable with columns + renderMobileCard
- EntityForm.Overlay for create/edit
- ConfirmDialog for archive
- RowActions (Edit + Archive buttons)

**Estimated duplication:** ~400 lines across 2+ views

---

### 1.5 Contract Service (MEDIUM PRIORITY)

| File | Duplication | Lines | Risk | Fix Strategy |
|------|-------------|-------|------|--------------|
| `rentrix-app/src/features/contracts/services/contractService.ts` | Repeated select strings (`contractSelect`, `contractDetailSelect`) | 34 | **Medium** | Extract to constants |

**Details:**
```typescript
const contractSelect = '*, properties:property_id(id,title,address), units:unit_id(...), people:tenant_id(...)';
const contractDetailSelect = contractSelect + ', renewed_from:renewed_from_id(...)';
```
Used in `listContracts` and `getContract`. Minor but flagged by Sonar.

---

### 1.6 Automation Types (LOW PRIORITY)

| File | Duplication | Lines | Risk | Fix Strategy |
|------|-------------|-------|------|--------------|
| `rentrix-app/src/features/automation/types/automation.types.ts` | Repeated label arrays (TRIGGER_DEFINITIONS, AUDIENCE_DEFINITIONS, CHANNEL_LABELS, etc.) | 70 | **Low** | Already consolidated; verify no further duplication |

**Details:** 343 lines total. Some label arrays could be generated from type unions but current structure is reasonable.

---

### 1.7 Dashboard Utilities (LOW PRIORITY)

| File | Duplication | Lines | Risk | Fix Strategy |
|------|-------------|-------|------|--------------|
| `rentrix-app/src/app/dashboard/dashboard.utils.ts` | Shared with inline functions previously in dashboard-page.tsx | 83 | **Low** | ✅ Already extracted — verify no residual duplication |

---

## 2. Duplicated Business Logic

### 2.1 Financial Calculations

| Function | Locations | Risk |
|----------|-----------|------|
| `formatCompanyMoney` | `lib/companyFormatters.ts` (source), used everywhere | ✅ Centralized |
| `formatCompanyDate` | `lib/companyFormatters.ts` (source), used everywhere | ✅ Centralized |
| `formatCompanyNumber` | `lib/companyFormatters.ts` (source), used everywhere | ✅ Centralized |
| `calculateDaysRemaining` | `dashboard.utils.ts`, previously inline in dashboard-page.tsx | ✅ Centralized |
| `money()` helper | Inline in multiple components (dashboard-page, lands-view, etc.) | **Medium** — create shared `useMoney` hook or utility |

**Finding:** Many components define local `money()` or `area()` helpers that just wrap `formatCompanyMoney`. Should use imported function directly.

---

### 2.2 Validation Schemas

| Schema | Locations | Risk |
|--------|-----------|------|
| `contractSchema` | `contractSchema.ts` (source), used in page + modal | ✅ Centralized |
| `property-schema.ts` | Single source | ✅ Centralized |
| `person-schema.ts` | Single source | ✅ Centralized |
| `lead-schema.ts` | Single source | ✅ Centralized |
| `land-schema.ts` | Single source | ✅ Centralized |

**Finding:** Validation schemas are well-centralized. No duplication found.

---

### 2.3 Permission/Role Checks

| Check | Locations | Risk |
|-------|-----------|------|
| `useAuth` / `usePermissions` | Scattered in components | **Medium** — audit for consistency |
| RLS policy alignment | Services assume RLS; no client-side permission checks | ✅ By design |

---

### 2.4 Supabase Query Patterns

| Pattern | Locations | Risk |
|---------|-----------|------|
| `.is('deleted_at', null)` soft-delete filter | **Every service list/get** | **High** — extract to `withSoftDelete` helper |
| `.order('created_at', { ascending: false })` | **Every service list** | **Medium** — extract to `defaultOrder` helper |
| Pagination `.range(from, to)` | **Every service list** | **High** — part of CRUD factory |
| Search `or('field1.ilike.%term%,field2.ilike.%term%')` | Properties, People, Units, Leads, Lands | **Medium** — extract to `applySearch` helper |

---

## 3. Dead Code Candidates

| File/Export | Reason | Risk |
|-------------|--------|------|
| `rentrix-app/src/app/dashboard-page.tsx` → `buildExpiringContracts`, `buildOverdueTenantRows` | Now re-exported from `dashboard.utils`; inline versions removed | ✅ Cleaned |
| `rentrix-app/src/components/ui/card.tsx` → `CardVariant` unused variants | Only `default` used in codebase | **Low** — verify with grep |
| `rentrix-app/src/lib/utils.ts` → `cn` (className merger) | Used everywhere — keep | — |
| `rentrix-app/src/features/automation/types/automation.types.ts` → `AutomationDispatchKind` | Used? Check consumers | **Low** — verify |
| `.agents/**` | Excluded from Sonar; not in production bundle | ✅ Excluded |

---

## 4. Inconsistent Patterns

| Pattern | Inconsistency | Files Affected | Risk |
|---------|---------------|----------------|------|
| **Query Keys** | Some use `['entity', 'list', params]`, others `['entity', params]`, others flat arrays | All services/hooks | **Medium** — standardize |
| **Error Handling** | Some services throw raw error, others wrap in `getWriteErrorMessage`, some use `handleSupabaseError` | property-service, people-service, contract-service | **Medium** — unify |
| **Type Imports** | Some use `import type`, others inline `type` in import | Mixed | **Low** — enforce `import type` |
| **Component Props** | Some use `interface Props`, others `type Props = Readonly<{...}>` | Mixed | **Low** — standardize on `interface` |
| **Export Style** | Some `export function`, others `export const fn = () =>` | Mixed | **Low** — standardize |
| **Date Formatting** | Some use `formatCompanyDate`, others `toLocaleDateString`, some manual | Mixed | **Medium** — enforce `formatCompanyDate` |

---

## 5. Risk Level Summary

| Category | Risk Level | Effort | Priority |
|----------|------------|--------|----------|
| CRUD Service Factory | **High** | ~4 hours | **P1** |
| Generic EntityListView | **High** | ~3 hours | **P1** |
| Contract Service select constants | **Medium** | ~30 min | **P2** |
| Financial formatting helpers | **Medium** | ~1 hour | **P2** |
| Query key standardization | **Medium** | ~2 hours | **P2** |
| Error handling unification | **Medium** | ~2 hours | **P2** |
| Automation types consolidation | **Low** | ~1 hour | **P3** |
| Dead code removal | **Low** | ~30 min | **P3** |
| Type import standardization | **Low** | ~1 hour | **P3** |

---

## 6. Recommended Fix Order

1. **P1 — CRUD Service Factory** (`lib/services/createCrudService.ts`)
   - Extract common CRUD pattern
   - Refactor 7 services to use factory
   - ~700 lines eliminated

2. **P1 — Generic EntityListView** (`components/layout/EntityListView.tsx`)
   - Extract shared view pattern
   - Refactor LandsView, LeadsView (and others if exist)
   - ~400 lines eliminated

3. **P2 — Contract Service Constants** (`contractService.ts`)
   - Move select strings to module-level constants
   - ~34 lines eliminated

4. **P2 — Financial Formatting Hook** (`hooks/useCompanyFormatters.ts`)
   - Single hook for `money`, `date`, `number` formatting
   - Eliminate inline `money()` helpers

5. **P2 — Query Key Standardization**
   - Define `createQueryKeys` factory
   - Apply to all services/hooks

6. **P2 — Error Handling Unification**
   - Single `handleSupabaseError` utility
   - Apply to all services

7. **P3 — Remaining Cleanups**
   - Automation types
   - Dead code
   - Type import style
   - Component prop style

---

## 7. Files Affected by Planned Changes

### New Files to Create:
- `rentrix-app/src/lib/services/createCrudService.ts`
- `rentrix-app/src/components/layout/EntityListView.tsx`
- `rentrix-app/src/hooks/useCompanyFormatters.ts`
- `rentrix-app/src/lib/queryKeys.ts` (or similar)
- `rentrix-app/src/lib/supabase-error.ts` (if not exists)

### Files to Modify:
- `rentrix-app/src/features/properties/property-service.ts`
- `rentrix-app/src/features/people/people-service.ts`
- `rentrix-app/src/features/units/unit-service.ts`
- `rentrix-app/src/features/lands/land-service.ts`
- `rentrix-app/src/features/leads/leads-service.ts`
- `rentrix-app/src/features/maintenance/maintenance-service.ts`
- `rentrix-app/src/features/commissions/commission-service.ts`
- `rentrix-app/src/features/lands/components/lands-view.tsx`
- `rentrix-app/src/features/leads/components/leads-view.tsx`
- `rentrix-app/src/features/contracts/services/contractService.ts`
- Multiple components using inline `money()` helpers

### Files Already Fixed (Phase 1):
- `rentrix-app/src/app/dashboard-page.tsx` ✅
- `rentrix-app/src/features/contracts/ContractFormPage.tsx` ✅
- `rentrix-app/src/features/contracts/contract-form-modal.tsx` ✅
- `rentrix-app/src/features/contracts/useContractForm.ts` ✅ (new)

---

## 8. Verification Checklist

After each fix:
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes (471 tests)
- [ ] `pnpm build` passes
- [ ] No SonarQube regression
- [ ] UI behavior verified manually for affected pages

---

## 9. Out of Scope (Requires Separate Approval)

- Database migrations
- Supabase schema changes
- RLS policy modifications
- Backend RPC changes
- Production deployment
- E2E test updates (unless UI behavior changes)