# supabase/migrations

## Filename convention

Every file must be named `<14-digit-timestamp>_<snake_case_name>.sql`, matching
`^[0-9]{14}_.+\.sql$`. This is enforced by evidence-gathering in
`scripts/collect-supabase-migration-evidence.sh` (run in CI via
`pnpm supabase:migration-evidence`), which flags any file that doesn't match.

## The `20250101000001`–`20250101000005` baseline

These 5 files are a **reconstructed snapshot** of the schema as it stood after
PR #916 ("rebuild migrations as code-first clean baseline"), not a literal
replay of the individual migrations that were actually run against production
up to that point. They were originally named `0001`–`0005`, which broke the
timestamp convention above; they were renamed to `20250101...` (a date
guaranteed to sort before every real migration in the live ledger) and
registered as already-applied in `supabase_migrations.schema_migrations`
(metadata-only insert, no DDL re-run — the schema they describe is already
live).

**They do not cover the full live schema.** As of 2026-07-05, the live
`nnggcnpcuomwfuupupwg` project has 54 tables in `public`; these files plus the
13 files after them account for 23 of them. The remaining ~31 tables
(`tenants`, `sessions`, `automation_jobs`, `leads`, `commissions`, etc. — full
list in `docs/CURRENT_STATE.md`) exist live but were, until this pass, never
captured in any migration file. That gap is being closed by three files dated
`20260705000000`–`20260705000002` (enum types + `users` compatibility, then
the 4 live-data tables, then the 27 empty/scaffolding tables — see
`docs/CURRENT_STATE.md`, "Baseline capture strategy and ordering", for why
they're split and ordered this way). A related finding from the same pass:
9 enum types existed live but weren't created by any migration and weren't
used by any column either — confirmed zero usage anywhere on 2026-07-05
(see `docs/CURRENT_STATE.md`) and dropped from production the same day via
`20260705000003_drop_orphaned_enum_types.sql`. Always verify against the
live project (via Supabase MCP
`list_tables` / `execute_sql` on `information_schema`) before assuming a
table, column, function, or type does or doesn't exist.

## Files applied live on 2026-07-05

- `20260616090000_complete_planned_product_modules.sql` (creates
  `communication_records`) — applied via `apply_migration`, confirmed live.
- `20260703010000_contract_documents.sql` (creates `contract_documents`) —
  applied via `apply_migration`, confirmed live. The file's `contract_id`
  column was corrected from `uuid` to `text` before applying, to match the
  live `public.contracts.id` column type (see the file's own header comment
  for the drift detail).
- `20260705000003_drop_orphaned_enum_types.sql` (drops the 9 orphaned enum
  types documented below and in `docs/CURRENT_STATE.md`) — applied via
  `apply_migration`, confirmed dropped from `pg_type`.

## `20260628000000_fix_find_payment_account_id.sql`

Intentional no-op (`SELECT 1;`). See the file's own header comment — the bug
it targets was already fixed live under a different migration name. Left in
place for changelog continuity; do not delete or "restore" its original body.

## Historical ledger noise

The live `supabase_migrations.schema_migrations` table has a small number of
duplicate-named rows from past incidents (same migration applied twice under
different generated versions, some with a `_dup1` suffix). This is a fact of
production history and is not rewritten — see `docs/CURRENT_STATE.md` for the
specific entries. It has no effect on the current schema; the migrations were
idempotent or corrective and simply ran more than once.

## 2026-07-06 payment/receipt reporting alignment

`20260706101000_align_payment_receipt_reporting_source.sql` defines `rpt_daily_collection` on `public.payments`, requires an authenticated app user via `public.is_app_user()`, and excludes soft-deleted and VOID rows. Do not apply it to production without explicit approval and staging verification.

## 2026-07-18 canonical ledger reconciliation

`supabase/migrations/` is the only active migration source. The historical
`supabase/migrations_consolidated/` snapshot was removed because it duplicated
and contradicted the active chain. Every active filename was compared with the
production ledger; 14 planning timestamps were replaced with their exact live
versions. With `20260718170255_drop_legacy_void_receipt_overload.sql` and the
clean-replay invariant repair
`20260718173652_reconcile_replay_security_and_fk_invariants.sql`, both the
repository and production ledger contain 110 exact `version_name` entries.

The production ledger was not squashed or rewritten. Applied historical files
remain in replay order so a fresh database can reproduce the same forward
chain without a metadata-only baseline repair.
