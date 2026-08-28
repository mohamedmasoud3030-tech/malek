---
description: Execute one MALEK task autonomously from inspection through validated PR-ready changes
argument-hint: Task description and optional scope constraints
---

# Execute MALEK task

Task: $ARGUMENTS

Execute the task in the current Claude Code Web session. Treat this session as one isolated unit of work.

## 1. Establish the baseline

- Read `CLAUDE.md`, `AGENTS.md`, `DATABASE_RULES.md`, and the relevant canonical documents/rules before editing.
- Record the current branch and HEAD SHA.
- Confirm the intended base. Default to latest `origin/main` unless the task explicitly depends on another branch.
- When GitHub access is available, inspect open work likely to overlap the same files/subsystem. Do not modify, rebase, reset, merge, or repurpose unrelated branches.
- If the current branch is not an isolated task branch, create/use one before making changes.

## 2. Understand before editing

- Search the repository; do not guess paths.
- Trace the existing implementation end-to-end where behavior crosses layers.
- Use `code-explorer` when the area is unfamiliar, cross-cutting, or has hidden legacy paths.
- For a non-trivial design/architecture change, use `code-architect` after exploration.
- Identify the smallest coherent change and the files that must remain untouched.

## 3. Execute without unnecessary stops

- If the requested outcome is clear, implement it autonomously.
- Do not stop merely to present a report, ask about ordinary engineering choices, or seek approval for obvious fixes inside scope.
- Ask only if progress requires a genuine owner/accounting/legal decision, unavailable credentials/access, destructive or unauthorized production mutation, or two materially different product outcomes that cannot be resolved from canonical rules.
- Preserve useful behavior and established abstractions.
- Reuse shared primitives/services/tokens before adding new ones.
- Remove superseded code only after proving it is no longer referenced or required.
- Never invent business/accounting/security/permission rules to make a task easier.

## 4. Validate proportionally

Run the narrowest checks first and broaden based on risk.

- Documentation/config only: inspect diff and run applicable docs/config checks.
- TypeScript/UI logic: targeted tests, then `pnpm typecheck`; run lint/build when the touched area warrants it.
- Shared UI/shell/design-system work: relevant tests + typecheck + build, then browser/visual verification when available.
- Business/financial logic: targeted tests + typecheck + appropriate business-rule/financial gates.
- Supabase/RLS/schema/RPC work: follow `DATABASE_RULES.md`, run the relevant DB/Supabase gates, and distinguish repository checks from hosted/live evidence.

Never claim a check that did not run.

## 5. Review the complete result

Use `code-reviewer` on the final diff when the change is non-trivial. Independently check:

- requested behavior is actually implemented;
- unrelated behavior did not change;
- no duplicate or superseded implementation remains;
- no new parallel design layer, token set, business rule, or source-of-truth document was introduced;
- no debug code, secrets, generated output, or accidental file churn is present;
- tests cover the changed behavior where appropriate.

Fix high-confidence regressions immediately when they are in scope.

## 6. Reconcile with moving main

Before finalizing, fetch current `origin/main` when possible. If it advanced, compare overlap. Integrate only when necessary and never discard another task's work. Re-run affected validation after integration.

## 7. Finish PR-ready

- Keep the diff focused.
- Commit with a precise message.
- Push the task branch and create one focused PR when credentials/tools permit.
- Do not merge unless explicitly instructed.
- In the final summary state: base SHA, head SHA, files/behavior changed, affected Rule/Gap IDs when applicable, checks actually run, runtime checks actually run, overlap status, risks/blockers, and whether governed stage credit changed.
