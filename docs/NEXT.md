# Next


## Current status

> Verified starting repository head: `afb3126` after merged PRs #1198–#1200 on 2026-07-18.

The bounded architecture refactor (phases A–E) is complete. The latest production incident fixes are merged, including authorization-helper recursion/grants, dashboard live-type compatibility, duplicate dashboard reads, and the public landing performance boundary.

The engineering P0 implementation is merged. As of 2026-07-18, Deposits and Automation are now live on production (`nnggcnpcuomwfuupupwg`):

- Utilities and Documents Vault are backed by real services and their current live contracts have been reconciled.
- Deposits and Automation migrations `20260718100928`, `20260718101006`, `20260718101020`, `20260718101036`, `20260718101117`, `20260718101201` were applied to production in dependency order on 2026-07-18 with explicit owner approval. Live-verified: `tenant_deposits`, `deposit_transactions`, `automation_rules` (6 rows seeded), `automation_notifications` all exist; RPCs `create_deposit_atomic`, `deduct_deposit_atomic`, `refund_deposit_atomic`, `execute_automation_rule`, `execute_automation_rule_internal`, `run_scheduled_automation_rules`, `retry_automation_run` are all live; the `tenant_deposits_status_check` constraint includes `partially_deducted`; `pg_cron` is enabled and `rentrix-automation-hourly` is scheduled and active (`0 * * * *`).
- Production authorization helpers and `rpt_dashboard_overview` were repaired and authenticated reads were verified after PR #1189.
- PR #1190 isolated the public landing entry from authenticated providers and heavy protected-app dependencies.
- PR #1195 repaired the canonical owner → property → agreement links, backfilled all 10 managed properties, and aligned owner reports/balances with payments and contract-level agreements. Production currently contains 8 `FIXED_MONTHLY` and 2 `RATE` agreements, with zero unlinked contracts, agreement/property/date mismatches, or invalid fee values in the 2026-07-18 read-only checkpoint.
- PR #1196 revoked direct API execution from internal owner-agreement trigger helpers and passed the security quality gate.
- PR #1197 expanded the owner-agreement release gate to 32 pgTAP assertions, covering independent RATE and FIXED_MONTHLY agreements, and added the owner-statement schema-compatibility migration.
- The PR #1197 migration is applied to production as ledger entry `20260718161218_fix_owner_statement_owner_schema_compatibility`. Its authenticated ADMIN owner-statement smoke passed; anonymous execution remains denied.
- A read-only production integrity snapshot returned zero findings for contract/agreement/property mismatches, financial or allocation orphans, overpayments/overallocations, balance-formula drift, unbalanced posted journals, and deposit math/orphans. The hourly automation cron is active and four automation rules are enabled.

Do not recreate completed architecture phases or reopen historical UI refactors.

## Execute now — authenticated live release verification

The owner-agreement/report read-only release gate is complete in repository CI and production verification. Remaining launch evidence, in priority order:

1. Run the authenticated deposit lifecycle (create → deduct → refund, including overdraw rejection) against Staging or an isolated approved target with bounded test data and rollback.
2. Run automation rule execution, retry, and scheduled-run verification.
3. Run owner-settlement approval and payout with journal and balance reconciliation.
4. Verify private Storage upload, preview, and download through signed URLs, plus denied unauthorized access.
5. Run the final post-deploy browser smoke and record the Go/No-Go decision with evidence.

## Phase 1 live release verification

1. Take a restorable backup before applying schema changes to the target environment.
2. Apply and reconcile the merged migration ledger on Staging; verify no drift or orphan migrations.
3. Verify live RPC definitions and `rpt_daily_collection` against the merged source.
4. Verify `pg_cron` and `rentrix-automation-hourly`, or document the deployed scheduling fallback.
5. Run the authenticated end-to-end financial lifecycle:
   - owner → property → unit → tenant → contract;
   - invoice → partial/full payment → receipt → VOID;
   - reports, journal entries, allocations, owner/tenant balances, and orphan checks.
6. Run a complete deposit lifecycle with overdraw rejection.
7. Run owner-settlement approval and payout with journal/balance reconciliation.
8. Verify private Storage upload/preview/download through signed URLs and denied unauthorized access.
9. Restore the backup into a separate Staging database and reconcile record counts and balances.
10. Validate Production Vercel environment variables and run final post-migration browser smoke.
11. Record a final Go/No-Go decision with evidence.

## After Phase 1

Proceed to bounded product/accounting completeness work only after the live release gate is closed:

- property-management office-fee rules;
- master-lease fixed owner obligations;
- daily/open-ended contract billing;
- utility posting to tenant/owner/office/suspense;
- split maintenance allocation;
- operation-level financial permissions;
- deferred-revenue and prepaid/annual-rent reporting;
- advanced bank-file reconciliation.

## Completed — canonical migration-ledger reconciliation (2026-07-18)

The dedicated consolidation pass compared every active local filename with all
production `supabase_migrations.schema_migrations` rows. Fourteen files that
carried planning timestamps were renamed to their actual live ledger versions,
and all test/script references were updated. The duplicate historical
`supabase/migrations_consolidated/` snapshot and its obsolete guidance were
removed, leaving `supabase/migrations/` as the only SQL migration source.

The applied production history was deliberately not squashed or rewritten.
After adding `20260718170255_drop_legacy_void_receipt_overload` and the
clean-replay invariant repair `20260718173652`, the active chain and
production ledger both contain 110 exact `version_name` entries.
This preserves disaster-recovery replay order while removing the competing
archive, superseded filenames, and the unreachable receipt overload.

## Execution rules

- Finish and document one phase before starting the next.
- Do not treat UI polish or broad refactors as launch blockers.
- Launch blockers are limited to data loss, authentication failure, broken contracts/collections, major financial errors, or critical security issues.
- Never claim Production readiness from local tests alone; use Staging/Production evidence appropriate to the risk.
