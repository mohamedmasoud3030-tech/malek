# Next

## Current checkpoint

> Verified starting `main` head: `f647a2a` after merged PR #1209 on 2026-07-19.

The bounded architecture refactor, migration-ledger consolidation, unit/contract integrity work, mobile form stabilization, theme expansion, and action cleanup are complete. Do not reopen those phases from historical plans.

## Execute now — authenticated release verification

Complete the remaining launch evidence in this order:

1. Run the authenticated deposit lifecycle against Staging or another isolated approved target: create → deduct → refund, including overdraw rejection and cleanup.
2. Verify automation rule execution, retry behavior, and the scheduled-run path.
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
