---
name: database
description: Use for MALEK SQL, migrations, RPCs, RLS, grants, indexes, schema design, Postgres performance, or frontend-database contracts. Enforces DATABASE_RULES.md, tenant isolation, forward migrations, SECURITY DEFINER discipline, regression tests, and database gates.
---

# Database

For any database-sensitive task, `DATABASE_RULES.md` is mandatory and outranks generic Postgres/Supabase advice.

## 1. Establish reality

1. Read `DATABASE_RULES.md`, `AGENTS.md` and relevant data/security/accounting rules.
2. Inspect migrations, functions, policies, grants, generated types and frontend consumers before editing.
3. Hosted-state claims require authorized inspection; repository state is not deployment proof.
4. Classify the change: schema, data migration, RPC, RLS/grant, query/index performance, generated contract or cleanup.

## 2. Safe change

- Use a new forward migration; never rewrite an already-merged migration.
- Keep company-owned rows scoped by `company_id` and RLS.
- Authorization uses MALEK's canonical role/permission resolvers and fails closed.
- Browser-executable `SECURITY DEFINER` functions pin `search_path`, validate identity/company/permission context and expose minimum EXECUTE grants.
- Financial mutations remain atomic and server/RPC-governed.
- Keep one canonical writable representation; no permanent `v2`, sprint- or phase-named DB surfaces.
- Destructive/narrowing changes require migrated-consumer/data proof plus recovery/cutover.

## 3. Prove correctness

Add the smallest regression coverage that proves the invariant. Tenant/RLS work must prove allowed same-company behavior, denied cross-company behavior, denied invalid membership/context where applicable, correct role/permission behavior and no unintended grant widening.

For query/index changes, inspect the actual access pattern and use `EXPLAIN (ANALYZE, BUFFERS)` or equivalent evidence when available instead of speculative indexes.

## 4. Synchronize contracts

Regenerate/check DB types as required, update `rentrix-app/scripts/check-frontend-db-contract.mjs` when frontend DB usage changes, verify consumers, and remove superseded wrappers/contracts only after proving no remaining consumer.

## 5. Gates

Database work commonly needs `pnpm db0:gate`, `pnpm db:guardian`, `pnpm test:supabase` and `pnpm --filter ./rentrix-app run check:frontend-db-contract`. Hosted QA is separate and only run when authorized credentials exist.

Read `references/postgres-rls-checklist.md`.
