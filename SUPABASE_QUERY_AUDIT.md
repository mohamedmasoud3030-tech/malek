# Supabase Query Audit

Generated: 2026-08-18  
Scope: browser query paths in `rentrix-app/src` against the current PostgREST contract + structural index support.  
Live row counts / 406 traces: **Not verifiable remotely** (sandbox egress). Defects below are proven from source + unit tests + PGlite inventory.

## How to read statuses

| Status | Meaning |
|---|---|
| Confirmed | Source + regression test (and/or PGlite inventory) prove the defect or the fix |
| Probable | Same pattern as a confirmed defect; not yet given its own failing-then-fixed test |
| Not verifiable remotely | Needs hosted PostgREST / Production data |

---

## 1. Confirmed defects fixed (this program of work)

### Q1 — OPERATIONS UI offered writes RLS always denies

| Field | Value |
|---|---|
| Status | Confirmed (prior + still valid) |
| Fix | `serverEnforcedWriteRoles` fence in `canAccess` |
| Migration | None |

### Q2–Q6 — Core detail reads used `.single()` (property/contract/unit/land/person)

| Field | Value |
|---|---|
| Status | Confirmed (prior) |
| Fix | `.maybeSingle()` + null / Arabic not-found |
| Tests | property/contract/unit/land/people service tests |

### Q7 — `listPropertyTitles` unbounded / unordered

| Field | Value |
|---|---|
| Status | Confirmed (prior) |
| Fix | deterministic order + `fetchAllRows` fail-closed ceiling |

### Q8 — `listPeople` order only `created_at`

| Field | Value |
|---|---|
| Status | Confirmed (prior) |
| Fix | secondary `.order('id')` |

### Q9 — Remaining critical detail reads used `.single()` (this branch)

| Field | Value |
|---|---|
| Status | **Confirmed → fixed** |
| Surfaces | `getOwner`, `getInvoiceDetail`, `getTenantDossier`, `getReceiptDetail`, expense re-read, `getServiceProvider`, leads status pre-read, contextual document replace |
| Root cause | PostgREST 406 on zero rows; UI treated as hard failure / “missing data” |
| Fix | `.maybeSingle()` + array-normalize + Arabic not-found |
| Migration | None |
| Tests | owners/invoices/receipts (+ related) suites PASS |

### Q10 — Owners hub listed soft-deleted owners

| Field | Value |
|---|---|
| Status | **Confirmed → fixed** |
| Evidence | `listOperationalOwners` filtered `deleted_at`; `listOwners` did not |
| Fix | `.is('deleted_at', null)` on `listOwners` |
| Impact | Hub vs detail / property-owner joins no longer disagree |

### Q11 — Utility lists non-deterministic page order

| Field | Value |
|---|---|
| Status | **Confirmed → fixed** |
| Evidence | `listUtilityMeters` / `listUtilityBills` ordered by date only while using `fetchAllRows` |
| Fix | secondary `.order('id', { ascending: false })`; bill balance pre-read uses `maybeSingle` |
| Tests | `utilities-service.test.ts` source contract |

### Q12 — Company switch membership read used `.single()`

| Field | Value |
|---|---|
| Status | **Confirmed → fixed** |
| Evidence | `use-company.tsx` `switchCompany` role lookup |
| Fix | `.maybeSingle()` + fail closed with `ACTIVE_COMPANY_ERROR` if membership vanished |
| Tests | `use-company.test.tsx`, `use-company-regression.test.ts` |

### Q13 — Hot-path FKs lacked supporting indexes (structural / performance)

