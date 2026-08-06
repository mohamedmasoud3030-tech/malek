# ADR 0014 — MALEK Visual Contract V2, Wave 2 Finance & Reporting Treatment

## Status

Accepted — 2026-08-06.

## Context

Wave 1 (PR #1357, merge SHA `f84dc96d6d5698af227f226e03ca2cfb00a06f7b`) completed the Malek Pro visual system adoption for operational surfaces:

- App shell, navigation, mobile drawer, mobile bottom navigation
- Shared UI primitives
- Properties, Contracts, Maintenance, Owners, People, Units, Settings
- Portfolio hub, Relationships hub
- Semantic token cleanup
- ADR 0013 and Wave 1 conformance audit

Wave 1 intentionally excluded Finance and Reporting to avoid mixing operational UI changes with financial-critical flows. ADR 0012 Phase 4 explicitly defined Finance/Reporting treatment as a separate phase that must preserve table fidelity and drill-down clarity.

Current finance/report inventory (verified from `rentrix-app/src/app/router/route-tree.ts` and filesystem):

**Primary finance hubs (new IA):**
- `/financials` → `rentrix-app/src/features/financials/financials-page.tsx` — summary + workflow groups
- `/finance/collections` → `collections-hub-page.tsx` → tabs: invoices, receipts
- `/finance/expenses` → `expenses-arrears-hub-page.tsx` → tabs: expenses, arrears
- `/finance/deposits` → `deposits-settlements-hub-page.tsx` → tabs: deposits, owner_settlements
- `/finance/banking` → `banking-commissions-hub-page.tsx` → tabs: bank_reconciliation, commissions

**Legacy redirects (must remain redirects, not modified in Wave 2):**
- `/invoices` → `/finance/collections?section=invoices`
- `/receipts` (list) → `/finance/collections?section=receipts`; **excluded**: `/receipts?receiptId=...` printable A4 surface
- `/expenses` → `/finance/expenses?section=expenses`
- `/arrears` → `/finance/expenses?section=arrears`
- `/deposits` → `/finance/deposits?section=deposits`
- `/owner-settlements` → `/finance/deposits?section=owner_settlements`
- `/bank-reconciliation` → `/finance/banking?section=bank_reconciliation`
- `/commissions` → `/finance/banking?section=commissions`
- `/accounting` → `/financials`

**Reports:**
- `/reports` → `rentrix-app/src/features/reports/reports-page.tsx`
  - Sections: overview, property_analytics, overdue, occupancy, collections, expenses, maintenance_analytics, deferred_revenue, statements, accounting
  - Components: `ReportsWorkspace.tsx`, `ReportsFilterSurface.tsx`, `ReportsHero.tsx` (deprecated), filter summary, accounting panels (trial-balance, income-statement, balance-sheet), collections panels (daily-collections, receipt-links, rent-roll), overdue panels, statements panels.

**Shared finance/report presentation components (Wave 2 scope limited to these):**
- `finance-hub-workspace.tsx`, `finance-hub-model.ts`, `finance-hub-sections.ts`
- `financials/components/*` — invoice-workspace-section, invoice-list-section, invoice-filters, invoice-summary-cards, invoice-detail-section, receipts-section, receipt-detail-card, arrears-*, expenses-section, etc.
- `financials/invoices/*`, `expenses/*`, `deposits/*`, `reconciliation/*`, `reports/*` — **presentation layer only**
- `reports/components/*` — ReportsWorkspace, FiltersPanel, OverviewSection, CollectionsSection, ExpensesSection, AccountingReportsSection, etc.
- `commissions/components/*`
- `owners/components/OwnerSettlementWorkspace.tsx` (settlement tab)
- `PageLayout` / `EmbeddableWorkspace` wrappers for finance only, when regression fix required

**Explicitly out of scope:**
- Printable receipt surface `/receipts?receiptId=...` (A4 print engine)
- Print/PDF/A4 documents, document templates
- Dashboard V2
- Properties, Contracts, Maintenance, Owners, People, Units, Settings
- App shell except direct regression fix caused by Wave 2 wrapper
- Any non-finance route/module
- Any accounting migration, backfill, Supabase change, RLS/RPC/grants, permissions, mock/fake data

Overlap map at start of Wave 2:
- Open PR #1355 `audit/s03-t01-gl-gap-matrix` touches only `docs/accounting/S03_T01_GL_GAP_AUDIT.md` — no file overlap with finance/reporting UI.
- No other open PRs touch finance/report files.
- Therefore Wave 2 can proceed without presentation-layer collision avoidance wrappers; if future overlap appears, commits must remain isolated and re-applicable.

## Decision

### Scope lock
- Wave 2 is **Finance & Reporting only**. No expansion into operational modules already completed in Wave 1, nor into Dashboard V2, nor into print surfaces.
- Visual treatment applies to the inventory listed above and their direct drill-down/detail destinations (invoice detail, receipt detail, expense detail, deposit detail, bank reconciliation detail, commission detail, report drill tables).

### Financial logic protection (non-negotiable)
- **Do not change business rules.**
- **Do not change accounting calculations.**
- **Do not change database schema or migrations.**
- **Do not change RLS or RPCs or grants.**
- **Do not change invoice/payment/receipt/settlement states or transitions.**
- **Do not change currency or rounding policies.**
- **Do not change Print/PDF or document generation.**
- **Do not change VAT logic, commission logic, settlement calculations, allocation logic, reconciliation logic.**
- **Do not change database queries to alter result semantics.**
- **Do not change permissions, authorization guards, audit logs.**

Only **presentation** changes are allowed: query consumption, view-model formatting, layout hierarchy, loading/empty/error states, semantic token mapping, desktop table preservation, mobile card presentation, keyboard and accessibility refinements.

Every presentation component must be provably non-mutating: no direct business mutation from UI presentation components; existing service hooks remain the only mutation entry points.

### Visual contract specifics
- **Semantic tokens mandatory.** All color/surface intent in Wave 2 files must use tokens defined in `rentrix-app/src/styles/tokens.css` and bridged in `globals.css` via `@theme inline`: `bg-background`, `bg-card`, `bg-card-muted`, `bg-primary`, `text-primary-foreground`, `text-foreground`, `text-muted-foreground`, `border-border`, `border-light`, `text-success`, `bg-success`, `bg-success-bg`, `text-warning`, `bg-warning`, `bg-warning-bg`, `text-destructive`, `bg-destructive`, `text-info`, `bg-info`, etc. Actual token existence must be verified before use.
- **Raw Tailwind palette classes forbidden** inside Wave 2 scope: no `emerald-*`, `slate-*`, `blue-*`, `red-*`, `amber-*`, `rose-*`, `violet-*`, `green-*`, `yellow-*` etc.
- **MALEK blue stays primary action color**: `bg-primary` / `text-primary-foreground` / `ring-primary`.
- **Green stays success state only**: `text-success` / `bg-success-bg` for posted/paid/healthy, not for primary actions or active navigation.
- **Finance tables stay tables on Desktop.** No conversion of accounting rows into Bento cards on ≥1024px. Preserve horizontal comparison, column hierarchy, sticky header where existing, `tabular-nums` for numbers, numeric LTR islands in RTL.
- **Component-level horizontal scroll allowed only when necessary.** Scroller must be keyboard-focusable (`tabIndex=0`), labeled via `aria-label`, `role="region"`, focus-visible ring via semantic token, no application-level horizontal overflow (`overflow-x-clip` preserved).
- **Mobile (320/375/414) uses compact record cards or stacked rows** when table is not viable. Every record card must open a valid drill destination (detail view or filtered report). Card must show amount, status, date, counterparty. One primary action only; secondary actions in menu/bottom-sheet. No swipe-to-execute for irreversible financial actions (pay, post, delete, refund, settlement approval).
- **All KPIs/totals must drill to source.** No fake numbers. KPI must be built from real current data, link to real tab/filter/page, preserve filters: period, property, owner, tenant, status, existing filters.
- **Filters and context preserved during drill-down.** URL search params (`section`, `status`, `dateFrom`, `dateTo`, `propertyId`, `tenantId`, etc.) remain intact across navigation; back navigation returns to previous context.
- **Color is not the sole status indicator.** Every status badge must have text label + semantic color + icon/shape when needed + accessible name. Status mapping unified:
  - Success/posted/paid: semantic success (`text-success` / `bg-success-bg`)
  - Warning/partial/aging: semantic warning (`text-warning` / `bg-warning-bg`)
  - Overdue/blocked/failed: semantic destructive (`text-destructive` / `bg-destructive/10`)
  - Draft/informational: semantic info (`text-info` / `bg-info/10`)
  - Archived/void/inactive: semantic neutral (`text-muted-foreground` / `bg-muted`)

### Page hierarchy (Finance hubs)

Every finance hub must follow:

1. Page context and title (`PageHeader` with description)
2. Critical alerts / blocked actions (real permissions, document readiness)
3. Summary KPIs (real data, drill-down enabled)
4. Filters and period context (preserved in URL, bottom-sheet on mobile if complex)
5. Main table/list (desktop table, mobile cards)
6. Drill-down / detail entry points (row click, actions)
7. Secondary analytics in lower priority position (if any)

No large hero, no wide empty spaces, no oversized cards that consume viewport.

### States

Every finance/reporting surface must have explicit states:
- Loading (skeleton, `role="status"`, aria-label)
- Empty (EmptyState component with title/description, not hiding error)
- Error (DataErrorScreen / error title, retry button)
- Retry (focus restoration)
- Stale data (if useQuery stale, optional notice)
- Partial data (when some reports succeed, some fail)
- Permission denied (AccessDenied with message, not empty)
- No results after filtering (EmptyState with filter context, not generic)

Query failure must never render as Empty.

### Wrapper strategy

- Reuse `[data-visual-wave='malek-pro']` contract introduced in Wave 1 for finance roots to avoid third token system. This wrapper provides subtle shadow/border hierarchy and 44px control targets.
- Finance hubs that already use `PageLayout` or `EmbeddableWorkspace` add `visualVariant="malek-pro"` prop (existing API). No global `:root` replacement.
- If a finance page needs additional scope without PageLayout, wrap with `<div data-visual-wave="malek-pro">` and document in audit.
- Do not create competing token system; do not edit `tokens.css` values; only consume existing tokens.

### Accessibility and responsive contract

- Viewport matrix: 320px, 375px, 414px, 768px, 1024px, 1440px must be verified.
- Conditions: RTL, Light, Dark, Reduced motion, Keyboard navigation, Large text where possible.
- Checks: no body/document horizontal overflow, primary controls ≥44×44, tables preserve critical columns, mobile cards open real detail, filters preserved, drill-down returns to context, empty does not hide error, dark mode no contrast regression, focus rings visible via `focus-visible:ring-primary`.

### Testing contract
- Unit/component: KPI drill-down, filter preservation, tab preservation, desktop table behavior, mobile card detail navigation, loading/empty/error distinction, keyboard navigation/focus restoration, status labels with non-color indicators, numeric alignment in RTL (LTR islands), permission-aware actions, no fake data, no direct mutation from presentation components.
- Browser/E2E: viewport matrix + theme/RTL checks via existing fixtures; document results in audit.
- Quality gates: use actual scripts from `rentrix-app/package.json`; no invented scripts; document lint alias if is alias.

## Consequences

- Finance/reporting surfaces gain same visual hierarchy, token safety, and mobile discipline as Wave 1 operational surfaces, without touching accounting logic.
- Any raw palette class introduced in a Wave 2 file is a regression against this ADR.
- KPI or total without drill destination is a defect.
- Filter loss during drill-down is a defect.
- Status shown only by color is a defect.
- Application-level horizontal overflow introduced by Wave 2 is a defect.
- Mobile swipe converting to irreversible financial action is a defect.
- Expansion beyond listed inventory requires new ADR; Wave 2 does not authorize it.

## Verification

- This ADR was authored after reading `route-tree.ts`, `finance-hub-*` pages, `financials-page.tsx`, `reports-page.tsx`, `tokens.css`, `globals.css`, `malek-pro-visual-wave.css`, Wave 1 audit, ADRs 0011-0013, and verifying open PR #1355 has no overlap.
- Base SHA: `f84dc96d6d5698af227f226e03ca2cfb00a06f7b` (latest main at time of branching)
- New branch: `fix/ui-malek-pro-visual-wave-2-finance-reporting`
- Evidence will be recorded in `docs/audits/MALEK_VISUAL_WAVE_2_FINANCE_REPORTING_AUDIT.md`.
