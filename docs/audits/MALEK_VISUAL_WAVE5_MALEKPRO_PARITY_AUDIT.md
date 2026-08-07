# MALEK Visual Wave 5 — Malek Pro Parity Audit (post-Wave-2 hardening)

Date: 2026-08-07
Branch: `arena/019fdc09-malik`
Owner-requested inputs: 20 reference screenshots of the Malek Pro prototype
(Google AI Studio build) supplied by the repo owner on 2026-08-07 as the
visual/UX comparison reference.

## 1. Where the reference screens live in the documented plan

Every reference screen maps to an existing, documented rollout stage:

| # | Malek Pro reference screen (owner screenshots) | Plan stage / wave | Status before Wave 5 |
|---|---|---|---|
| 1 | Dashboard: hero, 4 KPI cards, cash-flow charts, occupancy donut, due invoices, renewal alerts, urgent maintenance | ADR 0012 Phase 2 (Dashboard proof `[data-visual-contract='v2']`) + `dashboard-v2-visual-redesign` | Shipped (`evidence/dashboard-v2-visual-redesign`) |
| 2 | Properties register: property cards, codes, filters, add-property modal, expandable units | ADR 0013 Wave 1 + PR #1359 operational redesign | Shipped (`evidence/ui-malek-pro-wave-1`, register + command panel) |
| 3 | Contracts register: table, status chips, new-contract modal | ADR 0013 Wave 1 + PR #1359 | Shipped |
| 4 | Invoices & receipts: hero, filter chips, invoice table, pay-invoice modal, new-invoice modal, approved receipt card | ADR 0014 Wave 2 (Finance & Reporting) + Wave 4A surfaces | Shipped (`MALEK_VISUAL_WAVE_2_FINANCE_REPORTING_AUDIT.md`) |
| 5 | Maintenance: register, filters, new-report modal | ADR 0013 Wave 1 + PR #1359 | Shipped, one header-contract defect found in Wave 5 (this audit, fixed) |
| 6 | Owner form: bank details, agreement-model cards, linked properties | Wave 1 owners surfaces + Wave 4A forms | Shipped |
| 7 | Add property modal / pay invoice modal / contract modal header treatment | Wave 4A form contract (mobile bottom-sheet, desktop dialog) | Shipped; dark-navy promotional headers deliberately rejected (doc 3 consolidation pass, commit `2a2df3a7`) |

Reference screens **not** to be replicated: split-screen login with promotional
command-center panel (intentionally removed in the 2026-08-07 consolidation),
dark-navy gradient modal heroes (rejected as promotional in the same pass),
demo/mock data (Document 1: no demo/mock allowed in product surfaces).

## 2. Gaps found by direct visual comparison (fixed in this wave)

### G1 — Register tables: washed-out command header (contrast defect)
- **Where:** every operational register table on `[data-operational-route='true']` surfaces (properties, contracts, units, people, owners, maintenance standalone).
- **Cause:** the operational `thead` paints a dark command bar (`hsl(222 32% 16%)`), but `thead th` inherited the generic page-polish rule (`color: --color-text-muted`, `background: --muted/0.4`): dark-grey text on a milky overlay in both themes.
- **Fix:** `malek-pro-visual-wave.css` operational `thead th` now pins `background: transparent; color: rgb(248 250 252 / 0.92); border-bottom-color: rgb(255 255 255 / 0.08)` inside the dark bar.
- **Guard:** `src/styles/malek-pro-visual-wave.test.ts`.

### G2 — Maintenance standalone header breaks the PageHeader action contract on mobile
- **Where:** `/maintenance` standalone (and its e2e fixture).
- **Cause:** both the A4-print and create actions were stuffed into `primaryAction`, bypassing the mobile overflow sheet; at 390px the header row cramped/overlapped the title (reproduced with the real Cairo font).
- **Fix:** create = `primaryAction`, A4 print = `secondaryActions` (auto-collapses into the mobile overflow bottom-sheet; desktop renders inline). Embedded operations-hub mode unchanged.
- **Fixture:** `maintenance.e2e-fixture.tsx` updated to mirror the real workspace.

### G3 — OD-12: Cairo font relied on Google Fonts runtime CDN
- **Where:** `index.html` injected `fonts.googleapis.com` at load and preconnected to `fonts.gstatic.com`.
- **Impact:** offline PWA and CDN-blocked environments rendered Arabic in fallback fonts.
- **Fix:** self-hosted `public/fonts/` (Cairo arabic+latin 400–900, Sora latin 600–800, OFL licenses included), `public/fonts/fonts.css` with `font-display: swap` and exact `unicode-range` splits, deferred injection moved into typed `src/lib/product-fonts.ts` using `import.meta.env.BASE_URL`. PWA precache already globs `woff2`.
- **Guard:** `src/lib/product-fonts-contract.test.ts`.

## 3. Evidence

- Before (defect state): `evidence/ui-wave5-malekpro-parity/before/`
- After (fixed state): `evidence/ui-wave5-malekpro-parity/after/`
- Captured from the repository e2e harness fixtures (`/login?e2e-showcase-*`)
  at 390px and 1440px, light theme, self-hosted fonts active.

## 4. Remaining roadmap items intentionally untouched

- Split auth layouts / promotional hero panels: rejected by the owner-approved consolidation pass — must not return.
- Wave 2 exclusions stand: printable receipt A4 surface, document templates, finance calculations, all business logic.
- Stage S03–S10 backend roadmap items: unchanged (not UX).

## 5. Verification gates run

- `tsc -p tsconfig.json --noEmit` (typecheck): PASS
- Targeted tests: `product-fonts-contract.test.ts`, `malek-pro-visual-wave.test.ts`, `design-tokens.test.ts`, `page-header.test.tsx`, `maintenance-page.test.tsx`: PASS
- Full unit suite + production build + repo checks: see section 5 results recorded at execution time (all green at delivery).
