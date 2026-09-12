# PHASE 3 — Find & fix the next currently broken core mutation

Baseline: `main` @ `5a53be6b`. Phase 2's invoice-payment fix is accepted and
untouched; contract approval/rejection was NOT re-investigated (production-
proven in `5a53be6b`). This phase targets the operator's priority list:
(1) property create/edit, (2) unit create/edit, (3) tenant/person create/edit,
(4) contract create/edit/submit, (5) other financial, (6) other CRUD.

## 1. Target identification

**Winner: unit create (and, same table + same root cause, unit edit / unit
archive) — priority #2. Property create/edit (priority #1) was verified CLEAN
first; unit create is the first currently broken core mutation.**

Evidence chain:

1. A priority-ordered reproduction harness was built on the repository's
   canonical PGlite mechanism (`createFullReplayedDatabase`: full 101-file
   migration chain + seed, real RLS, real grants) executing each mutation
   exactly the way PostgREST executes a browser request:
   `set local role authenticated` + `set_config('request.jwt.claims', …)` with
   the real client payloads from the services.
2. Results on the unmodified baseline:

   | # | Mutation (exact client path) | Result |
   |---|------------------------------|--------|
   | 1a | property create — `rpc('create_property_with_ownership_atomic', …)` | ✅ persists |
   | 1b | property edit — direct `update properties` (exact `PropertyPayload` + `name`) | ✅ persists |
   | 2a | **unit create — direct `insert into units` (exact `UnitPayload`)** | ❌ `42501 permission denied for table units` |
   | 2b | unit edit — direct `update units` | ❌ same |
   | 2c | unit archive — direct `update units set deleted_at = now()` | ❌ same |
   | 3a | person create — direct `insert into people` (exact `PersonPayload`) | ❌ `42501 permission denied for table people` |
   | 3b | person edit — direct `update people` | ❌ same |

3. Per the stop rule, the first failure in priority order is the target:
   **unit create** (2a). The 3a/3b people failures share the identical root
   cause and are documented in §7 as the deferred sibling finding.

## 2. End-to-end trace (layer by layer) — unit create

### 2.1 UI
`UnitFormModal` submits through the `useCreateUnit(propertyId)` hook. UI layer
sound — the request is built and dispatched normally.

### 2.2 Form / component state
Standard react-hook-form + controller state; no defect.

### 2.3 Validation
`unitSchema` (zod): `unit_number` non-empty, `status` ∈
`['available','reserved']` manual values, `rent_amount` ≥ 0, optional
`floor`/`daily_reference_rate`/`notes`. Valid payload passes. No defect.

### 2.4 Service / hook
`unit-service.ts` → `createUnit(propertyId, payload)`:
`normalizeUnitPayload` produces
`{ unit_number, floor, status, rent_amount, daily_reference_rate, notes,
property_id }` — every column exists in `public.units` (incl.
`daily_reference_rate`, added by `20260901000048_unit_short_stay_reference_rate.sql`),
and `status` satisfies `units_status_check`. The call is:
`supabase.from('units').insert(insertPayload)` — a **direct PostgREST write**,
identical in kind to the property edit that works. `useCreateUnit` invalidates
`unitKeys.list()` + `unitKeys.property(propertyId)` and toasts on success.
No frontend defect.

### 2.5 API / RPC
Direct PostgREST `POST /rest/v1/units` (no RPC). The Supabase service runs the
statement as the **`authenticated`** role with the browser JWT.

### 2.6 AuthN / AuthZ — ALL PASSED
QA user `qa-admin@malek.app` is ACTIVE ADMIN of the company; `auth.users`,
`public.users`, `company_members` all consistent; JWT claims carry
`sub` + `app_metadata.company_id`. Authentication and app-level authorization
are not the blocker.

### 2.7 RLS policies — NOT the blocker (never reached)
`public.units` has the correct write policies in place:
`manager_write_units` (TO authenticated, USING/WITH CHECK
`is_admin_or_manager()`), restrictive `p0_tenant_isolation`
(company match), `p50_units_action_update` (+guard) for UPDATE, and
`units_no_hard_delete` (restrictive `false`) for DELETE. An admin insert would
pass all of them. RLS is never evaluated — the statement is rejected before
RLS runs.

### 2.8 Authorization layer (table privileges) — THE FAILURE POINT
`20260901000001_restore_dump_acl_lock.sql`:

