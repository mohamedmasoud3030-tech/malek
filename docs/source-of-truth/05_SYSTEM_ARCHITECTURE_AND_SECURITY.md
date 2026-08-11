# MALEK Canonical Pack — Document 5: System Architecture and Security

> **Status:** CANONICAL  
> **Baseline:** `main@8ada4e7eb81fbad3d19f5603626f699b5e10d8d5`

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

The route layer is TanStack Router, the query/cache layer is TanStack Query, and direct Supabase SDK calls are distributed across feature services/hooks. This is not a conventional server application: security and financial correctness therefore depend on RLS, restrictive grants, database constraints and narrow business RPCs. Any browser `.from(...).insert/update/delete` against a sensitive table is an explicit review target, even if the UI also checks permissions.

## Evidence classification at the baseline

| Area | Verified in repository | Claimed/supporting only | Requires live verification | Missing/conflicting control |
|---|---|---|---|---|
| React/Vite build | PR #1430 CI typecheck/lint/architecture/build/tests passed | — | actual client/browser behavior | Browser Readiness run was cancelled |
| Routing/IA | route contract/tree and navigation tests | screenshots/old IA docs | hosted redirects and protected states | `/ai-assistant` canonical rule conflicts with redirect-to-overlay implementation (`GAP-023`) |
| Active company | Auth Hook SQL, CompanyProvider claim validation, membership tests | migration comments | hook enabled for deployed project; issued-token claim; membership drift | live gate `GAP-003/021` |
| RLS/company isolation | hardening migrations, pgTAP/PGlite/ephemeral release database gate | blanket “all tables isolated” claims | deployed policies/grants/schema | generated types do not enumerate all newer tables |
| Roles/permissions | three roles, typed capabilities, effective grants and request lifecycle tests | six-role target in ADR0015 | migrated live role data and JWT semantics | three-vs-six-role conflict (`GAP-001`) |
| Maker-Checker | contract maker/checker RPCs, constraint and pgTAP; permission-review self-approval denial | coverage of every sensitive approval | deployed behavior and audited exceptions | VOID/settlement/other designated actions not proven uniformly (`GAP-002`) |
| GL write boundary | canonical batches/lines, lifecycle triggers, write-boundary guard/tests | “all financial paths use GL engine” | deployed grants/functions | legacy deposit/report and remaining sensitive-write inventory (`GAP-009/018`) |
| Storage/documents | private bucket policy migrations, file validation, signed URLs, ephemeral Storage release job | legal sufficiency of templates | deployed bucket/policies/object isolation | legal/template approval external (`GAP-019/021`) |
| Audit/idempotency | business RPC audit/source/request patterns and unique keys | universal coverage | deployed logs, retention and alerting | final sensitive-operation inventory remains open |
| Operations/observability | QA scripts, workflow artifacts, error-state components | production monitoring/SLO/incident readiness | logs/alerts/backups/restore | release operations remain `GAP-021/022` |

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
- service-provider company isolation in `20260810170000_service_providers_production_grade.sql`, `20260810171000_service_provider_atomic_writes.sql` and `supabase/tests/service_providers_company_isolation.sql`.

Focused repository tests passed during the brownfield audit. This supports `VERIFIED_IMPLEMENTED` for specific repository contracts, not a blanket statement that the deployed Supabase environment is identical.

## Permission-request lifecycle

Effective permission is determined from the user’s current role plus current granted permissions. A request record is workflow evidence; it is not itself the ongoing grant after revocation. Revoke → re-request must remain possible and must not resurrect historical approval implicitly.

## Maker-Checker

Approved policy requires creator/requester separation for material contracts, VOID and designated financial approvals. Contract enforcement is real repository implementation: `20260808010000_s04_contract_lifecycle_maker_checker_v2.sql` stores maker/checker identities/signatures, rejects self-approval and gates activation, with pgTAP coverage in `supabase/tests/s04_contract_lifecycle_maker_checker_v2.sql`. Permission-request review also rejects self-review in `20260810113000_p61_permission_reviewer_authority_closeout.sql`. `GAP-002` is the remaining coverage gap across VOID, owner-settlement and every other designated sensitive approval, plus the absent complete React workflow—not a claim that Maker-Checker is wholly absent.

## Financial write boundary

GL posting/reversal functions are service/server-oriented. Browser code must call predefined business-event RPCs; it must not send arbitrary account/debit/credit lines to an exposed generic mutation endpoint. Posted financial records require reversal/adjustment lifecycles.

## Audit and idempotency

Sensitive operations must preserve actor, company, source/event identity, timestamps/reasons and resulting business/GL references. Retried business events must be idempotent where double posting or double reservation is financially material.

Concrete patterns include the GL unique key `(company_id, source_type, source_id, event_id)`, financial operation request ids, advisory locks for selected workflows, immutable settlement reservation links and reversal references. These patterns are not yet one universal platform contract: each sensitive RPC must be inventoried for company validation, safe `search_path`, grants, request identity, audit event and retry-conflict behavior.

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

`supabase/config.toml` is intentionally a deterministic local/CI database configuration and contains no Auth Hook section. The presence of `public.custom_access_token_hook` in migrations therefore cannot prove that hosted Supabase invokes it.

These remain external/runtime gates and are recorded as gaps where release-relevant.

## Evidence anchors

- `rentrix-app/src/features/auth/permissions.ts`
- `rentrix-app/src/app/navigation/route-contract.ts`
- `docs/decisions/0015-owner-decisions-roles-void-due-from-owner-contract-governance.md`
- `supabase/migrations/**`
- `supabase/tests/**`
- Document 7 for rule-by-rule implementation status.

## Error handling and operational risk

- Auth/session failures clear unusable local session state and fail protected access closed in `rentrix-app/src/services/auth-service.ts`.
- Active-company resolution clears cached queries and refuses to expose company data unless a server-issued token claim matches an active membership in `rentrix-app/src/hooks/use-company.tsx`.
- User-facing services translate many Supabase errors, but consistent typed domain-error mapping is not universal; raw backend text must not leak sensitive schema/config detail.
- CI artifacts and QA scripts provide diagnostics, but they are not production observability. No current repository evidence proves alert routing, retention, SLOs, incident response, backup restoration or production audit review.
- The PR #1430 Vercel preview was Ready, while the complete Browser Readiness run was cancelled and authenticated staging was skipped. Availability must not be recorded as journey acceptance.
