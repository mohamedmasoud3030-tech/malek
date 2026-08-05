# MALIK Testing Strategy — Evidence Levels (2026-08-05)

**Baseline:** `main@f8e5556315b2ad2e76cfdd2a84431438e0932543`

## Why this document changed

The previous draft described planned or partial practices as fully implemented guarantees, used stale suite/migration counts, and presented illustrative test code as if it were active coverage. This version separates actual evidence levels.

## Evidence hierarchy

1. **Pure/unit behavior tests** — strongest for deterministic TypeScript business rules.
2. **Component behavior tests** — prove rendered interaction contracts under the tested DOM environment.
3. **PGlite/isolated replay tests** — prove supported SQL behavior within the project’s replay harness; they do not automatically prove every PostgreSQL/Supabase production behavior.
4. **pgTAP/live staging tests** — prove behavior on the database actually executed by that run.
5. **Production read-only verification** — proves the observed production state at a timestamp; it is not permanent.
6. **Static migration contract tests** — prove text/pattern presence only. They do not prove runtime semantics.

## Current verified strengths

- Large Vitest suite covering application utilities, services, components, and architecture contracts.
- Isolated database replay and company-isolation regression suites exist for critical areas.
- Canonical Stage 3 ledger has dedicated migration and behavioral coverage.
- Parser behavior tests exist for bank CSV formats.
- CI gates type checking, linting, architecture, builds, documentation, and multiple test groups.

Counts change frequently. Commit messages may record snapshots such as `307 files / 1778 tests`; do not copy those numbers into a permanent guarantee without rerunning the relevant command on the target SHA.

## Current verified gaps

### Bank CSV import RPC

`bank-csv-import-migration-contract.test.ts` inspects SQL text. `bankCsvImportService.test.ts` mocks Supabase. Neither executes `import_bank_statement_batch_atomic` against a database. Required behavioral cases:

- rejected source rows block the entire import;
- actual inserted line count equals `accepted_rows`;
- one failed line rolls back the batch;
- blank-description fingerprint is identical in every pass;
- same fingerprint on another bank account raises an explicit mismatch;
- server limits reject oversized row counts and invalid fingerprint shapes;
- OMR balance preserves three decimals;
- Company A cannot read/write Company B imports or lines.

### Coverage reporting

`sonar.coverage.exclusions` includes `**/*.ts` and `**/*.tsx`, so Sonar coverage cannot be described as authoritative application coverage. Fix configuration, generate LCOV on CI, then publish a baseline.

### Browser coverage

Component tests do not prove all 320/390/430 pixel browser behavior or navigation side effects. Critical mobile flows need Playwright/browser execution on the target SHA.

### Production parity

PGlite cannot replace a real Supabase/PostgreSQL staging run for extension behavior, grants, RLS, planner behavior, or environment drift. Production clone/rehearsal automation remains a desired capability, not a current universal guarantee.

## Required gates for financial write paths

Every new financial or contract-to-accounting boundary must include:

- a pure business-rule test where possible;
- a behavioral database test using the active function signature;
- company A/B isolation coverage;
- idempotent retry and conflict coverage;
- rollback-on-partial-failure coverage;
- precision tests at OMR 0.001;
- a migration rollback/hygiene check;
- documentation that states only what the tests actually execute.

## Documentation rule

Examples are marked as examples. A test is “implemented” only when the repository contains it and CI executes it on the referenced SHA. Green CI does not validate untested prose claims.
