# MALEK — UX Bible (Canonical)

> **Source-of-truth document.** Governing contract for all future UI work is **MALEK Visual Contract V2** (`docs/ui-ux/MALEK_VISUAL_CONTRACT_V2.md`, accepted 2026-08-05, "where older Rentrix-branded UI/UX documents disagree with this contract, this contract governs future implementation work"). This bible consolidates V2 + the still-valid operational rules from the Rentrix-era UX corpus (`RENTRIX_MOBILE_UX`, `RENTRIX_COMPONENT_CONTRACT`, `RENTRIX_FINANCIAL_PRESENTATION`, `RENTRIX_VISUAL_DIRECTION`, `RENTRIX_FULL_PRODUCT_AUDIT`) + ADRs 0008/0012/0013/0014 + Wave-3/Wave-4A inventories. Conflicts are recorded, not resolved here (`13_Conflict_Report.md`).

---

## 1. Design philosophy (locked)

**Accessible Minimalism** is the global visual foundation (ADR 0012):

- Every visible element justifies its presence via hierarchy, task support, state clarity, or navigation. Decoration is subordinate to comprehension — no gradients, noise, ornamental dividers, or decorative illustration to establish hierarchy on operational screens.
- Restrained **soft depth**: depth only separates planes (page / card / elevated overlay / transient feedback). Card elevation subtle; overlays may be stronger but restrained. Finance-critical screens prefer clarity over expressiveness.
- **Semantic color**: color assigned by role, not by page. Brand blue = primary intent/selected emphasis only.
- **Hierarchy before decoration**: page purpose, urgent action, KPI/value, detail order must read before styling is noticed.
- **Arabic-first, RTL-first**: direction defaults to RTL; logical properties (`start`/`end`) mandatory for spacing/borders/alignment/icons; English and numeric fragments must not break RTL; financial values may render `dir="ltr"` for numeric stability.

Composition principle (ADR 0012, verbatim): "Bento determines composition, Enterprise SaaS Mobile determines mobile interaction behavior, Executive Dashboard determines home-page information priority, and Financial Dashboard with Drill-Down determines finance and reporting presentation. None of these replaces the others."

---

## 2. Information architecture

### 2.1 Seven top-level workspaces (consolidated 2026-08)

| Workspace (Arabic) | Contents |
|---|---|
| لوحة التحكم (Dashboard) | Home dashboard V2 |
| المحفظة العقارية (Portfolio) | Owners, Properties, Units, Lands |
| العلاقات والعقود (Relations & Contracts) | People, Tenants, Contracts, Leads, Communication |
| التشغيل والصيانة (Operations & Maintenance) | Maintenance, Utilities, Automation, Documents |
| المالية (Finance) | Financials, Invoices, Receipts, Expenses, Arrears, Deposits, Owner settlements, Bank reconciliation, Commissions |
| التقارير (Reports) | Reports, AI Assistant |
| الإدارة (Administration) | Settings, Change password, Audit log, Data integrity, System |

### 2.2 Finance routes (ADR 0008 + ADR 0014)

- `/financials` = operational index ("Quick summary"); `/reports` = executive analytics ("Detailed reports"); `finance-hub/` is a shared component shell, **not a route**. Wave-2 finance hubs: per-workflow pages consume `FinanceHubWorkspace`; legacy finance URLs redirect.

### 2.3 Mobile navigation (Rentrix mobile spec, still valid)

- Bottom bar always visible < 1024px, max 5 primary destinations: الرئيسية / العقارات / الملاك / المالية / المزيد; fixed, safe-area-aware, 56px + safe-area-inset-bottom, card background with top border.
- Drawer: hamburger (top-left in RTL), slides from right, width min(320px, 88vw), backdrop rgba(0,0,0,0.4), closes on backdrop/item/swipe.
- Physical back = browser; in-app back in page header.

### 2.4 Property 360 workspace & guided wizards

- `PropertyDetailPage`: 8 URL-addressable tabs — نظرة عامة، الوحدات العقارية، العقود والمستأجرون، المالية والتحصيلات، الصيانة والمرافق، الملكية واتفاقيات التشغيل، المستندات، سجل النشاط.
- `PropertyFormModal`: 3-step wizard (property details → ownership & management → units & review).
- Contract creation resolves covering owner agreements automatically and shows an estimated invoice-schedule preview.

