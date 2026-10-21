# ADR 0020 — Six-role authorization mapping is adopted as implemented

Status: **APPROVED — Product Owner decision, 2026-10-21**
Date: 2026-10-21
Applies to: **GAP-001, WP-01, `SEC-004`, permission resolution in client and server**

## Context

Document 8 lists a dependency for WP-01: "product-owner mapping from existing three roles/data to six
roles". Until that mapping is approved, any role migration risks inventing a business rule.

Repository inspection at `129b538` shows the mapping is already implemented and enforced:

- `malek-app/src/features/auth/permissions.ts` declares
  `authorizationRoles = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER']` and states
  the list is the client-side spelling of `public.app_permission_catalog`, which is **the single
  authority**; a code that exists only client-side "fails closed server-side for every role including
  ADMIN".
- The same file documents `ADMIN` as the "Office Owner compatibility role".
- `supabase/migrations/20260901000008_company_members_six_role_constraint.sql` and
  `..._000009_company_members_six_role_authority.sql` enforce the constraint server-side.
- `scripts/db0/probe-role-enum.mjs` probes role representability.

The six roles are therefore not a proposal — they are existing, tested behaviour. Not recording the
mapping leaves the authored dependency open on paper while the code already satisfies it.

## Decision

The six-role model is adopted as the approved mapping:

| Role | Routine product meaning | Notes |
| --- | --- | --- |
| `ADMIN` | Office Owner | Compatibility role; server never lets employee overrides deny `ADMIN`. |
| `MANAGER` | Operations manager | Scoped operational approvals. |
| `ACCOUNTANT` | Accounting/finance | Financial review and reporting. |
| `OPERATIONS` | Day-to-day staff | Contracts, maintenance, collections operations. |
| `USER` | Basic staff | Narrow read/execute set. |
| `VIEWER` | Read-only | Read surfaces only. |

`public.app_permission_catalog` remains the single authority. Client lists must not grant anything the
catalog does not contain, and unknown/legacy role values must fail closed to least privilege.

## Alternatives rejected

- **Design a different six-role vocabulary.** Rejected: the existing model is migration-enforced,
  covered by parity tests, and documented; replacing it would be churn with migration and lockout risk.
- **Collapse to three roles.** Rejected: contradicts `SEC-004` job-separation intent and the existing
  migration constraint.
- **Leave the mapping undocumented as "obvious".** Rejected: an authored dependency that is satisfied
  but unrecorded keeps reappearing in gap reviews and blocks stage credit discussions.

## Consequences

- WP-01's authored dependency is satisfied *on paper* as well as in code.
- GAP-001 is **not** closed by this record: its remaining requirement is the live migration of the
  exact release SHA plus hosted role/JWT/RLS verification, which needs credentials this environment
  does not have.
- A future role change must supersede this ADR rather than edit it.

## Evidence

- `malek-app/src/features/auth/permissions.ts` — role list, catalog parity comment, `ADMIN` compatibility note.
- `supabase/migrations/20260901000008_company_members_six_role_constraint.sql`,
  `20260901000009_company_members_six_role_authority.sql`.
- `scripts/db0/probe-role-enum.mjs`.
- Document 7, GAP-001 row: "Engineering COMPLETE — remaining: live migration of the exact release SHA and hosted role/JWT/RLS verification".
- Owner instruction in session, 2026-10-21 (authority for taking defensible decisions directly).
