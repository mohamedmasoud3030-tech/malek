# MALEK Canonical Pack — Document 5: System Architecture and Security

> **Status:** CANONICAL  
> **Target Architecture Lock:** 2026-08-27  
> **Repository reality baseline for this lock:** `main@9e5c32e83082cac8227640cf260c51af01e54dc3`

## Architecture summary

MALEK is a React/Vite TypeScript application backed by Supabase Auth/Postgres/Storage. TanStack Router, TanStack Query, feature services/hooks and shared presentation foundations compose the client; RLS, SECURITY DEFINER RPCs, constraints/triggers and server-owned accounting functions remain the authoritative mutation/security boundaries.

The frontend is not a trusted security boundary. Hiding an action or route never substitutes for backend authorization.

## Target reconstruction decision

The approved target is **reconstruction/refactor of the current `rentrix-app`**, not a clean-room `malek-app` rewrite.

This decision is evidence-based:

- the current application already owns the tested route contract, PWA/build setup, shared register foundation, permission engine and thousands of regression tests;
- financial and security boundaries are already integrated with the current frontend/service layer;
- a second frontend package would create duplicated integration, migration and divergence risk without changing the authoritative backend/business rules;
- target UX freedom does not require a new application package.

Therefore:

1. keep `rentrix-app` as the implementation package during reconstruction;
2. rebuild IA/presentation progressively against the canonical target contract;
3. preserve strong services/RPCs/domain rules/tests instead of copying them into a parallel application;
4. keep compatibility routes only where they protect existing deep links/workflows;
5. perform any final technical rename of `rentrix-app` only after parity/release gates, as a mechanical migration rather than a rewrite.

## Target client dependency direction

Preferred dependency direction:

```text
UI / Presentation
      ↓
Application workflows / hooks
      ↓
Domain rules / read models
      ↓
Data access / governed services
      ↓
Supabase RPC / RLS / Postgres
```

Presentation components must not become data-plane or financial authorities. Cross-feature dependencies remain explicit and reviewed.

## Canonical architecture/security rules

| Rule ID | Canonical rule |
|---|---|
| `SEC-001` | Every authenticated operational request resolves an active company context; cross-company access is denied by default. |
| `SEC-002` | Company-owned tables use RLS/constraints that prevent cross-company SELECT/INSERT/UPDATE/DELETE; repository tests do not substitute for live-policy verification. |
| `SEC-003` | SECURITY DEFINER and sensitive RPCs must re-derive/validate company ownership, constrain affected rows, use safe search paths and fail closed on scope mismatch. |
| `SEC-004` | The authoritative backend role model remains `ADMIN`, `MANAGER`, `ACCOUNTANT`, `OPERATIONS`, `USER`, `VIEWER`. Routine staff UX may present the simpler Office Owner/Employee personas, but it must map to effective permissions rather than create a second authorization system. |
| `SEC-005` | Authorization is capability/effective-permission based for actions; role names alone do not grant an operation, and server/RLS/RPC enforcement remains authoritative. |
| `SEC-006` | Shell write posture uses effective grants: a user with an approved write permission is not mislabeled read-only; each affordance still checks its exact permission. |
| `SEC-007` | Permission requests support approve/reject/revoke and re-request lifecycle; a historical APPROVED request is not proof that a revoked permission remains effective. |
| `SEC-008` | Maker-Checker identity separation is enforced for designated sensitive approvals at the authoritative backend boundary, with audited exceptional override only where explicitly approved. |
| `SEC-009` | Sensitive financial mutations and arbitrary journal-line creation are server/RPC owned; browser code cannot author free-form accounting entries or bypass immutable-posted controls. |
| `SEC-010` | Auditability, idempotency, document/storage access and deployed configuration fail closed; production secrets, Auth Hook enablement and live schema are treated as external runtime evidence until verified. |

## Frontend boundaries

