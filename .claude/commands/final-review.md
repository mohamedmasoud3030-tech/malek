---
description: Perform the final high-confidence review of the current task diff before commit or PR
---

# Final review

Review the entire current task diff against `CLAUDE.md`, `AGENTS.md`, relevant `.claude/rules/`, and the canonical documents that govern the touched behavior.

## Review sequence

1. Identify the task branch/base and list every changed file.
2. Read the complete diff, including deletions and configuration/documentation changes.
3. Use `code-reviewer` for a second high-confidence pass when the diff contains application or backend code.
4. Report only concrete, actionable findings. Treat pre-existing unrelated issues separately; do not expand scope to fix them unless they block correctness.
5. For each real issue, fix it now if it is safely inside the task scope, then re-run the affected validation.

## Required checks

Verify all of the following:

- The requested outcome is present, not merely described.
- Canonical product/accounting/security/permission rules were preserved.
- Shared abstractions and design primitives were reused rather than duplicated.
- No competing design system, token layer, route/service abstraction, or source-of-truth document was introduced.
- Removed code is genuinely superseded/unreferenced.
- Error/empty/loading states remain coherent where applicable.
- Accessibility and responsive behavior were not degraded by UI work.
- Tests and checks match the risk of the change.
- No secrets, debug instrumentation, generated build output, temporary traces, or accidental file churn are included.
- Statements about browser/QA/live verification match what actually ran.
- The branch remains compatible with the current intended base, or any overlap is explicitly reported.

If no high-confidence issue remains, say so plainly and summarize the validation evidence. Do not invent findings to make the review look useful.
