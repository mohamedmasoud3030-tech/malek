import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ArrearsSummaryReport, CollectionSummaryReport } from '@/features/financials/reports/financialReportsService';
import { getFinanceCockpitState } from './components/finance-workspace-hero';

const financeRoot = join(process.cwd(), 'src/features/finance');
const pageSource = readFileSync(join(financeRoot, 'FinancePage.tsx'), 'utf8');
const cockpitSource = readFileSync(join(financeRoot, 'components/finance-workspace-hero.tsx'), 'utf8');

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

  it('keeps the remediation operational, directly navigable, and structurally stable', () => {
    expect(cockpitSource).toContain('data-finance-cockpit');
    expect(cockpitSource).toContain('الوضع المالي اليوم');
    expect(cockpitSource).not.toContain('كل حركة المال في مساحة تشغيل واحدة');

    expect(pageSource).toContain('data-finance-mobile-nav-mode="direct-tabs"');
    expect(pageSource).not.toContain('<WorkspaceNav');
    expect(pageSource).toContain('data-finance-subview-strip');
    expect(pageSource).not.toContain('subViews.length > 1');
    expect(pageSource).toContain('<FinanceOperationsOverview');
    expect(pageSource).not.toContain('<FinancialReportsPreviewSection');
  });
});
