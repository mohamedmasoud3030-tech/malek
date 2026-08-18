# MALEK — AI Project Assessment

> **Type:** Non-canonical agent assessment. Canonical authority remains `docs/source-of-truth/`.  
> **Branch tip:** `arena/01a0163e-malik`  
> **Date:** 2026-08-18 (session continuation)  
> **Method:** repository inspection, canonical pack, prior PGlite/schema audits, local dev server, focused Vitest, security/business guards. Live Supabase API from this sandbox remains TLS-blocked.

## 1. Product definition

**MALEK** is an Arabic-first, RTL, multi-company rental property operations system for real-estate offices (Oman/OMR 3dp baseline).

Primary value: one controlled operational and accounting record of properties, units, owners, tenants, contracts, collections, expenses, deposits, owner settlements, maintenance, banking, reports, and documents.

Not in current release scope as finished products: generic ERP, owner/tenant consumer portals, full Master Lease UI, historical backfill without S08 approval.

## 2. Users and roles

Admin, Manager, Accountant, Operations, Viewer (+ effective grants). Company isolation is mandatory. Auth is Supabase; tenancy is JWT `app_metadata.company_id` via access-token hook + RLS/`current_company_id()`.

## 3. Architecture (observed)

| Layer | Reality |
|---|---|
| Frontend | React + Vite + TanStack Router/Query, PWA (`rentrix-app/`) |
| Backend | Supabase Auth + Postgres RLS + SECURITY DEFINER RPCs + private Storage |
| Accounting | Stage-3 GL, 18 accounts, append-only corrections, OMR 3dp |
| Quality | Vitest, Playwright, pgTAP/DB0, governance guards |
| Deploy | Vercel SPA + GitHub Actions |

## 4. Maturity

- **Repository:** mature RC candidate — deep financial/security design, broad tests, canonical pack.
- **Runtime/live:** not production-proven here (egress blocked; hosted Auth Hook / pilot / backup external).
- **Owner login on preview:** previously confirmed working with real project env.

## 5. Confirmed findings in this continuation

| ID | Severity | Evidence | Impact | Root cause | Correction | Effort/risk | Verification |
|---|---|---|---|---|---|---|---|
| UX-BANK-ERR | High | `bank-reconciliation-page.tsx` treated `!isLoading && length===0` as empty without `isError` | Operators see “no bank activity” on failed loads; KPI zeros look trustworthy | Error collapsed into empty | `ErrorState` + gate empty/table/KPI on `!isError` | S / low | contract tests 4/4 + typecheck |
| UX-PAYTERMS-ERR | Medium | `payment-terms-settings-section.tsx` empty copy when query fails | Settings look empty instead of failed | Missing `isError` branch | Alert on error; empty only when success | S / low | same contract test file |
| DATA-VIS (prior) | High | detail `.single()` 406, soft-deleted owners in hub | Missing/wrong detail and list disagreement | Cardinality + soft-delete filter | maybeSingle + filters (shipped) | M / low | 110+ tests prior |
| IDX-HOT (prior) | Medium | 24 hot FKs unindexed | Slow company lists at scale | company_id FKs without indexes | additive migration (repo; QA apply pack) | M / low apply | PGlite 401 indexes |
| SEC-WRITE | — | sensitive-write boundary guard | — | — | still OK this session | — | guard PASS |
| BIZ-RULES | — | canonical business rules guard | — | — | still OK | — | guard PASS |

## 6. External blockers (unchanged)

Sandbox→Supabase HTTPS, hosted Auth Hook proof, backup/restore, one-office pilot, tax/legal activation, full browser readiness on current SHA, Production migration ledger reconciliation.

## 7. Verdict

Continue shipping **safe repository honesty fixes** (error≠empty, cardinality, indexes) while live money-cycle proof waits on environment/owner ops. Do not claim production readiness from green unit tests alone.
