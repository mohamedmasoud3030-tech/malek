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

Status: **complete and merged in PR #1137**.

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

Status: **complete and merged through PRs #1139, #1140, and #1141**.

Completed order:

1. `settings/settings-page.tsx` — decomposed in PR #1139.
2. `owners/OwnersPage.tsx` — decomposed in PR #1140.
3. `maintenance/maintenance-page.tsx` — decomposed in PR #1141.

Implementation evidence:

- `settings-page.tsx` was split into section/form components and a controller hook
  while preserving compatibility exports;
- `OwnersPage.tsx` was reduced to orchestration with owner identity, relationship,
  table, and controller modules;
- `maintenance-page.tsx` was reduced to orchestration with list, request form,
  detail/resolve overlays, and controller modules;
- the final Phase B branches reported typecheck, test typecheck, architecture check,
  full tests, and production build passing before merge;
- no permission, database, RPC, RLS, or financial behavior changes were introduced.

Exit conditions were met: all three target pages are below the documented limit and
their route/public exports remain compatible.

## Phase C — financial report boundary

Status: **complete and merged in PR #1142**.

Implementation evidence:

- `financialReportsService.ts` became a thin compatibility facade;
- operational collection and arrears aggregation moved into focused services;
- shared report rows, normalization, filters, and loading context moved into a
  dedicated shared module;
- accounting, statement, cash-flow/VAT, occupancy/rent-roll boundaries established
  by the preceding financial architecture work remain behind the same public facade;
- RPC names, filters, exported types, VOID/deleted-payment rules, and consumers were
  preserved;
- the 140-test financial suite, typecheck, and production build were reported green
  on the merged PR head.

Documented exception: the large facade parity test remains intact for broad public-
API regression coverage. It may be split later for navigation, but coverage must not
be reduced and its size alone is not an architecture violation.

## Phase D — shared page and form convergence

Status: **verified in PR #1143; ready to merge**.

Implemented scope:

- `EntityForm.Field` owns shared description and accessible field-error semantics;
- `EntityForm.Actions` supports normal and destructive submit workflows;
- contract modal and route page share one `ContractFormFields` implementation;
- person modal and route page share one `PersonFormFields` implementation;
- property, unit, owner, contract-renewal, and contract-termination forms converged
  on the shared form primitives;
- root/server errors use `EntityForm.ErrorSummary` in migrated workflows;
- equivalent four-card KPI groups were verified on `ResponsiveCardGrid`;
- table/mobile-card inventory confirmed existing shared paths where behavior matches;
- route-backed person/property/contract pages and confirmation-only financial dialogs
  remain documented exceptions rather than forced abstractions;
- CI now enforces `check:architecture` as part of the standard pull-request gate.

Verification evidence on implementation head
`9768bd98947b807a2df43b321aa5a6ceded4c4bc`:

- governance, migration evidence, typecheck, lint, architecture check, build, test
  typecheck, full tests, and financial tests passed;
- Browser Readiness / Playwright E2E smoke passed;
- Vercel preview reached Ready;
- Codacy reported 0 new issues and complexity reduced by 79;
- Sonar Quality Gate passed with 0 new issues, 0 security hotspots, and 2.1%
  duplication on new code.

Detailed evidence and exceptions live in `docs/PHASE_D_SHARED_UI_EXECUTION.md`.

Automation must not start Phase E until PR #1143 is merged. After merge, start from
updated `main`, confirm the merge commit and re-read this plan before moving files.

## Phase E — documentation consolidation

Status: **blocked until verified PR #1143 is merged**.

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
