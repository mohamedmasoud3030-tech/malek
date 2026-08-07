# S08 Operational Runbook — Read-only Historical Analysis

## Current review status

PR #1366 is **not ready for independent review** in its current form.

The initial implementation generated deterministic demo/test fixtures and committed those outputs as if they represented historical findings. The database objects in the initial migration also used `WHERE FALSE` stubs, so they did not execute the required live historical analysis.

## Required completion criteria

Before S08 may be marked ready:

- Replace demo findings in the production execution path with real company- and period-scoped queries.
- Replace `WHERE FALSE` analysis stubs with real read-only views/functions, or remove unnecessary database objects.
- Read currency from the actual company configuration; do not assume EGP or fixed precision.
- Treat empty live tables as valid observable zero-row/zero-finding results.
- Keep fixture evidence explicitly labelled `TEST_FIXTURE` and separate from live/staging validation.
- Prove no financial mutation with canonical before/after snapshots around execution of the real analysis engine.
- Run integration tests against seeded database rows using the same queries used by the analysis engine.
- Keep live sensitive results outside Git; commit only sanitized counts, metadata and checksums.

## Status vocabulary

Use these classifications explicitly:

- `OBSERVABLE_ZERO_ROWS`
- `OBSERVABLE_ZERO_FINDINGS`
- `NOT_OBSERVABLE_SCHEMA_GAP`
- `INSUFFICIENT_HISTORY`
- `LEGACY_GL_CONTEXT_ONLY`

## Safety boundary

`NO_FINANCIAL_DATA_MUTATION`

`S09_NOT_STARTED`

Do not mark `READY_FOR_INDEPENDENT_REVIEW` until all completion criteria above are satisfied and CI is green.
