---
name: security-review
description: Perform repository-grounded security review for changes that touch authentication, authorization, organization or tenant context, PostgreSQL RLS, secrets, untrusted input, external integrations, sensitive data, or other trust boundaries. Also use when an explicit security audit or threat review is requested. Identify realistic abuse paths and verify existing controls; do not replace general code review or duplicate accepted security policy from ADRs.
---

# Security Review

Review the security properties of the actual change and repository, not a
generic checklist.

**Core principle:** prove realistic abuse paths and controls at concrete trust
boundaries.

## Use when

- Authentication, sessions, membership, permissions, tenant/org context, or
  RLS are touched.
- A change handles secrets, credentials, sensitive business data, untrusted
  input, file/parser boundaries, or external services.
- A migration or raw SQL path can affect isolation or data integrity.
- A new network/API boundary or privileged operation is introduced.

## Do NOT use when

- A general code review has no security-relevant surface; or the edit is trivial.

## Workflow

1. **Scope the security surface.** Changed components, entry points, data
   stores, external integrations, privileged operations.
2. **Map the trust boundary.** Asset protected → who supplies input → what
   identity/authority crosses → control expected to enforce it.
3. **Select only applicable lenses:** authn/session; authorization, tenant
   isolation, RLS; validation/parsing/injection; secrets & config; DB
   integrity, migrations, raw SQL, transaction context; API/error/log data
   exposure; external integrations & dependency trust.
4. **Trace realistic abuse paths.** Reachability + attacker capability +
   missing/bypassed control + concrete impact. No purely theoretical findings.
5. **Apply repository security policy from the ADRs.** For tenant-owned data
   derive fail-closed and cross-tenant tests from the repo's accepted
   decisions — never import provider-specific assumptions.
6. **Escalate architectural security gaps** via `decision-governance`.
7. **Classify findings:** Critical (authz bypass, cross-tenant access, secret
   exposure, RCE, destructive integrity failure) / Important (exploitable
   weakness or missing ADR-required defense) / Minor (hardening opportunity).
8. **Report before fixing.** Record findings first; if remediation is in
   scope, fix one finding at a time via `test-driven-development`, then re-run
   the relevant review.
9. **New or changed trust boundary → compact threat-model pass:** assets →
   boundary → attacker capability → abuse path → existing control →
   mitigation/test.

## Required evidence / output (per finding)

location · severity/confidence · realistic abuse path · concrete impact ·
evidence of the existing/missing control · specific mitigation + the test that
proves it. Also record which lenses were applied and which were N/A.

## Portfolio invariants (from the 2026-10-21 inventory)

- No secrets or real `.env` files in git — flag immediately if found.
- RLS is the authorization boundary in Supabase projects; app-level filters
  are never a substitute. Test RLS with a role that matches production, not a
  bypassing service role.

## Exit criteria

- Every applicable trust boundary reviewed; Critical fixed before readiness;
  Important follows `code-review` deferral rule; claims backed by fresh
  evidence via `verification-before-completion`.

> 🏛️ Portfolio binding: canonical master lives in `command-center-/skills/`.
