# Parallel Agent Handoff — WP-05 / GAP-017 Bank CSV Closeout

## Isolation contract

This lane runs in parallel with WP-02/GAP-007 PR #1440.

- Repository: `mohamedmasoud3030-tech/malik`
- Base: `main@894224b8d323d1eacbcf7c571210bb99fbb6f366`
- Branch: `feat/wp05-gap017-bank-csv-closeout`
- Scope: WP-05 / GAP-017 only.
- Merge order: PR #1440 first, then update this branch once from latest `main`, run the focused bank/replay checks, and merge this PR.
- Do not merge/rebase/cherry-pick PR #1440 while implementation is in progress.
- Do not modify global canonical status documents in this PR; status reconciliation happens after both parallel lanes merge.

### Forbidden paths and symbols

Do not modify:

- `rentrix-app/src/p2/**`
- `rentrix-app/src/features/financials/fixed-monthly/**`
- `supabase/migrations/20260813210000_wp02_fixed_monthly_daily_accrual.sql`
- `supabase/migrations/20260813211000_wp02_rate_payment_auth_sqlstate_repair.sql`
- `supabase/rollback/20260813210000_rollback_wp02_fixed_monthly_daily_accrual.sql`
- `supabase/migrations/20260813170000_wp02_rate_fee_collection_wiring.sql`
- `supabase/migrations/20260809010000_s04_property_management_gl_rpcs.sql`
- `record_invoice_payment_atomic`
- `gl_pm_accrue_fixed_monthly_fee`
- `owner_agreement_versions`
- `docs/source-of-truth/04_FINANCE_AND_ACCOUNTING_MODEL.md`
- `docs/source-of-truth/07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`
- `docs/source-of-truth/08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md`

If a required change reaches a forbidden path, stop and report it instead of editing it.

## Canonical requirement

D16 / OPS-014 / GAP-017:

- CSV import is preview-first and fail-closed.
- Invalid or ambiguous input blocks the whole batch.
- No silent partial financial import.
- File size, row limits, authoritative counts and OMR 3dp are enforced server-side.
- Company isolation and permission checks fail closed.
- Replay/idempotency must not duplicate imported lines.

Existing implementation already includes parser, UI workflow, atomic import RPC and pgTAP coverage. This task must inspect live repository reality, close only genuine remaining holes and produce current-SHA evidence. Do not rewrite working code merely for style.

## Immediate assignment

Close GAP-017 end to end.

### Inspect first

- `rentrix-app/src/lib/bankCsvParser.ts`
- `rentrix-app/src/lib/bankCsvParser.test.ts`
- `rentrix-app/src/features/financials/reconciliation/bankCsvImportService.ts`
- `rentrix-app/src/features/financials/reconciliation/bankCsvImportService.test.ts`
- `rentrix-app/src/features/financials/reconciliation/bank-csv-import-workflow.tsx`
- `rentrix-app/src/features/financials/reconciliation/bank-csv-import-migration-contract.test.ts`
- `rentrix-app/src/features/financials/reconciliation/bank-csv-import-s02-contract-replay.test.ts`
- `supabase/migrations/20260805000001_bank_csv_import_hardening.sql`
- `supabase/migrations/20260805120000_s02_bank_csv_import_atomic_contract.sql`
- `supabase/migrations/20260807160000_s02_bank_csv_import_server_guards.sql`
- `supabase/tests/bank_csv_import_fail_closed.sql`

### Required behavior/evidence

Prove or repair:

1. Preview happens before every write and clearly shows total/accepted/rejected/duplicate/ambiguous counts.
2. Client-side checks are UX only; the RPC independently enforces company, permission, file-size, row-count, field shape, currency and OMR 3dp.
3. Missing/ambiguous mappings block confirm/import.
4. Any invalid row rejects the whole batch and leaves import and line counts unchanged.
5. More than 5 MB and more than 5,000 rows reject server-side.
6. Exactly one amount representation is accepted per row: amount OR debit OR credit.
7. Date and numeric parsing are deterministic and locale-safe.
8. Cross-company bank accounts and reads fail.
9. Same logical request/fingerprint replays without duplicate lines; a reused key with different immutable content fails closed.
10. Duplicate and possible-duplicate behavior is explicit, visible and never a silent partial import. Preserve existing behavior only if it satisfies D16; otherwise make it fail closed.
11. The response counts equal persisted server counts.
12. UI has Arabic loading/error/empty/blocked/completed states and never claims full success for a partial result.
13. No journal posting or matching side effect occurs during CSV staging import.

Prefer a server-authoritative preview/validation RPC if current code cannot prove count parity and no-write behavior without trusting the client. Keep the import staging-only.

### Allowed write scope

- `rentrix-app/src/lib/bankCsvParser*`
- `rentrix-app/src/features/financials/reconciliation/bankCsvImport*`
- `rentrix-app/src/features/financials/reconciliation/bank-csv-import-*`
- `rentrix-app/src/p5/wp05-bank-csv-*`
- new bank-CSV-only migration(s) generated with Supabase CLI, reserving timestamp range `2026081403xxxx`
- matching bank-CSV rollback
- `supabase/tests/bank_csv_import_fail_closed.sql`
- `evidence/wp05/gap017/**`
- this handoff file

Ask before touching anything else.

## Verification and delivery

- Use current Supabase docs/changelog before changing RPC/RLS behavior.
- Run focused parser/service/workflow tests and isolated migration replay/pgTAP.
- Run TypeScript/build only if affected.
- Maximum five minutes for any single broad suite. Stop a slow broad suite, record the cutoff, and continue.
- Never bypass: migration replay error, TypeScript/build error, cross-company leakage, partial-write behavior, count mismatch, 3dp violation, or idempotency/content-reuse defect.
- Open one non-draft PR to `main`.
- In the PR body list: proven existing controls, actual fixes, tests/evidence, deferred non-critical checks, and the post-#1440 update/merge requirement.
- Do not deploy or mutate production.
- Do not claim all of WP-05 complete; this PR closes GAP-017 only.
