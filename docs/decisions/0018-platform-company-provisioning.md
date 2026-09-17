# ADR 0018 — Platform Company Provisioning

Status: **APPROVED — Product Owner decision, 2026-09-17**
Date: 2026-09-17
Applies to: **Add Company / `create_company_for_existing_user` and its successor RPC**

## Context

`supabase/migrations/20260917000000_admin_company_provisioning_rpc.sql`
(applied to the hosted `Carmen gallery` / Malek-Plus project as migration
`20260917180806_admin_company_provisioning_rpc`) added
`public.create_company_for_existing_user(...)`, a `SECURITY DEFINER` RPC that
creates a `companies` row, a first `company_members` row and a
`company_settings` row in one transaction.

Repository inspection at this SHA found:

- The function gates on `public.is_admin()`, which resolves through
  `public.active_company_role(public.current_company_id())` — i.e. it
  authorizes only a caller who is already `ADMIN` of some existing company.
  There is no platform-level authority concept anywhere in the six-role model
  (`DATABASE_RULES.md`, Document 5 `SEC-004`); company creation was riding on
  a role check designed for company-scoped authorization.
- The function requires `p_user_id` to already exist as an active
  `public.users` row. There is no atomic path from "brand-new email, no
  `auth.users` row" to "company created with that person as its first admin";
  no `auth.admin.inviteUserByEmail`/`auth.admin.createUser` call exists
  anywhere in the repository.
- The function has no idempotency key, unlike sibling financial RPCs
  (`create_deposit_application_claim_atomic`, `apply_deposit_claim_atomic`,
  etc.) which all use `request_id` + a payload fingerprint.
- Live data at the time of inspection: exactly two companies
  (`malek-qa`, `nakheel-qa`), each with exactly one `ADMIN` member, and no
  overlap — consistent with an operator (Malek) provisioning sibling tenant
  companies, not tenant self-service signup.
- Document 5 (`SEC-001`–`SEC-010`) and Document 2 (`OPS-001`–`OPS-015`)
  govern behavior *within* an existing company; neither has a Rule ID for how
  a company itself comes into existence. Document 7's traceability matrix has
  no row for it. This is genuinely unscoped canonical territory, not an
  existing rule the migration got wrong.

Company creation is the one action in the system that must happen *before*
any company-scoped authority (`company_members.role`, `current_app_role()`,
`current_company_id()`) can exist for the new company. Reusing that same
company-scoped authority to gate the act of creating a company is circular
for a genuinely new tenant and, in practice, only ever worked here because a
human operator already held `ADMIN` on a pre-existing company.

## Decision

**A — Authority.** Company creation is a platform-level capability, separate
from the six company roles (`ADMIN`, `MANAGER`, `ACCOUNTANT`, `OPERATIONS`,
`USER`, `VIEWER`) and from `company_members`/`current_company_id()`
entirely. A new allow-list table, `public.platform_admins` (`user_id`,
`granted_by`, `granted_at`, `revoked_at`), is the sole source of this
authority. A new predicate, `public.is_platform_admin()`, resolves it
(`auth.uid()` present, matching active `platform_admins` row, identity still
`ACTIVE`/`is_active`/`deleted_at IS NULL` on `public.users` — the same
identity floor `custom_access_token_hook()` already applies). No existing
company-scoped resolver (`current_app_role`, `is_admin`, `is_admin_or_manager`,
etc.) is changed, widened, or reused for this. `public.users.role` is not
read for this decision, consistent with `DATABASE_RULES.md`.

Seeding the first platform admin(s) is an out-of-band, owner-authorized
operation (direct authorized SQL against `platform_admins`, run and recorded
the same way any other production mutation requires sign-off under
`docs/GOVERNANCE.md`), not something the application UI can bootstrap for
itself.

**B — Atomicity, including new identities.** The canonical RPC accepts either
an existing `user_id` or a `p_admin_email` for a person with no `auth.users`
row yet. When given an email with no matching identity, the flow is:
platform-admin-only Edge Function (service-role key, never exposed to the
browser) calls `auth.admin.inviteUserByEmail`, then calls the same
`SECURITY DEFINER` RPC used for the existing-user case to create the
company/first-membership/settings row in one transaction, keyed to the newly
created `auth.users.id`. If the invite step fails, no company row is created
(the company-creation RPC call happens only after a successful invite).
Company creation for an *already-existing* user remains a single RPC call
with no Edge Function involved.

