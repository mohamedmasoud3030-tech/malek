# Malek Document System — Unification Report

**Repo:** `malek/rentrix-app` · **Scope:** `src/services/documents/` + print CSS + golden validation
**Result:** documents suite 21 files / 266 tests green · `tsc --noEmit` clean · `vite build` clean ·
`check-architecture.mjs` exit 0 · **12/12 golden scenarios pass with print⇄PDF parity** · net **−92** source lines.

---

## 1. What was found (inventory first)

- **One canonical platform** already existed: `DocumentService → DocumentController → runDocumentAction → DocumentEngine → DocumentRenderer`. All consumers (receipt page, invoice/contract dialogs, report panels) used it. Good.
- **One competing subsystem:** `renderer/latinPdf.ts` — a parallel PDF path for Latin documents with no branding, no KPIs, no footer numbers. Deleted (with its test).
- **Core pagination bug:** budgeting ignored vertical margins (`outerHeight` used `getBoundingClientRect`, which excludes margins) → content that genuinely fits one page was pushed to 3–4 pages.
- **Clipping bug:** oversized blocks (tall tables) were placed whole and clipped by the shell's `overflow:hidden`.
- **Fixed chunking:** tables were blindly split every 22 rows regardless of real row height.
- **Print ≠ PDF:** print used body padding the PDF pipeline didn't; print had no page numbers at all.
- **Scattered design decisions:** margins/colors/fonts/regexes/table styles duplicated across `documentHtml`, `professionalDocumentHtml`, `latinPdf`, `documentRegistry`, `globals.css`.

## 2. Architecture decisions

1. **One pipeline for every language.** Arabic shaping, RTL, and Latin all flow through the same measurement + pagination + capture code. No `modelHasArabicText` branching anywhere.
2. **`documentDesignTokens.ts` as the single source of truth** (A4 page geometry, margins, colors, type scale, spacing, table chrome). `documentRegistry` margins and chunk caps now *derive* from tokens.
3. **Shared table primitives** (`renderer/documentTableHtml.ts`) used by both generic and professional renderers; listed in both boundary-guard tests so no second table style can sneak back in.
4. **Measurement-based pagination, never blind breaks:** outer-height budgeting that emulates CSS margin collapse; greedy row-level table splitting (thead repeated on every part, tfoot only on the last, title on the first); oversized atomic blocks get their own page rather than silent clipping. No `page-break-before: always` on content; text is never shrunk below the type scale.
5. **Print and PDF are peers, not implementations of each other:** both read identical margins/typography from tokens; print stylesheet carries `tr { break-inside: avoid }`, `thead/tfoot` display roles, heading `break-after: avoid`; PDF carries an absolute footer band with `صفحة X من Y`.
6. **No new dependencies.** Existing stack only: jsPDF + html2canvas-pro + browser engine. Validation tooling reuses Playwright already present in the repo.
7. **Truthful data contract:** amounts pass through unchanged; no invented references; status labels come from payloads only.

## 3. What was changed

