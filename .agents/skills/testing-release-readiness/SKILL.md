---
name: testing-release-readiness
description: Use before claiming any Rentrix feature, fix, refactor, or release candidate is ready. Use especially when UI, Supabase contracts, financial logic, or production readiness is involved. Do not use as a replacement for domain-specific skills; combine it with every applicable skill.
---

# Testing and Release Readiness

Apply this skill before saying work is complete, ready, verified, or releasable.

## Required workflow

1. Select checks based on the files and risk area changed. Consider:
   - typecheck
   - lint
   - build
   - unit tests
   - integration tests
   - financial tests
   - migration/schema contract checks
   - E2E or browser verification for user-facing flows
2. If a UI exists, do not claim browser/E2E verification unless it actually ran and the command or manual browser steps are documented.
3. Document seeded data, environment variables, credentials, or Supabase project assumptions required to reproduce the verification.
4. Distinguish clearly between:
   - code complete: implementation is present in code
   - verified: relevant automated/manual checks ran and passed
   - release ready: verification, environment needs, risks, and rollout/rollback considerations are documented
5. If a check cannot run because of an environment limitation, record it as a limitation and explain the impact.
6. Review the final diff before finishing.

## Completion standard

Do not call a change release-ready unless the relevant checks passed or the remaining gaps are explicitly documented as risks with a recommended follow-up.
