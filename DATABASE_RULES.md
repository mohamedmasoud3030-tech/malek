# MALEK Database Rules

This file is the permanent operating contract for database work in MALEK.

## Source of truth

- `supabase/migrations/` is the only executable schema-bootstrap path.
- A merged migration is immutable. Fixes are new forward migrations.
- `supabase/seed.sql` contains deterministic reference/bootstrap data only.
- Disposable Demo transactions must be created through the same governed RPC/business paths used by the application, not by bypassing accounting rules with raw inserts.
- Supabase Dashboard/manual SQL must never be a hidden source of schema truth.

## Tenant and authorization safety

- Every company-owned row must be isolated by `company_id` and RLS.
- Company context must be server-validated. Missing/invalid company context fails closed.
- The canonical roles are `ADMIN`, `MANAGER`, `ACCOUNTANT`, `OPERATIONS`, `USER`, `VIEWER`.
- Frontend visibility is never an authorization boundary.
- New SECURITY DEFINER functions must pin `search_path`, validate company context, and receive the minimum grants required.
- Auth-hook/runtime configuration that cannot be expressed as SQL must have an automated hosted smoke check; documentation alone is not proof.

## Financial invariants

- `journal_batches` + `journal_lines` are the canonical general ledger.
- Posted financial history is append-only. Corrections use balanced reversals/compensating events, never destructive rewriting.
- Every posted journal batch must balance to 0.001 OMR.
- Authoritative OMR money columns use `numeric(18,3)` unless a documented external standard requires otherwise.
- Financial mutations remain atomic, company-scoped, idempotent RPC operations.
- Browser/direct writes to protected financial tables are forbidden.
- Owner funds, tenant receivables, deposits and other subledgers must reconcile to their GL control accounts.
- No new parallel balance table/source of truth may be introduced when a canonical subledger/GL source already exists.

## Domain model discipline

- `people` is the canonical party identity/contact foundation. Role-specific attributes belong in one-to-one role/profile structures rather than duplicated identity tables.
- A concept has one canonical writable representation. Compatibility views/facades must be explicitly temporary and read-only where possible.
- A replacement report/RPC supersedes the old contract; do not create permanent parallel `v2`, `wp*`, `s*`, `phase*` surfaces.
- Permanent database identifiers use domain language. New sprint/ticket/phase codenames such as `wp05_*`, `s08_*`, `_phase*`, `_impl`, `_base`, or `_v2` are rejected.
- Private helper routines are not public API. Place them in a private schema or revoke client execution.

## Migration rules

Every schema change must:

1. inspect current schema/runtime dependencies first;
2. preserve unrelated work and data;
3. include preconditions for destructive/narrowing changes;
4. preserve RLS, grants, FKs and RPC contracts;
5. be reproducible from a fresh database;
6. include regression/security tests appropriate to its risk;
7. pass the blocking database gate before merge.

Do not use `DROP`, rename, type narrowing, or destructive data transformation solely to simplify history. Such changes require proof that consumers/data have been migrated and a recovery/cutover plan.

## Seed rules

- Schema DDL and disposable Demo data never share a migration.
- Global reference catalogs may be deterministic seed data.
- Company/user/contract/invoice/payment/receipt/deposit/journal Demo scenarios are seeded through governed application/RPC paths.
- Production-like environments are never implicitly reseeded.

## Required gates

Before database work is considered complete:

- fresh real Supabase/PostgreSQL bootstrap succeeds;
- reference seed succeeds;
- critical app/RPC flows succeed;
- RLS negative cross-company tests pass;
- role/company-claim tests pass;
- financial write-boundary tests pass;
- all posted GL batches balance;
- subledger reconciliation passes;
- generated database contract/type drift is reviewed;
- a second completely fresh bootstrap produces the same canonical schema;
- unexplained schema drift is zero.

## Remote environments

- Never infer that repo state equals hosted state. Inspect both.
- Remote reset or irreversible data loss requires explicit owner approval.
- Normal forward-safe technical fixes do not require repeated owner approval.
- Any hosted configuration not captured in migrations/config is a tracked infrastructure gap and must be verified after deployment.
