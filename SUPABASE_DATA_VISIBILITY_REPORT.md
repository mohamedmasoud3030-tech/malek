# Supabase Data Visibility Report

> **Date:** 2026-08-18  
> **Branch:** `arena/01a0163e-malik`  
> **Method:** repository inventory of every protected route + browser Supabase `.from`/`.rpc` call sites; prior PGlite RLS matrix + current focused Vitest; live hosted row counts **not** re-proven from this sandbox (outbound TLS blocked).  
> **Security stance:** no RLS disablement, no `service_role` in the browser, no broadened SELECT policies.

## Status vocabulary

| Status | Meaning |
|---|---|
| **Verified Working** | Query + empty/error contract + role matrix (or prior RLS proof) agree |
| **Confirmed Missing** | Zero-row / soft-delete / 406 path proven in source to hide or mis-render data |
| **Stale** | Mutation/cache path can show old data until refresh (not newly proven this pass) |
| **Unauthorized Exposure** | Would leak another tenant/user — **none introduced**; matrix remains deny-closed |
| **Unverified** | Needs hosted Auth Hook / live rows / browser journey |

---

## 1. Page → query → policy matrix (critical surfaces)

| Page / route | Primary reads | Authority | Empty vs error | Status after this pass |
|---|---|---|---|---|
| Login `/login` | Auth password grant | anon key only | config error vs bad credentials | **Verified Working** (owner logged in on preview) |
| Company context (shell) | `company_members` + JWT `app_metadata.company_id` | membership + hook claim | fail-closed full-page alert | **Verified Working** (repo + tests) |
| Today `/dashboard` | `rpt_dashboard_snapshot` RPC | company claim | error state, no fake zero KPIs | **Verified Working** (UI contract) / live data **Unverified** |
| Properties list/detail | `properties`, joins owners/agreements | company RLS; write admin/manager | null detail via `maybeSingle` | **Verified Working** |
| Units detail | `units` | company RLS | `maybeSingle` + Arabic not-found | **Verified Working** (prior fix) |
| Owners hub `/owners` | `owners` list | company RLS | soft-deleted excluded | **Confirmed Missing → fixed** (`listOwners` lacked `deleted_at` filter) |
| Owner detail `/owners/$id` | `getOwner` | company RLS | 406/`single` → empty-error confusion | **Confirmed Missing → fixed** (`maybeSingle` + deleted filter) |
| People / person dossier | `people` | company RLS | `maybeSingle` | **Verified Working** (prior fix) |
| Tenants `/tenants/$id` | `people` type=tenant + contracts/invoices | company RLS | 406 on missing tenant | **Confirmed Missing → fixed** |
| Contracts list/detail | `contracts` | company RLS | `maybeSingle` on detail | **Verified Working** (prior fix) |
| Lands dossier | `lands` + owner | company RLS | `maybeSingle` | **Verified Working** (prior fix) |
| Invoices detail | `invoices` + `payments` | company RLS / financial RPC for writes | 406 on missing invoice | **Confirmed Missing → fixed** |
| Receipts detail | `payments` (+ allocations enrich) | company RLS | 406 on missing payment | **Confirmed Missing → fixed** |
| Expenses update re-read | `expenses` after RPC | company / RPC | 406 after update edge | **Confirmed Missing → fixed** |
| Service provider detail | `service_providers` | effective permission | 406 on missing provider | **Confirmed Missing → fixed** |
| Leads update pre-read | `leads` status | company RLS | 406 before transition check | **Confirmed Missing → fixed** |
| Contextual vault replace | `vault_documents` read | company / admin-manager writes | 406 on missing doc | **Confirmed Missing → fixed** |
| Maintenance list | `maintenance_records` paged | company RLS | paged `fetchAllRows` | **Verified Working** |
| Bank / deposits / settlements | RPC-first financial paths | RPC + RLS | fail-closed RPCs | **Verified Working** (repo) / live **Unverified** |
| Reports / GL | report RPCs (`rpt_*`, `wp05_*`) | report permissions | error surfaces | **Verified Working** (repo) / live **Unverified** |
| Settings / cost centers / payment terms | table reads | admin-oriented | write `.single()` intentional | **Verified Working** |
| Documents vault upload | storage + `vault_documents` | admin/manager | write `.single()` intentional | **Verified Working** |
| AI assistant | Edge + read-only sources | membership + quota | configuration error | **Verified Working** (repo) |

### Remaining intentional `.single()` uses

Write paths that **must** return exactly one inserted/updated row (create/update/archive after a successful mutation) still use `.single()`. That is correct PostgREST usage and was **not** changed.

Examples left alone on purpose: `createOwner`, `createPerson`, maintenance RPC `.single()`, vault upload insert, category create/update.

---

## 2. Confirmed root causes fixed this pass

### V1 — Detail reads used `.single()` (406 / phantom empty)

| Field | Value |
|---|---|
| Status | **Confirmed Missing → fixed** |
| Surfaces | owner, invoice, tenant dossier, receipt, expense re-fetch, service provider, lead status pre-read, contextual document replace |
| Evidence | Source used `.single()` on PK lookups; PostgREST returns **406** when 0 rows, which UI often mapped to a generic error instead of “غير موجود”. Prior audit already fixed property/contract/unit/person/land. |
| Root cause | Wrong cardinality helper for optional existence |
| Secure fix | `.maybeSingle()` + normalize `[]` → null + Arabic not-found; **no** RLS widen |
| Why secure | Still company-scoped SELECT; missing row ≠ grant access |
| Tests | invoice/receipt/owner suites + prior property/person/contract/land |

