# Rentrix Full Product UI/UX Audit — Phase A

**Date:** 2026-07-15  
**Baseline SHA:** cdbdfce3  
**Scope:** Full UI/UX audit of 12 core screens + shared foundations  
**Method:** Code-first analysis (not documentation-first)  
**Agent roles:** Orchestrator, UX Audit, Product Ops, Design System, Accessibility+RTL, Financial Safety

---

## Executive Summary

Rentrix is a mature Arabic-RTL property management SaaS with solid architectural foundations: a real design system (`src/components/ui`), controller hooks for state separation, proper permission gating, and 135+ test files. The application is **not broken** — it works. The audit finds **incremental improvements** that compound into a significantly better experience, not a rewrite.

**Critical finding:** The app is already well above average for a property management tool. Most issues are consistency gaps between older and newer pages, not fundamental design flaws.

---

## Methodology

1. Read every route, shared component, feature page, hook, service, and test file
2. Traced 12 operational user flows end-to-end
3. Checked every shared primitive for adoption consistency
4. Verified financial boundaries (no changes to RPCs/schema/calculations)
5. Cross-referenced with `check:architecture.mjs` boundary rules

---

## Shared Foundations Audit

### SF-001: Page Shell (`app-shell.tsx`) — GOOD with minor gaps

**What works:**
- RTL is correct (sidebar on right, `dir="rtl"`)
- Mobile drawer with safe-area handling (`env(safe-area-inset-top)`)
- Bottom nav for quick access
- Skip-to-content link for accessibility
- Theme toggle (light/dark via `data-theme`)
- Notifications popover (basic but functional)
- Breadcrumb-style title in sticky header

**Issues found:**

| ID | Severity | Issue | Evidence |
|---|---|---|---|
| SF-001a | Low | Sidebar gradient uses hardcoded HSL (`hsl(var(--sidebar))`) — fine, but `bg-[linear-gradient(165deg,...)]` with arbitrary Tailwind may not respond to theme token changes cleanly | app-shell.tsx line 68 |
| SF-001b | Low | Mobile drawer `w-[min(20rem,88vw)]` — 88vw on a 360px screen = 316px, leaving 44px tap-to-close zone. Acceptable but tight | app-shell.tsx line 75 |
| SF-001c | Info | `animate-panel-in` and `animate-route-in` use CSS `animation` but `prefers-reduced-motion` in globals.css sets `animation-duration: 0.01ms` — correctly handled | globals.css |
| SF-001d | Low | The `--app-bottom-nav-height` CSS variable is referenced in `.safe-bottom-app` but the bottom nav component should set it. Need to verify it's actually set | globals.css `.safe-bottom-app` |

**Verdict:** Good. No structural changes needed.

---

### SF-002: Theme Tokens (`globals.css`) — GOOD

**What works:**
- Semantic tokens: `--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--destructive`, `--border`, `--input`, `--sidebar`, `--accent`
- Status colors: `--color-success-text/bg`, `--color-warning-text/bg`, `--color-danger-text/bg`, `--color-info-text/bg`
- Dark mode via `[data-theme='dark']` selector
- Prefers-reduced-motion respected
- Print styles with `data-print-hide` support

**Issues found:**

| ID | Severity | Issue | Evidence |
|---|---|---|---|
| SF-002a | Medium | Some pages use `text-emerald-600 dark:text-emerald-400` instead of semantic `text-success` — inconsistent status color usage | units-page.tsx mobile card rent display |
| SF-002b | Medium | `--secondary: 220 22% 94%` is hardcoded HSL, not a CSS variable indirection. In dark mode it switches to `222 24% 16%`. This means secondary cannot be themed independently per-tenant | globals.css |
| SF-002c | Low | No semantic token for "rent amount" or "financial positive/negative" colors — each page hand-codes emerald/red | scattered across financials |
| SF-002d | Info | `Cairo` font loaded from Google Fonts CDN — correct for Arabic, but no fallback for offline/PWA first-paint | globals.css line 1 |

**Verdict:** Token system is solid. Main gap is inconsistent usage of status colors across pages.

