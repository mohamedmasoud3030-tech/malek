# Rentrix — Current Project Status

> Last updated: 2026-07-23 (Asia/Muscat)
> Repository: `mohamedmasoud3030-tech/rentrixxx`
> Production project ref: `nnggcnpcuomwfuupupwg`

## Repository state

- All previously open PRs have been merged: #1233, #1269, and #1271.
- Open PR count: **0**.
- Current `main` includes the migration replay and pagination fixes.
- Latest documented application checks are green for build, typecheck, lint, tests, deploy, and report status.

## Current verification status

### Passing

- TypeScript typecheck
- Lint
- Production build
- Application test suite
- Financial test suite
- GitHub Pages deploy
- Report build status

### Still blocked

#### Supabase Preview

The isolated replay has reached a real data-contract preflight in
`20260723100000_enforce_payment_receipt_shared_identity.sql`:

```text
1 existing payment row has id <> receipt_id or no receipt_id
```

This migration intentionally stops rather than changing historical financial
identifiers automatically. The row must be inspected and repaired through an
approved, transactionally guarded process before the identity constraint is
applied. Do not bypass the preflight or delete the row.

The live migration ledger was inspected read-only. The known remote-only
ledger version `20260721234207` is represented locally by the no-op reconciliation
marker migration with the same version.

#### SonarCloud

The project’s Automatic Analysis currently ignores repository-level Sonar
scope settings. The latest quality gate reports:

- New-code duplication: `14.1%` (required `≤ 3%`)
- New-code security rating: `C` (required `A`)

Resolve this in SonarCloud project administration by either configuring the
Analysis Scope exclusions in the UI or switching from Automatic Analysis to a
CI-based scan that honors `sonar-project.properties`.

## Release decision

**NO-GO for a fully verified production release.** The application checks are
healthy, but the Supabase financial identity preflight and SonarCloud quality
gate remain unresolved. No production DDL, DML, migration repair, ledger
mutation, or QA cleanup should be performed until the payment mismatch has an
approved repair plan and backup/restore evidence is available.

## Security note

Credentials must never be committed to the repository or pasted into issue,
PR, or documentation content. Any credential shared during troubleshooting
must be revoked and replaced immediately.
