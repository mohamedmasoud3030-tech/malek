# PR 3 — Browser acceptance for the document/print/PDF platform

PR 1 (`5f8da3bb`) established the validated document/print/PDF foundation. PR 2 (`282e7f8b`) migrated every production caller to `documentService`. PR 3 proves that foundation end to end in a real browser, through the real production surfaces, with real artifacts — not mocks.

## What the suite drives

`rentrix-app/e2e/document-platform-acceptance.spec.ts` runs the REAL production paths:

- routes and page components (invoice workspace, receipt detail, contract detail, reports statements, accounting reports);
- real action handlers (`invoice-actions`, `receipt-detail-page`, `contractDetailActions`, `StatementsSection`, `AccountingReportsSection`);
- `documentService.printDocument` / `downloadDocumentPdf` → `DocumentController` → `DocumentEngine` → `DocumentRenderer`;
- real popup windows for print and real `application/pdf` downloads inspected as artifacts.

The ONLY stubbed boundary is the Supabase HTTP API: hermetic CI has no live project. `rentrix-app/e2e/support/fake-supabase-backend.ts` implements a PostgREST-shaped read layer seeded with rows matching the migration schemas (`supabase/migrations/20250101000001_core_schema.sql`, `20260722010000_phase1_create_companies_and_seed.sql`), including the multi-tenant `companies` / `company_members` gate and a real seeded session (`app_metadata.user_role = ADMIN`, `company_id`). Mutating HTTP calls are refused on purpose so a test can never silently fake a write. Live-data verification remains the seeded-staging `workflow_dispatch` job in `browser-readiness.yml`.

## Requirement → test matrix

| # | Requirement | Covering test(s) |
|---|---|---|
| 1 | Invoice | `الفاتورة` describe: print popup + PDF download + double-click (desktop & mobile) |
| 2 | Receipt | `الإيصال` acceptance (desktop incl. mobile overflow menu path) + mobile receipt print |
| 3 | Contract | contract detail print/export (desktop header actions, mobile listbox action menu) |
| 4 | Owner statement | reports «كشف حساب المالك» print + download with true owner identity |
| 5 | Tenant statement | reports «كشف حساب المستأجر» print + download |
| 6 | Long multi-page financial report | trial balance with 150 seeded accounts: ≥5 pages, ≤50-page cap |
| 7 | Print via a real popup | `waitForEvent('popup')` on every print; popup `dir=rtl lang=ar`, `@page size: A4 portrait`, intercepted `window.print()` invocation counted, CDP `Page.printToPDF` artifact from the popup's real print layout |
| 8 | Real PDF download + artifact verification | Playwright `download` event; `%PDF` magic, `%%EOF`, page objects, A4 MediaBox (~595×842pt), embedded image streams |
| 9 | Safe file names, no shortened UUIDs | `auditDocumentFileName`: no unsafe characters, ≤96 chars, `.pdf`, no 8+ hex-letter runs, no seeded UUID/UUID-prefix leak; registry prefixes asserted (`invoice-`, `receipt-REC-2026-0001`, `contract-`, `tenant-statement-`, `owner-statement-`, `trial-balance-`) |
| 10 | Real identity from `company_settings`, no MALEK fallback | every popup assertion requires the seeded company name and forbids `MALEK` and every seeded UUID fragment |
| 11 | Incomplete settings → disabled actions + correct message | settings read failure (a reachable production state): receipt buttons disabled, invoice affordances absent, statements actions disabled, `DocumentReadinessNotice` (`role=alert`) visible on all surfaces |
| 12 | Errors surfaced, never swallowed | popup-blocked → Arabic blocked-popup toast, zero popups; forced font-loading failure → renderer Arabic error toast on print AND download paths, zero popups/downloads, no orphan `data-document-render-root` left behind; per-test console-error audit |
| 13 | No duplicate on double-click | `dblclick` on print → exactly one popup; `dblclick` on PDF → exactly one download (single-flight guard) |
| 14 | RTL / A4 / multi-page / no clipping / no trailing blank page | popup RTL+A4 checks; tenant statement ≥2 pages; trial balance ≥5 pages; every page's image stream >10KB (a blank page compresses to a trickle) |
| 15 | Desktop and mobile per interface capabilities | desktop: full matrix; mobile: invoice cards, receipt (incl. overflow «إجراءات إضافية»), contract via listbox action menu, readiness gate |

