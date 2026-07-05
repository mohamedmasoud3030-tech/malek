# Rentrix Documentation Index

This is a navigation guide, not a source of truth. Use the specific documents below for product, roadmap, execution, runtime evidence, and policy decisions.

## Quick entry points

| Need | Read |
| --- | --- |
| Current dynamic status / next work | `docs/ai/CURRENT_EXECUTION_CONTEXT.md` |
| Shared agent rules | `docs/ai/AGENT_OPERATING_PROTOCOL.md` |
| Product scope | `docs/FINAL_PRODUCT_BLUEPRINT.md` |
| Ordered roadmap / phase gates | `docs/RENTRIX_MASTER_PLAN.md` |
| Runtime facts and contradictions | `docs/RUNTIME_TRUTH_AND_GAPS.md` |
| Root layout and runtime boundary | `docs/ROOT_LAYOUT.md` |
| Agent onboarding snapshot | `docs/ai/ONBOARDING.md` |
| ADRs / durable decisions | `docs/decisions/README.md` |

For simple edits, read only the entry point and task-relevant policy. For non-trivial implementation, read `docs/ai/CURRENT_EXECUTION_CONTEXT.md`, follow `docs/ai/AGENT_OPERATING_PROTOCOL.md`, inspect active code with `rg`/`rg --files`, and run relevant verification.

## Active runtime boundary

- Active app: `rentrix-app/`
- Shared libraries: `lib/`
- Canonical backend assets: `supabase/`

Do not treat historical reports, archives, promotional artifacts, or agent-tooling directories as active runtime code.

## Policy references

- Engineering: `docs/ai/engineering-policy.md`
- Security: `docs/ai/security-policy.md`
- Release: `docs/ai/release-policy.md`
- Testing: `docs/ai/testing-guide.md`
- Git: `docs/ai/GIT_TOOLING_POLICY.md`
- Capabilities/skills: `docs/ai/AGENT_CAPABILITIES.md`

## Maintenance

When document conflicts appear, inspect current code, migrations, tests, and CI before updating active docs. Keep dynamic phase status in `docs/ai/CURRENT_EXECUTION_CONTEXT.md`, not in this index.
