import { useMemo } from 'react';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { downloadBlob } from '@/lib/tabular-export';
import { buildXlsxBlob } from '@/lib/xlsx-export';
import {
  downloadAgedArrearsReportPdf,
  downloadPortfolioPerformanceReportPdf,
  downloadRentRollReportPdf,
  printAgedArrearsReport,
  printPortfolioPerformanceReport,
  printRentRollReport,
} from '../documents/report-documents';
import {
  downloadPropertyReportPdf,
  printPropertyReport,
} from '../documents/professional-property-report';
import type { ReportsFilterState } from '../reports-workspace-filters';
import type { ReportProductTarget } from '../report-products';
import type { ReportsWorkspaceModel } from '../use-reports-workspace';
import {
  buildOwnerReportPdfFile,
  buildTenantStatementPdfFile,
  downloadOwnerStatementExcel,
  downloadTenantStatementExcel,
  runOwnerReportDocumentAction,
  runTenantStatementDocumentAction,
} from './statement-report-actions';

type PremiumDocumentCapabilities = Readonly<{
  onPrint?: () => void | Promise<void>;
  onDownloadPdf?: () => void | Promise<void>;
  onDownloadExcel?: () => void;
  buildPdfFile?: () => Promise<File>;
}>;

/**
 * Resolves one product target's real document capabilities at the product
 * boundary. It never derives financial data: it only passes authoritative
 * read-model values to the existing document platform.
 */
