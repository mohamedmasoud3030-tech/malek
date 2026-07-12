# supabase/migrations_consolidated — Historical Artifact

> **This directory is a read-only reference archive. It is not the active
> migration source and must never be executed or included in any deployment
> pipeline.**

## Active migration source

**`supabase/migrations/`** is the only active Supabase migration source for
this project. All CI scripts, the `pnpm supabase:migration-evidence` command,
and the Supabase CLI operate exclusively on that directory. Every new migration
must be placed there using the standard `<14-digit-timestamp>_<name>.sql`
filename convention.

## What this directory is

`supabase/migrations_consolidated/` is a historical consolidation artifact
produced during a schema audit pass. It contains a set of numbered SQL files
(`0001`–`0005`) that represent a point-in-time consolidated snapshot of the
schema, plus two mapping documents:

- `CONSOLIDATION_MAPPING.md` — maps each individual migration in
  `supabase/migrations/` to the consolidated file it was absorbed into.
- `CANDIDATES_FOR_REMOVAL.md` — documents functions that were reviewed but
  explicitly preserved.

These files exist for audit traceability and human reference only. They were
never registered in `supabase_migrations.schema_migrations` and are not tracked
by any migration runner.

## What this directory is not

- It is **not** an alternative or replacement for `supabase/migrations/`.
- It is **not** executed by the Supabase CLI, `supabase db push`, or any
  CI/CD pipeline step.
- It is **not** a source of truth for the live database schema — always verify
  against the live Supabase project (`nnggcnpcuomwfuupupwg`) via MCP or the
  dashboard.
- The SQL files here must **not** be applied to production. Doing so would
  re-execute DDL that is already live, causing errors or data corruption.

## Do not

- Point `supabase db push` or `supabase migration up` at this directory.
- Add this directory to any deployment pipeline or CI migration step.
- Treat `0005_pending_future.sql` as unapplied work — the individual source
  migrations it references are already applied via `supabase/migrations/`.
