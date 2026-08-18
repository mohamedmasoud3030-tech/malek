# Supabase Query Audit

Generated: 2026-08-18  
Scope: browser query paths in `rentrix-app/src` against the current PostgREST contract.  
Live row counts / 406 traces: **Not verifiable remotely**. Defects below are proven from source + unit tests + the already-green RLS matrix.

## How to read statuses

| Status | Meaning |
|---|---|
| Confirmed | Source + regression test (and/or PGlite RLS) prove the defect or the fix |
| Probable | Same pattern as a confirmed defect; not yet given its own failing-then-fixed test |
| Not verifiable remotely | Needs hosted PostgREST / Production data |

## 1. Confirmed defects fixed in this PR

### Q1 — OPERATIONS UI offered writes RLS always denies

| Field | Value |
|---|---|
| Status | Confirmed |
| Evidence | Frontend `OPERATIONS` default set included `properties.write`, `contracts.write`, `expenses.write`, `documents.write` (`permissions.ts`). RLS / atomic RPCs / vault + storage mutations use `is_admin_or_manager()` (`20250101000002` and later). RLS matrix case `rls.operationsA.insert.properties` already denied the insert. |
| Root cause | Catalog capacity (`role_has_app_permission`) was copied into the UI. Database authority is narrower. Per-user `grantedPermissions` could also light up those actions. |
| Severity | High (fail-closed, but users see actions that always 403) |
| Fix | `serverEnforcedWriteRoles` fence in `canAccess`. Strip the four writes from the OPERATIONS default set. Keep `service_providers.write` (DB-enforced via `current_user_has_effective_app_permission`). Grants cannot bypass the fence. |
| Compatibility | Additive frontend contract. SQL catalog unchanged. ADMIN/MANAGER unchanged. |
| Migration | None |
| Rollback | Revert `permissions.ts` + auth tests |
| Verification | `permissions.test.ts`, `r5-authorization-matrix.test.ts` |
| Tests | OPERATIONS write cells now `false`. USER + `properties.write` grant stays read-only. USER + `service_providers.write` grant still opens shell write posture. |

### Q2 — `getProperty` used `.single()` (406 / phantom array)

| Field | Value |
|---|---|
| Status | Confirmed |
| Evidence | `property-service.ts` called `.single()`. Existing comments already documented 406 and `200 + []` phantom property UI. Callers (`useProperty`) treat `null` as empty. |
| Root cause | PostgREST `.single()` errors on 0 rows (406) and does not normalize a lenient empty array. |
| Severity | Medium (detail page errors or renders a blank property) |
| Fix | `.maybeSingle()` + keep array-normalize to `null` |
| Compatibility | Return type stays `Property \| null` |
| Migration | None |
| Rollback | Revert `getProperty` |
| Tests | `property-service.test.ts` — empty array → null; maybeSingle null → null; real error still throws |

### Q3 — `getContract` used `.single()`

| Field | Value |
|---|---|
| Status | Confirmed |
| Evidence | `contractService.ts`. `ContractDetailPage` already branches `isError` vs empty (`!data`). A 406 became an error instead of “العقد غير موجود”. |
| Root cause | Same as Q2 |
| Severity | Medium |
| Fix | `.maybeSingle()`, return `ContractDetail \| null`, array-normalize |
| Compatibility | Callers already handle null |
| Migration | None |
| Tests | `contractService.test.ts` missing-row suite |

### Q4 — `getUnitDetail` used `.single()`

| Field | Value |
|---|---|
| Status | Confirmed |
| Evidence | `unit-service.ts` PK lookup |
| Root cause | Same as Q2 |
| Severity | Medium |
| Fix | `.maybeSingle()`; if `!data` throw the existing Arabic not-found. Return type stays `UnitDetail`. |
| Tests | `unit-service.test.ts` |

### Q5 — `getLandDossier` used `.single()`

| Field | Value |
|---|---|
| Status | Confirmed |
| Evidence | `lands-service.ts` |
| Root cause | Same as Q2 |
| Severity | Medium |
| Fix | `.maybeSingle()` then the existing not-found throw |
| Tests | `lands-service.test.ts` |

### Q6 — `getPerson` used `.single()`