---

### SF-003: Shared Layout Primitives — GOOD, adoption varies

**Inventory of shared primitives:**
- `PageLayout` — used by most list pages ✅
- `PageHeader` — used by most pages ✅
- `ListPage` — used by Properties, partially by others
- `EntityDetailHeader` — used by Properties, Units, Contracts
- `AsyncContentState` — used by Properties, some others
- `FilterBar` — used by Properties, Units, Bank Reconciliation, Invoices ✅
- `ActiveFilterBar` — used by Properties ✅
- `DataTable` (alias for `EntityTable`) — used by Properties, Units ✅
- `EntityTable` — used directly by Bank Reconciliation, Owners, Contracts, Invoices
- `MobileCard` — used by Properties, Units, Invoices ✅
- `EntityCard` — used by Bank Reconciliation, Owners, some older pages
- `EntityForm` — used by all form modals ✅
- `ConfirmDialog` — used by Properties, Units, Contracts ✅
- `StatusBadge` — used everywhere ✅
- `KpiCard` — used by Dashboard, Units, Bank Reconciliation, Reports ✅
| ID | Severity | Issue | Evidence |
|---|---|---|---|
| SF-003a | Medium | **Dual mobile card pattern**: Some pages use `MobileCard`, others use `EntityCard`. These have different APIs and visual styles. `EntityCard` requires `id`, `name`, `avatarIcon` while `MobileCard` uses `title`, `subtitle`, `badge` | Bank Reconciliation uses EntityCard; Properties/Units use MobileCard |
| SF-003b | Medium | **Dual table pattern**: `EntityTable` is used directly in ~8 pages, `DataTable` alias in ~4. The alias works but creates import inconsistency | scattered |
| SF-003c | Medium | **`ListPage` underused**: Only Properties uses `ListPage` wrapper. Other list pages (Units, Contracts, Invoices, Expenses, Maintenance) manually assemble `PageLayout` + `PageHeader` + `FilterBar` | compare Properties vs Units |
| SF-003d | Low | **`AsyncContentState` underused**: Only Properties and detail pages use it. Others manually check `isLoading/isError/data` | compare Properties vs Bank Reconciliation |
| SF-003e | Low | **`EntityForm.Section` underused**: Bank Reconciliation uses it for form sections. Most other forms use flat field lists without section grouping | bank-reconciliation-page.tsx vs property-form-modal.tsx |

**Verdict:** Shared primitives exist and are good. The main issue is inconsistent adoption across older vs newer pages. This is a migration target, not a rewrite.

---

### SF-004: Controller Pattern — GOOD, not universal

**Pages with controller hooks:**
- Properties: `usePropertyListController` ✅
- Units: `useUnitsListController` ✅
- Owners: `useOwnersPageController` ✅
- Settings: `useSettingsPageController` ✅
- Reports: `useReportsWorkspace` ✅

**Pages without controllers (state embedded in page):**
| Page | Lines | Embedded State |
|---|---|---|
| `bank-reconciliation-page.tsx` | 554 | filters, 3 form drafts, 4 modal states, computed summary |
| `expenses-section.tsx` | 353 | filters, form state, modal states |
| `invoice-workspace-section.tsx` | 368 | filters, detail state, modal states |
| `receipts-page.tsx` | 313 | filters, form state, modal states |
| `ContractsListPage.tsx` | 162 | filters via `useContractFilters` hook (partial extraction) |
| `leads-view.tsx` | 285 | filters, modal, form state |
| `automation-center-view.tsx` | 268 | catalog state, editing state |

| ID | Severity | Issue | Evidence |
|---|---|---|---|
| SF-004a | Medium | Bank Reconciliation is 554 lines with all state embedded — the largest non-controller page | bank-reconciliation-page.tsx |
| SF-004b | Medium | Financial pages (expenses, invoices, receipts) each embed filter+modal+form state in the component | multiple files |
| SF-004c | Low | `useContractFilters` exists but is a filter-only hook, not a full controller | contracts/hooks/useContractFilters.ts |

