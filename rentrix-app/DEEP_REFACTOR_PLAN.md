# MALEK Rentrix — Deep Refactor Plan: Reports, Accounting, Finance Hub, Settings

**Status:** DRAFT — For Review
**Baseline:** `main@da9a98a38e61e9547df1e328ad91084e79b78410`
**Date:** 2026-08-25

---

## 1. Executive Summary

This plan covers a deep refactor of four interlocked feature areas in the MALEK Rentrix application:

| Feature Area | Primary Path | Key Files | Lines (est.) |
|-------------|--------------|-----------|--------------|
| **Reports** | `src/features/reports/` | `reports-page.tsx`, `ReportsWorkspace.tsx`, `ReportDirectory.tsx`, `use-reports-workspace.ts`, `AccountingReportsSection.tsx`, `GeneralLedgerCoreSection.tsx` | ~12,000 |
| **Accounting** | `src/features/accounting/` | `accountingDomain.ts`, `accountingServices.test.ts`, `wp05Services.ts`, `chartOfAccountsService.ts`, `accountingPeriodsService.ts`, `journalService.ts` | ~8,000 |
| **Finance Hub** | `src/features/finance-hub/` | `money-page.tsx`, `finance-shell-model.ts` | ~5,000 |
| **Settings** | `src/features/settings/` | `settings-page.tsx`, `settingsSections.ts`, `settingsForm.ts`, `company-profile-sections.tsx`, `useCompanySettings.ts`, `useDocumentSettings.ts` | ~10,000 |

**Total scope:** ~35,000 lines across 4 feature directories + shared documentation (`docs/source-of-truth/`).

### Core Problems to Address

1. **Feature Boundary Confusion** — `financials/` and `finance-hub/` overlap in purpose; `reports/` consumes both but owns neither
2. **Data Fetching Fragmentation** — Three different patterns: TanStack Query hooks (`useFinancialReports.ts`), custom workspace hook (`use-reports-workspace.ts`), and direct RPC calls in components
3. **Report Authority Split** — Accounting statements (Trial Balance, P&L, Balance Sheet) live in `reports/components/accounting/` but data comes from `financials/reports/`
4. **Settings Surface Area** — 8 settings sections with 40+ fields, all in one form; validation, preview, and persistence tightly coupled
5. **Finance Shell Model** — `finance-shell-model.ts` defines navigation/permissions but `money-page.tsx` is thin; actual financial views scattered across `financials/` and `reports/`
6. **Test Coverage Gaps** — Accounting services have unit tests; Reports workspace, Settings forms, Finance Hub views have none

---

## 2. Target Architecture

