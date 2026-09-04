---
name: review
description: Use before a MALEK PR or merge, or whenever reviewing a diff, branch, or implementation. Selects review lenses from the actual risk, separates review from fixes, deduplicates findings, and reports evidence-backed severity and confidence.
---

# Review

Review the change that exists, not the change the author intended. Default mode is report-only; do not mutate the branch unless the user explicitly asks to apply findings.

## Sequence

1. Identify base/head and read the complete diff, including deletions, migrations, tests, configuration and docs.
2. Read governing MALEK rules for touched behavior.
3. Classify risk and select only relevant review lenses.
4. Run independent lenses in parallel when safely supported; otherwise keep them logically separate in serial review.
5. Merge and deduplicate findings.
6. Separate introduced problems from unrelated pre-existing debt.
7. Report only findings with concrete evidence and plausible failure mode.

## Lenses

- security/auth: permissions, trust boundaries, public/anonymous access, tenant isolation;
- database: migrations, RLS, grants, RPCs, locking, indexing, drift;
- accounting/finance: posting authority, append-only history, atomicity, reconciliation, OMR precision;
- API/data contracts: compatibility, validation, generated types, consumer drift;
- frontend/journey: state, navigation, accessibility, responsive behavior, failure/empty states;
- reliability/performance: concurrency, retries, idempotency, fan-out, unbounded reads;
- governance/docs: Rule/Gap traceability and false completion claims.

Auth, tenant, anonymous/public and sensitive financial changes require an explicit threat-model pass.

## Finding contract

Each finding includes severity `P0`–`P3`, high/medium confidence, exact evidence, failure mode, smallest reasonable correction and ownership when not purely code.

Do not inflate severity or report taste as a defect. A clean review means no concrete findings in the inspected diff; it does not mean unrun tests or production behavior are green.

Read `references/reviewer-matrix.md`.
