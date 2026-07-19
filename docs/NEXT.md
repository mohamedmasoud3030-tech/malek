# Next

## Current checkpoint

> Verified starting `main` head: `ae64eb0` after merged PR #1210 on 2026-07-19.

The bounded architecture refactor, migration-ledger consolidation, unit/contract integrity work, mobile form stabilization, theme expansion, action cleanup, and stale-document removal are complete. Do not reopen those phases from historical plans.

## Execute now — authenticated release verification

Complete the remaining launch evidence in this order:

1. **Deposits:** rollback-isolated authenticated lifecycle passed on production on 2026-07-19: create → idempotent replay → overdraw rejection → deduct → idempotent replay → refund → idempotent replay. The final amounts reconciled to zero remaining, six journal entries balanced at 200 debit / 200 credit, and forced rollback left zero test rows. A persistent Staging/approved isolated-target run is still required before final Go/No-Go.
2. **Automation:** manual execution and the scheduled-run path passed in a rollback-isolated authenticated production check on 2026-07-19. The same check proved `retry_automation_run` self-blocks by marking its source row `running` before duplicate detection. Migration `20260719123000_fix_automation_retry_self_duplicate.sql` fixes this by preserving the failed source row and creating a new execution. Merge, replay, apply with explicit production approval, then verify a real failed-run retry.
3. Run owner-settlement approval and payout with journal and balance reconciliation.
4. Verify private Storage upload, preview, and download through signed URLs, plus denied unauthorized access.
5. Run the final post-deploy browser smoke on the exact release candidate and record the Go/No-Go decision.

## Release verification contract

For the target environment:

1. Take a restorable backup before schema or production-risk changes.
2. Reconcile the merged migration chain with the live migration ledger; do not rewrite applied history.
3. Verify live RPC definitions used by contracts, collections, receipts/voiding, reports, deposits, automation, settlements, and document access.
4. Verify `pg_cron` and required scheduled jobs, or document the deployed fallback.
5. Run the authenticated core lifecycle: owner → property → unit → tenant → contract → invoice → partial/full payment → receipt → VOID.
6. Reconcile allocations, journals, owner/tenant balances, overpayments, orphans, and report totals.
7. Restore the backup into a separate Staging database and compare record counts and financial balances when the release procedure requires disaster-recovery evidence.
8. Validate production Vercel environment variables and run the final browser smoke.

## After the release gate

Only then proceed to bounded product/accounting completeness work:

- property-management office-fee rules;
- master-lease fixed owner obligations;
- daily/open-ended contract billing;
- utility posting to tenant/owner/office/suspense;
- split maintenance allocation;
- operation-level financial permissions;
- deferred-revenue and prepaid/annual-rent reporting;
- advanced bank-file reconciliation.

## Execution rules

- Finish and document one bounded concern before starting the next.
- Read current code and live contracts before trusting documentation.
- Keep visual refactors, financial behavior, database changes, and production mutations separated unless the reviewed task explicitly requires them together.
- UI polish and broad refactors are not launch blockers.
- Launch blockers are limited to data loss, authentication failure, broken contracts/collections, major financial errors, or critical security issues.
- Never claim production readiness from local tests alone.
