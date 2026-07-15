# Rentrix Component Contract v2.0

**Date:** 2026-07-15
**Status:** Active — component-level visual and behavioral specification

---

## Component API & Visual Contract

### 1. AppShell

**Purpose:** Application chrome — sidebar, header, main content area, mobile nav.

**Visual Contract:**
- Sidebar: solid dark background, no gradient, 256px expanded / 72px collapsed
- Header: 56px height, sticky, backdrop-blur, subtle bottom border
- Main content: fills remaining space, horizontal constraint
- Mobile: bottom nav bar, drawer navigation
- Top accent bar: REMOVED (gradient bar at sidebar top)

**Props:** None (reads auth/store/route state internally)

**States:**
- Sidebar expanded (desktop)
- Sidebar collapsed (desktop)
- Mobile drawer open
- Mobile drawer closed
- Notifications open/closed
- Loading (user/auth not yet resolved)
- Error (auth failed)

---

### 2. PageLayout

**Purpose:** Consistent content wrapper for every feature page.

**Visual Contract:**
- Max-width constrained (default: 80rem)
- Horizontal padding: 16px mobile, 24px desktop
- Vertical rhythm: children spaced with consistent gap
- No background, no border, no shadow — pure layout container

**Props:**
```ts
interface PageLayoutProps {
  children: ReactNode;
  size?: 'default' | 'wide' | 'full';
  className?: string;
}
```

**Usage Rule:** Every page MUST wrap content in `<PageLayout>`. No page should set its own max-width or page-level padding.

---

### 3. PageHeader

**Purpose:** Page title, description, primary action, secondary actions.

**Visual Contract (NEW — flat design):**
- Background: transparent (not a card)
- Bottom border: 1px solid var(--color-border-light) (optional)
- Padding: 0 0 16px 0
- Title: 24px, 700 weight, text-primary
- Description: 14px, 400 weight, text-secondary
- Actions: aligned to the end (left in RTL)

**Props:**
```ts
interface PageHeaderProps {
  title: string;
  description?: string;
  count?: number | string;
  backTo?: string;
  backLabel?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
}
```

**States:**
- With description
- Without description
- With primary action
- Without primary action
- With count badge
- With back button
- All combinations

---

### 4. SectionHeader

**Purpose:** Section title within a page or card.

**Visual Contract:**
- Title: 15px, 600 weight, text-primary
- Description: 13px, 400 weight, text-secondary
- Action: aligned end, 13px, 600 weight, text-primary
- Bottom margin: 12px

**Props:**
```ts
interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}
```

---

### 5. Card

**Purpose:** Content container for grouping related information.

**Visual Contract:**
- Background: var(--color-card)
- Border: 1px solid var(--color-border-light)
- Border-radius: 12px
- Shadow: 0 1px 3px rgba(0,0,0,0.04)
- No hover transform in operational UI
- Variants: default, muted, outlined, elevated

**Props:**
```ts
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'muted' | 'outlined' | 'elevated';
}
```

**Sub-components:** CardHeader, CardTitle, CardDescription, CardContent, CardFooter

---

### 6. KpiCard

**Purpose:** Single metric display in dashboard or section header.

**Visual Contract (SIMPLIFIED):**
- One accent color only: primary (no emerald/amber/rose/violet/sky)
- Icon: 40px rounded square, primary bg, white icon
- Value: 28px, 700 weight, tabular-nums, text-primary
- Label: 12px, 500 weight, text-secondary
- Sub: 11px, 400 weight, text-muted
- Trend: compact badge, top-right
- No accent-colored background wash

**Props:**
```ts
interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}
```

**Removed props:** `accent`, `compact` (now determined by context)

---

### 7. StatusBadge

**Purpose:** Semantic status indicator.

**Visual Contract:**
- Full pill shape (rounded-full)
- 11px, 600 weight
- 1px inset ring
- Optional dot prefix
- Semantic tones only (not raw color tones)

**Props:**
```ts
interface StatusBadgeProps {
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';
  children: ReactNode;
  dot?: boolean;
}
```

**Financial State Mapping:**
- Paid → success
- Partial → warning
- Overdue → danger
- Void → neutral
- Draft → info
- Posted → success
- Inflow → success
- Outflow → danger
- Settled → success
- Outstanding → warning
- Blocked → danger

---

### 8. DataTable (EntityTable)

**Purpose:** Data display in rows and columns.

