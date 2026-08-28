# Validation rules

Use evidence proportional to the risk of the task.

## Baseline

- Record the base/head SHA used for the task.
- Start with targeted checks close to the changed code, then broaden only when shared or high-risk behavior is affected.
- Never report a check, browser scenario, hosted QA proof, or production verification unless it actually ran.

## Typical validation ladder

1. Static/documentation/config changes: inspect the complete diff and run the applicable repository checker.
2. TypeScript/application logic: relevant tests, then `pnpm typecheck`.
3. Shared frontend/shell/design-system changes: relevant tests + typecheck + build; add browser/visual verification when available.
4. Business/financial behavior: targeted tests + typecheck + the applicable business/financial guard scripts.
5. Schema/RPC/RLS/data changes: follow `DATABASE_RULES.md` and run the applicable DB/Supabase gates; hosted/live evidence remains a separate claim.

## Failure handling

- A failing gate is evidence to diagnose, not permission to weaken the gate.
- Distinguish failures caused by the task from pre-existing/environment/external failures using reproducible evidence.
- Fix in-scope regressions before finalizing.
- Do not delete or bypass tests merely to make CI green.

## Final evidence

Before PR-ready status, review the full diff, remove temporary artifacts, and state exactly which checks ran and their outcomes. If a required runtime or hosted check could not run, name it as an unverified external/runtime item rather than implying success.
