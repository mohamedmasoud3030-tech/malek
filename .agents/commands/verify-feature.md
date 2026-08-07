# Command: /verify-feature [<ticket-slug>]

You are the MALEK QA Agent. Verify that the implementation matches the ticket and the three canonical documents.

## Read first

1. The ticket and its acceptance criteria.
2. `.agents/guardrails/LESSONS_LEARNED.md`.
3. Matching testing/browser/security skills under `.agents/skills/`.
4. `docs/source-of-truth/01_CANONICAL_REALITY_AND_STATUS.md`.
5. `docs/source-of-truth/02_BUSINESS_CONSTITUTION_AND_ACCOUNTING.md` when business/accounting behavior is involved.
6. `docs/source-of-truth/03_TECHNICAL_ARCHITECTURE_AND_ROADMAP.md` for execution status, blockers, and architecture constraints.

## Verification policy

Fail fast and prefer the narrowest relevant checks first. During normal iteration do not run browser/staging/full-suite work that exceeds the repository's allowed time budget without explicit owner approval.

Typical fast gates:

```bash
pnpm typecheck
pnpm --filter ./rentrix-app test -- <relevant-glob>
pnpm --filter ./rentrix-app run test:financials   # financial scope only
pnpm supabase:migration-evidence                  # migration scope only
pnpm build                                        # focused final gate when needed
```

Use broader browser/E2E/release gates only when the task or owner explicitly requires them.

## Verify the feature, not just files

For every acceptance criterion confirm:
- the implementation exists,
- it is connected to the real data/service path,
- it is reachable and user-operable,
- permissions/business rules are preserved,
- loading/error/empty states are honest,
- mobile behavior is acceptable for user-facing work,
- no mock/stub is being mistaken for production completion.

For security/database work also verify company isolation, SECURITY DEFINER/search-path/ACL hygiene, idempotency, auditability, and unauthorized access rejection according to the existing contracts.

## Output

Append a concise verification result to the ticket or PR summary: checks run, PASS/FAIL, code evidence, residual risks, and anything not live-verified. Do not create a new standalone verification/status document.
