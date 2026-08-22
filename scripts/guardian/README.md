# MALEK Database Guardian

Run:

```bash
pnpm db:guardian
```

The Guardian is a local, disposable-database gate. It does **not** contact hosted Supabase and does **not** mutate production data.

It composes the repository's existing database proofs with the governance-stabilization checks:

- DB0 canonical replay/gate
- canonical membership authority + Auth Hook behavior
- sensitive RPC authorization behavior
- effective `SECURITY DEFINER` governance audit
- internal `SECURITY DEFINER` EXECUTE-boundary audit
- strict Guardian governance scan (`DG-GOV-008`)
- migration/rollback hygiene
- privileged-key exposure scan

The machine-readable report is written to `.guardian/report.json`.

## Canonical authority model

```
valid active identity
  -> active company membership
    -> active company
      -> company_members.role
        -> current_user_has_effective_app_permission(permission)
          -> RLS / RPC / server enforcement
```

`users.role` is not an operational authorization source. JWT role claims are context/cache only and cannot override database authority.

## DG-GOV-008

`DG-GOV-008` is intentionally strict. For an authenticated-callable `SECURITY DEFINER` control/mutation RPC, these are **not** accepted as proof of authorization:

- `auth.uid()` checks
- `require_company_id()` / `current_company_id()` checks
- company scoping alone
- input validation
- `RAISE EXCEPTION`

The RPC must either:

1. be explicitly classified as an internal/service-only or canonical authority helper in `governance-contract.json`, or
2. call `current_user_has_effective_app_permission(...)` for its governed capability.

This closes the permissive gap in the earlier Guardian draft where identity/scoping/validation could be mistaken for authorization.

## Exit codes

- `0`: every blocking Guardian layer passed
- `1`: one or more blocking layers failed
- `2`: a Guardian component crashed
