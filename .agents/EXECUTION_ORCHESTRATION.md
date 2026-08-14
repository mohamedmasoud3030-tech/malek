# MALEK Agent Execution Orchestration

> **Purpose:** deterministic task execution for coding agents.
>
> **Not a source of truth:** this file does not override the Canonical Pack, `governance/10-stage-master-plan.json`, the Agent checklist, the Reviewer ledger, or current Git/runtime evidence. It only defines how an agent must plan and execute work so it does not repeatedly patch symptoms, duplicate another active PR, or misread stale status text.

## 1. Mandatory task-start protocol

Before writing code, every agent must do all of the following:

1. Sync and prove the implementation base:
   - `git fetch --all --prune`
   - checkout latest `origin/main`
   - record `git rev-parse HEAD`
   - confirm a clean working tree
   - inspect open PRs/active branches for overlapping Gap IDs before starting duplicate work.
2. Read, in this order:
   - root `AGENTS.md`
   - `.agents/skills/README.md` and every triggered skill
   - `docs/source-of-truth/00_INDEX.md`
   - the affected canonical documents D01-D06
   - `docs/source-of-truth/07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`
   - `docs/source-of-truth/08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md`
   - `governance/10-stage-master-plan.json`
   - `docs/execution/10_STAGE_AGENT_CHECKLIST_AR.md`
   - the relevant current evidence, migrations, tests, CI runs and runtime/live state when authorized.
3. Do not trust a baseline SHA written inside a document over the actual Git SHA. Document baselines are audit snapshots, not proof that `main` has not advanced.
4. Do not interpret `NOT_STARTED` governed credit as “no implementation exists”. Inspect repository reality first.
5. Do not interpret existing migrations/tests as stage completion. Repository reality, governed credit, verification and live proof remain separate.

## 2. Convert every mission into an execution map before coding

For the requested mission, resolve and record in scratch/work notes:

- affected Rule IDs,
- owning Gap IDs,
- owning Work Package(s),
- mapped governed Stage(s),
- explicit dependencies,
- existing implementation that must be reused,
- missing layers in the chain `UI -> Service/RPC -> Database -> RLS/Permissions -> Audit/Idempotency -> Tests -> QA/Runtime`,
- exact exit evidence required by D08.

If the user gives a broad mission that spans several Work Packages or stages, decompose it into dependency order. The locked governance rule `one_stage_per_pr` still applies unless governance itself is changed by the authorized owner; do not silently mix later-stage migrations into an earlier-stage PR.

## 3. Root-cause execution rule

Never work as: gate fails -> patch the visible error -> rerun -> patch the next visible error.

Instead:

1. Reproduce the failure with the narrowest reliable test or query.
2. Trace it through the whole ownership chain:
   `canonical rule -> domain invariant -> data/schema -> RPC/service -> permission/RLS -> UI caller -> audit/idempotency -> test/runtime`.
3. Identify the owning layer and root cause.
4. Fix the owning layer once, preserving the canonical invariant.
5. Add or strengthen the regression test that would have caught the defect before CI.
6. Rerun the narrow test.
7. Rerun the affected stage/work-package gate set.
8. Only then run broad repository gates.

Do not weaken tests, bypass RLS, add permissive fallbacks, hard-code business values, catch-and-ignore database errors, or duplicate an accounting kernel just to make a gate green.

## 4. Error classification

Every blocker must be classified before action:

### A. Product/code defect
Fix it now in the owning layer, add regression coverage, and continue autonomously.

### B. Database contract or migration defect
Inspect repo migration history and authorized live schema first. Use forward-safe migrations only. Never edit an applied historical migration to hide drift.

### C. Test drift
Change the test only if canonical behavior or the real interface changed legitimately. Never change expected results merely to match a bug.

### D. Environment/config/access blocker
Do not fabricate a pass. Record exactly what cannot run and why. Continue all independent repository work.

### E. Governance/accounting/legal/product decision
Stop only the decision-dependent path. Do not invent policy. Continue unaffected implementation.

