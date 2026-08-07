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

## 4a. Wave 5.1 — WCAG 2.1 AA remediation (axe-measured)

An axe-core 4.12 audit (`wcag2a` + `wcag2aa` tags) was run on the 8 e2e
fixture surfaces in both themes (16 combinations, mobile viewport). Baseline
violations were all contrast-related plus two keyboard-access scroll regions.
Fixes (presentation-only):

| Defect (axe id) | Where | Fix |
| --- | --- | --- |
| `color-contrast` — light muted text 3.51–4.48:1 | root `--color-text-muted` | `215 14% 55%` → `215 14% 46%` (≈4.85:1) in `tokens.css` |
| `color-contrast` — dark muted text 4.05–4.49:1 | root dark `--color-text-muted` | `210 10% 50%` → `210 10% 58%` (≈4.8–5.0:1 incl. lightest dark surface) |
| `color-contrast` — dashboard v2 light muted 4.24–4.48:1 | `dashboard-v2.css` scoped muted | `215 12% 48%` → `215 12% 43%` (≈5.37:1) |
| `color-contrast` — white on Malek green 3.99:1 | `malek-pro-visual-wave.css --primary` | `160 84% 31%` → `160 84% 27%` (≈5.0:1); `--focus-ring` unchanged |
| `color-contrast` — `text-muted-foreground/70` ≈2.27:1 tiny text | `kpi-card`, `stat-card`, `entity-cell`, `lands-view`, `login-page` footer, reports category label | dropped the `/70` opacity blend (full muted token now AA) |
| `scrollable-region-focusable` | reports section-tab scroller, reports filter-chips scroller | `tabIndex={0}` + `role="region"` + Arabic `aria-label` + visible inset focus ring |

Deliberately untouched: `placeholder:text-muted-foreground/70` in
`enterprise-search.tsx` — placeholder/hint text is exempt from WCAG 1.4.3.

**Final result: 16/16 surface-theme combinations with 0 violations.**
Machine report: `evidence/ui-wave5-malekpro-parity/audits/axe-wcag2aa-final.json`.

## 4b. Responsive overflow matrix (Phase 3 check)

96 checks (16 fixture surfaces × 320/375/414/768/1024/1440 px) measured for
horizontal document overflow and page-title clipping: **0 defects**.
Machine report:
`evidence/ui-wave5-malekpro-parity/audits/responsive-overflow-matrix.json`.

## 4. Remaining roadmap items intentionally untouched

- Split auth layouts / promotional hero panels: rejected by the owner-approved consolidation pass — must not return.
- Wave 2 exclusions stand: printable receipt A4 surface, document templates, finance calculations, all business logic.
- Stage S03–S10 backend roadmap items: unchanged (not UX).

## 5. Verification gates run

- `tsc -p tsconfig.json --noEmit` (typecheck): PASS
- Targeted tests: `product-fonts-contract.test.ts`, `malek-pro-visual-wave.test.ts`, `design-tokens.test.ts`, `page-header.test.tsx`, `maintenance-page.test.tsx`: PASS
- Full unit suite + production build + repo checks: see section 5 results recorded at execution time (all green at delivery).
- Wave 5.1 gates: typecheck PASS; targeted component/token tests 51/51 PASS; full suite 349 files / 2168 tests PASS; production build (PWA 309 precache entries) PASS; `check:architecture`, `check:docs` (112 md), `check:business-rules` PASS; axe matrix 16/16 zero violations.
