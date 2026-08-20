# SUPABASE HEALTH REPORT

> **Date:** 2026-08-20
> **Repository SHA:** `main@2cb25743` (branch `fix/db-consolidated-baseline-closeout`)
> **Status:** IN PROGRESS — Consolidated baseline built; database rebuild pending live Supabase access

## 1. Consolidated Baseline Status

| Check | Status | Notes |
|---|---|---|
| Baseline SQL syntax | ✅ PASS | Valid SQL (112 tables, ~346 functions, 205 RLS policies) |
| Migration 01-06 merged | ✅ PASS | All 6 post-baseline migrations merged into canonical baseline |
| ACL lock preserved | ✅ PASS | Grant revocation + internal function hardening included |
| recalculate_invoice_status fix | ✅ PASS | Revoked from authenticated (internal-only) |
| History archived | ✅ PASS | 289 files in migrations_history/ |
| Single active migration | ✅ PASS | Only `20260901000000_canonical_baseline.sql` in migrations/ |

## 2. Five Confirmed Defects Resolution

| # | Defect | Status | Resolution |
|---|---|---|---|
| 1 | FK constraint names (contracts_property_id_fkey etc.) | ✅ FIXED (pre-existing) | Canonical baseline already has correct constraint names |
| 2 | Date columns as text (start_date, end_date, due_date) | ✅ FIXED (pre-existing) | All stored as proper PostgreSQL `date` type in baseline |
| 3 | record_invoice_payment_atomic missing payment_id | ✅ FIXED (pre-existing) | Function returns `payment_id` via `jsonb_build_object('payment_id', v_payment_id)` |
| 4 | list_permission_requests_for_review type mismatch | ✅ FIXED (pre-existing) | Return table `requester_name text` matches SELECT `coalesce(full_name, name)` type |
| 5 | recalculate_invoice_status executable by public/anon | ✅ FIXED (this pass) | Revoked from authenticated; now internal-only in consolidated baseline |

## 3. Pending Items (Require Live Supabase Access)

| Item | Priority | Action Required |
|---|---|---|
| Database rebuild from consolidated baseline | HIGH | Apply consolidated baseline to connected Supabase project |
| Verify RLS policies against live | HIGH | Run negative tests for company isolation and role matrix |
| Regenerate database types | HIGH | `pnpm db0:gen-types` against rebuilt database |
| Run database gate checks | HIGH | Execute `scripts/ci/run-supabase-database-gate.sh` |
| Run lifecycle smoke tests | HIGH | Execute `single-office-isolated-smoke.mjs seed\|lifecycle\|verify` |
| Vercel deployment verification | MEDIUM | Confirm preview/production point to rebuilt Supabase |
| Auth hook verification | MEDIUM | Verify `custom_access_token_hook` is enabled and working |
| Storage bucket verification | MEDIUM | Verify RLS policies on documents bucket |
| Browser readiness suite | MEDIUM | Desktop/tablet/mobile e2e on deployed preview |

## 4. Known Gaps (from Canonical Pack Document 7)

| Gap ID | Status | Notes |
|---|---|---|
| GAP-001 (6 roles) | VERIFIED_IMPLEMENTED | Live migration pending |
| GAP-003 (company isolation) | BLOCKED_EXTERNAL | Requires live verification |
| GAP-006 (owner-agency accounting) | ENGINEERING COMPLETE | Hosted/pilot proof pending |
| GAP-009 (governed deposits) | ENGINEERING COMPLETE | Hosted/pilot proof pending |
| GAP-010 (tax authority) | ENGINEERING COMPLETE | Legal confirmation pending |
| GAP-013 (reconciliation) | ENGINEERING COMPLETE | Hosted/pilot proof pending |
| GAP-021 (live config) | EXTERNAL | Requires authorized environment access |

## 5. Recommended Next Actions

1. **[Immediate]** Start Supabase local instance (`supabase start`) or connect to project
2. Apply consolidated baseline to empty application schema
3. Run database gate: `pnpm supabase:db:gate` or equivalent
4. Regenerate types: `pnpm db0:gen-types`
5. Run lifecycle smoke: `node rentrix-app/scripts/single-office-isolated-smoke.mjs verify`
6. Run financial tests
7. Deploy to Vercel preview and verify browser journeys
8. Merge PR to main after CI passes