# MALEK — Architecture (Canonical)

> **Source-of-truth document.** Consolidated from: `docs/ARCHITECTURE.md`, `docs/DATABASE_ARCHITECTURE.md`, `docs/MULTI_TENANT_ARCHITECTURE.md`, `docs/SECURITY_MODEL.md`, `docs/adr/0009-financial-write-trust-model.md` (FINANCIAL_WRITE_TRUST_MODEL_AR), `docs/RPC_REFERENCE.md`, `docs/ENGINEERING_GOVERNANCE.md`, `docs/TESTING.md`, `docs/decisions/0008-financial-routes-ux-clarity.md`, `docs/decisions/0010-stage3-general-ledger-core.md`, ADR 0014 (finance hubs), plus code-verified facts gathered during the 2026-08-07 consolidation. Where a source doc conflicts with verified code, this document records the code truth and flags the source as stale (see `13_Conflict_Report.md`).

---

## 1. Repository layout

- `rentrix-app/` — the only workspace package (see `pnpm-workspace.yaml`): Vite + React 19 + TypeScript PWA. Deployed to Vercel (`rentrixapp.vercel.app`).
- `supabase/migrations/` — the sole active SQL migration source for schema, RLS, functions, triggers, RPCs. **189 migration files** as of 2026-08-07. Reconcile ordered files with the live `supabase_migrations.schema_migrations` ledger before assuming anything is deployed — the 2026-08-07 live-drift audit proved 26 live-only and 14 repo-only migrations (see `11_Current_Status.md`).
- `supabase/rollback/` — **32 rollback files**, convention `<date>_rollback_<name>.sql`; some marked manual-only.
- `scripts/collect-supabase-migration-evidence.sh` — read-only preflight: checks migration naming/ordering; with `SUPABASE_DB_URL` + `psql` reconciles local filenames vs live ledger without mutating. Run via `pnpm supabase:migration-evidence`.
- `scripts/check-architecture.mjs` — Guard v2 dependency-boundary enforcement (§5).
- `.github/workflows/` — 9 workflows including `ci.yml`, `canonical-business-rules-guard`, `execution-plan-guard`, browser-readiness/release-blocker gates.
- Root `package.json` — workspace scripts (`build`, `typecheck`, `lint`, `supabase:migration-evidence`) delegating via `pnpm --filter`.
- `tsconfig.base.json` / `tsconfig.json` — shared TS options; `rentrix-app` extends them.
- `evidence/`, `tickets/`, `governance/`, `docs/` — governance and documentation (see `01_Documentation_Inventory.md`).
- There is **no** separate `lib/` package at workspace root.

Frozen technical identifiers (ADR 0011 compatibility boundary): repo name `malik`, app dir `rentrix-app`, package paths, DB objects, storage keys keep legacy spellings; only **user-visible** identity must be MALEK.

---

## 2. Frontend structure (`rentrix-app/src/`)

- `routes/` and `app/router/route-tree.ts` — thin TanStack Router adapters; programmatic route tree. Groups: `_auth` (login) and `_protected` (everything requiring a session). Route `beforeLoad` guards check `supabase.auth.getSession()` and call `assertSessionPermission` (`features/auth/route-guards.ts`) against `features/auth/permissions.ts`. `staticData.title` values are Arabic and drive titles/breadcrumbs.
- `app/` — composition infrastructure ONLY: shell/layout, navigation, providers, router, app-level not-found boundary. Business pages/services belong in `features/`; boundary enforced by `check-architecture.mjs`.
- `features/<domain>/` — one folder per business area: `contracts`, `owners`, `financials`, `maintenance`, `leads`, `lands`, `settings`, `audit`, `system`, `communication`, `commissions`, `people`, `properties`, `tenants`, `units`, `finance-hub`, auth, reports, etc. Typical contents: page component, `*Service.ts` (Supabase calls), `use*` hook (TanStack Query wiring), colocated tests.
- `components/` — shared UI: `components/layout/` primitives and `components/ui/` design-system primitives (shadcn/ui conventions + Tailwind v4); `components/brand/` MALEK brand components; `components/enterprise/` Wave-4A enterprise composition layer (new, additive-only).
- `domain/` — pure, Supabase-independent domain types/logic (`types.ts`, `financial-settlements.ts`, `validators.ts`).
- `lib/` — cross-cutting: `supabase.ts` (typed client), `query-client.ts`, `env.ts` (env validation/placeholder detection), `i18n.ts`, `formatters.ts` (Latin-numeral money/date formatting, `-u-nu-latn`), `csvExport.ts`, `moneyNormalization.ts`.
- `services/` — cross-feature services: `services/documents/` (PDF/document generation platform), `services/auth-service.ts`.
- `store/ui-store.ts` — Zustand for local UI-only state (theme, sidebar, sync status). NOT a data layer.
- `types/database.ts` — generated Supabase DB types (note: ENGINEERING_GOVERNANCE still references a stale `database.types.ts` path — see Conflict Report dangling-references section).

