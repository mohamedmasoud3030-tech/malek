# MALEK Design System Guide

Status: Active implementation contract  
Scope: `rentrix-app` frontend  
Last reviewed: 2026-08-27  
Backend/database: out of scope

> **Precedence.** This guide holds the *durable* design principles: tokens,
> semantic colour, typography, spacing, RTL, accessibility and the approved
> primitive set. **Current `main` is the source of truth for shipped product
> behaviour and composition.** Where this guide describes an older
> implementation-specific pattern that a later merged UX decision replaced, the
> shipped behaviour wins and this guide is updated to match — never the reverse.
>
> The canonical UX/IA contract is
> `docs/source-of-truth/06_UX_IA_AND_DESIGN_CONTRACT.md`. When a rule here and a
> regression test on `main` disagree, preserve the implementation and reconcile
> this document.
>
> Superseded sections are listed in §10 so nobody re-applies them by accident.

## 1. Product visual direction

MALEK is an operational property-management workspace. The interface should feel calm, dependable, dense enough for daily work, and unmistakably Arabic-first. The strongest existing direction is:

- Enterprise minimalism with Swiss clarity.
- Dark navy navigation and neutral document-like work surfaces.
- Deep navy (`222 68% 28%`) as the single primary action color, with a
  restrained gold (`38 88% 55%`) accent — the shipped "premium Navy + Gold"
  identity, not the earlier royal-blue direction.
- Semantic status colors used for meaning, never as decoration.
- Cairo for Arabic and general UI text; Sora only for selected Latin/product display text.
- Low-contrast borders and restrained elevation. The approved `premium-glass`
  surface system (frosted light surfaces, deep-navy glass in dark mode) is the
  current chrome; blur is budgeted — cards stay blur-free and only
  chrome/overlays pay for it. No hover scale on operational cards or buttons,
  and no animated sheen.

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
- **Money: one presentation, everywhere.** Every monetary value renders through
  `formatCompanyMoney(settings, value)` (or `formatMoney`), which produces the
  number followed by the currency code at the currency's real minor unit —
  `1,234.500 OMR` for the default Omani Rial. Not `OMR 1,234.500`, not
  `1234.500 ر.ع.`, and never a hand-rolled `toFixed(3)` plus a literal.
  `lib/money-contract-guard.test.ts` fails the build on `toFixed(3)` in a `.tsx`
  render surface and on hand-written currency text in a component file.
  Counts are not money: they use `formatCount` from `lib/formatters.ts`, which
  shares the same locale/numeral policy.
- Numeric date values use `formatCompanyDate` / `formatCompanyDateTime` so the
  company locale and timezone are respected. Do not call `toLocaleString` with a
  hard-coded locale in a screen.
- Latin numeral policy is enforced inside the formatters (`-u-nu-latn`); screens
  must not re-implement it.
- Never encode hierarchy with font size alone; combine weight, spacing, and surface grouping.

### Spacing

Use the 4px scale from `tokens.css`: 1, 2, 3, 4, 5, 6, 8, 10, 12, 16. Prefer existing scaffold spacing:

- Page sections: 12–24px.
- Card header and card content share one box: 12px on phone, 16px from `sm`.
  The header must not be inset differently from the body, or a card title stops
  aligning with the copy beneath it. `Card variant="compact"` overrides this
  through the `[data-card-header]` / `[data-card-content]` hooks.
- Control gaps: 6–12px.
- Table cells: compact mode only when the table remains scannable.
- Mobile bottom overlays must respect safe-area insets, and must derive their
  offset from `--mobile-dock-clearance` rather than hard-coding a distance above
  the phone dock. Sticky elements under the app-shell header offset by
  `--app-header-height`. Both live in `styles/ux-foundation.css`.

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

Use `EntityTable` for entity registers and `DataTable` for general tabular data. Use the shared empty/loading/error surfaces instead of custom state rows.

Register presentation is breakpoint-driven, per the canonical UX contract:

- **≥ 768px** — a dense semantic table. Every viewport at this width renders the
  same table; it scrolls horizontally rather than degrading into cards.
- **< 768px** — a true mobile register presentation: each record shows identity,
  one meaningful primary/secondary datum (status/amount/date), and a compact
  accessible «إجراءات» menu containing only that record's existing actions.

Mobile registers never use horizontal scrolling, clipped labels, overlapping RTL
text, disclosure/expansion rows, sticky action columns, or bulk expand-all
controls. Registers without an explicit mobile summary fall back to their first
two useful loaded fields.

> **Supersedes** the earlier "every viewport renders the same table; do not
> convert tabular registers into mobile cards" rule, which the shipped mobile
> shell replaced. See §10.

### Overlays

Use `Dialog` for modal workflows and `Drawer`/bottom sheet for contextual mobile workflows. Keep focus restoration, `aria-modal`, Escape behavior, and safe-area padding intact. Do not introduce a second overlay implementation.

### States