---

## 3. Responsive composition

### 3.1 Mobile-first grid & breakpoints (V2 contract)

- Composition starts at **320px**, scales up. Pages must be readable/operable at 320/375/414 **without horizontal application-level scrolling**.
- 320–414px: single-column flow; KPI/quick-action groups ≤ 2 columns only if every tap target stays compliant.
- 768px: two-column summary composition allowed if RTL scan order stays top-to-bottom; long-form content prefers one readable column.
- 1024px+: 12-column (or equivalent) modular grid; wide analytics/tables span columns; supporting cards secondary.

### 3.2 Viewport acceptance matrix

| Width | Requirement |
|---|---|
| 320px | usable, no app-level horizontal scroll |
| 375px | primary small-phone acceptance |
| 414px | large-phone acceptance |
| 768px | tablet portrait acceptance |
| 1024px | desktop threshold |
| 1440px | existing desktop verification width |

Rentrix mobile spec adds device targets: design at 390px first, verify at 360px; supported 360×800, 390×844, 430×932, 768×1024 (both docs consistent; V2 matrix governs).

### 3.3 Horizontal scroll rule

No application-level horizontal scrolling. Component-level scrollers allowed only for dense tables or chips/tabs that cannot collapse further — and they must be keyboard-focusable, preserve focus visibility, and indicate overflow affordance.

### 3.4 Progressive disclosure on mobile

Secondary analytics, complex filters, low-priority metadata, long action lists collapse or move to sheets/expanders on small screens. Summary first, detail on demand.

### 3.5 Bento usage rules

**Allowed:** summary cards, KPI groups, quick actions, status groups, dashboard queue modules, lightweight drill-entry analytics summaries.
**Prohibited:** dense accounting tables on desktop; long/ledger-like record lists needing row comparison; replacing report tables with decorative card mosaics; asymmetry that harms scan order.

---

## 4. Interaction safety (non-negotiable)

- Minimum interactive area **44×44px** (preferred table rows 44–48px height; form inputs 44–48px height).
- Keyboard focus always visible in both themes. No core action hover-only.
- Async actions must show visible loading feedback.
- Destructive actions require explicit confirmation.
- **Swipe must never directly commit** payment, posting, deletion, refund, settlement approval, or any irreversible financial operation (swipe may reveal actions only).
- Structural icons from one governed family: **Lucide SVG via `lucide-react`**. No emoji as structural icons. A new icon family requires explicit approval.
- Reduced-motion support mandatory.

---

## 5. States contract

Every screen must define and distinguish: **loading** (skeleton for content-level waits), **empty**, **error with retry**, **stale**, **partial-data**, **permission-denied**, and **no-results**. Never render a failure as an Empty state (no fake zeros, no fake data). Wave-4A provides shared `LoadingState`, `EmptyState`, `ErrorState`, skeletons for these.

Status semantics (5 roles, always with non-color indicators):
- **success** — success/posted-positive states only.
- **warning** — caution, partial completion, aging attention.
- **destructive (danger)** — destructive, overdue, blocked, loss.
- **info** — draft, informational, non-blocking.
- **neutral** — archived, void, inactive, reference-only.

Color is never the only status indicator (WCAG). Emerald/success tokens reserved for success-only (semantic mandate from Wave-3); raw Tailwind palette classes banned in product UI.

---

## 6. Typography, numerals & money presentation