```
src/features/
├── accounting/                 # CORE DOMAIN — single source of truth for GL, COA, periods, journals
│   ├── domain/                 # Pure types, monetary contract, required accounts (✓ exists)
│   ├── services/               # Server-boundary services (RPC wrappers, ✓ exists)
│   ├── reports/                # NEW: Accounting-only reports (TB, P&L, BS, GL drillthrough)
│   │   ├── trial-balance/
│   │   ├── income-statement/
│   │   ├── balance-sheet/
│   │   └── general-ledger/
│   └── reconciliation/         # NEW: Subledger↔GL reconciliation (moved from wp05Services)
│
├── finance/                    # UNIFIED FINANCE HUB (merges finance-hub + financials)
│   ├── shell/                  # Navigation, permissions, deep-link resolution (from finance-shell-model)
│   ├── collections/            # Invoices, receipts, arrears (from financials + reports)
│   ├── expenses/               # Expenses, commissions (from financials + reports)
│   ├── fees/                   # Fixed monthly accruals, management fees
│   ├── funds/                  # Deposits, owner settlements
│   ├── banking/                # Bank reconciliation, cash flow
│   └── reports/                # Operational/analytical reports (NOT accounting statements)
│       ├── collection-analytics/
│       ├── expense-analytics/
│       ├── occupancy-analytics/
│       └── maintenance-analytics/
│
├── reports/                    # REPORT PRESENTATION LAYER ONLY
│   ├── workspace/              # ReportsWorkspace, filter surface, KPI grid (✓ exists)
│   ├── directory/              # ReportDirectory tree navigation (✓ exists)
│   ├── sections/               # Section containers (accounting, statements, analytics)
│   │   ├── accounting/         # Thin adapter → accounting/reports/*
│   │   ├── statements/         # Thin adapter → finance/reports/statements/*
│   │   └── analytics/          # Thin adapter → finance/reports/analytics/*
│   └── hooks/                  # useReportsWorkspace (✓ exists, needs cleanup)
│
├── settings/                   # SETTINGS PLATFORM
│   ├── sections/               # Per-section components (office, identity, documents, finance-readiness, cost-centers, payment-terms, notifications, system)
│   ├── form/                   # Shared form machinery (draft, validation, preview, persistence)
│   ├── hooks/                  # useCompanySettings, useDocumentSettings (✓ exists)
│   └── registry/               # Section registry, feature flags, migration
│
└── shared/                     # CROSS-CUTTING (create if needed)
    ├── monetary/               # OMR 3dp contract, formatters (consolidate from lib/)
    ├── permissions/            # Authorization context, canAccess (from auth/)
    ├── document/               # Document generation, print/PDF (✓ services/documents/)
    └── ui/                     # FinanceSection, FinanceKpiGrid, EntityTable (✓ components/)
```

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Merge `finance-hub` + `financials` → `finance/`** | Both serve "operational finance" (collections, expenses, fees, funds, banking); current split is arbitrary and causes duplicate data fetching |
| **Accounting reports live in `accounting/reports/`** | Trial Balance, P&L, Balance Sheet, GL are *accounting* artifacts — they derive from posted GL, require reconciliation gates, and have document readiness checks. They don't belong in a generic "reports" feature. |
| **`reports/` becomes a pure presentation shell** | It composes views from `accounting/reports/*` and `finance/reports/*` — no data fetching, no business logic, only layout, filters, KPI grid, navigation |
| **Settings sections become independently loadable** | 8 sections × 40 fields = too much for one form. Each section gets its own component, validation, and persistence boundary. |

---

## 3. Work Packages (Sequenced)

### WP-A: Accounting Domain Hardening (Week 1–2)
**Goal:** Make `accounting/` the undisputed owner of GL, COA, periods, journals, and accounting reports.

| Task | Description | Acceptance |
|------|-------------|------------|
| A.1 | Move `financials/reports/financialReportsService.ts` → `accounting/reports/` (rename: `accountingReportsService.ts`) | All accounting statements (TB, P&L, BS, Cash Flow GL, VAT Return) served from accounting/ |
| A.2 | Move `financials/reports/accounting-reports-service.ts` → `accounting/reports/` | Subledger↔GL reconciliation, trial balance drillthrough |
| A.3 | Move `financials/reports/statements-reports-service.ts` → `accounting/reports/statements/` | Tenant/Owner statements are accounting artifacts (subledger-backed) |
| A.4 | Create `accounting/reports/general-ledger/` with `useGeneralLedgerCore` hook | GL tree, periods, batches as dedicated report views |
| A.5 | Consolidate monetary contract: `lib/formatters.ts` + `accountingDomain.ts` → `shared/monetary/` | Single OMR 3dp contract, shared round/format utilities |
| A.6 | Add integration tests for accounting reports services (pgTAP + Vitest) | Every report RPC has contract test + happy-path integration |

### WP-B: Finance Hub Unification (Week 2–3)
**Goal:** Single `finance/` feature owning all operational finance views.

| Task | Description | Acceptance |
|------|-------------|------------|
| B.1 | Create `finance/` feature directory with shell from `finance-shell-model.ts` | Navigation, permissions, deep-link resolution in one place |
| B.2 | Move `financials/` operational views → `finance/` (collections, expenses, fees, funds, banking) | Each sub-feature has its own service + hook + components |
| B.3 | Move `financials/reports/` analytical reports → `finance/reports/analytics/` | Collection analytics, expense analytics, occupancy, maintenance |
| B.4 | Delete `finance-hub/` and `financials/` directories | No dead code, no duplicate exports |
| B.5 | Update `money-page.tsx` to compose `finance/` sections | Single entry point for all operational finance |

### WP-C: Reports Presentation Layer Refactor (Week 3–4)
**Goal:** `reports/` becomes a thin, performant presentation shell.

