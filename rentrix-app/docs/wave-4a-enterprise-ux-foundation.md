# MALEK Pro — Wave 4A: Enterprise UX Foundation

> Reusable enterprise UI platform for all future module migrations.
> **Additive-only, isolation-first**: every file in this wave is NEW; no
> existing page, component, hook, style, or service was modified.

Base: `origin/main` at branch time (`8e4908a7`)
Branch: `feat/wave4a-enterprise-ux-foundation`
Location: `rentrix-app/src/components/enterprise/`
Import path: `@/components/enterprise`

## 1. What Wave 4A is (and is not)

Wave 3 delivered visual primitives + tokens (`src/components/ui/*`,
`src/styles/tokens.css`). Wave 4A delivers the **composition layer** above it:
page shells, the data-table framework, the drawer framework, the form layout
engine, state surfaces, and the state hooks that future module migrations
(Contracts, Properties, Owners, Tenants, Payments, …) will consume.

It is **not**:

- a redesign — no existing screen changed;
- a router change — no routes added/removed/modified;
- a data layer — no Supabase/API/service/business-rule code touched;
- a migration — no module was moved onto these components in this wave.

Isolation rule: everything lives under one new directory
(`src/components/enterprise/`) so parallel feature branches never conflict
with this wave. The only integration points are imports of existing
primitives (`Button`, `Card`, `Table`, `Dialog`, `ConfirmDialog`, `KpiCard`,
`EmptyState`, `ErrorState`, `LoadingState`, `Badge`, `Skeleton`, `Select`).

## 2. Directory map

```
src/components/enterprise/
├── index.ts                          # Public barrel — the only import path
├── design-tokens.ts                  # Typed view of the Wave 3 CSS tokens
│
├── enterprise-page.tsx               # Page shell (header/stats/toolbar/content/footer)
├── enterprise-header.tsx             # Title + breadcrumbs + actions (page h1)
├── enterprise-toolbar.tsx            # Search/filters/actions control band
├── enterprise-stats.tsx              # KPI grid (wraps KpiCard)
├── enterprise-filters.tsx            # Config-driven filter strip + chips
├── enterprise-search.tsx             # Debounced accessible search box
│
├── enterprise-data-table.tsx         # Sorting/filter/pagination/selection/keyboard grid
├── enterprise-bulk-actions.tsx       # Selection action bar (inline | floating)
├── enterprise-row-actions.tsx        # Per-record ⋯ menu (Radix DropdownMenu)
│
├── enterprise-drawer.tsx             # Create/Edit/View/Preview side-sheet
├── enterprise-modal.tsx              # Centered dialog, same dismissal grammar
├── enterprise-confirm-dialog.tsx     # Confirm gate (+ type-to-confirm)
│
├── enterprise-form.tsx               # Sections/tabs/cards form layout engine
├── enterprise-section.tsx            # Titled collapsible section
├── enterprise-card.tsx               # Standard content card
├── enterprise-tabs.tsx               # Config-driven Radix tabs
├── enterprise-sidebar-section.tsx    # Labeled sidebar nav group
├── enterprise-sticky-footer.tsx      # Safe-area sticky action bar
├── enterprise-preview-panel.tsx      # Read-only record preview
│
├── enterprise-empty-state.tsx        # Empty surfaces (tones: default/search/permission/data)
├── enterprise-loading-state.tsx      # Skeletons (page/table/cards/form/drawer/stats/inline)
├── enterprise-error-state.tsx        # Recoverable errors (+ inline variant)
├── enterprise-status-badge.tsx       # Module-agnostic status pill
│
├── hooks/
│   ├── use-drawer.ts                 # Drawer lifecycle (mode + payload + dirty)
│   ├── use-table-state.ts            # Page/sort/search/selection/expansion
│   ├── use-filters.ts                # Generic filter map state
│   ├── use-persistent-table-state.ts # Table state ↔ localStorage
│   ├── use-keyboard-shortcuts.ts     # Declarative chord shortcuts
│   └── use-unsaved-dismiss.ts        # Dirty-gate shared by overlays
│
└── *.test.tsx                        # 65 targeted tests (vitest + RTL + happy-dom)
```

## 3. Design tokens (typed)

