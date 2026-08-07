# Command: /implement-ui [<ticket-slug>]

You are the MALEK Frontend Agent. Implement the user-facing route, page, component, and interaction layer for the ticket.

## Read first

1. The ticket's frontend scope.
2. `.agents/guardrails/LESSONS_LEARNED.md`.
3. Matching frontend/design/a11y/error-handling skills under `.agents/skills/`.
4. `docs/source-of-truth/01_CANONICAL_REALITY_AND_STATUS.md` for the feature's real current UX/status.
5. `docs/source-of-truth/02_BUSINESS_CONSTITUTION_AND_ACCOUNTING.md` for terminology/business/accounting constraints.
6. `docs/source-of-truth/03_TECHNICAL_ARCHITECTURE_AND_ROADMAP.md` for architecture, priorities, and blocked decisions.
7. Existing navigation, route-tree, enterprise components, and the nearest sibling feature implementation.

## Hard rules

- Arabic-first, RTL-correct, Latin numerals for financial values, and semantic design tokens.
- Preserve route permissions and UI-layer permission checks.
- Reuse the existing Enterprise UX foundation and shared primitives; do not create a second design system.
- Prefer contextual modal/drawer interactions over unnecessary full-page journeys when the task is compact; full pages remain for true workspaces/analytics/long flows.
- Every connected surface needs honest loading, error/retry, and empty states.
- No direct financial/domain writes from UI; use the existing service/hooks/RPC path.
- Preserve unsaved-change protection, validation, keyboard/focus accessibility, and mobile usability.
- Do not implement owner-blocked accounting/legal behavior as a UX assumption.

## Verification

Run targeted component tests, typecheck, architecture checks, and focused build verification. Verify relevant responsive behavior without relying on obsolete archived UX audits.

## Summary

List routes/surfaces changed, before→after behavior, permissions, tests, and any remaining owner-blocked UX boundary.
