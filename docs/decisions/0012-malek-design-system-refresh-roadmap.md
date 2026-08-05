# ADR 0012 — MALEK design system refresh roadmap

## Status

Accepted — 2026-08-05.

## Context

MALEK already has a locked visible identity through [ADR 0011](./0011-malek-visible-brand-identity.md) and the [MALEK asset contract](../brand/MALEK_ASSET_CONTRACT.md). The repository also already has real production styling foundations in `rentrix-app/src/styles/tokens.css`, `product-palette.css`, `ux-foundation.css`, `page-polish.css`, and `globals.css`, plus existing shared UI components under `rentrix-app/src/components/ui/` and brand components under `rentrix-app/src/components/brand/`.

What is missing is an accepted execution ADR that turns the locked design decisions into an enforceable rollout contract without prematurely rewriting production UI, replacing global `:root` tokens, or treating one inspiration source as a total system replacement. The current `docs/ui-ux/` directory contains earlier Rentrix-branded visual direction, mobile UX, financial presentation, audit, and evidence documents, but those files do not yet formalize the final relationship between:

- Accessible Minimalism as the visual foundation,
- Bento Box Grid as a composition system,
- Enterprise SaaS (Mobile) style #83 as a mobile behavior reference,
- Executive Dashboard as the home Dashboard hierarchy model, and
- Financial Dashboard + Drill-Down Analytics as finance-only presentation patterns.

This task therefore closes the decision, keeps the work documentation-only, and establishes the governance boundary for all later implementation phases.

## Decision

The MALEK Design System Refresh Roadmap is accepted for execution with the following locked rules:

1. **Accessible Minimalism** is the global visual foundation.
2. **Bento Box Grid** is the responsive composition system for summaries, KPI groups, quick actions, and modular dashboard surfaces.
3. **Enterprise SaaS (Mobile) style #83** is a mobile interaction reference only.
4. **Executive Dashboard** governs the home Dashboard information hierarchy.
5. **Financial Dashboard + Drill-Down Analytics** apply only to accounting, finance, reconciliation, and reporting surfaces.
6. **Cairo** remains the application font.
7. The **existing MALEK blue semantic identity** remains the brand palette and may be refined, but not replaced.
8. The **Indigo/Violet gradient and Plus Jakarta Sans from style #83 are explicitly excluded**.
9. MALEK remains a **React web PWA**. React Native-only APIs, mandatory haptics, native shared-element transitions, and other native-only assumptions are out of scope.
10. **Light mode remains the default** and dark mode remains fully supported through the existing app-controlled `data-theme` mechanism.
11. **RTL is a first-class requirement**.
12. Brand names, marks, files, and asset contracts remain locked under ADR 0011 and `docs/brand/MALEK_ASSET_CONTRACT.md`.
13. **Third-party mockups, demo comps, and screenshots are not valid visual acceptance sources for this roadmap.** Screenshots may document regressions or evidence, but they do not define approval.
14. There will be **no global big-bang redesign**.
15. The **Dashboard is the first isolated proof before broader rollout**.

### Architectural composition principle

> “Bento determines composition, Enterprise SaaS Mobile determines mobile interaction behavior, Executive Dashboard determines home-page information priority, and Financial Dashboard with Drill-Down determines finance and reporting presentation. None of these replaces the others.”

### Documentation-only boundary

This ADR is documentation-only. It does not modify `rentrix-app/src`, replace production components, or change current token values in `rentrix-app/src/styles/tokens.css`.

### Scoped proof strategy

The first implementation proof will be constrained to the home Dashboard subtree and will use the selector:

```css
[data-visual-contract='v2']
```

That selector will initially exist **only around the Dashboard proof**. Existing components rendered inside that subtree inherit the V2 token contract without changing the rest of the application. After approval, the same contract can be promoted systematically to the app shell or to additional module scopes. The Dashboard proof must therefore use **scoped tokens rather than changing `:root`**.

### Execution roadmap

#### Phase 0 — Decision and governance lock

