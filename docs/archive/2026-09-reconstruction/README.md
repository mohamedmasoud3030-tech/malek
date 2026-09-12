# Archive — 2026-09 Reconstruction Docs

> **Status:** ARCHIVED 2026-09-12 · **Superseded by:** `README.md` + `docs/decisions/0018-*` + Canonical Pack (`docs/source-of-truth/00_INDEX.md`)

These files are the reconstruction-era working memory. They were accurate **at their timestamps** but overlap heavily, duplicate the Canonical Pack, and encode a *rotating-cast / autonomous-handoff* execution model that is no longer used.

They are kept here **for historical evidence only** — do not treat them as source of truth, do not update them, do not create new ones.

| File | Original purpose | Why archived | Where to look now |
|---|---|---|---|
| `HANDOFF.md` (1,022 lines, last `reconstruction/checkpoint-20260909` @ `6a66f692`) | Autonomous loop continuous memory: NOW-1…NOW-17, G1…G7, push/SHA tracking, §B sandbox quirks | Tied to abandoned `reconstruction/checkpoint-20260909` branch + credential-blocked autonomous loop; duplicates `docs/source-of-truth/07` reality and `08` closeout; stale branch `reconstruction/checkpoint-20260909` merged to `main@a3001df5` 2026-09-11 — further handoff updates are misleading | Current branch `main`, `docs/source-of-truth/07` (reality), `08` (work packages), `docs/GOVERNANCE.md` (production rule) |
| `NEXT_AGENT_PROMPT.md` | Copy-paste prompt for the next Arena agent to continue the loop | Presumes rotating differently-named agents; superseded by single human-driven model (`AGENTS.md` + `CLAUDE.md` + this README) | `AGENTS.md` § Execution model, `docs/decisions/0018-*` |
| `INTERFACE_CURRENT_STATE.md` | Snapshot of 25 nav entries / 51 routes after `e21b7e32` | Point-in-time UI inventory; Canonical IA now owned by `docs/source-of-truth/06_UX_IA_AND_DESIGN_CONTRACT.md` | `06_UX_IA_AND_DESIGN_CONTRACT.md` + live `rentrix-app/src/app/navigation/*` |
| `MALEK_CAPABILITY_GAP_AUDIT.md` (2026-09-04, 72 migrations) | DB0 census + frontend reachability (96 capabilities, P0 permission divergence, tax RPC 42501) | Baseline frozen; both P0s fixed on `main`, remaining P1/P2 tracked in `07` gaps + `08` WPs; 72-migration census is stale vs 100 migrations on `main` | `docs/source-of-truth/07` gaps, `08` WPs, `docs/GOVERNANCE_TOOLING_AUDIT_2026-09-12.md` |

## Also archived in place (still at `docs/execution/` but superseded)

`docs/execution/10_STAGE_AGENT_CHECKLIST_AR.md`, `10_STAGE_REVIEW_LEDGER_AR.md`, `10_STAGE_STATUS_AR.md`, `RECONSTRUCTION_INVENTORY.md` (160k), `RECONSTRUCTION_DOD_CHECKLIST.md`, `RECONSTRUCTION_COVERAGE.md` — all reconstruction-era ledgers. Governance credit now **path-scoped advisory** (see `docs/GOVERNANCE_TOOLING_AUDIT_2026-09-12.md`); implementation reality is `07`, closeout is `08`. Kept for history, not updated.

## Discipline going forward

- **Single living README:** `README.md` is the only entry point. No new `HANDOFF*.md`, `NEXT_AGENT*.md`, `CURRENT_STATE*.md`, or `*_AUDIT.md` at the repo root.
- **ADRs for durable decisions:** `docs/decisions/` — one file per decision, 0001…0018, per `docs/decisions/README.md` format. No parallel source-of-truth docs.
- **Canonical Pack over working memory:** `docs/source-of-truth/00_INDEX.md` → 01…08 owns product/domain/accounting/architecture/UX/reality/closeout. Update it instead of creating a new guide.
- **Human-driven sessions:** see ADR 0018. One task, one session, one branch, one PR from `origin/main`. No autonomous handoff loop.

*Ongoing discipline, not a one-time task — enforce via `AGENTS.md`, `CLAUDE.md`, and PR review.*

*Created by governance consolidation 2026-09-12 — branch `arena/01a09383-malek`.*
