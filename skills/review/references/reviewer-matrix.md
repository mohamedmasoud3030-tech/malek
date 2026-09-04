# Reviewer matrix

## Severity

- **P0:** credible data loss, cross-tenant/security compromise, invalid financial posting, destructive migration or release-stopping correctness failure.
- **P1:** likely production regression, authorization bypass, broken core journey, incompatible contract or serious reliability/performance defect.
- **P2:** bounded correctness/maintainability issue worth fixing before it hardens.
- **P3:** real non-blocking issue, never subjective taste.

## Routing

| Changed area | Required lens |
| --- | --- |
| auth, permissions, portal/public RPC, RLS | security + database |
| migrations, SQL, RPC, generated DB types | database |
| invoices, receipts, GL, settlements, deposits | accounting/finance + database |
| route tree, forms, React state, shared UI | frontend/journey |
| public interfaces, RPC args, contract shapes | API/data contracts |
| polling, batching, queues, expensive queries | reliability/performance |
| Canonical Pack, governance, completion claims | governance/docs |

Reviewers diagnose; fixing happens after synthesis. If fixes are requested, re-run evidence and then perform a fresh final review.

## Research basis

- EveryInc ce-code-review: https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/guides/ce-code-review.md
- OpenAI security: https://github.com/openai/skills/blob/main/skills/.curated/security-best-practices/SKILL.md
- OpenAI threat model: https://github.com/openai/skills/blob/main/skills/.curated/security-threat-model/SKILL.md
