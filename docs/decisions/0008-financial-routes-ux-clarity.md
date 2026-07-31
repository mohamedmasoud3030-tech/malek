# 0008. UX separation of `/financials` and `/reports`

## Context

The application exposes two top-level finance routes in the sidebar that
have historically been confused by users and reviewers:

- `/financials` — an index of day-to-day financial workflows (invoices,
  receipts, expenses, arrears, deposits, owner settlements, bank
  reconciliation). It is built by
  `rentrix-app/src/features/financials/financials-page.tsx` and renders
  a `FinancialReportsPreviewSection` (current-month collection summary)
  followed by workspace cards.
- `/reports` — an executive analytics center (collection, cashflow,
  arrears, accounting, statements, VAT, deferred revenue) built by
  `rentrix-app/src/features/reports/reports-page.tsx`.

The two pages also drew from the same shared service module
(`features/financials/reports/financialReportsService.ts`, the
domain-split facade introduced in PR #1314) and several i18n keys
(`financials`, `financialOverview`, `reports`, `reportsAndStatements`,
`accounting`, `statements`) lived in `lib/i18n.ts` without a written
contract for which key was for which page. The result was visible
label drift on the page header of each route and no in-product
description telling the user what each page was for.

`features/finance-hub/` exists as an internal workspace component
library (`FinanceHubWorkspace` + `finance-hub-sections.ts`) and is
**not** a route. It is the shell that the per-workflow pages reuse.
This decision covers only the two top-level routes `/financials` and
`/reports`; the internal component library is out of scope.

The user-visible problem in product: the page titles and descriptions
were hardcoded Arabic strings, the two pages overlapped conceptually in
the sidebar (both started with the word "مالي"), and there was no
authoritative place to read which page is for which job.

## Decision

1. **Routes are kept separate.** `/financials` and `/reports` stay as
   independent routes with independent permission gates (see
   `features/auth/permissions.ts` and PR #1307). The two pages solve
   different jobs — operational index vs. executive analytics — and
   merging them would either weaken the permission gate on reports or
   pollute the operational index with the heavier report bundles.

2. **Each page gets a one-line i18n description.** Six new shared
   translation keys are added in
   `rentrix-app/src/lib/i18n.ts`:
   - `financialsPageDescription` — explains the index role of
     `/financials`.
   - `financialsPageHint` — clarifies that each workflow has its own
     permission.
   - `reportsPageDescription` — explains the analytics/export role of
     `/reports`.
   - `reportsPageHint` — points users to `/financials` for the quick
     overview.
   - `financialsSectionSummary` — page title for `/financials`
     ("الملخص السريع" / "Quick summary").
   - `financialsSectionReports` — page title for `/reports`
     ("التقارير التفصيلية" / "Detailed reports").

   The two title keys are intentionally a pair so the sidebar and
   page header read as a single contrast.

3. **Page headers use the i18n lookup.** The hardcoded
   `title="الملخص المالي"` and
   `title="مركز التقارير والكشوف"` literals are replaced with
   `translateSharedLabel('financialsSectionSummary', language)` and
   `translateSharedLabel('financialsSectionReports', language)`
   respectively. The hardcoded Arabic description on each page is
   replaced with the matching `*PageDescription` key.

4. **`getAppLanguageState()` is the language source.** No new hook is
   introduced. The pattern matches the existing usage in
   `app/layout/app-shell.tsx`.

5. **Out of scope (deliberately unchanged).**
   - No sidebar entries are renamed, reordered, hidden, or merged.
   - No permission set is changed.
   - No RPC, service, migration, or route is renamed or removed.
   - `features/finance-hub/` is left as the internal workspace shell
     it is today.
   - The `FinancialPeriodSummaryReport` preview shown inside
     `/financials` is **kept**; it is the visual justification for
     the "Quick summary" title.

## Alternatives rejected

- **Merge `/financials` and `/reports` into a single hub with tabs.**
  Rejected because the permission gate on reports
  (`financial.reports.export`) is stricter than the per-section gates
  on `/financials` and a merged route would either drop that gate or
  force `/financials` users to render the report bundles. The
  permission boundary is the harder constraint to relax.
- **Drop `FinancialPeriodSummaryReport` from `/financials` and only
  show it in `/reports`.** Rejected because the preview is the
  reason the operational page carries "Quick summary" in its title.
  Removing it would make `/financials` a directory with no payoff.
- **Add a new i18n key per component instead of a per-page
  description key.** Rejected because the description is a single
  string shared by `<PageHeader>` and any future help-banner copy;
  one key per page keeps the localization authority in one place.

## Consequences

- The sidebar and page header for `/financials` and `/reports` now
  read as "Quick summary" / "Detailed reports" in EN and
  "الملخص السريع" / "التقارير التفصيلية" in AR. The contrast is
  visible at the first glance.
- `lib/i18n.ts` is the only place that owns these labels; the
  English translation ships in the same commit so there is no EN
  fallback gap.
- Tests are not affected: 255 files / 1349 tests pass after this
  change. No test referenced the old hardcoded title/description
  strings.
- The decision is reversible. If a future decision collapses the two
  routes, removing the new i18n keys and the two `translateSharedLabel`
  calls is the full revert.
- Any future copy change to either page description happens in
  `lib/i18n.ts` only, not in the page file. This was already the
  pattern for navigation labels; this decision extends it to page
  descriptions.

## When to revisit

- If `USER` and `MANAGER` roles are unified and the
  `financial.reports.export` gate loses its meaning, the case for
  keeping the routes separate weakens.
- If the `FinancialPeriodSummaryReport` preview is removed from
  `/financials` (e.g. moved entirely to the dashboard), the
  "Quick summary" wording for `/financials` should be re-evaluated.
- If the operational workflows inside `/financials` migrate to a
  single TanStack Table view, the page may become a pure directory
  and the description text should be shortened.

## Related

- `rentrix-app/src/lib/i18n.ts` — owns the new keys.
- `rentrix-app/src/features/financials/financials-page.tsx` — uses
  `financialsSectionSummary` and `financialsPageDescription`.
- `rentrix-app/src/features/reports/reports-page.tsx` — uses
  `financialsSectionReports` and `reportsPageDescription`.
- `rentrix-app/src/features/finance-hub/` — internal workspace shell,
  out of scope.
- `rentrix-app/src/features/auth/permissions.ts` — permission source of
  truth, unchanged.
- PR #1307 — `feat(finance): unify finance hub workspaces`. Established
  the workspace shell that this decision relies on.
- PR #1314 — `fix: unify MALIK tagline, auth contracts, and production
  governance`. Established the `financialReportsService.ts` facade.
