# Architecture execution plan

This document records the bounded architecture queue executed from PR #1137 onward. It remains the architecture history and verification contract; it is no longer an open-ended refactor backlog.

## Operating rule

1. Re-read the current code and latest open PR before trusting any document.
2. Keep one coherent architecture concern per PR.
3. Do not mix visual refactors, financial behavior, database changes, and production mutations unless a reviewed phase explicitly requires them together.
4. A phase is complete only when its exit conditions pass on the latest head SHA and the PR is merged.
5. If code or a verified live contract disagrees with documentation, code/live reality wins and the documentation must be corrected in the same change.
6. Phases A through E are complete. Do not invent a Phase F from this document. New work starts from [`NEXT.md`](NEXT.md) or an evidence-backed defect and receives a new bounded plan only when warranted.

## Why the application lives in `rentrix-app/`

The repository is a pnpm workspace, not a single-folder Vite checkout:

- the root owns workspace scripts, shared TypeScript configuration, governance, CI, Supabase migrations, operational scripts, and documentation;
- `rentrix-app/` is the deployable React/Vite package;
- the package boundary separates deployment code from repository governance and database assets.

Flattening `rentrix-app/` into the root would create a large path/deployment migration without improving feature boundaries. The correct target was to simplify `rentrix-app/src`, not remove the workspace boundary.

## Enforced frontend tree

```text
rentrix-app/src/
  app/                 composition only: router, providers, shell, navigation
  features/<domain>/   pages, components, hooks, services, domain-specific types
  components/layout/  shared page/layout composition
  components/ui/      shared interaction and design-system primitives
  domain/              pure cross-feature business rules
  lib/                 neutral runtime/data utilities
  services/            genuinely cross-feature integrations only
  routes/              thin route exports/adapters
  types/               generated database and shared transport/domain types
```

Rules:

- Business pages, services, snapshots, and domain logic must not live in `app/`.
- Route files stay thin and export a feature page or app shell.
- Feature presentation components do not call Supabase directly.
- A shared component must represent repeated behavior, not only repeated styling.
- New pages over 650 lines fail the architecture check.
- Generated `types/database.ts` is large by nature and is not a refactor target.
- Large tests may be split for navigation, but behavior coverage must not be reduced.

## Completed phase ledger

| Phase | Scope | Merged evidence | Status |
| --- | --- | --- | --- |
| A | Reserve `app/` for composition; move Dashboard/Login to owning features; introduce architecture guard and low-risk shared fields | PRs #1137 and #1138 | complete |
| B | Decompose Settings, Owners, and Maintenance operational pages | PRs #1139, #1140, #1141 | complete |
| C | Split the 944-line financial-report facade into domain services while preserving its public API and financial rules | PR #1142 | complete |
| D | Converge shared forms, errors, responsive overlays, KPI/table patterns, and enforce architecture checks in CI | PRs #1143 and #1144 | complete |
| E | Consolidate documentation, archive superseded root reports, add a documentation index, and remove contradictory phase status | `agent/phase-e-documentation-consolidation` | implemented; ready to merge |

## Phase A — app/feature boundary

Dashboard and Login implementation moved to their owning features, routes remained thin, and `app/` became composition-only. The architecture guard prevents business implementation from drifting back into `app/`.

## Phase B — large operational page decomposition

- `settings/settings-page.tsx` was decomposed in PR #1139.
- `owners/OwnersPage.tsx` was decomposed in PR #1140.
- `maintenance/maintenance-page.tsx` was decomposed in PR #1141.

Public exports and behavior were preserved; no permission, database, RPC, RLS, or financial behavior changes were introduced.

## Phase C — financial report boundary

`financialReportsService.ts` became a thin compatibility facade. Operational collection, arrears, shared rows/context, accounting, statements, cash-flow/VAT, and occupancy/rent-roll responsibilities are separated behind the same public API. RPC names, filters, exported types, VOID/deleted-payment rules, and consumers were preserved. The 140-test financial suite remained green on the merged head.

## Phase D — shared page and form convergence

PR #1143 unified accessible field errors, action shells, contract/person fields, property/unit/owner workflows, renewal/termination overlays, page errors, and equivalent KPI/table patterns. PR #1144 closed the final repeated field-shell exception in bank reconciliation and related forms. CI now enforces `check:architecture`.

Detailed implementation evidence remains in [`PHASE_D_SHARED_UI_EXECUTION.md`](PHASE_D_SHARED_UI_EXECUTION.md).

## Phase E — documentation consolidation

Implemented scope:

- added [`README.md`](README.md) as the maintained documentation index;
- retained `AGENTS.md` and `agent-context/CONTEXT_MAP.md` as contributor/agent entry points;
- retained `CURRENT_STATE.md`, `NEXT.md`, architecture, domain, governance, testing, database, and decision records as maintained sources;
- moved 13 completed audits/plans/execution reports plus the superseded root `CONTEXT_MAP.md` into [`archive/legacy-root-reports/`](archive/legacy-root-reports/);
- preserved archived file bodies by reusing their exact Git blobs;
- removed stale claims that Phase D awaited merge or Phase E remained blocked;
- added a repository documentation-link check to CI.

Exit conditions for merge:

- documentation-link check passes;
- repository root contains only true entry/configuration documents rather than historical status reports;
- standard CI remains green;
- the PR description records the moved files and verification evidence.

## Required verification matrix

For architecture or user-facing code changes:

```bash
pnpm typecheck
pnpm lint
pnpm --filter ./rentrix-app run typecheck:test
pnpm --filter ./rentrix-app run check:architecture
pnpm --filter ./rentrix-app test
pnpm build
```

Also run `pnpm --filter ./rentrix-app run test:financials` for files under `features/financials/`, and Browser Readiness/E2E for user-facing changes.

For documentation-only consolidation, run:

```bash
pnpm check:docs
```

The standard CI still runs the full repository matrix before merge.