```sql
revoke insert, update, delete, truncate on all tables in schema public from authenticated;
grant insert, update, delete on table public.audit_log to authenticated;  -- only this table
```

`20260901000036_frontend_backend_contract_acl_storage_fix.sql` later recognized
this exact defect class and restored the minimum direct-write surface for
**properties only**:

```sql
-- The frontend performs governed direct INSERT/UPDATE operations on properties.
GRANT INSERT, UPDATE ON TABLE public.properties TO authenticated;
```

No migration after `000001` ever re-grants DML to `authenticated` on `units`
(or `people`). Final ACL state on the canonical chain (verified by dumping
`pg_class.relacl` after a full replay):

```
properties: authenticated=arwxtm   (SELECT, INSERT, UPDATE, …)  ← works
units:      authenticated=rxtm     (SELECT, TRIGGER, REFERENCES only) ← 42501
people:     authenticated=rxtm     (SELECT, TRIGGER, REFERENCES only) ← 42501
contracts:  authenticated=rtm      (by design: RPC-only, 00054 restrictive(false))
```

PostgREST therefore rejects the browser's insert with
**`42501 permission denied for table units`** — before RLS, before triggers,
before any business rule. The service surfaces it as a failed mutation (no
row, error toast). **Failing layer: L6/L7 boundary — database
authorization (table ACL), i.e. the gate immediately inside the API layer and
immediately outside RLS.**

### 2.9 Returned result
PostgREST error `42501` → supabase-js `error` branch → no result row.

### 2.10 Cache / invalidation
No invalidation fires (the mutation errors). Stale-state-free, but nothing was
written.

### 2.11 Rendered UI
Error toast; the unit list is unchanged; after refresh the unit is still
absent (nothing persisted).

## 3. Exactly where the operation fails

`INSERT INTO public.units (…) VALUES (…)` executed by PostgREST as role
`authenticated` fails at PostgreSQL's privilege check on table `units` —
`GRANT` layer, error class `42501 insufficient_privilege`. Reproduced
deterministically on the full canonical migration chain (PGlite replay,
`set local role authenticated` + real JWT claims, exact client payload):
`permission denied for table units`.

## 4. Root-cause classification

**Authorization drift: bulk REVOKE + incomplete forward-fix (ACL restoration
gap).**

- `000001` correctly locked the schema down to fail-closed ACLs.
- `000036` was written specifically to restore "the minimum runtime ACLs that
  direct PostgREST property writes require" — but only enumerated `properties`
  and the attachments storage bucket.
- The same "governed direct PostgREST write" pattern used for properties is
  used for `units` (create/edit/soft-archive) and `people` (create/edit/
  soft-archive) by `unit-service.ts` / `people-service.ts`, and those tables
  were never added to the restoration list.
- Consequence: the **entire units write surface and the entire people write
  surface of the application is broken on any database built from the
  canonical chain** — every unit/person create/edit/archive from the UI fails
  with `42501` regardless of role, permissions, or RLS.

This is a server-side authorization defect; no business rule, financial
semantics, or maker-checker behavior is involved.

## 5. Why existing tests did not catch it

- Unit-level service tests mock the Supabase client, so the ACL layer does not
  exist there.
- The repo's PGlite suites (e.g. `property-ownership-atomicity`, the RLS
  matrix) exercise RPC paths, or execute writes **as the superuser/postgres
  connection** (which bypasses ACLs and RLS alike) — never as the
  `authenticated` role with a browser JWT the way PostgREST does.
- There is no browser E2E spec covering unit/person CRUD (and none could run
  in this sandbox: Playwright CDNs unreachable), so the only layer that
  observes the PostgREST-as-`authenticated` privilege check is untested.
- The RLS matrix verifies RLS filtering, but table privileges sit outside the
  policies it asserts.

## 6. Smallest safe fix

New forward-only migration
`supabase/migrations/20260912000001_units_direct_write_acl_restore.sql`,
mirroring the shape and guards of `000036`:

```sql
-- guard: public.units must have RLS enabled before restoring write privileges
GRANT INSERT, UPDATE ON TABLE public.units TO authenticated;
```

- Restores only the outer PostgreSQL gate; **all existing RLS policies,
  permission checks, and guard triggers remain authoritative**:
  `manager_write_units` (admin/manager only), `p0_tenant_isolation`
  (company match), `p50_units_action_update` +
  `trg_units_granular_update_guard` (per-action `properties.edit` /
  `properties.archive`), `units_archive_guard` (archive preconditions),
  `enforce_unit_operational_status` / `units_normalize_status_contract`
  (status invariants).
