# Technical Debt Audit — Verified Corrections (2026-08-05)

**Status:** Verified against `main` at `f8e5556315b2ad2e76cfdd2a84431438e0932543`  
**Authority:** Repository evidence only. Live Supabase Advisor counts require a fresh connected read before use.

## Executive decision

This audit replaces the earlier draft in this file. The earlier version mixed valid findings with stale production snapshots and unsupported recommendations. No destructive database action may be based on the old counts.

## Confirmed findings

| Priority | Finding | Verified evidence | Required action |
|---|---|---|---|
| P0 | Sonar coverage is effectively disabled for application TypeScript | `sonar.coverage.exclusions` includes `**/*.ts` and `**/*.tsx` | Narrow coverage exclusions and publish a real baseline before setting targets |
| P0 | Bank CSV Stage 4 is not fail-closed as documented | Client sends only `validRows`; RPC records `rejected_rows = 0`; insert loop catches `WHEN OTHERS` and continues | Forward-only integrity migration, client guard, actual insert-count verification, behavioral DB test |
| P1 | Bank balance precision is incompatible with OMR | `bank_statement_lines.balance numeric(14,2)` | Upgrade additively to 3-decimal precision before downstream financial matching/posting relies on it |
| P1 | Master Lease obligations are not materialized as a contractual schedule | Canonical accounting policy exists, but no complete obligation-schedule workflow exists | Build business obligation schedule before posting rules |
| P1 | Tenant deposit/balance deletion protection is incomplete | No verified tenant-equivalent guard matching the owner balance guard was found | Add a company-scoped, fail-closed guard after defining exact tenant identity boundaries |
| P1 | Split maintenance allocation is not implemented in the active RPC | `resolve_maintenance_with_expense(p_request_id, p_cost, p_notes)` has no owner/tenant split arguments | Design allocation model and replace through a new audited RPC; do not claim backend support exists |
| P2 | Document reference backfill uses row-by-row loops | `20260805000000_business_document_references.sql` | Keep for current volumes; benchmark before any large production backfill and replace with a reviewed set-based strategy if needed |
| P2 | `PageHeaderActions` mounts secondary actions in desktop and mobile trees | Same `secondaryActions` React node is rendered twice | Render a single responsive action model or prove duplicated mounts are side-effect free |

## Findings that were stale or unsupported

### Search-path warning

The previous draft said `audit_journal_entry_insert()` still needed a pending search-path migration. That is false on current `main`. Migration `20260730091000_reconcile_audit_journal_trigger_security.sql` already defines:

```sql
security invoker
set search_path = public, pg_temp
```

A live production database may still differ, but that requires a new direct production read; repository state must not be described as pending.

### Supabase Advisor counts

The counts `224 / 79 / 62 / 63` came from an older status snapshot and were not re-queried for this PR. They are not current evidence. In particular:

- Do not drop “63 unused indexes” from a stale Advisor snapshot.
- Every proposed index removal requires workload evidence, dependency review, and a separately reviewed migration.
- Auth/RLS performance recommendations require current policy definitions and query plans.

### Identifier types

Canonical source schema defines `contracts.id` as UUID. Some captured or historical environments may contain text drift, but the repository-wide statement “contracts.id is text” is inaccurate. Any type-alignment work must begin with a live schema diff and must not assume one environment represents all supported paths.

### Multi-tenant isolation

The old draft described core company isolation as broadly incomplete. Current `main` contains the P0 isolation remediation and company-scoped RPC hardening. Remaining work must be recorded per table/function with executable evidence, not as a blanket claim.

## Verified execution order

1. Correct and merge documentation only after every claim has repository or live evidence.
2. Repair Stage 4 bank-import integrity before any accounting/reconciliation workflow consumes imported balances or batch counts.
3. Establish the property operating model and contractual schedules.
4. Connect verified business events to the canonical Stage 3 general ledger.
5. Run a fresh live Advisor/readiness audit before performance or production-only recommendations.

## Prohibited shortcuts

- No historical migration rewrites.
- No index drops from stale Advisor counts.
- No claim that green CI proves Markdown accuracy.
- No accounting posting derived from an unverified bank import batch.
- No conversion of canonical UUIDs based only on environment-specific drift.