- `rentrix-app/src/app/router/route-tree.ts` owns route registration/guards.
- `rentrix-app/src/app/navigation/route-contract.ts` owns canonical routes, aliases, view bindings and permissions.
- Feature services/hooks own Supabase/RPC calls; presentation does not.
- React Query/Zustand/client state may cache/display data but cannot define financial truth.
- New page-specific data authorities are prohibited when an existing domain service/read model owns the same concept.
- New parallel design-token or register systems are prohibited; extend the shared foundation instead.
- New browser `.from(...).insert/update/delete` against sensitive tables is an explicit architecture violation/review target.

## AI trust boundary

AI Assistant may consume permission-filtered context/read models and may prepare navigation or drafts. It must not:

- approve/pay/cancel/void a sensitive financial action;
- create arbitrary journal entries;
- reinterpret accounting policy as authority;
- bypass route/action permissions;
- access another company or tenant scope;
- claim an unverified number as financial truth when the authoritative read model failed.

Any future AI-executed action requires a separate canonical decision and an explicit human authorization boundary.

## Tenant Portal trust boundary

Tenant Portal is a separate constrained surface. It reuses the canonical backend/domain sources but requires tenant-specific authorization in addition to company isolation. Office-shell permissions and mere knowledge of a record ID are never sufficient tenant-portal authorization.

Portal v1 is read-only; no core office record mutation is authorized by the target lock.

## Current authorization reality

`rentrix-app/src/features/auth/permissions.ts` implements:

- six backend roles;
- typed `AppPermission` capabilities;
- role-derived permissions plus effective grants;
- action-specific financial permissions.

The visible Office Owner/Employee model is a UX simplification over this authority, not a replacement for it.

## Multi-company isolation

Required layers remain:

1. Auth identity;
2. active-company claim/selection;
3. query/service company scoping;
4. RLS/constraints;
5. RPC revalidation for sensitive/SECURITY DEFINER paths;
6. cross-company behavioral tests;
7. live/deployed verification before production claims.

## Maker-Checker

Material contracts, VOID and designated sensitive financial approvals preserve creator/requester separation at the authoritative boundary. UI language may say “needs owner/authorized approval” instead of exposing governance jargon, but the control itself remains unchanged.

## Financial write boundary

Posted financial history is server-owned and append-only. Browser code calls predefined business-event boundaries; it does not submit arbitrary debit/credit lines or silently rewrite posted history. Corrections use governed reversal/adjustment lifecycles.

## Audit and idempotency

Sensitive operations preserve actor, company, source/event identity, timestamps/reasons and resulting business/GL references. Retried financially material events use stable idempotency identities and must not double-post/reserve.

## Storage and documents

Document security remains company/entity/action scoped. Signed or generated historical evidence is immutable/versioned. The target UX is contextual-first, but presentation location never weakens storage authorization.

## Runtime truth boundary

The repository cannot prove by itself which migrations/functions/hooks/configuration are deployed, live RLS drift, hosted browser behavior, monitoring, backup/restore readiness or real-pilot acceptance. Those remain runtime/external gates.

## Architecture guards required by target reconstruction

The implementation path must maintain or add automated guards for:

- no presentation direct Supabase data-plane access;
- explicit cross-feature dependencies;
- no raw/hand-built money formatting;
- no unsafe direct financial writes;
- no duplicate route/page authority;
- no routine navigation leakage of intentionally hidden specialist surfaces;
- shared register foundation use;
- no page-level horizontal overflow;
- local-only table overflow when optional mobile Table view is used;
- no raw technical/RPC/schema copy in routine UX;
- 44px mobile target floor where applicable;
- AI sensitive-action prohibition;
- tenant-portal tenant/company isolation.

## Evidence anchors

- `rentrix-app/src/features/auth/permissions.ts`
- `rentrix-app/src/app/navigation/route-contract.ts`
- `rentrix-app/scripts/check-architecture.mjs`
- `rentrix-app/src/features/active-register-inventory.ts`
- `DATABASE_RULES.md`
- `supabase/migrations/**`
- `supabase/tests/**`
- Document 7 for implementation status and runtime gaps.

## Release interpretation

This document locks the target architecture and refactor-vs-rewrite decision. It does not claim the target presentation or Tenant Portal is already implemented, and it does not change governed stage credit.