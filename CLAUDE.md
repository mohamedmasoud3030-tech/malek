# MALEK — Claude Code project instructions

This file is the Claude Code entry point. Keep it short. Product truth remains in the existing canonical documentation; do not create a parallel source of truth here.

## Read before editing

1. Read `AGENTS.md` and `DATABASE_RULES.md`.
2. Start at `docs/source-of-truth/00_INDEX.md` and read only the canonical documents relevant to the task.
3. For product, accounting, permissions, security, IA, or data behavior, inspect the affected Rule IDs in `docs/source-of-truth/07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md` before changing behavior.
4. Inspect the current implementation before proposing or editing code. Prefer `rg --files` and `rg <pattern>` over guessing paths.

## Repository shape

- Active application: `rentrix-app/`
- Canonical product/architecture/accounting/UX docs: `docs/source-of-truth/`
- Database and backend: `supabase/`
- Governance: `governance/`
- Repository scripts/checks: `scripts/`
- Package manager: `pnpm@10.11.1` only

Historical technical identifiers may still say Rentrix. User-visible product naming is MALEK unless an explicit migration says otherwise.

## Default execution mode

- One task, one Claude Web session, one branch, one focused PR.
- Start from the latest intended base branch; normally `origin/main` unless the task explicitly depends on another branch.
- Never push directly to `main` and never merge a PR unless the user explicitly asks.
- Do not modify unrelated files merely because you notice them.
- Before editing, inspect open/current work that may overlap the same files or subsystem when GitHub access is available.
- For a clear task, execute autonomously. Do not stop for ordinary implementation choices. Ask only when the remaining choice is a genuine owner/accounting/legal decision, unavailable credential/access, or unauthorized production mutation.
- Prefer the smallest coherent implementation that preserves useful behavior and existing architecture.
- Do not create duplicate abstractions, duplicate source-of-truth docs, parallel design systems, or replacement business rules.
- When removing legacy/dead code, prove references and preserve still-used behavior.

## Useful Claude helpers

- `/execute-task <task>` — default autonomous implementation workflow.
- `/final-review` — high-confidence final diff review before commit/PR.
- `code-explorer` — trace an existing feature before changing it.
- `code-architect` — design a non-trivial change against existing patterns.
- `code-reviewer` — high-confidence bug/regression review.
- `frontend-design` skill — use for new or materially reshaped UI, while still obeying MALEK's canonical UX/design contract and shared design system.

## Validation

Run the narrowest relevant checks first, then broaden according to risk. Common commands:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm check:docs
pnpm build
pnpm test
```

Database-sensitive work may additionally require repository gates such as `pnpm db0:gate`, `pnpm db:guardian`, `pnpm test:supabase`, or the relevant hosted-QA checks defined in `AGENTS.md`. Do not claim a check, browser proof, hosted QA proof, or production verification that was not actually run.

## Finish discipline

Before finalizing:

1. Review the complete diff, not only the last file changed.
2. Remove debug code, accidental generated artifacts, and superseded duplicate implementation.
3. Re-check branch/base compatibility if `main` advanced materially during the task.
4. Report exactly what changed, affected Rule/Gap IDs when applicable, checks actually run, runtime checks actually run, current SHA, risks/blockers, and governed stage credit separately.

The more detailed path-specific instructions live under `.claude/rules/`.