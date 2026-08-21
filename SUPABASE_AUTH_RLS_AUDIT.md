# Supabase Auth & RLS Audit — MALEK

**Date:** 2026-08-21  
**Repository evidence:** `main@abf12cb39d6a7507734f7f1f2b29b92443eccde8`  
**Scope:** Auth, JWT tenancy, Postgres RLS/grants/RPC, Edge Functions, Storage and Realtime.  
**Evidence status:** repository-static plus read-only hosted catalog/config inspection on 2026-08-21. No application rows, customer data, production settings or production schema were changed.

## Executive decision

The repository baseline is designed to fail closed and does not justify a broad policy rewrite. The verified repository controls are:

- 102/102 `public` tables have RLS enabled.
- 203 repository-visible policies protect the baseline; every company-owned row carries `company_id`, while the narrow global/identity inventory is explicitly classified below.
- The two RLS-enabled tables with no browser policy — `document_reference_sequences` and `financial_operation_idempotency` — are intentionally server/RPC-only and deny browser access by default.
- 268 `SECURITY DEFINER` functions in the baseline pin `search_path`; static source control is necessary but hosted grants must also be inspected per function.
- The client-facing role model is `ADMIN`, `MANAGER`, `ACCOUNTANT`, `OPERATIONS`, `USER`, `VIEWER`; authorisation is capability/effective-grant based, not a mutable browser role.
- The active company is a server-issued access-token claim, validated against an active `company_members` row. Missing, stale or mismatched context fails closed.
- The privileged background worker is protected by an independent 32+ character secret and uses the service role only inside the Edge Function; browser use is prohibited.

This audit adds a static regression gate **and** a forward Auth-Hook hardening migration. It has not been applied to any hosted project. Production rollout remains blocked on the runtime checks below.

## Authorization matrix

“Member” means an active authenticated user in the active company. “Server” means a narrowly deployed Edge Function/worker or migration with server credentials; it is not browser code.

| Resource class / operations | Anonymous | Owner | Member | Manager | Admin | Server | Reason |
|---|---:|---:|---:|---:|---:|---:|---|
| Auth session, signup, logout, refresh | Auth-only public endpoints | Allow own | Allow own | Allow own | Allow own | Allow provisioning only | Supabase Auth verifies identity; no application role is trusted from the client. |
| `users`, profile, active membership | Deny | Read/update own non-authority fields | Read permitted company context | Manage only with `users.manage` | Manage only with `users.manage` | Allow controlled provisioning | `company_members` is authority; membership/role changes are permission-gated. |
| `company_members`, roles, permission grants/requests | Deny | Deny | Read own/permitted company context | Allow only effective `users.manage` action | Allow only effective `users.manage` action | Allow controlled provisioning/revocation | Prevents self-escalation and historical approval resurrection. |
| Company operational data: properties, units, people, owners, contracts, maintenance, leads | Deny | N/A (no tenant-owner portal in repository) | Read according to effective capability | Allow scoped operational actions | Allow scoped operational actions | Allow governed RPC | Restrictive company policy requires `company_id = current_company_id()`; action policies/RPCs narrow writes. |
| Financial source and ledger data: invoices, payments, receipts, deposits, expenses, journal batches/lines, settlements | Deny | N/A | Read only where capability grants it | Approved business RPC only | Approved business RPC only | Allow atomic, audited RPC/worker only | Direct free-form browser financial writes are forbidden; posted history is append-only. |
| System/audit/idempotency/reference data | Deny | N/A | Read only where policy permits | Restricted manage/read | Restricted manage/read | Allow internal functions | Audit and idempotency tables are not browser-write surfaces; two internal tables have no permissive browser policy. |
| Documents, attachments, vault/storage objects | Deny | N/A | Read only same-company/permitted entity | Upload/manage by exact capability | Upload/manage by exact capability | Signed URL / controlled operation | Bucket/object policy and entity/company scope must agree; no public bucket is approved. |
| RPCs / SECURITY DEFINER functions | Deny unless explicitly pure/public-safe | N/A | Only explicitly granted business RPCs | Only explicitly granted and capability-checked RPCs | Only explicitly granted and capability-checked RPCs | Internal RPCs as required | Public execute is revoked; functions must pin search path and validate company context. |
| AI Edge Function | Deny | N/A | Allow only after authenticated DB authorization | Same | Same | Provider key server-only | Bearer token is verified against Auth and access/budget control RPCs. |
| Background worker Edge Function | Deny | N/A | Deny | Deny | Deny | Allow secret-authenticated invocation only | Dedicated worker secret and service-role key are confined to Edge Function secrets. |
| Realtime | Deny unless a table is explicitly published and covered by RLS | N/A | Same visibility as SELECT policy | Same | Same | N/A | No repository claim of Realtime publication is accepted without hosted verification. |