`design-tokens.ts` is a **view**, not a duplicate: it references the CSS
custom properties and registered Tailwind utilities from Wave 3
(`tokens.css`) and never stores raw visual values.

| Group | Export | Notes |
|---|---|---|
| Spacing | `spacing` | 4px scale → `var(--space-*)` |
| Radius | `radius` | `var(--radius*)` incl. card/elevated |
| Elevation | `elevation` | `shadow-card/…` classes |
| Transitions | `transition` | `var(--duration-*)` + class presets |
| Status colors | `statusColors`, `statusTones` | success/warning/danger/info/neutral class pairs |
| Semantic colors | `semanticColors` | canvas/surface/primary/border |
| Breakpoints | `breakpoints`, `mediaQueries`, `matchesBreakpoint()` | Tailwind-default px values |
| Icon sizing | `iconSizes` | `size-*` classes matching `--icon-*` |
| Typography | `typographyPresets` | class presets mirroring `ui/typography` |
| Z-index | `zIndex` | `var(--z-*)` |

Everything is also re-exported as one `enterpriseDesignTokens` object.

## 4. Component APIs (summary)

### 4.1 Page shell

```tsx
<EnterprisePage
  title="العقود"                      // the page's single <h1>
  description="…"
  breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'العقود' }]}
  icon={FileText}
  actions={<Button onClick={drawer.openCreate}>عقد جديد</Button>}
  stats={<EnterpriseStats items={kpis} isLoading={statsLoading} />}
  toolbar={
    <EnterpriseToolbar
      leading={<EnterpriseSearch value={table.search} onChange={table.setSearch} />}
      filters={<EnterpriseFilters fields={fields} values={filters.values} onChange={filters.setValue} onClearAll={filters.clearAll} />}
      actions={<ViewModeToggle … />}
    />
  }
  isLoading={query.isLoading}
  error={query.error}
  onRetry={query.refetch}
  maxWidth="xl"                       // sm|md|lg|xl|2xl|full
>
  <EnterpriseDataTable … />
</EnterprisePage>
```

`EnterprisePage` gates content **loading → error → children** and renders the
bands in a fixed order: header, stats, toolbar, content, footer.

### 4.2 EnterpriseDataTable

```tsx
<EnterpriseDataTable
  rows={contracts}
  columns={columns}                  // EnterpriseColumnDef<T>[]
  keyOf={(row) => row.id}
  aria-label="جدول العقود"
  /* sorting — controlled by useTableState, or client-side: */
  sort={table.sort}
  onSortChange={table.setSort}
  sortMode="controlled"              // 'client' sorts via column.sortValue
  /* generic global filter (client-side) */
  globalFilter={table.search}
  globalFilterAccessor={(row) => `${row.code} ${row.tenantName}`}
  /* pagination */
  pagination={{ page: table.page, pageSize: table.pageSize, onPageChange: table.setPage, onPageSizeChange: table.setPageSize }}
  /* bulk selection */
  selectable
  selectedKeys={table.selectedKeys}
  onSelectionChange={table.setSelectedKeys}
  /* per-row menu */
  rowActions={(row) => [
    { id: 'view', label: 'عرض', icon: Eye, onSelect: () => drawer.openView(row) },
    { id: 'delete', label: 'حذف', icon: Trash2, destructive: true, onSelect: () => confirmDelete(row) },
  ]}
  rowActionsLabel={(row) => `إجراءات العقد ${row.code}`}
  /* states */
  isLoading={query.isLoading}
  error={query.error}
  onRetry={query.refetch}
  emptyTitle="لا توجد عقود"
  emptyAction={<Button onClick={drawer.openCreate}>إنشاء أول عقد</Button>}
  /* behavior */
  onRowClick={(row) => drawer.openView(row)}
  renderMobileCard={(row) => <ContractCard contract={row} />}
  density="compact"
  stickyHeader
/>
```

Behaviour checklist (all implemented, all module-agnostic):

