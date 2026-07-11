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

**Update (2026-07-11):** The premise that no code-level blockers existed has been overturned. A first-ever live end-to-end financial cycle test (isolated `TEST-QA` rows on production) found that **3 of 4 newly-discovered issues were real, previously-undetected release blockers**, not just missing evidence:

- `create_contract_atomic` could never successfully create a contract in production (type-mismatch bug).
- No receipt could ever be successfully posted in production (owner-balance trigger bug).
- `post_receipt_atomic` was broken end-to-end via `receipt_allocations` (tenant-balance trigger bug).
- (The 4th finding, missing `EXECUTE` grants on role-check wrappers, was a permissions/access gap rather than a financial-correctness bug.)

All 4 are now fixed in production and committed as migrations (`20260711013008`–`20260711013339`). This means prior "financial workflows have no code-only blocker" conclusions in this document were based on workflows that had never actually been exercised end-to-end against live data. See `docs/NEXT.md` for full details and the still-open `tenant_balances` → `tenants` vs `people` FK question this test also surfaced. QA cycle (permission-boundary tests, void, report reconciliation) is still in progress as of this update.

## Release Captain audit — module verification pass

This pass treats feature development as frozen and only tracks production blockers and high-risk release issues. Each module was reviewed from the current codebase for CRUD surface, validation, mobile/RTL behavior, loading/empty/error state handling, confirmation dialogs, currency/date formatting, search/filter behavior, accessibility indicators, performance-sensitive query patterns, and permission boundaries where applicable.

| Module | Current release finding | Severity | Action |
| --- | --- | --- | --- |
| Dashboard | Uses service-backed snapshot data, loading skeletons, company money/date formatting, and responsive cards. Authenticated browser evidence is still missing. | MEDIUM | Manual/staging evidence required. |
| Properties | CRUD and archive confirmation are present with schema-backed forms and responsive list/detail UI. | LOW | No code action. |
| Lands | CRUD-like tracking and archive confirmation are present; numeric field validation is service-light but not release-blocking because it does not drive accounting totals directly. | MEDIUM | Post-QA or release-follow-up validation hardening. |
| Units | CRUD and archive confirmation are present with schema-backed forms and tests for list interactions. | LOW | No code action. |
| Owners | Owner workspace is service-backed with loading/error/empty handling; authenticated browser evidence remains missing. | MEDIUM | Manual/staging evidence required. |
| Tenants | Tenant workspace is service-backed with search, loading/error/empty handling, and responsive list behavior. | MEDIUM | Manual/staging evidence required. |
| Contracts | Contract lifecycle has schema validation, confirmations for destructive list/document operations, and tests; live/staging lifecycle evidence remains required. | MEDIUM | Manual/staging evidence required. |
| Invoices | Financial service/tests exist; invoice lifecycle still needs authenticated staging evidence. | MEDIUM | Manual/staging evidence required. |
| Payments | Payment service/tests exist; payment lifecycle still needs authenticated staging evidence. | MEDIUM | Manual/staging evidence required. |
| Receipts | Receipt service/tests and void-path contract checks exist; void receipt lifecycle still needs authenticated staging/live evidence. | MEDIUM | Manual/staging evidence required. |
| Expenses | Expense forms use schema-backed validation and company formatting; staging evidence remains missing. | MEDIUM | Manual/staging evidence required. |
| Bank Reconciliation | Ignore confirmation and service-level payload validation/normalization are present; staging evidence remains missing. | MEDIUM | Manual/staging evidence required. |
| Reports | Report services/tests exist; report totals still need staging reconciliation evidence against invoice/payment/receipt/void flows. | MEDIUM | Manual/staging evidence required. |
| Maintenance | Create/resolve workflow has schema validation and tests; browser evidence remains missing. | MEDIUM | Manual/staging evidence required. |
| Communication | Service-backed workflow has confirmation for archive and loading/error/empty states; validation hardening is lower priority than financial modules. | LOW | No pre-QA code action. |
| Leads | Service-backed workflow has archive confirmation and loading/error/empty states; budget validation hardening is not release-blocking. | LOW | No pre-QA code action. |
| Commissions | Financial-adjacent records previously accepted invalid/negative/NaN commission inputs. | HIGH | Fixed in this PR with positive finite amount/deal/percentage validation and regression tests. |
| Settings | Company settings and payment/cost center settings have tests; production evidence for configured currency/timezone behavior remains missing. | MEDIUM | Manual/staging evidence required. |
| AI Assistant | Route is isolated from financial writes; production readiness depends on configured integration and error handling evidence. | MEDIUM | Manual/staging evidence required. |
| Authentication | Login and route-guard tests exist; authenticated browser and role evidence remain missing. | MEDIUM | Manual/staging evidence required. |
| Permissions | Permission tests exist; backend RLS/RPC/grant evidence remains missing. | MEDIUM | Operator read-only evidence required. |