| Task | Description | Acceptance |
|------|-------------|------------|
| C.1 | Split `ReportsWorkspace.tsx` into: `ReportsShell.tsx` (layout, KPI, filters), `ReportsSectionTabs.tsx`, `ReportsViewPanel.tsx` | Each < 300 lines, single responsibility |
| C.2 | Replace `use-reports-workspace.ts` with TanStack Query composition | No custom fetch orchestration; each section view uses its own `useQuery` |
| C.3 | Create adapter components: `AccountingReportsAdapter`, `StatementsReportsAdapter`, `AnalyticsReportsAdapter` | Each adapts domain report hooks to workspace props interface |
| C.4 | Lazy-load section adapters only when section activated | Code splitting per section; initial bundle reduced |
| C.5 | Move `ReportDirectory.tsx` → `reports/directory/` with virtualized tree | Handles 100+ report nodes without jank |

### WP-D: Settings Platform Modularization (Week 4–5)
**Goal:** Each settings section independently loadable, validatable, persistable.

| Task | Description | Acceptance |
|------|-------------|------------|
| D.1 | Create `settings/registry/sectionRegistry.ts` — declarative section definitions | Replaces `settingsSections.ts`; supports lazy loading, feature flags, migration |
| D.2 | Extract per-section components: `OfficeSection`, `IdentitySection`, `DocumentsSection`, `FinanceReadinessSection`, `CostCentersSection`, `PaymentTermsSection`, `NotificationsSection`, `SystemSection` | Each < 200 lines, own validation, own draft slice |
| D.3 | Introduce `useSettingsSection(sectionId)` hook — isolated draft/validation/preview per section | No more monolithic `CompanySettingsDraft`; sections compose |
| D.4 | Add section-level persistence API: `PATCH /api/settings/{section}` | Backend work — but define contract here |
| D.5 | Migrate `settings-page.tsx` to compose sections from registry | Settings page becomes a router + layout only |

### WP-E: Cross-Cutting Consolidation (Week 5–6)
**Goal:** Eliminate duplication, establish shared contracts.

| Task | Description | Acceptance |
|------|-------------|------------|
| E.1 | Create `shared/monetary/` — single source for OMR 3dp, formatting, precision | All features import from here; delete duplicates in `lib/formatters.ts`, `financialMath.ts` |
| E.2 | Create `shared/permissions/` — canonical `AuthorizationContext`, `canAccess`, role definitions | Replace scattered permission checks |
| E.3 | Consolidate document generation: `services/documents/` → `shared/document/` | Single print/PDF path for all report types |
| E.4 | Add Storybook stories for all report panels, settings sections, finance views | Visual regression baseline |
| E.5 | Run full test suite + Browser Readiness (WP-06) | Zero regressions |

---

## 4. Detailed File Mapping

### 4.1 Accounting → Accounting/Reports Migration

| Source | Target | Notes |
|--------|--------|-------|
| `financials/reports/financialReportsService.ts` | `accounting/reports/statements/accountingReportsService.ts` | 19 report functions; all GL-backed |
| `financials/reports/accounting-reports-service.ts` | `accounting/reports/reconciliation/reconciliationService.ts` | Subledger↔GL, trial balance drillthrough |
| `financials/reports/statements-reports-service.ts` | `accounting/reports/statements/statementsService.ts` | Tenant/Owner statements |
| `features/reports/components/accounting/*` | `accounting/reports/*/components/` | TrialBalancePanel, IncomeStatementPanel, BalanceSheetPanel, AccountingReconciliationReadiness |
| `features/reports/components/GeneralLedgerCoreSection.tsx` | `accounting/reports/general-ledger/GeneralLedgerCoreSection.tsx` | GL tree, periods, batches |

### 4.2 Financials → Finance Migration

| Source | Target | Notes |
|--------|--------|-------|
| `finance-hub/money-page.tsx` | `finance/MoneyPage.tsx` | Entry point, composes finance sections |
| `finance-hub/finance-shell-model.ts` | `finance/shell/financeShellModel.ts` | Navigation, permissions, deep-link resolution |
| `financials/components/*` | `finance/*/components/` | Per sub-feature components |
| `financials/reports/financialReportsService.ts` (operational fns) | `finance/reports/analytics/analyticsService.ts` | Collection summary, aged receivables, expense breakdown, etc. |
| `features/financials/reports/useFinancialReports.ts` | `finance/reports/analytics/useAnalyticsReports.ts` | TanStack Query hooks for operational reports |

