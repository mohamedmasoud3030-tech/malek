# PHASE 5 — Expand to core data operations (systematic verification)

Baseline: `main` @ `5a53be6b` + accepted Phases 3–4
(unit create/edit/archive ACL fix `20260912000001`; person create/edit/archive
ACL fix `20260912000002`).

Per the operator's Phase 5 plan, this phase does **not** assume that fixing
one CRUD path fixes the rest. It verifies the core operation classes
systematically:

> **Create / Read / Update / Persistence (refresh-reopen) / Business actions /
> Relationships / Financial actions (where applicable)**

…against the core data objects (property, unit, person-tenant/owner,
contract), plus a systematic inventory of **every** table the frontend
writes to directly, on the full canonical migration chain with
PostgREST-identical execution (`set local role authenticated` + real JWT
claims, exact client payloads).

## 1. Systematic direct-write inventory (the "don't assume" step)

Every `.from('table').insert/.update` chain in the service layer was
inventoried: **18 tables** are written directly by the frontend (no RPC).
Final ACL state on the canonical chain (after Phase 3–4):

| # | Table | Frontend ops | ACL before Phase 5 | RLS write policies |
|---|-------|--------------|--------------------|--------------------|
| 1 | properties | insert, update | INSERT, UPDATE (000036) | manager + p50 + isolation ✅ |
| 2 | units | insert, update | INSERT, UPDATE (Phase 3) | manager + p50 + isolation ✅ |
| 3 | people | insert, update | INSERT, UPDATE (Phase 4) | manager + isolation ✅ |
| 4 | contracts | (none direct) | none — **by design** | p50 + restrictive(false) RPC-only ✅ |
| 5 | attachments | (none — Storage API only) | n/a | storage policies ✅ |
| 6 | **leads** | insert, update | ❌ read-only | manager_write_leads + isolation |
| 7 | **lands** | insert, update | ❌ read-only | manager_write_lands + isolation |
| 8 | **owners** | insert, update | ❌ read-only | manager_write_owners + isolation |
| 9 | **property_owners** | insert, update | ❌ read-only | manager_write_property_owners + isolation |
| 10 | **communication_records** | insert, update | ❌ read-only | manager_write_communication_records + isolation |
| 11 | **company_settings** | update | ❌ read-only | admin_write_company_settings (is_admin) + isolation |
| 12 | **cost_centers** | insert, update | ❌ read-only | cost_centers_company_manage (admin/manager + company) |
| 13 | **payment_terms_templates** | insert, update | ❌ read-only | admin/manager policy |
| 14 | **service_provider_categories** | insert, update | ❌ read-only | action policies (`service_providers.write`) |
| 15 | **utility_meters** | insert, update | ❌ read-only | manager_write_utility_meters + isolation |
| 16 | **utility_bills** | insert, update | ❌ read-only | manager_write_utility_bills + isolation |
| 17 | **vault_documents** | insert, update | ❌ read-only | manager_write_vault_documents + isolation |
| 18 | **automation_rules** | update | ❌ read-only | manager_write_automation_rules + isolation |
| 19 | **maintenance_records** | update (create = RPC by design) | ❌ read-only | p50 action policies + RPC-only insert(false) + no-hard-delete |

**Systematic result: 15 of 18 direct-write surfaces were failing with
`42501 permission denied for table …`** — the same authorization-drift class
as Phases 3–4 (bulk REVOKE in `000001`, incomplete restoration started by
`000036`). Critically, **every one of them already carried the correct RLS
write policies** — the RLS design was complete; only the outer PostgreSQL
gate was missing.

## 2. Fix

`supabase/migrations/20260912000003_complete_direct_write_acl_surface_restore.sql`
— completes the 000036 pattern for all 15 surfaces:

- fail-closed guard: each table must have RLS enabled before any grant;
- `GRANT INSERT, UPDATE` on the 13 full direct-write tables;
- `GRANT UPDATE` only on `maintenance_records` (creation stays on the
  governed `create_maintenance_atomic` RPC; `maintenance_rpc_only_insert`
  stays restrictive(false), so a raw INSERT remains blocked);
