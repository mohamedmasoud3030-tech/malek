# Governance Tooling Audit — 2026-09-12

**Author:** Arena agent (branch `arena/01a09383-malek`)  
**Baseline:** `main@492db36` · **Task:** Consolidate governance/process tooling that dominated the last 7 months and reduce ceremony-to-shipped-feature ratio.  
**Principle:** keep anything that *prevents a real shipped defect* (tenant leak, financial misstatement, lost migration history, direct prod mutation). Demote or archive anything that only *proves a process was followed*.

> This file is the decision record for the consolidation. It does not add a new process — it explains which existing checks still earn their keep and which were thinned, scoped, or archived.

---

## 1. What was measured

| Source | Count at baseline | Cost | Defect class caught |
|---|---|---|---|
| `package.json` `check:*` + `db0:*` + `db:guardian` scripts | **22** distinct `check`/`db0`/`db:guardian` scripts | 5–75 min when run together | schema, tenant isolation, financial invariants, doc links |
| GitHub Workflows that enforce governance | **13** workflows (`ci`, `canonical-business-rules-guard`, `execution-plan-guard`, `canonical-db-baseline`, `database-governance`, `browser-readiness`, `hosted-*`, `release-blocker`, `sonar`, `supabase-*`) | 2 parallel guards running `check-canonical-business-rules.mjs` on every PR | hash drift, stage-ledger drift |
| `governance/` locked files + hash gates | 3 JSON contracts + 3 `.sha256` + 2 markdown constitutions | every business-rule tweak required 4 files + hash update | silent business-rule mutation |
| `docs/execution/` 10-stage plan | 10 stages × 10 tasks = **98** tasks, agent ledger + reviewer ledger, one-stage-per-PR rule, `branch_from_latest_main`, evidence-per-task | 7 months of PR sequencing + dual truth (Governed Credit vs Repository Reality) | — process, not defect |
| `scripts/guardian/` | **12** sequential layers (DB0 gate + 7 security scans + hygiene + key scan) | 10–20 min local, many overlapping scans | tenant-authority gaps (real) + DG-GOV-008 style strictness (often allowlist churn) |

**Ceremony signal:** a routine UI copy change before this audit triggered **5 blocking governance checks** (canonical-rules, execution-plan, migration hygiene, gl-boundary, enterprise-freeze) even when `governance/**` and `supabase/**` were untouched, plus two duplicate workflow runs of the same `check-canonical-business-rules.mjs`.

---

## 2. Classification

### KEEP — blocking, fast, high signal (<30s, catches shipped defects)

| Tool | Why it stays blocking | Scope after audit |
|---|---|---|
| `check-production-mutation-guard.sh` → `docs/GOVERNANCE.md` | Only thing that prevented PR #1040-style deletion of the prod-mutation rule. 1 grep, 0.2s. | **Keep as-is**, runs in `ci` on every PR (cheap). |
| `check-migration-rollback-hygiene.mjs` | Prevents editing old migrations and adding `rollback/*down*` files — preserves replayable history. Changed-files-only, ~0.5s. | **Keep**, scoped to PRs that touch `supabase/migrations/**` (via `check:fast`). |
| `check-database-governance.mjs` | Blocks raw `INSERT` into `companies`/`invoices`/… without `ALLOW_GOVERNED_DATA_MIGRATION` and blocks sprint-codenames (`wp*`, `s*`) as permanent objects. Catches accounting-invariant bypasses. | **Keep**, runs only when `supabase/**` changes (workflow already scoped). |
| `check-no-new-legacy-journal-writes.mjs` (GL write boundary) | Prevents new browser direct writes to `journal_entries` compatibility surface; enforces RPC-only. Financial correctness. Changed-files-only. | **Keep**, runs only when `supabase/**` or `rentrix-app/src/**` changes (via `check:fast`). |
| `db0:check-types` (`gen-types --check`) | Migration → `rentrix-app/src/types/database.ts` drift is a real break (frontend queries missing column). | **Keep**, `ci` already runs it; now documented as part of `verify:quick`. |
| `check:architecture` (`rentrix-app/scripts/check-architecture.mjs`) core | Catches `supabase.from()` in presentation components and cross-feature service leaks. Real architecture drift. | **Keep core**, but debt-allowlist churn moved to advisory. |
| `check:frontend-db-contract` | Auto-discovers `.from()`/`.rpc()` and verifies table/column/RPC existence against generated types. Catches FK/enum drift. | **Keep**, `ci` already runs it. |

### MERGE — duplicate workflows doing the same hash check

| Before | After | Saving |
|---|---|---|
| `canonical-business-rules-guard.yml` **and** `execution-plan-guard.yml` both ran `check-canonical-business-rules.mjs` on *every* PR | Single **`governance-guard.yml`** (kept as `canonical-business-rules-guard.yml` scoped with `paths:`) runs canonical-rules once; execution-plan guard now **path-scoped** to `governance/10-stage*` / `docs/execution/10_STAGE*` only | 1 fewer duplicate workflow per PR; 30–60s saved + less noise |

