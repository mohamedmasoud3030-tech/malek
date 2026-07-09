# Rentrix 99.9% Readiness Audit Report

Date: 2026-07-08  
Branch: `docs/readiness-99-9-audit-report`  
Scope: Repository-wide readiness audit using all local Rentrix agent skills as review lenses.

## Executive summary

The checked-out Rentrix application is in a strong local engineering state: TypeScript checks, the Vitest suite, the focused financial suite, and the production Vite build all pass locally. The application also has a broad route surface, Supabase-backed feature services, a documented migration strategy, and a maintained feature gap register.

However, Rentrix should **not** be called 99.9% production-ready yet. The blocking issues are not basic compile/test failures; they are production-readiness gaps around live Supabase verification, browser/E2E release gates, financial workflow proof, operation-level permissions, and product/accounting decisions that are now recorded but not implemented or release-verified.

Estimated readiness from the available evidence: **approximately 80-85% production readiness**, with high local code confidence but incomplete release, live-data, and end-to-end confidence.

## Skills applied

This audit used the repository's local skills as structured review lenses:

| Skill | How it was applied |
| --- | --- |
| `frontend-integration` | Reviewed user-facing routes, feature readiness, navigation, reports, financial screens, and the gap between route existence and complete user workflows. |
| `supabase-data-contracts` | Reviewed Supabase/RPC/migration caveats, live-schema verification requirements, and frontend/backend contract risks. |
| `financial-reporting` | Reviewed receipts, payments, VOID handling, report source-of-truth issues, owner/tenant statements, settlements, and accounting basis blockers. |
| `testing-release-readiness` | Ran local release checks and compared results against the documented release gates and open feature gaps. |
| `react-patterns` | Reviewed React route/component architecture, route guards, lazy route loading, and feature composition at a high level. |
| `react-testing` | Reviewed the Vitest coverage status and test-suite output, including the focused financial suite. |
| `postgres-patterns` | Reviewed schema/RPC/RLS risk areas and the need for live `information_schema`, `pg_policies`, and `pg_get_functiondef` checks. |
| `database-migrations` | Reviewed migration ordering/evidence, immutable migration expectations, and live-ledger reconciliation blockers. |
| `security-review` | Reviewed route guards, the separation between frontend route permissions and backend RLS/RPC grants, and missing operation-level financial permissions. |
| `superpowers-systematic-debugging` | Treated warnings and blocked checks as findings with likely root causes rather than ignoring them as noise. |
| `error-handling` | Reviewed catch/error patterns and user-facing failure states at audit level; no code changes were made. |
| `vite-patterns` | Verified Vite build behavior through the production build command and reviewed package scripts. |
| `browser-qa` | Applied the browser QA checklist conceptually; actual browser QA was not run because there is no seeded E2E setup, credentials, or target preview URL in this task. |
| `design-system` | Reviewed the existing UX/navigation/responsive audit findings for consistency, mobile behavior, contrast, and RTL risks. |
| `frontend-a11y` | Reviewed accessibility risks documented in the UX audit, especially keyboard, focus, semantic tabs/filters, and contrast validation gaps. |

## Checks performed

The following commands were run from the repository root:

```bash
pnpm --version
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm --filter @workspace/rentrix run typecheck:test
pnpm --filter @workspace/rentrix run test:financials
pnpm --filter @workspace/rentrix run test
pnpm build
pnpm supabase:migration-evidence
git status --short
```

