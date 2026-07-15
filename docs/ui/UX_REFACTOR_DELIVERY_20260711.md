# Rentrix Product UX/UI Refactor — Delivery Notes

Date: 2026-07-11  
Scope: Product UX/UI only. Database hardening and financial RPCs left untouched.

## Quality gates

| Check | Result |
| --- | --- |
| `pnpm --filter ./rentrix-app exec tsc --noEmit` | Pass |
| `pnpm --filter ./rentrix-app test -- --run` | Pass — 95 files / 438 tests |
| `pnpm --filter ./rentrix-app run build` | Pass — PWA SW generated |

## Final UX readiness score: **86 / 100**

| Dimension | Score | Notes |
| --- | --- | --- |
| Design system completeness | 92 | Required primitives exported from `src/components/ui` |
| App shell / navigation | 88 | Sidebar + mobile drawer + bottom nav refined |
| Dashboard product feel | 90 | Full KPI set + charts + quick actions |
| Mobile experience | 84 | Cards, touch targets, safe areas, bottom nav |
| Entity actions | 82 | Contract/report action menus + presets |
| Communication / automation | 88 | Expandable service boundary + UI centers |
| PWA / offline shell | 80 | Offline shell only; no sensitive offline data |
| Copy polish | 85 | Developer phrasing reduced in shell/status |

## What shipped

### Design system (`src/components/ui`)

Added/completed:

- `IconButton`, `Badge`, `MobileCard`, `FilterBar`, `DatePicker`
- `Drawer`, `FormField`, `ActionMenu`, `Dropdown`
- `LoadingState`, `ErrorState`, `Modal` alias, `DataTable` alias
- `EmptyState` re-export, `entity-action-presets`
- Barrel export coverage verified by `design-system-exports.test.ts`

### Application shell

- Mobile bottom nav now prioritizes operational finance (`/invoices` instead of `/people`)
- Quick links include payment capture shortcut
- Status/copy cleaned for product language
- Automation route added to sidebar under operations

### Dashboard

- KPI grid now covers: properties, units, occupancy, monthly collection, arrears, expenses, net income
- Quick actions: new contract, receive payment, add property, maintenance, report, financials
- New `DashboardCharts` section for revenue/occupancy/collections/expenses
- Hero banner denser and mobile-friendly
- Source remains `rpt_dashboard_overview` via existing `getDashboardSnapshot`

### Communication center

- Outbound panel for WhatsApp / email templates
- Service boundary: `outbound-communication-service.ts` (no provider SDK inside UI)
- Local preview adapter only (wa.me / mailto)

### Automation center

- New route: `/automation`
- Rules catalog for contract expiry, rent reminders, owner reports, maintenance alerts
- Template previews and local enable/pause UI
- Ready for future worker/provider wiring without UI rewrite

### Product actions

- Contract detail: print, PDF, WhatsApp, share, renew, terminate via primary buttons + overflow menu
- Reports: shared ReportCard actions for Excel/CSV, print, PDF slot, action menu

### PWA

- Offline shell copy clarified (no sensitive financial offline storage)
- Workbox runtime caching limited to pages/assets shell

## Screens affected

- Dashboard (`/`)
- Contracts detail (`/contracts/$contractId`)
- Communication (`/communication`)
- Automation (`/automation`) — new
- Reports overview actions
- App shell / sidebar / bottom navigation

## Intentionally not reworked in this pass

- Backend RPCs / RLS / journal / bank reconciliation atomic paths
- Full form wizard conversion for every long form
- Live WhatsApp Business / SMTP provider integration
- Pixel-perfect redesign of every legacy list page (shared primitives are ready for incremental adoption)

## Follow-ups recommended

1. Migrate remaining list pages to `FilterBar` + `MobileCard` + `DataTable` only where not already on `EntityTable`/`EntityCard`.
2. Wire automation rules to real `automation_jobs` workers when backend schedule is ready.
3. Add provider adapters behind `sendOutboundMessage` for production WhatsApp/email.
4. Device QA on 320/375/430 against drawer + bottom nav + sticky actions.


## Dashboard priority pass (2026-07-15)

