# `scripts/db0` — WP-DB0 database contract toolchain

Proves that **migrations ↔ schema ↔ generated types ↔ frontend usage ↔ RLS**
are one contract. Runs entirely offline against an ephemeral PostgreSQL 18
(PGlite/WASM) — no hosted database, no Docker, no paid Supabase Database
Branching, and it never touches the live project or its demo data.

Full rationale and findings: [`docs/database/WP_DB0_CONTRACT_FREEZE.md`](../../docs/database/WP_DB0_CONTRACT_FREEZE.md).

## Commands

```bash
pnpm db0:gate          # all gates — this is what CI runs
pnpm db0:audit         # full reality audit -> .db0-artifacts/
pnpm db0:gen-types     # regenerate rentrix-app/src/types/database.ts
pnpm db0:check-types   # fail if database.ts drifted from the migrations
pnpm db0:replay        # apply the chain to a clean database
pnpm db0:idempotency   # prove re-running the WP-DB0 migrations is a no-op
pnpm db0:contract      # frontend/service/RPC contract drift
pnpm db0:isolation     # RLS, company isolation, FK and definer integrity
```

## After changing the schema

1. Add a migration in `supabase/migrations/`.
2. `pnpm db0:gen-types` and commit the regenerated `database.ts`.
3. Update services to the new contract.
4. `pnpm db0:gate`.

`database.ts` is **generated — never hand-edit it**.

## Layout

| Path | Role |
|---|---|
| `bootstrap.sql` | Supabase platform preamble (roles, `auth`/`storage`, `auth.uid()`) so the chain replays unmodified |
| `lib/replay.mjs` | Creates the database and applies the migration chain |
| `lib/introspect.mjs` | Extracts the full schema inventory |
| `lib/gen-types.mjs` | Renders `database.ts` from the introspected schema |
| `lib/types-parse.mjs` | Parses `database.ts` back into a comparable structure |
| `lib/frontend-scan.mjs` | Finds every `.from()` / `.rpc()` / select column in the app |
| `lib/drift.mjs` | Classifies mismatches into the `DB0-*` finding codes |
| `contract-baseline.json` | The one accepted, governed exception (GAP-009) |

## Baseline policy

`contract-baseline.json` pins accepted finding counts. The gate fails if a
count rises, and any finding class **not** listed is allowed zero occurrences —
so a new kind of drift can never appear silently. Lowering a number is always
safe; raising one requires an explicit contract decision recorded in the
freeze document.