- [x] sorting (aria-sort, asc→desc→clear, controlled or `client` via `sortValue`)
- [x] filtering (generic `globalFilterAccessor`; domain filters stay in modules via `useFilters`)
- [x] pagination (client slicing or `mode: 'server'` passthrough; page-size select; out-of-range recovery)
- [x] sticky header (scroll container with `maxHeightClassName`, default `max-h-[70vh]`)
- [x] sticky actions column (`position: sticky` at the inline-end edge, hover-synced background)
- [x] bulk selection (header tri-state checkbox + per-row checkboxes + `aria-selected`)
- [x] row actions (Radix dropdown; keyboard/type-ahead/focus-return built in)
- [x] loading skeleton / empty state / error state (delegated to the Wave 4A surfaces)
- [x] responsive mode (`renderMobileCard` — cards under `md`, table above)
- [x] keyboard navigation (↑/↓/Home/End row traversal, Enter/Space activates `onRowClick`)

`EnterpriseBulkActions` floats an action bar for the selection
(`position: 'inline' | 'floating'`, per-action `confirm` gating, clear-all).

### 4.3 EnterpriseDrawer

```tsx
const drawer = useDrawer<Contract>();

<EnterpriseDrawer
  {...drawer.bind}                   // open / mode / isDirty / onOpenChange
  title={drawer.mode === 'create' ? 'عقد جديد' : 'تعديل عقد'}
  description={drawer.payload?.code}
  width="lg"                         // sm|md|lg|xl|full  (responsive vw caps)
  side="right"                       // right|left|bottom
  closeOnEscape                      // default true
  closeOnOutsideClick                // default true
  warnOnUnsavedChanges               // default true — dirty-gates EVERY dismissal path
  isLoading={initialLoading}
  validationErrors={formErrors}
  readOnly={!canEdit}                // view/preview modes imply readonly automatically
  primaryAction={{ label: 'حفظ', onClick: save, loading: saving }}
  secondaryAction={{ label: 'إلغاء' /* defaults to dirty-gated close */ }}
>
  <ContractForm onDirtyChange={drawer.setDirty} />
</EnterpriseDrawer>
```

- Modes (`create | edit | view | preview`) render an intent chip and set
  readonly automatically for `view`/`preview`.
- The unsaved-changes warning is an `EnterpriseConfirmDialog` on top; Escape,
  scrim clicks, the × button and footer cancel all route through it.
- Footer is a sticky `EnterpriseStickyFooter`; pass `footer` for full control
  or the `primaryAction`/`secondaryAction` shortcuts.
- **`EnterpriseModal`** offers the same grammar for centered dialogs
  (`size: sm|md|lg|xl`).

### 4.4 EnterpriseForm

```tsx
<EnterpriseForm
  onSubmit={form.handleSubmit(save)}
  errors={errors}                    // [{ message, fieldId? }] — summary links jump to fields
  disabled={!canEdit}                // propagates through <fieldset disabled>
  readOnly={false}
  tabs={[                            // OR `sections={[…]}` OR free-form children
    { id: 'general', label: 'عام', badge: 2, sections: [
      { id: 'identity', title: 'الهوية', columns: 2, content: <IdentityFields /> },
      { id: 'notes', title: 'ملاحظات', content: <NotesField />, collapsible: true },
    ]},
  ]}
  submitLabel="حفظ"
  cancelLabel="إلغاء"
  onCancel={close}
  isSubmitting={saving}
  hideFooter={false}                 // true when hosted inside a drawer footer
/>
```

Supports: section cards, tabs, validation summary, readonly/disabled,
sticky footer actions. It is intentionally ignorant of react-hook-form/zod —
modules wire their own state machinery in.

### 4.5 Remaining surfaces

| Component | Purpose (one-liner) |
|---|---|
| `EnterpriseSection` | `<section aria-labelledby>` titled, collapsible, dense option |
| `EnterpriseCard` | Header/body/footer card, padding presets, `interactive`, `muted`, loading swap |
| `EnterpriseTabs` | Config-driven Radix tabs, `line`/`pills`, badges, sticky list |
| `EnterpriseSidebarSection` | Sidebar nav group, rail/card surfaces, collapse, active/badge/disabled |
| `EnterpriseStatusBadge` | `statusMap` → label/variant/icon; preset + neutral fallbacks |
| `EnterpriseEmptyState` | Tones (`search`, `permission`, …) + dual actions + compact |
| `EnterpriseLoadingState` | `context`: page/section/cards/table/inline/drawer/form/stats |
| `EnterpriseErrorState` | Shared ErrorState + `inline` variant; retry passthrough |
| `EnterpriseConfirmDialog` | Shared ConfirmDialog + `requireText` type-to-confirm |
| `EnterprisePreviewPanel` | Read-only record preview (dl grid, sections, empty/loading) |
| `EnterpriseStickyFooter` | Sticky/static, align start/end/between/center, safe-area |

