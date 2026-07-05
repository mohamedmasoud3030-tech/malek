# Rentrix Agent Operating Protocol

Shared operating guidance for Codex CLI, Claude Code, GitHub Copilot, Cursor, and generic coding agents working in Rentrix. This protocol is advisory: it helps agents load context, explain risk, and verify work without creating product-scope or architecture blockers.

## 1. Source and context model

Use these references to understand the repository before making decisions:

- **Runtime evidence:** inspect current code, migrations, generated contracts, tests, and CI configuration in this checkout before describing active behavior.
- **Current execution context:** `docs/ai/CURRENT_EXECUTION_CONTEXT.md` records dynamic status, current work, and recent blockers.
- **Product and execution plan:** `docs/RENTRIX_MASTER_PLAN.md` describes roadmap sequencing and phase intent. Confirm implementation status from code before treating planned capability as live.
- **Runtime truth and gaps register:** `docs/RUNTIME_TRUTH_AND_GAPS.md` records verified facts, contradictions, and gaps.
- **Historical references:** archived reports, old notes, and previous PRs can be useful context, but should be compared with current code before use.

When sources disagree, explain the disagreement, cite the inspected evidence, and describe the risk or follow-up needed.

## 2. Suggested reading flow

Before non-trivial edits, start from the relevant entry file for your tool (`AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, or `.cursor/rules/00-rentrix-core.mdc`), then read:

1. `docs/ai/CURRENT_EXECUTION_CONTEXT.md`.
2. This protocol.
3. `docs/ROOT_LAYOUT.md` when creating or moving files.
4. `docs/RENTRIX_MASTER_PLAN.md` when roadmap or phase context matters.
5. Task-specific policy, ADR, domain, testing, or release references as needed.

Use `rg` and `rg --files` for repository inspection when available.

## 3. Current repository orientation

- The active application currently lives in `rentrix-app/`.
- Shared workspace libraries currently live under `lib/`.
- Canonical backend assets currently live under `supabase/`.
- Rentrix is currently Arabic-first with RTL support, and English/LTR should be checked when relevant.
- Existing runtime architecture currently uses TanStack Router, React Query, Supabase, PWA support, and i18n direction handling.

These are current-orientation facts for this checkout. Future product or architecture changes can be proposed or implemented when requested; document their impact and verification.

## 4. Change documentation expectations

For any meaningful change, include in the PR or handoff:

- Objective and scope.
- Files changed and why.
- Architecture, domain, security, data, and environment impact when relevant.
- User-facing RTL/LTR and mobile impact when relevant.
- Tests and checks run, with actual results.
- Known risks, skipped checks, blockers, or follow-up work.

## 5. Legacy and tooling references

If work touches or references legacy patterns such as `react-router-dom`, `useApp`, `AppContext`, `dataService`, or agent-tooling directories, treat that as a review signal. Explain why the reference is appropriate, how it affects runtime, and what verification was run.

## 6. Sensitive areas

Supabase, migrations, RLS, RPCs, auth, financial workflows, environment configuration, production deployment, and credentials are high-impact areas. Changes in these areas should describe the impact, validation performed, and any operator or environment assumptions. If a check needs protected access, report the limitation and provide a safe local or operator-run alternative.

## 7. Verification guidance

Run the smallest meaningful checks while editing and broader checks before handoff when runtime behavior, financial behavior, schema/auth, or release readiness is affected. Report passed, failed, skipped, and blocked checks honestly.

## 8. Git and PR guidance

Follow `docs/ai/GIT_TOOLING_POLICY.md` for branch, diff, CI, PR, and merge work. Keep PRs focused, review the final diff, and avoid claiming production readiness, Supabase verification, or branch-protection status without evidence.
