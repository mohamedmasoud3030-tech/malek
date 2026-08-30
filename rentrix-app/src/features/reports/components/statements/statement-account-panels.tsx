import { Download, FileSpreadsheet, Landmark, Printer, ReceiptText, Scale, UserRound, UsersRound, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatMoney, getErrorMessage } from '@/features/financials/components/financials-formatters';
import type { OwnerStatementReport, TenantStatementReport } from '@/features/financials/reports/financialReportsService';
import { createReceiptPrintHref } from '../../reports-page.helpers';
import { ReportList, ReportListRow, ReportPanel, ReportPanelSkeleton, ReportState } from '../report-section-primitives';
import { formatLatinNumber } from '@/lib/formatters';

type ReceiptRow = Readonly<{
  id: string;
  receipt_number: string;
  payment_date: string;
  amount: number;
  tenant_name: string | null;
}>;

type TenantFallbackRow = Readonly<{
  contractId: string;
  tenantName: string | null;
  totalOutstanding: number;
  totalOverdue: number;
  invoiceCount: number;
}>;

type OwnerFallbackRow = Readonly<{
  propertyId: string;
  propertyTitle: string | null;
  total: number;
  count: number;
}>;

type TenantLedgerRow = TenantStatementReport['lines'][number] & { rowKey: string };
type OwnerLedgerRow = OwnerStatementReport['transactions'][number] & { rowKey: string; runningBalance: number };

function tenantOpeningBalance(statement: TenantStatementReport) {
  const first = statement.lines[0];
  return first ? (first.balance || 0) - (first.debit || 0) + (first.credit || 0) : statement.finalBalance || 0;
}

function tenantLineType(type: string | null) {
  if (type === 'invoice') return 'فاتورة / استحقاق';
  if (type === 'receipt') return 'دفعة / إيصال';
  if (type === 'credit') return 'دائن / عكس';
  return 'حركة حساب';
}

function ownerLineType(type: string | null) {
  if (type === 'receipt') return 'تحصيل';
  if (type === 'expense') return 'مصروف';
  if (type === 'settlement') return 'تسوية / صرف';
  return 'حركة مالية';
}

function ownerCommissionSummary(type: string | null, value: number) {
  if (type === 'RATE') return `نسبة ${formatLatinNumber(value, 'ar')}٪`;
  if (type === 'FIXED_MONTHLY') return `مبلغ شهري ${formatMoney(value)}`;
  return 'غير محددة';
}

