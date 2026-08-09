# Phase 7 — Document Platform Architecture + Print/PDF Parity

**Status:** `VERIFIED_COMPLETE`
**Scope:** One production-grade document platform for every printable/exportable
operational and financial document in MALIK. No change to business logic,
GL/accounting rules, settlement/payment calculations, or the permission model.

> This document records the architecture, the document inventory (before/after),
> the unified templates, the migrated callers, and the print/PDF parity evidence.
> It is the Phase 7 owner doc; per-document caller detail lives in
> `PR2_CALLER_INVENTORY.md` and browser acceptance in `PR3_BROWSER_ACCEPTANCE.md`.

---

## 1. The six separation-of-concerns contract

The platform cleanly separates the concerns the phase asked for, each with one
owning module and no cross-layer recompute of financial figures:

| # | Concern | Owning module(s) | Responsibility |
|---|---|---|---|
| 1 | **Document data model** | `documentPayloads.ts`, `types.ts` (`UnifiedDocumentModel`) | Typed, per-document canonical payloads; every field mirrors data the caller already holds. No financial value is invented or derived here. |
| 2 | **Document template/layout** | `documentRegistry.ts` (output contract) + `DocumentEngine.ts` (one builder per registry entry) | Registry↔engine parity is enforced by a test; layout decisions (status labels, signature roles, page/currency/empty-state/file-name policy) live in the registry. |
| 3 | **Print rendering** | `DocumentRenderer.ts` + `renderer/` (RTL A4 popup path) | Opens a scoped A4 RTL print preview and invokes the browser print dialog for the document alone — never the app screen. |
| 4 | **PDF/export rendering** | `DocumentRenderer.ts` + `renderer/` (jsPDF + html2canvas-pro) | Produces a real multi-page `application/pdf` with Arabic page numbers captured as pixels; never a print dialog. |
| 5 | **Branding / company identity** | `companyIdentity.ts` | The **only** adapter that reads the real `company_settings` record; no `MALEK`/placeholder fallback; readiness gate blocks output until real identity exists. |
| 6 | **locale / RTL / number / date / currency** | `currencyPrecision.ts`, `lib/formatters.ts`, `renderer/documentHtml.ts` | ISO-4217 minor units derived from the real currency code; Latin numerals; Arabic RTL layout; `ar-OM` dates. |

**Authoritative-source rule:** every document payload is built by the production
caller from the same domain data the UI already shows (`useDocumentSettings()`,
typed action helpers, report builders). The engine never re-derives totals — a
financial figure shown on screen is the exact figure printed and exported,
because the template only formats, never re-sums.

---

## 2. Document inventory (before / after)

### Before — parallel implementations
- Multiple independent print/PDF entry points and legacy fire-and-forget
  export adapters (`services/pdfService.ts` `void import(...).then(...)`),
  plus a large `DocumentTemplates.tsx` that mixed data conversion with layout.
- Company identity read from several historical shapes; a missing identity
  could silently print placeholder branding.
- Amounts formatted with global hard-coded precision (OMR-centric 3 decimals),
  which mis-format USD/EGP/JPY.
- No single registry of which document is printable/exportable, with what
  reference policy, signatures, page policy, and filename strategy.

### After — one unified platform
- **11 document types** registered in `documentRegistry.ts`, each with a
  builder in `DocumentEngine.ts` (parity test enforces 1:1):

| type | template | kind |
|---|---|---|
| `contract` | rental-contract-a4-ar | rental contract print/export |
| `invoice` | rent-invoice-a4-ar | rent invoice |
| `receipt` | cash-receipt-a4-ar | سند القبض |
| `expense_voucher` | expense-voucher-a4-ar | سند صرف مصروفات |
| `payment` | money-movement-voucher-a4-ar | neutral money-movement voucher (documented legacy alias, no live caller) |
| `owner_statement` | owner-statement-a4-ar | كشف حساب مالك |
| `tenant_statement` | tenant-statement-a4-ar | كشف حساب مستأجر |
| `trial_balance` | trial-balance-a4-ar | ميزان مراجعة |
| `income_statement` | income-statement-a4-ar | قائمة الدخل |
| `balance_sheet` | balance-sheet-a4-ar | المركز المالي |
| `generic_report` | generic-report-a4-ar | operational reports (collections/overdue/occupancy/expenses/maintenance/deferred revenue/property analytics, deposits clearance, utilities) |

