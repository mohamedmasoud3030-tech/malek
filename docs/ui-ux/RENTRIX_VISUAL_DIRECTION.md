# Rentrix Visual Direction v2.0

**Date:** 2026-07-15
**Branch:** `codex/full-polish-foundation-app-shell`
**Status:** Active — supersedes all previous visual direction documents

---

## 1. Design Philosophy

Rentrix is a **professional property management and financial operations tool** used daily by office managers and accountants. The visual design must communicate:

- **Trust** — the numbers are correct
- **Clarity** — what needs attention is immediately obvious
- **Efficiency** — no decoration slows the operator down
- **Cohesion** — every page belongs to the same product

### Guiding Principles

| Principle | Meaning |
|-----------|---------|
| **Enterprise Minimalism** | Every element must earn its place. Remove, don't add. |
| **Swiss Clarity** | Typographic hierarchy alone should convey structure. |
| **Financial Discipline** | Numbers are the most important thing on screen. |
| **Soft Dimensional Layering** | Subtle depth, not heavy shadows. Cards rest on the page, they don't float. |
| **Mobile-First Operations** | Phone use is real. Design for thumbs first. |

### Rejected Aesthetics

- ❌ Heavy glassmorphism (backdrop-blur on everything)
- ❌ Neumorphism / soft UI
- ❌ Cyberpunk / neon accents
- ❌ Heavy gradients in operational screens
- ❌ Marketing-style decorations
- ❌ Excessive shadows (3+ layered shadows)
- ❌ Generic SaaS template look
- ❌ Ant Design clone
- ❌ Bootstrap-era card designs
- ❌ Gradient accent bars on sidebars/headers

---

## 2. Typography

### Font Family

```
Cairo (Google Fonts)
Weights: 400 Regular, 500 Medium, 600 SemiBold, 700 Bold
Arabic-optimized. No fallback changes needed.
```

### Scale

| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `text-page-title` | 1.5rem (24px) | 1.3 | 700 | Page H1 |
| `text-section-title` | 0.9375rem (15px) | 1.4 | 600 | Section headers within pages |
| `text-card-title` | 0.875rem (14px) | 1.4 | 600 | Card headings |
| `text-body` | 0.875rem (14px) | 1.6 | 400 | Body text, descriptions |
| `text-body-sm` | 0.8125rem (13px) | 1.5 | 400 | Secondary body text |
| `text-label` | 0.75rem (12px) | 1.4 | 500 | Labels, field names |
| `text-label-sm` | 0.6875rem (11px) | 1.4 | 500 | Small labels, metadata |
| `text-amount` | 1.25rem (20px) | 1.2 | 700 | Financial amounts (tabular-nums) |
| `text-amount-lg` | 1.75rem (28px) | 1.15 | 700 | Large financial amounts |
| `text-table` | 0.8125rem (13px) | 1.4 | 400 | Table body text |
| `text-table-header` | 0.75rem (12px) | 1.3 | 600 | Table column headers |

### Arabic-Specific Rules

- Minimum line-height for Arabic: 1.5 for body text (prevents diacritic clipping)
- `letter-spacing: 0` — Arabic should never be tracked out
- Page titles at 700 weight, not 900 (black weight is too heavy for Arabic)
- Avoid `tracking-tight` on Arabic body text — it causes letter collision

### Weight Usage

| Weight | Usage |
|--------|-------|
| 700 (Bold) | Page titles, financial amounts, emphasized data |
| 600 (SemiBold) | Section titles, card titles, table headers, buttons |
| 500 (Medium) | Labels, field names, navigation |
| 400 (Regular) | Body text, descriptions, table content |

**No `font-black` (900) in operational UI.** Reserved for the Rentrix logo mark only.

---

## 3. Color System

### Semantic Token Structure

All colors expressed as HSL values for consistent opacity manipulation.

#### Light Mode

