# Release Readiness

## Current readiness status

The repository is **not yet release-ready for financial workflows**. The current PR narrows one critical consistency gap by aligning `rpt_daily_collection` with the payment-backed receipt source of truth and by excluding VOID payments from collection totals.

## Verified in this PR

- The Receipts UI remains payment-backed.
- Financial report helpers now defensively exclude payments where `status = 'VOID'`, even if a historical row is not soft-deleted.
- A new migration defines `rpt_daily_collection` on `public.payments` rather than `public.receipts`.
- Contract tests assert the reporting RPC source and VOID/deleted exclusion rules.

## Not verified in this PR

- No production migration was applied.
- No browser/E2E run was completed.
- No live Supabase data was modified.
- Owner/tenant statement pages and accounting-statement screens remain incomplete.
- Contract lifecycle hardening and owner settlement engine work remain follow-up items.

## Release gate before financial launch

1. Apply pending migrations in a staging environment first.
2. Verify invoice → payment → receipt → void receipt → invoice balance → collection report in the browser.
3. Run the full command set in `docs/TESTING.md`.
4. Confirm role permissions for ADMIN, MANAGER, and USER on financial routes.
5. Record production verification evidence in `docs/CURRENT_STATE.md` after approved deployment.
