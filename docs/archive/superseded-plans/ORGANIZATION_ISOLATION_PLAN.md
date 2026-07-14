# Organization isolation plan

> Archived on 2026-07-14. Rentrix is intentionally a single-office product; this speculative multi-organization plan is not approved scope and must not be used as an implementation queue.

Rentrix is currently hardened as a single-office ERP. This plan defines the future multi-organization sequence without changing business logic in the current hardening pass.

## 1. `organizations` table

Create a canonical `public.organizations` table with immutable `id`, display name, status, timestamps, and soft-delete metadata. Do not repurpose company settings as the tenant boundary.

## 2. `organization_id` migration

Use expand-contract migrations:

1. Add nullable `organization_id` columns to organization-scoped tables (`properties`, `units`, `tenants`/`people`, `contracts`, `invoices`, `payments`, `receipts`, `journal_entries`, `expenses`, `owner_balances`, `owner_agreements`, `maintenance_records`, reports support tables, and bank reconciliation tables).
2. Add non-blocking indexes on each new `organization_id` column.
3. Keep existing RLS policies until backfill and app writes are verified.

## 3. Data backfill

Backfill all existing production rows to one verified organization in a dedicated data migration/runbook. Validate row counts before and after. Do not mix schema changes and large backfills in the same migration.

## 4. JWT claims

Extend the custom access-token hook/session profile contract to include an `organization_id` claim, and define how admins switch organizations if that becomes a product requirement.

## 5. RLS replacement strategy

After every scoped row has an organization id and every app write includes it, replace role-only policies with predicates comparing row `organization_id` to the authenticated organization claim. Keep admin/manager permissions as operation-level checks, not tenant-boundary substitutes.

## 6. Two-organization security tests

Add database/RPC tests with two organizations:

- User from organization A cannot read organization B rows.
- User from organization A cannot write/update/delete organization B rows.
- SECURITY DEFINER RPCs must reject payloads that cross organization boundaries.
- Reports must aggregate only the caller's organization.