- **PDF libraries:** `jspdf` + `html2canvas-pro` are used only in the lazy-loaded
  renderer (kept out of initial/route bundles). No other production module
  imports them.

---

## 3. Unified templates & output contract

Each registry entry declares (see `documentRegistry.ts`):
- `supportedOutputs` — print and/or PDF.
- `requiredData` / `optionalData` — validated by the engine.
- `businessReference` — real document numbers only (`displayAsDocumentNo`),
  never a bare UUID fragment (`deriveHonestReference` drops them).
- `statusLabels` — truthful Arabic labels keyed by real status; no label may
  claim a state the data does not prove (e.g. a draft contract prints
  "مسودة عقد إيجار (غير موقّع)").
- `signatureRoles` — owner/tenant/accountant/general_manager as appropriate.
- `page` — A4 portrait with margins `{top:12, right:10, bottom:15, left:10}mm`.
- `currency` — always from `company-settings`, precision currency-derived.
- `emptyState` — `render` (say so in Arabic) or `block` (refuse output).
- `fileName` — `reference-then-date` sanitized, never invented.

---

## 4. Migrated callers (print/PDF parity in production)

Every production print/export entry point now invokes the canonical typed
`documentService.printDocument(type, { settings, payload })` /
`downloadDocumentPdf(...)`. No caller uses the deprecated `print`/`downloadPdf`/
`renderPdf` request shape. Full table in `PR2_CALLER_INVENTORY.md`. Highlights:
receipt, invoice, contract, expense voucher, deposit clearance, owner
settlement (owner statement), tenant statement, owner statement report,
trial balance, income statement, balance sheet, and the eight `generic_report`
operational surfaces.

---

## 5. Validation evidence (Phase 7 run)

- **Financial precision:** `currencyPrecision.test.ts` locks ISO-4217 minor
  units (OMR/KWD/BHD → 3, USD/EGP/SAR → 2, JPY/KRW → 0) derived from the real
  currency; `documentEngine.canonical.test.ts` locks pass-through (the engine
  renders the caller-supplied total even when display arithmetic would disagree
  — never re-sums).
- **Print/PDF parity:** new `documentPlatform.parity.test.ts` asserts the same
  engine model drives both print and PDF for receipts and owner statements, and
  that zero/negative amounts render verbatim with the real currency precision.
- **RTL / A4 / page breaks:** `renderer/documentRenderer.dom.test.ts` and
  `renderer/pdfArtifacts.test.ts` assert A4 pagination never splits rows/totals/
  signature blocks, table headers repeat, blank pages are skipped, and the
  page-count cap fails closed with an Arabic error.
- **Reference truthfulness / legacy compatibility:** `companyIdentity.test.ts`
  (no invented identity) and `documentEngine.canonical.test.ts` (legacy DB-shaped
  requests vs canonical payloads agree; UUID fragments never shown).
- **Boundaries:** `documentPlatform.boundaries.test.ts` ensures `DocumentTemplates`
  contains no model builders (thin adapters only) and no parallel implementation.

### Run results (this branch)
- `vitest run src/services/documents` — 13 files, 120 tests passed (116 prior + 4 new parity).
- Root `pnpm test` and app `typecheck` — see Phase 7 report for full numbers.

---

## 6. Legacy compatibility contract

- `services/pdfService.ts` remains only as a promise-returning compatibility
  layer with no production imports (`pdfService.test.ts` pins error propagation);
  it is removed once its test-only consumers migrate (tracked).
- `DocumentTemplates.tsx` is a thin compatibility adapter delegating to the
  canonical service; payload conversion is shared via `documentPayloadAdapters.ts`,
  not duplicated.
- `action-service.printCurrentView` (browser `window.print()`) has no production
  callers — all print paths go through the document platform.
- CSV exports, vault/storage downloads, WhatsApp links, and the receipt
  print-tab links are intentionally not document/PDF renderer callers.
