# Supabase Migration Audit

Generated: 2026-08-18  
Local chain: **281** SQL files, `20250101000001_core_schema.sql` … `20260830020000_ai_assistant_abuse_controls.sql`.  
Replay: **281 / 281 applied** into disposable PGlite (`scripts/supabase-tests/schema-inventory.mjs` / RLS matrix).  
Live ledger: **Not verifiable remotely** (no `SUPABASE_DB_URL`, no `psql`). Historical read-only evidence: `evidence/preflight/production_live_reconciliation_20260721.md` (project `nnggcnpcuomwfuupupwg`).

**This PR adds no migration and does not run `supabase db push`.**

## 1. How to read the statuses

| Status | Meaning |
|---|---|
| Confirmed | Proven in this sandbox (PGlite replay or repository file contents) |
| Probable | Strong repo evidence; not re-proven against Production |
| Not verifiable remotely | Needs hosted read-only credentials that are not present |

Every file after the 2026-07-21 live snapshot is treated as **unapplied from this sandbox’s point of view**. That is 145 files (`20260721090000` onward). Do not push them as a batch.

## 2. Live ledger (Not verifiable remotely)

As of 2026-07-21 the hosted ledger:

- Had **10 remote-only versions** (5 executable aliases with different timestamps, 5 Production-only historical fixes).
- Was missing three then-local files:
  - `20260721090000_harden_private_attachments_bucket`
  - `20260721161500_reconcile_release_runtime_shapes`
  - `20260721162000_fix_void_and_deposit_replay_compatibility`
- Blocked automatic Production deploy with: `Remote migration versions not found in local migrations directory.`
- Organization is on the **Free plan** — no downloadable managed backup, no restore rehearsal.

Merging a ledger-reconciliation PR would remove that blocker and could auto-apply every remaining local-only migration. That is why Production writes stay **HOLD / NO-GO**.

## 3. Classification of unapplied / post-snapshot migrations

Classification is from **file contents**, not from a live apply. Groups, not a 145-row dump.

### SAFE (additive only — still do not auto-push)

Index-only, new tables with RLS, new catalog rows, new SECURITY DEFINER RPCs that fail closed, check constraints that add values.

Examples:

- `20260820090000_rc1_release_integration_fk_indexes.sql` — index-only
- `20260821000000_r1_dashboard_truth_read_model.sql` — read model
- `20260822000000_r2_owner_financial_position.sql` — read model
- `20260824000000_r7_party_directory_read_model.sql` — read model
- `20260830020000_ai_assistant_abuse_controls.sql` — rate-limit table + controls
- `20260830010000_contract_registration_and_handover_evidence.sql` — additive evidence tables/RPCs

Safe in isolation does **not** mean safe to apply onto a drifted Production ledger.

### REQUIRES CARE (function replace, policy replace, backfill, constraint swap)

Most of the 2026-07-22 multi-tenant series and the August hardening chain.

| Theme | Examples | Why care |
|---|---|---|
| Company backfill / NOT NULL / FK | `20260722020000` … `20260722040000` | Assumes empty-or-single-tenant data |
| Auth hook / `current_company_id` | `20260722050000`, later JWT selection | Hosted hook must already be enabled |
| RPC company isolation | `20260722000002`, `20260723000000` | Replaces SECURITY DEFINER bodies |
| Storage / RLS rewrite | `20260721090000`, 35 `DROP POLICY` files | Replaces live policies |
| Payment/receipt identity | `20260723100000`, `20260723110000` | Drops legacy invoice-required constraint |
| Financial write sealing | `20260806*`–`20260807*`, `20260818040000` | Revokes direct browser writes |
| Six-role catalog | `20260811120000` | Catalog vs RLS mismatch (documented, keep) |
| Precision / tax / accruals | `20260819*`, `20260820*`, `20260813210000` | Replaces numeric contracts and RPCs |
| Contract billing / renewal / overlap | `20260823000000`, `20260827000000`, `20260828000000` | Replaces atomic RPCs |
| Maintenance lifecycle | `20260825000000`, `20260826000000` | Replaces atomic RPC |

