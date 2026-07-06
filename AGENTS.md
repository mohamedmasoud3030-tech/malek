# Working on Rentrix

This file is a starting point for any developer or agent picking up work in this repository. It is guidance, not policy — it does not restrict what you can build.

## Before you start

1. Read `README.md` for install and command basics.
2. Read `docs/CURRENT_STATE.md` before any task that is not a trivial, isolated fix. It is the single source of truth for what has been verified in the current checkout.
3. Read `docs/ARCHITECTURE.md` and `docs/DOMAIN.md` when your task touches routing, data flow, or business entities.
4. Read `docs/NEXT.md` if you are looking for something useful to work on.
5. Read `docs/agent-context/CONTEXT_MAP.md` to find the minimal file set for your specific task type, `docs/agent-context/WORKFLOW.md` for the step-by-step process to follow, and `docs/agent-context/DOMAIN.md` for a tagged (Verified/Inferred/Unknown) list of invariants you must not break. Use `docs/decisions/` for past architectural decisions and their rules before writing a new one.


## Repo-scoped Agent Skills

Before modifying Rentrix, check `.agents/skills/README.md` and read every skill that applies to the task. The current repo-scoped skills are:

- `.agents/skills/frontend-integration/SKILL.md` for any user-facing screen, route, component, or workflow.
- `.agents/skills/supabase-data-contracts/SKILL.md` for Supabase migrations, RLS, RPCs, views, database services, or UI/database contract alignment.
- `.agents/skills/financial-reporting/SKILL.md` for collections, payments, receipts, settlements, bank reconciliation, reports, or financial totals.
- `.agents/skills/testing-release-readiness/SKILL.md` before claiming a feature, fix, refactor, or release candidate is complete, verified, or release-ready.

When domains overlap, apply all relevant skills together; do not choose only one. Do not claim a feature with a user-facing interface is complete until the route/screen exists, is connected to the real service/data source, and the frontend flow has been tested and documented.

## While you work

- Inspect the current code before making a decision. Do not assume a past description of the project (including anything in this doc set) still matches the code — verify.
- Use `rg --files` and `rg <pattern>` to explore the codebase quickly instead of guessing at file locations.
- Review the diff you produce before finishing a task.
- Run the checks relevant to what you changed (see `docs/TESTING.md`). Prefer running the narrowest relevant check first, then the full suite before finishing.
- If you touch financial code (`rentrix-app/src/features/financials/**`), also run the financial test command.
- If you touch database schema or RPCs, verify the live Supabase schema before writing a migration — do not rely on generated TypeScript types alone, since they can drift from the database.

## Precedence when docs and reality disagree

Documentation — including everything under `docs/agent-context/` — describes
a point-in-time understanding. If a doc disagrees with the actual code or
the live database, **the code and the live database win.** Fix the doc in
the same PR when you find a mismatch; don't proceed on the doc's word alone.

## When to stop and ask instead of assuming

- The task would require a production mutation that wasn't specifically
  approved for this exact change (see `docs/GOVERNANCE.md`).
- A migration file and the live schema disagree, and the task's correctness
  depends on which one is right.
- You'd need to invent a business rule to proceed and can't find evidence
  for it in code, tests, migrations, or a live check — say it's unknown and
  ask, don't guess.
- The task, as described, would require touching more of the codebase than
  it states (a wider refactor, a shared component/hook/RPC used elsewhere).
  Confirm the wider scope is actually wanted before doing it.

## Scope discipline

Keep the diff to what the task actually requires. Don't fold in unrelated
refactors, formatting sweeps, or "while I'm here" cleanups — even ones that
seem clearly beneficial — unless asked. A small, reviewable diff plus
passing tests plus a verified live check (where relevant) is the goal, not
a maximally thorough rewrite.

## When you finish

Document, in your summary or PR description:

- What you changed and why.
- Any assumptions you made because something could not be verified from code, migrations, or tests.
- Any risk you're aware of in the change.
- Which checks you ran and their result.

## Scope of this file

This file describes a working process. It does not define product restrictions, feature bans, or approval gates. Decisions about what to build belong in product discussion, not in this file.
