---
name: code-review
description: Review a change for correctness, maintainability, requirement alignment, and architectural soundness. Use when completing a task, feature, or fix, before merging or before the change cascades into further work.
---

# Code Review

Answer: is this change correct, maintainable, aligned with requirements, and
architecturally sound? Review the diff, not the author's description of it.

## Use when

- After completing a feature, fix, or task, and before merging or building on
  top of it.

## Do NOT use when

- No change exists to review, or the change is a trivial typo fix.

## Required inputs

- The change (diff/files) and the requirements or plan it implements.
- Relevant ADRs for architecture conformance (see `decision-governance`).

## Workflow

1. Scope the change: read the full diff from the base commit; read changed files.
2. Review in two passes:

   a. **Requirements conformance** — does it implement what was asked? Are
      deviations justified? Is all planned functionality present?
   b. **Architecture and quality** — correctness, edge cases, error handling,
      type safety, maintainability, security where relevant, and conformance
      with the repo's boundary rules (ADRs / AGENTS.md).

3. Categorize every finding by severity:

   - **Critical** — bugs, security issues, data loss, broken functionality.
   - **Important** — architecture problems, missing features, test gaps.
   - **Minor** — style, polish, optimization.

   For each: location, what is wrong, why it matters, suggested fix.

4. Acknowledge what is done well before listing issues.
5. Give a verdict: ready / ready with fixes / not ready — plus a one-paragraph
   Arabic summary for the owner.

The reviewer may be you (review your own diff with fresh eyes, never skipping
the passes) or an independent reviewer. The passes and severity categorization
are the same either way.

## Do NOT reproduce

The verification checklist belongs to `verification-before-completion`. Apply
that skill before any completion claim; do not restate its checklist here.

## Exit criteria

- Critical findings fixed before "ready".
- Important findings fixed before "ready", unless the owner explicitly accepts
  the deferral. A reason alone is not authorization.
- Minor findings may be deferred with rationale.
- A verdict is recorded.

> 🏛️ Portfolio binding: canonical master lives in `command-center-/skills/`.
