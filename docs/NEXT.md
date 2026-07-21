# Next

## Current checkpoint

> Verified starting `main` head: `495ae198` after merged PR #1230 on 2026-07-21.

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
3. Production/deployed verification is **read-only except for Supabase Auth token/login/logout endpoints**. Playwright blocks any other non-GET request before it can reach the backend.
4. No project named `Lena show`, no paid Supabase branch, and no persistent write smoke against Production are permitted.
5. The existing required-check identifier `release-blocker-authenticated-staging` is retained only for branch-protection compatibility; its implementation is `production-readonly` and is not a Staging write job.

## Execute now — ephemeral release rehearsal

Branch `agent/ephemeral-release-rehearsal` adds the missing isolated lifecycle coverage:

- contract creation through the authenticated privileged RPC;
- invoice payment and linked receipt creation;
- payment-backed receipt VOID, replay idempotency, invoice balance restoration, report exclusion, and journal reversal balance;
- tenant deposit create → replay → overdraw rejection → deduction → replay → refund → replay;
- immutable deposit transactions and balanced deposit journal totals;
- owner settlement draft → replay → duplicate-period rejection → approve → replay → pay → replay;
- net payable reconciliation, one balanced payment batch, audit evidence, second-payment rejection, and paid-settlement cancellation rejection;
- the existing private Storage upload/signed-download/public-denial/MIME-denial/cleanup smoke on the same ephemeral stack.

All test data is wrapped in transactions or cleaned in `finally`; the GitHub Actions stack is stopped and removed on every exit path.

## Live production state verified on 2026-07-21

Production project: `nnggcnpcuomwfuupupwg` (`RENTRIX EGY (live)`).

Migration ledger:

- `20260719123000_fix_automation_retry_self_duplicate` — applied.
- `20260719150000_drop_rogue_permissive_attachments_upload_policy` — applied.
- `20260721090000_harden_private_attachments_bucket` — not recorded in the migration ledger.

Live Storage state already matches the last migration contract:

- `attachments.public = false`;
- file-size limit = 5MB;
- exact MIME set = PDF, JPEG, PNG, WebP;
- every attachments mutation policy requires `is_admin_or_manager()`;
- no broad `authenticated upload attachments` policy exists.

Do not apply or repair-register `20260721090000` on Production without a restorable backup and explicit product-owner approval. The missing ledger row is a production-drift item, not permission to write automatically.

## Release verification contract

For every release candidate:

1. Run the full ephemeral migration replay and all pgTAP tests.
2. Run the authenticated isolated lifecycle covering contracts, invoices, payment, receipt VOID, deposits, owner settlements, RLS, idempotency, journals, balances, and reports.
3. Run the real isolated Storage HTTP smoke on the same temporary stack.
4. Require deployed read-only Auth verification: valid login/logout, invalid credentials, invalid-session recovery, HTTPS health, and a network guard that blocks unexpected writes.
5. Run the final browser smoke on the exact deployed release candidate and record Go/No-Go.
6. Before any Production schema or ledger repair: take a restorable backup, reconcile the merged migration chain with the live ledger, and obtain explicit approval.

## Current Go/No-Go

Code-side Go/No-Go is pending the CI result for `agent/ephemeral-release-rehearsal`.

Persistent Staging is no longer a blocker because the approved zero-budget contract replaces it with an isolated ephemeral write environment. Production write approval remains required only for the unrecorded `20260721090000` ledger reconciliation or any future live schema/data mutation.

## After the release gate

Only after the gate is green proceed to bounded product/accounting completeness work:

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