| Field | Value |
|---|---|
| Status | Confirmed |
| Evidence | `people-service.ts` then `requirePersonData` |
| Root cause | Same as Q2 |
| Severity | Medium |
| Fix | `.maybeSingle()` then `requirePersonData` |
| Tests | `people-service.test.ts` |

### Q7 — `listPropertyTitles` unbounded, unordered

| Field | Value |
|---|---|
| Status | Confirmed |
| Evidence | `property-service.ts` selected `id, title` with no `order` and no `.range()`. Used by reports occupancy labels (`reports-page.helpers.ts`). PostgREST silently caps at 1000. Missing titles render as “عقار بدون اسم”. |
| Root cause | Unpaged PostgREST read |
| Severity | Medium (silent wrong occupancy labels above 1000 properties) |
| Fix | `.order('title').order('id')` + `fetchAllRows` (page 1000, max 20). **Fail closed** on truncation — the hook does not expose a warning. |
| Compatibility | Same return type `PropertyTitleRow[]` |
| Tests | `property-service.test.ts` listPropertyTitles suite |

### Q8 — `listPeople` order was only `created_at`

| Field | Value |
|---|---|
| Status | Confirmed (non-deterministic pagination on ties) |
| Evidence | `people-service.ts` |
| Fix | Also `.order('id', { ascending: false })` to match properties/contracts |
| Severity | Low |
| Migration | None |

## 2. Remaining query issues (not changed)

### Same-class `.single()` PK lookups — Probable

Insert/update `.single()` after a write that must return one row is **intentional** and left alone.

Remaining **read** `.single()` PK lookups (same 406 / phantom-array class as Q2–Q6):

| Path | Notes |
|---|---|
| `owners/services/owner-service.ts` `getOwner` | Same as `getPerson` |
| `financials/invoices/invoiceService.ts` `getInvoiceDetail` | Same as `getContract` |
| `maintenance/maintenance-service.ts` get-by-id | PK lookup |
| `tenants/tenantWorkspaceService.ts` | PK lookup |
| `service-providers/service-provider-service.ts` | mix of read + write |
| `documents` / `contractDocumentsService` / `documents-vault` | some reads, some writes |
| `settings/companySettingsService.ts`, `costCenterService.ts`, `paymentTermsService.ts` | singleton-ish |
| `use-company.tsx` membership `.single()` | after the company is already known; fail-closed path exists |

Left out of this PR to keep the change set to the already-proven call sites. Next pass should convert the remaining **read** lookups to `.maybeSingle()` with the same null / not-found contract.

### Unbounded / under-ordered lists — Probable

`listContracts` / `listProperties` / `listUnits` / owner lists already page or use `fetchAllRows` with deterministic order. Other feature lists (lands after fetchAllRows, communication, leads) were not re-proven here.

### Live data integrity — Not verifiable remotely

Cannot compare Production row counts, orphan FKs, or 406 rates without hosted read-only access.

### Unindexed FKs — Confirmed in repo replay, not fixed

102 FKs lack a supporting index in PGlite. Mostly `company_id` plus journal-batch / tax / settlement links. **No index migration in this PR** (REQUIRES CARE; needs live advisor + workload). See `SUPABASE_SCHEMA_MAP.md` §5.

### Auth hook hosted enablement — Not verifiable remotely

Repo function, grants, and fail-closed claim handling are proven. The dashboard toggle is a production action (`GAP-003/021`).

## 3. RLS impact

None. No policy, grant, or RPC body was edited. The frontend now **hides** actions the database already denied.

## 4. Compatibility / rollback

- Frontend-only. No schema change.
- Rollback = revert the listed TypeScript files.
- OPERATIONS users lose four write buttons they could not successfully use.

## 5. Verification / tests

| Suite | What it covers |
|---|---|
| `permissions.test.ts` / `r5-authorization-matrix.test.ts` | Fence + OPERATIONS matrix |
| `property-service.test.ts` | `getProperty`, `listPropertyTitles` |
| `contractService.test.ts` | `getContract` null path |
| `unit-service.test.ts` / `people-service.test.ts` / `lands-service.test.ts` | not-found paths |
| `scripts/supabase-tests/rls-matrix.mjs` | extra hook `search_path` + missing-claim fail-closed |
| `pnpm test:supabase` | key scan + RLS matrix + visibility Vitest |

Exact counts after this PR: `SUPABASE_TEST_RESULTS.md`.
