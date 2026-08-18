# Duplication Register — MALEK Frontend

> **Date:** 2026-08-19  
> **Type:** Read-only static analysis  
> **Scope:** `rentrix-app/src/` (347 tsx + 298 ts files, 474 test files)  
> **Commit:** `75227e17fa16ab63276d7a1d9ce06a7b2dfc5591`

**Decision vocabulary:**  
- **Keep Separate** — legitimate feature-specific code; do not merge  
- **Consolidate** — merge into one canonical owner  
- **Split** — break a large component into distinct responsibilities  
- **Replace** — remove one implementation in favor of another  
- **Remove** — delete dead code

---

## D-001 Money/Date formatting — five overlapping implementations

| | |
|---|---|
| **Concept** | Format money, dates, and numbers for display |
| **Locations** | 1. `src/lib/formatters.ts` (canonical lower-level: `formatMoney`, `formatNumber`, `formatDate`, `formatDateTime`, Latin variants) — 230 lines<br>2. `src/lib/companyFormatters.ts` (thin company-settings wrapper) — 37 lines<br>3. `src/features/financials/components/financials-formatters.ts` (`formatMoney`, `formatDate`, `getErrorMessage`, `formatShortId`) — 31 lines<br>4. `src/features/contracts/contractDisplayFormatters.ts` (`formatContractMoney`, `formatContractDate`, `formatContractDateTime`, `formatContractDayCount`) — 39 lines<br>5. `src/hooks/useCompanyFormatters.ts` (hook version of #2) |
| **Current differences** | #3 re-implements `formatMoney`/`formatDate` with simplified locale logic (no timezone handling); #4 re-implements the company-settings wrapper with a different signature (`CompanySettingsContract` vs `CompanyFormatterSettings`); #5 duplicates #2 as a hook with different return shape |
| **User impact** | Potential inconsistent money/date rendering across screens (e.g. 3dp OMR in contracts vs 2dp in financials) |
| **Maintenance impact** | 5 places to update for any formatting change; drift risk confirmed by prior PR work |
| **Decision** | **Consolidate** → one canonical formatter in `lib/` |
| **Canonical owner** | `lib/companyFormatters.ts` (wrapper) + `lib/formatters.ts` (primitives) |
| **Migration dependencies** | Replace ~25 import sites of `financials-formatters.ts` `formatMoney/formatDate` with `formatCompanyMoney`/`formatCompanyDate`; replace `contractDisplayFormatters.ts` with companyFormatters; move `useCompanyFormatters` to `lib/hooks/`; update tests that assert formatting |
| **Risk** | Medium — formatting is user-visible; contract tests + visual tests protect it |
| **Verification** | `pnpm typecheck`; run all financial + contract + owner test suites; grep for remaining imports of removed modules |

---

## D-002 State surfaces — overlapping loading/empty/error components

| | |
|---|---|
| **Concept** | Rendering loading / empty / error / offline / permission states |
| **Locations** | `components/async-content-state.tsx`, `components/data-error-screen.tsx`, `components/ui/error-state.tsx`, `components/empty-state.tsx` (+ re-export in `components/ui/empty-state.tsx`), `components/page-state-card.tsx` (`PageStateCard` + `WriteErrorCard`), `components/ui/state-surfaces.tsx` (`OfflineState`, `NoPermissionState`), `components/loading-state.tsx` (`RouteLoadingState`), `components/ui/loading-state.tsx` (`LoadingState`) |
| **Current differences** | `RouteLoadingState` is a separate skeleton layout duplicating `LoadingState variant="page"`; `WriteErrorCard` renders a distinct Card style from `ErrorState`; `PageStateCard` is used both for loading and empty; `AsyncContentState` wraps `DataErrorScreen`+`EmptyState`+`RouteLoadingState` in a status-enum façade used by only 2 features |
| **User impact** | Inconsistent state visuals across features (some show skeleton cards, some show PageStateCard text) |
| **Maintenance impact** | 8 files to keep in sync; two loading treatments; two error treatments |
| **Decision** | **Consolidate** |
| **Canonical owner** | `components/ui/` — one `LoadingState` (variants incl. `route`), one `ErrorState` (incl. write-error variant), one `EmptyState`, keep `OfflineState`/`NoPermissionState` |
| **Migration dependencies** | Migrate `RouteLoadingState` usages to `LoadingState variant="route"`; migrate `WriteErrorCard` usages to `ErrorState variant="write"`; migrate `PageStateCard` usages to `EmptyState`/`LoadingState`; delete `AsyncContentState` or reduce it to a thin composed helper; update `components/layout/` usages |
| **Risk** | Low — presentational only, covered by visual tests |
| **Verification** | `pnpm typecheck`; run all `*visual-wave-1*`, `*state-surface*`, browser-ux tests |

---

## D-003 Hub-workspace shells — four copy-pasted structures

| | |
|---|---|
| **Concept** | Workspace shell with permission-gated sections, lazy sub-sections, section search-key routing, AccessDenied handling |
| **Locations** | `features/portfolio-hub/portfolio-hub-workspace.tsx` (135 lines)<br>`features/operations-hub/operations-hub-workspace.tsx` (149 lines)<br>`features/relationships-hub/leasing-hub-workspace.tsx` (131 lines)<br>`features/finance-hub/money-page.tsx` (110 lines) |
| **Current differences** | Each defines its own section-search-key constant (`PORTFOLIO_HUB_SECTION_SEARCH_KEY`, `OPERATIONS_HUB_SECTION_SEARCH_KEY`, …); different default section redirects (portfolio → `.`, operations → `/`); different `AccessDenied` routing; slightly different sub-section ref handling |
| **User impact** | Subtle behavioral drift: selecting "no section" lands on different defaults per hub; deep links may behave differently |
| **Maintenance impact** | A change to section routing must be replicated 4×; the 4th (money-page) already diverges |
| **Decision** | **Consolidate** → extract one shared `EmbeddedWorkspaceShell` |
| **Canonical owner** | `components/layout/embedded-workspace-shell.tsx` (an `EmbeddableWorkspace` wrapper exists at `components/layout/embeddable-workspace.tsx` — reuse it) |
| **Migration dependencies** | Parameterize: sections config (id/label/component/permission), search key name, default redirect, back-to path; migrate 4 hubs one at a time; keep hub-specific section components in their feature dirs |
| **Risk** | Low-Medium — navigation logic change; protected by hub interaction tests |
| **Verification** | Run `portfolio-hub-workspace.test.tsx`, `operations-hub-workspace.test.tsx`, `leasing-hub-workspace.test.tsx`, `finance-hub` tests + browser navigation tests |

---

## D-004 Query-key factories — repeated manual pattern

| | |
|---|---|
| **Concept** | TanStack Query key factory for a domain entity (`all/lists/list/detail`) |
| **Locations** | `features/contracts/useContracts.ts` (`contractKeys`), `features/financials/invoices/useInvoices.ts` (`invoiceKeys`), `features/financials/receipts/useReceipts.ts` (`receiptKeys`), `features/financials/expenses/useExpenses.ts` (`expenseKeys`), `features/financials/payments/usePayments.ts` (imports others), `features/financials/reports/useFinancialReports.ts` (`financialReportKeys`), dashboard page inline key `['dashboard-snapshot', month, year, today]` |
| **Current differences** | Same shape, hand-written; `expenseKeys` omits `lists()` indirection; dashboard has no factory; invalidation sets differ per mutation (see D-005) |
| **User impact** | Indirect — stale-data bugs when a mutation forgets to invalidate the right key set |
| **Maintenance impact** | High — every new entity repeats the pattern; key-name typos are silent until stale data appears |
| **Decision** | **Consolidate** → shared factory helper |
| **Canonical owner** | `src/lib/query-keys.ts` — `defineEntityKeys('invoices')` etc. |
| **Migration dependencies** | Introduce helper; migrate factories one by one; add a `KEY_REGISTRY` map used by a future `invalidateEntity` helper |
| **Risk** | Low — key shapes unchanged if helper produces identical arrays |
| **Verification** | `pnpm typecheck`; run all query-hook test suites; assert key deep-equality in tests |

---

## D-005 Mutation cache invalidation — inconsistent cross-feature coverage

| | |
|---|---|
| **Concept** | After a mutation, invalidate all affected query namespaces |
| **Locations** | `useCreateExpenseAtomic`/`useUpdateExpense` (invalidate `expenseKeys.all` + `financialReportKeys.all`), `usePostPayment` (invalidates `invoiceKeys.all` + `receiptKeys.all` + `financialReportKeys.all`), `useGenerateInvoices` (invalidates `invoiceKeys.all` only), `useCreateContract`/`useUpdateContract` (invalidates `contractKeys.all` only) |
| **Current differences** | Payment invalidates 3 namespaces; contract mutations invalidate only contracts (owner/tenant/property namespaces may go stale); expense mutations don't touch `contractKeys`; dashboard key isn't invalidated anywhere |
| **User impact** | Users see stale dashboard/owner figures after an invoice/contract write |
| **Maintenance impact** | Each new mutation author guesses which keys to invalidate; no regression guard |
| **Decision** | **Consolidate** → one invalidation coordinator (with D-004) |
| **Canonical owner** | `src/lib/query-keys.ts` + `src/lib/invalidate.ts` |
| **Migration dependencies** | Define write→affected-namespace matrix; update each `onSuccess` to call the coordinator; add contract test asserting the matrix |
| **Risk** | Medium — behavior change (cache behavior); mitigable with tests |
| **Verification** | Contract test that spies on `invalidateQueries` calls per mutation; manual stale-data scenario in QA |

---

## D-006 Formatters for status labels — duplicated label maps

| | |
|---|---|
| **Concept** | Status → Arabic label mapping |
| **Locations** | `lib/contractStatus.ts` (contract status labels + casing normalization), `lib/maintenanceStatus.ts`, `features/financials/components/invoice-status-labels.ts` (`invoiceStatusLabels`), `features/financials/components/receipt-formatters.ts` (`receiptStatusLabels`, `paymentMethodLabels`), `features/commissions/components/commissions-view.tsx` (inline `statusLabels`, `typeLabels`), automation `automation.types.ts` (inline labels), `features/leads/*` (inline lead status labels) |
| **Current differences** | Each map is a local `Record<string,string>`; keys differ in casing handling; some normalize legacy values, others don't; commissions and automation define maps inline inside components |
| **User impact** | Inconsistent status wording across screens (e.g. "قيد المراجعة" in commissions vs "قيد المراجعة" in permission dialog — check consistency); missing normalization can render raw DB status |
| **Maintenance impact** | Status vocabulary changes require multi-file edits; no single authority |
| **Decision** | **Keep Separate** for domain-specific statuses (contract/maintenance/invoice legitimately differ) but **Consolidate** the *label maps that share vocabulary* (payment methods, receipt status, generic pending/approved/paid states) |
| **Canonical owner** | `src/lib/status-labels.ts` for shared vocabulary (payment method, generic lifecycle labels); domain-specific maps stay in their feature dirs but move out of component files into `labels.ts` modules |
| **Migration dependencies** | Extract commissions/automation/leads inline maps into feature-level `labels.ts`; align shared vocabulary through one map |
| **Risk** | Low — label-only changes, covered by existing label tests |
| **Verification** | Run all status-label unit tests; grep to assert no inline `statusLabels` remains in component files |

---

## D-007 Permission-denied surfaces — duplicated rendering

| | |
|---|---|
| **Concept** | "You don't have access" UI |
| **Locations** | `components/layout/access-denied.tsx`, `components/ui/state-surfaces.tsx` (`NoPermissionState`), `features/auth/route-guards.ts` (route-level), `features/auth/effective-route-guard.tsx`, `components/layout/permission-request-dialog.tsx` (dialog) |
| **Current differences** | `access-denied.tsx` renders a full-page variant; `NoPermissionState` renders an inline card; guard logic in `route-guards.ts` vs `effective-route-guard.tsx` — two mechanisms |
| **User impact** | Two different visual treatments for the same condition |
| **Maintenance impact** | Two components + two guard implementations to keep consistent |
| **Decision** | **Consolidate** → `NoPermissionState` as the single presentational component; `AccessDenied` becomes a thin wrapper composing it |
| **Canonical owner** | `components/ui/state-surfaces.tsx` |
| **Migration dependencies** | Refactor `AccessDenied` to compose `NoPermissionState`; verify guard behavior unchanged |
| **Risk** | Low |
| **Verification** | Run auth permission tests + browser-ux tests |

---

## D-008 Entity detail header patterns — duplicate page chrome

| | |
|---|---|
| **Concept** | Entity detail page header (title + back + actions) |
| **Locations** | `components/layout/entity-detail-header.tsx` (shared), plus per-feature header markup in `ContractDetailPage`, `owner-dossier-body.tsx`, `property-dossier-content.tsx`, `TenantsPage` detail, `service-provider-detail-page.tsx`, `land-detail` |
| **Current differences** | Some detail pages compose `EntityDetailHeader` + `PageHeader`; others render raw `flex` headers with different spacing/typography; back-button placement varies |
| **User impact** | Dossiers feel like different products |
| **Maintenance impact** | Header styling changes need per-page edits |
| **Decision** | **Consolidate** → one `EntityDetailHeader` used by all dossier pages |
| **Canonical owner** | `components/layout/entity-detail-header.tsx` |
| **Migration dependencies** | Migrate each dossier page one at a time; compare against visual tests |
| **Risk** | Low-Medium |
| **Verification** | `pnpm typecheck`; visual-wave tests; manual browser check on 3 dossier pages |

---

## D-009 Dossier content sections — same data presented differently

| | |
|---|---|
| **Concept** | Owner/property/tenant financial summaries (outstanding balance, open invoices, occupancy) |
| **Locations** | `owner-dossier-body.tsx` (`مستحقات المستأجرين` KPI), `property-dossier-content.tsx` (same KPI pattern), `tenant` dossier, `TenantsPage` summary cards |
| **Current differences** | Nearly identical KPI cards and "فواتير المستأجرين على العقارات" sections re-implemented per entity with different labels |
| **User impact** | Numbers should match but layouts differ slightly |
| **Maintenance impact** | Financial truth changes require editing multiple dossier components |
| **Decision** | **Keep Separate** at component level (each dossier has unique context) but **Consolidate** the shared *financial-summary card* into one `DossierFinancialSummary` component |
| **Canonical owner** | `features/financials/components/dossier-financial-summary.tsx` |
| **Migration dependencies** | Extract; wire into 3 dossiers; assert same values render |
| **Risk** | Medium — financial display; protected by dossier tests |
| **Verification** | `p6b-owner-property-dossier-completion.test.ts`, `p6c-person-tenant-dossier-consistency.test.ts`, `p6-detail-dossiers.test.ts` |

---

## D-010 CSS files — fragmented styling entry points

| | |
|---|---|
| **Concept** | Global stylesheet organization |
| **Locations** | `styles/globals.css` (317), `styles/tokens.css` (456), `styles/product-palette.css` (109), `styles/ux-foundation.css` (246), `styles/page-polish.css` (76), `styles/malek-pro-visual-wave.css` (378) |
| **Current differences** | `tokens.css` declares itself the single source of truth, but `product-palette.css` and `ux-foundation.css` and `page-polish.css` add rules that partially overlap (e.g. `[data-entity-table]` styling in page-polish.css vs component classes); import order matters; drift risk between token values and hard-coded hex/rgb in page-polish.css |
| **User impact** | Subtle styling inconsistencies if rules conflict; specificity fights |
| **Maintenance impact** | Developers must know which file wins; hard-coded colors can bypass tokens |
| **Decision** | **Consolidate** → 3 files: `tokens.css`, `globals.css`, `malek-pro-visual-wave.css` |
| **Canonical owner** | `styles/tokens.css` (all design tokens), `styles/globals.css` (element/base styles), `styles/malek-pro-visual-wave.css` (scoped wave) |
| **Migration dependencies** | Audit each rule in `product-palette.css`/`ux-foundation.css`/`page-polish.css`; move to tokens or component classes; delete duplicates; keep `design-tokens.test.ts`/`ux-foundation.test.ts` green |
| **Risk** | Medium — visual; covered by visual tests |
| **Verification** | `pnpm typecheck`; visual-wave tests; `ux-foundation.test.ts`; browser screenshot comparison |

---

## D-011 Provider tree — re-render churn

| | |
|---|---|
| **Concept** | App-wide providers |
| **Locations** | `app/providers/app-providers.tsx` (`QueryClientProvider` → `AuthProvider` → `CompanyProvider`) |
| **Current differences** | N/A (single location) — listed for the *pattern*: `CompanyProvider` clears query cache (`queryClient.clear()`) and cancels queries inside a context provider; `AuthProvider` and `CompanyProvider` both update on session changes, cascading re-renders of the whole shell |
| **User impact** | Minor perf: full-shell re-render on company switch/logout; cache clear is heavy-handed (drops all memoized data on any membership change) |
| **Maintenance impact** | Hard to reason about which provider owns session vs company vs query state |
| **Decision** | **Split** (in future): move query-cache lifecycle out of `CompanyProvider` into an explicit effect at the app boundary; keep provider order; memoize provider values |
| **Canonical owner** | `app/providers/app-providers.tsx` + `hooks/use-company.tsx` |
| **Migration dependencies** | None immediate; low priority |
| **Risk** | Low-Medium (behavior change risk if cache timing shifts) |
| **Verification** | `use-company.test.tsx` + `use-company-regression.test.ts` |

---

## D-012 Legacy page re-export shims

| | |
|---|---|
| **Concept** | Page re-export barrels to smooth naming migrations |
| **Locations** | `features/contracts/ContractDetailPage.tsx` (re-exports `./pages/ContractDetailPage`), `features/contracts/contracts-page.tsx` (re-exports `ContractsListPage`), `features/governance-hub/governance-hub-page.tsx`, `features/tenants/TenantsPage.tsx` style aliases |
| **Current differences** | Legitimate, single-line re-exports; low risk but add indirection |
| **User impact** | None |
| **Maintenance impact** | Minor indirection; import sites may use old or new path |
| **Decision** | **Keep Separate** (acceptable shims) — optionally clean up later by updating import sites |
| **Canonical owner** | N/A |
| **Migration dependencies** | None |
| **Risk** | None |
| **Verification** | `pnpm typecheck` after any cleanup |

---

## D-013 Empty-state copy drift

| | |
|---|---|
| **Concept** | Empty-list message copy |
| **Locations** | 30+ `EmptyState`/`EntityTable` `emptyTitle`/`emptyDescription` instances across features (properties, contracts, invoices, receipts, expenses, maintenance, utilities, automation, communication, audit, etc.) |
| **Current differences** | Some say "لا توجد X بعد" + next step; others say "لا توجد بيانات" (generic); some lack a next-step action |
| **User impact** | Inconsistent guidance; some empty states are dead ends |
| **Maintenance impact** | Copy change requires many edits |
| **Decision** | **Keep Separate** per feature (copy is contextual) but **Consolidate** the *pattern* via `UX_CONTENT_GUIDE.md` + a lint-style contract test asserting each empty state contains a next-step verb |
| **Canonical owner** | `UX_CONTENT_GUIDE.md` (already created) + optional contract test |
| **Migration dependencies** | Copy edits only |
| **Risk** | Low |
| **Verification** | New contract test greps `emptyDescription` for guidance patterns |

---

## Summary Table

| ID | Decision | Risk | Effort |
|----|----------|------|--------|
| D-001 Formatters | Consolidate | Medium | Medium |
| D-002 State surfaces | Consolidate | Low | Low |
| D-003 Hub shells | Consolidate | Low-Med | Medium |
| D-004 Query keys | Consolidate | Low | Medium |
| D-005 Invalidation | Consolidate | Medium | Medium |
| D-006 Status labels | Keep Separate + consolidate shared vocab | Low | Low |
| D-007 Permission surfaces | Consolidate | Low | Low |
| D-008 Detail headers | Consolidate | Low-Med | Medium |
| D-009 Dossier summaries | Consolidate | Medium | Medium |
| D-010 CSS | Consolidate | Medium | Medium |
| D-011 Provider tree | Split (future) | Low-Med | Low |
| D-012 Re-export shims | Keep Separate | None | — |
| D-013 Empty copy | Keep Separate + contract test | Low | Low |