export function TenantStatementPanel({
  selectedContractId,
  statement,
  error,
  isLoading,
  fallbackRows,
  receipts,
  onPrint,
  onDownloadPdf,
  onDownloadExcel,
  actionsDisabled = false,
}: Readonly<{
  selectedContractId: string;
  statement: TenantStatementReport | undefined;
  error: unknown;
  isLoading: boolean;
  fallbackRows: TenantFallbackRow[];
  receipts: ReceiptRow[];
  onPrint: () => void;
  onDownloadPdf: () => void;
  onDownloadExcel: () => void;
  actionsDisabled?: boolean;
}>) {
  const ledgerRows: TenantLedgerRow[] = (statement?.lines ?? []).map((line, index) => ({
    ...line,
    rowKey: `${line.date ?? 'line'}-${index}`,
  }));
  const opening = statement ? tenantOpeningBalance(statement) : 0;
  const totalDebit = ledgerRows.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = ledgerRows.reduce((sum, line) => sum + (line.credit || 0), 0);
  const tenantColumns: ColumnDef<TenantLedgerRow>[] = [
    { key: 'date', header: 'التاريخ', priority: 'identity', render: (line) => <span dir="ltr" className="tabular-nums">{line.date ?? '—'}</span> },
    { key: 'type', header: 'نوع الحركة', priority: 'secondary', render: (line) => tenantLineType(line.type) },
    { key: 'description', header: 'البيان / المرجع', priority: 'secondary', render: (line) => line.description ?? 'حركة حساب' },
    { key: 'debit', header: 'مدين', priority: 'detail', render: (line) => <span dir="ltr">{formatMoney(line.debit)}</span> },
    { key: 'credit', header: 'دائن', priority: 'detail', render: (line) => <span dir="ltr">{formatMoney(line.credit)}</span> },
    { key: 'balance', header: 'الرصيد الجاري', priority: 'primary', render: (line) => <strong dir="ltr">{formatMoney(line.balance)}</strong> },
  ];

  return (
    <ReportPanel
      title="كشف حساب المستأجر"
      description="دفتر حركة فعلي للعقد المحدد: افتتاحي، استحقاقات، تحصيلات/عكوس، رصيد جارٍ وختامي."
      icon={UserRound}
      action={statement ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={onPrint} disabled={actionsDisabled} className="min-h-11 gap-1.5 text-xs">
            <Printer className="size-3.5" aria-hidden="true" />
            طباعة الكشف
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDownloadPdf} disabled={actionsDisabled} className="min-h-11 gap-1.5 text-xs">
            <Download className="size-3.5" aria-hidden="true" />
            تنزيل PDF
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDownloadExcel} className="min-h-11 gap-1.5 text-xs">
            <FileSpreadsheet className="size-3.5" aria-hidden="true" />
            تنزيل Excel
          </Button>
        </div>
      ) : undefined}
    >
      {isLoading ? (
        <ReportPanelSkeleton />
      ) : error ? (
        <div className="p-4"><ReportState kind="error" message={getErrorMessage(error, 'تعذر تحميل كشف المستأجر.')} /></div>
      ) : selectedContractId && statement?.error ? (
        <div className="p-4"><ReportState kind="error" message={getErrorMessage(statement.error, 'تعذر تحميل كشف المستأجر.')} /></div>
      ) : selectedContractId && statement && ledgerRows.length > 0 ? (
        <div className="space-y-4 p-3 sm:p-4">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
            <p className="font-black">{statement.tenantName ?? 'مستأجر غير محدد'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {statement.propertyName ?? 'عقار غير محدد'} · {statement.unitName ?? 'وحدة غير محددة'} · {statement.startDate ?? '—'} إلى {statement.endDate ?? '—'}
            </p>
            {statement.tenantPhone ? <p className="mt-1 text-xs text-muted-foreground" dir="ltr">{statement.tenantPhone}</p> : null}
          </div>
          <ResponsiveCardGrid>
            <KpiCard label="الرصيد الافتتاحي" value={formatMoney(opening)} icon={WalletCards} accent="slate" compact />
            <KpiCard label="إجمالي الاستحقاقات" value={formatMoney(totalDebit)} icon={ReceiptText} accent="primary" compact />
            <KpiCard label="إجمالي التحصيل/الدائن" value={formatMoney(totalCredit)} icon={WalletCards} accent="emerald" compact />
            <KpiCard label="الرصيد الختامي" value={formatMoney(statement.finalBalance)} icon={Scale} accent={statement.finalBalance > 0 ? 'amber' : 'emerald'} compact />
          </ResponsiveCardGrid>
          <EntityTable
            aria-label="حركات كشف حساب المستأجر"
            rows={ledgerRows}
            columns={tenantColumns}
            keyOf={(row) => row.rowKey}
            emptyTitle="لا توجد حركات في كشف المستأجر"
            emptyDescription="غيّر العقد أو نطاق التقرير ثم أعد المحاولة."
          />
        </div>
      ) : selectedContractId ? (
        <div className="p-4"><ReportState message="لا توجد حركات في كشف المستأجر لهذا العقد." /></div>
      ) : fallbackRows.length > 0 ? (
        <ReportList>
          {fallbackRows.map((row) => (
            <ReportListRow
              key={row.contractId}
              title={row.tenantName ?? 'مستأجر غير محدد'}
              subtitle={`${formatLatinNumber(row.invoiceCount, 'ar')} فواتير`}
              meta={`متأخر ${formatMoney(row.totalOverdue)}`}
              value={<span dir="ltr">{formatMoney(row.totalOutstanding)}</span>}
            />
          ))}
          {receipts.slice(0, 3).map((receipt) => (
            <ReportListRow
              key={`receipt-${receipt.id}`}
              title={<a className="inline-flex min-h-11 items-center hover:text-primary hover:underline" href={createReceiptPrintHref(receipt.id)}>{receipt.receipt_number}</a>}
              subtitle={receipt.tenant_name ?? 'مستأجر غير محدد'}
              value={<span dir="ltr">{formatMoney(receipt.amount)}</span>}
            />
          ))}
        </ReportList>
      ) : (
        <div className="p-4"><ReportState message="اختر عقدًا من فلاتر التقرير لعرض كشف المستأجر الحقيقي." /></div>
      )}
    </ReportPanel>
  );
}

