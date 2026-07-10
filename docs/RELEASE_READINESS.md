# Release Readiness

This document separates code readiness from production evidence and external release blockers. Do not use readiness percentages as a release signal; a release recommendation must be based on objective evidence for the exact release candidate.

## Code readiness

- Core app build, typecheck, unit tests, and focused financial tests are available through the commands in `docs/TESTING.md`.
- Financial receipt/report correctness has local contract and unit coverage, but the payment → receipt → void → report flow still needs authenticated browser and live/staging evidence before release sign-off.
- Bank reconciliation now requires confirmation before ignoring a statement line and normalizes/validates manual line and match payloads before writes.

## Production evidence

### Completed

- Local code-level financial tests cover bank reconciliation helpers, receipt services, report services, financial math, and migration-contract expectations.
- Local build/typecheck/test commands can be run without production credentials.

### Missing

- Authenticated browser verification for critical workflows.
- Role/permission verification with real seeded users.
- Staging invoice lifecycle evidence.
- Staging payment lifecycle evidence.
- Staging receipt lifecycle evidence.
- Staging void receipt lifecycle evidence.
- Staging bank reconciliation evidence.
- Staging reports evidence.
- Printing/PDF/export evidence on the release candidate.
- Arabic RTL, mobile, desktop, and responsive layout evidence on real browser runs.
- Currency and timezone/date formatting evidence using configured company settings.
- Error/loading/empty-state evidence for critical pages.
- Live Supabase read-only evidence for migration ledger, RPC definitions, RLS policies, and grants.

## Release blockers

- Seeded staging credentials and/or an approved authenticated browser environment are still required for production evidence.
- Approved read-only Supabase access is still required for live/staging schema, RPC, RLS, and grant evidence.
- Production data mutations remain out of scope unless specifically approved through the governance process.

## Fresh production audit — 2026-07-10

### Audit scope

Performed a code-first sweep of `rentrix-app/src` after PR #1100, #1101, #1102, and the bank reconciliation confirmation PR were treated as merged baseline. The sweep checked route coverage, destructive actions, forms, formatter usage, loading/empty/error states, mobile/RTL table and dialog surfaces, search/filter forms, report pages, financial calculations, and targeted searches for `TODO`, `FIXME`, `HACK`, `XXX`, `console.log`, `debugger`, `any`, `@ts-ignore`, unvalidated forms, and destructive actions without confirmation.

### Category A — Must fix before July 20 QA

| Issue | Impact | User risk | Production risk | Implementation effort | Release blocker |
| --- | --- | --- | --- | --- | --- |
| Bank reconciliation manual-line and match submissions had incomplete service-level normalization/validation for malformed dates, blank identifiers, whitespace-only values, and zero/non-finite amounts. | Prevents invalid reconciliation rows and invalid match records from being submitted to Supabase. | Operators could submit malformed operational finance data and receive late or inconsistent failures. | Invalid or ambiguous bank reconciliation records can undermine financial close and audit review. | Small | No — fixed in this PR with tested payload builders. |

### Category B — Should fix before release

| Issue | Impact | User risk | Production risk | Implementation effort | Release blocker |
| --- | --- | --- | --- | --- | --- |
| Bank reconciliation forms still use local state instead of field-level schema resolver UI. | Users get less precise inline guidance than schema-backed forms. | More correction cycles for operators. | Service validation protects writes, so remaining risk is UX and support friction. | Medium | No |
| Generated document formatting still has direct date/money formatting helpers separate from company formatters. | App screens and generated documents can display date/currency values differently. | Users may distrust documents if formatting differs from the UI. | Financial document presentation inconsistency can create review friction. | Medium | No, if values are numerically correct and release QA covers generated documents. |
| Authenticated browser evidence is missing for critical financial and operational workflows. | Release managers lack objective proof of complete user journeys. | Bugs can escape local unit/component coverage. | Critical workflow regressions may be missed until QA/staging. | External/operator plus test work | Yes for release, not a code-only blocker. |
| Live Supabase read-only evidence is missing for migration ledger, RPCs, RLS, and grants. | Release managers cannot prove deployed backend contracts match the code. | Role or RPC drift can surprise users in staging/production. | Backend contract drift can break financial workflows even when local tests pass. | External/operator | Yes for release, not a code-only blocker. |

### Category C — Safe to postpone after v1.0

| Issue | Impact | User risk | Production risk | Implementation effort | Release blocker |
| --- | --- | --- | --- | --- | --- |
| Debug `console.log` calls remain in governance tests. | CI output noise only. | No end-user risk. | Could hide meaningful warnings in test logs, but does not affect production runtime. | Small | No |
| Non-financial draft-state forms in commissions, communication, leads, lands, and owner detail quick forms are not all schema-backed. | Inconsistent validation ergonomics across lower-risk operational screens. | Users may see generic errors on these screens. | Lower than financial workflows because they do not directly alter accounting totals. | Medium per feature | No |
| Design and consistency cleanups that do not change validation, correctness, accessibility, performance, or safety. | Cosmetic polish. | Minimal. | Minimal. | Variable | No |

## Manual QA checklist

- Authenticated login/logout and protected-route redirects.
- Role permissions for ADMIN, MANAGER, and USER, including denied financial actions.
- Invoice create/view/update status lifecycle.
- Payment recording and invoice balance update.
- Receipt creation, listing, printing, and PDF generation.
- Void receipt flow and report total reconciliation.
- Bank reconciliation import/manual line/match/ignore flows.
- Reports: collections, overdue, expenses, occupancy, owner statements, tenant statements, and VAT summaries.
- CSV exports and generated document downloads.
- Arabic RTL layout across dashboard, list pages, forms, dialogs, bottom sheets, and reports.
- Mobile, tablet, and desktop responsive behavior.
- Currency formatting using configured company currency and decimals.
- Timezone/date formatting using configured company timezone/date settings.
- Loading, empty, and error states for critical routes.

## Staging verification checklist

- Run the full command suite from `docs/TESTING.md` for the exact release candidate.
- Run authenticated browser smoke tests against seeded staging credentials.
- Capture screenshots or traces for critical workflows and responsive breakpoints.
- Run read-only Supabase readiness checks against the intended staging/live project.
- Archive RPC definitions, RLS policy/grant checks, migration ledger status, and denied-action evidence.
- Record workflow identifiers used during invoice/payment/receipt/void/report verification.

## Go / No-Go recommendation

**No-Go until production evidence is complete.** The codebase can continue through focused Category A fixes, but release sign-off requires objective staging/browser/live-readiness evidence for critical financial workflows, permissions, formatting, and responsive RTL behavior.
