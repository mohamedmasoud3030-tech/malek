# SonarQube Quality Gate Hardening — Rentrix Audit Report

**Date:** 2026-07-12  
**Project:** mohamedmasoud3030-tech_rentrixxx  
**SonarCloud URL:** https://sonarcloud.io/project/overview?id=mohamedmasoud3030-tech_rentrixxx

---

## Executive Summary

| Metric | Current | Target |
|--------|---------|--------|
| Quality Gate | **FAILED** | PASS |
| Open Issues | **514** | 0 |
| Duplicated Lines | **13.6%** (7,764 lines, 213 blocks) | 0% (or justified exclusions) |
| Codebase Size | ~40k LOC | — |

---

## Critical Configuration Issue

**`sonar-project.properties` points to non-existent source directory:**
```properties
sonar.sources=artifacts/rentrix/src,supabase
sonar.tests=artifacts/rentrix/src
```
**Actual source:** `rentrix-app/src/` — `artifacts/rentrix/` does not exist.

This means SonarCloud is either:
- Analyzing no application TypeScript/React code, OR
- Analyzing stale/wrong files

**Fix required:** Update `sonar.sources` and `sonar.tests` to `rentrix-app/src`.

---

## Issue Classification (514 Open Issues)

### By Category (from SonarCloud fetch)

| Category | Count | Severity | Action |
|----------|-------|----------|--------|
| **Code Smells** | ~480 | Minor–Major | Fix (A) / Configure (B) |
| **Bugs** | ~20 | Major–Critical | Fix (A) |
| **Vulnerabilities** | 0 | — | — |
| **Security Hotspots** | 0 | — | — |

### By Rule Pattern (representative sample from 514 issues)

| Rule | Files Affected | Severity | Classification | Proposed Fix |
|------|----------------|----------|----------------|--------------|
| **Unused imports** (eslint/no-unused-vars) | 20+ files | Minor | A — Real code problem | Remove unused imports |
| **Read-only props** (react/readonly-props) | 40+ components | Minor | A — Real code problem | Add `readonly` to props interfaces |
| **Nested ternary** (sonarjs/no-nested-ternary) | 15+ locations | Medium | A — Real code problem | Extract to variable/function |
| **Accessibility: native HTML over ARIA roles** | 10+ components | Medium/Major | A — Real code problem | Replace `role="dialog"` with `<dialog>`, `role="button"` with `<button>`, etc. |
| **Array index as key** (react/no-array-index-key) | 5+ locations | Medium | A — Real code problem | Use stable unique IDs |
| **Type: `any` overrides union** | 3 locations | Minor | A — Real code problem | Fix type definitions |
| **Deprecated `action` prop on form** | 2 locations | Minor | A — Real code problem | Remove deprecated prop |
| **Bash `[[` vs `[`** | 3 files in `.agents/` | Major | **B — Generated/config** | Exclude `.agents/**` from analysis (already in exclusions but still flagged) |
| **Test file: remove ignored test** | 1 file | Medium | A — Real code problem | Remove or fix test |

---

## Duplication Analysis (13.6% = 7,764 lines, 213 blocks, 65 files)

### A. Application Code Duplications (Must Fix — Category C)

| File | Duplication | Lines | Root Cause | Refactor Strategy |
|------|-------------|-------|------------|-------------------|
| `rentrix-app/src/app/dashboard/ExpiringContractsSection.tsx` | 39.4% | 28 | Inline duplicate in `dashboard-page.tsx` | **Extract shared component** — keep standalone, remove inline |
| `rentrix-app/src/app/dashboard/OverdueSection.tsx` | 23.3% | 14 | Inline duplicate in `dashboard-page.tsx` | **Extract shared component** — keep standalone, remove inline |
| `rentrix-app/src/features/contracts/services/contractService.ts` | 25.2% | 34 | Internal repetition of select strings | **Extract constants** for select clauses |
| `rentrix-app/src/features/automation/types/automation.types.ts` | 20.4% | 70 | Repeated label/object definitions | **Consolidate to single source of truth** |
| `rentrix-app/src/features/contracts/ContractFormPage.tsx` | 13.3% | 13 | Shared form logic with `contract-form-modal.tsx` | **Extract shared form hook/component** |
| `rentrix-app/src/features/properties/property-service.ts` | 11.0% | 13 | CRUD pattern duplication with `people-service.ts` | **Create generic CRUD service base** |
| `rentrix-app/src/features/people/people-service.ts` | 10.8% | 13 | CRUD pattern duplication with `property-service.ts` | **Create generic CRUD service base** |
| `rentrix-app/src/app/dashboard-page.tsx` | 7.6% | 42 | Inlines Expiring/Overdue sections | **Use standalone components** |
| `rentrix-app/src/features/contracts/contract-form-modal.tsx` | 5.9% | 13 | Shared form logic with `ContractFormPage.tsx` | **Extract shared form hook/component** |
| `rentrix-app/src/features/lands/components/lands-view.tsx` | 4.7% | 13 | CRUD view pattern duplicated in `leads-view.tsx` | **Extract generic `EntityListView` component** |
| `rentrix-app/src/features/leads/components/leads-view.tsx` | 4.6% | 13 | CRUD view pattern duplicated in `lands-view.tsx` | **Extract generic `EntityListView` component** |