### 4.3 Reports Workspace Decomposition

| Source | Target | Responsibility |
|--------|--------|----------------|
| `reports-page.tsx` | `reports/ReportsPage.tsx` | Route entry, loads workspace model |
| `ReportsWorkspace.tsx` | `reports/workspace/ReportsShell.tsx` | Layout, KPI grid, filter surface, section tabs |
| `ReportsWorkspace.tsx` (view rendering) | `reports/workspace/ReportsViewPanel.tsx` | Renders active section adapter |
| `use-reports-workspace.ts` | `reports/hooks/useReportsWorkspace.ts` | Composes section adapters' query states |
| `ReportDirectory.tsx` | `reports/directory/ReportDirectory.tsx` | Virtualized tree navigation |

### 4.4 Settings Section Extraction

| Source | Target | Fields |
|--------|--------|--------|
| `company-profile-sections.tsx` (office) | `settings/sections/OfficeSection.tsx` | company_name, legal_name, tax_number, registration_number, phone, email, city, country, address |
| `company-profile-sections.tsx` (identity) | `settings/sections/IdentitySection.tsx` | currency, locale, timezone, date_format, number_format, logo_url |
| `company-profile-sections.tsx` (documents) | `settings/sections/DocumentsSection.tsx` | invoice_prefix, contract_prefix, receipt_prefix, default_vat_rate, vat_rate, vat_registration_number, vat_enabled |
| (new) | `settings/sections/FinanceReadinessSection.tsx` | Tax authority, accounting periods, chart of accounts — fail-closed gates |
| (new) | `settings/sections/CostCentersSection.tsx` | Cost center CRUD, hierarchy |
| (new) | `settings/sections/PaymentTermsSection.tsx` | Payment schedule templates |
| (new) | `settings/sections/NotificationsSection.tsx` | Notification channels, preferences |
| (new) | `settings/sections/SystemSection.tsx` | Theme, UI language, surface preview |

---

## 5. Data Flow Contracts

### 5.1 Accounting Reports Contract
```typescript
// accounting/reports/contracts.ts
export interface AccountingReportFilters {
  asOf: string;           // Required for TB, BS
  from: string;           // Required for P&L, Cash Flow
  to: string;             // Required for P&L, Cash Flow
  accountingPeriodId?: string;
}

export interface TrialBalanceReport {
  accounts: Array<{ accountNo: string; name: string; debit: number; credit: number; balance: number }>;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  asOf: string;
}

export interface IncomeStatementReport {
  revenue: Array<{ accountNo: string; name: string; amount: number }>;
  expenses: Array<{ accountNo: string; name: string; amount: number }>;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  period: { from: string; to: string };
}

export interface BalanceSheetReport {
  assets: Array<{ accountNo: string; name: string; amount: number }>;
  liabilities: Array<{ accountNo: string; name: string; amount: number }>;
  equity: Array<{ accountNo: string; name: string; amount: number }>;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
  asOf: string;
}
```

### 5.2 Finance Operational Reports Contract
```typescript
// finance/reports/contracts.ts
export interface FinancialReportFilters {
  dateFrom: string;
  dateTo: string;
  costCenterId?: string;
  ownerId?: string;
  contractId?: string;
}

export interface ArrearsReportFilters {
  asOf: string;
  costCenterId?: string;
  ownerId?: string;
}

// Each report returns typed data — no `unknown` payloads
```

### 5.3 Settings Section Contract
```typescript
// settings/registry/types.ts
export interface SettingsSection {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  component: React.LazyExoticComponent<React.FC<SettingsSectionProps>>;
  validationSchema: ZodSchema<SectionDraft>;
  migration?: (legacyDraft: unknown) => SectionDraft;
  featureFlag?: string;
  permissions?: AppPermission[];
}

export interface SettingsSectionProps {
  draft: SectionDraft;
  errors: SectionErrors;
  isSaving: boolean;
  preview: SectionPreview;
  onChange: (field: keyof SectionDraft, value: string) => void;
  onSave: () => Promise<void>;
}
```