---

## 3. Routing & finance information architecture

TanStack Router routes declared programmatically in `routeTree.ts`.

Two top-level finance routes with deliberately different jobs (ADR 0008), extended by ADR 0014 Wave-2 finance reporting:

- `/financials` — **operational index** ("Quick summary" / `financialsSectionSummary`): workspace cards (invoices, receipts, expenses, arrears, deposits, owner settlements, bank reconciliation) + small `FinancialReportsPreviewSection` (current-month collection summary).
- `/reports` — **executive analytics center** ("Detailed reports" / `financialsSectionReports`): tabs for collection, cashflow, arrears, accounting, statements, VAT, deferred revenue; filtering + CSV export; guarded by `financial.reports.export`.
- `rentrix-app/src/features/finance-hub/` — **NOT a route**: reusable `FinanceHubWorkspace` component (+ `finance-hub-sections.ts`, `finance-hub-model.ts`) consumed by per-workflow pages (`/invoices`, `/receipts`, `/expenses`, `/arrears`, `/deposits`, `/owner-settlements`, `/bank-reconciliation`, `/commissions`). There is deliberately no `_protected.finance-hub.tsx`.

ADR 0014 (Wave 2) added finance hub routing with legacy redirects; page-header title pair is a deliberate contrast (sidebar labels unchanged).

---

## 4. Data layer & the atomic-RPC pattern

