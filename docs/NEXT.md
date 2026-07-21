# Next

## Current checkpoint

> Verified starting `main` head: `8088671b` on 2026-07-21; this includes merged PR #1230 and subsequent main updates.

The bounded architecture refactor, migration-ledger consolidation, unit/contract integrity work, mobile form stabilization, theme expansion, action cleanup, stale-document removal, automation retry repair, live owner-settlement workspace, unified design system, mobile shell follow-up, private storage vault gate, and the documents/reports upgrade are complete in the repository. Do not reopen those phases from historical plans.

Completed on 2026-07-21 (PR #1230):

- Reports: all report sections converted from label/value lists to structured columnar tables; statement reports corrected for commission and opening balances.
- Documents: enhanced RTL print (B&W support, tafqit amount-in-words, footer timestamp); vault UI cleaned of developer jargon.
- CI: the production bundle build step receives the live Supabase URL and publishable key instead of isolated-test placeholders; unit and financial tests remain isolated from live backends.
- E2E: vault selectors aligned with the private-storage copy.

## Zero-budget release-verification policy

Rentrix will not create a paid Supabase project or paid persistent Development Branch for Staging.

The approved release model is:

1. Every schema replay and write-heavy rehearsal runs on a fresh **ephemeral isolated Supabase stack inside GitHub Actions**.
2. The stack starts from an empty database, applies the full migration chain, runs authenticated pgTAP lifecycle tests and the real Storage HTTP smoke, then is destroyed automatically with no backup.
3. Production/deployed verification permits safe GET/HEAD/OPTIONS requests, Supabase Auth token/login/logout requests, and explicitly read-only `rpt_*` PostgREST RPC calls. Playwright blocks every other non-safe request before it can reach the backend.
4. No project named `Lena show`, no paid Supabase branch, and no persistent write smoke against Production are permitted.
5. The existing required-check identifier `release-blocker-authenticated-staging` is retained only for branch-protection compatibility; its implementation is `production-readonly` and is not a Staging write job.

## Completed — ephemeral release rehearsal

PR #1231 (`agent/ephemeral-release-rehearsal`) adds the missing isolated lifecycle coverage:

- contract creation through the authenticated privileged RPC;
- invoice payment and linked receipt creation;
- payment-backed receipt VOID, replay idempotency, invoice balance restoration, report exclusion, and balanced journal reversal;
- tenant deposit create → replay → overdraw rejection → deduction → replay → refund → replay;
- immutable deposit transactions and balanced deposit journal totals;
- owner settlement draft → replay → duplicate-period rejection → approve → replay → pay → replay;
- net payable reconciliation, one balanced payment batch, audit evidence, second-payment rejection, and paid-settlement cancellation rejection;
- the existing private Storage upload/signed-download/public-denial/MIME-denial/cleanup smoke on the same ephemeral stack.

All test data is wrapped in transactions or cleaned in `finally`; the GitHub Actions stack is stopped and removed on every exit path.

The rehearsal exposed clean-replay defects that were hidden by live-schema drift. Two forward migrations now reconcile both shapes without rewriting historical migrations:

- `20260721161500_reconcile_release_runtime_shapes.sql` aligns the replayed `journal_entries` and `audit_log` identifier/date/source columns with their verified live text contracts, restores the missing journal lifecycle columns, and makes `rpt_daily_collection` call the stable `_safe_date(text)` signature.
- `20260721162000_fix_void_and_deposit_replay_compatibility.sql` preserves the live epoch-millisecond `receipts.voided_at` contract and makes deposit RPCs safely support the text/UUID identifier shapes encountered across live and clean-replay databases.

Both migrations are committed to the repository migration chain only. Neither has been applied to Production.

## Verification evidence — PR #1231

Verified green on head `a0f98fa6` on 2026-07-21:

- `CI / Typecheck, Lint & Build` — success.
- `Release Blocker Gate / release-blocker-code` — success.
- `Release Blocker Gate / release-blocker-database` — success: full migration replay, all pgTAP suites including the new 60-assertion lifecycle rehearsal, and isolated Storage HTTP smoke.
- `Release Blocker Gate / release-blocker-authenticated-staging` — success; despite the retained check identifier, the implementation is deployed `production-readonly` verification.
- `Browser Readiness / E2E Smoke` — success.

No Production schema or data write and no paid Supabase resource were used for this evidence.

## Live production state verified on 2026-07-21

Production project: `nnggcnpcuomwfuupupwg` (`RENTRIX EGY (live)`).

Migration ledger:

- `20260719123000_fix_automation_retry_self_duplicate` — applied.
- `20260719150000_drop_rogue_permissive_attachments_upload_policy` — applied.
- `20260721090000_harden_private_attachments_bucket` — not recorded in the migration ledger.
- `20260721161500_reconcile_release_runtime_shapes` — repository-only pending release migration; not applied to Production.
- `20260721162000_fix_void_and_deposit_replay_compatibility` — repository-only pending release migration; not applied to Production.

Live Storage state already matches the storage-hardening contract:

- `attachments.public = false`;
- file-size limit = 5MB;
- exact MIME set = PDF, JPEG, PNG, WebP;
- every attachments mutation policy requires `is_admin_or_manager()`;
- no broad `authenticated upload attachments` policy exists.

Do not apply or repair-register `20260721090000`, `20260721161500`, or `20260721162000` on Production without a restorable backup and explicit product-owner approval. The missing ledger row and forward migrations are production-release items, not permission to write automatically.

## Release verification contract

For every release candidate:

1. Run the full ephemeral migration replay and all pgTAP tests.
2. Run the authenticated isolated lifecycle covering contracts, invoices, payment, receipt VOID, deposits, owner settlements, RLS, idempotency, journals, balances, and reports.
3. Run the real isolated Storage HTTP smoke on the same temporary stack.
4. Require deployed read-only Auth verification: valid login/logout, invalid credentials, invalid-session recovery, HTTPS health, safe reads, explicitly read-only `rpt_*` RPCs, and a network guard that blocks every other write-capable request.
5. Run the final browser smoke on the exact deployed release candidate and record Go/No-Go.
6. Before any Production schema or ledger repair: take a restorable backup, reconcile the merged migration chain with the live ledger, and obtain explicit approval.

## Current Go/No-Go

- **Repository/CI gate from PR #1231: GO** for the GitHub-required release checks recorded above.
- **Production Access & Backup Preflight: NO-GO / HOLD** as of 2026-07-21 23:50 Asia/Muscat. The preflight started from `main` head `0d3b7f32b2992921cd420e38dbf026ec0f595167` and did **not** perform any Production write.

### Repository/CI state

- Latest merged PR reviewed: #1231, merged at `2026-07-21T16:51:20Z` into `0d3b7f32b2992921cd420e38dbf026ec0f595167`.
- PR #1231 required release checks on head `0383870d` were green for `CI / Typecheck, Lint & Build`, `Release Blocker Gate / release-blocker-code`, `Release Blocker Gate / release-blocker-database`, `Release Blocker Gate / release-blocker-authenticated-staging`, and `Browser Readiness / E2E Smoke`.
- Current `main` head GitHub Actions build/Pages checks are green, but two external checks are not green and must be treated separately from the Production rollout:
  - `Supabase Preview` — failure: `Remote migration versions not found in local migrations directory`.
  - `SonarCloud Code Analysis` — failure: quality gate error.
- Local migration preflight confirmed 129 repository migrations, first `20250101000001_core_schema.sql`, last `20260721162000_fix_void_and_deposit_replay_compatibility.sql`, with no duplicate timestamps or ordering findings.
- Local full CI could not be completed in this sandbox because TypeScript/build processes exhausted or exceeded the execution limits. Use GitHub Actions as the authoritative CI runner for any PR.

### Supabase Preview drift

- The public GitHub check-run output exposes only the summary `Remote migration versions not found in local migrations directory`; it does **not** include the missing remote version list.
- No `SUPABASE_ACCESS_TOKEN` or `SUPABASE_DB_URL` was available in the operator environment, so the remote ledger/history could not be read.
- Known historical candidate areas from repository documentation, pending live verification:
  - `20260705000005_bank_reconciliation_foundation.sql` was applied live under ledger version `20260706081635`.
  - Metadata-only historical ledger repairs exist for `20260715000003` and `20260715000005`.
- Do **not** use migration repair or ledger mutation to hide this failure. First extract the live remote versions with approved read-only Supabase management/database access and classify them as true historical migrations, renamed equivalents, or drift from a previous deploy.

### SonarCloud findings

- Public SonarCloud quality gate status on `main`: ERROR.
- Failed conditions:
  - `new_duplicated_lines_density = 8.3%` where required `<= 3%`.
  - `new_security_rating = C` where required `A`.
  - `new_reliability_rating = C` where required `A`.
- Public issue fetch found 888 open/new-period issues: 873 code smells, 14 vulnerabilities, and 1 bug.
- Classification:
  - Real CI-hardening findings: GitHub Actions `pnpm install` steps without `--ignore-scripts` (`githubactions:S6505`). Fix only in a dedicated CI-hardening PR after proving package install/build still works.
  - Real code finding to review separately: `rentrix-app/src/services/documents/DocumentRenderer.ts:279` (`typescript:S6544`) around `document.fonts?.ready` in a boolean conditional. Not part of the Production DB gate.
  - External/static-analysis noise for this gate: PL/SQL duplication/non-printable-literal issues in immutable historical migrations and pgTAP tests. Do not rewrite applied migration history to satisfy Sonar; use exclusions or future-only refactoring if owner-approved.

### Production live state

- Public HTTP probes against `https://nnggcnpcuomwfuupupwg.supabase.co` confirmed response headers with `sb-project-ref: nnggcnpcuomwfuupupwg`.
- The repository-pinned publishable key was rejected by Supabase REST/Auth as `UNAUTHORIZED_INVALID_API_KEY`; therefore it cannot be used for Production read-only Auth or REST verification.
- Blocked until approved read-only access is available:
  - `supabase_migrations.schema_migrations` ledger read;
  - live table/column type inspection for `journal_entries`, `audit_log`, `receipts`, `tenant_deposits`, `deposit_transactions`, `payments`, `storage.buckets`, and `storage.objects` policy catalogs;
  - live RPC signatures/definitions for `void_receipt_atomic`, deposit RPCs, and `rpt_daily_collection`;
  - live `pg_policies` check for attachments policies;
  - Storage bucket metadata and signed URL checks;
  - Auth login/logout/session restoration and read-only browser verification;
  - read-only report RPC execution;
  - no-leftover-test-data verification.

### Migration-specific live-vs-repository status

Because live catalog access was unavailable, these are preflight classifications only; they are **not** approval to apply anything:

- `20260721090000_harden_private_attachments_bucket.sql`
  - Repository intent: upsert `attachments` bucket metadata and drop the legacy broad upload policy.
  - Already documented as matching Production in the previous checkpoint, but not revalidated in this preflight.
  - Potentially unnecessary/destructive if applied blindly because it mutates Storage metadata and drops a policy.
  - Decision pending live evidence: maybe no-op, maybe smaller ledger/documentation reconciliation, maybe full migration; cannot decide safely yet.
- `20260721161500_reconcile_release_runtime_shapes.sql`
  - Repository intent: reconcile `journal_entries`/`audit_log` text contracts, add journal lifecycle columns, and replace `rpt_daily_collection(date,date)`.
  - Potential risk: column type conversions and report RPC replacement.
  - Decision pending live evidence: prefer the smallest forward reconciliation over full-file application if Production already has some of the shapes.
- `20260721162000_fix_void_and_deposit_replay_compatibility.sql`
  - Repository intent: preserve/convert `receipts.voided_at` to epoch-millisecond `bigint` and replace deposit RPCs for replay/live compatibility.
  - Potential risk: type conversion plus RPC replacements affecting VOID/deposit financial flows.
  - Decision pending live evidence: verify live types and function definitions before deciding whether full file or smaller forward migration is appropriate.

### Backup state

No backup evidence was available in this environment. Not verified:

- latest backup timestamp;
- backup type;
- retention;
- restore method;
- restore target;
- restore rehearsal evidence.

Automatic backups alone are not sufficient. A restorable backup and a known restore procedure must be evidenced before any Production write is proposed.

### CI hardening branch state

A separate branch `fix/ci-hardening-sonar-supabase-diagnostics` was prepared for CI/Sonar/Supabase-diagnostic hardening only; it does not change Production schema, RLS, RPCs, Auth, ledger rows, or data.

Repository changes prepared on that branch:

- Fixed the Sonar `typescript:S6544` finding in `rentrix-app/src/services/documents/DocumentRenderer.ts` by avoiding a Promise-valued optional-chain expression in a boolean condition while preserving the font-loading behavior.
- Hardened GitHub Actions installs by using `pnpm install --frozen-lockfile --ignore-scripts` and then explicitly rebuilding only the approved native toolchain package, `esbuild`. A clean local install with lifecycle scripts disabled plus `pnpm rebuild esbuild` succeeded, and the pinned Supabase CLI remained `2.105.0`.
- Kept historical migrations and pgTAP fixture SQL immutable. Sonar exclusions were narrowed to generated evidence, immutable migration history, consolidated historical snapshots, SQL fixtures/tests, and existing test-file exclusions; application code and services remain in scope.
- Improved `scripts/collect-supabase-migration-evidence.sh` diagnostics so read-only ledger access prints local migration versions, counts local-only and remote-only drift, lists both sides of the diff, and fails with an explicit “do not repair or push automatically” message.

Local validation evidence from the sandbox:

- `pnpm install --frozen-lockfile --ignore-scripts` — pass after removing local `node_modules`.
- `pnpm rebuild esbuild` — pass.
- `node scripts/ci/verify-tool-versions.mjs` — pass; Supabase CLI `2.105.0`, Playwright `1.61.1`.
- `node scripts/check-doc-links.mjs` — pass for 70 maintained Markdown files.
- Workflow YAML parse check — pass for all maintained workflow files.
- `bash -n scripts/collect-supabase-migration-evidence.sh` — pass.
- `pnpm --filter ./rentrix-app run typecheck` and `pnpm --filter ./rentrix-app run lint` — pass.
- Targeted `DocumentRenderer.test.ts` — pass.
- `pnpm --filter ./rentrix-app run check:architecture` — pass.
- Full unit and financial Vitest suites executed their tests but ended with a sandbox worker-exit error after passing test files; rerun in GitHub Actions is required.
- Production build transformed modules but was killed by sandbox limits before completion; rerun in GitHub Actions is required.
- `typecheck:test` was killed by sandbox limits; rerun in GitHub Actions is required.
- E2E was not run locally because browser installation/runtime is not available in this sandbox; use GitHub Actions Browser Readiness as the authoritative runner.

### Pending approval / next stop

Production remains **NO-GO / HOLD**. Before the first Production write, collect and present:

1. backup evidence and restore procedure;
2. live-vs-repository ledger/schema/RPC/RLS/Storage diff;
3. exact minimal proposed migration or ledger/documentation action;
4. rollback/restore procedure;
5. risks and financial/RLS/Auth impact;
6. exact command to be executed;
7. explicit product-owner approval.

Persistent Staging is no longer a blocker because the approved zero-budget contract replaces it with an isolated ephemeral write environment. Production write approval remains required for migration-ledger reconciliation, forward migration application, or any future live schema/data mutation.

## After the release gate

Only after the Production database rollout gate is explicitly completed proceed to bounded product/accounting completeness work:

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
- Read current code and live contracts before trusting historical documentation.
- Keep visual refactors, financial behavior, database changes, and production mutations separated unless the reviewed task explicitly requires them together.
- UI polish and broad refactors are not launch blockers.
- Launch blockers are limited to data loss, authentication failure, broken contracts/collections, major financial errors, or critical security issues.
- Never claim production readiness from local tests alone.