`DELETE FROM` / `TRUNCATE` appearances in this set are fixture, privilege, or grant cleanups inside migrations — still REQUIRES CARE on a live database.

`USING (true)` appears once: `onboarding_requirement_templates` SELECT (`20260818000000`). That table is a **global catalog**, not tenant operational data. Do not treat it as a reason to open other RLS.

### DESTRUCTIVE / do not apply from this PR

These files contain `DROP TABLE`, `DROP COLUMN`, or `ALTER … TYPE`. Leave them out of any automatic Production apply until a restorable backup exists and each file is reviewed against live row shapes.

| File | Risk |
|---|---|
| `20260724120000_p0_company_isolation_reports_rls.sql` | `DROP TABLE` |
| `20260725000000_p1_owner_settlement_server_derivation.sql` | `DROP TABLE` |
| `20260815010000_reconcile_legacy_owner_settlement_link_shape.sql` | `DROP TABLE` |
| `20260731190948_rollback_create_maintenance_atomic_rpc.sql` | `DROP COLUMN` + rollback RPC |
| `20260815018000_normalize_legacy_account_classification_casing.sql` | `DROP COLUMN` + constraint rewrite |
| `20260721161500_reconcile_release_runtime_shapes.sql` | `ALTER … TYPE` |
| `20260721162000_fix_void_and_deposit_replay_compatibility.sql` | `ALTER … TYPE` |
| `20260805120000_s02_bank_csv_import_atomic_contract.sql` | `ALTER … TYPE` |
| `20260813210000_wp02_fixed_monthly_daily_accrual.sql` | `ALTER … TYPE` |
| `20260815000000_wp_db0_contract_freeze_corrections.sql` | `ALTER … TYPE` + constraint drops |
| `20260815011000_reconcile_empty_legacy_expenses_id_type.sql` | `ALTER … TYPE` |
| `20260817085000_wp02_gap009_deposit_precision_and_reversal_contract.sql` | `ALTER … TYPE` |
| `20260819000000_phase1_omr_precision_convergence.sql` | `ALTER … TYPE` (precision) |

Historical live inspection (2026-07-21) already reported that Production **already matched** several of the then-pending runtime contracts (attachments bucket, several id/text shapes). Re-applying a type-reconciliation file onto a matching live column can still fail or rewrite the ledger.

## 4. This PR

| Item | Decision |
|---|---|
| New migration | **None** |
| Rewrite of applied history | **Forbidden / not done** |
| Unindexed FK cleanup (102 on replay) | Documented only. Adding ~100 indexes is REQUIRES CARE and needs live advisor + workload |
| `payments.invoice_id` / maintenance invoice types / `account_balances` / `profiles` / locale defaults | **Not changed** — not proven as active defects |
| RLS | **Not weakened** |
| Production apply | **HOLD** |

## 5. Rollback

Because this PR changes no database objects, there is nothing to roll back on the server.

If a future additive index migration is added: `drop index if exists …` in a new follow-up file. Never edit an already-applied file.

Frontend rollback (this PR): revert `permissions.ts` and the five service files. OPERATIONS users would again see write buttons the database denies.

## 6. Production actions still required (manual)

1. Confirm a restorable backup, or disable automatic Production deploy on merge to `main`.
2. Read-only compare `supabase_migrations.schema_migrations` to the 281 local files (`pnpm supabase:migration-evidence` / `pnpm supabase:live-readiness`).
3. Classify each local-only file against the live row shapes before any apply.
4. Enable the hosted Auth Hook (`custom_access_token_hook`) if it is not already on.
5. Do **not** merge ledger-alias PRs that would unblock auto-deploy while the backup gate is red.

## 7. Verification / tests

| Check | Result |
|---|---|
| PGlite replay of all 281 files | Confirmed (inventory + RLS matrix) |
| Duplicate / non-monotonic timestamps | None in local filenames |
| Live ledger equality | Not verifiable remotely |
| `pnpm test:supabase` after this PR | See `SUPABASE_TEST_RESULTS.md` |