### F. Live production mutation required
Stop unless there is an explicitly authorized procedure. Production financial history is never modified ad hoc.

## 5. Program dependency order

This is the execution order for the remaining MALEK closeout program. Current status must always be re-derived from D07/D08 and the actual repository before starting; this section defines dependency order, not completion status.

### Wave 1 — WP-01 Security, authorization and company isolation

Primary gaps: `GAP-001`, `GAP-002`, `GAP-003`, `GAP-018`.

Finish the security foundation required by every sensitive later stage:

1. six-role/effective-capability model fails closed,
2. maker-checker identity separation for every designated sensitive action,
3. zero unintended browser-owned financial writes,
4. exhaustive SECURITY DEFINER/company-scope/grant/search_path review,
5. exact deployed-target two-company negative tests when live access exists.

Do not broaden permissions to unblock a feature.

### Wave 2 — WP-03 Contracts, onboarding, versioning and legal evidence

Primary gaps: `GAP-004`, `GAP-005`, `GAP-019`.

Complete trustworthy source terms before final financial acceptance:

1. owner-agreement version creation and immutable historical terms,
2. contract draft -> review -> approval -> signature -> activation with maker-checker,
3. snapshot the exact agreement version/collection role/commercial terms into activated contracts,
4. controlled property onboarding and evidence gates,
5. signed document/version/company/actor traceability,
6. external legal/template approval remains explicitly external where required.

### Wave 3 — WP-02 Owner-agency financial lifecycle

Primary gaps: `GAP-006` through `GAP-011`.

Execute the complete agent-net lifecycle, not isolated accounting helpers:

1. collection -> RATE fee -> tax -> owner position -> settlement,
2. FIXED_MONTHLY daily accrual/catch-up/reversal/partial-month logic,
3. Due-from-Owner recovery and lawful offset ordering,
4. authoritative 3dp RPC-only deposit receive/apply/refund/reverse lifecycle,
5. versioned company tax profiles/codes and immutable per-line snapshots,
6. controlled VOID/credit/refund/late-fee/termination adjustments,
7. subledger/GL/report parity, concurrency safety and idempotency.

For OMR, server/database authority is 3 decimals and reconciliation tolerance is `<= 0.001` where the canonical rule says so.

### Wave 4 — WP-04 Independent MASTER_LEASE closeout

Primary gap: `GAP-012`.

First confirm the release-inclusion decision from canonical/product authority.

If included, complete one real principal-accounting product journey using existing `gl_ml_*` / S06 kernels:

1. classification and source terms,
2. initial measurement,
3. liability schedule, payment and interest,
4. ROU depreciation,
5. remeasurement/modification,
6. partial/full termination,
7. sublease revenue and vacancy treatment,
8. reconciliation of 1600/2500/6200/6300/4000,
9. UI/service/RPC/report wiring and truthful labeling,
10. professional accounting review where required.

If excluded, remove misleading release availability/compliance claims without deleting valid accounting history.

### Wave 5 — WP-05 Banking, reports, reconciliation and history/corrections

Primary gaps: `GAP-013` through `GAP-017`.

Do not rewrite engineering that already exists without first proving a defect.

1. verify deterministic 1201/2000/1300/2200/2300 reconciliation,
2. verify GL-backed Trial Balance, P&L, Balance Sheet, General Ledger and Cash Flow,
3. prove fail-closed bank import on hosted/authorized data,
4. freeze S08 read-only evidence and obtain genuine independent Accounting approval,
5. only after approved S08, authorize S09 append-only corrections,
6. every S09 correction must be company/period/source scoped, reversible and evidenced before/after.

**Hard stop:** no historical S09 activation or financial backfill before genuine S08 approval. Test fixtures do not count as production approval.

### Wave 6 — WP-06 UX contract and hosted browser acceptance

Primary gaps: `GAP-020`, `GAP-023`.

Use the stable implementation candidate from prior waves:

