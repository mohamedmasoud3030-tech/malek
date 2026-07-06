---
name: supabase-data-contracts
description: Use for Rentrix changes involving Supabase migrations, RLS policies, RPCs, views, generated database types, service-layer database calls, or UI/data contract alignment. Do not use for isolated frontend-only styling or documentation changes that do not depend on database behavior.
---

# Supabase Data Contracts

Apply this skill whenever Rentrix code depends on Supabase schema, permissions, RPC behavior, or database-backed service contracts.

## Required workflow

1. Identify the source of truth before editing: live Supabase schema, migration files, generated types, service layer, or UI assumptions.
2. For migrations, RLS, RPCs, and views, compare the intended contract across:
   - `supabase/migrations/`
   - generated TypeScript database types when present
   - feature service files
   - UI consumers and tests
3. Verify soft-delete, VOID, reversal, and permission behavior when the affected entity supports those states.
4. Do not apply a migration to production without a clear run plan, expected impact, rollback/mitigation notes, and explicit approval path.
5. Do not rely on generated TypeScript types alone when live schema accuracy matters; verify live schema/RLS/RPC definitions when required by the task.
6. Document any mismatch found between migrations, live schema, service code, and UI behavior.

## Completion standard

A database-backed change is not ready until the migration/RLS/RPC/view contract, service layer, UI expectations, and tests all agree, or every remaining mismatch is documented as a known risk.