**C — Multi-company membership.** A person may hold an active
`company_members` row (of any role, including `ADMIN`) in more than one
company at the same time. The existing `create_company_for_existing_user`
check that unconditionally rejects a user already present in *any*
`company_members` row is a bug relative to this decision, not an intentional
constraint — it is replaced by the actual invariant, the existing
`company_members_company_id_user_id_key` unique constraint (one membership
row per `(company_id, user_id)` pair), which already permits multiple
companies per user and needs no schema change. `custom_access_token_hook()`'s
existing behavior — resolve the JWT's `company_id`/`role` claims from
`raw_user_meta_data.company_id` when it names a company the user actively
belongs to, otherwise fall back to their first active membership by
`created_at` — already supports a multi-company user with no change; the
frontend needs a company switcher, which is new UI scope, not new backend
scope.

## Alternatives rejected

- **Keep gating on `is_admin()` of an existing company.** Rejected: circular
  for a genuinely new tenant with no existing company, and conflates
  platform operator authority with tenant company authority — exactly the
  "second authorization system" `SEC-004` warns against, just inverted (here
  the risk is company authority silently standing in for platform authority).
- **Add an `is_platform_admin` boolean column to `public.users`.** Rejected:
  `DATABASE_RULES.md` is explicit that `users` is identity/profile metadata
  only and must never be read for authorization decisions; a boolean flag
  there would be exactly that, and would not carry `granted_by`/`granted_at`/
  `revoked_at` audit history the way a dedicated table does.
  `user_permission_grants` was considered and rejected for the same
  authority-mixing reason as above — it is explicitly company-scoped
  (`company_id` on every row), and platform authority must not be
  expressible inside a single company's permission surface.
  A new dedicated table with no company scope at all is the smallest correct
  primitive.
- **Self-service signup (any authenticated user creates their own first
  company).** Rejected by explicit Product Owner decision: today there are
  exactly two companies, both operator-provisioned, and Malek's own
  operating model is "the office provisions tenant companies," not open
  tenant self-registration.

## Consequences

- Makes possible: a genuinely new admin (no prior `auth.users` row) can be
  onboarded to a brand-new company in one governed, atomic action; a person
  can legitimately operate more than one company (e.g. an operator who is
  also a tenant admin) without a schema change.
- Makes harder: platform-admin seeding is deliberately not self-service —
  the first platform admin(s) must be granted by direct authorized
  operation, which is intentional friction, not an oversight to "fix" later.
- New follow-up work created: the frontend company switcher (reading
  `company_members` for the signed-in user, writing the selected
  `company_id` to `raw_user_meta_data` so the next token refresh reflects
  it) is not built by this decision and is tracked as its own scope under
  GAP-024 (see Document 7 update), not silently bundled into the RPC change.
- Risk this introduces: a second allow-list table is a second place
  authorization can drift from intent if forgotten in review; mitigated by
  giving it its own Rule ID (`SEC-011`) and its own negative test
  requirement (non-platform-admin, revoked-platform-admin, cross-company
  actor) rather than folding it into the existing company-isolation tests.

## Evidence

- `supabase/migrations/20260917000000_admin_company_provisioning_rpc.sql` —
  the migration under review.
- Hosted inspection, Supabase project `nnggcnpcuomwfuupupwg`
  (`Malek-Plus (live)`): `create_company_for_existing_user` present in
  `pg_proc`; `platform_admins` absent; exactly two `companies` rows
  (`malek-qa`, `nakheel-qa`), one active `ADMIN` `company_members` row each;
  `custom_access_token_hook` definition read from `pg_proc`.
- `DATABASE_RULES.md` — "`company_members.role`... is the only operational
  role authority... `users.role` is identity/profile metadata only and must
  never be read for authorization decisions."
- `docs/source-of-truth/05_SYSTEM_ARCHITECTURE_AND_SECURITY.md` — `SEC-001`
  through `SEC-010`; none address company creation itself.
- Product Owner decision recorded in this task's conversation, 2026-09-17:
  platform-super-admin-only authority; atomic new-admin invite required;
  multi-company membership permitted.