1. resolve the AI Assistant IA conflict by explicit product decision,
2. run complete browser readiness to completion, not cancelled/skipped,
3. validate critical desktop, tablet and phone journeys,
4. validate Arabic/RTL, keyboard/focus, touch targets and responsive overflow,
5. validate loading/empty/error/permission states,
6. validate representative financial/legal print/PDF output,
7. trace any browser defect back to its owning backend/domain layer instead of masking it in UI.

### Wave 7 — WP-07 Live environment, pilot and controlled release

Primary gaps: `GAP-021`, `GAP-022`.

No production-ready claim before all of the following:

1. exact deployed candidate SHA recorded,
2. migration ledger/schema/Auth Hook/company claim/RLS/functions/Storage/config verified,
3. secrets/observability/backup and restore rehearsal verified,
4. live positive and negative critical financial/security journeys pass,
5. one real office completes a full accounting period with daily and close reconciliation,
6. zero unexplained control-account difference remains,
7. accountant, product owner and pilot office record explicit release/no-release sign-off,
8. progressive deployment and rollback/incident runbook are evidenced.

## 6. Governed stage mapping

Use `governance/10-stage-master-plan.json` and the Agent checklist for exact task IDs. Broadly:

- S02: isolation, settlement integrity, safe imports
- S03: canonical GL/chart/periods
- S04: owner-agency contracts/billing/collections/settlements
- S05: expenses/deposits/fees/tax/termination/refunds
- S06: MASTER_LEASE
- S07: reports/reconciliation/close controls
- S08: read-only historical analysis
- S09: append-only historical correction
- S10: acceptance, pilot, deployment and release

A later repository implementation may exist before governed credit. Audit it; do not rebuild it automatically and do not grant yourself Reviewer credit.

## 7. Parallel-work collision rule

Before implementing a Gap ID:

1. inspect open PRs and active branches,
2. if another active PR owns the same Gap ID or migration surface, do not duplicate it,
3. either work on an independent gap/layer or wait for/rebase onto the owning PR after it lands,
4. never create two competing migrations/RPCs for the same business event,
5. after another PR merges, refresh from latest `origin/main` before continuing.

## 8. Financial invariants that may not be traded for convenience

- OMR is 3 decimal places where authoritative monetary storage/calculation applies.
- JavaScript floating-point arithmetic is not monetary authority.
- posted accounting history is append-only,
- corrections use controlled reversal/compensating events,
- balanced GL batches are mandatory,
- event posting is idempotent and traceable,
- company isolation is mandatory at database/RPC authority,
- sensitive browser writes are forbidden unless the canonical contract explicitly permits them,
- maker-checker is enforced backend-side for designated approvals,
- owner-agency and MASTER_LEASE accounting never share liability semantics incorrectly,
- a green UI/unit test never substitutes for subledger/GL reconciliation or live proof.

## 9. Verification ladder

Run verification in this order to reduce repeated failures:

1. targeted unit/domain tests for changed logic,
2. targeted database/pgTAP/migration tests,
3. migration replay/idempotency/contract/isolation gates,
4. relevant financial/security regression suites,
5. typecheck and lint,
6. full application tests,
7. build,
8. browser/E2E for changed user journeys,
9. authorized hosted QA/live proof when required,
10. CI on the final head SHA.

If a broad gate fails, narrow it to the owning failure before editing code.

Use repository-defined scripts from `package.json`; never invent a passing command that the repository does not define.

## 10. PR and handoff contract

Every implementation PR must state:

- base SHA and final head SHA,
- governed Stage and Work Package,
- affected Rule IDs and Gap IDs,
- root cause(s) fixed,
- exact migrations/RPCs/services/UI/tests changed,
- exact commands/tests actually run and results,
- runtime/live checks actually run,
- external/governance blockers separately,
- whether exit criteria changed,
- confirmation that no unauthorized production/historical mutation occurred.

Update D07/D08 only when repository reality or exit evidence actually changed. Update only the Agent-owned checklist items with reproducible evidence. Never mark Reviewer items or governed stage COMPLETE yourself.

The correct terminal state for an agent-owned stage is `READY_FOR_INDEPENDENT_REVIEW`, not self-awarded completion.
