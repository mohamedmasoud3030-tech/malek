import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('OperationsOverviewSection — Phase 2B semantic contracts', () => {
  const src = readFileSync(
    resolve(process.cwd(), 'src/features/reports/components/OperationsOverviewSection.tsx'),
    'utf8',
  );

  it('uses canonical shared controls and report primitives instead of local action/stat implementations', () => {
    expect(src).toContain("import { Button } from '@/components/ui/button'");
    expect(src).toContain('ReportList');
    expect(src).toContain('ReportListRow');
    expect(src).toContain('ReportProgress');
    expect(src).toContain('ReportSummaryStrip');
    expect(src).toContain('ReportPanel');
    expect(src).toContain('ReportInsightNote');
    expect(src).toContain('ReportState');
    expect(src).not.toContain('<button');
    expect(src).not.toContain('<dl');
    expect(src).not.toContain('<dt>');
    expect(src).not.toContain('<dd>');
  });

  it('keeps maintenance-record cost separate from posted expenses', () => {
    expect(src).not.toContain('maintenanceRecordedCost +');
    expect(src).not.toContain('+ maintenanceRecordedCost');
    expect(src).not.toContain('تكلفة التشغيل الإجمالية');
    expect(src).toContain('غير مضمونة الترحيل');
    expect(src).toContain('يعيد احتسابه مرتين');
  });

  it('never labels operating indicators as profit or net income', () => {
    expect(src).not.toContain('ربح');
    expect(src).not.toContain('صافي الدخل');
    expect(src).not.toContain('صافي الربح');
  });

  it('derives urgency only from the active backlog', () => {
    expect(src).toContain("normalizeMaintenanceStatus(row.status)");
    expect(src).toContain("normalizeMaintenancePriority(row.priority) === 'urgent'");
    expect(src).toContain("status === 'open' || status === 'in_progress'");
    expect(src).toContain('const urgencyRatio = openRequests > 0');
    expect(src).toContain('urgentOpenRequests / openRequests');
    expect(src).not.toContain('maintenanceSummary.urgent / openRequests');
  });

  it('treats cancelled work as distinct from completed work', () => {
    expect(src).toContain("status === 'resolved' || status === 'closed'");
    expect(src).toContain("normalizeMaintenanceStatus(row.status) !== 'cancelled'");
    expect(src).toContain('completedRequests / actionableRequests');
    expect(src).not.toContain('maintenanceSummary.closed');
  });

  it('preserves the expected drill routes', () => {
    expect(src).toContain("onDrill('operations', 'expenses')");
    expect(src).toContain("onDrill('operations', 'maintenance_analytics')");
    expect(src).toContain("onDrill('operations', 'services')");
    expect(src).toContain("onDrill('properties', undefined, { propertyId: row.propertyId })");
  });

  it('surfaces deterministic operational insight and honest ratio guards', () => {
    expect(src).toContain('const insightBody');
    expect(src).toContain('قراءة العمليات');
    expect(src).toContain('urgencyRatio !== null');
    expect(src).toContain('completionRatio !== null');
  });
});
