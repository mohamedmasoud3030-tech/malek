# Production Access & Backup Preflight Evidence
> **Historical snapshot notice (2026-07-23):** This report predates the merge of PRs #1233, #1269, and #1271. It is retained as evidence, not as the current repository status. See [`docs/PROJECT_STATUS.md`](../../docs/PROJECT_STATUS.md).

Date: 2026-07-21 (Asia/Muscat).
Repository HEAD inspected: `0d3b7f32b2992921cd420e38dbf026ec0f595167` (`main`).
Production project ref: `nnggcnpcuomwfuupupwg`.

## Guardrails honored

No Production writes were attempted. Specifically: no `supabase db push`, no migration repair, no ledger mutation, no DDL/DML, no Storage mutation, and no operational test data creation.

## Available secure access

Environment inspection found no Supabase/GitHub/Sonar/E2E credential environment variables. Tooling available locally did not include Docker, `psql`, `gh`, global `supabase`, or global `pnpm`. Repository dependencies and the pinned Supabase CLI are available through local `node_modules`/`npx`, but authenticated Supabase inspection requires credentials that are not present.

## Supabase Preview failure

GitHub check-run on current `main` head:

- Check: `Supabase Preview`
- Conclusion: `failure`
- Output: `Remote migration versions not found in local migrations directory.`

Remote missing versions could not be extracted from the public check-run output. Supabase management/database access is required to read the remote migration ledger/history. Known repository history already documents at least one legitimate live-ledger version mismatch: `20260705000005_bank_reconciliation_foundation.sql` was applied live under version `20260706081635`. There are also documented metadata-only historical ledger repairs for `20260715000003` and `20260715000005`. These facts are not permission to repair the ledger; they are only candidate drift areas to verify with read-only ledger access.

## SonarCloud failure

Public SonarCloud APIs were reachable. Current main quality gate is ERROR:

- `new_reliability_rating`: actual `3`, threshold `1` (C vs required A).
- `new_security_rating`: actual `3`, threshold `1` (C vs required A).
- `new_duplicated_lines_density`: `8.3`, threshold `3`.

Fetched open/new-period issues: 888 total (873 code smells, 14 vulnerabilities, 1 bug). Major actionable categories include:

- GitHub Actions `pnpm install` without `--ignore-scripts` (`githubactions:S6505`) in CI workflows. This is a real supply-chain hardening finding, but changing it may affect package install/build behavior and should be handled in a dedicated CI-hardening PR.
- One TypeScript bug finding in `rentrix-app/src/services/documents/DocumentRenderer.ts:279` (`typescript:S6544`) around using `document.fonts?.ready` in a boolean conditional. This is not part of Production DB rollout and should be fixed separately if confirmed by tests.
- Many PL/SQL duplication/non-printable-literal code smells in historical migrations and pgTAP tests. Refactoring already-applied historical migrations is forbidden; these should not be “fixed” by rewriting migration history. Prefer Sonar exclusions for immutable migration history or a targeted forward-only change where appropriate.

## Production read-only inspection status

Only public HTTP probes were possible. Public probes confirmed the response header `sb-project-ref: nnggcnpcuomwfuupupwg`. The repository-pinned publishable key was rejected by Supabase REST/Auth with `UNAUTHORIZED_INVALID_API_KEY`, so it cannot be used for Auth/read-only verification.

Blocked without approved read-only database/management access:

- `supabase_migrations.schema_migrations` ledger read.
- Live table/column type inspection for `journal_entries`, `audit_log`, `receipts`, `tenant_deposits`, `deposit_transactions`, `payments`, `storage.buckets`, and `storage.objects` policies.
- Live RPC signatures/definitions for `void_receipt_atomic`, deposit RPCs, and `rpt_daily_collection`.
- Live `pg_policies` check for attachments policies.
- Storage bucket metadata via authenticated APIs.
- Auth login/logout/session restoration and read-only browser verification.
- Read-only report RPC execution.

## Migration-specific preflight assessment pending live access

### `20260721090000_harden_private_attachments_bucket.sql`

Repository intent: upsert the `attachments` bucket contract and drop a legacy broad upload policy. Existing docs claim Production already has the desired bucket metadata and manager-only mutation policies, but that claim was not revalidated in this preflight because live DB/API access was unavailable.

Potential risk: applying the full file would mutate Storage bucket metadata and drop a policy. If Production already matches, the least-change path may be ledger reconciliation only or no action, but only after backup and explicit approval; no repair should be used to hide drift.

### `20260721161500_reconcile_release_runtime_shapes.sql`

Repository intent: reconcile `journal_entries`/`audit_log` identifier/date/source shapes, add missing journal lifecycle columns, and replace `rpt_daily_collection(date,date)`.

Potential risk: column type conversions and RPC replacement. The file may be unnecessary or partially unnecessary if Production already has the live text contracts. A smaller forward reconciliation migration may be safer, but that decision requires live column and RPC definition evidence.

### `20260721162000_fix_void_and_deposit_replay_compatibility.sql`

Repository intent: preserve/convert `receipts.voided_at` as epoch-millisecond `bigint` and replace deposit RPCs for text/UUID compatibility.

Potential risk: column type conversion for `receipts.voided_at` and multiple RPC replacements affecting VOID/deposit financial flows. Must verify live types and RPC definitions first. A smaller forward reconciliation migration may be required if Production already matches some contracts.

## Backup preflight status

No backup evidence was available in this environment. Not verified:

- latest backup timestamp;
- backup type;
- retention;
- restore method;
- restore target;
- restore rehearsal evidence.

Automatic backups alone are not sufficient evidence. The rollout remains NO-GO until a restore path is known and evidenced.

## Current decision

NO-GO / HOLD. The next safe action is to obtain approved read-only Supabase database/management access plus backup/restore evidence. Stop before the first Production write.
