# Live production ledger vs repository canonical migrations — crosswalk

Measured **read-only** on 2026-09-11 (13:20–13:40 UTC) against Supabase project
`nnggcnpcuomwfuupupwg` ("Malek-Plus (live)", ap-southeast-1) via the Supabase
Management API `database/query` endpoint (SELECT-only statements) — the first
live G6 parity measurement in this reconstruction. No mutation of the live
database, no ledger repair, no `db push`.

## Headline numbers

| Measure | Count |
|---|---|
| Live ledger rows (`supabase_migrations.schema_migrations`) | **109** |
| Repository canonical migration files (`supabase/migrations/*.sql`, branch `reconstruction/checkpoint-20260909` = main + docs/CI-only work) | **100** |
| Exact version matches | **82** |
| Ledger-only versions (applied to production, no repo file under that version) | **27** |
| Repo-only versions (canonical file, not in live ledger under that version) | **18** |

## Repo-only versions → name-matched ledger entries

All 18 repo-only files are the reconstruction's **re-stamped** versions of
migrations that production applied earlier under their original timestamps:

| Repo version | Name | Live version | Content verdict (whitespace/comment-insensitive full-text compare of the ledger's stored `statements[1]` vs the repo file) |
|---|---|---|---|
| 20260901000019 | revoke_recalculate_unit_statuses | 20260824055153 | IDENTICAL (re-stamped) |
| 20260901000020 | revoke_internal_and_trigger_rpc_execute | 20260824055235 | DIVERGED (local hardened variant never applied) |
| 20260901000021 | browser_rpc_canonical_identity_guards | 20260824055925 | IDENTICAL (re-stamped) |
| 20260901000022 | fix_soft_delete_contract_atomic_uuid_casts | 20260824055944 | IDENTICAL (re-stamped) |
| 20260901000023 | mark_app_notification_read_governed_rpc | 20260824055959 | IDENTICAL (re-stamped) |
| 20260901000024 | restore_system_inspection_templates | 20260824060022 | IDENTICAL (re-stamped) |
| 20260901000025 | expand_bank_reconciliation_entity_types | 20260824060033 | IDENTICAL (re-stamped) |
| 20260901000026 | fix_bank_reconciliation_rpc_validation | 20260824060104 | DIVERGED (local hardened variant never applied) |
| 20260901000027 | harden_bank_reconciliation_economic_identity | 20260824060120 | IDENTICAL (re-stamped) |
| 20260901000028 | secure_function_default_privileges | 20260824060134 | IDENTICAL (re-stamped) |
| 20260901000029 | normalize_financial_precision_to_omr_3dp | 20260824060153 | IDENTICAL (re-stamped) |
| 20260901000030 | fix_bank_reconciliation_audit_schema | 20260824060222 | DIVERGED (local hardened variant never applied) |
| 20260901000031 | rc1_business_rules_closeout | 20260824060255 | DIVERGED (local hardened variant never applied) |
| 20260901000032 | rc1_commission_deal_identity_omr_precision | 20260824060337 | IDENTICAL (re-stamped) |
| 20260901000033 | rc1_bank_reconciliation_fail_closed | 20260824060415 | DIVERGED (local hardened variant never applied) |
| 20260901000034 | collections_payments_period_close_fixes | 20260824060542 | IDENTICAL (re-stamped) |
| 20260901000036 | frontend_backend_contract_acl_storage_fix | 20260828122738 | IDENTICAL (re-stamped) |
| 20260901000068 | ai_assistant_postgrest_rpc_repair | 20260901015736 | IDENTICAL (re-stamped) |

## Ledger-only versions with NO repository counterpart (9)

These were applied directly to production (dashboard/CLI from another working
tree) and were never committed to this repository in any branch (verified via
`git log --all --name-only` path search):

| Live version | Name |
|---|---|
| 20260821172857 | archive_duplicate_contract_draft_and_enforce_uniqueness |
| 20260821175402 | require_active_contract_before_invoice_posting |
| 20260824060320 | rc1_business_rules_closeout_update_commission_completion |
| 20260824060451 | rc1_bank_reconciliation_fail_closed_process_completion |
| 20260824060503 | rc1_bank_reconciliation_fail_closed_wp05_guard_completion |
| 20260830071342 | atomicity_test_demo_invoice_v4 |
| 20260830223912 | recreate_ai_assistant_authorization_rpc |
| 20260901082930 | ai_assistant_postgrest_rpc_repair_repo_sync |
| 20260901083347 | repair_financial_report_public_wrappers |

## Live-schema probes for the 5 diverged pairs (read-only catalog checks)

Signature probes against `pg_get_functiondef` / `pg_trigger` for every distinctive
guard string of the 5 diverged repo files, classified by whether the guard lives
in a persistent FUNCTION body or a transient DO block:

| Repo file | Signature | Kind | Live |
|---|---|---|---|
| 20260901000031 | trigger `trg_guard_journal_line_rc1_revenue_scope` | persistent | **present** (1) |
| 20260901000031 | `RC1_4000_NON_MASTER_LEASE_CREDIT_BLOCKED` | persistent | **present** (1 fn) |
| 20260901000031 | `RC1_COMMISSION_PAYMENT_ROWS_PRESENT` | transient DO check | absent (expected — one-shot data check, leaves no catalog residue) |
| 20260901000030 | `Cross-company payment match rejected` | persistent | **present** (1 fn) |
| 20260901000030 | `Cross-company receipt match rejected` | persistent | **present** (1 fn) |
| 20260901000033 | `BANK_IMPORT_ATOMIC_INSERT_COUNT_MISMATCH` | persistent | **present** (1 fn) |
| 20260901000033 | `file_fingerprint was already used with different content` | persistent | **present** (2 fns) |
| 20260901000026 | `v_existing_match_id` dedupe guard | persistent | **0 — NOT APPLIED LIVE** |
| 20260901000020 | `INTERNAL_ACL_ABORT` verify block | transient DO check | absent (expected — one-shot ACL verification) |
| (context) | `statement_line_id is required` / `requires ADMIN or MANAGER` / `Only managers can import bank statements` | persistent | present (2/1/2 fns) |

**Net functional gap: exactly ONE confirmed** — production's bank-reconciliation
matching RPCs run without the repo-hardened `v_existing_match_id` dedupe guard
(repo 20260901000026; no ledger-only hotfix adds it either — signature absent
from all 27 archived statements). All other divergences are either formatting,
transient one-shot checks, or hardened guards already present live.

## Consequences (recorded, not "fixed")

1. `supabase db push` is **UNSAFE**: the 18 re-stamped files would be treated as
   pending and re-applied on top of objects that already exist under the 27
   ledger-only versions → guaranteed failures or double-application. The G4
   deploy path must not run until the ledger is reconciled by governance
   decision (documented repair path: `docs/operations/BACKUP_RESTORE_RUNBOOK.md`
   via `supabase migration repair` — operator-gated by design).
2. Exactly ONE confirmed functional gap (probe matrix above): the
   20260901000026 `v_existing_match_id` dedupe guard is **not live** and none of
   the 9 archived hotfixes adds it — production runs the pre-hardening variant
   of the bank-reconciliation matching RPCs. Closing this gap requires a NEW
   forward migration (never editing applied history) as part of the ledger
   reconciliation decision in (1).
3. The parity gate (`scripts/verify-migration-ledger-parity.sh`) now fails
   **honestly and visibly** on every run (by design — it detects, never
   silently repairs). Its first executed run with a live DB URL: workflow run
   34605268416 (readiness step SUCCESS, parity step FAILURE = true drift).