Every data surface must account for loading, empty, error, permission denied, disabled, and success/confirmation states. Preserve layout dimensions with skeletons and reserved action areas to avoid layout shift.

Use the shared surfaces — `EmptyState`, `ErrorState`, `OfflineState`,
`NoPermissionState`, `LoadingState` — and never invent a per-screen variant. They
share one visual contract so an empty register and an empty dossier look like the
same product:

- icon chip `size-10` / `rounded-lg`, semantic tone for error and permission, muted for empty
- title `text-base font-semibold`
- description `text-[0.8125rem]` (13px) with `leading-6` — small helper text must
  not drop below this to gain density
- container `px-4 py-5`, `min-h-28`, content centred
- loading uses `LoadingState` skeletons with `role="status"`; errors use `role="alert"`

## 5. Responsive and RTL rules

- RTL is the default document direction, **but the product is bilingual**: `lib/i18n.ts`
  sets `document.documentElement.dir` for `ar` (RTL) and `en` (LTR). Treat every
  direction-sensitive choice as needing to work in both.
- Use logical properties and Tailwind `start/end`, `ms/me`, `inset-inline`,
  `text-start`, `ps/pe`. Do not use `text-left` / `text-right`, `ml/mr`, `pl/pr`,
  or physical `border-l/r` for layout.
- **Do not hard-code a `dir` attribute on a component that is not portalled** —
  it already inherits the document direction, and pinning `dir="rtl"` mirrors the
  surface when the product runs in English. Portalled surfaces (Radix
  dialogs/drawers, `createPortal` menus) render onto `document.body` outside the
  app's direction context, so they *do* need an explicit `dir`.
- `text-right` paired with `dir="ltr"` on phone/email/number cells is the
  deliberate exception: it aligns intentionally-LTR content to the start edge of
  an RTL table. Keep it.
- Desktop (≥ 1024px) uses a **fixed, always-visible, named** right-side sidebar
  (`w-64`, content offset by `lg:pr-64`). It does not collapse into an unnamed
  icon rail. Tablet (768–1023px) is a first-class band, not a stretched phone.
- Phone (< 768px) has no destination-style bottom navigation. One floating
  utility dock provides Menu, Search, Quick Add, Notifications and AI; it hides
  while the drawer is open, respects safe-area insets, and keeps 44px targets.
- Mobile is a first-class operating mode of the same system: controls remain
  tappable, registers use the mobile card presentation below 768px (see §4), and
  fixed docks reserve content space through `--mobile-dock-clearance`.
- At zoom 200%, content must remain readable without horizontal page overflow; local horizontal scrolling is acceptable for wide data tables.
- Avoid fixed heights for text-bearing surfaces.
- Preserve focus visibility on keyboard navigation and never remove outlines without a replacement.

## 6. Accessibility contract

- Minimum target: 44×44px. This applies to **raw** `<button>`, `<a>` and `<Link>`
  elements as well as `<Button>`; `touch-target-floor.test.ts` guards all of
  them, including `size-*` utilities. A visually smaller control is acceptable
  only when it is centred inside an explicit 44px hit wrapper, and that wrapper
  must be listed in the guard's allowlist with a reason. Stacked full-width list
  rows may use `min-h-10` under the WCAG 2.5.5 spacing exception.
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

## 10. Superseded by shipped product decisions

Recorded so these are not re-applied from an older reading of this guide. In
every case the shipped implementation on `main` is authoritative.

| Earlier guidance here | Shipped decision that replaced it | Evidence |
| --- | --- | --- |
| "Every viewport renders the same table; do not convert tabular registers into mobile cards." | Registers render a dense table at ≥ 768px and a true mobile card presentation below 768px, with a compact «إجراءات» menu per record. | `06_UX_IA_AND_DESIGN_CONTRACT.md`; `components/ui/mobile-card.tsx`; `entity-table-mobile-summary.test.ts` |
| "Royal blue as the single primary action color." | Deep navy primary with a restrained gold accent. | `styles/tokens.css` (`--color-primary: 222 68% 28%`, `--accent: 38 88% 55%`) |
| "No decorative gradients, glass effects … in operational screens." | The `premium-glass` surface system is the approved chrome, with a blur budget that keeps cards blur-free. | `styles/premium-glass.css`; `premium-glass-design-contract.test.ts` |
| "Desktop uses a right-side collapsible sidebar." | The desktop sidebar is fixed, always visible and named; it never becomes an unnamed icon rail. | `app/layout/app-shell.tsx` (`fixed … w-64 … lg:flex`, `lg:pr-64`); `desktop-shell-contract.test.ts` |
| Card header inset 8px against 12px body inset. | Header and content share one box (12px phone / 16px `sm`) so titles align with body copy. | `components/ui/card.tsx` |
| Per-register `new Intl.NumberFormat('en-US')` count helpers. | One canonical `formatCount` in `lib/formatters.ts`. | `lib/formatters.test.ts` |

