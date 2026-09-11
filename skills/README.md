# MALEK Agent Skills

This directory is the agent-agnostic skill layer for repository work. `AGENTS.md` is the entry
point; these skills provide task-specific procedures that any capable coding agent can load on
demand.

The set was trimmed on 2026-09-11 (post-merge cleanup) to the three skills that match the
remaining work profile — database reconciliation, gated reviews, and governance decisions.
The removed skills (`implementation`, `implementation-planning`, `frontend-design`,
`webapp-testing`, `skill-creator`) remain available in git history (see commit before this
trim) if the work profile changes.

## Kept skills

| Skill | Use it for |
| --- | --- |
| `database` | PostgreSQL, Supabase, migrations, RPCs, RLS, grants and DB performance |
| `review` | Risk-routed review of diffs/branches before PR or merge |
| `architecture-decision` | Architecture, system boundaries, durable trade-offs, ADRs, threat modeling |

## Routing

1. Read `AGENTS.md` and the relevant canonical documents.
2. Load only the skill(s) matching the task; do not preload the whole directory.
3. Project rules and repository reality override generic skill advice.
