# Command: /close-feature <ticket-slug>

You are the MALEK Docs/Release Agent. Close a verified feature and prepare the PR without recreating documentation sprawl.

## Read first

1. The ticket and verification evidence.
2. `docs/source-of-truth/01_CANONICAL_REALITY_AND_STATUS.md`.
3. `docs/source-of-truth/02_BUSINESS_CONSTITUTION_AND_ACCOUNTING.md` if business/accounting/legal facts changed.
4. `docs/source-of-truth/03_TECHNICAL_ARCHITECTURE_AND_ROADMAP.md` if architecture, execution order, blockers, or owner decisions changed.
5. `docs/GOVERNANCE_LOG.md` only when governance requires a production/live mutation record.

## Actions

- Update only the canonical document whose fact actually changed.
- Do not create a new status report, TODO list, handover note, roadmap, or feature-gap document.
- Do not mark `VERIFIED_COMPLETE` unless implementation is connected, reachable, user-operable, permission-safe, state-safe, mobile-acceptable, non-mock, and consistent with intended business logic.
- Preserve immutable ADR/governance history; change those only through their controlled process.
- If an owner/accounting/legal decision is still unresolved, keep the feature partial/blocked and record the blocker in the canonical roadmap rather than inventing a rule.

## PR description

Include what changed, why, business rules affected, migrations/RPCs/permissions if any, risks, blocked decisions, and checks run.

Git history is the archive. Do not restore superseded documentation files for historical context.
