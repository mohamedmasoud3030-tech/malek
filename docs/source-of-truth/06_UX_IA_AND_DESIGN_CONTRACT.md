# MALEK Canonical Pack — Document 6: UX, IA, and Design Contract

> **Status:** CANONICAL  
> **Baseline:** `main@8ada4e7eb81fbad3d19f5603626f699b5e10d8d5`

## UX contract

MALEK is Arabic-first, RTL and mobile-conscious, but desktop remains a first-class operational surface. IA is defined by the implemented route/navigation contract, not by stale screenshots or legacy page names.

## Canonical UX/IA rules

| Rule ID | Canonical rule |
|---|---|
| `UX-001` | The interface is Arabic-first/RTL, responsive and mobile-conscious; dense operational screens must remain usable on both phone and desktop. |
| `UX-002` | Canonical navigation/routes follow `route-contract.ts` and `route-tree.ts`; aliases/views preserve compatibility instead of inventing duplicate page authorities. |
| `UX-003` | Financial operations use the `/financials` hub plus canonical `/finance/*` section routes/view bindings; legacy `/invoices`, `/receipts`, `/expenses`, `/deposits`, etc. are compatibility surfaces, not separate information architectures. |
| `UX-004` | `/reports` (Accounting & Reports) remains a distinct top-level workspace and must not be visually or conceptually collapsed into Financials. |
| `UX-005` | People is the navigation root for people/owners/tenants and related interactions; owner/tenant dossiers may have first-class routes while remaining part of the People domain. |
| `UX-006` | Maintenance/Services is an operational root; Service Providers is a company-scoped subordinate workflow with its own list/detail/create/edit routes and permissions. |
| `UX-007` | AI Assistant is a separate `/ai-assistant` route; it is not embedded as accounting authority or a Reports tab. |
| `UX-008` | Shared design tokens/components, company-aware money/date formatting, accessible states, printing/document guards and consistent loading/empty/error/permission states form one design contract; parallel token systems and hidden unsafe handlers are not allowed. |

## Current canonical route reality

Evidence: `rentrix-app/src/app/navigation/route-contract.ts`.

### Top-level operational roots

- `/dashboard`
- `/people`
- `/properties`
- `/lands`
- `/contracts`
- `/maintenance` (conceptually Services)
- `/financials`
- `/commissions`
- `/reports`
- `/ai-assistant`
- `/settings`

Not every route above is equally release-critical. Presence in the route contract proves the implemented navigation surface, not completion of its business lifecycle.

### Route disposition matrix

| Surface | URL/behavior at baseline | Visible navigation owner | Disposition |
|---|---|---|---|
| Dashboard | `/dashboard` renders | Dashboard | CANONICAL |
| People | `/people`; owner/tenant/leads/communication first-class child routes | People | CANONICAL |
| Properties/Units | `/properties`; `/units` redirects to `/properties?section=units` | Properties | CANONICAL + COMPATIBILITY redirect |
| Lands | `/lands` and detail route | Lands | CANONICAL but not automatically pilot-critical |
| Contracts | `/contracts` and create/detail/edit | Contracts | CANONICAL; canonical DB approval path not fully wired in UI |
| Financials | `/financials`; `/finance/*` and legacy finance URLs redirect/bind to section/view search | Financials | CANONICAL HUB + COMPATIBILITY routes |
| Reports | `/reports`; `/accounting` redirects to Reports accounting view | Reports | CANONICAL + COMPATIBILITY redirect |
| Services | `/maintenance`; `/utilities` redirects to maintenance view; Service Providers have first-class CRUD routes | Services | CANONICAL + COMPATIBILITY redirect |
| Settings/admin | `/settings`; `/system`, `/audit-log`, `/data-integrity`, `/automation`, `/change-password` redirect to settings sections | Settings | CANONICAL HUB + COMPATIBILITY routes |
| AI Assistant | `/ai-assistant` redirects to `/dashboard?globalAction=ai-assistant`; shell opens a global overlay | no primary nav item | CONFLICT with `PRD-008/UX-007`; `GAP-023` |
| Documents Vault | `/documents-vault` redirects to `/maintenance?section=documents_vault`; `documents_vault` is a real Operations Hub section (embedded DocumentsVaultWorkspace) acting as the aggregate documents authority, while contextual entity-level panels on properties/owners/units/contracts/maintenance remain complementary | no primary nav item | CANONICAL HUB + COMPATIBILITY redirect (was CONFLICTING/legacy surface under `UX-008/GAP-020`) |
| Dev design system | `/dev/design-system`, DEV-only | none | HIDDEN development surface, not product IA |

### People domain

- `/people`
- `/owners`, `/owners/$ownerId`, `/owners/$ownerId/edit`
- `/tenants`, `/tenants/$tenantId`
- `/leads`
- `/communication`

Owners and tenants remain dossiers/workspaces under the People navigation root rather than being treated as unrelated products.

### Properties and assets

- `/properties`, create/detail/edit
- `/units` binds into the Properties section
- `/lands` is a separate first-class asset route where implemented

