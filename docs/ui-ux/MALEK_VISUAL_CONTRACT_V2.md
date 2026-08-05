# MALEK Visual Contract V2

**Status:** Accepted reference contract
**Date:** 2026-08-05
**Scope:** Dashboard-first phased rollout; documentation-only in this phase.

## Authority and scope

This document is the enforceable visual contract for later implementation phases. It works with:

- [ADR 0011 — MALEK visible brand identity](../decisions/0011-malek-visible-brand-identity.md)
- [ADR 0012 — MALEK design system refresh roadmap](../decisions/0012-malek-design-system-refresh-roadmap.md)
- [MALEK asset contract](../brand/MALEK_ASSET_CONTRACT.md)
- Existing production style foundations in `rentrix-app/src/styles/`

Where older Rentrix-branded UI/UX documents disagree with this contract, this contract governs future implementation work.

> “Bento determines composition, Enterprise SaaS Mobile determines mobile interaction behavior, Executive Dashboard determines home-page information priority, and Financial Dashboard with Drill-Down determines finance and reporting presentation. None of these replaces the others.”

## Implementation boundary

- This phase does **not** change production components or global token values.
- The first implementation proof must scope V2 to the home Dashboard by wrapping that subtree with:

```css
[data-visual-contract='v2']
```

- Existing components inside that subtree inherit the V2 token contract.
- Promotion beyond the Dashboard happens only after Phase 2 approval.

## A. Design foundations

### Accessible Minimalism

- Every visible element must justify its presence through hierarchy, task support, state clarity, or navigation.
- Decoration is subordinate to comprehension; operational screens do not rely on gradients, noise, ornamental dividers, or decorative illustration to establish hierarchy.
- Cards, headers, actions, and charts must read clearly in both light and dark themes without hidden information.

### Restrained soft depth

- Depth is permitted only to separate planes: page, card, elevated overlay, and transient feedback.
- Card elevation must remain subtle; overlays may be stronger but still restrained.
- Finance-critical screens must prefer clarity over expressiveness.

### Semantic color use

- Color is assigned by role, not by page.
- Brand blue identifies primary intent and selected emphasis, not arbitrary decoration.
- Status colors must be semantic and consistent across Dashboard, finance, reports, and mobile states.

### Hierarchy before decoration

- Page purpose, urgent action, KPI/value, and detail order must be understandable before any user notices styling.
- Titles, section labels, numbers, alerts, and action placement establish hierarchy first.

### Arabic-first and RTL-first behavior

- Layout direction defaults to RTL.
- Logical properties (`start`/`end`) are required for spacing, borders, alignment, and icon placement.
- Arabic is the primary reading mode; English and numeric fragments must not break the RTL experience.
- Financial values may render with `dir="ltr"` when needed for numeric stability.

## B. Responsive composition

### Mobile-first grid

- Composition starts at 320px and scales upward.
- Pages must remain readable and operable at 320px, 375px, and 414px without horizontal application-level scrolling.
- Summary modules stack first, then form denser grids only when width allows.

### Bento usage rules

**Allowed:**
- Summary cards
- KPI groups
- Quick actions
- Status groups
- Dashboard queue modules
- Lightweight drill-entry analytics summaries

**Prohibited:**
- Dense accounting tables on desktop
- Long records or ledger-like lists that must preserve row comparison
- Replacing report tables with decorative card mosaics
- Using asymmetry when it harms scan order or reading continuity

### Grid behavior by breakpoint

| Breakpoint | Contract |
| --- | --- |
| 320-414px | Single-column page flow. KPI and quick-action groups may use at most 2 columns when every tap target remains compliant. |
| 768px | Two-column summary composition is allowed when scan order remains top-to-bottom in RTL. Long-form content still prefers a single readable column. |
| 1024px+ | A 12-column or equivalent modular grid may be used. Wide analytics or tables span multiple columns; supporting cards occupy secondary columns. |

### Horizontal scroll

- No application-level horizontal scrolling is allowed.
- Component-level horizontal scrolling is allowed only for dense tables or chips/tabs that cannot collapse further.
- Any component-level scroller must preserve focus visibility and indicate overflow affordance.

### Progressive disclosure on mobile

- Secondary analytics, complex filters, low-priority metadata, and long action lists must collapse or move into sheets/expanders on small screens.
- Mobile should show summary first and reveal detail on demand.

## C. Mobile behavior from style #83

### Adopt for the web PWA