## Resource inventory and policy evidence

All 102 public tables have RLS enabled. Company-owned tables carry `company_id`; the explicit global/identity inventory is `app_permission_catalog`, `audit_log`, `automation_jobs`, `companies`, `financial_operation_idempotency`, `governance`, `onboarding_requirement_templates`, `payment_terms_templates`, `tax_code_catalog`, and `users`. The tenant-isolation policy convention is restrictive `USING` and `WITH CHECK` equality to `public.current_company_id()`, with narrower permissive policies for valid operations.

| Resource inventory | Browser posture |
|---|---|
| `companies`, `company_members`, `users`, onboarding and company settings/tax assets | active-member and effective-permission guarded |
| properties, units, people, owners, property ownership, contracts and contract evidence/registration/inspection | active-company constrained; lifecycle operations through governed RPCs |
| invoices, payments, receipts, deposits, expenses, owner funds/settlements, commissions, accounts, periods, journal batches/lines | active-company constrained; sensitive mutation via atomic RPCs |
| automation, notification, communication, support and AI budget data | active-company constrained; internal queues/rate limits deny direct browser writes |
| audit, status history, governance, correction/frozen-review data | read/action policy only; no unrestricted browser mutation |
| document references and financial idempotency records | RLS enabled with no permissive client policy: server/RPC-only |
| Storage objects and signed documents | private-bucket smoke test exists, but `storage.objects` policies/bucket definition are not committed in this migration chain; hosted configuration remains unverified |
| views and functions | all repository-defined public views use `security_invoker`; 268 `SECURITY DEFINER` functions have pinned search paths and no `anon`/`PUBLIC` execution grant; both are regression-gated |

## Confirmed findings

1. **No confirmed cross-company bypass in repository baseline.** The company key is server-derived from the access-token claim and all baseline public tables are company-scoped/RLS-enabled.
2. **No confirmed SECURITY DEFINER public-execute exposure.** Repository baseline grants no such function to `anon` or `PUBLIC`; public execute revocations are present.
3. **No browser service-role exposure found in the repository trust model.** Existing privileged-key scan and this audit’s role boundary treat any browser secret as a release blocker.
4. **Deliberate deny-by-default tables:** `document_reference_sequences` and `financial_operation_idempotency` are RLS-enabled with no browser policy. This is correct for internal sequencing/idempotency state.
5. **Confirmed repair — inactive identity token claim:** the previous hook checked `status = ACTIVE` but did not explicitly require `is_active` and `deleted_at IS NULL` before resolving company membership. Forward migration `20260901000012_harden_custom_access_token_hook_identity.sql` now withholds/removes `company_id` for inactive or soft-deleted application identities and limits invocation to Auth/server roles.
6. **Confirmed repair — legacy public attachment references:** the client previously returned stored absolute `http(s)` URLs unchanged. It now rejects them, so a historical public link cannot be re-published by the application. Such records require a controlled server-side migration into the private bucket before display.
7. **Storage configuration evidence gap:** `attachments` has a non-production, cleanup-safe smoke test for private access and MIME limits, but its `storage.objects` policies and bucket definition are not represented in the committed migration chain. No policy is invented from client code; the read-only `supabase:live-readiness` check now inventories the deployed bucket and object policies in QA before release.
8. **Realtime scope:** the repository contains one `postgres_changes` subscription for a user's permission grants, filtered to that user. The read-only readiness check now reports whether that table is in the `supabase_realtime` publication; an actual anonymous/cross-company subscription denial test is still required in QA.
9. **Confirmed hosted helper exposure — repair prepared, not deployed:** the live catalog showed that `next_document_reference(uuid, text, text, integer)` and `wp05_provision_default_cashflow_classifications(uuid)` are `SECURITY DEFINER` helpers whose caller supplies a company ID, yet they had browser-role execution. `assign_document_reference()` and `update_unit_status_from_activity()` are trigger helpers and also do not need browser execution. Migration `20260901000013_revoke_internal_security_definer_helpers.sql` revokes `PUBLIC`, `anon`, and `authenticated` execution for precisely those four signatures, preserving only explicit `service_role` execution. The static regression test enforces this grant contract. It has **not** been applied to the live project.
10. **Hosted migration-history drift:** the live migration history does not list repository migrations 10 and 11, while the live catalog confirms their unique index and invoice-lineage trigger/function are present. This is evidence drift, not proof the safeguards are absent. Reconcile migration history against the canonical chain in QA before production rollout; do not re-run migrations 10/11 blindly.
11. **Hosted Auth warning:** Supabase reports leaked-password protection disabled. This does not explain the offline screen, but it weakens future password safety. Recommended production decision: enable it first in QA, then in production during the approved maintenance window.
12. **Hosted advisor inventory requires staged work:** 169 `authenticated SECURITY DEFINER executable` warnings, 99 unindexed foreign-key notices, 35 multiple-permissive-policy notices, 7 RLS init-plan notices, and 158 unused-index notices remain. These are not safe to “bulk fix”: many business RPCs are deliberately authenticated and indexes/policies require workload evidence. Each must be classified and tested per function/table; no broad grant, RLS, or index change is approved by this audit.

