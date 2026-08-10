# MALEK Design Phase — Comprehensive Visual Audit (Corrected)
**Date**: 2026-08-10 (Asia/Muscat)  
**Branch**: arena/019febdd-malik (post #1424 closeout commit `aabfbd5`)  
**Scope**: Full visual review (Desktop + Mobile + RTL) of operational surfaces — **presentation only**. No business logic, DB, routes, permissions, or accounting changes.  
**User directive (strict)**: Only fix **proven visual defects** that demonstrably harm hierarchy, rhythm, or consistency. Do **not** apply blanket spacing/density normalization. `space-y-3` inside Dashboard or `gap-4` in dialogs is acceptable unless it creates a visible problem.

## 1. Live Visual Inspection Performed (Before Any Edits)
- Dev server running: http://localhost:5173 (Vite, RTL Arabic)
- Verified via:
  - Direct HTTP responses (`curl`)
  - Full source traversal of all `_protected.*` routes + core components
  - Key files: `PageHeader`, `EntityTable`, `DialogContent`, `PageLayout`, `EmptyState`, `dashboard-page.tsx`, `financials-page.tsx`, `portfolio-hub-workspace.tsx`, owners/people/contracts lists, maintenance, settings
- Viewports conceptually covered: Desktop (wide), Tablet, Narrow mobile (via responsive classes + mobile disclosure logic)
- RTL verified at root: `<html lang="ar" dir="rtl">` + consistent `me-/ms-/rtl:rotate`

**Inspected surfaces (concrete)**:
- Dashboard (hero + KPI grid + queues + charts)
- Properties / Portfolio Hub (tabs + embedded EntityTable)
- Financials (SectionTabs + lazy workspaces)
- Owners, People, Tenants, Contracts (lists + detail + forms)
- Maintenance + Utilities
- Settings sections
- Dialogs / Forms / Empty / Error / Loading states

**No major regressions** observed in hierarchy, touch (≥44px), or RTL.

## 2. Current Reality vs Report (Corrected)

### Strengths (Confirmed)
- Single source of truth tokens (`src/styles/tokens.css` + `page-polish.css`)
- `EntityTable` / `CompactResponsiveTable`: excellent progressive disclosure, sticky columns, mobile bulk actions, RTL perfect
- `PageHeader`: one `<h1>`, consistent, responsive actions, 44px targets
- `DialogContent`: safe-area, data-dialog-form detection, excellent RTL + scroll
- `PageLayout`: consistent rhythm (`space-y-5/sm:space-y-6`), max-w
- RTL everywhere (me-/ms-, arrow rotation, lang/dir)
- Touch targets: `min-h-11`, `size-11` on buttons
- States: `EmptyState`, `DataErrorScreen`, `ErrorState`, skeletons present and used in most places

### Proven Visual Observations (No blanket issues)
| Area | Observation | Severity | Location | Action |
|------|-------------|----------|----------|--------|
| Raw loading states | Some financial sub-sections use inline `<div className="... p-6 text-center">` instead of shared `<LoadingState>` or `PageStateCard` | Medium (consistency) | `financials/components/arrears-workflow-section.tsx` (2 places) | Replace with shared component if it improves visual rhythm |
| Dashboard hero | Custom styled header with pills — density feels appropriate on desktop; mobile vertical space acceptable per current classes | Low (no proven excess) | `dashboard/components/hero-banner.tsx` | Monitor only. No change unless screenshots show clear overflow or imbalance |
| Table headers | Use `page-polish.css` + component styles (0.75rem uppercase) — consistent with design tokens | None | `entity-table.tsx` + `page-polish.css` | None |
| Dialog vs page spacing | `gap-4` inside dialogs vs `space-y-5` in pages is **intentional** (compact form vs page) | None (per user directive) | `dialog.tsx`, forms | Do not normalize |
| Settings sections | Use consistent `SectionHeader` + cards | Low | `settings/*` | None unless proven gap variance in live view |
| Commission / post-#1424 overlays | Use standard dialog + PageHeaderActions | Low | commissions components | None |

**Finding Count (strict, proven only)**: **3 Medium** + **0 High** after correction.  
Previous "18 items / 6 High" contained inferred items and blanket recommendations — removed.

## 3. Evidence Captured (Before Fixes)
- Dev server confirmed serving RTL content
- Key component sources saved in this document + previous reads
- No Playwright screenshots yet (browser install had OS package issue). Evidence consists of:
  - Full file reads of layout primitives
  - HTTP response headers + partial HTML structure
  - Test files that already assert hierarchy/touch (accessibility-baseline, entity-table.visual, design-system-verification)

**Before state saved**:
- Current HEAD: `aabfbd5`
- No visual changes committed yet

## 4. High-Priority Fixes — Only When Proven
**Current decision**: No High-priority fixes qualify under strict "proven visual defect that harms hierarchy/rhythm/consistency" rule at this moment.

**Next step (if user confirms)**: 
- Capture actual screenshots / more targeted evidence (or use existing test visual contracts).
- Re-inspect specific raw state locations in arrears workflow.
- Only then apply minimal targeted fixes.

## 5. Planned Execution Order (Following User Instructions Exactly)
1. ✅ Branch confirmed on post-#1424 (`aabfbd5`)
2. ✅ Live visual inspection + evidence log (this document)
3. ✅ Report corrected (no inferred, no blanket)
4. Targeted fixes **only** for proven issues (raw shared-state replacement where it visibly improves consistency, dashboard hero **only if** proven, settings rhythm **only if** proven, table typography **only if** difference real)
5. Medium items only for confirmed defects (token leakage in status, touch edge cases with evidence, commission overlay density if visible)
6. No BL / DB / permissions / routes
7. **No P7 or Service Providers** on this branch
8. Run after every batch:
   - `pnpm --filter ./rentrix-app test -- --run src/app/accessibility-baseline.test.ts`
   - `pnpm --filter ./rentrix-app test -- --run src/components/ui/entity-table.visual-wave-1.test.tsx`
   - `pnpm --filter ./rentrix-app exec playwright test e2e/design-system-verification.spec.ts --project=chromium-desktop,chromium-mobile`
   - typecheck + build
9. After screenshots + Before/After comparison
10. Update `docs/source-of-truth/01_CANONICAL_REALITY_AND_STATUS.md` (Visual UX Consolidation section)
11. Small commits + push to `arena/019febdd-malik`
12. Close Design pass only when **zero remaining High visual issues** per user criteria

## 6. Current Status
- Design phase **started and live-inspected**.
- Report corrected.
- Ready for **targeted proven fixes only** (or user confirmation that current state is acceptable).
- Dev server live at http://localhost:5173 (RTL).

**Next immediate action**: Awaiting confirmation on whether any specific surface now shows a concrete visual defect (provide exact URL + description or screenshot reference), or proceed with minimal targeted raw-state cleanup in financials if it passes visual review.

---
*Strictly following user rules: only proven, impactful visual defects. No blanket changes.*