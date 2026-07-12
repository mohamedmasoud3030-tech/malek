# Database Baseline Guide

## Purpose

`supabase/migrations_consolidated/` contains the normalized PostgreSQL baseline for Rentrix.
It is intended to describe the current verified production database state in a compact, reviewable form.

## Why this exists

The historical migration chain records how the schema evolved over time.
The consolidated baseline records what the database must look like now.

Use cases:

- rebuild a clean environment from the current production baseline
- review the current database shape without replaying the full historical chain
- isolate unapplied future work from the live production definition

## Historical migrations vs. consolidated baseline

### Historical migrations

Location:

- `supabase/migrations/`

Characteristics:

- chronological change history
- includes superseded definitions and intermediate fixes
- includes already-applied production changes and future pending changes

### Consolidated baseline

Location:

- `supabase/migrations_consolidated/`

Characteristics:

- one final production definition per object
- no historical replay content in `0001`–`0004`
- pending changes isolated in `0005_pending_future.sql`

## File layout

1. `0001_core_schema.sql`
   - core schemas, types, tables, final structural definitions
2. `0002_security_rls.sql`
   - role helpers, RLS enablement, policies, grants, access model
3. `0003_functions_triggers_rpcs.sql`
   - functions, triggers, operational RPCs, transactional logic
4. `0004_reports_views_indexes.sql`
   - reporting functions, views, indexes, reporting grants
5. `0005_pending_future.sql`
   - isolated pending migrations, intentionally not part of the active baseline

Supporting reports:

- `CONSOLIDATION_MAPPING.md`
- `CANDIDATES_FOR_REMOVAL.md`

## Deployment order

Apply in this order only:

1. `0001_core_schema.sql`
2. `0002_security_rls.sql`
3. `0003_functions_triggers_rpcs.sql`
4. `0004_reports_views_indexes.sql`

Do **not** apply `0005_pending_future.sql` as part of baseline creation.
It exists only to preserve the isolated future migration set.

## Pending migration handling

The 13 pending migrations remain isolated because they were intentionally excluded from the active production baseline.
They require separate review, test, and deployment approval.

## Rollback considerations

This baseline is intended for clean rebuilds and controlled validation, not as a single-step production rollback tool.

Recommended rollback strategy:

- revert by forward-fix migration, not by manual object deletion
- treat `0005_pending_future.sql` as future work, not rollback input
- keep production rollback plans at the migration/change level rather than at the baseline package level

## Operational guidance

- treat Git as the source of truth for the baseline package
- keep pending work isolated until explicitly approved
- update `CONSOLIDATION_MAPPING.md` whenever the baseline package changes
- update `CANDIDATES_FOR_REMOVAL.md` only when candidate status is still accurate relative to the SQL package
