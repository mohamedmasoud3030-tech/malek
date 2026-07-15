# Rentrix Mobile UX Specification v2.0

**Date:** 2026-07-15
**Status:** Active

---

## Mobile-First Philosophy

Rentrix is used by office managers and accountants who are frequently away from their desks — showing properties, meeting owners, inspecting units. Mobile is not a "lite" version; it is a first-class operational interface.

---

## Viewport Strategy

### Supported Resolutions

| Width | Device Class | Priority |
|-------|-------------|----------|
| 360×800 | Small Android | Must work perfectly |
| 390×844 | iPhone 14/15 | Must work perfectly |
| 430×932 | iPhone 15 Pro Max | Must work perfectly |
| 768×1024 | iPad portrait | Should work well |

### Design at 390px first; verify at 360px.

---

## Navigation

### Bottom Navigation Bar

**Visible:** Always on mobile (< 1024px)
**Items:** Maximum 5 primary destinations

```
┌───────┬───────┬───────┬───────┬───────┐
│  🏠   │  🏢   │  👥   │  💰   │  📋   │
│الرئيسية│العقارات│الملاك │المالية │المزيد  │
└───────┴───────┴───────┴───────┴───────┘
```

**Behavior:**
- Fixed at bottom
- Safe-area-aware (padding for home indicator)
- Active item: primary color
- Inactive items: muted color
- Height: 56px + safe-area-inset-bottom
- Background: var(--color-card) with top border

### Drawer Navigation

**Trigger:** Hamburger menu (top-left in RTL)
**Behavior:**
- Slides from right (RTL)
- Full height
- Width: min(320px, 88vw)
- Backdrop: rgba(0,0,0,0.4)
- Closes on: backdrop tap, nav item tap, swipe

### Back Navigation

- Physical back button: handled by browser
- In-app back: back button in page header
- Swipe back: browser default

---

## Touch Interactions

### Target Sizes

| Element | Minimum Size | Preferred Size |
|---------|-------------|----------------|
| Buttons | 44×44px | 44×44px |
| Icon buttons | 44×44px | 44×44px |
| Table rows | 44px height | 48px height |
| Form inputs | 44px height | 48px height |
| Checkboxes/Radios | 44×44px | 44×44px |
| Nav items | 44px height | 48px height |
| Filter chips | 32px height | 36px height |

### Touch Spacing

- Minimum 8px gap between adjacent touch targets
- 12px preferred for high-frequency actions
- Action buttons at bottom of screen: stacked with 12px gap

---

## Layout Patterns

### List → Card Transition

On mobile, all data tables become card lists:

**Desktop Table:**
```
| Property | Type    | Units | Status  | Actions |
|----------|---------|-------|---------|---------|
| برج السلام | Commercial | 12  | ✓ Active | ···    |
```

**Mobile Card:**
```
┌─────────────────────────────────┐
│ برج السلام                      │
│ Commercial · 12 units           │
│ ✓ Active                   ··· │
└─────────────────────────────────┘
```

### Form → Bottom Sheet

On mobile, entity forms open in bottom sheets:

```
┌─────────────────────────────────┐
│          ═══ (drag handle)      │
│  New Property                   │
│                                 │
│  Name: [_______________]        │
│  Type: [Select ▼          ]     │
│  ...                            │
│                                 │
│  [Cancel]    [Create Property]  │
└─────────────────────────────────┘
```

### Filters → Collapsible / Bottom Sheet

On mobile, filters are hidden by default:
- **Option A:** Collapsible filter bar (toggle button in page header)
- **Option B:** Bottom sheet filter panel

Use Option A for 1-3 simple filters.
Use Option B for complex filter forms.

---

## Financial Operations on Mobile

### Key Rules

1. **Never hide financial amounts** — they must always be visible, no truncation
2. **Confirmation before mutation** — every financial action has a confirmation step
3. **Clear success/error feedback** — toast notification after every financial operation
4. **Undo where possible** — VOID, not DELETE

### Payment Form

```
┌─────────────────────────────────┐
│  Receive Payment                │
│                                 │
│  Amount: [_______________]      │
│  Method: [Cash ▼         ]      │
│  Date:   [2026-07-15     ]      │
│  Notes:  [_______________]      │
│                                 │
│  Invoice balance: 1,250 ر.ع.   │
│  After payment:      750 ر.ع.   │
│                                 │
│  [Cancel]  [Receive Payment]    │
└─────────────────────────────────┘
```

---

## Loading States

### Skeleton Priority

Content areas show skeleton placeholders that match the expected layout:
- KPI grid: 4 skeleton cards
- Table: 5 skeleton rows
- Detail: section skeletons

### Pull-to-Refresh

Not implemented. Use explicit refresh button. Pull-to-refresh conflicts with scroll in data-heavy pages.

---

## Error States

### Network Error

```
┌─────────────────────────────────┐
│                                 │
│         ⚠️ (warning icon)      │
│    تعذر الاتصال بالخادم         │
│    تحقق من اتصالك بالإنترنت      │
│                                 │
│        [إعادة المحاولة]          │
│                                 │
└─────────────────────────────────┘
```

### Permission Error

```
┌─────────────────────────────────┐
│                                 │
│         🔒 (lock icon)         │
│    لا تملك الصلاحية للوصول       │
│    تواصل مع مسؤول النظام         │
│                                 │
└─────────────────────────────────┘
```

---

## Keyboard Handling

- Financial amount inputs: numeric keyboard
- Search inputs: text keyboard with search action
- Form inputs: appropriate keyboard type

---

## Safe Areas

All fixed/sticky elements must account for:
- Top: status bar / notch (env(safe-area-inset-top))
- Bottom: home indicator (env(safe-area-inset-bottom))

```css
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.sticky-header {
  padding-top: env(safe-area-inset-top, 0px);
}
```

---

## Orientation

- Portrait: primary design target
- Landscape: functional but not optimized
- No lock on orientation — let the user rotate

---

## Performance

- No heavy animations on mobile
- No parallax scrolling
- No autoplay video
- Images: lazy loaded, appropriate resolution
- Fonts: subset Arabic glyphs if possible
- Bundle: code-split per route (already done by Vite)
