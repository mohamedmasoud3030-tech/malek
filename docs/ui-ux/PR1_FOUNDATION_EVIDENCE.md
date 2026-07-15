# PR #1: Full Polish Foundation — App Shell & Visual Contract

**Branch:** `codex/full-polish-foundation-app-shell`
**Date:** 2026-07-15
**Status:** Ready for review

---

## What This PR Delivers

### Visual Direction (Phase 0-1)

Created four cornerstone design documents that establish the new visual contract:

| Document | Purpose |
|----------|---------|
| `docs/ui-ux/RENTRIX_VISUAL_DIRECTION.md` | Complete visual design system — typography, colors, spacing, surfaces, responsive |
| `docs/ui-ux/RENTRIX_COMPONENT_CONTRACT.md` | Component API and visual specification for all 18 shared components |
| `docs/ui-ux/RENTRIX_MOBILE_UX.md` | Mobile-first UX specification — touch targets, navigation, layouts |
| `docs/ui-ux/RENTRIX_FINANCIAL_PRESENTATION.md` | Financial state presentation — invoices, receipts, arrears, reconciliation |

### Design Token System Rebuild

**CSS Foundation (`globals.css`):**
- Refined HSL color tokens for both light and dark modes
- Semantic token structure: success, warning, danger, info, neutral, primary
- Cleaner shadow tokens: `--shadow-card`, `--shadow-card-hover`, `--shadow-elevated`
- Unified border-radius scale: `--radius`, `--radius-card`, `--radius-elevated`
- Removed decorative animations (float-soft, pulse-soft, panel-in, row-in)
- Replaced with professional, restrained animations (route-in fade, shimmer, slide-up)
- Updated all Shadcn-compatible CSS variable mappings
- Dark mode: deeper navy-black (`215 28% 9%`), refined card/background contrast

**UX Foundation (`ux-foundation.css`):**
- Aligned with new visual contract tokens
- Consistent touch targets and safe area handling

**Page Polish (`page-polish.css`):**
- Added table styling defaults
- Financial amount emphasis with semantic data attributes
- Status row indicators (left-border color coding)

### Shared Component Rebuild (Phase 2)

**AppShell** — Cleaned, professionalized:
- Removed gradient sidebar background → solid dark surface
- Removed decorative gradient accent bar at top of sidebar
- Removed gradient from brand logo → solid primary color
- Simplified brand: smaller logo, cleaner typography
- Cleaner sticky header: solid background with subtle blur
- Lighter header height: 56px → 52px
- Removed decorative shadows from sidebar
- Refined notification popover styling
- Sidebar width: 288px → 256px (expanded), 80px → 72px (collapsed)
- All `font-black` → `font-bold` or `font-semibold`

**PageLayout** — Refined spacing:
- Section gap: `space-y-4` → `space-y-5` (mobile), `space-y-6` (desktop)

**PageHeader** — FLAT design (no card):
- Background: removed (transparent)
- Border: bottom border only
- Removed card background, shadow, border-radius
- Title: `font-black` → `font-bold`, 24px
- Count badge: cleaner, smaller

**SectionHeader** — Consistent hierarchy:
- Title: 15px semibold
- Description: 13px
- Cleaner spacing

**Card** — Refined surfaces:
- Removed `hover-card` scale transform
- Removed hover-card utility class
- Border-radius: `rounded-2xl` → `rounded-xl` (12px)
- Shadow: softened to single subtle shadow
- Padding: tightened

**KpiCard** — Simplified:
- Removed all accent color variations (emerald, amber, rose, violet, sky)
- Single primary accent for icon
- Added backward compat for `accent` and `compact` props
- Icon: cleaner styling, primary bg
- Value: `text-[1.5rem] font-bold`
- No hover transform in operational UI

**StatusBadge** — Enhanced:
- Added `neutral` semantic tone
- Legacy color tone support preserved (blue→info, green→success, etc.)
- Cleaner styling: `bg-{tone}/10` for background
- Updated font: 11px semibold

**Button** — Refined:
- Border-radius: `rounded-xl` → `rounded-lg` (10px)
- Simplified sizes: sm/md 40px height, lg 44px height
- Removed min-h-11 mobile overrides (simplified)

