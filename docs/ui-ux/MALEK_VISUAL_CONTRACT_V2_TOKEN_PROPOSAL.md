# MALEK Visual Contract V2 Token Proposal

**Status:** Design proposal only
**Date:** 2026-08-05
**Production impact in this PR:** None

## Purpose

This document proposes a **scoped** token evolution for the future Dashboard proof. It is not a production token change and it does not modify `rentrix-app/src/styles/tokens.css` in this task.

The proposal preserves the locked MALEK blue semantic identity, Cairo, RTL-first behavior, the current `data-theme` model, and the requirement that the first proof be isolated under:

```css
[data-visual-contract='v2']
```

## Audited source files

Current values were read directly from:

- `rentrix-app/src/styles/tokens.css`
- `rentrix-app/src/styles/product-palette.css`
- `rentrix-app/src/styles/ux-foundation.css`
- `rentrix-app/src/styles/page-polish.css`
- `rentrix-app/src/styles/globals.css`

## Proposal summary

- Keep the MALEK blue primary token locked.
- Tighten contrast in supporting text and borders.
- Introduce an explicit focus token for scoped V2 work.
- Slightly increase radius and shadow sophistication for a restrained Dashboard proof.
- Preserve compatibility accent tokens, but do not expand purple/violet usage as a brand direction.
- Add scoped spacing tokens that make the Dashboard proof honor the 16-20px gutter and 24px/12px rhythm without touching global defaults.

## Core surfaces, text, and focus

| Token name | Current light value | Proposed V2 light value | Current dark value | Proposed V2 dark value | Reason | Affected component classes or semantic surfaces | Risk | Change type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `--color-bg` | `210 20% 98%` | `210 24% 98%` | `215 28% 9%` | `215 30% 10%` | Keep the near-white / deep-navy structure while making the scoped Dashboard canvas feel slightly cleaner and less flat. | App canvas, Dashboard background, sticky headers, empty states | Low | Value only |
| `--color-card` | `0 0% 100%` | `0 0% 100%` | `215 25% 13%` | `215 24% 14%` | Preserve white cards in light mode; slightly separate dark cards from the page background. | Card, KPI, quick-action, queue, dialog, sheet surfaces | Low | Value only |
| `--color-card-muted` | `210 20% 96%` | `210 24% 96%` | `215 20% 11%` | `215 18% 12%` | Improve section grouping and muted surface layering without introducing decorative contrast. | Secondary cards, filter surfaces, muted panels, skeleton backplates | Low | Value only |
| `--color-primary` | `200 85% 38%` | `200 85% 38%` | `200 85% 48%` | `200 85% 48%` | Lock the MALEK blue primary identity for the first proof; refinement happens around it, not against it. | Primary buttons, selected navigation, key links, emphasis accents | Low | Value only (unchanged by intent) |
| `--color-primary-fg` | `0 0% 100%` | `0 0% 100%` | `0 0% 100%` | `0 0% 100%` | Preserve readable foreground on primary actions in both themes. | Text and icons on primary buttons or fills | Low | Value only (unchanged by intent) |
| `--color-text-primary` | `215 28% 17%` | `215 32% 16%` | `210 20% 92%` | `210 24% 94%` | Slightly sharpen reading contrast for operational surfaces and Dashboard scanning. | Page titles, KPI values, body text, table values | Low | Value only |
| `--color-text-secondary` | `215 16% 40%` | `215 18% 33%` | `210 14% 68%` | `210 16% 74%` | Make secondary text more reliable for 16px body usage and dark-theme scanability. | Descriptions, section support text, compact metadata | Medium | Value only |
| `--color-text-muted` | `215 14% 55%` | `215 12% 48%` | `210 10% 50%` | `210 12% 60%` | Improve placeholder, tertiary text, and timestamp legibility while keeping muted hierarchy. | Captions, helper text, placeholders, inactive metadata | Medium | Value only |
| `--color-border` | `214 20% 88%` | `214 18% 84%` | `215 20% 22%` | `215 18% 26%` | Give inputs and section boundaries clearer structure for Minimalism without heavier decoration. | Inputs, cards, dialogs, tables, cards-in-cards | Medium | Value only |
| `--color-border-light` | `214 20% 93%` | `214 18% 89%` | `215 16% 17%` | `215 16% 21%` | Improve subtle separators, especially in dark mode. | Table separators, header separators, subtle card edges | Medium | Value only |
| `--focus-ring` *(new scoped token)* | `—` | `200 85% 38%` | `—` | `200 85% 48%` | Formalize focus treatment instead of depending only on ad hoc `ring-primary/15-20` usage. | `focus-visible` states for buttons, tabs, chips, inputs, cards | Low | New scoped token addition |