## 5. Hooks

### `useTableState()`
- `page, pageSize, offset, setPage, setPageSize` — page resets on size change
- `sort, setSort, toggleSort(field)` — asc → desc → cleared
- `search, setSearch` — resets page
- `selectedKeys, setSelectedKeys, toggleSelected, selectOnly, clearSelection, isSelected, selectionCount`
- `expandedKey, toggleExpanded`
- `reset()`

### `usePersistentTableState(storageKey, options)`
Same surface, but page/pageSize/sort/search hydrate from + persist to
`localStorage` under `storageKey`. Selection/expansion stay session-only.
Storage failures degrade silently (same pattern as `useViewModePreference`).

### `useFilters(initialValues)`
`values, setValue, setMany, clearValue, clearAll, activeEntries, activeCount, isDirty`.

### `useDrawer<TPayload>()`
`isOpen, mode, payload, isDirty, setDirty`,
`open/openCreate/openEdit/openView/openPreview, close, setPayload`,
and `bind` — spreadable props for `EnterpriseDrawer`.

### `useKeyboardShortcuts(shortcuts, options)`
```ts
useKeyboardShortcuts([
  { keys: 'mod+k', description: 'بحث سريع', onTrigger: openSearch },
  { keys: 'escape', onTrigger: drawer.close },
  { keys: '/', onTrigger: focusSearch, description: 'تركيز البحث' },
]);
```
Chords: `mod` (Ctrl/⌘), `ctrl`, `shift`, `alt` + key. Skips editable fields
unless `allowInEditable`. `formatShortcutLabel()` renders legends.

### `useUnsavedDismiss({ isDirty, warnOnDismiss, onClose })`
Shared dirty-gate used by Drawer/Modal (also exported for custom overlays).

## 6. Migration guide — how a module adopts Wave 4A later

1. Replace page boilerplate with `EnterprisePage` + `EnterpriseHeader`.
2. Move list state to `usePersistentTableState(moduleKey)` (+ `useFilters`).
3. Swap hand-rolled table markup for `EnterpriseDataTable` (columns config,
   `renderMobileCard` for the existing card view).
4. Replace create/edit/view dialogs with `useDrawer + EnterpriseDrawer`
   (same open/close semantics, free dirty-gating).
5. Move forms into `EnterpriseForm` sections (keep RHF/zod untouched).
6. Map domain statuses through `EnterpriseStatusBadge statusMap`.
7. Delete the replaced local components only after visual parity review.

Nothing in Wave 4A forces this order or timeline — the foundation is
importable in isolation from `@/components/enterprise`.

## 7. Accessibility notes

- RTL-first: logical properties everywhere (`ms-/me-/ps-/pe-`, `start/end`,
  `end-0` sticky edges); chevrons mirrored with `rtl:` variants.
- Keyboard: table row traversal, Radix focus trap/return in overlays, tabs
  roving focus, escape dismissal through the dirty gate.
- ARIA: `aria-sort`, `aria-selected`, `aria-current`, labelled navs/regions,
  `role="status"`/`role="alert"` on state surfaces, sr-only dialog
  descriptions, `indeterminate` header checkbox.
- Status never color-only: badges carry icons/text (Wave 3 rule preserved).

## 8. Testing & verification

- 65 targeted Vitest/RTL tests (3 files, all under
  `src/components/enterprise/`), covering table behaviors, all 5 public
  hooks, overlays, forms and surfaces. ~4s runtime.
- `pnpm typecheck` (app + tests tsconfig), `pnpm lint`,
  `pnpm --filter @workspace/rentrix run check:architecture`,
  and `pnpm build` — clean.
- Per wave policy: no Playwright/browser smoke/staging suites were run.

## 9. Guardrails for consumers

- Never fork these components into a module — extend via props or open a
  wave PR against the foundation.
- No Supabase/service imports in this layer (the architecture guard blocks it).
- Keep module enums OUT of the foundation; map them at the call site.
- Arabic is the UI language; new copy follows the existing tone.