| Token | HSL | Usage |
|-------|-----|-------|
| `--color-bg` | `210 20% 98%` | Page background |
| `--color-card` | `0 0% 100%` | Card surfaces |
| `--color-card-muted` | `210 20% 96%` | Secondary card surfaces |
| `--color-primary` | `200 85% 38%` | Primary actions, links |
| `--color-primary-fg` | `0 0% 100%` | Text on primary |
| `--color-text-primary` | `215 28% 17%` | Primary text |
| `--color-text-secondary` | `215 16% 40%` | Secondary text |
| `--color-text-muted` | `215 14% 55%` | Muted/placeholder text |
| `--color-border` | `214 20% 88%` | Default borders |
| `--color-border-light` | `214 20% 92%` | Subtle borders |
| `--color-sidebar-bg` | `215 28% 14%` | Sidebar background |
| `--color-sidebar-text` | `210 20% 85%` | Sidebar text |
| `--color-sidebar-active-bg` | `200 85% 38%` | Active nav item |
| `--color-sidebar-active-text` | `0 0% 100%` | Active nav text |
| `--color-sidebar-hover-bg` | `215 28% 20%` | Hovered nav item |

#### Dark Mode

| Token | HSL | Usage |
|-------|-----|-------|
| `--color-bg` | `215 28% 10%` | Page background |
| `--color-card` | `215 25% 14%` | Card surfaces |
| `--color-card-muted` | `215 20% 12%` | Secondary card surfaces |
| `--color-primary` | `200 85% 48%` | Primary actions, links |
| `--color-primary-fg` | `0 0% 100%` | Text on primary |
| `--color-text-primary` | `210 20% 92%` | Primary text |
| `--color-text-secondary` | `210 14% 70%` | Secondary text |
| `--color-text-muted` | `210 10% 50%` | Muted text |
| `--color-border` | `215 20% 22%` | Default borders |
| `--color-border-light` | `215 16% 18%` | Subtle borders |
| `--color-sidebar-bg` | `215 30% 8%` | Sidebar background |
| `--color-sidebar-text` | `210 20% 80%` | Sidebar text |
| `--color-sidebar-active-bg` | `200 85% 38%` | Active nav item |
| `--color-sidebar-active-text` | `0 0% 100%` | Active nav text |
| `--color-sidebar-hover-bg` | `215 28% 16%` | Hovered nav item |

### Accent (Brand) Color

The primary accent is a **professional cyan-blue**: `hsl(200 85% 38%)` in light, `hsl(200 85% 48%)` in dark. This is the ONLY accent color used for primary actions. No emerald/amber/violet/rose accent colors on KPI cards — KPI cards use the primary accent or neutral tones only.

### Status Colors (Financial + Operational)

| Status | Light Text | Light BG | Dark Text | Dark BG |
|--------|-----------|----------|-----------|---------|
| Success/Paid | `152 66% 26%` | `152 62% 94%` | `152 58% 62%` | `152 40% 16%` |
| Warning/Partial | `32 81% 32%` | `42 96% 92%` | `42 88% 64%` | `38 60% 16%` |
| Danger/Overdue | `0 72% 42%` | `0 72% 95%` | `0 78% 70%` | `0 48% 18%` |
| Info/Draft | `199 74% 32%` | `199 82% 94%` | `199 82% 68%` | `199 46% 16%` |
| Neutral/Void | `215 16% 42%` | `215 18% 92%` | `215 14% 55%` | `215 16% 20%` |

---

## 4. Spacing System

### Base Unit: 4px (Tailwind default)

| Token | Value | Usage |
|-------|-------|-------|
| `space-xs` | 4px (p-1) | Icon padding, tight groups |
| `space-sm` | 8px (p-2) | Compact card content |
| `space-md` | 12px (p-3) | Standard card padding |
| `space-lg` | 16px (p-4) | Page section gap, card internal |
| `space-xl` | 24px (p-6) | Between major page sections |
| `space-2xl` | 32px (p-8) | Page top/bottom breathing room |
| `space-3xl` | 48px | Between unrelated sections |

### Page Layout Spacing

```
Page top padding:    16px mobile, 24px desktop
Section gap:         20px (space-y-5)
Card padding:        16px (p-4)
Card internal gap:   12px
Between card groups: 24px
```

### Content Width

| Breakpoint | Max Width |
|------------|-----------|
| Default pages | `max-w-7xl` (80rem / 1280px) |
| Wide pages (reports) | `max-w-[96rem]` (1536px) |
| Full-width pages | 100% |
| Desktop workspace | Content area ~60-70% of viewport |

---

## 5. Surfaces

### Page Background

- Light: `hsl(210 20% 98%)` — near-white with slight cool tint
- Dark: `hsl(215 28% 10%)` — deep navy-black
- No background patterns, no radial gradients, no decorative elements

### Cards

```
Border: 1px solid var(--color-border-light)
Background: var(--color-card)
Border-radius: 12px (rounded-xl)
Shadow: 0 1px 3px rgba(0,0,0,0.04)
```