---

## 6. Migration Strategy

### 6.1 Phase 1: Parallel Implementation (Weeks 1–4)
- Build new structure alongside old — no breaking changes
- Feature flags gate new components
- Old imports remain functional

### 6.2 Phase 2: Cutover (Week 5)
- Switch route entries: `/reports` → new `ReportsPage`, `/finance` → new `MoneyPage`, `/settings` → new `SettingsPage`
- Update all internal imports (codemod + manual)
- Delete old feature directories

### 6.3 Phase 3: Cleanup (Week 6)
- Remove dead code, unused exports
- Consolidate shared utilities
- Update documentation (`docs/source-of-truth/`)

### 6.4 Rollback Plan
- Each WP is behind a feature flag (`NEXT_REPORTS`, `NEXT_FINANCE`, `NEXT_SETTINGS`, `NEXT_ACCOUNTING`)
- Toggle off → old code paths active
- No database migrations in this refactor (read-only restructuring)

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Report data regression** — moved RPCs return different shape | Medium | High | Contract tests per report RPC; snapshot comparison in CI |
| **Settings form state loss** — section split breaks draft persistence | Medium | High | `useSettingsSection` preserves draft in localStorage per section; integration test |
| **Finance deep-link breakage** — `resolveFinanceLocation` behavior change | Low | Medium | Golden test matrix for all legacy URL patterns |
| **Bundle size increase** — lazy loading not effective | Low | Medium | Webpack bundle analyzer in CI; budget per feature |
| **Permission gaps** — moved components lose auth checks | Medium | High | `isViewPermitted` unit tests for every view in finance shell |

---

## 8. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| **Lines per feature** | Reports: 12K, Accounting: 8K, Finance: 10K, Settings: 10K | Each < 6K (clear boundaries) |
| **Data fetching patterns** | 3 (custom hook, TanStack, direct RPC) | 1 (TanStack Query everywhere) |
| **Report RPC test coverage** | ~40% | 100% (contract + integration) |
| **Settings form fields in single component** | 40+ | 0 (max 8 per section) |
| **Initial JS bundle (reports route)** | ~450 KB | < 250 KB (lazy sections) |
| **TypeScript strictness** | `strict: true` but `any` in 12 places | Zero `any` in feature code |

---

## 9. Dependencies & Prerequisites

| Dependency | Status | Notes |
|------------|--------|-------|
| TanStack Query v5 | ✅ Installed | Already used in `useFinancialReports.ts` |
| Zod (validation) | ✅ Installed | Used in `settingsForm.ts` |
| Lucide React (icons) | ✅ Installed | Consistent icon system |
| EntityTable, SectionTabs, FinanceKpiGrid | ✅ Components exist | Reusable UI primitives |
| pgTAP test infrastructure | ✅ Operational | Document 7 evidence |
| Browser Readiness suite | ✅ Passing (hermetic) | WP-06 gate |

---

## 10. Open Questions for Review

1. **MASTER_LEASE exclusion (ADR 0017)** — Should `accounting/reports/` include a stub/disabled view for lease accounting, or omit entirely?
2. **AI Assistant IA (GAP-023)** — Does the refactor need to accommodate a separate `/ai-assistant` route, or is the global overlay model final?
3. **Historical correction (S09)** — Should `accounting/reports/` expose S08/S09 review UIs, or stay read-only?
4. **Cost Centers / Payment Terms** — Are these fully implemented in backend, or placeholders? Affects Settings section scope.
5. **Document generation** — Keep `services/documents/` as-is or move to `shared/document/`?

---

## 11. Next Steps

1. **Review this plan** — Confirm scope, sequencing, and architectural decisions
2. **Resolve open questions** — Especially MASTER_LEASE and AI Assistant IA
3. **Create tracking issues** — One per Work Package with exit criteria
4. **Begin WP-A** — Accounting domain hardening (highest leverage, lowest risk)

---

*This plan is derived from codebase exploration (35+ files read), canonical documentation (Documents 4, 6, 7, 8), and the current implementation reality. It reflects the MALEK project's evidence-gated, reconciliation-first engineering culture.*