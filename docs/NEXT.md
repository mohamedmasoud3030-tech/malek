# Next


## Current status

> Verified repository head: `7bb098f530fdd0041aa5588cbccd223b04beba5c` from PR #1190 on 2026-07-18. There are no open pull requests at this checkpoint.

The bounded architecture refactor (phases A–E) is complete. The latest production incident fixes are merged, including authorization-helper recursion/grants, dashboard live-type compatibility, duplicate dashboard reads, and the public landing performance boundary.

The engineering P0 implementation is merged. As of 2026-07-18, Deposits and Automation are now live on production (`nnggcnpcuomwfuupupwg`):

- Utilities and Documents Vault are backed by real services and their current live contracts have been reconciled.
- Deposits and Automation migrations `20260717000003`, `20260717000004`, `20260717000005`, `20260717000007`, `20260717000008`, `20260717000009` were applied to production in dependency order on 2026-07-18 with explicit owner approval. Live-verified: `tenant_deposits`, `deposit_transactions`, `automation_rules` (6 rows seeded), `automation_notifications` all exist; RPCs `create_deposit_atomic`, `deduct_deposit_atomic`, `refund_deposit_atomic`, `execute_automation_rule`, `execute_automation_rule_internal`, `run_scheduled_automation_rules`, `retry_automation_run` are all live; the `tenant_deposits_status_check` constraint includes `partially_deducted`; `pg_cron` is enabled and `rentrix-automation-hourly` is scheduled and active (`0 * * * *`).
- Production authorization helpers and `rpt_dashboard_overview` were repaired and authenticated reads were verified after PR #1189.
- PR #1190 isolated the public landing entry from authenticated providers and heavy protected-app dependencies.

Do not recreate completed architecture phases or reopen historical UI refactors.

## Execute next — deposits/automation lifecycle verification

1. Run authenticated CRUD/lifecycle tests for deposits (create → deduct → refund, overdraw rejection) and automation (rule execution, retry, scheduled run) against production or a Staging replica.
2. Add repository contract tests that lock the now-live schema (columns, constraint values, RPC signatures) so future migrations can't silently drift from it.
3. Confirm the frontend/service layer callers for deposits and automation now resolve against production (previously blocked by the absent tables/RPCs — see historical note below).

## Then — Phase 1 live release verification

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
