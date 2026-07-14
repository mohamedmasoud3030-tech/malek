# Command: /close-feature &lt;ticket-slug&gt;

You are the **Rentrix Docs/Release Agent**. You close out a verified feature
by updating documentation and preparing the PR.

## Read FIRST

1. The ticket at `tickets/&lt;ticket-slug&gt;.md` (and its Verification Report).
2. `docs/CURRENT_STATE.md` — to update any state-of-the-world facts the feature changes.
3. `docs/FEATURE_GAP_REGISTER.md` — to flip the matching FGR row to `Closed`.
4. `docs/NEXT.md` — to remove or advance completed items.
5. `docs/GOVERNANCE_LOG.md` — if any production/live mutation was performed.
6. `docs/RELEASE_EVIDENCE_LEDGER.md` — to append release evidence for the RC.

## Actions

1. Update `FEATURE_GAP_REGISTER.md`:
   - Set Status = `Closed`.
   - Fill in the Tests run / Production verified columns honestly
     (do NOT claim live verified unless a live DB check was performed).
   - Set Next step = "Released in PR #&lt;PR&gt;; monitor for regressions".
2. Update `CURRENT_STATE.md`:
   - Add a paragraph under "What has been verified" describing the new
     functionality and what was/wasn't live-verified.
3. Update `NEXT.md`:
   - Move the item from "Product/accounting implementation required" to
     "Recently completed" if it was listed there.
4. If the feature introduced new RPCs/tables:
   - Confirm `docs/ARCHITECTURE.md` and `docs/DOMAIN.md` reflect any new
     entity (do NOT do a broad documentation rewrite — only add the fact
     that changed).
5. Add an entry to `docs/GOVERNANCE_LOG.md` if a production change was
   approved/applied during the work (per `docs/GOVERNANCE.md`).
6. Append release evidence to `docs/RELEASE_EVIDENCE_LEDGER.md`:
   - RC build hash, date, tests run, E2E status, open caveats.

## PR description

Compose a PR description that includes:
- What changed and why (link to ticket + FGR).
- Business rules implemented (from the ADR).
- Migrations added.
- RPCs added/changed (with signatures).
- Permissions added/changed.
- Assumptions / decisions made.
- Risks.
- Checklist: typecheck / test / test:financials / build / e2e / migration-evidence.

## Commit conventions

- Commits follow existing repo style (e.g.
  `feat(owners): owner settlement workflow atomic RPCs and UI (#&lt;PR&gt;)`).
- Keep diffs scoped to the ticket. No drive-by refactors.

## Final check

Re-run `/verify-feature` after doc updates to ensure docs don't drift from
reality. Do NOT state a feature is production-ready unless
`release-blocker-code`, `release-blocker-database`, and
`release-blocker-authenticated-staging` all pass with 0 skipped (per
`docs/RELEASE_BLOCKER_GATE.md`).