| Field | Value |
|---|---|
| Status | **Confirmed → fixed (repo migration)** |
| Evidence | PGlite inventory: 102 unindexed FKs; 24 on operational hot tables (company_id on properties/units/people/owners/…, `receipt_allocations.receipt_id`, settlement link settlement side, maintenance expense/invoice FKs) |
| Root cause | Multi-tenant `company_id` FKs added without leading indexes; relationship reverse lookups used unindexed columns |
| Fix | Additive migration `20260831000000_hot_path_fk_covering_indexes.sql` |
| Result | indexes 377→401; unindexed FK 102→84; **hot-path unindexed = 0** |
| Compatibility | Index-only; no RLS/RPC change |
| Live apply | **Not applied to Production** — see migration audit approval gate |
| Tests | `hot-path-fk-index-migration.contract.test.ts`; inventory replay |

---

## 2. Remaining query notes (not changed this pass)

### Intentional write-path `.single()`

Insert/update `.select('*').single()` after a mutation that must return exactly one row remains correct (create owner/person/unit, vault upload, category create, maintenance RPC payloads).

### Probable same-class reads still using `.single()` on niche paths

| Path | Notes |
|---|---|
| `settings/companySettingsService.ts`, cost centers, payment terms | singleton-ish writes/reads |
| `documents-vault` upload return | write path |
| `utilities` create/update meter/bill return | write path (read pre-check fixed) |
| `deposits` some RPC wrappers | write path |

### Inner joins that intentionally hide parents

| Path | Behavior |
|---|---|
| `listOwnerProperties` `property_owners!inner` | Correct: only properties linked to the owner |
| `listInvoicesForProperty` `contracts!inner` | Correct: invoices for contracts of that property |
| Command palette contract search `!inner` on property/tenant | Correct: search requires both labels |
| Company membership `companies!inner` | Correct: only active companies |

These are **not** defects.

### Explicit FK relationship hints

Contract/tenant/people/deposit selects use `!contracts_property_id_fkey` / `!contracts_tenant_id_fkey` / `!contracts_unit_id_fkey` to prevent PostgREST ambiguous-relationship errors. Keep this pattern when adding new embeds.

### Unbounded reads

High-traffic lists use `fetchAllRows` or range pagination. Remaining low-traffic admin lists were not re-proven; prefer `fetchAllRows` + deterministic order when touching them.

### Live data integrity

Cannot compare Production row counts, orphan FKs, or real 406 rates without hosted read-only access.

---

## 3. RLS impact

- Index migration: **none** (no policy change).
- Query fixes: **none** (still company-scoped SELECT).
- Frontend write fence (Q1): aligns UI with existing RLS.

---

## 4. Compatibility / rollback

| Change | Rollback |
|---|---|
| Query `.maybeSingle` / soft-delete filters | Revert TypeScript files |
| Index migration | `DROP INDEX IF EXISTS` each named index |
| Write fence | Revert `permissions.ts` |

---

## 5. Verification / tests (this session)

| Suite | Result |
|---|---|
| PGlite schema inventory (full replay) | 282 migrations; 401 indexes; hot unindexed FK 0 |
| Migration hygiene guard | OK |
| `use-company` + regression | 19 PASS |
| utilities service | 6 PASS |
| hot-path index contract | 2 PASS |
| owners / invoices / receipts (prior visibility pack) | included in earlier 110 PASS set |
| typecheck | PASS |
| Privileged-key scan | PASS (prior) |
| Hosted PostgREST | Not executable here |

---

## 6. Page → query → structural support (summary)

| Domain | Primary query pattern | Structural support after this pass |
|---|---|---|
| Today dashboard | RPC `rpt_dashboard_*` | unchanged RPCs |
| Properties / units / people / owners | company RLS lists + detail maybeSingle | **company_id indexes added** |
| Contracts / tenants | FK-hinted embeds | existing property/unit/tenant indexes + company index |
| Invoices / payments / receipts | lists + receipt allocation batch | **receipt_id + company indexes** |
| Owner settlements | settlement link tables | **settlement_id, company_id pair indexes** |
| Maintenance | company lists + reverse expense/invoice | **company + expense/invoice indexes** |
| Utilities | fetchAllRows meters/bills | **company indexes + deterministic order** |
| Vault / leads / communication | company lists | **company indexes** |
