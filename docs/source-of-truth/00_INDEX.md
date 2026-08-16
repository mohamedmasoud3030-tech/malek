# MALEK Canonical Pack — Index

> **Status:** CANONICAL  
> **Effective date:** 2026-08-11  
> **Repository reality baseline:** `main@da9a98a38e61e9547df1e328ad91084e79b78410` (sequential financial hardening and WP-07 closeout)
> **Audit cut-off:** 2026-08-11
> **Purpose:** one authoritative entry point for product, domain, accounting, architecture, UX, implementation reality, and release closeout.

## 1. What this pack is

This is a brownfield source-of-truth pack. It does not assume that an old plan, a merged PR, a migration, a test, or a UI screen is complete merely because it exists. It separates four different kinds of truth:

1. **Canonical rule** — the approved behavior MALEK must satisfy.
2. **Repository reality** — code, migrations, routes, tests, and evidence that physically exist at the baseline SHA.
3. **Governed stage credit** — the status granted by `governance/10-stage-master-plan.json`, the Agent checklist, and the Reviewer ledger.
4. **Runtime/live verification** — evidence from a deployed environment, live database, Auth configuration, or authorized pilot.

These concepts must never be collapsed. Repository code may exist for a stage that still has no governed credit. Conversely, a historical document may claim completion without current implementation evidence.

## 2. The eight canonical documents

| # | Document | Owns |
|---|---|---|
| 1 | [`01_PRODUCT_CHARTER_AND_SCOPE.md`](01_PRODUCT_CHARTER_AND_SCOPE.md) | Product purpose, scope, operating boundaries, production-ready meaning |
| 2 | [`02_OPERATING_MODELS_AND_JOURNEYS.md`](02_OPERATING_MODELS_AND_JOURNEYS.md) | End-to-end business journeys and legal/accounting operating models |
| 3 | [`03_DOMAIN_AND_DATA_MODEL.md`](03_DOMAIN_AND_DATA_MODEL.md) | Canonical entities, invariants, lifecycle/data rules |
| 4 | [`04_FINANCE_AND_ACCOUNTING_MODEL.md`](04_FINANCE_AND_ACCOUNTING_MODEL.md) | Accounting policy, chart of accounts, posting and reversal rules |
| 5 | [`05_SYSTEM_ARCHITECTURE_AND_SECURITY.md`](05_SYSTEM_ARCHITECTURE_AND_SECURITY.md) | Architecture, tenancy, authorization, RPC/RLS and security controls |
| 6 | [`06_UX_IA_AND_DESIGN_CONTRACT.md`](06_UX_IA_AND_DESIGN_CONTRACT.md) | Canonical IA, routes, UX/design contract and document behavior |
| 7 | [`07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`](07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md) | The complete 77-rule evidence matrix and 23-gap register |
| 8 | [`08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md`](08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md) | Seven closeout work packages and release gates |

`00_INDEX.md` is the manifest and authority policy; it is not a ninth domain document.

## 3. Authority and precedence

When two sources disagree, use this order:

1. **Approved canonical rule in this pack.**
2. **Locked governance/decision record explicitly referenced by the pack.**
3. **Verified repository implementation evidence** for describing what exists now.
4. **Supporting ADRs, runbooks, audits and execution evidence.**
5. **Historical or superseded documents.**

Implementation evidence cannot silently rewrite an approved business rule. A mismatch is recorded as `CONFLICT` or `PARTIAL` in Document 7 and assigned to one Gap ID.

Governance stage status also cannot be inferred from implementation presence. Stage credit changes only through the governance process that owns that credit.

## 4. Rule ownership

The pack owns exactly 77 canonical rules:

| Prefix | Owner document | Count |
|---|---|---:|
| `PRD-` | 01 Product Charter | 10 |
| `OPS-` | 02 Operating Models | 15 |
| `DOM-` | 03 Domain Model | 10 |
| `FIN-` | 04 Finance & Accounting | 20 |
| `SEC-` | 05 Architecture & Security | 10 |
| `UX-` | 06 UX/IA | 8 |
| `REL-` | 08 Closeout & Release | 4 |
| **Total** |  | **77** |

Every one of these 77 Rule IDs appears exactly once in the traceability matrix in Document 7. Cross-references may mention a Rule ID but must not redefine it.

## 5. Implementation status vocabulary

Document 7 uses only these implementation statuses:

- `VERIFIED_IMPLEMENTED` — implementation evidence plus focused repository verification evidence exists for the rule.
- `IMPLEMENTED_UNVERIFIED` — implementation exists but the required verification layer is incomplete or stale.
- `PARTIAL` — only part of the end-to-end chain exists.
- `NOT_IMPLEMENTED` — no conforming implementation evidence was found.
- `CONFLICT` — implementation or active governance conflicts with the canonical rule.
- `BLOCKED_EXTERNAL` — completion depends on live environment, legal/accounting sign-off, secrets, deployment state, or another external authority.

`VERIFIED_IMPLEMENTED` does **not** mean a governance stage is `COMPLETE` and does **not** prove production deployment.

## 6. Governed stage status

