import { CircleDollarSign, Zap } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  responsiblePartyLabels,
  utilityBillStatusLabels,
  utilityTypeLabels,
  useUtilityBills,
  useUtilityMeters,
  type ResponsibleParty,
  type UtilityBill,
} from '@/features/utilities/use-utilities';
import { formatMoney, normalizeCurrency } from '@/lib/formatters';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import type { CsvRow } from '@/lib/csvExport';
import { documentService } from '@/services/documents/DocumentService';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import { toReportDocumentPayload, type ReportDocumentData } from '@/services/documents/documentPayloadAdapters';
import type { ReportsFilterState } from '../reports-workspace-filters';
import { buildReportCsvFilename } from '../reports-page.helpers';
import {
  ReportColumns,
  ReportInsightNote,
  ReportList,
  ReportListRow,
  ReportPanel,
  ReportState,
  ReportSummaryStrip,
} from './report-section-primitives';
import { ReportShareActions } from './ReportShareActions';

const statusTone = {
  unpaid: 'warning',
  partially_paid: 'info',
  paid: 'success',
} as const;

const money = (value: number | null | undefined, currency: string) => formatMoney({ amount: value, currency: normalizeCurrency(currency), locale: 'ar-OM-u-nu-latn' });

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('ar-OM-u-nu-latn', { dateStyle: 'medium' }).format(parsed);
}

function isWithinScope(row: UtilityBill, filters: ReportsFilterState) {
  if (row.due_date < filters.from || row.due_date > filters.to) return false;
  if (filters.unitId && row.unit_id !== filters.unitId) return false;
  return true;
}