- **no DELETE grants anywhere** — archival is the soft `deleted_at` UPDATE
  (verified: no table in the restored set exposes DELETE to `authenticated`);
- `contracts` untouched (RPC-only by design); `attachments` untouched
  (Storage-API-only).

## 3. Core operations matrix — results (all on the canonical chain, real RLS/grants/JWT)

Regression suite:
- `rentrix-app/src/features/core-operations/core-data-operations-matrix.pglite.test.ts` (48 tests)
- `rentrix-app/src/features/core-operations/core-financial-operations.pglite.test.ts` (6 tests)

| Entity | Create | Read | Update | Persistence | Business actions | Relationships | Financial |
|--------|--------|------|--------|-------------|------------------|---------------|-----------|
| Property | ✅ RPC create → property + ownership + agreement + version in one transaction | ✅ admin/USER see own company; other company sees 0 | ✅ direct update, exact `PropertyPayload` | ✅ fresh read returns edited title/notes/name/value | ✅ archive blocked with active units; blocked with saved owner agreement (23514, exact messages) | ✅ ownership link (100% primary, company-scoped); agreement `current_version_id` set | — |
| Unit | ✅ direct insert, exact `UnitPayload` (company from JWT) | ✅ admin/USER visible; cross-company 0 | ✅ direct update (rent/floor/notes) | ✅ fresh read | ✅ manual status available→reserved→available; archive of contract-free unit persists; **archive with contract history blocked (23514)** | ✅ unit→property FK + join | rent feeds invoice (below) |
| Person (tenant) | ✅ direct insert, exact `PersonPayload` | ✅ same visibility contract | ✅ direct update | ✅ fresh read | ✅ archive persists; active list excludes | ✅ tenant↔contract link intact | — |
| Owner | ✅ direct insert (restored ACL) | ✅ same | ✅ direct update | ✅ fresh read | (owner archive = same soft-delete path) | ✅ 60/40 re-split through direct writes; concurrent-ownership ≤100% check enforced; sum = 100 | — |
| Contract | ✅ `create_contract_atomic_v2` draft, exact client payload | ✅ draft visible with billing policy | ✅ billing-policy RPC on draft persists (7/15) | ✅ fresh read | ✅ submit (maker) → **self-approve rejected (MAKER_CHECKER_MUST_BE_DISTINCT)** → approve (distinct checker) → activate → `active` | ✅ contract→unit/tenant/property all same-company; frozen snapshot = agreement current version; **overlapping second contract on same unit rejected** | ✅ see below |
| Financial | — | — | — | ✅ invoice survives fresh browser-identity read | ✅ `generate_invoices_from_active_contracts` → exactly 1 invoice | ✅ invoice↔contract link | ✅ see below |

**Financial actions (contract rent obligation → persisted invoice truth):**
- invoice `amount` = contract rent (600); `document_status` = POSTED;
- `issue_date` = `billing_day` anchored in the current month; `due_date` =
  period end + `grace_days` — both derived from the contract's billing policy;
- RC1 classification stamped: `OWNER_AGENCY_OWNER_CREDITOR_OPERATIONAL`;
- OPERATIONAL owner-creditor invoices post **no invoice GL batch until
  collection** (`journal_batches` count = 0) — financial semantics preserved;
- regeneration is idempotent (second run = 0, still exactly 1 invoice);
- billing policy frozen after activation (`CONTRACT_BILLING_POLICY_IMMUTABLE`).

**Restored-surface spot checks (exact client payloads, all persist):**
leads, lands, communication_records, cost_centers, payment_terms_templates,
service_provider_categories, utility_meters, utility_bills, vault_documents,
company_settings (admin-only), automation_rules toggle, maintenance (RPC
create + direct metadata edit). Plus negative controls: plain-USER insert
denied by RLS, cross-company update → 0 rows, maintenance raw INSERT still
blocked by the restrictive(false) policy, and an ACL probe asserting the
exact intended privilege set (INSERT+UPDATE / UPDATE-only / no DELETE).

