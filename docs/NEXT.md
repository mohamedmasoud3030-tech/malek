# Next

## Current checkpoint

> Verified starting `main` head: `495ae198` after merged PR #1230 on 2026-07-21.

The bounded architecture refactor, migration-ledger consolidation, unit/contract integrity work, mobile form stabilization, theme expansion, action cleanup, stale-document removal, automation retry repair, live owner-settlement workspace, unified design system, mobile shell follow-up, private storage vault gate, and the documents/reports upgrade are complete in the repository. Do not reopen those phases from historical plans.

Completed on 2026-07-21 (PR #1230):

- Reports: all report sections converted from label/value lists to structured columnar tables; statement reports corrected for commission and opening balances.
- Documents: enhanced RTL print (B&W support, tafqit amount-in-words, footer timestamp); vault UI cleaned of developer jargon (no raw bucket/storage-path wording surfaced to users).
- CI: the production bundle build step now receives the live Supabase URL + publishable anon key instead of the isolated-test placeholders; the `rentrix-env-guard` placeholder warning no longer appears in build logs. Unit/financial tests remain isolated from any live backend.
- E2E: vault workspace selector aligned with the new private-storage copy (`التخزين الخاص` exact + `مساحة آمنة`) after the copy cleanup.

Release Verification evidence for the merged tree (tree hash `18c90edf`, identical on branch `4d7ea884` and merged `main` 495ae198):

- Local gates green: typecheck, lint, typecheck:test, unit tests (815), financial tests (214), architecture check, production build.
- GitHub Actions green on the merged SHA: `build`, `release-blocker-code`, `release-blocker-database` (full migration replay + pgTAP invariants + isolated Storage smoke), `release-blocker-authenticated-staging` (read-only auth lifecycle), `browser-smoke` (full Playwright suite).
- Read-only smoke executed against the actual release build (vite preview of `pnpm build` with live Supabase env): login renders, RTL document, standalone manifest + service worker served, unauthenticated `/dashboard` redirects to `/login`, zero console errors, and every non-GET request was hard-blocked at the network layer (zero write attempts observed).
- Static contract review passed: every RPC invoked by the app (contracts create/update/renew/terminate/soft-delete, `record_invoice_payment_atomic`, `void_receipt_atomic`, deposits create/deduct/refund, owner agreements, settlements draft/approve/pay, bank reconciliation match, `generate_invoices_from_active_contracts`, `resolve_maintenance_with_expense`, `rpt_owner_statement`, `rpt_tenant_statement`, `rpt_cash_flow`, `rpt_vat_return`, `rpt_dashboard_overview`) is defined in the merged 128-migration chain; the two storage-hardening migrations (`20260719150000`, `20260721090000`) pin the private-bucket contract.

## Execute now — authenticated release verification

Complete the remaining launch evidence in this order:

1. **Deposits:** rollback-isolated authenticated lifecycle passed on production on 2026-07-19: create → idempotent replay → overdraw rejection → deduct → idempotent replay → refund → idempotent replay. The final amounts reconciled to zero remaining, six journal entries balanced at 200 debit / 200 credit, and forced rollback left zero test rows. A persistent Staging/approved isolated-target run is still required before final Go/No-Go.
2. **Automation:** manual execution and the scheduled-run path passed in a rollback-isolated authenticated production check on 2026-07-19. PR #1211 merged the retry repair after clean database replay and all release gates passed. The migration remains unapplied to production pending explicit approval; after application, verify one real failed-run retry.
3. **Owner settlements:** rollback-isolated authenticated production lifecycle passed on 2026-07-19: draft → idempotent replay → duplicate-period rejection → approve → idempotent replay → pay → idempotent replay. The paid settlement reconciled 1000 collected - 350 office fee - 50 owner expenses = 600 net; the payout posted one balanced batch (600 owner-payable debit / 600 cash credit), wrote CREATE/APPROVE/PAY audit evidence, rejected a second payment and paid-settlement cancellation, and left zero test rows after rollback. PR #1212 replaced the hard-coded UI with live Supabase queries/RPC mutations and real company settings for printing. A persistent Staging/approved isolated-target run is still required before final Go/No-Go.
4. **Private Storage:** live read-only inspection on 2026-07-19 confirmed the `attachments` bucket is private with a 5MB PDF/JPEG/PNG/WebP contract, but found a legacy `authenticated upload attachments` policy that allowed any authenticated user to insert and bypassed the ADMIN/MANAGER restriction. Two migrations now pin the contract on `main`: `20260719150000_drop_rogue_permissive_attachments_upload_policy.sql` removes the broad policy and `20260721090000_harden_private_attachments_bucket.sql` pins `public=false` + the 5MB/4-MIME bucket config (and re-drops the rogue policy idempotently). Neither has been applied to production — apply only with explicit product-owner approval. Application code stores storage paths only (no public URLs); preview/download resolve signed URLs at view time across the vault, contract documents, and shared attachment field. The Release Blocker Gate now replays every migration, runs pgTAP invariants (bucket privacy/size/MIME exact set; every attachments mutation policy requires `is_admin_or_manager()`), then executes the isolated Storage smoke (upload → signed download → anonymous/public denial → disallowed-MIME denial → cleanup) on the same isolated local Supabase stack. GitHub secrets labelled Staging were proven to reference the production Supabase project, so no Staging write smoke is wired until item 5 is fixed; the smoke refuses production refs before any write.
5. **Staging configuration (BLOCKING):** replace `E2E_SUPABASE_URL` / `E2E_SUPABASE_ANON_KEY` with a genuine non-production project before any persistent Staging release rehearsal. Status on 2026-07-21: the secrets were last verified on 2026-07-19 to reference the production project (`nnggcnpcuomwfuupwg`), and GitHub does not expose secret values for re-verification; the `release-blocker-authenticated-staging` job remains intentionally limited to read-only authentication lifecycle checks (login/logout/invalid-credentials) so it is safe even if it still targets production. Until the owner confirms the secrets now point at a non-production project: no write smoke is permitted, and Release Verification is **not** complete.
6. Run the final post-deploy browser smoke on the exact release candidate and record the Go/No-Go decision. Code-side evidence (item above) is green; the authenticated staging rehearsal and the pending production migrations remain the open blockers.

## Release verification contract

For the target environment:

1. Take a restorable backup before schema or production-risk changes.
2. Reconcile the merged migration chain with the live migration ledger; do not rewrite applied history.
3. Verify live RPC definitions used by contracts, collections, receipts/voiding, reports, deposits, automation, settlements, and document access (static chain verified on 2026-07-21; live read-only DB verification via `SUPABASE_READONLY_DB_URL` / `supabase:live-readiness` still outstanding).
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
