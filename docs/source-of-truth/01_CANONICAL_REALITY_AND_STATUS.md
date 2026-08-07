# MALEK — Canonical Reality & Status (Document 1)

> **Execution-Ready Source of Truth.** Created on 2026-08-07. This document is the authoritative feature-reality catalog: what exists, what is verified complete, what is partial, and what is intentionally untouched. Status changes require evidence (implementation + tests + reachable UI), recorded in the evidence column.

---

## 1. Feature Status Catalog

Legend: `VERIFIED_COMPLETE` = implemented, connected to real data, reachable, user-visible, actions + permissions + loading/error/empty states work, mobile acceptable, no demo/mock. `PARTIAL` = safe core exists, boundary item blocked. `NOT_STARTED` = deferred by owner decision.

### A — User Experience Foundation (Wave 4A + continuous program)

| Feature | Status | Evidence |
|---|---|---|
| Enterprise UX foundation (page/drawer/modal/form/table/state surfaces) | `VERIFIED_COMPLETE` | `src/components/enterprise/*`, Wave 4A (#1369) |
| Hub consolidation (finance/portfolio/operations/relationships) — one SectionTabs per hub, URL `?section=` deep links | `VERIFIED_COMPLETE` | `hub-navigation-contract.test.ts`, `finance-hub-architecture.test.ts` |
| Create/Edit/View journeys stay inside the workspace: properties (create+edit modal), units (modal), owners (dialog), tenants (modal), people (modal), invoices (in-workspace detail + collect), receipts (inline detail + print tab), expenses (overlay), maintenance (overlays), commissions (overlay), owner settlements (overlays) | `VERIFIED_COMPLETE` | routes `_protected.people.*`, `_protected.properties.*`, `_protected.contracts.*`; per-module interaction tests |
| People create/edit routes → centered modal over directory (no full-page journey) | `VERIFIED_COMPLETE` | 2026-08-07, `feat/continuous-product-completion` commit `7a02d4d6` |
| Property edit route → centered modal over detail workspace | `VERIFIED_COMPLETE` | commit `8aaffc9e` |
| Contract create/edit routes → centered modal over workspace context | `VERIFIED_COMPLETE` | commit `5f585a06`; `contract-form-workflow.test.ts`, `ux041-agreement-recovery.test.tsx` |
| Compact enterprise forms (sensible width, grouped fields, responsive grids, progressive disclosure, dirty protection, single-pass validation) | `VERIFIED_COMPLETE` | `form-single-pass-validation.test.ts`, `mobile-accessibility-ux.test.ts` |
| Quick collect deep link stays in invoice workspace (`?invoiceId=&collect=1`) | `VERIFIED_COMPLETE` | `quick-collect.ts`, `useInvoiceWorkspaceController.ts` |
| Mobile surfaces: tables degrade to cards in all primary workspaces | `VERIFIED_COMPLETE` | `MobileCard`/`renderMobileCard` in properties/owners/units/people/tenants/contracts/invoices/receipts/expenses/arrears/deposits/commissions/reconciliation/maintenance/utilities |

### A3 — Reports experience (consolidation)

| Feature | Status | Evidence |
|---|---|---|
| Reports grouped into 3 macro categories: LIVE OPERATIONAL INSIGHTS / ANALYTICAL VIEWS / FORMAL REPORTS, with grouped tab clusters and category headings | `VERIFIED_COMPLETE` | `reports-page.sections.ts` (`category`), `ReportsWorkspace.tsx`, `reports-groups.test.ts`; commit `21d5ebe2` |
| All 10 report sections, calculations, RPCs, and `?section=` deep-link contract preserved | `VERIFIED_COMPLETE` | `reports-section-model.test.ts`, `reports-groups.test.ts` |
| Operational insights embedded in operational screens (collections KPIs in receipts, arrears summary + aging in arrears workspace, settlements KPIs, property financials/contracts tabs) | `VERIFIED_COMPLETE` | `receipts-page.tsx`, `arrears-workflow-section.tsx`, `OwnerSettlementWorkspace.tsx`, `property-detail-page.tsx` |
| GL/accounting logic untouched by the reports consolidation | `VERIFIED_COMPLETE` | no GL files modified in this program |

### C — Bank Reconciliation UX

| Feature | Status | Evidence |
|---|---|---|
| Structured import flow (select → preview → mapping → review → importing → completed), fail-closed batch validation | `VERIFIED_COMPLETE` | `bank-csv-import-workflow.tsx`, `bankCsvImportService.ts` |
| Duplicate detection (file hash, row-level, possible duplicates) surfaced in UI | `VERIFIED_COMPLETE` | import result panels |
| Unmatched list with filters, suggested deterministic matching (date+amount), ignore flow, match confirmation, reconciliation status KPIs | `VERIFIED_COMPLETE` | `bank-reconciliation-page.tsx`, `useBankReconciliationController.ts` |
| Final accounting approval authority beyond match/ignore (FGR-006 approval flow) | `PARTIAL` — blocked | pending owner decision on approval role (see OD-04/approval-role); all work up to the boundary is shipped |
| **Owner-audit nuance (2026-08-07):** the whole E9 feature carries the owner-audit label `PARTIALLY_IMPLEMENTED` until approval flows (FGR-006) and the upload wizard land | `PARTIAL` (owner-audit label) | arena commit `9b6564c0` context; label adopted, not overwritten |

### D — Owner Settlements UX

| Feature | Status | Evidence |
|---|---|---|
| Draft creation from server-derived preview only (no client amounts), idempotent writes | `VERIFIED_COMPLETE` | `OwnerSettlementWorkspace.tsx`, `owner-settlements-service.ts` |
| Source collections/expenses visibility in preview (payments count, source, VAT policy) | `VERIFIED_COMPLETE` | preview breakdown panel |
| Stale-input warning when scope changes and server recalculates | `VERIFIED_COMPLETE` | commit `ee3fdcee` |
| Atomic reservation visibility (D14 note) | `VERIFIED_COMPLETE` | commit `ee3fdcee` |
| Payout preview with explicit payable amount, recipient, period, method | `VERIFIED_COMPLETE` | commit `ee3fdcee` |
| Explicit post-payment status on settlement cards (paid date / approved / cancelled) | `VERIFIED_COMPLETE` | commit `305b459c` |
| First-run ADMIN supervision UX (banner: needs-ADMIN + first-cycle supervision reminder) | `VERIFIED_COMPLETE` | commit `c067d1b0`; focused tests |
| Approval (ADMIN) → payout (ADMIN) with print/PDF owner statement | `VERIFIED_COMPLETE` | workspace + `documentService` |
| Negative-balance collection accounting (Due-from-Owner recovery) | `NOT_STARTED` — blocked | OD-08 owner decision required |
| **Owner-audit nuance (2026-08-07, arena branch 019fdb42):** the whole E7 feature is classified `PARTIALLY_IMPLEMENTED` until first-run ADMIN supervision is formalized and OD-08 collection rules resolve | `PARTIAL` (owner-audit label) | arena commit `9b6564c0` (author: repo owner); tip of that branch is superseded (`# placeholder`) — label adopted here, not overwritten |

### E — Contract Experience

| Feature | Status | Evidence |
|---|---|---|
| 4-state lifecycle UX: draft/active/expired/terminated, renew dialog, termination dialog with reason, state badges | `VERIFIED_COMPLETE` | `lifecycle/*`, `ContractDetailSections.tsx` |
| Documents shell, payments tab (invoices + payments), financial timeline, agreement-coverage recovery | `VERIFIED_COMPLETE` | `contractDocumentsShell.tsx`, `contractPaymentsTab.tsx`, `ContractAgreementMissingAlert.tsx` |
| Payment schedule preview inside the form | `VERIFIED_COMPLETE` | `contract-schedule-preview.ts` + `ContractFormFields.tsx` |
| Compact create/edit modal over workspace context | `VERIFIED_COMPLETE` | commit `5f585a06` |
| Maker-Checker lifecycle, signature verification, future 8+2 legal states | `NOT_STARTED` — blocked | Stage S04; needs owner/legal decision (OD-03 templates, OD-04 roles) |

### B / F — Safe completeness

| Feature | Status | Evidence |
|---|---|---|
| Loading/error/retry/empty states with actions in all primary workspaces | `VERIFIED_COMPLETE` | `AsyncContentState`, `PageStateCard`, `EmptyState` across modules |
| Document vault upload validation (mime + 5MB contract, accept attribute) | `VERIFIED_COMPLETE` | `attachments-contract.ts`, `documents-vault-service.ts` |
| CSV export with UTF-8 BOM, dated filenames | `VERIFIED_COMPLETE` | `csvExport.ts`, `reports-page.helpers.ts` |
| Navigation exposure: all safe features reachable from hub child nav + mobile drawer; 5 primary mobile destinations | `VERIFIED_COMPLETE` | `app-nav-items.ts` |
| Permission-consistent UI (void/approve/pay/export gates) | `VERIFIED_COMPLETE` | `permissions.ts` + per-workspace gates |

---

## 2. Visual UX Consolidation Pass (2026-08-07, same program/PR lineage)

Presentation-only normalization; no business behavior, routes, permissions, RPCs, or DB changes.

| Item | Status | Evidence |
|---|---|---|
| Login: single centered compact auth card (no split layout, no promotional command-center panel, restrained lockup) | `VERIFIED_COMPLETE` | `login-page.tsx` + additive tests; real Chromium smoke at 390px/1440px (0px horizontal overflow, card fits viewport) |
| Compact operational page headers: jargon/promotional descriptions trimmed to one concise line (finance workspaces + 4 finance hub entries) | `VERIFIED_COMPLETE` | workspace page components; `page-header.test.tsx` intact |
| One heading hierarchy: EntityDetailHeader normalized to the standard PageHeader scale (text-xl sm:text-2xl) | `VERIFIED_COMPLETE` | `entity-detail-header.tsx` |
| Reports tab clusters use compact inline category labels (mobile) while keeping the 3-category architecture | `VERIFIED_COMPLETE` | `ReportsWorkspace.tsx` |
| Shared primitives audit (buttons/inputs/cards/tables/modals/forms/filter pills/status pills/empty states) — found already normalized on one token system; no second design system created | `VERIFIED_COMPLETE` | `tokens.css`, `malek-pro-visual-wave.css`, `page-polish.css`, component audit |
| Full-surface consistency sweep (dashboard, properties, units, owners, people, contracts, finance hubs, invoices/collections, expenses, deposits, reconciliation, settlements, reports, maintenance, utilities, automation, vault, settings/system, change-password, audit log) — all on the standard PageHeader/PageLayout/EntityForm/EntityTable family; mobile cards present everywhere; no fixed-width breakage | `VERIFIED_COMPLETE` | component audit + targeted suites (346 tests) |
| Dashboard/reports restraint (hero + KPI cards already compact; calculations preserved) | `VERIFIED_COMPLETE` | `hero-banner.tsx`, `FinanceKpiCard` |
| Operational-route page headers: removed the Wave-2 dark-gradient hero cards + decorative rings (promotional feel); operational pages now use the standard compact PageHeader | `VERIFIED_COMPLETE` | `malek-pro-visual-wave.css` (hero block removed); commit `2a2df3a7` |
| Finance/reports hub descriptions trimmed to operational one-liners (i18n) | `VERIFIED_COMPLETE` | `lib/i18n.ts`; i18n contract tests pass |
| Safe cascade warnings: property + unit archive dialogs list the exact backend guard preconditions | `VERIFIED_COMPLETE` | `properties-list-page.tsx`, `units-list.tsx`; commits `9c66cc50`, `246bb18d` |
| Repo hygiene: repaired two `evidence/preflight` links broken by #1373's `docs/APP_STATUS.md` removal (pre-existing on main; was failing the CI docs gate on every PR) | `VERIFIED_COMPLETE` | commit `a3343775`; `check-doc-links` passes |
| Repo hygiene: `product-accounting-decision-gates.test.ts` re-sourced from ADR 0001 (it read two docs deleted by #1373 as superseded; ADR 0001 explicitly records the same gates + FGR-008..013 as decided-but-implementation-pending). Same gate topics and FGR visibility pinned; CI build/release-blocker gates unblocked | `VERIFIED_COMPLETE` | commit (next); targeted test passes |
| Dead legacy route-wrapper cleanup: removed 9 unreferenced wrapper files (`_protected.arrears.tsx`, etc.) where `route-tree.ts` provides canonical redirect and no runtime import depends on wrapper | `VERIFIED_COMPLETE` | `src/routes/_protected.*.tsx` |
| Settings / Governance flattening: removed duplicate inner Settings sections (`security`, `governance`, `integrity`, `role-simulator`) from `SettingsWorkspace` while keeping canonical top-level Governance destinations | `VERIFIED_COMPLETE` | `settingsSections.ts`, `settings-operations-sections.tsx` |
| General Ledger read-only UI: surfaced `chartOfAccountsService`, `accountingPeriodsService`, and `journalService` in read-only General Ledger Core section (`general_ledger`) under formal Reports category | `VERIFIED_COMPLETE` | `GeneralLedgerCoreSection.tsx`, `use-general-ledger-core.ts` |
| `/accounting` route canonical redirect: points directly to `/reports?section=general_ledger` | `VERIFIED_COMPLETE` | `route-tree.ts` |

### Wave 5 — Malek Pro parity hardening (2026-08-07, arena branch 019fdc09)

Presentation-only parity pass against the owner-supplied Malek Pro reference set (20 prototype screenshots). Mapping of every reference screen to its plan stage + findings: `docs/audits/MALEK_VISUAL_WAVE5_MALEKPRO_PARITY_AUDIT.md`.

| Item | Status | Evidence |
|---|---|---|
| Operational register tables: dark command-header contrast pinned (page-polish muted-header leak removed, both themes) | `VERIFIED_COMPLETE` | `malek-pro-visual-wave.css`; guard `malek-pro-visual-wave.test.ts`; `evidence/ui-wave5-malekpro-parity/` |
| Maintenance standalone header follows the PageHeader actions contract (create = primary, A4 print = secondary → mobile overflow sheet) | `VERIFIED_COMPLETE` | `maintenance-workspace.tsx`, `maintenance.e2e-fixture.tsx` |
| OD-12 Cairo + Sora self-hosted fonts (offline PWA + no external font CDN), deferred load, `font-display: swap`, OFL licenses shipped | `VERIFIED_COMPLETE` | `public/fonts/*`, `src/lib/product-fonts.ts`; guard `product-fonts-contract.test.ts` |
| Reference screens not to replicate (split login, dark-navy promotional modal heroes) | confirmed intentionally excluded | doc 3 consolidation pass, commit `2a2df3a7` |

## 3. Open Owner Decisions (blockers, unchanged)

- **OD-08** — Due-from-Owner collection mechanism (offset vs payment invoice): blocks negative-balance settlement accounting.
- **OD-03** — Missing legal templates: blocks production contract printing automation.
- **OD-04** — Role model scope (3 vs 6 roles): blocks Maker-Checker and Accountant/Viewer role rollout.
- **OD-02** — Void signature payload: awaits refactor decision.
- **S08 crediting (OD-11)** — blocks Stage S09 historical correction.

### Deferred verification (not blocking)
- Full browser smoke pass on changed surfaces is deferred (per program instruction): the login responsive smoke script (`rentrix-app/scripts/responsive-smoke-login.cjs`) passed earlier at 390px/1440px with 0px horizontal overflow; re-running it requires re-downloading the headless Chromium binary in the sandbox. CI `browser-smoke` runs on GitHub for the branch.

## 4. Intentionally Untouched

- GL business-posting rewiring (Stage S03 wiring), VOID accounting model changes, historical financial backfill, multi-currency, new master-lease accounting policies, Maker-Checker lifecycle, legal contract wording, VAT policy changes, new settlement accounting rules, migration drift reconciliation (OD-15). All require upstream decisions per the roadmap.