`governance/10-stage-master-plan.json` remains the authority for governed stage credit. At the baseline it records:

| Stage | Governed credit |
|---|---|
| S01 | COMPLETE |
| S02 | PARTIAL |
| S03 | PARTIAL |
| S04 | NOT_STARTED |
| S05 | PARTIAL |
| S06 | NOT_STARTED |
| S07 | PARTIAL |
| S08 | NOT_STARTED |
| S09 | NOT_STARTED |
| S10 | NOT_STARTED |

This does not erase repository reality. For example, S04/S06/S08 implementation artifacts exist in the repository, but the governance process has not granted those stages the corresponding completion credit. See Documents 7 and 8.

## 7. Documentation authority inventory

| Source | Final status | Canonical replacement / role | Action |
|---|---|---|---|
| `docs/source-of-truth/00_INDEX.md` | CANONICAL | Pack manifest | Keep current |
| Documents 01–08 in this directory | CANONICAL | Domain authority | Keep current |
| `governance/final-decision-register.json` | SUPPORTING / LOCKED DECISIONS | Referenced by pack | Do not duplicate decisions |
| `governance/10-stage-master-plan.json` | SUPPORTING / GOVERNANCE AUTHORITY | Governed stage credit | Do not infer status from code |
| `docs/execution/10_STAGE_AGENT_CHECKLIST_AR.md` | SUPPORTING | Agent evidence ledger | Agent-owned only |
| `docs/execution/10_STAGE_REVIEW_LEDGER_AR.md` | SUPPORTING | Reviewer evidence ledger | Reviewer-owned only |
| `docs/execution/10_STAGE_STATUS_AR.md` | SUPPORTING | Human-readable dual-view stage snapshot | Must distinguish repository reality from credit |
| `.agents/skills/README.md` | SUPPORTING / CONTRIBUTOR ROUTING | Repository skill routing | Must point here, never to archived authority |
| `docs/decisions/**` and `docs/adr/**` | SUPPORTING | Immutable decision history | Canonical pack references accepted decisions |
| `docs/accounting/**`, `docs/security/**`, `docs/ui-ux/**`, `docs/audits/**` | SUPPORTING | Evidence and specialist detail | Cannot override pack |
| `docs/source-of-truth/archive/01_CANONICAL_REALITY_AND_STATUS.md` | SUPERSEDED | Documents 01, 07 and 08 | Historical only |
| `docs/source-of-truth/archive/02_BUSINESS_CONSTITUTION_AND_ACCOUNTING.md` | SUPERSEDED | Documents 02 and 04 | Historical only |
| `docs/source-of-truth/archive/03_TECHNICAL_ARCHITECTURE_AND_ROADMAP.md` | SUPERSEDED | Documents 05, 07 and 08 | Historical only |

No other file may call itself the active source of truth for a rule owned by this pack.

## 8. Evidence rules

A material claim about current behavior must cite a stable repository path plus a symbol, migration, RPC, route, test, or evidence artifact where practical. Never use an old test count or old CI run as current evidence without the SHA that produced it.

Live database state, enabled Auth Hooks, deployed Edge Functions, secrets, production configuration and real pilot behavior are never inferred from migrations or source files.

## 9. Change control

Any PR that changes product behavior, accounting, permissions, security, IA, or the domain model must:

1. cite affected Rule IDs;
2. update Document 7 when implementation status/evidence changes;
3. update Document 8 when a Gap ID is closed or a release gate changes;
4. preserve unresolved conflicts explicitly;
5. avoid creating a parallel source-of-truth document.

A module is not complete because a PR merged. Applicable completion evidence follows the chain:

`UI → Service/RPC → Database → RLS/Permissions → Audit → Tests → QA/Runtime evidence`.

## 10. Brownfield audit baseline and verification record

The pack describes `main@da9a98a38e61e9547df1e328ad91084e79b78410` (the sequential financial hardening and WP-07 closeout). Evidence is deliberately split:

- **Repository tests from the original audit:** 177/177 focused tests passed for navigation/permissions, Stage 3 GL, S04, S06, S08, company isolation and permission-request lifecycle.
- **PR #1430 CI on head `a6aaa8648b21945c0b92a9da851cdd4f5e2c7f96`:** documentation links, typecheck, lint, architecture, production build, full application tests and financial tests passed.
- **Release Blocker Gate on the same head:** code and ephemeral database/Storage jobs passed; authenticated staging was skipped.
- **Browser Readiness on the same head:** the complete browser suite was cancelled during its run; seeded staging smoke was skipped. It is not passing evidence.
- **Vercel:** the PR preview reached Ready. Availability of a preview is not acceptance of its journeys.

GitHub workflow run/job evidence is recorded in Document 7. Live Supabase/Auth configuration, hosted authenticated journeys and a real one-office pilot remain separate external gates.

## 11. Release rule

P7/S07 remains `PARTIAL` in the governed master plan and is not advanced by editing this documentation. Document 8 defines closeout work packages; governance ledgers define governed stage credit. Historical correction/backfill remains prohibited until its prerequisites and approvals are satisfied.
