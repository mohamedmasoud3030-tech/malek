# Decision workflow reference

## ADR shape

- **Context:** concrete problem and repository evidence.
- **Constraints/invariants:** Rule IDs, security/accounting/data constraints and compatibility needs.
- **Options considered:** include status quo when viable.
- **Decision:** one clear choice.
- **Why:** decisive trade-offs.
- **Rejected alternatives:** why each lost.
- **Consequences:** positive and negative.
- **Migration/rollback:** safe path and failure containment.
- **Validation:** tests, runtime proof and operational checks.
- **Open owner decisions:** only genuine product/accounting/legal decisions.

## Threat-model shape

Identify assets, trust boundaries, attacker/privileged actors, plausible abuse paths, existing controls, required mitigations and evidence proving those mitigations.

## Research basis

- Anthropic architecture: https://github.com/anthropics/knowledge-work-plugins/blob/main/engineering/skills/architecture/SKILL.md
- Anthropic system design: https://github.com/anthropics/knowledge-work-plugins/blob/main/engineering/skills/system-design/SKILL.md
- OpenAI threat modeling: https://github.com/openai/skills/blob/main/skills/.curated/security-threat-model/SKILL.md
- OpenAI security best practices: https://github.com/openai/skills/blob/main/skills/.curated/security-best-practices/SKILL.md
