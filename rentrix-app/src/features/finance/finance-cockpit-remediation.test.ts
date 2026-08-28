import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ArrearsSummaryReport, CollectionSummaryReport } from '@/features/financials/reports/financialReportsService';
import { getFinanceCockpitState } from './finance-cockpit-state';

const financeRoot = join(process.cwd(), 'src/features/finance');
const pageSource = readFileSync(join(financeRoot, 'FinancePage.tsx'), 'utf8');
const cockpitStateSource = readFileSync(join(financeRoot, 'finance-cockpit-state.ts'), 'utf8');

function collection(overrides: Partial<CollectionSummaryReport> = {}): CollectionSummaryReport {
  return {
    invoiced: 1_000,
    paid: 600,
    outstanding: 400,
    receiptsCount: 3,
    invoicesCount: 5,
    expensesTotal: 120,
    ...overrides,
  };
}

function arrears(overrides: Partial<ArrearsSummaryReport> = {}): ArrearsSummaryReport {
  return {
    asOf: '2026-08-26',
    totalOverdue: 250,
    overdueInvoiceCount: 2,
    over90Amount: 0,
    over90InvoiceCount: 0,
    averageDaysOverdue: 12,
    ...overrides,
  };
}

describe('Finance cockpit UI remediation', () => {
  it('prioritizes overdue receivables and calculates a bounded collection rate', () => {
    expect(getFinanceCockpitState(collection(), arrears())).toMatchObject({
      collectionRate: 60,
      attentionTone: 'danger',
      nextAction: 'arrears',
    });

    expect(getFinanceCockpitState(collection({ paid: 1_500 }), arrears({ totalOverdue: 0 }))).toMatchObject({
      collectionRate: 100,
      attentionTone: 'warning',
      nextAction: 'collections',
    });
  });

  it('reports a stable state when nothing is outstanding', () => {
    expect(getFinanceCockpitState(
      collection({ invoiced: 1_000, paid: 1_000, outstanding: 0 }),
      arrears({ totalOverdue: 0, overdueInvoiceCount: 0 }),
    )).toMatchObject({
      collectionRate: 100,
      attentionTone: 'success',
      nextAction: 'collections',
    });
  });

  it('uses the app-wide page and section chrome instead of a finance-specific hero', () => {
    expect(cockpitStateSource).not.toContain('className=');
    expect(pageSource).toContain("import { PageHeader } from '@/components/layout/page-header';");
    expect(pageSource).toContain('<PageHeader');
    expect(pageSource).toContain('<SectionHeader');
    expect(pageSource).not.toContain('FinanceWorkspaceHero');
    expect(pageSource).toContain('data-finance-mobile-nav-mode="direct-tabs"');
    expect(pageSource).not.toContain('<WorkspaceNav');
    expect(pageSource).toContain('data-finance-subview-strip');
    expect(pageSource).not.toContain('subViews.length > 1');
    expect(pageSource).toContain('<FinanceOperationsOverview');
    expect(pageSource).not.toContain('<FinancialReportsPreviewSection');
  });

  it('surfaces management fees and owner settlements as routine Money overview entries without widening access', () => {
    const overviewSource = readFileSync(join(financeRoot, 'components/finance-operations-overview.tsx'), 'utf8');

    expect(overviewSource).toContain('canViewManagementFees');
    expect(overviewSource).toContain('canViewOwnerSettlements');
    expect(overviewSource).toContain('استحقاق أتعاب الإدارة الشهرية');
    expect(overviewSource).toContain('مستحقات وتسويات الملاك');
    expect(overviewSource).toContain('{canViewManagementFees || canViewOwnerSettlements ? (');

    expect(pageSource).toContain("canViewManagementFees={permittedViewIds.has('fixed_monthly_accruals')}");
    expect(pageSource).toContain("canViewOwnerSettlements={permittedViewIds.has('owner_settlements')}");
    expect(pageSource).toContain("handleLocationChange('fees', 'fixed_monthly_accruals')");
    expect(pageSource).toContain("handleLocationChange('funds', 'owner_settlements')");
  });
});
