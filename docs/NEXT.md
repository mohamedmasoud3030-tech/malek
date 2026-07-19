# Next

## Current checkpoint

> Verified starting `main` head: `d1c5d19` after merged PR #1212 on 2026-07-19.

The bounded architecture refactor, migration-ledger consolidation, unit/contract integrity work, mobile form stabilization, theme expansion, action cleanup, stale-document removal, automation retry repair, and live owner-settlement workspace are complete in the repository. Do not reopen those phases from historical plans.

## Execute now — authenticated release verification

Complete the remaining launch evidence in this order:

1. **Deposits:** rollback-isolated authenticated lifecycle passed on production on 2026-07-19: create → idempotent replay → overdraw rejection → deduct → idempotent replay → refund → idempotent replay. The final amounts reconciled to zero remaining, six journal entries balanced at 200 debit / 200 credit, and forced rollback left zero test rows. A persistent Staging/approved isolated-target run is still required before final Go/No-Go.
2. **Automation:** manual execution and the scheduled-run path passed in a rollback-isolated authenticated production check on 2026-07-19. PR #1211 merged the retry repair after clean database replay and all release gates passed. The migration remains unapplied to production pending explicit approval; after application, verify one real failed-run retry.
3. **Owner settlements:** rollback-isolated authenticated production lifecycle passed on 2026-07-19: draft → idempotent replay → duplicate-period rejection → approve → idempotent replay → pay → idempotent replay. The paid settlement reconciled 1000 collected - 350 office fee - 50 owner expenses = 600 net; the payout posted one balanced batch (600 owner-payable debit / 600 cash credit), wrote CREATE/APPROVE/PAY audit evidence, rejected a second payment and paid-settlement cancellation, and left zero test rows after rollback. PR #1212 replaced the hard-coded UI with live Supabase queries/RPC mutations and real company settings for printing.
4. **Private Storage:** live read-only inspection on 2026-07-19 confirmed the `attachments` bucket is private with a 5MB PDF/JPEG/PNG/WebP contract, but found a legacy `authenticated upload attachments` policy that allows any authenticated user to insert and bypasses the intended ADMIN/MANAGER restriction. Migration `20260719134000_harden_private_attachments_bucket.sql` removes the broad policy, recreates the canonical policy set, and pins the bucket contract. The fix passed a production subtransaction/forced-rollback verification with zero persistent changes. The Release Blocker now includes a fail-closed non-production Storage smoke for upload → signed download → anonymous/public denial → cleanup. Merge and pass clean replay plus this Staging smoke, then apply the migration to production only with explicit approval.
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
