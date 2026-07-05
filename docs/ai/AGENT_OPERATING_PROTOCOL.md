# Rentrix Agent Operating Protocol

Shared operating rules for Codex CLI, Claude Code, GitHub Copilot, Cursor, and generic coding agents working in Rentrix. This is the durable shared operations reference; tool-specific entry files should point here instead of duplicating these rules.

## 1. Authority model

Separate these concepts before making decisions:

- **Runtime truth:** current code, migrations, generated contracts, tests, and CI configuration in this checkout. Inspect them before concluding how Rentrix behaves.
- **Current execution state:** `docs/ai/CURRENT_EXECUTION_CONTEXT.md` records dynamic status, current work, and immediate blockers. Read it before any non-trivial edit.
- **Product and execution plan:** `docs/RENTRIX_MASTER_PLAN.md` is the ordered implementation roadmap and phase plan. It is not proof that a capability is currently live.
- **Runtime truth and gaps register:** `docs/RUNTIME_TRUTH_AND_GAPS.md` records verified facts, contradictions, and gaps. It is not an alternate implementation plan.
- **Historical references:** old reports, archived notes, and previous pull requests are evidence only. Do not copy their conclusions into active behavior without checking current code and migrations.

When sources conflict, do not guess. Prefer inspected runtime evidence, record the contradiction in the appropriate active document, and keep the change inside the requested scope.

## 2. Read before editing

Before non-trivial edits, read the relevant entry file for your tool (`AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, or `.cursor/rules/00-rentrix-core.mdc`), then read:

1. `docs/ai/CURRENT_EXECUTION_CONTEXT.md`.
2. This protocol.
3. `docs/ROOT_LAYOUT.md` before creating or moving files.
4. `docs/RENTRIX_MASTER_PLAN.md` for roadmap/phase decisions.
5. Task-specific policy, ADR, domain, testing, or release documents.

Use `rg` and `rg --files` for repository inspection. Load only task-relevant references and skills.

## 3. Non-negotiable product boundaries

- Rentrix is a **single-office** property operations system.
- Arabic is the lead product experience with RTL support; English/LTR must remain safe.
- Do not introduce SaaS multi-tenancy, organizations, memberships, invitations, subscriptions, or organization-scoped runtime behavior.
- Do not introduce or wire a general accounting ledger.
- Do not expand product scope during audits, repairs, or release-readiness work.

## 4. Non-negotiable architecture boundaries

- The active application is `rentrix-app/`.
- Keep the current TanStack Router, React Query, Supabase, PWA, i18n, RTL/LTR direction unless an explicit approved architecture decision says otherwise.
- Do not reintroduce `react-router-dom`, `useApp`, `AppContext`, `dataService`, local database flows, or historical barrels into active runtime.
- Do not import `.agents/`, `.agent-skills/`, `.ai/`, or `.codex/vendor/` tooling into runtime code.
- Treat migrations, RLS policies, RPCs, auth boundaries, financial posting, and environment handling as sensitive surfaces.

## 5. Non-negotiable domain invariants

- A property owns units.
- A contract references exactly one unit and one tenant.
- A payment belongs to exactly one contract; standalone payments are not allowed.
- A receipt is generated only from a posted payment.
- Active contracts for the same unit must not overlap.
- Orphan chains are not allowed.
- Posted payments are immutable; corrections use reversal and replacement.
- Outstanding balance is derived through one canonical calculation path and is never edited manually.

## 6. Environment and secret safety

Do not use Supabase Cloud, Vercel production, live SQL, live production data, production configuration, credentials, secrets, or service-role keys from an agent session without explicit approval. If verification needs protected access, report the exact blocker and provide a safe local or operator-run alternative.

## 7. Work discipline

Keep each branch and pull request narrow. Do not mix unrelated cleanup, opportunistic refactors, runtime changes, schema changes, or product expansion into governance or documentation work.

Before claiming completion:

1. Review `git diff --stat` and focused patches.
2. Run the smallest meaningful verification and any required full gate.
3. Report passed, failed, skipped, and blocked checks honestly.
4. Never claim production readiness, Supabase verification, or branch-protection success without evidence.

## 8. Git and PR discipline

Follow `docs/ai/GIT_TOOLING_POLICY.md`. Preserve dirty worktrees, avoid destructive Git operations, inspect branch/base state, review open related PRs when tooling permits, and do not merge PRs unless explicitly instructed.