- Hard DELETE stays denied: no DELETE privilege is granted and
  `units_no_hard_delete` remains restrictive `false`; archival is the soft
  `deleted_at` UPDATE only.
- `service_role` already holds full privileges; `anon` untouched.
- No business constraint was weakened, no RLS bypass introduced, no new
  architecture, no client-side fake success.

**Deliberately scoped out (stop rule):** the identical one-line gap on
`public.people` — see §7.

## 7. Deferred sibling finding (reproduced, NOT fixed in this phase)

`people-service.ts` performs the same governed direct INSERT/UPDATE on
`public.people`, whose final ACL is also `authenticated=rxtm`. Reproduced in
the same harness: `42501 permission denied for table people` for
createPerson / updatePerson / softDeletePerson (priority #3 on the operator's
list). Same root cause, same one-line fix shape
(`GRANT INSERT, UPDATE ON TABLE public.people TO authenticated;`); its RLS
(`manager_write_people` + restrictive `p0_tenant_isolation`) is already
correct and remains the authority. Per the explicit stop-at-first rule it is
left for the next phase.

## 8. Verification (DB proof — full canonical chain, real RLS/grants/JWT)

Regression test
`rentrix-app/src/features/units/unit-direct-write-acl.pglite.test.ts`
(7 tests, PGlite full replay, PostgREST-identical execution):

- WITH the fix (all pass):
  - unit CREATE persists via the direct insert path (exact `UnitPayload`;
    `company_id` defaulted from the JWT);
  - unit EDIT persists via the direct update path;
  - unit ARCHIVE persists via the soft `deleted_at` update;
  - reopened records survive a fresh read (refresh/reopen proof, list filter
    consistent);
  - authority still fail-closed after the grant: plain USER insert rejected
    by RLS (`is_admin_or_manager`), cross-company MANAGER update touches 0
    rows (`p0_tenant_isolation`), hard DELETE still `permission denied`.
- WITHOUT the fix (counter-proof, migration temporarily removed): CREATE /
  EDIT / ARCHIVE / read-back all fail with
  `permission denied for table units` — the exact production failure mode.

Gate results (all green):

| Gate | Result |
|------|--------|
| `pnpm typecheck` | PASS |
| `pnpm check:migration-hygiene` + tests | PASS (11/11) |
| `pnpm db0:gate` | PASS 7/7 (clean-DB replay, idempotency, type drift, frontend/RPC contract, RLS isolation: 107 tables / 254 policies / 407 functions, role model) |
| `pnpm test:supabase:rls` | PASS 84/84 |
| vitest: all 18 PGlite suites | PASS 189/189 |
| vitest: units + people + properties (28 files) | PASS 164/164 |
| vitest: contracts (32 files) | PASS 211/211 |

## 9. Hosted proof — remaining blocker

The sandbox has no egress to `malek-plus.vercel.app` or
`nnggcnpcuomwfuupupwg.supabase.co` (both unreachable), so the live
reproduction and post-deploy verification must be executed from the operator
side. Exact steps (QA user `qa-admin@malek.app`):

1. Apply migration `20260912000001` to the hosted project (Supabase CLI
   `supabase db push` / migration runner), then redeploy if the platform
   caches schema snapshots.
2. In the app: open an active property → Units → **create a unit** (any valid
   number/floor/rent). Before the fix this toast is
   `فشل… / permission denied for table units`; after the fix it succeeds.
3. Refresh the page and reopen the property → the unit is listed with the
   saved rent; edit its rent and refresh again → the change persists;
   archive it and refresh → it disappears from the active list.
4. Expected DB state: `select id, unit_number, rent_amount, deleted_at from
   public.units where property_id = … and deleted_at is null;` shows the row
   after create/edit; `deleted_at` set after archive.
5. (Optional, proves the sibling) attempt to create a person from the People
   page → still fails with `permission denied for table people` until the
   Phase 4 one-line fix lands.

## 10. Deliverables & commit

- Fix: `supabase/migrations/20260912000001_units_direct_write_acl_restore.sql`
- Regression: `rentrix-app/src/features/units/unit-direct-write-acl.pglite.test.ts`
- Report: `docs/execution/PHASE3_FIRST_BROKEN_MUTATION_TRACE.md` (this file)
- Fix commit SHA: `e6b43d7e3f8e596f178757219b679a040b1909a2`
