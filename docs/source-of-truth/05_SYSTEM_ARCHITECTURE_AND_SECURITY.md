# MALEK Canonical Pack — Document 5: System Architecture and Security

> **Status:** CANONICAL  
> **Baseline:** `main@75832b2f139f3b759325dcf17cf78101093671b4`

## Architecture summary

MALEK is a React/Vite TypeScript application backed by Supabase Auth/Postgres/Storage. TanStack routing/navigation contracts and feature services compose the client; RLS, SECURITY DEFINER RPCs, database constraints/triggers and server-owned accounting functions are the authoritative mutation/security boundaries.

The frontend is not a trusted security boundary. Hiding an action or route never substitutes for backend authorization.

## Canonical architecture/security rules

| Rule ID | Canonical rule |
|---|---|
| `SEC-001` | Every authenticated operational request resolves an active company context; cross-company access is denied by default. |
| `SEC-002` | Company-owned tables use RLS/constraints that prevent cross-company SELECT/INSERT/UPDATE/DELETE; repository tests do not substitute for live-policy verification. |
| `SEC-003` | SECURITY DEFINER and sensitive RPCs must re-derive/validate company ownership, constrain affected rows, use safe search paths and fail closed on scope mismatch. |
| `SEC-004` | The approved target role model is six product roles: `ADMIN`, `MANAGER`, `ACCOUNTANT`, `OPERATIONS`, `USER`, `VIEWER`; current three-role deployments require explicit migration. |
| `SEC-005` | Authorization is capability/effective-permission based for actions; role names alone do not grant an operation, and server/RLS/RPC enforcement remains authoritative. |
| `SEC-006` | Shell write posture uses effective grants: a USER with an approved write permission is not mislabeled read-only; each affordance still checks its exact permission. |
| `SEC-007` | Permission requests support approve/reject/revoke and re-request lifecycle; a historical APPROVED request is not proof that a revoked permission remains effective. |
| `SEC-008` | Maker-Checker identity separation is enforced for designated sensitive approvals at the authoritative backend boundary, with audited exceptional override only where explicitly approved. |
| `SEC-009` | Sensitive financial mutations and arbitrary journal-line creation are server/RPC owned; browser code cannot author free-form accounting entries or bypass immutable-posted controls. |
| `SEC-010` | Auditability, idempotency, document/storage access and deployed configuration fail closed; production secrets, Auth Hook enablement and live schema are treated as external runtime evidence until verified. |

## Frontend boundaries

- `rentrix-app/src/app/router/route-tree.ts` owns route registration/guards.
- `rentrix-app/src/app/navigation/route-contract.ts` describes canonical routes, aliases, view bindings and permissions.
- Feature services/hooks call Supabase/RPC boundaries; React components do not become accounting/security authorities.
- React Query/Zustand/client state may cache/display data but cannot define financial truth.

## Current authorization reality

`rentrix-app/src/features/auth/permissions.ts` currently implements:

- roles: `ADMIN`, `MANAGER`, `USER`;
- a typed `AppPermission` catalog;
- role-derived permissions plus `grantedPermissions` effective grants;
- `getWriteAccessState()` based on any effective write capability;
- action-specific financial permissions.

ADR `docs/decisions/0015-owner-decisions-roles-void-due-from-owner-contract-governance.md` accepts six roles. Therefore the target-vs-current mismatch is a real implementation conflict (`GAP-001`), not an undocumented preference.

## Multi-company isolation

### Required layers

1. Auth identity.
2. Active-company claim/selection.
3. Query/service company scoping.
4. RLS/constraints.
5. RPC revalidation for SECURITY DEFINER/sensitive paths.
6. Cross-company behavioral tests.
7. Live/deployed verification before production claim.

Repository evidence includes hardening migrations and tests such as:

- `supabase/migrations/20260722000002_multi_tenant_rpc_company_isolation.sql`
- `supabase/migrations/20260723000000_harden_remaining_rpcs_company_isolation.sql`
- `supabase/migrations/20260804000000_fix_owner_agreement_company_isolation.sql`
- `supabase/tests/owner_agreement_company_isolation.sql`
- service-provider company isolation introduced by baseline commit `75832b2f...`.

Focused repository tests passed during the brownfield audit. This supports `VERIFIED_IMPLEMENTED` for specific repository contracts, not a blanket statement that the deployed Supabase environment is identical.

## Permission-request lifecycle

Effective permission is determined from the user’s current role plus current granted permissions. A request record is workflow evidence; it is not itself the ongoing grant after revocation. Revoke → re-request must remain possible and must not resurrect historical approval implicitly.

## Maker-Checker

Approved policy requires creator/requester separation for material contracts, VOID and designated financial approvals. Current route/UI controls and permission catalog are not sufficient proof of authoritative identity separation. This remains `GAP-002` until backend enforcement and tests cover the complete designated set.

## Financial write boundary

GL posting/reversal functions are service/server-oriented. Browser code must call predefined business-event RPCs; it must not send arbitrary account/debit/credit lines to an exposed generic mutation endpoint. Posted financial records require reversal/adjustment lifecycles.

## Audit and idempotency

Sensitive operations must preserve actor, company, source/event identity, timestamps/reasons and resulting business/GL references. Retried business events must be idempotent where double posting or double reservation is financially material.

## Storage and documents

Document access follows company/entity scope and action permissions. Signed legal artifacts are immutable historical evidence; replacement/amendment produces a new version rather than overwriting what was signed.

## Runtime truth boundary

The repository cannot prove by itself:

- which migrations are deployed;
- which Auth Hook is enabled;
- production secret values;
- live RLS drift;
- deployed Edge Function/version state;
- hosted browser behavior;
- backup/restore readiness.

These remain external/runtime gates and are recorded as gaps where release-relevant.

## Evidence anchors

- `rentrix-app/src/features/auth/permissions.ts`
- `rentrix-app/src/app/navigation/route-contract.ts`
- `docs/decisions/0015-owner-decisions-roles-void-due-from-owner-contract-governance.md`
- `supabase/migrations/**`
- `supabase/tests/**`
- Document 7 for rule-by-rule implementation status.
