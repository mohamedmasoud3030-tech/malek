# MALEK Frontend ↔ Backend Contract Hardening

This document describes the CI contract after PR #1590 and the follow-up hardening phase.

## Fast PR gates

Every pull request to `main` must prove:

1. TypeScript application typecheck.
2. Architecture guard.
3. Full migration chain ↔ generated `src/types/database.ts` parity.
4. Production frontend Supabase discovery ↔ generated database contract parity.
5. Zero **unreviewed** dynamic Supabase contracts. The small reviewed dynamic inventory is occurrence-counted and fails closed if it changes.
6. Targeted runtime frontend/backend contract scenarios for payment, receipt/accounting safety, period close, owner settlements, OMR precision, and lifecycle workflows.
7. Six-role behavioral RLS / cross-company isolation matrix in disposable PGlite.
8. Production bundle build.

## Dynamic contract policy

Ordinary `supabase.from()` and `supabase.rpc()` usages must be statically discoverable.

When a call cannot be fully resolved by the fast scanner, it is not silently ignored. It must be covered by the reviewed dynamic gate. That inventory is keyed by source path, operation, relation/RPC, and expected occurrence count. Any new dynamic usage, stale inventory item, or changed occurrence count fails CI.

The receipt enrichment helper is the only reviewed generic table-name helper. Its allowed targets are explicitly limited to `invoices`, `contracts`, `units`, `properties`, and `people`; the exact required columns are checked against `database.ts`.

Comment-only scanner examples are excluded as scanner noise. Literal targets obscured only by a TypeScript `as` assertion are resolved and checked as literal database relations.

## Runtime and RLS safety

All runtime database and RLS checks use local/disposable test infrastructure. No PR compatibility gate writes to the hosted production Supabase project.

The six canonical roles are:

- `ADMIN`
- `MANAGER`
- `ACCOUNTANT`
- `OPERATIONS`
- `USER`
- `VIEWER`

The RLS matrix also proves cross-company denial boundaries.

## Release principle

A frontend/backend compatibility change is acceptable only when the CI chain is green and reports no frontend/database mismatch and no unreviewed dynamic contract.