export function useReportProductDocumentActions(
  params: Readonly<{
    target: ReportProductTarget;
    model: ReportsWorkspaceModel;
    filters: ReportsFilterState;
    canExportReports: boolean;
  }>,
): Readonly<{
  capabilities: PremiumDocumentCapabilities;
  documentUnavailableHint: string | null;
}> {
  const { target, model, filters, canExportReports } = params;
  const { companySettings, isReady } = useDocumentSettings();
  const documentKind = target.documentKind;

  return useMemo(() => {
    if (!canExportReports) {
      return {
        capabilities: {},
        documentUnavailableHint:
          'الطباعة و PDF والمشاركة المباشرة تتطلب صلاحية تصدير التقارير؛ المعاينة متاحة كما هي.',
      };
    }
    if (!isReady) {
      return {
        capabilities: {},
        documentUnavailableHint:
          'أكمل بيانات الشركة الأساسية في الإعدادات لتفعيل الطباعة و PDF والمشاركة المباشرة.',
      };
    }
    if (!documentKind) {
      return { capabilities: {}, documentUnavailableHint: null };
    }

    const settings = companySettings;
    const statements = model.sections.statements;
    const period = { from: filters.from, to: filters.to };

    switch (documentKind) {
      case 'owner-pack': {
        const ownerId = statements.selectedOwnerId || filters.ownerId || null;
        if (!ownerId) {
          return {
            capabilities: {},
            documentUnavailableHint:
              'اختر مالكًا من فلاتر التقرير لتجهيز كشف المالك الشامل.',
          };
        }
        if (
          statements.isOwnerStatementLoading ||
          statements.isOwnerReportPayloadLoading
        ) {
          return {
            capabilities: {},
            documentUnavailableHint:
              'جارٍ تجهيز كشف المالك الشامل من المصادر المعتمدة.',
          };
        }
        if (
          statements.ownerStatementError ||
          !statements.ownerStatement ||
          statements.ownerStatement.error
        ) {
          return {
            capabilities: {},
            documentUnavailableHint: 'تعذر تجهيز كشف مالك معتمد للنطاق الحالي.',
          };
        }
        if (
          statements.ownerReportPayloadError ||
          !statements.ownerReportPayload
        ) {
          return {
            capabilities: {},
            documentUnavailableHint:
              'تعذر تجهيز تفاصيل كشف المالك الشامل؛ أعد تحميل التقرير.',
          };
        }
        const ownerParams = {
          isReady: true,
          settings,
          ownerId,
          statement: statements.ownerStatement,
          period: { ...period, propertyId: filters.propertyId },
          payload: statements.ownerReportPayload,
        };
        return {
          documentUnavailableHint: null,
          capabilities: {
            onPrint: () => runOwnerReportDocumentAction(ownerParams, 'print'),
            onDownloadPdf: () =>
              runOwnerReportDocumentAction(ownerParams, 'pdf'),
            onDownloadExcel: () =>
              downloadOwnerStatementExcel(statements.ownerStatement, ownerId),
            buildPdfFile: () =>
              buildOwnerReportPdfFile({
                settings,
                ownerId,
                statement: statements.ownerStatement!,
                period: { ...period, propertyId: filters.propertyId },
                payload: statements.ownerReportPayload,
              }),
          },
        };
      }
      case 'tenant-statement': {
        const contractId =
          statements.selectedContractId || filters.contractId || null;
        if (!contractId) {
          return {
            capabilities: {},
            documentUnavailableHint:
              'اختر عقدًا من فلاتر التقرير لتجهيز كشف المستأجر.',
          };
        }
        if (statements.isTenantStatementLoading) {
          return {
            capabilities: {},
            documentUnavailableHint:
              'جارٍ تجهيز كشف المستأجر من المصدر المعتمد.',
          };
        }
        if (
          statements.tenantStatementError ||
          !statements.tenantStatement ||
          statements.tenantStatement.error
        ) {
          return {
            capabilities: {},
            documentUnavailableHint:
              'تعذر تجهيز كشف مستأجر معتمد للعقد الحالي.',
          };
        }
        const tenantParams = {
          isReady: true,
          settings,
          statement: statements.tenantStatement,
          period,
        };
        return {
          documentUnavailableHint: null,
          capabilities: {
            onPrint: () =>
              runTenantStatementDocumentAction(tenantParams, 'print'),
            onDownloadPdf: () =>
              runTenantStatementDocumentAction(tenantParams, 'pdf'),
            onDownloadExcel: () =>
              downloadTenantStatementExcel(
                statements.tenantStatement,
                contractId,
              ),
            buildPdfFile: () =>
              buildTenantStatementPdfFile({
                settings,
                statement: statements.tenantStatement,
                period,
              }),
          },
        };
      }
      case 'rent-roll': {
        const rows = model.sections.collections.rentRollRows;
        return {
          documentUnavailableHint:
            rows.length === 0
              ? 'سجل العقود يبنى من عقود النطاق الحالي؛ يتفعل الإخراج عند وجود بيانات.'
              : null,
          capabilities: {
            onPrint: () => printRentRollReport({ rows, settings }),
            onDownloadPdf: () => downloadRentRollReportPdf({ rows, settings }),
            onDownloadExcel: () => {
              if (rows.length === 0) return;
              downloadBlob(
                buildXlsxBlob({
                  name: 'سجل العقود والإيجارات',
                  headers: [
                    'المستأجر',
                    'العقار',
                    'الوحدة',
                    'الإيجار',
                    'دورة الدفع',
                    'حالة العقد',
                    'تاريخ البدء',
                    'تاريخ الانتهاء',
                  ],
                  rows: rows.map(
                    (row) =>
                      [
                        row.tenantName,
                        row.propertyTitle,
                        row.unitNumber,
                        row.rentAmount,
                        row.paymentCycle,
                        row.statusLabel,
                        row.startDate,
                        row.endDate,
                      ] as const,
                  ),
                  rightToLeft: true,
                }),
                `rent-roll-${filters.from || 'all'}_${filters.to || 'now'}.xlsx`,
              );
            },
          },
        };
      }
      case 'aged-arrears': {
        const report = model.sections.overdue.agedReport;
        if (!report) {
          return {
            capabilities: {},
            documentUnavailableHint:
              'كشف الأعمار يُبنى من مصدر المتأخرات المعتمد؛ يتفعل الإخراج عند اكتمال تحميله.',
          };
        }
        return {
          documentUnavailableHint: null,
          capabilities: {
            onPrint: () => printAgedArrearsReport({ report, settings }),
            onDownloadPdf: () =>
              downloadAgedArrearsReportPdf({ report, settings }),
            onDownloadExcel: () => {
              downloadBlob(
                buildXlsxBlob({
                  name: 'أعمار المتأخرات',
                  headers: [
                    'المستأجر',
                    'العقار / الوحدة',
                    'غير متأخر',
                    '1–30',
                    '31–60',
                    '61–90',
                    '+90',
                    'الإجمالي',
                  ],
                  rows: report.rows.map(
                    (row) =>
                      [
                        row.tenantName ?? '—',
                        `${row.propertyTitle ?? '—'}${row.unitNumber ? ` (${row.unitNumber})` : ''}`,
                        row.buckets.current?.total ?? 0,
                        row.buckets.days_1_30?.total ?? 0,
                        row.buckets.days_31_60?.total ?? 0,
                        row.buckets.days_61_90?.total ?? 0,
                        row.buckets.days_90_plus?.total ?? 0,
                        row.totalOutstanding,
                      ] as const,
                  ),
                  rightToLeft: true,
                }),
                `arrears-aging-${report.asOf}.xlsx`,
              );
            },
          },
        };
      }
      case 'property-pack': {
        return {
          documentUnavailableHint: null,
          capabilities: {
            onPrint: () => printPropertyReport({ settings, model, filters }),
            onDownloadPdf: () =>
              downloadPropertyReportPdf({ settings, model, filters }),
          },
        };
      }
      case 'portfolio-performance': {
        const occupancyRows = model.sections.occupancy.occupancyRows;
        return {
          documentUnavailableHint:
            occupancyRows.length === 0
              ? 'صورة المحفظة تُبنى من أداء الإشغال المعتمد؛ يتفعل الإخراج عند توفر بيانات الوحدات.'
              : null,
          capabilities: {
            onPrint: () =>
              printPortfolioPerformanceReport({
                occupancyRows,
                settings,
                periodFrom: filters.from,
                periodTo: filters.to,
              }),
            onDownloadPdf: () =>
              downloadPortfolioPerformanceReportPdf({
                occupancyRows,
                settings,
                periodFrom: filters.from,
                periodTo: filters.to,
              }),
          },
        };
      }
      default:
        return { capabilities: {}, documentUnavailableHint: null };
    }
  }, [canExportReports, companySettings, documentKind, filters, model]);
}
