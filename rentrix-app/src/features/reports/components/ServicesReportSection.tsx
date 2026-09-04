import { useMemo } from 'react';
import { ArrowLeft, CircleDollarSign, ReceiptText, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { useNavigate } from '@tanstack/react-router';
import {
  responsiblePartyLabels,
  utilityBillStatusLabels,
  utilityTypeLabels,
  useUtilityBills,
  useUtilityMeters,
  type ResponsibleParty,
  type UtilityBill,
} from '@/features/utilities/use-utilities';
import {
  compareUtilityObligationUrgency,
  deriveUtilityObligations,
  summarizeUtilityObligations,
  utilityBillRemaining,
  utilityObligationUrgencyLabels,
} from '@/features/utilities/utility-obligations';
import { formatLatinNumber, formatMoney, normalizeCurrency } from '@/lib/formatters';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import type { CsvRow } from '@/lib/csvExport';
import { documentService } from '@/services/documents/DocumentService';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import { toReportDocumentPayload, type ReportDocumentData } from '@/services/documents/documentPayloadAdapters';
import type { ReportsFilterState } from '../reports-workspace-filters';
import { buildReportCsvFilename, usePropertyTitles } from '../reports-page.helpers';
import {
  ReportColumns,
  ReportInsightNote,
  ReportList,
  ReportListRow,
  ReportPanel,
  ReportProgress,
  ReportState,
  ReportSummaryStrip,
} from '@/components/ui/report-section-primitives';
import { ReportShareActions } from './ReportShareActions';

const statusTone = {
  unpaid: 'warning',
  partially_paid: 'info',
  paid: 'success',
} as const;

const money = (value: number | null | undefined, currency: string) => formatMoney({ amount: value, currency: normalizeCurrency(currency), locale: 'ar-OM-u-nu-latn' });

function formatDateValue(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('ar-OM-u-nu-latn', { dateStyle: 'medium' }).format(parsed);
}

function isWithinScope(row: UtilityBill, filters: ReportsFilterState) {
  if (row.due_date < filters.from || row.due_date > filters.to) return false;
  if (filters.unitId && row.unit_id !== filters.unitId) return false;
  return true;
}

const RESPONSIBLE_PARTIES = ['landlord', 'company', 'tenant'] as const;

/**
 * الخدمات والمرافق — answers "ما الخدمات التي تحتاج مراجعة أو سدادًا أو
 * متابعة؟" from the canonical utilities register only:
 *
 * - urgency (overdue / due soon) comes from the same pure derivation the
 *   utilities workspace uses (`utility-obligations`), never a parallel rule;
 * - `amount` and `paid_amount` stay exactly as recorded; remaining is the
 *   shared `utilityBillRemaining` presentation arithmetic;
 * - responsibility stays as recorded (responsible party + actual payer) with
 *   no financial reclassification inside the report;
 * - no aggregate is invented beyond sums of the bills actually in scope.
 */
export function ServicesReportSection({
  filters,
  canExportReports,
}: Readonly<{
  filters: ReportsFilterState;
  canExportReports: boolean;
}>) {
  const navigate = useNavigate();
  const propertyId = filters.propertyId || undefined;
  const billsQuery = useUtilityBills({ propertyId });
  const metersQuery = useUtilityMeters(propertyId);
  const propertyTitlesQuery = usePropertyTitles();
  const { companySettings: documentSettings, isReady: isDocumentSettingsReady } = useDocumentSettings();
  const currency = normalizeCurrency(documentSettings.currency);

  const rows = useMemo(
    () => (billsQuery.data ?? []).filter((row) => isWithinScope(row, filters)),
    [billsQuery.data, filters.from, filters.to, filters.unitId],
  );
  const meterById = useMemo(
    () => new Map((metersQuery.data ?? []).map((meter) => [meter.id, meter])),
    [metersQuery.data],
  );
  const propertyTitleById = useMemo(
    () => new Map((propertyTitlesQuery.data ?? []).map((row) => [row.id, (row.title ?? '').trim()] as const)),
    [propertyTitlesQuery.data],
  );

  // Operational urgency is the canonical obligation derivation — the exact
  // module the utilities workspace triages with, anchored to the report's as-of date.
  const obligations = useMemo(() => deriveUtilityObligations(rows, filters.asOf), [rows, filters.asOf]);
  const obligationByBillId = useMemo(
    () => new Map(obligations.map((obligation) => [obligation.billId, obligation])),
    [obligations],
  );
  const obligationsSummary = useMemo(() => summarizeUtilityObligations(obligations), [obligations]);

  const triagedRows = useMemo(
    () => [...rows].sort((a, b) => {
      const obligationA = obligationByBillId.get(a.id);
      const obligationB = obligationByBillId.get(b.id);
      if (!obligationA || !obligationB) return obligationA ? -1 : obligationB ? 1 : a.id.localeCompare(b.id);
      return compareUtilityObligationUrgency(obligationA, obligationB) || a.id.localeCompare(b.id);
    }),
    [rows, obligationByBillId],
  );

  const totalBilled = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const totalPaid = rows.reduce((sum, row) => sum + (Number(row.paid_amount) || 0), 0);
  const paidCount = rows.filter((row) => row.status === 'paid').length;
  const proofCount = rows.filter((row) => Boolean(row.attachment_url)).length;
  const unpaidWithoutProof = rows.filter((row) => row.status !== 'paid' && !row.attachment_url).length;
  const isLoading = billsQuery.isLoading || metersQuery.isLoading;
  const hasError = billsQuery.isError || metersQuery.isError;

  // Payment progress is derived only from bills actually in scope — with no
  // bills it is undefined, never an invented 0%.
  const paymentProgress = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : null;
  const overdueShare = totalBilled > 0 ? (obligationsSummary.overdueAmount / totalBilled) * 100 : null;

  const partyRows = useMemo(() => RESPONSIBLE_PARTIES.map((party) => {
    const partyBills = rows.filter((row) => row.responsible_party === party);
    const billedAmount = partyBills.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const unsettledCount = partyBills.filter((row) => obligationByBillId.get(row.id)?.urgency !== 'settled').length;
    return {
      party,
      billCount: partyBills.length,
      billedAmount,
      unsettledCount,
      outstanding: obligationsSummary.remainingByResponsibleParty[party],
    };
  }), [rows, obligationByBillId, obligationsSummary]);

  const csvRows: CsvRow[] = triagedRows.map((row) => {
    const meter = row.meter_id ? meterById.get(row.meter_id) : undefined;
    const obligation = obligationByBillId.get(row.id);
    return {
      bill: row.bill_number || row.id,
      service: meter ? utilityTypeLabels[meter.utility_type] : 'خدمة عامة',
      property: propertyTitleById.get(row.property_id) || '',
      dueDate: row.due_date,
      urgency: obligation ? utilityObligationUrgencyLabels[obligation.urgency] : '',
      daysOverdue: obligation?.daysOverdue ?? 0,
      status: utilityBillStatusLabels[row.status],
      responsibleParty: responsiblePartyLabels[row.responsible_party],
      actualPayer: row.actual_payer ? responsiblePartyLabels[row.actual_payer] : '—',
      amount: row.amount,
      paid: row.paid_amount,
      remaining: utilityBillRemaining(row),
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
          { label: 'المسدد', value: money(totalPaid, currency) },
          { label: 'غير المسدد (قيد السداد)', value: money(obligationsSummary.outstandingAmount, currency) },
          { label: 'متأخر السداد بعد موعده', value: money(obligationsSummary.overdueAmount, currency) },
          { label: 'تستحق خلال أيام قليلة', value: money(obligationsSummary.dueSoonAmount, currency) },
          { label: 'فواتير معها إثبات دفع', value: proofCount },
          { label: 'فواتير غير مسددة بدون إثبات', value: unpaidWithoutProof },
        ],
      },
      {
        title: 'تفاصيل الفواتير بترتيب أولوية السداد',
        columns: ['الفاتورة', 'الخدمة', 'العقار', 'الاستحقاق', 'الحالة', 'المسؤول', 'الدافع فعليًا', 'القيمة', 'المسدد', 'المتبقي', 'أولوية السداد'],
        rows: triagedRows.map((row) => {
          const meter = row.meter_id ? meterById.get(row.meter_id) : undefined;
          const obligation = obligationByBillId.get(row.id);
          return [
            row.bill_number || row.id,
            meter ? utilityTypeLabels[meter.utility_type] : 'خدمة عامة',
            propertyTitleById.get(row.property_id) || 'عقار غير محدد',
            row.due_date,
            utilityBillStatusLabels[row.status],
            responsiblePartyLabels[row.responsible_party],
            row.actual_payer ? responsiblePartyLabels[row.actual_payer] : '—',
            money(row.amount, currency),
            money(row.paid_amount, currency),
            money(utilityBillRemaining(row), currency),
            obligation ? utilityObligationUrgencyLabels[obligation.urgency] : '—',
          ];
        }),
      },
    ],
    totalSummary: `إجمالي المستحق: ${money(totalBilled, currency)} | المسدد: ${money(totalPaid, currency)} | غير المسدد: ${money(obligationsSummary.outstandingAmount, currency)} | المتأخر: ${money(obligationsSummary.overdueAmount, currency)}`,
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

  const openUtilitiesScreen = () => {
    // Reports identify the action; the utilities workspace performs it — same
    // hand-off contract as the follow-up queue.
    void navigate({ to: '/maintenance', search: { section: 'utilities' } });
  };

  const shareActions = canExportReports ? (
    <ReportShareActions
      className="flex flex-wrap gap-2"
      reportLabel="تقرير الخدمات والمرافق"
      target={{ section: 'analytics', view: 'services', filters }}
      summaryText={`إجمالي المستحق ${money(totalBilled, currency)} · غير المسدد ${money(obligationsSummary.outstandingAmount, currency)} · المتأخر ${money(obligationsSummary.overdueAmount, currency)}`}
      onPrint={handlePrint}
      onDownloadPdf={handlePdf}
      csv={{ filename: buildReportCsvFilename('utilities-services'), rows: csvRows }}
    />
  ) : undefined;

  if (hasError) {
    return <ReportState kind="error" title="تعذر تحميل تقرير الخدمات" message="تعذر تحميل فواتير أو عدادات المرافق من المصدر المعتمد. أعد المحاولة بعد التحقق من الاتصال." />;
  }

  const billColumns: ColumnDef<UtilityBill>[] = [
    {
      key: 'bill',
      header: 'الفاتورة',
      priority: 'identity',
      render: (row) => {
        const meter = row.meter_id ? meterById.get(row.meter_id) : undefined;
        return (
          <div className="min-w-0">
            <div className="font-bold">{row.bill_number || 'فاتورة بدون رقم'}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{meter ? utilityTypeLabels[meter.utility_type] : 'خدمة عامة'}</div>
          </div>
        );
      },
    },
    {
      key: 'property',
      header: 'العقار',
      priority: 'secondary',
      render: (row) => propertyTitleById.get(row.property_id) || 'عقار غير محدد',
    },
    {
      key: 'due',
      header: 'الاستحقاق',
      priority: 'primary',
      render: (row) => {
        const obligation = obligationByBillId.get(row.id);
        return (
          <div>
            <div>{formatDateValue(row.due_date)}</div>
            {obligation?.urgency === 'overdue' ? (
              <p className="mt-0.5 text-xs font-bold text-danger">{`متأخرة ${formatLatinNumber(obligation.daysOverdue, 'ar')} يوم`}</p>
            ) : null}
            {obligation?.urgency === 'due_soon' ? (
              <p className="mt-0.5 text-xs font-bold text-warning">{`خلال ${formatLatinNumber(obligation.daysUntilDue, 'ar')} يوم`}</p>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'party',
      header: 'المسؤول',
      priority: 'secondary',
      render: (row) => (
        <div className="min-w-0">
          <div>{`على ${responsiblePartyLabels[row.responsible_party]}`}</div>
          {row.actual_payer ? (
            <div className="mt-0.5 text-xs text-muted-foreground">{`دفعها ${responsiblePartyLabels[row.actual_payer]}`}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      priority: 'primary',
      render: (row) => (
        <StatusBadge tone={statusTone[row.status]}>{utilityBillStatusLabels[row.status]}</StatusBadge>
      ),
    },
    {
      key: 'remaining',
      header: 'المتبقي',
      priority: 'primary',
      render: (row) => <span dir="ltr" className="font-bold tabular-nums">{money(utilityBillRemaining(row), currency)}</span>,
    },
    {
      key: 'proof',
      header: 'إثبات الدفع',
      priority: 'detail',
      render: (row) => (row.attachment_url
        ? <StatusBadge tone="success">يوجد إثبات</StatusBadge>
        : <span className="text-xs text-muted-foreground">—</span>),
    },
  ];

  return (
    <div className="space-y-3" data-services-report>
      <ReportSummaryStrip
        dataReportSummary="services"
        items={[
          { label: 'إجمالي المستحق', value: money(totalBilled, currency), detail: `${formatLatinNumber(rows.length, 'ar')} فاتورة` },
          { label: 'المسدد', value: money(totalPaid, currency), detail: `${formatLatinNumber(paidCount, 'ar')} فاتورة مسددة بالكامل` },
          { label: 'غير المسدد', value: money(obligationsSummary.outstandingAmount, currency), detail: `${formatLatinNumber(obligationsSummary.outstandingCount, 'ar')} فاتورة قيد السداد`, tone: obligationsSummary.outstandingAmount > 0 ? 'warning' : undefined },
          { label: 'متأخر السداد', value: money(obligationsSummary.overdueAmount, currency), detail: `${formatLatinNumber(obligationsSummary.overdueCount, 'ar')} فاتورة بعد موعدها`, tone: obligationsSummary.overdueCount > 0 ? 'critical' : undefined },
          { label: 'إثباتات الدفع', value: `${formatLatinNumber(proofCount, 'ar')}/${formatLatinNumber(rows.length, 'ar')}`, detail: 'فواتير مرتبطة بإثبات' },
        ]}
      />

      <ReportInsightNote title="قراءة الخدمات">
        {obligationsSummary.overdueCount > 0
          ? `${formatLatinNumber(obligationsSummary.overdueCount, 'ar')} فواتير متأخرة بمبلغ ${money(obligationsSummary.overdueAmount, currency)} — رتّب سدادها مع الجهة المسؤولة عنها أولًا، فالتأخر يتراكم على العقار لا على التقرير.`
          : obligationsSummary.dueSoonCount > 0
            ? `${formatLatinNumber(obligationsSummary.dueSoonCount, 'ar')} فواتير تستحق قريبًا بمبلغ ${money(obligationsSummary.dueSoonAmount, currency)}؛ جهّز السداد أو اتفاق التحميل قبل استحقاقها.`
            : unpaidWithoutProof > 0
              ? `${formatLatinNumber(unpaidWithoutProof, 'ar')} فواتير غير مسددة بدون إثبات دفع مرتبط؛ أكمل الإثباتات لتوثيق التحميل على الجهة الصحيحة.`
              : 'لا توجد متأخرات في النطاق — الالتزامات المسجلة مسددة أو مجدولة ضمن النافذة القريبة.'}
      </ReportInsightNote>

      {paymentProgress !== null && overdueShare !== null && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ReportProgress
            label="نسبة السداد من المستحق"
            value={paymentProgress}
            helper={`${money(totalPaid, currency)} من ${money(totalBilled, currency)}`}
            tone={paymentProgress >= 90 ? 'good' : paymentProgress >= 60 ? 'warning' : 'critical'}
          />
          <ReportProgress
            label="حصة المتأخر من المستحق"
            value={overdueShare}
            helper={obligationsSummary.overdueCount > 0 ? `${formatLatinNumber(obligationsSummary.overdueCount, 'ar')} فواتير بعد موعدها` : 'لا فواتير متأخرة'}
            tone={overdueShare <= 0 ? 'good' : overdueShare <= 25 ? 'warning' : 'critical'}
          />
        </div>
      )}

      <ReportPanel
        title="فواتير الخدمات والمرافق"
        description="من سجل فواتير المرافق المعتمد، مرتبة بترتيب أولوية السداد: المتأخر أولًا ثم الأقرب استحقاقًا، مع جهة التحمل والدافع الفعلي والإثبات."
        eyebrow="الخدمات"
        icon={Zap}
        isLoading={isLoading}
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={openUtilitiesScreen}
              className="min-h-11 gap-1.5 text-xs font-black text-primary"
              aria-label="فتح شاشة المرافق والعدادات لتنفيذ السداد والمتابعة"
            >
              شاشة المرافق
              <ArrowLeft className="size-3.5" aria-hidden="true" />
            </Button>
            {shareActions}
          </div>
        )}
      >
        {rows.length === 0 && !isLoading ? (
          <div className="p-4"><ReportState title="لا توجد خدمات في هذا النطاق" message="غيّر الفترة أو نطاق العقار/الوحدة لعرض فواتير الخدمات المسجلة." /></div>
        ) : (
          <div className="p-4">
            <EntityTable
              aria-label="جدول فواتير الخدمات والمرافق"
              rows={triagedRows}
              columns={billColumns}
              keyOf={(row) => row.id}
              emptyTitle="لا توجد فواتير خدمات"
              emptyDescription="لا توجد فواتير في النطاق المحدد."
            />
          </div>
        )}
      </ReportPanel>

      <ReportColumns>
        <ReportPanel
          title="غير المسدد حسب جهة التحمل"
          description="المتبقي الفعلي على كل جهة من الالتزامات غير المسددة في النطاق — كما سُجل، بلا إعادة تصنيف."
          eyebrow="من يتحمل ما تبقى؟"
          icon={CircleDollarSign}
          isLoading={isLoading}
        >
          <ReportList>
            {partyRows.map(({ party, billCount, billedAmount, unsettledCount, outstanding }) => (
              <ReportListRow
                key={party}
                title={responsiblePartyLabels[party as ResponsibleParty]}
                subtitle={`${formatLatinNumber(billCount, 'ar')} فاتورة في النطاق · ${formatLatinNumber(unsettledCount, 'ar')} غير مسددة · مستحق ${money(billedAmount, currency)}`}
                value={<span dir="ltr">{money(outstanding, currency)}</span>}
              />
            ))}
          </ReportList>
        </ReportPanel>

        <div className="space-y-4">
          <ReportInsightNote title="ملكية التكلفة">
            كل فاتورة هنا تحتفظ بجهة التحمل المسجلة — المالك أو المكتب أو المستأجر — وبالدافع الفعلي إن وُجد، بدون إعادة تصنيف مالي داخل التقرير.
          </ReportInsightNote>

          <ReportPanel
            title="أولوية السداد"
            description="ترتيب المتابعة المعتمد في شاشة المرافق: المتأخر أولًا ثم الأقرب استحقاقًا."
            eyebrow="ماذا أولًا؟"
            icon={ReceiptText}
            isLoading={isLoading}
          >
            <ReportList>
              <ReportListRow
                title={utilityObligationUrgencyLabels.overdue}
                subtitle="تجاوزت موعد الاستحقاق ولم تُسدد"
                value={`${formatLatinNumber(obligationsSummary.overdueCount, 'ar')} · ${money(obligationsSummary.overdueAmount, currency)}`}
              />
              <ReportListRow
                title={utilityObligationUrgencyLabels.due_soon}
                subtitle="تستحق خلال نافذة الأيام القريبة"
                value={`${formatLatinNumber(obligationsSummary.dueSoonCount, 'ar')} · ${money(obligationsSummary.dueSoonAmount, currency)}`}
              />
              <ReportListRow
                title="إجمالي غير المسدد"
                subtitle="كل الالتزامات غير المسددة في النطاق"
                value={`${formatLatinNumber(obligationsSummary.outstandingCount, 'ar')} · ${money(obligationsSummary.outstandingAmount, currency)}`}
              />
            </ReportList>
          </ReportPanel>
        </div>
      </ReportColumns>
    </div>
  );
}
