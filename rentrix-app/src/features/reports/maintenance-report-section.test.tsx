import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MaintenanceReportSection } from './components/MaintenanceReportSection';
import type { Maintenance } from '@/features/maintenance/maintenance-service';
import type { MaintenanceSummary } from '@/features/maintenance/maintenance-helpers';

vi.mock('@/features/settings/useCompanySettings', () => ({
  useCompanySettings: () => ({
    data: { company_name: 'مكتب الاختبار', currency: 'OMR' },
  }),
}));

vi.mock('@/app/router/background-location', () => ({
  useDialogNavigate: () => () => undefined,
}));

function isoDaysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function makeRequest(
  overrides: Partial<Maintenance> & { id: string },
): Maintenance {
  return {
    no: null,
    property_id: 'p1',
    unit_id: null,
    title: 'طلب صيانة',
    description: null,
    priority: 'medium',
    status: 'open',
    assigned_to: null,
    cost: null,
    charged_to: null,
    notes: null,
    request_date: isoDaysFromToday(-2),
    scheduled_date: null,
    work_description: null,
    technician_name: null,
    response_time_hours: null,
    expense_id: null,
    invoice_id: null,
    reported_by: null,
    completed_at: null,
    resolved_at: null,
    created_at: `${isoDaysFromToday(-2)}T08:00:00`,
    updated_at: null,
    attachment_url: null,
    deleted_at: null,
    company_id: 'c1',
    reference: null,
    service_provider_id: null,
    service_provider_category_id: null,
    cancelled_at: null,
    cancellation_reason: null,
    request_id: null,
    ...overrides,
  } as Maintenance;
}

const emptySummary: MaintenanceSummary = {
  total: 0,
  open: 0,
  inProgress: 0,
  urgent: 0,
};

function renderSection(
  rows: Maintenance[],
  summary: MaintenanceSummary = emptySummary,
  canExportReports = true,
) {
  return renderToStaticMarkup(
    <MaintenanceReportSection
      rows={rows}
      summary={summary}
      canExportReports={canExportReports}
      isLoading={false}
    />,
  );
}

describe('MaintenanceReportSection — operational attention contracts', () => {
  it('renders the canonical report pattern and the attention panel that answers "what needs attention now"', () => {
    const markup = renderSection(
      [
        makeRequest({
          id: 'm1',
          status: 'open',
          request_date: isoDaysFromToday(-20),
          title: 'تسريب مياه',
        }),
        makeRequest({ id: 'm2', status: 'resolved', title: 'تبديل إنارة' }),
        makeRequest({
          id: 'm3',
          status: 'in_progress',
          scheduled_date: isoDaysFromToday(-1),
          title: 'صيانة مكيف',
        }),
      ],
      { total: 3, open: 1, inProgress: 1, urgent: 0 },
    );

    expect(markup).toContain('data-report-summary');
    expect(markup).toContain('data-report-visual');
    expect(markup).toContain('data-report-insight');
    expect(markup).toContain('يحتاج انتباهًا الآن');
    expect(markup).toContain('متوقفة عن التقدم');
    expect(markup).toContain('بانتظار الإغلاق');
    expect(markup).toContain('تجاوزت موعد الزيارة');
    expect(markup).toContain('قائمة العمل');
    expect(markup).toContain('data-report-share-actions');
  });

  it('never counts cancelled work as completed or in the completion denominator', () => {
    const markup = renderSection(
      [
        makeRequest({ id: 'm1', status: 'resolved' }),
        makeRequest({ id: 'm2', status: 'closed' }),
        makeRequest({ id: 'm3', status: 'cancelled', title: 'طلب ملغى' }),
        makeRequest({ id: 'm4', status: 'open' }),
      ],
      { total: 4, open: 1, inProgress: 0, urgent: 0 },
    );

    // 2 completed of 3 non-cancelled = 67% — not 2/4 = 50%.
    expect(markup).toMatch(/67(?:<!-- -->)?%/);
    expect(markup).not.toMatch(/50(?:<!-- -->)?%/);
    expect(markup).toContain('2 منجز من 3 غير ملغى');
    expect(markup).toContain(
      'قرار إلغاء — لا تُحسب منجزة ولا تدخل معدل الإنجاز',
    );
  });

  it('derives the urgent backlog from the active workload only', () => {
    const markup = renderSection(
      [
        makeRequest({ id: 'm1', status: 'open', priority: 'urgent' }),
        makeRequest({ id: 'm2', status: 'resolved', priority: 'urgent' }),
      ],
      { total: 2, open: 1, inProgress: 0, urgent: 2 },
    );

    expect(markup).toContain('عاجلة نشطة');
    expect(markup).toContain('1 طلبات عاجلة فعالة');
    expect(markup).not.toContain('2 طلبات عاجلة فعالة');
  });

  it('shows maintenance-recorded cost as its own source, never merged with posted expenses', () => {
    const markup = renderSection([
      makeRequest({ id: 'm1', cost: 12.5 }),
      makeRequest({ id: 'm2', cost: 3.75 }),
    ]);

    expect(markup).toContain('تكلفة سجلات الصيانة');
    expect(markup).toContain('16.250');
    expect(markup).toContain('مصدر مستقل عن المصروفات');
  });

  it('hands every active request to the maintenance screen for execution', () => {
    const markup = renderSection([
      makeRequest({ id: 'm1', title: 'تسريب مياه' }),
    ]);
    expect(markup).toContain('فتح الطلب');
    expect(markup).toContain('في شاشة الصيانة');
  });

  it('does not invent a completion ratio when every request is cancelled', () => {
    const markup = renderSection(
      [makeRequest({ id: 'm1', status: 'cancelled' })],
      { total: 1, open: 0, inProgress: 0, urgent: 0 },
    );
    expect(markup).toContain('معدل الإنجاز غير متاح');
    expect(markup).not.toContain('معدل الإنجاز</p>');
  });

  it('keeps share, print and export behind the export permission', () => {
    const markup = renderSection(
      [makeRequest({ id: 'm1' })],
      { total: 1, open: 1, inProgress: 0, urgent: 0 },
      false,
    );
    expect(markup).not.toContain('data-report-share-actions');
  });
});