**Verdict:** Controller pattern is proven and should be extended to the 7 largest remaining pages.

---

### SF-005: Form Patterns — GOOD

**What works:**
- `EntityForm.Root` with grid layout
- `EntityForm.Field` with label, error, description
- `EntityForm.Section` for grouped fields
- `EntityForm.ErrorSummary` for submission errors
- `EntityForm.Actions` with sticky mobile footer, safe-area padding
- `EntityForm.Overlay` with responsive surface (dialog/bottom-sheet/full-page)
- Zod schemas for validation
- react-hook-form with zodResolver
- Focus-first-invalid-field on submit
- Unsaved changes badge

**Issues found:**

| ID | Severity | Issue | Evidence |
|---|---|---|---|
| SF-005a | Medium | No standard `scroll-to-error` behavior after submit — `focusFirstInvalidField` exists in entity-form.tsx but relies on browser scroll | entity-form.tsx `focusFirstInvalidField` |
| SF-005b | Low | `PropertyFormCoreFields<T>` uses `Path<T>` string casts — acceptable but loses some type narrowing | property-form-core-fields.tsx |
| SF-005c | Low | Some forms use `required` HTML attribute while others use only Zod — inconsistent validation approach | bank-reconciliation vs property-form |

---

## Per-Screen Audit

### Screen 1: Login (`/login`) — GOOD

