---
name: implementation-planning
description: Plan multi-step work before writing code. Use when a task spans more than one change, a new feature, or anything that must be decomposed into small, testable, reversible steps — before touching code.
---

# Implementation Planning

Decompose work into small, independently testable, reversible steps before
writing code. Adapted from `obra/superpowers` (`writing-plans`) via the
portfolio's own skills (nilesys); vendor-neutral.

## Use when

- A task spans multiple files, behaviors, or decisions.
- You are about to implement a feature, refactor, or multi-step change.

## Do NOT use when

- The change is a single trivial edit with no decomposition needed.

## Required inputs

- The task or requirement, plus any ADRs or docs that constrain it.
- Knowledge of what already exists (reuse check).

## Workflow

1. Reuse check: search the repository for an existing module or capability,
   and consider mature libraries, before building. Respect small-change,
   YAGNI, and reuse rules in the repo's `AGENTS.md`.
2. List concrete steps. Each step is one action ending in an independently
   testable result: write the failing test → verify RED → implement the
   minimal code → verify GREEN → refactor where needed. Follow
   `test-driven-development`. Commit granularity follows the repository/user
   workflow, not the TDD cycle.
3. For each step give: files to create or modify, and the expected result. No
   placeholders — no "TBD", no "add error handling", no vague steps.
4. State explicitly what is OUT of scope (what you are not building).
5. Self-review the plan: every requirement maps to a step; no placeholders;
   names and types consistent across steps.
6. Surface anything that contradicts an accepted decision — see
   `decision-governance`.

## Required evidence / output

- A written step list, each step small and independently testable, with an
  explicit out-of-scope note. For the non-technical owner: a 3-line Arabic
  summary of the plan before execution.

## Exit criteria

- The plan is complete, placeholder-free, and each step is reversible.

## Common failure modes

- Big-bang changes ("one PR that does everything").
- Placeholder steps that assume implementation knowledge.
- Planning abstractions you do not need yet (YAGNI).

> 🏛️ Portfolio binding: canonical master lives in `command-center-/skills/`.
> It overrides duplicated copies inside other repos. Answer the owner in Egyptian Arabic.
