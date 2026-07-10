# Release Readiness

## Current readiness status

The repository is **not yet release-ready for financial workflows**. The current PR narrows one critical consistency gap by aligning `rpt_daily_collection` with the payment-backed receipt source of truth and by excluding VOID payments from collection totals.

## Verified in this PR

- The Receipts UI remains payment-backed.
- Financial report helpers now defensively exclude payments where `status = 'VOID'`, even if a historical row is not soft-deleted.
- A new migration defines `rpt_daily_collection` on `public.payments` rather than `public.receipts`, but the current frontend still reads payments directly and does not call this RPC.
- Contract tests assert the reporting RPC source and VOID/deleted exclusion rules.

## Not verified in this PR

- No production migration was applied.
- No browser/E2E run was completed.
- No live Supabase data was modified.
- Owner/tenant statement pages and accounting-statement screens remain incomplete.
- Contract lifecycle hardening and owner settlement engine work remain follow-up items.

## Release gate before financial launch

1. Apply pending migrations in a staging environment first.
2. Verify invoice → payment → receipt → void receipt → invoice balance → collection report in the browser.
3. Run the full command set in `docs/TESTING.md`.
4. Confirm role permissions for ADMIN, MANAGER, and USER on financial routes.
5. Record production verification evidence in `docs/CURRENT_STATE.md` after approved deployment.

## 2026-07-10 production sweep update

### Fresh audit scope

Performed a repository/code-first sweep of `rentrix-app/src` after PR #1100, #1101, and #1102 were assumed merged into the baseline. The sweep checked route inventory, destructive actions, forms, currency/date formatter usage, loading/empty/error states, mobile/RTL table/dialog surfaces, search/filter forms, report pages, financial calculations, and targeted code-smell searches for `TODO`, `FIXME`, `HACK`, `XXX`, `console.log`, `debugger`, `any`, `@ts-ignore`, unvalidated forms, and destructive actions without confirmation.

### Ranked remaining production issues

| Priority | Issue | Severity | User impact | Production risk | Effort | Recommended priority |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Bank reconciliation “ignore” action changed statement-line status immediately from the table/mobile card without a confirmation step. | High | Operators can accidentally remove an unmatched bank movement from the active reconciliation queue. | Financial operations may miss or delay reconciliation of a real bank movement until someone reviews ignored lines. | Small | Fixed in the 2026-07-10 PR. |
| 2 | Bank reconciliation import/manual/match forms still rely on inline state plus service-side validation rather than a shared form schema/resolver. | Medium | Users receive errors late and field-level guidance is limited. | Invalid operational inputs are blocked by service checks, but UX is weaker and duplicate validation can drift. | Medium | Next small PR. |
| 3 | Several non-financial workflow forms (`commissions`, `communication`, `leads`, `lands`, owner detail quick form) use local draft state and submit handlers rather than shared schema-backed form patterns. | Medium | Inconsistent validation and submit feedback across operational screens. | Bad inputs are more likely to reach service/API boundaries or produce generic failures. | Medium | Work through one feature at a time. |
| 4 | Formatter usage is mostly centralized, but document generation and some feature-specific display helpers still use direct `toLocale*`/`Intl.NumberFormat` calls. | Medium | Users may see inconsistent date/currency formatting across app screens vs generated documents. | Financial documents may not match configured company locale/currency expectations. | Medium | Prioritize document output after bank reconciliation forms. |
| 5 | Test files contain `console.log` debugging output in governance tests. | Low | No end-user impact. | CI logs are noisy and can hide meaningful warnings. | Small | Cleanup-only if bundled with a test-readability PR; not a standalone production PR. |
| 6 | Live Supabase/read-only verification and seeded authenticated browser journeys remain evidence blockers. | High | Release managers cannot prove production/staging parity or authenticated workflow readiness from local tests alone. | Production readiness cannot be claimed with high confidence without operator evidence. | External/operator | Blocked on credentials/operator environment, not code-only. |

### Completed work

- Added a confirmation dialog before a bank statement line can be marked ignored, including the movement description and formatted amount so the operator can verify the target before changing reconciliation status.

### Remaining issues

- Schema-backed validation for bank reconciliation forms remains the recommended next code PR.
- Live Supabase readiness, seeded browser validation, and financial invoice/payment/receipt/void/report proof remain release evidence requirements.

### Blockers

- No approved read-only `SUPABASE_DB_URL` or seeded staging credentials were available in this environment, so live database readiness and authenticated E2E evidence still require operator follow-up.

### Estimated readiness

- Estimated production readiness: **86%**.
- Estimated confidence for the July 20 QA freeze: **medium-high (about 75%)** if the next PRs stay focused on bank reconciliation validation, formatter consistency for generated financial documents, and release evidence collection.

### Recommended next PR

- Add schema-backed validation and field-level errors to the bank reconciliation import/manual-line/match forms without changing database contracts or reconciliation accounting behavior.