- `lib/supabase.ts` — typed `createClient<Database>` from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` via `lib/env.ts`; known CI placeholders treated as "not configured" and surfaced via runtime diagnostics (no crash).
- Each feature `*Service.ts` wraps Supabase queries/RPCs; `use*.ts` hooks wrap services with TanStack Query (caching/loading/error).
- **All contract writes are atomic Postgres RPCs**, never direct client writes: `create_contract_atomic`, `update_contract_atomic`, `renew_contract_atomic`, `terminate_contract_atomic`, `soft_delete_contract_atomic`.
- Other multi-step operations are likewise atomic RPCs: `resolve_maintenance_with_expense`, `record_invoice_payment_atomic`, `void_receipt_atomic`, `pay_owner_settlement_atomic`, `pay_commission_atomic`, `reverse_commission_atomic`, deposit create/deduct/refund RPCs, bank CSV import (fail-closed, S02).
- **Payment-backed receipt shared identity**: `payments.id = payments.receipt_id`; payment rows double as receipts (see `04_Accounting.md`).
- Financial totals rule (FGR-001, closed): payment-backed receipt screens and collection reports read `public.payments` filtered to non-deleted, non-VOID rows; `rpt_daily_collection` follows the same rule to avoid frontend/RPC drift.

### Server-side pagination & determinism (2026-08 consolidation)

- Large datasets (`owners`, `receipts`, `expenses`, `maintenance_records`, `audit_log`, `communication_records`) enforce deterministic tie-breaking (`.order('id')` secondary sort) and safe server-side `.range(from, to)` pagination via `fetchAllRows`.
- `.in(...)` identifier filtering uses `chunkForInFilter(ids, 250)` to avoid PostgREST URL/parser overflow.

---

## 5. Automated dependency boundary — Guard v2

`scripts/check-architecture.mjs` governs EVERY feature directory:

- every current cross-feature dependency edge is explicit in the script;
- a new feature has no cross-feature access by default;
- adding an edge requires a reviewed integration seam + allow-list update in the same PR;
- presentation components cannot add new cross-feature service imports;
- eight existing presentation/service debts are frozen by exact file path — removal only, never expansion;
- app-composition, direct-Supabase presentation, page-size, and circular-import checks enforced.

This is a **ratchet**: preserves current behavior, prevents drift; it does not certify grandfathered imports as ideal.

---

## 6. Multi-tenant SaaS architecture

Converted from single-office to multi-tenant on 2026-07-22 (`20260722010000_phase1_create_companies_and_seed.sql`; `docs/MULTI_TENANT_ARCHITECTURE.md`).

- Every data row carries `company_id`.
- `companies(id, name, slug, currency, locale, timezone, is_active)`; `company_members(company_id, user_id, role CHECK IN ('OWNER','ADMIN','MEMBER','VIEWER'), is_active, UNIQUE(company_id,user_id))` — note these membership roles differ from app roles (C-05, see Conflict Report).
- `current_company_id()` reads `auth.jwt() -> 'app_metadata' ->> 'company_id'`; `custom_access_token_hook()` injects the user's first active company into `app_metadata.company_id`; re-invoked on company switch.
- RLS base pattern (most tables): `{table}_company_isolation FOR ALL TO authenticated USING (company_id = current_company_id()) WITH CHECK (...)`. Documented exceptions exist (ledger/helper tables).
- Tenant-isolation policy family: restrictive `p0_tenant_isolation` policies from the P0 hardening wave (#1276).
- Known scale caveats: composite `(company_id, no)` uniqueness for chart-of-accounts tightening remains later scope; 224 performance advisories open (`auth_rls_initplan` 79, `multiple_permissive_policies` 20) — see `11_Current_Status.md`.

---

## 7. Security & financial-write trust model

(`docs/SECURITY_MODEL.md`, `docs/adr/0009-financial-write-trust-model.md`, `docs/security/FINANCIAL_WRITE_TRUST_MODEL_AR.md`)

Layered model:

1. **Role-aware helpers**: `current_app_role()`, `is_app_user()`, `is_admin_or_manager()`, `is_admin()` (public) + `app_private.*` wrappers. App roles: `ADMIN`, `MANAGER`, `USER`.
2. **RLS** enabled across exposed tables: separates self-read, authenticated read, admin/manager write, and no-direct-browser-access for sensitive tables (e.g. `financial_operation_idempotency`); restricted read/write model for `journal_entries`.
3. **Restricted grants** to `anon` / `authenticated` / `service_role` / `supabase_auth_admin`.
4. **SECURITY DEFINER RPCs** for privileged workflows — the ONLY write path for financial mutations; internal helpers revoked from non-browser-facing routines.
5. **Financial write trust model** (ADR 0009): browser never writes financial tables directly; every financial mutation flows through an atomic SECURITY DEFINER RPC that re-validates authZ, company scope, and invariants server-side; idempotency via `financial_operation_idempotency`.
6. Audit: `audit_log` table + triggers (incl. `audit_journal_entry_insert`, which has an open `function_search_path_mutable` advisory — PR #1297 Draft).

Open security items are tracked in `11_Current_Status.md` (leaked-password protection, demo-password rotation, perf advisories).

---

## 8. Database architecture (PostgreSQL via Supabase)

Organized groups (`docs/DATABASE_ARCHITECTURE.md`):

- **Identity/access**: `users`, `profiles`, `sessions`.
- **Property & ownership**: `owners`, `properties`, `property_owners`, `owner_agreements`, `units`, `lands`.
- **Tenant & contract**: `people`, `tenants` (legacy/supporting), `contracts`, `contract_documents`, `payment_terms_templates`.
- **Billing & receipts**: `invoices`, `payments`, `receipts`, `receipt_allocations`, `financial_operation_idempotency`.
- **Expenses & maintenance**: `expenses`, `maintenance_records`, `cost_centers`, `utility_bills`.
- **Accounting & balances**: `accounts`, `journal_entries`, `contract_balances`, `owner_balances`, `tenant_balances`, `owner_settlements`; Stage-3 GL platform adds journal batches/lines/periods + engine RPCs (`gl_create/post_journal_batch`, `post_journal_event`, `reverse_journal_batch`) — **shipped but not wired to business flows** (see `04_Accounting.md` §S03 gaps).
- **Reporting & audit**: `audit_log`, reporting views, `rpt_*` functions (14+ RPCs — see `09_Feature_Catalog.md`).
- Contract lifecycle enforced through RPCs, not direct updates; lifecycle states currently draft/active/terminated/soft-deleted (4 states) vs the LOCKED 8+2 target (`05_Legal_Workflows.md`).

### 8.1 Authoritative property-ownership model (2026-08)

- `property_owners` — authoritative legal/economic ownership: percentages, temporal validity (`starts_on`/`ends_on`); non-overlapping active percentages ≤ 100%; at most one primary owner per property.
- `owner_agreements` — authoritative management agreements (`agreement_type`, `commission_type`, `commission_value`, effective dates).
- `properties.owner_id` / `owner_name` — backward-compat projections synced by trigger `trg_sync_property_owner_projection`; never an independent source of truth.
- `current_property_ownership` view — canonical join of active `property_owners` + `owner_agreements` as of `CURRENT_DATE`.

### 8.2 Client-money separation (2026-08)

- Tenant deposits held as liabilities (account **2200** Tenant Deposits Payable) in `tenant_deposits` until refunded/applied/forfeited.
- Owner settlement: server-derived net payable via `calculate_owner_net_payout()`, disbursed via `pay_owner_settlement_atomic()` with balanced journals.
- Commission payouts: `pay_commission_atomic` / `reverse_commission_atomic` — POSTED operating expense (account **6100**), balanced (`DR 6100 / CR 1111 Cash`), duplicate/cancellation protection. (Live-absent until fixed by #1361 per the 2026-08-07 drift audit.)

---

## 9. Document & print platform

`services/documents/` document-generation platform: unified `documentService`, print/PDF pipeline; PR2 migrated all 17 callers; PR3 acceptance evidence in `docs/documents/`. Private documents vault uses Supabase private storage with signed URLs.

---

## 10. CI/CD & quality gates

- `.github/workflows/ci.yml` on push/PR to `main`: install → migration-evidence check → typecheck (diagnostics on failure) → lint → build → test-file typecheck → main suite → financial suite (diagnostics on failure). Placeholder Supabase env lets the app build credential-free.
- Additional workflows (9 total): browser-readiness, release-blocker gates, `canonical-business-rules-guard` (hashes the Arabic constitution), `execution-plan-guard` (protects governance JSON + GOVERNANCE_LOG), and others.
- Tests: colocated `*.test.ts(x)/`*.spec.ts`, Vitest (happy-dom); `test` script auto-discovers; `test:financials` explicit suite via `--dir src/features/financials`. Playwright e2e config exists (`rentrix-app/playwright.config.ts`, `e2e/`).
- Latest evidence numbers are tracked (with dates) in `11_Current_Status.md`.

