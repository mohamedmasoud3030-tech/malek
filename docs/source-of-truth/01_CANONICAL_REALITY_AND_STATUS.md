# MALEK — Canonical Reality & Status (Document 1)

> **Execution-Ready Source of Truth.** Created on 2026-08-07. This document is the authoritative feature-reality catalog: what exists, what is verified complete, what is partial, and what is intentionally untouched. Status changes require evidence (implementation + tests + reachable UI), recorded in the evidence column.

---

## 1. Feature Status Catalog

Legend: `VERIFIED_COMPLETE` = implemented, connected to real data, reachable, user-visible, actions + permissions + loading/error/empty states work, mobile acceptable, no demo/mock. `PARTIAL` = safe core exists, boundary item remains. `NOT_STARTED` = implementation has not started. A resolved owner decision removes policy ambiguity but does not by itself mark implementation complete.

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
| Mobile dense registers: one compact responsive table with column priority, progressive disclosure, sticky identity/actions, and controlled horizontal scrolling; no card duplication | `VERIFIED_COMPLETE` | `EntityTable` / `CompactResponsiveTable` + behavioral interaction coverage |

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
| Final accounting approval authority beyond match/ignore (FGR-006 approval flow) | `PARTIAL` — decision resolved, implementation pending | ADR 0015 adopts six roles + Maker-Checker; backend permission implementation still required |
| **Owner-audit nuance (2026-08-07):** the whole E9 feature carries the owner-audit label `PARTIALLY_IMPLEMENTED` until approval flows (FGR-006) and the upload wizard land | `PARTIAL` (owner-audit label) | approval policy resolved by ADR 0015; implementation remains |

### D — Owner Settlements UX

| Feature | Status | Evidence |
|---|---|---|
| Draft creation from server-derived preview only (no client amounts), idempotent writes | `VERIFIED_COMPLETE` | `OwnerSettlementWorkspace.tsx`, `owner-settlements-service.ts` |
| Source collections/expenses visibility in preview (payments count, source, VAT policy) | `VERIFIED_COMPLETE` | preview breakdown panel |
| Stale-input warning when scope changes and server recalculates | `VERIFIED_COMPLETE` | commit `ee3fdcee` |
| Atomic reservation visibility (D14 note) | `VERIFIED_COMPLETE` | commit `ee3fdcee` |
| Payout preview with explicit payable amount, recipient, period, method | `VERIFIED_COMPLETE` | commit `ee3fdcee` |
| Explicit post-payment status on settlement cards (paid date / approved / cancelled) | `VERIFIED_COMPLETE` | commit `305b459c` |
| First-run ADMIN supervision UX (banner: needs-ADMIN + first-cycle supervision reminder) | `VERIFIED_COMPLETE` | commit `c067d1b0`; ADR 0015 fixes exit criterion after one reconciled cycle |
| Approval (ADMIN) → payout (ADMIN) with print/PDF owner statement | `VERIFIED_COMPLETE` | workspace + `documentService` |
| Negative-balance collection accounting (Due-from-Owner recovery) | `NOT_STARTED` — decision resolved, implementation pending | ADR 0015: separate Due from Owner; never negative Owner Funds Payable |
| **Owner-audit nuance (2026-08-07):** the whole E7 feature remains classified `PARTIALLY_IMPLEMENTED` until Due-from-Owner recovery is implemented and first-cycle supervision evidence exists | `PARTIAL` (owner-audit label) | product decisions resolved by ADR 0015; implementation/evidence still required |

### E — Contract Experience

| Feature | Status | Evidence |
|---|---|---|
| 4-state lifecycle UX: draft/active/expired/terminated, renew dialog, termination dialog with reason, state badges | `VERIFIED_COMPLETE` | `lifecycle/*`, `ContractDetailSections.tsx` |
| Documents shell, payments tab (invoices + payments), financial timeline, agreement-coverage recovery | `VERIFIED_COMPLETE` | `contractDocumentsShell.tsx`, `contractPaymentsTab.tsx`, `ContractAgreementMissingAlert.tsx` |
| Payment schedule preview inside the form | `VERIFIED_COMPLETE` | `contract-schedule-preview.ts` + `ContractFormFields.tsx` |
| Compact create/edit modal over workspace context | `VERIFIED_COMPLETE` | commit `5f585a06` |
| Maker-Checker lifecycle, signature verification, future legal states | `NOT_STARTED` — decisions resolved, implementation pending | ADR 0015 fixes Maker-Checker roles and `DRAFT → REVIEW → APPROVED → SIGNED → ACTIVE`; final jurisdiction-specific legal wording still requires legal review |

### B / F — Safe completeness

| Feature | Status | Evidence |
|---|---|---|
| Loading/error/retry/empty states with actions in all primary workspaces | `VERIFIED_COMPLETE` | `AsyncContentState`, `PageStateCard`, `EmptyState` across modules |
| Document vault upload validation (mime + 5MB contract, accept attribute) | `VERIFIED_COMPLETE` | `attachments-contract.ts`, `documents-vault-service.ts` |
| CSV export with UTF-8 BOM, dated filenames | `VERIFIED_COMPLETE` | `csvExport.ts`, `reports-page.helpers.ts` |
| Navigation exposure: all safe features reachable from collapsible domain groups + mobile drawer; mobile persistent control is Menu + Search only | `VERIFIED_COMPLETE` | `app-nav-items.ts`, `layout-navigation-view.tsx` |
| Permission-consistent UI (void/approve/pay/export gates) | `VERIFIED_COMPLETE` | `permissions.ts` + per-workspace gates |

