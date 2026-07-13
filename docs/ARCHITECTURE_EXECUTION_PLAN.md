# Architecture execution plan

This is the canonical architecture queue for humans and recurring Codex automation.
It turns the broad audit into bounded phases with explicit entry and exit conditions.
`docs/NEXT.md` remains the product/data backlog; this file owns code-tree, shared-UI,
and maintainability work.

## Operating rule for automation

1. Start with the first phase whose status is `ready` or `in progress`.
2. Re-read the current code and the latest open PR before trusting this document.
3. Keep one coherent phase per PR. Do not mix financial behavior, database changes,
   and visual refactors unless the phase explicitly requires all three.
4. Update the phase evidence and PR description in the same change.
5. A phase is complete only when its exit conditions and required checks pass on
   the latest head SHA.
6. If code reality disagrees with this plan, code wins; correct this plan before
   continuing.

## Why the application lives in `rentrix-app/`

The repository is a pnpm workspace, not a single-folder Vite checkout:

- the root owns workspace scripts, shared TypeScript configuration, governance,
  CI, Supabase migrations, operational scripts, and documentation;
- `rentrix-app/` is the deployable React/Vite package;
- `pnpm-workspace.yaml` currently contains one package, but the package boundary
  keeps deployment and future tooling packages separate from governance/database
  assets.

Flattening `rentrix-app/` into the repository root would create a large path and
deployment migration without improving feature boundaries. The correct target is
to simplify `rentrix-app/src`, not remove the workspace boundary.

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
- New pages over 650 lines fail the architecture check; existing large pages are
  reduced through the phases below.

## Current measured hotspots

Measured on the PR that introduced this plan:

| Area | Evidence | Decision |
| --- | ---: | --- |
| Financial reports facade | `financialReportsService.ts` 944 lines; test 922 lines | split by report domain while preserving public facade |
| Settings page | 644 lines | split orchestration from sections/forms |
| Bank reconciliation page | 567 lines | split import, matching, result, and form surfaces; financial phase only |
| Maintenance page | 528 lines | split list, create/edit, and resolution workflow |
| Owners page | 498 lines | split owner directory, relationship workspace, and overlay forms |
| Shared form fields | local `Field` shells existed across multiple features | migrate to `EntityForm.Field`/`FormField` |
| Documentation | many historical root reports plus active docs | index/archive only after link audit |

Generated `types/database.ts` is large by nature and is not a refactor target.
Large tests may be split for navigation, but behavior coverage must not be reduced.

## Phase A — app/feature boundary

Status: **in progress on PR #1136**.

Scope:

- move Dashboard page, components, snapshot, service, helpers, and tests into
  `features/dashboard/`;
- move Login page and its test into `features/auth/`;
- keep routes as thin exports;
- add an architecture guard reserving `app/` for composition infrastructure;
- introduce and adopt the shared `EntityForm.Field` shell in low-risk CRUD forms.

Exit conditions:

- no Dashboard or Login business implementation remains under `app/`;
- `app/` contains only router/providers/layout/navigation and the app-level
  not-found boundary;
- architecture check, typecheck, full tests, build, and browser smoke pass.

## Phase B — large operational page decomposition

Status: **ready after Phase A**.

Order:

1. `settings/settings-page.tsx`
2. `owners/OwnersPage.tsx`
3. `maintenance/maintenance-page.tsx`

For each page:

- keep the page as orchestration and query/mutation composition;
- move presentation sections into `components/`;
- move pure transformations into named helper modules;
- keep one public compatibility export when routes/tests already depend on it;
- migrate repeated form shells to `EntityForm` primitives;
- add interaction coverage for open/close, loading, empty, error, submit, and
  destructive confirmation states.

Exit conditions: each page is below 350 lines unless a documented exception is
added, no behavior or permission changes are introduced, and full UI checks pass.

## Phase C — financial report boundary

Status: **ready after Phase B; financial-risk phase**.

Scope:

- convert `financialReportsService.ts` into a compatibility facade;
- split operational collection/arrears aggregation, statement RPCs, accounting
  reports, occupancy/rent roll, and shared normalization into separate modules;
- split the 922-line test by the same domains;
- preserve current RPC names, filters, VOID/deleted payment rules, and exported
  types exactly unless a separate parity-tested behavior change is approved.

Required checks include the complete financial suite. Do not combine this phase
with database migrations or report-source swaps.

## Phase D — shared page and form convergence

Status: **ready after Phase C**.

Scope:

- finish replacing local `Field`, error-summary, filter-card, and summary-card
  shells with shared primitives;
- inventory `EntityTable`, raw tables, and mobile cards; converge only equivalent
  behaviors;
- make all create/edit workflows use an explicit overlay or a documented
  route-backed exception;
- verify RTL labels, focus return, keyboard navigation, dialog/sheet scrolling,
  loading, empty, and error states.

Exit conditions: no duplicate one-line `Field` components remain, four-card KPI
groups use `ResponsiveCardGrid`, and browser E2E passes on desktop/tablet/mobile.

## Phase E — documentation consolidation

Status: **ready after code phases stabilize**.

Scope:

- classify root reports as active, superseded, or historical;
- move historical reports under `docs/archive/` only after checking every link;
- keep `AGENTS.md`, `docs/agent-context/CONTEXT_MAP.md`, `docs/NEXT.md`, this plan,
  and domain/governance/testing references as the active entry points;
- add a documentation index and eliminate contradictory status claims.

Exit conditions: no broken internal links, root contains only true repository entry
documents, and automation can find current state and next work without reading
historical reports.

## Required verification matrix

For every architecture phase:

```bash
pnpm typecheck
pnpm lint
pnpm --filter ./rentrix-app run typecheck:test
pnpm --filter ./rentrix-app run check:architecture
pnpm --filter ./rentrix-app test
pnpm build
```

Also run `pnpm --filter ./rentrix-app run test:financials` for any file under
`features/financials/`, and Browser Readiness/E2E for user-facing changes.