Cards should feel like they **rest on** the page, not float above it. Single subtle shadow only. No hover scale transform on operational cards.

### Elevated Surfaces (Dialogs, Dropdowns)

```
Border: 1px solid var(--color-border)
Border-radius: 14px (rounded-2xl)
Shadow: 0 8px 32px rgba(0,0,0,0.12)
```

### Sidebar

```
Background: solid dark color (no gradient)
Border: 1px solid on right edge only
Width: 256px expanded / 72px collapsed
No gradient accent bar at top
```

### Page Header

The page header is NOT a card. It's a flat section at the top of the content area:

```
Background: transparent
Border-bottom: 1px solid var(--color-border-light) (optional, only when sticky)
Padding: 0 0 16px 0
```

### Sticky Header (App Shell)

```
Background: var(--color-bg) with 0.85 opacity
Backdrop blur: 8px
Border-bottom: 1px solid var(--color-border-light)
```

---

## 6. Components — Visual Specification

### Buttons

| Variant | Background | Text | Border | Hover |
|---------|-----------|------|--------|-------|
| Primary | `--color-primary` | `--color-primary-fg` | none | Darken 8% |
| Secondary | `--color-card-muted` | `--color-text-primary` | `--color-border-light` | Darken 4% |
| Ghost | transparent | `--color-text-secondary` | none | `--color-card-muted` |
| Destructive | `hsl(0 72% 42%)` | white | none | Darken 8% |

Border-radius: 10px (rounded-lg)
Height: 40px (h-10) default, 36px (h-9) compact
Font: 600 weight, 13px

### Form Inputs

```
Border: 1px solid var(--color-border)
Border-radius: 10px
Background: var(--color-card)
Height: 40px
Focus: border-color → var(--color-primary), ring-2 ring-primary/15
```

### Tables

```
Header: bg-muted/40, text-xs, font-semibold, uppercase tracking
Row: border-b border-border-light
Row hover: bg-muted/20
Row height: 44px (for touch targets)
Cell padding: 12px 16px
No alternating row colors (clean Swiss approach)
```

### KPI Cards

```
Border: 1px solid var(--color-border-light)
Background: var(--color-card)
Border-radius: 12px
Padding: 16px
Shadow: 0 1px 3px rgba(0,0,0,0.04)
No hover transform (operational UI, not marketing)
Icon: 40px rounded square, primary bg, white icon
Value: text-2xl, font-bold, tabular-nums
Label: text-xs, text-muted-foreground
```

### Status Badges

```
Border-radius: 9999px (full pill)
Padding: 3px 10px
Font: 11px, 600 weight
Ring: 1px inset
Dot: 6px circle (optional prefix)
```

### Page Shell

The default page structure:

```
┌─ PageHeader ──────────────────────────────────┐
│ Title                    [Primary Action]      │
│ Description (optional)   [Secondary Actions]   │
├─ FilterBar (optional) ─────────────────────────┤
│ [Filter 1] [Filter 2] [Filter 3]    [Search]  │
├─ ActiveFilterBar (conditional) ────────────────┤
│ Tag ×  Tag ×  Tag ×         [Clear All]       │
├─ KPI Row (optional) ──────────────────────────┤
│ [KPI] [KPI] [KPI] [KPI]                       │
├─ Content Area ────────────────────────────────┤
│ Table / Cards / Form / Detail                  │
└────────────────────────────────────────────────┘
```

---

## 7. Financial States — Visual Contract

| State | Badge Tone | Text Prefix | Additional Indicator |
|-------|-----------|-------------|---------------------|
| Paid | success | ✓ | Green left-border on row |
| Partial | warning | ◐ | Amber left-border |
| Overdue | danger | ⚠ | Red left-border + bold amount |
| Void | neutral | ∅ | Strikethrough text, muted |
| Draft | info | ○ | Dashed border on card |
| Posted | success | ✓ | Solid |
| Inflow | success text | + | Green amount |
| Outflow | danger text | − | Red amount |
| Settled | success | ✓ | Checkmark |
| Outstanding | warning | ◐ | Amber highlight |
| Warning | warning | ⚠ | Amber background strip |
| Blocked | danger | ⊗ | Red, disabled interactions |

**Rule:** Color is NEVER the sole indicator. Every state has: color + icon + text label.

---

## 8. Responsive Behavior

### Breakpoints

