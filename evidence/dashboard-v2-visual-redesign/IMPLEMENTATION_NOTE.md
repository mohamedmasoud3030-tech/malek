# Dashboard V2 visual redesign implementation note

## Scope and containment

- Scope remains Dashboard-only under `[data-visual-contract='v2']` (`DashboardVisualScope`).
- No global `:root` token changes, schema changes, migrations, RLS, RPCs, financial calculations, route contracts, or permission rules were changed.
- Rollback/containment: revert the Dashboard component/style changes or remove the Dashboard V2 scope; non-Dashboard routes do not depend on these Dashboard-owned classes.

## Mapping to MALEK Visual Contract V2

- **A / I — Accessible Minimalism and Dashboard content contract:** replaced the old oversized hero/welcome surface with a compact operational context header; urgent priorities and KPI decisions now appear before secondary analytics.
- **B — Responsive composition / Bento usage:** implemented a real Dashboard KPI Bento cluster (2×2 on phone, 4-column at desktop) plus compact priority, action, queue, and analytics modules.
- **C — Web PWA mobile behavior:** preserved safe-area handling, bottom-navigation clearance, no horizontal app-level overflow, compact mobile spacing, visible press feedback, reduced-motion fallback, and skeleton states.
- **D — Interaction safety:** all KPI, priority, quick-action, queue, and analytics destinations remain real links with visible focus and minimum 44×44px interaction areas.
- **E / G — Color, shape, and depth:** kept MALEK blue as the brand-primary accent, semantic status tones, ~14px cards, ~12px controls, subtle borders/shadows, light/dark theme support, and no purple/indigo rebrand, gradients, glassmorphism, or theatrical shadows.
- **F / J — Typography and financial presentation:** Cairo remains the app font; money values are rendered directionally stable with `dir="ltr"` and tabular numerals; no fake trends or fake values were introduced.

## Mapping to ADR 0012

- **Phase 2 Dashboard-scoped proof:** the Dashboard subtree keeps the accepted V2 scope and scoped CSS, while non-Dashboard surfaces remain visually and behaviorally unchanged.
- **Phase 3 mobile behavior:** the implementation verifies the required viewport matrix, safe-area/bottom-nav behavior, no horizontal overflow, keyboard focus, reduced motion, loading, empty, stale, error, and partial-data states.
- **Rejected alternatives honored:** no global token replacement, no big-bang app-shell redesign, no wholesale style #83 palette/font copy, and no finance/reporting business-rule changes.

## Root cause addressed

PR #1348 established the V2 contract markers and tests but left much of the old visual composition intact: a large title/hero surface, oversized stacked priority/KPI cards, weak density, and secondary analytics appearing too high. This PR changes the actual Dashboard component structure and scoped CSS, not only tokens or DOM assertions.