Tracked by [#1155](https://github.com/mohamedmasoud3030-tech/rentrixxx/issues/1155) and implemented in [PR #1165](https://github.com/mohamedmasoud3030-tech/rentrixxx/pull/1165).

### Goal and scope

- Make the dashboard a decision surface ordered as priorities, four decision KPIs, work queues, then supporting trends.
- Remove duplicate financial and operational summaries without changing their source or calculation.
- Keep every four-card metric/action group on the shared 2×2 contract.
- Preserve `getDashboardSnapshot`, route guards, permissions, financial services, and all backend contracts.

### Verification contract

Run from the repository root:

```bash
pnpm typecheck
pnpm lint
pnpm --filter ./rentrix-app run typecheck:test
pnpm --filter ./rentrix-app run check:architecture
pnpm --filter ./rentrix-app test
pnpm build
pnpm e2e
```

Browser acceptance covers 360×800, 390×844, 430×932, 768×1024, and 1440×1000 in light/dark Arabic RTL. It asserts the priority-first section order, exactly four quick actions, exactly four KPI cards, two computed columns for both four-card groups, and no horizontal overflow. Exact-head CI results belong in the PR and #1155; this document records the durable scope and command contract.


## Login simplification pass (2026-07-15)

Tracked by [#1155](https://github.com/mohamedmasoud3030-tech/rentrixxx/issues/1155).

### Goal and scope

- Reduce `/login` to one focused authentication surface: brand, form, and form-local status.
- Remove the desktop marketing panel and repeated feature cards from the authentication path.
- Keep runtime diagnostics and authentication failures inside the form with an accessible live alert.
- Preserve `useAuth().login`, session storage, redirects, Supabase configuration, and route protection unchanged.
- Keep success notification behavior while making failure recovery independent of transient toast visibility.

### Verification contract

Run from the repository root:

```bash
pnpm typecheck
pnpm lint
pnpm --filter ./rentrix-app run typecheck:test
pnpm --filter ./rentrix-app run check:architecture
pnpm --filter ./rentrix-app test
pnpm build
pnpm e2e
```

Browser acceptance covers 360×800, 390×844, 430×932, 768×1024, and 1440×1000 in light/dark Arabic RTL. It asserts one form surface, removal of the marketing aside/cards, usable primary controls, no horizontal overflow, viewport containment, and an inline recoverable authentication error. Exact-head CI results and screenshots belong in the PR and #1155; this section records the durable scope and command contract.


## Properties + Units refactor pass (2026-07-15)

Tracked by [#1155](https://github.com/mohamedmasoud3030-tech/rentrixxx/issues/1155).

### Goal and scope

- Extract controller hooks so list pages are pure orchestrators.
- Eliminate shared-primitive duplication (propertyStatusTone, DataTable alias, MobileCard, EntityDetailHeader).
- Deduplicate property form fields between create and edit modals.
- Fix zero-count display bug in Properties list header.
- Add regression tests for filter state, modal lifecycle, navigation, and responsive patterns.

### What changed

| File | Change |
| --- | --- |
| `use-property-list-controller.ts` | **New.** Controller hook owning search, status, pagination, modal, and archive state. |
| `use-units-list-controller.ts` | **New.** Controller hook owning search, property/status/occupancy filters, KPI computation, modal state. |
| `property-form-core-fields.tsx` | **New.** Generic `<T extends FieldValues>` component sharing 7 core property form fields. |
| `properties-list-page.tsx` | Refactored to use controller; fixed zero-count via `count={ctrl.totalCount}` (no longer `\|\| undefined`); imports `propertyStatusTone` from shared source. |
| `property-form-modal.tsx` | Refactored to use `PropertyFormCoreFields<T>` — removed all `as unknown as` casts. |
| `units-page.tsx` | Refactored to use controller hook; page is now a pure orchestrator. |
| `units-list.tsx` | Replaced hand-assembled mobile `<div>` cards with shared `MobileCard`; uses `DataTable` alias. |
| `property-unit-detail-page.tsx` | Uses `EntityDetailHeader` instead of manual Card header assembly. |
| `units-page.test.ts` | Updated imports to match new controller file location. |
| `properties-list-page-interaction.test.tsx` | Added zero-count regression test. |
| `property-form-core-fields.test.tsx` | **New.** Validates generic typing renders all 7 fields without cast regressions. |
| `properties-controller-regression.test.tsx` | **New.** 9 tests: count badge, zero count, desktop/mobile parity, modal open/close, archive flow, filter/search rendering. |
| `units-controller-regression.test.tsx` | **New.** 14 tests: KPI computation, status normalization, desktop/mobile parity, filters, modal lifecycle, navigation. |

### Decisions

- `PropertyFormCoreFields` uses `Path<T>` for register calls. This is the narrowest type-safe approach that works with both `PropertyWithAgreementFormValues` and `PropertyEditFormValues` without requiring the caller to cast.
- `navigateToProperty` was removed from the units controller because the units page only navigates to unit detail, never directly to property detail.
- The zero-count bug was caused by `count={ctrl.totalCount || undefined}` converting `0` to `undefined`. Fixed with `count={ctrl.totalCount}`; `PageHeader` already guards with `count !== undefined`.

### Schema / backend contract boundary

No changes to:
- Database schema, migrations, RLS policies
- RPC signatures or financial calculations
- Auth implementation or permissions
- Supabase service-layer contracts

### Verification contract

Run from the repository root:

```bash
pnpm typecheck
pnpm lint
pnpm --filter ./rentrix-app run typecheck:test
pnpm --filter ./rentrix-app run check:architecture
pnpm --filter ./rentrix-app test
pnpm --filter ./rentrix-app run test:financials
pnpm build
```

Browser acceptance covers 360×800, 390×844, 430×932, 768×1024, and 1440×1000 in light/dark Arabic RTL. It asserts: mobile cards render for every list row, filter selects have all expected options, search inputs have correct placeholders, create modals expose agreement fields, edit modals do not show agreement fields, and navigation targets are correct. Exact-head CI results belong in the PR and #1155; this section records the durable scope and command contract.
