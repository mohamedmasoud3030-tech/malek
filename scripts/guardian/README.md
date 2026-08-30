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
- internal GL posting/helper RPC browser EXECUTE boundary
- effective `SECURITY DEFINER` governance audit
- internal `SECURITY DEFINER` EXECUTE-boundary audit
- strict Guardian governance scan (`DG-GOV-008`)
- migration/rollback hygiene
- privileged-key exposure scan

The machine-readable report is written to `.guardian/report.json` and is gitignored.

## Canonical authority model

```
valid active identity
  -> active company membership
    -> active company
      -> company_members.role
        -> canonical role/permission resolver
          -> RLS / RPC / server enforcement
```

`users.role` is not an operational authorization source. JWT role claims are context/cache only and cannot override database authority.

Some sensitive RPCs intentionally preserve an existing ADMIN/MANAGER boundary. Those functions authorize through the membership-backed `is_admin_or_manager()` helper rather than widening the historical boundary merely because a permission token is available. Other capability-governed RPCs use `current_user_has_effective_app_permission(...)` with their exact catalog permission.

## DG-GOV-008

`DG-GOV-008` is intentionally strict. For an authenticated-callable `SECURITY DEFINER` control/mutation RPC, these are **not** accepted as proof of authorization:

- `auth.uid()` checks
- `require_company_id()` / `current_company_id()` checks
- company scoping alone
- input validation
- `RAISE EXCEPTION`

The RPC must either:

1. be explicitly classified as an internal/service-only or canonical authority helper in `governance-contract.json`, or
2. call a canonical database authorization resolver such as `current_user_has_effective_app_permission(...)`, `is_admin_or_manager()`, `is_admin()`, `is_accountant()`, `is_operations()`, or another resolver explicitly allowed by the contract.

The stricter rule closes the permissive gap in the earlier Guardian draft where identity/scoping/validation could be mistaken for authorization, while still preserving intentional existing role boundaries.

Two documented authority models exist alongside the membership/permission resolvers:

- **Granular Employee action permissions.** Maintenance lifecycle RPCs authorize through `current_user_has_effective_app_permission('maintenance.approve' | 'maintenance.edit' | 'maintenance.cancel')` or the canonical wrapper `current_user_can_transition_maintenance(...)` (migrations `00051`/`00053`). These are listed in `governance-contract.json` under `permissionGovernedSensitiveRpcs`, which requires both the effective permission resolver and the exact permission token.
- **External bearer-token portal snapshots.** `get_tenant_portal_snapshot` / `get_owner_portal_snapshot` serve external tenants/owners who have no company membership by design; the private unguessable portal link token is the only browser-supplied authority input. They are listed under `externalTokenAuthorityRpcs`, and the scan only accepts them while every required token-validation marker (`revoked_at is null`, `expires_at > now()`) is present in the effective definition. Losing the marker check re-opens the finding.

## Exit codes

- `0`: every blocking Guardian layer passed
- `1`: one or more blocking layers failed
- `2`: a Guardian component crashed
