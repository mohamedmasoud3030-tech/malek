# MALEK — Full Test Strategy (Risk-Based)

> **Status:** Active strategy document (living during the testing mission).
> **Branch:** `arena/01a01776-malek`
> **Base SHA:** `091496423b1fe2ab23354cf25eedc1b2c6b229ae`
> **Date:** 2026-08-19
> **Author:** Arena orchestration agent (no specialist-model routing was verifiable in this environment — see session disclosure).

This document is the single risk-based testing plan for the whole repository. It replaces a generic testing-pyramid or blanket-coverage approach with evidence: every decision is driven by the real architecture, the 77 canonical rules, the 23-gap register, the existing test surface, CI gates, and the production defect history.

---

## 0. How to read this document

MALEK separates four layers of truth that must never be collapsed (`REL-001`, `AGENTS.md`):

1. **Canonical rule** — what the product must do (Canonical Pack docs 01–08).
2. **Repository reality** — code, migrations, tests and evidence that physically exist at a SHA.
3. **Governed stage credit** — `governance/10-stage-master-plan.json` + ledgers (agent must not self-grant).
4. **Runtime/live verification** — deployed Auth/Postgres/Storage/browser/pilot proof.

A green test never grants stage credit, and a missing stage credit never means "no implementation exists." This strategy operates on **repository reality** and labels hosted/live checks explicitly as external gates.

---

## 1. Phase 1 — Complete test inventory

### 1.1 Product and architecture (one paragraph)

MALEK is an Arabic-first, RTL, multi-company property-operations system (React 19 + Vite + TypeScript + Tailwind + TanStack Router/Query, backed by Supabase Auth/Postgres/Storage). Security and financial correctness are enforced at the **database** boundary (RLS, company-scoped constraints, `SECURITY DEFINER` business RPCs, balanced GL posting). The browser is a display/entry surface, never a trust boundary (`SEC-009`). Money is OMR to 3 decimals, server-owned (`FIN-013`).

### 1.2 User roles

Six roles (`SEC-004`, `permissions.ts`): `ADMIN`, `MANAGER`, `ACCOUNTANT`, `OPERATIONS`, `USER`, `VIEWER`. Authorization is capability/effective-permission based (`SEC-005`), Maker-Checker separation applies to designated sensitive approvals (`SEC-008`).

### 1.3 Critical end-to-end journeys

Canonical journey matrix (Doc 2): A owner-agency onboarding → B tenant contract lifecycle (draft→review→approved→signed→active) → C `OWNER_IS_CREDITOR` collection → D `OFFICE_IS_CREDITOR` billing/collection → E expenses/maintenance → F deposits → G owner settlement → H MASTER_LEASE (separate principal module) → I banking/reconciliation → J historical remediation (S08→S09).

### 1.4 Business rules, calculations and state transitions

- 77 canonical rules: `PRD-`×10, `OPS-`×15, `DOM-`×10, `FIN-`×20, `SEC-`×10, `UX-`×8, `REL-`×4.
- Financial kernel: 18-account chart, balanced journal batches/lines, `DRAFT→POSTED→REVERSED`, periods `OPEN→SOFT_CLOSED→HARD_CLOSED`, agent-net vs principal (MASTER_LEASE) separation, RATE-on-collection vs FIXED_MONTHLY daily accrual, versioned tax profiles, OMR 3dp, subledger↔GL reconciliation ≤0.001 tolerance.
- Lifecycles: owner-agreement versioning, contract maker-checker, invoice credit/reversal, deposit held→applied/refunded, settlement DRAFT→APPROVED→PAID, S08 frozen review → S09 append-only correction.

### 1.5 Data model, permissions, tenancy boundaries

- Company is the isolation root. 76 tenant tables / 204 RLS policies verified by WP-DB0 with 0 isolation violations at baseline.
- `people` identity vs owner/tenant profiles; property→unit; payment vs receipt vs allocation; deposits; owner settlements with atomic reservations (one source ≤ one active settlement); GL batches/lines.
- Auth Hook `custom_access_token_hook` + `company_members` membership → JWT company claim; RLS + FK + RPC revalidation.

### 1.6 Integrations and external surfaces

Verified by dependency and code scan:

