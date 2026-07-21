# Next

## Current checkpoint

Verified repository head after merged PRs #1232 and #1234.

The architecture refactor, migration-chain replay gate, unit/contract integrity work, mobile form stabilization, design-system unification, private document vault, reports/documents upgrade, CI hardening, and read-only Production preflight are complete in the repository. Do not reopen those phases from historical plans.

## Release-verification model

Rentrix uses a zero-budget verification model:

1. Schema replay and write-heavy lifecycle rehearsals run on a fresh ephemeral Supabase stack in GitHub Actions.
2. The stack starts empty, applies the full migration chain, runs pgTAP and the authenticated financial lifecycle, exercises private Storage, then is destroyed.
3. Deployed/Production verification is read-only: safe HTTP requests, Auth lifecycle, and explicitly read-only report RPCs only.
4. No persistent paid Staging project or Production write smoke is permitted.
5. The retained check name `release-blocker-authenticated-staging` is branch-protection compatibility only; its implementation is Production read-only.

## Repository and CI state — GO

PR #1232 completed CI hardening:

- dependency install lifecycle scripts are disabled;
- only the approved native toolchain package is rebuilt explicitly;
- `DocumentRenderer` Promise-conditional finding is fixed;
- immutable migrations and SQL fixtures are excluded narrowly from Sonar noise;
- migration-evidence diagnostics report local-only and remote-only versions without repair or push.

PR #1234 completed the safe Production preflight handoff:

- the active Supabase publishable key is used by the Production build;
- live reconciliation evidence is committed;
- Production QA residue inventory is committed;
- no migration files or Production writes were included.

Authoritative verification on these changes is green:

- `CI / Typecheck, Lint & Build`;
- application and test typechecks;
- full unit and financial suites;
- production bundle build;
- architecture check;
- `Release Blocker Gate / release-blocker-code`;
- `Release Blocker Gate / release-blocker-database` with full migration replay, financial lifecycle, and Storage blockers;
- `Release Blocker Gate / release-blocker-authenticated-staging` with read-only Auth lifecycle;
- `Browser Readiness / E2E Smoke`;
- SonarCloud quality gate;
- Codacy and Vercel checks.

## Production read-only preflight — COMPLETE

Production project: `nnggcnpcuomwfuupupwg` (`RENTRIX EGY (live)`).

Verified through authenticated read-only Supabase access:

- the live migration ledger;
- relevant table and column types;
- receipt VOID, deposit, and daily-collection RPC signatures, ownership, grants, security mode, and pinned search paths;
- private `attachments` bucket metadata and policies;
- security and performance advisors;
- bounded QA-residue dependency graph;
- protected-branch deployment logs.

Evidence:

- `evidence/preflight/production_live_reconciliation_20260721.md`
- `evidence/preflight/qa_residue_inventory_20260721.md`

No Production DDL, DML, migration repair, ledger mutation, write RPC, Storage mutation, or QA cleanup was executed.

## Migration-history reconciliation — PREPARED, MERGE BLOCKED

Draft PR #1233 contains only ten small metadata-only migration aliases/captures that make the repository history recognize authoritative versions already present in the live ledger.

The branch is technically verified:

- one commit;
- ten migration files;
- full migration replay green;
- financial and Storage gates green;
- Auth and E2E green;
- Sonar: zero new issues and zero new-code duplication.

Do not merge PR #1233 yet.

Read-only Supabase `branch-action` logs prove that every merge to protected branch `main` starts a Production deployment. Current deployments stop before migration application with:

`Remote migration versions not found in local migrations directory.`

Merging #1233 would remove that blocker and could automatically apply remaining local-only migrations to Production.

## Pending Production migrations

The following repository migrations are not recorded in the live ledger:

- `20260721090000_harden_private_attachments_bucket`
- `20260721161500_reconcile_release_runtime_shapes`
- `20260721162000_fix_void_and_deposit_replay_compatibility`

Read-only inspection found that Production already matches the important Storage, identifier-type, VOID timestamp, report, deposit, authorization, idempotency, and journal contracts. These files are release/replay reconciliation items, not evidence of a current Production outage.

Do not apply or repair-register them automatically.

## Backup gate — NO-GO / HOLD

The Supabase organization is on the Free plan.

No verified restorable managed backup, off-site logical dump, restore target, or restore rehearsal is available. Database-only backup would also not cover Storage object bytes.

Production writes remain **NO-GO / HOLD** until one of these controls is evidenced:

1. a verified restorable off-site database backup plus restore procedure and rehearsal; or
2. Supabase GitHub Integration `Deploy to production` is disabled before merging migration-history reconciliation, followed by a controlled deployment later.

Immediately before the first Production write, present:

- exact migration/ledger operation;
- expected schema, RPC, RLS, Auth, financial, and Storage effects;
- backup and restore evidence;
- rollback/restore procedure;
- exact execution command;
- explicit product-owner approval.

## Production QA residue — DO NOT DELETE DIRECTLY

The live dependency graph includes:

- 2 QA owners;
- 3 people/tenants;
- 2 properties;
- 2 units;
- 3 contracts;
- 2 owner agreements;
- 4 invoices;
- 4 receipts;
- 2 payments;
- 4 receipt allocations;
- 15 journal entries;
- 5 audit rows.

Cleanup must be forward-only, allowlist-based, reversal-aware, dependency-safe, transactionally guarded, and rehearsed against a verified backup. Ad-hoc deletion is prohibited.

## Current next action

1. Keep PR #1233 Draft and unmerged.
2. Obtain a verified off-site backup/restore path or disable Supabase `Deploy to production` in the GitHub integration.
3. Reconfirm live ledger and schema immediately before execution.
4. Obtain explicit approval for the exact Production write.
5. Apply only the approved minimal operation and verify Auth, safe reads, reports, Storage, financial balances, and absence of new QA residue.

## After the Production gate

Only after the Production database gate is explicitly complete proceed to bounded product/accounting completeness work:

- property-management office-fee rules;
- master-lease fixed owner obligations;
- daily/open-ended contract billing;
- utility posting allocation;
- split maintenance allocation;
- operation-level financial permissions;
- deferred-revenue and prepaid/annual-rent reporting;
- advanced bank-file reconciliation.

## Execution rules

- Finish and document one bounded concern before starting the next.
- Read current code and live contracts before trusting historical documentation.
- Keep UI, financial behavior, database changes, and Production mutations separated unless a reviewed task explicitly requires them together.
- UI polish and broad refactors are not launch blockers.
- Launch blockers are limited to data loss, authentication failure, broken contract/collection flows, major financial errors, or critical security issues.
- Never claim Production readiness from local tests alone.