- Strict safe-area handling using `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` where fixed UI is involved
- 16-20px screen gutters
- Approximately 24px between major sections
- Approximately 12px between related items
- 3-5 primary bottom-navigation destinations
- Skeleton loading for content-level waits
- Bottom sheets for appropriate mobile flows such as filters, compact forms, and task-focused actions
- Visible press feedback
- Reduced-motion fallback
- Collapsible or compact mobile headers where useful

### Reject or adapt

| Source idea from style #83 | Contract decision |
| --- | --- |
| Indigo/Violet branding | Rejected. MALEK blue remains the brand accent. |
| Plus Jakarta Sans | Rejected. Cairo remains the application font. |
| React Native-only APIs and assumptions | Rejected. Behavior must be implemented for the web platform. |
| Mandatory haptics | Rejected. Haptics are not a web requirement. |
| Unsafe swipe actions | Rejected. Swipe may reveal actions but may not directly commit irreversible operations. |
| Native-only shared-element transitions | Rejected. Continuity may be communicated with web-safe motion only. |

## D. Interaction safety

- Interactive controls must expose a minimum interactive area of **44×44px**.
- Keyboard focus must always be visible in both themes.
- No core action may be hover-only.
- Asynchronous actions must show visible loading feedback.
- Destructive actions require explicit confirmation.
- Swipe must never directly perform payment, posting, deletion, refund, settlement approval, or any irreversible financial operation.
- Structural UI icons come from one governed SVG icon family. The current governed family is **Lucide SVG via `lucide-react`**; introducing another structural family requires explicit follow-up approval.
- Emoji must not be used as structural UI icons.

## E. Color

### Semantic role contract

The implementation must provide complete explicit light and dark pairs for every role below. Numerical target values are documented in [MALEK_VISUAL_CONTRACT_V2_TOKEN_PROPOSAL.md](./MALEK_VISUAL_CONTRACT_V2_TOKEN_PROPOSAL.md).

| Role | Required light token(s) | Required dark token(s) | Contract rule |
| --- | --- | --- | --- |
| Primary MALEK blue | `--color-primary`, `--color-primary-fg` | `--color-primary`, `--color-primary-fg` | Keep MALEK blue as the only brand-primary action identity. |
| Background | `--color-bg` | `--color-bg` | Light uses a near-white neutral canvas; dark uses a deep non-black canvas. |
| Card / raised surface | `--color-card`, `--card` | `--color-card`, `--card` | Cards separate from the page without decorative contrast spikes. |
| Card-muted / secondary surface | `--color-card-muted`, `--muted` | `--color-card-muted`, `--muted` | Secondary grouping surfaces stay readable and low drama. |
| Text hierarchy | `--color-text-primary`, `--color-text-secondary`, `--color-text-muted` | `--color-text-primary`, `--color-text-secondary`, `--color-text-muted` | Primary text carries reading load; secondary and muted text must remain legible. |
| Border / input | `--color-border`, `--color-border-light`, `--input` | `--color-border`, `--color-border-light`, `--input` | Borders and separators stay visible without becoming decorative outlines. |
| Success | `--color-success-text`, `--color-success-bg` | `--color-success-text`, `--color-success-bg` | Used for success or posted-positive states only. |
| Warning | `--color-warning-text`, `--color-warning-bg` | `--color-warning-text`, `--color-warning-bg` | Used for caution, partial completion, or aging attention states. |
| Danger | `--color-danger-text`, `--color-danger-bg` | `--color-danger-text`, `--color-danger-bg` | Used for destructive, overdue, blocked, or loss-oriented states. |
| Information | `--color-info-text`, `--color-info-bg` | `--color-info-text`, `--color-info-bg` | Used for draft, informational, or non-blocking system states. |
| Neutral | `--color-neutral-text`, `--color-neutral-bg` | `--color-neutral-text`, `--color-neutral-bg` | Used for archived, void, inactive, or reference-only states. |
| Focus ring | `--focus-ring` or equivalent scoped alias | `--focus-ring` or equivalent scoped alias | Focus treatment must remain distinct from both border and hover states. |

### Accessibility requirements

- WCAG AA is mandatory.
- Normal text contrast must be at least **4.5:1**.
- Large text and large glyphs must be at least **3:1** where applicable.
- Color must never be the only status indicator.
- A new purple brand palette must not be introduced.

## F. Typography

- Cairo remains the application font.
- Arabic text must avoid tracking tricks that reduce legibility.
- The contract hierarchy is:

