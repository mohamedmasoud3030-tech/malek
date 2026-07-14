# Phase D — Shared page and form convergence

Status: **verified — ready to merge in PR #1143**

Started from `main` after merge of PR #1142 (`63fc6ebb8d36d18bbfc4375ccf799c18175b7a7b`).

## Objective

Converge only genuinely equivalent page, form, table, KPI, loading, empty, and error behaviors onto existing shared primitives while preserving all business rules, permissions, routes, RPC names, Supabase contracts, and financial calculations.

## Confirmed entry state

- Phase B operational page decomposition is merged through PRs #1139, #1140, and #1141.
- Phase C financial report boundary split is merged in PR #1142.
- `EntityForm.Field`, `EntityForm.ErrorSummary`, `EntityForm.Actions`, `EntityForm.Overlay`, and `ResponsiveCardGrid` already existed as the preferred primitives.
- The code still contained repeated field wrappers, local validation-message helpers, raw route-backed form shells, and contract lifecycle dialogs that did not share the responsive form surface.

## Implemented convergence

### D1 — Form shell convergence

Implemented as one coherent form-system wave:

- extended `EntityForm.Field` with shared `description` and accessible `error` rendering;
- extended `EntityForm.Actions` with an optional destructive submit variant;
- added coverage for the shared field description/error contract;
- extracted `features/contracts/components/ContractFormFields.tsx` so the contract modal and route-backed contract page use one field tree instead of duplicate implementations;
- extracted `features/people/components/PersonFormFields.tsx` so person modal and route-backed page use one field tree;
- migrated contract create/edit modal, contract route form, person modal/page, unit modal, property create/edit modal, property route form, and owner identity form;
- removed local one-line field-error renderers from those migrated workflows;
- preserved schemas, field names, values, placeholders, autofocus, query dependencies, mutation payloads, agreement coverage, unit-conflict validation, and submit-disable rules.

The first implementation attempt duplicated the contract field tree between the modal and route page and caused Sonar duplication to reach 46.6%. That approach was removed. The final implementation owns contract and person field trees in shared components and keeps only surface-specific orchestration in modal and route-backed variants.

### D2 — Error, loading, and empty-state convergence

- field errors now use one shared semantic renderer with `role="alert"`;
- root/server errors use `EntityForm.ErrorSummary` in the migrated workflows;
- existing route loading states remain `RouteLoadingState`;
- route-specific retry cards remain local because they include domain-specific retry/navigation actions rather than only repeated styling;
- no loading state was changed to suppress a query or mutation error.

### D3 — KPI and summary convergence

Inventory confirmed that equivalent four-card KPI groups already use `ResponsiveCardGrid`, including the financial expenses summary. The four-column control in `financials-page.tsx` is a tab selector, not a KPI group, and remains local.

No metric calculation, report source, query ownership, currency formatting, or financial aggregation changed in this phase.

### D4 — Table and mobile-card inventory

Inventory confirmed:

- financial expenses use `DataTable` with a dedicated `MobileCard` renderer;
- equivalent list pages already preserve desktop/mobile action parity through their existing shared table/card path;
- filter controls remain domain-owned because their selection, reset, and query semantics differ;
- financial tables and reconciliation surfaces remain local where sorting, matching, selection, or atomic-operation behavior is domain-specific.

No forced table abstraction was added.

### D5 — Overlay and accessibility convergence

- converted contract renewal to `EntityForm.Overlay`, preserving agreement-coverage validation and renewal RPC behavior;
- converted contract termination to `EntityForm.Overlay` with shared destructive actions, preserving the required reason and termination mutation;
- retained `ConfirmDialog` for confirmation-only destructive workflows;
- retained the invoice-generation dialog as a documented non-form exception because it is a permission-gated financial batch confirmation with warning content, not a create/edit workflow;
- retained `ContractFormPage`, `PersonFormPage`, and `PropertyFormPage` as documented route-backed exceptions because their routes already exist and include page navigation, retry, and dirty-navigation behavior.

The shared overlay continues to provide mobile bottom-sheet and desktop dialog surfaces, bounded scrolling, sticky mobile actions, safe-area padding, and RTL-compatible layout.

## Guardrails respected

- No migrations, schema changes, RLS changes, RPC changes, auth changes, or production Supabase/Vercel changes.
- No feature additions.
- No business-rule, accounting, report-source, or financial calculation rewrites.
- No file under `features/financials/` was modified.
- Shared components represent repeated form behavior, not only repeated styling.

## Verification evidence

Verified on implementation head `9768bd98947b807a2df43b321aa5a6ceded4c4bc`:

- branch relation to `main`: **ahead, behind by 0**;
- governance guard: **success**;
- Supabase migration evidence: **success**;
- `pnpm typecheck`: **success**;
- `pnpm lint`: **success**;
- `pnpm --filter ./rentrix-app run check:architecture`: **success**;
- `pnpm build`: **success**;
- `pnpm --filter ./rentrix-app run typecheck:test`: **success**;
- `pnpm --filter ./rentrix-app test`: **success**;
- financial test suite: **success**;
- Browser Readiness / Playwright E2E smoke: **success**;
- Vercel preview/build: **Ready**;
- Codacy: **0 new issues**, complexity reduced by **79**;
- Sonar Quality Gate: **passed**, **0 new issues**, **0 security hotspots**, duplication on new code reduced to **2.1%** from the earlier 46.6% failure.

The CI workflow now runs `check:architecture` explicitly, closing the gap between the documented verification matrix and the enforced GitHub gate.

## Exit decision

Phase D exit conditions are met on the verified implementation head. PR #1143 is ready to merge. Phase E remains blocked until PR #1143 is merged into `main`, after which automation should start from the updated `main` branch and re-read this plan before consolidating documentation.