- **Scope:** Accept the design decision, document the locked principles, audit current documentation, and index the canonical sources.
- **Explicitly excluded work:** Production component rewrites, token edits, route changes, screenshot-led design sign-off, and any finance workflow changes.
- **Deliverables:** This ADR, the MALEK Visual Contract V2 document, the V2 token proposal, and documentation index updates.
- **Tests:** Markdown/link validation, forbidden-reference grep checks, and repository diff verification proving the change set is docs-only.
- **Approval gate:** Product/design review confirms the locked decisions are represented exactly and no production source changed.
- **Rollback or containment:** Revert the documentation commit only; no runtime rollback is required.

#### Phase 1 — Visual Contract and token proposal

- **Scope:** Maintain the accepted contract and token proposal as the only approved input to implementation PRs.
- **Explicitly excluded work:** Shipping token values globally, redesigning modules, or rewriting shared components.
- **Deliverables:** A stable V2 contract, scoped token proposal, acceptance matrix, and explicit non-goals for later PRs.
- **Tests:** Cross-check every proposed rule against the current style files, the existing theme mechanism, and the locked brand contract.
- **Approval gate:** Every later implementation PR must cite the relevant contract sections and affected proposal rows.
- **Rollback or containment:** Keep Phase 1 documentation in place and block implementation PRs that do not conform.

#### Phase 2 — Dashboard-scoped proof

- **Scope:** Apply the visual contract only to the home Dashboard through `[data-visual-contract='v2']`, using existing components inside that subtree wherever possible.
- **Explicitly excluded work:** Global `:root` replacement, finance/reporting rollout, unrelated page redesign, and module-wide token promotion.
- **Deliverables:** Dashboard wrapper scope, scoped token overrides, Dashboard composition proof, and defined loading/empty/stale/error/partial-data states.
- **Tests:** Targeted Dashboard RTL/light/dark/reduced-motion/keyboard/mobile checks; no horizontal app-level scrolling; safe-area verification on installed-PWA conditions.
- **Approval gate:** The Dashboard meets the V2 contract while all non-Dashboard surfaces remain visually and behaviorally unchanged.
- **Rollback or containment:** Remove the Dashboard wrapper or scoped stylesheet; no other surface should depend on it.

#### Phase 3 — Mobile interaction and responsive behavior

- **Scope:** Introduce the approved web-adapted mobile behaviors from style #83 across the Dashboard proof and then other approved scopes: safe areas, gutters, section rhythm, bottom sheets, compact headers, skeleton loading, and press feedback.
- **Explicitly excluded work:** Native-only APIs, haptic dependencies, unsafe swipe actions, and changes to business logic.
- **Deliverables:** Responsive behavior refinements, mobile interaction rules, and implementation evidence across the required viewport matrix.
- **Tests:** 320px/375px/414px/768px/1024px and existing desktop width validation in RTL, light, dark, reduced motion, keyboard navigation, and large-text conditions.
- **Approval gate:** Mobile behavior improves without reintroducing overflow, focus loss, hidden controls, or action ambiguity.
- **Rollback or containment:** Revert per-scope responsive behavior changes without affecting untouched modules.

#### Phase 4 — Finance/reporting treatment

- **Scope:** Apply the Financial Dashboard and Drill-Down rules to accounting, finance, reconciliation, and reporting surfaces only.
- **Explicitly excluded work:** Reusing finance density patterns on the home Dashboard, converting dense tables into Bento cards on desktop, or changing financial business rules.
- **Deliverables:** Finance/reporting layout rules, summary-to-detail drill paths, preserved tables on desktop, and mobile record-card entry points to detail views.
- **Tests:** Currency formatting, decimal precision, context-preserving filters, positive/negative status redundancy, drill-down navigation, and keyboard accessibility.
- **Approval gate:** Finance screens gain clearer summary-to-detail presentation without reducing accounting fidelity.
- **Rollback or containment:** Keep finance changes isolated to financial modules; revert module by module if necessary.

#### Phase 5 — Module-by-module rollout