### Services

- `/maintenance`
- `/service-providers`, create/detail/edit
- `/utilities` as an operational section/view
- `documents_vault` is an Operations Hub section (embedded `DocumentsVaultWorkspace`); `/documents-vault` redirects to `/maintenance?section=documents_vault`

### Financials

Canonical section routes bind into the Financials hub:

- `/finance/collections`
- `/finance/expenses`
- `/finance/deposits`
- `/finance/banking`

Compatibility routes such as `/invoices`, `/receipts`, `/expenses`, `/arrears`, `/deposits`, `/owner-settlements` and `/bank-reconciliation` bind to hub sections/views. Documentation must not invent non-existent routes such as `/financials/receipts` when the route contract uses a hub/view binding instead.

### Reports and AI

`/reports` is independent. The approved target keeps `/ai-assistant` independent from Dashboard and from accounting authority. The baseline implementation instead treats the URL as a legacy deep-link into the single global overlay (`route-tree.ts` and `ai-assistant-global-action.tsx`), so this is an explicit conflict rather than a verified rule.

## Dossier contract

Owner, tenant, person and property detail surfaces present operational context, related contracts/documents/activity and carefully labeled financial context. They do not relabel tenant receivables as owner balances or display unscoped activity from another entity/company.

## Permission UX

Navigation visibility and button state must reflect effective permission, but the backend remains authoritative. A user with a granted write capability should not see a global “read-only” message that contradicts their effective grant; unrelated actions remain individually gated.

Permission requests that require action must be visibly actionable, with enough requester/permission/state/reason context to review them without guesswork.

## Mobile/desktop behavior

- Desktop (≥ 1024px) uses a right-side collapsible sidebar generated from `navGroups`/workspace children.
- Tablet / iPad (768–1023px) is a first-class class: header hamburger + header search, no floating bottom control, dense registers, and two-column composition. It must not be treated as a stretched phone.
- Phone (< 768px) has no legacy five-item bottom navigation. `mobileNavItems` is empty. The header hamburger and `MobileFloatingControl` (Menu + Search) both open the full permitted drawer. Documentation must not claim a maintenance-priority bottom tab at this baseline.
- Avoid oversized single-column card stacks where a compact 2-column mobile grid is clearer. Metric groups stay 2 columns below 1024px and may open to 4 columns on desktop.
- Long contract/agreement forms may use mobile steppers while desktop retains an efficient single-scroll workflow.
- Shared entity registers render a dense semantic table on desktop/tablet (≥ 768px) and, below 768px, a true mobile register presentation: each record shows identity, one meaningful primary/secondary datum (status/amount/date), and a compact accessible «إجراءات» menu containing only the record's existing actions. Mobile registers never use horizontal scrolling, clipped labels, overlapping RTL text, disclosure/expansion rows, sticky action columns, or bulk expand-all controls.
- Safe-area/sticky actions must not hide validation or prevent access to submit/cancel.
- Page headers, dossier headers, register cards and list controls share one elevated surface (`rounded-2xl` / token radius) so remaining workspaces do not invent a second chrome.

## Design system

Use the repository’s canonical design tokens/shared enterprise components. Do not create a second token layer for one feature. Money uses company-aware formatting and the canonical OMR precision contract; hard-coded currency/decimal presentation is not authoritative.

Evidence includes `rentrix-app/src/index.css`, `rentrix-app/src/components/ui/**`, `rentrix-app/src/components/enterprise/**`, shared layout components and company formatters. The `enterprise/*` component name is historical; it does not authorize a second design system. New features must reuse the active tokens/components and respect the repository enterprise-freeze guard.

## State contract

Every protected/loaded surface must have intentional loading, empty, error and permission-denied states. A route must not render a blank screen merely because a query failed or data is absent.

## Printing and documents

Print/PDF controls require real company/document readiness. Guard the action handler as well as the visible button; hiding/disabling a button is not sufficient if the handler can still run through another path. Signed versions and generated financial/legal documents must preserve the correct company, party, currency and data snapshot.

Repository evidence includes `pdfService.ts`, report/document generators and targeted tests. It does not prove Arabic font rendering, pagination, signatures, totals or legal layout in the deployed browser; the cancelled Browser Readiness run leaves this under `GAP-020`.

## Accessibility

Text contrast, focus order, keyboard interaction, dialog labeling, touch targets and semantic tables/forms must remain compatible with WCAG-oriented enterprise use. Small helper text must not become unreadable simply to reduce density.

## Evidence anchors

- `rentrix-app/src/app/navigation/route-contract.ts`
- `rentrix-app/src/app/router/route-tree.ts`
- `rentrix-app/src/app/navigation/app-nav-items.test.ts`
- `rentrix-app/src/app/navigation/legacy-compatibility.test.ts`
- `rentrix-app/src/features/auth/permissions.ts`
- visual/IA decisions in `docs/decisions/` and `docs/ui-ux/`

Actual implementation/verification gaps are owned by Document 7 rather than hidden inside this design contract.