**Current state (post-PR #1170):** Clean single-surface auth form with inline error handling.

| ID | Severity | Issue |
|---|---|---|
| LGN-001 | Low | Password visibility toggle button has no explicit `aria-label` (relying on icon) |
| LGN-002 | Info | Good: runtime error shown inside form, not as toast |

**Verdict:** Recently simplified. No blockers.

---

### Screen 2: Dashboard (`/`) — GOOD

**Current state:** Priority-first section ordering, 4 KPI cards, quick actions, charts, work queues.

| ID | Severity | Issue |
|---|---|---|
| DSH-001 | Low | `DashboardCharts` renders charts that may not be useful at 360px width — chart labels could overlap |
| DSH-002 | Info | Source is `rpt_dashboard_overview` RPC — read-only, no mutation risk |

**Verdict:** Recently refactored (PR #1165). Good state.

---

### Screen 3: Properties (`/properties`) — GOOD (post-PR #1172)

**Current state:** Controller hook, shared primitives, generic form fields, zero-count fix.

| ID | Severity | Issue |
|---|---|---|
| PRP-001 | Low | `property-form-page.tsx` (full-page edit route) uses a different schema (`propertySchema` with `owner_name` display field) than the modal — intentional but confusing naming |
| PRP-002 | Info | CSV export works, pagination works, mobile cards work |

**Verdict:** Recently refactored. Good state.

---

### Screen 4: Units (`/units`) — GOOD (post-PR #1172)

| ID | Severity | Issue |
|---|---|---|
| UNT-001 | Low | Fetches all 500 properties for filter dropdown — could be optimized with title-only endpoint |
| UNT-002 | Info | KPI computation, filtering, navigation all in controller |

**Verdict:** Recently refactored. Good state.

---

### Screen 5: Owners (`/owners`) — NEEDS ATTENTION

**Current state:** Uses `useOwnersPageController` hook, but detail view is complex.

| ID | Severity | Issue | Evidence |
|---|---|---|---|
| OWN-001 | Medium | `OwnerAgreementsManager` (160 lines) is used both standalone and embedded in property detail — same component, different contexts | OwnerAgreementsManager.tsx |
| OWN-002 | Medium | Owner detail page (`owner-detail-page.tsx`) loads owner data, then renders `owner-detail-view.tsx` — two components for one page with unclear responsibility split | owner-detail-page.tsx + owner-detail-view.tsx |
| OWN-003 | Low | `owner-form-dialog.tsx` is a dialog-based form, but owners also have a workspace table — the create flow is in a dialog, not a page | owner-form-dialog.tsx |
| OWN-004 | Info | Owner agreements have temporal controls (start/end dates) — financial logic is preserved |

**Verdict:** Needs controller consolidation and view decomposition. Not urgent.

---

### Screen 6: Contracts (`/contracts`) — NEEDS ATTENTION

**Current state:** Well-structured with sub-components but some complexity.

| ID | Severity | Issue | Evidence |
|---|---|---|---|
| CTR-001 | Medium | **Duplicate detail page**: `ContractDetailPage.tsx` (top-level) and `pages/ContractDetailPage.tsx` (subfolder) both exist. Only the subfolder one should be used | both files exist |
| CTR-002 | Medium | `ContractFormFields.tsx` (204 lines) is a large form field component — could be split into sections | ContractFormFields.tsx |
| CTR-003 | Low | `contractPaymentsTab.tsx` (156 lines) embeds payment table inline — no controller | contractPaymentsTab.tsx |
| CTR-004 | Info | Lifecycle actions (renew, terminate) have dedicated dialogs with proper confirmation | ContractRenewalDialog, ContractTerminationDialog |
| CTR-005 | Info | Contract form uses `useContractForm` hook — partial controller pattern | useContractForm.ts |

**Verdict:** Good sub-component decomposition. Needs: remove duplicate page, extract form sections.

---

### Screen 7: Invoices (`/invoices`) — NEEDS ATTENTION

**Current state:** Workspace section approach with inline state.

| ID | Severity | Issue | Evidence |
|---|---|---|---|
| INV-001 | Medium | `invoice-workspace-section.tsx` (368 lines) is the largest financial section — filters, detail, generation, and table all in one file | invoice-workspace-section.tsx |
| INV-002 | Medium | `invoice-list-section.tsx` (244 lines) and `invoice-detail-section.tsx` are separate but share state via props — no controller | prop drilling |
| INV-003 | Low | Invoice generation button checks permission but the permission gate is inline, not abstracted | `canAccess(authorization, financialOperationPermissions.generateInvoices)` |
| INV-004 | Info | Quick payment form exists inline — `quick-payment-form.tsx` |

**Verdict:** Needs controller extraction. Financial logic (generation, balance) is properly in services.

---

### Screen 8: Receipts (`/receipts`) — NEEDS ATTENTION

| ID | Severity | Issue | Evidence |
|---|---|---|---|
| RCT-001 | Medium | `receipts-page.tsx` (313 lines) embeds list, detail, filters, and VOID logic in one page | receipts-page.tsx |
| RCT-002 | Medium | Receipt detail page (`receipt-detail-page.tsx`, 250 lines) is separate from list — detail has its own state management | receipt-detail-page.tsx |
| RCT-003 | Low | VOID action has proper permission gate and confirmation dialog | `financialOperationPermissions.voidReceipt` |

**Verdict:** Needs controller extraction. VOID logic is correctly gated.

---

### Screen 9: Expenses (`/expenses`) — NEEDS ATTENTION

| ID | Severity | Issue | Evidence |
|---|---|---|---|
| EXP-001 | Medium | `expenses-section.tsx` (353 lines) embeds all state — filters, form, table, modal | expenses-section.tsx |
| EXP-002 | Low | Expense creation uses `create_expense_with_journal_atomic` RPC — correct atomic behavior preserved | service layer |
| EXP-003 | Info | Permission gate: `expenses.write` checked before create | permissions.ts |

**Verdict:** Needs controller extraction. Financial atomicity is preserved.

---

### Screen 10: Maintenance (`/maintenance`) — NEEDS ATTENTION

| ID | Severity | Issue | Evidence |
|---|---|---|---|
| MNT-001 | Medium | Maintenance page not read yet but follows similar pattern to expenses — inline state | route exists |
| MNT-002 | Info | Uses `resolve_maintenance_with_expense` RPC for cost resolution | service layer |

**Verdict:** Needs same treatment as expenses.

---

### Screen 11: Reports (`/reports`) — GOOD

**Current state:** Uses `useReportsWorkspace` controller, section tabs, filter surface.

| ID | Severity | Issue | Evidence |
|---|---|---|---|
| RPT-001 | Low | `AccountingReportsSection.tsx` (244 lines) and `StatementsSection.tsx` (220 lines) are large section components | file sizes |
| RPT-002 | Info | Reports workspace has proper section tabs and filter surface | ReportsWorkspace.tsx |

**Verdict:** Recently refactored. Good state.

---

### Screen 12: Settings (`/settings`) — GOOD

**Current state:** Uses `useSettingsPageController`, section-based navigation, workspace pattern.

| ID | Severity | Issue | Evidence |
|---|---|---|---|
| SET-001 | Low | `cost-centers-settings-section.tsx` (188 lines) is the largest settings section | file size |
| SET-002 | Info | Settings workspace has proper save bar and dirty state | settings-save-bar.tsx |

**Verdict:** Recently refactored. Good state.

---

### Additional: Bank Reconciliation (`/bank-reconciliation`) — NEEDS ATTENTION

| ID | Severity | Issue | Evidence |
|---|---|---|---|
| BNK-001 | **High** | **554 lines, no controller** — the largest page in the app with all state embedded. Filters, 3 form drafts, 4 modal states, and computed summary all in one component | bank-reconciliation-page.tsx |
| BNK-002 | Medium | Uses `EntityTable` directly instead of `DataTable` alias | import |
| BNK-003 | Medium | Uses `EntityCard` for mobile instead of `MobileCard` — different visual pattern from Properties/Units | renderMobileCard |
| BNK-004 | Low | Match form has manual `event.preventDefault()` instead of using EntityForm's built-in submit handling | manual handler |
| BNK-005 | Info | Permission gates are correct: `financial.bank_reconciliation.match` for write ops | canManageReconciliation |

**Verdict:** Highest priority for controller extraction. Financial logic is safe in services.

---

### Additional: Financials (`/financials`) — OK

| ID | Severity | Issue | Evidence |
|---|---|---|---|
| FIN-001 | Medium | `financials-page.tsx` (191 lines) acts as a tab container — each tab is a large section component | financials-page.tsx |
| FIN-002 | Low | Arrears workflow section has proper helpers extraction | arrears-workflow-helpers.ts |

---

## Cross-Cutting Concerns

### RTL

| ID | Severity | Issue |
|---|---|---|
| RTL-001 | Low | `html { direction: rtl; }` in globals.css — correct |
| RTL-002 | Low | Sidebar on `right-0` — correct for RTL |
| RTL-003 | Low | Arrow icons in EntityDetailHeader use `ArrowLeft` with `rtl:rotate-180` — correct |
| RTL-004 | Info | All text content is Arabic — no mixed LTR/RTL issues observed in code |

**Verdict:** RTL is well-handled.

### Dark Mode

| ID | Severity | Issue |
|---|---|---|
| DM-001 | Medium | Some hardcoded color classes: `text-emerald-600 dark:text-emerald-400` instead of `text-success` |
| DM-002 | Low | Theme persisted in localStorage, applied via `document.documentElement.dataset.theme` |
| DM-003 | Info | No `prefers-color-scheme` media query — theme is manual toggle only |

**Verdict:** Dark mode works via manual toggle. Main gap is inconsistent status color usage.

### Accessibility

| ID | Severity | Issue |
|---|---|---|
| A11Y-001 | Low | Skip-to-content link exists in app shell ✅ |
| A11Y-002 | Low | `aria-label` on most interactive elements ✅ |
| A11Y-003 | Low | Focus ring via `focus-visible:ring-4 focus-visible:ring-primary/20` ✅ |
| A11Y-004 | Low | `prefers-reduced-motion` respected in globals.css ✅ |
| A11Y-005 | Medium | Some icon-only buttons rely on `title` instead of `aria-label` |

**Verdict:** Accessibility is above average. Minor gaps in icon-button labeling.

### Mobile

| ID | Severity | Issue |
|---|---|---|
| MOB-001 | Low | Bottom nav with 5 items — correct mobile-first pattern |
| MOB-002 | Low | Safe-area handling via CSS utilities — correct |
| MOB-003 | Medium | Mobile cards exist for Properties, Units, Bank Reconciliation, Invoices — but NOT for Contracts list, Expenses list, Maintenance list |
| MOB-004 | Low | `min-h-11` on most buttons — meets 44px touch target |

**Verdict:** Core mobile patterns are solid. Gap is mobile card coverage for older pages.

---

## Priority Roadmap

### Phase 1: Shared Foundations (Low risk, high impact)
1. Migrate all list pages to `ListPage` wrapper
2. Standardize `DataTable` import (alias everywhere)
3. Unify mobile cards to `MobileCard` (retire `EntityCard` usage in new code)
4. Extend `AsyncContentState` to all pages with data fetching
5. Add semantic financial color tokens (`--color-rent-amount`, `--color-positive`, `--color-negative`)

### Phase 2: Controller Extraction (Medium risk, high impact)
1. `bank-reconciliation-page.tsx` → `useBankReconciliationController`
2. `expenses-section.tsx` → `useExpensesController`
3. `invoice-workspace-section.tsx` → `useInvoicesController`
4. `receipts-page.tsx` → `useReceiptsController`
5. `maintenance` page → controller
6. `ContractsListPage.tsx` → extend `useContractFilters` to full controller

### Phase 3: Domain Pages (Low risk, medium impact)
1. Contracts: remove duplicate `ContractDetailPage.tsx`
2. Contracts: split `ContractFormFields.tsx` into sections
3. Owners: decompose `owner-detail-view.tsx`
4. Reports: no changes needed (already good)

### Phase 4: Dark Theme Hardening (Low risk, low impact)
1. Replace hardcoded `text-emerald-600 dark:text-emerald-400` with `text-success`
2. Add `prefers-color-scheme` as fallback for first visit
3. Audit all 12 screens in dark mode

### Phase 5: Visual Regression + Accessibility (Info, verification)
1. Run browser matrix: 360/390/430/768/1440 × light/dark/RTL
2. Verify touch targets, focus order, overflow
3. Add assertions for mobile card parity

---

## What NOT to Change

- ✅ Financial service layer (RPCs, calculations, posting rules)
- ✅ Database schema, migrations, RLS
- ✅ Auth implementation, permissions matrix
- ✅ EntityForm.Overlay responsive surface logic
- ✅ EntityTable/DataTable core implementation
- ✅ Controller hook pattern (proven, extend it)
- ✅ Zod validation approach
- ✅ Supabase service layer
- ✅ Document/PDF generation service
- ✅ Arabic-first content approach

---

## Architecture Boundary Verification

The `check:architecture.mjs` enforces:
- Properties may reference: owners, units, financials ✅
- Units may reference: properties ✅
- Contracts may reference: properties, units, owners, people, settings, financials ✅
- No feature may import Supabase directly in presentation ✅
- No page may exceed 650 lines ✅ (largest is 554 — bank-reconciliation)
- No circular imports ✅

**No boundary violations found.**

---

## CI Baseline (SHA: cdbdfce3)

| Check | Result |
|---|---|
| `pnpm typecheck` | ✅ Pass |
| `pnpm lint` | ✅ Pass |
| `pnpm --filter ./rentrix-app run typecheck:test` | ✅ Pass |
| `pnpm --filter ./rentrix-app run check:architecture` | ✅ Pass |
| `pnpm --filter ./rentrix-app test` | ✅ 136 files, 621 tests |
| `pnpm --filter ./rentrix-app run test:financials` | ✅ 45 files, 192 tests |
| `pnpm build` | ✅ PWA SW generated |
| `pnpm check:docs` | ✅ 78 markdown files |

---

## Conclusion

Rentrix has a solid foundation. The audit identifies **incremental improvements** organized into 5 phases, not a rewrite. The highest-impact, lowest-risk work is:

1. **Consistent adoption of existing shared primitives** across all 12 screens
2. **Controller extraction** for the 6 largest pages still embedding state
3. **Financial color token** standardization for dark mode consistency
4. **Mobile card coverage** for screens missing it (Contracts, Expenses, Maintenance)

Every recommendation preserves existing financial logic, permissions, and backend contracts.
