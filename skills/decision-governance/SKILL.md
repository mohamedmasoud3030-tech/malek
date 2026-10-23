---
name: decision-governance
description: Read, respect, and change the repository's accepted architecture decisions. Use whenever a task touches architecture, dependencies, database schema, module boundaries, permissions, or security; whenever a request would contradict an accepted ADR or architectural invariant; and whenever a consequential choice is unresolved and must be surfaced to the owner rather than silently selected.
---

# Decision Governance

Decision rules live in each repo's `AGENTS.md` (precedence, immutability,
surface-don't-choose); the decisions live in the repo's decision store
(`docs/DECISIONS.md`, `docs/decisions/`, or `docs/adr/`). This skill is the
procedure for interacting with them — not a second source of truth.

## Use when

- Starting a task touching architecture, dependencies, DB schema, module
  boundaries, permissions, or security.
- A request (including an explicit owner request) would contradict an accepted
  decision or invariant.
- A consequential choice is unresolved and must be made.

## Do NOT use when

- A trivial, decision-free edit.

## Workflow

1. Read the repo's decision index, then every ADR relevant to the task.
2. Check the task against accepted decisions. Conflict = would change a
   decided outcome, violate a stated invariant, or re-decide a decided topic.
3. No conflict → proceed; cite the ADRs that apply in your plan.
4. Conflict → STOP and surface it in Arabic for the owner: the conflict, the
   specific ADR/invariant, and options — (a) comply and supersede via a new
   ADR, or (b) do not proceed. Never edit the accepted ADR; never break
   architecture silently.
5. Unresolved consequential choice → STOP and surface it with trade-offs and
   a recommendation; wait for the owner's decision. Do not silently pick.
6. Approved change → draft a superseding ADR following the repo's existing
   format, declaring `Supersedes: ADR-XXXX`; update the decision index; leave
   the superseded ADR byte-for-byte unchanged (accepted ADRs are immutable).

## Required evidence / output

- ADRs consulted, or the surfaced conflict/decision request.
- New ADR file with its `Supersedes` field + updated index (when applicable).

## Exit criteria

- Every applicable decision respected, OR every conflict/unresolved choice
  surfaced and awaiting the owner.

## Common failure modes

- Treating AGENTS.md or this skill as the source of truth instead of the ADRs.
- Editing an accepted ADR in place.
- Silently "reinterpreting" a decision to make the task fit.

> 🏛️ Portfolio binding: canonical master lives in `command-center-/skills/`.