## Semantic statuses and compatibility accents

| Token name | Current light value | Proposed V2 light value | Current dark value | Proposed V2 dark value | Reason | Affected component classes or semantic surfaces | Risk | Change type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `--color-success-text` | `152 66% 26%` | `154 68% 27%` | `152 58% 62%` | `154 64% 67%` | Keep success readable and slightly cleaner against neutral surfaces. | Paid, posted, healthy, positive confirmations | Low | Value only |
| `--color-success-bg` | `152 62% 94%` | `152 52% 93%` | `152 40% 16%` | `154 34% 18%` | Soften success fills while preserving semantic recognition in both themes. | Success badges, subtle success rows, notices | Low | Value only |
| `--color-warning-text` | `32 81% 32%` | `36 86% 31%` | `42 88% 64%` | `42 92% 68%` | Support aging/partial states with slightly cleaner amber contrast. | Partial, caution, aging alerts | Low | Value only |
| `--color-warning-bg` | `42 96% 92%` | `43 100% 91%` | `38 60% 16%` | `39 62% 18%` | Maintain visible but restrained caution background fills. | Warning badges, arrears highlights, partial states | Low | Value only |
| `--color-danger-text` | `0 72% 42%` | `2 70% 41%` | `0 78% 70%` | `2 82% 74%` | Preserve finance-critical danger clarity while slightly smoothing saturation. | Overdue, destructive, blocked, negative financial values | Medium | Value only |
| `--color-danger-bg` | `0 72% 95%` | `0 80% 96%` | `0 48% 18%` | `2 44% 20%` | Keep destructive fills legible without becoming noisy. | Danger badges, confirm surfaces, alert rows | Medium | Value only |
| `--color-info-text` | `199 74% 32%` | `201 78% 34%` | `199 82% 68%` | `201 86% 72%` | Differentiate informational states from primary brand usage while keeping blue-family coherence. | Draft/info badges, non-blocking notices | Low | Value only |
| `--color-info-bg` | `199 82% 94%` | `200 88% 95%` | `199 46% 16%` | `201 44% 18%` | Keep informational fills subtle and readable. | Draft chips, helper callouts, non-critical notices | Low | Value only |
| `--color-neutral-text` | `215 16% 42%` | `215 14% 36%` | `215 14% 55%` | `215 12% 68%` | Strengthen archived/void legibility and secondary-state contrast. | Void, archived, inactive, reference-only states | Low | Value only |
| `--color-neutral-bg` | `215 18% 92%` | `215 16% 94%` | `215 16% 18%` | `215 14% 20%` | Keep neutral backgrounds soft but clearer in dark mode. | Neutral badges, void containers, inactive filters | Low | Value only |
| `--tone-emerald` / `--tone-emerald-soft` | `154 67% 34%` / `153 56% 93%` | `154 64% 32%` / `152 52% 92%` | `154 60% 58%` / `154 38% 16%` | `154 58% 62%` / `154 34% 18%` | Preserve compatibility for positive/product accents while keeping them softer than the brand-primary path. | KPI accent bands, product accent badges in `product-palette.css` | Medium | Value only |
| `--tone-amber` / `--tone-amber-soft` | `36 88% 42%` / `43 96% 91%` | `36 82% 38%` / `43 92% 90%` | `42 91% 62%` / `38 54% 17%` | `42 88% 66%` / `39 48% 18%` | Preserve caution accents for non-primary highlight uses. | KPI caution accents, badge ramps, warning summaries | Medium | Value only |
| `--tone-sky` / `--tone-sky-soft` | `199 83% 43%` / `198 85% 93%` | `200 78% 40%` / `200 82% 94%` | `199 86% 67%` / `199 42% 17%` | `200 82% 70%` / `200 36% 18%` | Keep informational accents available without confusing them with the primary action color. | Non-primary analytic accents, compatibility KPI cards | Medium | Value only |
| `--tone-rose` / `--tone-rose-soft` | `347 74% 48%` / `349 82% 94%` | `347 74% 48%` / `349 82% 94%` | `347 82% 70%` / `347 42% 18%` | `347 82% 70%` / `347 42% 18%` | Preserve compatibility only; do not expand rose as a new system direction during the Dashboard proof. | Legacy accent badges or KPI variants outside the new Dashboard contract | Medium | Value only (usage constrained) |
| `--tone-violet` / `--tone-violet-soft` | `263 69% 52%` / `263 78% 95%` | `263 69% 52%` / `263 78% 95%` | `263 86% 76%` / `263 38% 19%` | `263 86% 76%` / `263 38% 19%` | Preserve compatibility only; V2 must not reinterpret violet as MALEK’s primary palette. | Legacy accent badges or KPI variants outside the new Dashboard contract | High | Value only (usage constrained) |
| `--tone-slate` / `--tone-slate-soft` | `215 20% 42%` / `214 24% 93%` | `215 18% 38%` / `214 20% 94%` | `214 18% 70%` / `215 18% 18%` | `214 16% 74%` / `215 16% 20%` | Strengthen neutral analytic accents that pair well with accessible minimal surfaces. | Neutral KPI accents, low-emphasis status groups | Low | Value only |

