# Working on MALEK

> **Compatibility note:** user-visible branding is MALEK. Historical technical identifiers such as the repository name, `rentrix-app/`, database object names, persisted keys, and infrastructure identifiers remain unchanged unless an explicit migration says otherwise.

This file is the contributor/agent entry point. Product truth lives in the MALEK Canonical Pack.

## Before you start

1. Read this file.
2. Read `.agents/skills/README.md` and apply every repo skill whose trigger matches the task.
3. Read the MALEK Canonical Pack starting at `docs/source-of-truth/00_INDEX.md`.
4. Then inspect the current code and, for database-sensitive work, the live schema before making a decision.

The Canonical Pack contains eight documents covering product scope, operating models, domain model, accounting, architecture, UX, implementation traceability, and release gates. Always read the relevant canonical document before making product, accounting, permission, security, IA, or data-model changes.

**Rule ID discipline:** When implementing changes, cite affected Rule IDs in your PR description. Update the traceability matrix (`07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`) when implementation status changes.

**Conflict resolution:** If you discover a conflict between documentation and code, preserve the canonical rule and record the implementation as CONFLICT. Do not silently redefine the rule to match existing code.

Do not use old status snapshots, archived plans, TODO lists, handover reports, or superseded architecture summaries as current truth. Git history remains available when historical evidence is needed.

## While you work

- Code and verified live database reality outrank stale prose, except for locked business/ADR/governance decisions that explicitly require owner-controlled change.
- Use `rg --files` and `rg <pattern>` instead of guessing paths.
- Keep changes scoped and reviewable.
- Run the narrowest relevant checks first; use repository scripts/package commands as the source for available checks.
- Financial browser writes must follow the existing server/RPC trust model.
- For schema/RPC work, reconcile live-vs-repo migration reality before adding migrations.
- Never invent a business, accounting, legal, or permission rule to unblock yourself. Record the blocker and continue with independent safe work.

## Autonomous verification loop

When a task changes a user-facing flow, an API/RPC, authentication/permissions,
or data mapping, do not stop at code inspection or a static test result. Operate
the application as part of the task, then fix and re-check what you observe.

1. Start the local app or use the task's deployed **QA/preview** URL.
2. Open the affected route with browser automation. Inspect the rendered UI at
   the relevant desktop and mobile sizes, browser console, failed network
   requests, navigation, and success/error states.
3. For a live backend-dependent flow, run the matching hosted-QA proof before
   diagnosing the UI: `pnpm qa:preflight` for Auth/API/RLS and
   `pnpm qa:database-contracts` for schema/RPC/RLS drift. For an approved
   disposable financial flow, use `pnpm qa:lifecycle`.
4. Treat a browser-visible failure, console error, failed request, schema
   mismatch, permission mismatch, unexpected response, overflow, or broken
   state as a defect. Trace it across UI -> mapper/service -> RPC/API ->
   database, implement the smallest correct repair, and repeat the same route
   and scenario.
5. Preserve useful evidence from the browser runner (screenshots, traces, and
   reports) when a failure occurs. State exactly what was actually run; never
   describe a flow as visually or end-to-end verified if the agent did not open
   it.

Use the repo's `browser-qa` and `testing-release-readiness` skills for this
loop. The normal target is QA/preview. Production browser activity is
read-only; no financial or other mutating journey may run there.

## When to stop and ask

Stop only when the remaining work requires a genuine owner/accounting/legal decision or an explicitly unauthorized production mutation. Ordinary implementation choices are not blockers.

## When you finish

Report:
- what changed and why,
- tests/checks run,
- risks or blocked decisions,
- affected Rule IDs (from the traceability matrix),
- and update the relevant canonical status only when the code evidence justifies it.

**Never declare a module complete** from a component test or merged PR alone. A module is complete only when the applicable chain is evidenced: UI → Service/RPC → Database → RLS/Permissions → Audit → Tests → QA evidence.

**Do not create parallel source-of-truth documents.** If your change requires a new document, update the Canonical Pack instead.
