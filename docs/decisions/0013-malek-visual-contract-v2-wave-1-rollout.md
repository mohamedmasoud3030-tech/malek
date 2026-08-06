# ADR 0013 — MALEK visual contract v2, Wave 1 rollout

## Status

Accepted — 2026-08-06.

## Context

[ADR 0012](./0012-malek-design-system-refresh-roadmap.md) established the
MALEK design-system refresh as a documentation-only, Dashboard-scoped proof
of concept. It closed the direction decision (Accessible Minimalism +
Bento Box Grid + Enterprise SaaS mobile behavior + Executive Dashboard
hierarchy + Financial Dashboard drill-down patterns) without expanding the
rollout beyond the Dashboard.

PR #1357 (`fix/ui-malek-pro-visual-wave-1`, verified head
`8c48dba94c813bd1d632b3505f23d211ac8cc5be`) is the first controlled
expansion of that proof beyond the Dashboard. It touches the app shell,
navigation, notifications, shared primitives (button, card, entity-table,
mobile-card, section-tabs), and a set of already-migrated feature surfaces
(properties, contracts, maintenance, owners, people, units, settings,
portfolio hub, relationships hub).

## Decision

- ADR 0012 remains the historical Dashboard-proof decision and is not
  superseded by this ADR.
- The Dashboard proof is approved for controlled expansion.
- PR #1357 is the first controlled Wave 1 rollout beyond the Dashboard.
- Wave 1 is limited to the surfaces already modified by PR #1357 as of the
  verified head SHA above. This is **not** a blanket authorization for
  application-wide redesign.
- Routes, permissions, business logic, accounting behavior, workflows, and
  data flow are unaffected by Wave 1 and must remain unchanged by it.
- Semantic design tokens (`bg-primary`, `bg-sidebar`, `text-success`,
  `bg-background`, `text-muted-foreground`, `border-border`, etc., as
  defined in `rentrix-app/src/styles/tokens.css`) are the mandatory way to
  express color and surface intent in Wave 1 surfaces.
- Raw Tailwind color palette classes (e.g. `emerald-*`, `slate-*`) are not
  part of the design-system API and must not be introduced or reintroduced
  in Wave 1 surfaces.
- MALEK blue remains the primary brand and primary-action identity
  (`bg-primary` / `text-primary-foreground`).
- Emerald/green (`text-success` / `bg-success`) is reserved for genuine
  success or positive states — not primary actions, not active-nav states.
- Light mode, dark mode, accessibility (focus-visible, contrast), and
  responsive behavior (375px, 414px, 768px, 1440px) must be validated for
  any surface touched under Wave 1.
- Expansion into modules not already touched by PR #1357 requires a later,
  separate, explicit rollout decision — it is not implied by this ADR.

## Consequences

- Wave 1 surfaces gain a consistent semantic-token contract, reducing the
  chance of future light/dark or contrast regressions on those surfaces.
- Any raw-palette usage discovered later on a Wave 1 surface is a
  regression against this ADR and should be treated as a defect, not a
  style preference.
- Surfaces outside the touched set are explicitly out of scope and should
  not be modified opportunistically under the banner of this ADR.

## Verification

This ADR was written only after independently confirming, via direct
repository access (not third-party report), that:

- the branch `fix/ui-malek-pro-visual-wave-1` exists with head
  `8c48dba94c813bd1d632b3505f23d211ac8cc5be`,
- PR #1357 exists open/draft against `main` at the same head,
- ADR 0012 exists on `main` and is `Accepted`,
- the semantic token layer referenced above exists in
  `rentrix-app/src/styles/tokens.css`.

See `docs/audits/MALEK_VISUAL_WAVE_1_CONFORMANCE_AUDIT.md` for the detailed
conformance findings and corrections applied.
