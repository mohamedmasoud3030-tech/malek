# Claude Code setup for MALEK

This directory contains the repository-scoped Claude Code helpers used by Claude Code on the web and local Claude Code sessions.

## What is intentionally included

- `agents/`: a small vendored subset of Anthropic's official `feature-dev` agents (`code-explorer`, `code-architect`, `code-reviewer`).
- `skills/frontend-design/`: Anthropic's official `frontend-design` skill, vendored so cloud sessions do not depend on runtime plugin installation.
- `skills/{architecture-decision,implementation-planning,implementation,review,database}/`: thin Claude discovery adapters pointing to canonical root `skills/` procedures.
- `commands/`: MALEK-specific autonomous task and final-review workflows.
- `rules/`: small path-aware guardrails for Git, frontend/UI, database/finance, and validation.

This is intentionally not a large agent pack. Add a helper only when it removes repeated work or enforces a real repository invariant.

## Default usage

For a normal implementation task, start a Claude Web session from the intended base branch and run:

```text
/execute-task <clear task description>
```

Before commit/PR, run:

```text
/final-review
```

For analysis-heavy work, explicitly invoke `code-explorer` or `code-architect`. For substantial visual work, let Claude use the `frontend-design` skill, but MALEK's canonical UX contract and existing shared primitives always override generic visual advice.

## Updating vendored Anthropic material

See `THIRD_PARTY.md`. Keep vendored files unmodified where practical. If a vendored file is changed, mark the modification and preserve the Apache-2.0 attribution/license requirements.

Project-wide instructions belong in `AGENTS.md`; reusable task procedures belong in root `skills/`. Claude-only discovery adapters stay thin under `.claude/skills/`. Do not duplicate canonical skill bodies here. Vendored Anthropic files remain unmodified where practical.