### Results

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --version` | Pass | Reported pnpm `10.11.1`. |
| `pnpm install --frozen-lockfile` | Pass with warning | Dependencies were already up to date. pnpm warned that some dependency build scripts are ignored until approved. |
| `pnpm typecheck` | Pass | Root TypeScript build and app typecheck completed successfully. |
| `pnpm lint` | Pass | This project currently aliases lint to TypeScript checking; it is not a real ESLint pass. |
| `pnpm --filter @workspace/rentrix run typecheck:test` | Pass | Test TypeScript project typechecked successfully. |
| `pnpm --filter @workspace/rentrix run test:financials` | Pass | 23 financial test files and 90 tests passed. |
| `pnpm --filter @workspace/rentrix run test` | Pass with warnings | 84 test files and 402 tests passed. Some tests emitted React `act(...)` warnings and one router-context warning. |
| `pnpm build` | Pass | Vite production build completed and generated PWA assets. |
| `pnpm supabase:migration-evidence` | Local preflight pass; live reconciliation blocked | Local migration chain checks passed with 36 migrations, no duplicate timestamp findings, and no ordering findings. Live reconciliation was blocked because authenticated Supabase management/database access was unavailable. |
| `git status --short` | Pass | The tree was clean before documentation changes. |

## Positive findings

1. **Local code health is strong.** Typecheck, test typecheck, focused financial tests, full tests, and production build all passed.
2. **Financial test coverage exists and is meaningful.** The focused financial suite covers receipts, payments, invoices, financial reports, reconciliation, money math, and migration-contract behavior.
3. **The application has a broad route surface.** Core operational routes exist for dashboard, properties, units, people, tenants, owners, contracts, financials, receipts, expenses, invoices, arrears, bank reconciliation, reports, system, audit log, data integrity, maintenance, settings, and more.
4. **The repository has strong operational documentation.** `docs/CURRENT_STATE.md`, `docs/NEXT.md`, `docs/FEATURE_GAP_REGISTER.md`, `docs/TESTING.md`, and `docs/agent-context/*` provide a realistic picture of what is complete, partially complete, and still blocked.
5. **Migration hygiene has improved.** The local migration evidence script found no duplicate timestamps and no ordering findings in the current migration chain.
6. **Known gaps are explicitly tracked.** The feature gap register is actionable and should be treated as the roadmap to production readiness.

## Blockers to 99.9% readiness

### 1. Browser/E2E release readiness is missing

The repository documents that there is no automated visual regression or E2E suite. FGR-007 tracks this as a high-priority open gap.

Impact:

- Local unit/component tests cannot prove complete user journeys.
- There is no automated proof for auth flows, navigation, financial workflows, mobile behavior, or browser-specific regressions.
- Visual and accessibility regressions can ship undetected.

Recommended actions:

1. Add Playwright or an equivalent E2E framework.
2. Create a seeded staging environment with safe test credentials.
3. Add smoke tests for login/logout, core navigation, property/unit/contract workflows, invoice/payment/receipt/void/report flows, and permission-denied states.
4. Add axe accessibility scans for critical screens.
5. Run E2E in CI before merge.

### 2. Live Supabase reconciliation was blocked in this audit

The local migration evidence script could perform repository-level checks, but live reconciliation was blocked because authenticated Supabase access was unavailable.

Impact:

- This audit cannot prove that production/staging exactly matches the local migration chain.
- Local tests do not prove live RPC definitions, RLS policies, grants, or migration ledger status.
- Any claim of production readiness remains incomplete until live read-only verification is performed.

Recommended actions:

1. Provide approved read-only `SUPABASE_DB_URL` and/or management access in an operator environment.
2. Run migration ledger reconciliation against the intended project.
3. For sensitive flows, inspect live `information_schema`, `pg_constraint`, `pg_indexes`, `pg_policies`, and `pg_get_functiondef`.
4. Make the read-only reconciliation part of release gating for staging at minimum.

### 3. Payment-backed receipt and VOID reporting still require live/browser proof

The code and tests have improved, but the documentation still identifies payment-backed receipt voiding and collection report alignment as needing live and browser verification before production claims.

Impact:

- Financial totals may be locally correct but not proven against the live RPC/migration state.
- VOID handling is a financial accuracy requirement, not a cosmetic behavior.
- Report summaries, detail rows, and receipt history must reconcile under real app flows.

Recommended actions:

1. Apply `20260706101000_align_payment_receipt_reporting_source.sql` first to staging, then production only after approval.
2. Browser-verify invoice -> payment -> receipt -> void -> report totals.
3. Confirm that posted payments appear in receipts and reports.
4. Confirm that voided receipts remain visible as history where applicable but are excluded from financial totals.
5. Add or keep parity tests for the report source-of-truth transition.

### 4. Reports are still partially mixed between RPCs and client/service aggregation

The reports page now has partial owner/tenant statement wiring, but the documentation still identifies mixed RPC/client-side report sources and incomplete full accounting statement lifecycle.

Impact:

- Different reports may use different accounting bases or data sources.
- Swapping a client-calculated report to an RPC without parity tests could create production financial drift.
- Owner and tenant statement screens need lifecycle, export, and live E2E verification before they can be called accounting-complete.

Recommended actions:

1. Document each report basis explicitly: collected, invoiced, paid, accrual, or another named basis.
2. Add parity tests before moving any report from client/service aggregation to RPC.
3. Wire one validated report RPC at a time.
4. Add lifecycle and export tests for owner/tenant statements.

### 5. Contract lifecycle atomicity is not fully proven

FGR-004 remains open for contract update/termination lifecycle risks.

Impact:

- Contract state drives invoicing, occupancy, tenant balances, and reporting.
- Direct updates/deletes can bypass backend invariants if not controlled by atomic RPCs or equivalent constraints.
- Lifecycle bugs can create financial or occupancy inconsistencies.

Recommended actions:

1. Audit all contract update and termination paths.
2. Add `update_contract_atomic` and/or `terminate_contract_atomic` if direct writes can bypass invariants.
3. Add regression tests for renewal, termination, invoice linkage, unit occupancy, and owner-agreement coverage.
4. Verify live RPC definitions before production rollout.

### 6. Operation-level financial permissions need hardening

The application has route guards and some permission-gated routes, but FGR-014 remains open for operation-level financial permissions.

Impact:

- Viewing a financial page and performing a sensitive financial action are different permissions.
- Frontend route guards do not replace backend RLS or RPC grants.
- Payment creation, receipt voiding, settlement approval/payment, and report exports need explicit authorization boundaries.

Recommended actions:

1. Define a financial action permission matrix.
2. Enforce permissions in UI affordances, route guards where relevant, and backend RPC/RLS/grants.
3. Add tests for allowed and denied actions by role.
4. Add E2E coverage for forbidden states.

### 7. Product/accounting decisions are recorded but not implemented

The former product/accounting policy blockers are now recorded as source-of-truth decisions, but they still require implementation and evidence:

- Office fee calculation basis and lifecycle.
- Master lease fixed owner obligation schedule.
- Daily and open-ended contract rules.
- Utility bill posting rules.
- Maintenance cost responsibility and posting path.
- Tenant deposit ledger.
- Cash vs accrual/deferred revenue policy.
- Multi-currency expectations.

Impact:

- The policy choices no longer require guessing, but code can still be incomplete until schema/RPC/service/UI/report/export work implements them.
- Financial reports cannot be 99.9% reliable until the decided cash, accrual, deferred, settlement, tax, void, and reversal rules are proven in tests and live/staging evidence.
- Property-management readiness cannot be complete while the decided workflows remain unmodeled or not browser/live verified.

Recommended actions:

1. Treat `docs/decisions/0001-product-accounting-policies.md`, `docs/decisions/0002-staging-live-verification-and-release-evidence.md`, and `docs/decisions/0003-financial-security-ux-reporting-and-reconciliation-scope.md` as source-of-truth inputs.
2. Convert each decision into schema/RPC/service/UI/test work.
3. Keep each workflow behind explicit tests, browser verification, backend authorization proof, and release evidence.

## UX, mobile, RTL, accessibility, and design-system findings

The active UX audit already highlights several important risks:

1. The financial hub and financial child routes need product confirmation as either a hub, tab family, or navigation group.
2. The mobile bottom navigation includes both `/financials` and `/arrears`, which may be intentional but needs product confirmation.
3. The search icon currently opens quick actions, which can confuse users because the icon implies global search.
4. Mobile keyboard behavior, modal closing behavior, scroll locking, and real-device safe-area behavior are not fully proven from code alone.
5. Contrast risks remain for some sidebar, muted, status, and dark-mode color combinations.
6. Some tab/filter semantics should be reviewed for accessibility consistency.

Recommended actions:

1. Run browser QA at 375px, 768px, and 1440px viewports.
2. Add automated axe checks to critical pages.
3. Perform manual RTL and Arabic layout validation on real devices.
4. Decide and document global rules for route tabs, local tabs, and filter segmented controls.
5. Align mobile financial navigation with the product information architecture.

## Security readiness recommendations

1. Treat frontend route guards and Supabase RLS/RPC grants as separate layers.
2. Verify live RLS policy `qual` and `with_check` expressions for sensitive tables.
3. Verify live RPC definitions and grants for financial actions.
4. Add operation-level tests for payment, void, settlement, export, and reconciliation actions.
5. Confirm that internal diagnostic copy cannot leak to unintended customer-facing contexts.

## Database and migration readiness recommendations

1. Do not treat local migration files as proof of live production state.
2. Run live read-only checks before any production readiness claim involving schema, RPCs, or RLS.
3. Keep migration filenames in the documented timestamped convention.
4. Keep schema changes and data backfills separate.
5. Add rollback/forward-fix notes for high-risk financial and auth migrations.
6. Avoid changing RPC signatures casually because overloads have historically been a production risk.

## Prioritized roadmap to 99.9%

### Phase 1: Release gate foundation

Status in this branch: **foundation implemented, not full release readiness**.

- Added Playwright browser smoke coverage through `pnpm e2e`.
- Added Chromium desktop/tablet/mobile projects for 1440px, 768px, and 375px-class checks.
- Added login/protected-route smoke tests, screenshot artifacts, and an axe scan on the login surface.
- Added a pull-request browser readiness workflow that installs Chromium, runs `pnpm e2e`, and uploads Playwright artifacts.
- Added an opt-in seeded staging workflow path for authenticated smoke tests when `E2E_BASE_URL`, `E2E_TEST_EMAIL`, and `E2E_TEST_PASSWORD` are configured.

Remaining Phase 1 work before a 99.9% claim: expand seeded staging data, add full financial and operational user journeys, define screenshot baselines if visual regression is required, and add manual real-device RTL validation.

### Phase 2: Live Supabase confidence

Status in this branch: **read-only verification gate implemented, live verification still depends on approved credentials**.

- Added `pnpm supabase:live-readiness`, backed by `scripts/verify-supabase-live-readiness.sh`.
- The script requires `SUPABASE_DB_URL` and `psql`, opens a `BEGIN READ ONLY` transaction, checks migration count, required tables, required RPCs, RLS tables without policies, and payment/receipt RPC overload signatures, then rolls back.
- Added a manual `Supabase Live Readiness / Read-only` workflow that runs the check with `SUPABASE_READONLY_DB_URL`.

Remaining Phase 2 work before a 99.9% claim: provide approved read-only credentials, run the workflow against the intended staging/production project, archive the output, and investigate any missing table/RPC/RLS findings.

### Phase 3: Financial correctness closure

Status in this branch: **local financial gates implemented; live/browser proof still required before closure**.

- Added a financial readiness gate test that verifies the payment-backed `rpt_daily_collection` migration reads from `payments`, excludes deleted/VOID rows, and preserves the receipt void RPC boundary.
- Added a report-total parity test that filters deleted/VOID payments before summarizing daily collections and asserts grand totals, payment counts, payment-method totals, and daily row totals reconcile.
- Remaining before a 99.9% claim: apply the migration with approved change control, run seeded browser invoice -> payment -> receipt -> void -> report totals, and complete owner/tenant statement lifecycle/export proof.

### Phase 4: Security and permissions

Status in this branch: **operation-level frontend permission matrix and negative unit checks implemented; backend/live authorization proof still required before closure**.

- Added explicit financial operation permissions for invoice generation/export, payment creation, receipt voiding, report export, bank reconciliation matching, and owner-settlement approve/pay decisions.
- Enforced those permissions in the financial UI for invoice actions, quick payments, receipt voiding, report CSV exports, and bank reconciliation write actions.
- Added positive/negative authorization tests proving admin coverage, manager operational finance access, manager denial for owner-settlement approvals/payments, and user denial for all financial operations.
- Remaining before a 99.9% claim: align backend RPC grants/RLS with the matrix, run seeded E2E denied-action coverage, and archive live authorization evidence.

### Phase 5: Product/accounting decisions

Status in this branch: **product/accounting policies recorded; implementation and release evidence still required before closure**.

- Added `docs/PRODUCT_ACCOUNTING_DECISION_GATES.md` and decision records under `docs/decisions/` to convert office fees, master leases, daily/open-ended contracts, utility posting, maintenance allocation, tenant deposits, deferred-revenue/accounting basis, staging evidence, security, UX, reporting, and bank-reconciliation scope into explicit implementation gates.
- Updated financial readiness tests so the gates remain documented and the linked feature-gap blockers cannot be treated as closed without implementation evidence.
- Remaining before a 99.9% claim: engineering must convert the decided policies into migrations/RPCs/services/UI/report/export tests with backend authorization, live Supabase, browser/staging, and release-ledger evidence.

### Phase 6: UX/a11y/mobile hardening

Status in this branch: **browser hardening expanded for login keyboard and mobile overflow; broader authenticated UX/mobile validation still required**.

- Expanded Playwright browser smoke to verify keyboard focus order through the unauthenticated login form.
- Added a mobile viewport overflow guard for the login surface across the configured Chromium mobile/tablet/desktop projects.
- Existing axe and screenshot smoke remain in place for unauthenticated login.
- Remaining before a 99.9% claim: authenticated route/device validation, financial navigation IA decisions, broader keyboard/focus/contrast coverage, and standardized tabs/filters/cards/forms/error states across high-traffic workflows.

### Phase 7: Release evidence ledger

Status in this branch: **evidence ledger implemented; release evidence must still be produced per release commit**.

- Added `docs/RELEASE_EVIDENCE_LEDGER.md` to define mandatory evidence states for CI, browser, live Supabase, seeded staging, backend authorization, financial proof, product decisions, and manual RTL/mobile validation.
- Added a release evidence gate test so future readiness claims cannot silently omit mandatory evidence items.
- Remaining before a 99.9% claim: populate the ledger with actual CI/operator/product artifacts for the exact release commit.

### Phase 8: Seeded staging and live verification runbooks

Status in this branch: **runbook implemented; execution still depends on staging seeds and approved credentials**.

- Added `docs/SEEDED_STAGING_READINESS_RUNBOOK.md` with required environment variables, seed data requirements, ordered staging verification, and release stop conditions.
- The runbook keeps mutating financial journeys staging-only and requires archived ids/screenshots/reset notes for invoice -> payment -> receipt -> void receipt/payment -> report proof -> statement proof -> audit proof.
- Remaining before a 99.9% claim: provision safe seed data, configure `E2E_*` and `SUPABASE_DB_URL`, run the checks, and archive the evidence.

## Final verdict

**Verdict: Do not claim 99.9% readiness yet.**

The repository is in a healthy local state and has strong documentation discipline, but 99.9% readiness requires closing release-gate, live-verification, financial-proof, permission-hardening, and product-accounting blockers.

The fastest path to a defensible 99.9% claim is:

1. Add automated E2E/browser QA.
2. Enable read-only live Supabase verification.
3. Close financial receipt/report verification gaps.
4. Harden operation-level financial permissions.
5. Implement the recorded product/accounting decisions with tests and evidence.
6. Archive release evidence for the exact release commit.
7. Execute seeded staging and live read-only verification runbooks.