The native print dialog itself cannot be automated; the suite intercepts `window.print` at the invocation boundary (counted) and additionally produces a real PDF from the popup's actual print layout via CDP. Everything upstream of the dialog — popup, A4 RTL content, asset readiness — is the real production path.

## Artifact notes

- Arabic output renders through `html2canvas` → `jsPDF`: text is captured as pixels, so artifact assertions use genuine PDF structure (magic bytes, `/Type /Page` objects, MediaBox geometry, image stream sizes), not text extraction.
- Chromium headless-shell flattens non-ASCII suggested download names to `download`. The production file name is therefore observed directly from the `download` attribute jsPDF assigns to its save anchor (`__downloadNames` capture); ASCII names (invoice, receipt, contract, trial balance) are additionally asserted through Playwright's `suggestedFilename()`.
- `rentrix-app/e2e/support/pdf-artifact.ts` performs the structural inspection; the runner fonts step in `browser-readiness.yml` guarantees an Arabic-script font exists so captured pixels are real glyphs.

## Defect found and fixed in this PR (root cause)

The browser acceptance run caught a real production-path defect that unit tests could not see: PostgREST returns `numeric` columns as strings, and the receipt detail page passed `receipt.amount` uncoerced into the document payload. The engine's validation (`DocumentDataError`: «قيم مالية غير صالحة في بيانات المستند») then blocked EVERY receipt print/PDF in production, silently surfaced only as a toast. Invoice and contract callers already coerce with `Number(...)`; the receipt path did not.

- Fix: `receipt-detail-page.tsx` now coerces with `toFinancialNumber(receipt.amount)` (same boundary pattern as the migrated callers).
- Regression test: `receipt-detail-print-readiness.test.tsx` — «coerces the PostgREST string amount into a finite number before reaching the document engine».
- The fake backend deliberately returns numeric values as strings (PostgREST parity) so this class of defect stays visible to the suite.

## Observations recorded, not changed here

- `normalizeCompanySettingsRecord` pads an absent/blank `company_name` with the product brand (`MALEK`) — behavior pinned by merged tests (`companySettingsService.test.ts`, `settingsForm.test.ts`). The document platform itself never falls back (verified here through the settings-failure state), but the readiness gate cannot fire for the brand-padded row. Recommend a dedicated follow-up decision (out of PR 3's test-only scope).
- Statement file names embed Arabic tenant/owner names by design (`tenant-statement-<name>`); real browsers keep them, headless-shell reports `download`. Observed, not a defect.

## Changed files

- `rentrix-app/e2e/document-platform-acceptance.spec.ts` — acceptance suite.
- `rentrix-app/e2e/support/fake-supabase-backend.ts` — seeded PostgREST-shaped read layer.
- `rentrix-app/e2e/support/document-acceptance-session.ts` — seeded session, font-CDN neutralization, failure switches, print/download capture.
- `rentrix-app/e2e/support/pdf-artifact.ts` — PDF artifact inspection + file-name audit.
- `rentrix-app/src/features/financials/receipts/receipt-detail-page.tsx` — amount coercion fix.
- `rentrix-app/src/features/financials/receipts/receipt-detail-print-readiness.test.tsx` — regression test.
- `.github/workflows/browser-readiness.yml` — idempotent Arabic font availability for canvas rendering.

No SQL, RLS, RPC, calculation, permission, financial-status, or report-logic changes.
