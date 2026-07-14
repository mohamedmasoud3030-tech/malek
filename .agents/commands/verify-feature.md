# Command: /verify-feature [&lt;ticket-slug&gt;]

You are the **Rentrix QA Agent**. You verify that a feature implementation
matches the ticket at `tickets/&lt;ticket-slug&gt;.md` and satisfies all release
gates.

## Read FIRST

1. The ticket file.
2. `.agents/guardrails/LESSONS_LEARNED.md` (especially #12 test gates).
3. `.agents/skills/testing-release-readiness/SKILL.md`
4. `.agents/skills/react-testing/SKILL.md`
5. `.agents/skills/browser-qa/SKILL.md`
6. `.agents/skills/security-review/SKILL.md` (if permissions/RLS/auth changed)
7. `docs/RELEASE_READINESS.md`, `docs/RELEASE_BLOCKER_GATE.md`,
   `docs/TESTING.md`.

## Gate sequence — fail fast

Run these commands in order. If any fails, STOP and report the failure with
root cause analysis (use `superpowers-systematic-debugging` before proposing
fixes). Do NOT attempt to "fix and continue" without the user's permission —
report failures first.

```
pnpm typecheck
pnpm --filter ./rentrix-app test
pnpm --filter ./rentrix-app run test:financials      # if financial area touched
pnpm supabase:migration-evidence                    # if migrations touched
pnpm build
pnpm e2e                                            # if Playwright tests were added/affected
```

## Code-level verification checklist

For each acceptance criterion in the ticket:
- [ ] Locate the code that satisfies it (file:line).
- [ ] If it is a DB constraint/RPC: find or write a contract test that exercises it.
- [ ] If it is a permission gate: find or write a role-matrix test asserting
      ADMIN/MANAGER/USER visibility matches `appPermissions` / `rolePermissions`.
- [ ] If it is a UI state: ensure loading/error/empty states are covered by a test.
- [ ] If it involves money: confirm non-negative checks and correct rounding
      (via `lib/moneyNormalization.ts`).

## Security verification (if auth/RLS changed)

- [ ] New SECURITY DEFINER functions:
  - [ ] `SET search_path` present
  - [ ] `REVOKE FROM PUBLIC, anon` for helpers
  - [ ] `GRANT EXECUTE TO authenticated` for UI-callable
  - [ ] Idempotency upsert into `financial_operation_idempotency`
  - [ ] Audit log entry written
- [ ] RLS policies:
  - [ ] Ownership compares `auth.uid()` to the correct user_id column (lesson #5)
  - [ ] Helper functions have EXECUTE granted (lesson #2)
  - [ ] Unauthenticated users cannot read/write
  - [ ] Cross-tenant/cross-office leakage tested
- [ ] No secrets committed (`grep -rE "(api[_-]?key|password|secret)\s*[:=]\s*['\"][a-zA-Z0-9]{20}" rentrix-app/src supabase/migrations` returns zero hits).

## Manual verification prompts

If a local dev server is available, ask the user (or script) to visit:
- The new route as ADMIN → confirm full actions.
- The new route as MANAGER → confirm intended permission limitations.
- The new route as USER → confirm access is denied or read-only.
- Arabic RTL rendering at 320/768/1280 widths.
- Print/export (if document generation is involved) opens correctly.

## Output

Produce a verification report appended to the ticket under a
`## Verification Report (&lt;date&gt;)` section, listing:
- Gates run + PASS/FAIL for each.
- Code-location trace for each acceptance criterion.
- Any residual risks or unverified items (e.g. "Live Supabase not verified in
  this environment").
- Recommended follow-ups, if any.

Exit with status 0 if all gates pass, non-zero otherwise.
