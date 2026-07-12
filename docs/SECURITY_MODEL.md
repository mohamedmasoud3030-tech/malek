# Security Model

## Security strategy

Rentrix uses a layered PostgreSQL/Supabase security model built from:

- role-aware helper functions
- Row Level Security (RLS)
- restricted grants
- `SECURITY DEFINER` RPCs for privileged workflows
- internal helper revocations for non-browser-facing routines

## Roles

Primary application role values:

- `ADMIN`
- `MANAGER`
- `USER`

Database access roles/grant targets used in the schema include:

- `anon`
- `authenticated`
- `service_role`
- `supabase_auth_admin`

## Role helper functions

Public helpers:

- `public.current_app_role()`
- `public.is_app_user()`
- `public.is_admin_or_manager()`
- `public.is_admin()`

Private helper wrappers:

- `app_private.current_app_role()`
- `app_private.is_app_user()`
- `app_private.is_admin_or_manager()`

These functions centralize authorization decisions used by RLS and RPC logic.

## RLS model

RLS is enabled across the exposed application tables in the baseline.
Policies are used to separate:

- self-read behavior where required
- authenticated application read access
- admin/manager write access
- no-direct-browser access for sensitive operational tables

Representative examples:

- broad authenticated read policies for operational tables
- admin/manager write policies for mutable business entities
- no-direct-access policy for `financial_operation_idempotency`
- restricted read/write model for `journal_entries`

## Permissions model

### Browser-facing RPCs

Certain RPCs remain executable by `authenticated` users because the frontend calls them directly through PostgREST.
These RPCs still enforce internal role checks.

### Internal helpers

Internal helper functions are revoked from broad client roles where they are not intended for direct execution.

### Service-role paths

Maintenance or protected functions may be restricted to `service_role` or to tightly controlled execution grants.

## `SECURITY DEFINER` usage

`SECURITY DEFINER` is used for routines that must:

- bypass client-side direct table permissions safely
- execute controlled business logic under server-managed privileges
- perform multi-step atomic financial mutations

This is especially important for:

- contract lifecycle RPCs
- payment/receipt posting flows
- void flows
- expense/journal posting flows
- reporting RPCs where production behavior depends on privileged reads

## `search_path` hardening

Privileged functions pin `search_path` to controlled schemas, typically:

- `public, pg_temp`

This reduces search-path ambiguity and aligns with security hardening expectations.

## Access boundaries

### Client boundary

The frontend should use:

- direct table access only where RLS is intended to govern behavior
- RPCs for protected transactional workflows

### Database boundary

The database enforces:

- role checks inside sensitive functions
- row-level visibility via policies
- grants/revocations for execution control

### Operational boundary

Pending migrations are isolated from the active baseline so that security-impacting future changes do not silently alter the verified production package.
