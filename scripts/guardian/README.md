# Database Guardian V1

Permanent, deterministic database protection for MALEK. Runs entirely offline
against an ephemeral PostgreSQL (PGlite) — no production data, no hosted
branch, no Docker.

## Run

```bash
pnpm db:guardian
```

Exit code `0` means no CRITICAL or HIGH findings. The machine-readable report
is written to `.guardian/report.json`.

## What it checks

| Gate | What it proves |
|------|----------------|
| Inventory & canonical contract | 112 tables / 1761 columns / 375 functions / 209 policies / 413 indexes are inventoried and compared to `contract.json`: NUMERIC money (never float), `company_id` + RLS on every tenant/financial table, no permissive browser write policies on protected financial tables, document-number uniqueness, append-only tables, SECURITY DEFINER `search_path`, FK-anchored `company_id`. |
| Behavioral RLS + financial RPCs | Real queries as two tenants using `SET LOCAL ROLE authenticated` (actual PostgreSQL role transition, not a GUC write): cross-company SELECT/INSERT/UPDATE/DELETE are blocked; role gates work; `record_invoice_payment_atomic` rejects foreign invoices, zero amounts and anonymous callers; browser cannot insert into `journal_lines`; idempotency table has its unique key; SECURITY DEFINER functions are not `anon`-executable. Every one of the 19 append-only contract tables is tested by inserting a real row and attempting a hard DELETE (the 10 new shared guards must raise SQLSTATE 23001). |
| Data & financial integrity | SQL detectors for orphan records, cross-company parent/child relationships, duplicate document numbers, invoice overpayment, unbalanced posted GL batches, negative money, zero posted invoices, and paid-but-unallocated invoices. Detectors are valid queries and run on any populated database. |
| Operation map | Frontend `.rpc()`/`.from()` → RPC → table write map. Flags direct frontend writes to protected tables and tables with many parallel server-side writers. |
| Migration hygiene | All migrations replay from clean; no `DROP TABLE` / `TRUNCATE`; unique timestamps; already-merged migrations are immutable (compared to `origin/main`). |

## Severity and CI

`CRITICAL` and `HIGH` findings fail the gate. `.github/workflows/database-guardian.yml`
runs on every PR that touches `supabase/migrations/**`, `scripts/guardian/**`,
`scripts/db0/**`, `scripts/supabase-tests/rls-matrix.mjs`, generated types, or
the workflow itself, and blocks merge on a critical regression.

## Fixing a finding

Follow the protocol:

1. Read the finding's `evidence` — it is a concrete row/value, not an opinion.
2. Write or run the behavioural/integrity check that proves the defect.
3. Fix with a **new forward migration** under `supabase/migrations/`. Never edit
   merged migrations.
4. Re-run `pnpm db:guardian` until clean.
5. If a finding is an accepted, governed exception, record it in
   `contract.json` with rationale — do not silence the detector.

## Files

- `run.mjs` — unified runner (`pnpm db:guardian`)
- `contract.json` — canonical, governed database contract
- `lib/inventory.mjs` — inventory + contract checks
- `lib/behavioral.mjs` — two-tenant RLS / RPC / append-only behavioral tests
- `lib/integrity.mjs` — data and financial reconciliation detectors
- `lib/operation-map.mjs` — frontend → RPC → table write map
- `lib/migration.mjs` — migration hygiene and immutability
- `lib/findings.mjs` — finding model, severity, report rendering
