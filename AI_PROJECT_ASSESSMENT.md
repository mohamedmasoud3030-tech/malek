# MALEK — AI Project Assessment

> **Type:** Non-canonical agent assessment. Canonical authority remains `docs/source-of-truth/`.  
> **Assessed SHA base:** `6500ff5240160278b9700ef743bb0e921473cb58`  
> **Branch:** `arena/01a0163e-malik`  
> **Date:** 2026-08-18  
> **Method:** repository inspection, canonical pack review, local install/dev server, focused contract tests, static product audit cross-check.

## 1. Product definition

**MALEK** is an Arabic-first, RTL, multi-company rental property operations system for real-estate offices in Oman (OMR, 3 decimal places).

Primary value:

- one controlled operational record of properties, units, owners, tenants, contracts;
- collections, expenses, deposits, owner settlements, maintenance;
- accounting-traceable money flows (subledger + posted GL);
- reports, documents, settings, and governed administration.

It is **not** a generic ERP, investment platform, marketplace, or owner/tenant consumer portal for the current release.

Compatibility note: user-visible brand is MALEK; technical paths may still say `rentrix-app` / `rentrix`.

## 2. Users and roles

| Role | Intended use |
|---|---|
| Admin | company setup, users/roles, sensitive approvals, settings |
| Manager | day-to-day operations + many approvals |
| Accountant | financial posting, settlements, reports, S08 review path |
| Operations | properties/units/contracts/maintenance execution |
| Viewer | read-only operational visibility |
| (effective grants) | temporary capability elevation via request/review lifecycle |

Owner and tenant **portals** are out of release scope even though party records exist.

## 3. Business / domain workflow (canonical)

1. Company auth + active company selection + onboarding checklist.
2. Properties/units (+ lands where present) and people (owners/tenants/providers).
3. Owner agreements (versioned terms, collection role, fee basis).
4. Tenant contracts (draft → review → approve → sign → active; evidence separate).
5. Invoicing/collections according to collection role (owner-creditor vs office-creditor).
6. RATE fee on collection; FIXED_MONTHLY daily accrual.
7. Expenses, Due-from-Owner, lawful offset, deposits (2200 liability lifecycle).
8. Owner settlements with atomic source reservation.
9. Bank CSV preview/import and reconciliation.
10. GL statements + control reconciliations; S08 frozen analysis before any S09 correction.
11. Maintenance/services and document vault/print outputs.
12. Reports workspace separate from Financials hub.

Supported operating models:

- **Owner-agency / property management** (agent-net) — primary RC1 path.
- **Master lease / principal** — kernels exist; full product journey not release-complete.

## 4. Technical stack (observed)

| Layer | Reality |
|---|---|
| Frontend | React + Vite + TanStack Router/Query, Tailwind, PWA (`rentrix-app/`) |
| Backend | Supabase Auth + Postgres + RLS + SECURITY DEFINER RPCs + Storage |
| Accounting | Stage-3 GL (18 accounts), journal batches/lines, periods, idempotent posting |
| Tests | Vitest unit/integration, Playwright e2e, pgTAP/DB0 migration gates |
| CI/Deploy | GitHub Actions, Vercel SPA, extensive governance/script guards |
| Docs | Canonical pack D01–D08 + governance D01–D18 decisions |

## 5. Critical journeys

| Journey | Repository state | Runtime/live |
|---|---|---|
| Public landing / legal / login | Present, branded, Arabic RTL | Local dev shell serves 200; no authenticated backend in this sandbox |
| Password recovery | Implemented with neutral copy | Hosted email/redirect proof external |
| Onboarding first value | Backend-driven checklist | Hosted proof pending |
| Property → unit → owner agreement | Strong UI + version RPCs | Hosted pending |
| Contract lifecycle + evidence | Repository-complete framework | Legal profile empty by default; hosted pending |
| Invoice → collect → fee/tax → void/credit | RC1 owner-agency golden tests | Synthetic/ephemeral only |
| Deposits claim/refund/reverse | Governed RPC lifecycle tests | Hosted pending |
| Owner settlement reserve/approve/pay | Atomic reservation tests | Ephemeral gate historically green |
| Bank CSV import | Fail-closed preview/import | Hosted bank file pending |
| Reports / GL / reconciliation | WP-05 engines + report UI | Hosted cycle/sign-off pending |
| Master lease full ops | Kernels only | Not finished product |
| One-office pilot | Contract tests only | **Not done** |

## 6. What is strong

- Deep financial/security design: company RLS, RPC-owned sensitive writes, maker-checker, OMR 3dp, append-only corrections.
- Clear separation of canonical rule vs repository reality vs governed stage credit vs live proof.
- Broad automated coverage (thousands of app tests, financial suites, DB0, guards).
- Arabic-first UX with task-centric IA (Today, Portfolio, Leasing, Money, Services, Reports, Settings).
- Fail-closed posture for missing tax/legal configuration and unauthorized financial writes.

## 7. What is incomplete, risky, or external

| Area | Severity | Notes |
|---|---|---|
| Live Auth Hook / RLS / schema drift proof | Release blocker | Needs authorized QA credentials |
| Backup/restore rehearsal | Release blocker | Documented PENDING_LIVE_EXECUTION |
| One-office full-period pilot | Release blocker | No real pilot evidence |
| Oman legal templates / tax codes | External | Engineering frameworks exist; professional approval required |
| Master lease product completion | High / optional RC1 exclusion | Kernels without full UI/reports |
| Hosted browser acceptance on current SHA | High | Prior runs cancelled/skipped in places |
| SonarCloud automatic gate | Medium | workflow_dispatch only; owner/cost decision |
| PWA install icons on iOS | Low→fixed this session | Was SVG-only; PNG install set added |
| robots.txt sitemap URL | Low→fixed this session | Was relative; now absolute |
| Bundle size / CSP unsafe-inline | Low–medium | Known, not silent data risk |
| Observability/monitoring | Medium ops | No centralized alerts proven |

## 8. Evidence from this session

- `pnpm install --frozen-lockfile` succeeded (pnpm 10.11.1).
- Dev server started on `0.0.0.0:5173`; public routes `/`, `/landing`, `/login`, `/privacy`, `/terms`, `/manifest.json` returned HTTP 200.
- Focused brand/sitemap contract tests: **31/31 PASS**.
- No production secrets were present or required for the first safe milestone.
- Authenticated financial journeys could **not** be exercised here (no QA Supabase credentials).

## 9. Assessment verdict

MALEK is a **mature brownfield Release Candidate candidate** with a strong security/accounting core in the repository. It is **not** proven production-ready until live environment, backup restore, hosted acceptance, professional tax/legal sign-off, and a reconciled one-office pilot complete.

Highest owner-facing product risk is not “missing screens”; it is **claiming readiness without live money-cycle proof**. Highest safe autonomous engineering value now is closing remaining repository UX/install/ops defects and keeping financial invariants protected while external gates wait for credentials/approvals.