### Code-search findings

| Search target | Finding | Severity | Action |
| --- | --- | --- | --- |
| `TODO`, `FIXME`, `HACK`, `XXX`, `debugger`, `@ts-ignore`, skipped tests | No production-runtime blockers found in the searched app source. | LOW | No code action. |
| `console.log` | Debug logs remain in governance tests only. | LOW | Safe to postpone; no production runtime impact. |
| `any` | Mostly test mocks plus one event helper accepting broad event types. | LOW | Safe to postpone; not a release blocker. |
| Duplicated validation/business rules | Financial-critical bank reconciliation validation has been centralized; commissions validation is now guarded before writes. Remaining non-financial draft forms are not blockers. | MEDIUM | Post-QA hardening only unless QA finds a failure. |
| Dead/unreachable code | No BLOCKER/HIGH dead-code finding was confirmed from code search. | LOW | No code action. |

## Release Candidate evidence report

### Remaining manual QA

- Authenticated end-to-end browser pass for every critical route and module listed above.
- Role-based QA for ADMIN, MANAGER, and USER, including denied actions and hidden/disabled financial controls.
- Invoice → payment → receipt → void receipt → report reconciliation journey.
- Bank reconciliation import, manual line, match, ignore, filter, and suggested-match flows.
- Printing, PDF generation, CSV export, and generated document review.
- Arabic RTL pass for dashboard, list pages, tables, dialogs, bottom sheets, and reports.
- Mobile, tablet, and desktop responsive pass.
- Loading, empty, and error-state pass for critical pages.

### Remaining staging verification

- Run full CI-equivalent command suite for the exact release-candidate commit.
- Run authenticated browser smoke/E2E against seeded staging credentials.
- Archive screenshots/traces for critical financial flows and responsive breakpoints.
- Verify company currency, decimal, locale, timezone, and date formatting in staging.
- Record IDs and expected totals for invoice/payment/receipt/void/report proof.

### Remaining infrastructure tasks

- Provide seeded staging credentials for all required roles.
- Provide approved read-only Supabase connection for migration ledger, RPC, RLS, and grant checks.
- Archive CI run URLs and browser-readiness artifacts for the exact release candidate.
- Confirm no production mutation is required before QA freeze, or obtain explicit governance approval if one is required.

### Release blockers

- Authenticated browser evidence is still missing.
- Staging financial lifecycle evidence is still missing.
- Read-only Supabase backend evidence for RPC/RLS/grants/migration ledger is still missing.
- Manual QA evidence for RTL/mobile/desktop/exports/PDF/printing is still missing.

### Go / No-Go recommendation

**NO-GO for release sign-off today.** There are no additional code-only BLOCKER/HIGH issues confirmed in this pass after the commission validation fix, but critical production evidence is still missing. Recommend moving to release-candidate evidence collection and manual/staging QA before any GO decision.

### RPC authorization fixes (2026-07-10)

Direct live-DB verification of financial/maintenance RPCs surfaced two authorization gaps, both applied to the live database and now synced as migrations:

| RPC | Issue | Severity | Fix |
|---|---|---|---|
| `resolve_maintenance_with_expense` | Only checked `auth.uid() IS NOT NULL`; any authenticated USER-role account (normally restricted to dashboard-view) could post an arbitrary-amount expense row directly via RPC call. | HIGH | Added ADMIN/MANAGER role check, matching `post_receipt_atomic` / `record_invoice_payment_atomic` / `void_receipt_atomic`. Migration: `20260710120000_resolve_maintenance_with_expense_role_check.sql`. |
| `recalculate_all_balances` | `SECURITY INVOKER`, relying solely on table RLS (which grants ALL to any `app_private.is_app_user()` with no role distinction) to protect a full delete+rebuild of `contract_balances`, `tenant_balances`, `owner_balances`. | MEDIUM | Switched to `SECURITY DEFINER` with the same ADMIN/MANAGER role check, so the authorization boundary no longer depends on RLS alone. Migration: `20260710120001_recalculate_all_balances_security_definer.sql`. |

No frontend call sites invoke `recalculate_all_balances`, so this fix carries no UI risk. Frontend unit tests mock the RPC layer and are unaffected by either change.