- **Cairo** remains the application font (external Google Fonts dependency flagged as an operational item).
- Hierarchy: Title 28–32/700; Page heading 24–28/700; Section 18–20/600; Body 16–18/400–500 (min 16px); Label 14/500–600; Caption 12–13/400–500. Financial numbers: 14–16px in tables, 20–28px in summaries, weight 600–700, `tabular-nums` where supported (token to be introduced intentionally, not ad hoc).
- Arabic body keeps generous line-height (1.55–1.7); no letter-tracking tricks on Arabic.
- **Numerals: Latin digits enforced in code** (`rentrix-app/src/lib/formatters.ts`, `-u-nu-latn`, since PR #1298). The older `RENTRIX_FINANCIAL_PRESENTATION.md` specified Eastern Arabic numerals (١٬٢٥٠٫٥٠٠) — superseded by code truth; confirmation recorded as an open item (C-06).
- Amount presentation: OMR, 3 decimal places, server-side rounding 0.001; amounts directionally stable in RTL via `dir="ltr"` islands; currency and decimal precision explicit and consistent everywhere.

---

## 7. Color, shape, motion

- Full light/dark token pairs required per semantic role (V2 token table; numeric targets in `MALEK_VISUAL_CONTRACT_V2_TOKEN_PROPOSAL.md`). Light mode is default; dark via existing `data-theme` mechanism. Near-white light canvas; deep non-black dark canvas. **No new purple/indigo palette.**
- Accessibility: WCAG AA mandatory; ≥ 4.5:1 normal text; ≥ 3:1 large text/glyphs.
- Radius: card ~14px, input ~12px, button ~12px, sheet/dialog ~16px, pill/badge/chip full radius.
- Depth: soft neutral/brand-tinted shadows sparingly; no decorative blur-heavy glass/claymorphism/neon/theatrical depth on finance-critical screens.
- Motion: 150–300ms micro-interactions; communicates state/continuity/loading; no decorative infinite animation on operational screens; press feedback transform-only without layout shift.

---

## 8. Dashboard content contract

- 4–6 primary KPIs max above the fold; urgent exceptions/required actions before secondary analytics.
- Quick actions reflect real role/permission availability.
- No dense accounting table on home Dashboard.
- Every summary card links to a real detail destination.
- Loading/empty/stale/error/partial states defined.
- Content order: (1) page context/greeting, (2) urgent exceptions, (3) KPI cluster, (4) queues/follow-up, (5) secondary analytics.
- V2 proof scope: `[data-visual-contract='v2']` wrapper, Dashboard-first, then promotion only after Phase-2 approval.

---

## 9. Financial & reporting contract

- Summary first, detail second; **every KPI/report total drills down** to source records or nearest valid detail; **filters preserve context** while drilling.
- Tables remain tables for genuinely tabular data; desktop does not convert every financial row into a Bento card; mobile may summarize a record as a card that opens full detail.
- Positive/negative status never by color alone.
- Financial amounts directionally stable in RTL.

---

## 10. Forms & enterprise composition layer

- Forms contract (legacy `RENTRIX_COMPONENT_CONTRACT`, still operative): `EntityForm.Overlay` pattern; consistent sections/validation/error surfacing; sticky action footers safe-area aware (Wave-4A `enterprise-sticky-footer`).
- **Wave-4A enterprise layer** (`src/components/enterprise/`, additive-only, merged #1369): `EnterprisePage` shell (header/stats/toolbar/content/footer), `EnterpriseDataTable` (sort/filter/pagination/selection/keyboard grid), drawer framework (Create/Edit/View/Preview side-sheet), `EnterpriseModal`, `EnterpriseConfirmDialog` (incl. type-to-confirm), form layout engine (sections/tabs/cards), config-driven filters/search, bulk & row actions, state surfaces and state hooks. Future module migrations (Contracts, Properties, Owners, Tenants, Payments, …) consume these; no module migrated yet.
- Wave-3 (merged #1368): visual primitives + tokens (`components/ui/*`, `styles/tokens.css`) — inventory in `rentrix-app/docs/wave-3-design-system-inventory.md`.

---

## 11. Print/PDF & acceptance

Unified `documentService` print/PDF platform (PR2: all 17 callers migrated; PR3: acceptance evidence). Print contract: RTL-correct documents, MALEK lockup per asset contract, Latin numerals, OMR 3dp, no screen-only color dependence.

Every V2-compliance claim must verify: RTL, light, dark, keyboard navigation, reduced motion, large/dynamic text, iOS safe-area as installed PWA — across the §3.2 viewport matrix.

---

## 12. Explicitly rejected / banned

- Indigo/Violet gradient branding; Plus Jakarta Sans (from style #83) — rejected.
- React Native-only APIs, mandatory haptics, native shared-element transitions — rejected (web PWA).
- Swipe-to-execute irreversible financial actions — rejected.
- Global big-bang redesign — rejected (phased rollout only).
- Third-party mockups/demo comps/screenshots as visual acceptance sources — rejected (evidence only).
- Glassmorphism/theatrical depth (legacy visual direction) — rejected for finance-critical screens.
- Emoji as structural icons; raw Tailwind palette utilities in product UI; color-only status — banned.
