# Architecture Migration Status — MALEK Frontend

> **Last updated:** 2026-08-19  
> **Current baseline:** `7bdc0ad9`  
> **Method:** Incremental vertical slices, each with full test coverage

---

## Completed Milestones

### ✅ Milestone 1 — State-surface consolidation
- `RouteLoadingState` → `LoadingState variant="route"`
- `WriteErrorCard` → `ErrorState variant="write"`
- Removed dead CSS rule

### ✅ Milestone 2 — Hub-workspace shell consolidation
- Portfolio hub → `EmbeddableWorkspace`
- Operations hub → `EmbeddableWorkspace`
- Leasing hub → `EmbeddableWorkspace`

### ✅ Milestone 3 — Inline labels extraction
- Commissions: `labels.ts`
- Leads: `labels.ts`
- Lands: `labels.ts`
- Communication: `labels.ts`

### ✅ Milestone 4 — Empty-state content contract test
- Static-analysis test asserts guidance verbs in empty descriptions
- Fixed 5 passive descriptions across audit-log, automation, owner-dossier, reports

### ✅ Milestone 5 — CSS consolidation
- `product-palette.css` merged into `page-polish.css` (6→5 CSS files)

### ✅ Milestone 6 — Query-key factory
- `lib/query-keys.ts` with `defineEntityKeys(name)` helper
- Migrated: contractKeys, invoiceKeys, receiptKeys

### ✅ Milestone 7 — RouteLoadingState removal
- Deleted `components/loading-state.tsx`
- 7 consumers updated to `LoadingState variant="route"`

### ✅ CSS files after consolidation: 5
- `styles/tokens.css` (design tokens)
- `styles/globals.css` (base + imports for tokens + malek-pro)
- `styles/malek-pro-visual-wave.css` (scoped visual wave)
- `styles/page-polish.css` (component-level polish, incl. former product-palette)
- `styles/ux-foundation.css` (page gutters, form scroll, mobile touch)

---

## Remaining Items (lower priority)

| ID | Item | Risk | Notes |
|----|------|------|-------|
| D-005 | Mutation invalidation coordinator | Medium | Could add `invalidateEntity` helper in `lib/query-keys.ts` |
| D-009 | Dossier financial summary consolidation | Medium | Owner/property/tenant dossier KPI overlap — not urgent |
| D-011 | Provider tree optimization | Low | `CompanyProvider` clears query cache — future optimization |
| D-012 | Re-export shim cleanup | None | Legacy page re-exports — cosmetic only |

---

## Architectural Rules (enforced)

1. ✅ All pages use `PageLayout` for the page shell
2. ✅ All pages use `PageHeader` for the page title
3. ✅ All features use `LoadingState`/`EmptyState`/`ErrorState`/`OfflineState`/`NoPermissionState`
4. ✅ All features use `lib/formatters.ts` + `lib/companyFormatters.ts` for formatting
5. ✅ All feature status label maps extracted to `labels.ts`
6. ✅ All hub workspaces use `EmbeddableWorkspace` for the shell
7. ✅ Query keys use `defineEntityKeys()` factory from `lib/query-keys.ts`
8. ✅ Empty-state descriptions contain guidance verbs (enforced by contract test)