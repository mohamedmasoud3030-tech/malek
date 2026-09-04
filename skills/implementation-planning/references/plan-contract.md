# Implementation plan contract

Each non-trivial task should include:

- **ID:** unique within the plan.
- **Goal:** one observable outcome.
- **Change:** concrete files/modules/contracts.
- **Depends on:** prior task IDs or none.
- **Proof:** exact test/check/runtime evidence.
- **Cleanup:** old code/contracts removed by the task.
- **Risk/rollback:** only when material.

Prefer dependency order: invariant/contract → database/shared foundation → service/domain logic → UI/integration → cutover cleanup → broad validation. Follow the repository's actual dependency graph when it differs.

## Research basis

- GitHub create-implementation-plan: https://github.com/github/awesome-copilot/blob/main/skills/create-implementation-plan/SKILL.md
- EveryInc compound engineering: https://github.com/EveryInc/compound-engineering-plugin
