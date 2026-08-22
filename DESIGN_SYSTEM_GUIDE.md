# MALEK Design System Guide

Status: Active implementation contract  
Scope: `rentrix-app` frontend  
Last reviewed: 2026-08-21  
Backend/database: out of scope

## 1. Product visual direction

MALEK is an operational property-management workspace. The interface should feel calm, dependable, dense enough for daily work, and unmistakably Arabic-first. The strongest existing direction is:

- Enterprise minimalism with Swiss clarity.
- Dark navy navigation and neutral document-like work surfaces.
- Royal blue as the single primary action color.
- Semantic status colors used for meaning, never as decoration.
- Cairo for Arabic and general UI text; Sora only for selected Latin/product display text.
- Low-contrast borders and restrained elevation. No decorative gradients, glass effects, hover scale, or neon treatment in operational screens.

This guide consolidates the existing direction; it is not a wholesale redesign.

## 2. Source of truth

| Concern | Canonical source |
| --- | --- |
| Semantic colors, radius, shadows, spacing, motion, z-index | `src/styles/tokens.css` |
| Base reset, RTL, print, reduced motion | `src/styles/globals.css` |
| Shared operational CSS contracts | `src/styles/ux-foundation.css` and `src/styles/app-density-contract.css` |
| Approved visual-wave overrides | `src/styles/malek-pro-visual-wave.css` |
| Buttons | `src/components/ui/button.tsx` |
| Cards | `src/components/ui/card.tsx` |
| Inputs and text fields | `src/components/ui/input.tsx`, `text-field.tsx` |
| Tables | `src/components/ui/table.tsx`, `entity-table.tsx`, `data-table.tsx` |
| Dialogs and drawers | `src/components/ui/dialog.tsx`, `modal.tsx`, `drawer.tsx` |
| Page/list scaffolds | `src/components/layout/page-layout.tsx`, `list-page.tsx`, `embeddable-workspace.tsx` |
| Fonts and language direction | `public/fonts/fonts.css`, `src/lib/product-fonts.ts`, `src/lib/i18n.ts` |

Do not add a competing token file or local replacement for any of these concerns.

## 3. Token contract

### Color

Use semantic tokens, not raw colors:

- Page: `bg-background text-foreground`
- Surface: `bg-card text-card-foreground`
- Secondary surface: `bg-muted`
- Primary action: `bg-primary text-primary-foreground`
- Secondary action: `bg-secondary text-secondary-foreground`
- Quiet action: `hover:bg-muted text-foreground`
- Border: `border-border` or `border-input`
- Muted text: `text-muted-foreground`
- Success, warning, danger, info: semantic tokens only.

The primary blue is reserved for the next meaningful action, active navigation, focus, links, and selected states. Do not use it for every icon or decorative accent.

### Typography

- Body/UI: Cairo, 14px default desktop control text, 16px mobile form text.
- Page title: bold, compact, one clear level above section titles.
- Section title: semibold; do not use all caps.
- Supporting copy: muted foreground with a readable line height.
- Numeric money/date values: preserve the existing formatter contracts and Latin numeral policy.
- Never encode hierarchy with font size alone; combine weight, spacing, and surface grouping.

### Spacing

Use the 4px scale from `tokens.css`: 1, 2, 3, 4, 5, 6, 8, 10, 12, 16. Prefer existing scaffold spacing:

- Page sections: 12–24px.
- Card header/content: 16px, 20px at larger widths.
- Control gaps: 6–12px.
- Table cells: compact mode only when the table remains scannable.
- Mobile bottom overlays must respect safe-area insets.

### Radius and elevation

- Controls: `rounded-lg` or `rounded-xl` according to their primitive.
- Cards: `rounded-xl`.
- Dialogs/sheets: `rounded-2xl`.
- Pills/status badges: full radius.
- Default cards use the subtle `shadow-card`; elevated surfaces use `shadow-elevated`.
- No transform scale on operational cards or buttons.

### Motion

Use the existing 120/180/240ms durations and standard easing. Motion must communicate state or hierarchy. Every new animation must support `prefers-reduced-motion: reduce`.

## 4. Component inventory and variants

### Actions

Use `Button` for all standard actions. Variants:

- `primary`: one main action per region.
- `secondary`: lower-priority action with visible surface.
- `outline`: alternative action requiring separation.
- `ghost`: low-emphasis utility.
- `soft`: contextual, non-destructive emphasis.
- `danger` / `destructive`: irreversible or destructive actions.
- `link`: inline navigation only.

