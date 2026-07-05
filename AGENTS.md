# Rentrix Agent Instructions

This is the entry point for Codex and generic agents. These instructions are advisory and are meant to improve context loading, risk reporting, and verification without blocking requested product or architecture changes.

## Start here

- The active application currently lives in `rentrix-app/`.
- Read `docs/ai/CURRENT_EXECUTION_CONTEXT.md` before non-trivial edits.
- Follow the shared guidance in `docs/ai/AGENT_OPERATING_PROTOCOL.md`.
- Use actual code, migrations, tests, and CI configuration as runtime evidence.
- Prefer `rg` and `rg --files` for repository inspection.

## Working guidance

- Review `docs/ROOT_LAYOUT.md` before creating top-level folders or moving files between root categories.
- Use `docs/RENTRIX_MASTER_PLAN.md`, `docs/RUNTIME_TRUTH_AND_GAPS.md`, and task-specific docs when roadmap, runtime gaps, or domain context matters.
- Compare historical reports or old PR notes against current code before relying on them.
- Document architecture, domain, security, data, environment, RTL/LTR, mobile, and verification impact when relevant.
- Review the final diff before handoff.
- Run the checks that are appropriate for the change and report actual results, skipped checks, warnings, and residual risks.

## Skills and workflows

- Select one primary workflow from `.ai/workflows/README.md` for non-trivial work.
- Use `docs/ai/AGENT_CAPABILITIES.md` as a task-to-skill map when helpful.
- Load only task-relevant skills and references.

## Git and PR guidance

Follow `docs/ai/GIT_TOOLING_POLICY.md` for branch, diff, CI, PR, and merge work. Keep changes focused, preserve unrelated local work, and avoid claiming production, Supabase, deployment, or branch-protection status without evidence.
