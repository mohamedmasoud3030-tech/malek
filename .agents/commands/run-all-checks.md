# Command: /run-all-checks

Run the full verification gate (same as /verify-feature but for the entire codebase)
and report a PASS/FAIL table. Do NOT fix anything; only report.

## Commands

Run in this order:
1. `pnpm install --frozen-lockfile`
2. `pnpm supabase:migration-evidence`
3. `pnpm typecheck`
4. `pnpm --filter ./rentrix-app test`
5. `pnpm --filter ./rentrix-app run test:financials`
6. `pnpm build`
7. `pnpm e2e` (if E2E_* env vars are present; otherwise report "skipped: no staging credentials")

## Output format

```
| Gate                           | Result  | Time | Notes |
|--------------------------------|---------|------|-------|
| install                        | PASS    | …s   |       |
| migration-evidence             | PASS    | …s   |       |
| typecheck                      | PASS    | …s   |       |
| unit tests                     | PASS    | …s   | N tests |
| financial tests                | PASS    | …s   | N tests |
| build                          | PASS    | …s   | dist/  |
| e2e (authenticated staging)    | SKIPPED | —    | E2E_STAGING_* missing |
```

If a gate fails, capture the first 50 lines of the error and point to the
suspected file/line. Do not attempt to fix; report and stop.