| Role | Target size | Weight | Line-height | Rule |
| --- | --- | --- | --- | --- |
| Title | 28-32px | 700 | 1.2-1.3 | Reserved for prominent page-level title moments only. |
| Page heading | 24-28px | 700 | 1.25-1.35 | Primary page title; must remain readable in Arabic. |
| Section heading | 18-20px | 600 | 1.35-1.45 | Used for grouped content sections and card clusters. |
| Body | 16-18px | 400-500 | 1.55-1.7 | Minimum normal body size is 16px where practical. |
| Label | 14px | 500-600 | 1.4-1.5 | Used for field labels, compact action labels, and short metadata keys. |
| Caption | 12-13px | 400-500 | 1.4-1.5 | Used for timestamps, supporting metadata, and tertiary explanations. |
| Financial number hierarchy | 14-16px in tables, 20-28px in summaries | 600-700 | 1.15-1.3 | Must use tabular numerals when supported; if not yet tokenized, the requirement remains a documented future token. |

Additional rules:

- Arabic body text should keep generous line-height.
- Financial numbers should keep alignment stability through `tabular-nums` where supported.
- If tabular numerals require a future token rather than immediate implementation, the token must be introduced intentionally rather than ad hoc per screen.

## G. Shape and depth

### Radius targets

| Surface | Target |
| --- | --- |
| Card | ~14px |
| Input | ~12px |
| Button | ~12px |
| Sheet / dialog | ~16px |
| Pill / badge / filter chip | Full radius |

### Depth rules

- Use soft neutral or brand-tinted shadows sparingly.
- Card shadows should suggest separation, not floating spectacle.
- Hover elevation may increase depth slightly, but must remain subtle.
- Decorative blur-heavy glass, claymorphism, neon effects, and theatrical depth are prohibited on finance-critical screens.

## H. Motion

- Standard micro-interaction duration: **150-300ms**.
- Motion must communicate state, continuity, or loading.
- Decorative infinite animation is prohibited on operational screens.
- Reduced-motion support is mandatory.
- Press-scale feedback must use transform-only techniques and must not shift surrounding layout.

## I. Dashboard content contract

- The home Dashboard shows **4-6 primary KPIs maximum above the fold**.
- Urgent exceptions and required actions appear before secondary analytics.
- Quick actions must reflect real role and permission availability.
- A dense accounting table does not belong on the home Dashboard.
- Every summary card must link to a real detail destination.
- The Dashboard must define loading, empty, stale, error, and partial-data states.
- Recommended content order:
  1. Page context / greeting / workspace framing
  2. Urgent exceptions and required actions
  3. KPI summary cluster
  4. Queues and operational follow-up
  5. Secondary analytics and trends

## J. Financial and reporting contract

- Summary first, detail second.
- Every KPI or report total must have a drill-down path to source records or the nearest valid detail destination.
- Filters must preserve context while drilling into detail.
- Currency and decimal precision must be explicit and consistent.
- Positive and negative status must never rely on color alone.
- Tables remain tables when the data is genuinely tabular; desktop should not convert every financial row into a Bento card.
- Mobile may summarize a record as a card if that card opens a full detail view.
- Financial amounts should remain directionally stable and readable in RTL contexts.

## K. Acceptance viewports and test conditions

### Minimum viewport matrix

| Width | Requirement |
| --- | --- |
| 320px | Must remain usable without horizontal application-level scrolling. |
| 375px | Primary small-phone acceptance width. |
| 414px | Large-phone acceptance width. |
| 768px | Tablet portrait acceptance width. |
| 1024px | Desktop threshold / large-tablet acceptance width. |
| 1440px | Existing application desktop verification width used by current evidence. |

### Required acceptance conditions

Every implementation phase that claims V2 compliance must also verify:

- RTL
- Light mode
- Dark mode
- Keyboard navigation
- Reduced motion
- Large text or dynamic text conditions where applicable
- iOS safe-area behavior when installed as a PWA

## Source traceability

This contract is traceable to:

- `nextlevelbuilder/ui-ux-pro-max-skill` data bundled in `.agents/skills/ui-ux-pro-max/`, especially style rows 1, 8, 30, 32, 36, 39, and 83
- Existing MALEK architecture and style files in `rentrix-app/src/styles/`
- Existing MALEK brand and asset governance in ADR 0011 and `docs/brand/MALEK_ASSET_CONTRACT.md`
- Explicit architectural judgment documented in ADR 0012 where the external guidance had to be adapted from React Native to the web PWA platform
