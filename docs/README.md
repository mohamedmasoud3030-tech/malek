# Rentrix documentation map

Use this page to find the current source for each kind of question. Do not treat historical audit reports as the latest project state.

## Start here

| Question | Document |
| --- | --- |
| What is Rentrix? | [PRODUCT.md](PRODUCT.md) |
| What is the current state? | [CURRENT_STATE.md](CURRENT_STATE.md) |
| What should happen next? | [NEXT.md](NEXT.md) |
| Can this release ship? | [RELEASE_READINESS.md](RELEASE_READINESS.md) |
| How is the system structured? | [ARCHITECTURE.md](ARCHITECTURE.md) |
| What are the domain and accounting rules? | [DOMAIN.md](DOMAIN.md) |
| Which commands prove code quality? | [TESTING.md](TESTING.md) |
| What engineering rules are mandatory? | [ENGINEERING_GOVERNANCE.md](ENGINEERING_GOVERNANCE.md) |
| Who can approve production mutations? | [GOVERNANCE.md](GOVERNANCE.md) |
| Where are production approvals recorded? | [GOVERNANCE_LOG.md](GOVERNANCE_LOG.md) |
| Where do agents begin? | [../AGENTS.md](../AGENTS.md) and [agent-context/CONTEXT_MAP.md](agent-context/CONTEXT_MAP.md) |
| Which product decisions are locked? | [decisions/README.md](decisions/README.md) |

## Precedence

When sources disagree:

1. Verified target-environment state for deployment facts.
2. Current application code, active migrations, tests, and CI configuration.
3. Approved decision records and governance policy.
4. Current-state and architecture documents.
5. Historical audits and phase reports.

A historical report is evidence of what was observed at its timestamp, not an instruction to revert newer work.

## Database documentation

- Active migrations: `../supabase/migrations/`
- Active migration guidance: `../supabase/migrations/README.md`
- Historical consolidated archive: `../supabase/migrations_consolidated/` (read-only)
- Production mutation policy: [GOVERNANCE.md](GOVERNANCE.md)
- Release backend evidence: [RELEASE_READINESS.md](RELEASE_READINESS.md)

## Maintaining this documentation

Update:

- `CURRENT_STATE.md` when a documented fact changes,
- `NEXT.md` when work closes or priority changes,
- `RELEASE_READINESS.md` when objective evidence changes,
- `ARCHITECTURE.md` when system structure or source-of-truth rules change,
- `DOMAIN.md` when an invariant or entity relationship changes,
- an ADR under `decisions/` when a durable product/architecture choice changes.

Do not copy the same long status narrative into multiple documents. Link to the authoritative document and keep historical reports immutable unless they contain a factual path/link error.
