# Release Readiness

> Reconciled: 2026-07-27 (Asia/Muscat)
>
> Current authority: [`APP_STATUS.md`](APP_STATUS.md). Evidence checklist: [`RELEASE_EVIDENCE_LEDGER.md`](RELEASE_EVIDENCE_LEDGER.md).

## Decision

**GO for a controlled single-office Pilot. HOLD before issuing real user accounts until the two account-security actions below are complete.**

This is not a claim of universal or multi-office production completeness. The Pilot scope is the existing company, one ADMIN operator initially, Arabic RTL, and the daily property/contract/invoice/payment/receipt/expense/maintenance/reporting workflow documented in [`SINGLE_OFFICE_LAUNCH.md`](SINGLE_OFFICE_LAUNCH.md).

## Verified release baseline

- Production alias: `https://rentrixapp.vercel.app`
- Current `main`: `44ec873d`
- CI candidate evidence head: `07cd112e` (squash-merged to the `main` commit above)
- CI run `30224710133`: typecheck, lint/typecheck alias, architecture, build, full tests, financial tests — passed
- Browser Readiness run `30224710110`: 243 passed, 204 intentional skips, 0 failed across desktop/tablet/mobile
- Release Blocker run `30224710108`: code gate, isolated Supabase lifecycle, authenticated single-office journey, and Production authenticated read-only checks — passed
- Desktop RTL sidebar blocker: fixed by PR #1292 and included in Production
- Latin `0–9` UI consistency: completed by PR #1298 and included in Production
- Production read-only state: one company; accounts `1111`, `1201`, `2000`, `2100`, `4000` each present once; latest ledger migration `20260730090500`
- Isolated financial proof: invoice → payment → receipt → VOID, balanced reversal, and idempotent retry behavior

No mutating financial acceptance journey was run against Production.

## Operational HOLD before real accounts

1. Enable Supabase Auth **Leaked Password Protection**. The Security Advisor still reports it disabled.
2. Change the test-account password that appeared in the testing conversation and revoke its previous sessions.

These are account operations, not missing application code. Do not place passwords in issues, chat, logs, screenshots, or release artifacts.

## Pilot-day sign-off

- Confirm the Production backup/rollback posture before any future migration.
- Run a non-destructive operator pass on a real desktop and phone: login, navigation, Arabic/RTL, keyboard/focus, PDF/export/print, role visibility.
- Start with one ADMIN. Add MANAGER and USER only after checking their visible navigation and denied actions.
- Supervise the first deposit and owner settlement; keep bank reconciliation, multi-office setup, and advanced automation outside the first-week default workflow.
- Review `/audit-log` and `/data-integrity` at the end of each Pilot day.

## Tracked, non-blocking follow-up

- PR #1297 remains Draft for the `audit_journal_entry_insert` fixed `search_path` reconciliation. It must follow its own migration approval and rollback process.
- Supabase Advisor warnings for expected SECURITY DEFINER functions require ongoing review, but no new Production mutation is authorized by this document.
- Advanced accounting parity, bank import/matching, full USER/MANAGER denied-action browser evidence, multi-office account uniqueness, and deferred-revenue reporting remain post-Pilot scope in [`FEATURE_GAP_REGISTER.md`](FEATURE_GAP_REGISTER.md).

## Release rule

Ship only an exact commit whose CI, browser, database lifecycle, and Production read-only evidence are all green. Any schema change needs a separate migration review, reversible plan, explicit Production approval, and a fresh evidence ledger entry.
