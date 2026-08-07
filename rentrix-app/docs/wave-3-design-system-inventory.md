# MALEK Pro — Visual Wave 3: System Inventory

> Enterprise Design System Foundation. This is an **audit before build**, not a
> rewrite. The rule is **Reuse → Extend → Refactor → Create only when missing**.

Base SHA: `6bc8eb4ff6449383f8a367d422337611b451a3d4` (origin/main)
Workspace: `@workspace/rentrix` (pnpm monorepo, `rentrix-app/`)

## 1. Existing foundation (reused, not replaced)

- **Router**: TanStack Router, manually registered in `src/app/router/route-tree.ts`.
  **No second router is added.**
- **Theming**: CSS custom properties in `src/styles/tokens.css` with a Tailwind v4
  `@theme inline` bridge. Light in `:root`, dark in `[data-theme='dark']` toggled by
  `useUiStore` → `document.documentElement.dataset.theme`.
- **RTL**: app is RTL-first (`html { direction: rtl }`), uses logical properties
  (`ms-/me-`, `start/end`).
- **Utilities**: `cn()` = `twMerge(clsx(...))`; CVA already in deps but not yet used by primitives.
- **Icons**: `lucide-react` (no second icon library).
- **Toast**: `sonner` `<Toaster>` mounted once in `src/routes/__root.tsx` — not replaced.
- **Tests**: Vitest + Testing Library + happy-dom; Axe in Playwright e2e.

## 2. Existing primitives

| Primitive | File | State |
|---|---|---|
| Button | `components/ui/button.tsx` | Reused/extended |
| IconButton | `components/ui/icon-button.tsx` | Reused |
| Input | `components/ui/input.tsx` | Reused/extended |
| Textarea | `components/ui/textarea.tsx` | Reused |
| Select | `components/ui/select.tsx` | Reused |
| SearchInput | `components/ui/search-input.tsx` | Reused |
| Card / CardHeader/Title/Description/Content/Footer | `components/ui/card.tsx` | Reused/extended |
| Badge | `components/ui/badge.tsx` | Reused/extended |
| StatusBadge | `components/ui/status-badge.tsx` | Reused |
| Label | `components/ui/label.tsx` | Reused |
| FormField (label/error/hint) | `components/ui/form-field.tsx` | Reused |
| Dialog (Radix) | `components/ui/dialog.tsx` | Reused (focus trap/Esc/a11y from Radix) |
| ConfirmDialog | `components/ui/confirm-dialog.tsx` | Reused/extended |
| Modal | `components/ui/modal.tsx` | Reused |
| Drawer / BottomSheet | `components/ui/drawer.tsx`, `bottom-sheet.tsx` | Reused |
| Table / TableHeader/Body/Row/Head/Cell | `components/ui/table.tsx` | Reused/extended (no Caption, no states) |
| Skeleton | `components/ui/skeleton.tsx` | Reused |
| LoadingState | `components/ui/loading-state.tsx` | Reused |
| EmptyState | `components/empty-state.tsx` | Reused |
| ErrorState | `components/ui/error-state.tsx` | Reused |
| KpiCard / StatCard / InlineStatCard | `components/ui/*-card.tsx` | Reused (financial surfaces) |

## 3. Gaps Wave 3 closes

- **Tokens**: spacing scale, motion duration/easing, z-index, opacity, focus-ring,
  disabled, overlay, container widths, icon sizes; semantic `surface`/`surface-elevated`
  and `financial-positive/negative/neutral` tokens. Added to `tokens.css` only (no CSS rewrite).
- **Typography**: a single `Typography` API (display/h1–h6/title/subtitle/body*/caption/
  label/overline/button/mono) backed by tokens. Cairo font + Arabic/RTL preserved.
- **Button**: add `xs`, `xl`; `soft`, `success`, `warning`, `link` variants;
  `loading` + `fullWidth`; `leftIcon`/`rightIcon`. Refactored to CVA while keeping
  all existing variant names (`primary`, `default`, `secondary`, `ghost`, `danger`,
  `destructive`, `outline`) and the `44px` hit area — no breaking change.
- **Input**: stateful variants (`error`/`warning`/`success`/`loading`/`readonly`) and a
  composed `TextField` shell (label/description/error/leading icon/trailing action)
  that wraps the existing `Input`/`Textarea`. `currency` type supported via shell.
- **Card**: add `interactive`, `compact`, `statistic`, `financial` variants (additive).
- **Badge**: add `neutral` variant and business states (`active`, `inactive`, `draft`,
  `pending`, `paid`, `overdue`, `cancelled`, `archived`, `void`) as presets with icons —
  visual only, no business logic.
- **Table**: add `TableCaption` and reusable visual states (loading/empty/error/selected/
  compact density). No new data grid; sorting/filtering/pagination deferred to Wave 4.
- **Feedback**: new `Alert` (info/success/warning/danger) and `Spinner`. Toast,
  EmptyState, ErrorState, Skeleton reused. New presentational `OfflineState` and
  `NoPermissionState` built on existing Card primitives.
- **Accessibility**: keyboard nav, focus-visible, ARIA, accessible names, reduced motion,
  screen-reader-safe loading (role=status/aria-live), RTL. Color never used alone.
- **Showcase**: isolated, **development-only** route `/dev/design-system` registered with
  the existing TanStack router (lazy, not in production navigation, redirects/404s in
  production). App is not replaced; `App.tsx`/home unchanged; no second router.
- **Tests**: render, variants, disabled, loading, keyboard focus, accessible name,
  class merging (cn), RTL-safe rendering.

## 4. Hardcoded patterns noted (Wave 4 will migrate pages)

Some pages use raw color classes / one-off spacing. Wave 3 provides the tokens and
primitives; **page migration is explicitly Wave 4** and is out of scope here.

## 5. Explicitly deferred to Wave 4

- Migrating all application pages/screens to the new primitives.
- Sorting/filtering/pagination wiring on tables.
- Replacing per-page ad-hoc cards/badges/forms.
- Any data-fetching, business, accounting, permission, or Supabase changes.

## 6. Not touched

`supabase/`, migrations, services, financial/accounting logic, hooks, auth,
permissions, API contracts, routing behavior, navigation, existing pages.
No new router, icon library, or variant library (CVA was already present).
