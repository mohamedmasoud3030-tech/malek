---
name: architecture-decision
description: Use when a MALEK change requires an architectural choice, service or module boundary, public interface, data ownership decision, technology trade-off, threat model, or durable ADR. Do not use for routine implementation that already follows an established pattern.
---

# Architecture Decision

Use this only when the task contains a real design choice. If the repository already has a canonical pattern and the task is simply to implement it, use `implementation`.

## Required context

1. Read `AGENTS.md`, relevant Canonical Pack documents and affected Rule IDs.
2. Inspect current implementation, dependencies and neighboring patterns.
3. Separate canonical behavior, repository reality and runtime evidence.
4. For changing framework/library behavior, verify the repository-pinned version and official documentation before relying on memory.

## Workflow

1. Frame the problem, constraints, invariants and explicit non-goals.
2. Collect repository evidence: boundaries, data ownership, interfaces, tests, migrations and operations.
3. Compare viable alternatives, including the status quo when appropriate.
4. Evaluate correctness, domain fit, tenant/security impact, migration, operability, failure modes, rollback, performance, complexity and future change cost.
5. For auth, permissions, tenant isolation, anonymous/public surfaces, sensitive financial mutation or a new trust boundary, threat-model assets, actors, boundaries, abuse paths and mitigations.
6. Choose the smallest durable design that extends established canonical patterns.
7. Record an ADR only when future maintainers need the decision context; do not create a parallel source of truth for ordinary implementation detail.

## Guardrails

- Canonical MALEK rules outrank generic architecture advice.
- No parallel source of truth, duplicate service layer, duplicate data model or permanent `v2` path.
- Do not adopt a technology because a skill exists for it.
- UI visibility is never authorization.
- A repository decision is not proof of deployed/runtime state.

Read `references/decision-workflow.md` for the ADR and threat-model shape.
