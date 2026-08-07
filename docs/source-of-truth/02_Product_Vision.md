# 02 — Product Vision (canonical)

> This document consolidates the product vision, identity, market positioning, and operating models discovered across the entire documentation set. Where a **LOCKED** source exists (constitution, ADR 0011-family), this document summarizes and points to it — the locked source remains the single binding text.

## Sources merged here

| Source | What was taken |
|---|---|
| `docs/PRODUCT.md` | Product purpose, users, areas, receipts/collections rule |
| `docs/APP_STATUS.md` §1 | Verified product definition & tech stack |
| `docs/audits/COMPETITIVE_BENCHMARK_20260724.md` | Market analysis, Gulf localization rationale |
| `docs/business/CANONICAL_BUSINESS_AND_CONTRACT_RULES_AR.md` | Four operating models (LOCKED summary) |
| `docs/decisions/0011-malek-visible-brand-identity.md` + `docs/brand/MALEK_ASSET_CONTRACT.md` | Name & identity |
| `README.md`, `AGENTS.md` (brand notes) | Technical naming boundary (`rentrix-*` identifiers frozen) |
| `docs/MULTI_TENANT_ARCHITECTURE.md` + P0 audit | Single-office → multi-tenant SaaS evolution |
| `docs/audits/2026-07-07-workflow-audit-ar.md` | Original office operating scenarios |

---

## 1. What the product is

**MALEK** (Arabic: **مالك** — tagline: **كل أملاكك في مكان واحد**, "all your properties in one place") is an Arabic-first (RTL), mobile-first rental-property management platform for real-estate offices in the Gulf, with the current commercial focus on **Oman**. It gives a property-management office **one system of record for contracts and money movement** — replacing spreadsheets and disconnected tools — so that invoices, payments, expenses, deposits, and owner payouts stay consistent and auditable.

- **Form:** React 19 + TypeScript + Vite PWA (installable; offline shell), TanStack Router/Query, Tailwind v4.
- **Backend:** Supabase (Postgres + Auth + RLS + atomic SECURITY DEFINER RPCs), deployed on Vercel (`https://rentrixapp.vercel.app`).
- **Currency/precision:** OMR, 3 decimal places, server-side rounding unit 0.001 (LOCKED — see `04_Accounting.md`).
- **Tenancy:** multi-tenant SaaS. Every operational row carries `company_id`; RLS restrictive policies (`p0_tenant_isolation`) plus JWT-derived `current_company_id()` isolate each office. The first commercial milestone is nevertheless a **controlled single-office pilot** (see `10_Roadmap.md`).

### Naming boundary (decided)

- User-visible English name: **MALEK**; Arabic name **مالك**; fixed Arabic tagline.
- The repository name (`malik`), app directory (`rentrix-app/`), package name (`@workspace/rentrix`), persisted storage keys (`rentrix-theme`, `rentrix-auth-session`, …), the Vercel host (`rentrixapp.vercel.app`), database object names, and historical migrations intentionally keep legacy spellings. These are invisible to users and frozen until a separately planned migration changes them safely. They may not leak into user-facing UI.
- ⚠️ residue: several docs (root `README.md`, `AGENTS.md`, `docs/TESTING.md` brand notes; MALIK-era audit docs) still describe **MALIK** as the visible name. Chronology resolves it (MALIK brand audit 2026-07-28 → MALEK identity ADR 0011 on 2026-08-04, confirmed live in `index.html`/manifest), and the doc updates are tracked as conflict **C-01** in `13_Conflict_Report.md`.

## 2. Who it serves

Office staff who run day-to-day property management:

- **Primary:** office manager (ADMIN), operations manager (MANAGER), accountant/data-entry (USER) — the three roles implemented in code today (`features/auth/permissions.ts`).
- **Planned (ADR 0003-financial):** Accountant, Viewer, and future read-only **Owner** and **Tenant** portal roles — decided as product scope, not yet implemented (conflict **C-05**/OD-04).
- Geography-localized for Gulf practice: Arabic-first UI, OMR precision, VAT-configurable (disabled by default, no hard-coded statutory rate), local document printing.

## 3. What the product is for (jobs)

1. **Portfolio management** — properties, units, lands; ownership & management agreements; 360° property workspaces.
2. **Relationship management** — owners, tenants, people directory, leads, communication log.
3. **Contract & billing operations** — tenant contracts, billing schedules, invoices.
4. **Money movement** — collections, receipts, expenses, deposits, owner settlements, bank reconciliation, commissions.
5. **Operations** — maintenance, utilities, automation, documents vault.
6. **Reports & decisions** — operational and financial reports, statements, read-only AI assistant.
7. **Administration & governance** — company settings, audit log, data-integrity checks, system governance.