---

## 2. Visual UX Consolidation Pass (2026-08-07, same program/PR lineage)

Presentation-only normalization; no business behavior, routes, permissions, RPCs, or DB changes.

| Item | Status | Evidence |
|---|---|---|
| Login: single centered minimal auth surface with approved MALEK mark → MALEK → current tagline → auth fields/actions; responsive support contacts below | `VERIFIED_COMPLETE` after PR #1384 merge | `login-page.tsx`, canonical brand assets; mobile/desktop CI verification required on PR head |
| Compact operational page headers: jargon/promotional descriptions trimmed to one concise line (finance workspaces + 4 finance hub entries) | `VERIFIED_COMPLETE` | workspace page components; `page-header.test.tsx` intact |
| One heading hierarchy: EntityDetailHeader normalized to the standard PageHeader scale (text-xl sm:text-2xl) | `VERIFIED_COMPLETE` | `entity-detail-header.tsx` |
| Reports tab clusters use compact inline category labels (mobile) while keeping the 3-category architecture | `VERIFIED_COMPLETE` | `ReportsWorkspace.tsx` |
| Shared primitives audit (buttons/inputs/cards/tables/modals/forms/filter pills/status pills/empty states) — found already normalized on one token system; no second design system created | `VERIFIED_COMPLETE` | `tokens.css`, `malek-pro-visual-wave.css`, `page-polish.css`, component audit |
| Full-surface consistency sweep (dashboard, properties, units, owners, people, contracts, finance hubs, invoices/collections, expenses, deposits, reconciliation, settlements, reports, maintenance, utilities, automation, vault, settings/system, change-password, audit log) | `VERIFIED_COMPLETE` | component audit + targeted suites |
| **Visual Design Pass (post-#1424 closeout)** | `VERIFIED_COMPLETE` | Live inspection 2026-08-10 (RTL+desktop+narrow mobile). Targeted fix only: raw states → shared LoadingState/ErrorState in arrears-workflow-section. No blanket spacing/density. Full verification passed (typecheck + build + baseline tests + visual contracts). See evidence/design-final-2026-08-10/ + design-phase-audit-2026-08-10.md. Commit 0b49198 + final closeout. |
| Dashboard/reports restraint (hero + KPI cards already compact; calculations preserved) | `VERIFIED_COMPLETE` | `hero-banner.tsx`, `FinanceKpiCard` |
| Operational-route page headers: removed the Wave-2 dark-gradient hero cards + decorative rings; operational pages use standard compact PageHeader | `VERIFIED_COMPLETE` | `malek-pro-visual-wave.css`; commit `2a2df3a7` |
| Finance/reports hub descriptions trimmed to operational one-liners (i18n) | `VERIFIED_COMPLETE` | `lib/i18n.ts`; i18n contract tests pass |
| Safe cascade warnings: property + unit archive dialogs list exact backend guard preconditions | `VERIFIED_COMPLETE` | `properties-list-page.tsx`, `units-list.tsx` |
| Dead legacy route-wrapper cleanup | `VERIFIED_COMPLETE` | canonical redirects in `route-tree.ts` |
| Settings / Governance flattening | `VERIFIED_COMPLETE` | `settingsSections.ts`, `settings-operations-sections.tsx` |
| General Ledger read-only UI under formal Reports category | `VERIFIED_COMPLETE` | `GeneralLedgerCoreSection.tsx`, `use-general-ledger-core.ts` |
| `/accounting` canonical redirect to `/reports?section=general_ledger` | `VERIFIED_COMPLETE` | `route-tree.ts` |

## 3. Owner Decisions

Resolved by **ADR 0015 (2026-08-07)**:

- **OD-02** — VOID: immutable/audited Maker-Checker lifecycle; mandatory reason; requester cannot self-approve; ADMIN emergency override requires extra reason.
- **OD-03** — Contract workflow/versioning: `DRAFT → REVIEW → APPROVED → SIGNED → ACTIVE`; signed artifact immutable; final jurisdiction-specific legal wording remains subject to legal review.
- **OD-04** — Six product roles: `ADMIN / MANAGER / ACCOUNTANT / OPERATIONS / USER / VIEWER`; Maker-Checker separation; backend permission enforcement remains authoritative.
- **OD-08** — Negative owner balance: separate Due from Owner receivable; never negative Owner Funds Payable; collection or documented permitted offset.
- **First-cycle settlement supervision** — one complete ADMIN-supervised and reconciled company cycle, then the first-run warning can exit.

Still open outside this UX decision round:

- **S08 crediting (OD-11)** — blocks Stage S09 historical correction.

### Deferred verification (not blocking policy)
- Browser/a11y/responsive evidence must be regenerated on the final integrated PR/main head; historical evidence is not a substitute for current CI/browser execution.

## 4. Intentionally Untouched

- GL business-posting rewiring (Stage S03 wiring), historical financial backfill, multi-currency, new master-lease accounting policies, jurisdiction-specific legal contract wording, VAT policy changes, and migration drift reconciliation (OD-15). ADR 0015 resolves product-owner ambiguity only; it does not itself implement these backend/accounting stages.