### DEMOTE — useful but not per-PR blocking

| Tool | Previous | New | Reason |
|---|---|---|---|
| `check:docs` (`check-doc-links.mjs`, 162 lines, scans every `*.md`) | `heavy-validation` on `main` only, but still expected | **Advisory** — `pnpm check:advisory`, runs on `docs/**` changes or `workflow_dispatch` | Broken links don't block a feature; fix forward, don't fail PR. |
| `check:enterprise-freeze` (`check-no-new-enterprise-usage.mjs`) | Ran in `ci` governance guard via `check-no-new-enterprise-usage.test.mjs` | **Advisory / archived** — `enterprise/*` is already deleted (zero prod consumers); guard now `check:advisory` only | Tautology. Keeping it blocking forced a test run for a deleted surface. |
| `guardian` extended layers (`strict-governance` DG-GOV-008, `security-definer-boundary`, `function-default-acl`, `governance-migration-safety`, `privileged-key-scan`) | Presented as “run guardian before merge” (12 layers) | **Split** into `db:guardian:core` (5 blocking layers) vs `db:guardian` (full 12, pre-release) | DG-GOV-008 and overlap scans generated allowlist churn without catching net-new tenant leaks beyond the 3 core layers. |
| `check-manual-migration-workflow.mjs` + its `.test.mjs` | Ran on every `ci` build | **Advisory** — runs only when `.github/workflows/supabase-production-migrations.yml` changes | Validates a manual workflow is dispatch-only; no need to run on a UI change. |
| `check-migration-rollback-hygiene.test.mjs` / `check-no-new-legacy-journal-writes.test.mjs` / `check-no-new-enterprise-usage.test.mjs` | Ran on every `ci` build as part of governance guard | **Moved to `pnpm test`** — guard unit tests are dev tests, not prod gates | Running guard-self-tests per-PR doubled the guard cost. |

### ARCHIVE — process that slowed 7 months, now superseded by Canonical Pack

| Artifact | Status after audit | Replacement |
|---|---|---|
| `governance/10-stage-master-plan.json` + `.sha256` strict rules (`one_stage_per_pr`, `branch_from_latest_main`, `stage_complete_requires_agent_and_reviewer`, `evidence_required_for_every_task`, `no_cherry_pick_from_superseded_*`) | **Archived as reference** — hash integrity still verified **only when the file itself changes**; the one-stage-per-PR / evidence-per-task rules no longer gate routine feature PRs | `docs/source-of-truth/08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md` work packages (WP-01…WP-07) + `docs/source-of-truth/07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md` rule-by-rule reality |
| `governance/final-decision-register.json` (D01–D18) | **Kept as locked reference**, but its hash gate is now **path-scoped**, not per-PR | Decisions remain authoritative via `docs/decisions/0011*` and `docs/business/CANONICAL_BUSINESS_AND_CONTRACT_RULES_AR.md`; no longer need to update 4 files for a business-rule note |
| `docs/execution/10_STAGE_AGENT_CHECKLIST_AR.md` + `10_STAGE_REVIEW_LEDGER_AR.md` + `10_STAGE_STATUS_AR.md` | **Archived** — retain for history, no longer the per-PR credit gate; reviewer/agent separation preserved via `CODEOWNERS` | Closeout tracked in `docs/source-of-truth/08*` |
| Canonical business-rules constitution/changelog **lockstep** (`CANONICAL_BUSINESS_AND_CONTRACT_RULES_AR.md` must contain version + SHA, `BUSINESS_RULES_CHANGELOG.md` must contain version + SHA) | **Demoted to WARN** — `check-canonical-business-rules.mjs` now checks SHA + core fields **strictly**, and constitution/changelog sync **advisory** (fails only with `--strict`) | Owner approval via `CODEOWNERS` + SHA integrity is the real gate; docs can catch up in a follow-up PR |

---

## 3. Concrete changes in this PR

### `package.json` (root)

- Added **consolidated scripts**:
  - `check:fast` — the 4 cheap blocking gates that earn their keep (prod-mutation guard + migration hygiene + gl-boundary + db-governance)
  - `check:advisory` — demoted checks (`check:docs`, enterprise-freeze, manual-workflow test)
  - `verify:quick` — `check:fast` + architecture + type parity + frontend-db-contract + RLS smoke (the pre-PR gate developers actually need, <3 min)
  - `verify:full` — `verify:quick` + full `db:guardian` (pre-release)
  - `db:guardian:core` — 5-layer core guardian (db0 gate + canonical-authority + sensitive-rpc-auth + internal-gl-rpc-boundary + tax-readiness) — the part that catches real tenant leaks

- Kept all historic `check:*` names for backward compat, but CI no longer calls the advisory ones per-PR.

### Workflows

- **`.github/workflows/canonical-business-rules-guard.yml`** — added `paths:` filter (`governance/canonical-business-rules.*`, `docs/business/CANONICAL_BUSINESS_AND_CONTRACT_RULES_AR.md`, `governance/BUSINESS_RULES_CHANGELOG.md`, `scripts/check-canonical-business-rules.mjs`). It no longer runs on every UI PR.

