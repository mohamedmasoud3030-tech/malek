# MALEK Canonical Pack — Index

> **Status:** CANONICAL  
> **Effective date:** 2026-08-27  
> **Repository reality baseline for Target Architecture Lock:** `main@9e5c32e83082cac8227640cf260c51af01e54dc3`  
> **Purpose:** one authoritative entry point for product, domain, accounting, architecture, UX, implementation reality and release closeout.

## 1. What this pack is

This is MALEK's brownfield source of truth. It separates four different kinds of truth:

1. **Canonical rule** — approved behavior/target.
2. **Repository reality** — code, migrations, routes, tests and evidence that physically exist at a cited SHA.
3. **Governed stage credit** — status granted by the governance plan/ledgers.
4. **Runtime/live verification** — deployed environment, live database/Auth configuration and pilot evidence.

These layers must never be collapsed. Existing code does not silently rewrite a target rule, and a target rule does not falsely claim existing implementation.

## 2. The eight canonical documents

| # | Document | Owns |
|---|---|---|
| 1 | [`01_PRODUCT_CHARTER_AND_SCOPE.md`](01_PRODUCT_CHARTER_AND_SCOPE.md) | Product purpose, target scope and visible product boundaries |
| 2 | [`02_OPERATING_MODELS_AND_JOURNEYS.md`](02_OPERATING_MODELS_AND_JOURNEYS.md) | Business journeys and operating/accounting models |
| 3 | [`03_DOMAIN_AND_DATA_MODEL.md`](03_DOMAIN_AND_DATA_MODEL.md) | Canonical entities, invariants and lifecycle/data rules |
| 4 | [`04_FINANCE_AND_ACCOUNTING_MODEL.md`](04_FINANCE_AND_ACCOUNTING_MODEL.md) | Accounting policy, posting/reversal rules and financial truth |
| 5 | [`05_SYSTEM_ARCHITECTURE_AND_SECURITY.md`](05_SYSTEM_ARCHITECTURE_AND_SECURITY.md) | Architecture, reconstruction decision, tenancy, authorization, RPC/RLS/security controls |
| 6 | [`06_UX_IA_AND_DESIGN_CONTRACT.md`](06_UX_IA_AND_DESIGN_CONTRACT.md) | Target IA, UX/design, responsive/register/document/AI/portal behavior |
| 7 | [`07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`](07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md) | Rule-by-rule implementation evidence, conflicts and gaps |
| 8 | [`08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md`](08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md) | Release/governance closeout gates |

`00_INDEX.md` is the manifest and authority policy; it is not a ninth domain document.

## 3. Authority and precedence

When sources disagree, use this order:

1. approved canonical rule in this pack;
2. locked governance/decision record explicitly referenced by the pack;
3. verified current repository implementation for describing present reality;
4. supporting ADRs, audits, runbooks and execution evidence;
5. historical/superseded guides and screenshots.

Implementation evidence cannot silently rewrite an approved target. A mismatch is recorded as `CONFLICT` or `PARTIAL` in Document 7 until implementation catches up.

## 4. Target Architecture Lock — 2026-08-27

The following decisions are locked for target reconstruction:

- **Reconstruct/refactor the current `rentrix-app`; do not create a clean-room `malek-app` rewrite.**
- Keep Supabase schema/RLS/RPCs, accounting engines, services, permission authority, tests and architecture guards as the strong technical core unless a specific defect requires change.
- Visible global IA remains exactly seven roots: **Today → Portfolio → Leasing → Money → Services → Reports → Settings**.
- Routine staff UX presents **Office Owner / Employee** while the six-role/effective-permission backend remains authoritative.
- **OWNER_AGENCY/property management** is the primary routine product model; MASTER_LEASE remains specialist/later UX.
- Deposits, Automation, Data Integrity, Audit/System and raw accounting/journal surfaces are hidden from routine UX, not deleted from the governed core.
- Generic People and aggregate Documents Vault are not routine product pillars; identity stays canonical underneath and documents are contextual-first.
- AI is global read/explain/suggest/navigate/draft support and cannot silently authorize sensitive actions.
- Tenant Portal v1 is a separate read-only constrained surface.
- Desktop uses a fixed named expanded sidebar; phone primary navigation opens as a **bottom sheet**.
- Design is **Dark-first + complete Light**, medium-density, premium, Arabic-first/RTL.
- Relevant registers support **Cards ⇄ Table** through one shared foundation; phone defaults to Cards but optional Table scrolls only inside its container.
- Entity dossiers own relationship/operations; heavy financial analysis belongs in Money/Reports.
- Payment behavior never rewrites the contractual due schedule; contract history is versioned/append-only according to its governing lifecycle.
- Final technical rename of `rentrix-app` is allowed only after reconstruction/parity/release gates and is mechanical, not a rewrite.

