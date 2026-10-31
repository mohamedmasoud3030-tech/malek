---
name: database-postgres-rls
description: Use for SQL, migrations, RPCs, RLS policies, grants, indexes, schema design, Postgres/Supabase performance, or frontend-database contracts in any portfolio repo. Enforces the repo's own DB rules doc first, tenant isolation, forward-only migrations, SECURITY DEFINER discipline, regression tests, and declared database gates.
---

# Database — Postgres / Supabase / RLS

For any database-sensitive task, the repo's own DB rules document
(`DATABASE_RULES.md`, `docs/DATABASE_*`, or the DB section of `AGENTS.md`) is
mandatory and outranks generic Postgres/Supabase advice.

## 1. Establish reality

1. Read the repo's DB rules, AGENTS.md, and relevant data/security/accounting docs.
2. Inspect migrations, functions, policies, grants, generated types, and
   frontend consumers before editing.
3. Hosted-state claims require authorized inspection; repository state is not
   deployment proof.
4. Classify the change: schema · data migration · RPC · RLS/grant ·
   query/index performance · generated contract · cleanup.

## 2. Safe change

- New **forward** migration only; never rewrite an already-merged migration.
- Owned rows stay scoped by tenant key (`company_id`/`org_id`) and RLS.
- Authorization fails closed; `SECURITY DEFINER` functions pin `search_path`,
  validate identity/tenant/permission context, and expose minimum EXECUTE grants.
- Financial mutations remain atomic and server/RPC-governed.
- One canonical writable representation; no permanent `v2` or sprint-named surfaces.
- Destructive/narrowing changes require migrated-consumer/data proof plus a
  recovery/cutover note.

## 3. Prove correctness

Smallest regression coverage that proves the invariant. Tenant/RLS work must
prove: allowed same-tenant behavior · denied cross-tenant behavior · denied
invalid membership/context · correct role behavior · no unintended grant
widening. For query/index changes, use `EXPLAIN (ANALYZE, BUFFERS)` evidence
where available instead of speculative indexes.

## 4. Synchronize contracts

Regenerate/check DB types as the repo requires, update frontend-DB contract
checkers when usage changes, verify consumers, and remove superseded wrappers
only after proving no remaining consumer.

## 5. Gates

Run the repo's declared DB gates (typecheck, contract checks, migration-chain
checks, live QA only with authorized credentials). Missing gate = report the
gap; never silently pass.

> 🏛️ Portfolio binding: canonical master lives in `command-center-/skills/`.
