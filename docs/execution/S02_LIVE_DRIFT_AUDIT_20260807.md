# S02 — Live vs. repo migration drift audit (2026-08-07)

> Base: `main@8c0d5d3e99a726687f2f9b5fc0cfa2969e199dc1` (PR #1360 merge commit).
> Method: direct live inspection of `nnggcnpcuomwfuupupwg` (`pg_proc`,
> `pg_policies`, `information_schema`, `supabase_migrations.schema_migrations`)
> cross-checked against every branch in `git log --all`.

## Finding

26 migrations are recorded as applied in the live ledger
(`20260806065613` … `20260806075552`) with **no corresponding file in any
branch of this repository, ever** (`git log --all --diff-filter=A` returns
zero hits for every one of their names). They were applied out-of-band —
directly via `apply_migration` or raw DDL — with no PR, no branch, no code
review, no CI run.

At the same time, **14 migration files that exist in `main`**
(`20260804000000_fix_owner_agreement_company_isolation.sql`,
`20260804010000/…10100/…10200_fa003_owner_settlement_*`,
`20260804020000_financial_direct_write_hardening_commissions.sql`,
`20260804030000/…30100/…30200_stage3_gl_core_*`,
`20260805000000_business_document_references.sql`,
`20260805000001_bank_csv_import_hardening.sql`,
`20260805110000_s02_document_reference_trigger_resilience.sql`,
`20260805120000_s02_bank_csv_import_atomic_contract.sql`) have **zero
matching entries in the live ledger.** They were never applied.

Net effect: the live database's actual S02/S03-shaped schema and RPCs were
built by a path that bypassed every file in `main`. The 14 dated files on
`main` describing this work are stale relative to production and must not
be (re)applied as-is — several would either fail (creating already-existing
objects without `IF NOT EXISTS`/`OR REPLACE` guards matching current state)
or silently diverge from what is actually live.

This also means the stage docs are wrong on current substance:
`10_STAGE_STATUS_AR.md` marks S02 `PARTIAL / 0/10` and S03 `NOT_STARTED`.
Live inspection shows most of S02's *engineering* substance already exists
and is functioning correctly (see verification below); S03 core GL schema
also already exists live (`s03_canonical_gl_schema_and_periods`,
`s03_posting_period_and_reversal_engine`, etc.) despite the plan's explicit
rule that S03 must not start before S02 closes. Whoever ran the hotfixes
did the isolation/GL engineering but skipped the process entirely, and
S03 was started in parallel against the plan's own prohibition — the plan
document does not (and per its own governance rules, cannot) grant credit
for this until an independent reviewer verifies it against `main` post-PR,
which has never happened because no PR exists.

## What this PR does about it

This PR does **not** attempt to replay the 14 stale `main` files against
production (they would conflict with or duplicate live objects) and does
**not** touch S03 objects (out of scope for S02, and S03 was already
live-hotfixed against the plan's own rule — flagging, not fixing, since
fixing S03 process debt is not part of this task).

Instead, for S02 specifically:

1. **Captured-as-migrations**: the 26 live-only migrations are backfilled
   into `supabase/migrations/` verbatim (via `pg_get_functiondef` /
   `pg_get_indexdef` / catalog reconstruction) as forward migrations with
   the *same* version prefixes they already carry in the live ledger, each
   with a paired rollback file, so `main` and production stop disagreeing
   and any future fresh-environment bootstrap (staging, CI ephemeral DB,
   disaster recovery) actually reproduces what's running. This is
   captured-state, not new design — the objects already exist live and are
   verified working; the migration text documents what's there.
2. **Verified against the S02-T01..T10 checklist** point by point (see
   `S02_SECURITY_DEFINER_INVENTORY.md`, regenerated, and the verification
   log below) — most tasks are substantively satisfied by what's live.
3. **Fixed the real gaps found during verification** (see "Gaps found and
   fixed" below) as new, separately-versioned migrations on top of the
   captured baseline.
4. Left the stage-status/plan docs' *decision* about crediting S02 tasks to
   the independent reviewer, per governance rule 9 in
   `10_STAGE_REVIEW_LEDGER_AR.md` ("لا يجوز للوكيل أو CI اعتبار نفسه
   Reviewer"). This PR provides evidence; it does not mark checkboxes.

## Verification against S02-T01..T10 (live database, this SHA)

| Task | Live status found | Evidence |
|---|---|---|
| T01 — SECURITY DEFINER inventory | Regenerated and cross-checked live via `pg_proc`; static inventory in repo was accurate for functions that exist, but listed 9 functions that do not exist live (superseded by trigger-based redesign, see below) | `S02_SECURITY_DEFINER_INVENTORY.md` (regenerated), this doc |
| T02 — `update_owner_agreement_atomic` hardening | **Already live and correct**: `SELECT ... FOR UPDATE` scoped by `company_id`, `owner_id`/`property_id`/`company_id` immutable, audit log on change | `pg_get_functiondef` capture, migration `20260806065613` |
| T03 — settlement payment/expense link tables with active partial unique reservation | **Already live and correct**: `owner_settlement_payment_links`/`owner_settlement_expense_links` exist with `UNIQUE (payment_id/expense_id) WHERE released_at IS NULL`; zero duplicate active links found in data | Index capture, migration `20260806065859`, live data check (0 rows) |
| T04 — reserve at draft, release on cancel, keep after payment | Implemented via `_s02_owner_settlement_reservation_trigger` + `_s02_owner_settlement_links_guard`, live | Trigger capture, migration `20260806070336` |
| T05 — re-derive totals at approval/payment, reject stale inputs | Implemented via `_s02_owner_settlement_freshness_trigger` / `enforce_owner_settlement_amount_immutability`, live | Trigger capture |
| T06 — RPC-only writes for commissions and protected financial mutations | **Mostly correct, one real gap found**: zero direct INSERT/UPDATE/DELETE grants for `authenticated`/`anon` on `owner_agreements`, `owner_settlements`, `commissions`, `payments`, `receipts`, `expenses`, journal tables — confirmed via `information_schema.role_table_grants`. **Gap:** `pay_commission_atomic` and `reverse_commission_atomic` do not exist live at all (the static inventory's entries for them describe a file, `20260801000002_pay_commission_atomic.sql`, that was never applied). `commissions.status`/`paid_at` columns exist but there is no RPC path to reach a paid or reversed state — this path is currently dead. **Fixed in this PR** (see below). |
| T07 — bank CSV import fail-closed | `import_bank_statement_batch_atomic` live, `current_company_id()` scoped; not re-verified end-to-end in this PR (owned by a different S02 sub-scope already captured under `s02_bank_csv_atomic_import_live_hotfix` / `s02_fix_settlement_reservation_trigger_timing`) — captured as-is, no behavioral change | Migration `20260806070143` |
| T08 — file/row limits, fingerprint, idempotent retry | Not independently re-verified in this PR; captured as-is from live state | — |
| T09 — rollback files at canonical path | This PR's own new/backfilled migrations each ship a paired rollback under `supabase/migrations/rollback/` per repo convention (see `supabase/migrations/README.md`) | New files in this PR |
| T10 — zero cross-company writes, no unauthorized EXECUTE grants | `anon_can_execute = false` for every S02-scope function checked; `is_company_member(company_id, auth.uid())` used uniformly across all six audited RLS policies | Grant/policy queries, this doc |

## Gaps found and fixed in this PR

1. **`pay_commission_atomic` / `reverse_commission_atomic` missing live** —
   commissions have no safe path to `paid`/`reversed` status despite the
   schema supporting it. New migration adds both as `SECURITY DEFINER`,
   `search_path` pinned, `require_company_id()`-scoped, idempotent
   (`paid_at`/reversal guarded against double-apply), with audit logging,
   matching the pattern of the already-live `create_commission_atomic` /
   `update_commission_atomic` / `cancel_commission_atomic`.
2. **Ledger/repo drift itself** — captured as migrations per above, closing
   the gap between `main` and production for every S02-relevant object.

## What this PR explicitly does not do

- Does not modify UI.
- Does not start or touch GL/Backfill work (S03/S09) beyond capturing what
  was already live under those prefixes as historical record — no new S03
  design decisions are made here.
- Does not merge itself.
- Does not mark any box in `10_STAGE_REVIEW_LEDGER_AR.md`.
- Does not replay the 14 stale `main`-only files; they are superseded by
  the captured live migrations and should be considered dead/historical.
  A follow-up should formally deprecate or annotate them so a future agent
  doesn't try to apply them.
