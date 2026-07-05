# Rentrix Release Policy

Use this policy before declaring a change ready to merge or a roadmap release ready to close.

Read first:

```text
docs/RENTRIX_MASTER_PLAN.md
docs/ai/ONBOARDING.md
docs/ai/GIT_TOOLING_POLICY.md
docs/ai/testing-guide.md
```

## Scope gate

- Map the change to one roadmap item or one tightly coupled safe slice.
- Do not add SaaS multi-tenancy, general-ledger work, or unrelated features.
- Do not re-expose or delete deferred routes casually.
- Remove only cleanup items already classified as safe.

## Domain gate

- Re-check affected rules in `domain-rules.md`.
- Preserve occupancy exclusivity, orphan prevention, canonical balances, and posted-payment immutability.
- Use reversal and replacement for posted-payment correction.

## Database and environment gate

- Review every changed migration, policy, RPC, auth boundary, environment variable, and connector target.
- Keep migrations conservative and preview-first.
- Do not commit secrets, production data, or generated local metadata.
- Record access blockers honestly.

## UI gate

For changed user-facing pages, check:

- Arabic RTL;
- English LTR sanity;
- mobile layout;
- loading, empty, error, retry, and null-relation states;
- relevant PWA behavior;
- any browser or device limitation.

## Git and PR gate

Follow `GIT_TOOLING_POLICY.md`:

- inspect branch and `main` state before writing;
- compare the branch against `main`;
- review changed filenames and focused patches;
- use fresh CI evidence from the current head SHA;
- keep the diff narrow;
- record the merge SHA and next roadmap item.

## Full runtime verification gate

GitHub Actions currently runs:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build
pnpm --filter ./rentrix-app run typecheck:test
pnpm --filter ./rentrix-app test
pnpm --filter ./rentrix-app run test:financials
```

For database work, also run the approved local or preview validation flow when available.

## Documentation-only gate

- Confirm no runtime file changed.
- Review the full diff for contradictions and stale references.
- Run `git diff --check` when a local checkout exists.
- Use PR CI as the verification source when local checkout is unavailable.

## Release closure gate

Close a roadmap release only when:

- required items are complete or recorded as accepted residual risk;
- CI evidence is fresh;
- required browser, connector, preview, or live evidence is recorded honestly;
- deferred modules remain documented;
- the result is recorded as GO or NO-GO;
- the next release and first ready item are identified.

## Completion report

State the roadmap release, completed item, exact files changed, behavior changed, checks run with actual results, blockers, database or deployment impact, diff review notes, commit SHA, and next roadmap item.