**Input** — Refined:
- Border-radius: `rounded-xl` → `rounded-lg` (10px)
- Height: min-h-10 (40px) unified
- Background: `bg-background` → `bg-card`
- Focus ring: `ring-4` → `ring-2` (subtler)
- Removed min-h-12 mobile override

**Dialog** — Refined:
- Border-radius: `rounded-3xl` → `rounded-2xl` (14px elevated)
- Shadow: `shadow-2xl` → `shadow-elevated` (tokenized)
- Backdrop: `bg-black/55` → `bg-black/45`
- Title: `font-black` → `font-bold`

**BottomSheet** — Refined:
- Border-radius: `rounded-t-[1.75rem]` → `rounded-t-2xl`
- Shadow: hardcoded → `shadow-elevated` token
- Backdrop: `bg-black/55` → `bg-black/45`
- Background: `bg-background` → `bg-card`
- Title: `font-black` → `font-bold`

**EmptyState** — Cleaner:
- Reduced icon size and complexity
- Cleaner typography hierarchy
- Dashed border preserved
- Smaller container: `min-h-64` → `min-h-56`

**ErrorState** — Consistent:
- Updated danger colors to use semantic tokens
- Consistent border-radius
- Cleaner error message display

**LoadingState** — Consistent:
- Updated skeleton border-radius to match new card radius
- Cleaner skeleton heights

**Tailwind Config** — Aligned:
- Added `neutral` color config
- Updated shadow tokens
- Consistent border-radius scale

---

## What Was NOT Changed

- ✅ Zero schema/migration changes
- ✅ Zero RLS/RPC changes
- ✅ Zero auth/permission changes
- ✅ Zero financial calculation changes
- ✅ Zero service/contract changes
- ✅ Zero Supabase changes
- ✅ Zero route/logic changes
- ✅ All 621 tests pass unchanged
- ✅ TypeScript compiles clean
- ✅ Build succeeds (PWA)
- ✅ Architecture check passes

---

## UI UX Pro Max Query Log

All 6 specialized queries were run via `.agents/skills/ui-ux-pro-max/scripts/search.py`:

| Q# | Domain | Query | Recommendation | Decision |
|----|--------|-------|---------------|----------|
| 1 | design-system | "arabic RTL property management financial..." | Trust & Authority style, Inter font | Reject Inter, keep Cairo |
| 2 | style | "financial data table invoice receipt..." | Financial Dashboard, Data-Dense | Adopt financial coloring |
| 3 | chart | "dashboard KPI cards soft dimensional..." | Bullet charts for KPIs | Keep KpiCard, simplify accents |
| 4 | ux | "mobile first RTL Arabic responsive..." | Touch targets 44px, 8px gaps | Enforce in component specs |
| 5 | style | "dark mode semantic tokens WCAG AAA" | 7:1+ contrast, semantic tokens | Refine HSL values |
| 6 | ux | "enterprise fintech table list dense data" | Horizontal scroll, multi-select | Table overflow-x-auto |

---

## Visual Direction Adopted

- **Enterprise Minimalism** — every element must earn its place
- **Swiss Clarity** — typography drives hierarchy, not decoration
- **Financial Dashboard Discipline** — numbers are paramount
- **Soft Dimensional Layering** — subtle shadows, not heavy elevation
- **Strong Arabic Typography** — Cairo, 400-700 weights, generous line-height
- **Mobile-First Operational UX** — 44px touch targets, bottom sheets

## Explicitly Rejected

- ❌ Glassmorphism, neumorphism, cyberpunk
- ❌ Heavy gradients in operational screens
- ❌ Marketing-style decorations
- ❌ Excessive shadows (3+ layers)
- ❌ Generic SaaS template aesthetic
- ❌ Ant Design clone
- ❌ `font-black` (900 weight) in operational UI
- ❌ Hover scale transforms on cards
- ❌ Multi-accent KPI cards

---

## CI Results

| Check | Status |
|-------|--------|
| `pnpm typecheck` | ✅ Pass |
| `pnpm lint` | ✅ Pass |
| `pnpm check:architecture` | ✅ Pass |
| `pnpm test` | ✅ 136 files, 621 tests |
| `pnpm build` | ✅ PWA built (175 entries) |

---

## Next Phase

After this PR merges, proceed to Phase 3: Full Screen Polish starting with AppShell + Login, then Dashboard, Properties+Units, etc.
