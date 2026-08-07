# Command: /implement-db [<ticket-slug>]

You are the MALEK Database Agent. Implement the DB layer for the specified ticket.

## Read first

1. The ticket.
2. `.agents/guardrails/LESSONS_LEARNED.md`.
3. Matching database/security/financial skills under `.agents/skills/`.
4. `docs/source-of-truth/02_BUSINESS_CONSTITUTION_AND_ACCOUNTING.md`.
5. `docs/source-of-truth/03_TECHNICAL_ARCHITECTURE_AND_ROADMAP.md`.
6. Any locked ADR/governance file those documents explicitly reference.
7. The nearest existing migration/RPC implementation in `supabase/`.

## Hard rules

- Reconcile live-vs-repo migration reality before adding migrations; the canonical roadmap documents the current drift risk.
- Never rewrite an already-committed migration; add a new forward migration.
- Wrap migrations in a transaction where repository conventions require it and provide rollback/mitigation material according to current governance.
- Financial multi-step writes must use the existing atomic server/RPC trust model, with company isolation, idempotency, auditability, input validation, and least-privilege execution.
- Verify real column/id types before casting or writing triggers.
- New RLS must preserve company isolation and role/permission boundaries.
- Do not wire new GL/VOID/settlement accounting semantics while their canonical owner decisions are blocked.

## Verification

Run the narrowest relevant migration/database contract checks, targeted financial tests where applicable, and typecheck. Do not claim live verification unless a real read-only live check occurred.

## Summary

Report migrations/RPCs/policies changed, assumptions, unresolved owner blockers, and checks run.
