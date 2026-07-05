# Rentrix Decision Register

Use this directory for durable product and architecture decisions that future agents must not reopen casually.

## Active decisions

### ADR-001 — Single-office product only

Rentrix is a single-office property operations system. SaaS multi-tenancy is outside the active product scope. Do not add organizations, memberships, invitations, subscriptions, or organization-scoped runtime behavior.

### ADR-002 — Defer accounting-grade ledger

Do not wire a general accounting ledger during stabilization and release-readiness work. The approved operational flow is properties, units, people, tenants, owners, contracts, invoices, payments, receipts, expenses, arrears, and reports. `/accounting` remains a redirect to `/financials`.

### ADR-003 — Active app boundary

The active application lives under `rentrix-app/`. Legacy or archived code is a review source only. Reuse requires deliberate adaptation to the current architecture. `.migration-backup/`, `artifacts/rentrix/legacy-src/`, and `archive/recovery-reference/` are not present in the current checkout; use git history for removed historical references.

### ADR-004 — Canonical financial calculations

Balances and arrears are derived through one canonical calculation path. Posted payment corrections use reversal and replacement rather than silent historical edits.

### ADR-005 — Constrained-beta navigation visibility

Visible navigation follows the active snapshot in `docs/ai/ONBOARDING.md`. Routes must not be exposed as placeholders or dead navigation. The historical constrained-beta navigation ADR was removed from active docs and remains available through git history.

### ADR-006 — Approved planned modules stay single-office

Lands, leads, commissions, and internal communication are approved Rentrix modules inside the single-office product boundary. They must not introduce SaaS multi-tenancy, organizations, subscriptions, a broad accounting ledger, or external-provider sends.

### ADR-007 — First-client v0.4 module scope

Use `docs/FIRST_CLIENT_DELIVERY_PLAN.md` for current first-client sequencing. The historical v0.4 scope ADR was removed from active docs and remains available through git history.

### ADR-008 — Unified Table and Entity Card System

All list pages use `EntityTable` (replacing manual `Table` primitive usage and the unused `DataTable`). All person/owner display uses `EntityCard` (replacing `PersonCard` and `OwnerCard` over time). All list pages use `ListPage` scaffold. Full spec in `docs/decisions/ADR-008-unified-ui-components.md` and usage guide in `docs/ai/UI_COMPONENT_GUIDE.md`.

### ADR-009 — Dead Code Removal: DataTable, layouts/ shims, lib/db, lib/api-client-react

The following are confirmed dead code and must be removed in a dedicated cleanup PR:

- `rentrix-app/src/components/shared/DataTable.tsx` — generic table component, zero usages in pages, replaced by `EntityTable` (ADR-008)
- `rentrix-app/src/layouts/` folder — re-export shims only; `routes/_protected.tsx` and `routes/_auth.tsx` must be updated to import from `@/components/layout/` directly, then the shim folder deleted
- `lib/db/` workspace package — Drizzle ORM setup, zero imports from app
- `lib/api-client-react/` workspace package — HTTP client, zero imports from app

These must not be deleted without first verifying `pnpm build` passes without them.

## Open product decisions required

The following decisions still require explicit approval before implementation:

| Decision | Needed for |
| --- | --- |
| External communication or notification sends | Provider integration and outbound messaging |
| Owner payout or settlement workflows | Advanced owner settlement modules |
| General accounting-grade ledger | Balance sheet, accounting-grade P&L, journal-entry UI expansion |
| SaaS or shared-database multi-tenancy | Organizations, memberships, invitations, subscriptions |

## Adding a decision

Add a short ADR file when changing a durable boundary. State the context, decision, consequences, and explicit exclusions. Link the new ADR from this index.
