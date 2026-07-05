# Rentrix Agent Capabilities

This file inventories the skills, workflows, and support tools currently present in the repository and defines when they should be used.

Read together with:

```text
AGENTS.md
docs/ai/ONBOARDING.md
docs/RENTRIX_MASTER_PLAN.md
docs/ai/GIT_TOOLING_POLICY.md
.ai/workflows/README.md
```

The active application code remains the source of truth. Agent tooling must never be imported into the production bundle.

## 1. Mandatory selection rule

Before every non-trivial task:

1. read `docs/ai/CURRENT_EXECUTION_CONTEXT.md` and `docs/ai/AGENT_OPERATING_PROTOCOL.md`;
2. choose one primary workflow from `.ai/workflows/README.md`;
3. load only task-relevant skills from the matrix below;
4. follow `GIT_TOOLING_POLICY.md` for branch, PR, CI, and merge work;
5. run fresh verification before claiming completion;
6. update roadmap evidence only when reviewed work actually changes status.

Do not inject every skill into every task.

## 2. Rentrix-owned and installed skills

### `.agent-skills/rentrix-build-web-apps/SKILL.md`

Use for Rentrix UI, routing, responsive, RTL/LTR, and hosted-preview work.

### `.agents/skills/connector-operator/SKILL.md`

Use for GitHub, Supabase, Vercel, MCP, or external connector work. Inspect documented schemas first, classify errors, and stop at access boundaries.

### `.agents/skills/ui-ux-pro-max/SKILL.md`

Use for visual design, interaction patterns, navigation, forms, tables, dashboards, mobile layouts, accessibility, and pre-launch UI polish.

### `.agents/skills/vercel-react-best-practices/SKILL.md`

Use for React implementation, hooks, data fetching, rendering behavior, bundle boundaries, and performance-sensitive refactoring.

### `.agents/skills/audit-website/SKILL.md`

Use only when a live or preview website audit is in scope and the required CLI is available.

## 3. Superpowers Skills (obra/superpowers — full install)

All 14 skills from https://github.com/obra/superpowers are now installed under:

```text
.codex/vendor/selected-agent-skills/superpowers-selected/skills/
```

### Core meta-skill — load first

| Skill | Path | Use when |
| --- | --- | --- |
| `using-superpowers` | `skills/using-superpowers/SKILL.md` | **Always load first** — tells you which other superpowers skill to use |

### Planning

| Skill | Path | Use when |
| --- | --- | --- |
| `writing-plans` | `skills/writing-plans/SKILL.md` | Writing a plan document before implementation |
| `executing-plans` | `skills/executing-plans/SKILL.md` | Following an existing plan step-by-step |

### Implementation

| Skill | Path | Use when |
| --- | --- | --- |
| `subagent-driven-development` | `skills/subagent-driven-development/SKILL.md` | Complex features needing parallel sub-agents |
| `dispatching-parallel-agents` | `skills/dispatching-parallel-agents/SKILL.md` | Spawning and coordinating multiple agents |
| `test-driven-development` | `skills/test-driven-development/SKILL.md` | Writing tests before or alongside implementation |

### Debugging

| Skill | Path | Use when |
| --- | --- | --- |
| `systematic-debugging` | `skills/systematic-debugging/SKILL.md` | Any unexplained bug or regression |

### Code quality

| Skill | Path | Use when |
| --- | --- | --- |
| `requesting-code-review` | `skills/requesting-code-review/SKILL.md` | Before submitting a PR for review |
| `receiving-code-review` | `skills/receiving-code-review/SKILL.md` | Responding to review feedback |
| `writing-skills` | `skills/writing-skills/SKILL.md` | Authoring or improving SKILL.md files |

### Git & completion

| Skill | Path | Use when |
| --- | --- | --- |
| `verification-before-completion` | `skills/verification-before-completion/SKILL.md` | **Before any completion claim** |
| `finishing-a-development-branch` | `skills/finishing-a-development-branch/SKILL.md` | Before PR handoff or merge |
| `using-git-worktrees` | `skills/using-git-worktrees/SKILL.md` | When local checkout is available and parallel branches needed |

