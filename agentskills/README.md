# Agent Skills Library

This folder vendors a deliberately small set of external agent skills that are useful for building and maintaining Rentrix. The skills were copied from the upstream repositories listed in `SOURCES.md` so agents can reference them locally during project work.

## Selection criteria

The included skills focus on high-value Rentrix development needs:

- implementation planning for multi-step work;
- frontend design and real web-app validation;
- code review and architecture review;
- domain modeling for business workflows;
- systematic debugging and test-driven development;
- research and issue triage.

To keep this folder easy to use, overlapping or weaker duplicates are intentionally omitted. When two skills cover the same workflow, keep the more complete one and document the choice below. Binary assets and Claude-artifact-specific helpers are also omitted so this folder remains text-reviewable and branch-friendly.

## Included skills

| Source | Included local folders | Why included |
| --- | --- | --- |
| Anthropic skills | `anthropics-frontend-design`, `anthropics-webapp-testing` | Strong frontend design guidance and practical Playwright-based web-app verification. |
| Matt Pocock engineering skills | `mattpocock-code-review`, `mattpocock-codebase-design`, `mattpocock-domain-modeling`, `mattpocock-improve-codebase-architecture`, `mattpocock-research`, `mattpocock-triage` | Useful review, design, modeling, architecture, research, and issue-preparation workflows. |
| Superpowers skills | `superpowers-systematic-debugging`, `superpowers-test-driven-development`, `superpowers-writing-plans` | More comprehensive debugging, TDD, and planning workflows than the overlapping alternatives. |

## Omitted overlap and non-project assets

- `mattpocock-diagnosing-bugs` was omitted because `superpowers-systematic-debugging` is a stronger root-cause debugging workflow.
- `mattpocock-tdd` was omitted because `superpowers-test-driven-development` is the more complete TDD workflow and includes anti-pattern guidance.
- `mattpocock-implement` was omitted because it is a thin wrapper around normal implementation, TDD, review, and commit steps already covered elsewhere.
- `superpowers-verification-before-completion` and `superpowers-finishing-a-development-branch` were omitted because Rentrix already has the repo-specific `.agents/skills/testing-release-readiness` workflow and explicit PR/commit instructions.
- `anthropics-web-artifacts-builder` was omitted because it targets Claude HTML artifacts rather than this application and includes a binary `shadcn-components.tar.gz` helper, which makes branch/diff workflows harder.
- Non-essential upstream skills for document generation, presentations, spreadsheets, image/art, Slack/GIF, Claude-specific API workflows, and personal productivity remain omitted.

## Usage

Open the relevant `SKILL.md` file before starting a task that matches that skill's purpose. Repo-specific skills in `.agents/skills/` still take precedence for Rentrix-specific workflows such as frontend integration, Supabase contracts, financial reporting, and release-readiness checks.

When updating this folder, prefer small curated additions over copying every upstream skill. Keep source prefixes in folder names to avoid collisions, but avoid keeping two skills for the same workflow unless they serve clearly different use cases.
