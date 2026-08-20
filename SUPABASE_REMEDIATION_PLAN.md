# SUPABASE REMEDIATION PLAN

> **Date:** 2026-08-20
> **Status:** Phase 1 complete — consolidated baseline built
> **Owner:** Mohamed Masoud

## Phase 1: Consolidate Baseline ✅ DONE

| Step | Status | Detail |
|---|---|---|
| 1.1 Clone latest main | ✅ | `git clone` from `main@2cb25743` |
| 1.2 Read canonical docs | ✅ | AGENTS.md + DATABASE_RULES.md + Canonical Pack Docs 1-8 |
| 1.3 Identify all 5 defects | ✅ | Defects 1-4 pre-fixed in baseline; defect 5 fixed in this pass |
| 1.4 Build consolidated baseline | ✅ | Merged 00 + 01-06 into single SQL file (37,042 lines) |
| 1.5 Fix recalculate_invoice_status | ✅ | Revoked from authenticated; internal-only |
| 1.6 Archive old migrations | ✅ | 01-06 moved to `migrations_history/` |
| 1.7 Update DATABASE_RULES.md | ✅ | Added consolidated baseline rules + internal function security rule |
| 1.8 Create docs | ✅ | SUPABASE_SYSTEM_MAP.md, SUPABASE_HEALTH_REPORT.md, SUPABASE_DECISIONS.md, this plan |

## Phase 2: Rebuild Database 🔜 NEXT

| Step | Status | Detail |
|---|---|---|
| 2.1 Back up current Supabase project | ⏳ | Requires Supabase CLI or project access |
| 2.2 Connect to Supabase project | ⏳ | Requires project URL + service_role key |
| 2.3 Delete test data, Auth users, Storage objects | ⏳ | Via Supabase APIs |
| 2.4 Apply consolidated baseline | ⏳ | Run consolidated SQL against clean database |
| 2.5 Apply reference seed | ⏳ | Run `supabase/seed.sql` |
| 2.6 Verify RLS, functions, triggers | ⏳ | Manual verification or CI gate |
| 2.7 Reload PostgREST schema | ⏳ | `NOTIFY pgrst, 'reload schema'` |

## Phase 3: Verify Database 🔜 NEXT

| Step | Status | Detail |
|---|---|---|
| 3.1 Run database gate | ⏳ | `scripts/ci/run-supabase-database-gate.sh` |
| 3.2 Regenerate types | ⏳ | `pnpm db0:gen-types` |
| 3.3 Run lifecycle smoke | ⏳ | `single-office-isolated-smoke.mjs verify` |
| 3.4 Run financial tests | ⏳ | GL, reconciliation, OMR 3dp |
| 3.5 Run cross-company isolation tests | ⏳ | Negative tests for company boundaries |

## Phase 4: Verify Frontend Compatibility 🔜 NEXT

| Step | Status | Detail |
|---|---|---|
| 4.1 Check constraint names match frontend queries | ⏳ | contracts_property_id_fkey, contracts_tenant_id_fkey, contracts_unit_id_fkey |
| 4.2 Check date types in contracts/invoices | ⏳ | start_date, end_date, due_date as `date` type |
| 4.3 Check RPC signatures match frontend calls | ⏳ | record_invoice_payment_atomic, list_permission_requests_for_review, etc. |
| 4.4 Update frontend queries if needed | ⏳ | Only for exact compatibility |

## Phase 5: Vercel Deployment 🔜 NEXT

| Step | Status | Detail |
|---|---|---|
| 5.1 Confirm Vercel project config | ⏳ | Pointing to correct Supabase project |
| 5.2 Deploy to Vercel | ⏳ | From merged main branch |
| 5.3 Verify browser journeys | ⏳ | Login, dashboard, properties, contracts, invoices, payments |
| 5.4 Verify Auth, RLS, Storage in deployment | ⏳ | End-to-end |

## Phase 6: GitHub Closeout 🔜 NEXT

| Step | Status | Detail |
|---|---|---|
| 6.1 Open PR with consolidated baseline | ⏳ | PR from `fix/db-consolidated-baseline-closeout` to `main` |
| 6.2 Let CI run all gates | ⏳ | Wait for green checks |
| 6.3 Merge to main | ⏳ | After required checks pass |
| 6.4 Delete task branch | ⏳ | `fix/db-consolidated-baseline-closeout` |
| 6.5 Provide Arabic summary to owner | ⏳ | Final report |

## Blockers

| Blocker | Impact | Resolution |
|---|---|---|
| No Supabase CLI/Docker in sandbox | Cannot run database locally to verify baseline | Delegate to GitHub CI or provide live project access |
| No live Supabase credentials | Cannot rebuild connected database | Owner must provide project URL + service key |
| No pnpm in sandbox | Cannot run type generation, tests | CI will handle; or install pnpm |
| Repo is private | Need PAT for push | ✅ PAT provided |