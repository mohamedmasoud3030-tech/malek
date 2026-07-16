# Next

> **Current main:** includes PR #1180 via merge commit `8d57580b9346ddca93fe8df0cbd696b9416645de`.  
> **Canonical execution checklist:** [`docs/handover/INTEGRATED_TODO_LIST.md`](handover/INTEGRATED_TODO_LIST.md).

## Current status

The engineering P0 release-blocker phase is complete and merged:

- mock-backed Utilities, Documents Vault, Deposits, and Automation were replaced with real implementations;
- AI Assistant auth/rate-limit flow was hardened;
- RLS, report source, production environment validation, and deterministic CI were implemented;
- owner settlements are connected to real tables/RPCs;
- date-only UTC slicing regressions are closed;
- Main CI, full Browser Readiness, Vercel Preview, Empty DB Replay, DB/RLS tests, and authenticated staging auth tests succeeded;
- Database and Auth release blockers passed 3/3 consecutive runs on the same SHA;
- PR #1180 was merged with zero open review threads.

Do not create another audit or reopen historical mock/CI items unless current code or live evidence proves a regression.

## Execute next — Phase 1 live release verification

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

## Execution rules

- Finish and document one phase before starting the next.
- Do not treat UI polish or broad refactors as launch blockers.
- Launch blockers are limited to data loss, authentication failure, broken contracts/collections, major financial errors, or critical security issues.
- Never claim Production readiness from local tests alone; use Staging/Production evidence appropriate to the risk.
