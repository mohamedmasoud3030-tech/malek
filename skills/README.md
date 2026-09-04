# MALEK Agent Skills

This directory is the agent-agnostic skill layer for repository work. `AGENTS.md` is the entry point; these skills provide task-specific procedures that any capable coding agent can load on demand.

## Core project skills

| Skill | Use it for |
| --- | --- |
| `architecture-decision` | Architecture, system boundaries, durable trade-offs, ADRs, threat modeling |
| `implementation-planning` | Converting an approved change into an executable, dependency-aware plan |
| `implementation` | Features, bug fixes and refactors with source verification, tests and cleanup |
| `review` | Risk-routed review of diffs/branches before PR or merge |
| `database` | PostgreSQL, Supabase, migrations, RPCs, RLS, grants and DB performance |

## Specialized skills kept

- `frontend-design` — substantial new or materially reshaped UI.
- `webapp-testing` — browser-driven verification and Playwright workflows.
- `skill-creator` — create or improve a skill only after a proven workflow gap remains.

## Routing

1. Read `AGENTS.md` and the relevant canonical documents.
2. Load only the skill(s) matching the task; do not preload the whole directory.
3. Project rules and repository reality override generic skill advice.
4. Load a skill's `references/` files only when its `SKILL.md` directs you there.
5. If the host has no native skill loader, treat the matching `SKILL.md` as repository procedure.

## Current stack reality

The current repository is React 19 + Vite + TanStack + Supabase/PostgreSQL with Vitest and Playwright. There is no Nx, NestJS, Drizzle or Fastify project configuration in the current tree.

Do not add framework-specific skills because a framework is merely under consideration. Add one only after the repository actually adopts that technology and a repeated workflow gap exists.

## Skill governance

Before adding another project skill:

- prove the workflow is repeated and not already covered;
- prefer MODIFY or MERGE over a near-duplicate;
- keep `SKILL.md` focused and move heavy material to `references/`;
- make trigger descriptions specific enough to avoid accidental invocation;
- keep one canonical project procedure and use thin compatibility adapters;
- remove superseded skills, adapters, tests and references in the same change.

The goal is a small Agent OS, not a marketplace mirror.
