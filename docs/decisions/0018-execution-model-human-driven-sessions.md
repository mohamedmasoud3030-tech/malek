# 0018. Single execution model: human-driven sessions

## Status

Accepted — 2026-09-12

## Context

From 2026-02 to 2026-09 the repository accumulated **four overlapping handoff mechanisms** that each claimed to be the source of truth:

- `HANDOFF.md` — 1,022-line autonomous loop memory (NOW-1…NOW-17, G1…G7, branch `reconstruction/checkpoint-20260909`, per-session SHA tracking, §B sandbox quirks). Tied to a branch that merged to `main` at `a3001df5` on 2026-09-11.
- `NEXT_AGENT_PROMPT.md` — copy-paste prompt assuming a rotating cast of differently-named agents continues the loop.
- `INTERFACE_CURRENT_STATE.md` — point-in-time 25-entry nav / 51-route snapshot after `e21b7e32`, duplicating the canonical IA.
- `MALEK_CAPABILITY_GAP_AUDIT.md` — 52k DB0-census audit at `main@87c55fc` (72 migrations) vs 100 migrations on current `main`; both P0s already fixed but the doc still reads as open.

In parallel, `AGENTS.md` and `CLAUDE.md` described a **human-driven, one-task / one-session / one-PR** model from `origin/main`, while `.claude/agents/` + `skills/` added a third vocabulary for specialist agents. The result was a *rotating cast of differently-named agents* with no single owner of priority, and every session paid a 15–30 min tax reading four stale docs that contradicted each other and the Canonical Pack (`docs/source-of-truth/00_INDEX.md`).

**Observed evidence (not hypothetical):** `HANDOFF.md` local HEAD `6a66f692` was 11 ahead of remote with no credential to push; `NEXT_AGENT_PROMPT.md` still pointed at `411167f6`; `INTERFACE_CURRENT_STATE.md` dated 2026-09-07 predated the Target Architecture Lock (2026-08-27) wording in `00_INDEX.md`; `MALEK_CAPABILITY_GAP_AUDIT.md` §6.1 P0 was marked RESOLVED at the top but P1–P3 still read as open without reference to `07` gaps. PR #1040-style doc cleanups had previously deleted production-safety docs because they *looked* stale — proof that overlapping docs create real drift risk.

§6 root cause (governance audit retro): the ceremony-to-shipped-feature ratio was dominated not by product complexity but by **process-doc proliferation without a single accountable execution owner**.

## Decision

**Adopt one execution model going forward: human-driven sessions.**

- The **human product owner** (`@mohamedmasoud3030-tech`) owns priority and release decisions. The agent (Arena / Claude / any session) is a *helper* within a human-driven session — not an autonomous handoff loop.
- One task, one session, one branch from latest `origin/main`, one focused PR. No autonomous `HANDOFF.md` loop, no copy-paste `NEXT_AGENT_PROMPT.md`, no rotating cast.
- **Single living README:** `README.md` is the only repo-root entry point (see updated `README.md`).
- **ADRs for durable decisions:** `docs/decisions/` is the only place for architecture/product decisions, per `docs/decisions/README.md` format. No new parallel source-of-truth docs.
- **Canonical Pack is the product truth:** `docs/source-of-truth/00_INDEX.md` → 01…08 owns product, domain, accounting, architecture, UX, reality, closeout. Update it instead of creating a new guide.
- All four reconstruction-era files above are **archived** to `docs/archive/2026-09-reconstruction/` (see that directory's `README.md`). The `docs/execution/` reconstruction ledgers remain on disk for history but are superseded and no longer updated.

## Alternatives rejected

- **Single autonomous handoff loop.** Considered because `HANDOFF.md` was self-contained and suited the intensive reconstruction phase (Feb–Sep, `reconstruction/checkpoint-20260909`). Rejected going forward because it assumes an always-on agent with implicit memory and credential continuity that does not exist in human-driven maintenance: it produced stale SHA tracking, blocked pushes, speculative G1…G7 work without owner direction, and a 1,022-line file no human reviews. Keep the *technique* (focused PR + evidence) but not the *loop* as the operating model.
- **Keep both / let the next agent choose.** Rejected — the root cause is *having two models*. Allowing choice recreates the rotating cast.
- **Start a clean `malek-app` rewrite or new branch.** Rejected per Target Architecture Lock `00_INDEX.md` §4 — reconstruct/refactor `rentrix-app`, not a clean-room rewrite.

## Consequences

- Changes how work is initiated: via GitHub issue / product-owner request reviewed against `00_INDEX.md` + `07` gaps + `08` WPs, not via `HANDOFF.md` §G or `NEXT_AGENT_PROMPT.md` Steps 0–5.
- `HANDOFF.md` is no longer updated. Its NOW-18 park items are superseded by `07` gaps + `08` WPs + open GitHub issues. Any resumption of G2/G3/G4/etc requires a *human* decision to create a new issue/ADR, not an agent following the old loop.
- Reduces onboarding tax from ~30 min (read 4 stale 50k-line docs) to ~5 min (`README.md` → `00_INDEX.md` → relevant 01…08 doc → `AGENTS.md`).
- Risk: contributors who expect autonomous continuation must be redirected to the human-driven issue flow. Mitigated by the archive README and this ADR being linked from `README.md` and `AGENTS.md`.
- Follow-up: enforce ongoing discipline via `AGENTS.md` “Do not create parallel source-of-truth documents” and PR review — this ADR is not a one-time task.

## Evidence

- Archived files: `docs/archive/2026-09-reconstruction/HANDOFF.md` (1,022 lines, `6a66f692` local, `bcdf6944` remote), `NEXT_AGENT_PROMPT.md` (`411167f6`), `INTERFACE_CURRENT_STATE.md` (25 entries, 51 routes), `MALEK_CAPABILITY_GAP_AUDIT.md` (52k, 72 migrations, 96 capabilities, P0s now resolved).
- Merge evidence: `a3001df5` fast-forward `fe2a5911..a3001df5` (branch `reconstruction/checkpoint-20260909` → `main`) 2026-09-11.
- Canonical truth after archive: `README.md` (updated 2026-09-12), `docs/source-of-truth/00_INDEX.md` (2026-08-27 Target Architecture Lock), `AGENTS.md` (human-driven), `CLAUDE.md`, `docs/decisions/README.md`.
- Governance history: `docs/GOVERNANCE_TOOLING_AUDIT_2026-09-12.md` §6 root cause, `docs/GOVERNANCE.md` (only production rule — deliberately not archived).
