# Next


## Current status

> Verified repository head: `e82b754ed7cbee8a07e809b87e935b4bf5c4cf37` from PR #1196 on 2026-07-18. There are no open pull requests at this checkpoint.

The bounded architecture refactor (phases A–E) is complete. The latest production incident fixes are merged, including authorization-helper recursion/grants, dashboard live-type compatibility, duplicate dashboard reads, and the public landing performance boundary.

The engineering P0 implementation is merged. As of 2026-07-18, Deposits and Automation are now live on production (`nnggcnpcuomwfuupupwg`):

- Utilities and Documents Vault are backed by real services and their current live contracts have been reconciled.
- Deposits and Automation migrations `20260717000003`, `20260717000004`, `20260717000005`, `20260717000007`, `20260717000008`, `20260717000009` were applied to production in dependency order on 2026-07-18 with explicit owner approval. Live-verified: `tenant_deposits`, `deposit_transactions`, `automation_rules` (6 rows seeded), `automation_notifications` all exist; RPCs `create_deposit_atomic`, `deduct_deposit_atomic`, `refund_deposit_atomic`, `execute_automation_rule`, `execute_automation_rule_internal`, `run_scheduled_automation_rules`, `retry_automation_run` are all live; the `tenant_deposits_status_check` constraint includes `partially_deducted`; `pg_cron` is enabled and `rentrix-automation-hourly` is scheduled and active (`0 * * * *`).
- Production authorization helpers and `rpt_dashboard_overview` were repaired and authenticated reads were verified after PR #1189.
- PR #1190 isolated the public landing entry from authenticated providers and heavy protected-app dependencies.
- PR #1195 repaired the canonical owner → property → agreement links, backfilled all 10 managed properties, and aligned owner reports/balances with payments and contract-level agreements. Production currently contains 8 `FIXED_MONTHLY` and 2 `RATE` agreements, with zero unlinked contracts, agreement/property/date mismatches, or invalid fee values in the 2026-07-18 read-only checkpoint.
- PR #1196 revoked direct API execution from internal owner-agreement trigger helpers and passed the security quality gate.

Do not recreate completed architecture phases or reopen historical UI refactors.

## Execute now — authenticated live release verification

1. Run the owner → property → agreement → unit → tenant → contract lifecycle with two different agreement fee policies. Confirm each contract keeps its own agreement and that `FIXED_MONTHLY` is never interpreted as a percentage.
2. Run invoice → partial/full payment → receipt → VOID and reconcile reports, journal entries, allocations, owner/tenant balances, and orphan checks.
3. Run authenticated CRUD/lifecycle tests for deposits (create → deduct → refund, overdraw rejection) and automation (rule execution, retry, scheduled run) against Staging first, then the approved Production target.
4. Keep the repository pgTAP release gate aligned with the live contract so fee-policy drift fails CI before deployment.

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

## Pending — migration ledger consolidation (dedicated conversation)

The `supabase/migrations/` directory now has ~99 files accumulated across baseline captures, hotfixes, and superseded repairs (for example, `20260717000010`/`20260717000011` were superseded by the later-applied `20260718075311`/`20260718075504`, and several stub files exist purely to register out-of-band repairs). The owner has requested this be consolidated into a smaller, clean baseline set, with old/duplicate/superseded/archived files removed.

This must be a dedicated conversation, not an extension of routine fix work, because:
- Every file must be cross-checked against the production ledger (`supabase_migrations.schema_migrations`) and live schema before it can be judged safe to remove or merge — this is a full-repository audit, not a quick pass.
- Deleting or reordering migration files risks breaking a from-scratch schema replay (`supabase db reset` / disaster recovery) even when production itself is unaffected.
- The established approach (see `docs/ENGINEERING_GOVERNANCE.md`) is: enumerate every live table/function/constraint, diff repo files against the ledger, diff the ledger against live objects, and only then decide what can be safely consolidated.

Do not start this inside an unrelated conversation or as a side effect of a different fix.

## Execution rules

- Finish and document one phase before starting the next.
- Do not treat UI polish or broad refactors as launch blockers.
- Launch blockers are limited to data loss, authentication failure, broken contracts/collections, major financial errors, or critical security issues.
- Never claim Production readiness from local tests alone; use Staging/Production evidence appropriate to the risk.
