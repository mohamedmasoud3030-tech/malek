# S08 Operational Runbook — Read-only Historical Analysis

## Safety guarantee

**NO_FINANCIAL_DATA_MUTATION** — analysis never issues `INSERT | UPDATE | DELETE | TRUNCATE` on financial or operational tables, never creates corrective journals, never modifies settlements/payments/deposits, never backfills.

Proof:
- Static: `node scripts/s08/check-read-only.mjs` scans migration for forbidden DML (fails CI if found)
- Runtime: `summary.json -> read_only_proof.runtime.equal === true` (before/after checksums identical)
- DB: all S08 views use `security_invoker` (plain views) and functions are `security invoker` with `search_path = public, pg_temp`, company-scoped; revoke on `public`/`anon`.

## Prerequisites

- Permissions: `authenticated` with `is_app_user()` and membership in target company, or `service_role` for CI. `anon` and cross-company reads are denied by RLS (`p0_tenant_isolation` restrictive).
- No `service_role` in browser bundles (verified by `rentrix-app/src/test/db-contract/financial-writes-bypass.test.ts`).

## Run locally (PGlite, no network, no writes)

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm --filter @workspace/rentrix run lint && pnpm build
# Regenerate deterministic evidence (demo IDs, no prod data)
node scripts/s08/generate-evidence.mjs
# Verify read-only
node scripts/s08/check-read-only.mjs
# Run proof tests
pnpm --filter @workspace/rentrix exec vitest run src/s08/s08-read-only-analysis.test.ts
pnpm --filter @workspace/rentrix exec vitest run src/s08/s08-company-isolation.test.ts
pnpm --filter @workspace/rentrix exec vitest run src/s08/s08-proof-of-correctness.test.ts
# Hygiene
node scripts/check-migration-rollback-hygiene.mjs --base origin/main
bash scripts/collect-supabase-migration-evidence.sh
```

## Run on Staging (read-only, company-scoped)

```sql
-- As authenticated user, company is derived from JWT (current_company_id())
select * from public.s08_analyze_settlement_duplicates(current_company_id());
select * from public.s08_analyze_expense_misclassification(current_company_id());
select * from public.s08_analyze_deposit_exceptions(current_company_id());
select * from public.s08_orphan_postings(current_company_id());
select * from public.s08_liability_balances_by_period where company_id = current_company_id();
select * from public.s08_subledger_gl_reconciliation where company_id = current_company_id();
select * from public.s08_master_lease_readiness where company_id = current_company_id();
```

Or via scripts with `SUPABASE_URL` + read-only JWT:
```bash
node scripts/s08/run-analysis.mjs --company $COMPANY_ID --period 2026-01
```
All queries must be company-scoped; missing scope fails closed.

## Export without sensitive data

Artifacts under `evidence/s08/` use demo UUIDs and names (`Demo Malek Co A`, `Owner Alpha`...). Live datasets must be stored only as secure CI artifacts, never committed. Use `summary.json` counts + `findings.csv` (IDs only) for repo; strip PII before sharing.

## Finding codes

| Code | Severity | Meaning | S09 action category |
|------|----------|---------|---------------------|
| DUPLICATE_PAYMENT_ACROSS_SETTLEMENTS | HIGH | Same payment in >1 PAID settlement | NEEDS_REVIEW |
| DUPLICATE_EXPENSE_ACROSS_SETTLEMENTS | HIGH | Same expense in >1 PAID settlement | NEEDS_REVIEW |
| PAID_SETTLEMENT_WITHOUT_PAYMENT_EVIDENCE | MEDIUM | Paid settlement has no linked payment | NEEDS_REVIEW |
| OWNER_TENANT_EXPENSE_IN_OFFICE_ACCOUNT | MEDIUM | OWNER/TENANT expense in 6100 | FUTURE_CATCH_UP |
| MISSING_BENEFICIARY | MEDIUM | Expense/deposit missing beneficiary | NEEDS_REVIEW |
| DEDUCTION_WITHOUT_BENEFICIARY | HIGH | Deposit deduction no beneficiary | NEEDS_REVIEW |
| DEDUCTION_WITHOUT_APPROVED_CLAIM | HIGH | Deposit deduction no approved claim | NEEDS_REVIEW |
| REFUND_EXCEEDING_AVAILABLE_BALANCE | HIGH | Refund > available | POSSIBLE_OVERPAYMENT |
| SOURCE_WITHOUT_POSTING | MEDIUM | Invoice/contract without journal batch | NEEDS_REVIEW |
| POSTING_WITHOUT_SOURCE | HIGH | Journal batch without source | NEEDS_REVIEW |
| VOIDED_INVOICE_WITHOUT_REVERSAL | HIGH | Void invoice without reversal batch | NEEDS_REVIEW |
| RETROACTIVE_COMMISSION_CHANGE | MEDIUM | Agreement commission vs snapshot drift | POSSIBLE_OVERPAYMENT/UNDERPAYMENT |
| MASTER_LEASE_MISSING_DISCOUNT_RATE | HIGH | master_lease missing rate snapshot | MISSING_VERSION_EVIDENCE |
| SUBLEDGER_GL_MISMATCH | HIGH | Subledger vs GL difference | NEEDS_REVIEW |
| NOT_OBSERVABLE / INSUFFICIENT_HISTORY | LOW | Field not storable in current schema | NO_ACTION (document) |

Report rows always include `company_id, owner_id, property_id, agreement_id, settlement_id, source_type, source_id, period, amount (OMR 3dp)`.

## Known limitations (S08)

- `discount_rate`, `ROU_asset`, `lease_liability` are not columns on `owner_agreements`; master-lease readiness reports `MISSING_CRITICAL_DATA` when absent.
- Very old invoices/payments may have `company_id = NULL` (pre-phase2) → `INSUFFICIENT_HISTORY`.
- Expenses `charged_to/beneficiary` not in core DDL → `NOT_OBSERVABLE` until S05 app logic backfills.
- Deleted invoices keep `deleted_at` but journal lines are append-only; orphan detection shows `SOURCE_WITHOUT_POSTING` vs `POSTING_WITHOUT_SOURCE` bidirectionally.

## Checklist before PR

- [ ] `git fetch --all --prune && git rev-parse HEAD` matches `origin/main` base `6bc8eb4...`
- [ ] `scripts/s08/check-read-only.mjs` passes
- [ ] `evidence/s08/SHA256SUMS` validates (`sha256sum -c evidence/s08/SHA256SUMS`)
- [ ] All `src/s08/*.test.ts` green
- [ ] No DML/backfill/S09 logic introduced
