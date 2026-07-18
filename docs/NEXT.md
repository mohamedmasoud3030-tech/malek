# Next


## Current status

> Verified repository head: `7bb098f530fdd0041aa5588cbccd223b04beba5c` from PR #1190 on 2026-07-18. There are no open pull requests at this checkpoint.

The bounded architecture refactor (phases A–E) is complete. The latest production incident fixes are merged, including authorization-helper recursion/grants, dashboard live-type compatibility, duplicate dashboard reads, and the public landing performance boundary.

The engineering P0 implementation is merged, but two data contracts must not be described as live-ready yet:

- Utilities and Documents Vault are backed by real services and their current live contracts have been reconciled.
- Deposits and Automation have frontend/service/migration implementations in the repository, but their required tables and RPCs are absent from the verified production schema.
- The existing deposit/automation migration chain must not be applied as-is: its `property_id uuid` assumption conflicts with the verified live `properties.id text` contract.
- Production authorization helpers and `rpt_dashboard_overview` were repaired and authenticated reads were verified after PR #1189.
- PR #1190 isolated the public landing entry from authenticated providers and heavy protected-app dependencies.

Do not recreate completed architecture phases or reopen historical UI refactors. Current work must start from the verified data-contract mismatch below.

## Execute next — bounded data-contract stabilization

1. Correct the unapplied deposit and automation migration chain so every property reference matches the verified live `properties.id text` contract.
2. Add repository contract tests that reject UUID property references and verify migration dependency ordering.
3. Replay the corrected migrations on an empty/Staging database and reconcile tables, constraints, indexes, RLS policies, grants, and RPC signatures.
4. Run authenticated CRUD/lifecycle tests for deposits and automation on Staging.
5. Apply to Production only with a restorable backup, rollback/mitigation notes, and explicit approval under `docs/GOVERNANCE.md`.

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

## Execution rules

- Finish and document one phase before starting the next.
- Do not treat UI polish or broad refactors as launch blockers.
- Launch blockers are limited to data loss, authentication failure, broken contracts/collections, major financial errors, or critical security issues.
- Never claim Production readiness from local tests alone; use Staging/Production evidence appropriate to the risk.
