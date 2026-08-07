# Working on MALEK

> **Compatibility note:** user-visible branding is MALEK. Historical technical identifiers such as the repository name, `rentrix-app/`, database object names, persisted keys, and infrastructure identifiers remain unchanged unless an explicit migration says otherwise.

This file is the contributor/agent entry point. Product truth lives in exactly three canonical documents.

## Before you start

1. Read this file.
2. Read `.agents/skills/README.md` and apply every repo skill whose trigger matches the task.
3. Read the three canonical documents:
   - `docs/source-of-truth/01_CANONICAL_REALITY_AND_STATUS.md`
   - `docs/source-of-truth/02_BUSINESS_CONSTITUTION_AND_ACCOUNTING.md`
   - `docs/source-of-truth/03_TECHNICAL_ARCHITECTURE_AND_ROADMAP.md`
4. Then inspect the current code and, for database-sensitive work, the live schema before making a decision.

Do not use old status snapshots, archived plans, TODO lists, handover reports, or superseded architecture summaries as current truth. Git history remains available when historical evidence is needed.

## While you work

- Code and verified live database reality outrank stale prose, except for locked business/ADR/governance decisions that explicitly require owner-controlled change.
- Use `rg --files` and `rg <pattern>` instead of guessing paths.
- Keep changes scoped and reviewable.
- Run the narrowest relevant checks first; use repository scripts/package commands as the source for available checks.
- Financial browser writes must follow the existing server/RPC trust model.
- For schema/RPC work, reconcile live-vs-repo migration reality before adding migrations.
- Never invent a business, accounting, legal, or permission rule to unblock yourself. Record the blocker and continue with independent safe work.

## When to stop and ask

Stop only when the remaining work requires a genuine owner/accounting/legal decision or an explicitly unauthorized production mutation. Ordinary implementation choices are not blockers.

## When you finish

Report:
- what changed and why,
- tests/checks run,
- risks or blocked decisions,
- and update the relevant canonical status only when the code evidence justifies it.