| File | Change |
|---|---|
| `documentDesignTokens.ts` | NEW — all page/color/type/spacing/table tokens (leaf module). |
| `renderer/documentTableHtml.ts` | NEW — shared inline-styled table primitives incl. multi-row tfoot (`DocumentTable.totals: string[] \| string[][]`, final-row last cell = accent grand total). |
| `renderer/pagination.ts` | REWRITTEN — margin-collapse-aware budgeting (`appendedBudget`), row-level measured table splitting (also for a first-block table taller than a page), footer band builder, shells carry the exact typography contract. |
| `renderer/pagination.test.ts` | NEW — 12 contract tests (budget math incl. collapse, splitting with repeated thead/single tfoot, atomic fallback, entry guard). |
| `renderer/documentHtml.ts` | Tokens-based blocks + print stylesheet parity; bidi-safe header (no letter-spacing on Arabic, `dir=ltr` isolation for phone/timestamps); audit footer with isolated date/time runs. |
| `renderer/professionalDocumentHtml.ts` | Refactored onto tokens + shared primitives; KPI/identity/chart/keepTogether preserved; dead `COMPACT_SECTION_WRAP` removed. |
| `DocumentRenderer.ts` | Unified pipeline only: `buildDocumentPdf`, print/PDF entry points, footer band injection, measurement via padded offscreen container; no latin imports. |
| `renderer/offscreen.ts` | **Measurement-fidelity contract:** container mirrors page-shell geometry (A4 width, border-box, page-margin padding) so blocks measure at the exact content width they will print at. |
| `renderer/latinPdf.ts` + test | DELETED. |
| `types.ts` | `totals` multi-row extension. |
| `DocumentEngine.ts` | Income statement merged net income into expenses table's 2-row tfoot (one-page financial statement; removes redundant third-table chrome). |
| `documentRegistry.ts` | Margins/chunk cap derived from tokens; 50-page fail-closed cap. |
| `globals.css` | Deleted dead `.print-page-break`, `.print-avoid-break`, `.kpi-card`, `.signature-block` print rules; kept `tr` / `[data-entity-card]` guards and receipt detail print styles. |
| Guard tests (inventory, boundaries, dom, pdfArtifacts, Renderer) | Updated to pin the new unified surface (footer band, table primitives, signature labels in text projection, row-split page math). |
| `scripts/verify-golden-documents.mjs` + `src/test/documents/` | NEW golden validation set (below). |

## 4. Validation (real rendered output, not just compile)

`node scripts/verify-golden-documents.mjs` bundles the harness (esbuild), loads it in **headless Chromium**, waits for real fonts, and for each scenario compares:
- **PDF path** page count (jsPDF) vs **browser print** page count (Chromium PDF via `@page` mm margins),
- per-page shell overflow (clipping) from real layout metrics,
- blank pages, table-header repetition on continuation pages, and the exact one-page expectation for short docs.

**Final result — all pass, pdf == print everywhere:**

| Scenario | Pages | Notes |
|---|---|---|
| receipt-short | 1/1 | one-pager fits exactly |
| invoice-short | 1/1 | |
| contract-short | 1/1 | signatures + stamp on page 1 |
| tenant-statement-medium | 3/3 | |
| owner-statement-long | 6/6 | table spans pages, thead repeated |
| income-statement | 1/1 | financial doc, totals via 2-row tfoot |
| trial-balance-stress | 7/7 | 200 accounts, page numbering stress |
| english-report | 1/1 | Latin through the unified pipeline |
| mixed-ar-en-report | 1/1 | bidi: Latin refs/dates keep order inside RTL |
| legal-dossier-long-text | 3/3 | long paragraphs, no blind breaks |
| property-report-professional | 2/2 | KPIs + RTL SVG chart |
| owner-report-long-table | 4/4 | professional + long table parity |

Visual inspection of rasterized pages confirmed: branded RTL header (logo + title badge + doc ref), KPI strips, dark table heads with accent totals, signature rows, audit footer, footer band `company · ref · صفحة X من Y`, Arabic glyph shaping intact, no clipping.

Root causes fixed during validation: (a) blocks measured at 794 px while pages print at 718 px content width; (b) margin-collapse over-reservation in the page budget; (c) page shells capturing without the document typography contract; (d) Chromium PDF page counting against compressed object streams.

## 5. Cleaned up

- Deleted `latinPdf.ts` (+119-line test) — the last parallel pipeline.
- Deleted dead print CSS classes and unused style constants.
- Collapsed duplicate table/header/typography styles into tokens + shared primitives.
- Net diff: **572 insertions / 664 deletions** across 16 modified files, plus new test/validation assets.

**The repo ends with one document system, one pagination engine, one token source, two equal outputs (print, PDF), and a repeatable golden gate that proves rendered behavior.**
