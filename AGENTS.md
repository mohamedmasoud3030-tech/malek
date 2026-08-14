# Working on MALEK

> **Compatibility note:** user-visible branding is MALEK. Historical technical identifiers such as the repository name, `rentrix-app/`, database object names, persisted keys, and infrastructure identifiers remain unchanged unless an explicit migration says otherwise.

This file is the contributor/agent entry point. Product truth lives in the MALEK Canonical Pack.

## Before you start

1. Read this file.
2. Read `.agents/EXECUTION_ORCHESTRATION.md` and follow its mandatory task-start, dependency-order, root-cause, parallel-work and verification protocol. It is an execution runbook, not a source of product truth.
3. Read `.agents/skills/README.md` and apply every repo skill whose trigger matches the task.
4. Read the MALEK Canonical Pack starting at `docs/source-of-truth/00_INDEX.md`.
5. Read the affected Rule IDs in `07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md` before changing product, accounting, permissions, security, IA or data behavior.
6. Then inspect current code and, for database-sensitive work, the live schema/deployed configuration when authorized before making a runtime claim.

The Canonical Pack contains eight documents covering product scope, operating models, domain model, accounting, architecture, UX, implementation traceability, and release gates.

## Four truth layers — never collapse them

Always report these separately:

1. **Canonical rule** — approved behavior.
2. **Repository Reality** — what code/migrations/tests/evidence exist at a cited SHA.
3. **Governed Stage Credit** — what `governance/10-stage-master-plan.json` plus the Agent/Reviewer ledgers officially credit.
4. **Runtime/live verification** — what was actually proven in deployed Auth/Postgres/Storage/browser/pilot environments.

Repository implementation does **not** grant stage credit. Lack of stage credit does **not** justify saying no implementation exists. Never mark Reviewer checkboxes or rewrite a `NOT_STARTED/PARTIAL` governed status just because code/tests were found.

**Rule ID discipline:** cite affected Rule IDs in every implementation PR and update the traceability matrix when implementation evidence/status changes.

**Gap discipline:** each open gap has one primary Gap ID and one owning Work Package. Do not create duplicate TODOs/roadmaps for the same missing outcome.

**Conflict resolution:** preserve canonical/locked decisions and record mismatching implementation as `CONFLICT` or `PARTIAL`. Do not silently redefine a rule to match existing code.

Do not use archived status snapshots, TODOs, handovers or superseded architecture/accounting documents as current authority. Git history remains available for historical evidence.

## While you work

- Locked D01–D18 decisions and the Canonical Pack govern target behavior; current implementation evidence describes reality and may expose a gap.
- Use `rg --files` and `rg <pattern>` instead of guessing paths.
- Keep changes scoped and reviewable.
- Run the narrowest relevant checks first; use repository scripts/package commands as the source for available checks.
- Use the repository-pinned pnpm version; do not diagnose a pnpm-major mismatch as an application failure.
- Financial browser writes must follow the server/RPC trust model.
- For schema/RPC work, reconcile live-vs-repo migration reality before adding migrations.
- Never invent a business, accounting, legal, permission or stage-status rule to unblock yourself.
- Do not describe S04/S06/S08 as absent merely because their governed credit is NOT_STARTED; inspect repository reality first.
- Do not describe S04/S06/S08 as complete merely because migrations/tests exist; inspect Document 7 and governance ledgers first.

## Autonomous verification loop

When a task changes a user-facing flow, API/RPC, authentication/permissions or data mapping, do not stop at code inspection or a static test result. Operate the application as part of the task, then fix and re-check what you observe.

1. Start the local app or use the task's deployed **QA/preview** URL.
2. Open the affected route with browser automation. Inspect desktop/mobile rendering, browser console, failed network requests, navigation and success/error states.
3. For a live backend-dependent flow, run the matching hosted-QA proof before diagnosing the UI: `pnpm qa:preflight` for Auth/API/RLS and `pnpm qa:database-contracts` for schema/RPC/RLS drift. For an approved disposable financial flow, use `pnpm qa:lifecycle`.
4. Treat browser-visible failure, console error, failed request, schema mismatch, permission mismatch, unexpected response, overflow or broken state as a defect. Trace it across `UI → mapper/service → RPC/API → database`, implement the smallest correct repair and repeat the same scenario.
5. Preserve useful evidence from the browser runner when a failure occurs. State exactly what was run; never describe a flow as visually/end-to-end verified if it was not opened.

Use the repo's `browser-qa` and `testing-release-readiness` skills for this loop. The normal target is QA/preview. Production browser activity is read-only; no financial or other mutating journey may run there without explicit authorized procedure.

## Accounting and historical controls

- Owner-agency is agent-net; MASTER_LEASE is separate principal accounting.
- The canonical Stage-3 chart has exactly 18 required accounts, including 1300 Due from Owners, 2300 Broker Commissions Payable and 6110 Broker Commission Expense.
- `gl_pm_*` or `gl_ml_*` function presence proves a repository surface, not that the user journey is wired end-to-end.
- Posted history is append-only; use controlled reversal/adjustment.
- Historical correction/backfill is prohibited until governed S08 analysis is independently approved and S09 controls are authorized.

## When to stop and ask

Stop only when the remaining work requires a genuine owner/accounting/legal decision, credentials/access that are unavailable, or an explicitly unauthorized production mutation. Ordinary implementation choices are not blockers.

## When you finish

Report:
- what changed and why,
- affected Rule IDs and Gap IDs,
- repository evidence and the exact SHA,
- tests/checks actually run,
- runtime/live checks actually run,
- governed stage credit separately,
- risks/external blockers,
- and whether Work Package exit criteria truly changed.

**Never declare a module complete** from a component test, migration or merged PR alone. A module is complete only when the applicable chain is evidenced: `UI → Service/RPC → Database → RLS/Permissions → Audit → Tests → QA/Runtime evidence`.

**Do not create parallel source-of-truth documents.** Update the Canonical Pack instead.