- **Scope:** Promote the approved contract gradually from the Dashboard proof to additional modules and eventually to app-shell scopes where justified.
- **Explicitly excluded work:** One-shot global restyling, silent token redefinition, and cross-module redesign without module acceptance.
- **Deliverables:** Ordered rollout plan, per-module implementation PRs, and updated evidence tied back to the contract.
- **Tests:** Module-specific regression checks plus shared viewport, theme, RTL, and keyboard checks for each rollout PR.
- **Approval gate:** Each module proves compatibility before the next module starts.
- **Rollback or containment:** Revert only the affected module scope; do not entangle unfinished scopes with global tokens.

#### Phase 6 — cleanup, accessibility audit, and contract enforcement

- **Scope:** Remove dead transitional patterns, run a final accessibility audit, and add any durable enforcement hooks that keep implementation aligned with the contract.
- **Explicitly excluded work:** New visual experimentation, net-new module redesigns, or reopening the locked decisions in this ADR.
- **Deliverables:** Cleanup diff, audit findings, enforcement notes, and updated documentation showing which scopes have fully adopted V2.
- **Tests:** Repository documentation checks, relevant accessibility/architecture checks, contrast review, focus-state verification, and final rollout regression review.
- **Approval gate:** No remaining dependency on transitional one-off overrides for approved scopes.
- **Rollback or containment:** Transitional cleanup can be reverted independently if enforcement reveals regressions.

## Alternatives rejected

- **Direct global token replacement at `:root` during the Dashboard proof.** Rejected because it creates avoidable blast radius across every route.
- **Treating Bento as a replacement for Executive Dashboard or Financial Dashboard.** Rejected because composition, hierarchy, and finance presentation solve different problems.
- **Copying style #83 wholesale.** Rejected because the Indigo/Violet brand palette, Plus Jakarta Sans, and React Native assumptions conflict with MALEK’s locked palette, Cairo, and web-PWA architecture.
- **Using third-party mockups, demo designs, or screenshots as acceptance references.** Rejected because they are not canonical MALEK architecture or durable governance artifacts.
- **Big-bang redesign.** Rejected because the repository already has live production contracts, existing components, and finance-critical flows that need controlled containment.

## Consequences

- Future implementation PRs must begin from the MALEK V2 contract and token proposal, not from screenshots or unconstrained inspiration.
- The Dashboard proof can be reviewed in isolation because it is required to live under `[data-visual-contract='v2']` before any broader promotion.
- Finance/reporting surfaces keep their dense-data integrity instead of being flattened into generic dashboard cards.
- When older Rentrix-branded UI/UX documents conflict with this ADR or the new MALEK V2 contract, the new MALEK documents govern all future rollout work.
- The current app-controlled `data-theme` mechanism, Cairo font, MALEK blue semantic palette, and locked brand assets remain stable during the proof phase.

## Evidence

- Brand identity lock: `docs/decisions/0011-malek-visible-brand-identity.md`
- Asset lock: `docs/brand/MALEK_ASSET_CONTRACT.md`
- Existing visual token and styling foundations:
  - `rentrix-app/src/styles/tokens.css`
  - `rentrix-app/src/styles/product-palette.css`
  - `rentrix-app/src/styles/ux-foundation.css`
  - `rentrix-app/src/styles/page-polish.css`
  - `rentrix-app/src/styles/globals.css`
- Existing shared UI and brand component boundaries:
  - `rentrix-app/src/components/ui/`
  - `rentrix-app/src/components/brand/`
- Existing theme and responsive verification artifacts:
  - `rentrix-app/e2e/design-system-verification.spec.ts`
  - `rentrix-app/e2e/dashboard-workspace.spec.ts`
  - `rentrix-app/src/styles/ux-foundation.test.ts`
- UI/UX source data from `nextlevelbuilder/ui-ux-pro-max-skill` bundled in this repository:
  - `.agents/skills/ui-ux-pro-max/data/styles.csv` rows 1, 8, 30, 32, 36, 39, and 83
  - `.agents/skills/ui-ux-pro-max/data/app-interface.csv` entries covering loading feedback, safe areas, and reduced motion
  - `.agents/skills/ui-ux-pro-max/data/ux-guidelines.csv` entries covering async feedback and fixed-element/safe-area handling
