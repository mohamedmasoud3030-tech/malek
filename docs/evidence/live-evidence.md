# Live evidence report

> **Generated artifact — do not edit by hand.** Regenerate with `pnpm evidence:live`.
> **Revision:** `6c4dc560ccf1c74785108fa2a3cf6a6ad368fc24`
> **Generated:** 2026-10-21T03:07:45.546Z
> **Engine:** PGlite (PostgreSQL 18 in WASM), schema replayed from `supabase/migrations`.

## What this report proves — and what it does not

A `PROVEN_LOCALLY` gap means every mapped proof unit executed and passed **at this revision,
against a real PostgreSQL engine**. It does **not** mean the gap is closed.

This environment has no Supabase Auth service, no PostgREST, no Storage, no browser and no
hosted project. The following cannot be established here, for any gap:

- Supabase Auth service (JWT issuance, sessions, hooks)
- PostgREST HTTP layer
- Supabase Storage
- Browser rendering and Playwright journeys
- Hosted configuration, secrets, grants at the deployed SHA
- Legal opinion and pilot operations

## Summary

| Status | Gaps |
| --- | ---: |
| PROVEN_LOCALLY | 14 |
| NO_LOCAL_PROOF | 4 |

## Per-gap evidence

| Gap | Status | Assertions | Proof units | Remaining (cannot be shown locally) | Authority |
| --- | --- | ---: | --- | --- | --- |
| GAP-001 | PROVEN_LOCALLY | 95 | `permission-catalog`, `rls-matrix` | Live migration of the exact release SHA plus hosted role/JWT/RLS verification. Local proof covers the six roles, catalog parity and per-role projections. | QA environment |
| GAP-003 | PROVEN_LOCALLY | 107 | `rls-matrix`, `company-isolation`, `deposit-persistence` | Release-SHA live negative tests and Auth Hook/claim/policy evidence on a hosted project. Local proof covers two-company SELECT/UPDATE/DELETE and role boundaries on the replayed schema. | QA environment |
| GAP-006 | PROVEN_LOCALLY | 22 | `core-financial`, `collections-close`, `product-workflow` | Hosted/pilot proof of the owner-agency invoice → collection → fee → VOID journey. Local proof covers collection-role mapping and ledger effects. | QA environment |
| GAP-007 | PROVEN_LOCALLY | 32 | `fixed-monthly-accrual`, `core-financial` | Hosted lifecycle evidence for FIXED_MONTHLY daily accrual, catch-up and reversal across periods. | QA environment |
| GAP-008 | PROVEN_LOCALLY | 38 | `owner-receivable-offset`, `owner-receivable-recovery`, `owner-reconciliation`, `owner-funds-cutover` | Hosted lifecycle evidence for owner expense → 1300, lawful offset gating and post-payout recovery. | QA environment |
| GAP-009 | PROVEN_LOCALLY | 21 | `deposit-persistence`, `collections-close` | 3dp hosted deposit lifecycle (receive/apply/refund/reverse) reconciled to 2200 with maker-checker. | QA environment |
| GAP-010 | PROVEN_LOCALLY | 13 | `tax-authority` | Professional/legal confirmation of statutory Oman tax codes, plus a hosted lifecycle run. | Accountant + QA environment |
| GAP-011 | PROVEN_LOCALLY | 22 | `collections-close`, `core-financial`, `product-workflow` | Hosted adjustment lifecycle: credit note, receipt VOID and compensating reversal against real receipts. | QA environment |
| GAP-013 | PROVEN_LOCALLY | 14 | `owner-reconciliation`, `collections-close` | Hosted `wp05_reconcile_all` output at the release SHA over real data, with accountant acceptance. | QA environment |
| GAP-014 | PROVEN_LOCALLY | 14 | `owner-reconciliation`, `collections-close` | Hosted financial statement acceptance (trial balance, P&L, balance sheet, cash flow) at the release SHA. | QA environment |
| GAP-015 | PROVEN_LOCALLY | 27 | `s09-correction` | Hosted S08 frozen review plus an ACCOUNTANT approval signature. The database gate already blocks S09 without it. | Accountant |
| GAP-016 | PROVEN_LOCALLY | 27 | `s09-correction` | Operating S09 on governed scope after S08 approval. Engineering is proven locally; activation is gated by REL-004. | Accountant |
| GAP-017 | PROVEN_LOCALLY | 10 | `bank-governed-writes` | Hosted current-SHA import journey on authorized bank data, including the fail-closed CSV path. | QA environment |
| GAP-018 | PROVEN_LOCALLY | 2 | `sensitive-writes`, `sensitive-writes-tests` | Deployed grants/RLS verification on the hosted project. Repository-level boundary is now enforced by the restored guard. | QA environment |
| GAP-019 | NO_LOCAL_PROOF | 0 | — | Authorized legal review of Oman registration/retention policy before enabling a real profile. Local proof cannot establish legal validity. | Legal |
| GAP-020 | NO_LOCAL_PROOF | 0 | — | Authenticated seeded-staging browser acceptance. No browser is installed here and the Playwright CDN is unreachable; a skipped CI job is not a PASS. | Browser + QA environment |
| GAP-021 | NO_LOCAL_PROOF | 0 | — | Exact-SHA live config, Auth Hook, functions, secrets, RLS and restore evidence from the hosted project. | QA environment |
| GAP-022 | NO_LOCAL_PROOF | 0 | — | One real office running a full period with GL/subledger reconciliation and sign-off. | Pilot office |

## Reproducing

```bash
corepack pnpm install --frozen-lockfile --ignore-scripts && corepack pnpm rebuild esbuild
corepack pnpm evidence:live
```

A failure is a defect, not an evidence gap. `FAILED` must be fixed before any release claim.
