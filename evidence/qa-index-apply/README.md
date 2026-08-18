# QA apply pack — hot-path FK covering indexes

## What this is

Additive `CREATE INDEX IF NOT EXISTS` only for company-scoped operational tables
and a few relationship reverse lookups. Proven on disposable PGlite (282/282
migrations, 401 indexes, 0 hot-path unindexed FKs).

## Why the agent could not push it for you

The Arena sandbox blocks outbound HTTPS TLS (`SSL_ERROR_SYSCALL` /
`SSLZeroReturnError`) to `api.supabase.com` and the project host. CLI/API apply
from this runner is impossible until egress is restored.

## Safest owner apply (recommended)

1. Open Supabase Dashboard → project `nnggcnpcuomwfuupupwg` → **SQL Editor**.
2. Paste and run `20260831000000_hot_path_fk_covering_indexes.sql`.
3. Paste and run `VERIFY_AFTER_APPLY.sql`.
4. Expect `hot_path_indexes_present = 24`.

Optional CLI (on a machine with network + `supabase` login):

```bash
export SUPABASE_ACCESS_TOKEN=...   # personal access token
supabase link --project-ref nnggcnpcuomwfuupupwg
supabase db query --linked -f supabase/migrations/20260831000000_hot_path_fk_covering_indexes.sql
```

Do **not** run a full `db push` of the entire migration history until remote-only
ledger versions are reconciled (see `SUPABASE_MIGRATION_AUDIT.md`).

## Rollback

Run `ROLLBACK.sql` in the SQL Editor. Data rows are untouched.

## Risk

- No row rewrite, no RLS change, no column change.
- Index build may take longer on large tables and can briefly lock writes
  (standard `CREATE INDEX`, not `CONCURRENTLY`, for managed SQL Editor simplicity).
- Prefer a quiet window if the QA database is already large.