export function OwnerStatementPanel({
  selectedOwnerId,
  statement,
  error,
  isLoading,
  fallbackRows,
  onPrint,
  onDownloadPdf,
  onDownloadExcel,
  onPrintProfessionalReport,
  onDownloadProfessionalReportPdf,
  actionsDisabled = false,
}: Readonly<{
  selectedOwnerId: string;
  statement: OwnerStatementReport | undefined;
  error: unknown;
  isLoading: boolean;
  fallbackRows: OwnerFallbackRow[];
  onPrint: () => void;
  onDownloadPdf: () => void;
  onDownloadExcel: () => void;
  /** Professional owner financial report pack (كشف مالك تفصيلي) — print. */
  onPrintProfessionalReport?: () => void;
  /** Professional owner financial report pack — PDF. */
  onDownloadProfessionalReportPdf?: () => void;
  actionsDisabled?: boolean;
}>) {
  let runningBalance = 0;
  const ledgerRows: OwnerLedgerRow[] = (statement?.transactions ?? []).map((transaction, index) => {
    runningBalance += transaction.net || 0;
    return { ...transaction, runningBalance, rowKey: `${transaction.date ?? 'line'}-${index}` };
  });
  const settlementMovement = ledgerRows
    .filter((row) => row.type === 'settlement')
    .reduce((sum, row) => sum + Math.abs(row.net || 0), 0);
  const properties = [...new Set(ledgerRows.map((row) => row.propertyName).filter((value): value is string => Boolean(value)))];
  const ownerColumns: ColumnDef<OwnerLedgerRow>[] = [
    { key: 'date', header: 'التاريخ', priority: 'identity', render: (row) => <span dir="ltr" className="tabular-nums">{row.date ?? '—'}</span> },
    { key: 'type', header: 'نوع الحركة', priority: 'secondary', render: (row) => ownerLineType(row.type) },
    { key: 'property', header: 'العقار', priority: 'secondary', render: (row) => row.propertyName ?? 'غير محدد' },
    { key: 'details', header: 'البيان', priority: 'secondary', render: (row) => row.details ?? 'حركة مالية' },
    { key: 'gross', header: 'إجمالي', priority: 'detail', render: (row) => <span dir="ltr">{formatMoney(row.gross)}</span> },
    { key: 'deduction', header: 'استقطاع', priority: 'detail', render: (row) => <span dir="ltr">{formatMoney(row.deduction)}</span> },
    { key: 'net', header: 'صافي الحركة', priority: 'primary', render: (row) => <strong dir="ltr">{formatMoney(row.net)}</strong> },
    { key: 'balance', header: 'الرصيد الجاري', priority: 'primary', render: (row) => <strong dir="ltr">{formatMoney(row.runningBalance)}</strong> },
  ];

  return (
    <ReportPanel
      title="كشف حساب المالك"
      description="حركة المالك للفترة: العقارات، إجمالي التحصيل/الحركة، الاستقطاعات، التسويات وصافي الرصيد الجاري."
      icon={UsersRound}
      action={statement ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={onPrint} disabled={actionsDisabled} className="min-h-11 gap-1.5 text-xs">
            <Printer className="size-3.5" aria-hidden="true" />
            طباعة الكشف
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDownloadPdf} disabled={actionsDisabled} className="min-h-11 gap-1.5 text-xs">
            <Download className="size-3.5" aria-hidden="true" />
            تنزيل PDF
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDownloadExcel} className="min-h-11 gap-1.5 text-xs">
            <FileSpreadsheet className="size-3.5" aria-hidden="true" />
            تنزيل Excel
          </Button>
          {onPrintProfessionalReport ? (
            <Button type="button" size="sm" variant="outline" onClick={onPrintProfessionalReport} disabled={actionsDisabled} className="min-h-11 gap-1.5 text-xs" title="كشف المالك التفصيلي — نسخة احترافية">
              <Printer className="size-3.5" aria-hidden="true" />
              كشف المالك التفصيلي
            </Button>
          ) : null}
          {onDownloadProfessionalReportPdf ? (
            <Button type="button" size="sm" variant="outline" onClick={onDownloadProfessionalReportPdf} disabled={actionsDisabled} className="min-h-11 gap-1.5 text-xs" title="كشف المالك التفصيلي — نسخة احترافية PDF">
              <Download className="size-3.5" aria-hidden="true" />
              كشف المالك التفصيلي PDF
            </Button>
          ) : null}
        </div>
      ) : undefined}
    >
      {isLoading ? (
        <ReportPanelSkeleton />
      ) : error ? (
        <div className="p-4"><ReportState kind="error" message={getErrorMessage(error, 'تعذر تحميل كشف المالك.')} /></div>
      ) : selectedOwnerId && statement?.error ? (
        <div className="p-4"><ReportState kind="error" message={getErrorMessage(statement.error, 'تعذر تحميل كشف المالك.')} /></div>
      ) : selectedOwnerId && statement && ledgerRows.length > 0 ? (
        <div className="space-y-4 p-3 sm:p-4">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
            <p className="font-black">{statement.ownerName ?? 'مالك غير محدد'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              الفترة: {statement.periodFrom ?? '—'} إلى {statement.periodTo ?? '—'} · العمولة: {ownerCommissionSummary(statement.commissionType, statement.commissionValue)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              العقارات في الحركة: {properties.length ? properties.join('، ') : 'غير محددة في مصدر الكشف'}
            </p>
          </div>
          <ResponsiveCardGrid>
            <KpiCard label="إجمالي الحركة/التحصيل" value={formatMoney(statement.totalGross)} icon={ReceiptText} accent="primary" compact />
            <KpiCard label="مصروفات/عمولات واستقطاعات" value={formatMoney(statement.totalDeductions)} icon={Landmark} accent="amber" compact />
            <KpiCard label="حركات التسوية/الصرف" value={formatMoney(settlementMovement)} icon={WalletCards} accent="sky" compact />
            <KpiCard label="الصافي المستحق وفق الكشف" value={formatMoney(statement.totalNet)} icon={Scale} accent={statement.totalNet >= 0 ? 'emerald' : 'rose'} compact />
          </ResponsiveCardGrid>
          <EntityTable
            aria-label="حركات كشف حساب المالك"
            rows={ledgerRows}
            columns={ownerColumns}
            keyOf={(row) => row.rowKey}
            emptyTitle="لا توجد حركات في كشف المالك"
            emptyDescription="غيّر المالك أو فترة التقرير ثم أعد المحاولة."
          />
          <p className="text-xs leading-5 text-muted-foreground">
            «حركات التسوية/الصرف» تجمع الحركات المصنفة كتسوية في الكشف، ولا تعني بالضرورة أنها مبالغ مدفوعة للمالك إلا إذا كان السجل المالي يثبت ذلك.
          </p>
        </div>
      ) : selectedOwnerId ? (
        <div className="p-4"><ReportState message="لا توجد حركات في كشف المالك للفترة المحددة." /></div>
      ) : fallbackRows.length > 0 ? (
        <ReportList>
          {fallbackRows.map((row) => (
            <ReportListRow
              key={row.propertyId}
              title={row.propertyTitle ?? 'عقار غير محدد'}
              subtitle={`${formatLatinNumber(row.count, 'ar')} حركة مصروفات`}
              value={<span dir="ltr">{formatMoney(row.total)}</span>}
            />
          ))}
        </ReportList>
      ) : (
        <div className="p-4"><ReportState message="اختر مالكًا من فلاتر التقرير لعرض كشف المالك الحقيقي." /></div>
      )}
    </ReportPanel>
  );
}