- **Supabase** — Auth (session, password recovery), Postgres (RLS/RPC), Storage (private buckets, signed URLs).
- **AI Assistant** — one Edge Function (`supabase/functions/ai-assistant/index.ts`); read-only decision support, no accounting authority (`PRD-008`, `UX-007`).
- **WhatsApp** — client-side `wa.me` deep links only (`services/whatsapp.ts`); no provider API or webhook.
- **Automation** — UI catalog only; backend job execution is explicitly deferred (no scheduler/provider integration).
- **No payment gateway, no webhooks, no email provider, no Stripe** in dependencies. Env surface is minimal: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (+ `VITE_E2E`, `BASE_URL`, `DEV`).

### 1.7 Frontend forms, interactions, mobile/RTL/a11y

Route IA with 7 top-level roots; hub/workspace shells; dense registers (semantic table ≥768px, true mobile register <768px, no horizontal scroll/sticky actions); dialogs, focus management, touch-target floor, RTL Arabic, company-aware money/date formatting; intentional loading/empty/error/permission states for every protected surface (`UX-008`).

### 1.8 PWA

`VitePWA` `registerType: autoUpdate`, `public/manifest.json` (MALEK icons), precache install-shell only (no lazy JS chunks), `NetworkFirst` navigations (3s timeout), `StaleWhileRevalidate` static assets, `navigateFallbackDenylist: /^\/api\//`, `offline.html` fallback. Legacy Rentrix/MALIK icons are excluded from precache.

### 1.9 Deployment and post-release smoke

Vercel deploy (`vercel.json` CSP), Supabase migration apply, `supabase:migration-evidence`, `supabase:live-readiness`, hosted QA preflight (`qa:preflight` / `qa:database-contracts` / `qa:lifecycle`), one-office pilot (`REL-003`, `GAP-022`).

### 1.10 Existing test inventory (repository reality)