All interactive sizes retain the 44px touch target. Use `IconButton` for icon-only actions and provide an accessible label.

### Surfaces

Use `Card` and its subcomponents for grouped content. Prefer `default`, `muted`, `elevated`, `interactive`, `statistic`, and `financial` only when their meaning is clear. Do not create one-off card shells in feature files.

### Forms

Use `TextField`/`FormField` for label, help, error, and required-state behavior. Use `Input`, `Select`, and `Textarea` as primitives. Errors must be text plus semantic styling; color alone is insufficient.

### Data

Use `EntityTable` for entity registers and `DataTable` for general tabular data. Use `TableEmpty`, `TableLoading`, and `TableError` instead of custom state rows. Every viewport renders the same table; on narrow screens the grid stays a real table and scrolls horizontally. Do not convert tabular registers into mobile cards.

### Overlays

Use `Dialog` for modal workflows and `Drawer`/bottom sheet for contextual mobile workflows. Keep focus restoration, `aria-modal`, Escape behavior, and safe-area padding intact. Do not introduce a second overlay implementation.

### States

Every data surface must account for loading, empty, error, permission denied, disabled, and success/confirmation states. Preserve layout dimensions with skeletons and reserved action areas to avoid layout shift.

## 5. Responsive and RTL rules

- RTL is the default document direction; use logical properties and Tailwind `start/end`, `ms/me`, and `inset-inline`.
- Do not hard-code left/right for navigation, borders, icons, or action order unless the content is intentionally LTR (dates, codes, URLs).
- Mobile is a first-class operating mode of the same system: controls remain tappable, tables stay tables with horizontal overflow, and fixed docks reserve content space.
- At zoom 200%, content must remain readable without horizontal page overflow; local horizontal scrolling is acceptable for wide data tables.
- Avoid fixed heights for text-bearing surfaces.
- Preserve focus visibility on keyboard navigation and never remove outlines without a replacement.

## 6. Accessibility contract

- Minimum target: 44×44px.
- Visible focus ring for every keyboard-operable element.
- Contrast target: WCAG AA for text and controls.
- Status meaning must include text, icon, or label; never color alone.
- Dialogs must announce title/description and restore focus to the opener.
- Loading states use `role=status`; errors use `role=alert` where appropriate.
- Respect reduced motion and forced-colors/user contrast settings.
- Images and logos must preserve aspect ratio; decorative assets are hidden from assistive technology.

## 7. Migration priorities

### P0 — foundation (implemented/locked)

- Keep `tokens.css` as the only semantic token source.
- Keep shared CSS imports explicit and ordered from reset → tokens → foundation → feature polish.
- Keep Button/Card/Input/Table/Dialog as the approved primitive set.
- Prevent new raw hex/HSL values in operational feature components.
- Keep page/list scaffolds as the default entry point.

### P1 — high-impact screens

Migrate in this order, one screen at a time:

1. Dashboard/today workspace: KPI hierarchy, action rail, attention states.
2. Entity registers: properties, units, tenants, owners, contracts, invoices, receipts.
3. Financial workspace and reports: filters, tables, amount hierarchy, print actions.
4. Detail pages: identity header, grouped fields, documents, timeline, next actions.
5. Settings and system screens: form density, section rhythm, destructive action separation.
6. Auth and public pages: preserve brand but keep their visual tokens scoped.

### P2 — cleanup

- Replace feature-local button/card/table shells with shared primitives.
- Remove one-off spacing/radius/shadow utilities after migration.
- Delete obsolete visual-wave selectors only after their consumers are migrated.
- Add visual contracts for every new primitive and high-impact screen.

## 8. Review checklist

Before merging a visual change:

- Is the visual decision represented by an existing token or primitive?
- Is there exactly one primary action in the region?
- Does the screen work in Arabic RTL and at mobile widths?
- Are loading, empty, error, disabled, focus, and reduced-motion states covered?
- Does the change preserve data semantics and backend boundaries?
- Did the diff avoid raw colors, arbitrary shadows, and duplicate components?
- Were typecheck, build, relevant tests, and an accessibility/visual check run?

## 9. Current known risks

- Several historical style layers coexist; treat `malek-pro-visual-wave.css` and `page-polish.css` as migration layers, not new sources of truth.
- The project contains multiple table/card abstractions for compatibility. New work must use the canonical primitives above.
- Landing-page tokens are intentionally scoped and must not leak into the authenticated workspace.
- Visual verification requires a running app and seeded demo data; CI checks can prove contracts but cannot replace rendered review.