## Secure design selected

- Keep RLS enabled; never substitute UI guards for authorization.
- Keep `company_members` as the source of membership truth; `user_metadata.company_id` is only an untrusted selection request. The Auth Hook must additionally require `status = ACTIVE`, `is_active = true`, and `deleted_at IS NULL` before it issues a company claim.
- Resolve current company from the server-issued JWT claim and fail closed on invalid/missing membership.
- Keep role changes, invitation/membership lifecycle, financial mutation, approvals and deletion behind narrow authorization RPCs.
- Keep privileged credentials only in server/Edge Function secrets. The worker requires both deployment-held service credentials and a dedicated invocation secret.
- Treat private/internal `SECURITY DEFINER` helpers as server-only: revoke `PUBLIC`, `anon` and `authenticated` execution; do not expose caller-supplied tenant identifiers through RPC.
- Keep storage private and authorize by company/entity at the object-policy layer; signed URLs are short-lived access mechanisms, not a permission bypass.
- Preserve append-only financial/audit history; account deletion must revoke access before any scheduled retention/pseudonymisation workflow.

## Rollout and rollback

### Safe rollout order

1. Run `pnpm test:supabase:auth-rls` and existing `pnpm test:supabase:rls` on a fresh disposable database.
2. Run `pnpm qa:preflight` and `pnpm qa:database-contracts` against QA only.
3. In Supabase QA, verify Custom Access Token Hook is enabled and the new access token contains the validated company claim.
4. Run `pnpm supabase:live-readiness` with an approved **read-only QA** database URL, then verify private Storage object policies and Realtime publication against anonymous, unrelated-company and intended-member tokens.
5. Reconcile hosted migration history with the canonical chain in QA and confirm migrations 10/11 safeguards by catalog before planning the forward migration.
6. Back up production and obtain explicit production-change approval before any migration/configuration action, including enabling Auth leaked-password protection and applying migrations 12/13.

### Rollback

Rollback is a forward restoration of the previous known-safe hook definition from the canonical baseline, followed by forced session refresh/revocation for affected identities. Do not roll back by disabling RLS or widening any policy. Take a production backup and obtain explicit approval before applying or reverting this migration.

## Required role-based tests

The existing behavioural matrix is retained and the new static gate enforces baseline invariants. QA/runtime verification must demonstrate:

- anon: no protected table, RPC, storage or Realtime read/write;
- user A: own active-company visibility only;
- unrelated user B/company B: no SELECT/INSERT/UPDATE/DELETE or RPC side effect against company A;
- ADMIN, MANAGER, ACCOUNTANT, OPERATIONS, USER and VIEWER: intended capability allow/deny behaviour;
- inactive, deleted and no-membership identities: receive no company claim and fail closed;
- privileged worker: succeeds only with server-held worker secret; every browser-style invocation is denied;
- direct PostgREST/RPC calls, not just UI behaviour, including denial of direct calls to the four internal helper signatures;
- Storage object list/read/write/delete across two companies, MIME and private-public URL checks; and Realtime subscription parity with normal RLS;
- account deletion/deactivation: session/access revocation and no accessible orphan records.

## Hosted inspection note

The live Supabase project reported `ACTIVE_HEALTHY` during the read-only inspection. The mobile “offline” screenshot is the application’s `offline.html` PWA fallback, not a Supabase health signal; its unsafe global navigation fallback is separately removed in UI PR #1542 and still awaits deployment. The hosted inspection read catalog, ACL, migration and advisor metadata only; it did not query application records.

## Remaining blockers

No production remediation was applied. Runtime/live verification is required for Auth Hook activation, migration-history reconciliation, Storage, Realtime, deployed Edge Function versions, backups and retention/deletion operations. Production deployment of migrations 12/13 and the Auth leaked-password setting remains blocked pending QA evidence, backup and explicit production-change approval.

**Canonical rule anchors:** `SEC-001` through `SEC-010` in `docs/source-of-truth/05_SYSTEM_ARCHITECTURE_AND_SECURITY.md`.  
**Governed stage credit:** unchanged by this repository-only audit.
