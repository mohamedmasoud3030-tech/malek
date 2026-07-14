# AI Agent Commands

This folder contains slash-style commands for coding agents working on Rentrix
(Cursor/Windsurf/Claude Code/Codex CLI). To use a command, ask the agent to run
it — e.g. `/new-feature Owner Settlements` — and it will follow the prompt
inside the corresponding `.md` file.

## Command index

| Command | Agent role | Purpose |
|---|---|---|
| `/new-feature <title>` | Product Agent | Reads ADRs/FGR/CODE and writes a rigorous `tickets/<slug>.md` |
| `/implement-db [slug]` | Database Agent | Builds migrations, atomic RPCs, RLS, and DB contract tests |
| `/implement-api [slug]` | API/Service Agent | Builds TypeScript services and TanStack Query hooks |
| `/implement-ui [slug]` | Frontend Agent | Builds routes, pages, components, Arabic RTL UI, permissions |
| `/verify-feature [slug]` | QA Agent | Runs typecheck/tests/build/e2e and writes a verification report |
| `/close-feature <slug>` | Docs/Release Agent | Updates CURRENT_STATE / FGR / NEXT / GOVERNANCE_LOG + PR |
| `/run-all-checks` | QA Agent | Runs the full verification gate, reports PASS/FAIL, no fixes |

## How agents should work

1. ALWAYS read `.agents/guardrails/LESSONS_LEARNED.md` before writing code.
2. Follow `AGENTS.md` and `docs/agent-context/CONTEXT_MAP.md` for task routing.
3. Keep diffs scoped per ticket. No "while I'm here" refactors.
4. Financial changes MUST go through atomic SECURITY DEFINER RPCs — never
   multi-step client writes.
5. Never apply migrations to production without explicit sign-off per
   `docs/GOVERNANCE.md`.
6. Update docs in the same PR where facts change.
7. If a business rule is unclear, STOP and list it under "Open Questions" —
   do NOT invent rules.

## Tickets

Active tickets live in `/tickets/`. Each ticket follows the template at
`prompts/ticket-template.md`.