Older source-of-truth wording in Documents 1/5/6 has been reconciled to this lock. Historical design guides do not override it.

## 5. Target reconstruction execution order

This is an implementation-priority overlay, **not** a replacement for governed S01–S10 stage credit:

```text
P0  Foundation + Shell + Permissions UX
 ↓
P1  Properties + Units + Owners + Tenants + Onboarding
 ↓
P2  Contracts + Schedule/Billing + Collections + Expenses + Owner Funds
 ↓
P3  Today + Maintenance + Utilities + Contextual Documents
 ↓
P4  Reports + AI + Tenant Portal + WhatsApp/Print/Export
 ↓
P5  Settings + Specialist/Hidden Surfaces + Legacy Cleanup + Final Rename/Release
```

A priority group is a Gate, not a stopping point. When its applicable acceptance criteria are green, execution proceeds directly to the next group.

## 6. Rule ownership

The pack continues to own exactly 77 canonical Rule IDs:

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

Every Rule ID remains defined exactly once by its owning document. The 2026-08-27 lock changes target wording for selected existing rules; it does not create a parallel rule namespace.

## 7. Implementation status vocabulary

Document 7 uses:

- `VERIFIED_IMPLEMENTED`
- `IMPLEMENTED_UNVERIFIED`
- `PARTIAL`
- `NOT_IMPLEMENTED`
- `CONFLICT`
- `BLOCKED_EXTERNAL`

`VERIFIED_IMPLEMENTED` does not imply governance-stage completion or deployed-production proof.

## 8. Governance separation

`governance/10-stage-master-plan.json` and its Agent/Reviewer ledgers remain the authority for governed S01–S10 credit. The P0–P5 target-reconstruction order is a product implementation sequence only and must not silently rewrite those governed statuses.

## 9. Documentation authority inventory

| Source | Final status | Role |
|---|---|---|
| `docs/source-of-truth/00_INDEX.md` | CANONICAL | Pack manifest + Target Architecture Lock |
| Documents 01–08 | CANONICAL | Domain authorities |
| `governance/final-decision-register.json` | SUPPORTING / LOCKED DECISIONS | Referenced governance decisions |
| `governance/10-stage-master-plan.json` | SUPPORTING / GOVERNANCE AUTHORITY | Governed stage credit |
| `docs/execution/**` | SUPPORTING | Execution/reviewer evidence ledgers |
| `docs/decisions/**` | SUPPORTING | Immutable decision history |
| `docs/malek-target/**` | DRAFT / SUPPORTING | Planning work used to derive this lock; cannot override this pack |
| historical design/status documents | SUPERSEDED where conflicting | Historical evidence only |

No other file may call itself the active source of truth for a rule owned by this pack.

## 10. Change control

Any PR that changes product behavior, accounting, permissions, security, IA or the domain model must:

1. cite affected Rule IDs;
2. update Document 7 when implementation status/evidence changes;
3. update Document 8 when a Gap ID or release gate truly changes;
4. preserve unresolved conflicts explicitly;
5. avoid creating a parallel source-of-truth document.

A module is not complete because a PR merged. Applicable evidence follows:

`UI → Service/RPC → Database → RLS/Permissions → Audit → Tests → QA/Runtime evidence`.

## 11. Release rule

This Target Architecture Lock authorizes the reconstruction direction, not a production-ready claim. Financial/accounting invariants remain governed by Documents 2/4 and `DATABASE_RULES.md`; runtime/live acceptance and governed stage credit remain separate until proven.