| Layer | Tool | Count at base SHA | Entry points |
|---|---|---|---|
| Unit / component / integration (frontend) | Vitest 3.2.7 (happy-dom) | **476** test files (480 with this mission's 4 additions) | `pnpm --filter ./rentrix-app run test` |
| Financial regression subset | Vitest | subset (393 financial tests) | `pnpm --filter ./rentrix-app run test:financials` |
| E2E / browser | Playwright 1.61.1 (chromium desktop/tablet/mobile) | **26** specs | `pnpm e2e` (hermetic Browser Readiness; seeded staging) |
| Database pgTAP-style SQL | `supabase/tests/*.sql` | **35** files | `pnpm test:supabase`, `test:supabase:rls` |
| DB replay + contract + isolation gates | PGlite `scripts/db0/*` | gates | `pnpm db0:gate` (7/7 at baseline) |
| Static security/regression guards | `scripts/check-*.mjs`, `scripts/ci/*` | ~15 scripts | CI + `pnpm check:*`, `test:*` |

CI quality gates (workflows):

- `ci.yml` — governance guard, migration hygiene, QA runtime syntax, `supabase:migration-evidence`, WP-DB0 gates, doc links, typecheck, lint, architecture check, production build, full app tests, financial tests.
- `release-blocker-gate.yml` — code (typecheck/tests/build + secret-leak scan) and database (ephemeral Supabase replay + isolated single-office lifecycle + Storage blockers), plus manual-only authenticated staging.
- `browser-readiness.yml` — 3 hermetic shards (desktop/tablet/mobile) with stubbed Supabase; manual-only seeded staging.
- `canonical-business-rules-guard.yml`, `execution-plan-guard.yml` — locked governance integrity + owner-approval gates.
- `hosted-qa-verification.yml`, `supabase-live-readiness.yml`, `supabase-production-migrations.yml` — manual/authorized.

Coverage tooling: `@vitest/coverage-v8` is present but intentionally **not** wired as a gate. Per mission guidance, coverage percentage is not a goal; risk coverage is.

Skipped/flaky: 4 `it.skipIf(!FIX_FILE)` environmental gates exist in `p0-multi-tenant-isolation.test.ts`; no `.only` usage. CI forbids `.only` in E2E (`forbidOnly`). E2E runs with `retries: 1` in CI; Vitest has no retries configured.

Baseline results: see §7.

---

## 2. Phase 2 — Risk model

### 2.1 Risk factors

Each area is scored on: **business impact**, **data/security impact**, **regression likelihood**, **change frequency**, **complexity**, **external dependency**, **ease of detecting failure** (detectability). `Risk = Impact × Likelihood`, adjusted down when a fast deterministic test exists (detectability) and up when failure is silent (data corruption/security).

### 2.2 Ranked risk register

Severity legend: **C** = Critical, **H** = High, **M** = Medium, **L** = Low. "Protection today" = repository evidence at base SHA.

| # | Area | Sev | Why | Protection today (repo) | Unprotected residue |
|---|---|---|---|---|---|
| 1 | Company/tenant isolation (cross-company read/write) | C | P0 data disclosure / mutation | RLS matrix, WP-DB0 isolation gate (76 tables/204 policies, 0 violations), pgTAP two-company, p0 tests | hosted Auth Hook / live RLS drift (`GAP-003`, external) |
| 2 | GL posting/reversal/idempotency (balanced batches, 3dp, append-only) | C | financial truth | Stage-3 suites, posting engine, idempotency, db0 contract | hosted/pilot proof (`GAP-013/014` external) |
| 3 | Owner-agency billing/collection/fee/tax mapping (`GAP-006/007/010`) | C | revenue/AR/VAT misstatement | wp02 golden tests, pgTAP gap006/007/010 | hosted lifecycle + statutory tax confirmation |
| 4 | Deposits subledger ↔ 2200 (3dp, RPC-only, reversal) | C | client-money integrity | `wp02-gap009-deposit-lifecycle` 19 tests, pgTAP | hosted proof |
| 5 | Settlement reservation (one source ≤ one active settlement) | C | double payout | atomic reservation RPC tests, pgTAP, PGlite matrix | hosted proof |
| 6 | Due-from-Owner / lawful offset / post-payout recovery (`GAP-008`) | H | negative payable / lost receivable | pgTAP gap008 (23), wp02 tests | hosted proof |
| 7 | MASTER_LEASE correctness & truthful labeling (`GAP-012`) | H | IFRS overclaim | S06 kernel unit/integration tests | no complete UI/service/reports; product decision |
| 8 | Bank CSV import fail-closed (`GAP-017`) | H | partial/duplicate cash data | `bankCsvParser.test.ts` (26 cases) + pgTAP (55) | hosted import on authorized bank data |
| 9 | S08 frozen review → S09 correction gates | H | wrong-company/period correction | pgTAP gap015 (25) + gap016 (32) | Accounting sign-off (blocked by governance) |
| 10 | Maker-Checker separation on sensitive approvals | H | self-approval | contract lifecycle pgTAP, permission-review self-approval | hosted verification |
| 11 | Sensitive browser write boundary (no direct financial writes) | H | RPC bypass | `check-sensitive-financial-write-boundary.mjs`, pgTAP | re-run at exact release SHA |
| 12 | Auth/session fail-closed + no account enumeration | H | account takeover | auth-service tests, login tests | hosted email delivery/redirects |
| 13 | Six-role → capability → route/button visibility | H | wrong access | permissions tests, r5 matrix, permission-visibility, route-contract | hosted role data migration |
| 14 | Business-reference display (never leak internal UUID as reference) | M | operator confusion / data-integrity | **NEW** `business-reference.test.ts` (this mission) | — |
| 15 | Company-aware money/date display (OMR 3dp, currency, locale) | M | wrong displayed amounts | formatters + **NEW** `companyFormatters.test.ts` | — |
| 16 | Maintenance lifecycle vocabulary (Cancelled ≠ Closed) | M | wrong state in filters/reports | **NEW** `maintenanceStatus.test.ts` | — |
| 17 | Owner financial read boundary (cross-owner guard, fail-closed parsing) | M | wrong owner numbers | **NEW** `owner-financial-service.test.ts` | — |
| 18 | RTL/mobile/tablet/a11y rendering | M | unusable operators | visual-wave tests, a11y baseline, touch-target, cross-device contract, E2E shards | hosted browser acceptance (`GAP-020`) |
| 19 | PWA install/offline/update + CSP + DOMPurify | M | security/availability | platform-security-contract, brand contract, pwa-install-prompt | real-device install |
| 20 | AI Assistant isolation (read-only, quota, guardrails) | M | misuse | ai-assistant service/quota/context tests | edge function hosted |
| 21 | WhatsApp/communication outbound (wa.me only) | L | low (no provider) | whatsapp tests, outbound-communication tests | — |
| 22 | Automation catalog (deferred backend) | L | no runtime yet | automation tests (service/dispatch/catalog) | — |

### 2.3 Unprotected Critical/High risks first (findings)

- **Critical/High risks are overwhelmingly protected at the repository layer** by existing tests + CI gates. The remaining exposure for those is **external** (hosted Auth/RLS/schema drift, statutory tax/legal approval, accounting sign-off, real pilot) — these are gated by `GAP-003/010/019/020/021/022` and cannot be closed by more local unit tests; they require authorized environment access and owner decisions.
- **The full local test suite was RED at SHA `0914964`** due to 6 pre-existing test-drift defects, and is now **GREEN (3071/3071)** after the test-only fix in §7.1 — the strongest single reliability improvement of this mission.
- **Real repository holes found this mission** (no sibling/cross coverage) were Medium-severity but user-visible/financial-adjacent: business-reference leakage, company money/date formatting, maintenance status vocabulary, and the owner-financial read boundary. These are closed in Group 1 (§4).
- **Watching items** (verified covered but worth periodic re-checks): bank CSV parser (already 26 cases), sensitive-write scan, SECURITY DEFINER `search_path`/grant hygiene (WP-DB0 isolation gate + S02 inventory).

---

## 3. Phase 3 — Test architecture

### 3.1 Layer selection policy (lowest-cost reliable layer first)

| Layer | Use for | MALEK convention |
|---|---|---|
| **Unit (pure)** | deterministic business rules, parsers, formatters, normalization, validators | Vitest, no DOM, no mock — e.g. `lib/money.test.ts` |
| **Component/interaction** | form behavior, dialogs, focus, mobile/RTL/a11y states | Vitest + happy-dom + Testing Library |
| **Integration (service)** | Supabase/RPC boundary, auth session, owner/company resolution, error mapping | Vitest + `vi.mock('@/lib/supabase')` |
| **Database contract / migration** | schema↔types↔frontend drift, RLS enablement, isolation, replay/idempotency | PGlite (`scripts/db0`, `rls-matrix.mjs`) |
| **pgTAP-style SQL** | RPC lifecycle, RLS negatives, triggers, invariants | `supabase/tests/*.sql` (run via `pnpm test:supabase`) |
| **Contract (source-level)** | locked configs (CSP, PWA, DOMPurify, brand, fonts, migration hygiene) | Vitest file-read assertions (e.g. `platform-security-contract.test.ts`) |
| **E2E (small)** | critical cross-layer journeys (login, single-office lifecycle, read-only auth) | Playwright, 3 projects; hermetic + staged |
| **Accessibility / visual** | contrast, focus, touch targets, RTL overflow | axe-core in E2E + `visual-wave-*` vitest contracts |
| **PWA / perf / smoke** | install shell, offline, cache scope, post-release readiness | contract tests + `qa:preflight` + readiness scripts |

### 3.2 Failure-path coverage contract

Every Critical/High area must cover, where relevant: **success**, **failure/reversal**, **invalid/empty/boundary**, **unauthorized**, **cross-company/cross-user**, **duplicate/retry idempotency**, **timeout**, **concurrency/advisory-lock**, **provider/backend outage**, **mobile/RTL/a11y**, and **data integrity**. The existing suite already covers the financial matrix (golden + VOID/reversal + isolation + idempotency); the new Group 1 tests add failure/boundary/normalization and cross-owner guard coverage for previously untested modules.

### 3.3 Anti-patterns (do not)

- Do not couple tests to implementation details; assert behavior/contracts.
- Do not duplicate coverage that already exists (e.g. do not re-test `formatMoney` through five wrappers).
- Do not mock RLS/permissions away to make a test green; the database remains authoritative.
- Do not add new tooling/dependencies; reuse Vitest/Playwright/PGlite/pgTAP and repo scripts.
- Do not change expected product behavior to pass a test; register defects separately.

---

## 4. Phase 4 — Implementation in value order

### Group 1 — Critical security/data/core-journey protection (DONE this mission)

Four new deterministic tests, zero new dependencies, all passing (31/31), all auto-discovered by CI's full suite:

| File | Protects | Cases | Result |
|---|---|---|---|
| `rentrix-app/src/lib/business-reference.test.ts` | Never surface an internal UUID as a business reference; field precedence, trimming, non-string handling, label fallback | 10 | PASS |
| `rentrix-app/src/lib/maintenanceStatus.test.ts` | Canonical status/priority vocabulary incl. R8 "Cancelled ≠ Closed"; legacy synonyms; case/whitespace; fail-safe defaults | 9 | PASS |
| `rentrix-app/src/lib/companyFormatters.test.ts` | OMR 3dp display, currency minor-unit, locale, timezone, null-amount, default contract | 7 | PASS |
| `rentrix-app/src/features/owners/services/owner-financial-service.test.ts` | Owner financial read boundary: cross-owner guard, fail-closed on non-finite server values, never derive net client-side, error passthrough | 5 | PASS |

### Group 2 — High-risk business/integration behavior (candidates, not yet implemented)

- Bank CSV parser: add row-count/size-limit and "all errors surfaced before any write" boundary cases if the pgTAP 55-case layer is judged insufficient at a future audit (currently low marginal value).
- `contractPaymentService` payment-row mapping/aggregation (summary totals correctness) — no sibling test today.
- `commission-source-service` source-resolution mapping.

### Group 3 — Frontend/PWA/a11y regression (candidates)

- `offline.html` content contract (honest offline messaging; no false "write queued" claim).
- Mobile-register datum-visibility and touch-target cases are already covered by `entity-table.mobile-datum-visibility` and `touch-target-floor`; only add cases for newly added registers.

### Group 4 — Lower risk

- Only when maintenance value is justified (e.g. `query-keys` factory shape).

### CI quality-gate decision

**No CI workflow change was made.** Rationale: every Vitest file is auto-discovered by `vitest run` in `ci.yml` ("full application tests") and `release-blocker-gate.yml`, so the four new files are gated automatically. Adding a separate CI step would duplicate execution and slow every PR. A gate change is only warranted if a future test needs a new runner (e.g. a new Playwright project), not for Vitest additions.

---

## 5. Commands

### Local (this environment)

```bash
corepack enable                        # activate pnpm 10.11.1 (repo-pinned)
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter ./rentrix-app rebuild esbuild

pnpm --filter ./rentrix-app run typecheck        # app typecheck
pnpm --filter ./rentrix-app run typecheck:test   # test typecheck
pnpm --filter ./rentrix-app run test             # full Vitest suite (unit/component/integration)
pnpm --filter ./rentrix-app run test:financials  # financial regression subset
pnpm db0:gate                                    # PGlite replay/idempotency/contract/isolation gates
pnpm test:supabase                               # privileged-key scan + RLS matrix + focused client tests
pnpm e2e                                         # Playwright (hermetic; requires chromium)
pnpm build                                       # production build (real Supabase env)
```

### CI (already configured)

`ci.yml`, `release-blocker-gate.yml`, `browser-readiness.yml`, `canonical-business-rules-guard.yml`, `execution-plan-guard.yml` run automatically on PRs to `main`. Hosted/live gates (`hosted-qa-verification`, `supabase-live-readiness`, authenticated/seeded staging) are manual and credential-gated.

---

## 6. Manual checks that cannot be reliably automated here

1. **Hosted Auth Hook / JWT claim / live RLS negative tests** (`GAP-003`) — requires authorized QA/live credentials.
2. **Live schema vs migration-ledger parity** — `verify-supabase-live-readiness.sh` requires the live project.
3. **Bank import on real bank CSV data** (`GAP-017`) — requires authorized bank files.
4. **S08 frozen-dataset Accounting sign-off** and **S09 activation** — genuine professional sign-off, not a CI result.
5. **Oman statutory tax code/rate confirmation** (`GAP-010`) and **contract legal wording/registration profile** (`GAP-019`).
6. **Real-device PWA install, offline, and update** (iOS Safari, Android) and **print/PDF visual acceptance** in Arabic.
7. **One-office full-period pilot + control-account reconciliation** (`GAP-022`).
8. **Browser readiness on the hosted candidate** — hermetic E2E is not a substitute for authenticated/seeded staging.

---

## 7. Baseline and final results (executed locally, base SHA `0914964`)

| Check | Result |
|---|---|
| App typecheck (`pnpm --filter ./rentrix-app run typecheck`) | PASS |
| Test typecheck (`typecheck:test`) | PASS |
| New Group-1 tests | **31/31 PASS** (4 files) |
| Full Vitest suite (`pnpm --filter ./rentrix-app run test`) | **480/480 files, 3071/3071 tests, 0 failed, 0 skipped — exit 0** (after the §7.1 test-drift fix) |
| Migration replay (`node scripts/db0/replay-migrations.mjs --all`) | **PASS — 282/282 applied, 0 failures** |
| WP-DB0 gates (`pnpm db0:gate`) | not re-run (baseline 7/7 at prior integrated head) |
| E2E / Browser (`pnpm e2e`) | not executed locally (chromium binary + hermetic backend; CI-owned) |
| Financial tests (`test:financials`) | subset of the full suite (included above) |

### 7.1 Pre-existing failures — root cause, classification and resolution

The 6 failed tests (and 5 additional suite-level failures) existed at the base SHA **independently of this mission** — no production code was touched, and the canonical migration replay passed 282/282, so **none of these are database/product defects**. All were **test-drift defects**, fixed this mission with test-only edits (no production behavior changed):

| # | Failing file | Root cause | Fix applied |
|---|---|---|---|
| 1 | `src/p0/p0-multi-tenant-isolation.test.ts` | historical "pre-fix" replay did not exclude the new `20260831000000_hot_path_fk_covering_indexes.sql` migration | added `hot_path_fk_covering_indexes` to the replay filter |
| 2–5 | `src/p1/p1-forward-rollback.test.ts`, `src/p3/phase3a1b-forward-rollback.test.ts`, `src/p3/phase3a1b-inventory-catalog.test.ts`, `src/p3/phase3a1c-catalog-contract.test.ts`, `src/p3/phase3a1c-forward-rollback.test.ts` | same: checkpoint replays omit FA-003/S03/S04/WP-02/RC1 but not the hot-path index migration, which then references absent tables/columns | added `hot_path_fk_covering_indexes` to the shared `LATER_GOVERNED_STAGE_MARKERS` in `replay-bootstrap.ts` (covers files 2–5) and to the p1 filter |
| 6 | `src/features/contracts/confirmation-dialogs-ux.test.ts` | asserted an outdated confirm-dialog description | updated expectation to the current canonical copy (retention intent preserved) |
| 7 | `src/features/owners/OwnersPage.test.tsx` | expected `جار التحميل`; canonical label is `جارٍ التحميل` | updated expectation |
| 8 | `src/features/financials/expenses/expenseService-list.test.ts` | expected `تعذر تحميل المصاريف`; canonical message is `تعذر تحميل المصروفات` | updated expectation |
| 9 | `src/services/documents/contextualDocumentsService.lifecycle.test.ts` | supabase mock query-chain lacked `.maybeSingle()` | added `maybeSingle` to the mock chain |
| 10 | `src/features/financials/expenses/expenseService-fields.test.ts` | supabase mock query-chain lacked `.maybeSingle()` | renamed mock `single` → `maybeSingle` |

**Consequence:** at SHA `0914964` the full test step (`pnpm --filter ./rentrix-app run test`) now exits **0** — the CI "full application tests" and "release-blocker" test steps are expected to be green again. The 4 `it.skipIf(!FIX_FILE)` gates in `p0-multi-tenant-isolation.test.ts` run (not skipped) because the fix migration `20260724120000_p0_company_isolation_reports_rls.sql` is present.

---

## 8. Guardrails and next stage

- Keep financial/sensitive behavior authoritative at the database; never weaken RLS, permissions, types, or tests to make a gate green.
- Report repository reality, governed credit, and runtime proof separately.
- Next stage (recommended): (1) adopt Group 2 candidates on the next financial-hardening PR; (2) schedule the hosted/live and pilot gates (owner-gated) that close the external `GAP-003/020/021/022` exposure; (3) after any new register/route ships, add its mobile-register + permission-visibility case in the same PR.