## Shadows, radius, and spacing

| Token name | Current light value | Proposed V2 light value | Current dark value | Proposed V2 dark value | Reason | Affected component classes or semantic surfaces | Risk | Change type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `--shadow-card` | `0 1px 3px 0 rgb(0 0 0 / 0.04)` | `0 1px 2px 0 rgb(15 23 42 / 0.06)` | `0 1px 3px 0 rgb(0 0 0 / 0.2)` | `0 1px 2px 0 rgb(2 6 23 / 0.28)` | Keep card depth restrained but slightly more deliberate and neutral. | `.shadow-card`, cards, KPI tiles, queues | Low | Value only |
| `--shadow-card-hover` | `0 2px 8px 0 rgb(0 0 0 / 0.06)` | `0 6px 18px -12px rgb(15 23 42 / 0.18)` | `0 2px 8px 0 rgb(0 0 0 / 0.3)` | `0 8px 22px -14px rgb(0 0 0 / 0.42)` | Create a clearer hover distinction without turning cards into floating marketing tiles. | Hover-capable cards, interactive list items, summary tiles | Medium | Value only |
| `--shadow-elevated` | `0 8px 32px 0 rgb(0 0 0 / 0.12)` | `0 20px 40px -24px rgb(15 23 42 / 0.28)` | `0 8px 32px 0 rgb(0 0 0 / 0.4)` | `0 24px 48px -24px rgb(0 0 0 / 0.56)` | Separate dialogs and sheets more clearly from the page while keeping depth soft. | Dialogs, bottom sheets, popovers, confirmation layers | Medium | Value only |
| `--radius` | `0.625rem` | `0.75rem` | `—` | `0.75rem` | Lift the baseline from 10px to 12px for a calmer mobile-friendly control rhythm. | `rounded-lg` mapping, buttons, compact controls | Medium | Value only |
| `--radius-card` | `0.75rem` | `0.875rem` | `—` | `0.875rem` | Move cards toward the restrained intersection between Bento and style #83 without becoming pill-heavy. | `rounded-xl` mapping, cards, KPI tiles, muted panels | Medium | Value only |
| `--radius-elevated` | `0.875rem` | `1rem` | `—` | `1rem` | Give sheets/dialogs slightly more separation than base cards. | `rounded-2xl` mapping, dialogs, sheets, popovers | Medium | Value only |
| `--radius-input` *(new scoped token)* | `—` | `0.75rem` | `—` | `0.75rem` | Document a distinct input radius for later component cleanup without touching current production classes yet. | Inputs, selects, textareas, date pickers | Low | New scoped token addition |
| `--radius-button` *(new scoped token)* | `—` | `0.75rem` | `—` | `0.75rem` | Align button rounding with the calmer V2 control language. | Buttons, tabs, segmented actions, compact quick actions | Low | New scoped token addition |
| `--app-page-gutter-inline` | `clamp(0.75rem, 2.4vw, 1.5rem)` | `clamp(1rem, 4vw, 1.25rem)` | same as light | `clamp(1rem, 4vw, 1.25rem)` | Enforce the V2 mobile gutter rule of roughly 16-20px without changing global layout defaults. | `#main-content`, page layout wrappers, Dashboard shells | Low | Value only |
| `--app-page-gutter-block` | `clamp(0.75rem, 2vw, 1.5rem)` | `clamp(1rem, 3vw, 1.5rem)` | same as light | `clamp(1rem, 3vw, 1.5rem)` | Create slightly more stable vertical breathing room for Dashboard sections. | Page top spacing, section wrappers | Low | Value only |
| `--dashboard-section-gap` *(new scoped token)* | `—` | `1.5rem` | `—` | `1.5rem` | Formalize the ~24px major-section rhythm requested by the contract. | Dashboard section stacks, bento rows, analytics groups | Low | New scoped token addition |
| `--dashboard-cluster-gap` *(new scoped token)* | `—` | `0.75rem` | `—` | `0.75rem` | Formalize the ~12px related-item rhythm requested by the contract. | KPI clusters, action clusters, grouped status chips | Low | New scoped token addition |
| `--mobile-bottom-nav-height` | `3.75rem` | `3.75rem` | same as light | `3.75rem` | Current height already supports 3-5 primary destinations and safe-area clearance; keep unchanged. | Bottom nav clearance, mobile page padding | Low | Value only (unchanged by intent) |

