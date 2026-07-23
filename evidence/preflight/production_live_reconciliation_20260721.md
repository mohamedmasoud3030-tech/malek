# Production Live Reconciliation Evidence
> **Historical snapshot notice (2026-07-23):** This report predates the merge of PRs #1233, #1269, and #1271. It is retained as evidence, not as the current repository status. See [`docs/APP_STATUS.md`](../../docs/APP_STATUS.md).

Date: 2026-07-21 UTC  
Project: `nnggcnpcuomwfuupupwg` (`RENTRIX EGY (live)`)  
Region: `ap-southeast-1`  
Project status: `ACTIVE_HEALTHY`  
Database: PostgreSQL 17

## Safety boundary

The authenticated Supabase connector was used only for read-only catalog, migration-ledger, policy, function, advisor, log, and bounded data-inventory queries.

No Production write was performed. Specifically, there was no:

- `supabase db push`;
- migration repair or ledger mutation;
- DDL or DML;
- write RPC execution;
- Storage mutation;
- QA-data deletion;
- RLS, Auth, grant, function, table, or schema change.

## Authoritative migration-ledger comparison

The live `supabase_migrations.schema_migrations` ledger was read directly.

Ten authoritative live versions are absent from the current `main` migration directory. Five correspond to executable repository migrations with different local timestamps; five are Production-only historical fixes whose final runtime effects are reconstructed by later repository migrations.

A technically verified reconciliation using tiny metadata-only aliases/captures is prepared in Draft PR #1233. It is intentionally not merged because doing so may unblock automatic Production deployment.

### Executable repository versions with different live aliases

| Executable repository version | Authoritative live alias | Migration name |
|---|---|---|
| `20260719143000` | `20260719143358` | `fix_execute_automation_rule_overdue_invoice_due_date_cast` |
| `20260720162500` | `20260720163537` | `reconcile_unit_legacy_rent` |
| `20260720180500` | `20260720183950` | `reconcile_core_field_contracts` |
| `20260720180530` | `20260720184001` | `prepare_expense_write_fields` |
| `20260720180600` | `20260720184056` | `reconcile_expense_write_fields` |

### Additional live historical versions

| Live version | Migration name | Stored statement evidence |
|---|---|---|
| `20260718205846` | `fix_audit_journal_entry_insert_missing_id` | MD5 `5cfae2f35c1a042a795f356ceb238625`, 679 chars |
| `20260718205954` | `fix_missing_audit_log_id_in_invoice_gen_and_bank_recon` | MD5 `96d727ec302f905fd961410e7a83f255`, 8691 chars |
| `20260719142548` | `revert_post_receipt_atomic_payments_sync_v2` | MD5 `e1403584814ae786f3ff952364e7f20e`, 6965 chars |
| `20260719224741` | `add_payments_receipt_fk_and_auto_create_in_post_receipt_atomic` | MD5 `4f9970dd77bed3b077fd7b30bc3a4f11`, 8445 chars |
| `20260719225256` | `fix_record_invoice_payment_atomic_remove_redundant_payments_insert` | MD5 `f8bf8050daff724b58e69de0456eccfd`, 5962 chars |

## Repository-only pending migrations vs live state

These repository migrations remain absent from the live ledger:

- `20260721090000_harden_private_attachments_bucket`
- `20260721161500_reconcile_release_runtime_shapes`
- `20260721162000_fix_void_and_deposit_replay_compatibility`

Read-only inspection found that Production already matches the important runtime contracts.

### Storage

- `attachments.public = false`;
- file limit is 5 MiB;
- MIME set is PDF, JPEG, PNG, and WebP;
- reads require authenticated app-user access;
- insert, update, and delete require manager/admin authorization;
- no broad legacy authenticated upload policy exists.

### Runtime table shapes

- `journal_entries.id`, `date`, `source_id`, `entity_id`, `request_id`, and `status` are text;
- `journal_entries.batch_id` is UUID and `deleted_at` is timestamptz;
- `audit_log.id`, `user_id`, and `entity_id` are text;
- `receipts.voided_at` is bigint epoch milliseconds;
- `tenant_deposits.id` and `deposit_transactions.deposit_id` are text;
- `contracts.id` and `properties.id` are text;
- `units.id` is UUID;
- `expenses.property_id` is text;
- `payments.date_time` is text and `payment_date` is date.

### RPCs

The live receipt VOID, deposit, and daily collection functions inspected are owned by `postgres`, use `SECURITY DEFINER`, pin `search_path` to `public, pg_temp`, grant execution only to intended authenticated/service roles, and retain authorization, idempotency, and journal controls where applicable.

## Automatic Production deployment risk

Read-only `branch-action` logs show that each merge to protected branch `main` starts a Supabase Production deployment. Current runs stop before migration application with:

`Remote migration versions not found in local migrations directory.`

Merging the migration-history reconciliation would remove that blocker and could automatically apply all remaining local-only migrations. Therefore Draft PR #1233 must not be merged while the backup gate is unresolved or while `Deploy to production` remains enabled.

## API key reconciliation

The repository CI build referenced a disabled/rejected publishable key. The safe PR updates CI to the currently active publishable key returned by the authenticated Supabase management connector. The key value is intentionally not recorded here.

## Backup determination

The Supabase organization is on the Free plan. Free-plan projects do not provide a downloadable managed database backup. The available connector does not expose a backup artifact or the database password required to produce and verify an off-site logical dump.

Therefore:

- no restorable backup artifact is evidenced;
- no restore rehearsal has been completed;
- no Recovery Point Objective can be claimed;
- Storage object bytes would require separate backup coverage.

Production writes remain **HOLD / NO-GO**.

## Advisor snapshot

Security findings include a mutable `search_path` warning on `public.audit_journal_entry_insert`, several `SECURITY DEFINER` warnings requiring per-function intent review, and leaked-password protection being disabled.

Performance findings include unindexed foreign keys, multiple permissive SELECT policies, and unused-index observations that require workload evidence before removal.

These are tracked separately and were not changed during this preflight.

## Decision

- Read-only Production access and live reconciliation: **COMPLETE**.
- Safe evidence and active publishable-key correction: **READY TO MERGE**.
- Migration-history reconciliation PR #1233: **TECHNICALLY VERIFIED, MERGE BLOCKED**.
- Production migration, ledger, schema, Storage, and QA cleanup writes: **HOLD / NO-GO** until a verified backup/restore path or disabled automatic Production deployment is evidenced, followed by explicit owner approval.