### V2 — Owners hub listed soft-deleted owners

| Field | Value |
|---|---|
| Status | **Confirmed Missing → fixed** |
| Surface | `/owners` hub via `listOwners` |
| Evidence | `listOperationalOwners` filtered `deleted_at`; `listOwners` did not. Detail `getOwner` and property joins that filter deleted owners could disagree with the hub list. |
| Root cause | Inconsistent soft-delete filter between list and detail/selectors |
| Secure fix | `.is('deleted_at', null)` on `listOwners` |
| Why secure | Narrows visibility of archived rows; no cross-tenant change |
| Tests | `owner-service.test.ts` source contract |

### V3 — Leads list order non-deterministic on timestamp ties

| Field | Value |
|---|---|
| Status | **Confirmed Missing → fixed** (pagination stability) |
| Surface | `/leads` |
| Evidence | `order('created_at')` only |
| Fix | secondary `.order('id', { ascending: false })` matching people/contracts pattern |

### V4 — Frontend offered writes RLS always denies (prior, still valid)

Documented in `SUPABASE_QUERY_AUDIT.md` Q1: OPERATIONS write affordances fenced to match `is_admin_or_manager()`. Prevents “missing data after save” false reports when the write never succeeded.

---

## 3. Verified working controls (not regressed)

| Control | Evidence |
|---|---|
| Browser uses only public anon/publishable key | `privileged-key-scan.mjs` PASS; `supabase-client-boundary` tests |
| Active company fail-closed | `use-company.tsx` + 9 tests |
| Six-role authorization matrix | `r5-authorization-matrix` 120 tests PASS |
| Critical empty/error page states | `critical-page-states` 7 tests PASS |
| RLS multi-company isolation | Prior current-schema matrix **81/81** (PGlite); not re-run this minute but schema unchanged |
| Typecheck | `tsc --noEmit` PASS after fixes |

---

## 4. Unauthorized exposure check

| Scenario | Expected | Result |
|---|---|---|
| User A cannot read company B rows | deny | Unchanged RLS; no policy edits |
| Anon cannot read tenant tables | deny | Unchanged |
| Missing row does not become another row | not-found | `maybeSingle` + null normalize |
| Soft-deleted owner not in hub | hidden | `listOwners` filter |
| Service role not in client | absent | key scan PASS |

**Unauthorized Exposure: none found introduced.**

---

## 5. Hosted / environment limitations

| Item | Status |
|---|---|
| Owner login on Live Preview | **Verified Working** (owner-reported) |
| Sandbox → Supabase HTTPS | **Blocked** (`SSL_ERROR_SYSCALL`) — agent cannot re-query live counts from this runner |
| Hosted Auth Hook enabled on project | **Unverified** remotely (GAP-003/021). Repo hook function + grants proven in PGlite |
| Production migration drift vs live | See `SUPABASE_MIGRATION_AUDIT.md` — production apply still requires owner approval |
| Realtime subscription mismatches | **Unverified** this pass (app is primarily request/response Query) |

---

## 6. Code changes required (implemented)

| File | Change |
|---|---|
| `owners/services/owner-service.ts` | `listOwners` filter deleted; `getOwner` maybeSingle |
| `financials/invoices/invoiceService.ts` | `getInvoiceDetail` maybeSingle + Arabic not-found |
| `tenants/tenantWorkspaceService.ts` | `getTenantDossier` maybeSingle + row normalize |
| `service-providers/service-provider-service.ts` | `getServiceProvider` maybeSingle |
| `financials/receipts/receiptService.ts` | `getReceiptDetail` maybeSingle + Arabic not-found |
| `financials/expenses/expenseService.ts` | post-update re-read maybeSingle |
| `leads/services/leads-service.ts` | status pre-read maybeSingle; deterministic list order |
| `services/documents/contextualDocumentsService.ts` | replace read maybeSingle + empty normalize |
| Matching `*.test.ts` | regression coverage |

**Migrations:** none (frontend query correctness only).

**Rollback:** revert the listed TypeScript files.

---

## 7. Role-based regression expectations

| Actor | After fix |
|---|---|
| Admin/Manager company A | Sees A’s non-deleted owners, invoices, tenants, receipts; missing IDs → Arabic not-found, not 406 |
| User/Viewer company A | Same reads where permitted; writes still denied by RLS/UI fence |
| Admin company B | Never sees A’s rows (RLS unchanged) |
| Anon | Login only; no register data |
| Soft-deleted owner | Absent from hub; detail not-found |

---

## 8. Verification evidence (this session)

| Check | Result |
|---|---|
| Focused service tests (owners/invoices/receipts/properties/people/contracts/lands/providers/tenants) | **110/110 PASS** |
| Visibility + company + R5 + client boundary | **139/139 PASS** |
| Privileged key scan | **PASS** |
| App typecheck | **PASS** |
| Production build | not re-run this pass (query-only TS) |
| Live RLS HTTP against project `nnggcnpcuomwfuupupwg` | **Not executable** from sandbox egress |

---

## 9. Next single approval (only if owner wants live DB work)

**Recommended action:** authorize a **read-only** hosted verification (Auth Hook toggle confirmation + two-company negative SELECT) on the QA/project ref already provided — **no production schema apply**, no destructive repair.

| Impact | Proof Auth Hook is on; catch claim drift |
| Cost | None beyond existing Supabase project |
| Downtime | None |
| Risk | Low if read-only |
| Rollback | N/A (read-only) |

Until that approval, repository visibility defects above are fixed and regression-tested without touching production data or RLS breadth.