describe('MaintenanceReportSection — source semantic contracts', () => {
  const src = readFileSync(
    resolve(
      process.cwd(),
      'src/features/reports/components/MaintenanceReportSection.tsx',
    ),
    'utf8',
  ).replaceAll('"', "'");

  it('normalizes lifecycle values before any status comparison', () => {
    expect(src).toContain(
      'const status = normalizeMaintenanceStatus(row.status);',
    );
    expect(src).toContain("status === 'open' || status === 'in_progress'");
    expect(src).toContain(
      "normalizeMaintenanceStatus(row.status) === 'cancelled'",
    );
    expect(src).toContain("status === 'resolved' || status === 'closed'");
  });

  it('keeps cancelled work outside the completion ratio', () => {
    expect(src).toContain(
      'const actionableCount = rows.length - cancelledCount',
    );
    expect(src).toContain('completedCount / actionableCount');
    expect(src).not.toContain('completedCount / summary.total');
  });

  it('never sums maintenance-recorded cost with posted expenses', () => {
    expect(src).toContain('total + (row.cost ?? 0)');
    expect(src).not.toContain('maintenanceRecordedCost +');
    expect(src).not.toContain('+ maintenanceRecordedCost');
    expect(src).not.toContain('تكلفة التشغيل الإجمالية');
  });

  it('uses the canonical shared controls instead of local copies', () => {
    expect(src).toContain("import { Button } from '@/components/ui/button'");
    expect(src).toContain("from '@/components/ui/report-section-primitives'");
    expect(src).toContain('ReportSummaryStrip');
    expect(src).toContain('ReportProgress');
    expect(src).toContain('ReportInsightNote');
    expect(src).toContain('ReportList');
    expect(src).toContain('ReportListRow');
    expect(src).toContain('ReportPanel');
    expect(src).toContain('ReportState');
    expect(src).not.toContain('<button');
  });

  it('derives attention from the canonical maintenance-attention module, not a parallel rule', () => {
    expect(src).toContain(
      "from '@/features/maintenance/maintenance-attention'",
    );
    expect(src).toContain('summarizeMaintenanceAttention(rows, todayStr)');
    expect(src).not.toContain('MAINTENANCE_STALLED_AFTER_DAYS =');
  });

  it('keeps interactive controls at the 44px minimum touch target', () => {
    expect(src).not.toMatch(/min-h-(8|9|10)\b/);
    expect(src).toContain('min-h-11');
  });
});