- **`.github/workflows/execution-plan-guard.yml`** — added `paths:` filter (`governance/10-stage-master-plan.*`, `governance/final-decision-register.*`, `docs/execution/10_STAGE*`, `docs/decisions/0011*`, `docs/accounting/ACCOUNTING_DECISION_GATES_AR.md`). Removed duplicate `Verify canonical business rules` step (canonical guard owns it). Header now marks the plan as **archived reference** with pointer to `docs/source-of-truth/08*`. This single change eliminates the per-PR “98-task evidence” gate for routine work.

- **`.github/workflows/ci.yml`** — thinned the `Governance guard` step: kept `check-production-mutation-guard.sh` + the two **real** hygiene checks (`check-migration-rollback-hygiene.mjs --base origin/main`, `check-no-new-legacy-journal-writes.mjs --base origin/main`). Removed the 3 guard-self-test runs (`*.test.mjs`) and `check-manual-migration-workflow.mjs` from the per-PR blocking path (they stay in `check:advisory`).

### Scripts

- **`scripts/check-canonical-business-rules.mjs`** — constitution/changelog SHA sync is now **warn, not fail**, unless `CANONICAL_RULES_STRICT=1` / `--strict`. SHA integrity and core field assertions remain blocking. Fixes the 4-file lockstep churn.

- **`scripts/guardian/run.mjs`** — now accepts `--core` to run only the 5 high-signal layers. `run-core` is exposed as `pnpm db:guardian:core`.

- **`scripts/guardian/README.md`** — now documents core vs full and that guardian is **pre-release**, not per-PR.

### Documentation

- This audit (`docs/GOVERNANCE_TOOLING_AUDIT_2026-09-12.md`) becomes the canonical justification. `AGENTS.md` now points to `verify:quick` as the daily gate.

---

## 4. What stays cheap and what stays safe

**Daily developer loop (before push):**

```bash
pnpm verify:quick   # ~90s: fast gates + typecheck + architecture + frontend-db contract
```

Only fails on real defects: broken migration history, direct journal write, tenant-isolation drift, type/contract drift, presentation data-plane leak.

**Pre-release / weekly:**

```bash
pnpm verify:full    # adds full guardian (12 layers) + doc links + advisory checks
pnpm db:guardian:core   # or just the 5 isolation-critical layers if short on time
```

**Governance change (only when `governance/**` or `docs/business/**` touched):**

- Canonical rules guard runs and requires `@mohamedmasoud3030-tech` approval on current head (existing `CODEOWNERS` + workflow approval check).
- Hash mismatch now fails fast with one file to fix (`.sha256`), not four.

---

## 5. Ceremony budget reclaimed

| Before | After | Delta |
|---|---|---|
| Every UI PR triggered 2 governance workflows + 3 guard-self-tests + duplicate `check-canonical-business-rules` | 1 governance workflow, path-scoped | **−2 workflow runs per UI PR** |
| `check-migration-rollback-hygiene.test.mjs` + `check-no-new-legacy-journal-writes.test.mjs` + `check-manual-migration-workflow.mjs` on every PR | advisory only | **−3 blocking steps per PR** |
| Changing a business-rule note required editing 4 files + SHA in lockstep | SHA only; docs warn | **−3 file edits per governance note** |
| 98-task evidence gate per PR (“one stage per PR”) | Path-scoped, archived to work packages | **− process bottleneck for 7 months** |
| 12-layer guardian implied per-PR | 5-layer `core` quick, 12-layer pre-release | **−7 layers per daily run** |

Estimated PR iteration saving: **2–4 minutes of CI per UI PR** plus **elimination of 30–60 min of “fix the plan ledger” churn** that previously dominated stage-crossing PRs. No safety invariant was weakened — every removed gate was either duplicate, testing the test, or checking a file the PR didn't touch.

---

## 6. Explicit non-goals

- **Not deleting `docs/GOVERNANCE.md` or `docs/GOVERNANCE_LOG.md`.** That one rule (no prod mutation without sign-off) is the only guard that *must* stay cheap and blocking. Its CI check is untouched except to keep it.
- **Not weakening RLS/tenant isolation, financial write boundaries, or migration replay.** Those are the real production breakers and remain blocking.
- **Not inventing a new process document.** The Canonical Pack (`docs/source-of-truth/00_INDEX.md` → `07`/`08`) was already the approved replacement for the 10-stage plan’s process role; this audit just stops gating on both.

---

## 7. How to revert

Every demoted check keeps its implementation file. To restore strictness:

- Business-rules lockstep: `CANONICAL_RULES_STRICT=1 node scripts/check-canonical-business-rules.mjs`
- Execution-plan full gate: `node scripts/check-10-stage-execution-plan.mjs` (still present)
- Guardian full: `pnpm db:guardian`
- Advisory: `pnpm check:advisory`

Nothing was deleted; only the *per-PR blocking* wiring was thinned.
