# Decision records

This directory holds short architecture/decision records (ADRs) for choices
made in this repository that are worth remembering — the kind of thing a
future agent or developer would otherwise have to re-derive or,
worse, accidentally reverse.

## When to write one

Write a decision record when:

- You chose between two or more real alternatives for a non-trivial
  design/schema/API question, and the reasoning isn't obvious from the code
  alone (e.g. the pending voidReceipt Option A vs. Option B choice described
  in `docs/CURRENT_STATE.md` — whichever option is picked should get a
  record here once it's decided).
- A past approach was deliberately rejected, and someone re-proposing it
  later would waste time re-discovering why (e.g. rewriting the migration
  ledger's historical duplicate entries — rejected as high-risk for no
  schema benefit, per `docs/CURRENT_STATE.md`).
- The product owner made an explicit call on scope or risk that isn't
  self-evident from the diff (e.g. the decision to drop 9 orphaned enum
  types after confirming zero usage, rather than leave them).

Do **not** write one for:

- Routine bug fixes, refactors, or anything whose reasoning is fully
  captured by the code/tests/commit message.
- Anything already covered by `docs/GOVERNANCE.md` (the production-mutation
  sign-off rule) or `docs/GOVERNANCE_LOG.md` (the append-only mutation log)
  — those have their own place and shouldn't be duplicated here as ADRs.
- Routine documentation updates.

## Format

One file per decision: `docs/decisions/NNNN-short-title.md`, numbered
sequentially (`0001-`, `0002-`, ...). Each file has exactly these sections:

```markdown
# NNNN. Short title

## Context
What situation forced this decision? What was actually observed
(code/schema/live behavior), not a hypothetical.

## Decision
What was chosen, stated plainly in one or two sentences.

## Alternatives rejected
What else was considered, and why it was rejected. If there was only one
realistic option, say so instead of inventing alternatives to fill this
section.

## Consequences
What this makes easier, harder, or riskier going forward. Include any
follow-up work this decision creates.

## Evidence
Concrete pointers: file paths, migration filenames, PR numbers, or the
specific live query that informed this decision. A decision record without
evidence pointers is not useful to a future agent — it's just an opinion.
```

## Rules

- **Do not invent decision records from inference.** A record here
  describes a decision that was actually made and can be evidenced — either
  by an existing artifact (a PR, a migration, an explicit product-owner
  instruction) or by one being made as part of the current task with the
  product owner's input. Do not write a record for what you think the
  original author "must have" decided.
- **Do not backfill a full decision history retroactively.** If no record
  exists for a past choice, that's fine — start writing them from here
  forward rather than trying to reconstruct history you can't evidence.
- **Keep them short.** A decision record is a paragraph or two per section,
  not a design document. If a decision needs a design document, write that
  separately and link to it from the `Evidence` section.
- **Superseding a decision**: don't delete the old file. Add a one-line note
  at the top ("Superseded by 000N — see that file") and leave the rest
  intact as a historical record.

## Index

| #    | Title                                                                                                       | Date       | Status   |
| ---- | ----------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 0001 | [Product accounting policies for owner fees and rental revenue](./0001-product-accounting-policies.md)      | 2026-07-11 | Accepted |
| 0002 | [Staging live verification and release evidence](./0002-staging-live-verification-and-release-evidence.md)  | 2026-07-14 | Accepted |
| 0003 | [Company-scoped account resolution](./0003-company-scoped-account-resolution.md)                            | 2026-07-15 | Accepted |
| 0003 | [Financial security, UX, reporting, and reconciliation scope](./0003-financial-security-ux-reporting-and-reconciliation-scope.md) | 2026-07-15 | Accepted |
| 0004 | [Proration and billing basis](./0004-proration-and-billing-basis.md)                                       | 2026-07-17 | Accepted |
| 0005 | [Account resolution: payment-receipt-void](./0005-account-resolution-payment-receipt-void.md)               | 2026-07-21 | Accepted |
| 0006 | [Owner settlement account resolution and request binding](./0006-owner-settlement-account-resolution-and-request-binding.md) | 2026-07-24 | Accepted |
| 0008 | [UX separation of /financials and /reports](./0008-financial-routes-ux-clarity.md)                         | 2026-07-31 | Accepted |

Oldest first. Numbering must stay monotonic — the next record takes
`0009-` even if a prior slot in the table is empty.