| Name | Width | Behavior |
|------|-------|----------|
| Mobile | < 640px | Single column, bottom nav, full-width cards |
| Tablet | 640-1023px | Single column, side nav collapsed |
| Desktop | ≥ 1024px | Sidebar visible, multi-column where applicable |

### Mobile Rules

- Tables → Card lists
- Page padding: 12px
- Touch targets: ≥ 44px
- Sticky actions at bottom
- Bottom nav visible
- Filters in bottom sheet or collapsible header
- Forms in bottom sheets

### Desktop Rules

- Tables with full columns
- Sidebar always visible
- 2-3 column layouts for dashboards
- Filters in top bar, always visible
- Forms in dialogs (not bottom sheets)

---

## 9. Dark Mode

Both light and dark modes must be **equal quality**. No "light-first, dark-later" approach.

### Dark Mode Specifics

- Background: deep navy-black (not pure black, not grey)
- Cards: slightly lighter than background (2-4% difference)
- Text: off-white, never pure white
- Borders: subtle, visible on close inspection
- All status colors have dark-specific HSL values (already defined above)
- Form inputs: slightly lighter than card background

---

## 10. RTL (Arabic)

- `direction: rtl` on `<html>`
- Sidebar on the right
- Content flows right-to-left
- Icons: use `rtl:rotate-180` on directional arrows
- Numbers and amounts: `dir="ltr"` wrapper
- All UI text in Arabic
- Left/right padding uses `ps`/`pe` (start/end) not `pl`/`pr`

---

## 11. Implementation Priority

1. CSS tokens update (globals.css)
2. AppShell redesign (remove gradients, clean structure)
3. PageHeader → flat design
4. PageLayout spacing refinement
5. Card surface refinement
6. SectionHeader consistency
7. KpiCard simplification
8. StatusBadge audit
9. Empty/Loading/Error states
10. Mobile navigation polish
11. Dark mode verification
12. Final visual regression

---

## UI UX Pro Max Query Log

### Q1: Design System Baseline
**Query:** `"arabic RTL property management financial dashboard enterprise minimal swiss clarity" --design-system`
**Output:** Minimal Single Column pattern, Trust & Authority style, Inter font (rejected — Cairo is correct), Dark bg palette
**Recommendation:** Adopt Trust & Authority principles, reject Inter font, adapt color palette for Arabic RTL
**Decision:** Keep Cairo, adopt Swiss clarity principles, use the refined token system above
**Impact:** Foundation for all subsequent visual decisions

### Q2: Financial Data Display
**Query:** `"financial data table invoice receipt accounting clean density" --domain style`
**Output:** Financial Dashboard style with profit/loss coloring, Data-Dense Dashboard for KPI grids
**Recommendation:** Use Financial Dashboard patterns for tables, adopt clean density
**Decision:** Apply financial coloring to receipt/invoice tables, KPI cards use minimal accent
**Impact:** All financial screens

### Q3: KPI Presentation
**Query:** `"dashboard KPI cards soft dimensional layering professional" --domain chart`
**Output:** Bullet charts for multi-KPI, Gauge for single metric
**Recommendation:** KPI cards with compact value display, no charts inside KPI cards
**Decision:** Keep current KpiCard structure, simplify accent colors to primary only
**Impact:** Dashboard and all KPI grids

### Q4: Mobile UX
**Query:** `"mobile first RTL Arabic responsive layout touch targets" --domain ux`
**Output:** Touch-friendly targets, 8px gap between touch targets, mobile-first breakpoints
**Recommendation:** 44px touch targets, mobile-first CSS, adequate touch spacing
**Decision:** Audit all interactive elements for 44px minimum, enforce 8px+ gap
**Impact:** Mobile navigation and all touch interactions

### Q5: Dark Mode
**Query:** `"dark mode semantic tokens WCAG AAA contrast" --domain style`
**Output:** WCAG AAA (7:1+), Accessible & Ethical style, OLED-optimized dark
**Recommendation:** 7:1+ contrast, visible focus rings, semantic tokens
**Decision:** Maintain current token structure with refined HSL values for better contrast
**Impact:** Dark mode across entire application

### Q6: Enterprise Data Tables
**Query:** `"enterprise fintech table list dense data" --domain ux`
**Output:** Horizontal scroll for tables, multi-select with checkbox column
**Recommendation:** Use horizontal scroll wrapper, consider bulk actions
**Decision:** All tables get overflow-x-auto wrapper, row height at 44px for touch
**Impact:** All list/table pages