## Concrete scoped CSS proposal for the later Dashboard PR

The Dashboard proof should introduce a scoped wrapper instead of editing global `:root` values.

```css
[data-visual-contract='v2'] {
  --color-bg: 210 24% 98%;
  --color-card: 0 0% 100%;
  --color-card-muted: 210 24% 96%;
  --color-primary: 200 85% 38%;
  --color-primary-fg: 0 0% 100%;
  --color-text-primary: 215 32% 16%;
  --color-text-secondary: 215 18% 33%;
  --color-text-muted: 215 12% 48%;
  --color-border: 214 18% 84%;
  --color-border-light: 214 18% 89%;
  --color-success-text: 154 68% 27%;
  --color-success-bg: 152 52% 93%;
  --color-warning-text: 36 86% 31%;
  --color-warning-bg: 43 100% 91%;
  --color-danger-text: 2 70% 41%;
  --color-danger-bg: 0 80% 96%;
  --color-info-text: 201 78% 34%;
  --color-info-bg: 200 88% 95%;
  --color-neutral-text: 215 14% 36%;
  --color-neutral-bg: 215 16% 94%;
  --focus-ring: 200 85% 38%;

  --shadow-card: 0 1px 2px 0 rgb(15 23 42 / 0.06);
  --shadow-card-hover: 0 6px 18px -12px rgb(15 23 42 / 0.18);
  --shadow-elevated: 0 20px 40px -24px rgb(15 23 42 / 0.28);

  --radius: 0.75rem;
  --radius-card: 0.875rem;
  --radius-elevated: 1rem;
  --radius-input: 0.75rem;
  --radius-button: 0.75rem;

  --app-page-gutter-inline: clamp(1rem, 4vw, 1.25rem);
  --app-page-gutter-block: clamp(1rem, 3vw, 1.5rem);
  --dashboard-section-gap: 1.5rem;
  --dashboard-cluster-gap: 0.75rem;

  /* Explicit local remapping so existing utility consumers inherit V2 safely. */
  --background: var(--color-bg);
  --foreground: var(--color-text-primary);
  --card: var(--color-card);
  --card-foreground: var(--color-text-primary);
  --primary: var(--color-primary);
  --primary-foreground: var(--color-primary-fg);
  --muted: var(--color-card-muted);
  --muted-foreground: var(--color-text-muted);
  --border: var(--color-border);
  --input: var(--color-border);
  --accent: var(--color-primary);
}

[data-theme='dark'] [data-visual-contract='v2'] {
  --color-bg: 215 30% 10%;
  --color-card: 215 24% 14%;
  --color-card-muted: 215 18% 12%;
  --color-primary: 200 85% 48%;
  --color-primary-fg: 0 0% 100%;
  --color-text-primary: 210 24% 94%;
  --color-text-secondary: 210 16% 74%;
  --color-text-muted: 210 12% 60%;
  --color-border: 215 18% 26%;
  --color-border-light: 215 16% 21%;
  --color-success-text: 154 64% 67%;
  --color-success-bg: 154 34% 18%;
  --color-warning-text: 42 92% 68%;
  --color-warning-bg: 39 62% 18%;
  --color-danger-text: 2 82% 74%;
  --color-danger-bg: 2 44% 20%;
  --color-info-text: 201 86% 72%;
  --color-info-bg: 201 44% 18%;
  --color-neutral-text: 215 12% 68%;
  --color-neutral-bg: 215 14% 20%;
  --focus-ring: 200 85% 48%;

  --shadow-card: 0 1px 2px 0 rgb(2 6 23 / 0.28);
  --shadow-card-hover: 0 8px 22px -14px rgb(0 0 0 / 0.42);
  --shadow-elevated: 0 24px 48px -24px rgb(0 0 0 / 0.56);

  --background: var(--color-bg);
  --foreground: var(--color-text-primary);
  --card: var(--color-card);
  --card-foreground: var(--color-text-primary);
  --primary: var(--color-primary);
  --primary-foreground: var(--color-primary-fg);
  --muted: var(--color-card-muted);
  --muted-foreground: var(--color-text-muted);
  --border: var(--color-border);
  --input: var(--color-border);
  --accent: var(--color-primary);
}
```

## Adoption notes for Phase 2

- Do not add this selector to production CSS in this task.
- The first implementation PR should wrap only the Dashboard proof subtree.
- Existing components inside the wrapper should inherit the scoped variables before any component API changes are considered.
- Any token that would force non-Dashboard changes must wait for a later approved promotion phase.