**Visual Contract:**
- Header: bg-muted/30, 12px, 600 weight, uppercase
- Row: 44px height, border-b border-border-light
- Row hover: bg-muted/15
- Cell padding: 12px 16px
- Mobile: transforms to card list
- Overflow: horizontal scroll on narrow screens

**Props:**
```ts
interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  emptyState?: ReactNode;
  errorState?: ReactNode;
  onRowClick?: (item: T) => void;
  sortState?: SortState;
  onSort?: (sort: SortState) => void;
  pagination?: PaginationState;
  onPagination?: (pagination: PaginationState) => void;
}
```

---

### 9. FilterBar

**Purpose:** Filter controls for list pages.

**Visual Contract:**
- Horizontal row of filter controls
- Wraps on mobile
- Background: transparent
- Gap: 8px between filters

---

### 10. ActiveFilterBar

**Purpose:** Shows currently active filters as removable tags.

**Visual Contract:**
- Appears only when filters are active
- Tags: pill shape, 11px, with × to remove
- "Clear All" button at end

---

### 11. Dialog

**Purpose:** Modal overlay for focused tasks.

**Visual Contract:**
- Center-positioned card
- Max-width: 480px default, 640px wide
- Background: var(--color-card)
- Border: 1px solid var(--color-border)
- Border-radius: 14px
- Shadow: 0 8px 32px rgba(0,0,0,0.12)
- Backdrop: rgba(0,0,0,0.4) — strong enough to isolate

---

### 12. BottomSheet

**Purpose:** Mobile-optimized modal from screen bottom.

**Visual Contract:**
- Slides up from bottom
- Max-height: 90vh
- Top corners: rounded-xl
- Drag handle at top
- Backdrop: rgba(0,0,0,0.4)

---

### 13. ConfirmDialog

**Purpose:** Destructive action confirmation.

**Visual Contract:**
- Red accent on destructive actions
- Clear title and description
- Cancel + Destructive action buttons
- Destructive button: red background
- No pre-checked confirmations

---

### 14. EmptyState

**Purpose:** Displayed when a list/table has no data.

**Visual Contract:**
- Centered in content area
- Muted icon (48px, text-muted/30)
- Title: 15px, 600 weight, text-secondary
- Description: 13px, 400 weight, text-muted
- Optional: primary action button

---

### 15. ErrorState

**Purpose:** Displayed when data fetching fails.

**Visual Contract:**
- Centered in content area
- Warning-colored icon (48px)
- Title: "حدث خطأ" (An error occurred)
- Description: error message or generic text
- Retry button

---

### 16. LoadingState (Skeleton)

**Purpose:** Displayed while data is loading.

**Visual Contract:**
- Animated pulse on placeholder blocks
- Matches the shape of the expected content
- No spinner-only states (spinners are for actions, skeletons for content)
- Use: card skeletons, table row skeletons, KPI skeletons

---

### 17. EntityForm

**Purpose:** Create/edit entity forms.

**Visual Contract:**
- Fields stacked vertically with labels above
- Label: 12px, 500 weight, text-secondary
- Input: 40px height, full-width, bordered
- Error: red text below field, red border on input
- Actions: sticky at bottom on mobile
- Overlay mode: BottomSheet on mobile, Dialog on desktop

---

### 18. DetailFields

**Purpose:** Read-only field display on detail pages.

**Visual Contract:**
- Label: 12px, 500 weight, text-muted
- Value: 14px, 400 weight, text-primary
- Stacked vertically
- Grid layout: 2 columns desktop, 1 column mobile

---

## Interaction Patterns

### Primary Actions
- Position: top-right of page header
- Style: primary button, 40px height
- Always visible, never hidden in menus

### Secondary Actions
- Position: next to primary action
- Style: secondary button, 40px height
- Can collapse into "More" menu on mobile

### Row Actions
- Position: end of table row
- Style: ghost icon buttons
- At most 3 visible; rest in dropdown

### Destructive Actions
- Always require confirmation
- Confirmation dialog: red-accented
- Action button labeled explicitly (not just "Confirm")
- Example: "إلغاء العقد" not "تأكيد"

### Navigation
- Breadcrumb: current page in header
- Back button: left side of page header
- Mobile: back is swipe or button
- Bottom nav: 5 primary destinations max

### Search
- Position: in filter bar or page header
- Behavior: debounced (300ms)
- Clear button inside input
- Empty state when no results
