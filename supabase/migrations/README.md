# Active Supabase migrations

This directory is the **only active migration source** for Rentrix.

`supabase/migrations_consolidated/` is a read-only historical/rebuild archive. Do not add active migrations there and do not edit its SQL files to represent new work.

## Naming and immutability

Every active file must match:

```text
<14-digit-timestamp>_<snake_case_name>.sql
```

Once a migration is merged to `main`, treat it as immutable. Corrections are new forward-only migrations.

## Baselines

Two different artifacts exist for different purposes:

- `20250101000001`–`20250101000005` are the reconstructed application baseline registered as already applied.
- `20260705000000`–`20260705000002` capture the formerly untracked live enums/tables and close the historical schema-capture gap identified on 2026-07-05.

The baseline capture is complete in repository history. It does not remove the need to verify a specific target environment before deployment.

## Current reconciliation model

Repository history also contains:

- executable forward fixes,
- intentional no-op continuity migrations,
- comment-only stubs for migrations whose effects already existed under out-of-band/timestamped ledger versions,
- guarded QA cleanup and reversal migrations.

A comment-only stub documents ledger history; it must not replay an already-applied effect.

Known examples include the reconciliation stubs for `20260712081006` and `20260712081017`, plus the timestamped QA reversal history captured around `20260712080434`.

## Important special cases

### Intentional no-op

`20260628000000_fix_find_payment_account_id.sql` is intentionally a no-op. The underlying correction was applied under a different production version and the file remains for changelog continuity.

### Payment-backed collection reporting

`20260706101000_align_payment_receipt_reporting_source.sql` defines daily collection from `public.payments`, requires an authenticated app user, and excludes deleted/VOID rows. Confirm whether it is applied to the intended target before relying on it.

### Tenant identity

The canonical tenant identity is `public.people`. The guarded foreign-key repair is represented by:

```text
20260712020000_fix_tenant_balances_people_fk.sql
```

Do not create new financial relationships against the legacy `public.tenants` table.

### QA accounting cleanup

Posted journal history is immutable. QA cleanup that reaches posted accounting rows must use balanced reversal entries, not deletion or mutation of posted rows.

## Required workflow

Before a schema/RPC/RLS change:

1. Read `docs/ENGINEERING_GOVERNANCE.md`.
2. Confirm the active branch and latest `main`.
3. Run read-only target inspection.
4. Compare the local migration list with `supabase_migrations.schema_migrations`.
5. Check live column types, constraints, indexes, policies, grants, triggers, and function definitions relevant to the change.
6. Write one focused forward migration.
7. Obtain the specific production approval required by `docs/GOVERNANCE.md`.
8. Apply through the approved migration path.
9. Regenerate database types when schema contracts changed.
10. Run the full quality suite and record the mutation in `docs/GOVERNANCE_LOG.md`.

## Evidence commands

```bash
pnpm supabase:migration-evidence
pnpm supabase:live-readiness
```

The live-readiness command requires `SUPABASE_DB_URL` and `psql`. Without them, do not claim target-environment parity.

## Never infer deployment from files

A migration file proves that a change is represented in source control. It does not prove:

- that it was applied to staging or production,
- that the ledger version matches the intended filename,
- that the live function body matches the file,
- or that RLS/grants are correct.

Release proof must be captured for the exact release-candidate SHA. See `docs/RELEASE_READINESS.md`.