---

## 11. Deployment

`rentrix-app/vercel.json`: Vercel build (`pnpm install --frozen-lockfile`, `pnpm --filter @workspace/rentrix run build`, output `dist/public`) + security headers (CSP, `X-Frame-Options`, etc.) scoped to the Supabase origin. PWA: service worker precache, manifest pointing at MALEK assets.

---

## 12. Migration & rollback policy

- Migrations are forward-only, timestamped `YYYYMMDDHHMMSS_name.sql`; every financial migration must ship a rollback file in `supabase/rollback/` (some marked manual).
- Apply path: Supabase CLI/actions per `docs/GOVERNANCE.md`; **every applied migration must be recorded in `docs/GOVERNANCE_LOG.md`** — this logging has been stale since 2026-07-18 (OD-14).
- Live/repository reconciliation via `pnpm supabase:migration-evidence`; the 2026-08-07 audit (`docs/execution/S02_LIVE_DRIFT_AUDIT_20260807.md`) is the current drift baseline.

---

## 13. Engineering governance (summary)

`docs/ENGINEERING_GOVERNANCE.md` (1172 lines) defines: branch/commit/PR discipline, definition-of-done, migration governance, evidence requirements, and doc-update obligations. Two staleness flags recorded for owner decision (D-5 in Deletion Proposal): references to repo name `rentrixxx` (now `malik`) and to a `database.types.ts` types path (actual: `rentrix-app/src/types/database.ts`); §12.4/Appendix A still reference the archived `docs/CURRENT_STATE.md`. Governance content itself remains ACTIVE.

---

## 14. Contributor path

- `AGENTS.md` (root) + `docs/agent-context/` (CONTEXT_MAP etc.) + `.agents/` skills & commands — how agents/humans pick up work, which docs to read first, and per-area commands. Several reference paths are stale (dangling `CURRENT_STATE.md` rows) — flagged D-5.
- Entry reading order for a new developer is in `README.md` of this source-of-truth folder.

---

## 15. Known architecture debts & limitations

1. GL engine dormant: business RPCs still post via `journal_entries` compat view (`is_legacy_compat=true`, `accounting_period_id=NULL`); `late_posting`/`posting_date` unimplemented; reports read subledgers not GL; no first OPEN period seeded (S03 gap audit).
2. Eight frozen cross-feature presentation debts (Guard v2 allow-list).
3. Historical reporting views still expose compatibility `owner_id`/`owner_name` fields.
4. Reports page mixed RPC/client wiring (FGR-002).
5. Legacy raster icons `icon-rentrix-192/512.png` retained on disk, unreferenced, guarded by `brand-contract.test.ts`; deletable once a MALEK icon set is approved.
6. `rentrix-app` path/name and repo name remain legacy spelling by ADR 0011 compatibility boundary.
