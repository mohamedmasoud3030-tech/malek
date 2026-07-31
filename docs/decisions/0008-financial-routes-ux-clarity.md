# 0008. UX separation of `/financials` and `/reports`

## Context

The application exposes two top-level finance destinations that were easy to
confuse because both concern financial data but serve different jobs:

- `/financials` is the operational index for invoices, receipts, expenses,
  arrears, deposits, owner settlements, and bank reconciliation. It also shows
  a current-month `FinancialReportsPreviewSection` before the workspace cards.
- `/reports` is the detailed analytics center for collection, cashflow,
  arrears, accounting, statements, VAT, deferred revenue, filtering, and CSV
  export.

The pages share reporting services, while navigation and page-copy keys such as
`financialOverview`, `reportsAndStatements`, `accounting`, and `statements`
existed without a written contract describing which page owns which job. Their
headers and descriptions were hardcoded Arabic strings, and the UI did not
provide a direct way to move from the quick operational view to detailed
reports or back.

`rentrix-app/src/features/finance-hub/` is an internal reusable workspace shell,
not a route. This decision concerns only `/financials` and `/reports`.

## Decision

1. Keep `/financials` and `/reports` as separate routes. `/financials` remains
   the operational directory with per-workspace permissions; `/reports`
   retains its existing `financial.reports.export` access check and heavier
   analytics workspace.
2. Add six bilingual shared keys in `rentrix-app/src/lib/i18n.ts`:
   `financialsPageDescription`, `financialsPageHint`,
   `reportsPageDescription`, `reportsPageHint`,
   `financialsSectionSummary`, and `financialsSectionReports`.
3. Use `financialsSectionSummary` and `financialsSectionReports` as the two page
   header titles. They are an intentional contrast pair inside the pages and
   their cross-route actions. Existing sidebar labels remain unchanged.
4. Render each hint as a low-emphasis, actionable cross-route banner:
   `/financials` links to `/reports` only when the current user has the existing
   reports permission, and `/reports` links back to `/financials`.
5. Use both `language` and `direction` from `getAppLanguageState()` for page
   copy and layout direction. No new language hook or state source is added.
6. Keep all existing routes, sidebar entries, permission definitions, RPCs,
   services, migrations, and financial calculations unchanged. Keep the
   `FinancialReportsPreviewSection` inside `/financials`.

## Alternatives rejected

- **Merge `/financials` and `/reports` into one tabbed hub.** Rejected because
  the reports workspace has a stricter access boundary and a heavier analytics
  bundle than the operational directory.
- **Remove the current-month preview from `/financials`.** Rejected because the
  preview gives the operational route a useful quick-summary payoff instead of
  leaving it as a directory only.
- **Keep explanatory text without navigation actions.** Rejected because a
  banner that tells the user another page is relevant should provide the route
  directly, while still respecting the destination permission.
- **Use raw source scanning as the i18n consumer contract.** Rejected because a
  comment, fixture, or unrelated string can create a false positive. The test
  instead matches real `translateSharedLabel(...)` calls in the intended route
  files.

## Consequences

- The page headers now read "Quick summary" / "Detailed reports" in English
  and "الملخص السريع" / "التقارير التفصيلية" in Arabic. This does not rename
  the sidebar entries.
- Both routes explain their purpose and provide a direct, keyboard-focusable
  route to the complementary view. Restricted users do not receive the new
  `/reports` action.
- The two pages no longer force RTL when their language state is LTR.
- Translation value tests protect the six keys in Arabic and English, while
  consumer tests tie every key to an actual translation call in its intended
  page source.
- Copy changes remain centralized in `lib/i18n.ts`; route responsibilities and
  access behavior remain unchanged.
- Revisit this decision if the reports permission is removed, if the quick
  preview leaves `/financials`, or if the operational workspaces are replaced
  by one consolidated table that changes the route's purpose.

## Evidence

- `rentrix-app/src/features/financials/financials-page.tsx` — quick-summary
  header, direction-aware layout, permission-gated link to `/reports`, preview,
  and financial workspace cards.
- `rentrix-app/src/features/reports/reports-page.tsx` — detailed-reports header,
  existing reports access check, direction-aware layout, and link back to
  `/financials`.
- `rentrix-app/src/lib/i18n.ts` — owns the six ADR-0008 translation keys.
- `rentrix-app/src/lib/i18n.test.ts` — bilingual value, contrast, and exact
  consumer contracts.
- `rentrix-app/src/app/navigation/app-nav-items.ts` — evidence that sidebar
  labels and ordering remain unchanged.
- `docs/ARCHITECTURE.md` — records the route split and the non-route role of
  `features/finance-hub/`.
- PR #1307 — established the finance workspace shell.
- PR #1314 — established the financial reporting service facade.