## 4. Why existing tests did not catch it

Same class as Phases 3–4: service tests mock the Supabase client (no ACL
layer); PGlite/RLS-matrix suites write as superuser or via RPCs (bypass ACLs);
no browser E2E spec exists for any of these modules. The ACL gate sits
between the API layer and RLS — untested from any side. The core-operations
matrix now closes this for every direct-write core table.

## 5. Verification (DB proof)

- With the fix: 54/54 matrix + financial tests pass (create/read/update/
  persistence/business/relationships/financial, plus negative controls).
- Counter-proof (migration removed): every restored-surface write fails with
  `42501 permission denied for table …` (owners, property_owners, leads,
  lands, communication_records, cost_centers, payment_terms_templates,
  service_provider_categories, utility_meters, utility_bills, …) — the exact
  production failure mode; core entity classes for properties/units/people
  (Phases 3–4 grants) keep passing, isolating the effect precisely.
- Gates (all green): typecheck ✅ · migration hygiene ✅ · `db0:gate` 7/7 ✅
  (clean-DB replay, idempotency, type drift, frontend/RPC contract, RLS
  isolation over 107 tables/254 policies, role model) · RLS matrix 84/84 ✅ ·
  full PGlite batch 250/250 ✅ (two consecutive green runs) ·
  contracts + financials suites 1002/1002 (144 files) ✅.

## 6. Hosted proof — remaining blocker

Sandbox has no egress to the hosted project; operator-side steps (QA user
`qa-admin@malek.app`):

1. Apply `20260912000001` + `20260912000002` + `20260912000003` to the hosted
   project (`supabase db push` / migration runner), redeploy if schema
   snapshots are cached.
2. Walk the matrix live (each: success toast → refresh → reopen → DB row):
   - property create/edit/archive-block (Phase 3 §9),
   - unit create/edit/archive (Phase 3 §9),
   - person + owner create/edit/archive (Phase 4 §8),
   - **new this phase**: lead create, land create, communication record log,
     cost center create, payment-terms create, service-provider-category
     create, utility meter + bill create, vault document upload,
     company-settings save, automation rule toggle, maintenance edit,
     property ownership re-split (60/40),
   - contract draft → submit → (distinct) approve → activate → generate
     invoices → invoice amount/due-date correct.
3. DB spot checks, e.g.:
   `select id, name, status from public.leads where company_id = …;`
   `select id, amount, issue_date, due_date, document_status from public.invoices where contract_id = …;`

## 7. State of the priority list after Phase 5

| Priority | Area | Status |
|----------|------|--------|
| 1 | property create/edit | ✅ clean + full class verified (this phase) |
| 2 | unit create/edit/archive | ✅ fixed Phase 3 + full class verified |
| 3 | person/owner create/edit/archive | ✅ fixed Phase 4 + full class verified (incl. ownership re-split) |
| 4 | contract create/edit/submit/approve/activate | ✅ full class verified end-to-end (maker-checker, snapshot, overlap guard, billing policy) |
| 5 | core financial (contract rent → invoice truth, GL semantics) | ✅ verified end-to-end (invoice dates/amount/classification/idempotency; RC1 no-GL rule preserved) |
| 6 | other high-value direct-write CRUD (leads, lands, utilities, vault, communication, settings, cost centers, payment terms, service providers, automation, maintenance) | ✅ all 15 surfaces fixed + spot-checked with exact client payloads |

Remaining: hosted verification (§6) — everything else in the plan is green on
the canonical chain.

## 8. Deliverables & commits

- Fix: `supabase/migrations/20260912000003_complete_direct_write_acl_surface_restore.sql`
- Matrix: `rentrix-app/src/features/core-operations/core-data-operations-matrix.pglite.test.ts`
- Financial: `rentrix-app/src/features/core-operations/core-financial-operations.pglite.test.ts`
- Report: `docs/execution/PHASE5_CORE_DATA_OPERATIONS_MATRIX.md` (this file)
- Fix commit SHA: `92a6cbfcb23d619a2478607b251bd44a2b8f6f78`
