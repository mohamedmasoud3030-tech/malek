# MALEK Visual Wave 2 — Post-Merge Review

Date: 2026-08-06
Reviewed PR: #1358
Review base: `main` at `c503d32d58dde7e084b3227a7f7b14c51386ddbf`
Correction branch: `fix/ui-malek-wave-2-review-corrections`

## Verified repository truth

- PR #1358 is merged.
- PR head recorded by GitHub at merge time: `ab9ee1fdcf5d27a3be0b474396fc18efd1889012`.
- Merge commit: `b35d90c480dbd6bfb22b60e31724cb7cca09a871`.
- The reported final branch commit `af8ab0f1a0993acbe64309e3ccc88f60e1979abe` was not the PR head that GitHub merged.
- `main` subsequently advanced to `c503d32d58dde7e084b3227a7f7b14c51386ddbf` through PR #1359.
- PR #1359 did not directly modify the Wave 2 finance/reporting feature files, but it did modify shared layout and visual-wave CSS, so post-merge regression verification remains required.
- PR #1358 has no open review threads.

## Defects found and corrected

### Duplicate status indicator

`FinanceStatusBadge` passed `dot={true}` to `StatusBadge` and also supplied a custom `data-finance-status-icon` child. This produced two visual dots for one status.

Correction:

- `StatusBadge` now detects a supplied custom status indicator and does not render a second default dot.
- The default dot is explicitly `aria-hidden`.

### Ineffective tests

The Wave 2 status test suite contained a test that rendered the component but made no assertion. Other tests only checked for the custom icon and did not detect the duplicate default dot.

Correction:

- Removed the no-op test.
- Added assertions for semantic tone, visible label, exactly one indicator, and `withDot={false}` behavior.
- Removed unused `vi` import and avoided `any` in the filter assertion.

## Scope safety

These corrections change presentation and tests only. They do not modify:

- financial calculations,
- accounting rules,
- migrations,
- RLS/RPC/grants,
- persistence,
- business-state transitions.

## Required gates

The correction PR must pass typecheck, Wave 2 tests, financial tests, architecture checks, build, business-rules checks, and repository release gates before merge.