export function ServicesReportSection({
  filters,
  canExportReports,
}: Readonly<{
  filters: ReportsFilterState;
  canExportReports: boolean;
}>) {
  const propertyId = filters.propertyId || undefined;
  const billsQuery = useUtilityBills({ propertyId });
  const metersQuery = useUtilityMeters(propertyId);
  const { companySettings: documentSettings, isReady: isDocumentSettingsReady } = useDocumentSettings();
  const currency = normalizeCurrency(documentSettings.currency);

  const rows = (billsQuery.data ?? []).filter((row) => isWithinScope(row, filters));
  const meterById = new Map((metersQuery.data ?? []).map((meter) => [meter.id, meter]));
  const totalBilled = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const totalPaid = rows.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0);
  const remaining = rows.reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0) - Number(row.paid_amount || 0)), 0);
  const overdue = rows.filter((row) => row.status !== 'paid' && row.due_date < filters.asOf);
  const proofCount = rows.filter((row) => Boolean(row.attachment_url)).length;
  const isLoading = billsQuery.isLoading || metersQuery.isLoading;
  const hasError = billsQuery.isError || metersQuery.isError;

  const partyTotals = (['landlord', 'company', 'tenant'] as const).map((party) => ({
    party,
    amount: rows
      .filter((row) => row.responsible_party === party)
      .reduce((sum, row) => sum + Number(row.amount || 0), 0),
    count: rows.filter((row) => row.responsible_party === party).length,
  }));

  const csvRows: CsvRow[] = rows.map((row) => {
    const meter = row.meter_id ? meterById.get(row.meter_id) : undefined;
    return {
      bill: row.bill_number || row.id,
      service: meter ? utilityTypeLabels[meter.utility_type] : 'خدمة عامة',
      dueDate: row.due_date,
      status: utilityBillStatusLabels[row.status],
      responsibleParty: responsiblePartyLabels[row.responsible_party],
      actualPayer: row.actual_payer ? responsiblePartyLabels[row.actual_payer] : '—',
      amount: row.amount,
      paid: row.paid_amount,
      remaining: Math.max(0, row.amount - row.paid_amount),
      hasProof: Boolean(row.attachment_url),
    };
  });

  const reportData = (): ReportDocumentData => ({
    reportTitle: 'تقرير الخدمات والمرافق',
    reportType: 'Utilities_Services_Report',
    periodFrom: filters.from,
    periodTo: filters.to,
    sections: [
      {
        title: 'ملخص الخدمات والمرافق',
        rows: [
          { label: 'عدد الفواتير', value: rows.length },
          { label: 'إجمالي المستحق', value: money(totalBilled, currency) },
          { label: 'المدفوع', value: money(totalPaid, currency) },
          { label: 'المتبقي', value: money(remaining, currency) },
          { label: 'متأخرة حتى تاريخ التقرير', value: overdue.length },
          { label: 'فواتير معها إثبات', value: proofCount },
        ],
      },
      {
        title: 'تفاصيل الفواتير',
        columns: ['الفاتورة', 'الخدمة', 'الاستحقاق', 'المسؤول', 'الحالة', 'القيمة', 'المدفوع', 'المتبقي'],
        rows: rows.map((row) => {
          const meter = row.meter_id ? meterById.get(row.meter_id) : undefined;
          return [
            row.bill_number || row.id,
            meter ? utilityTypeLabels[meter.utility_type] : 'خدمة عامة',
            row.due_date,
            responsiblePartyLabels[row.responsible_party],
            utilityBillStatusLabels[row.status],
            money(row.amount, currency),
            money(row.paid_amount, currency),
            money(Math.max(0, Number(row.amount || 0) - Number(row.paid_amount || 0)), currency),
          ];
        }),
      },
    ],
    totalSummary: `إجمالي المستحق: ${money(totalBilled, currency)} | المدفوع: ${money(totalPaid, currency)} | المتبقي: ${money(remaining, currency)}`,
  });

  const handlePrint = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: () => documentService.printDocument('generic_report', {
        settings: documentSettings,
        payload: toReportDocumentPayload(reportData()),
      }),
      fallbackMessage: 'تعذرت طباعة تقرير الخدمات.',
    });
  };

  const handlePdf = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: () => documentService.downloadDocumentPdf('generic_report', {
        settings: documentSettings,
        payload: toReportDocumentPayload(reportData()),
      }),
      fallbackMessage: 'تعذر تنزيل تقرير الخدمات بصيغة PDF.',
    });
  };

  if (hasError) {
    return <ReportState kind="error" title="تعذر تحميل تقرير الخدمات" message="تعذر تحميل فواتير أو عدادات المرافق من المصدر المعتمد. أعد المحاولة بعد التحقق من الاتصال." />;
  }

  return (
    <div className="space-y-3" data-services-report>
      <ReportSummaryStrip
        dataReportSummary="services"
        items={[
          { label: 'إجمالي الخدمات', value: money(totalBilled, currency), detail: `${rows.length} فاتورة` },
          { label: 'المدفوع', value: money(totalPaid, currency), detail: 'من الفواتير المسجلة' },
          { label: 'المتبقي', value: money(remaining, currency), detail: `${overdue.length} متأخرة`, tone: overdue.length > 0 ? 'warning' : undefined },
          { label: 'إثباتات الدفع', value: `${proofCount}/${rows.length}`, detail: 'مرتبطة بإثبات' },
        ]}
      />

      <ReportColumns>
        <ReportPanel
          title="فواتير الخدمات والمرافق"
          description="من سجل فواتير المرافق المعتمد، مع جهة التحمل والدافع الفعلي والإثبات عند توفره."
          eyebrow="الخدمات"
          icon={Zap}
          isLoading={isLoading}
          action={canExportReports ? (
            <ReportShareActions
              className="flex flex-wrap gap-2"
              reportLabel="تقرير الخدمات والمرافق"
              target={{ section: 'analytics', view: 'services', filters }}
              summaryText={`إجمالي الخدمات ${money(totalBilled, currency)} · المتبقي ${money(remaining, currency)}`}
              onPrint={handlePrint}
              onDownloadPdf={handlePdf}
              csv={{ filename: buildReportCsvFilename('utilities-services'), rows: csvRows }}
            />
          ) : undefined}
        >
          {rows.length === 0 && !isLoading ? (
            <div className="p-4"><ReportState title="لا توجد خدمات في هذا النطاق" message="غيّر الفترة أو نطاق العقار/الوحدة لعرض فواتير الخدمات المسجلة." /></div>
          ) : (
            <ReportList>
              {rows.slice(0, 20).map((row) => {
                const meter = row.meter_id ? meterById.get(row.meter_id) : undefined;
                const serviceLabel = meter ? utilityTypeLabels[meter.utility_type] : 'خدمة عامة';
                return (
                  <ReportListRow
                    key={row.id}
                    title={`${serviceLabel} · ${row.bill_number || 'فاتورة بدون رقم'}`}
                    subtitle={`${formatDate(row.due_date)} · على ${responsiblePartyLabels[row.responsible_party]}${row.actual_payer ? ` · دفعها ${responsiblePartyLabels[row.actual_payer]}` : ''}${row.attachment_url ? ' · يوجد إثبات' : ''}`}
                    meta={<StatusBadge tone={statusTone[row.status]}>{utilityBillStatusLabels[row.status]}</StatusBadge>}
                    value={money(Math.max(0, Number(row.amount || 0) - Number(row.paid_amount || 0)), currency)}
                  />
                );
              })}
            </ReportList>
          )}
        </ReportPanel>

        <div className="space-y-4">
          <ReportInsightNote title="ملكية التكلفة">
            كل فاتورة هنا تحتفظ بجهة التحمل المسجلة — المالك أو المكتب أو المستأجر — وبالدافع الفعلي إن وُجد، بدون إعادة تصنيف مالي داخل التقرير.
          </ReportInsightNote>

          <ReportPanel
            title="توزيع جهة التحمل"
            description="تجميع تشغيلي مباشر لقيمة فواتير الخدمات حسب الجهة المسؤولة المسجلة."
            eyebrow="من يتحمل التكلفة؟"
            icon={CircleDollarSign}
            isLoading={isLoading}
          >
            <ReportList>
              {partyTotals.map(({ party, amount, count }) => (
                <ReportListRow
                  key={party}
                  title={responsiblePartyLabels[party as ResponsibleParty]}
                  subtitle={`${count} فاتورة`}
                  value={money(amount, currency)}
                />
              ))}
            </ReportList>
          </ReportPanel>
        </div>
      </ReportColumns>
    </div>
  );
}

