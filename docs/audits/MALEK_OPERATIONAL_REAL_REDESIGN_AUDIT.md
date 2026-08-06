# MALEK Operational Real Redesign — Execution Audit

Date: 2026-08-06
Branch: `fix/ui-malek-pro-visual-wave-2-real-redesign`
PR: #1359
Base at creation: `f84dc96d6d5698af227f226e03ca2cfb00a06f7b`

## Goal

Deliver the visibly different operational redesign that Wave 1 did not achieve, including the agreed create/edit form contract.

## Included

- Properties
- Units
- People
- Tenants
- Owners and non-financial ownership relationships
- Contracts
- Maintenance
- Settings operational surfaces
- Shared layout and entity-form primitives required by those modules

## Parallel task exclusion

PR #1358 / branch `fix/ui-malek-pro-visual-wave-2-finance-reporting` owns Finance and Reporting treatment.

This branch does not modify:

- `rentrix-app/src/features/financials/**`
- `rentrix-app/src/features/reports/**`
- finance hub routes or report routes
- owner settlement pages
- commissions pages
- `rentrix-app/src/styles/finance-reporting-visual-wave.css`
- `rentrix-app/src/styles/globals.css`
- finance calculations, accounting, database, RLS, RPCs, grants, print/PDF
- `docs/decisions/0014-malek-visual-contract-v2-wave-2-finance-reporting.md`

The overlap check was repeated after PR #1358 expanded. The two PRs still have no changed-file overlap.

A second compatibility review found that PR #1358 uses `visualVariant="malek-pro"` on finance pages. Therefore page visual scope and form-surface behavior are intentionally separated: `PageLayout` and `EmbeddableWorkspace` do not infer form behavior from `visualVariant`.

## Implemented page treatment

### Properties

- Added an operational readiness overview calculated from the current real rows.
- Added ready / needs-attention and owner-link visibility.
- Reframed the list/cards as a dedicated property register.
- Preserved search, filters, CSV export, archive, edit and detail navigation.

### Units

- Added an occupancy command panel and live occupancy percentage.
- Added available, occupied, maintenance and expected-rent context from current data.
- Rebuilt the units register header and desktop/mobile result framing.
- Preserved all filters, status rules, navigation and mutations.

### People and tenants

- Added live operational summaries and clearer record hierarchy.
- Tenant cards now expose contract/location/contact context and safe actions.
- People records are framed as a dedicated register with page-honest metrics.
- Preserved current queries, pagination, archive and edit behavior.

### Owners

- Added ownership-link coverage and a split owner-register / relationship workspace.
- Kept owner identity and property ownership separate from settlements and finance.
- Did not modify `owner-settlements-page.tsx` or any settlement logic.

### Contracts

- Replaced generic KPI cards with a contract-lifecycle overview.
- Added active-rate, expiring-soon and visible-rent context from existing rows.
- Reframed contract results as a dedicated operational register.

### Maintenance

- Added urgent/open/in-progress command-center treatment.
- Reframed maintenance results as a request register.
- Preserved print readiness, status actions, create/edit, details and resolve behavior.

### Settings

- Preserved the existing long-form workspace model.
- Added operational visual context to both standalone and embedded settings shells.

## Create/edit form contract

- `rentrix-app/src/routes/_protected.tsx` applies the `operational` form context only when `isOperationalFormRoute(pathname)` returns true.
- The classifier lives outside the generated TanStack Router tree in `rentrix-app/src/lib/operational-form-routes.ts`.
- Included route families are Properties, Units, People, Tenants, Owners, Contracts, Maintenance, Settings, Portfolio and Relationships.
- Finance, Reports, commissions, owner settlements and Dashboard explicitly remain outside the operational form context.
- Operational create/edit overlays resolve to:
  - mobile: Bottom Sheet
  - desktop: Dialog
- Unrelated workflows preserve their previous default surface.
- Person/tenant/owner and unit forms also declare the operational contract explicitly.
- Sticky actions, safe-area handling, focus trapping, focus restoration, invalid-field focus and unsaved-change guards remain intact.
- The isolated browser fixture carries `data-entity-form-variant="operational"` and verifies both responsive surfaces without connecting to data, authentication or finance.

## Visual system

`rentrix-app/src/styles/malek-pro-visual-wave.css` now includes:

- contextual dark operational headers
- stronger list controls and filters
- elevated cards with logical RTL accents
- structured table headers, zebra rows and row focus/hover treatment
- clearer tab treatment
- operational form styling scoped by `data-entity-form-variant="operational"`
- responsive and reduced-motion behavior

## Safety

No business rule, query, mutation, schema, migration, permission, calculation, print, PDF or document-generation behavior was changed.

The only route-level change is presentation context selection; it neither changes destinations nor navigation behavior.

## Verification

Required before review:

- TypeScript typecheck
- lint / architecture checks
- focused form and route-scope tests
- full application tests
- production build
- browser smoke
- route-backed mobile and desktop visual evidence
- final changed-file overlap check against PR #1358
