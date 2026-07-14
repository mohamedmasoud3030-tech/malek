# Phase D — Shared page and form convergence

Status: **in progress**

Started from `main` after merge of PR #1142 (`63fc6ebb8d36d18bbfc4375ccf799c18175b7a7b`).

## Objective

Converge only genuinely equivalent page, form, table, KPI, loading, empty, and error behaviors onto existing shared primitives while preserving all business rules, permissions, routes, RPC names, Supabase contracts, and financial calculations.

## Confirmed entry state

- Phase B operational page decomposition is merged through PRs #1139, #1140, and #1141.
- Phase C financial report boundary split is merged in PR #1142.
- `EntityForm.Field`, `EntityForm.ErrorSummary`, `EntityForm.Actions`, `EntityForm.Overlay`, and `ResponsiveCardGrid` already exist and are the preferred primitives.
- The current code still contains local field wrappers and repeated `<label className="grid gap-2 text-sm font-bold">` shells.
- A confirmed first target is `rentrix-app/src/features/contracts/contract-form-modal.tsx`, which has a local `fieldError` helper and repeated field-label/error markup despite already importing `EntityForm`.

## Ordered execution

### D1 — Form shell convergence

1. Replace duplicate one-line field wrappers and repeated label/error shells with `EntityForm.Field` or the existing shared `FormField` where semantics match.
2. Start with the contract form modal, then inspect people, properties, owners, settings, lands, commissions, leads, and communication forms.
3. Preserve field names, registration, validation messages, autofocus, disabled states, placeholders, input types, and layout spans.
4. Do not alter form schemas, mutations, RPCs, persistence payloads, or submit conditions.

Acceptance:

- no duplicate one-line `Field` component remains in feature code;
- each migrated form retains its current labels, errors, keyboard order, and submit behavior;
- focused interaction tests cover open/close, validation, loading, server error, successful submit, and focus return where applicable.

### D2 — Error, loading, and empty-state convergence

1. Inventory local error summaries and route-level loading/empty shells.
2. Replace only behaviorally equivalent implementations with shared primitives.
3. Keep domain-specific remediation copy and retry behavior local.

Acceptance:

- repeated structural shells are removed without flattening domain-specific messaging;
- no loading state hides actionable errors;
- screen-reader live regions and alert roles remain correct.

### D3 — KPI and summary convergence

1. Find four-card KPI groups and move equivalent groups to `ResponsiveCardGrid`.
2. Keep metric calculation and query ownership inside the feature domain.
3. Preserve RTL order, mobile 2×2 behavior, skeletons, and empty values.

Acceptance:

- all equivalent four-card KPI groups use `ResponsiveCardGrid`;
- no financial source or calculation changes;
- mobile/tablet/desktop layouts remain stable.

### D4 — Table and mobile-card inventory

1. Classify `EntityTable`, raw table, and mobile-card implementations by behavior.
2. Converge only when sorting, filtering, pagination, row actions, selection, and responsive semantics match.
3. Record documented exceptions instead of forcing incompatible screens into one abstraction.

Acceptance:

- equivalent list behaviors share one implementation path;
- domain-specific tables remain local with a documented reason;
- row actions and mobile actions remain parity-tested.

### D5 — Overlay and accessibility verification

1. Confirm all create/edit workflows use `EntityForm.Overlay` or have a documented route-backed exception.
2. Verify RTL labels, initial focus, focus return, Escape handling, keyboard navigation, dialog/sheet scrolling, sticky actions, and safe-area padding.
3. Run browser checks on desktop, tablet, and mobile widths.

Acceptance:

- no undocumented create/edit surface remains;
- focus and scrolling behavior pass browser verification;
- destructive confirmation behavior is unchanged.

## Guardrails

- No migrations, schema changes, RLS changes, RPC changes, auth changes, or production Supabase/Vercel changes.
- No feature additions.
- No business-rule or financial-source rewrites.
- Shared components must represent repeated behavior, not merely repeated styling.
- Keep one coherent migration wave per commit and preserve compatibility exports.

## Required verification

```bash
pnpm typecheck
pnpm lint
pnpm --filter ./rentrix-app run typecheck:test
pnpm --filter ./rentrix-app run check:architecture
pnpm --filter ./rentrix-app test
pnpm build
```

Also run:

```bash
pnpm --filter ./rentrix-app run test:financials
```

when any financial feature file is touched, plus browser readiness/E2E for user-facing changes.

## Completion evidence

Update this section in the same PR with:

- migrated files and removed duplicate shells;
- documented exceptions;
- test counts and command results;
- browser viewport evidence;
- confirmation that no database, RPC, permission, or financial behavior changed.
