# Rentrix repo-scoped Agent Skills

These skills are local to this repository under `.agents/skills/`. Apply every relevant skill when work crosses multiple domains. Rentrix-specific skills take precedence over external workflow skills when they overlap.

## Rentrix-specific skills

| Skill | Use when | Path |
| --- | --- | --- |
| `frontend-integration` | A change creates, modifies, reviews, or claims completion of a user-facing screen, route, component, or workflow. | `.agents/skills/frontend-integration/SKILL.md` |
| `supabase-data-contracts` | A change touches Supabase migrations, RLS, RPCs, views, database services, generated database types, or UI/database contract alignment. | `.agents/skills/supabase-data-contracts/SKILL.md` |
| `financial-reporting` | A change affects collections, payments, receipts, settlements, bank reconciliation, owner/tenant statements, reporting totals, or financial calculations. | `.agents/skills/financial-reporting/SKILL.md` |
| `testing-release-readiness` | Before claiming any feature, fix, refactor, or release candidate is complete, verified, or release-ready. | `.agents/skills/testing-release-readiness/SKILL.md` |

## Curated external workflow skills

These upstream skills live beside the Rentrix-specific skills so there is only one local skills root. Each skill remains in its own folder with its own `SKILL.md`; selected upstream source revisions are recorded in `.agents/skills/EXTERNAL_SOURCES.md`, with shared upstream licenses in `.agents/skills/EXTERNAL_LICENSES/`.

| Source | Skill folders | Use when |
| --- | --- | --- |
| Anthropic skills | `anthropics-frontend-design`, `anthropics-webapp-testing` | You need stronger visual design guidance or Playwright-based local web-app verification. |
| Matt Pocock engineering skills | `mattpocock-code-review`, `mattpocock-codebase-design`, `mattpocock-domain-modeling`, `mattpocock-improve-codebase-architecture`, `mattpocock-research`, `mattpocock-triage` | You need code review, architecture/design vocabulary, domain modeling, primary-source research, or issue triage workflows. |
| Superpowers skills | `superpowers-systematic-debugging`, `superpowers-test-driven-development`, `superpowers-writing-plans` | You need root-cause debugging, strict TDD, or a detailed implementation plan. |

## Curation rules

- Do not create another top-level skills directory; use `.agents/skills/<skill-name>/`.
- Do not keep duplicate skills for the same workflow unless they serve clearly different use cases.
- Prefer the more complete skill when two upstream skills overlap; the current selection keeps Superpowers debugging/TDD over the smaller Matt Pocock equivalents.
- Do not vendor binary helper assets into skills. Keep folders text-reviewable and branch-friendly.
- Omit Claude-artifact-specific, document-generation, presentation/spreadsheet, image/art, Slack/GIF, Claude API, and personal-productivity skills unless a Rentrix task specifically needs them.
