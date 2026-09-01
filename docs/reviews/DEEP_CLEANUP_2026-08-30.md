# MALEK Deep Cleanup — 2026-08-30

> **Purpose:** dead-code and repository-hygiene pass over `rentrix-app` with every removal validated by typecheck, architecture guard, docs check, production build, and the full Vitest suite.
> **Baseline:** `main@84de6a7cd37d6b672b3f5e9defd3bf73c111ed60` (merged into this branch with no file overlap; the cleanup itself was authored against `main@936b0572d973d66f2a0671359c83d1e77677f7a5`, before PRs #1692/#1693 landed).
> **Change boundary for this PR:** no behavior, business/accounting rule, database, RLS, RPC, or migration change. No architectural restructuring. Parallel work preserved (no open PRs existed when the cleanup started; #1692/#1693 merged cleanly afterward).
> **Authority boundary:** this is a cleanup record only — **not** a source of truth. Product, accounting, security, UX, and stage-credit truth remain exclusively in the Canonical Pack (`docs/source-of-truth/`) and the governed ledgers under `governance/`. Where anything here appears to conflict with the Canonical Pack, the Canonical Pack wins and this document must be corrected.

## Method

A whole-repository import graph was built over all 1,226 TS/TSX source files (entry `src/index.tsx` through `route-tree.ts` lazy imports), distinguishing:

1. **production-reachable** modules (shipped),
2. **test/spec-referenced only** modules (governed stage evidence or parked surfaces),
3. **fully dead** modules (referenced by nothing: no import, no config, no script, no doc, no vitest/spec convention, no ambient `.d.ts`).

Every deletion candidate was cross-checked against `scripts/`, `rentrix-app/scripts/`, `e2e/`, configs, `.claude/`, `docs/`, and `governance/` before removal, then re-checked to a fixpoint (removals were re-analyzed for newly orphaned dependents). Removals were then validated by `pnpm typecheck`, `check:architecture`, `check:docs`, `pnpm build`, and `pnpm test`.

## What was removed (validated)

### Superseded components (10 files)

| File | Evidence of supersession |
|---|---|
| `features/auth/command-center-panel.tsx` | Login split panel deliberately retired: `login-page.test.tsx` asserts its absence in rendered HTML; `responsive-smoke-login.cjs` asserts `splitPanelGone: hasSplit === 0`; `brand-contract.test.ts` entry updated (retired surface removed from brand-surface list). |
| `features/financials/components/receipts-section.tsx` | Superseded by route-native `receipts/receipts-page.tsx` (route `/receipts` redirects there). The stale entry in `active-register-inventory.ts` proved the inventory was already updated to the live page. |
| `features/automation/automation-page.tsx` | Superseded by `components/automation-workspace.tsx` / `automation-center-view.tsx` (both production-reachable). Contract test updated to guard the live surfaces. |
| `features/operations-hub/components/OperationsHub.tsx` | Superseded by `operations-hub-workspace.tsx` (production-reachable via the operations route). |
| `features/command-palette/command-palette-trigger.tsx` | Trigger surface retired; palette opens via the mobile dock search (`layout-navigation-view.tsx` → `useCommandPaletteStore`) and the shell dialog. Cross-device contract's stale "header search" assertion removed. |
| `components/layout/workspace-hint.tsx` | Unused wrapper; no reference anywhere. |
| `features/contracts/components/ContractPreviewDialog.tsx` *(initially deleted, then restored)* | Restored: `p6-detail-dossiers.test.ts` asserts all seven priority-entity preview dialogs share the `EntityPreviewDialog` foundation. Contract-governed despite being unlinked. |
| `features/properties/components/PropertyPreviewDialog.tsx` *(initially deleted, then restored)* | Restored: `p6b-owner-property-dossier-completion.test.ts` dossier contract. |
| `features/contracts/useContractDocuments.ts` | Dead hook; service layer retained with its tests. |
| `services/action-center-counts.ts` | Superseded by the R1 dashboard read model (its own docblock said so); the only consumer left was a stale inert `vi.mock` removed from `dashboard-page.test.tsx`. |

### Superseded compatibility shims (5 files kept deleted; 2 restored)

Kept deleted, consumers repointed to canonical modules:

- `features/contracts/ContractDetailPage.tsx` → canonical `pages/ContractDetailPage.tsx` (2 test imports updated).
- `features/financials/reports/operational-collection-service.ts` → canonical `financial-reporting.ts` (1 production import updated).
- `features/governance-hub/governance-hub-page.tsx` → canonical `components/GovernanceHubWorkspace.tsx` (settings route + test updated).
- `features/communication/services/whatsapp-share-service.ts` → canonical `@/lib/whatsapp-share` (1 production import updated).
- `features/settings/components/settings-appearance-section.tsx` → canonical `sections/SystemSection.tsx` (e2e fixture updated).

Restored after the suite flagged a deliberate contract:

- `features/reports/components/ReportsWorkspace.tsx` and `features/reports/components/ReportDirectory.tsx` — `reports-workspace-structure.test.ts` ("WP-C C.1") requires these historical import-path compatibility seams to exist for the planned refactor.

### Hygiene findings (already clean)

- **No unused npm dependencies.** Every flagged package is used via imports, e2e specs, `@vitest-environment` docblocks, tsconfig `types`, or peer requirements.
- **Zero `console.log` / `debugger` / TODO / FIXME** in non-test source. Remaining `console.*` calls are `warn`/`error` only.
- `src/lib/moneyNormalization.spec.ts` runs under Vitest's default `.spec` include — not dead.
- `src/vite-env.d.ts` is ambient TypeScript — not dead.

## Pre-existing defects found on `main` (and repaired test-side only)

`pnpm test` on **pristine `main@936b057`** fails 28 tests across 7 files (each verified by isolated runs on an unmodified checkout; those files were untouched by #1692/#1693, and a diagnostic full-suite run at the merged base — `84de6a7` + this branch's drift repairs — confirmed exactly the two contract conflicts of items 3–4 remained before today's fixes). This cleanup repairs 26 of them test-side only and resolves the remaining two by explicit technical decision:

1. **Stale zustand test mocks (25 tests / 4 layout test files).** `app-shell.tsx` reads the ui store through selectors — `useUiStore((s) => s.setSyncStatus)` — but `app-shell-header` (10), `mobile-drawer-focus-restoration` (4), `mobile-shell-navigation-polish` (8), and `account-permission-status-polish` (3) mocked `useUiStore` as a no-arg state-returning function, so `setSyncStatus` resolved to a non-function (or was missing). The four mocks now apply the selector when one is passed. (A stale `vi.mock` of the deleted command-palette trigger was removed from the drawer test.)
2. **Over-bounded PWA safety slice (1).** `pwa-safety-contract.test.ts` sliced `vite.config.ts` from `runtimeCaching:` to end-of-file, so the later `manualChunks` vendor split (which legitimately names `@supabase`) tripped the "no Supabase in runtime cache rules" regex. The slice is now bounded to the `runtimeCaching` array; the actual runtime rules were already Supabase-free.

**Two further deterministic red tests at the merged base (84de6a7 + this branch) — resolved in this PR with explicit technical decisions:**

3. `features/landing/landing-performance-contract.test.ts` forbade any `manualChunks` in `vite.config.ts`, while PR #1691's reviewed bundle strategy added a **vendor-only** `manualChunks` split (Supabase / charts / PDF / motion / date-fns) for long-lived browser caching. Resolution (consistent with the shipped strategy, removing no performance work): the contract now asserts the split is *structurally vendor-only* — the `node_modules` early-return guard must exist and precede every chunk assignment, and every manually assigned chunk name must be `vendor-*`. Application code is still never forced into a named chunk, and dynamically imported vendors stay lazy, which is what the landing contract was protecting.
4. `components/ui/design-system-exports.test.ts` required every barrel primitive to be `typeof 'function'`, but `DataTable` is the legitimate `memo(EntityTableImpl)` alias (a React component object, as `forwardRef` wrappers also are). Resolution: the contract now validates *React component-ness* — a function, or an object whose `$$typeof` is `Symbol.for('react.memo')` / `Symbol.for('react.forward_ref')` — instead of the shape of one authoring style.

**Load-sensitivity root cause fixed (not tolerated):**

5. `mobile-drawer-focus-restoration.test.ts` (4 tests) passed deterministically in isolation and in most full-suite runs, but failed all four tests in one full-suite execution. Its assertions are fully synchronous `act()` renders of the whole `AppShell` tree; on this 2-core pool, running beside the CPU-heavy PGlite journey suites, the render could exceed Vitest's default 5 s wall-clock budget — the only failure mode available to a synchronous test under contention. Fix: a file-scoped `vi.setConfig({ testTimeout: 30_000 })` with the rationale documented in the file, removing the load-dependent cliff so the file behaves identically isolated and in the full suite. Stability evidenced by consecutive full-suite runs recorded under "Validation evidence".

After this cleanup branch, the full suite is green (see validation evidence for the exact, actually-observed counts).


No production code was changed for either item.

## Deliberately kept (parked / governed — owner decisions, not cleanup)

| Cluster | Files | Why kept |
|---|---|---|
| Marketing landing | 11 components in `features/landing/components/` + `public/landing/` (≈20 MB assets) | `routes/landing.tsx` documents intent: "intentionally disconnected … until its performance is fixed." Planned reconnection. |
| Owner portal (frontend) | `features/owner-portal/*` (5), `routes/owner-portal.tsx`, `owners/owner-portal-admin-service.ts`, `owners/components/OwnerPortalLinkAction.tsx`, `owners/components/owner-financial-authority-section.tsx`, `owners/useOwnerFinancialAuthority.ts` | P4 parked feature: DB side is live (`20260901000044/45` portal projection migrations); `owner-portal-boundary.test.ts` still passes. Deleting the frontend would strand live DB work. |
| Governance-hub route wrappers | `routes/_protected.audit-log/change-password/data-integrity/system.tsx` | Unregistered as standalone routes (surfaces composed under `/settings` via governance-hub) but referenced by `governance-hub.test.tsx` and phase-6 audit evidence. |
| Test-only-referenced modules | e.g. `ContractDetailPage` (pages, live), `contractDocumentsService`, `maintenance-page`, `finance-cockpit-state`, `command-registry`, `use-command-search`, `domain/validators`, `company-selector`, `p0/p1` replay stubs | These are covered-by-test evidence for governed phases; removal would delete stage evidence. Listed for the owner to retire stage-by-stage. |
| Root status/audit docs | `PROJECT_STATUS.md`, `IMPROVEMENT_PLAN.md`, `GOVERNANCE_STABILIZATION_PLAN.md`, `PERFORMANCE_*.md`, `PWA_REVIEW.md`, `UX_REVIEW.md` | Owner decision resolved 2026-09-01: these point-in-time ledgers were retired to remove conflicting active guidance; git history remains the archive and the Canonical Pack plus the active reconstruction blueprint hold current authority. |
| `public/build-proof.json` | tracked, regenerated per build | Release-evidence artifact written by `scripts/write-build-proof.mjs`; will churn diffs (`sha: local`) on local builds — noted, not changed. |

## Remaining refactor plan — prioritized phases

Sequencing note: phases 0–2 are low-risk and unblock the rest; phases 3–6 map to `rentrix-app/DEEP_REFACTOR_PLAN.md` (draft, status "For Review") and must not begin until the owner approves that plan, per its own governance note.

**Phase 0 — Baseline hygiene (this PR).** Dead code removed, shims flattened, test suite returned to green, contracts re-pointed at live surfaces. Acceptance: typecheck, `check:architecture`, `check:docs`, build, and full Vitest suite all pass on this branch.

**Phase 1 — Test-suite truth restoration (small, mechanical).** Done in Phase 0: the 26 drift-broken tests (zustand selector mocks, PWA slice bound), both deterministic contract conflicts (items 3–4 above), and the load-sensitive drawer suite (item 5) are resolved; keep the suite green in CI so drift like the selector-mock change cannot land silently again.

**Phase 2 — Owner decisions on parked clusters (decision PRs, no code).** For each parked cluster above: reconnect (landing after perf work; owner-portal frontend against its live projections) or retire it together with its tests and evidence ledger entries. Retiring the owner-portal frontend would also orphan `owners/*` portal-side files and the `public/landing` assets. Each decision is one focused PR.

**Phase 3 — WP-A: Accounting domain hardening** (from the draft plan): move accounting statements under `accounting/reports/`, single owner for TB/P&L/BS/GL. Depends on owner approval of the draft plan.

**Phase 4 — WP-B: Finance hub unification**: merge `finance-hub` + `financials` into `finance/`, killing the dual data-fetching patterns around collections/expenses/fees/funds/banking.

**Phase 5 — WP-C + WP-D: Reports presentation shell + Settings platform**: make `reports/` a pure presentation layer over `accounting/reports` and `finance/reports`; split the 8-section settings form into independently loadable sections.

**Phase 6 — WP-E: Cross-cutting consolidation**: shared monetary/permissions/document seams; retire the compatibility seams deliberately preserved in Phase 0 once all consumers are migrated.

## Validation evidence (this branch, at the merged base `84de6a7` + cleanup)

All results below were actually executed and observed on this branch; nothing is inferred from a previous run.

- `pnpm typecheck` — **pass** (workspace `tsc -b` + app `tsc -p tsconfig.json --noEmit`, zero errors).
- `pnpm --filter @workspace/rentrix run check:architecture` — **pass** (`check-architecture.mjs` feature edges + active-register inventory + its node tests: 3 pass / 0 fail).
- `pnpm check:docs` — **pass** (90 maintained Markdown files).
- `pnpm check:business-rules` — **pass** (`v2.0.0 382a0b8c…` unchanged).
- `pnpm check:execution-plan` — **pass** (Stages: 10; Tasks: 98; Decisions: 18, unchanged).
- `pnpm check:expired-flags` — **pass** (8 flags within their cleanup windows as of 2026-08-29).
- `pnpm build` — **pass** (production Vite build + PWA generateSW, 28 precache entries / 451.84 KiB; shipped bundle unchanged by the deletions — the removed modules were never in the production graph).
- `pnpm test` — **pass, twice consecutively**: `475/475` test files, `3147/3147` tests, exit code 0 in both runs (stability evidence for the drawer-suite fix above). For comparison, `main@936b057` fails 28 tests deterministically across 7 files, and the drifted files were untouched by #1692/#1693.
- **Browser/E2E matrix — not run, and why precisely:** the Playwright browser cache (`~/.cache/ms-playwright`) is absent in this environment; `npx playwright install chromium` (1.61.1, Chrome-for-Testing 149.0.7827.55) fails with a download error because egress to `cdn.playwright.dev` is blocked at the TLS layer (verified directly: the HTTPS connection is closed during handshake, via both the installer and curl); no system Chromium/Chrome/Firefox binary exists to route through the config's `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; and the Debian apt repository exposes no `chromium` package. No hosted QA/preview URL was provided for this task either. Component-level browser-environment coverage (happy-dom renders, including the full `AppShell` mount and bottom-sheet focus/scroll-lock semantics) does run inside the Vitest suite above, but no real-browser E2E claim is made.
