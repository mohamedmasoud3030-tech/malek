# PHASE 4 — Find & fix the next currently broken core mutation

Baseline: `main` @ `5a53be6b`; Phase 3 (unit create/edit/archive 42501 ACL gap)
is accepted and committed (`74a2508` fix, `616268b` report). Phase 3 §7
reproduced — and explicitly deferred under the stop rule — the identical
defect on `public.people`. Per the operator's priority list, person
create/edit (priority #3) is the next currently broken core mutation and the
target of this phase.

## 1. Target identification

**Winner: person create (and, same table + same root cause, person edit /
person archive) — priority #3. The Phase 3 walk-through had already
reproduced it in the same PostgREST-identical harness (full canonical
PGlite replay, `set local role authenticated` + real JWT claims, exact
client payloads):**

| # | Mutation (exact client path) | Result on baseline |
|---|------------------------------|--------------------|
| 3a | person create — `people-service.ts createPerson` → direct `insert into people` (exact `PersonPayload`) | ❌ `42501 permission denied for table people` |
| 3b | person edit — `updatePerson` → direct `update people` | ❌ same |
| 3c | person archive — `softDeletePerson` → direct `update people set deleted_at = …` | ❌ same |

No new hunting was required: the defect was reproduced, traced, and
classified in Phase 3; this phase closes it.

## 2. End-to-end trace (layer by layer) — person create

### 2.1 UI
Person form modal submits through `useCreatePerson` / `useUpdatePerson` /
`useSoftDeletePerson` (react-query mutations in `use-people.ts`). UI layer
sound.

### 2.2 Form / component state
Standard react-hook-form state; no defect.

### 2.3 Validation
`personSchema` (zod): `full_name` ≥ 2 chars, `type` ∈
`personTypeValues` (tenant/owner/contact — matches `people_type_check`),
`phone` pattern, optional `email`/`national_id`/`address`/`notes` → `null`.
Valid payload passes; `normalizePersonPayload` emits
`{ full_name, type, phone, email, national_id, address, notes }` — every
column exists in `public.people`. No frontend defect.

### 2.4 Service / hook
`createPerson` → `supabase.from('people').insert(…).select('*').single()` —
a **direct PostgREST write** (same governed pattern as properties/units);
`company_id` is omitted and defaults from the JWT
(`public.current_company_id()`). `useCreatePerson` invalidates
`peopleKeys.all` + tenant-workspace keys + the new person's detail key on
success. No frontend defect.

### 2.5 API / RPC
Direct PostgREST `POST /rest/v1/people` (no RPC). Supabase executes the
statement as the **`authenticated`** role with the browser JWT.

### 2.6 AuthN / AuthZ — ALL PASSED
QA user is ACTIVE ADMIN of the company; `auth.users`, `public.users`,
`company_members` consistent; claims carry `sub` + `app_metadata.company_id`.
Not the blocker.

### 2.7 RLS policies — NOT the blocker (never reached)
`public.people` carries the correct policies: `manager_write_people`
(TO authenticated, no FOR clause → covers INSERT/UPDATE/DELETE,
USING/WITH CHECK `is_admin_or_manager()`), restrictive `p0_tenant_isolation`
(company match USING + WITH CHECK), `app_read_people` for SELECT. An admin
insert would pass all of them. RLS is never evaluated — the statement is
rejected before RLS runs.

### 2.8 Authorization layer (table privileges) — THE FAILURE POINT
Same chain as Phase 3:
- `20260901000001_restore_dump_acl_lock.sql`: `revoke insert, update, delete,
  truncate on all tables in schema public from authenticated` (only
  `audit_log` re-granted);
- `20260901000036` restored the direct-write surface for **properties only**;
- `20260912000001` (Phase 3) restored it for **units**;
- **no migration ever re-grants DML to `authenticated` on `people`.**

Final ACL state on the canonical chain (verified by `pg_class.relacl` after
full replay): `people: authenticated=rxtm` (SELECT, TRIGGER, REFERENCES
only). PostgREST therefore rejects the browser's insert with
**`42501 permission denied for table people`** — before RLS, before
triggers, before any business rule. The service's `select('*').single()`
never returns a row; `handleSupabaseError` + `requirePersonData` surface a
failed mutation.

**Failing layer: L6/L7 boundary — database authorization (table ACL), the
gate immediately inside the API layer and immediately outside RLS. Same
failing layer as Phase 3.**

### 2.9 Returned result
PostgREST error `42501` → supabase-js `error` branch → no result row.

### 2.10 Cache / invalidation
No invalidation fires (the mutation errors). Nothing was written.

### 2.11 Rendered UI
Error toast (`تعذر إنشاء الشخص` / `تعذر تحديث بيانات الشخص` / `تعذر أرشفة
الشخص`); the people list is unchanged; after refresh the person is still
absent (nothing persisted).

## 3. Exactly where the operation fails

`INSERT INTO public.people (…) VALUES (…)` executed by PostgREST as role
`authenticated` fails at PostgreSQL's privilege check on table `people` —
`GRANT` layer, error class `42501 insufficient_privilege`. Reproduced
deterministically on the full canonical migration chain (PGlite replay,
`set local role authenticated` + real JWT claims, exact client payload):
`permission denied for table people`.

## 4. Root-cause classification

**Authorization drift: bulk REVOKE + incomplete forward-fix (ACL restoration
gap)** — the identical class as Phase 3 (units). `000001` locked the schema
down fail-closed; `000036` restored the "governed direct PostgREST write"
surface for properties only; Phase 3 completed it for units; `people` — the
last of the three direct-write core tables the frontend writes without an
RPC — was left out. Consequence: the **entire people write surface of the
application was broken on any database built from the canonical chain** —
every person create/edit/archive from the UI failed with `42501` regardless
of role, permissions, or RLS.

Server-side authorization defect; no business rule, financial semantics, or
maker-checker behavior involved.

## 5. Why existing tests did not catch it

- Service tests mock the Supabase client — the ACL layer does not exist
  there.
- PGlite suites and the RLS matrix exercise RPC paths or write as the
  superuser connection (bypasses ACLs and RLS), never as `authenticated`
  with a browser JWT the way PostgREST does.
- No browser E2E spec covers person CRUD.
- Table privileges sit outside the policies the RLS matrix asserts.

(Same coverage gap as Phase 3; the units + people regression files now close
it for every direct-write core table.)

## 6. Smallest safe fix

New forward-only migration
`supabase/migrations/20260912000002_people_direct_write_acl_restore.sql`,
mirroring the shape and guards of `000036` / `20260912000001`:

```sql
-- guard: public.people must have RLS enabled before restoring write privileges
GRANT INSERT, UPDATE ON TABLE public.people TO authenticated;
```

- Restores only the outer PostgreSQL gate; **existing RLS stays
  authoritative**: `manager_write_people` (ADMIN/MANAGER only), restrictive
  `p0_tenant_isolation` (company match).
- Hard DELETE stays denied: no DELETE privilege is granted, so archival
  remains the soft `deleted_at` UPDATE only (fail-closed at the outer gate;
  strictly safer than the pre-`000001` state where `GRANT ALL` still
  allowed browser hard deletes).
- `service_role` already holds full privileges; `anon` untouched.
- No business constraint weakened, no RLS bypass, no new architecture, no
  client-side fake success.

After this phase, all three direct-write core tables the frontend writes
without an RPC (`properties` via 000036, `units` via 20260912000001,
`people` via this migration) carry the same restored, RLS-governed
write surface. `contracts` remains RPC-only by design
(`000054` restrictive `false` policies).

## 7. Verification (DB proof — full canonical chain, real RLS/grants/JWT)

Regression test
`rentrix-app/src/features/people/people-direct-write-acl.pglite.test.ts`
(7 tests, PGlite full replay, PostgREST-identical execution):

- WITH the fix (all pass):
  - person CREATE persists via the direct insert path (exact `PersonPayload`;
    `company_id` defaulted from the JWT);
  - person EDIT persists via the direct update path;
  - person ARCHIVE persists via the soft `deleted_at` update;
  - reopened records survive a fresh read (refresh/reopen proof, list filter
    consistent);
  - authority still fail-closed after the grant: plain USER insert rejected
    by RLS (`is_admin_or_manager`), cross-company MANAGER update touches 0
    rows (`p0_tenant_isolation`), hard DELETE still `permission denied`.
- WITHOUT the fix (counter-proof, migration temporarily removed): CREATE /
  EDIT / ARCHIVE / read-back all fail with
  `permission denied for table people` — the exact production failure mode.

Gate results (all green):

| Gate | Result |
|------|--------|
| `pnpm typecheck` | PASS |
| `pnpm check:migration-hygiene` | PASS |
| `pnpm db0:gate` | PASS 7/7 (clean-DB replay, idempotency, type drift, frontend/RPC contract, RLS isolation: 107 tables / 254 policies / 407 functions, role model) |
| `pnpm test:supabase:rls` | PASS 84/84 |
| vitest: all 19 PGlite suites | PASS 196/196 (one first-batch flake in `company-unscoped-tables-isolation` — passes isolated 10/10 and on full-batch re-run; unrelated to this change) |
| vitest: people + units (incl. both ACL regressions) | PASS 82/82 |

## 8. Hosted proof — remaining blocker

The sandbox has no egress to `malek-plus.vercel.app` or
`nnggcnpcuomwfuupupwg.supabase.co`; the live verification must be executed
from the operator side. Exact steps (QA user `qa-admin@malek.app`):

1. Apply migrations `20260912000001` **and** `20260912000002` to the hosted
   project (Supabase CLI `supabase db push` / migration runner), then
   redeploy if the platform caches schema snapshots.
2. People page → **create a person** (any valid name/type/phone). Before the
   fix: `تعذر إنشاء الشخص` / `permission denied for table people`; after:
   success toast and the person appears in the list.
3. Refresh and reopen the person → saved fields persist; edit the phone and
   refresh again → change persists; archive and refresh → gone from the
   active list.
4. Expected DB state: `select id, full_name, type, phone, deleted_at from
   public.people where company_id = … and deleted_at is null;` shows the row
   after create/edit; `deleted_at` set after archive.
5. (Optional) same walk-through for units (Phase 3 §9) in one session, to
   close both hosted verifications together.

## 9. Deliverables & commit

- Fix: `supabase/migrations/20260912000002_people_direct_write_acl_restore.sql`
- Regression: `rentrix-app/src/features/people/people-direct-write-acl.pglite.test.ts`
- Report: `docs/execution/PHASE4_FIRST_BROKEN_MUTATION_TRACE.md` (this file)
- Fix commit SHA: `0676722015de4b2fb164a20ffc480b4b42ab64bb`

## 10. State of the priority list after Phase 4

| Priority | Mutation | Status |
|----------|----------|--------|
| 1 | property create/edit | ✅ verified clean (Phase 3) + ACL restored by 000036 |
| 2 | unit create/edit/archive | ✅ FIXED Phase 3 (`74a2508`, `20260912000001`) |
| 3 | person create/edit/archive | ✅ FIXED this phase (`20260912000002`) |
| 4 | contract create/edit/submit | client↔server cross-checked clean in Phase 3 (18-param `create_contract_atomic_v2` signature, billing pre-RPC, approval chain) — next phase should verify end-to-end through the live harness |
| 5 | core financial mutations (excl. invoice payment — fixed in `5a53be6b`) | untested this phase |
| 6 | other high-value CRUD | untested this phase |
