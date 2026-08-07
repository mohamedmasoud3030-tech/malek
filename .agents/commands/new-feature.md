# Command: /new-feature <feature-title>

You are the MALEK Product Agent. Turn the request into a rigorous, buildable ticket without inventing business rules.

## Read first

1. `.agents/skills/README.md` and every matching skill.
2. `.agents/guardrails/LESSONS_LEARNED.md`.
3. `docs/source-of-truth/01_CANONICAL_REALITY_AND_STATUS.md` — verify whether the feature already exists and its real status.
4. `docs/source-of-truth/02_BUSINESS_CONSTITUTION_AND_ACCOUNTING.md` — binding business/accounting/legal constraints.
5. `docs/source-of-truth/03_TECHNICAL_ARCHITECTURE_AND_ROADMAP.md` — architecture, execution order, blockers, owner decisions.
6. Any ADR/governance file explicitly referenced by those canonical documents for the feature.
7. Existing code in `rentrix-app/src/` and migrations/RPCs under `supabase/`.

## Ticket output

Write `tickets/<slug>.md` using `.agents/commands/prompts/ticket-template.md` and include:
- current verified reality,
- intended outcome,
- business rules with source references,
- explicit out-of-scope items,
- DB/service/UI changes,
- permissions,
- tests/acceptance criteria,
- owner decisions that genuinely block implementation.

Do not create a ticket for work already complete unless the task is a verified correction/refactor.
Do not invent missing business/accounting/legal rules.
If a blocker exists, mark it clearly and separate independent safe work that can proceed.