### Creativity

| Skill | Path | Use when |
| --- | --- | --- |
| `brainstorming` | `skills/brainstorming/SKILL.md` | Architecture decisions, design exploration, visual brainstorming |

## 4. Project workflows

Choose one primary workflow:

```text
Roadmap continuation
Repository audit
Safe bug fix
Frontend page completion
Supabase migration or RLS review
Safe root cleanup
Release check
```

A task may load extra skills, but it should still have one primary workflow and one narrow PR objective.

## 5. Source-locked vendor packs

### `.codex/vendor/openai-build-web-apps/`

Available references include frontend app building, frontend debugging, React, shadcn, Stripe, and Supabase guidance.

### `.codex/vendor/anthropic-skills/`

Use only task-relevant upstream references that are verified locally.

### `.codex/vendor/addy-agent-skills/`

Start with:

```text
.codex/vendor/addy-agent-skills/skills/using-agent-skills/SKILL.md
```

Then load only the needed workflow, such as planning, incremental implementation, frontend UI engineering, test-driven development, debugging, code review, security, performance, Git workflow, CI, documentation, or shipping.

## 6. Selected additive bundle — Matt Pocock

```text
.codex/vendor/selected-agent-skills/mattpocock-selected/skills/engineering/diagnose/SKILL.md
.codex/vendor/selected-agent-skills/mattpocock-selected/skills/engineering/zoom-out/SKILL.md
.codex/vendor/selected-agent-skills/mattpocock-selected/skills/productivity/handoff/SKILL.md
.codex/vendor/selected-agent-skills/mattpocock-selected/skills/productivity/write-a-skill/SKILL.md
```

Use `diagnose` for defects, `zoom-out` for architecture review, `handoff` when unfinished work remains, and `write-a-skill` only for repeated workflows.

## 7. Agent Almanac

```text
.codex/vendor/selected-agent-skills/agent-almanac-selected/skills/troubleshoot-mcp-connection/SKILL.md
```

Use only for MCP troubleshooting together with connector-operator.

## 8. Task-to-skill matrix

| Task type | Primary workflow | Required skills |
| --- | --- | --- |
| Continue roadmap work | Roadmap continuation | `using-superpowers` → master plan → task-specific skills |
| Writing a plan | Planning | `writing-plans` |
| Executing a plan | Implementation | `executing-plans` |
| Complex new feature | Implementation | `subagent-driven-development`, `dispatching-parallel-agents` |
| UI page completion | Frontend page completion | `rentrix-build-web-apps`, `ui-ux-pro-max`, `vercel-react-best-practices` |
| React refactor or performance | Safe bug fix | `vercel-react-best-practices` |
| Bug diagnosis | Safe bug fix | `systematic-debugging`, Matt `diagnose` |
| Test-first implementation | Implementation | `test-driven-development` |
| Supabase migration / RLS review | Supabase migration or RLS review | `connector-operator`, security guidance |
| Before PR submission | Release check | `requesting-code-review`, `verification-before-completion` |
| Responding to review | Code quality | `receiving-code-review` |
| PR handoff or merge | Release check | `finishing-a-development-branch`, `verification-before-completion` |
| Architecture review | Repository audit | Matt `zoom-out`, `brainstorming` |
| Writing a new skill | Documentation | `writing-skills` |
| Safe file removal | Safe root cleanup | root layout, cleanup inventory, Git policy |
| Git branch / PR / CI / merge | Relevant workflow | `GIT_TOOLING_POLICY.md`, `connector-operator` |

## 9. Sync scripts

```text
scripts/sync-codex-vendor-skills.sh
scripts/sync-selected-agent-skills.sh
```

Run a sync script only when files are missing or an explicit refresh is approved.

## 10. Runtime boundary

All files listed here are guidance, source locks, sync helpers, or generated analysis support. Never import them into `rentrix-app/src/` or the shipped production bundle.
