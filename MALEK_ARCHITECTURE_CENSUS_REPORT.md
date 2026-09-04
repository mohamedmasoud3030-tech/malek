# MALEK — Full Architecture & Codebase Census

**Type:** Architecture census + corrected execution roadmap. No application/source code changes were made; this analysis branch changes the report file only.
**Branches/commits inspected:** application-code baseline `main@5f2b970a5a02ed7d1079299425ede40442534f96`. Analysis branch `arena/01a0690e-malek` is ahead only by report commits; its diff against that baseline is `MALEK_ARCHITECTURE_CENSUS_REPORT.md` only. All source-code claims below refer to the exact main baseline.
**Scope baseline:** `main@5f2b970a5a02ed7d1079299425ede40442534f96` (2026-09-03 23:11 +04:00).

**Evidence convention:** every claim cites an exact file path, exported symbol, route, import, DB object, or doc. Where item-level enumeration of all ~1,200 source files was not individually performed, the relevant cell says `UNKNOWN_NEEDS_REVIEW` rather than asserting a state. Status vocabulary, risk vocabulary, and `IMPLEMENTED_*`/governance-status conventions used in the repo are respected (the repo's own four truth-layers — canonical rule / repository reality / governed credit / runtime — are kept distinct).

> ⚠️ **Scope honesty:** this is a ~1,200-source-file / ~175k-LOC frontend plus a 70-migration Supabase backend. Census tables that require enumerating every route/page/component/hook/DB object are populated to the depth the static tree supports and are explicitly flagged where exhaustive per-item confirmation was not possible in this pass. Nothing is asserted as dead without stating which reachability axes were checked (route tree, lazy import, navigation, barrel export, dynamic import, non-test inbound import).

---

## 1. Executive Summary

MALEK is a large, **Arabic-first (RTL), dark-first property/portfolio management SaaS** for a real-estate office, implemented as a **React 19 + Vite 7 + TanStack Router + TanStack Query + Zustand** SPA (package `@workspace/rentrix` in `rentrix-app/`) on a **Supabase (Postgres + RLS + SECURITY DEFINER RPC + Auth + Storage + 2 Edge Functions)** backend, published via **Vercel** with **PWA/workbox** and a heavy **Playwright E2E + Vitest** harness. Historically branded "Rentrix"; user-visible naming is **MALEK**. Docs/canonical pack live at `docs/source-of-truth/` (the "MALEK Canonical Pack," 8 documents, 77 canonical Rule IDs).

**Headline structural facts:**
- **Monorepo**: pnpm workspace at repo root, single package `rentrix-app/` (plus many repo-level scripts under `scripts/`). `pnpm-workspace.yaml` declares only `rentrix-app`.
- **Routing**: TanStack Router. Route registration and guards are centralized in a single hand-authored `rentrix-app/src/app/router/route-tree.ts` (515 lines) — there is **no file-based route generation**. Nearly all page components are loaded via `lazyRouteComponent`.
- **IA**: Global navigation reduced to **7 sidebar roots** — `/dashboard` (Today), `/properties` (Portfolio), `/contracts` (Leasing), `/financials` (Money), `/maintenance` (Services), `/reports` (Reports), `/settings` (Settings) — with a second "analysis/admin" group. Many legacy/register routes still exist **as redirects into these workspaces** (`REDIRECT_ONLY`).
- **The application contains a large amount of implemented-but-hidden / redirect-only / specialist material** by design (documented in the Target Architecture Lock): Deposits, Automation, Data Integrity, Audit/System, raw accounting/journal surfaces, generic People/Documents-vault are intentionally hidden from routine UX but not deleted.
- **Composition/compatibility seams exist, but they are not competing product authorities by default**: `FinancePage` owns the Money shell and embeds authoritative `features/financials/*` workspaces; `GovernanceHubWorkspace` owns `/settings` and embeds the single `SettingsWorkspace` as its company section; legacy URLs are resolved by the route contract. Treat these as canonical layering unless a specific duplicate implementation is proven.
- **Brand files carry two export spellings of one identity**: `MalekBrandWordmark` (`components/brand/malek-wordmark.tsx`) is used by the authenticated shell, while `MalikBrand`/`MalikMark` (`malik-brand.tsx`, `malik-mark.tsx`) are used on landing/login/public-support/PWA-prompt. Both are **active** — the `Malik`/`Malek` split is cosmetic naming, not dead residue.
- **A visible-vs-canonical authorization split is intentional and documented**: routine UX shows "Office Owner / Employee" personas, while the authoritative backend model is 6 roles (`ADMIN, MANAGER, ACCOUNTANT, OPERATIONS, USER, VIEWER`) resolved into 61 typed `AppPermission` capabilities (verified by counting the `appPermissions` array in `permissions.ts`). Browser UI is never a security boundary.
- **Mobile primary navigation** is a bottom-sheet (dock: menu/notifications/AI) — `mobileNavItems` is intentionally empty (destination model abandoned).
- **State**: One small Zustand store (`ui-store.ts`) + command palette store; React Query for server cache; most per-page state lives in feature hooks and URL search params (section/view/quickAdd).
- **Testing** is unusually deep: 497 in-src Vitest files (the `.test.*`/`.spec.*` set already includes the `.visual-wave-1`, `.pglite`, `.axe` sub-categories) plus 21 Playwright spec files under `rentrix-app/e2e` (with 4 harness support files under `e2e/support/`), plus repo-level SQL migration/RLS/authority scripts.

**Biggest census findings (see §29–§33):**
1. **Money shell/workspace layering is already resolved** — `/financials` is owned by `features/finance/FinancePage.tsx` + `financeShellModel.ts`; it composes authoritative `features/financials/*` workspaces. There are **11 Money compatibility aliases** inside the app-wide 21-entry `REDIRECT_ROUTES` list. This is the documented canonical pattern, not a second Finance authority.
2. **Settings/governance composition is already resolved** — `/settings` renders `GovernanceHubWorkspace`; its `company` section lazily mounts the single `SettingsWorkspace`. `settings-workspace-model.ts` is only a pure summary-tile view-model helper, while `registry/sectionRegistry.ts` is the declarative company-settings section registry. `/system`, `/audit-log`, `/data-integrity`, `/change-password`, `/automation` remain guarded compatibility deep links.
3. **Hidden-but-alive specialist surfaces** confirm the canonical "hidden from routine UX" policy is *implemented*, not just documented.
4. **Compatibility residue**: `/landing`, `/units`, `/utilities`, `/documents-vault`, `/accounting`, legacy `?previewKind=` handling, client role-default permission map, and old register pages retained because they export embedded `*Workspace` components consumed by the Money/Settings shells. (Brand `malik`/`malek` is not residue — both exports are live.)
5. **No file was confirmed dead.** Every candidate examined for "no inbound imports / no route" (e.g. `receipt-detail-page`, `onboarding/`) resolved to an active path once relative imports, lazy route targets, and shell consumers were traced — confirming the census discipline that "no direct feature-path import" is not proof of dead code.

---

## 2. Repository Ground Truth

| Item | Value | Evidence |
|---|---|---|
| Latest `origin/main` SHA | `5f2b970a5a02ed7d1079299425ede40442534f96` (2026-09-03) | `git log origin/main -1` |
| Working branch | `arena/01a0690e-malek` (HEAD == origin/main, clean) | `git status` |
| Package / app root | `rentrix-app/` (package `@workspace/rentrix`, `type: module`) | `rentrix-app/package.json` |
| Workspace root | pnpm monorepo root (`pnpm@10.11.1` enforced) | `package.json` engines; `.npmrc` |
| Framework / runtime | React 19.1.0, Vite 7.3.2, TypeScript ~5.9 | `rentrix-app/package.json`, `pnpm-workspace.yaml` catalog |
| Routing system | TanStack Router (`@tanstack/react-router` 1.139.3) | `rentrix-app/src/app/router/{app-router.tsx,route-tree.ts}` |
| Query/cache | TanStack React Query v5 | `src/app/providers/query-client.ts`, `src/lib/query-keys.ts`, `src/lib/data/query-keys.ts` |
| State stores | Zustand 5 (`ui-store.ts`; `command-palette-store`) | `src/store/ui-store.ts`; UI store provider |
| Forms | react-hook-form + zod + zodResolver | catalog deps + `src/components/ui/entity-form.tsx`, `use-crud-form-state.ts` |
| Styling | Tailwind CSS v4 + PostCSS, `components.json` (shadcn-style) | `postcss.config.js`, `rentrix-app/components.json` |
| Data access | Feature services/hooks → Supabase `.from/RPC` via `src/lib/supabase.ts` | evidence below §14 |
| Auth architecture | Supabase Auth sessions; route-level `beforeLoad` guards; office personas over 6-role backend | `route-tree.ts`, `route-guards.ts`, `permissions.ts` |
| Authorization | 61 capability perms, 6 roles, effective-permission loading | `src/features/auth/{permissions.ts,effective-permissions.ts}` |
| DB integration | Supabase Postgres + generated types `src/types/database.ts` | `@supabase/supabase-js`, types |
| RLS / RPC | Extensive SECURITY DEFINER RPC + RLS migration surface (70 `.sql` migrations) | `supabase/migrations/`, `DATABASE_RULES.md` |
| Edge Functions | `ai-assistant`, `background-worker` (+ `_shared/*`) | `supabase/functions/**` |
| Major shared UI/runtime primitives | `components/ui/*` (DataTable/EntityTable, PageHeader, PageLayout, dialogs, entity-preview-dialog, forms, bottom-sheet, filters, export-menu…), `components/layout/list-page`, `components/documents/contextual-documents-panel`, services/documents renderer | §8 |
| Governance / SoT docs | `docs/source-of-truth/00_INDEX.md`…`08_CLOSEOUT…`; `governance/*`; `CLAUDE.md`/`AGENTS.md`/`DATABASE_RULES.md` | — |
| PWA | `vite-plugin-pwa`, manual `prompt` registration in `src/lib/pwa-update.ts`, install in `pwa-install.ts`, prompt UI `components/layout/pwa-install-prompt.tsx` | `rentrix-app/vite.config.ts` |
| Deploy | Vercel (`vercel.json`), Supabase hosted | `rentrix-app/vercel.json` |
| Branding | user-visible **MALEK**; internal/historical **Rentrix** + **LENA** ecosystem cues; brand exports split across `MalekBrandWordmark` (shell) and `MalikBrand`/`MalikMark` (public/auth/PWA) — same visual identity, two spellings | `lib/brand.ts`, `components/brand/*`, docs |

**Documentation authority (respecting governance):** Per `docs/source-of-truth/00_INDEX.md`, canonical truth layers are ordered: canonical pack rules → locked decisions → current implementation (for describing present reality) → ADRs/runbooks → superseded docs. `CLAUDE.md`/`AGENTS.md` explicitly instruct **not** to let docs override runtime/implementation reality and to record `CONFLICT`/`PARTIAL`. This report therefore reports implementation as authoritative for "what exists today" and flags doc-vs-code disagreements (§29).

---

## 3. Architecture Map

Dependency direction target (from `docs/source-of-truth/05_*`):
`UI → workflow/hooks → domain rules/read models → data access/services → Supabase RPC/RLS/Postgres`.

| # | Layer | Physical paths | Responsibility | Public entry points | Depends on | Domain ownership | Canonical? | Alternatives / duplicates |
|---|---|---|---|---|---|---|---|---|
| 1 | App shell | `src/app/layout/app-shell.tsx`, `layout-navigation-view.tsx`, `notifications-menu.tsx`, `app-shell-header*` | Auth'd desktop sidebar + mobile bottom-sheet/dock, header, theme | mounted by `ProtectedRouteComponent` (`routes/_protected.tsx`) | `use-auth`, `useUiStore`, brand, router, command-palette, AI global action | Shared/Office | CANONICAL | — |
| 2 | Root providers | `src/app/providers/*` (AppProviders, query-client) | Compose QueryClient + auth context + feature providers | `RootRouteComponent` (`routes/__root.tsx`) | lib/supabase | Shared | CANONICAL | — |
| 3 | Routing | `src/app/router/*`, `src/routes/*` | Registration, guards, lazy pages, redirects, legacy preview redirect | `app-router.tsx` → `RouterProvider` | route-tree, pages | Shared | CANONICAL | — |
| 4 | Navigation contract | `src/app/navigation/{route-contract.ts,route-nav-map.ts,app-nav-items.ts,terminology-registry.ts}` | Single IA authority + guards | imported by tests & shell | permissions | Shared | CANONICAL (route-contract) | app-nav-items + route-nav-map overlap; terminology-registry extra |
| 5 | Authn | `src/features/auth/*` (login-page, password-recovery, auth-service, use-auth, route-guards) | Sign-in, recovery, session context | pages, guards | lib/supabase | Auth | CANONICAL | — |
| 6 | Authz | `src/features/auth/{permissions.ts,effective-permissions.ts,route-guards.ts,permission-request*}` | 6-role→61-perm model, effective grants, request/review lifecycle | consumed app-wide | — | Auth/Governance | CANONICAL (UI mirror; DB is authority) | `mock-role-simulator.ts`, granular-* test mirrors |
| 7 | Data access | `src/lib/supabase.ts`; per-feature `*Service.ts`, `*Service/` under `src/services/` | All Supabase/DB reads/writes + RPC calls | feature hooks | types/database | Feature | CANONICAL | see §14 for duplicates |
| 8 | Query cache | `src/lib/query-keys.ts`, `src/lib/data/query-keys.ts`, providers/query-client | Cache invalidation | hooks | React Query | Shared | CANONICAL candidate = `lib/query-keys.ts` | small helper overlap: richer root factory/invalidation utility is used broadly; list-only `lib/data/query-keys.ts` is used by Lands/Leads (§23) |
| 9 | Shared UI primitives | `src/components/ui/*` (68 files incl. tests) | buttons, cards, table/data-table/entity-table, dialog, bottom-sheet, form, filter, status-badge, export-menu, primitives | `src/components/ui/index.ts` barrel | lib/utils, cva | Shared | CANONICAL | see §23 for competing lists/tables |
| 10 | Shared layout components | `src/components/layout/*` | PageHeader/PageLayout/ListPage, access-denied, embeddable-workspace, register-summary, pwa-install-prompt, permission-request-dialog | features | ui | Shared | CANONICAL | register-summary vs per-feature summaries |
| 11 | Domain model | `src/domain/types.ts`, `src/types/{domain.ts,database.ts}`; feature `domain/`, `schemas/`, `services/` | types, zod schemas, business rules | many | — | Cross | PARTIAL (types split) | per-feature schema files duplicate entity shapes |
| 12 | Document/print/export engine | `src/services/documents/*` (DocumentController, DocumentEngine, renderer/, specifications/) | PDF/HTML/report rendering, contextual docs, company identity, payload adapters | feature documents code | jspdf/html2canvas, storage | Documents (Shared) | CANONICAL | legacyPayloadAdapters/compatibility types (COMPATIBILITY) |
| 13 | Reporting | `src/features/reports/**` (113 files) + `features/accounting/reports/**` + `financials/reports/**` | report catalog/workspace UI + canonical accounting read boundary + operational/subledger report facade | `/reports`, `/reports/$reportId` | accounting facade, financial report modules, documents | Reports/Accounting | CANONICAL layering: `features/reports` UI, `accountingReportsFacade` accounting authority, `financialReportsService` facade/domain exports; not three competing authorities (§23) |
| 14 | Money workspace | `src/features/finance/*` + `src/features/financials/**` (165 files) | invoices, receipts, arrears, expenses, deposits, owner settlements, bank reconciliation, fixed-monthly accruals, commissions | `/financials` shell | financial service layer | Financials | CANONICAL shell | standalone register routes (REDIRECT_ONLY) |
| 15 | Settings / governance | `src/features/governance-hub/*`, `src/features/settings/**`, `src/features/system/**`, `src/features/audit/**` | governance hub + company settings workspace/registry + users/roles/permissions + specialist admin surfaces | `/settings`, deep links | settings registry, permissions | Governance/Settings | CANONICAL composition: hub owns route; `SettingsWorkspace` owns company subsection | no second settings workspace; specialist pages remain guarded/deep-linkable |
| 16 | AI assistant | `src/features/ai-assistant/**` (36 files) incl. `services/`, `speech/` | global read/explain/suggest/navigate/draft assistant, TTS/voice | AI page `/ai-assistant`, global action, dock | edge fn `ai-assistant`, guardrails | AI | CANONICAL | copilot surfaces + page + speech |
| 17 | PWA / notifications / background | `src/lib/pwa-*.ts`, notifications-menu, `app-notifications-service.ts`; Edge fn `background-worker` | SW/update lifecycle, install, app notifications | shell/root | workbox | Runtime | CANONICAL (PWA) | notif menu vs in-page notification settings |
| 18 | Tenant/Owner portals | `src/features/tenant-portal/*`, `src/features/owner-portal/*` | constrained read-only external surfaces | `/tenant-portal`, `/owner-portal` (root, outside auth shell) | server snapshot RPCs | External/Portals | CANONICAL | `features/tenants/tenant-portal-admin-service.ts` links portal perms |
| 19 | Testing | in-`src` Vitest (497 files) + `e2e/*.spec.ts` (21) + repo scripts | unit/integration/contract/guard/E2E | CI/package scripts | vitest/playwright/axe | Shared | CANONICAL | see §21 |
| 20 | DB contracts | `supabase/migrations/*.sql` (70 + README + `rls_per_table`), `DATABASE_RULES.md`, `governance/*` | schema/RLS/RPC/functions, canonical authority, migration hygiene | server + service layer | — | Backend | CANONICAL | `db0`/`guardian`/`wp05` alternate audit systems (§23) |

---

## 4. Domain Matrix

"Ownership" means the feature folder / navigation root that owns the domain task. Many entities physically live under several feature folders (§27 highlights leakage). Status: ACTIVE unless noted.

| Domain | Routes (primary) | Pages/Screens (owners) | Shared primitives | Data layer | Permissions | Dialogs/Previews | Tests present | Status / notes |
|---|---|---|---|---|---|---|---|---|
| Dashboard / Today | `/dashboard` | `features/dashboard/dashboard-page.tsx` | KPI-card, cards, entity-card | `dashboard-snapshot.ts`, signals, services | `app.dashboard.view` (default) | previews via detail links | many (`*-signal.test.ts`, daily-collection) | ACTIVE; canonical label اليوم |
| Properties/Portfolio | `/properties…`, `/properties/$propertyId{/,/units,/units/$unitId,/edit}` | `features/portfolio-hub/portfolio-hub-workspace`, `features/properties/{property-form-page,property-detail-page}`, overview, units | entity-table, filters, page-header | `property-workspace-service.ts` (src/services) | `properties.view/create/edit` | unit/contract previews | yes | ACTIVE |
| Lands | `/lands`, `/lands/$landId` | `features/lands/lands-page.tsx`, `routes/_protected.lands.$landId` | entity-table/lands-view | lands services | `lands.view` | land dossier | yes | ACTIVE (Phase2 standalone) |
| Owners | `/owners…`, `/owners/$ownerId{/edit}` | `features/owners/**` (54 files incl OwnerSettlementWorkspace) | entity-table, dossier, status-badge | owner-workspace-service, owner-settlements-service | `owners.hub.view`, `owners.detail.view`; settlement perms | preview dialog, settlement workspace | extensive | ACTIVE |
| People directory | `/people…` | `features/people/people-list-page`, PersonDossier | entity-table | people service | `contracts.*` (reuse) | person dossier/dialog | yes | ACTIVE; canonical identity underneath |
| Tenants | `/tenants…` | `features/tenants/TenantsPage`, `features/tenants/components/TenantPreviewDialog.tsx` (exports `TenantDetailPage` page + `TenantDossierContent` + `TenantPreviewDialog`) | entity-table | tenantWorkspaceService / useTenantDossier | `contracts.view` | tenant dossier page + preview dialog share `TenantDossierContent` | yes | ACTIVE; dossier content is shared between the page and the preview dialog (§29) |
| Contracts/Leasing | `/contracts…` | `features/relationships-hub/leasing-hub-workspace`, `features/contracts/**` (78 files) | entity-table(ContractTable), contract-form-modal, schedule-preview | contract services/hooks, RPC (terminate, soft-delete, one-live-draft) | `contracts.view/create/edit/approve/cancel` | contract-form-modal, schedule preview, documents | very heavy | ACTIVE |
| Financials (Money) | `/financials` (shell) | `features/finance/FinancePage.tsx` mounting `financials/*` workspaces | entity-table, filter-bar, form | financial service layer, RPCs | finance workspace + granular (see list) | receipt detail, invoice detail | heavy | ACTIVE CANONICAL shell |
| Invoices | shell view `collections/invoices` + `/invoices`(redirect) | `financials/invoices/invoices-page` (InvoicesWorkspace), invoice-list-section | data-table | invoiceService.ts | `financial.invoices.generate/export` | invoice detail section | yes | ACTIVE via shell; standalone route REDIRECT_ONLY |
| Receipts | `receipts` view + `/receipts`(only w/ receiptId) | `financials/receipts/receipts-page` (ReceiptsWorkspace) | data-table | receiptService.ts | payments.create / receipts.void | receipt-detail-card (embedded) + ReceiptDetailPage (standalone `/receipts?receiptId=`) | yes | ACTIVE via shell + deep-link detail page |
| Payments/Collections | `quickAdd=collect`, quick-payment-form | `financials/payments/*`, `financials/components/quick-payment-form` | form | paymentService.ts | `financial.payments.create` | — | paymentService.test | ACTIVE |
| Expenses | shell `expenses` view | `financials/expenses/*`, expenses-section | data-table | expenseService.ts, operational-expenses | `expenses.view/write` | expense-actions | yes | ACTIVE |
| Arrears | shell `collections/arrears` | `financials/arrears/*`, overdue-invoices-table | data-table | arrears-service | `arrears.view` | — | yes | ACTIVE |
| Deposits | shell `funds/deposits` (view) | `financials/deposits/*`, deposits-workspace | data-table | deposit-service | `financial.deposits.view` | deposit-action-forms, voucher doc | yes | ACTIVE — a permission-gated view inside the Money `funds` primary section; has no global-nav root (not ACTIVE_HIDDEN) |
| Owner settlements | shell `funds/owner_settlements` | `owners/owner-settlements-page`, `owners/components/OwnerSettlementWorkspace` | data-table | owner-settlements-service | `financial.owner_settlements.*` approve/pay | request binding | yes | ACTIVE |
| Fixed monthly accruals (fees) | shell `fees/fixed_monthly_accruals` (view) | `financials/fixed-monthly-accruals/*` | data-table | accrual-service | view/execute/reverse | — | — | ACTIVE — a permission-gated view in the Money `fees` primary section |
| Commissions | `/commissions` | `features/commissions/*` | data-table/commissions-view | commissions services | `commissions.view` | — | yes | ACTIVE (nav under Money? deep link) |
| Bank reconciliation | shell `banking` | `financials/reconciliation/*` | data-table | bankReconciliationService + bankCsv import | `financial.bank_reconciliation.*` match | CSV import wizard | yes | ACTIVE_HIDDEN-ish |
| Maintenance/Services | `/maintenance` | `features/maintenance/**`, `routes/_protected.maintenance` | entity-table/maintenance-list | maintenance-service | `maintenance.*` | detail/resolve overlays, request-form | heavy (r8/r13/lifecycle) | ACTIVE |
| Utilities | `/maintenance?section=utilities` | `features/utilities/**` | data-table | utilities service/docs | `maintenance.view`/create | — | yes | ACTIVE (nav child) |
| Service providers | `/service-providers…` | `features/service-providers/*` | entity-table | provider service/schema | `service_providers.view/write` | categories dialog | yes | ACTIVE |
| Leads | `/leads` | `features/leads/*` | entity-table/leads-view | leads service | `leads.view` | — | — | ACTIVE (Phase2) |
| Communication | `/communication` | `features/communication/*` | hub-view | communication service | `communication.view` | — | — | ACTIVE (Phase2) |
| Reports | `/reports`, `/reports/$reportId` | `features/reports/**` (ReportsShell/Workspace, panels, premium/report-product-page) | report primitives, documents engine | financial reporting services + accounting + documents | `financial.reports.view/export` | premium product page; share/export | heavy | ACTIVE |
| Accounting (GL) | `/accounting`(redirect→reports), shell `accounting` | `features/accounting/**`, `financials/reports/**`, reports accounting panels | report panels | wp05/journal/chart services + RPCs | `financial.reports.*`, audit | reconciliation | yes | ACTIVE as data/report layer; hidden journal writes |
| Settings (company) | `/settings?companySection=…` | `features/governance-hub` company tab → `features/settings/settings-page` (SettingsWorkspace) + registry | settings-form/section card | companySettingsService, costCenterService, paymentTerms | `company.settings.manage`, `cost_centers.manage` | — | yes | ACTIVE |
| Governance/System/Audit/Integrity | `/settings?section=…`, legacy `/system`,`/audit-log`,`/data-integrity` | `features/{governance-hub,system,audit}/**` | audit-log-view, data-integrity-view | audit-log-service, data-integrity-service | `audit.view`, `integrity.view`, `system.view` | — | yes | ACTIVE_HIDDEN (specialist) |
| Users & permissions | `/settings` users-permissions | `governance-hub/UserRolesWorkspace`, user-roles-* | user roles table | user-roles-service, permission-request | `users.manage`,`permission_requests.review` | permission-request dialog | yes | ACTIVE |
| Automation | `/settings?section=automation` | `features/automation/**` | automation-center-view | automation service | `automation.view` | — | yes | ACTIVE_HIDDEN |
| AI assistant | `/ai-assistant`, global/dock | `features/ai-assistant/**` | chat surface, speech control | edge fn + operating-service | (no per-perm; read-only guardrails) | copilot | yes | ACTIVE |
| Help/support | `/help`, `/support`(public) | `features/help-support/*` | — | support | `support.*` admin | — | — | ACTIVE |
| Admin support ops | `/admin-support` | `features/admin-support/*` | — | admin-support | `support.operations.view` | — | — | ACTIVE_HIDDEN (specialist) |
| Onboarding | `/dashboard` (component slot) | `features/onboarding/*` | KPI/card | `onboardingService.ts`, `useOnboarding.ts` | — | — | OnboardingChecklist.test | ACTIVE (dashboard checklist when company incomplete) |
| Command palette | — (global) | `features/command-palette/*` | dialog | ui-store | — | CommandPaletteDialog | — | ACTIVE (shell) |
| Browser-ux / design-system / data-visibility | `/dev/design-system` (DEV), features/browser-ux, features/supabase-data-visibility | — | showcase | — | — | — | — | DEV / INTERNAL |
| Tenant portal | `/tenant-portal` (root, public) | `features/tenant-portal/*` | — | tenant-portal snapshot RPC | tenant claims (non-office) | — | yes | ACTIVE |
| Owner portal | `/owner-portal` (root, public) | `features/owner-portal/*` | — | owner-portal snapshot RPC (`get_owner_portal_snapshot`) | bearer token + owner scope | — | — | ACTIVE |
| Landing & legal | `/`, `/privacy`, `/terms`, `/support` | `features/landing/*`, `routes/{landing,privacy,terms}` | brand components | — | public | — | — | ACTIVE; `/landing` compat redirect |
| Auth/account | `/login`,`/forgot-password`,`/reset-password`,`/change-password` | `features/auth/*` | auth-layout | auth-service, password-recovery-service | `auth.password.change` | — | yes | ACTIVE |
| Finance shell metadata | Finance sections/views model | `features/finance/shell/financeShellModel.ts` | — | — | granular perms | — | — | ACTIVE (drives Money nav) |

Additional discovered domains: **Billing readiness** (`financials/billing`), **Tax authority/readiness** (`financials/tax-authority`, `features/settings/sections/FinanceReadinessSection`), **Fixed accruals**, **Dossier/relationships** (`services/dossier-activity-scoping`), **Reports premium product**.

---

## 5. Route Census

Source of truth: `src/app/router/route-tree.ts` (registration + guards), `src/app/navigation/route-contract.ts` (canonical/aliases), `app-nav-items.ts` + `route-nav-map.ts` (nav visibility), `governance-hub-sections.ts` + `financeShellModel.ts` (hidden tabs). Route pages are lazy-loaded; every entry below shows its lazy component target.

Legend — **Protected** = behind `protectedRoute` auth beforeLoad (redirect→`/login`). **Permission** = extra `beforeLoad` `requirePermission(...)`.

### 5.1 Root / public routes (outside auth shell)

| Route | Route file | Page owner | Layout | Domain | Nav entry | Protected | Permission | Redirect/Alias | Runtime reachability | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | route-tree | `routes/landing.tsx` → `LandingRouteComponent` | root (public) | Landing | link in login | no | none | — | public URL | ACTIVE | MALEK landing; canonical title |
| `/login` | route-tree | `routes/_auth.login.tsx` `LoginRouteComponent` | authRoute (redirects→/dashboard if session) | Auth | public | no | none | — | public | ACTIVE | `_auth.login.e2e-fixture` sibling |
| `/forgot-password` | route-tree | `features/auth/password-recovery-page` `ForgotPasswordPage` | authRoute | Auth | no | no | none | — | public | ACTIVE | |
| `/reset-password` | route-tree | `password-recovery-page` `ResetPasswordPage` | **root** (not authRoute) | Auth | no | no | none | — | via email link | ACTIVE | parent = rootRoute, intentionally outside authRoute redirect |
| `/landing` | route-tree | — | root | Landing | no | no | none | **redirect → `/`** | only via old bookmarks | REDIRECT_ONLY | `landingCompatRoute` |
| `/privacy`,`/terms` | route-tree | `routes/privacy`,`routes/terms` | root | Legal | footer links | no | none | — | public | ACTIVE | |
| `/support` | route-tree | `features/help-support/public-support-page` | root | Support | no | no | none | — | public, static | ACTIVE | public-safe; real support is `/help` |
| `/tenant-portal` | route-tree | `features/tenant-portal/tenant-portal-page` | root (own constrained surface) | Tenant Portal | external | tenant claim | none(office) | — | external link | ACTIVE | outside office shell |
| `/owner-portal` | route-tree | `features/owner-portal/owner-portal-page` | root | Owner Portal | external | bearer token | — | — | external link | ACTIVE | `get_owner_portal_snapshot` server scope |
| `/dev/design-system` | route-tree | `features/design-system/design-system-showcase` | root | Design system | no | no | DEV-only | — | DEV only | ACTIVE_HIDDEN (DEV) | non-DEV → redirect `/`; also `components/ui/design-system-showcase` referenced? see §22 |

### 5.2 Protected routes (under `protectedRoute`; auth enforced at shell parent)

All below require a session. Route-level extra permission listed. **Sidebar root** from route-contract.

| Route | Page owner (lazy) | Sidebar root | Permission (route) | Navigation entry | Status | Notes |
|---|---|---|---|---|---|---|
| `/dashboard` | `features/dashboard/dashboard-page` DashboardPage | Today | none | primary (group1) | ACTIVE | |
| `/properties` | `features/portfolio-hub/portfolio-hub-workspace` PortfolioHubPage | Portfolio | `properties.view` | primary | ACTIVE | workspace w/ search section |
| `/properties/new` | `features/properties/property-form-page` PropertyFormPage | Portfolio | `properties.create` | action | ACTIVE | |
| `/properties/$propertyId` | `features/properties/property-detail-page` PropertyDetailPage | Portfolio | `properties.view` | from list | ACTIVE | has children |
| `…/$propertyId/` | `features/properties/overview/property-overview-page` | Portfolio | view | index tab | ACTIVE | child of detail |
| `…/$propertyId/units` | `features/properties/property-detail-page` PropertyUnitsPage | Portfolio | view | child tab | ACTIVE | |
| `…/$propertyId/units/$unitId` | `features/properties/units/property-unit-detail-page` | Portfolio | view | child | ACTIVE | |
| `/properties/$propertyId/edit` | `property-form-page` PropertyFormPage | Portfolio | `properties.edit` | action | ACTIVE | |
| `/units` | — | Portfolio | — | no | **REDIRECT_ONLY** → `/properties?section=units` | legacy |
| `/lands` | `features/lands/lands-page` LandsWorkspace | Portfolio | `lands.view` | (portfolio child) | ACTIVE | Phase2 standalone |
| `/lands/$landId` | `routes/_protected.lands.$landId` LandDetailRouteComponent | Portfolio | `lands.view` | from list | ACTIVE | |
| `/owners` | `features/owners/OwnersPage` OwnersWorkspace | Portfolio | `owners.hub.view` | portfolio child | ACTIVE | |
| `/owners/$ownerId` | `features/owners/owner-detail-page` OwnerDetailPage | Portfolio | `owners.detail.view` | from list | ACTIVE | dossier |
| `/owners/$ownerId/edit` | `routes/_protected.owners.$ownerId.edit` | Portfolio | `owners.hub.view` | action | ACTIVE | |
| `/tenants` | `features/tenants/TenantsPage` TenantsWorkspace | Leasing | `contracts.view` | leasing child | ACTIVE | |
| `/tenants/$tenantId` | `features/tenants/components/TenantPreviewDialog` `TenantDetailPage` (a real page) | Leasing | `contracts.view` | from list | ACTIVE | dossier page + preview dialog share `TenantDossierContent` (§29) |
| `/people` | `features/people/people-list-page` PeopleListPage | Leasing | `contracts.view` | (no global nav; via contracts) | ACTIVE | canonical identity directory |
| `/people/new` | `routes/_protected.people.new` | Leasing | `contracts.create` | action | ACTIVE | |
| `/people/$personId` | `features/people/components/PersonDossier` PersonDetailPage | Leasing | `contracts.view` | from list | ACTIVE | |
| `/people/$personId/edit` | `routes/_protected.people.$personId.edit` | Leasing | `contracts.edit` | action | ACTIVE | |
| `/leads` | `features/leads/leads-page` LeadsPage | Leasing | `leads.view` | (contracts deep link) | ACTIVE | |
| `/communication` | `features/communication/communication-page` | Leasing | `communication.view` | (deep link) | ACTIVE | |
| `/contracts` | `features/relationships-hub/leasing-hub-workspace` LeasingHubPage | Leasing | none at route (children guard) | primary | ACTIVE | beforeLoad handles legacy `?section=people/tenants/leads/communication` → redirects |
| `/contracts/new` | `features/contracts/ContractFormPage` | Leasing | `contracts.create` | action/quick-create | ACTIVE | |
| `/contracts/$contractId` | `features/contracts/pages/ContractDetailPage` | Leasing | view | from list | ACTIVE | |
| `/contracts/$contractId/edit` | `ContractFormPage` | Leasing | `contracts.edit` | action | ACTIVE | |
| `/financials` | `features/finance/FinancePage` FinancePage | Money | (shell; per-view perms) | primary | ACTIVE | Money workspace, section/view in search |
| `/finance/collections` | — | Money | — | no | REDIRECT_ONLY → `/financials?section=collections&view=…` | legacy |
| `/finance/expenses` | — | Money | `expenses.view` | no | REDIRECT_ONLY → `/financials?section=expenses` | legacy |
| `/finance/deposits` | — | Money | `financial.deposits.view` | no | REDIRECT_ONLY → `/financials?section=funds` | legacy |
| `/finance/banking` | — | Money | `financial.bank_reconciliation.view` | no | REDIRECT_ONLY → banking / `/commissions` | legacy |
| `/commissions` | `features/commissions/commissions-page` | Money | `commissions.view` | no global | ACTIVE | deep link |
| `/invoices` | — | Money | (redirect) | no | REDIRECT_ONLY → collections/invoices | legacy |
| `/receipts` | `features/financials/receipts/receipts-page` ReceiptsPage | Money | (redirect if no receiptId) | no | **PARTIALLY_WIRED** | only renders when `?receiptId=` present; else redirect → collections/receipts |
| `/expenses` | — | Money | `expenses.view` | no | REDIRECT_ONLY | |
| `/arrears` | — | Money | `arrears.view` | no | REDIRECT_ONLY | |
| `/deposits` | — | Money | `financial.deposits.view` | no | REDIRECT_ONLY | |
| `/owner-settlements` | — | Money | `financial.owner_settlements.view` | no | REDIRECT_ONLY | |
| `/bank-reconciliation` | — | Money | `bank_reconciliation.view` | no | REDIRECT_ONLY | |
| `/accounting` | — | Reports | (redirect) | no | REDIRECT_ONLY → reports accounting/GL | |
| `/reports` | `features/reports/reports-page` ReportsPage | Reports | `financial.reports.view` | primary | ACTIVE | Reports workspace shell |
| `/reports/$reportId` | `features/reports/premium/report-product-page` | Reports | `financial.reports.view` | from catalog | ACTIVE | premium report product |
| `/ai-assistant` | `features/ai-assistant/ai-assistant-page` | (Settings? no — Today root per contract) | none | dock/AI | ACTIVE | |
| `/help` | `features/help-support/help-support-page` | Settings | none | (support) | ACTIVE | authenticated support |
| `/admin-support` | `features/admin-support/admin-support-page` | Settings | `support.operations.view` | no | ACTIVE_HIDDEN | specialist |
| `/settings` | `features/governance-hub/components/GovernanceHubWorkspace` | Settings | none (per-section) | primary | ACTIVE | renders hub + company tab |
| `/automation` | — | Settings | `automation.view` | no | REDIRECT_ONLY → settings?section=automation | |
| `/utilities` | — | Services | (redirect) | no | REDIRECT_ONLY → maintenance?section=utilities | legacy |
| `/documents-vault` | — | Services | (redirect) | no | REDIRECT_ONLY → maintenance?section=documents_vault | compatibility (old bookmarks only, per comment) |
| `/system` | — | Settings | `system.view` | no | REDIRECT_ONLY → settings?section=system-settings | legacy |
| `/audit-log` | — | Settings | `audit.view` | no | REDIRECT_ONLY → settings?section=audit-log | legacy |
| `/data-integrity` | — | Settings | `integrity.view` | no | REDIRECT_ONLY → settings?section=data-integrity | legacy |
| `/change-password` | — | Settings | `auth.password.change` | no | REDIRECT_ONLY → settings?section=security | legacy |
| `/maintenance` | `routes/_protected.maintenance` MaintenanceRouteComponent | Services | (nav `maintenance.view`) | primary | ACTIVE | section=maintenance/utilities/documents_vault |
| `/service-providers` | `features/service-providers/service-providers-page` | Services | `service_providers.view` | (maintenance deep link) | ACTIVE | |
| `/service-providers/new` | `routes/_protected.service-providers.new` | Services | `service_providers.write` | action | ACTIVE | |
| `/service-providers/$providerId` | `service-provider-detail-page` | Services | `service_providers.view` | from list | ACTIVE | |
| `/service-providers/$providerId/edit` | `routes/_protected.service-providers.$providerId.edit` | Services | `service_providers.write` | action | ACTIVE | |

**Route census observations:**
- `REDIRECT_ROUTES` list in `route-contract.ts` enumerates the redirect-only set explicitly (route-contract is the single authority; matches route-tree).
- Several routes are **ALIAS via search**, not paths (`/units`, `/utilities`, `/documents-vault`, all legacy finance): canonical reach is `workspace?section=…&view=…`.
- **No route registers a component but never renders** except intentional redirects; the biggest "route exists but no page behind it" is normal (redirects). `reports-page` is imported widely (many screens link into reports), confirming reports workspace is a hub target, not dead.
- `/tenants/$tenantId` renders `TenantDetailPage` — a real dossier page that shares `TenantDossierContent` with the in-workspace `TenantPreviewDialog` (content reuse, not a dialog used as a page).

---

## 6. Page / Screen Census (summary table)

Rows for page-level screens owned by a route. Multi-entity "hubs" with `section` search param are listed as one screen with sub-tabs.

| Screen | File Path | Route(s) | Domain | Purpose | Primary Entity | Status / concerns |
|---|---|---|---|---|---|---|
| Dashboard/Today | `features/dashboard/dashboard-page.tsx` | `/dashboard` | Dashboard | needs-attention + signals + finance perf | mixed | ACTIVE; heavy analytics subsections |
| Portfolio hub | `features/portfolio-hub/portfolio-hub-workspace.tsx` | `/properties` | Properties | properties register + units/owners child registers | property/unit/owner | ACTIVE |
| Property form | `features/properties/property-form-page.tsx` | `/properties/new`, `/…/edit` | Properties | create/edit property | property | ACTIVE |
| Property detail | `features/properties/property-detail-page.tsx` | `/properties/$propertyId` (+ `/units`) | Properties | dossier + unit tabs | property | ACTIVE |
| Property overview | `features/properties/overview/property-overview-page` | detail `/` | Properties | overview KPIs | property | ACTIVE |
| Property unit detail | `features/properties/units/property-unit-detail-page` | `/units/$unitId` | Units | unit dossier | unit | ACTIVE |
| Lands workspace | `features/lands/lands-page.tsx` | `/lands` | Lands | land register | land | ACTIVE |
| Land detail | `routes/_protected.lands.$landId.tsx` | `/lands/$landId` | Lands | land file | land | ACTIVE |
| Owners workspace | `features/owners/OwnersPage` | `/owners` | Owners | owner register | owner | ACTIVE |
| Owner detail | `features/owners/owner-detail-page.tsx` | `/owners/$ownerId` | Owners | dossier | owner | ACTIVE |
| Owner edit | `routes/_protected.owners.$ownerId.edit.tsx` | `/owners/$ownerId/edit` | Owners | edit | owner | ACTIVE |
| Tenants workspace | `features/tenants/TenantsPage.tsx` | `/tenants` | Tenants | tenant register | tenant | ACTIVE |
| Tenant detail | `features/tenants/components/TenantPreviewDialog.tsx` (`TenantDetailPage`) | `/tenants/$tenantId` | Tenants | real dossier page | tenant | ACTIVE; page shares `TenantDossierContent` with the preview dialog |
| People list | `features/people/people-list-page.tsx` | `/people` | People | person directory | person | ACTIVE |
| Person dossier | `features/people/components/PersonDossier` | `/people/$personId` | People | dossier | person | ACTIVE |
| Person new/edit | `routes/_protected.people.{new,$personId.edit}.tsx` | `/people/new`,`…/edit` | People | create/edit | person | ACTIVE |
| Leasing hub | `features/relationships-hub/leasing-hub-workspace` | `/contracts` | Contracts | contracts register + tenants/people children | contract | ACTIVE |
| Contract form | `features/contracts/ContractFormPage.tsx` | `/contracts/new`,`…/edit` | Contracts | create/edit contract | contract | ACTIVE |
| Contract detail | `features/contracts/pages/ContractDetailPage` | `/contracts/$contractId` | Contracts | dossier + payments + docs | contract | ACTIVE |
| Money workspace | `features/finance/FinancePage.tsx` | `/financials` | Financials | section/view shell | mixed | ACTIVE (CANONICAL) |
| *(embedded register workspaces)* | see §4/§11 | shell | Financials | invoices/receipts/arrears/expenses/deposits/accruals/commissions/settlements/bank | — | ACTIVE via shell |
| Reports workspace | `features/reports/reports-page.tsx` / `workspace/*` | `/reports` | Reports | catalog + view panels | report | ACTIVE |
| Report product | `features/reports/premium/report-product-page.tsx` | `/reports/$reportId` | Reports | premium product | report | ACTIVE |
| AI assistant | `features/ai-assistant/ai-assistant-page.tsx` | `/ai-assistant` | AI | chat assistant + speech | — | ACTIVE |
| Help & support | `features/help-support/help-support-page.tsx` | `/help` | Support | support center | ticket | ACTIVE |
| Public support | `features/help-support/public-support-page.tsx` | `/support` | Support | static contact | — | ACTIVE |
| Admin support ops | `features/admin-support/admin-support-page.tsx` | `/admin-support` | Support | triage/investigation | support request | ACTIVE_HIDDEN |
| Settings (Governance hub) | `governance-hub/components/GovernanceHubWorkspace.tsx` | `/settings` | Settings/Governance | hub tabs incl. company + users/perms | company/user | ACTIVE |
| Company settings | `features/settings/settings-page.tsx` `SettingsWorkspace` (+ registry sections) | settings?company | Settings | office/identity/documents/finance-readiness/cost-centers/payment-terms/notifications/system | company | ACTIVE (as company tab) |
| User roles workspace | `governance-hub/components/UserRolesWorkspace.tsx` | settings?section=users-permissions | Governance | manage users + review requests | user/permission | ACTIVE |
| Automation workspace | `features/automation/components/automation-workspace.tsx` | settings?section=automation | Automation | rules/alerts | automation rule | ACTIVE_HIDDEN |
| System workspace | `features/system/system-page.tsx` `SystemWorkspace` | settings?section=system-settings | System | admin settings | system | ACTIVE_HIDDEN |
| Audit log | `features/audit/audit-log-page.tsx` `AuditLogWorkspace` + `audit-log-view` | settings?section=audit-log | Audit | read-only audit | audit event | ACTIVE_HIDDEN |
| Data integrity | `features/system/data-integrity-page.tsx` + view/service | settings?section=data-integrity | Integrity | integrity checks | — | ACTIVE_HIDDEN |
| Change password | `features/auth/change-password-page.tsx` | settings?section=security | Auth | password change | — | ACTIVE |
| Maintenance | `routes/_protected.maintenance.tsx` → maintenance-workspace | `/maintenance` | Maintenance | request + utility + documents-vault tabs | maintenance req | ACTIVE |
| Service providers | `service-providers-page`, `-detail-page`, routes `new/$providerId/edit` | `/service-providers…` | Service providers | providers | provider | ACTIVE |
| Onboarding checklist | `features/onboarding/*` | `/dashboard` (slot) | Onboarding | first-run setup checklist | company | ACTIVE (dashboard) |
| Owner portal | `features/owner-portal/owner-portal-page` | `/owner-portal` | Portal | read-only owner view | owner | ACTIVE |
| Tenant portal | `features/tenant-portal/tenant-portal-page` | `/tenant-portal` | Portal | read-only tenant view | tenant | ACTIVE |
| Landing | `routes/landing.tsx` | `/` | Landing | marketing | — | ACTIVE |
| Legal | `routes/{privacy,terms}.tsx` | `/privacy`,`/terms` | Legal | static | — | ACTIVE |

**Page-status flags:** Onboarding is not a standalone page — it is a Dashboard slot (`OnboardingChecklist` in `dashboard-page.tsx`). Routes without a bespoke page = `/receipts` without `?receiptId` (redirects into Money) and all REDIRECT_ONLY routes. Multiple pages per capability: People/Tenants/Owners dirs + embedded registers in hubs (by design per lock).

---

## 7. Feature Census (capability-level; representative high-value rows)

| Feature | Domain | User capability | Main files | UI entry | Route | Data layer / RPC | Permissions | Tests | Status / notes |
|---|---|---|---|---|---|---|---|---|---|
| Log in / out | Auth | sign in | `auth/login-page.tsx`,`auth-service.ts`,`use-auth` | `/login` | public | supabase.auth | — | many | ACTIVE |
| Password recovery / reset | Auth | recover password | `auth/password-recovery-{page,service}.ts` | `/forgot-password`,`/reset-password` | public | supabase.auth.resetPasswordForEmail | — | yes | ACTIVE |
| Change password | Auth | change password | `auth/change-password-{page,service}.ts` | settings security | `/change-password`→settings | auth RPC/service | `auth.password.change` | yes | ACTIVE_HIDDEN entry |
| Create/edit property | Portfolio | add/manage property | properties/property-form-page, property-workspace-service | `/properties/new` | route | service→tables | properties.create/edit | yes | ACTIVE |
| Property analytics/health | Dashboard | view property health | dashboard property-health-signal | dashboard | — | snapshot | app.dashboard.view | yes | ACTIVE |
| Owner dossier + statement | Owners | view owner, run statement | owner-detail-page, owners components | /owners/$ownerId | route | owner-workspace-service | owners.detail.view | yes | ACTIVE |
| Owner settlement request+approve | Financials/Owners | request & approve settlement | owner-settlements-*, OwnerSettlementWorkspace | Money funds/owner_settlements | shell | RPC `owner_settlements` | view/approve/pay | heavy | ACTIVE |
| Contract creation/activation | Leasing | create & activate lease | contracts/ContractFormPage, contractSchema, contract-activation-authority | /contracts/new | route | contract service + activation RPCs | contracts.create/edit/approve | heavy | ACTIVE |
| Contract schedule preview | Leasing | preview billing schedule | contracts/contract-schedule-preview | contract form | route | schedule RPC/calc | view | yes | ACTIVE |
| Contract soft-delete/terminate | Leasing | end/delete contract | contracts actions/services; `soft-delete-contract-*`, `terminate_contract` RPC | contract dossier | route | RPCs | contracts.* | yes | ACTIVE |
| Invoice generation/preview | Money | generate invoice | financials/invoices/invoice-actions, invoiceService, invoice-list-section | Money | shell | RPC (invoice generation) | financial.invoices.generate | heavy | ACTIVE; legacy standalone `/invoices` path redirects into the Money shell (workspace export still used by shell) |
| Quick collect/payment | Money | collect a payment | financials/components/quick-payment-form, payments/paymentService | Money quickAdd=collect | shell | RPC payment | financial.payments.create | heavy | ACTIVE |
| Receipt allocation/print | Money | allocate & print receipt | receipts/receiptService, receipt-print, receipt-detail-card | Money receipts | shell | RPC | payments.create/receipts.void | yes | ACTIVE |
| Void receipt | Money | void receipt | receipt-actions | Money | shell | RPC | financial.receipts.void | yes | ACTIVE |
| Expense entry | Money | log expense | expenses/expenseService, expense-actions | Money expenses | shell | RPC | expenses.view/write | yes | ACTIVE |
| Arrears aging | Money | view arrears | financials/arrears/* | Money collections/arrears | shell | RPC | arrears.view | yes | ACTIVE |
| Deposit management | Money | manage security deposits | deposits/deposit-service, deposit-action-forms | Money funds/deposits | shell | RPC | financial.deposits.view | yes | ACTIVE_HIDDEN primary-nav |
| Bank statement import + reconciliation | Money | reconcile bank | reconciliation/{bankCsvImportService,bankReconciliationService,bank-csv-import-workflow} | Money banking | shell | RPC bank_reconciliation | financial.bank_reconciliation.match | heavy | ACTIVE |
| Fixed monthly accrual (fees) | Money | record management fee | fixed-monthly-accruals/* | Money fees | shell | RPC | view/execute/reverse | — | ACTIVE_HIDDEN |
| Commission tracking | Money | track broker commissions | commissions/* | /commissions | route | service | commissions.view | yes | ACTIVE |
| Report catalog & open product | Reports | browse & open reports | reports workspace, ReportsCatalog, report-product-page | /reports | route | reports directory + services | financial.reports.view | heavy | ACTIVE |
| Report export/PDF/Excel/print | Reports | export report | report-output-actions, documents engine, xlsx/CSV export | report | — | docs/export | financial.reports.export | yes | ACTIVE |
| Premium owner/property reports | Reports | premium report product | reports/premium, reports/documents/professional-* | product page | route | documents engine | view/export | yes | ACTIVE |
| General ledger / statements | Accounting | view GL + statements | accounting/reports/*, reports components accounting | reports accounting | route | accounting services + RPC | financial.reports.view | yes | ACTIVE (journal *write* server-owned & hidden) |
| Maintenance request lifecycle | Services | create/resolve maintenance | maintenance/* (list, form, service, resolve overlays) | /maintenance | route | RPCs | maintenance.create/edit/approve | heavy (r8/r13) | ACTIVE |
| Utilities/utility bills | Services | manage meters & bills | features/utilities/** | maintenance?section=utilities | shell | service/RPC | maintenance.create (bill) | yes | ACTIVE |
| Service-provider mgmt | Services | manage providers | service-providers/* | /service-providers… | route | service | service_providers.* | yes | ACTIVE |
| Contextual documents | Documents | attach/generate docs per entity | documents/contextual-documents-*, contracts/owners/properties/utilities/maintenance documents | dossiers | route | DocumentService + storage | documents.write | heavy | ACTIVE |
| Audit log viewing | Governance | read audit | audit/services/audit-log-service, audit-log-view | settings?section=audit-log | shell | RPC | audit.view | yes | ACTIVE_HIDDEN |
| Integrity checks | Governance | run integrity checks | system/data-integrity-{page,view,service} | settings?section=data-integrity | shell | RPC | integrity.view | yes | ACTIVE_HIDDEN |
| Users/roles/permissions mgmt | Governance | manage users + review requests | governance-hub/UserRolesWorkspace, user-roles-service | settings users-permissions | shell | user-roles RPC/service | users.manage, permission_requests.review | yes | ACTIVE |
| Company settings (identity/office/docs…) | Settings | edit company | settings/settings-page + registry sections + settings services | settings company | shell | companySettingsService | company.settings.manage | yes | ACTIVE |
| Notification prefs (company) | Settings | set notification prefs | settings/sections/NotificationsSection | settings company notifications | shell | service | — | — | ACTIVE |
| Automation rules | Automation | create automation rules | automation/components/automation-center-view | settings?section=automation | shell | service | automation.view | yes | ACTIVE_HIDDEN |
| AI chat + navigate/draft | AI | query assistant | ai-assistant/* | /ai-assistant + dock/global | route | edge fn | none (guardrails) | yes | ACTIVE |
| AI speech (TTS/voice) | AI | ask via voice | ai-assistant/speech/* | AI surface | — | web speech | — | yes | ACTIVE |
| PWA install/update | Runtime | install app | lib/pwa-{install,update}, pwa-install-prompt | root/header | — | SW | — | yes | ACTIVE |
| In-app notifications | Runtime | view notifications | app/layout/notifications-menu, app-notifications-service | header | — | RPC `mark_app_notification_read` | — | yes | ACTIVE |
| Tenant portal read | Portal | tenant self-service read | tenant-portal/* | external | public | snapshot RPC | tenant claim | yes | ACTIVE |
| Owner portal read | Portal | owner self-service read | owner-portal/* | external | public | `get_owner_portal_snapshot` | bearer/owner | — | ACTIVE |
| Command palette | Runtime | jump to actions | command-palette/* | header/⌘K | global | ui-store | — | — | ACTIVE |

Sub-capabilities deliberately enumerated separately above (schedule preview, void, export, approval, allocation, etc.) because the task requires meaningful sub-capabilities be distinct features.

---

## 8. Component Census (shared primitives + duplicates)

Source: `src/components/**` (98 files total incl. 35 test files). Production (non-test) files by subfolder: `components/ui` = 42 (41 primitives + `index.ts` barrel), `components/layout` = 11, `components/brand` = 3, `components/documents` = 2, plus top-level `components/*` production files. Shared barrel: `components/ui/index.ts`.

### 8.1 Shared global primitives (CANONICAL candidates)

| Component | Path | Category | Used by | Shared/local | Status |
|---|---|---|---|---|---|
| `DataTable` | `components/ui/data-table.tsx` | table | many registers | SHARED | CANONICAL |
| `EntityTable` (+ mobile summary) | `components/ui/entity-table.tsx` | table (responsive register) | registers via active-register-inventory | SHARED | CANONICAL (primary register primitive) |
| `Table` (base) | `components/ui/table.tsx` | table base | DataTable/EntityTable | SHARED | CANONICAL (low-level) |
| `Card`/`CardContent/…` | `components/ui/card.tsx` | card | everywhere | SHARED | CANONICAL |
| `Button` | `components/ui/button.tsx` | action | everywhere | SHARED | CANONICAL |
| `PageHeader` | `components/layout/page-header.tsx` | header | feature pages | SHARED | CANONICAL |
| `PageLayout` | `components/layout/page-layout.tsx` | layout | feature pages | SHARED | CANONICAL |
| `ListPage` | `components/layout/list-page.tsx` | list scaffold | list screens | SHARED | CANONICAL |
| `Dialog` (Radix) | `components/ui/dialog.tsx` | dialog | many | SHARED | CANONICAL |
| `EntityPreviewDialog` | `components/ui/entity-preview-dialog.tsx` | preview dialog | entity dossiers | SHARED | CANONICAL (see TenantPreviewDialog reuse below) |
| `ConfirmDialog` | `components/ui/confirm-dialog.tsx` | confirm | destructive actions | SHARED | CANONICAL |
| `BottomSheet` | `components/ui/bottom-sheet.tsx` | mobile sheet | shell + previews | SHARED | CANONICAL |
| `EntityForm` (+ `EntityFormVisualProvider`) | `components/ui/entity-form.tsx` | form shell | create/edit forms | SHARED | CANONICAL; `.e2e-fixture` sibling |
| `EntityCard`/`EntityCell` | `components/ui/{entity-card,entity-cell}.tsx` | card/cell | registers | SHARED | CANONICAL |
| `FilterBar`/`ActiveFilterBar`/`FilterTabs` | `components/ui/{filter-bar,active-filter-bar,filter-tabs}.tsx` | filtering | registers | SHARED | CANONICAL |
| `SearchInput` | `components/ui/search-input.tsx` | search | lists | SHARED | CANONICAL |
| `StatusBadge` | `components/ui/status-badge.tsx` | status display | everywhere | SHARED | CANONICAL |
| `ActionMenu` | `components/ui/action-menu.tsx` | actions menu | register rows | SHARED | CANONICAL |
| `ExportMenu` | `components/ui/export-menu.tsx` | export | lists | SHARED | CANONICAL |
| `LoadingState`/`ErrorState`/`StateSurfaces` | `components/ui/{loading-state,error-state,state-surfaces}.tsx` | async states | pages | SHARED | CANONICAL |
| `AsyncContentState` | `components/async-content-state.tsx` | async gate | features | SHARED | CANONICAL |
| `KpiCard`, `Badge`, `Alert`, `Skeleton`, `Select`, `Input`, `Label`, `Textarea`, `FileAttachmentField`, `SectionHeader`, `SectionTabs`, `DataTableColumnsMenu`, `DetailFields`, `ResponsiveCardGrid`, `ReportBarChart`, `ReportSectionPrimitives`, `SelectionCard`, `MobileFormStepper`, `FieldError`-style | ui/* | misc | various | SHARED | CANONICAL set |
| `ErrorBoundary`/`AppCatchBoundary`/`RouteErrorFallback` | `components/error-boundary.tsx` | error boundary | root + router | SHARED | CANONICAL |
| `AccessDenied` | `components/layout/access-denied.tsx` | permission gate | feature gates | SHARED | CANONICAL |
| `EmbeddableWorkspace` | `components/layout/embeddable-workspace.tsx` | shell-inside-shell | hubs | SHARED | CANONICAL |
| `EntityDetailHeader`, `PageHeaderActions`, `RegisterSummary` | layout/* | detail header/actions/summary | dossiers | SHARED | CANONICAL |
| `PermissionRequestDialog` | `components/layout/permission-request-dialog.tsx` | request permission | users | SHARED | ACTIVE |
| `PwaInstallPrompt` | `components/layout/pwa-install-prompt.tsx` | PWA | root | SHARED | ACTIVE |
| Brand: `MalekBrandWordmark` (shell), `MalikBrand` (public/auth), `MalikMark` (mark primitive) | `components/brand/{malek-wordmark,malik-brand,malik-mark}.tsx` | brand | shell vs landing/login/public-support/PWA-prompt | SHARED | ACTIVE — `MalekBrandWordmark` is a wrapper over the same identity; naming split (`Malik` vs `Malek`) is cosmetic |
| `ContextualDocumentsPanel`/`Section` | `components/documents/*` | contextual docs | dossiers | SHARED | CANONICAL |

### 8.2 Competing/parallel primitives (duplicate candidates → §23)

| Concept | Implementation A | Implementation B | Canonical | Notes |
|---|---|---|---|---|
| PageHeader | `components/layout/page-header.tsx` | inline headers in feature pages | A (contract) | features historically rolled own headers; many now use PageHeader |
| List page scaffold | `components/layout/list-page.tsx` | per-feature page components | A | some features (old tenants/owners/contracts) had bespoke pages now reworked to ListPage/workspace |
| Table | `components/ui/table.tsx` (base) | `DataTable` | `EntityTable` | three layers; DataTable/EntityTable both canonical-register |
| Status pill/badge | `StatusBadge` | `Badge` | StatusBadge for status; Badge generic | per-feature `*Status.tsx`/`*StatusLabels` exist (invoice-status-labels, contractStatus, maintenanceStatus) |
| Empty/Loading/Error | `state-surfaces.tsx` vs `loading-state/error-state` vs `AsyncContentState` | — | shared | overlapping state primitives; test `state-surfaces` present |
| Filter bar | `FilterBar`+`ActiveFilterBar` | `ReportsFilterSurface`, `FiltersPanel`, feature-specific filters | FilterBar/ActiveFilterBar | reports has own filters (ReportsFilterSurface/FiltersPanel) |
| Action menu | `ActionMenu` (ui) | `entity-action-presets.tsx` | ActionMenu | entity-action-presets is a preset library over action primitives |
| Report bar chart | `report-bar-chart.tsx` (recharts) | dashboard charting | report-bar-chart for reports | recharts used; feature-local chart comps exist |

### 8.3 Domain/local components per feature
Every feature folder has a `components/` subfolder (see §4). Prominent local-only components: `owners/components/*` (dossier, workspace-table, settlement workspace, statement), `contracts/components/*`, `financials/components/*` (invoice/receipt/arrears/expenses sections), `reports/components/*` (many panels), `maintenance/components/*`, `tenants/components/TenantPreviewDialog`, `people/components/PersonDossier`, `lands/components/lands-view`, `leads/components/leads-view`, `communication/components/*`, `utilities/components/*`, `service-providers/components/*`, `commissions/components/*`, `system/components/*`, `audit/components/*`, `automation/components/*`.

**Important shared-primitive consumers trace (register foundation):** the file `src/features/active-register-inventory.ts` + guard `scripts/check-active-register-inventory.mjs` + `app/accessibility/` enforce that each listed register renders via `EntityTable`/`DataTable`. This is the strongest evidence of "canonical register foundation" — with 30+ registered surfaces.

---

## 9. Dialog / Preview / Modal Census

Source: `components/ui/{dialog,entity-preview-dialog,confirm-dialog,bottom-sheet,data-table-columns-menu,file-attachment-field,entity-form}.tsx`; feature dialogs.

| UI surface | File | Type | Entity | Trigger / location | Mobile | Desktop | Alternative | Canonical |
|---|---|---|---|---|---|---|---|---|
| `Dialog` base | `components/ui/dialog.tsx` (Radix) | modal | generic | all | full-dialog | centered modal | — | CANONICAL |
| `EntityPreviewDialog` | `components/ui/entity-preview-dialog.tsx` | preview | generic entity | dossiers | sheet | dialog | full dossier page | CANONICAL |
| `ConfirmDialog` | `components/ui/confirm-dialog.tsx` | confirm | generic | destructive actions | — | — | — | CANONICAL |
| `BottomSheet` | `components/ui/bottom-sheet.tsx` | sheet | generic | mobile nav/preview | bottom sheet | (n/a on desktop usually) | — | CANONICAL |
| Tenant dossier (page) vs preview dialog | `features/tenants/components/TenantPreviewDialog.tsx` (`TenantDetailPage` + `TenantDossierContent` + `TenantPreviewDialog`) | page + preview dialog sharing dossier content | tenant | page `/tenants/$tenantId`; preview dialog in Tenants workspace | page | dialog | — | ACTIVE — shared `TenantDossierContent` is a clean reuse, not "dialog-as-page" (§29) |
| Person dossier dialog/page | `features/people/components/PersonDossier` | dossier | person | `/people/$personId` | — | — | — | ACTIVE |
| Contract form modal | `features/contracts/contract-form-modal.tsx` (`ContractFormModal`) | create/edit form | contract | mounted by `ContractFormPage` (route `/contracts/new`,`…/edit`) and by `ContractsListPage` (in-list) | — | — | — | ACTIVE — single shared form; `ContractFormPage` is a thin shell rendering this modal |
| Contract schedule preview | `features/contracts/contract-schedule-preview.ts`(.test) | preview panel | contract | form | — | — | — | ACTIVE |
| Invoice detail | `financials/components/invoice-detail-section.tsx` | detail | invoice | Money list | — | — | — | ACTIVE |
| Receipt detail card | `financials/components/receipt-detail-card.tsx` | quick detail | receipt | Money receipts (embedded) | — | — | `features/financials/receipts/receipt-detail-page.tsx` (ReceiptDetailPage) used for standalone `/receipts?receiptId=` | card ACTIVE (embedded); page ACTIVE (deep-link detail) |
| Quick payment form | `financials/components/quick-payment-form.tsx` | transaction form | payment | Money quickAdd=collect | — | — | — | ACTIVE |
| Expense actions | `financials/expenses/expense-actions.ts` | action forms | expense | Money expenses | — | — | — | ACTIVE |
| Deposit action forms | `financials/deposits/deposit-action-forms.tsx` | action forms | deposit | Money funds | — | — | — | ACTIVE_HIDDEN |
| Deposit documents | `financials/deposits/deposit-{clearance-document,voucher-document}.ts` | print | deposit | actions | — | — | — | ACTIVE |
| Bank CSV import wizard | `financials/reconciliation/bank-csv-import-workflow.tsx` | wizard | bank statement | banking | — | — | — | ACTIVE (raw table allowed/justified) |
| Maintenance detail/resolve overlays | `maintenance/components/maintenance-detail-{overlay,resolve-overlays}.tsx` | overlay | maintenance req | /maintenance | — | — | — | ACTIVE |
| Maintenance request form | `maintenance/components/maintenance-request-form.tsx` | create form | maintenance | /maintenance quickAdd | — | — | — | ACTIVE |
| Permission-request dialog | `components/layout/permission-request-dialog.tsx` | form | permission request | users-permissions | — | — | — | ACTIVE |
| Service-provider categories dialog | `service-providers/components/service-provider-categories-dialog.tsx` | manage | category | /service-providers | — | — | — | ACTIVE (registered in active-register-inventory) |
| Command palette dialog | `command-palette/command-palette-dialog.tsx` | palette | generic | header / dock | sheet? | dialog | — | ACTIVE |
| EntityForm e2e fixture | `components/ui/entity-form.e2e-fixture.tsx` | fixture | generic | tests | — | — | — | TEST |

Also note the removed "EntityPreviewHost via search" legacy mechanism is handled by `app/router/legacy-preview-redirect.tsx` converting `?previewKind=…&previewId=…` → canonical URL (COMPATIBILITY layer; many dialogs previously opened this way).

**Entity inconsistency note (revised after verification):** the tenant dossier exists both as a full page `/tenants/$tenantId` (`TenantDetailPage`) and as an in-workspace preview dialog (`TenantPreviewDialog`); both render the same shared `TenantDossierContent`, which is a deliberate content-reuse pattern (a dossier body rendered in a page vs in a preview) rather than a divergence. Owner/Owner-settlement content is likewise shared across the Money shell and the owner dossier via shared components. Cross-surface consistency is enforced by sharing the dossier body component.

---

## 10. Form Census (representative; feature-local forms are numerous)

Shared form scaffolding: `components/ui/entity-form.tsx`, `hooks/use-crud-form-state.ts`, `lib/operational-form-routes.ts` (routes flagged as "operational form" for unsaved-change/blank guards), `settings/form/*` (sectionDrafts, useSettingsSection).

| Form | File | Entity/Action | Type | Validation | Mutation layer | Permissions | Dialog/Page | Duplicate? | Status |
|---|---|---|---|---|---|---|---|---|---|
| Property create/edit | `features/properties/property-form-page.tsx` | property | create/edit | zod (schema) | property service | properties.create/edit | route page | (old modal not found) | ACTIVE |
| Contract create/edit | `features/contracts/contract-form-modal.tsx` (`ContractFormModal`) | contract | create/edit | `contractSchema.ts` | contract service | contracts.create/edit/approve | `ContractFormPage` (thin route shell) + `ContractsListPage` | single shared modal, not duplicated | ACTIVE |
| Owner edit | `routes/_protected.owners.$ownerId.edit.tsx` | owner | edit | schema | owner service | owners.hub.view | route | — | ACTIVE |
| Person new/edit | `routes/_protected.people.{new,$personId.edit}.tsx` | person | create/edit | schema | people service | contracts.create/edit | route | — | ACTIVE |
| Service provider new/edit | `routes/_protected.service-providers.*.tsx`, `service-provider-schema.ts` | provider | create/edit | schema | provider service | service_providers.write | route | — | ACTIVE |
| Quick collect | `financials/components/quick-payment-form.tsx` | payment | action | zod | paymentService/RPC | financial.payments.create | embedded | — | ACTIVE |
| Invoice generate/actions | `financials/invoices/invoice-actions.ts` | invoice | action | — | RPC | invoices.generate | — | — | ACTIVE |
| Expense entry | `financials/expenses/expense-actions.ts` | expense | create | — | RPC | expenses.write | — | — | ACTIVE |
| Deposit actions | `deposits/deposit-action-forms.tsx` | deposit | action | `deposit-schema.ts` | deposit-service | deposits.view | — | — | ACTIVE |
| Settlement actions | `owners/…`/`financials` | owner settlement | approve/pay | — | RPC | owner_settlements.approve/pay | — | — | ACTIVE |
| Maintenance request | `maintenance/components/maintenance-request-form.tsx` | maintenance | create | — | maintenance service/RPC | maintenance.create | quickAdd | — | ACTIVE |
| Company settings | `features/settings/settings-page.tsx`+`settingsForm.ts`+registry | company settings | edit | section schemas | companySettingsService | company.settings.manage | company tab | older `settings-form-fields`? see notes | ACTIVE |
| Change password | `auth/change-password-page.tsx` | account | action | — | change-password-service | auth.password.change | settings security | — | ACTIVE |
| Attachment upload | `hooks/use-attachment-upload.ts` + `file-attachment-field` | attachment | action | — | storage | documents.write | any | — | ACTIVE |

Form-level verification: Settings does **not** have two competing workspace implementations. `SettingsWorkspace` in `settings-page.tsx` is the company-settings renderer; `settings-workspace-model.ts` is a pure `buildSettingsSummaryTiles` helper consumed by that workspace and its E2E fixture; `registry/sectionRegistry.ts` declares the sections. `operational-form-routes.ts` centralizes which routes get unsaved-change guards (routes `_protected.people.new` etc.).

---

## 11. Table / List / Card Census (representative; foundation-enforced)

Foundation: `EntityTable`, `DataTable`, `EntityCard`/`ResponsiveCardGrid`, `SelectionCard`, `DataTableColumnsMenu`. Registers bound by `features/active-register-inventory.ts` + guard. 

| Surface | File | Entity | Pattern | Desktop/Mobile | Canonical | Notes |
|---|---|---|---|---|---|---|
| People list | `features/people/people-list-page.tsx` | person | table | both | ✔ | inventory row |
| Tenants register | `features/tenants/TenantsPage.tsx` | tenant | table | both | ✔ | |
| Owners register | `owners/components/owner-workspace-table.tsx` | owner | table | both | ✔ | |
| Owner dossier body | `owners/components/owner-dossier-body.tsx` | owner dossier | table/cards | both | ✔ | |
| Owner settlement register | `owners/components/OwnerSettlementWorkspace.tsx` | settlement | table | both | ✔ | |
| Contract register | `contracts/components/ContractTable.tsx` | contract | table | both | ✔ | |
| Contract payments | `contracts/contractPaymentsTab.tsx` | payments | table | both | ✔ | |
| Land register | `lands/components/lands-view.tsx` | land | table | both | ✔ | |
| Leads | `leads/components/leads-view.tsx` | lead | table | both | ✔ | |
| Communication | `communication/components/communication-hub-view.tsx` | thread | table | both | ✔ | |
| Units (property) | `units/units-list.tsx`, `units/units-page.tsx` | unit | table | both | ✔ | |
| Properties | `properties/properties-list-page.tsx` | property | table/cards | both | ✔ | |
| Maintenance | `maintenance/components/maintenance-list.tsx` | maintenance | table | both | ✔ | |
| Utilities | `utilities/components/utilities-workspace.tsx` | utility | table | both | ✔ | |
| Automation center | `automation/components/automation-center-view.tsx` | rule | table | both | ✔ | |
| Audit log | `audit/components/audit-log-view.tsx` | audit event | table | both | ✔ | |
| Commissions | `commissions/components/commissions-view.tsx` | commission | table | both | ✔ | |
| Invoice list | `financials/components/invoice-list-section.tsx` | invoice | table | both | ✔ | |
| Overdue/arrears | `financials/components/overdue-invoices-table.tsx` | invoice | table | both | ✔ | |
| Expenses | `financials/components/expenses-section.tsx` | expense | table | both | ✔ | |
| Deposits | `financials/deposits/deposits-workspace.tsx` | deposit | table | both | ✔ | |
| Fixed monthly accruals | `financials/fixed-monthly-accruals/*workspace` | accrual | table | both | ✔ | |
| Receipts | `financials/receipts/receipts-page.tsx` (ReceiptsWorkspace) | receipt | table | both | ✔ | standalone `/receipts` only when ?receiptId |
| Bank reconciliation | `financials/reconciliation/bank-reconciliation-page.tsx` | statement | table | both | ✔ | |
| Service providers | `service-providers/service-providers-page.tsx` | provider | table | both | ✔ | |
| Provider detail | `service-providers/service-provider-detail-page.tsx` | provider | cards/table | both | ✔ | |
| Reports panels (collections/rent roll/overdue/GL) | reports components | report rows | table | both | ✔ | several inventory rows |

Also a large set of **dashboard/report panels/cards** that are not "registers": dashboard signals, report section primitives, KPI cards.

**Places bypassing standard register foundation:** justified exclusions listed in `active-register-inventory.ts` (bank CSV preview `<table>`, DEV showcase, e2e fixtures). Any other raw `<table>` in production registers would violate the guard — `check-active-register-inventory.mjs` + `canonical-table-usage.test.ts` protect this. Reports premium/print tables go through the document engine's `TableGenerator.ts`.

---

## 12. Hook Census (representative of each hook set + notable per-feature hooks)

Root shared hooks (`src/hooks/`): `use-auth.tsx`, `use-company.tsx`, `useCompanyFormatters.ts`, `use-owner-options.ts`, `use-crud-form-state.ts`, `use-unsaved-changes-guard.tsx`, `useDebounce.ts`, `use-attachment-upload.ts`.

| Hook | Path | Domain | Purpose | Consumers | Dep | Runtime |
|---|---|---|---|---|---|---|
| `useAuth` (ctx) | `src/hooks/use-auth.tsx` | auth | session + canAccess + authorization context | app-wide | supabase auth | ACTIVE |
| `useCompany` | `src/hooks/use-company.tsx` | settings | active company ctx | app-wide | company settings | ACTIVE |
| `useUiStore` via `src/store/ui-store.ts` | `store/` | state | theme/panel/nav state | shell | zustand | ACTIVE |
| `useDebounce` | hooks | utility | search debounce | lists | — | ACTIVE |
| `useCrudFormState` | hooks | form | crud form state | entity forms | — | ACTIVE |
| `useUnsavedChangesGuard` | hooks | nav guard | block nav on dirty | operational-form-routes | router | ACTIVE |
| `use-owner-options`/`owner-options.ts` | hooks/services | owners | owner select options | property/contract forms | — | ACTIVE |
| `useContracts`/`useContractForm`/`useContractAttention`/`useContractPayments` | contracts hooks | contracts | list/detail/form/attention/payments | Leasing/contract pages | React Query | ACTIVE |
| `useTenantWorkspace` | tenants | tenants | tenant dossier data | Tenants page | — | ACTIVE |
| `useInvoices`/`useInvoiceWorkspaceController` | financials/invoices | invoices | invoice list+ctrl | Money | Query | ACTIVE |
| `useReceipts` | financials/receipts | receipts | receipt list | Money | Query | ACTIVE |
| `usePayments` | financials/payments | payments | payments | Money | Query | ACTIVE |
| `useExpenses` | financials/expenses | expenses | expenses | Money | Query | ACTIVE |
| `useBankReconciliation`(+Controller) | reconciliation | bank | recon | Money banking | Query | ACTIVE |
| `useDepositWorkspaceController` | deposits | deposits | deposits | Money funds | Query | ACTIVE |
| `useFinancialReports` | financials/reports | reports | report data | Reports | Query | ACTIVE |
| `useReportsWorkspace`/`use-general-ledger-core`/`use-reports-workspace` | reports | reports | workspace data | ReportsShell | Query | ACTIVE |
| `use-maintenance`/`useMaintenancePageController` | maintenance | maintenance | list/form ctrl | /maintenance | Query | ACTIVE |
| `useServiceProviders` | service-providers | providers | providers | /service-providers | Query | ACTIVE |
| `useCompanySettings`/`useCostCenters`/`useDocumentSettings`/`usePaymentTerms` | settings | settings | company sections | settings registry | Query | ACTIVE |
| `useSettingsSection`/`useSettingsPageController` | settings/form | settings | section drafts | settings | — | ACTIVE |
| `useEmployeePermissionManagement`/`usePermissionRequestReview` | governance-hub | perms | users/perms + review | UserRolesWorkspace | — | ACTIVE |
| `useSmartAssistant`/copilot hooks | ai-assistant | AI | assistant conversation | AI page/global | edge | ACTIVE |
| `useAssistantSpeech` + speech hooks | ai-assistant/speech | AI TTS | voice | AI | web speech | ACTIVE |

Classification coverage: query hooks (useInvoices…), mutation hooks (invoice-actions, expense-actions, action-service), forms (useContractForm, useSettingsSection), auth (useAuth), permission (permission hooks in governance), responsive (useUiStore/visual viewport), navigation (useUnsavedChangesGuard), domain (financialMath, helpers), utility (useDebounce). This list is representative; full per-feature enumeration is `UNKNOWN_NEEDS_REVIEW` at the row level.

---

## 13. State Architecture

| State owner | Path | Type | Responsibility | Consumers | Persistence | Canonical | Duplicate/risk |
|---|---|---|---|---|---|---|---|
| Auth/session/effective perms | `hooks/use-auth.tsx` + auth service | React context | session, authorization, canAccess | app-wide | supabase (cookie/local) | CANONICAL | effective-permissions loaded async; role default client map is compatibility (§16) |
| Active company | `hooks/use-company.tsx` | context | company scope | app-wide | DB/claimed | CANONICAL | `lib/companySettings.ts` + `useCompanyFormatters` overlap |
| UI store | `store/ui-store.ts` | Zustand | theme, sidebars, misc UI | shell, tests | none (zustand persist?) | CANONICAL | small |
| Command palette store | `features/command-palette/command-palette-store.ts` | Zustand | palette open state | shell | none | CANONICAL | — |
| React Query cache | `providers/query-client.ts`, `lib/query-keys.ts`, `lib/data/query-keys.ts` | server cache | all data | features | in-memory | CANONICAL | **two query-keys files** (§23) |
| URL/route state | TanStack Router `search` (section/view/quickAdd/companySection/workspace) | URL state | finance/settings/maintenance navigation | FinancePage, GovernanceHub, maintenance | URL | CANONICAL | deep links rely on it |
| Theme/dark/light | `lib/brand`, app-shell header (Sun/Moon) | local store/UI | dark-first+light | shell | ? | CANONICAL | verify persisted key |
| Locale/RTL | `lib/i18n.ts` | module | direction/lang | root | — | CANONICAL | |
| PWA state | `lib/pwa-{install,update}.ts` | module | update lifecycle/install | root/shell | SW | CANONICAL | |
| Feature-flag-like | `env.ts`, `import.meta.env.DEV/VITE_E2E` | env | dev/e2e gating | routes (design-system, devtools) | env | CANONICAL | no central FF registry found |
| Money view permission state | `financeShellModel.ts` + `FinancePage` | derived | permitted sections/views | Money | derived | CANONICAL | |
| Company section drafts | `settings/form/sectionDrafts.ts` | module/local | draft persistence | settings | ? | ACTIVE | persistence risk if unpersisted |

Risks: finance navigation state (section/view) is entirely URL-driven and duplicated between route-contract `viewBinding` and `financeShellModel`; a change to section ids in one and not the other would break deep links (guarded by tests `route-nav-map`, `phase2-canonical-ia`, `finance-task-first-ux`). Zustand usage is minimal by design (only UI + palette); React Query owns data cache. Confirmed two query-keys authorities.

---

## 14. Data Access Map

Chain target: `UI → Hook → Query/Mutation → Service → lib/supabase → RPC/table → RLS`. Supabase client is `src/lib/supabase.ts`; DB types `src/types/database.ts`.

Representative map (see also §4/§11):

| Data capability | UI consumer | Hook | Service/Repo | DB object | RW | Permission | Canonical path | Alt path |
|---|---|---|---|---|---|---|---|---|
| Company settings | Settings sections | useCompanySettings | `settings/companySettingsService.ts` | company tables | RW | company.settings.manage | ✔ | `lib/companySettings.ts` also touches settings |
| Cost centers | settings | useCostCenters | `costCenterService.ts` | cost center table | RW | cost_centers.manage | ✔ | `financials` old? |
| Payment terms | settings | usePaymentTerms | `paymentTermsService.ts` | — | RW | — | ✔ | — |
| Owners/owner dossier | owners pages | use-owner-options + hooks | `services/owner-workspace-service.ts`, `owners/services/*` | owners/units/properties | RW | owners.* | ✔ | owner-options.ts duplicate option loader |
| Property workspace | properties | — | `services/property-workspace-service.ts` | properties/units | RW | properties.* | ✔ | — |
| Contracts | Leasing/contract | useContracts etc | contracts/services + hooks | contracts + RPCs (terminate/soft-delete/one-live-draft) | RW | contracts.* | ✔ | legacy direct calls must pass guard |
| Invoices | Money | useInvoices | `financials/invoices/invoiceService.ts` + `invoice-actions` | invoices + RPC | RW | invoices.generate/export | ✔ | — |
| Payments | quick collect | usePayments | `payments/paymentService.ts` | payments/receipt RPC | W | payments.create | ✔ | — |
| Receipts | Money receipts | useReceipts | `receipts/receiptService.ts`, `receipt-print` | receipts | RW(print) | receipts.void | ✔ | ReceiptDetailPage deep-link path via `/receipts?receiptId=` |
| Expenses | Money | useExpenses | `expenses/expenseService.ts`,`operational-expenses` | expenses | RW | expenses.write | ✔ | — |
| Owner settlements | Money funds | — | `owners/services/owner-settlements-service` | settlement RPC | RW | approve/pay | ✔ | — |
| Deposits | Money funds | useDepositWorkspaceController | `deposits/deposit-service.ts` | deposits RPC | RW | deposits.view | ✔ | — |
| Bank reconciliation | Money banking | useBankReconciliation | `bankReconciliationService.ts`,`bankCsvImportService` | RPC | RW | match | ✔ | bankCsvParser (lib) parse helper |
| Fixed monthly accruals | Money fees | — | `fixed-monthly-accrual-service.ts` | RPC | RW | execute/reverse | ✔ | — |
| Reports data | Reports | useFinancialReports + accounting hooks | `financials/reports/*` + `accounting/*` | RPC/views | R | reports.view/export | ✔ | **three service layers** (§23) |
| GL/statements | Reports accounting | accounting hooks | `accounting/reports/*` | GL RPC/views | R (write server) | reports.view | ✔ | journal writes hidden/server |
| Audit | settings | — | `audit/services/audit-log-service.ts` | audit RPC | R | audit.view | ✔ | — |
| Data integrity | settings | — | `system/services/data-integrity-service.ts` | integrity RPC | R | integrity.view | ✔ | — |
| Maintenance | /maintenance | use-maintenance | `maintenance/maintenance-service.ts` | maintenance + RPC | RW | maintenance.* | ✔ | — |
| Utilities | maintenance utilities | — | utilities services | utility tables/RPC | RW | maintenance.create | ✔ | — |
| Providers | service-providers | useServiceProviders | `service-provider-service.ts` | providers | RW | service_providers.* | ✔ | — |
| User/roles/perms | settings users | governance hooks | `user-roles-service.ts` | company_members/effective RPC | RW | users.manage | ✔ | — |
| AI | AI page | useSmartAssistant | `ai-assistant/services/ai-assistant-operating-service.ts` | edge `ai-assistant` | R(read) | guardrails | ✔ | — |
| Attachments/documents | dossiers | use-attachment-upload | `services/documents/attachment-storage-service.ts` | storage + tables | RW | documents.write | ✔ | — |
| Contextual docs | dossiers | — | `services/documents/contextualDocumentsService.ts` | storage/registry | RW | documents.write | ✔ | — |
| Tenant/owner portal | portals | — | server snapshot RPCs | portal projections | R | portal claim | ✔ | `tenants/tenant-portal-admin-service.ts` (admin link mgmt) |
| Notifications | header | — | `app/layout/app-notifications-service.ts` | notifications RPC `mark_app_notification_read` | RW | — | ✔ | — |

**Direct-DB/bypass watch:** repo guards target "no presentation direct Supabase data-plane access" and "no unsafe direct financial writes" (`rentrix-app/scripts/check-architecture.mjs`, `rentrix-app/src/lib/supabase-client-boundary.test.ts`, `rentrix-app/src/lib/r10-financial-as-any-guard.test.ts`, `scripts/check-no-new-legacy-journal-writes.mjs`, `frontend-backend-db-contract`). Rule `SEC-009` and `DATABASE_RULES.md` ban browser free-form journal writes. Competing wrappers: `lib/companySettings.ts` vs `settings/companySettingsService.ts`; owner option loading in `services/owner-options.ts` + `hooks/use-owner-options.ts`; report aggregation across `financials/reports`, `accounting/reports`, `reports` (needs consolidation review, §23).

---

## 15. DB Contract Map (repo-level; read-only)

Source: `supabase/migrations/*.sql` (70 timestamp-numbered migrations: `20260830223142` + `20260901000000`–`…068`; dir also holds `README.md` and `rls_per_table/` reference material), `src/types/database.ts`, `DATABASE_RULES.md`, canonical docs 3/4/5. This is a structural map from migration names and client references; it does **not** modify DB.

| Area | DB objects (evidence) | App consumers | Security | Usage/notes |
|---|---|---|---|---|
| AI assistant RPC | `ai_assistant_postgrest_rpc_repair`, budget idempotency (migrations `…242/…002/…068`), Edge fn `ai-assistant` | ai-assistant service/guardrails | read-only, budget, safety (`_shared/ai-safety.ts`) | ACTIVE |
| Company/tenant/members | migrations `…08/09 six_role`, `…39–41 employee effective perms/deps`, `…51 granular employee`, `…55 permission boundary closeout`; `company_members_six_role` | users/roles/permissions UI + RPC | RLS, effective perms | ACTIVE; six-role constraint + authority |
| Contracts | `…010 one_live_draft_per_unit_tenant`, `…022 soft_delete_contract_atomic_uuid`, `…061 terminate_contract uuid`, `…011 require_active_contract_before_invoice_posting` | contracts services/hooks/RPC | SECURITY DEFINER | ACTIVE |
| Financial precision/GL | `…029 normalize_financial_precision_omr_3dp`, `…032 commission_deal_identity_omr`, `…034 collections_payments_period_close`, `…056 revoke_browser_execute_internal_gl_rpcs`, GL RPCs `gl_pm_*`/`gl_ml_*` (referenced in AGENTS) | accounting/reporting services | browser GL write revoked; server-owned | ACTIVE; journal writes hidden |
| Bank reconciliation | `…025–027`, `…030 audit schema`, `…033 fail closed`, `…057 governed_bank_statement_line_writes`, `…058 bank_statement_permission` | reconciliation service/CSV import | RPC validation, fail-closed | ACTIVE |
| Security definer/authority | `…014–017 security definer hardening/permission boundary`, `…021 browser_rpc_canonical_identity_guards`, `…028 secure_function_default_privileges`, `…063 rls_auth_initplan_optimization` | global | hardening | ACTIVE |
| Revocation of internal RPCs | `…018 revoke_wp05_internal_rpc`, `…019 revoke_recalculate_unit_statuses`, `…020 revoke_internal_and_trigger_rpc_execute`, `…056` | none (revoked) | revoked browser-exec | LEGACY/cleanup targets in DB are intentional revocations |
| Maintenance/utilities | `…038 maintenance_completion_utility_actual_payer`, `…053 maintenance_transition_permission` | maintenance service | RLS/perms | ACTIVE |
| Short-stay lease | `…037 short_stay_lease_mode`, `…047 date_driven_expiry`, `…048 unit_short_stay_reference_rate`, `…049 extend_short_stay_atomic` | contracts short-stay tests | RLS | ACTIVE |
| Portals | `…042 tenant_portal_secure_link`, `…043 snapshot_hardening`, `…044 external_portal_read_links`, `…045/046 owner/tenant portal canonical projection`, `…062 owner_portal_vault_company_scope` | portals | bearer/claim, read-only | ACTIVE |
| Notifications | `…023 mark_app_notification_read_governed_rpc` | notifications-menu | RPC | ACTIVE |
| Attachments/storage | `…035 tenant_scoped_attachment_storage`, `…036 frontend_backend_contract_acl_storage_fix` | attachment-storage service | storage RLS/ACL | ACTIVE |
| Cash-flow / financial reports | `…066 canonical_cash_flow_rpc_transition`, `…067 repair_legacy_cash_flow_compatibility`, `…064 financial_report_rpc_permission_boundary`, `…065 financial_reports_view_permission_catalog` | reporting | view catalog perms | ACTIVE; **…067 is explicitly a legacy-compatibility repair migration** |
| RLS reference material | `supabase/migrations/rls_per_table/` (non-migration reference) | governance/audit | — | reference; not applied |
| Seed | `supabase/seed.sql` | local/staging | — | staging seed |

DB objects with **no obvious direct app consumer** and flagged possible-legacy/revoked (do not delete based on frontend alone): the set of revoked internal RPCs (`…018/019/020/056`) and legacy cash-flow compatibility `…067` are intentional; those exist to lock closed surfaces. Actual schema object-level enumeration (every table/view/function) was **not** performed row-by-row here → mark `UNKNOWN_NEEDS_REVIEW` for a full per-object owner map. `supabase/config.toml` is gitignored (generated/local); not present.

---

## 16. Auth & Permissions Map

Auth stack: Supabase sessions; TanStack Router `beforeLoad` guards. UI persona model = Office Owner/Employee over the authoritative six-role + 61-capability backend model.

Route-guard inventory (from `route-tree.ts` `requirePermission` + `route-guards.ts` + `app/providers`):

| Area/capability | UI visible | Route guard | Backend/RLS | Roles (base map) | Notes |
|---|---|---|---|---|---|
| Login/session | yes | authRoute redirects if session | supabase.auth | — | |
| Any protected | — | protectedRoute (session) | RLS | — | shell parent |
| Dashboard | yes | none (default) | `app.dashboard.view` base | all roles incl USER/VIEWER | |
| Properties | yes | `properties.view/create/edit` | RLS | MANAGER/OPERATIONS etc | properties.archive exists in perms; not in route? |
| Lands | yes(child) | `lands.view` | RLS | MANAGER/… | Phase2 |
| Owners | yes(child) | hub/detail view | RLS | MANAGER/OPERATIONS/VIEWER | |
| Contracts | yes | `contracts.view/create/edit` | RLS + RPC | MANAGER/OPERATIONS/VIEWER | |
| Tenants/People/Leads/Communication | via contracts | contracts.view + leads/communication perms | RLS | — | |
| Money workspace | yes | per-view perms (financeShellModel) | RLS/RPC | ACCOUNTANT etc | arrears view hidden in section nav for some |
| Reports | yes | `financial.reports.view` | RPC/view catalog | ACCOUNTANT/MANAGER/VIEWER | export separate perm |
| Maintenance/Services | yes | `maintenance.view` | RLS/RPC | OPERATIONS | |
| Settings company | yes | `company.settings.manage` | RLS | ADMIN/OWNER | |
| Users/permissions | yes | `users.manage`/`permission_requests.review` | RPC effective perms | ADMIN | |
| System/Audit/Integrity | hidden | `system.view`/`audit.view`/`integrity.view` | RPC | ADMIN/ACCOUNTANT(audit) | ACTIVE_HIDDEN tabs |
| Automation | hidden | `automation.view` | RPC | MANAGER etc | |
| Change password | hidden (own) | `auth.password.change` | supabase | all (USER/VIEWER too) | base roles include it |
| Admin support | hidden | `support.operations.view` | RPC | MANAGER/support | |
| AI assistant | yes | none (no office perm) | guardrails | — | global read-only |
| Service providers | child | view/write | RLS | — | |
| Owner portal | external | bearer + owner scope | server snapshot | owner claims | outside office perms |
| Tenant portal | external | tenant claim | server snapshot | tenant claims | outside office perms |

**Role→perm defaults** (`permissions.ts` rolePermissions): ADMIN = all; MANAGER = broad ops incl most finance action perms but **not** owner_settlements.approve/pay; ACCOUNTANT = finance/audit read + action; OPERATIONS = properties/contracts/maintenance/service + expenses/arrears; USER = dashboard + password; VIEWER = broad read. Effective server perms override these defaults (documented). **Owner overrides server-resolved and take precedence; employee overrides cannot deny ADMIN** (comment in permissions.ts).

**Gaps/concerns:** (a) client `rolePermissions` is a "compatibility default" map and can drift from server; guarded by effective-permission tests + `r5-authorization-matrix`, `granular-*` tests. (b) Route `beforeLoad` permission vs nav-item permission must match — enforced by route-nav-map/permission-visibility tests. (c) finance "view" perms are granular but the shell computes `getPermittedSections/Views` client-side; server RPC remains authority. (d) Tenant/owner portals rely on server scope not client knowledge (correct). Full per-capability backend enforcement matrix lives in `DATABASE_RULES.md` and repo test scripts (`test:supabase:rls` matrix, `privileged-key-scan`), which were not run (analysis only).

---

## 17. Settings & Governance Deep Census

Settings surface is split: **(A) Governance Hub** (`features/governance-hub`) is the `/settings` page and owns section routing; **(B) Company settings registry** (`features/settings`) provides the "company" tab content; **(C) older standalone settings pages** remain as lazy-mount targets for the hub's sections (all confirmed active, not orphaned — see below).

Governance hub sections (`governance-hub-sections.ts`) and their primary-nav visibility:

| Capability | Route (section) | Content owner | Nav | Permission | Status |
|---|---|---|---|---|---|
| Company settings | `/settings?section=company&companySection=` | `features/settings/settings-page.tsx` `SettingsWorkspace` | primary tab | company.settings.manage | ACTIVE |
| Users & permissions | `section=users-permissions` | `governance-hub/UserRolesWorkspace` | primary tab | users.manage / permission_requests.review | ACTIVE |
| Cost centers | `section=cost-centers` | settings/cost-centers-settings-section | hidden tab | cost_centers.manage | ACTIVE_HIDDEN |
| Automation | `section=automation` | `automation/components/automation-workspace` (`AutomationCenterView` register) | hidden | automation.view | ACTIVE_HIDDEN |
| System settings | `section=system-settings` | `features/system/system-page.tsx` `SystemWorkspace` | hidden | system.view | ACTIVE_HIDDEN |
| Audit log | `section=audit-log` | `audit/audit-log-page.tsx` + audit-log-view | hidden | audit.view | ACTIVE_HIDDEN |
| Data integrity | `section=data-integrity` | `system/data-integrity-page.tsx` | hidden | integrity.view | ACTIVE_HIDDEN |
| Security (change password) | `section=security` | `auth/change-password-page.tsx` | hidden | auth.password.change | ACTIVE_HIDDEN |

Company settings registry (`settings/registry/sectionRegistry.ts`, visible set from `getVisibleSettingsSections`): office ✔, identity ✔, documents ✔, finance-readiness ✖, cost-centers ✖, payment-terms ✖, notifications ✔, system ✔ (showInPrimaryNavigation flags). Company tab also reachable from legacy `/system`? No — legacy maps to governance sections as above.

Deeper company sections: `sections/OfficeSection`, `IdentitySection`, `DocumentsSection`, `FinanceReadinessSection`, `NotificationsSection`, `SystemSection`, `CostCentersSection`, `PaymentTermsSection`. Supporting: `settings/settingsSections.ts` is a **re-export compatibility seam** over `registry/sectionRegistry.ts` (explicitly "no second source of truth").

Hidden/internal settings-related capabilities discovered: Finance Readiness (`financials/billing/billing-readiness-*`, `tax-authority/finance-readiness-section`), system settings, document-readiness gate (`settings/document-readiness-*`), `companySettingsContractAdapter.ts` (adapter residue).

Legacy standalone page modules that still export workspaces now mounted under the hub: `features/settings/settings-page.tsx`, `features/system/system-page.tsx`, `features/audit/audit-log-page.tsx`, `features/system/data-integrity-page.tsx`, `features/auth/change-password-page.tsx`. Each previously had its own top-level route; routes now redirect to `/settings?section=…`. Those files are ACTIVE (lazy-mount targets) not orphaned.

---

## 18. Reports / Printing / Documents Census

Reporting layers (three coexisting service roots, §23): `features/reports/**` (workspace/product), `features/accounting/reports/**`, `features/financials/reports/**`. Document engine `src/services/documents/**` + specifications docs list 24 documents (`specifications/24-documents-contract-specification.md`, `24-documents-source-inventory.md`).

| Capability | File | Domain | Screen | Print | Export | Data source | Canonical | Duplicates |
|---|---|---|---|---|---|---|---|---|
| Report catalog | `reports/workspace/*`, `ReportsCatalog`, `ReportsShell` | Reports | yes | — | — | directory groups (`report-directory-groups.ts`) | ✔ | — |
| Collections panel | `reports/components/collections/daily-collections-panel.tsx` | Reports | yes | — | export | reporting service | ✔ | |
| Rent roll | `reports/components/collections/rent-roll-panel.tsx` | Reports | yes | — | — | reporting | ✔ | |
| Overdue panel | `reports/components/overdue/overdue-invoices-panel.tsx` | Reports | yes | — | export | reporting | ✔ | |
| GL core section | `reports/components/GeneralLedgerCoreSection.tsx` | Accounting | yes | — | export | accounting | ✔ | duplicate accounting roots |
| Accounting reports (IS/BS/TB) | `reports/components/accounting/*` panels | Accounting | yes | export | — | accounting | ✔ | |
| Statements | `financials/reports/statements-*`,`accounting/reports/statements/*`,`reports/components/statements/*` | Financials | yes | — | PDF/Excel | statements service | ✔ | **3 statement service roots** |
| Premium report product | `reports/premium/report-product-page.tsx` | Reports | yes | — | PDF/Excel | document engine | ✔ | |
| Professional owner/property reports | `reports/documents/professional-{owner,property}-report.ts`, `premium-owner-report.ts` | Reports | doc | PDF | — | document engine | ✔ | |
| Contract documents | `contracts/contractDocumentsService.ts`,`contracts/documents/*`,`contractDocumentsShell` | Leasing | doc | PDF | — | document engine | ✔ | |
| Owner documents/statement | `owners/documents/*` | Owners | doc | PDF | — | engine | ✔ | |
| Maintenance documents | `maintenance/documents/maintenance-documents.ts` | Services | doc | PDF | — | engine | ✔ | |
| Deposit vouchers/clearance | `financials/deposits/deposit-{voucher,clearance}-document.ts` | Money | doc | PDF | — | engine | ✔ | |
| Receipt print | `financials/receipts/receipt-print.ts` | Money | print | PDF | — | receiptService | ✔ | ReceiptDetailPage deep-link renderer separate |
| Report share/output actions | `reports/components/{report-share,report-output,report-document}-actions.tsx` | Reports | — | — | PDF/Excel | engine | ✔ | overlapping with export-menu |
| Utilities documents | `utilities/documents/*` | Services | doc | PDF | — | engine | ✔ | |
| General CSV/XLSX | `lib/{csvExport,xlsx-export,tabular-export}.ts`, `bankCsvParser.ts` | Shared | — | — | CSV/XLSX | local | ✔ | xlsx/csv + tabular overlap |
| PDF/HTML renderer | `services/documents/renderer/{latinPdf,professionalDocumentHtml,pagination,offscreen,documentHtml}.ts` | Docs | render | PDF | — | jspdf/html2canvas | ✔ | latin vs professional doc variants |
| Company identity/templates | `services/documents/companyIdentity.ts`, `documentRegistry.ts`, spec `…24-documents…` | Docs | header/footer | — | — | settings | ✔ | legacyPayloadAdapters COMPATIBILITY |
| Screen-vs-print semantics | panels + document builders share same services/read models | — | — | — | — | — | ⚠ must verify per report that print payload matches on-screen rows (report-period, documents tests guard) | |

Notes: screen rendering and printing share data services (e.g., statements) but the engine also has `documentPayloads.ts` vs `legacyPayloadAdapters.ts`/`documentCompatibilityTypes.ts` — a documented compatibility seam. Print/export permission `financial.reports.export` is separate from view (enforced at report page/actions), consistent with the route comment in route-tree.

---

## 19. AI Assistant Architecture

| Capability | File | Runtime entry | Context/data | Permissions | UI surface | Status |
|---|---|---|---|---|---|---|
| Assistant page | `features/ai-assistant/ai-assistant-page.tsx` | `/ai-assistant` | route-aware | read/guardrails | full chat | ACTIVE |
| Global action / dock entry | `ai-assistant-global-action.tsx` | app shell | global | — | floating/dock | ACTIVE |
| Surface context provider | `ai-assistant-surface-context.ts` | provider | current route/entity | — | context | ACTIVE |
| Intent/navigation | `ai-assistant-intent.ts`, `ai-assistant-navigation.ts` | assistant | navigate user | — | — | ACTIVE |
| Response model | `ai-assistant-response-model.ts` | — | classify/limit | — | — | ACTIVE |
| Copilot actions | `services/ai-assistant-copilot-actions.test` | copilot | draft/suggest | prohibited sensitive | page | ACTIVE |
| Operating service | `services/ai-assistant-operating-service.ts` | edge fn `ai-assistant` | permission-filtered read | guardrails | — | ACTIVE |
| Guardrails | `services/ai-assistant-guardrails.ts` | boundary | no approve/pay/void/journal | — | — | ACTIVE |
| Service/wiring | `services/ai-assistant-service.ts` | edge | read models | — | — | ACTIVE |
| Quota/budget | migration `…002 budget_idempotency`, quota tests | edge | budget | — | — | ACTIVE |
| Speech (TTS/voice) | `speech/*` (assistant-speech, use-assistant-speech, text, controls, ios-webkit) | AI surface | browser speech | — | voice | ACTIVE |
| Edge shared | `supabase/functions/_shared/{ai-contract,ai-safety,openai-compatible-adapter}.ts` | edge | safety/adapters | — | — | ACTIVE |

AI trust boundary documented (SEC §05 + docs): read/explain/suggest/navigate/draft only; no silent sensitive-action authorization; no arbitrary journal entries. Route/entity awareness via surface context; unsupported/sensitive actions answered but not executed. AI route has no office permission (any signed-in user). Tenant/owner portal surfaces intentionally do **not** include AI (portals are separate constrained surfaces).

---

## 20. PWA / Notifications / Background / Runtime

| Item | Files | Behavior |
|---|---|---|
| Service worker | `rentrix-app/vite.config.ts` (VitePWA, registerType prompt, injectRegister:false, workbox globPatterns; navigateFallback disabled) | prompt-based update |
| Update flow | `src/lib/pwa-update.ts` (registerPwaUpdateLifecycle) wired in `routes/__root.tsx` toast "تحديث الآن" | waits to apply |
| Install | `src/lib/pwa-install.ts` imported in `index.tsx`; `components/layout/pwa-install-prompt.tsx` + tests | install prompt UI |
| Offline/caching | vite-plugin-pwa workbox; globals.css; manifest handled by platform (manifest:false) | — |
| In-app notifications | `app/layout/notifications-menu.tsx` + `.test/.visual-wave-1`, `app-notifications-service.ts`; RPC `mark_app_notification_read_governed_rpc` | header bell |
| Notification read RPC | migration `…023`; tests `notification-read-state-rpc.test.ts` | governed |
| Background Edge Function | `supabase/functions/background-worker/index.ts`; migration `…006 background_job_foundation` | scheduled/background jobs (AI/worker) |
| Scheduled/automation | `features/automation/**` + `…` background_job foundation | automation rules UI + worker |
| Runtime viewport | `routes/__root.tsx` visualViewport CSS vars | mobile UX |
| Fonts/brand | `lib/product-fonts.ts`, `lib/product-fonts-contract.test` loaded in index | load Arabic/Latin fonts |

Offline-first nuance: because navigateFallback is disabled and PWA registration is manual/prompt, offline fallback is limited/non-spa-fallback by design. Not deeply analyzed (runtime), flagged UNKNOWN for offline coverage.

---

## 21. Test Architecture Census

- **In-src Vitest:** 497 files under `rentrix-app/src` matching `*.test.ts(x)`/`*.spec.ts`. Categories: unit (per-feature `*.test`), contract (`*-contract.test`, `frontend-design-drift`, `ux-completion-contract`, `route-contract`, `supabase-client-boundary`), pglite integration (`*.pglite.test.ts`), a11y/axe (`primitives.axe`, `*.axe`), visual/layout (`*.visual-wave-1`), architecture guards (`architecture-guard-v2.test`, `canonical-table-usage`, `active-register-inventory`), security (`r5-authorization-matrix`, `platform-security-contract`, `supabase-error`), money/business-rules (`money`, `financial-*`, `omr-precision`, `r*` lifecycle).
- **E2E (Playwright):** `rentrix-app/e2e/*.spec.ts` (21) covering login, dashboard, contracts entity-table, owners, maintenance, reports-premium-catalog, service-providers, new-modules, documents-vault/route, document-platform, ux-foundation, design-system, plus `e2e/support/{fake-supabase-backend,pdf-artifact,screenshot-validity,document-acceptance-session}` harnesses.
- **Repo-level scripts/tests (JS):** migration hygiene/rollback, canonical business rules, 10-stage execution plan, enterprise-freeze, gl-write-boundary, doc-link checks, pilot-seed, production-demo-preflight, qa-preflight; supabase test runners (`test:supabase`, `test:supabase:rls`, `privileged-key-scan`); db0 audit/gen-types/gate; guardian governance. Not run here (analysis only).
- **Fixtures/mocks:** `e2e/support/fake-supabase-backend.ts`, `services/mock-role-simulator.ts`, `*e2e-fixture.tsx` VITE_E2E components, `p0/replay-stubs.ts`, `p1/replay-bootstrap.ts` (replay/seed helpers).

Test areas vs targets:

| Test area | Files | Protects | Kind | Active feature | Missing/notes |
|---|---|---|---|---|---|
| Route/nav/IA contract | route-contract/route-nav-map/phase2-canonical-ia/permission-visibility/app-nav-items/active-nav | IA, perms, deep links | contract | global IA | strong |
| Register foundation | active-register-inventory + check script + canonical-table-usage + entity-table.mobile-summary | table unification | guard | registers | strong |
| Authz | r5-authorization-matrix, permissions, effective-*, granular-*, permission-workflow.integration | role/perm model | unit/integration | users/perms | strong |
| Financial safety | money/moneyNormalization/omr-precision/invoice-payment-safety/paymentService/financials pglite | financial truth | unit/integration | Money | strong |
| Business rules/lifecycle | contracts r4/ux041/activation, maintenance r8/r13, dashboard r1/r13, owners p1 settlements | business | integration | core journeys | — |
| Settings/governance | settings-page/workspace-model/phase0-settings-auth, governance-hub, system-governance | settings | unit | Settings | — |
| AI | ai-assistant page/speech/quota/guardrails tests | AI | unit/integration | AI | — |
| DB/RLS (script, not run) | scripts/supabase-tests, guardian, db0 | live schema/RLS | contract/script | backend | not executed here |

**Observed: very strong in-src test depth; risk is that many `*test` files protect possibly-obsolete/legacy routes (e.g. tests around old standalone finance pages, `/documents-vault` route).** Some active new modules have thinner unit coverage (e.g. portals, premium reports partly doc-tests). Full per-file test mapping → UNKNOWN_NEEDS_REVIEW.

---

## 22. Hidden / Unreachable Capability Report

What exists but a normal user may never discover from the UI (all reachable by deep URL, per governance "hidden from routine UX"):

| Capability | Exists | UI entry | Route entry | Direct URL works | Permission | Why hidden | Intended? | Evidence |
|---|---|---|---|---|---|---|---|---|
| Audit log | yes | no primary nav | `/settings?section=audit-log` (also `/audit-log`) | yes | audit.view | specialist | YES (lock) | governance-hub-sections showInPrimary=false; route redirect |
| Data integrity | yes | no nav | settings?section=data-integrity (`/data-integrity`) | yes | integrity.view | specialist | YES | same |
| System settings | yes | no nav | settings?section=system-settings (`/system`) | yes | system.view | specialist | YES | same |
| Automation | yes | no nav (hidden tab) | settings?section=automation (`/automation`) | yes | automation.view | specialist | YES | same |
| Admin support ops | yes | no nav | `/admin-support` | yes | support.operations.view | specialist | YES | route only |
| Deposits (as a Money sub-view) | yes | not a global 7-roots nav root, but present as the `deposits` view under the Money `funds` primary section | Money funds/deposits (deep link `/deposits` redirect) | yes (in Money) | financial.deposits.view | no global-nav root; permission-gated view | YES | financeShellModel: funds `showInPrimaryNavigation:true`; deposits view `permission: financial.deposits.view` |
| Fixed monthly accruals | yes | Money "fees" section (routine? fees primary) | Money fees | yes | accrual.* | partially | YES | financeShellModel fees |
| Journal / GL accounting raw | yes (data) | Reports accounting (read); no journal entry UI | reports | yes (read) | financial.reports.view | journal write server-only, no browser authoring | YES | SEC-009 |
| Change password | yes | no top nav | settings?section=security (`/change-password`) | yes | auth.password.change | hidden in hub nav but accessible | YES | |
| Onboarding | code present, **active on Dashboard** | OnboardingChecklist rendered on `/dashboard` when incomplete | — | — | yes (dashboard) | active | YES (dashboard checklist) | |
| Receipt detail (standalone) | yes | not in primary nav | Money receipts embedded; `/receipts?receiptId=` standalone | yes (w/ receiptId) | financial | deep-link detail used by ReceiptsWorkspace | YES | `receipts-page.tsx` imports ReceiptDetailPage; renders when !embedded && receiptIdFromSearch |
| Legacy finance standalone pages | yes | — | redirect | via old links | — | collapsed into Money shell | COMPATIBILITY | route redirects |
| Generic Documents Vault | yes | no nav | `/documents-vault`→ maintenance section documents_vault | yes | maintenance.view | lock: documents contextual-first | YES | route comment |
| Generic People | yes | no nav | `/people` | yes | contracts.view | lock: identity canonical, people not a pillar | YES | route-contract |
| `/dev/design-system` | yes | no nav | `/dev/design-system` | DEV only | — | dev showcase | YES (DEV) | route guards DEV |

The canonical Target Architecture Lock explicitly says "Deposits, Automation, Data Integrity, Audit/System and raw accounting/journal surfaces are hidden from routine UX, not deleted from the governed core." So hidden status here is **intentional and documented**, not accidental. (Onboarding and ReceiptDetailPage are not "hidden" — they are Dashboard-slot and `/receipts?receiptId=` deep-link surfaces respectively.)

---

## 23. Overlap / Compatibility Implementations (re-verified)

The earlier draft overused the word **duplicate**. This table now separates real overlap from intentional layering, compatibility, and different presentation contexts.

| Concept | Actual relation | Evidence | Disposition | Risk |
|---|---|---|---|---|
| Query-key helpers | **Real small overlap**: `lib/query-keys.ts` provides `defineEntityKeys` + `invalidateEntity`; `lib/data/query-keys.ts` provides only `createEntityQueryKeys` with the same `all/list` shape | root helper used by Contracts/Invoices/Expenses/Receipts; data helper used by Lands/Leads (+ unit test) | migrate Lands/Leads to the richer root helper; remove list-only helper only after parity tests | LOW–MEDIUM |
| Brand exports | `MalikBrand` / `MalikMark` / `MalekBrandWordmark` are all active and represent the same visual identity | public/auth/PWA vs app-shell consumers | keep; naming cleanup only if desired | LOW |
| Reports folders | **Intentional layering, not three authorities**: `features/reports` = UI/workspace; `features/accounting/reports/accountingReportsFacade.ts` explicitly declares the **SINGLE** accounting import boundary; `features/financials/reports/financialReportsService.ts` explicitly declares itself a facade/domain aggregator | source comments + ADR 0008 + current imports | do **not** merge folders by pathname; preserve authority boundaries | LOW |
| Statement services | **Different capabilities**: accounting `statementsService.ts` is a fail-closed aggregate compatibility surface because no aggregate RPC exists; financial `statements-reports-service.ts` implements tenant/owner statement RPCs | service comments + RPC calls | keep distinct | LOW |
| Settings files | **One workspace + helpers**: `SettingsWorkspace` is the renderer; `settings-workspace-model.ts` only builds summary tiles; `sectionRegistry.ts` is the declarative registry | direct imports in `settings-page.tsx` | keep; no settings-workspace consolidation project | NONE |
| Receipt detail surfaces | **Different presentation contexts**: `ReceiptDetailCard` is compact embedded detail inside Money; `ReceiptDetailPage` is the full deep-link/print/PDF document surface | `ReceiptsWorkspace` deliberately chooses page vs embedded card by `embedded` + `receiptId` | keep both; share lower-level presenters only if drift appears later | LOW |
| Money shell/workspaces | **Canonical composition**: `FinancePage`/`financeShellModel` own navigation and embed `features/financials/*` workspaces | ADR 0008 + Finance source/tests | keep | NONE |
| Contract create/edit | two mount points of one shared `ContractFormModal` | route shell + Contracts list | keep | LOW |
| Tenant dossier | one shared `TenantDossierContent` rendered by a real detail page and preview dialog | `TenantPreviewDialog.tsx` exports all three | keep | LOW |
| Register primitives | `EntityTable` / `DataTable` / base `Table` are layered primitives | active-register inventory + UI primitives | preserve foundation contract | LOW |
| Company-settings access wrappers | `settings/companySettingsService.ts` and `lib/companySettings.ts` both exist | consumer map not fully re-derived | `UNKNOWN_NEEDS_REVIEW`; do not delete | UNKNOWN |
| Owner-option loading seams | service/hook/workspace helpers coexist | consumer map not fully re-derived | `UNKNOWN_NEEDS_REVIEW`; do not delete | UNKNOWN |
| State surfaces | `state-surfaces.tsx`, `loading-state`, `error-state`, `AsyncContentState` coexist | semantics not fully diffed | audit when touched; no blanket merge | UNKNOWN |

---

## 24. Dead / Legacy / Compatibility Code

### A. Dead-code candidates
**No file was confirmed dead.** Reachability checks (route tree + lazy import + non-test inbound import + nav) were performed on every candidate considered; each resolved to an active or legacy-but-retained state. Remaining "dead-looking but unproven" items are listed under §30 as UNKNOWN.

### B. Orphaned features
| Feature | Files | Why orphaned | Existing runtime entry | Data deps | Confidence |
|---|---|---|---|---|---|
| Standalone legacy finance register *routes* (invoices/arrears/deposits/etc as full pages) | `financials/*/*-page.tsx` | top-level routes now redirect to Money shell; each module still **exports `*Workspace`** consumed by FinancePage | Money shell (workspace exports); legacy route redirect | same services | MEDIUM that standalone full-page path is unused; HIGH that embedded workspace path is live |

### C. Legacy implementations
| Legacy owner | Replacement | Remaining consumers | Compatibility reason | Removal blocker |
|---|---|---|---|---|
| `malik-*` brand filenames/exports | (none — both active) | app-shell imports `malek-wordmark`; landing/login/public-support import `malik-brand`; PWA prompt imports `malik-mark` | cosmetic naming split only; `malek-wordmark` is the shell's wordmark wrapper over the same identity | not a legacy pair — no removal path |
| Standalone finance top-level routes | Money shell | old bookmarks | deep-link preservation | keep redirects |
| `permissions.ts` rolePermissions default map | effective-permissions (server) | client pre-merge; ADMIN override rule | fallback until effective loaded | keep (documented compatibility) |
| `legacyPayloadAdapters.ts`/`documentCompatibilityTypes.ts` | `documentPayloads.ts` | document engine old payloads | back-compat of document rendering | keep until parity |
| `/documents-vault`, `/people` as top-level | contextual documents + identities | deep links | old bookmarks; lock | keep redirects/aliases |
| legacy `?previewKind=` handling | `legacy-preview-redirect.tsx` | old bookmarked URLs | back-compat | keep |

### D. Compatibility layers
| Compatibility code | Purpose | Consumers | Still needed | Evidence |
|---|---|---|---|---|
| `route-tree` REDIRECT routes (`/landing`,`/units`,`/utilities`,`/documents-vault`,`/finance/*`,`/accounting`,`/system`,`/audit-log`,`/data-integrity`,`/change-password`,`/automation`) | preserve legacy deep links | old links/bookmarks, IA tests | YES (lock) | route-tree comments + route-contract REDIRECT_ROUTES |
| `settings/settingsSections.ts` re-export seam | route old imports to registry | legacy settings code | YES transitional | file header |
| `legacy-preview-redirect.tsx` | `?previewKind=`→canonical | old external links | YES | header comment |
| `mock-role-simulator.ts` | test/demo role simulation | tests/e2e | yes (tests) | — |
| cash-flow `…067 repair_legacy_cash_flow_compatibility` migration | compat read model | reporting | transitional | migration name |

---

## 25. Dependency Hotspots / Import & Size Concerns

Fan-in/fan-out analysis is static-heuristic (not exhaustive). Highest-centrality modules observed:

| Module | Role | Fan-in | Fan-out | Domains | Concern | Severity |
|---|---|---|---|---|---|---|
| `src/features/auth/permissions.ts` | permission authority | very high (imported app-wide) | low | all | single choke point; UI mirrors server | LOW (guarded) |
| `src/hooks/use-auth.tsx` | auth context | very high | med | all | central | LOW |
| `src/lib/supabase.ts` | DB client | high | med | all | single data-plane entry | LOW (good) |
| `src/app/router/route-tree.ts` | route registry | low fan-in | **very high fan-out** (imports ~all pages) | all | single 515-line registration file; no file-based routing | MEDIUM (grows; guarded) |
| `components/ui/index.ts` | UI barrel | high | low | shared | barrel | LOW |
| `components/layout/page-header|page-layout|list-page` | layout | high | low | shared | LOW |
| `src/features/finance/FinancePage.tsx` + `financeShellModel.ts` | Money shell | med | **high** (mounts many workspaces) | financials | shell complexity | MEDIUM |
| `governance-hub/components/GovernanceHubWorkspace.tsx` | settings shell | med | high (mounts settings/system/audit/auth/automation) | settings/governance | lazy big surface | MEDIUM |
| `reports/**` reports-page/use-reports-workspace | reports hub | med | very high | reports/accounting/financials | 113-file feature | HIGH |
| `domain/types.ts`, `types/domain.ts`, `types/database.ts` | types | high | low | all | split type roots | MEDIUM |
| `services/documents/**` engine | document engine | med-high | med | all docs | central | MEDIUM |
| `active-register-inventory.ts` | register foundation | test-only fan-in | high listing | registers | guard data | LOW |

Domain leakage: `features/reports` reaches into accounting/financials documents/services; `financials/deposits` reuses documents engine; `owners` settlement workspace mounted inside Money shell (cross-domain by design). Shared folder containing domain logic: `services/` root mixes auth-service/action-service (shared) with owner-options/property-workspace-service/owner-workspace-service (domain) — domain services in a shared folder; and `hooks/` (shared) holds `use-owner-options` (domain). Circular risk: none obvious statically; guarded by architecture tests.

---

## 26. Large / Complex Files (LOC sampled)

Full LOC per file not enumerated; representative heavies (sampled) with responsibility split judgment (not purely LOC):

| File | ~LOC | Responsibilities | Domain | Should split? | Risk |
|---|---|---|---|---|---|
| `app/router/route-tree.ts` | 515 | all route registration/guards | routing | yes-able but guarded by tests; each route small | MEDIUM (monolithic registration) |
| `features/auth/permissions.ts` | 386 | roles+perms+resolution+labels | authz | moderate | LOW |
| `features/finance/FinancePage.tsx` | 245 | Money shell + perm gating + render all workspaces | financials | could extract; lazy already | MEDIUM |
| `reports/**` (113 files) | ~20k total | workspace/panels/product/documents | reports | already feature-split | HIGH (aggregate) |
| `financials/**` (165 files) | ~24k total | all money registers/services | financials | already split by subdir | HIGH aggregate |
| `features/contracts/**` | ~11k/78 files | leasing | contracts | split | MEDIUM aggregate |
| `routes/__root.tsx` | 82 | root providers + PWA + viewport | shared | — | LOW |
| `app-shell.tsx` | >200 (301 start) | desktop+mobile shell, nav, dock, theme | shared | candidate | MEDIUM |

Splitting is **not** recommended on LOC alone; route-tree and shells are cohesive-by-wiring so LOC growth is architectural (manual router registration), not necessarily a cohesion defect.

---

## 27. Runtime Navigation Graph (user-journey architecture)

Primary graph (task-centric; text only):

```
public: / → landing ; /login → authRoute(redirect /dashboard if session) → protected shell
protected shell (AppShell):
  Desktop: fixed sidebar (7 roots + analysis group)  ·  Mobile: dock (menu/notifications/AI) + bottom-sheet nav
  routes dispatch to workspaces; legacy deep links redirect preserving ?search

/dashboard (Today) → signals → property/maintenance/finance detail deep links
/properties (Portfolio hub) → /properties/$propertyId → /overview | /units/$unitId | /edit ; ?section=units|owners
  → /lands, /owners/$ownerId → /edit
/contracts (Leasing hub) → /contracts/$contractId (payments tab, docs, schedule) | /contracts/new | /contracts/$contractId/edit
  → /tenants/$tenantId · /people/$personId · (leads/communication via ?section redirects)
/financials (Money shell FinancePage: section= collections|fees|expenses|funds|banking ; view=…) →
    invoices → collect (quickAdd) → receipt ; receipts ; arrears ; expenses ; deposits ; owner_settlements ;
    bank_reconciliation ; commissions(/commissions) ; fixed_monthly_accruals
/reports → catalog → /reports/$reportId (premium) ; accounting panels (GL/IS/BS/TB) ; export/PDF/print
/settings → GovernanceHub (company tab→ registry sections | users-permissions) ; hidden specialist tabs via deep link
/maintenance → section maintenance (list→ resolve overlays) | utilities | documents_vault
/ai-assistant, /help, /admin-support
external portals: /tenant-portal /owner-portal (root, own auth) ; print/preview ?previewKind legacy → redirect
```

Data layer per destination: route page → feature hook → service → supabase RPC/RLS. Disconnected/orphan nodes: `/dev/design-system` (DEV only) and standalone legacy finance *routes* (edge replaced by the Money shell; the underlying `*Workspace` exports remain in the live graph). Onboarding and `receipt-detail-page` are **not** disconnected — Onboarding is a Dashboard slot and ReceiptDetailPage serves `/receipts?receiptId=` deep links.

---

## 28. File-Level Census (representative meaningful files; full 1200-file listing not repeated)

See §3–§11 & §15 for the categorized file tables (this report groups meaningfully per category rather than dumping filenames). Highest-value per category:

| File | Category | Domain | Responsibility | Main exports | Consumers | Runtime | Canonical/Legacy |
|---|---|---|---|---|---|---|---|
| `routes/__root.tsx` | app root | shared | providers+PWA+viewport | RootRouteComponent | router | ACTIVE | CANONICAL |
| `app/router/app-router.tsx` | routing | shared | createRouter | router, AppRouterProvider | App.tsx | ACTIVE | CANONICAL |
| `app/router/route-tree.ts` | routing | shared | registration/guards | routeTree | app-router | ACTIVE | CANONICAL |
| `app/router/legacy-preview-redirect.tsx` | routing | compat | ?previewKind→canonical | LegacyPreviewRedirect | _protected | ACTIVE | COMPATIBILITY |
| `app/layout/app-shell.tsx` | shell | shared | chrome | AppShell | _protected | ACTIVE | CANONICAL |
| `app/layout/layout-navigation-view.tsx` | nav | shared | links/mobile | NavigationLinks, MobileFloatingControl | shell | ACTIVE | CANONICAL |
| `app/navigation/route-contract.ts` | IA | shared | canonical+aliases | ROUTE_CONTRACT… | shell/tests | ACTIVE | CANONICAL |
| `features/auth/permissions.ts` | authz | auth | role/perm model | authorizationRoles, appPermissions, canAccess… | global | ACTIVE | CANONICAL (UI) |
| `features/auth/effective-permissions.ts` | authz | auth | server effective perms | loadEffective… | use-auth | ACTIVE | CANONICAL |
| `features/auth/route-guards.ts` | authz | auth | session permission assert | assertSessionPermission | route-tree | ACTIVE | CANONICAL |
| `lib/supabase.ts` | data | shared | supabase client | supabase | services | ACTIVE | CANONICAL |
| `types/database.ts` | data types | shared | DB row types | tables | services | ACTIVE | GENERATED-ish |
| `services/documents/DocumentEngine.ts`…renderer | docs | shared | document build/render | — | features | ACTIVE | CANONICAL |
| `components/ui/entity-table.tsx` / `data-table.tsx` | register UI | shared | responsive tables | EntityTable, DataTable | registers | ACTIVE | CANONICAL |
| `features/active-register-inventory.ts` | register map | shared | canonical register list | ACTIVE_REGISTER_INVENTORY | guard tests | ACTIVE | CANONICAL |
| `features/finance/FinancePage.tsx` | money shell | financials | mount money workspaces | FinancePage | /financials | ACTIVE | CANONICAL shell |
| `features/finance/shell/financeShellModel.ts` | money IA | financials | sections/views | FINANCE_SECTIONS… | FinancePage | ACTIVE | CANONICAL |
| `features/governance-hub/components/GovernanceHubWorkspace.tsx` | settings shell | governance | mount settings tabs | GovernanceHubWorkspace | /settings | ACTIVE | CANONICAL |
| `features/settings/settings-page.tsx` | company settings | settings | company SettingsWorkspace | SettingsWorkspace | GovernanceHub (lazy) | ACTIVE | ACTIVE (legacy-name page) |
| `features/settings/registry/sectionRegistry.ts` | settings registry | settings | section registry | settingsSections… | settingsSections seam | ACTIVE | CANONICAL |
| `features/reports/reports-page.tsx` | reports | reports | ReportsPage | ReportsPage | route | ACTIVE | CANONICAL |
| `features/reports/workspace/*` | reports | reports | workspace shell | ReportsShell/Workspace | reports-page | ACTIVE | CANONICAL |
| `features/ai-assistant/services/ai-assistant-operating-service.ts` | AI | ai | operating layer | — | AI page | ACTIVE | CANONICAL |

Remaining meaningful files are grouped by their category tables in §3–§18; the huge feature folders are individually listed by filename in the trees captured above but not repeated here for space.

---

## 29. Architecture Contradictions / Doc-vs-Code (re-verified)

1. **Seven primary roots** — code and canonical docs agree. No contradiction.
2. **Office Owner / Employee routine persona vs six backend roles** — backend/client authorization still exposes `ADMIN, MANAGER, ACCOUNTANT, OPERATIONS, USER, VIEWER` in governance and permission maps. Routine persona simplification is **PARTIAL** at presentation level; this is a product/UX decision, not a security defect.
3. **`/receipts` compatibility seam** — intentional. Money owns the routine register; `/receipts?receiptId=` still serves the full receipt document.
4. **Tenant dossier page/dialog** — intentional shared-content composition. `TenantDetailPage` is a real page; no rebuild is required.
5. **People/Leads/Communication under Leasing permission/IA edges** — functional but semantically broad. Treat as a future domain-ownership review, not dead code.
6. **Reports folders** — earlier report was wrong to call them three competing authorities. `accountingReportsFacade.ts` explicitly declares the single accounting import boundary; `financialReportsService.ts` is a facade/domain aggregator; `features/reports` is the UI/workspace. ADR 0008 documents this layering. **No PARTIAL/CONFLICT remains here.**
7. **Settings files** — earlier report was wrong to call `settings-workspace-model.ts` a second workspace. It is a pure summary helper consumed by the single `SettingsWorkspace`; the registry is declarative. **No workspace conflict.**
8. **Brand identity** — both `Malik*` and `Malek*` exports are active. Difference is naming, not a second identity.
9. **Canonical-doc baseline SHA predates current main** — expected and documented.
10. **Query-key utilities** — genuine helper overlap, not two cache “authorities.” The root helper is richer; the list-only helper is isolated to Lands/Leads.
11. **Active-register inventory metadata drift (real)** — `active-register-inventory.ts` still lists fixed-monthly accruals under `/financials?section=funds&view=fixed_monthly_accruals`, while `financeShellModel.ts`, `FinancePage.tsx`, and finance IA tests place it under **`fees`**. Runtime is safe because the resolver normalizes the old funds deep link; inventory canonical-route metadata is stale.
12. **Redirect count attribution (report error)** — `REDIRECT_ROUTES` contains **21 app-wide entries**. Only **11** are Money aliases; `/accounting` redirects to Reports and the remainder belong to other domains.

---

## 30. Remaining Unknowns / Decisions

1. **Per-object DB ownership** — build a table/view/RPC/function → service/hook/route/permission matrix across the 70 migrations using live schema/tooling.
2. **Runtime role visibility** — verify representative roles against hosted Auth/RLS and actual UI, especially specialist Settings/Money surfaces.
3. **Exhaustive safe-delete ledger** — re-derive reachability for every production file before claiming dead/orphaned code.
4. **Type/domain ownership cleanup** — `domain/types.ts`, `types/domain.ts`, generated DB types, and feature schemas need a symbol/consumer map before consolidation.
5. **Shared `src/services/` domain leakage** — move domain-owned services only after consumer edges are enumerated.
6. **Routine persona materialization** — decide whether routine UI should hide six-role implementation terminology behind Owner/Employee concepts while backend roles stay unchanged.
7. **Compatibility redirect retention horizon** — only product/support policy can decide when an alias may be retired.
8. **Onboarding lifecycle** — currently active; future retirement depends on supported office setup states.
9. **Cosmetic naming only** — tenant dossier file placement and `Malik`/`Malek` export spelling can be normalized later.

**Resolved by source/ADR and no longer open decisions:** report authority layering, Settings workspace ownership, receipt card vs receipt document, Money shell ownership, and tenant dossier presentation.

---

## 31. Verified Execution Roadmap

This roadmap is evidence-first. It does **not** schedule refactors for areas proved canonical.

### P0 — Accuracy lock (this report revision)
- Remove false “three report authorities,” “two Settings workspaces,” “duplicate receipt detail,” and “Money has 21 redirects” findings.
- Replace approximate status partitions with exact facts or `UNKNOWN_NEEDS_REVIEW`.
- Record the stale fixed-monthly-accrual route metadata in `active-register-inventory.ts`.
- Keep application source untouched on this analysis branch.

**Exit:** report no longer recommends merging canonical layers.

### P1 — Two proven low-risk cleanup items — ✅ IMPLEMENTED (2026-09-04)

> **Status:** Both P1 items shipped on a dedicated implementation branch (`refactor/architecture-census-p1-cleanup`, PR #1788, merge commit `435de8e1`). This was a separate code PR — not the documentation branch. All required gates were green (build, browser-smoke PR gate, canonical business rules, 10-stage/decision parity, release blockers, security scans). No business/DB semantic change.

**1. Fix active-register canonical route metadata** — ✅ done
- Changed the fixed-monthly-accrual inventory route in `active-register-inventory.ts` from the stale `section=funds` to canonical `section=fees`.
- Resolver compatibility for old `funds/fixed_monthly_accruals` deep links is preserved — `resolveFinanceLocation('funds','fixed_monthly_accruals',…)` already canonicalises to `fees`; no resolver/business change was needed.
- Added a focused guard `features/active-register-inventory-finance-routes.test.ts` that (a) pins fixed-monthly accruals to the `fees` section, (b) asserts every inventory `/financials` deep link resolves to the exact section/view it declares (metadata ↔ `financeShellModel` parity, so drift fails CI), and (c) confirms legacy `funds` links still normalise to `fees`.

**2. Consolidate query-key helper overlap** — ✅ done
- Migrated Lands (`features/lands/use-lands.ts`) and Leads (`features/leads/use-leads.ts`) from `createEntityQueryKeys` (`lib/data/query-keys.ts`) to the canonical `defineEntityKeys` (`lib/query-keys.ts`).
- Exact runtime key shape preserved: `all = [scope]`, `list(filters) = [scope,'list',filters]`; invalidation and the Lands dossier sub-key are unchanged (cache/invalidation parity).
- Added `lib/query-keys.test.ts` covering the canonical helper including the Lands/Leads list-key shape and prefix invalidation.
- Deleted `lib/data/query-keys.ts` and its dedicated test **after** parity was proven; no third helper introduced.

**Exit:** ✅ met — no business/DB semantic change; targeted tests + typecheck + build + architecture guards all green.

### P2 — Exhaustive reachability / safe-delete ledger
- Enumerate every production source file.
- Record route owner, lazy/static/relative/dynamic imports, barrel export, navigation, permission, runtime mount, and test-only use.
- Classify only as `ACTIVE`, `COMPATIBILITY`, `SPECIALIST`, `TEST_ONLY`, `ORPHAN_CONFIRMED`, or `UNKNOWN`.
- Require at least two independent reachability checks before deletion.
- Produce a HIGH-confidence delete list; if none exists, delete nothing.

> **Partial progress (2026-09-04):** A focused reachability re-audit of the stale `cleanup/canonical-dead-code-20260903` set already shipped on a separate branch (`cleanup/canonical-dead-frontend-files`, PR #1789, merge commit `87c55fc1`). Six files — three unmounted document output adapters (`features/contracts/contractDocumentsService.ts`, `features/owners/documents/owner-documents.ts`, `features/properties/documents/unit-passport-document.ts`) plus their colocated unit tests — had **0 external references** for every exported symbol (no static/dynamic import, barrel, route, nav/permission, e2e, or script use) and were deleted with coherent updates to `documentOutputInventory.test.ts` and `documents-vault-service.test.ts`. The other originally-candidate landing components (`FinalCta`, `Showcase`, `Security`) were **retained**: they are actively asserted by `brand-contract.test.ts` and `landing-performance-contract.test.ts` and belong to the intentionally-disconnected landing surface, so they are not provably dead. The exhaustive repo-wide P2 ledger is still outstanding.

### P3 — Boundary cleanup, one domain at a time
- Build symbol-level maps for shared-root domain services and type/schema definitions.
- Move domain-owned services out of shared `src/services/` only when all consumers are known.
- Converge types only after explicit ownership between generated DB types, domain models, and form schemas.
- **Do not combine Reports/Accounting/Financials folders merely because names overlap.**

### P4 — Runtime + DB evidence closure
- Live schema inventory for tables/views/RPCs/functions and RLS/policy ownership.
- Hosted role matrix for representative roles.
- Runtime verification for print/PDF parity, PWA/offline lifecycle, notifications, AI/TTS, and specialist deep links.
- Reconcile runtime evidence back into this census.

### P5 — Optional cosmetic normalization
- Move `TenantDetailPage` to a clearer file if useful.
- Unify `Malik`/`Malek` export spellings only for maintainability.
- Keep behavior and visuals unchanged.

### Explicit no-change list unless new evidence appears
- **Do not merge** `features/reports`, `features/accounting/reports`, and `features/financials/reports` by folder name.
- **Do not replace** `SettingsWorkspace`; `settings-workspace-model.ts` is not another workspace.
- **Do not collapse** `ReceiptDetailCard` and `ReceiptDetailPage`; they serve compact embedded vs full document/print contexts.
- **Do not remove** Money compatibility aliases merely to reduce route count.
- **Do not rebuild** the tenant detail page.
- **Do not delete** active brand exports.

For implementation phases, run the narrowest relevant tests first, then architecture/typecheck/lint/build/required PR gates.

---

Counts below are separated into **exactly verified facts** and **not-yet-rederived categories**. Approximate rows are no longer presented as mathematically exact status partitions.

| Category | Verified fact | Confidence |
|---|---|---|
| Registered route `path:` defs | **67** | HIGH |
| Route partition | **20 redirect-only + 1 partial (`/receipts`) + 46 active = 67** | HIGH |
| `REDIRECT_ROUTES` | **21 app-wide** entries; **11 Money aliases**; `/accounting` → Reports | HIGH |
| App permissions | **61** `AppPermission` capabilities | HIGH |
| `src/components` | **98** files = 63 production non-test + 35 tests | HIGH for count |
| `components/ui` production primitives | **41** primitives (42 incl. `index.ts`) | HIGH |
| Governance Hub sections | **8** total = **2 routine primary + 6 specialist/deep-link** | HIGH |
| Company Settings registry | **8** standalone sections = **5 routine + 3 specialist**; embedded company workspace excludes `cost-centers` | HIGH |
| Finance shell | **6 sections** (5 routine + compatibility `overview`), **10 views**; fixed-monthly accruals belong to **fees** | HIGH |
| Supabase migrations | **70** `.sql` files | HIGH |
| In-src Vitest files | **497** | HIGH |
| Playwright E2E specs | **21** | HIGH |
| Pages/features/dialogs/forms/hooks/report-capability totals | **NOT RE-DERIVED EXHAUSTIVELY** | `UNKNOWN_NEEDS_REVIEW` |
| DB object ownership | **NOT ENUMERATED object-by-object** | `UNKNOWN_NEEDS_REVIEW` |

### Highest-Priority Findings

No HIGH-severity implementation defect was proven by this static census. The prior HIGH items for Reports, Settings, and Money were reclassified after direct source verification.

| Priority | Finding | Evidence | Impact | Next action |
|---|---|---|---|---|
| MEDIUM | Full per-file reachability/status ledger is incomplete | ~1,200-file scope; representative sampling only | blocks trustworthy dead-code deletion | P2 exhaustive reachability ledger |
| MEDIUM | DB per-object ownership remains unknown | 70 migrations; no live schema object→consumer map | limits backend cleanup/security ownership confidence | P4 live DB inventory |
| ~~MEDIUM~~ ✅ RESOLVED | ~~Active-register inventory has stale fixed-monthly canonical path metadata~~ | was: inventory `funds` vs shell `fees` | metadata/guard drift (resolver masked it) | **Fixed in #1788 (`435de8e1`): inventory now `section=fees`; parity guard added** |
| ~~LOW–MEDIUM~~ ✅ RESOLVED | ~~Query-key helper overlap~~ | was: richer `lib/query-keys.ts` vs list-only `lib/data/query-keys.ts` (Lands/Leads) | needless utility duplication | **Consolidated in #1788 (`435de8e1`): Lands/Leads migrated; old helper + test deleted after parity proven** |
| MEDIUM | Routine persona still exposes six-role terminology | permissions/governance code | UX/product-model inconsistency, not auth defect | explicit product decision |
| LOW | Manual `route-tree.ts` remains large | 515-line centralized router | maintainability/merge-conflict risk | split only if churn justifies it |
| LOW | Tenant dossier file naming | real page exported from `TenantPreviewDialog.tsx` | cosmetic | optional P5 rename |

**Verified canonical / not cleanup defects:** Reports layering, SettingsWorkspace composition, Money shell + embedded financial workspaces, receipt card + full receipt document, tenant page/preview shared content, compatibility redirects, active brand exports.

### Hidden Capabilities

| Capability | Current state | How to reach today | Why it matters |
|---|---|---|---|
| Audit log | implemented, active | deep link `/settings?section=audit-log` (or `/audit-log`) | governance/read-only; documented hidden |
| Data integrity | implemented | `/settings?section=data-integrity` | integrity checks; specialist |
| System settings | implemented | `/settings?section=system-settings` | admin; specialist |
| Automation | implemented | `/settings?section=automation` | specialist; background worker |
| Admin support ops | implemented | `/admin-support` | triage/investigation; support.operations |
| Deposits | implemented | Money `funds` section → `deposits` view (permission `financial.deposits.view`) | deposit lifecycle; not a global nav root but reachable in Money |
| Fixed monthly accruals | implemented | Money fees/fixed_monthly_accruals | management-fee booking |
| GL/accounting read | implemented | Reports accounting | journal writes remain server-only |
| Change password | implemented | `/settings?section=security` | security |
| Tenant/Owner portals | implemented, external | `/tenant-portal`,`/owner-portal` | constrained read-only external access |

### Architecture Debt (verified)

| Debt | Evidence | Risk | Suggested resolution |
|---|---|---|---|
| Stale fixed-monthly canonical route metadata | `active-register-inventory.ts` = funds; finance shell/tests = fees | LOW–MEDIUM | P1 fix + guard |
| Overlapping query-key helpers | `lib/query-keys.ts` vs list-only `lib/data/query-keys.ts` | LOW–MEDIUM | P1 consolidate Lands/Leads |
| Manual monolithic router registration | `route-tree.ts` 515 lines | maintainability | keep centralized unless churn proves split valuable |
| Domain services under shared `src/services/` | owner/property workspace examples | boundary leakage possible | P3 consumer map first |
| Type/schema ownership spread | domain/generated/feature schemas | drift possible | P3 symbol-level ownership map |
| Exhaustive dead-code proof absent | production tree not individually re-derived | unsafe deletion risk | P2 reachability ledger |
| Wide shell fan-out | FinancePage, GovernanceHubWorkspace | coupling, but intentional | preserve lazy composition; optimize only with measured issue |

**Not debt by itself:** compatibility aliases, shell/workspace composition, report folder layering, Settings registry/model helpers, compact-vs-full detail presentations.

### Safe Cleanup Candidates (HIGH-confidence only)

| Candidate | Evidence | Replacement/Reason | Dependencies | Confidence |
|---|---|---|---|---|
| *(none at HIGH)* — no file was confirmed high-confidence safe to delete. All candidates examined in this pass resolved to an active or legacy-but-retained state (e.g. onboarding = Dashboard slot, `receipt-detail-page` = `/receipts?receiptId=` detail, brand files all live). | — | — | — | — |

Per task constraint, nothing is declared safe-to-delete without strong evidence; none cleared that bar in this pass.

### Human Decisions Required

| Decision | Why code cannot decide | Recommended default |
|---|---|---|
| Routine persona terminology | product choice: how aggressively to hide six backend-role names | keep backend roles unchanged; simplify routine UI only after explicit UX decision |
| Redirect retirement horizon | depends on bookmarks/support/usage | keep aliases; retire only with evidence |
| Onboarding future | depends on supported incomplete-office state | keep active |
| Type/service boundary policy | requires symbol/consumer evidence | defer to P3 |
| Tenant/brand naming cleanup | cosmetic/maintainability | last priority |

**No human architecture decision is required for Reports authority, Settings workspace ownership, receipt-detail presentation, Money shell ownership, or tenant dossier presentation; source and ADRs already resolve those.**

---

---

## 32. Accuracy Verification (deep re-audit vs code)

This section records a systematic accuracy audit of the report above against the actual source (code treated as the sole source of truth). It does not add new scope; it only states what was re-verified, what was wrong, and what was corrected in-place throughout the earlier sections.

**Method:** exact counts were taken from source with shell/python, not by hand. File/route claims were re-checked for existence, imports (including **relative** imports, lazy route targets, and barrel/mount consumers — never only direct-feature-path imports), route registration, navigation wiring, and permission/data plumbing. Hidden / orphaned / dead / legacy classifications were re-derived; any claim that could not be proven to HIGH confidence was either corrected to what the code shows or flagged UNKNOWN.

### Numeric / total corrections (verified by counting source)

| Claim in original report | Was | Verified actual | Source of truth |
|---|---|---|---|
| Supabase migrations | 72 | **70** `.sql` files (`20260830223142` + `20260901000000`–`…068`); the 72 was dir entries incl. `README.md` + `rls_per_table/` | `ls supabase/migrations/*.sql \| wc -l` |
| Playwright E2E specs | 27 | **21** `e2e/*.spec.ts` (27 counted total `e2e` files incl. 4 `support/*.ts` + `evidence/`) | `ls rentrix-app/e2e/*.spec.ts` |
| `AppPermission` capabilities | 62 | **61** | count of `appPermissions` array in `features/auth/permissions.ts` |
| Registered route `path:` defs | ~95 (earlier draft) | **67** unique | `route-tree.ts` `path:` scan |
| Route partition | hidden column double-counted | **20 redirect-only + 1 partial (`/receipts`) + 46 active = 67**; specialist routes are a subset of Active | `REDIRECT_ROUTES` (21) + component presence |
| `components/ui` "non-test UI primitives" | 30 | **41** primitives (42 incl. `index.ts`) | `find components/ui` (non-test) |
| Components totals | ~98 | **98** files (63 prod non-test + 35 test files) | `find src/components` |
| `components/layout` / `brand` / `documents` prod files | (implicit) | 11 / 3 / 2 | counting |
| In-src Vitest files | 497 | **497** (includes `.visual-wave-1/.pglite/.axe` sub-kinds) | `find src ... *.test.*/*.spec.*` |
| Redirect attribution | “21 Money redirects” (later summary) | **21 app-wide**, of which **11** are Money aliases | `route-contract.ts` `REDIRECT_ROUTES` |
| Governance/Settings hierarchy | flat `~16 / 8 primary + 8 hidden` summary | Governance Hub: **8 = 2 routine + 6 specialist**; company registry: **8 = 5 routine + 3 specialist** standalone | `governance-hub-sections.ts`, `settings/registry/sectionRegistry.ts` |

### Classification / factual corrections

| Area | Original claim | Corrected to (code evidence) |
|---|---|---|
| Tenant detail route (`/tenants/$tenantId`) | "dialog rendered as a full page"; `CONFLICT` with UX (§29, §6, §5, §4, §23, summary) | **Real `TenantDetailPage`** (PageLayout dossier). File exports `TenantDetailPage` + shared `TenantDossierContent` + `TenantPreviewDialog`; page and preview dialog share the dossier body — intentional content reuse, not dialog-as-page. Only cosmetic oddity is the page living in `TenantPreviewDialog.tsx`. |
| Contract create/edit | "DUPLICATED surface (route page + modal)" (§9/§10/§23) | **Single shared `ContractFormModal`** mounted by thin shell `ContractFormPage` (`/contracts/new`,`…/edit`) and by `ContractsListPage`. Two mount points, one implementation. |
| Deposits | "hidden from Money primary tabs / ACTIVE_HIDDEN per lock" (§4/§22) | Money `funds` section is in primary nav (`showInPrimaryNavigation:true`) and `deposits` is a normal **permission-gated view** (`financial.deposits.view`); it is not globally nav-hidden, only not a 7-roots destination. |
| Fixed-monthly accruals | ACTIVE_HIDDEN (§4) | ACTIVE permission-gated view in Money `fees` primary section. |
| `/invoices` page | "orphaned behind redirect" | Legacy standalone path redirects to Money; `InvoicesWorkspace` export is consumed by the shell (active). |
| `receipt-detail-page` | earlier "orphan" label | ACTIVE — `ReceiptsWorkspace` renders `ReceiptDetailPage` for `/receipts?receiptId=` (relative import). |
| `onboarding/` | earlier "no entry" | ACTIVE — Dashboard renders `OnboardingChecklist`. |
| Brand `malik-*` | earlier "residue" | ACTIVE on landing/login/public-support/PWA; `MalekBrandWordmark` (shell) wraps the same identity. |
| `statements-reports-service` | (suspected unused) | ACTIVE via **relative** import from `financials/reports/financialReportsService.ts` → consumed by reports workspace. Confirms direct-import search alone is insufficient. |
| `supabase-client-boundary.test` path | cited under `components/` | Real path `rentrix-app/src/lib/supabase-client-boundary.test.ts` (§14). |
| `e2e/support` harness list | missing `document-acceptance-session.ts` | added (§21). |
| Reports “3 roots = 3 authorities” | HIGH duplicate-authority risk | **False**: UI layer + canonical accounting facade + financial facade/domain modules are explicitly layered |
| Settings “two workspace models” | HIGH ambiguity | **False**: one `SettingsWorkspace`; `settings-workspace-model.ts` is a summary helper |
| Receipt detail “duplicate renderers” | MEDIUM duplicate UI | **False as stated**: compact embedded detail vs full document/print surface are different contexts |
| Money redirect count | “21 legacy Money routes” | **False**: 21 redirects app-wide; 11 Money aliases |
| Fixed-monthly active-register route | `section=funds` inventory metadata | **Stale metadata**: canonical view is `section=fees`; legacy funds input is normalized |

### Reports layering verification (correction)

The earlier “three reporting service roots = authority overlap” conclusion was **wrong**.

- `features/reports/**` owns report UI/workspace composition.
- `features/accounting/reports/accountingReportsFacade.ts` explicitly says it is the **“SINGLE import path for all accounting report consumers”**.
- `features/reports/accounting-report-authority.ts` imports cash-flow/reconciliation through that facade.
- `features/financials/reports/financialReportsService.ts` explicitly calls itself a **canonical reports facade**, re-exporting accounting results plus operational/subledger modules; it says not to grow a second implementation.
- ADR 0008 names `accountingReportsFacade.ts` as the canonical accounting-report read boundary.

Therefore the folder split is intentional layering, **not a HIGH duplicate-authority refactor target**.

### Settings / receipt / redirect re-verification

- `settings-workspace-model.ts` is only `buildSettingsSummaryTiles`; it is imported by the single `SettingsWorkspace`.
- `ReceiptDetailCard` (embedded Money detail) and `ReceiptDetailPage` (full deep-link document/print/PDF) are intentionally different contexts.
- `REDIRECT_ROUTES` has 21 app-wide entries, not 21 Money routes. Eleven are Money aliases; `/accounting` routes to Reports.
- New real drift: `active-register-inventory.ts` still labels fixed-monthly accruals with `section=funds`; canonical runtime/tests place the view under `fees`.

### Spot-check of file existence (sampling)

69 file paths cited across the route/page/component/service tables were checked for existence and **0 were missing**. This does not prove every one of the ~1,200 referenced rows correct; it bounds the risk.

### Verification summary table

| Area | Items Checked | Errors Found | Corrections Made | Remaining Uncertainty | Confidence |
|---|---|---|---|---|---|
| Repo ground-truth numbers (migrations, e2e, tests, perms, LOC) | exact counts from source | 4 (migrations 72→70, e2e 27→21, perms 62→61, route partition) | yes | none for these totals | HIGH (counted) |
| Route census (67 paths, redirect/alias, owners, guards) | all route `path:` defs + REDIRECT_ROUTES + sampled owners/guards | route total overstatement; hidden double-count; 1 partial accounting | yes | exact ACTIVE/HIDDEN split of the 46 pages is judgment + role-dependent | HIGH for counts; MEDIUM for per-page hidden flags |
| Page/route owner mapping | 35 sampled page files exist + route lazy targets | tenant-detail mischaracterization | yes | a few page owners rely on the route-tree read (no runtime run) | HIGH (sampled) |
| Components (shared primitives, duplicates) | counts + representative existence | "30 primitives" undercount; "malik legacy" cell | yes | not every feature-local component pair diffed | HIGH for counts; MEDIUM for full duplicate list |
| Dialogs / forms census | contract-form + tenant-detail + receipt-detail traced | contract "duplicate"; tenant "dialog-as-page" | yes | full dialog trigger-map not re-walked | MEDIUM–HIGH |
| Data-access & DB contract map | guards existence, service consumers, report facades/layers | supabase-boundary path; statements reachability; corrected false 3-authority framing | yes | per-object DB ownership UNKNOWN (needs DB tooling) | MEDIUM |
| Auth/permissions | appPermissions count, role map | 62→61 | yes | per-route/permission membership not exhaustively re-derived | HIGH for count; MEDIUM for per-role detail |
| Settings / Governance | hub sections + registry + money sections read | deposits/fixed-monthly "hidden" labels | yes | which company sections are "visible vs hidden" is role-gated | MEDIUM–HIGH |
| Hidden / orphaned / dead / legacy | re-derived via route + lazy + relative-import + mount-point checks | orphan labels for receipt-detail/onboarding (prior) + this pass verified reachability | yes | some "hidden" classification is role-dependent | HIGH that nothing was falsely *deleted* as dead; MEDIUM on exhaustive hidden set |
| Reports / printing / documents | UI adapters + accounting facade + financial facade + doc engine specs | corrected false duplicate-authority framing | yes | screen-vs-print parity not runtime-verified | MEDIUM–HIGH for layering; MEDIUM runtime |
| AI / PWA / notifications | file existence + wiring sampled | none | — | runtime (speech/SW/offline) not exercised | MEDIUM |
| Summary tables | math re-derived (routes 20+1+46=67; column semantics added) | route double-count; orphan/duplicate cells stale after body fixes; migrations/e2e/perms | yes | other rows are intentionally approximate (~) | HIGH after this pass for the rows with exact totals; MEDIUM for `~` rows |

---

### Accuracy closeout (frank)

**Total errors found in the original report:** the earlier “~18” closeout was itself incomplete. This pass found **at least 7 additional material corrections** (Reports authority framing, Settings workspace framing, receipt-detail duplication, Money redirect attribution, Settings hierarchy summary, query-key “authority” wording, and stale fixed-monthly inventory metadata). Treat the cumulative count as **≥25 distinct inaccuracies/misclassifications**, depending on whether repeated copies of the same false claim are counted separately.

**Most consequential errors / misclassifications found (updated):**

- **Reports authority split was falsely flagged HIGH.** Source defines a single accounting facade and separate UI/facade layering.
- **Settings was falsely flagged as two workspaces.** `settings-workspace-model.ts` is a pure summary helper.
- **Receipt detail was falsely treated as duplicate UI to collapse.** It is compact embedded detail vs full document/print detail.
- **“Money has 21 redirects” was false.** 21 is app-wide; 11 are Money aliases.
- **The report missed a real metadata drift:** fixed-monthly accrual inventory still says `funds`, canonical runtime is `fees`.

**Previously identified major errors retained for history:**

1. **Tenant detail route mislabeled "dialog rendered as a full page" and flagged a `CONFLICT`** — the route actually renders a real `TenantDetailPage` dossier that shares `TenantDossierContent` with the preview dialog. Wrong in §4, §5, §6, §9, §23, §29, §30, §31, and the summary. *(Highest-impact misclassification.)*
2. **Route census overcount (~95)** — true count is **67** `path:` definitions, with a mutually exclusive 20-redirect / 1-partial / 46-active split.
3. **Supabase migrations stated as 72** — the directory holds **70** `.sql` migrations (72 was entries incl. `README.md` + `rls_per_table/`).
4. **Playwright E2E specs stated as 27** — there are **21** `*.spec.ts` files (27 was all `e2e/` files incl. 4 support harnesses).
5. **AppPermission capabilities stated as 62** — the `appPermissions` array has **61** entries.
6. **Deposits labeled "hidden from Money primary tabs / ACTIVE_HIDDEN"** — the `funds` Money section is in primary nav and `deposits` is a normal permission-gated view (`financial.deposits.view`); it is only not-a-global-root.
7. **Contract create/edit labeled a "DUPLICATED surface"** — `ContractFormPage` is a thin shell that renders the single shared `ContractFormModal` (also mounted by `ContractsListPage`). Not a duplicate implementation.
8. **`components/ui` "non-test primitives = 30"** — actual **41** primitives (42 incl. `index.ts`); whole-component production total is 63 files.
9. **Fixed-monthly accruals labeled ACTIVE_HIDDEN** — it is an ACTIVE permission-gated view in the Money `fees` primary section.
10. **Summary-table contradictions** — features "~2 orphaned" (0 orphaned), components "Legacy=malik" (0 legacy), and a route "hidden" column that double-counted pages (now a mutually-exclusive partition + explicit column-semantics caveat).

**What is still NOT certain (honest):**
- **Exhaustive per-item classification of ~1,200 files was not fully re-derived.** Numeric totals and a 69-file path sample were verified; the full ACTIVE/HIDDEN/DUPLICATE ledger for every feature-local component, hook, and test file remains `UNKNOWN_NEEDS_REVIEW`.
- **Per-role visibility** (which ACTIVE_HIDDEN labels are actually hidden for a given role) is role-dependent and was reasoned from permission maps, not exercised at runtime.
- **DB per-object ownership** across 70 migrations was not enumerated object-by-object (needs DB tooling/live schema).
- **The approximate (`~`) totals** (pages ~40, hooks ~60+, dialogs ~30, forms ~25, reports ~30, settings ~16) are estimates, not exact counts.
- **Runtime behavior** (offline/PWA, TTS/speech, live RLS/role enforcement, print-parity) was not exercised; only static wiring was inspected.

**Realistic confidence in the report after this audit:**
- **Numeric / structural claims:** ~92–95% (routes, migrations, e2e, permissions, tests, LOC, component counts — all directly counted or sampled with 0 misses).
- **Per-item status classifications across the whole tree:** ~70% (representative tables verified; exhaustive per-file re-derivation not performed).
- **Overall report confidence after this second source-grounded correction: ~85% for architecture relationships, ~95% for exact counted totals, but only ~70% for exhaustive per-file status classification.** Remaining uncertainty is the full reachability ledger, role-dependent runtime visibility, DB object-level ownership, and un-run runtime behavior. The execution roadmap in §31 is constrained accordingly.

---
*End of corrected census + accuracy audit. Report remains read-only analysis; no application code was modified. All cells that could not be verified to HIGH confidence are explicitly marked `UNKNOWN_NEEDS_REVIEW` or flagged in §32.*