**Total application duplication to fix: ~270 lines across 11 files**

### B. Supabase Migration Duplications (Justified Exclusion — Category B)

| Directory | Files | Duplication | Justification |
|-----------|-------|-------------|---------------|
| `supabase/migrations/` | ~45 | 15–90% | Historical migration history — repeats constraint patterns by design |
| `supabase/migrations_consolidated/` | 5 | 20–88% | Consolidated snapshots of above — same history |

**Current `sonar.cpd.exclusions` covers `supabase/migrations/**` but NOT `supabase/migrations_consolidated/**`**

**Fix:** Add `supabase/migrations_consolidated/**` to `sonar.cpd.exclusions`

---

## Phase 1 — Audit Summary

### Files Requiring Code Fixes (Category A)
1. **Dashboard components** — `ExpiringContractsSection.tsx`, `OverdueSection.tsx`, `dashboard-page.tsx` (inline duplicates)
2. **Contract forms** — `ContractFormPage.tsx`, `contract-form-modal.tsx` (shared form logic)
3. **Service layer** — `property-service.ts`, `people-service.ts` (CRUD boilerplate)
4. **Contract service** — `contractService.ts` (repeated select strings)
5. **Automation types** — `automation.types.ts` (repeated label arrays)
6. **Generic list views** — `lands-view.tsx`, `leads-view.tsx` (CRUD view pattern)

### Files Requiring Sonar Config Updates (Category B)
1. `sonar-project.properties` — Fix `sonar.sources` to `rentrix-app/src`
2. `sonar-project.properties` — Add `supabase/migrations_consolidated/**` to `sonar.cpd.exclusions`
3. `sonar-project.properties` — Ensure `.agents/**` excluded from issues (not just CPD)

### Files Requiring Safe Refactoring (Category C)
All application duplications listed above — refactor to shared utilities/components without behavior change.

---

## Phase 2 — Fix Plan (Application Code)

### Priority 1: Remove Inline Duplicates (Dashboard)
- Delete inline `ExpiringContractsSection` and `OverdueSection` from `dashboard-page.tsx`
- Import and use standalone components from `./dashboard/`

### Priority 2: Extract Shared Contract Form Logic
- Create `useContractForm` hook with shared form setup, validation, queries
- Use in both `ContractFormPage.tsx` and `contract-form-modal.tsx`

### Priority 3: Create Generic CRUD Service Base
- Extract `createCrudService` factory in `services/`
- Refactor `property-service.ts` and `people-service.ts` to use it

### Priority 4: Consolidate Contract Service Selects
- Extract `CONTRACT_SELECT` and `CONTRACT_DETAIL_SELECT` constants
- Use in `listContracts` and `getContract`

### Priority 5: Consolidate Automation Types
- Merge duplicate label/definition arrays
- Use single source of truth for `TRIGGER_DEFINITIONS`, `AUDIENCE_DEFINITIONS`, etc.

### Priority 6: Extract Generic EntityListView
- Create `EntityListView` component with props for columns, actions, KPIs
- Refactor `LandsView` and `LeadsView` to use it

---

## Phase 3 — Database/Supabase Handling

- **Do NOT rewrite** any migration in `supabase/migrations/**` or `supabase/migrations_consolidated/**`
- **Configure exclusion:** Add `supabase/migrations_consolidated/**` to `sonar.cpd.exclusions`
- Verify no application TypeScript code is hidden by exclusions

---

## Phase 4 — Verification Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes (471 tests)
- [ ] `pnpm build` passes
- [ ] SonarCloud analysis shows:
  - [ ] Open Issues = 0
  - [ ] Duplicated Lines = 0% (or only excluded migration files)
  - [ ] Quality Gate = PASS

---

## Production Risk Assessment

| Change Type | Risk | Mitigation |
|-------------|------|------------|
| Remove unused imports | None | No runtime effect |
| Add `readonly` to props | None | TypeScript compile-time only |
| Extract nested ternaries | None | Pure refactor, same logic |
| Replace ARIA roles with native HTML | Low | Improves accessibility, same behavior |
| Replace array index keys with stable IDs | Low | Must verify IDs are stable/unique |
| Extract shared components/hooks | Low | Unit tests cover behavior |
| Generic CRUD service factory | Low | Existing tests validate CRUD ops |
| Sonar config fixes | None | Analysis-only changes |

**Confirmation:** All fixes preserve existing tests and application behavior. No database behavior changes. No migration history rewrites.