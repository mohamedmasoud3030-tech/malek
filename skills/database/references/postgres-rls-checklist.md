# PostgreSQL and RLS checklist

Use only after `DATABASE_RULES.md`.

## Performance

Inspect query shape/cardinality before indexing; check filters, joins, ordering and pagination against existing indexes; avoid unbounded projections; prefer batching over N+1; measure material changes when possible.

## Schema/concurrency

Preserve MALEK data invariants, including `numeric(18,3)` for authoritative OMR money unless documented otherwise. Keep true uniqueness/referential invariants in the DB. Keep transactions short, define lock order/retry behavior and make retried commands idempotent.

## RLS/privilege

Application filtering is not tenant isolation. Keep RLS fail-closed, index hot predicate columns when evidence justifies it, treat `SECURITY DEFINER` as a trust boundary, use minimum grants and test an other-company/malicious actor.

## Research basis

- Supabase Postgres best practices: https://github.com/supabase/agent-skills/blob/main/skills/supabase-postgres-best-practices/SKILL.md
- Supabase RLS performance: https://github.com/supabase/agent-skills/blob/main/skills/supabase-postgres-best-practices/references/security-rls-performance.md
