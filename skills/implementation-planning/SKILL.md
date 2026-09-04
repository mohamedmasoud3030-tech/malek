---
name: implementation-planning
description: Use when turning an approved MALEK feature, refactor, architecture change, migration, or infrastructure change into an ordered executable plan with dependencies, acceptance evidence, cleanup, rollout, and rollback. Skip for trivial one-file edits.
---

# Implementation Planning

Turn an already-understood change into a plan another agent can execute without rediscovering the repository.

## Workflow

1. Read `AGENTS.md`, relevant canonical documents, Rule/Gap IDs and exact current code paths.
2. Confirm observable acceptance criteria and explicit non-goals.
3. Inventory files/modules/contracts to modify, reuse and remove.
4. Map dependencies and risk; order prerequisites before dependents.
5. Create tasks with unique IDs, concrete scope, expected outcome and proof.
6. For bugs, plan a failing reproduction test before the repair. For new behavior, choose the narrowest meaningful test layer.
7. Plan cleanup explicitly: superseded routes, exports, adapters, helpers, tests and database objects must disappear after cutover unless a real compatibility window remains.
8. Add rollout/rollback only when risk requires it.
9. Use repository commands and runtime scenarios for validation; do not invent checks.

## Quality gate

The plan is not implementation-ready if it guesses paths/APIs, creates parallel source-of-truth docs, omits superseded-code removal, uses duplicate task IDs, hides an owner decision inside implementation, or claims runtime proof the executor cannot perform.

Read `references/plan-contract.md` for the task record.