The phone bottom bar intentionally exposes only five daily hubs (Dashboard, Properties, Contracts, Financial overview, Reports); everything else lives in the drawer — a deliberate UX decision (docs/PRODUCT.md).

## 4. Operating models (LOCKED — constitution §2)

| Model | Office role | Presentation | Default `collection_role` | Rent is office revenue? |
|---|---|---|---|---|
| `OWNER_AGENCY` (property management) | Agent | NET | `OWNER_IS_CREDITOR` | No — office revenue = management fee + contractually granted charges |
| `MASTER_LEASE` | Principal | GROSS | `OFFICE_IS_CREDITOR` | Yes — separate module with ROU asset/lease liability; never mixed with owner settlements |
| `OFFICE_OWNED` | Principal | GROSS | `OFFICE_IS_CREDITOR` | Yes — no owner agreement required |
| `BROKERAGE_OR_COLLECTION_ONLY` | Agent | NET | Explicit per agreement | No — revenue = brokerage fee |

`collection_role` is stored **explicitly** in the owner agreement and snapshotted into each activated tenant contract — never inferred from invoice names or bank accounts.

## 5. Market position (from the 2026-07-24 competitive benchmark)

- Global leaders (AppFolio, Buildium, Yardi, DoorLoop, TenantCloud, MRI) prove the bar: strict double-entry trust accounting, segregated subledgers, drill-down reporting, strong mobile.
- None of them serve Arabic RTL natively or localize for Gulf practice (OMR 3dp, Omani/GCC VAT configurability, Arabic legal-document printing).
- **Strategic target:** "unrivaled Gulf specialist" — strict double-entry ledger with isolated per-company charts, server-derived numbers, drill-down everywhere, flawless RTL, mobile-first operations.
- Benchmark-derived practices adopted into the product plan: subledger-per-obligation with control-account reconciliation, immutable audit trail, KPI→source drill-down (now mandatory in finance UI per ADR 0014).

## 6. Product principles discovered (recurring across docs)

1. **Server is the source of truth for money.** The browser never computes or asserts amounts; numbers are server-derived, idempotent, and atomic.
2. **No silent history changes.** Posted financial records are append-only; corrections are reversals; agreements/contracts are versioned.
3. **Fail closed, never fall back.** Ambiguity (accounts, periods, mappings, file rows) blocks the operation loudly — no silent partial success.
4. **Arabic-first, mobile-first, offline-tolerant.** RTL is first-class; phone workflows are primary; PWA shell works offline.
5. **One office daily-rhythm first.** The product is sequenced around one office's day: due invoices → collections → expenses → maintenance → daily reports → audit review (single-office pilot doctrine).
6. **Docs yield to reality.** Code and the live database outrank any document; mismatches are fixed in docs in the same change (AGENTS.md / docs/README policy).

## 7. Explicit non-goals (discovered & rejected)

- Not a white-label platform; no per-company theming (from `ui-ux/RENTRIX_FULL_PRODUCT_AUDIT.md` scope statement, still consistent with direction).
- No React-Native app; web PWA only (ADR 0012 §9).
- No third portals (owner/tenant) in the current execution window (ADR 0003: "future read-only scoped roles").
- No multi-currency in current policy (decision deferred — OD-05).
- No marketing-site focus; the landing page is a secondary surface.
- No chatbot that acts on financial data — the AI assistant is **read-only by design** with 4 fixed actions (arrears summary, renewals, reminder draft, financial snapshot), no autonomous execution.

## 8. Current reality check

| Statement | Status |
|---|---|
| Product = Arabic-first Gulf property-management office system | ✅ still matches |
| Single-office system of record | ⚠️ evolved — multi-tenant SaaS infra shipped (P0/S02); **single-office pilot remains the commercial milestone** |
| Receipts/collections from posted payments, VOID excluded | ✅ still matches (README + DOMAIN + FGR-001 closed) |
| Multi-currency & deferred revenue separate decisions | ⚠️ deferred-revenue handling decided (dual model, 0001 + D03); multi-currency still undecided (OD-05) |
| Commission = operational tracking only (DOMAIN note) | ⚠️ outdated — atomic lifecycle RPCs (create/update/cancel/pay/reverse) exist since #1361; accounting treatment now decided in D03/D05 — see `09_Feature_Catalog` |
